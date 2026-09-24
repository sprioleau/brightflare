# Brightflare HTML design explorations

Open `index.html` through the local preview server to compare the three early styles and the connected hybrid direction. The hybrid pages are static interaction demos, not a replacement for the Next.js application.

## Hybrid direction

- `hybrid.html`: family desk, sample question and source-backed response, expandable FAQs, staff handoff.
- `hybrid-admin.html`: staff dashboard and all current sidebar destinations, with local preview interactions.
- `hybrid-handbook.html`: searchable, browsable handbook articles.
- `hybrid.css`, `hybrid.js`, and `hybrid-icons.svg`: shared styling, behavior, and 20px Lucide icon sprite (1.75px stroke). Icons use Lucide's ISC license.
- `assets/brightflare-logo.svg` and `assets/brightflare-logo-full.svg`: exact supplied logo files copied from the project assets. The full logo is used in each hybrid header.

The four primary colors are taken directly from the supplied logo: teal `#2ABABB`, amber `#FC9F28`, pink `#FC47AD`, and blue `#4A68D6`. The interface uses quiet tints of these colors over `#F5F9FB` with dark text `#20364C`.

The hybrid uses Manrope with compact operational hierarchy: page headings about 28–36px, section headings about 18–22px, and body/control text about 12–14px. The family desk is a 40/60 question and FAQ split on desktop; it collapses to one column below 760px. The Admin menu becomes a horizontally scrollable row below 970px. All eight destinations remain reachable.

**Accepted button rule for the real build:** orange buttons use a border in a slightly darker orange than their fill, never navy. Their centered lower ledge uses the same orange hue. In this preview the fill is `#FFC266`, border `#BF7417` at 3px, and lower ledge `#A95F16` at 6px. Hover lifts by 2px; pressing moves the button down 5px and compresses the ledge to 1px. The final application uses white neutral secondary controls with visible neutral outlines and matching lower ledges. All navigation, icon, pause, and clear controls share the same hover and press behavior.

The dot field travels 112px horizontally and 84px vertically in a 9s linear loop. Decorative plus signs float on alternating 4s cycles. FAQ reveal and answer entrance take roughly 240ms. The visible Pause motion control freezes ambient animation, and `prefers-reduced-motion: reduce` disables motion automatically. Keyboard focus uses a 3px blue outline; form focus also changes the containing question panel.

These files are intentionally standalone HTML for rapid visual review. The gallery marks them as previews, and mutations remain local to the browser. The real app should retain its actual data, approvals, and staff permissions when this direction is implemented.

The implementation plans in this folder preserve the design-review history. The latest application behavior is documented in [the functionality audit](../docs/functionality-audit.md); in particular, FAQ expansion is independent from the multi-turn chat.
