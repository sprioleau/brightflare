# brightflare

A calmer front desk for childcare families, with a companion workspace for center staff. Built as a Brightwheel take-home prototype around one loop: **families ask → the center sees demand → staff publish an approved answer → future families find it immediately.**

## What works

- **Parent desk:** desktop and iPad views use a portrait chat rail beside a wider area for up to eight featured FAQs. **Preview iPad front desk** opens a simulated 1180 × 820 view for demos. On phones, the question comes first and FAQ rows expand progressively to show a short sourced answer. Families can ask with Shift + Enter, stay on the same screen for the answer, and open the exact source section in the [public handbook](src/app/handbook/page.tsx).
- **Time-aware knowledge:** staff can feature FAQs and set start/end dates for seasonal information. Expired entries leave the parent experience automatically.
- **Question stream and demand inbox:** staff see each submitted public question and its answer/source status. Related questions become de-identified topics with question and anonymous-session counts. Missing answers and answers needing review are called out.
- **Staff workflow:** approve a sourced handbook entry from a topic, including its parent-facing title, short answer, source label, and visibility dates. Published content immediately becomes searchable and can resolve the topic.
- **Admin recommendations:** opening Admin reviews published handbook entries, grouped parent questions, and seasonal demand. Gemini creates complete, persisted drafts for FAQ, staff-answer, or handbook changes. Staff can approve the saved draft instantly, edit it, or dismiss it. Unsupported policy facts require staff input before publication. The fixed-width admin workspace has searchable, status-marked recommendation rows and handbook-category question groups.
- **Center settings:** `/admin/settings` shares the Admin workspace shell and lets staff update the center name, hours, tagline, handbook title, website, and agent guidance for tone, audience, preferred and forbidden terms, and a center glossary. Public center details and the handbook title appear after saving.
- **Linkable handbook:** `/handbook` and `/handbook/[id]` render approved, currently effective sections in a responsive reading layout. The sitemap lists each section, and source links from parent answers open the matching page.
- **Private child path:** a demo family PIN gates fictional teacher-message search through `@child`. Child-specific questions are excluded from public topic analytics, and the answer clears from the shared screen after 30 seconds or when the tab is hidden.

The prototype uses **Little Lantern Learning Center**, a fictional center with seeded handbook entries, dated center updates, historical question counts, and one fictional child. It does not connect to Brightwheel's private APIs or use real family data. Audio is a stretch goal.

## Demo access

- Staff in local development and Preview: `/admin`, demo PIN `2468`. Production uses a separate Vercel environment variable.
- Family child search: choose **Ask about my child**, enter `Mia Carter` and PIN `1357`

These are intentionally simple **fictional demo credentials**, not a production authentication scheme. Production's admin credential is configured separately and is not stored in this repository.

## Run locally

Use Node.js 22+ and pnpm. Set `NEXT_PUBLIC_CONVEX_URL`, `BRIGHTFLARE_SERVER_SECRET`, `BRIGHTFLARE_SESSION_SECRET`, `BRIGHTFLARE_ADMIN_PIN`, and `BRIGHTFLARE_FAMILY_PIN` in `.env.local`. Set `GOOGLE_GENERATIVE_AI_API_KEY` for a direct Gemini connection, or use Vercel AI Gateway credentials. Both paths default to `gemini-3.5-flash-lite`; `GEMINI_MODEL_ID` overrides the model. Parent answers use read-only source lookup tools and fall back to Gemini 3.5 Flash if Flash-Lite reports overload or a model-specific quota limit. The staff dashboard shows a time-ordered stream of parent questions, groups related public questions into topics, and keeps private child question wording out of the stream.

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

Convex function definitions and the fictional seed live in `convex/`. The seed is an internal mutation named `brightflare:seedLittleLantern` and is idempotent. See `CHANGELOG.md` for delivered feature increments.

## Design choices

The center handbook and dated staff updates are the only sources for generated answers. A model response must cite IDs from the retrieved records; if it cannot, the parent sees a staff handoff. Staff, not the model, decide what becomes authoritative. Public question tracking stores a general topic and anonymous session key rather than raw child-specific text.

The UI uses ShadCN components and a simple theme guided by the `b51GFh7y6` preset. Brightflare blue is the primary action color; teal, amber, and pink add restrained accents. Soft borders, white reading surfaces, and pale color sections keep the parent iPad view and staff dashboard easy to scan. The earlier Neubrutalism treatment was removed after visual review.
