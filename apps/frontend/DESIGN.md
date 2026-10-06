---
name: StockSync
description: Category-standard inventory admin for store staff; light, flat, one blue for action and one red for failure.
colors:
  background: "#F8FAFC"
  foreground: "#0F172A"
  card: "#FFFFFF"
  primary: "#2563EB"
  primary-foreground: "#FFFFFF"
  secondary: "#F1F5F9"
  muted-foreground: "#64748B"
  sidebar-foreground: "#475569"
  border: "#E2E8F0"
  input: "#94A3B8"
  ring: "#2563EB"
  destructive: "#DC2626"
  destructive-ink: "#B91C1C"
  selection: "#DBEAFE"
typography:
  headline:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    fontFeature: "tnum"
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#2563EBE6"
  button-primary-lg:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.secondary}"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.secondary}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  nav-item:
    textColor: "{colors.sidebar-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
  data-surface:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
  alert-destructive:
    textColor: "{colors.destructive-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  badge-out-of-stock:
    textColor: "{colors.destructive-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: StockSync

## Overview

**Creative North Star: "The Shop Counter Ledger"**

StockSync is the category-standard admin, done carefully: the grammar of Linear and the official shadcn/ui examples, with nothing smuggled in. A near-white canvas carries white surfaces outlined by hairlines; slate ink does almost all of the talking. Color is not decoration here. It is a verdict: blue means "you can act here", red means "something failed or is short", and neither ever appears alone without words.

Density is desktop-first and tabular: products, sale lines and failed sync updates are tables with right-aligned figures in tabular numerals. The memorable moment is a sale's outcome, so outcomes are stated inline, directly above the form that produced them, and they say exactly what happened, whether anything changed, and what to do next.

The system is light only. shadcn primitives stay in their native grammar; their `dark:` classes remain in the source but are inert, because the `dark` variant is bound to a `.dark` ancestor class the app never sets and the document declares `color-scheme: light`.

**Key Characteristics:**
- Near-white canvas, white surfaces, hairline borders, slate ink.
- One blue accent for primary actions, links and focus; one red for failures and short stock.
- Inter Variable throughout; tabular figures on numbers only.
- Flat surfaces with a single faint shadow; depth by border and tone.
- Inline, worded outcome alerts; no toasts.
- Tables that reflow into labelled rows below `md` instead of scrolling sideways.

## Colors

A slate-neutral palette with two functional hues, each with exactly one job.

### Primary
- **Action Blue** (primary): primary buttons ("Register sale", "Log in"), the "Add product" ghost action, links, the text caret, and every focus ring (ring at 50% alpha). It never fills a surface, a header or a status.

### Secondary
- **Failure Red** (destructive): failures and short stock only. Short-stock figures in the sale lines, the red-ringed invalid quantity, inline field and line messages, the failed count on the sync summary, failed-update error text, the border and tint of the out-of-stock badge, and the alert icon in a destructive alert.
- **Failure Ink** (destructive-ink): the darker red used for red text that sits on the 5% red tint of a destructive alert, where Failure Red falls under 4.5:1. The destructive alert title and the out-of-stock badge label take Failure Ink; the alert body stays in Slate Ink.

### Neutral
- **Slate Ink** (foreground): headings, body text, table values, alert bodies, the brand mark tile.
- **Slate Mid** (sidebar-foreground): inactive sidebar navigation labels.
- **Slate Muted** (muted-foreground): descriptions, table headers, SKUs, CSS row labels, timestamps, secondary counts.
- **Field Stroke** (input): the border of inputs, selects and other form controls, deliberately darker than the hairline so fields read as fields.
- **Hairline** (border): card, table-row and sidebar borders; the dashed outline of empty states.
- **Canvas** (background): the page behind everything.
- **Surface White** (card): data surfaces, sidebar, popovers, the login card, and the fill of outline buttons and filter controls so they read on the canvas.
- **Wash** (secondary): the hover and active fill for ghost buttons, nav items and menu options; skeleton placeholders; the avatar disc.
- **Selection Blue** (selection): text selection background, with Slate Ink text.

### Named Rules
**The Blue Means Act Rule.** Blue appears only where the user can act or where focus is. If an element is not a primary action, a link or a focus indicator, it is not blue.

**The Red Speaks Twice Rule.** Red is never the only signal. Every red figure, ring or tint is paired with text: a badge that says "Out of stock", an inline line message, an alert title, the error text of a failed update.

**The Ink-On-Tint Rule.** Red text on a red-tinted background uses Failure Ink, not Failure Red; the explanatory body of a destructive alert is Slate Ink.

