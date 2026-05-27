@AGENTS.md

# Vertxia — guide rapide pour Claude

## Source de vérité design / brand

Avant tout contenu visuel ou éditorial pour Vertxia, lis ces deux fichiers :

- **`docs/brand-guidelines.md`** — voice, ton, vocabulaire interdit, ICP, messaging framework, tagline officielle, signatures par canal (Insta, TikTok, email, LinkedIn). Source de vérité pour TOUT contenu marketing/sales (DMs, Reels captions, landings, emails).
- **`design-system/vertxia/MASTER.md`** + **`tokens.json`** — palette, typo, spacing tokenisés. Persisté par le skill `ui-ux-pro-max`. Pour changer la direction visuelle, édite `design-system/vertxia/tokens.json` puis re-génère le CSS via :
  ```bash
  node ~/.claude/skills/design-system/scripts/generate-tokens.cjs \
    --config design-system/vertxia/tokens.json \
    --output design-system/vertxia/tokens.css --format css
  ```

## Direction visuelle actuelle (v1)

**Premium Dark Cinema** — warm stone `#1C1917` + gold accent `#A16207`, Calistoga display + Inter body. Inspiration : Magic Window (Active Theory). Pas de pur `#000` (OLED smear), pas de violet/cyan saturés.

## Tokens Tailwind disponibles (cf. `app/globals.css`)

Utilities sémantiques générées via le skill `design-system` :
- `bg-background` / `text-foreground` — fond et texte par défaut
- `bg-surface` — cards / panels
- `bg-accent` / `text-accent` / `hover:bg-accent-hover` — CTA gold
- `border-border` / `border-border-strong` — borders
- `text-muted` / `text-muted-foreground` — captions

**Anti-pattern** : ne JAMAIS ajouter de hex code Tailwind type `bg-[#1C1917]` — utilise toujours les tokens sémantiques. Si une couleur manque, ajoute-la d'abord dans `design-system/vertxia/tokens.json`.

## Règles éditoriales non-négociables

- **Email business** : `emilien@vertxia.com` (jamais `linkii669@gmail.com`)
- **Instagram tag** : `@vertxia.fr`
- **Tutoiement** : toujours "tu" en social/DMs, jamais "vous"
- **Interdit verbatim** : "ex-Marine", "atomicien", "Marine Nationale" (cf. brand-guidelines § 4)
- **Mots interdits** : révolutionnaire, innovant, disruptif, game changer, synergie, best-in-class, plug-and-play, magique

## Architecture skills installées

Les skills `ui-ux-pro-max`, `design-system`, `brand`, `ui-styling`, `design`, `slides`, `banner-design` sont installés globalement dans `~/.claude/skills/` et s'auto-déclenchent selon le contexte. Pour les invoquer manuellement, voir leurs SKILL.md respectifs.
