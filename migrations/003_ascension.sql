-- ASCENSION update: three new weapon families and the Act II campaign
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_weapon_check;
ALTER TABLE runs ADD CONSTRAINT runs_weapon_check CHECK (weapon IN ('katana', 'daggers', 'hammer', 'scythe', 'gauntlets', 'bow'));
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_mode_check;
ALTER TABLE runs ADD CONSTRAINT runs_mode_check CHECK (mode IN ('campaign', 'act2', 'endless'));
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_stage_check;
ALTER TABLE runs ADD CONSTRAINT runs_stage_check CHECK (stage >= 0 AND (mode = 'endless' OR stage <= 10));
