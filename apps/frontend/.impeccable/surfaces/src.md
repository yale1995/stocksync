---
version: 1
slug: "src"
primary_target: "src"
related_targets: []
---

## Scope

The whole StockSync app (`apps/frontend`): login, products, new sale, sync status. Visitor mode: **Operate**.

## Task

Store staff register sales quickly and correctly, read stock at a glance, and check the ads sync. The most memorable moment is the sale and its outcome: success summary, or a 409 naming every short SKU with nothing changed.

## Direction contract

THESIS: The category-standard admin, executed at Linear / official shadcn examples craft. It refuses the template version of that standard: grey-on-grey cards, decorative gradients, vague toasts, and states that rely on color alone.

OWN-WORLD: Near-white canvas (#F8FAFC) with a white sidebar and white surfaces, slate ink (#0F172A, #475569, #64748B), hairline borders (#E2E8F0), one blue accent (#2563EB) only for primary actions, links and focus. Red (#DC2626) is reserved for failures and short stock. Inter with tabular figures; 6–10px radii; one subtle shadow on raised cards; shadcn components left in their native grammar.

STORY: Staff see which items are in or out of stock, build a sale, and know at once whether it was registered. If it wasn't, they see what failed, that nothing changed, and how to fix it. Sync health is readable at a glance, with failures listed explicitly.

FIRST VIEWPORT: New sale. A page title with a one-line explanation; outcome feedback (an alert) directly above the items card, never in a toast. The card has columns Product (name over SKU), In stock, Quantity, Unit price, Subtotal and remove, plus "+ Add product" (a combobox with search). Short lines show their stock in red, a red-ringed quantity and an inline message. Total and the primary "Register sale" button sit right-aligned under the card; the button is disabled until every line is valid.

FORM: The category standard (canon), chosen by the user over the roll; seed key 89e47602. Reference bar: Linear and the official shadcn/ui examples.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decided details

- Demo artboards live in Paper, file "StockSync · Direções visuais", artboard 4. Treat them as the critique reference, not as a pixel contract.
- State never relies on color alone: out of stock has a badge with text, a short line has an inline message, and failed sync events carry their error text.
- Light theme only; no dark mode commitment.
