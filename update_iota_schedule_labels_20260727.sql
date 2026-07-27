BEGIN;

UPDATE iota_v2.iota_schedule_items
SET
    lv1 = CASE lv1
        WHEN '주주사 및 수익자 설명회' THEN '주주/수익자 설명회'
        WHEN '[YD427]설계 및 시공' THEN '427 설계/시공'
        WHEN '[YD816] 설계 및 시공' THEN '816 설계/시공'
        ELSE lv1
    END,
    lv2 = CASE lv2
        WHEN '주주사 및 수익자 설명회' THEN '주주/수익자 설명회'
        WHEN '[YD427]설계 및 시공' THEN '427 설계/시공'
        WHEN '[YD816] 설계 및 시공' THEN '816 설계/시공'
        ELSE lv2
    END,
    task_name = CASE task_name
        WHEN '주주사 및 수익자 설명회' THEN '주주/수익자 설명회'
        WHEN '[YD427]설계 및 시공' THEN '427 설계/시공'
        WHEN '[YD816] 설계 및 시공' THEN '816 설계/시공'
        ELSE task_name
    END,
    display_name = CASE display_name
        WHEN '주주사 및 수익자 설명회' THEN '주주/수익자 설명회'
        WHEN '[YD427]설계 및 시공' THEN '427 설계/시공'
        WHEN '[YD816] 설계 및 시공' THEN '816 설계/시공'
        ELSE display_name
    END,
    updated_at = NOW()
WHERE
    lv1 IN (
        '주주사 및 수익자 설명회',
        '[YD427]설계 및 시공',
        '[YD816] 설계 및 시공'
    )
    OR lv2 IN (
        '주주사 및 수익자 설명회',
        '[YD427]설계 및 시공',
        '[YD816] 설계 및 시공'
    )
    OR task_name IN (
        '주주사 및 수익자 설명회',
        '[YD427]설계 및 시공',
        '[YD816] 설계 및 시공'
    )
    OR display_name IN (
        '주주사 및 수익자 설명회',
        '[YD427]설계 및 시공',
        '[YD816] 설계 및 시공'
    );

COMMIT;

SELECT
    source_key,
    lv1,
    lv2,
    display_name
FROM iota_v2.iota_schedule_items
WHERE source_key IN ('S-016', 'S-062', 'S-081')
ORDER BY source_order;