**The Light Only Rule.** There is one theme. Do not add dark values or rely on `dark:` variants.

## Typography

**Display Font:** none (no display role)
**Body Font:** Inter Variable (with ui-sans-serif, system-ui, sans-serif)

**Character:** One neutral grotesque at small, dense sizes, tightened slightly at heading weight. Hierarchy comes from weight and color (Slate Ink vs. Slate Muted), not from size jumps.

### Hierarchy
- **Headline** (600, 24px, 32px line, tight tracking): page titles in the page header, followed by a one-line Slate Muted description in Body.
- **Title** (600, 16px, 24px line, tight tracking): section headings within a page (e.g. "Failed updates"), card titles. The login heading steps up to 20px.
- **Figure** (600, 24px, tabular numerals): the sale total and the sync summary counts.
- **Body** (400, 14px, 20px line): table cells, descriptions, alerts, navigation. Inputs render at 16px below `md` and 14px from `md` up.
- **Label** (500, 14px): buttons, field labels, product names, alert titles, the active nav item.
- **Caption** (400, 12px, 16px line): SKU under a product name, inline line messages, badges, tenant and role lines in the sidebar.

### Named Rules
**The Figures Only Rule.** Tabular numerals are applied to numeric cells and numeric containers (stock, quantities, prices, subtotals, totals, counts, dates, pagination), never globally, so SKU hyphens and prose keep normal glyphs.

## Layout

The authenticated shell is a two-column grid from `md` (768px): a 240px sticky, full-height white sidebar with a right hairline, and a main column padded 40px with content capped at 1152px and centered. Below `md` the sidebar collapses into a top bar with a bottom hairline, horizontal scrolling nav pills and the user block; main padding drops to 16px horizontal, 24px vertical. The login page is a single centered column 384px wide.

Spacing follows a 4px base: 4 / 8 / 16 / 24 / 32 / 40. The page header sits 32px above content; page sections stack 32px apart; filters and pagination sit 16px from their table; outcome alerts sit 16px above the form. Table cells pad 8px with a 16px inset on the first and last column; summary cells pad 16px x 20px.

Figures right-align in their columns; the sale total and the primary action right-align under the sale card.

### Named Rules
**The Reflow Not Scroll Rule.** Below `md`, a table that must not scroll sideways (sale lines, failed updates) drops its header row and becomes a stack of grid rows. Every figure that lost its column header gets a Slate Muted label generated with a CSS `::before` (e.g. "Qty", "Unit price", "Subtotal", "Attempts") or an inline visually-shown label, so nothing is unnamed and nothing is clipped. The products table keeps the native horizontal-scroll container.

## Elevation & Depth

Flat by default. Depth comes from white surfaces on the near-white canvas and hairline borders. Data surfaces carry one barely-there shadow; only the login card and floating layers lift further.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): data surfaces (tables, sale lines card, sync summary), outline buttons, inputs, selects.
- **Card** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): the login card only.
- **Float** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): popovers, the product combobox and select menus.

### Named Rules
**The Hairline Rule.** A surface is defined by its 1px Hairline border first; shadow is a whisper on top, never the boundary.

## Shapes

Gently rounded and consistent. Controls (buttons, inputs, selects, nav items, brand mark, skeletons) use 8px. Data surfaces, alerts and empty states use 10px. Menu options use 6px. The login card uses 10px too, so no surface exceeds 10px. Badges and the avatar disc are full pills/circles. Empty states use a dashed Hairline border to read as "nothing here yet" rather than as a surface. Data surfaces clip their contents (overflow hidden) so row hovers respect the corners.

## Components

### Buttons
Native shadcn grammar: quiet, compact, confident.
- **Shape:** gently rounded (8px).
- **Primary:** Action Blue fill, white Label text, 36px tall; the sale form's "Register sale" uses the 40px large size. Disabled at 50% opacity until every line is valid; label changes to a progressive form ("Registering…") while pending.
- **Hover / Focus:** fill drops to 90%; focus shows the Action Blue border plus a 3px ring at 50% alpha.
- **Outline:** Surface White fill, Hairline border, Rest shadow, 32px small size for Retry, Clear filters and pagination; hover fills with Wash.
- **Ghost:** no fill; hover Wash. Used for "Add product" (Action Blue text, plus icon), remove-line (Slate Muted icon, 32px square) and Log out.
- **Icons:** Lucide SVG at 16px, inline with the label.

