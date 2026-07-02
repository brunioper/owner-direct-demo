# CLAUDE.md — Owner Direct (OD) Property Platform

> Drop this file into the root of any Claude Code / Claude.ai project.
> It governs how to build, extend, and improve every part of the OD platform —
> the property report, the listing browser, the AI search, and the buyer experience.

---

## 1. What this platform is

**Owner Direct** is a premium, owner-to-buyer real estate platform for the Uruguayan market
(initially Colinas de Carrasco and high-end Montevideo). Owners list directly; buyers get a
transparent, architect-grade property report before purchasing.

The product competes on **radical transparency** — real costs, real scores, real deficiencies —
not marketing copy. Every design and UX decision must reinforce trust, not excitement.

Target buyer: informed, upper-middle-income, Spanish-speaking. Reads data carefully.
Respects honesty over hype.

---

## 2. Default stack

- **Next.js 14+ (App Router)** for the main platform
- **Tailwind CSS v3** for styling
- **Motion** (`npm install motion`) for all animations — import as `import { motion } from "motion/react"`
- **TypeScript** always (even single-file utilities)
- **OpenRouter API** for all AI features (see Section 6)
- **Vercel** for deployment

---

## 3. Design language

### 3.1 Color palette — mitti brand (shipped in styles.css)

Brand: **mitti** — "Vendé tu propiedad con control". Palette: grafito
`#2B2E31` · arena `#E7DFCF` · verde seco `#6F7A67`. Light editorial system:
grafito is a *stage* (hero, sidebar, chat head), arena claro is the page,
verde seco is the single accent. Token NAMES are stable (`--night`, `--cream`,
`--gold`…) — only values change on rebrands.

| Token | Value | Use |
|---|---|---|
| `--night` | `#2B2E31` | Grafito stage: hero, sidebar, score card, chat head |
| `--cream` | `#F2EEE4` | Page background (arena claro) |
| `--paper` | `#FFFFFF` | Card surfaces |
| `--sand` | `#E7DFCF` | Arena: fills, hover washes, tracks |
| `--ink` | `#24272A` | Primary text (grafito) |
| `--ink-soft` | `#52554E` | Secondary text |
| `--muted` | `#8D8A7C` | Labels, captions |
| `--cream-ink` | `#EFEBDF` | Text on dark |
| `--gold` | `#6F7A67` | THE accent (verde seco): CTAs, scores, active states |
| `--line` | `#DED7C5` | Borders, dividers |
| `--ok` / `--warn` / `--bad` | `#4E8A66` / `#B4832F` / `#A85448` | Semantic states (use their `-wash` pairs for fills) |

Wordmark "mitti" renders lowercase in DM Sans 500 with 0.14em tracking (never
serif). Never use `#000000`/`#FFFFFF` for text, never any blue. One accent
family only: **verde seco**. All values live in the single `:root` of
`styles.css` — a raw hex anywhere else is a defect.

### 3.2 Typography — Poppins / Inter (per mitti brand board)

| Purpose | Font | Size desktop | Size mobile |
|---|---|---|---|
| Logo / wordmark | Poppins 500, lowercase, tracking .14em | 16–17px | 15px |
| Display / hero | Poppins 300–400, tracking −.02em | 32–54px | 28–34px |
| Prices / stats | Poppins 400 | 21–38px | 18–24px |
| Section headers | Poppins 400–500 | 15–19px | 14–17px |
| Body / UI | Inter 300–400 | 12–14px | 12px |
| Labels / caps | Inter 500, uppercase, tracking .1–.2em | 9–11px | 9–10px |

Tokens: `--font-display` (Poppins), `--font-sans` (Inter). Load only weights
Poppins 300/400/500 + italic 300 and Inter 300/400/500. No serif anywhere.
Logo mark: the architectural-plan "M" (inline SVG, stroke `currentColor`,
square caps) — used in sidebar, pill-nav, and favicon.

### 3.3 Cards + geometry

Cards are white paper on cream, with warm shadows. Exactly three radii exist:
`--r-card: 4px` (cards, panels, inputs, modals), `--r-tight: 2px` (buttons),
`--r-pill: 999px` (pills, badges, nav capsule). Three elevations: `--e1`
(resting card), `--e2` (hover/dropdown), `--e3` (modal/sheet) — all
warm-tinted `rgba(26,16,8,…)`. Card anatomy:
```css
.panel {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  box-shadow: var(--e1);
}
.panel-head {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line-soft);
  background: linear-gradient(to bottom, rgba(201,168,76,0.04), transparent);
}
```

