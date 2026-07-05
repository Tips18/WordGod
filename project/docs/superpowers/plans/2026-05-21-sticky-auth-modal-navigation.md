# Sticky Auth Modal Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the header sticky, keep only reading and vocabulary as visible pages, move authentication into a modal, and show the logged-in email in the header.

**Architecture:** `App.tsx` owns global auth state and the modal so all pages can open the same authentication flow. Reading keeps its existing completion-intercept modal path through the shared auth handler, while vocabulary receives an auth-required callback instead of navigating to `/auth`.

**Tech Stack:** React 19, React Router, TanStack Query, Vitest, Testing Library, Tailwind CSS utility classes.

---

### Task 1: Update Behavior Tests

**Files:**
- Modify: `frontend/src/app.behavior.spec.tsx`

- [ ] Replace standalone `/auth` expectations with header modal expectations.
- [ ] Add coverage that logged-in navigation shows `reader@example.com`.
- [ ] Add coverage that guest vocabulary access opens the auth dialog instead of navigating to `/auth`.
- [ ] Run `corepack pnpm --filter frontend test -- app.behavior.spec.tsx` and verify the new tests fail before implementation.

### Task 2: Implement Global Auth Modal

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] Remove the visible `/auth` route from normal navigation.
- [ ] Add global modal state and shared login/register/reset handlers.
- [ ] Change the header to sticky styling and only show `阅读检测`, `生词本`, and either `登录 / 注册` or the user email plus logout.
- [ ] Keep `/auth` as a compatibility redirect to `/` or remove route exposure without breaking tests.

### Task 3: Wire Page-Level Auth Requirements

**Files:**
- Modify: `frontend/src/pages/reading-page.tsx`
- Modify: `frontend/src/pages/vocabulary-page.tsx`

- [ ] Keep reading-page interception, but allow the shell to update the visible header email after successful modal login.
- [ ] Replace vocabulary redirect-to-auth behavior with an `onAuthRequired` callback.
- [ ] Invalidate/refetch vocabulary after modal authentication by changing query enablement or shell state.

### Task 4: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/business/PRD.md`
- Modify: `docs/technical/ARCHITECTURE.md`
- Modify: `docs/technical/DATABASE.md`

- [ ] Document sticky top navigation, only two visible page entries, auth modal behavior, and logged-in email display.
- [ ] Confirm no database schema changes are required.

### Task 5: Verify

**Files:**
- Read: `frontend/package.json`

- [ ] Run focused frontend behavior tests.
- [ ] Run frontend build or lint if focused tests pass.
- [ ] Start local frontend dev server only if visual verification needs browser inspection.
