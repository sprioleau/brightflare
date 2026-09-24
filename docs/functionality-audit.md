# Brightflare functionality and reliability audit

## Family desk

- The eight featured FAQs expand their complete approved answer, source link, and review date inside the same card. Opening a FAQ never calls the answer service or changes the conversation. Closed neighboring cards keep their height.
- New questions and follow-ups appear as a bounded, scrollable conversation. The client retains up to twenty displayed public turns and sends at most four completed public turns as context. The server validates the history shape and size, removes private-child turns, and treats history as untrusted context rather than policy evidence. Current authorized center sources remain the evidence for each answer.
- Clear chat aborts pending work, stops voice input, discards drafts and transcript, rotates the anonymous session, and focuses the composer. Late results cannot repopulate the cleared screen. Family-scoped logout preserves a staff session.
- Real activity, including an unsent draft, starts or resets the shared-screen idle timer. After two minutes, a twenty-second warning allows the family to keep reading or clear the conversation. Private responses clear after thirty seconds or when the tab is hidden. Unverified private questions direct families to staff; the shared desk has no family PIN entry screen.
- Voice input supports start/stop and inserts recognized text without submitting it. Browser start/listening/stop and mocked transcription/error/cleanup behavior are verified. Actual spoken-audio transcription has not been exercised.

## Grounded answer service

- Existing JSON callers remain supported. The family client requests newline-delimited streaming events from the real AI SDK `ToolLoopAgent`.
- Provisional text is shown only when a partial answer has authorized source IDs, does not require staff, and contains no configured forbidden terms. Private-child and medical/safety questions suppress provisional text. The final event follows citation validation, center wording checks, and recording the outcome.
- One eight-second deadline begins before request parsing and backend reads. The remaining budget and cancellation signal reach provider calls. Client progress appears at three and six seconds; timeout clears provisional text and offers retry or staff help. Cancellation after response headers, ignored aborts, and stalled failure logging are covered by tests.
- Following the working Flock model choice, configured Gemini 3.6 Flash falls back to Gemini 3.5 Flash-Lite; configured Flash-Lite can fall back to Gemini 3.5 Flash. Nested quota/capacity errors, including 429 `RESOURCE_EXHAUSTED` and 503 `UNAVAILABLE`, can trigger a Gemini alternate model, followed by optional OpenRouter when configured. Authentication and invalid-input errors do not trigger fallback. Provider retries are disabled so quota errors reach the fallback promptly. Without OpenRouter, a primary attempt has at most four seconds and the Gemini alternate receives only the remaining original deadline. With OpenRouter configured, the first two attempts have at most two seconds each and OpenRouter receives the remaining time. Wrapped attempt timeouts can trigger fallback; caller cancellation cannot. Without an alternate, the primary keeps the full remaining budget. The SDK timeout aborts the upstream model signal, and a draft is cleared before fallback output. Parent generation uses minimal Gemini thinking and answers directly from the supplied approved source text when sufficient.
- Already-dispatched Convex mutations cannot be interrupted and may settle after cancellation. Private wording remains excluded from public topic analytics.

## Staff and handbook

- Browser checks passed for all eight staff destinations: Dashboard, Recommendations, Questions, Question topics, Handbook, Front desk layout, Announcement, and Center settings.
- Saving unchanged announcement content produced the live-success toast. Saving unchanged settings produced success feedback and retained the saved hours after reload. The phone settings layout and horizontal staff navigation were inspected.
- Handbook search, article selection, direct section links, review/source metadata, mobile browse disclosure, and actual center hours were checked. Handbook hours come from the existing public front-desk query; no backend deployment is required.
- Admin drafts remain reviewable and never publish automatically. Stream/error/stale-result behavior is covered by regression tests. Later production checks below verified all three Admin AI suggestion modes.

## Annotated UI polish

- Family navigation and footer retain fixed viewport positions, with a scrolling body between them. Eight closed FAQs and the composer fit both iPad orientations; phone FAQs have equal widths and remain reachable by scrolling. Microphone and send controls sit inside the textarea, with reserved text padding.
- The handbook return-to-chat CTA has no underline. Staff Add an answer is amber; draft tag removal uses a plain accessible X. Topic cards have visible padding, gaps, and clipped accent stripes.
- All eight staff destinations have distinct URLs within a persistent shared layout. Browser navigation, history, and direct settings reload were verified. The selected destination is marked visually and with aria-current; Center settings stays at the desktop sidebar bottom.

## Release verification

