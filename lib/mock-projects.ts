/**
 * Mock projects pour la Floating Gallery cinematic multi-couches.
 *
 * 3 couches de profondeur — VERSION LIGHT (25 cards total, demandee par Emilien 2026-05-29) :
 *
 *  FOREGROUND_PROJECTS  —  5 hero (gros, nets, interactifs, parallax fort)
 *  MIDGROUND_PROJECTS   —  8 supporting (images, opacity 0.75, parallax moyen)
 *  BACKGROUND_FAR       — 12 lointaines (images, opacity 0.5, parallax leger, partiel viewport)
 *
 * Pas de dust tiles colorees (rendu trop kitsch). Vraies images uniquement.
 */

export type MockProject = {
  id: string;
  label: string;
  category: string;
  hint: string;
  imageUrl: string;
  position: [number, number, number];
  scale: [number, number];
  liveSlug?: string;
};

export type MidProject = {
  id: string;
  imageUrl: string;
  position: [number, number, number];
  scale: [number, number];
  opacity: number;
  speed: number;
};

export type BackgroundFar = {
  id: string;
  imageUrl: string;
  position: [number, number, number];
  scale: [number, number];
  opacity: number;
  speed: number;
};

const u = (seed: string) => `https://picsum.photos/seed/${seed}/640/400`;
const uSmall = (seed: string) => `https://picsum.photos/seed/${seed}/320/200`;

/* =================================================================
 *  FOREGROUND — 5 hero (interactifs)
 * ================================================================= */

export const FOREGROUND_PROJECTS: MockProject[] = [
  {
    id: "aman-svetistefan",
    label: "Aman Sveti Stefan",
    category: "Hospitality",
    hint: "Boutique resort · Cinematic narrative",
    imageUrl: u("aman-resort"),
    position: [-2.8, 1.3, 0.4],
    scale: [2.0, 1.25],
  },
  {
    id: "porsche-heritage",
    label: "Porsche Heritage",
    category: "Automotive",
    hint: "Launch campaign · Performance specs",
    imageUrl: u("porsche-heritage"),
    position: [3.6, 1.8, -0.6],
    scale: [2.2, 1.4],
  },
  {
    id: "margiela-edition",
    label: "Margiela · Édition",
    category: "Fashion Editorial",
    hint: "Lookbook · Drop culture",
    imageUrl: u("margiela-edition"),
    position: [3.4, -0.8, 0.2],
    scale: [1.7, 2.2],
  },
  {
    id: "loom-vestiaire",
    label: "Loom · Vestiaire",
    category: "Fashion",
    hint: "Cinematic narrative · Film grain",
    imageUrl: u("loom-vestiaire"),
    position: [-3.2, -1.0, -0.2],
    scale: [1.8, 1.15],
    liveSlug: "loom_fr",
  },
  {
    id: "allbirds-sugar",
    label: "Allbirds · Sugar",
    category: "Editorial",
    hint: "Halftone print · Sugar collection",
    imageUrl: u("allbirds-sugar"),
    position: [0.4, -1.7, 0.6],
    scale: [1.7, 1.05],
    liveSlug: "allbirds_com",
  },
];

/* Legacy export pour la page /app/projects */
export const MOCK_PROJECTS: MockProject[] = [
  ...FOREGROUND_PROJECTS,
  {
    id: "cartier-tank",
    label: "Cartier Tank Solo",
    category: "Luxury Watch",
    hint: "Macro editorial · Brand storytelling",
    imageUrl: u("cartier-watch"),
    position: [-4.2, -0.4, -0.6],
    scale: [1.6, 1.0],
  },
  {
    id: "riva-aquariva",
    label: "Riva Aquariva Super",
    category: "Yacht · Luxury",
    hint: "Heritage storytelling · Italian crafted",
    imageUrl: u("riva-yacht"),
    position: [-3.4, -1.7, -1.6],
    scale: [1.9, 1.2],
  },
  {
    id: "fenty-launch",
    label: "Fenty · Launch",
    category: "Beauty Campaign",
    hint: "Drop culture · Editorial cinematic",
    imageUrl: u("fenty-launch"),
    position: [1.3, -1.85, -1.0],
    scale: [1.3, 1.6],
  },
];

/* =================================================================
 *  MIDGROUND — 8 supporting (semi-transparents, parallax moyen)
 * ================================================================= */

