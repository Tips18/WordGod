# Kaoyan English II Article Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Kaoyan English II `Text 1-4` article paragraphs to the same Passage import, seed, and random-reading pool used by English I.

**Architecture:** Reuse the existing WordCram article parser and importer, but make the source set explicit: English I comes from `真题题库/wordcram-kaoyan/articles/`, English II comes from `真题题库/kaoyan-english-ii/articles/`. The database schema and DTO contract already support `paper`, `textIndex`, and `paragraphIndex`, so this work only changes extraction, cache, seed loading, Prisma filtering, tests, and documentation.

**Tech Stack:** NestJS backend, Prisma/PostgreSQL, Jest, TypeScript, pnpm workspace.

---

## File Structure

- Modify `backend/src/content/word-bank.parser.ts`: keep Markdown parsing generic for `*-kaoyan-english-i-articles.md` and `*-kaoyan-english-ii-articles.md`; continue extracting only `Text 1-4`.
- Modify `backend/src/content/word-bank.importer.ts`: list both source directories and write a combined `content-cache/wordcram-article-passages.json`.
- Modify `backend/src/store/seed-passages.ts`: load cached or raw English I + English II passages in memory mode.
- Modify `backend/src/store/prisma-app.store.ts`: allow random reading to draw from approved English I and English II source domains without admitting old legacy rows.
- Modify tests in `backend/src/content/word-bank.parser.spec.ts`, `backend/src/content/word-bank.importer.spec.ts`, `backend/src/store/seed-passages.spec.ts`, and add a focused Prisma store query test if needed.
- Modify `README.md`, `docs/business/PRD.md`, `docs/technical/ARCHITECTURE.md`, and `docs/technical/DATABASE.md` to record the new runtime source set.

## Tasks

### Task 1: Parser Tests

**Files:**
- Modify: `backend/src/content/word-bank.parser.spec.ts`

- [ ] **Step 1: Add a failing English II parser test**

Add a test that reads `真题题库/kaoyan-english-ii/articles/2026-kaoyan-english-ii-articles.md`, asserts `paper === '英语二'`, asserts only `Text 1-4` are returned, and asserts no paragraph contains `____(1)____`.

- [ ] **Step 2: Verify red**

Run:

```powershell
corepack pnpm --filter backend test -- word-bank.parser.spec.ts
```

Expected: the new test fails because the current test helper only points at the English I directory or because the importer path still excludes English II.

### Task 2: Import Source Discovery Tests

**Files:**
- Modify: `backend/src/content/word-bank.importer.spec.ts`

- [ ] **Step 1: Add a failing discovery/cache test**

Add a test that calls `createWordBankImportPaths(workspaceRoot)` and `extractWordBankPassages(paths, true)`, then asserts the selected passages contain at least one `英语一` and one `英语二` item and that English II ids use `english-ii`.

- [ ] **Step 2: Verify red**

Run:

```powershell
corepack pnpm --filter backend test -- word-bank.importer.spec.ts
```

Expected: the new test fails because `listWordBankMarkdownFiles` currently only reads `wordcram-kaoyan/articles` and only matches English I.

### Task 3: Parser And Importer Implementation

**Files:**
- Modify: `backend/src/content/word-bank.parser.ts`
- Modify: `backend/src/content/word-bank.importer.ts`

- [ ] **Step 1: Keep parser generic**

Ensure metadata parsing accepts both `YYYY-kaoyan-english-i-articles.md` and `YYYY-kaoyan-english-ii-articles.md`; keep `selectWordBankPassages` id generation based on `toPaperSlug`.

- [ ] **Step 2: Add explicit source roots**

Replace the single `wordBankRoot` assumption with a list of article roots:

```typescript
[
  join(workspaceRoot, '真题题库', 'wordcram-kaoyan', 'articles'),
  join(workspaceRoot, '真题题库', 'kaoyan-english-ii', 'articles'),
]
```

List files matching `^\d{4}-kaoyan-english-(i|ii)-articles\.md$`, sort by file name, and parse each with `basename(file)`.

- [ ] **Step 3: Verify green**

Run:

```powershell
corepack pnpm --filter backend test -- word-bank.parser.spec.ts word-bank.importer.spec.ts
```

Expected: parser and importer tests pass.

### Task 4: Memory Seed Tests And Implementation

**Files:**
- Modify: `backend/src/store/seed-passages.spec.ts`
- Modify: `backend/src/store/seed-passages.ts`

- [ ] **Step 1: Update failing seed expectations**

Assert memory seed passages include `英语一` and `英语二`, ids remain unique, `kaoyan-2026-english-ii-reading-text-1` exists, and no passage title includes `Section I Use of English`.

- [ ] **Step 2: Verify red**

Run:

```powershell
corepack pnpm --filter backend test -- seed-passages.spec.ts
```

Expected: the English II count/id expectations fail under the current English I-only seed loader.

- [ ] **Step 3: Implement combined seed loading**

Update workspace root detection and raw extraction so both article roots are required when available. Keep fallback seed data only for missing article assets or a non-expanded extraction result.

- [ ] **Step 4: Verify green**

Run:

```powershell
corepack pnpm --filter backend test -- seed-passages.spec.ts
```

Expected: seed test passes with the combined English I + English II article bank.

### Task 5: Prisma Runtime Filter

**Files:**
- Modify: `backend/src/store/prisma-app.store.ts`
- Test: existing backend tests or a new focused test if the query can be exercised cleanly

- [ ] **Step 1: Update the Passage source filter**

Change `listPassages` from `sourceDomain = wordcram.com.cn` to an approved-source filter that includes:

```typescript
['wordcram.com.cn', 'jixun.iqihang.com', 'kaoyan.eol.cn', 'zhenti.burningvocabulary.cn']
```

Also keep `examType: 'kaoyan'` and `questionType: 'reading'` in the query so legacy non-reading rows cannot enter the random pool.

- [ ] **Step 2: Verify query compiles**

Run:

```powershell
corepack pnpm --filter backend test -- reading.service.spec.ts
```

Expected: reading service tests still pass.

### Task 6: Documentation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/business/PRD.md`
- Modify: `docs/technical/ARCHITECTURE.md`
- Modify: `docs/technical/DATABASE.md`

- [ ] **Step 1: Update docs**

Record that the V1 runtime reading bank now includes English I 1998-2026 and English II 2010, 2013-2026 `Text 1-4` paragraphs; `Section I Use of English` remains excluded from random reading.

- [ ] **Step 2: Run required verification**

Run:

```powershell
corepack pnpm --filter backend prisma:generate
corepack pnpm --filter backend test
corepack pnpm --filter backend exec eslint "{src,apps,libs,test}/**/*.ts"
```

Expected: Prisma generation succeeds; backend tests pass; ESLint exits with no error or warning.
