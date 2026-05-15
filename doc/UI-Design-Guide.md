# SafuSkill UI Design Guide

> Design system and UI specification for the SafuSkill AI Agent Skill Marketplace.

---

## 1. Design Principles

| Principle | Description |
|-----------|-------------|
| **Dark-first** | All interfaces use a dark theme optimized for developer comfort and Web3 aesthetic |
| **Security-forward** | Risk levels and scan statuses are always visually prominent |
| **Minimal chrome** | Clean layouts with generous spacing; let content breathe |
| **Consistent feedback** | Every interactive element has hover, focus, and active states |
| **Progressive disclosure** | Show summary first, details on demand |

---

## 2. Color System

All colors are defined as RGB triplets in CSS custom properties and consumed via Tailwind utilities.

### Core Palette

| Token | RGB | Hex | Usage |
|-------|-----|-----|-------|
| `--background` | `11 14 17` | `#0B0E11` | Page background |
| `--foreground` | `234 236 239` | `#EAECEF` | Primary text |
| `--card` | `20 23 28` | `#141720` | Card / panel background |
| `--card-foreground` | `234 236 239` | `#EAECEF` | Card text |
| `--primary` | `240 185 11` | `#F0B90B` | Brand accent (gold) |
| `--primary-foreground` | `17 17 17` | `#111111` | Text on primary |
| `--secondary` | `30 35 41` | `#1E2329` | Secondary surfaces |
| `--secondary-foreground` | `234 236 239` | `#EAECEF` | Text on secondary |
| `--muted` | `30 35 41` | `#1E2329` | Muted backgrounds |
| `--muted-foreground` | `132 142 156` | `#848E9C` | Muted / placeholder text |
| `--border` | `43 47 54` | `#2B2F36` | Borders and dividers |
| `--input` | `43 47 54` | `#2B2F36` | Input borders |
| `--ring` | `240 185 11` | `#F0B90B` | Focus ring |
| `--accent` | `26 26 26` | `#1A1A1A` | Accent surface |
| `--accent-foreground` | `240 185 11` | `#F0B90B` | Accent text |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#0ECB81` | Safe / low risk / positive |
| `--warning` | `#F0B90B` | Medium risk / caution |
| `--info` | `#1E88E5` | Informational |
| `--error` / `--destructive` | `#F6465D` | High risk / error / destructive |

### Risk Level Color Mapping

| Level | Text Class | Background Class | Example |
|-------|-----------|-----------------|---------|
| LOW | `text-success` | `bg-success/10` | Safe to use |
| MEDIUM | `text-warning` | `bg-warning/10` | Review recommended |
| HIGH | `text-orange-500` | `bg-orange-500/10` | Potential issues |
| CRITICAL | `text-destructive` | `bg-destructive/10` | Do not use |

---

## 3. Typography

### Font Family

- **Primary**: `Space Grotesk` (Google Fonts)
- **Fallback**: `system-ui, -apple-system, sans-serif`
- **Monospace**: System default monospace (code blocks only)

### Font Rendering

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

### Scale

| Element | Size | Weight | Class |
|---------|------|--------|-------|
| Page title | 36px | 700 | `text-4xl font-bold` |
| Section heading | 24px | 600 | `text-2xl font-semibold` |
| Card title | 18px | 600 | `text-lg font-semibold` |
| Body text | 14-16px | 400 | `text-sm` / `text-base` |
| Caption / label | 12-13px | 500 | `text-xs font-medium` |
| Badge | 12px | 500 | `text-xs font-medium` |
| Button | 14px | 500 | `text-sm font-medium` |

### Text Colors

| Purpose | Class |
|---------|-------|
| Primary text | `text-foreground` |
| Secondary text | `text-muted-foreground` |
| Brand / accent text | `text-primary` |
| Link hover | `text-primary` with `hover:text-primary` |

---

## 4. Spacing & Layout

### Grid System

- **Max width**: `max-w-7xl` (1280px) centered with `mx-auto`
- **Page padding**: `px-6` (24px horizontal)
- **Section spacing**: `py-16` to `py-24`

### Common Spacing Values

| Token | Size | Usage |
|-------|------|-------|
| `gap-4` | 16px | Between grid items |
| `gap-6` | 24px | Between card grid columns |
| `p-5` | 20px | Card inner padding |
| `p-6` | 24px | Section / form padding |
| `p-8` | 32px | Large card padding |
| `mb-2` | 8px | Between label and input |
| `mb-8` | 32px | Between sections |
| `space-y-4` | 16px | Vertical list spacing |