### Badges
- **Out of stock:** a shared component (`OutOfStockBadge`), outline badge, full pill, 12px Label weight, red text on a 5% red tint with a 30% red border, always worded "Out of stock". Its text is Failure Ink, per the Ink-On-Tint Rule. Used in the products table next to the red zero and in the product picker options. Reuse the component; do not restyle a local copy.

### Cards / Containers
- **Corner Style:** 10px for data surfaces and the login card.
- **Background:** Surface White on Canvas.
- **Shadow Strategy:** Rest (see Elevation); login card uses Card.
- **Border:** 1px Hairline.
- **Internal Padding:** tables inset 16px at the edges; summary cells 16px x 20px; login card 24px.

### Inputs / Fields
- **Style:** 36px tall, 8px radius, 1px Field Stroke border, Rest shadow, transparent or Surface White fill on the canvas, placeholder in Slate Muted.
- **Focus:** Action Blue border plus 3px Action Blue ring at 50% alpha.
- **Error:** `aria-invalid` turns the border Failure Red with a faint red ring; a Failure Red message sits below (14px for login fields, 12px for sale lines) and is linked with `aria-describedby`.
- **Disabled:** 50% opacity, not-allowed cursor.
- **Combobox (product picker):** an outline trigger showing product name over SKU in Caption, opening a Float popover with search; each option shows name over SKU and stock, or the Out of stock badge.

### Navigation
- **Sidebar:** white, 240px, brand tile (32px Slate Ink square with a white Lucide mark) beside "StockSync" and the tenant name. Items are 14px Slate Mid, 8px x 12px padding, 8px radius; hover and active fill with Wash and switch to Slate Ink, active adds 500 weight. The user block (initials disc, email, role, ghost Log out) sits at the bottom behind a Hairline.
- **Mobile:** the same items become a horizontally scrolling row in the top bar.

### Outcome Alert (signature)
The answer to "did it work?". An inline alert, 10px radius, 12px x 16px padding, 16px Lucide icon in the leading column, placed directly above the form it reports on.
- **Success:** Surface White alert, check icon, "Sale registered", followed by a compact table of the registered items and the total in tabular figures.
- **Failure:** 5% red tint, 30% red border, Failure Red icon, Failure Ink title ("Sale not registered"), Slate Ink body that lists every short item, states that nothing changed (or that resubmitting will not register twice when the outcome is unknown), and gives the recovery step.
- **Neutral notice:** Surface White alert with a neutral icon, e.g. "Session expired" on login.

**The Inline Verdict Rule.** Outcome feedback is an inline alert above the form, never a toast. It stays until the next action replaces it.

### Data Tables
Hairline row dividers, Slate Muted 14px headers at 40px height, a Wash-at-50% row hover (suppressed on header and form rows), SKU in Slate Muted, names in Label weight, figures right-aligned in tabular numerals. Loading uses Wash skeleton rows inside the same frame; placeholder data dims the table to 60% while refetching. Empty states are dashed Hairline boxes with a Label title, a Slate Muted sentence and an optional outline action.

### Summary Strip
The sync summary is a definition list on a data surface: four cells (2 columns, 4 from `sm`) divided by Hairlines, each a Slate Muted label over a Figure; the failed count turns Failure Red only when above zero. A footer row gives the last successful sync as relative time in Label weight plus the absolute timestamp in Slate Muted.

## Do's and Don'ts

### Do:
- **Do** reserve Action Blue for primary actions, links and focus rings.
- **Do** pair every use of Failure Red with words: a badge label, an inline message, an alert title, an error string.
- **Do** use Failure Ink for red text on the red alert tint, and keep the alert body in Slate Ink.
- **Do** apply tabular numerals per numeric cell or container, not to the body.
- **Do** report outcomes in an inline alert directly above the form, stating what happened, whether anything changed, and how to recover.
- **Do** reflow sale-line and failed-update style tables into labelled grid rows below `md` with CSS `::before` labels.
- **Do** use the shared Out of stock badge wherever out-of-stock state appears.
- **Do** keep shadcn primitives in their native grammar: 8px controls, 10px data surfaces, hairline borders, the Rest shadow.

### Don't:
- **Don't** add toasts for sale, login or sync outcomes.
- **Don't** signal state by color alone.
- **Don't** use blue for status, decoration, headers or filled surfaces.
- **Don't** add dark theme values or set the `.dark` class; the system is light only.
- **Don't** apply `tabular-nums` globally; it changes SKU hyphens.
- **Don't** let a table whose rows carry inputs or long error text (sale lines, failed updates) scroll sideways on a phone; reflow it.
- **Don't** add decorative gradients, grey-on-grey cards or heavier shadows to data surfaces.
