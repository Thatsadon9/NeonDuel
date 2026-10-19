-- Daily / Weekly challenges: seeded runs with their own leaderboards
ALTER TABLE runs ADD COLUMN IF NOT EXISTS seed text;
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_mode_check;
ALTER TABLE runs ADD CONSTRAINT runs_mode_check CHECK (mode IN ('campaign', 'act2', 'endless', 'daily', 'weekly'));
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_stage_check;
ALTER TABLE runs ADD CONSTRAINT runs_stage_check CHECK (stage >= 0 AND (mode IN ('endless', 'daily') OR stage <= 10));
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_seed_check;
ALTER TABLE runs ADD CONSTRAINT runs_seed_check CHECK ((mode IN ('daily', 'weekly')) = (seed IS NOT NULL));
CREATE INDEX IF NOT EXISTS runs_mode_seed_score_idx ON runs (mode, seed, score DESC) WHERE seed IS NOT NULL;
