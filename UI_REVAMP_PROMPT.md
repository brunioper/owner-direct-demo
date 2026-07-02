# UI/UX Revamp Prompt — Owner Direct Uruguay

> Hand this entire file to a build agent (or Claude Code) as the single instruction
> for the visual revamp. It is self-contained: context, rules, tokens, specs,
> per-screen requirements, and the acceptance protocol are all here.

---

## Mission

Rebuild the visual layer of Owner Direct from scratch into one clean, coherent,
luxury-editorial design system — **without changing any functionality**. The app
works; the CSS is the problem. You are replacing an accreted 7,400-line
`styles.css` (five stacked redesigns, 625 `!important`s, 36 leftover blue hex
codes, 12 different border radii, and rules referencing a font that is never
loaded) with a single-system stylesheet of ≤ 2,800 lines.

**Product**: premium owner-to-buyer real estate platform for Uruguay. Spanish
only. It sells trust through radical transparency — real costs, real scores,
real deficiencies. Every visual decision must read as *calm, confident,
verifiable* — never hype.

**Stack**: vanilla HTML/CSS/JS. One `index.html` (views toggled via
`body[data-view]` + `.view.active`), `app.js` renders everything, `server.js`
serves on port 4173 (`node server.js`). No build step. Deployed on Render from
`main`.

---

## Non-negotiable ground rules

1. **Rewrite, don't patch.** Write a brand-new `styles.css` from a blank file.
   Never append override blocks. The old file is in git history for reference.
2. **DOM contract is frozen.** `app.js` queries hundreds of specific IDs and
   classes (`#aiSearchBtn`, `#clientPropertyGrid`, `.property-card`,
   `#propertyModal`, `.pill-nav`, `#backofficeDashboard`, `.dash-stat-num`,
   `#modelManagerGrid`, `#chatWidget`, `.mortgage-calc`, dialogs
   `#loginDialog` / `#manualDialog` / `#compareDialog`, `#roomSheet`, …).
   You may restyle everything; you may not rename/remove any ID or class that
   JS or inline HTML uses. Verify with grep before deleting any selector name.
3. **One token block.** Every color, font, radius, shadow, spacing, and
   duration lives in a single `:root`. A raw hex value outside `:root` is a
   defect. Semantic states (ok/warn/bad) included.
4. **Zero `!important`.** Target 0; hard cap 10, each with a comment explaining
   the load-order reason. If you need one, your cascade is wrong — fix the
   cascade.
5. **Spanish only** in all UI copy. No English fallbacks.
6. **Product rules from CLAUDE.md still apply**: no fake urgency, no
   superlatives, max 1 primary CTA per screen, never hide missing data (show
   `⚠ Pendiente`), skeletons not spinners, no agent contact info.

---

## Design language — "Sotheby's ledger"

Luxury editorial. A dark navy stage for the hero; warm cream paper for
everything else; gold used sparingly as the single accent; serif display type
doing the talking. Think auction-house catalog, not tech dashboard.

### Color tokens (the palette is settled — do not invent a new one)

```css
:root {
  /* canvas */
  --night:      #0A1420;  /* hero / dark stage (gradient to #0D1B2A allowed) */
  --cream:      #F8F5EF;  /* page background */
  --paper:      #FFFFFF;  /* card surfaces */
  --sand:       #F0EBE2;  /* subtle fills, hover washes, table stripes */
  /* ink */
  --ink:        #1A1008;  /* primary text */
  --ink-soft:   #5A4E3C;  /* secondary text */
  --muted:      #A89880;  /* labels, captions */
  --faint:      #C8BCA8;  /* disabled, hairline text */
  --cream-ink:  #F5F0E8;  /* text on dark */
  /* accent — ONE family */
  --gold:       #C9A84C;
  --gold-deep:  #B8973B;  /* hover */
  --gold-wash:  rgba(201,168,76,0.12);
  /* lines */
  --line:       #E8E0D0;
  --line-soft:  #F0EBE2;
  /* semantics (warm-shifted, low saturation) */
  --ok:         #4C8F6D;  --ok-wash:   rgba(76,143,109,0.12);
  --warn:       #C9862B;  --warn-wash: rgba(201,134,43,0.12);
  --bad:        #B0483B;  --bad-wash:  rgba(176,72,59,0.10);
}
```

**Forbidden**: any blue (`#0071e3`, `#2558B8`, `#1E3A5F`, `#4F46E5`,
`#2B6CB0`, iOS system blue, `--color-accent` blue tokens), pure `#000`/`#FFF`
for text, Apple-flat gray palettes (`#1d1d1f`, `#f5f5f7`, `#d2d2d7`).

### Typography — two families, loaded and used

Fix the font mess: `index.html` currently loads Cormorant Garamond, Fraunces,
Inter, and Playfair Display, while the CSS references DM Sans which is **not
loaded at all**. Replace the Google Fonts URL to load exactly:

- **Cormorant Garamond** 300, 400, italic 300/400 — display, prices, section
  headings, stat numbers.