export const MIDGROUND_PROJECTS: MidProject[] = [
  { id: "m1", imageUrl: u("m-cartier-watch"),    position: [-5.8, 2.4, -2.8], scale: [1.4, 0.9],  opacity: 0.82, speed: 0.4  },
  { id: "m2", imageUrl: u("m-riva-yacht"),       position: [ 5.6, 2.0, -3.0], scale: [1.5, 0.95], opacity: 0.78, speed: 0.45 },
  { id: "m3", imageUrl: u("m-fenty-beauty"),     position: [-6.4,-0.6, -3.2], scale: [1.2, 1.5],  opacity: 0.76, speed: 0.55 },
  { id: "m4", imageUrl: u("m-perfume-bottle"),   position: [ 6.0,-1.2, -2.6], scale: [1.1, 1.4],  opacity: 0.80, speed: 0.50 },
  { id: "m5", imageUrl: u("m-fashion-runway"),   position: [-2.0, 3.6, -3.4], scale: [1.3, 1.65], opacity: 0.72, speed: 0.42 },
  { id: "m6", imageUrl: u("m-luxury-interior"),  position: [ 1.6, 3.4, -2.9], scale: [1.6, 1.0],  opacity: 0.74, speed: 0.48 },
  { id: "m7", imageUrl: u("m-coffee-aesthetic"), position: [-4.6,-2.6, -3.0], scale: [1.3, 0.85], opacity: 0.76, speed: 0.52 },
  { id: "m8", imageUrl: u("m-supercar-detail"),  position: [ 4.0,-2.8, -3.3], scale: [1.5, 0.95], opacity: 0.80, speed: 0.46 },
];

/* =================================================================
 *  BACKGROUND FAR — 12 lointaines (visibles mais lointaines)
 *  z range : -4.5 a -6.0
 *  Certaines positionnees en bord de viewport pour la sensation "ca continue"
 * ================================================================= */

export const BACKGROUND_FAR: BackgroundFar[] = [
  { id: "bf1",  imageUrl: uSmall("bf-product-1"),      position: [-8.2,  3.8, -5.2], scale: [1.4, 0.9],  opacity: 0.48, speed: 0.20 },
  { id: "bf2",  imageUrl: uSmall("bf-fashion-1"),      position: [ 8.0,  3.2, -5.5], scale: [1.2, 1.6],  opacity: 0.52, speed: 0.22 },
  { id: "bf3",  imageUrl: uSmall("bf-architecture-1"), position: [-9.0, -0.4, -5.8], scale: [1.5, 1.0],  opacity: 0.45, speed: 0.18 },
  { id: "bf4",  imageUrl: uSmall("bf-watch-1"),        position: [ 8.8, -1.8, -5.0], scale: [1.0, 0.95], opacity: 0.55, speed: 0.25 },
  { id: "bf5",  imageUrl: uSmall("bf-beauty-1"),       position: [-7.4, -3.6, -5.5], scale: [1.3, 1.6],  opacity: 0.48, speed: 0.20 },
  { id: "bf6",  imageUrl: uSmall("bf-yacht-1"),        position: [ 7.2, -3.8, -5.2], scale: [1.6, 1.0],  opacity: 0.52, speed: 0.23 },
  { id: "bf7",  imageUrl: uSmall("bf-portrait-1"),     position: [-3.2,  4.8, -5.6], scale: [1.2, 1.5],  opacity: 0.46, speed: 0.21 },
  { id: "bf8",  imageUrl: uSmall("bf-runway-1"),       position: [ 3.8,  4.5, -5.3], scale: [1.3, 1.0],  opacity: 0.50, speed: 0.24 },
  { id: "bf9",  imageUrl: uSmall("bf-interior-1"),     position: [-0.5,  5.6, -5.8], scale: [1.8, 1.1],  opacity: 0.42, speed: 0.18 },
  { id: "bf10", imageUrl: uSmall("bf-jewel-1"),        position: [-5.0,  1.0, -5.0], scale: [1.0, 1.4],  opacity: 0.55, speed: 0.26 },
  { id: "bf11", imageUrl: uSmall("bf-marble-1"),       position: [ 5.5,  0.4, -5.4], scale: [1.4, 0.9],  opacity: 0.50, speed: 0.22 },
  { id: "bf12", imageUrl: uSmall("bf-food-1"),         position: [ 0.2, -4.5, -5.7], scale: [1.5, 1.0],  opacity: 0.46, speed: 0.20 },
];
