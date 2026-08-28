CREATE UNIQUE INDEX "ev_deletion_jobs_owner_kind_target_unique"
ON "ev_deletion_jobs" USING btree ("user_id", "kind", "target_id");
