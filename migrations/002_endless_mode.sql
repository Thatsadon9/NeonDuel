-- Endless mode: runs get a mode; endless "stage" = rounds survived (no upper bound)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'campaign';
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_mode_check;
ALTER TABLE runs ADD CONSTRAINT runs_mode_check CHECK (mode IN ('campaign', 'endless'));
ALTER TABLE runs ALTER COLUMN stage TYPE integer;
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_stage_check;
ALTER TABLE runs ADD CONSTRAINT runs_stage_check CHECK (stage >= 0 AND (mode = 'endless' OR stage <= 10));

DROP INDEX IF EXISTS runs_hard_score_idx;
CREATE INDEX IF NOT EXISTS runs_mode_hard_score_idx ON runs (mode, hard, score DESC, created_at);
