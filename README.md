# brightflare

A calmer front desk for childcare families, with a companion workspace for center staff. Built as a Brightwheel take-home prototype around one loop: **families ask → the center sees demand → staff publish an approved answer → future families find it immediately.**

## What works

- **Parent desk:** up to six featured FAQs in a spaced, responsive card grid with one-sentence answers, full sourced answers, and text questions grounded in the active center handbook.
- **Time-aware knowledge:** staff can feature FAQs and set start/end dates for seasonal information. Expired entries leave the parent experience automatically.
- **Question stream and demand inbox:** staff see each submitted public question and its answer/source status. Related questions become de-identified topics with question and anonymous-session counts. Missing answers and answers needing review are called out.
- **Staff workflow:** approve a sourced handbook entry from a topic, including its parent-facing title, short answer, source label, and visibility dates. Published content immediately becomes searchable and can resolve the topic.
- **Admin assistant:** Vercel AI SDK tools retrieve current handbook entries, grouped questions, and prior-year seasonal demand to suggest titles, answer drafts, and timely FAQ ideas. Staff review all suggestions before publishing.
- **Private child path:** a demo family PIN gates fictional teacher-message search through `@child`. Child-specific questions are excluded from public topic analytics, and the answer clears from the shared screen after 30 seconds or when the tab is hidden.

The prototype uses **Little Lantern Learning Center**, a fictional center with seeded handbook entries, dated center updates, historical question counts, and one fictional child. It does not connect to Brightwheel's private APIs or use real family data. Audio is a stretch goal.

## Demo access

- Staff in local development and Preview: `/admin`, demo PIN `2468`. Production uses a separate Vercel environment variable.
- Family child search: choose **Ask about my child**, enter `Mia Carter` and PIN `1357`

These are intentionally simple **fictional demo credentials**, not a production authentication scheme. Production's admin credential is configured separately and is not stored in this repository.

## Run locally

Use Node.js 22+ and pnpm. Set `NEXT_PUBLIC_CONVEX_URL`, `BRIGHTFLARE_SERVER_SECRET`, `BRIGHTFLARE_SESSION_SECRET`, `BRIGHTFLARE_ADMIN_PIN`, and `BRIGHTFLARE_FAMILY_PIN` in `.env.local`. Set `GOOGLE_GENERATIVE_AI_API_KEY` for a direct Gemini connection, or use Vercel AI Gateway credentials. Both paths default to `gemini-3.6-flash`; `GEMINI_MODEL_ID` overrides the model. Parent answers fall back to Gemini 3.5 Flash Lite when 3.6 reports overload or a model-specific quota limit. The staff dashboard shows a time-ordered stream of parent questions, groups related public questions into topics, and keeps private child question wording out of the stream.

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

The UI starts from the ShadCN `b6a2WHJ20` preset and adapts rounded Neubrutalism details from the Brightflare logo: flat blue, teal, amber, and pink accents, dark outlines, and crisp offset shadows. Answers and sources stay on calm white surfaces for readability.