Buttons: `.primary` = gold bg/ink text caps; default `<button>` = ghost
(line border, inverts to ink on hover); `.delete-btn` = ghost-destructive.
Focus ring everywhere: gold, `0 0 0 3px var(--gold-wash)` — never blue.

### 3.4 Section labels (`.sec`)
```css
.sec {
  font-size: 9px;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sec::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
```

### 3.5 Animations

Use Motion. Rules:
- `viewport={{ once: true }}` always — never replay on scroll-back
- Translation max 24px, duration 0.5–0.8s, `ease: "easeOut"`
- `prefers-reduced-motion` fallback — Motion handles this automatically
- Stagger children at 0.05–0.08s for lists

Default fade-in:
```jsx
<motion.div
  initial={{ opacity: 0, y: 18 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-80px" }}
  transition={{ duration: 0.6, ease: "easeOut" }}
>
```

**Anti-patterns:**
- ❌ Animating every element
- ❌ Animations longer than 1s on data UI
- ❌ Hover animations on layout properties
- ❌ Loading spinners — always skeleton-load instead

---

## 4. The Property Report (core product)

### 4.1 Architecture

The report is a **5-tab single-page application** per property. Tabs:

| Tab | ID | Purpose |
|---|---|---|
| 📋 Ficha | `ficha` | Hero card, OD Stars score, area breakdown, installations |
| 🏠 Ambientes | `ambientes` | Room-by-room scoring with improvement suggestions |
| 📸 Checklist | `checklist` | Photo documentation completeness tracker |
| ✅ Datos | `amenities` | Amenities grid + legal/documentation fields |
| 💰 Costos | `costos` | Real monthly/annual cost transparency |

### 4.2 OD Stars scoring system

Each property gets a **global score (0–10)** composed of 4 sub-scores:
- Estructura (structural quality)
- Instalaciones (systems/mechanical)
- Terminaciones (finishes)
- Exterior (outdoors/landscaping)

Each room gets its own score. Color coding:
- `8.0–10` → green dot → `.dot-hi`
- `6.5–7.9` → amber dot → `.dot-mid`
- `<6.5` → red dot → `.dot-lo`

Display the potential score with improvement investments prominently:
```html
<div class="potential-note">
  ▲ Con mejoras (inversión ~USD X–Y): score potencial <strong>Z★</strong>
  · Precio objetivo <strong>USD A–B</strong>
</div>
```

### 4.3 Improvement suggestions (mejoras)

Every room must have at least 2–3 improvement cards. Each card shows:
- Name of improvement
- Why it matters (buyer-facing reasoning, NOT generic)
- Investment range in USD
- Return/gain estimate
- Star impact (e.g. `+0.4★`)

### 4.4 Cost transparency (Costos tab)

This is the most trust-building section. Show ALL ownership costs:
- Monthly fixed (utilities: UTE electricity, OSE water, Antel, neighborhood fees)
- Monthly variable (gardening, security, maintenance)
- Annual (Contribución Inmobiliaria, home insurance)
- Running total

Mark pending data with `⚠ Pendiente` badge in amber. Never hide or omit missing data — show the gap explicitly.

### 4.5 Photo checklist

Track completeness as a percentage. Separate sections:
- ✅ Available photos (room-by-room)
- ⚠ Pending (infrastructure: electrical panel, water meters, tanks, utility connections, architectural plans)

Pending items are **sales blockers** — call them out visually, not buried.

---

## 5. UX improvements to implement

### 5.1 Property listing cards (search results)

Current state: none — build from scratch.

Each listing card must show:
- Property photo (lazy-loaded, with a shimmer skeleton while loading)
- Property name and neighborhood
- Price in USD (Cormorant Garamond display font)
- USD/m² metric
- 3 key stats: beds, baths, total m²
- OD Stars score badge
- "Fotos completadas" progress indicator (e.g. 58%)
- Status badge: `En venta`, `Reservado`, `Vendido`

