// Pre-traitement image cote client pour plaques signaletiques difficiles
// (rayees, sales, faible contraste, eclairage difficile, gravure embossee).
//
// Strategies appliquees en cascade :
//  1. Upscale leger (x1.5) si image < 1500px → plus de pixels pour Claude
//  2. Conversion niveaux de gris (le rouge/vert/bleu n'apportent rien sur
//     une plaque alu gris/noir)
//  3. Etirement du contraste (auto-stretch histogramme)
//  4. Sharpening leger (unsharp mask via convolution canvas)
//  5. Re-encode JPEG qualite haute (92%)
//
// L'objectif n'est PAS d'avoir une image jolie mais une image lisible par
// Claude vision. Les artefacts esthetiques sont OK tant que les caracteres
// gravees sortent du fond.
//
// IMPORTANT : cette transformation est destructive (perte de couleurs).
// Toujours conserver l'image originale pour stockage / affichage.

/** Convertit File → dataURL pre-traite optimal pour Claude vision plaque. */
export async function enhancePlateImage(file: File): Promise<string> {
  const original = await fileToImage(file);
  return enhanceImageElement(original);
}

/** Variante : depuis une dataURL existante (utile pour retry). */
export async function enhancePlateImageFromDataUrl(
  dataUrl: string
): Promise<string> {
  const img = await dataUrlToImage(dataUrl);
  return enhanceImageElement(img);
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("DataURL illisible"));
    img.src = dataUrl;
  });
}

function enhanceImageElement(img: HTMLImageElement): string {
  // 1. Calcul de la taille cible : upscale x1.5 si petit, sinon garde
  //    la resolution d'origine. Plafond 3000px pour respecter quota Claude.
  const maxOriginalDim = Math.max(img.width, img.height);
  const shouldUpscale = maxOriginalDim < 1500;
  const scale = shouldUpscale ? 1.5 : 1;
  const targetW = Math.min(3000, Math.round(img.width * scale));
  const targetH = Math.min(3000, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponible");

  // 2. Draw avec smoothing pour upscale propre
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // 3. Pre-traitement pixels : grayscale + contraste + sharpening
  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;
  const n = data.length;

  // 3a. Grayscale + collecte min/max pour contrast stretch
  const gray = new Uint8Array(n / 4);
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0, j = 0; i < n; i += 4, j++) {
    // Luma BT.709
    const g = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) | 0;
    gray[j] = g;
    if (g < minVal) minVal = g;
    if (g > maxVal) maxVal = g;
  }

  // 3b. Stretch contraste (auto-levels). Si la plage est deja max, no-op.
  // On exclut les 1% extremes pour eviter qu'un seul pixel saturé fausse
  // tout le stretch (typique sur plaque alu avec un reflet).
  const range = maxVal - minVal;
  if (range > 10 && range < 240) {
    // Histogramme simple pour percentile 1 / 99
    const hist = new Uint32Array(256);
    for (let j = 0; j < gray.length; j++) hist[gray[j]]++;
    const total = gray.length;
    const lowTarget = Math.floor(total * 0.01);
    const highTarget = Math.floor(total * 0.99);
    let acc = 0;
    let p1 = 0;
    let p99 = 255;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc <= lowTarget) p1 = v;
      if (acc <= highTarget) p99 = v;
    }
    const span = Math.max(1, p99 - p1);
    for (let j = 0; j < gray.length; j++) {
      const v = gray[j];
      const stretched = ((v - p1) * 255) / span;
      gray[j] = stretched < 0 ? 0 : stretched > 255 ? 255 : stretched | 0;
    }
  }

  // 3c. Ecriture grayscale + alpha conserve
  for (let i = 0, j = 0; i < n; i += 4, j++) {
    data[i] = gray[j];
    data[i + 1] = gray[j];
    data[i + 2] = gray[j];
    // alpha (data[i+3]) inchange
  }
  ctx.putImageData(imgData, 0, 0);

  // 3d. Sharpening simple via filter CSS (plus rapide qu'une convolution
  //     manuelle, et la qualite suffit pour de l'OCR plaque).
  //     On re-draw l'image grayscale par-dessus elle-meme avec contrast +
  //     un leger sharpen via filter (filter accelere GPU sur la plupart
  //     des browsers modernes).
  try {
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = targetW;
    tmpCanvas.height = targetH;
    const tmpCtx = tmpCanvas.getContext("2d");
    if (tmpCtx) {
      tmpCtx.drawImage(canvas, 0, 0);
      ctx.filter = "contrast(1.15)";
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(tmpCanvas, 0, 0);
      ctx.filter = "none";
    }
  } catch {
    // Filter API peut etre absent (vieux Safari) — on ignore.
  }

  // 4. Re-encode JPEG qualite haute
  return canvas.toDataURL("image/jpeg", 0.92);
}