- Current full Vitest checkpoint: **20 files, 93 tests passed**. TypeScript, `git diff --check`, and the production build passed.
- Browser layout passed at **1024×768**, **768×1024**, and **390×844**. All eight closed FAQs and the composer fit both iPad orientations. Expanded answers remain scrollable in the FAQ region, retain their card surface, and leave chat unchanged. Phone announcements display their full message.
- Refreshed screenshots are in `public/screenshots/`, with absolute production URLs in the README.
- Live checks found both application and provider limits: a default-thinking Flash-Lite probe used a redundant source-tool roundtrip at 6.7 seconds; a direct-source attempt still exceeded eight seconds. The final minimal-thinking Gemini 3.5 Flash probe returned a real 503 `UNAVAILABLE` in about 2.5 seconds, before any text. The Flock reference independently documents minimal thinking as its fix for Flash-Lite latency. The revised fallback/deadline behavior is regression-tested. The later production check below also verified a sourced real answer within the eight-second cap. The production build also passed a browser check confirming that a private family question and Clear chat preserve an authenticated staff session. Deployment verification follows publication.

## Provider diagnosis and error context

- A production request at 2026-09-24 19:01 UTC identified the actual runtime models: direct Google Gemini 3.5 Flash-Lite reached its four-second attempt budget, then Gemini 3.5 Flash returned HTTP 503 UNAVAILABLE after 291 ms. The original provider message reported high demand. This is capacity evidence, not a quota diagnosis.
- The SDK partial-output stream can omit provider error chunks and later reject with a generic NoOutputGeneratedError. Original full-stream errors are now preserved for fallback decisions and safe diagnostics. Default raw SDK error logging is disabled; detailed server diagnostics redact payloads and credentials. Public family/staff errors use fixed category messages. Saved staff recommendations remain reviewable when new generation fails.
- After deployment 5cd4799, the single production browser check at 2026-09-24 20:18:24 UTC returned the correct weekday hours, linked to Family Handbook · Hours with its September 1 review date. Correlated request 09eed497-7fe8-49d7-9cd5-2f304eda54c0 used direct Google Gemini 3.5 Flash-Lite: preflight 204 ms, model generation 883 ms, finalization complete at 1,135 ms. No fallback ran. The browser also displayed the expected idle-clear warning. This verifies one successful full production request; it does not guarantee provider availability for subsequent requests.
- One authorized isolated Gateway check using existing OIDC and fictional source text returned a correct structured answer from openai/gpt-4.1-mini in 1.854 seconds. This was a small independent check, not the full app workflow; app provider configuration was unchanged.

## Earlier evidence and data scope

Earlier real requests returned sourced answers in 22.5–39.2 seconds, before the eight-second cap. A later Google 503 indicated high demand; the user's AI Studio screenshot separately showed a Gemini 3.6 Flash rate-limit hit. Local development currently selects Gemini 3.5 Flash-Lite. These are distinct observations.

All demonstration center, policy, family, and child records are fictional. The original additive fixture update affected the personal development deployment `tame-cod-314`. The subsequent authorized production demo curation used existing authenticated admin APIs and required no Convex code deployment.

## Production agent coverage and optional fallback

- Serial production checks on September 24 at 20:36–20:38 UTC returned a sourced public hours answer (1.44 seconds), a verified fictional Mia Carter answer from the September 18 teacher message (2.27 seconds), and HTTP 401 for the same private question without family verification. Private output was withheld until its final validated answer. Correlated public/private model times were 956 ms and 1,934 ms, both direct Google Gemini 3.5 Flash-Lite.
- Staff title, knowledge, and seasonal assistance returned useful structured suggestions in 2.04, 1.27, and 2.33 seconds. Recommendations returned eight saved drafts without a generation error; that response alone does not prove fresh inference because generation has a ten-minute cooldown. The subsequent provider patch adds successful staff attempt logs for exact model attribution.
- A browser question about an unspecified late-pickup fee correctly requested staff follow-up without inventing a fee. The corresponding draft policy remains unresolved for the demo.
- Optional OpenRouter fallback is disabled unless OPENROUTER_API_KEY is configured. Its default model is openai/gpt-oss-20b:free. The existing grounded-answer validation, private-source scope, and eight-second family deadline remain in effect; no live OpenRouter call is claimed without a configured key.

- After release 3a39335 reached Ready, all three staff modes succeeded again. Correlated direct Google Gemini 3.5 Flash-Lite model times were 1,524 ms (title), 1,268 ms (knowledge), and 3,277 ms (seasonal). A fresh recommendation run after its cooldown used the same model successfully in 2,014 ms. No fallback ran in these checks.
- Production demo curation added eleven fictional entries through existing admin APIs: twenty stored entries now cover fourteen current public policies, eight current featured FAQs, two drafts, three future policies, and one expired policy. All nine original knowledge rows remained unchanged. The unsupported lunch recommendation was dismissed; the unresolved late-fee draft remains. An active October 12 announcement agrees with the published lunch policy.
- The final browser lunch question on September 24 at 20:51:14 UTC returned the correct pack-lunch answer, cited Family Handbook · Meals and nutrition with its September 24 review date, and opened the matching handbook entry. It used Flash-Lite in 812 ms and completed source validation at 1,055 ms. Production deployment dpl_DjsYAZbryPehVbsAMC2SuPqL67LJ served the verified release at https://brightflare.sprioleau.dev. OpenRouter remains configured in code only, pending its API key and a separate live check.