```jsx
// Skeleton loader pattern — always use while fetching
function PropertyCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="bg-navy h-48 rounded-t-xl" /> {/* photo placeholder */}
      <div className="p-4 space-y-2">
        <div className="h-4 bg-navy rounded w-3/4" />
        <div className="h-3 bg-navy rounded w-1/2" />
      </div>
    </div>
  );
}
```

Show 3–6 skeleton cards immediately on page load, replace with real data as it arrives.
Never block the entire UI for data fetching.

### 5.2 Loading states — hierarchy

| State | Pattern |
|---|---|
| Initial page load | Show topbar + skeleton cards immediately |
| AI search thinking | Inline typing indicator (3 pulsing dots) below the input, NOT a full-page spinner |
| AI generating report fields | Stream text token-by-token into the UI, don't wait for full response |
| Photo upload processing | Progress bar per photo, not global spinner |
| Tab switching | Instant (tabs are pre-rendered, just hidden) |

### 5.3 Tab UX improvements

Current tab bar switches via `display: none/flex`. Improvements:
- Add slide transition between tabs (Motion `AnimatePresence`)
- Remember active tab in URL hash (`#ambientes`) so users can share/bookmark
- On mobile: make tabs horizontally scrollable with momentum scrolling, not wrapping

### 5.4 Room detail UX (Ambientes tab)

Current: click room card → detail appears below. Improvements:
- On mobile: open room detail as a bottom sheet (slide up from bottom)
- Animate the score number counting up from 0 when a room is first selected
- Add a "Ver todas las mejoras" total investment/return summary at the bottom

### 5.5 Score visualization

The current score track bar is minimal. Upgrade:
- Animate the fill bar on first view (Motion whileInView)
- Add tick marks at 5 and 7.5 with small labels ("Estándar" and "Bueno")
- Show score history if property has been re-evaluated

### 5.6 Cost completeness nudge

If cost data is less than 60% complete, show a banner at the top of the Costos tab:
```html
<div class="completeness-warning">
  ⚠ Datos de costo incompletos — el comprador no puede evaluar el costo real de propiedad.
  Completar esto aumenta conversión en un estimado 30%.
</div>
```

Style it as amber, not red — it's a nudge, not an error.

---

## 6. AI Search — OpenRouter free models

### 6.1 Model selection strategy

Use OpenRouter's free tier. The goal is **maximum speed** with good-enough quality.
Free models ranked by speed for this use case:

| Model | Use case | Why |
|---|---|---|
| `google/gemini-2.0-flash-exp:free` | Primary search query parsing | Fastest, good Spanish |
| `meta-llama/llama-3.1-8b-instruct:free` | Property matching/ranking | Low latency, good reasoning |
| `mistralai/mistral-7b-instruct:free` | Fallback if above rate-limited | Reliable |
| `google/gemma-3-4b-it:free` | Simple field extraction | Very fast for structured output |

**Never use large models (70B+) for real-time search.** Use them only for batch report generation.

### 6.2 Search UX pattern

The search input should behave like a conversation, not a filter form:

```
User types: "casa con parrillero y jardín en Carrasco, 4 dormitorios, hasta 500k"
→ Parse intent in real-time (debounce 300ms)
→ Show "Buscando propiedades que coincidan..." with pulsing dots
→ Stream results as they arrive — show first match immediately
→ After all results, show AI summary: "Encontré 3 propiedades que coinciden.
   La más cercana a tu búsqueda es Casa I08..."
```

```typescript
// OpenRouter search call — optimized for speed
async function searchProperties(query: string, properties: Property[]) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ownerdirect.uy',
      'X-Title': 'Owner Direct Property Search'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp:free',
      stream: true, // ALWAYS stream — shows results faster
      max_tokens: 400, // Keep tight — search answers should be short
      temperature: 0.1, // Low temp for consistent structured output
      messages: [
        {
          role: 'system',
          content: `Eres un asistente de búsqueda de propiedades para Owner Direct Uruguay.
          Analiza la consulta del usuario y devuelve SOLO un JSON con este formato:
          {
            "filters": {
              "maxPrice": number | null,
              "minBeds": number | null,
              "minBaths": number | null,
              "minM2": number | null,
              "features": string[], // e.g. ["parrillero", "jardín", "pileta"]
              "neighborhood": string | null
            },
            "explanation": "Frase corta en español explicando qué encontraste",
            "matchedIds": string[] // IDs de propiedades que coinciden, ordenadas por relevancia
          }
          Propiedades disponibles: ${JSON.stringify(properties.map(p => ({
            id: p.id,
            price: p.price,
            beds: p.beds,
            baths: p.baths,
            m2: p.m2,
            features: p.features,
            neighborhood: p.neighborhood
          })))}`
        },
        { role: 'user', content: query }
      ]
    })
  });

  return response; // Handle streaming in the component
}
```