- **DM Sans** 300, 400, 500 — body, UI, labels, buttons, forms.

Remove Inter, Fraunces, Playfair from the URL and from every CSS rule.

Type scale (define as tokens):

| token | font | size | use |
|---|---|---|---|
| `--t-hero` | Cormorant 300 | clamp(46px, 5vw, 76px), lh 1.02 | hero H2 |
| `--t-display` | Cormorant 300 | clamp(30px, 3.2vw, 48px) | results heading, prices, dash stats |
| `--t-title` | Cormorant 400 | 22–26px | card titles, modal H2, panel H3 |
| `--t-body` | DM Sans 400 | 14px / 1.6 | default |
| `--t-small` | DM Sans 400 | 12px | meta, captions |
| `--t-caps` | DM Sans 500 | 10px, tracking .18em, uppercase, `--gold` or `--muted` | eyebrows, section labels, nav |

### Geometry, elevation, motion

- **Radius scale — exactly three**: `--r-card: 4px` (cards, panels, modals,
  inputs), `--r-tight: 2px` (buttons, chips inside dense UI), `--r-pill: 999px`
  (pills, badges, nav capsule). Nothing else.
- **Shadows — warm-tinted, three levels**:
  `--e1: 0 1px 3px rgba(26,16,8,.07), 0 4px 14px rgba(26,16,8,.04)` (resting card),
  `--e2: 0 12px 48px rgba(26,16,8,.13)` (hover / dropdown),
  `--e3: 0 24px 80px rgba(26,16,8,.22)` (modal / sheet).
- **Motion**: micro-interactions 150–200ms ease-out; cards/overlays 350ms
  `cubic-bezier(0.22,1,0.36,1)`; card hover = translateY(-4px) + `--e2`;
  photo zoom 1.04 on card hover; everything wrapped in a
  `@media (prefers-reduced-motion: reduce)` kill switch. No animation > 500ms.

### Buttons — three variants, used everywhere consistently

- `btn-primary`: `--gold` bg, `--ink` text, `--r-tight`, DM Sans 500 11px caps
  tracking .12em. Hover `--gold-deep`. (Buscar con IA, Guardar, Publicar.)
- `btn-dark`: `--ink` bg, `--cream-ink` text. (Ingresar, secondary CTAs on cream.)
- `btn-ghost`: transparent, 1px `--line` border, `--ink-soft` text; hover
  inverts to `--ink` bg. (Cancelar, Limpiar, chips, Editar.)
- Destructive: ghost with `--bad` text/border. (Borrar.)
- Focus-visible for ALL interactive elements: `0 0 0 3px var(--gold-wash)` +
  1px `--gold` border. Never a blue ring. Touch targets ≥ 44px on mobile.

---

## Screen-by-screen requirements

Work through these in order. Every screen must be verified logged-out AND as
admin (`admin@admin.com` / `1234`).

### 1. Marketplace (`body[data-view="marketplace"]`) — the flagship
- **Pill nav** (`.pill-nav`): white capsule, `--e1`, serif logo, DM Sans caps
  links, active link = `--ink` bg pill. Role links (Backoffice/Cargar/Admin IA)
  appear for admin — keep that logic visible and styled.
- **Hero** (`.panel-head`): `--night` gradient stage, ≤ 460px tall, gold caps
  eyebrow, `--t-hero` serif headline with gold italic `em`, outline trust
  pills. Keep the existing centered layout math
  (`max(24px, calc((100% - 1320px)/2))`).
- **Search** (`.ai-search-hero`): cream band, white input (`--r-card`,
  `--line` border, gold focus ring), gold `#aiSearchBtn`, ghost suggestion
  chips that invert on hover, minimal caps mode-toggle with gold underline
  active. Helper dropdown = white card `--e2`, warm chips. Mobile: icon-only
  search button (already `→`).
- **Results** (`.results-toolbar`, `#clientListPane`): cream, gold RESULTADOS
  eyebrow, `--t-display` serif count, view-switch as ghost segmented control
  (active = `--ink` bg, NOT Apple black). Grid 3/2/1 columns, 28px gap,
  1280px centered.
- **Property card** (`.property-card.public-card`): white, `--r-card`, `--e1`,
  hover lift. 16:10 photo with gradient scrim; status badge = frosted cream
  pill top-left; score badge = gold pill bottom-right. Body: gold caps
  neighborhood → serif price (`--t-display`) → serif title (`--ink-soft`) →
  USD/m² small → hairline → DM Sans stats row → footer (photo-completeness
  pill in semantic wash colors + COMPARAR ghost caps).
- **Map view** (`#clientMapPane`): frame the Leaflet canvas in `--r-card` with
  `--line` border; restyle popup to tokens if trivially possible.

### 2. Property modal (`#propertyModal`) — the core product
- Full editorial treatment: `--e3`, `--r-card`, cream sticky summary bar with
  serif title + pills (price pill in gold wash), warm close button.
- **Tabs** (`.modal-tabs`): text + gold underline active state — NOT filled
  blue buttons. Keep hash memory behavior.
