# Vertxia — Brand Guidelines v1.0

> Last updated: 2026-05-27
> Status: Draft v1 — pivot Vertxia Day 3
> Owner: Emilien Behague

## Quick Reference

| Element | Value |
|---------|-------|
| Brand name | **Vertxia** |
| Tagline | "L'IA qui transforme ton Shopify en site 3D cinéma" |
| Primary background | `#1C1917` (warm stone-900) |
| Accent (CTA) | `#A16207` (gold) |
| Display font | Calistoga |
| Body font | Inter |
| Voice | Direct · Technique · Confiante · Build-in-public · Pas de corporate BS |
| Email business | `emilien@vertxia.com` |
| Instagram | `@vertxia.fr` |
| Domaine | `vertxia.com` |
| Founder | Emilien Behague (Toulon, FR) |

---

## 1. Positionnement & ICP

### Promesse produit
Vertxia transforme une URL Shopify en site e-commerce 3D immersif en 4 minutes. L'IA scrape les produits, génère le mesh 3D et publie un site cinématique sur le domaine du client.

### Customer fit (ICP)
- **Marques D2C** françaises ou européennes
- **Streetwear, fashion, lifestyle, déco design, boutiques tech**
- 10-100 produits au catalogue
- CA 10k€ → 500k€/an
- Founder solo ou petite équipe (≤5 personnes)
- Déjà présents sur Instagram/TikTok (savent l'importance du visuel)
- Frustrés par leur Shopify "comme les autres"

### Pas pour
- Gros e-commerçants déjà saturés en outils (Cdiscount, La Redoute)
- B2B SaaS sans produits physiques
- Marketplaces multi-vendeurs (trop hétérogène)
- Clients qui veulent un site WordPress classique

---

## 2. Color Palette

> Source de vérité : `design-system/vertxia/tokens.json` + `tokens.css`

### Primary (Premium Dark Cinema)

| Name | Hex | Token | Usage |
|------|-----|-------|-------|
| Background | `#1C1917` | `--color-background` | Fond app, warm stone-900 (PAS pur #000) |
| Foreground | `#FAFAF9` | `--color-foreground` | Texte sur fond, cream warm |
| Surface | `#292524` | `--color-surface` | Cartes, panels (stone-800) |
| Accent CTA | `#A16207` | `--color-accent` | Gold — boutons primaires, highlights |
| Accent Hover | `#854D0E` | `--color-accent-hover` | Hover des CTAs |

### Neutral

| Name | Hex | Token | Usage |
|------|-----|-------|-------|
| Secondary | `#44403C` | `--color-secondary` | Texte secondaire |
| Muted | `#78716C` | `--color-muted` | Captions, tertiary |
| Border | `#44403C` | `--color-border` | Borders subtils |
| Border-strong | `#57534E` | `--color-border-strong` | Borders accentués |

### Semantic

| State | Hex | Token | Usage |
|-------|-----|-------|-------|
| Destructive | `#DC2626` | `--color-destructive` | Erreurs only |

### Accessibility
- Texte cream sur fond stone : 14.6:1 (AAA)
- Accent gold sur fond stone : 5.2:1 (AA passé)
- Tous les CTAs respectent WCAG 2.1 AA

### Anti-patterns palette
- ❌ **Pur `#000000`** : OLED smear, donne un look "youtube banner amateur"
- ❌ **Violet/magenta saturé** : trop "videogame", pas "agence premium"
- ❌ **Cyan/turquoise** : sort de la palette mono-warm
- ❌ **Plus d'1 accent à la fois** : 1 gold suffit, multiplier les couleurs casse l'élégance

---

## 3. Typography

### Font Stack

```css
--font-display: 'Calistoga', Georgia, serif;       /* hero, h1, moments éditoriaux */
--font-sans: 'Inter', system-ui, sans-serif;       /* body, UI, paragraphes */
--font-mono: 'JetBrains Mono', ui-monospace;       /* data, labels, timecodes */
```

### Type Scale (Tailwind)

| Element | Class | Usage |
|---------|-------|-------|
| Hero brand | `font-display text-[clamp(4rem,12vw,11rem)]` | "VERTXIA" / vendor name |
| H1 page | `font-display text-4xl md:text-7xl` | Chapter titles, CTA |
| H2 section | `text-3xl md:text-6xl` | Sections, sous-titres |
| Body large | `text-base md:text-lg` | Paragraphes principaux |
| Body | `text-sm md:text-base` | Texte standard |
| Caption mono | `font-mono text-xs tracking-[0.3em]` | Labels "CHAPITRE 01", timecodes |
| Tiny mono | `font-mono text-[10px] tracking-[0.4em]` | Tags meta "✓ GÉNÉRÉ EN LIVE" |

### Hiérarchie typographique
- **Calistoga** réservé aux moments dramatiques (hero, chapter titles)
- **Inter** = par défaut partout ailleurs
- **JetBrains Mono** = data tech, labels système, signatures éditoriales

---

## 4. Voice & Tone

### Personnalité de marque

| Trait | Description |
|-------|-------------|
| **Direct** | Phrases courtes, action-driven, pas de blabla |
| **Technique** | On parle mesh, GLB, polygones, ScrollTrigger — sans condescension |
| **Confiante** | "Vertxia génère X en 4 min" pas "Vertxia pourrait peut-être..." |
| **Build-in-public** | Tu ship en transparence, tu montres les ratés autant que les wins |
| **Pas corporate** | Zéro "Notre solution permet de...". Pas de Vous, on tutoie. |

### Voice chart

| Trait | We are | We are not |
|-------|--------|------------|
| Direct | "Tes produits en 3D, 4 min" | "Notre solution révolutionne..." |
| Technique | "Mesh 300k poly, PBR" | "Stunning quality visuals" |
| Confiante | "Je te livre ton site complet" | "On essaiera de faire au mieux" |
| Build-in-public | "Day 3, on a chopé 2 prospects" | "Founded by a passionate team" |
| Indépendant | Solo founder qui code, vend, livre | Startup VC avec roadmap fluffy |

### Tone par contexte

| Contexte | Tone | Exemple |
|----------|------|---------|
| **DM cold prospect** | Chaleureux, ciblé, low-pressure | "Salut ! Tes TN Tees seraient parfaits en 3D, envoie-moi ton préféré et je te fais une démo perso cet aprem." |
| **Réponse commentaire Insta** | Court, redirige vers démo | "Démo gratuite ici → vertxia.com/try. Pour ton site complet, DM." |
| **Caption Reel** | Hook + valeur + CTA | "Day 3 du build in public. J'ai chopé 2 prospects en commentaires. Voilà ce qu'on a sorti aujourd'hui ↓" |
| **Email business** | Pro, structuré, direct | "Salut [prénom], j'ai vu ton site [URL]. Voici ce que Vertxia peut générer pour toi : [demo URL]. Tu veux qu'on en parle ?" |
| **Erreur app** | Calme, solution claire | "La génération a échoué — réessaie ou écris-moi à emilien@vertxia.com" |
| **Documentation** | Clair, instructionnel | "Colle l'URL de ta boutique Shopify, clique Générer, attends 4 min." |

### Vocabulaire — Vertxia parle comme ça

**On dit** :
- Générer / génération
- Boutique 3D / site 3D immersif
- Cinématique / cinéma
- Mesh / GLB / polygones
- Sur ton domaine
- Build in public
- Day N (compteur transparence)
- "On" collaboratif ("on construit la tienne")
- "Tu" (toujours, jamais "vous" en social)

**On dit PAS** :
| À éviter | Pourquoi |
|----------|----------|
| Révolutionnaire | Vide, overused |
| Innovant | Buzzword startup |
| Solution clé en main | Corporate cliché |
| Game changer | Hype vide |
| Disruptif | Bullshit valley |
| Synergie | Corporate jargon |
| Best-in-class | Auto-congratulation vague |
| Plug and play | Cliché tech |
| Magique / magie | Évite le mystère, on est technique |
| Boost | Lazy hype word |

### Règles de fond — verbatim
**Per `CLAUDE.md` règle 16** : NE JAMAIS mentionner "ex-Marine", "atomicien", "Marine Nationale" dans tout contenu public Vertxia (Reels, captions, DMs, landing, posts LinkedIn). Demande explicite Emilien 25/05/2026.

---

## 5. Messaging Framework

### Tagline officielle
> **L'IA qui transforme ton Shopify en site 3D cinéma**

### Variantes courtes (selon contexte)
- TikTok hook : "Ton Shopify → site 3D en 4 min"
- Email subject : "Démo Vertxia 3D pour [marque]"
- Insta bio : "Site 3D cinéma pour ton Shopify / 4 min / Build in public"

### Pitch 30 sec
> "Vertxia transforme n'importe quelle boutique Shopify en site 3D immersif en 4 minutes. Tu colles ton URL, l'IA scrape tes produits, génère le mesh 3D et publie un site cinématique sur ton domaine. Build in public, solo founder."

### Pitch 10 sec
> "Tes produits Shopify en 3D, sur ton domaine, en 4 minutes."

### Pitch 1 ligne
> "Vertxia, c'est Shopify mais en 3D cinéma."

### Bénéfices (par ordre d'impact)
1. **Différenciation visuelle** : tes produits ne ressemblent plus aux 10000 autres boutiques Shopify
2. **Conversion** : interaction 3D = engagement × 3 vs photo plate
3. **Viralité Reels** : ton site = un asset TikTok par défaut
4. **Domaine perso** : tu possèdes l'expérience, pas un lien Linktree
5. **Vitesse** : 4 min vs 3 mois pour une agence

### Objections + réponses

| Objection | Réponse |
|-----------|---------|
| "C'est cher" | "Premier site démo gratuit. On parle prix QUAND tu vois le rendu." |
| "On est pas sur Shopify" | "Aucun souci — la 3D se génère depuis une image, peu importe la plateforme." |
| "C'est compliqué à intégrer" | "Tu reçois une URL hébergée sur ton domaine. Zéro install, zéro plugin." |
| "Ça va casser ma SEO" | "Le site 3D peut cohabiter avec ton Shopify principal — landing 3D + funnel classique." |
| "Pas convaincu par la 3D" | "Regarde le démo live ici : vertxia.com/demo. Si ça t'évoque rien, pas grave." |

---

## 6. Visual Identity

### Direction
**Premium Dark Cinema** — référence : Magic Window AR (Active Theory), agences premium type Yota.aagency.

### Imagery style
- **Photographie** : low-light, contrast dramatique, mono-warm
- **3D renders** : warm rim lights (gold/amber), pas de cyan/violet saturé
- **Backgrounds** : warm stone, jamais pur noir
- **Atmosphère** : fog volumetric, particules cream/gold subtiles, blur backdrop pour cards

### Anti-patterns visuels
- ❌ Pur `#000000` background (OLED smear, look amateur)
- ❌ Palette arc-en-ciel (violet + cyan + emerald = videogame)
- ❌ Iridescence sur mesh texturés (sheen huileux moche)
- ❌ Chromatic aberration sur mesh à 300k poly (amplifie artefacts)
- ❌ Sparkles/quads visibles sous bloom

### Logo / Wordmark
État actuel : **WORDMARK uniquement** en Calistoga "VERTXIA" — pas de logo iconique.
À développer : pictogramme V/X minimal (étape 4 — skill `design` logo gen).

---

## 7. Channels & Signatures

### Instagram (@vertxia.fr)
- **Reels** : 1 par jour, Day N counter en intro, ratio 9:16
- **Stories** : daily build-in-public (code, screenshots, prospects)
- **Bio** : "L'IA qui transforme ton Shopify en site 3D cinéma / Build in public / 🔗 vertxia.com"
- **Caption format** : hook 1 ligne → contexte 2 lignes → CTA 1 ligne

### TikTok
- Cross-post Reels Insta
- Hooks plus aggressifs autorisés (TikTok culture)

### Email signature (`emilien@vertxia.com`)
```
Emilien Behague
Vertxia — site 3D cinéma pour ton Shopify
vertxia.com · @vertxia.fr
```

### LinkedIn (linkedin.com/in/emilien-behague-9697a1364)
- Posts hebdo build-in-public
- Format storytelling 5-8 lignes max

---

## 8. Approval Checklist (pré-publication)

Avant de publier du contenu Vertxia (Reel, post, DM, landing, email) :

- [ ] Tagline ou pitch respecte la voice (direct, pas corporate)
- [ ] Couleurs alignées palette (warm stone + gold, pas de violet/cyan)
- [ ] Aucun mot prohibé (révolutionnaire, innovant, disruptif, etc.)
- [ ] Aucune mention "ex-Marine" / "atomicien" / "Marine Nationale"
- [ ] CTA explicite et unique (1 seul par contenu)
- [ ] Email = `emilien@vertxia.com` (pas `linkii669@gmail.com`)
- [ ] Insta tag = `@vertxia.fr`
- [ ] Tu tutoies, jamais "vous" en social

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-27 | Initial guidelines — pivot Vertxia Day 3 |
