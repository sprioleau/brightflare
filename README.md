<p align="left">
  <img src="public/assets/brightflare-logo-full.svg" alt="brightflare" width="360" />
</p>

**A calmer front desk for childcare families.** brightflare answers routine questions from a center-approved handbook, shows families where an answer came from, and gives staff a clear path to review the questions the handbook could not resolve.

**Try it:** [Family front desk](https://brightflare.sprioleau.dev/) · [Family handbook](https://brightflare.sprioleau.dev/handbook) · [Staff workspace](https://brightflare.sprioleau.dev/admin)

> brightflare is a fictional take-home prototype. Little Lantern Learning Center, its policies, staff, children, and family records are invented for demonstration. It does not connect to Brightwheel or contain real family information.

**Project notes:** [Build decisions](docs/build-decisions.md) · [Functionality audit](docs/functionality-audit.md) · [GitHub repository](https://github.com/sprioleau/brightflare)

## See it

### Family desk

![brightflare family desk on desktop](https://brightflare.sprioleau.dev/screenshots/parent-desktop.png?v=20260924-polish)

![brightflare family desk on a phone](https://brightflare.sprioleau.dev/screenshots/parent-mobile.png?v=20260924-polish)

### Staff workspace

![brightflare staff dashboard](https://brightflare.sprioleau.dev/screenshots/admin-dashboard.png?v=20260924-polish)

### Family handbook

![brightflare family handbook](https://brightflare.sprioleau.dev/screenshots/handbook-desktop.png?v=20260924-polish)

These captures show the current app. Any standalone HTML style explorations are design proposals and are not part of the live interface.

## How it helps

- **Families get a useful first answer.** Popular questions expand fully in their own cards. New questions and follow-ups stay together in a conversation with handbook sources and review dates. Clear chat starts a fresh session for the next family.
- **The app says when it does not know.** Missing, unclear, or sensitive policy questions go to staff instead of being guessed. Dated center updates can clarify a general handbook policy for a specific period.
- **The handbook works on a phone.** Families can browse published sections, open direct links, and follow a source citation from an answer to the relevant section. Staff can search handbook records in Admin, and the answer service can search approved records when grounding a reply.
- **Staff see what needs attention.** Admin shows recent questions, groups recurring topics, and highlights gaps or stale answers. Counts represent question events and anonymous sessions, not identified families.
- **Staff keep control of policy.** The assistant prepares sourced drafts for review. Staff can edit, publish, or dismiss them; it never changes the handbook on its own.
- **Private child questions stay private.** The shared desk directs unverified child-specific questions to staff. The backend also supports verified access to fictional family records, excludes private wording from public topic analytics, and clears private responses after a short period or when the tab is hidden.

## The prototype

The parent desk is designed for a landscape tablet and adapts to phones. It keeps the question form, answer, center hours, and featured questions together. The staff workspace supports handbook review, seasonal featured answers, announcements, center details, and writing guidance for generated drafts.

The source of truth is the center's structured handbook in Convex. The final answer cites retrieved source records, and the server checks those citations before presenting it as verified. Eligible routine answers may stream first as clearly labeled drafts without source links. The final answer replaces the draft only after citation checks pass; sensitive questions and handoffs do not stream draft answer text. Requests have an eight-second deadline, with progress messages and a clear retry or staff handoff when the service cannot respond in time.

The experience uses ShadCN components with amber primary actions, outlined buttons with playful depth, and clear white reading surfaces. Animated dots and small interactions support the task while keeping policy and provenance easy to scan; motion can be paused.

## Demo access

- Staff workspace: open `/admin` and use the demo credential configured for the environment.
- The backend family verification flow uses an environment-configured demo credential and a fictional family record. The shared desk currently has no family PIN entry screen and routes those questions to staff.

Demo credentials are not a production authentication scheme. Credentials are configured outside this repository.

## Run locally

Use Node.js 22+ and pnpm. Configure `NEXT_PUBLIC_CONVEX_URL`, `BRIGHTFLARE_SERVER_SECRET`, `BRIGHTFLARE_SESSION_SECRET`, `BRIGHTFLARE_ADMIN_PIN`, and `BRIGHTFLARE_FAMILY_PIN` in `.env.local`. For direct Gemini inference, also set `GOOGLE_GENERATIVE_AI_API_KEY`; Vercel AI Gateway credentials can be used instead. The default model is `gemini-3.5-flash-lite` and can be changed with `GEMINI_MODEL_ID`. Following the working Flock configuration, `gemini-3.6-flash` falls back to `gemini-3.5-flash-lite`; configured Flash-Lite can fall back to `gemini-3.5-flash`. Optionally set `OPENROUTER_API_KEY` to enable the final fallback, `openai/gpt-oss-20b:free`; `OPENROUTER_MODEL_ID` can select another OpenRouter model. The OpenRouter attempt runs only after Gemini and its existing alternate fail from capacity, quota, or the bounded attempt timeout. Parent answers reserve time for all three attempts within the original eight-second deadline, then validate structured output and approved-source citations as usual. Parent answers use minimal thinking and the supplied approved source text before using source tools.

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

Convex functions and the fictional Little Lantern fixture are in `convex/`. The initial seed creates the center only when it is absent; an additive demo update uses stable fixture keys and preserves existing handbook edits. `CHANGELOG.md` records shipped feature increments.