### 6.3 Search result streaming

```typescript
// Stream handler — show results as they arrive
async function* streamSearchResults(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {}
      }
    }
  }
}
```

### 6.4 Rate limit handling

Free OpenRouter models have strict rate limits. Always implement:

```typescript
// Retry with exponential backoff + model fallback
const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free'
];

async function searchWithFallback(query: string, properties: Property[], attempt = 0) {
  try {
    return await searchProperties(query, properties, FALLBACK_MODELS[attempt]);
  } catch (error: any) {
    if (error.status === 429 && attempt < FALLBACK_MODELS.length - 1) {
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      return searchWithFallback(query, properties, attempt + 1);
    }
    throw error;
  }
}
```

### 6.5 Client-side pre-filtering

**Do not send all properties to the AI on every keystroke.** Pre-filter client-side first:

```typescript
function preFilter(properties: Property[], query: string): Property[] {
  const q = query.toLowerCase();
  // Quick regex extraction before hitting AI
  const priceMatch = q.match(/(\d+)k?/);
  const maxPrice = priceMatch ? parseInt(priceMatch[1]) * (q.includes('k') ? 1000 : 1) : Infinity;
  const bedMatch = q.match(/(\d+)\s*(dorm|hab|cuartos?)/);
  const minBeds = bedMatch ? parseInt(bedMatch[1]) : 0;

  return properties.filter(p =>
    p.price <= maxPrice * 1.1 && // 10% tolerance
    p.beds >= minBeds
  );
  // Only send pre-filtered set to AI — reduces tokens and latency
}
```

### 6.6 AI-generated report field assistance

When owners fill in property data, use AI to help:

