# Brightflare app reskin plan

> Historical design draft. The September 24 final correction supersedes this plan where they differ: neutral controls have white tops and visible gummy depth; FAQs expand full answers in their own cards and never enter chat; chat retains follow-up turns and provides Clear chat. See [the current implementation audit](../docs/functionality-audit.md) and the live Next.js application.

## Objective

Recreate the approved hybrid HTML direction in the existing Next.js app using real center records, existing AI SDK/Gemini streams, Convex data, authentication, and staff approval flows. The HTML previews remain the visual reference. This is a presentation refactor; API contracts and permission boundaries stay intact.

## Latest design correction — takes precedence over the initial button plan

The user clarified that applying colorful gummy action styling to every interactive element was too literal. Astra is defining a revised design system before further Luna implementation:

- Reserve strong color for primary actions. Header navigation, secondary controls, icon buttons, and cancel/dismiss use white or very pale neutral surfaces.
- FAQ and handbook disclosures are quiet content controls, not prominent action buttons. Remove nested FAQ cards and excessive teal fills.
- Use a compact FAQ grid. At iPad sizes, the resting family desk must show all eight selected questions and the composer without page scrolling; the chat must not grow past the viewport. Phones can scroll naturally.
- Constrain the app to Manrope and a short H1–H4/body/subheading typography scale, with restrained weights and colors.
- Sequence: Astra design specification → Luna implementation planning → shared primitive revision → parallel Luna page updates → browser checks at desktop, iPad landscape/portrait, and phone.
- Additional user request: investigate slow Gemini requests without assuming quota exhaustion; enforce an eight-second parent request deadline including time before response headers, with honest progress copy at three and six seconds. Keep submitted questions and answers together as message bubbles inside the bounded chat panel. Add New question, request/voice cancellation and stale-result protection, plus a shared-iPad inactivity warning/reset. Preserve stricter private-answer clearing. Astra's chat lifecycle addition is the implementation contract.
- Latest layout clarification: align “How can we help today?” and “Popular questions” as the two column headings, each with a subtitle. Render individual clickable/expandable FAQ cards in two columns, with one surface per card. Move center hours beneath the center name in the fixed navbar, rather than above the FAQs.

## Primitives and components identified before page work

| Layer | Shared implementation | Required behavior |
| --- | --- | --- |
| Tokens | Tailwind v4 variables in `globals.css` | Logo-derived teal, amber, pink, blue; pale cool background; dark readable text; Manrope; compact heading and spacing scale |
| Buttons | Existing shadcn `Button` and `buttonVariants` | Every variant, icon action, cancel, dismiss, tab, and navigation button has a same-hue 3px border and centered lower ledge; hover lift, pressed compression, disabled and keyboard focus states |
| Surfaces | Existing Card, Alert, Badge, Table, Tabs | Light raised panels, consistent radii, quiet separators, compact readable density |
| Fields | Existing Input, Textarea, labels and select treatment | Consistent padding/borders; strong focus; question card responds to focus within |
| Overlays | Existing Dialog and editor surfaces | Gummy close/cancel controls, safe viewport bounds, focus handling, scrollable long content |
| App shell | New `AppShell` | Shared full logo, navigation fixed flush to viewport top, responsive content offset, center name from data, accessible motion pause |
| Ambient motion | Shared shell and CSS | Continuously moving dots, floating plus signs, pointer-inert decoration, reduced-motion support |
| Family notification | New `NotificationBanner` | Real announcement content, matching raised style, readable semantic tone, optional gummy dismiss |
| Staff feedback | New `AppToast` | Real mutation feedback, success/error semantics, accessible status, gummy dismiss, mobile-safe placement |
| Page composition | Existing parent/Admin/settings plus reusable handbook browser | Real records and handlers; uniform Lucide icons; no Admin menu count badges |

The supplied full SVG is 698 × 128. Orange button fill is `#FFC266`, border `#BF7417`, lower ledge `#A95F16`. Other button tones follow the same hue-family rule. Page headings target 28–36px, section headings 18–22px. Desktop question column targets 40% and never exceeds half the content width. Avoid decorative eyebrow labels.

## Sequence and agent ownership