### Grid Layouts

| Context | Columns | Gap | Responsive |
|---------|---------|-----|------------|
| Skill cards | 4 | `gap-6` | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` |
| Stats grid | 4 | `gap-6` | `grid-cols-2 lg:grid-cols-4` |
| Features | 3 | `gap-8` | `grid-cols-1 md:grid-cols-3` |
| Launchpad cards | 3 | `gap-6` | `grid-cols-1 md:grid-cols-3` |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `12px` | Default radius for cards and containers |
| `rounded-lg` | 12px | Cards, modals, dropdowns |
| `rounded-md` | 8px | Buttons, inputs |
| `rounded-full` | 9999px | Badges, pills, avatars |

---

## 6. Components

### Buttons

#### Primary Button
```
h-11 px-6 rounded-lg font-medium text-sm
bg-primary text-primary-foreground
hover:opacity-90
transition-all duration-300
```

#### Secondary / Outline Button
```
h-11 px-6 rounded-lg font-medium text-sm
border border-border text-foreground
hover:bg-secondary
transition-all duration-300
```

#### Destructive Button
```
h-11 px-6 rounded-lg font-medium text-sm
bg-destructive/10 text-destructive border border-destructive/20
hover:bg-destructive/20
```

#### Icon Button
```
p-2 rounded-lg
text-muted-foreground hover:text-foreground
hover:bg-secondary
```

### Cards

#### Standard Card
```
p-5 rounded-lg border border-border bg-card
hover:border-primary/30
transition-all duration-300
```

#### Elevated Card (with glow)
```
p-6 rounded-xl border border-border bg-card
hover:border-primary/50
hover:shadow-[0_0_20px_rgba(240,185,11,0.1)]
```

#### Stat Card
```
p-5 rounded-xl bg-card border border-border
```

### Inputs

#### Text Input
```
w-full h-10 px-4 rounded-lg text-sm
bg-secondary border border-border text-foreground
placeholder:text-muted-foreground
focus:outline-none focus:border-primary
transition-colors
```

#### Search Input
```
Same as text input with:
pl-10 (left padding for icon)
<SearchIcon> positioned absolute left-3
```

#### File Upload Zone
```
border-2 border-dashed border-border rounded-xl p-8
text-center cursor-pointer
hover:border-primary/50 hover:bg-primary/5
transition-all duration-300
```

### Badges

#### Risk Badge
```
px-2.5 py-0.5 rounded-full text-xs font-medium
```
Colors vary by risk level (see Risk Level Color Mapping above).

#### Status Badge
```
px-2 py-0.5 rounded-full text-xs font-medium
```
- Active: `bg-success/10 text-success`
- Scanning: `bg-info/10 text-info`
- Failed: `bg-destructive/10 text-destructive`
- Pending: `bg-warning/10 text-warning`

### Navigation

#### Navbar
```
fixed top-0 left-0 right-0 z-50 h-16
bg-background/80 backdrop-blur-xl
border-b border-border
```

#### Nav Link
```
text-sm font-medium text-muted-foreground
hover:text-foreground
transition-colors
```
Active state: `text-foreground`

#### Category Tabs
```
px-4 py-2 rounded-lg text-sm font-medium
text-muted-foreground
hover:text-foreground hover:bg-secondary
transition-all duration-300
```
Active state: `bg-primary text-primary-foreground`

### Tables

```
w-full border-collapse
```
- Header: `text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4`
- Row: `border-t border-border hover:bg-secondary/50 cursor-pointer transition-colors`
- Cell: `py-3 px-4 text-sm`

---

## 7. Animations

### Keyframes

| Name | Effect | Duration | Usage |
|------|--------|----------|-------|
| `fadeUp` | Fade in + slide up 20px | 0.6s ease-out | Page sections on load |
| `fadeIn` | Opacity 0 → 1 | 0.5s ease-out | General fade-in |
| `scaleIn` | Scale 0.95 → 1 + fade | 0.5s ease-out | Cards, modals |
| `slideInLeft` | Slide from -30px left + fade | 0.6s ease-out | Sidebar items |
| `slideInRight` | Slide from 30px right + fade | 0.6s ease-out | Content panels |
| `float` | Y translate ±10px | 3s ease-in-out ∞ | Decorative elements |
| `pulse-glow` | Gold box-shadow pulse | 2s ease-in-out ∞ | CTA highlight |
| `shimmer` | Gradient shift left → right | 2s linear ∞ | Loading skeletons |
| `orbit` | 360° rotation | 20s linear ∞ | Background decoration |
| `gradient-shift` | Background position shift | 3s ease ∞ | Gradient backgrounds |

### Transition Defaults

```css
transition-all duration-300   /* Most interactive elements */
transition-colors             /* Color-only changes */
```

### Staggered Animations

Cards and list items use `animation-delay` with incremental offsets:

```tsx
style={{ animationDelay: `${index * 0.1}s` }}
```

---

## 8. Icons

### Icon Libraries

| Library | Usage | Import |
|---------|-------|--------|
| **Lucide React** | UI icons (nav, buttons, status) | `import { Icon } from 'lucide-react'` |
| **Material Symbols** | Filled icons (feature cards) | `<span className="material-symbols-rounded">icon_name</span>` |

### Icon Sizing

| Context | Size |
|---------|------|
| Navbar | 20px (`w-5 h-5`) |
| Button inline | 16-18px (`w-4 h-4`) |
| Card feature | 24px (`text-2xl`) |
| Stat icon | 20px (`w-5 h-5`) |
| Empty state | 48px (`w-12 h-12`) |

---

## 9. Responsive Breakpoints

Uses Tailwind default breakpoints:

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Minor adjustments |
| `md` | 768px | Tablet layout, 2-col grids |
| `lg` | 1024px | Desktop layout, 3-col grids |
| `xl` | 1280px | Full layout, 4-col grids |

### Key Responsive Patterns

- **Skill grid**: 1 → 2 → 3 → 4 columns
- **Dashboard**: Sidebar hidden on mobile (full sidebar at `lg`)
- **Stats**: 2 columns on mobile, 4 on desktop
- **Navbar**: Simplified on mobile

---

## 10. Page Layouts

### Standard Page
```
<Navbar />                          // fixed, h-16, z-50
<div className="pt-16">             // offset for fixed navbar
  <main className="max-w-7xl mx-auto px-6 py-12">
    {/* page content */}
  </main>
