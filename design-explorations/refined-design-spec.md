# Brightflare refined design

> Historical design draft. The September 24 final correction supersedes this plan where they differ: neutral controls have white tops and visible gummy depth; FAQs expand full answers in their own cards and never enter chat; chat retains follow-up turns and provides Clear chat. See [the current implementation audit](../docs/functionality-audit.md) and the live Next.js application.

Implementation brief for Family desk, Handbook, and Staff. Supersedes hybrid guidance that gives every control colored gummy styling. Preserve supplied logos, moving dots/pluses, motion controls, and the fixed header flush against the viewport top.

## Visual tokens

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#F5F9FB` | Page and disclosure backgrounds |
| Surface | `#FFFFFF` | Composer, reading surfaces, navigation |
| Hover / selected | `#EDF2F5` / `#E7EDF2` | Neutral interactive states |
| Ink / muted ink | `#20364C` / `#526875` | Main / supporting text |
| Border / neutral ledge | `#CFDADF` / `#BDC9D0` | Quiet boundaries and depth |
| Primary fill / hover | `#FFC266` / `#FFD48B` | Submit, save, publish, approve |
| Primary border / ledge | `#BF7417` / `#A95F16` | Hue-matched action depth |
| Link / focus | `#3555B0` / `#4A68D6` | Text links / keyboard outline |
| Brand colors | `#2ABABB`, `#FC9F28`, `#FC47AD`, `#4A68D6` | Unchanged logo, ambient decoration, restrained markers |

Primary is amber. Secondary is white or neutral gray. Accent is a small brand marker, never a default control fill. Teal is decorative or a tiny confirmed-status marker; pink is decorative, not the error color. Errors use `#9B3541` text on `#FFF4F5`, border `#E3BDC3`. Use dark ink on colored backgrounds. Avoid brand teal for small text.

Spacing: 4, 8, 12, 16, 24, 32px. Control radius 10px; surface radius 14px. Ordinary surfaces: 1px border, `0 2px 0 #DFE6EA`; reading articles may add `0 8px 24px rgb(32 54 76 / 5%)`. Remove global heavy card shadows.

## Typography

Manrope everywhere. Exactly three weights: 400, 600, 700. Use the following roles across all routes; no local arbitrary sizes, uppercase eyebrows, or extra-bold variants.

| Role | Size / line height | Weight | Color |
| --- | --- | --- | --- |
| H1 page | 28 / 34px | 700 | Ink |
| H2 section | 20 / 26px | 700 | Ink |
| H3 panel | 16 / 22px | 700 | Ink |
| H4 / subheading | 14 / 20px | 600 | Ink |
| Body / input / article | 16 / 24px | 400 | Ink |
| Supporting / control / FAQ | 14 / 20px | 400 / 600 | Muted / ink |
| Metadata only | 12 / 18px | 400 | Muted |

H1 tracking -0.03em; H2 -0.02em; remaining roles normal. Phone H1 is 24/30px. Reading articles use 16/26px. Never shrink input below 16px or interactive labels below 14px to achieve tablet fit.

## Semantic controls

- **Primary action:** amber gummy, existing 3px orange border and 6px ledge; hover lifts 2px, press moves 5px. One prominent action per local task. Reserve ledge clearance in layouts.
- **Secondary action:** white, 1px neutral border, 2px neutral ledge; hover lifts 1px, press compresses. Optional destructive action uses error styling only where appropriate.
- **Icon action:** neutral secondary styling, 44×44px hit area, 18–20px icon. Send may be amber. Microphone shows active state with a small status marker and accessible label.
- **Navigation and tabs:** white/pale neutral fill, 1px border, no gummy transform. Current item uses pale gray plus an ink underline and `aria-current`. Family desk, Handbook, Staff always retain readable labels.
- **FAQ/disclosure:** one neutral clickable surface, 1px border, 2px quiet depth. No Card surrounding a second styled Button. Question and chevron share the same surface; optional 3px brand marker only. Hover changes neutral fill. Selected state uses a blue inset edge; no colored ledge.
- **Links:** dark blue, underline on hover/focus. Disclosure links and Handbook summaries never inherit primary button styling.

## Family desk viewport budgets

At tablet widths ≥768px and heights ≥700px, use the actual `100dvh` and measured header height. Remove the existing extra shell bottom padding/min-height combination. Every grid/flex ancestor of a scrolling answer requires `min-height: 0`; use `minmax(0, …)` tracks. Never conceal overflowing page content to fake a fit.

| Allocation | 1024×768 | 768×1024 |
| --- | --- | --- |
| Fixed header | 64px, single row | 88px, two rows |
| Main horizontal inset | 24px | 24px |
| Top inset + announcement + gap | 16 + 60 + 12px | 16 + 60 + 12px |
| Page heading + following gap | 56 + 16px | 56 + 16px |
| Workspace | 484px | 716px |
| Footer gap + footer + bottom inset | 12 + 32 + 16px | 12 + 32 + 16px |

These totals equal the viewport heights. Absent announcements return their space to the workspace. Compact the announcement to title/message preview with “Read more” for its complete text; never silently truncate essential content.

Landscape workspace: 40% composer/chat, 60% FAQs after a 24px gap. Portrait: 42% composer/chat, 58% FAQs after a 16px gap. Chat never exceeds 50% of workspace width on tablet/desktop. Approximate portrait widths are 296px/408px.

FAQ heading is 44px plus 12px gap. Display **all eight staff-selected questions in two columns × four rows**, 12px gaps, no pagination. Landscape tiles are 98px tall; portrait tiles can be 140px tall. Question text wraps naturally at 14/20px; no ellipsis for ordinary titles. A pathological title or enlarged text may use a contained FAQ region overflow fallback rather than clipped text or smaller type.

