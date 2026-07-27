-- 마일스톤 일정과 통합업무보드 업무의 공식 연결 구조
-- 임시 후보 데이터는 이관하지 않으며, 사용자가 확정한 연결만 저장한다.

BEGIN;

DROP TABLE IF EXISTS iota_v2.iota_schedule_task_link_candidates CASCADE;
DROP FUNCTION IF EXISTS iota_v2.prepare_schedule_link_candidate_review() CASCADE;

CREATE TABLE IF NOT EXISTS iota_v2.iota_schedule_task_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_item_id UUID NOT NULL
        REFERENCES iota_v2.iota_schedule_items(id)
        ON DELETE CASCADE,
    task_id UUID NOT NULL
        REFERENCES iota_v2.iota_pmo_tasks(id)
        ON DELETE CASCADE,
    link_source VARCHAR(20) NOT NULL DEFAULT 'existing'
        CHECK (link_source IN ('existing', 'new_task')),
    linked_by_email TEXT,
    linked_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (schedule_item_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_iota_schedule_task_links_schedule
ON iota_v2.iota_schedule_task_links(schedule_item_id);

CREATE INDEX IF NOT EXISTS idx_iota_schedule_task_links_task
ON iota_v2.iota_schedule_task_links(task_id);

CREATE OR REPLACE FUNCTION iota_v2.prepare_schedule_task_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iota_v2, public, auth
AS $$
DECLARE
    actor_email TEXT;
BEGIN
    actor_email := NULLIF(auth.jwt() ->> 'email', '');
    NEW.linked_by_email := actor_email;

    IF actor_email IS NOT NULL THEN
        SELECT member.staff_name
        INTO NEW.linked_by_name
        FROM public.iota_seoul_pilot_members AS member
        WHERE LOWER(member.email) = LOWER(actor_email)
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_schedule_task_link_trigger
ON iota_v2.iota_schedule_task_links;

CREATE TRIGGER prepare_schedule_task_link_trigger
BEFORE INSERT ON iota_v2.iota_schedule_task_links
FOR EACH ROW
EXECUTE FUNCTION iota_v2.prepare_schedule_task_link();

ALTER TABLE iota_v2.iota_schedule_task_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read schedule task links"
ON iota_v2.iota_schedule_task_links;

CREATE POLICY "Authenticated users can read schedule task links"
ON iota_v2.iota_schedule_task_links
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Planning and PM2 can create schedule task links"
ON iota_v2.iota_schedule_task_links;

CREATE POLICY "Planning and PM2 can create schedule task links"
ON iota_v2.iota_schedule_task_links
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.iota_seoul_pilot_members AS member
        WHERE LOWER(member.email) = LOWER(auth.jwt() ->> 'email')
          AND (
              member.workspace_code IN ('WS_PM2', 'WS_PM')
              OR member.role_code IN ('master', 'director')
              OR member.role_code ILIKE '%PO%'
              OR member.org_name ILIKE '%사업2파트%'
              OR member.org_name ILIKE '%기획추진%'
              OR member.org_name ILIKE '%시스템 관리자%'
          )
    )
);

DROP POLICY IF EXISTS "Planning and PM2 can delete schedule task links"
ON iota_v2.iota_schedule_task_links;

CREATE POLICY "Planning and PM2 can delete schedule task links"
ON iota_v2.iota_schedule_task_links
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.iota_seoul_pilot_members AS member
        WHERE LOWER(member.email) = LOWER(auth.jwt() ->> 'email')
          AND (
              member.workspace_code IN ('WS_PM2', 'WS_PM')
              OR member.role_code IN ('master', 'director')
              OR member.role_code ILIKE '%PO%'
              OR member.org_name ILIKE '%사업2파트%'
              OR member.org_name ILIKE '%기획추진%'
              OR member.org_name ILIKE '%시스템 관리자%'
          )
    )
);

GRANT SELECT, INSERT, DELETE
ON iota_v2.iota_schedule_task_links
TO authenticated;

CREATE OR REPLACE FUNCTION iota_v2.create_pmo_task_and_link_schedule(
    p_schedule_item_id UUID,
    p_project_code VARCHAR,
    p_category_main VARCHAR,
    p_task_name TEXT,
    p_task_purpose TEXT,
    p_deliverables TEXT,
    p_target_axis VARCHAR,
    p_lead_dept_code VARCHAR,
    p_assignee VARCHAR,
    p_due_date DATE,
    p_status VARCHAR,
    p_importance_level VARCHAR,
    p_is_blocker BOOLEAN,
    p_needs_decision BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = iota_v2, public, auth
AS $$
DECLARE
    new_task_id UUID;
    actor_email TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM iota_v2.iota_schedule_items AS schedule_item
        WHERE schedule_item.id = p_schedule_item_id
          AND schedule_item.item_type = 'task'
          AND schedule_item.is_active = TRUE
    ) THEN
        RAISE EXCEPTION '연결할 세부 일정 업무를 찾을 수 없습니다.';
    END IF;

    actor_email := NULLIF(auth.jwt() ->> 'email', '');

    INSERT INTO iota_v2.iota_pmo_tasks (
        project_code,
        category_main,
        task_name,
        task_purpose,
        deliverables,
        target_axis,
        gate_stage,
        pmo_manager,
        lead_dept_code,
        assignee,
        due_date,
        status,
        importance_level,
        task_type,
        is_blocker,
        needs_decision,
        created_by_email
    ) VALUES (
        p_project_code,
        p_category_main,
        p_task_name,
        NULLIF(BTRIM(p_task_purpose), ''),
        NULLIF(BTRIM(p_deliverables), ''),
        p_target_axis,
        'G0',
        '사업2파트',
        NULLIF(p_lead_dept_code, ''),
        NULLIF(BTRIM(p_assignee), ''),
        p_due_date,
        p_status,
        p_importance_level,
        '정규',
        COALESCE(p_is_blocker, FALSE),
        COALESCE(p_needs_decision, FALSE),
        actor_email
    )
    RETURNING id INTO new_task_id;

    INSERT INTO iota_v2.iota_schedule_task_links (
        schedule_item_id,
        task_id,
        link_source
    ) VALUES (
        p_schedule_item_id,
        new_task_id,
        'new_task'
    );

    RETURN new_task_id;
END;
$$;

REVOKE ALL
ON FUNCTION iota_v2.create_pmo_task_and_link_schedule(
    UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, VARCHAR, VARCHAR,
    VARCHAR, DATE, VARCHAR, VARCHAR, BOOLEAN, BOOLEAN
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION iota_v2.create_pmo_task_and_link_schedule(
    UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, VARCHAR, VARCHAR,
    VARCHAR, DATE, VARCHAR, VARCHAR, BOOLEAN, BOOLEAN
)
TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
