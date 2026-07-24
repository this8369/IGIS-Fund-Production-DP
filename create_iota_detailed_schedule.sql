-- 08_스케줄_연동표 기반 상세 마일스톤 일정 원장
-- 일정 전용 표시는 S-001~S-091을 사용하며 통합업무보드 UUID는 linked_task_id로 별도 연결한다.

BEGIN;

CREATE TABLE IF NOT EXISTS iota_v2.iota_schedule_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(20) NOT NULL UNIQUE,
    source_order INTEGER NOT NULL,
    source_row INTEGER,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('lv1', 'lv2', 'task')),
    parent_source_key VARCHAR(20),
    lv1 VARCHAR(150) NOT NULL,
    lv2 VARCHAR(150),
    task_name VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,
    lead_dept_code VARCHAR(50) REFERENCES iota_v2.iota_departments(dept_code),
    lead_label VARCHAR(100),
    category_main VARCHAR(100),
    start_period VARCHAR(20),
    end_period VARCHAR(20),
    milestone_period VARCHAR(20),
    management_note TEXT,
    board_link_state VARCHAR(100),
    linked_task_id UUID REFERENCES iota_v2.iota_pmo_tasks(id) ON DELETE SET NULL,
    source_system VARCHAR(100) NOT NULL DEFAULT 'excel_v21_schedule_08',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT iota_schedule_items_parent_fk
        FOREIGN KEY (parent_source_key)
        REFERENCES iota_v2.iota_schedule_items(source_key)
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT iota_schedule_items_period_check CHECK (
        (start_period IS NULL OR start_period ~ '^2026-(0[7-9]|1[0-2])-W[1-4]$')
        AND (end_period IS NULL OR end_period ~ '^2026-(0[7-9]|1[0-2])-W[1-4]$')
        AND (milestone_period IS NULL OR milestone_period ~ '^2026-(0[7-9]|1[0-2])-W[1-4]$')
    )
);

CREATE INDEX IF NOT EXISTS idx_iota_schedule_items_source_order
ON iota_v2.iota_schedule_items(source_order);

CREATE INDEX IF NOT EXISTS idx_iota_schedule_items_parent
ON iota_v2.iota_schedule_items(parent_source_key);

CREATE INDEX IF NOT EXISTS idx_iota_schedule_items_linked_task
ON iota_v2.iota_schedule_items(linked_task_id);

ALTER TABLE iota_v2.iota_schedule_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read schedule items"
ON iota_v2.iota_schedule_items;

CREATE POLICY "Authenticated users can read schedule items"
ON iota_v2.iota_schedule_items
FOR SELECT
TO authenticated
USING (TRUE);

GRANT SELECT ON iota_v2.iota_schedule_items TO authenticated;