1. **Inventory and plan (conductor + two Luna agents, read-only):** map current pages, actions, and data boundaries; agree on shared component APIs. Save this plan before page refactors.
2. **Shared foundation (Luna):** theme, font, shadcn primitives, AppShell, NotificationBanner, AppToast. Own only shared UI, shell, global CSS/layout, and font assets. Complete this before page agents edit their pages.
3. **Parallel page work after foundation checkpoint:**
   - **Family/handbook Luna:** parent desk and handbook routes. Preserve speech start/stop/transcripts, progressive FAQs, grounded answer drafts/final citations, private-answer clearing, handoff/error/retry, iPad preview, and real handbook URLs/data. Integrate the real center announcement banner.
   - **Admin Luna:** sign-in, Dashboard, Recommendations, Questions, Question topics, Handbook editor, Front desk layout, Announcement, Center settings. Preserve filters, pagination, editor validation, approve/publish actions, streaming suggestions, cancellation, saved ordering, and settings. Use real successful/failed actions to show toast feedback.
4. **Page checkpoints (conductor):** review screenshots and browser interactions as each page becomes ready; send focused corrections to the owning Luna. Check desktop and 390px mobile, all Admin destinations, forms/overlays, fixed nav after scrolling, and notification/toast states.
5. **Integration gate:** run meaningful existing Vitest regressions, typecheck, production build, diff checks. Check a real sourced answer and staff save/reload flow on the existing development environment; report provider failures honestly. Capture final screenshots.
6. **Publishing (subsequently requested):** deploy the verified app and final `public/screenshots/` assets to the existing Brightflare Vercel project. Update the GitHub README to embed the verified absolute image URLs. Do not commit the submission one-pager. Any production Convex mutation still requires the deployment guard's specific approval; the visual refactor does not require backend changes.

## Shared API contract

```tsx
<AppShell section="family" centerName={center.name} actions={optionalActions}>
  <main>...</main>
</AppShell>

<NotificationBanner title={announcement.title} tone="info">
  {announcement.message}
</NotificationBanner>

<AppToast message={message} tone="success" onDismiss={clearMessage} />
```

`AppShell.section` is `family | handbook | admin`. It handles ambient motion and header spacing. Page agents retain their data fetching and state. Existing Button variants remain compatible; avoid page overrides that remove gummy borders or shadows. Ordinary inline text links remain links; controls styled as buttons use the shared variants.

## Acceptance checklist

- [ ] Shared tokens, actual Manrope font, and consistent shadcn primitives
- [ ] Every button treatment includes gummy depth, including cancel/dismiss/close and secondary actions
- [ ] Fixed top-zero full-width navbar; content and focused/anchored elements remain visible
- [ ] Family desk matches preview composition with real announcement and answer behavior
- [ ] Handbook browsing, source pages, and search use real published records
- [ ] All Admin destinations and settings match the same visual language
- [ ] Admin save feedback appears in matching, accessible dismissible toast
- [ ] Motion pause and reduced-motion preference work; no mobile document overflow
- [ ] Browser interactions/screenshots reviewed per page
- [ ] Regression suite, typecheck, and build pass; limitations documented

## Verification record

- Baseline: real family center announcement and eight featured answers load; local fictional staff sign-in succeeds.
- Foundation checkpoint: self-hosted Manrope plus license, shared shell/notification APIs and theme are implemented; page agents started only after that checkpoint.
- Publishing target verified read-only: Vercel `sprioleau-projects/brightflare`, project `prj_M1BJ3hm8eIDuwS1yh8BOVnAzJeN1`.

## Submission follow-up requested by the user

- Evaluate the completed reskin against the take-home criteria: realistic finished scope, persuasive value, parent/staff empathy, and distinctive craft.
- Preserve both functional perspectives: center-specific trustworthy parent answers with graceful sensitive/uncertain handling; staff source editing, visibility into demand/failures, and an improvement loop. Use fictional data throughout.
- `docs/submission.md` is the reviewable Markdown draft. After the app is complete and verified, update it to describe what was actually finished in less than one page. Clearly distinguish local work from the hosted release.
- Do not commit the submission document yet. When the user asks “what’s next” or how to finish, remind them to review the Markdown one-pager; consider committing it only once everything is complete and the user is ready.
- README was already updated earlier, with screenshots of the previous UI. Refresh documentation and screenshots only after the reskin is complete; avoid spending effort on interim captures for the README.
- The user subsequently requested publishing the screenshots: save final captures under `public/screenshots/`, deploy the completed app/assets, and use absolute public screenshot URLs in the GitHub README. Verify the URLs after deployment. Keep `docs/submission.md` uncommitted.
