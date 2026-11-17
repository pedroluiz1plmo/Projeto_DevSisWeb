ALTER TABLE free_trials
  ADD COLUMN duration_days SMALLINT NOT NULL DEFAULT 7;

ALTER TABLE free_trials
  DROP CONSTRAINT free_trials_exact_duration,
  ADD CONSTRAINT free_trials_supported_duration
    CHECK (duration_days IN (7, 30)),
  ADD CONSTRAINT free_trials_exact_duration
    CHECK (ends_at = starts_at + make_interval(days => duration_days));

ALTER TABLE subscriptions
  ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
