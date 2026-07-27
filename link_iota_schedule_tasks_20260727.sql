-- 마일스톤 세부업무 67건과 통합업무보드의 주제 연관 연결
-- 연결 근거 원장: scripts/data/iota-schedule-task-links-20260727.json

BEGIN;

GRANT UPDATE (
    linked_task_id,
    board_link_state
) ON iota_v2.iota_schedule_items TO authenticated;

CREATE TEMP TABLE schedule_task_link_map (
    source_key VARCHAR(20) PRIMARY KEY,
    linked_task_id UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO schedule_task_link_map (source_key, linked_task_id)
VALUES
    ('S-003', '185c6f9d-f5f5-479d-a69d-11807004460d'),
    ('S-004', '185c6f9d-f5f5-479d-a69d-11807004460d'),
    ('S-005', '3ff551cd-4b7d-45e2-869b-2c85c3f97302'),
    ('S-006', '185c6f9d-f5f5-479d-a69d-11807004460d'),
    ('S-007', '3ff551cd-4b7d-45e2-869b-2c85c3f97302'),
    ('S-008', '3ff551cd-4b7d-45e2-869b-2c85c3f97302'),
    ('S-009', '3ff551cd-4b7d-45e2-869b-2c85c3f97302'),
    ('S-012', 'ad31f7bd-4ec8-4fb3-815e-d285bcd2eeb6'),
    ('S-013', 'ad31f7bd-4ec8-4fb3-815e-d285bcd2eeb6'),
    ('S-014', 'e5307e10-99f8-4cc7-973e-36ac2ab6b4cd'),
    ('S-015', 'de787fc4-f824-48d8-a26d-3d93706e460e'),
    ('S-018', 'cb74d9d6-13ac-401b-8eae-6d428f5780f4'),
    ('S-019', 'cb74d9d6-13ac-401b-8eae-6d428f5780f4'),
    ('S-020', 'ef5bebbf-5d2d-4359-a2a2-40e4d45e8b8e'),
    ('S-022', '8613d21b-6f58-4512-9ef8-c42d0dcbc86d'),
    ('S-024', '5746487d-2b2d-4ae2-a77a-687fbed95cb4'),
    ('S-025', '5746487d-2b2d-4ae2-a77a-687fbed95cb4'),
    ('S-026', 'cb74d9d6-13ac-401b-8eae-6d428f5780f4'),
    ('S-029', '4d39b518-0acd-4e1f-8f59-b2f4c235da50'),
    ('S-030', '7410ddd6-16f5-4885-a2db-5e077678892e'),
    ('S-031', '5bdbd000-43e2-45c7-b8de-bcc6014eac18'),
    ('S-032', '7410ddd6-16f5-4885-a2db-5e077678892e'),
    ('S-034', '9b7684ff-5ec3-47ed-a128-2f81d7815c80'),
    ('S-035', '9b7684ff-5ec3-47ed-a128-2f81d7815c80'),
    ('S-036', '9b7684ff-5ec3-47ed-a128-2f81d7815c80'),
    ('S-037', '4d39b518-0acd-4e1f-8f59-b2f4c235da50'),
    ('S-038', '4d39b518-0acd-4e1f-8f59-b2f4c235da50'),
    ('S-039', '5bdbd000-43e2-45c7-b8de-bcc6014eac18'),
    ('S-041', 'a12ec0ec-0bcf-4349-9dcc-f3e912218cac'),
    ('S-042', '9b7684ff-5ec3-47ed-a128-2f81d7815c80'),
    ('S-043', '9b7684ff-5ec3-47ed-a128-2f81d7815c80'),
    ('S-044', 'ee00e54d-535b-498b-ae7c-fccc75a71bcd'),
    ('S-047', '4d39b518-0acd-4e1f-8f59-b2f4c235da50'),
    ('S-048', '9b7684ff-5ec3-47ed-a128-2f81d7815c80'),
    ('S-049', 'ba8c4321-6730-43e8-b943-499e73080103'),
    ('S-050', '4d39b518-0acd-4e1f-8f59-b2f4c235da50'),
    ('S-051', '4d39b518-0acd-4e1f-8f59-b2f4c235da50'),
    ('S-053', 'ba8c4321-6730-43e8-b943-499e73080103'),
    ('S-054', 'ba8c4321-6730-43e8-b943-499e73080103'),
    ('S-055', 'ba8c4321-6730-43e8-b943-499e73080103'),
    ('S-056', '4d39b518-0acd-4e1f-8f59-b2f4c235da50'),
    ('S-059', 'a428eb4f-0254-4dc0-b43a-65eabf9ff415'),
    ('S-060', 'a428eb4f-0254-4dc0-b43a-65eabf9ff415'),
    ('S-061', 'a428eb4f-0254-4dc0-b43a-65eabf9ff415'),
    ('S-064', 'de787fc4-f824-48d8-a26d-3d93706e460e'),
    ('S-065', 'c6e65ff4-e8a4-4a9e-9452-1e317373e034'),
    ('S-066', 'de787fc4-f824-48d8-a26d-3d93706e460e'),
    ('S-068', '050cd579-5bc6-4dcb-a92a-30038f3c874a'),
    ('S-069', 'ea6ae6be-a80a-4a8b-b705-f80e24b25abc'),
    ('S-070', '050cd579-5bc6-4dcb-a92a-30038f3c874a'),
    ('S-071', 'c6e65ff4-e8a4-4a9e-9452-1e317373e034'),
    ('S-072', '81f7c8ab-3d52-441e-b263-9d93ff3712d6'),
    ('S-073', '0f861cd2-1200-42b2-884d-055dad5136c6'),
    ('S-074', '0f861cd2-1200-42b2-884d-055dad5136c6'),
    ('S-075', '0f861cd2-1200-42b2-884d-055dad5136c6'),
    ('S-077', '1a44166e-30b9-4569-a74e-becdfba1e9fa'),
    ('S-078', 'ab79464a-cd4b-4c6b-a2b5-4ec57b1e2550'),
    ('S-079', 'bc8fe572-ebbf-4d55-9313-376b33eac394'),
    ('S-080', 'c6e65ff4-e8a4-4a9e-9452-1e317373e034'),
    ('S-083', '050cd579-5bc6-4dcb-a92a-30038f3c874a'),
    ('S-084', 'ea6ae6be-a80a-4a8b-b705-f80e24b25abc'),
    ('S-085', '738ca0ba-71fe-4d9e-9f8d-6f1178779284'),
    ('S-086', 'c6e65ff4-e8a4-4a9e-9452-1e317373e034'),
    ('S-087', '9301df94-37b1-4c96-8c06-37707569b5bd'),
    ('S-089', '1a44166e-30b9-4569-a74e-becdfba1e9fa'),
    ('S-090', '1a44166e-30b9-4569-a74e-becdfba1e9fa'),
    ('S-091', 'ab79464a-cd4b-4c6b-a2b5-4ec57b1e2550');

DO $$
DECLARE
    mapping_count INTEGER;
    valid_schedule_count INTEGER;
    valid_task_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mapping_count
    FROM schedule_task_link_map;

    SELECT COUNT(*) INTO valid_schedule_count
    FROM iota_v2.iota_schedule_items AS schedule_item
    JOIN schedule_task_link_map AS link
      ON link.source_key = schedule_item.source_key
    WHERE schedule_item.item_type = 'task'
      AND schedule_item.is_active = TRUE;

    SELECT COUNT(*) INTO valid_task_count
    FROM schedule_task_link_map AS link
    JOIN iota_v2.iota_pmo_tasks AS task
      ON task.id = link.linked_task_id
    WHERE task.task_type <> '팝업';

    IF mapping_count <> 67
       OR valid_schedule_count <> mapping_count
       OR valid_task_count <> mapping_count THEN
        RAISE EXCEPTION
            'Schedule link validation failed: mapping %, schedule %, tasks %',
            mapping_count,
            valid_schedule_count,
            valid_task_count;
    END IF;
END;
$$;

UPDATE iota_v2.iota_schedule_items AS schedule_item
SET
    linked_task_id = link.linked_task_id,
    board_link_state = '통합업무 연결 완료'
FROM schedule_task_link_map AS link
WHERE schedule_item.source_key = link.source_key
  AND schedule_item.item_type = 'task'
  AND schedule_item.is_active = TRUE;

DO $$
DECLARE
    linked_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO linked_count
    FROM iota_v2.iota_schedule_items
    WHERE item_type = 'task'
      AND is_active = TRUE
      AND linked_task_id IS NOT NULL;

    IF linked_count <> 67 THEN
        RAISE EXCEPTION
            'Expected 67 linked schedule tasks, found %',
            linked_count;
    END IF;
END;
$$;

COMMIT;

SELECT
    COUNT(*) AS linked_schedule_tasks,
    COUNT(DISTINCT linked_task_id) AS connected_pmo_tasks
FROM iota_v2.iota_schedule_items
WHERE item_type = 'task'
  AND is_active = TRUE
  AND linked_task_id IS NOT NULL;
