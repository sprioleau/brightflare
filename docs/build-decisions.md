# brightflare build decisions

Updated September 24, 2026. This consolidates the original September 23 build notes with subsequent implementation and verification. The [functionality audit](functionality-audit.md) records detailed checks; [Git history](https://github.com/sprioleau/brightflare/commits/main/) records shipped changes.

## Product and trust

| Decision | Reason and consequence |
| --- | --- |
| Build both family and staff perspectives around one structured handbook. | A useful answer depends on maintained center policy. Staff can inspect demand, edit approved content, and publish it for the next family. Document ingestion was outside the chosen scope. |
| Use fictional center, policy, family, and child data. | The assignment requires a proof of concept without real personal data. No Brightwheel integration is implied. |
| Keep common FAQs independent from chat. | Approved cards expand entirely in place without a model call. New questions and follow-ups belong in the conversation; opening a card does not send a question. |
| Show source labels and review dates, and validate returned source IDs. | Families can inspect the policy behind an answer. Missing or insufficient evidence produces a staff handoff. Effective dates exclude draft, future, and expired records from current guidance. |
| Keep staff in control of publication. | AI proposes titles, answers, seasonal ideas, and stored create/update drafts. Approve, edit, and dismiss act on reviewable proposals; the model cannot silently change policy. |
| Separate public demand from private child context. | Trends count question events and anonymous sessions, not identified people. Verified private questions use authorized child records and exclude their wording from public topic analytics. Demo authentication illustrates the boundary; production identity and retention remain future work. |

## Interaction and visual evolution

- Early dense grids and a rigid visual treatment were revised after browser review. The final direction uses the supplied lowercase brightflare logo, white reading surfaces, thick outlined controls with visible depth, and amber primary actions. Policy and provenance remain the visual priority.
- The shared tablet desk supports eight closed FAQ cards with independent expansion, a conversation with follow-ups, Clear chat, and inactivity cleanup. Smaller screens scroll naturally instead of compressing text to fit.
- Public streamed text is explicitly provisional until validation. Private answers withhold provisional text. A request deadline and progress feedback prevent an indefinite loading state.
- Mobile navigation and utilities move into a disclosed menu; center identity and hours remain readable. Desktop keeps full navigation. Staff destinations have distinct URLs within a persistent workspace.
- Featured ordering, announcements, handbook search, and center writing guidance became implemented staff controls rather than deferred concepts. Voice input remains browser-dependent; spoken answer output is not implemented.

## Runtime and provider choices

- Next.js, TypeScript, shadcn/Tailwind, Convex, and the AI SDK support one small full-stack prototype. The production build uses Next's documented webpack flag after local Turbopack compilation stalled.
- Gemini 3.5 Flash-Lite became the default after observed Gemini 3.6 quota limits and review of the working Flock reference. Configured 3.6 falls back to 3.5 Flash-Lite; configured Flash-Lite can fall back to 3.5 Flash. Minimal Gemini thinking reduces avoidable latency. These observations do not establish universal provider limits.
- Parent requests share one eight-second deadline. With OpenRouter inactive, a primary attempt can use four seconds before its Gemini alternate gets the remaining time. OpenRouter is explicitly opt-in and requires `OPENROUTER_FALLBACK_ENABLED=true`, a nonblank `OPENROUTER_API_KEY`, and an explicit `OPENROUTER_MODEL_ID`; there is no implicit model default. When enabled, the two Gemini attempts have two seconds each and OpenRouter receives the remaining budget. Quota, capacity, and attempt timeouts can trigger fallback; authentication, invalid input, and caller cancellation do not.
- SDK partial-output streams can hide the original provider error behind a generic no-output failure. The app observes full-stream errors, suppresses raw SDK error logging, and retains bounded, redacted diagnostics with model, timing, category, and provider details. Public error messages use fixed categories.
- OpenRouter fallback testing found the former `openai/gpt-oss-20b:free` model unavailable on the free tier. `qwen/qwen3.8-27b:free` was upstream rate-limited. `liquid/lfm-2.5-2.6b:free` returned a grounded parent answer and usable staff title suggestions, but produced tool narration instead of a usable staff knowledge draft. `nvidia/nemotron-3-super-120b-a12b:free` did not produce parseable structured staff output. OpenRouter therefore remains inactive pending a model verified for both parent answers and staff assistance.
- Provider fallback, when explicitly enabled, retains the same structured output, authorized-source scope, and final citation checks. Local synthetic-data checks and production checks are recorded separately; success on a small synthetic probe is not evidence that every live workflow succeeds.

## Delivery and evidence

Browser checks accompany meaningful Vitest tests, TypeScript, and production builds. Verified app changes are pushed normally to main for Vercel deployment. The one-pager and recording plans remain review drafts until explicitly approved.

Production demo curation added eleven records through existing authenticated admin APIs without changing the original nine knowledge rows. It now includes fourteen current public records, eight current featured FAQs, two drafts, three future records, and one expired record. The missing late-pickup fee remains unresolved to demonstrate an honest handoff. No measured real-world time savings or distinct-family metrics are claimed.