```typescript
// Auto-suggest improvement descriptions based on room data
async function generateMejoraDescription(
  room: string,
  currentFinish: string,
  neighborhood: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemma-3-4b-it:free', // Smallest/fastest for this simple task
      max_tokens: 120,
      temperature: 0.3,
      messages: [{
        role: 'system',
        content: 'Eres un consultor inmobiliario de lujo en Uruguay. Genera descripciones de mejoras breves (2 oraciones máximo), directas y orientadas al comprador del segmento premium. Sin marketing vacío.'
      }, {
        role: 'user',
        content: `Ambiente: ${room}. Terminación actual: ${currentFinish}. Barrio: ${neighborhood}. ¿Qué mejora sugerirías y por qué convence al comprador?`
      }]
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

---

## 7. Competitive market analysis — platforms that sell houses

Study these platforms and adopt what works for your market:

### 7.1 Global premium marketplaces

**Sotheby's International Realty** (`sothebysrealty.com`)
- Full-screen video heroes, editorial photography
- Property stories — narrative copy, not spec sheets
- **Adopt:** video hero pattern, editorial tone for descriptions

**Christie's International Real Estate** (`christiesrealestate.com`)
- Minimalist, white space dominant
- Price on request common — exclusivity signal
- **Adopt:** restraint in UI, quality over quantity of listings

**Luxury Portfolio International** (`luxuryportfolio.com`)
- Property lifestyle marketing, not just specs
- "Who buys here" neighborhood profiles
- **Adopt:** neighborhood context cards

### 7.2 Data-forward portals

**Zillow** (`zillow.com`) — benchmark for data completeness
- Zestimate transparency (shows estimate + confidence interval)
- Full cost of ownership calculator
- "What will my mortgage be" front and center
- Walk Score, Transit Score integration
- **Adopt:** cost calculator, confidence intervals on valuations

**Rightmove** (UK) — benchmark for listing quality
- Floor plan required for all listings (increases saves by 30%+)
- EPC (energy rating) mandatory and prominent
- School catchment area maps
- **Adopt:** floor plan prominence, energy cost display

**Redfin** (`redfin.com`) — benchmark for buyer tools
- Price history graph (all time)
- Days on market counter
- Comparative market analysis accessible to buyers
- **Adopt:** price history, market comparison context

### 7.3 Transparency-first disruptors

**Purplebricks** (UK)
- Fixed fee, no agent — owner direct (your model)
- Self-service listing with guided data collection
- **Adopt:** guided owner onboarding flow

**Fizber** (USA)
- FSBO (For Sale By Owner) platform
- Checklist-driven listing completeness score
- **Adopt:** completeness score concept (you already have this)

**OpenDoor** (`opendoor.com`)
- Radical cost transparency
- All fees shown upfront before offer
- **Adopt:** fee transparency, no-surprises promise

### 7.4 Local Uruguayan/LATAM context

**MercadoLibre Inmuebles** (`inmuebles.mercadolibre.com.uy`)
- Dominant volume player, low trust
- No verification, no scoring
- **OD differentiator:** verified data, architect-grade scoring

**InfoCasas** (`infocasas.com.uy`)
- Standard portal, agent-dominated
- Photo quality inconsistent
- **OD differentiator:** photo checklist, quality standards

**Properati** (`properati.com.uy`)
- Aggregator model, data quality varies
- Good price trend graphs
- **Adopt:** price trend visualization for the Colinas market

### 7.5 Key insights from competitive analysis

| Feature | Market adoption | OD status | Priority |
|---|---|---|---|
| Floor plan mandatory | Rightmove: yes; most LATAM: no | Missing | 🔴 High |
| Full cost of ownership | Zillow, Redfin | Partial (Costos tab) | 🟡 Medium |
| Price history graph | Zillow, Rightmove, Purplebricks | Missing | 🟡 Medium |
| Neighborhood comparison | Luxury Portfolio, Rightmove | Missing | 🟡 Medium |
| Energy/utility costs | Rightmove (EPC), Zillow | In Costos tab | ✅ Done |
| AI natural language search | Zillow (beta), Redfin | Build now | 🔴 High |
| Virtual tour / 3D | Zillow 3D, Rightmove | Missing | 🟠 Later |
| Verified ownership | Almost none | Core OD value | ✅ Done |

---

## 8. Buyer experience — end-to-end journey

Map every screen the buyer touches and apply these standards:

### 8.1 Discovery (search + browse)

- Show max 6 listings on first load — quality over quantity
- Default sort: OD Stars score descending
- Natural language search bar as primary (not filters)
- Filters available as secondary (collapsible sidebar)
- Each card shows price/m² — educate buyers on value

### 8.2 First look (listing card)

The card must answer: *Should I click to learn more?*

Required on card:
- Hero photo (professionally shot)
- Price in USD (large, clear)
- USD/m² (small, under price)
- 4 key stats: beds, baths, m² cubiertos, terreno
- OD Stars score badge (gold if ≥7.5, amber if 6–7.5, gray below)
- Neighborhood + barrio name
- "Fotos completadas" pill (green if >80%, amber if 50–80%, red below)

Forbidden on card:
- ❌ Agent phone number / contact info
- ❌ "Premium", "Exclusivo", "Único" superlatives
- ❌ Multiple CTA buttons

### 8.3 Property report (deep look)

The report answers: *Should I arrange a visit?*

The report is the core product. By the time a buyer finishes the 5 tabs, they should know:
1. What the property is worth and why
2. What it costs to own monthly
3. What it would take to improve it and what return to expect
4. Whether the documentation is complete or has gaps
5. What each room looks like and what's good/bad

### 8.4 Decision support

Add to each property report:
- "Comparar con similar" button → shows 2–3 comparable properties side by side
- "Calcular hipoteca" quick widget (input: down payment %, annual rate)
- "Solicitar visita" CTA — single button, only in the hero card header

### 8.5 Trust signals throughout

Every section must reinforce why OD is different:
- "Datos declarados por el propietario y verificables con documentación adjunta"
- Score methodology link (a short explainer page)
- "Esta propiedad tiene planos aprobados" badge (when true)
- No fake urgency ("¡Solo 1 disponible!")

---

## 9. Component library (build order)

Build in this priority order:

1. `<PropertyCard />` — listing grid card with skeleton loader
2. `<ScoreDisplay />` — OD Stars score with animated fill bar
3. `<RoomDetail />` — room terms + mejoras panel
4. `<SearchBar />` — AI-powered natural language search input
5. `<CostBreakdown />` — monthly/annual cost calculator
6. `<AmenitiesGrid />` — yes/no/pending amenity cards
7. `<PhotoChecklist />` — photo completeness tracker
8. `<ComparePanels />` — side-by-side property comparison
9. `<MortgageCalculator />` — simple monthly payment estimator
10. `<NeighborhoodCard />` — Colinas/Carrasco context block

---

## 10. File structure

```
od-platform/
├── app/
│   ├── layout.tsx          ← global nav, fonts, metadata
│   ├── page.tsx            ← listing browser / search
│   ├── propiedad/
│   │   └── [id]/
│   │       └── page.tsx    ← property report (5 tabs)
│   └── globals.css
├── components/
│   ├── PropertyCard.tsx
│   ├── PropertyCardSkeleton.tsx
│   ├── ScoreDisplay.tsx
│   ├── RoomDetail.tsx
│   ├── SearchBar.tsx
│   ├── CostBreakdown.tsx
│   ├── AmenitiesGrid.tsx
│   ├── PhotoChecklist.tsx
│   └── ui/
│       ├── Tabs.tsx
│       ├── Badge.tsx
│       ├── ProgressBar.tsx
│       └── BottomSheet.tsx  ← mobile room detail
├── lib/
│   ├── search.ts            ← OpenRouter search logic
│   ├── properties.ts        ← data fetching / types
│   └── scoring.ts           ← OD Stars calculation
├── public/
│   └── properties/          ← property photos (organized by ID)
├── tailwind.config.ts
└── package.json
```

---

## 11. Performance targets

| Metric | Target |
|---|---|
| First contentful paint | < 1.2s |
| Time to interactive | < 2.5s |
| Search response (AI) | < 1.5s to first result |
| Tab switch | Instant (< 50ms) |
| Property card load | Skeleton shown < 100ms, data < 800ms |
| Core Web Vitals | LCP < 2.5s, CLS < 0.1, FID < 100ms |

Achieve these by:
- Pre-rendering listing pages at build time (SSG for static data)
- Skeleton loaders before any data
- Streaming AI responses (never wait for full completion)
- Image optimization via Next.js `<Image />` component
- Debounce search input at 300ms

---

## 12. Anti-patterns (never do these)

- ❌ Agent contact info anywhere — this is owner direct
- ❌ Fake scarcity or urgency copy
- ❌ Loading spinners that block the whole page
- ❌ Large AI models (70B+) in the real-time search path
- ❌ Sending all property data to OpenRouter on every keystroke — pre-filter first
- ❌ Generic superlatives ("lujosa", "exclusiva", "única") in AI-generated copy
- ❌ Auto-play video in listing cards (kills mobile performance)
- ❌ Hiding pending/missing data — always show gaps transparently
- ❌ More than 1 CTA per screen
- ❌ English-language fallback — this platform is Spanish only
- ❌ Reproducing boilerplate from other portals — OD has its own voice

---

## 13. Content voice

OD's copy voice across all AI-generated and human-written text:

- **Direct.** State the fact, then why it matters.
- **Technical without jargon.** "Losa radiante eléctrica en toda la casa" not "sistema de calefacción de última generación".
- **Honest about deficiencies.** "El piso vinílico es percibido como inferior al porcelanato en este segmento" — not hidden.
- **Buyer-aligned.** Every piece of information answers "how does this affect me as a buyer?"
- **Never marketing copy.** No exclamation marks. No "¡oportunidad única!".

---

## 14. Build process (3-round pattern)

Follow this for every major feature:

**Round 1 — Structure**
Data model, component skeleton, tab structure, routing. No styling, no animations.

**Round 2 — Data + AI**
Connect OpenRouter search, render real property data, add skeleton loaders, implement streaming.

**Round 3 — Polish**
Motion animations, score bar fill, mobile bottom sheets, responsive edge cases, copy review.

Never attempt all three in one pass.

---

*This config is for Owner Direct Uruguay. Update as the platform evolves.*
