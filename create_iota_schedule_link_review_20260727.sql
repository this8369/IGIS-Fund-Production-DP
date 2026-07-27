-- 현재 주차(2026-07-W4) 마일스톤·통합업무 연결 후보 검토
-- 후보 원장: scripts/data/iota-schedule-link-candidates-20260727.json
-- 검토 승인 전에는 iota_schedule_items.linked_task_id를 변경하지 않는다.

BEGIN;

CREATE TABLE IF NOT EXISTS iota_v2.iota_schedule_task_link_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_item_id UUID NOT NULL
        REFERENCES iota_v2.iota_schedule_items(id)
        ON DELETE CASCADE,
    source_key VARCHAR(20) NOT NULL,
    candidate_period VARCHAR(20) NOT NULL,
    task_id UUID NOT NULL
        REFERENCES iota_v2.iota_pmo_tasks(id)
        ON DELETE CASCADE,
    task_display_id VARCHAR(20) NOT NULL,
    match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_reason TEXT NOT NULL,
    review_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'approved', 'rejected')),
    generated_by TEXT NOT NULL DEFAULT 'system',
    reviewed_by_email TEXT,
    reviewed_by_name TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_key, task_id, candidate_period),
    UNIQUE (task_id, candidate_period)
);

CREATE INDEX IF NOT EXISTS idx_schedule_link_candidates_source
ON iota_v2.iota_schedule_task_link_candidates(source_key, candidate_period);

CREATE INDEX IF NOT EXISTS idx_schedule_link_candidates_review
ON iota_v2.iota_schedule_task_link_candidates(review_status, candidate_period);

ALTER TABLE iota_v2.iota_schedule_task_link_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Planning and PM2 can read schedule link candidates"
ON iota_v2.iota_schedule_task_link_candidates;

CREATE POLICY "Planning and PM2 can read schedule link candidates"
ON iota_v2.iota_schedule_task_link_candidates
FOR SELECT
TO authenticated
USING (
    EXISTS (
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

DROP POLICY IF EXISTS "Planning and PM2 can review schedule link candidates"
ON iota_v2.iota_schedule_task_link_candidates;

CREATE POLICY "Planning and PM2 can review schedule link candidates"
ON iota_v2.iota_schedule_task_link_candidates
FOR UPDATE
TO authenticated
USING (
    EXISTS (
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
    EXISTS (
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

CREATE OR REPLACE FUNCTION iota_v2.prepare_schedule_link_candidate_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iota_v2, public, auth
AS $$
DECLARE
    actor_email TEXT;
    actor_name TEXT;
BEGIN
    NEW.updated_at := NOW();

    IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
        actor_email := NULLIF(auth.jwt() ->> 'email', '');

        IF actor_email IS NOT NULL THEN
            SELECT member.staff_name
            INTO actor_name
            FROM public.iota_seoul_pilot_members AS member
            WHERE LOWER(member.email) = LOWER(actor_email)
            LIMIT 1;
        END IF;

        IF NEW.review_status = 'pending' THEN
            NEW.reviewed_by_email := NULL;
            NEW.reviewed_by_name := NULL;
            NEW.reviewed_at := NULL;
        ELSE
            NEW.reviewed_by_email := actor_email;
            NEW.reviewed_by_name := actor_name;
            NEW.reviewed_at := NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_schedule_link_candidate_review_trigger
ON iota_v2.iota_schedule_task_link_candidates;

CREATE TRIGGER prepare_schedule_link_candidate_review_trigger
BEFORE UPDATE ON iota_v2.iota_schedule_task_link_candidates
FOR EACH ROW
EXECUTE FUNCTION iota_v2.prepare_schedule_link_candidate_review();

GRANT SELECT ON iota_v2.iota_schedule_task_link_candidates TO authenticated;
GRANT UPDATE (review_status) ON iota_v2.iota_schedule_task_link_candidates TO authenticated;
REVOKE INSERT, DELETE ON iota_v2.iota_schedule_task_link_candidates FROM authenticated;

INSERT INTO iota_v2.iota_schedule_task_link_candidates (
    schedule_item_id,
    source_key,
    candidate_period,
    task_id,
    task_display_id,
    match_score,
    match_reason,
    generated_by
)
VALUES
    (
        'fb1a2f9f-65a0-4070-9ee2-62a9e1db8ab0',
        'S-003',
        '2026-07-W4',
        '22897c33-96ba-4db7-a6cf-758848a57823',
        'T-006',
        100,
        '주관 조직과 업무분류가 일치하며 427/816 단독 PF 조건이라는 핵심 문구가 직접 일치',
        'Codex 검토 후보'
    ),
    (
        'efdb0b4c-0db3-45e4-a459-14d49bb3715c',
        'S-012',
        '2026-07-W4',
        'ad31f7bd-4ec8-4fb3-815e-d285bcd2eeb6',
        'T-028',
        94,
        '주관 조직과 업무분류가 일치하며 호텔 브랜드 운영방향 확정이라는 의사결정 범위가 일치',
        'Codex 검토 후보'
    ),
    (
        'c763506a-ac01-48be-b089-ce070221adf7',
        'S-013',
        '2026-07-W4',
        '3a68355a-b6d8-48fd-832d-8553e9a847d2',
        'T-010',
        82,
        '주관 조직과 업무분류가 일치하며 소노 협의안이 호텔 운영계약 구조 검토의 실행 항목에 해당',
        'Codex 검토 후보'
    ),
    (
        'dac0afae-5ed1-4510-a545-a89c7cb86eab',
        'S-041',
        '2026-07-W4',
        'a12ec0ec-0bcf-4349-9dcc-f3e912218cac',
        'T-043',
        96,
        '주관 조직과 업무분류가 일치하며 임관리비 관리 항목이 직접 일치',
        'Codex 검토 후보'
    ),
    (
        '42c21aad-71f7-43f9-a2d5-c3bf8c4271b7',
        'S-065',
        '2026-07-W4',
        'c6e65ff4-e8a4-4a9e-9452-1e317373e034',
        'T-034',
        80,
        '주관 조직과 업무분류가 일치하며 양동숲길·소공원로의 인허가 및 사용변경 협의 범위가 연관',
        'Codex 검토 후보'
    ),
    (
        '32ab4a01-dff0-4a2f-8407-d6ba3de82677',
        'S-074',
        '2026-07-W4',
        '0f861cd2-1200-42b2-884d-055dad5136c6',
        'T-002',
        84,
        '주관 조직과 업무분류가 일치하며 호텔 인테리어 계획설계와 FF&E 범위 정리가 직접 연관',
        'Codex 검토 후보'
    )
ON CONFLICT (source_key, task_id, candidate_period)
DO UPDATE SET
    task_display_id = EXCLUDED.task_display_id,
    match_score = EXCLUDED.match_score,
    match_reason = EXCLUDED.match_reason,
    generated_by = EXCLUDED.generated_by,
    updated_at = NOW();

COMMIT;

SELECT
    candidate_period,
    COUNT(*) AS candidate_count,
    COUNT(*) FILTER (WHERE review_status = 'pending') AS pending_count,
    COUNT(DISTINCT source_key) AS schedule_count,
    COUNT(DISTINCT task_id) AS task_count
FROM iota_v2.iota_schedule_task_link_candidates
WHERE candidate_period = '2026-07-W4'
GROUP BY candidate_period;