Composer starts at 220px high landscape, 240px portrait. On answer arrival it contracts to 164px, retaining label, input, microphone, and submit. The remaining column is an answer region with its own vertical scroll, stationary close/header, source attribution, and follow-up controls. Streaming must never expand the page or move the FAQ grid.

FAQ selection opens its answer in this same region; it does not expand a tile. Keep all eight questions reachable. Selection moves keyboard focus to the answer heading; closing restores the originating control. Announce loading/final status politely, not every streamed token. Optional enlarged reading dialog stays inside the viewport, scrolls internally, traps focus, and returns focus on close.

At 390px, use 16px insets, a two-row fixed header, natural document scrolling, full-width composer and a one-column FAQ list with ≥64px rows. The tablet 50% width rule becomes full width for phone usability. Expanded answers flow normally or use the reading dialog; allow keyboard/zoom overflow without clipping.

## Shared pages and feedback

Handbook uses the same neutral browse controls and typography: 16/26px article copy, quiet source metadata, a single reading surface. Staff uses neutral menus, tabs, tables, and secondary controls; amber identifies save/publish/approve. Keep tables horizontally scrollable when necessary.

Announcements use a pale neutral surface, 1px border, small semantic icon, no hard ledge. Warnings add amber tint; errors use the error tokens. Toasts are white, 1px neutral border, subtle floating shadow, 14/20px text, small status icon, neutral dismiss button; no gummy slab. On tablet Family desk, place toasts over the reserved announcement area so they do not obscure FAQs or composer actions.

Verify both tablet budgets with eight FAQs, announcement present, long streamed answer, and keyboard focus. Verify phone scrolling and enlarged text. Preserve reduced-motion and pause behavior throughout.

## Chat lifecycle and shared iPad contract

This section supersedes placing answers beneath the composer. Keep the established tablet column widths/heights and eight visible FAQs. Use one chat surface: stationary header, internally scrolling transcript, stationary bottom composer. Header: “Ask brightflare” and neutral “New question” control. Initially show a short prompt and roomy 220/240px composer. After submission, the column fills its allocated height; composer contracts to 164px. The transcript uses remaining space with `min-height: 0`.

Show the submitted question as an ink-on-pale-gray user bubble, followed immediately by a white assistant bubble containing progress, answer, attribution, or error. Use 16/24px body text. Keep both bubbles in the same scroll region. Anchor updates near the latest message only while the reader remains at the bottom; preserve position when they scroll upward. Each new submission replaces the previous exchange; do not accumulate prior families’ conversations. FAQ selection also displays its question and answer here.

Start an absolute eight-second deadline on submission, including network and streaming time. Progress text changes without implying verified work stages:

| Elapsed | Assistant bubble copy |
| --- | --- |
| 0 seconds | “Looking for an answer…” |
| 3 seconds | “Still waiting for an answer…” |
| 6 seconds | “Taking longer than expected…” |
| 8 seconds, no final answer | “We couldn’t get an answer in time. Try again or ask the front desk team.” |

Final answers replace progress immediately. Draft text remains visibly “Draft · not yet verified”; timeout removes it. Timeout aborts the request, stops loading, and invalidates its request identity so late events cannot change the screen. Clear timers on success, failure, reset, or unmount. Error bubble provides neutral “Try again”; retry uses the displayed question and a fresh deadline. Keep input available for editing; disable only duplicate submit during loading. “New question” always remains available.

“New question” clears question, answer, draft, errors, selected FAQ, and timers; aborts AI work; stops voice input and invalidates late voice callbacks; clears transient conversation context; then focuses the empty input. Show a persistent 12px hint: “Shared iPad · tap New question when you’re finished.” Preserve existing private-answer clearing after 30 seconds and on tab hiding.

For public exchanges, after 120 seconds without typing, scrolling, touch, or keyboard activity, show “Clear this conversation in 20 seconds?” with “Keep reading” and “Clear now.” Any activity cancels the countdown. Suspend automatic public clearing while composing, listening, loading, or the tab is hidden. Warning uses an inline status strip, preserves focus, and never covers input or FAQs.

Acceptance: verify 0/3/6/8-second states, success before deadline, ignored late final/draft/voice events, fresh retry, reset during loading, preserved reading position, idle-warning cancellation, private clearing, and unchanged eight-FAQ tablet fit.

## Layout clarification: aligned columns and expandable FAQs

This amendment supersedes the global page heading and FAQ-selection-only behavior above. Place “How can we help today?” above chat and “Popular questions” above FAQs, aligned at the same baseline. Both use 20/26px, weight 700, with 14/20px muted subtitles. Retain semantic H1/H2 levels while matching their appearance. Remove the separate heading spanning both columns. Put hours directly beneath the center name in the fixed navbar; keep both visible at every breakpoint.

All eight FAQs remain individual expandable cards in a two-column grid. Each has one neutral surface and an unstyled disclosure trigger containing the complete question and chevron. Expanding reveals up to two lines of short answer plus a “Full answer” text link that opens the complete sourced answer in chat. Only one card expands at a time; opening another collapses its predecessor. Do not nest a styled button or card inside the surface.

Reserve expansion space instead of growing the page. Landscape gains 72px from removing the global heading: workspace becomes 556px, column heading/gap uses 68px, grid receives 488px. Four closed 98px rows plus three 12px gaps use 428px, leaving 60px expansion reserve. The active row becomes 158px; its unexpanded neighbor stays 98px and top-aligned. Portrait has more room. Never ellipsize ordinary question titles; unusually long titles may scroll within the expanded preview. Full answers scroll within bounded chat. Phone disclosures expand naturally in document flow.
