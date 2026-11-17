ALTER TABLE free_trials
  DROP CONSTRAINT free_trials_exact_duration,
  ADD CONSTRAINT free_trials_active_exact_duration
    CHECK (
      status <> 'active'
      OR ends_at = starts_at + make_interval(days => duration_days)
    );