WITH source_rows AS (
    SELECT *
    FROM jsonb_to_recordset($schedule$
[
  {"source_key":"S-001","source_order":1,"source_row":4,"item_type":"lv1","parent_source_key":null,"lv1":"금융","lv2":null,"task_name":null,"display_name":"금융","lead_dept_code":null,"lead_label":"미정","category_main":"PF/금융","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-002","source_order":2,"source_row":5,"item_type":"lv2","parent_source_key":"S-001","lv1":"금융","lv2":"PF준비","task_name":null,"display_name":"PF준비","lead_dept_code":null,"lead_label":"미정","category_main":"PF/금융","start_period":"2026-11-W1","end_period":"2026-11-W1","milestone_period":"2026-11-W1","management_note":"마일스톤 반영","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-003","source_order":3,"source_row":6,"item_type":"task","parent_source_key":"S-002","lv1":"금융","lv2":"PF준비","task_name":"PF 구조협의 (427/816 단독 PF Term)","display_name":"PF 구조협의 (427/816 단독 PF Term)","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"PF/금융","start_period":"2026-07-W3","end_period":"2026-08-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-004","source_order":4,"source_row":7,"item_type":"task","parent_source_key":"S-002","lv1":"금융","lv2":"PF준비","task_name":"주관사 선정","display_name":"주관사 선정","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"PF/금융","start_period":"2026-08-W3","end_period":"2026-09-W1","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-005","source_order":5,"source_row":8,"item_type":"task","parent_source_key":"S-002","lv1":"금융","lv2":"PF준비","task_name":"원가·임차·호텔·신용공여 모델 반영","display_name":"원가·임차·호텔·신용공여 모델 반영","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"PF/금융","start_period":"2026-08-W1","end_period":"2026-09-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-006","source_order":6,"source_row":9,"item_type":"task","parent_source_key":"S-002","lv1":"금융","lv2":"PF준비","task_name":"대주단 마케팅, 심의","display_name":"대주단 마케팅, 심의","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"PF/금융","start_period":"2026-10-W1","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-007","source_order":7,"source_row":10,"item_type":"task","parent_source_key":"S-002","lv1":"금융","lv2":"PF준비","task_name":"시장실사","display_name":"시장실사","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"PF/금융","start_period":"2026-07-W3","end_period":"2026-08-W3","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-008","source_order":8,"source_row":11,"item_type":"task","parent_source_key":"S-002","lv1":"금융","lv2":"PF준비","task_name":"회계(816, 통합(안) 포함)","display_name":"회계(816, 통합(안) 포함)","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"PF/금융","start_period":"2026-07-W4","end_period":"2026-08-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-009","source_order":9,"source_row":12,"item_type":"task","parent_source_key":"S-002","lv1":"금융","lv2":"PF준비","task_name":"감정평가","display_name":"감정평가","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"PF/금융","start_period":"2026-07-W4","end_period":"2026-08-W3","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-010","source_order":10,"source_row":13,"item_type":"lv1","parent_source_key":null,"lv1":"호텔","lv2":null,"task_name":null,"display_name":"호텔","lead_dept_code":null,"lead_label":"미정","category_main":"호텔/운영","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-011","source_order":11,"source_row":14,"item_type":"lv2","parent_source_key":"S-010","lv1":"호텔","lv2":null,"task_name":null,"display_name":"호텔","lead_dept_code":null,"lead_label":"미정","category_main":"호텔/운영","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-012","source_order":12,"source_row":15,"item_type":"task","parent_source_key":"S-011","lv1":"호텔","lv2":null,"task_name":"국내 호텔 위탁 운영사, 브랜드 운영방안 결정","display_name":"국내 호텔 위탁 운영사, 브랜드 운영방안 결정","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"호텔/운영","start_period":"2026-07-W3","end_period":"2026-07-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-013","source_order":13,"source_row":16,"item_type":"task","parent_source_key":"S-011","lv1":"호텔","lv2":null,"task_name":"소노 협의(안) 작성-추가 협의","display_name":"소노 협의(안) 작성-추가 협의","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"호텔/운영","start_period":"2026-07-W3","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-014","source_order":14,"source_row":17,"item_type":"task","parent_source_key":"S-011","lv1":"호텔","lv2":null,"task_name":"브랜드 운영전략, 수익추정(안) 확정","display_name":"브랜드 운영전략, 수익추정(안) 확정","lead_dept_code":null,"lead_label":"미정","category_main":"호텔/운영","start_period":"2026-07-W3","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-015","source_order":15,"source_row":18,"item_type":"task","parent_source_key":"S-011","lv1":"호텔","lv2":null,"task_name":"호텔사업계획승인","display_name":"호텔사업계획승인","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"호텔/운영","start_period":"2026-10-W4","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-016","source_order":16,"source_row":19,"item_type":"lv1","parent_source_key":null,"lv1":"주주사 및 수익자 설명회","lv2":null,"task_name":null,"display_name":"주주사 및 수익자 설명회","lead_dept_code":null,"lead_label":"미정","category_main":"구조/법무/세무","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-017","source_order":17,"source_row":20,"item_type":"lv2","parent_source_key":"S-016","lv1":"주주사 및 수익자 설명회","lv2":"IOTA 사업구조 확정","task_name":null,"display_name":"IOTA 사업구조 확정","lead_dept_code":null,"lead_label":"미정","category_main":"구조/법무/세무","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-018","source_order":18,"source_row":21,"item_type":"task","parent_source_key":"S-017","lv1":"주주사 및 수익자 설명회","lv2":"IOTA 사업구조 확정","task_name":"통합 및 계획실행 계획안 수립(Concept)","display_name":"통합 및 계획실행 계획안 수립(Concept)","lead_dept_code":null,"lead_label":"CFT","category_main":"구조/법무/세무","start_period":"2026-07-W4","end_period":"2026-08-W3","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-019","source_order":19,"source_row":22,"item_type":"task","parent_source_key":"S-017","lv1":"주주사 및 수익자 설명회","lv2":"IOTA 사업구조 확정","task_name":"IPR 실행안 수립","display_name":"IPR 실행안 수립","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"구조/법무/세무","start_period":"2026-08-W3","end_period":"2026-09-W1","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-020","source_order":20,"source_row":23,"item_type":"task","parent_source_key":"S-017","lv1":"주주사 및 수익자 설명회","lv2":"IOTA 사업구조 확정","task_name":"구조 확정 및 수익자, 주주설명회","display_name":"구조 확정 및 수익자, 주주설명회","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"구조/법무/세무","start_period":"2026-09-W1","end_period":"2026-09-W3","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-021","source_order":21,"source_row":24,"item_type":"lv2","parent_source_key":"S-016","lv1":"주주사 및 수익자 설명회","lv2":"신규투자자 협의","task_name":null,"display_name":"신규투자자 협의","lead_dept_code":null,"lead_label":"미정","category_main":"구조/법무/세무","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-022","source_order":22,"source_row":25,"item_type":"task","parent_source_key":"S-021","lv1":"주주사 및 수익자 설명회","lv2":"신규투자자 협의","task_name":"신규투자자 합의","display_name":"신규투자자 합의","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"구조/법무/세무","start_period":"2026-08-W2","end_period":"2026-09-W2","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-023","source_order":23,"source_row":26,"item_type":"lv2","parent_source_key":"S-016","lv1":"주주사 및 수익자 설명회","lv2":"리츠전환(전환시)","task_name":null,"display_name":"리츠전환(전환시)","lead_dept_code":null,"lead_label":"미정","category_main":"구조/법무/세무","start_period":"2026-10-W4","end_period":"2026-10-W4","milestone_period":"2026-10-W4","management_note":"마일스톤 반영","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-024","source_order":24,"source_row":27,"item_type":"task","parent_source_key":"S-023","lv1":"주주사 및 수익자 설명회","lv2":"리츠전환(전환시)","task_name":"국토부 협의","display_name":"국토부 협의","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"구조/법무/세무","start_period":"2026-08-W2","end_period":"2026-08-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-025","source_order":25,"source_row":28,"item_type":"task","parent_source_key":"S-023","lv1":"주주사 및 수익자 설명회","lv2":"리츠전환(전환시)","task_name":"리츠법인설립 / 인가/등록","display_name":"리츠법인설립 / 인가/등록","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"인허가","start_period":"2026-09-W1","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-026","source_order":26,"source_row":29,"item_type":"task","parent_source_key":"S-023","lv1":"주주사 및 수익자 설명회","lv2":"리츠전환(전환시)","task_name":"기존사업자 지분양수, 자산편입","display_name":"기존사업자 지분양수, 자산편입","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"구조/법무/세무","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-027","source_order":27,"source_row":30,"item_type":"lv1","parent_source_key":null,"lv1":"임대 세일즈","lv2":null,"task_name":null,"display_name":"임대 세일즈","lead_dept_code":null,"lead_label":"미정","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-028","source_order":28,"source_row":31,"item_type":"lv2","parent_source_key":"S-027","lv1":"임대 세일즈","lv2":"전략적임차(LG,CJ등 앵커)","task_name":null,"display_name":"전략적임차(LG,CJ등 앵커)","lead_dept_code":null,"lead_label":"미정","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-029","source_order":29,"source_row":32,"item_type":"task","parent_source_key":"S-028","lv1":"임대 세일즈","lv2":"전략적임차(LG,CJ등 앵커)","task_name":"협업/사업구도 제안 (PT)","display_name":"협업/사업구도 제안 (PT)","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-030","source_order":30,"source_row":33,"item_type":"task","parent_source_key":"S-028","lv1":"임대 세일즈","lv2":"전략적임차(LG,CJ등 앵커)","task_name":"LOI/Term Sheet 협상(앵커 딜 구조)","display_name":"LOI/Term Sheet 협상(앵커 딜 구조)","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-031","source_order":31,"source_row":34,"item_type":"task","parent_source_key":"S-028","lv1":"임대 세일즈","lv2":"전략적임차(LG,CJ등 앵커)","task_name":"LOC","display_name":"LOC","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-032","source_order":32,"source_row":35,"item_type":"task","parent_source_key":"S-028","lv1":"임대 세일즈","lv2":"전략적임차(LG,CJ등 앵커)","task_name":"상호 사업화 실행 (Phase1)","display_name":"상호 사업화 실행 (Phase1)","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":"2026-07-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-033","source_order":33,"source_row":36,"item_type":"lv2","parent_source_key":"S-027","lv1":"임대 세일즈","lv2":"시장모집(Open)","task_name":null,"display_name":"시장모집(Open)","lead_dept_code":null,"lead_label":"미정","category_main":"임차/마케팅","start_period":"2026-10-W4","end_period":"2026-10-W4","milestone_period":"2026-10-W4","management_note":"마일스톤 반영","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-034","source_order":34,"source_row":37,"item_type":"task","parent_source_key":"S-033","lv1":"임대 세일즈","lv2":"시장모집(Open)","task_name":"LM/TR 전략 (오피스, 리테일)","display_name":"LM/TR 전략 (오피스, 리테일)","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-035","source_order":35,"source_row":38,"item_type":"task","parent_source_key":"S-033","lv1":"임대 세일즈","lv2":"시장모집(Open)","task_name":"컨설팅 수수료 정책 수립","display_name":"컨설팅 수수료 정책 수립","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-036","source_order":36,"source_row":39,"item_type":"task","parent_source_key":"S-033","lv1":"임대 세일즈","lv2":"시장모집(Open)","task_name":"임대차조건 가이드(경쟁 임대료/TI)","display_name":"임대차조건 가이드(경쟁 임대료/TI)","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-037","source_order":37,"source_row":40,"item_type":"task","parent_source_key":"S-033","lv1":"임대 세일즈","lv2":"시장모집(Open)","task_name":"컨설팅 RFP작성, 업체선정","display_name":"컨설팅 RFP작성, 업체선정","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-038","source_order":38,"source_row":41,"item_type":"task","parent_source_key":"S-033","lv1":"임대 세일즈","lv2":"시장모집(Open)","task_name":"롱/숏리스트, 시장 업데이트","display_name":"롱/숏리스트, 시장 업데이트","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":"2026-07-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-039","source_order":39,"source_row":42,"item_type":"task","parent_source_key":"S-033","lv1":"임대 세일즈","lv2":"시장모집(Open)","task_name":"LOC","display_name":"LOC","lead_dept_code":null,"lead_label":"CFT","category_main":"임차/마케팅","start_period":"2026-07-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-040","source_order":40,"source_row":43,"item_type":"lv2","parent_source_key":"S-027","lv1":"임대 세일즈","lv2":"임대관리","task_name":null,"display_name":"임대관리","lead_dept_code":null,"lead_label":"미정","category_main":"임차/마케팅","start_period":"2026-10-W4","end_period":"2026-10-W4","milestone_period":"2026-10-W4","management_note":"마일스톤 반영","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-041","source_order":41,"source_row":44,"item_type":"task","parent_source_key":"S-040","lv1":"임대 세일즈","lv2":"임대관리","task_name":"임관비 관리","display_name":"임관비 관리","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"임차/마케팅","start_period":"2026-07-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-042","source_order":42,"source_row":45,"item_type":"task","parent_source_key":"S-040","lv1":"임대 세일즈","lv2":"임대관리","task_name":"기본정책 초안(리콰이어먼트 승인/보증금/정산 로직)","display_name":"기본정책 초안(리콰이어먼트 승인/보증금/정산 로직)","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-043","source_order":43,"source_row":46,"item_type":"task","parent_source_key":"S-040","lv1":"임대 세일즈","lv2":"임대관리","task_name":"계약(행정)","display_name":"계약(행정)","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"임차/마케팅","start_period":"2026-07-W1","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-044","source_order":44,"source_row":47,"item_type":"task","parent_source_key":"S-040","lv1":"임대 세일즈","lv2":"임대관리","task_name":"향후 PM/FM 운영 요구사항 관리","display_name":"향후 PM/FM 운영 요구사항 관리","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"호텔/운영","start_period":"2026-09-W1","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-045","source_order":45,"source_row":48,"item_type":"lv1","parent_source_key":null,"lv1":"상품기획","lv2":null,"task_name":null,"display_name":"상품기획","lead_dept_code":null,"lead_label":"미정","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-046","source_order":46,"source_row":49,"item_type":"lv2","parent_source_key":"S-045","lv1":"상품기획","lv2":"상품기획","task_name":null,"display_name":"상품기획","lead_dept_code":null,"lead_label":"미정","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-047","source_order":47,"source_row":50,"item_type":"task","parent_source_key":"S-046","lv1":"상품기획","lv2":"상품기획","task_name":"IOTA상품전략(오피스, 리테일, 호텔)","display_name":"IOTA상품전략(오피스, 리테일, 호텔)","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"호텔/운영","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-048","source_order":48,"source_row":51,"item_type":"task","parent_source_key":"S-046","lv1":"상품기획","lv2":"상품기획","task_name":"가격 포지셔닝(임대포지셔닝)","display_name":"가격 포지셔닝(임대포지셔닝)","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-049","source_order":49,"source_row":52,"item_type":"task","parent_source_key":"S-046","lv1":"상품기획","lv2":"상품기획","task_name":"공간프로그램/인테리어 기획","display_name":"공간프로그램/인테리어 기획","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-050","source_order":50,"source_row":53,"item_type":"task","parent_source_key":"S-046","lv1":"상품기획","lv2":"상품기획","task_name":"멤버십 기획(요금/타겟/서비스 체계)","display_name":"멤버십 기획(요금/타겟/서비스 체계)","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-051","source_order":51,"source_row":54,"item_type":"task","parent_source_key":"S-046","lv1":"상품기획","lv2":"상품기획","task_name":"솔루션 파트너십 shortlist / RFP","display_name":"솔루션 파트너십 shortlist / RFP","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-052","source_order":52,"source_row":55,"item_type":"lv2","parent_source_key":"S-045","lv1":"상품기획","lv2":"테크 솔루션","task_name":null,"display_name":"테크 솔루션","lead_dept_code":null,"lead_label":"미정","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-053","source_order":53,"source_row":56,"item_type":"task","parent_source_key":"S-052","lv1":"상품기획","lv2":"테크 솔루션","task_name":"통합 솔루션 기획","display_name":"통합 솔루션 기획","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-054","source_order":54,"source_row":57,"item_type":"task","parent_source_key":"S-052","lv1":"상품기획","lv2":"테크 솔루션","task_name":"tech 고객경험 시나리오","display_name":"tech 고객경험 시나리오","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-055","source_order":55,"source_row":58,"item_type":"task","parent_source_key":"S-052","lv1":"상품기획","lv2":"테크 솔루션","task_name":"신기술 구축 전략 (주차, 로봇, B.iot 등)","display_name":"신기술 구축 전략 (주차, 로봇, B.iot 등)","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"인테리어/TI","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-056","source_order":56,"source_row":59,"item_type":"task","parent_source_key":"S-052","lv1":"상품기획","lv2":"테크 솔루션","task_name":"신사업 클러스터 구축 (투자,임대차 유치)","display_name":"신사업 클러스터 구축 (투자,임대차 유치)","lead_dept_code":"DEPT_DESIGN","lead_label":"공간솔루션","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-057","source_order":57,"source_row":60,"item_type":"lv1","parent_source_key":null,"lv1":"마케팅","lv2":null,"task_name":null,"display_name":"마케팅","lead_dept_code":null,"lead_label":"미정","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-058","source_order":58,"source_row":61,"item_type":"lv2","parent_source_key":"S-057","lv1":"마케팅","lv2":"마케팅 IM","task_name":null,"display_name":"마케팅 IM","lead_dept_code":null,"lead_label":"미정","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-059","source_order":59,"source_row":62,"item_type":"task","parent_source_key":"S-058","lv1":"마케팅","lv2":"마케팅 IM","task_name":"마케팅 전략(+로드맵)","display_name":"마케팅 전략(+로드맵)","lead_dept_code":"DEPT_MKT","lead_label":"기업마케팅","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-060","source_order":60,"source_row":63,"item_type":"task","parent_source_key":"S-058","lv1":"마케팅","lv2":"마케팅 IM","task_name":"마케팅 소스 기획 (영상, 웹사이트 등)","display_name":"마케팅 소스 기획 (영상, 웹사이트 등)","lead_dept_code":"DEPT_MKT","lead_label":"기업마케팅","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-061","source_order":61,"source_row":64,"item_type":"task","parent_source_key":"S-058","lv1":"마케팅","lv2":"마케팅 IM","task_name":"세일즈킷","display_name":"세일즈킷","lead_dept_code":"DEPT_MKT","lead_label":"기업마케팅","category_main":"임차/마케팅","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-062","source_order":62,"source_row":65,"item_type":"lv1","parent_source_key":null,"lv1":"[YD427]설계 및 시공","lv2":null,"task_name":null,"display_name":"[YD427]설계 및 시공","lead_dept_code":null,"lead_label":"미정","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-063","source_order":63,"source_row":66,"item_type":"lv2","parent_source_key":"S-062","lv1":"[YD427]설계 및 시공","lv2":"인허가","task_name":null,"display_name":"인허가","lead_dept_code":null,"lead_label":"미정","category_main":"인허가","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-064","source_order":64,"source_row":67,"item_type":"task","parent_source_key":"S-063","lv1":"[YD427]설계 및 시공","lv2":"인허가","task_name":"사업시행계획인가 변경","display_name":"사업시행계획인가 변경","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인허가","start_period":"2026-11-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-065","source_order":65,"source_row":68,"item_type":"task","parent_source_key":"S-063","lv1":"[YD427]설계 및 시공","lv2":"인허가","task_name":"양동숲길 실시계획인가","display_name":"양동숲길 실시계획인가","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인허가","start_period":"2026-07-W3","end_period":"2026-09-W2","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-066","source_order":66,"source_row":69,"item_type":"task","parent_source_key":"S-063","lv1":"[YD427]설계 및 시공","lv2":"인허가","task_name":"관광호텔 사업계획 승인","display_name":"관광호텔 사업계획 승인","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"호텔/운영","start_period":"2026-07-W1","end_period":"2026-09-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-067","source_order":67,"source_row":70,"item_type":"lv2","parent_source_key":"S-062","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":null,"display_name":"설계","lead_dept_code":null,"lead_label":"미정","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-068","source_order":68,"source_row":71,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"실시설계(1차)","display_name":"실시설계(1차)","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-069","source_order":69,"source_row":72,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"견적 및 공사비 산출","display_name":"견적 및 공사비 산출","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-07-W1","end_period":"2026-08-W2","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-070","source_order":70,"source_row":73,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"실시설계 변경(2차)","display_name":"실시설계 변경(2차)","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-071","source_order":71,"source_row":74,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"양동숲길 실시설계","display_name":"양동숲길 실시설계","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인허가","start_period":"2026-07-W1","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-072","source_order":72,"source_row":75,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"호텔 기본 설계(DA)","display_name":"호텔 기본 설계(DA)","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"호텔/운영","start_period":"2026-07-W1","end_period":"2026-08-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-073","source_order":73,"source_row":76,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"인테리어 프리디자인","display_name":"인테리어 프리디자인","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인테리어/TI","start_period":"2026-07-W1","end_period":"2026-07-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-074","source_order":74,"source_row":77,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"인테리어 계획설계 (국보/다원)","display_name":"인테리어 계획설계 (국보/다원)","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인테리어/TI","start_period":"2026-07-W1","end_period":"2026-07-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-075","source_order":75,"source_row":78,"item_type":"task","parent_source_key":"S-067","lv1":"[YD427]설계 및 시공","lv2":"설계","task_name":"인테리어 기본설계 (국보/다원)","display_name":"인테리어 기본설계 (국보/다원)","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인테리어/TI","start_period":"2026-08-W1","end_period":"2026-11-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-076","source_order":76,"source_row":79,"item_type":"lv2","parent_source_key":"S-062","lv1":"[YD427]설계 및 시공","lv2":"시공","task_name":null,"display_name":"시공","lead_dept_code":null,"lead_label":"미정","category_main":"도면/설계","start_period":"2026-10-W4","end_period":"2026-10-W4","milestone_period":"2026-10-W4","management_note":"마일스톤 반영","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-077","source_order":77,"source_row":80,"item_type":"task","parent_source_key":"S-076","lv1":"[YD427]설계 및 시공","lv2":"시공","task_name":"해체공사","display_name":"해체공사","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-07-W1","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-078","source_order":78,"source_row":81,"item_type":"task","parent_source_key":"S-076","lv1":"[YD427]설계 및 시공","lv2":"시공","task_name":"본공사","display_name":"본공사","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-11-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-079","source_order":79,"source_row":82,"item_type":"task","parent_source_key":"S-076","lv1":"[YD427]설계 및 시공","lv2":"시공","task_name":"기부채납시설","display_name":"기부채납시설","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-11-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-080","source_order":80,"source_row":83,"item_type":"task","parent_source_key":"S-076","lv1":"[YD427]설계 및 시공","lv2":"시공","task_name":"양동숲길 조성공사","display_name":"양동숲길 조성공사","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인허가","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-081","source_order":81,"source_row":84,"item_type":"lv1","parent_source_key":null,"lv1":"[YD816] 설계 및 시공","lv2":null,"task_name":null,"display_name":"[YD816] 설계 및 시공","lead_dept_code":null,"lead_label":"미정","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-082","source_order":82,"source_row":85,"item_type":"lv2","parent_source_key":"S-081","lv1":"[YD816] 설계 및 시공","lv2":"설계","task_name":null,"display_name":"설계","lead_dept_code":null,"lead_label":"미정","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-083","source_order":83,"source_row":86,"item_type":"task","parent_source_key":"S-082","lv1":"[YD816] 설계 및 시공","lv2":"설계","task_name":"실시설계","display_name":"실시설계","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-07-W1","end_period":"2026-08-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-084","source_order":84,"source_row":87,"item_type":"task","parent_source_key":"S-082","lv1":"[YD816] 설계 및 시공","lv2":"설계","task_name":"견적 및 공사비 산출","display_name":"견적 및 공사비 산출","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-09-W1","end_period":"2026-12-W1","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-085","source_order":85,"source_row":88,"item_type":"task","parent_source_key":"S-082","lv1":"[YD816] 설계 및 시공","lv2":"설계","task_name":"연결통로 실시계획인가","display_name":"연결통로 실시계획인가","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인허가","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-086","source_order":86,"source_row":89,"item_type":"task","parent_source_key":"S-082","lv1":"[YD816] 설계 및 시공","lv2":"설계","task_name":"소공원 실시계획인가","display_name":"소공원 실시계획인가","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"인허가","start_period":"2026-12-W1","end_period":"2026-12-W3","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-087","source_order":87,"source_row":90,"item_type":"task","parent_source_key":"S-082","lv1":"[YD816] 설계 및 시공","lv2":"설계","task_name":"대안시공사 협의","display_name":"대안시공사 협의","lead_dept_code":"DEPT_PM2","lead_label":"사업2파트","category_main":"도면/설계","start_period":"2026-07-W3","end_period":"2026-10-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-088","source_order":88,"source_row":91,"item_type":"lv2","parent_source_key":"S-081","lv1":"[YD816] 설계 및 시공","lv2":"시공","task_name":null,"display_name":"시공","lead_dept_code":null,"lead_label":"미정","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"구분행","board_link_state":"카테고리/요약행","linked_task_id":null},
  {"source_key":"S-089","source_order":89,"source_row":92,"item_type":"task","parent_source_key":"S-088","lv1":"[YD816] 설계 및 시공","lv2":"시공","task_name":"지상 해체공사","display_name":"지상 해체공사","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-07-W1","end_period":"2026-11-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-090","source_order":90,"source_row":93,"item_type":"task","parent_source_key":"S-088","lv1":"[YD816] 설계 및 시공","lv2":"시공","task_name":"지하 해체공사","display_name":"지하 해체공사","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":"2026-12-W1","end_period":"2026-12-W4","milestone_period":null,"management_note":"일정구간 반영","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null},
  {"source_key":"S-091","source_order":91,"source_row":94,"item_type":"task","parent_source_key":"S-088","lv1":"[YD816] 설계 및 시공","lv2":"시공","task_name":"본공사","display_name":"본공사","lead_dept_code":"DEPT_DEV","lead_label":"개발솔루션","category_main":"도면/설계","start_period":null,"end_period":null,"milestone_period":null,"management_note":"일정 미기재 - 추후 보완","board_link_state":"업무판 등록/매칭 확인","linked_task_id":null}
]
$schedule$::jsonb) AS source(
        source_key TEXT,
        source_order INTEGER,
        source_row INTEGER,
        item_type TEXT,
        parent_source_key TEXT,
        lv1 TEXT,
        lv2 TEXT,
        task_name TEXT,
        display_name TEXT,
        lead_dept_code TEXT,
        lead_label TEXT,
        category_main TEXT,
        start_period TEXT,
        end_period TEXT,
        milestone_period TEXT,
        management_note TEXT,
        board_link_state TEXT,
        linked_task_id UUID
    )
)
INSERT INTO iota_v2.iota_schedule_items (
    source_key,
    source_order,
    source_row,
    item_type,
    parent_source_key,
    lv1,
    lv2,
    task_name,
    display_name,
    lead_dept_code,
    lead_label,
    category_main,
    start_period,
    end_period,
    milestone_period,
    management_note,
    board_link_state,
    linked_task_id,
    source_system,
    is_active
)
SELECT
    source_key,
    source_order,
    source_row,
    item_type,
    parent_source_key,
    lv1,
    lv2,
    task_name,
    display_name,
    lead_dept_code,
    lead_label,
    category_main,
    start_period,
    end_period,
    milestone_period,
    management_note,
    board_link_state,
    linked_task_id,
    'excel_v21_schedule_08',
    TRUE
FROM source_rows
ON CONFLICT (source_key) DO UPDATE
SET
    source_order = EXCLUDED.source_order,
    source_row = EXCLUDED.source_row,
    item_type = EXCLUDED.item_type,
    parent_source_key = EXCLUDED.parent_source_key,
    lv1 = EXCLUDED.lv1,
    lv2 = EXCLUDED.lv2,
    task_name = EXCLUDED.task_name,
    display_name = EXCLUDED.display_name,
    lead_dept_code = EXCLUDED.lead_dept_code,
    lead_label = EXCLUDED.lead_label,
    category_main = EXCLUDED.category_main,
    start_period = EXCLUDED.start_period,
    end_period = EXCLUDED.end_period,
    milestone_period = EXCLUDED.milestone_period,
    management_note = EXCLUDED.management_note,
    board_link_state = EXCLUDED.board_link_state,
    linked_task_id = COALESCE(
        iota_v2.iota_schedule_items.linked_task_id,
        EXCLUDED.linked_task_id
    ),
    source_system = EXCLUDED.source_system,
    is_active = TRUE,
    updated_at = NOW();

COMMIT;

SELECT
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE item_type = 'task') AS task_count,
    COUNT(*) FILTER (
        WHERE item_type = 'task'
          AND start_period IS NOT NULL
          AND end_period IS NOT NULL
    ) AS scheduled_task_count,
    COUNT(*) FILTER (WHERE milestone_period IS NOT NULL) AS milestone_count
FROM iota_v2.iota_schedule_items
WHERE is_active = TRUE;
