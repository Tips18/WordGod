-- Prevent duplicate imports for the same exam paper reading text.
CREATE UNIQUE INDEX "Passage_examType_year_paper_questionType_passageIndex_key"
ON "Passage"("examType", "year", "paper", "questionType", "passageIndex");
