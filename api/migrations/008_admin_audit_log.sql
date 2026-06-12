-- Audit trail for admin changes to auto-refresh and seed locations.

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL
        CHECK (category IN ('refresh_config', 'seed_location')),
    action TEXT NOT NULL,
    entity_id TEXT,
    changed_by_uid TEXT,
    changed_by_email TEXT,
    previous_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
    ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_category_idx
    ON admin_audit_log (category, created_at DESC);
