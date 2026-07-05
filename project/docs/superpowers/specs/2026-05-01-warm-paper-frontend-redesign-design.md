# Warm Paper Frontend Redesign Design

## Context

The frontend redesign uses the user-provided palette as the visual foundation:

- `#E6DCCA` as the page canvas, muted paper surfaces, and low-contrast dividers.
- `#FED8B6` as the primary reading surface and soft emphasis background.
- `#FFCFAB` as secondary panels, hover layers, and vocabulary list surfaces.
- `#FFC2B0` as the strongest state color for marked words, primary actions, and active status.

The chosen direction is A, "paper literature": a calm, reading-first interface where the passage is the primary object and vocabulary details behave like margin notes.

## Scope

This redesign covers the existing V1 frontend pages only:

- `/`: reading detection page.
- `/auth`: login and registration page.
- `/vocabulary`: vocabulary list page.
- `/vocabulary/:lemma`: vocabulary detail page.

It does not add product features, exam categories, backend endpoints, CMS screens, payment, social features, rankings, or study plans.

## Visual System

The interface should feel like a focused study desk rather than a marketing page. The layout uses broad paper-like surfaces, thin warm dividers, quiet typography, and restrained shadows. Rounded corners should be moderate, not pill-heavy except for small tags and primary controls.

Primary visual rules:

- Use the four provided colors as the dominant palette.
- Keep body text high contrast with a warm near-black text color.
- Use `#FFC2B0` only where attention is needed: selected words, primary buttons, active tags, and counts.
- Keep card nesting shallow. Page sections can be full-width surfaces; individual repeated entries may be cards.
- Do not introduce decorative orbs, purple gradients, dark hero sections, or generic SaaS hero composition.

## Page Design

### Layout Shell

The app shell should become a compact study header, not a large hero card. It contains the product name, a short positioning line, route links, and the current account state. The header should sit on the warm canvas and use subtle paper translucency, giving the reading page immediate priority below it.

### Reading Page

The reading page is a two-column desktop layout:

- Left: the full passage in a large paper panel.
- Right: a sticky or visually persistent "Live Note" margin panel with the focused token, part of speech, definition, source sentence, and translation.

The passage content must still render from `passage.content` and remain readable as complete English prose. Clickable tokens should keep natural inline flow. Selected tokens use `#FFC2B0` with a text treatment that preserves readability and does not resize surrounding lines.

The page keeps the existing flow:

1. Load random passage.
2. Toggle token selection locally.
3. Show selected token details immediately.
4. Continue to next passage.
5. If unauthenticated, show the login/register dialog.
6. After authentication, complete the current attempt and show the next passage.

### Auth Page And Dialog

The login/register form should use the same warm paper system. Inputs should be simple, high-contrast, and accessible. The mode switch remains a secondary action. The auth dialog from the reading page should feel like an interruption checkpoint rather than a separate product surface.

### Vocabulary Pages

The vocabulary list should feel like an index of accumulated weak words. The count badge and active surfaces use the palette consistently, with `#FFC2B0` reserved for priority or count emphasis. The detail page should read as a vocabulary card plus recent context archive, using the same paper surfaces as reading notes.

## State And Error Handling

The redesign should keep current state behavior intact:

- Loading states should be visible and warm-toned.
- API failure on the reading page should show a clear error message instead of a long loading state.
- Vocabulary authentication failures should keep redirecting to `/auth?redirect=...`.
- The unauthenticated "next passage" path should keep opening the auth dialog.

## Implementation Boundaries

The implementation should stay frontend-focused and preserve current API contracts. It may introduce shared CSS variables and small presentational helpers, but it should not refactor backend logic or shared contract types.

All functions added or changed must keep summary-style comments, matching the project rule.

## Documentation Updates

After implementation, update:

- `README.md` with the current frontend visual direction.
- `docs/business/PRD.md` with the V1 interface experience expectation.
- `docs/technical/ARCHITECTURE.md` with the frontend visual system notes.
- `docs/technical/DATABASE.md` only to clarify that the visual redesign does not require schema changes.

## Verification

Implementation should be verified with:

- `corepack pnpm --filter frontend lint`
- `corepack pnpm --filter frontend test`
- `corepack pnpm --filter frontend build`

If a local dev server is used for visual review, check desktop and mobile widths for the reading page, auth page, vocabulary list, and vocabulary detail page. Text must not overlap, selected inline tokens must not shift passage layout, and the four-color palette must dominate the UI.

## Self-Review

- No unresolved requirements remain.
- Scope is limited to existing V1 frontend pages.
- The design matches the selected A direction and does not conflict with PRD constraints.
- The design does not require database or backend contract changes.