- Gallery: featured-first grid, `--sand` placeholders with serif monogram for
  missing photos, "Sin fotos cargadas" as a styled empty state not a gray box.
- **Mortgage calculator** (`.mortgage-calc`) — currently the worst offender,
  fully iOS-blue: restyle sliders (WebKit + Moz thumbs/tracks) to gold on
  `--sand` track, values in `--ink`, labels `--muted` caps, cuota mensual
  emphasized in serif `--t-title` gold. Keep all 5 output rows.
- Score section: gold serif score, warm bars (`--gold` fill on `--sand`
  track), tooltip on `--ink` bg.
- Costos/Datos/Checklist panels: ledger-style tables — hairline rows,
  `--sand` header band, `⚠ Pendiente` in `--warn` wash pill.
- Room bottom-sheet (`#roomSheet`): warm sheet, `--e3`, drag handle in
  `--faint`.

### 3. Backoffice (`data-view="properties"`) — must stop looking like a different product
- Topbar + sidebar: restyle to the same warm system (cream bg, serif page
  title, caps nav). Sidebar active item = gold left rule + `--sand` wash.
- Dash stats (`.dash-stat-row`): serif `--t-display` numbers (keep), warm
  cards, gold caps labels.
- "Acciones recomendadas": semantic wash rows (warn/bad/sand), not raw
  orange/red text.
- Property cards/list: same card anatomy as public cards; Editar = ghost,
  Borrar = ghost-destructive; status pills in semantic washes.
- Editor (5 steps): step tabs as caps + gold underline; form sections with
  serif H4s; inputs per form spec below; progress bars gold on sand.

### 4. Admin IA (`data-view="settings"`)
- Model manager cards: white, `--r-card`, caps eyebrows, status chips in
  semantic washes (activo=ok, fallback=warn, falló=bad, probando=sand).
- Key status line prominent: configured → ok wash banner with masked key;
  missing → warn wash banner "La IA no responde aún — pegá tu API key".
- Selects/inputs per form spec. Test buttons = ghost; Guardar = primary.

### 5. Shared chrome
- **Forms** (all dialogs + editor): DM Sans inputs, white bg, `--line` border,
  `--r-card`, gold focus ring, `--muted` labels in caps-small. `<dialog>`
  backdrop `rgba(10,20,32,0.55)`.
- **Chat** (`#chatBubbleBtn`, `#chatWidget`): the bubble is currently blue —
  make it `--ink` circle with gold "IA" serif monogram; widget = warm card,
  user bubbles `--sand`, assistant bubbles white with `--line`.
- **Toasts** (`#autosaveToast`): `--ink` bg, `--cream-ink` text, gold hairline
  top, bottom-center.
- **Empty states / skeletons**: serif strong line + muted body + single ghost
  CTA; skeleton shimmer on `--sand` (no gray pulse).
- **Server error banner**: `--bad` wash, not raw red.

---

## Process — three rounds, verify between each

**Round 1 — Foundation.** New `styles.css`: tokens, reset, typography,
buttons, forms, layout primitives (`.shell`, views, nav, dialogs). Update the
Google Fonts URL. App must be fully usable (ugly-but-coherent is fine).
Playwright smoke: all views render, nav works, modal opens.

**Round 2 — Screens.** Marketplace → modal → backoffice → editor → Admin IA,
in that order. Screenshot each against the specs above before moving on.

**Round 3 — Polish.** Motion, hover/focus states everywhere, responsive pass
at 390/768/1440, reduced-motion, contrast check, then the acceptance protocol.

Commit at the end of each round (small, reviewed commits — not one mega-commit).
Do NOT push until the full acceptance protocol passes locally.

## Acceptance protocol (all must pass before push)

```bash
# 1. No blue, no dead fonts, no Apple grays
grep -cE "#0071e3|#2558B8|#1E3A5F|#4F46E5|#2B6CB0|#1d1d1f|#f5f5f7|#d2d2d7" styles.css  # → 0
grep -cE "'Inter'|Fraunces|Playfair" styles.css index.html                              # → 0
# 2. Discipline
grep -c "!important" styles.css                    # → ≤ 10, each commented
grep -oE "#[0-9a-fA-F]{3,8}" styles.css | wc -l    # hexes only inside :root
wc -l styles.css                                   # → ≤ 2800
# 3. Functionality (Playwright, headless, port 4173)
#    - anon: hero → search "casa" → card click → modal opens → all tabs → mortgage
#      sliders recompute → close → map view renders
#    - admin login → Backoffice (stats + cards) → card → editor 5 steps →
#      Admin IA (model cards + key banner) → logout
#    - zero pageerrors in console (401s from missing AI key are expected)
# 4. Screenshots at 390 / 768 / 1440 of: marketplace, modal (ficha+costos),
#    backoffice, editor, admin IA — reviewed against this brief
```

Finally: update `CLAUDE.md` §3.1–3.4 to match the shipped tokens so the doc
stops describing a dark theme the product no longer has.
