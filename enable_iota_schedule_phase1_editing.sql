-- 마일스톤 상세 일정 1단계 편집 기능
-- 범위: 기존 task 행의 내용/기간/진행상태 수정, 자동 완료일, 변경 이력

BEGIN;

ALTER TABLE iota_v2.iota_schedule_items
    ADD COLUMN IF NOT EXISTS progress_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS actual_completed_date DATE,
    ADD COLUMN IF NOT EXISTS updated_by_email TEXT,
    ADD COLUMN IF NOT EXISTS updated_by_name TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'iota_schedule_items_progress_status_check'
          AND conrelid = 'iota_v2.iota_schedule_items'::regclass
    ) THEN
        ALTER TABLE iota_v2.iota_schedule_items
            ADD CONSTRAINT iota_schedule_items_progress_status_check
            CHECK (progress_status IN ('not_started', 'in_progress', 'completed', 'on_hold'));
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS iota_v2.iota_schedule_item_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_item_id UUID NOT NULL
        REFERENCES iota_v2.iota_schedule_items(id)
        ON DELETE RESTRICT,
    source_key VARCHAR(20) NOT NULL,
    changed_fields TEXT[] NOT NULL,
    previous_values JSONB NOT NULL,
    next_values JSONB NOT NULL,
    changed_by_email TEXT NOT NULL,
    changed_by_name TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iota_schedule_history_item
ON iota_v2.iota_schedule_item_history(schedule_item_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_iota_schedule_history_source
ON iota_v2.iota_schedule_item_history(source_key, changed_at DESC);

ALTER TABLE iota_v2.iota_schedule_item_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read schedule item history"
ON iota_v2.iota_schedule_item_history;

CREATE POLICY "Authenticated users can read schedule item history"
ON iota_v2.iota_schedule_item_history
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Planning and PM2 can update schedule tasks"
ON iota_v2.iota_schedule_items;

CREATE POLICY "Planning and PM2 can update schedule tasks"
ON iota_v2.iota_schedule_items
FOR UPDATE
TO authenticated
USING (
    item_type = 'task'
    AND EXISTS (
        SELECT 1
        FROM public.iota_seoul_pilot_members AS member
        WHERE LOWER(member.email) = LOWER(auth.jwt() ->> 'email')
          AND (
              member.org_name ILIKE '%기획추진%'
              OR member.org_name IN ('사업2파트', '사업그룹2파트', '사업관리2파트', '사업파트2')
              OR member.workspace_code = 'WS_PM2'
          )
    )
)
WITH CHECK (
    item_type = 'task'
    AND EXISTS (
        SELECT 1
        FROM public.iota_seoul_pilot_members AS member
        WHERE LOWER(member.email) = LOWER(auth.jwt() ->> 'email')
          AND (
              member.org_name ILIKE '%기획추진%'
              OR member.org_name IN ('사업2파트', '사업그룹2파트', '사업관리2파트', '사업파트2')
              OR member.workspace_code = 'WS_PM2'
          )
    )
);

CREATE OR REPLACE FUNCTION iota_v2.prepare_iota_schedule_item_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iota_v2, public, auth
AS $$
DECLARE
    actor_email TEXT;
    actor_name TEXT;
BEGIN
    actor_email := NULLIF(auth.jwt() ->> 'email', '');

    IF actor_email IS NOT NULL THEN
        SELECT member.staff_name
        INTO actor_name
        FROM public.iota_seoul_pilot_members AS member
        WHERE LOWER(member.email) = LOWER(actor_email)
        LIMIT 1;

        NEW.updated_by_email := actor_email;
        NEW.updated_by_name := actor_name;
    END IF;

    NEW.updated_at := NOW();

    IF NEW.progress_status = 'completed' AND NEW.actual_completed_date IS NULL THEN
        NEW.actual_completed_date := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
    ELSIF OLD.progress_status = 'completed' AND NEW.progress_status <> 'completed' THEN
        NEW.actual_completed_date := NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION iota_v2.record_iota_schedule_item_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iota_v2, public, auth
AS $$
DECLARE
    actor_email TEXT;
    actor_name TEXT;
    previous_values JSONB;
    next_values JSONB;
    changed_fields TEXT[];
BEGIN
    actor_email := NULLIF(auth.jwt() ->> 'email', '');
    IF actor_email IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT member.staff_name
    INTO actor_name
    FROM public.iota_seoul_pilot_members AS member
    WHERE LOWER(member.email) = LOWER(actor_email)
    LIMIT 1;

    previous_values := JSONB_BUILD_OBJECT(
        'display_name', OLD.display_name,
        'lead_dept_code', OLD.lead_dept_code,
        'lead_label', OLD.lead_label,
        'category_main', OLD.category_main,
        'start_period', OLD.start_period,
        'end_period', OLD.end_period,
        'milestone_period', OLD.milestone_period,
        'progress_status', OLD.progress_status,
        'actual_completed_date', OLD.actual_completed_date
    );

    next_values := JSONB_BUILD_OBJECT(
        'display_name', NEW.display_name,
        'lead_dept_code', NEW.lead_dept_code,
        'lead_label', NEW.lead_label,
        'category_main', NEW.category_main,
        'start_period', NEW.start_period,
        'end_period', NEW.end_period,
        'milestone_period', NEW.milestone_period,
        'progress_status', NEW.progress_status,
        'actual_completed_date', NEW.actual_completed_date
    );

    SELECT ARRAY_AGG(field_name ORDER BY field_name)
    INTO changed_fields
    FROM JSONB_OBJECT_KEYS(next_values) AS field_name
    WHERE previous_values -> field_name IS DISTINCT FROM next_values -> field_name;

    IF COALESCE(ARRAY_LENGTH(changed_fields, 1), 0) = 0 THEN
        RETURN NEW;
    END IF;

    INSERT INTO iota_v2.iota_schedule_item_history (
        schedule_item_id,
        source_key,
        changed_fields,
        previous_values,
        next_values,
        changed_by_email,
        changed_by_name
    )
    VALUES (
        NEW.id,
        NEW.source_key,
        changed_fields,
        previous_values,
        next_values,
        actor_email,
        actor_name
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_iota_schedule_item_update_trigger
ON iota_v2.iota_schedule_items;

CREATE TRIGGER prepare_iota_schedule_item_update_trigger
BEFORE UPDATE ON iota_v2.iota_schedule_items
FOR EACH ROW
EXECUTE FUNCTION iota_v2.prepare_iota_schedule_item_update();

DROP TRIGGER IF EXISTS record_iota_schedule_item_history_trigger
ON iota_v2.iota_schedule_items;

CREATE TRIGGER record_iota_schedule_item_history_trigger
AFTER UPDATE ON iota_v2.iota_schedule_items
FOR EACH ROW
EXECUTE FUNCTION iota_v2.record_iota_schedule_item_history();

GRANT SELECT ON iota_v2.iota_schedule_item_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON iota_v2.iota_schedule_item_history FROM authenticated;

GRANT UPDATE (
    task_name,
    display_name,
    lead_dept_code,
    lead_label,
    category_main,
    start_period,
    end_period,
    milestone_period,
    progress_status,
    actual_completed_date
) ON iota_v2.iota_schedule_items TO authenticated;

COMMIT;

SELECT
    COUNT(*) AS total_items,
    COUNT(*) FILTER (WHERE item_type = 'task') AS editable_tasks,
    COUNT(*) FILTER (
        WHERE item_type = 'task'
          AND progress_status = 'not_started'
    ) AS not_started_tasks
FROM iota_v2.iota_schedule_items
WHERE is_active = TRUE;
