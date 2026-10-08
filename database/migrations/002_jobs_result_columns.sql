-- Optional enrichment for report workflow results
-- Run against existing kenya_crm databases that already have `jobs`.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS result_path VARCHAR(512) NULL AFTER error_message,
  ADD COLUMN IF NOT EXISTS result_json JSON NULL AFTER result_path;
