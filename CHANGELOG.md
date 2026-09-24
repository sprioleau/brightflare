# Changelog

Notable changes to brightflare and brightflare Admin.

## Delivered features

- **Family desk:** Desktop and iPad views keep question and answer on the left with up to eight featured FAQ cards on the right. Phones show the question first and compact FAQs that reveal previews on tap. Shift + Enter submits a question without leaving the desk.
- **Grounded questions:** Families can type a question for an answer based on the current handbook and dated center updates. Gemini 3.5 Flash-Lite uses focused, read-only source tools; only validated citations appear, and uncertain answers go to staff. Gemini 3.5 Flash handles Flash-Lite capacity or quota limits.
- **Seasonal knowledge:** Staff can feature evergreen or dated FAQs, choose visibility windows, and publish approved answers. Expired entries leave the parent desk automatically.
- **Question intelligence:** The admin console streams individual public questions with answer and source status, groups repeated questions into topics, and shows question and anonymous-session counts for staff review.
- **Admin recommendations:** Opening Admin can generate complete, grounded FAQ, staff-answer, or handbook drafts from question trends and seasonal history. Drafts are saved for Approve, Edit, or Dismiss; approval applies the stored draft without another inference call. The fixed-width admin workspace offers status cues, search, filters, and question groups tied to handbook categories or clearly marked suggested categories.
- **Center settings:** The separate `/admin/settings` page lets staff update public center details and agent guidance for tone, audience, preferred and forbidden terms, and a center glossary.
- **Public handbook:** Published, effective knowledge records render at `/handbook` and individual `/handbook/[id]` URLs. Parent answers link directly to their source section; the sitemap lists the public sections.
- **Private family path:** A verified demo family can ask about a fictional child and teacher messages with `@child`. Private wording stays out of public topics and the admin stream, and the shared screen clears the answer after the session.
- **Brightflare UI:** The family desk and staff console use the Brightflare logo, ShadCN components, a simple theme guided by preset `b51GFh7y6`, soft borders, and restrained blue, teal, amber, and pink accents.

## Unreleased

### Documentation
- Record FAQ card accessibility fix
- Update popular questions changelog
- Update feature changelog
- Generate feature changelog


### Features
- Add responsive family desk and center admin workspace
- Use Gemini 3.5 with scoped answer tools
- Show popular questions as spaced cards
- Add Gemini 3.6 answers and parent question stream
- Build sourced family desk and center admin prototype


### Fixes
- Fall back when Gemini 3.6 quota is exhausted
- Keep FAQ cards semantically clickable

