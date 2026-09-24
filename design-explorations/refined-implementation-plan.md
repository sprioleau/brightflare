# Brightflare refined implementation plan

> Historical design draft. The September 24 final correction supersedes this plan where they differ: neutral controls have white tops and visible gummy depth; FAQs expand full answers in their own cards and never enter chat; chat retains follow-up turns and provides Clear chat. See [the current implementation audit](../docs/functionality-audit.md) and the live Next.js application.

Follow [the refined design spec](./refined-design-spec.md). Preserve real data, APIs, permissions, handlers, streaming, and accessible test labels.

## Ownership and order

1. **Shared foundation — Luna:** own `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/**`, `src/components/brand/app-shell.tsx`, and `public/fonts/**`. Restore neutral shared `border-border` and keyboard focus outlines. Restore logo-click answer close. Checkpoint this layer before page edits.
2. **Family and handbook — functionality/streaming agent:** own `src/components/parent/parent-desk.tsx`, its tests, `src/app/handbook/handbook-browser.tsx`, handbook routes, and tests. Keep existing streaming/sensitive-question behavior and browse/search APIs.
3. **Staff — content/submission agent:** own `src/components/admin/admin-console.tsx`, `src/components/admin/center-settings.tsx`, and their tests. Preserve staff actions and approval boundaries.
4. **Integration — root:** resolve cross-page issues, typecheck/regressions, inspect target viewports, and capture final screenshots.

## Shared foundation

Use the spec’s canvas, surface, ink, error, border, and action tokens. Keep neutral 1px boundaries and 2px surface ledges; retain self-hosted Manrope and ambient motion with pause/reduced-motion support. Avoid global raw-button selectors.

Keep `Button`/`buttonVariants` backward compatible. Add semantic variants for primary, neutral secondary, 44px icon action, navigation/tab, disclosure, and text link. Primary uses amber 3px borders and centered 6px ledge. Secondary uses a 1px neutral border and 2px ledge. Navigation, tabs, disclosures, and links avoid primary gummy motion. Apply shared classes directly to `TabsTrigger` and `DialogClose`; route page controls through shared variants. Keep error styling separate from pink decoration.

Expose shared typography classes for page title, section title, panel title, subheading, body, supporting text, and metadata using the exact sizes, line heights, colors, and 400/600/700 weights in the spec. Give Card, Input, Textarea, Alert, Badge, Table, Tabs, and Dialog quiet surfaces. Keep `NotificationBanner` neutral with semantic tone markers; style `AppToast` as a floating white surface with a neutral dismiss action.

Keep `AppShell.section` required. Add optional `centerName`, `actions`, `className` for page layout, and `onBrandClick` for answer close/focus restoration. Measure the fixed header into `--app-header-height`; target 64px landscape and 88px portrait, allowing a small deviation when the complete viewport allocation still fits. Its child slot accepts `<main>` without nesting another main.

## Page implementation

**Family desk:** At tablet ≥768px wide and ≥700px tall, use `100dvh` minus measured header; remove extra shell bottom padding/min-height. Answer-scroll ancestors use `min-height:0`; grid tracks use `minmax(0, …)`. Landscape is 40/60 after 24px; portrait 42/58 after 16px; chat stays at or below half-width. Show all eight FAQs in two columns/four rows with natural wrapping. Composer starts at 220px landscape/240px portrait and contracts to 164px after answer arrival. Scroll the answer internally with stationary heading/close, source, and follow-ups. FAQ selection opens there, focuses its heading, and close restores focus. Preview announcements with Read more. At 390px retain natural scrolling, full-width composer, one-column FAQ rows ≥64px, and zoom without clipping; preserve current phone progressive behavior.

**Handbook:** use neutral browse/search/tabs/disclosures, one article surface, 16/26px reading text, and quiet source metadata. **Staff:** use neutral navigation/tabs/tables/secondary actions; reserve amber for save/publish/approve and keep tables horizontally scrollable.

## Checkpoints

After foundation inspect border colors, focus, shell offsets, and variants. Verify 1024×768 and 768×1024 with announcement, eight FAQs, long streamed answer, and keyboard focus; input and every question must fit without clipping or hidden overflow. Verify 390px natural scrolling/zoom, answer close/focus return, handbook search/article navigation, and staff save/reload. Run meaningful regressions and typecheck before final captures.
