# Email Code Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete email-code registration, login, and password reset so the existing frontend auth UI works end to end.

**Architecture:** Add a focused email-code service with an email sender abstraction. Persist code records through the existing `AppStore` boundary in memory and Prisma stores, while reusing `AuthService` session issuance for successful code login and reset.

**Tech Stack:** NestJS, Prisma/PostgreSQL, bcrypt, Jest, React, Vitest, pnpm workspace.

---

### Task 1: Backend Email Code Domain

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `backend/src/store/store.types.ts`
- Modify: `backend/src/store/app-store.ts`
- Modify: `backend/src/store/in-memory-app.store.ts`
- Modify: `backend/src/store/prisma-app.store.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/202605200001_add_email_verification_codes/migration.sql`
- Create: `backend/src/auth/email-code.service.ts`
- Create: `backend/src/auth/email-sender.ts`
- Test: `backend/src/auth/email-code.service.spec.ts`

- [ ] Write failing Jest tests for sending a 6-digit code, rejecting resend within 60 seconds, consuming a valid code, rejecting expired/wrong/over-attempted/consumed codes.
- [ ] Run `corepack pnpm --filter backend test -- email-code.service.spec.ts --runInBand` and confirm failures are from missing implementation.
- [ ] Implement store record types and methods for email verification codes.
- [ ] Implement in-memory and Prisma persistence plus Prisma migration.
- [ ] Implement console email sender and `EmailCodeService`.
- [ ] Re-run the focused backend test and confirm it passes.

### Task 2: Backend Auth Endpoints

**Files:**
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

- [ ] Write failing tests for register requiring a valid register code, email-code login creating a session with `rememberLogin`, and password reset making the old password invalid.
- [ ] Run `corepack pnpm --filter backend test -- auth.service.spec.ts --runInBand` and confirm expected failures.
- [ ] Wire `EmailCodeService` into `AuthService` and expose `sendEmailCode`, `loginWithEmailCode`, and `resetPassword`.
- [ ] Add controller routes `POST /auth/email-codes`, `POST /auth/login/email-code`, and `POST /auth/password/reset`.
- [ ] Register providers in `AppModule`.
- [ ] Re-run focused backend auth tests.

### Task 3: Frontend Auth Flow

**Files:**
- Modify: `frontend/src/components/auth-form-card.tsx`
- Modify: `frontend/src/pages/auth-page.tsx`
- Modify: `frontend/src/pages/reading-page.tsx`
- Test: `frontend/src/app.behavior.spec.tsx`

- [ ] Write failing Vitest coverage for code-login API calls, register requiring `emailCode`, reset-password flow, and send-code countdown behavior.
- [ ] Run `corepack pnpm --filter frontend test -- app.behavior.spec.tsx` and confirm expected failures.
- [ ] Fix any broken text, mode-specific submit labels, and API wiring needed for the existing auth UI.
- [ ] Re-run focused frontend tests.

### Task 4: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `frontend/README.md`
- Modify: `docs/business/PRD.md`
- Modify: `docs/technical/ARCHITECTURE.md`
- Modify: `docs/technical/DATABASE.md`
- Modify: `docs/technical/CODE_NOTES.md`

- [ ] Update docs to remove the old “no email verification” V1 statement and describe the completed auth flow.
- [ ] Run `corepack pnpm --filter @word-god/contracts build`.
- [ ] Run focused backend and frontend tests.
- [ ] Run `corepack pnpm --filter backend lint`.
- [ ] Run `corepack pnpm --filter frontend lint`.