</div>
```

### Dashboard Page
```
<Navbar />
<div className="pt-16 flex">
  <aside className="w-[260px] fixed h-[calc(100vh-64px)] bg-card border-r border-border">
    {/* sidebar nav */}
  </aside>
  <main className="ml-[260px] flex-1 p-8">
    {/* dashboard content */}
  </main>
</div>
```

### Detail Page (Two Column)
```
<div className="flex gap-8">
  <div className="flex-1">           // Left: main content
    {/* description, code, reviews */}
  </div>
  <div className="w-[400px]">        // Right: sidebar
    {/* actions, stats, security report */}
  </div>
</div>
```

---

## 11. Branding

### Logo

Three concentric hexagons with increasing opacity toward center:

1. **Outer hex** — Wireframe stroke, `opacity="0.25"`
2. **Middle hex** — Wireframe stroke, `opacity="0.55"`
3. **Inner hex** — Solid fill, primary color
4. **Center spark** — White circle, `fillOpacity="0.3"`

Color: `rgb(var(--primary))` in app, `#F0B90B` in static assets.

### Brand Name

- Full: **SafuSkill**
- Tagline: *The Secure Marketplace for AI Agent Skills*
- Partner reference: **BNBChain** (no space between BNB and Chain)

### Theme Color

`#0B0E11` — Used in `<meta name="theme-color">` and PWA manifest.

---

## 12. Accessibility

| Area | Standard |
|------|----------|
| Color contrast | All text meets WCAG AA against dark backgrounds |
| Focus states | `focus:border-primary` ring on all interactive elements |
| Keyboard nav | Tab-accessible buttons, links, and inputs |
| Alt text | SVG logos have descriptive structure |
| Semantic HTML | `<nav>`, `<main>`, `<header>`, `<footer>` used appropriately |

---

## 13. Dark Theme Only

SafuSkill ships as a dark-only application. There is no light mode toggle. All color tokens are defined once in `:root` and do not change. This simplifies maintenance and ensures visual consistency with the Web3 / crypto aesthetic.
