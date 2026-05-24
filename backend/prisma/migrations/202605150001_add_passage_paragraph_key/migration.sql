ALTER TABLE "Passage"
ADD COLUMN "textIndex" INTEGER,
ADD COLUMN "paragraphIndex" INTEGER;

UPDATE "Passage"
SET "textIndex" = "passageIndex",
    "paragraphIndex" = 1
WHERE "textIndex" IS NULL
   OR "paragraphIndex" IS NULL;

ALTER TABLE "Passage"
ALTER COLUMN "textIndex" SET NOT NULL,
ALTER COLUMN "paragraphIndex" SET NOT NULL;

DROP INDEX IF EXISTS "Passage_examType_year_paper_questionType_passageIndex_key";

CREATE UNIQUE INDEX "Passage_examType_year_paper_questionType_textIndex_paragraphIndex_key"
ON "Passage"("examType", "year", "paper", "questionType", "textIndex", "paragraphIndex");
