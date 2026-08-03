import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import WorkspaceActivityLog from '../workspace/WorkspaceActivityLog';
import { notifyMembersOnTaskCreation } from '../../../utils/notificationHelpers';
import { calculatePmoPriorityScore as calculatePriorityScore, comparePmoTasksByCreatedAt, comparePmoTasksByPriority, getPmoMeetingGrade, matchesPmoStatusFilter, parseTaskBoolean as parseBool } from '../../../utils/pmoTaskPriority';
import { normalizeIotaDepartmentList, normalizeIotaOrganization } from '../../../utils/iotaOrganizations.js';
import {
    fetchPmoBoardReferenceData,
    fetchPmoBoardTasks,
    fetchRecentPmoActiveTaskIds,
    getCachedPmoBoardTasks,
    invalidatePmoBoardTasksCache,
} from '../../../utils/pmoBoardDataCache.js';
import toast from 'react-hot-toast';
import { savePmoTaskChangeLog } from '../../../utils/pmoTaskChangeLog';

const RAW_FALLBACK_BOARD_TASKS = [
  {
    "id": "T-001",
    "project": "공통",
    "category_main": "공통 PMO",
    "sector_detail": "업무관리 체계",
    "task_name": "IOTA 통합 업무관리 원장 운영",
    "task_purpose": "업무과중·중복요청·공 차지 문제를 차단하고 PF/준공 중심으로 업무를 재정렬",
    "deliverables": "통합업무보드, 회의메인, Action Item 운영기준",
    "target_axis": "공통 PMO",
    "gate_stage": "G0 현황정리",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "사업관리1파트;개발관리실;공간솔루션실;기업마케팅실;LFC",
    "assignee": "미정",
    "external_party": "내부 전체",
    "support_needed": "부서별 담당자 입력",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-07-27",
    "status": "진행중",
    "importance_level": "준공필수",
    "task_type": "정규",
    "next_action": "회의체 운영원칙 확정 후 부서 배포",
    "priority_score": 70,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "준공필수 / 의사결정 / 지원:부서별 담당자 입력",
    "sort_key": 70.0997,
    "notes": "사업2파트가 PMO"
  },
  {
    "id": "T-002",
    "project": "공통",
    "category_main": "공통 PMO",
    "sector_detail": "우선순위 기준",
    "task_name": "회의상정 우선순위 산정 기준 확정",
    "task_purpose": "종합현황이 수기 요약이 아니라 원장 기반으로 자동 정렬되어야 함",
    "deliverables": "우선순위 기준표, 회의상정 기준, 상정사유",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "LFC;개발관리실",
    "assignee": "미정",
    "external_party": "내부 전체",
    "support_needed": "파트장 확인",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-07-27",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "회의에서 점수 기준 합의",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:파트장 확인",
    "sort_key": 65.0996,
    "notes": null
  },
  {
    "id": "T-003",
    "project": "427PFV",
    "category_main": "호텔/운영",
    "sector_detail": "브랜드",
    "task_name": "427 호텔 브랜드 방향 확정",
    "task_purpose": "427 PF 실행을 위해 호텔 브랜드·운영전략·대주 설득 스토리 필요",
    "deliverables": "리츠칼튼/소노/대안 브랜드 비교표, 추천안",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "기업마케팅실;LFC;법무/세무 외부자문",
    "assignee": "미정",
    "external_party": "Marriott, 대명소노",
    "support_needed": "호텔 담당/법무 검토",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-07-22",
    "status": "지연",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "리츠칼튼 우선협상권 및 소노 협약 충돌 가능성 정리 , 소노 단독 액션플랜 정리",
    "priority_score": 105,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:호텔 담당/법무 검토 / 지연",
    "sort_key": 105.0995,
    "notes": "핵심 Blocker"
  },
  {
    "id": "T-004",
    "project": "427PFV",
    "category_main": "호텔/운영",
    "sector_detail": "HMA/Franchise",
    "task_name": "호텔 운영계약 구조 검토",
    "task_purpose": "호텔 계약 형태가 PF, 가치평가, 운영리스크에 영향",
    "deliverables": "HMA/프랜차이즈/운영위탁 구조별 Term 비교",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "LFC;법무/세무 외부자문;기업마케팅실",
    "assignee": "미정",
    "external_party": "Marriott, 대명소노",
    "support_needed": "외부 법무 검토",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "미착수",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "계약 유형별 대주단 수용성 확인",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:외부 법무 검토",
    "sort_key": 65.0994,
    "notes": null
  },
  {
    "id": "T-005",
    "project": "427PFV",
    "category_main": "호텔/운영",
    "sector_detail": "운영전략",
    "task_name": "호텔 운영수지·FF&E·CAPEX 반영",
    "task_purpose": "재무모델과 PF 상환가능성 검토에 필요",
    "deliverables": "호텔 운영수지, FF&E, Capex, 안정화 기간 가정",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "LFC",
    "coop_depts": "사업2파트;기업마케팅실;공간솔루션실",
    "assignee": "미정",
    "external_party": "호텔 브랜드사",
    "support_needed": "운영자료 필요",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "미착수",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "브랜드 후보로부터 기준자료 수령",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:운영자료 필요",
    "sort_key": 45.0993,
    "notes": null
  },
  {
    "id": "T-006",
    "project": "공통",
    "category_main": "인허가",
    "sector_detail": "현금기부채납",
    "task_name": "현금기부채납 협의 조건 정리",
    "task_purpose": "기부채납 규모·지급시기·인허가 조건이 사업비/PF 조건에 직접 영향",
    "deliverables": "관청 협의현황, 비용반영표, 쟁점 및 협상안",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;LFC",
    "assignee": "미정",
    "external_party": "서울시/중구청",
    "support_needed": "관청 협의 결과",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-07-26",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "협약 시나리오정리/인허관청 미팅 논의",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:관청 협의 결과",
    "sort_key": 90.0992,
    "notes": null
  },
  {
    "id": "T-007",
    "project": "공통",
    "category_main": "인허가",
    "sector_detail": "소공원로",
    "task_name": "소공원로 협의 및 공사중 사용/변경 가능성 검토",
    "task_purpose": "도로·공공기여·공사동선 이슈가 착공 및 준공 일정에 영향",
    "deliverables": "소공원로 협의안, 일정표, 리스크표",
    "target_axis": "착공",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;공간솔루션실",
    "assignee": "미정",
    "external_party": "서울시/중구청",
    "support_needed": "도면·관청의견 필요",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-08-02",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "소공원로 관련 도면 및 협의주체 확인",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:도면·관청의견 필요",
    "sort_key": 90.0991,
    "notes": null
  },
  {
    "id": "T-008",
    "project": "816PFV",
    "category_main": "인허가",
    "sector_detail": "주거전환",
    "task_name": "816 주거전환 가능성 및 인허가 리스크 검토",
    "task_purpose": "통합/대안 구조에서 816의 사업성·리스크·대주단 수용성 판단 필요",
    "deliverables": "주거전환 가능성 검토서, 일정/리스크/사업성 비교",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;LFC;공간솔루션실",
    "assignee": "미정",
    "external_party": "서울시/중구청, 삼성물산",
    "support_needed": "인허가/설계 검토",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "주거전환 시 인허가 변경기간 및 조건 산정",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:인허가/설계 검토",
    "sort_key": 65.099,
    "notes": null
  },
  {
    "id": "T-009",
    "project": "427PFV",
    "category_main": "인허가",
    "sector_detail": "변경인가",
    "task_name": "427 호텔·오피스 변경 가능성 및 PF 전 인허가 쟁점 정리",
    "task_purpose": "호텔 브랜드/운영전략에 따라 도면·용도·면적 영향 가능",
    "deliverables": "427 변경인가 쟁점표, 필요 인허가 목록",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;공간솔루션실",
    "assignee": "미정",
    "external_party": "서울시/중구청",
    "support_needed": "인허가 판단",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "미착수",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "호텔 프로그램 확정 이후 필요 변경범위 확인",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:인허가 판단",
    "sort_key": 45.0989,
    "notes": null
  },
  {
    "id": "T-010",
    "project": "공통",
    "category_main": "인허가",
    "sector_detail": "사용승인",
    "task_name": "준공/사용승인 역산 로드맵 수립",
    "task_purpose": "PF 이후에도 준공·담보대출까지 장기 관리 필요",
    "deliverables": "사용승인 체크리스트, 준공 CP, 관계기관 일정표",
    "target_axis": "준공/사용승인",
    "gate_stage": "G5 준공",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;LFC",
    "assignee": "미정",
    "external_party": "서울시/중구청",
    "support_needed": "장기 일정 입력",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-10-07",
    "status": "미착수",
    "importance_level": "준공필수",
    "task_type": "정규",
    "next_action": "PF 이후 공사·준공 CP로 연결",
    "priority_score": 50,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "준공필수 / 지원:장기 일정 입력",
    "sort_key": 50.0988,
    "notes": null
  },
  {
    "id": "T-011",
    "project": "427PFV",
    "category_main": "시공/원가",
    "sector_detail": "현대건설 도급",
    "task_name": "427 현대건설 도급조건 및 신용공여 조건 확정",
    "task_purpose": "427 PF 실행성은 시공조건·공사비·신용공여에 좌우",
    "deliverables": "현대건설 Term, 도급조건, 신용공여 범위",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "LFC;개발관리실",
    "assignee": "미정",
    "external_party": "현대건설",
    "support_needed": "시공사 Term 회신",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "현대건설과 도급/신용공여 핵심 조건 테이블화",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:시공사 Term 회신",
    "sort_key": 65.0987,
    "notes": null
  },
  {
    "id": "T-012",
    "project": "816PFV",
    "category_main": "시공/원가",
    "sector_detail": "삼성물산 도급",
    "task_name": "816 삼성물산 도급조건·책임임차·LOC 구조 정리",
    "task_purpose": "816 원가와 삼성 조건이 단독/통합 PF 실행성의 핵심",
    "deliverables": "삼성물산 Term, LOC, 책임임차, 공사비 비교",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "LFC;개발관리실;기업마케팅실",
    "assignee": "미정",
    "external_party": "삼성물산",
    "support_needed": "삼성 조건 회신",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "삼성물산의 주주/시공사 이중 지위 고려해 협상안 작성",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:삼성 조건 회신",
    "sort_key": 90.0986,
    "notes": null
  },
  {
    "id": "T-013",
    "project": "공통",
    "category_main": "시공/원가",
    "sector_detail": "공사비 검증",
    "task_name": "427/816 공사비 적정성 및 VE 가능성 검토",
    "task_purpose": "높은 원가가 PF·주주승인·임차조건의 공통 병목",
    "deliverables": "공사비 비교표, VE 목록, 공사비 민감도",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;LFC;공간솔루션실",
    "assignee": "미정",
    "external_party": "현대건설, 삼성물산",
    "support_needed": "견적 상세내역",
    "is_blocker": "Y",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "공사비 상승 근거와 절감 가능항목 분리",
    "priority_score": 70,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 지원:견적 상세내역",
    "sort_key": 70.0985,
    "notes": null
  },
  {
    "id": "T-014",
    "project": "공통",
    "category_main": "시공/원가",
    "sector_detail": "공기/착공조건",
    "task_name": "책임착공·착공조건·공기 단축 시나리오 정리",
    "task_purpose": "PF 약정상 착공기한과 공정관리가 장기 리스크",
    "deliverables": "착공조건표, 공기 시나리오, 책임착공 리스크표",
    "target_axis": "착공",
    "gate_stage": "G4 착공/공사",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;LFC",
    "assignee": "미정",
    "external_party": "현대건설, 삼성물산",
    "support_needed": "시공사 공정표",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-09-22",
    "status": "미착수",
    "importance_level": "준공필수",
    "task_type": "정규",
    "next_action": "PF Term과 착공 조건 연결",
    "priority_score": 50,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "준공필수 / 지원:시공사 공정표",
    "sort_key": 50.0984,
    "notes": null
  },
  {
    "id": "T-015",
    "project": "공통",
    "category_main": "도면/설계",
    "sector_detail": "PF 기준도면",
    "task_name": "PF 대주단 제출용 기준도면 패키지 확정",
    "task_purpose": "도면 기준이 없으면 공사비·임차·PF 설명자료가 모두 흔들림",
    "deliverables": "PF 기준도면, 면적표, 변경이력표",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "공간솔루션실",
    "coop_depts": "개발관리실;사업2파트;LFC",
    "assignee": "미정",
    "external_party": "설계사/CM",
    "support_needed": "도면 기준 정리",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-08-02",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "427/816 공통 기준도면 양식 확정",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:도면 기준 정리",
    "sort_key": 90.0983,
    "notes": null
  },
  {
    "id": "T-016",
    "project": "공통",
    "category_main": "도면/설계",
    "sector_detail": "면적표",
    "task_name": "GFA/NLA/전용률/임대면적 기준 통일",
    "task_purpose": "임차·재무모델·PF 설명자료의 숫자 불일치 방지",
    "deliverables": "면적표, 전용률, 임대가능면적, 변경 이력",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "공간솔루션실;기업마케팅실",
    "assignee": "미정",
    "external_party": "설계사/CM",
    "support_needed": "도면/면적자료",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "임차 제안서와 모델 입력값 일치 확인",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:도면/면적자료",
    "sort_key": 45.0982,
    "notes": null
  },
  {
    "id": "T-017",
    "project": "427PFV",
    "category_main": "도면/설계",
    "sector_detail": "호텔 프로그램",
    "task_name": "호텔 객실/부대시설 프로그램 도면 반영",
    "task_purpose": "브랜드·운영전략과 설계가 불일치하면 PF 후 변경 리스크 확대",
    "deliverables": "호텔 프로그램 도면, 면적/동선 검토표",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "공간솔루션실",
    "coop_depts": "사업2파트;기업마케팅실",
    "assignee": "미정",
    "external_party": "호텔 브랜드사, 설계사",
    "support_needed": "브랜드 기준자료",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "미착수",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "브랜드 후보별 프로그램 요구사항 수령",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:브랜드 기준자료",
    "sort_key": 45.0981,
    "notes": null
  },
  {
    "id": "T-018",
    "project": "공통",
    "category_main": "인테리어/TI",
    "sector_detail": "오피스 TI",
    "task_name": "오피스 표준 TI 및 임차인 Fit-out 기준 설정",
    "task_purpose": "임차조건·임대안정화비용·PF 모델에 반영 필요",
    "deliverables": "오피스 TI 기준표, 비용범위, 부담주체",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "공간솔루션실",
    "coop_depts": "기업마케팅실;LFC;사업2파트",
    "assignee": "미정",
    "external_party": "잠재 임차인",
    "support_needed": "TI 시장자료",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "임차 제안서와 비용모델 연동",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:TI 시장자료",
    "sort_key": 45.098,
    "notes": null
  },
  {
    "id": "T-019",
    "project": "427PFV",
    "category_main": "인테리어/TI",
    "sector_detail": "호텔 인테리어",
    "task_name": "호텔 인테리어/FF&E 범위 및 비용 정리",
    "task_purpose": "호텔 CAPEX가 총사업비와 대주단 조건에 영향",
    "deliverables": "호텔 인테리어 Scope, FF&E, Owner 부담범위",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "공간솔루션실;기업마케팅실",
    "assignee": "미정",
    "external_party": "호텔 브랜드사",
    "support_needed": "브랜드 기준자료",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-09-07",
    "status": "미착수",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "브랜드 결정 후 Cost Book 작성",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:브랜드 기준자료",
    "sort_key": 45.0979,
    "notes": null
  },
  {
    "id": "T-020",
    "project": "공통",
    "category_main": "인테리어/TI",
    "sector_detail": "공간제안 패키지",
    "task_name": "주요 임차인별 공간 제안 패키지 제작",
    "task_purpose": "임차 확보가 PF 실행성과 대주단 설득의 핵심",
    "deliverables": "광장/KB/삼성 등 임차 제안 패키지",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "공간솔루션실",
    "coop_depts": "기업마케팅실;사업2파트",
    "assignee": "미정",
    "external_party": "광장, KB, 삼성 등",
    "support_needed": "임차인 요구사항",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "임차인별 니즈를 도면·조건에 반영",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:임차인 요구사항",
    "sort_key": 45.0978,
    "notes": null
  },
  {
    "id": "T-021",
    "project": "427PFV",
    "category_main": "임차/마케팅",
    "sector_detail": "광장",
    "task_name": "광장 임차 Term 및 면적·조건 확정",
    "task_purpose": "427/통합 PF 스토리에서 핵심 임차사 역할 가능",
    "deliverables": "임차 Term Sheet, 면적, 임대료, 인센티브",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "기업마케팅실",
    "coop_depts": "사업2파트;공간솔루션실;LFC",
    "assignee": "미정",
    "external_party": "광장",
    "support_needed": "임차조건 회신",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-07-26",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "임차 조건과 PF 반영 가능성 확인",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:임차조건 회신",
    "sort_key": 90.0977,
    "notes": null
  },
  {
    "id": "T-022",
    "project": "공통",
    "category_main": "임차/마케팅",
    "sector_detail": "KB/금융권",
    "task_name": "KB증권 등 금융권 임차 후보 협의",
    "task_purpose": "오피스 선임차 수준이 PF 대주단 설득에 필요",
    "deliverables": "후보별 면적/조건/의사결정 단계표",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "기업마케팅실",
    "coop_depts": "사업2파트;공간솔루션실;LFC",
    "assignee": "미정",
    "external_party": "KB증권 등",
    "support_needed": "임차 후보 접촉",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "금융권 임차 후보 우선순위화",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:임차 후보 접촉",
    "sort_key": 45.0976,
    "notes": null
  },
  {
    "id": "T-023",
    "project": "816PFV",
    "category_main": "임차/마케팅",
    "sector_detail": "삼성/이지스 선임차",
    "task_name": "816 선임차·책임임차·임차이전 가능성 정리",
    "task_purpose": "816 단독/통합 PF 구조에서 선임차와 신용공여가 핵심",
    "deliverables": "삼성/이지스 임차 조건표, LOC/책임범위",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "기업마케팅실",
    "coop_depts": "사업2파트;LFC;삼성물산",
    "assignee": "미정",
    "external_party": "삼성물산, 이지스",
    "support_needed": "내부/삼성 협의",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "816 선임차 유지 vs 427 이전 비교",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:내부/삼성 협의",
    "sort_key": 90.0975,
    "notes": null
  },
  {
    "id": "T-024",
    "project": "공통",
    "category_main": "임차/마케팅",
    "sector_detail": "임대료/NOC",
    "task_name": "임차조건·E.NOC·인센티브 기준 통일",
    "task_purpose": "임차 제안서와 재무모델·대주단 설명자료 일치 필요",
    "deliverables": "임대료, 관리비, RF, TI, NOC 계산 기준표",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "기업마케팅실",
    "coop_depts": "LFC;공간솔루션실;사업2파트",
    "assignee": "미정",
    "external_party": "잠재 임차인",
    "support_needed": "시장자료",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "임차조건 산식 단순화 및 내부 기준화",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:시장자료",
    "sort_key": 45.0974,
    "notes": null
  },
  {
    "id": "T-025",
    "project": "공통",
    "category_main": "PF/금융",
    "sector_detail": "단독 PF",
    "task_name": "427/816 단독 PF 조건 정리",
    "task_purpose": "개별 PF 가능성 판단과 통합 PF 대비 기준점 필요",
    "deliverables": "427 단독 Term, 816 단독 Term, 민감도",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "사업관리1파트;LFC",
    "assignee": "미정",
    "external_party": "대주단",
    "support_needed": "Term Sheet 필요",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "단독 PF 가능/불가 조건을 수치화",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:Term Sheet 필요",
    "sort_key": 90.0973,
    "notes": null
  },
  {
    "id": "T-026",
    "project": "공통",
    "category_main": "PF/금융",
    "sector_detail": "통합 PF",
    "task_name": "대주단 일치화 및 통합 PF 구조 검토",
    "task_purpose": "두 PFV 동시 추진 시 대주단, 담보, 구조가 복잡하므로 의사결정 필요",
    "deliverables": "통합 PF 구조도, 대주단 전략, 담보 제공안",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "LFC",
    "coop_depts": "사업2파트;법무/세무 외부자문;사업관리1파트",
    "assignee": "미정",
    "external_party": "대주단",
    "support_needed": "금융/법무 검토",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "단독 vs 통합 의사결정용 비교표 작성",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:금융/법무 검토",
    "sort_key": 90.0972,
    "notes": null
  },
  {
    "id": "T-027",
    "project": "공통",
    "category_main": "PF/금융",
    "sector_detail": "재무모델",
    "task_name": "427/816/통합 재무모델 업데이트",
    "task_purpose": "원가·임차·호텔·신용공여 조건이 PF 조달액과 주주 설득에 영향",
    "deliverables": "통합 재무모델, 사업비, 금융비용, 민감도",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "LFC",
    "coop_depts": "사업2파트;기업마케팅실;개발관리실",
    "assignee": "미정",
    "external_party": "회계법인/대주단",
    "support_needed": "업데이트 입력값",
    "is_blocker": "Y",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "각 부서 입력값 마감일 설정",
    "priority_score": 70,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 지원:업데이트 입력값",
    "sort_key": 70.0971,
    "notes": null
  },
  {
    "id": "T-028",
    "project": "816PFV",
    "category_main": "PF/금융",
    "sector_detail": "LOC/책임임차",
    "task_name": "삼성 LOC/책임임차 비용 및 구조 반영",
    "task_purpose": "816 단독 PF 비용절감/대주 설득 논리와 연결",
    "deliverables": "LOC 수수료, 책임임차 비용, 이지스 부담 비교",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "LFC",
    "coop_depts": "사업2파트;기업마케팅실",
    "assignee": "미정",
    "external_party": "삼성물산, 대주단",
    "support_needed": "삼성 조건 확정",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-08-22",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "단독 PF 시 비용절감 논리 재검증",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:삼성 조건 확정",
    "sort_key": 65.097,
    "notes": null
  },
  {
    "id": "T-029",
    "project": "공통",
    "category_main": "PF/금융",
    "sector_detail": "PF CP",
    "task_name": "PF 실행 선결조건 체크리스트 구축",
    "task_purpose": "PF 실행 전 모든 부서 산출물을 CP 형태로 확인 필요",
    "deliverables": "PF CP checklist, 담당/기한/증빙자료 목록",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "LFC",
    "coop_depts": "사업2파트;개발관리실;공간솔루션실;기업마케팅실",
    "assignee": "미정",
    "external_party": "대주단",
    "support_needed": "각 부서 산출물",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-09-07",
    "status": "미착수",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "부서별 CP owner 지정",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:각 부서 산출물",
    "sort_key": 65.0969,
    "notes": null
  },
  {
    "id": "T-030",
    "project": "공통",
    "category_main": "구조/법무/세무",
    "sector_detail": "리츠 전환",
    "task_name": "427 리츠 전환 및 816 편입 구조 검토",
    "task_purpose": "기존 통합 기본안이었으나 방향성이 미정이라 재검토 필요",
    "deliverables": "리츠 전환 구조도, 절차, 세무/법무 쟁점",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "법무/세무 외부자문;LFC;사업관리1파트",
    "assignee": "미정",
    "external_party": "법무법인, 세무법인",
    "support_needed": "외부 자문",
    "is_blocker": "Y",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "기본안 유지/폐기/보류 판단",
    "priority_score": 90,
    "meeting_grade": "A_즉시상정",
    "agenda_reason": "PF필수 / Blocker / 의사결정 / 지원:외부 자문",
    "sort_key": 90.0968,
    "notes": null
  },
  {
    "id": "T-031",
    "project": "공통",
    "category_main": "구조/법무/세무",
    "sector_detail": "Asset/Share/합병",
    "task_name": "Asset Deal·Share Deal·합병·현물출자 비교",
    "task_purpose": "통합 구조별 절차·취득세·주주동의·실행가능성 판단 필요",
    "deliverables": "구조별 비교표, 장단점, 세금/승인 이슈",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "사업2파트;LFC",
    "assignee": "미정",
    "external_party": "법무법인, 세무법인",
    "support_needed": "자문결과 필요",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-08-07",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "구조별 의사결정 기준 명확화",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:자문결과 필요",
    "sort_key": 65.0967,
    "notes": null
  },
  {
    "id": "T-032",
    "project": "공통",
    "category_main": "구조/법무/세무",
    "sector_detail": "421호 펀드",
    "task_name": "421호 펀드 및 수익자 이해관계 정리",
    "task_purpose": "펀드 투자자·주주대여·수익배분 구조가 구조전환 및 PF에 영향",
    "deliverables": "421호 투자자/수익권/배당구조 요약표",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업관리1파트",
    "coop_depts": "사업2파트;LFC;법무/세무 외부자문",
    "assignee": "미정",
    "external_party": "수익자, 신탁사",
    "support_needed": "펀드자료 확인",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-08-22",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "구조전환 시 수익자 동의/통지 필요성 확인",
    "priority_score": 45,
    "meeting_grade": "C_주간관리",
    "agenda_reason": "PF필수 / 지원:펀드자료 확인",
    "sort_key": 45.0966,
    "notes": null
  },
  {
    "id": "T-033",
    "project": "공통",
    "category_main": "구조/법무/세무",
    "sector_detail": "PFV 주주승인",
    "task_name": "PFV별 주주승인·기존주주 설득 포인트 정리",
    "task_purpose": "기존 주주 동의가 구조전환·PF 실행의 실질 변수",
    "deliverables": "주주별 권리/동의필요/협상 포인트",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업관리1파트",
    "coop_depts": "사업2파트;법무/세무 외부자문",
    "assignee": "미정",
    "external_party": "현대건설, 삼성물산, 신한, NH 등",
    "support_needed": "주주 구조 확인",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-08-22",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "주주별 이해관계와 설득논리 정리",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:주주 구조 확인",
    "sort_key": 65.0965,
    "notes": null
  },
  {
    "id": "T-034",
    "project": "공통",
    "category_main": "주주/보고",
    "sector_detail": "내부 의사결정",
    "task_name": "6~7월 단독/통합/호텔/시공 방향결정 회의 준비",
    "task_purpose": "의사결정 없이 자료요청만 반복되는 구조 차단",
    "deliverables": "의사결정 안건지, 옵션 비교표, 추천안",
    "target_axis": "PF",
    "gate_stage": "G1 방향결정",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "개발관리실",
    "assignee": "미정",
    "external_party": "대표/본부장/파트장",
    "support_needed": "회의 일정 확정",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-07-27",
    "status": "진행중",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "회의 전 부서별 산출물 마감 설정",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:회의 일정 확정",
    "sort_key": 65.0964,
    "notes": null
  },
  {
    "id": "T-035",
    "project": "공통",
    "category_main": "주주/보고",
    "sector_detail": "주주사 보고",
    "task_name": "주주사 보고자료 구조 및 리스크 문안 정리",
    "task_purpose": "외부 보고 시 사업성·PF 가능성·원가 리스크 표현 필요",
    "deliverables": "주주사 보고자료, Q&A, 리스크 대응문안",
    "target_axis": "PF",
    "gate_stage": "G2 PF준비도",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "LFC;사업관리1파트;법무/세무 외부자문",
    "assignee": "미정",
    "external_party": "주주사",
    "support_needed": "숫자/법무 검토",
    "is_blocker": "N",
    "needs_decision": "Y",
    "due_date": "2026-09-07",
    "status": "미착수",
    "importance_level": "PF필수",
    "task_type": "정규",
    "next_action": "보고자료와 내부 의사결정안 분리",
    "priority_score": 65,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "PF필수 / 의사결정 / 지원:숫자/법무 검토",
    "sort_key": 65.0963,
    "notes": null
  },
  {
    "id": "T-036",
    "project": "공통",
    "category_main": "주주/보고",
    "sector_detail": "Action Item",
    "task_name": "회의록·Action Item·Due Date 관리",
    "task_purpose": "업무가 흩어지지 않고 담당/기한/산출물 기준으로 회수되게 함",
    "deliverables": "회의록, Action Item, 미완료/지원요청 목록",
    "target_axis": "공통 PMO",
    "gate_stage": "G0 현황정리",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "전 부서",
    "assignee": "미정",
    "external_party": "내부 전체",
    "support_needed": "부서별 피드백",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-07-27",
    "status": "진행중",
    "importance_level": "중요",
    "task_type": "정규",
    "next_action": "주간 업데이트 루틴 확정",
    "priority_score": 15,
    "meeting_grade": "D_대기",
    "agenda_reason": "지원:부서별 피드백",
    "sort_key": 15.0962,
    "notes": null
  },
  {
    "id": "T-037",
    "project": "공통",
    "category_main": "준공/담보대출",
    "sector_detail": "착공 이후 KPI",
    "task_name": "PF 이후 착공·공정·원가·변경관리 KPI 설계",
    "task_purpose": "PF가 끝이 아니라 준공과 Take-out까지 관리 필요",
    "deliverables": "공정률, 원가, 변경, 리스크 KPI 대시보드",
    "target_axis": "착공",
    "gate_stage": "G4 착공/공사",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;LFC;공간솔루션실",
    "assignee": "미정",
    "external_party": "시공사/CM",
    "support_needed": "장기 KPI 설계",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-11-07",
    "status": "미착수",
    "importance_level": "준공필수",
    "task_type": "정규",
    "next_action": "PF CP 이후 공사관리 체계로 전환",
    "priority_score": 50,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "준공필수 / 지원:장기 KPI 설계",
    "sort_key": 50.0961,
    "notes": null
  },
  {
    "id": "T-038",
    "project": "공통",
    "category_main": "준공/담보대출",
    "sector_detail": "준공 CP",
    "task_name": "준공/사용승인 CP 및 증빙자료 관리체계 수립",
    "task_purpose": "Take-out 대출 및 운영전환의 전제 조건",
    "deliverables": "준공 CP, 사용승인 증빙, 담보대출 요구자료 목록",
    "target_axis": "준공/사용승인",
    "gate_stage": "G5 준공",
    "pmo_manager": "사업2파트",
    "lead_dept": "개발관리실",
    "coop_depts": "사업2파트;LFC",
    "assignee": "미정",
    "external_party": "관청, 대주단",
    "support_needed": "장기 자료요건",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2027-04-07",
    "status": "미착수",
    "importance_level": "준공필수",
    "task_type": "정규",
    "next_action": "장기 과제로 별도 로드맵 관리",
    "priority_score": 50,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "준공필수 / 지원:장기 자료요건",
    "sort_key": 50.096,
    "notes": null
  },
  {
    "id": "T-039",
    "project": "공통",
    "category_main": "준공/담보대출",
    "sector_detail": "Take-out",
    "task_name": "준공 후 담보대출/Take-out 전략 수립",
    "task_purpose": "브릿지/PF 상환과 자산 안정화 전략의 최종 회수 단계",
    "deliverables": "Take-out 대출 전략, 담보가치, DSCR, 임대안정화 계획",
    "target_axis": "담보대출/Take-out",
    "gate_stage": "G6 담보대출/운영전환",
    "pmo_manager": "사업2파트",
    "lead_dept": "LFC",
    "coop_depts": "사업2파트;기업마케팅실;개발관리실",
    "assignee": "미정",
    "external_party": "금융기관",
    "support_needed": "장기 금융전략",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2027-04-07",
    "status": "미착수",
    "importance_level": "준공필수",
    "task_type": "정규",
    "next_action": "PF 조건과 준공 후 담보대출 연결",
    "priority_score": 50,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "준공필수 / 지원:장기 금융전략",
    "sort_key": 50.0959,
    "notes": null
  },
  {
    "id": "T-040",
    "project": "공통",
    "category_main": "준공/담보대출",
    "sector_detail": "운영전환",
    "task_name": "준공 후 운영·자산관리 전환계획 수립",
    "task_purpose": "준공 이후 임대운영, 호텔운영, 담보대출 관리 필요",
    "deliverables": "운영전환 체크리스트, 임대운영/호텔운영 업무분장",
    "target_axis": "운영전환",
    "gate_stage": "G6 담보대출/운영전환",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "기업마케팅실;공간솔루션실;LFC",
    "assignee": "미정",
    "external_party": "운영사/임차인",
    "support_needed": "운영정책 필요",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2027-04-07",
    "status": "미착수",
    "importance_level": "준공필수",
    "task_type": "정규",
    "next_action": "장기 과제로 초기부터 관리",
    "priority_score": 50,
    "meeting_grade": "B_회의점검",
    "agenda_reason": "준공필수 / 지원:운영정책 필요",
    "sort_key": 50.0958,
    "notes": null
  },
  {
    "id": "T-041",
    "project": "공통",
    "category_main": "팝업/단발",
    "sector_detail": "외부 보고 요청",
    "task_name": "갑작스러운 외부 보고자료 요청 접수",
    "task_purpose": "정규 업무 침식 여부 판단 필요",
    "deliverables": "요청 목적/기한/원 수행부서 확인 후 접수 또는 위임",
    "target_axis": "PF",
    "gate_stage": "G0 현황정리",
    "pmo_manager": "사업2파트",
    "lead_dept": "사업2파트",
    "coop_depts": "요청부서",
    "assignee": "미정",
    "external_party": "내부/외부 요청자",
    "support_needed": "목적·기한 확인",
    "is_blocker": "N",
    "needs_decision": "N",
    "due_date": "2026-07-27",
    "status": "미착수",
    "importance_level": "중요",
    "task_type": "팝업",
    "next_action": "팝업요청관리 시트로 이관",
    "priority_score": 20,
    "meeting_grade": "D_대기",
    "agenda_reason": "지원:목적·기한 확인 / 팝업",
    "sort_key": 20.0957,
    "notes": "샘플"
  }
];

export const FALLBACK_BOARD_TASKS = RAW_FALLBACK_BOARD_TASKS.map((task) => ({
    ...task,
    pmo_manager: normalizeIotaOrganization(task.pmo_manager, '사업2파트'),
    lead_dept: normalizeIotaOrganization(task.lead_dept, '사업2파트'),
    coop_depts: normalizeIotaDepartmentList(task.coop_depts).join(';'),
}));

const decoratePmoBoardTasks = (taskRows) => [...(taskRows || [])]
    .sort(comparePmoTasksByCreatedAt)
    .map((task, index) => ({
        ...task,
        displayId: `T-${String(index + 1).padStart(3, '0')}`,
    }));

// Department name normalization helper
const normalizeDeptName = (name, isCoop = false) => {
    if (!name) return isCoop ? '' : '사업2파트';
    const clean = String(name).trim().toUpperCase();
    
    if (clean.includes('SUB-PO') || clean.includes('SUB PO')) return 'Sub-PO';
    if (clean === 'PO') return 'PO';
    if (clean.includes('기획추진') || clean.includes('DEPT_PO')) return '기획추진';
    if (clean.includes('CFT') || clean.includes('총괄')) return 'CFT 책임인력';
    if (clean.includes('IPR')) return 'IPR';
    if (clean.includes('사업PM') && !clean.includes('PM1') && !clean.includes('PM2')) return '사업2파트';
    if (clean.includes('펀드운용')) return 'KAM';

    if (clean.includes('LFC') || clean.includes('금융') || clean.includes('파이낸싱')) return 'LFC';
    if (clean.includes('사업관리1') || clean.includes('사업1') || clean.includes('관리1') || clean.includes('PM1')) return '사업1파트';
    if (clean.includes('사업관리2') || clean.includes('사업2') || clean.includes('관리2') || clean.includes('PM2')) return '사업2파트';
    if (clean.includes('개발관리') || clean.includes('개발솔루션') || clean.includes('개발') || clean.includes('DEV') || clean.includes('DSC')) return '개발솔루션';
    if (clean.includes('기업마케팅') || clean.includes('마케팅') || clean.includes('홍보') || clean.includes('MKT') || clean.includes('EMC')) return '기업마케팅';
    if (clean.includes('공간솔루션') || clean.includes('설계') || clean.includes('공간') || clean.includes('DESIGN') || clean.includes('SSC')) return '공간솔루션';
    if (clean.includes('KAM') || clean.includes('자산') || clean.includes('에셋')) return 'KAM';
    if (clean.includes('전부서') || clean.includes('전 부서') || clean.includes('전체')) {
        return isCoop ? '전부서' : '사업2파트';
    }
    if (clean.includes('외부') || clean.includes('법무') || clean.includes('세무') || clean.includes('자문')) {
        return isCoop ? String(name).trim() : '사업2파트';
    }
    
    return isCoop ? name || '전부서' : '사업2파트';
};

const normalizeCoopDepts = (deptsStr) => {
    if (!deptsStr) return '';
    const parts = deptsStr.split(/[,;/]+/).map(p => p.trim()).filter(Boolean);
    const normalized = parts.map(p => normalizeDeptName(p, true));
    const unique = [...new Set(normalized)];
    return unique.filter(Boolean).join(', ');
};

// Project name normalization helper
const normalizeProjectName = (name) => {
    if (!name) return 'IOTA 공통';
    const clean = String(name).trim().toUpperCase();
    if (clean === 'IOTA_SEOUL' || clean === 'IOTA 공통' || clean === '공통' || clean === 'IOTA공통') return 'IOTA 공통';
    if (clean === 'PFV_427' || clean === '427 PFV' || clean === '427PFV' || clean === '427') return '427 PFV';
    if (clean === 'PFV_816' || clean === '816 PFV' || clean === '816PFV' || clean === '816') return '816 PFV';
    if (clean === 'FUND_421' || clean === '421FUND' || clean === '421 FUND' || clean === '421펀드' || clean === '421') return '421Fund';
    if (clean === 'EXTERNAL' || clean === '외부') return '외부';
    return name;
};

const normalizeSearchText = (value) => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(normalizeSearchText).join(' ');
    if (typeof value === 'object') {
        return [
            value.name,
            value.staff_name,
            value.dept_name,
            value.stakeholder_name,
            value.label,
            value.title
        ]
            .filter(item => item !== null && item !== undefined)
            .map(normalizeSearchText)
            .join(' ');
    }
    return String(value).toLowerCase();
};

// Gate string mapping (UI/Excel <-> DB)
const gateMapToDb = (uiVal) => {
    if (!uiVal) return 'G0';
    if (uiVal.startsWith('G0')) return 'G0';
    if (uiVal.startsWith('G1')) return 'G1';
    if (uiVal.startsWith('G2')) return 'G2';
    if (uiVal.startsWith('G3')) return 'G3';
    if (uiVal.startsWith('G4')) return 'G4';
    if (uiVal.startsWith('G5')) return 'G5';
    if (uiVal.startsWith('G6')) return 'G6';
    return 'G0';
};

const gateMapToUi = (dbVal) => {
    if (dbVal === 'G0') return 'G0 현황정리';
    if (dbVal === 'G1') return 'G1 방향결정';
    if (dbVal === 'G2') return 'G2 PF준비도';
    if (dbVal === 'G3') return 'G3 PF실행';
    if (dbVal === 'G4') return 'G4 착공/공사';
    if (dbVal === 'G5') return 'G5 준공';
    if (dbVal === 'G6') return 'G6 담보대출/운영전환';
    return dbVal || 'G0 현황정리';
};

// Meeting grade mapping (UI/Excel <-> DB)
const gradeMapToDb = (uiVal) => {
    if (!uiVal) return 'B';
    const s = String(uiVal).toUpperCase();
    if (s.startsWith('A')) return 'A';
    if (s.startsWith('B')) return 'B';
    if (s.startsWith('C')) return 'C';
    if (s.startsWith('D')) return 'D';
    return uiVal;
};

const gradeMapToUi = (dbVal) => {
    if (dbVal === 'A') return 'A_즉시상정';
    if (dbVal === 'B') return 'B_회의점검';
    if (dbVal === 'C') return 'C_주간관리';
    if (dbVal === 'D') return 'D_대기';
    return dbVal || 'B_회의점검';
};

const getPmoTaskDisplayId = (task, taskList = []) => {
    const directDisplayId = String(task?.displayId || '').trim();
    if (directDisplayId) return directDisplayId;

    const matchedTask = taskList.find((candidate) => (
        String(candidate.id) === String(task?.id)
    ));
    const matchedDisplayId = String(matchedTask?.displayId || '').trim();
    if (matchedDisplayId) return matchedDisplayId;

    const legacyTaskId = String(task?.id || '').trim();
    return /^T-\d+$/i.test(legacyTaskId) ? legacyTaskId : '';
};

export default function PmoTaskBoardStaging({
    searchQuery: propSearchQuery,
    setSearchQuery: propSetSearchQuery,
    viewMode: propViewMode,
    setViewMode: propSetViewMode,
    pageSize = 10,
    setPageSize,
    addNewTaskTrigger = 0,
    embeddedDetailOnly = false,
    onEmbeddedDetailClose = null
}) {
    const { memberInfo } = useAuth();
    const initialCachedTasksRef = useRef(getCachedPmoBoardTasks());
    const [tasks, setTasks] = useState(() => decoratePmoBoardTasks(initialCachedTasksRef.current));
    const [loading, setLoading] = useState(() => !initialCachedTasksRef.current);
    const [isDbMode, setIsDbMode] = useState(() => Boolean(initialCachedTasksRef.current));

    // Table header filters state
    const [selectedProject, setSelectedProject] = useState('전체보기');
    const [selectedCategoryMain, setSelectedCategoryMain] = useState('전체보기');
    const [selectedGateStage, setSelectedGateStage] = useState('전체보기');
    const [selectedLeadDept, setSelectedLeadDept] = useState('전체보기');
    const [selectedCoopDept, setSelectedCoopDept] = useState('전체보기');
    const [selectedIsBlocker, setSelectedIsBlocker] = useState('전체보기');
    const [selectedNeedsDecision, setSelectedNeedsDecision] = useState('전체보기');
    const [selectedStatus, setSelectedStatus] = useState('전체보기');
    const [selectedImportanceLevel, setSelectedImportanceLevel] = useState('전체보기');
    const [selectedMeetingGrade, setSelectedMeetingGrade] = useState('전체보기');
    const [selectedSupportNeeded, setSelectedSupportNeeded] = useState('전체보기');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const filterStatus = params.get('filterStatus');
        const filterIsBlocker = params.get('filterIsBlocker');
        const filterNeedsDecision = params.get('filterNeedsDecision');
        const filterImportance = params.get('filterImportance');
        const filterMeetingGrade = params.get('filterMeetingGrade');
        const filterSupportNeeded = params.get('filterSupportNeeded');

        if (filterStatus) setSelectedStatus(filterStatus);
        if (filterIsBlocker) setSelectedIsBlocker(filterIsBlocker);
        if (filterNeedsDecision) setSelectedNeedsDecision(filterNeedsDecision);
        if (filterImportance) setSelectedImportanceLevel(filterImportance);
        if (filterMeetingGrade) setSelectedMeetingGrade(filterMeetingGrade);
        if (filterSupportNeeded) setSelectedSupportNeeded(filterSupportNeeded);
        const filterLeadDept = params.get('filterLeadDept');
        const filterCoopDept = params.get('filterCoopDept');
        if (filterLeadDept) setSelectedLeadDept(filterLeadDept);
        if (filterCoopDept) setSelectedCoopDept(filterCoopDept);
        const filterCategoryMain = params.get('filterCategoryMain');
        if (filterCategoryMain) setSelectedCategoryMain(filterCategoryMain);
    }, []);

    // Masters loaded from DB
    const [projects, setProjects] = useState([
        { project_code: 'IOTA_SEOUL', project_name: 'IOTA 공통' },
        { project_code: 'PFV_427', project_name: '427 PFV' },
        { project_code: 'PFV_816', project_name: '816 PFV' },
        { project_code: 'FUND_421', project_name: '421Fund' },
        { project_code: 'EXTERNAL', project_name: '외부' }
    ]);
    const [departments, setDepartments] = useState([
        { dept_code: 'DEPT_PM2', dept_name: '사업2파트' },
        { dept_code: 'DEPT_PO', dept_name: '기획추진' },
        { dept_code: 'DEPT_LFC', dept_name: 'LFC' },
        { dept_code: 'DEPT_DEV', dept_name: '개발솔루션' },
        { dept_code: 'DEPT_DESIGN', dept_name: '공간솔루션' },
        { dept_code: 'DEPT_MKT', dept_name: '기업마케팅' }
    ]);
    const [stakeholders, setStakeholders] = useState([
        { stakeholder_code: 'SH_LP_01', stakeholder_name: '이지스자산운용' },
        { stakeholder_code: 'SH_DEV_01', stakeholder_name: '이오타시행사' },
        { stakeholder_code: 'SH_CON_01', stakeholder_name: '이지스건설' },
        { stakeholder_code: 'SH_FIN_01', stakeholder_name: '한국대주은행' }
    ]);
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const [subsectors, setSubsectors] = useState([]);
    const [supportOptions, setSupportOptions] = useState([]);
    const [activeTaskIds, setActiveTaskIds] = useState(new Set());

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDrawerEditing, setIsDrawerEditing] = useState(false);
    const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
    const [prioritySortOrder, setPrioritySortOrder] = useState('desc'); // default: highest first
    const [showAuthInfoModal, setShowAuthInfoModal] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
    const setSearchQuery = propSetSearchQuery !== undefined ? propSetSearchQuery : setLocalSearchQuery;
    const [localViewMode, setLocalViewMode] = useState('key');
    const viewMode = propViewMode !== undefined ? propViewMode : localViewMode;
    const isAll = viewMode === 'all';
    const [editingItem, setEditingItem] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
    const [isSaveSuccessOpen, setIsSaveSuccessOpen] = useState(false);
    const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
    const initialUrlCheckedRef = useRef(false);
    const drawerRef = useRef(null);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

    const closeSelectedTaskDetail = () => {
        setSelectedTaskDetail(null);
        if (embeddedDetailOnly) onEmbeddedDetailClose?.();
    };

    // Suggestions panels
    const [showSubsectorSuggestions, setShowSubsectorSuggestions] = useState(false);
    const [showStakeholderSuggestions, setShowStakeholderSuggestions] = useState(false);
    const [showSupportSuggestions, setShowSupportSuggestions] = useState(false);

    // Form states
    const [formProject, setFormProject] = useState('IOTA_SEOUL');
    const [formCategoryMain, setFormCategoryMain] = useState('');
    const [formSectorDetail, setFormSectorDetail] = useState('');
    const [formTaskName, setFormTaskName] = useState('');
    const [formTaskPurpose, setFormTaskPurpose] = useState('');
    const [formDeliverables, setFormDeliverables] = useState('');
    const [formGateStage, setFormGateStage] = useState('G0 현황정리');
    const [formPmoManager, setFormPmoManager] = useState('사업2파트');
    const [formLeadDept, setFormLeadDept] = useState('사업2파트');
    const [formCoopDepts, setFormCoopDepts] = useState('');
    const [formAssignee, setFormAssignee] = useState('미정');
    const [formExternalParty, setFormExternalParty] = useState('');
    const [formSupportNeeded, setFormSupportNeeded] = useState('');
    const [formIsBlocker, setFormIsBlocker] = useState(false);
    const [formNeedsDecision, setFormNeedsDecision] = useState(false);
    const [formDueDate, setFormDueDate] = useState('');
    const [formStatus, setFormStatus] = useState('진행중');
    const [formImportanceLevel, setFormImportanceLevel] = useState('중간');
    const [formTaskType, setFormTaskType] = useState('정규');
    const [formNextAction, setFormNextAction] = useState('');
    const [formPriorityScore, setFormPriorityScore] = useState(0);
    const [formMeetingGrade, setFormMeetingGrade] = useState('B_회의점검');
    const [formAgendaReason, setFormAgendaReason] = useState('');
    const [formSortKey, setFormSortKey] = useState('');
    const [formNotes, setFormNotes] = useState('');

    // Clear inline editing on detail drawer target change
    useEffect(() => {
        setIsDrawerEditing(false);
    }, [selectedTaskDetail]);

    // Toggle body class to hide global header buttons when drawer is open
    useEffect(() => {
        if (selectedTaskDetail) {
            document.body.classList.add('drawer-open');
        } else {
            document.body.classList.remove('drawer-open');
        }
        return () => {
            document.body.classList.remove('drawer-open');
        };
    }, [selectedTaskDetail]);

    // Listen to log updates to dynamically mark task as active (red N badge) in real-time
    useEffect(() => {
        const handleLogUpdated = (e) => {
            const taskId = e.detail?.taskId;
            if (taskId) {
                setActiveTaskIds(prev => {
                    const next = new Set(prev);
                    next.add(taskId);
                    return next;
                });
            }
        };
        window.addEventListener('iota_log_updated', handleLogUpdated);
        return () => window.removeEventListener('iota_log_updated', handleLogUpdated);
    }, []);

    // Automatically calculate priority score, meeting grade, and agenda reason in Edit form
    useEffect(() => {
        const tempTask = {
            importance_level: formImportanceLevel,
            is_blocker: formIsBlocker,
            needs_decision: formNeedsDecision,
            support_needed: formSupportNeeded,
            due_date: formDueDate,
            status: formStatus,
            task_type: formTaskType
        };
        const score = calculatePriorityScore(tempTask);
        setFormPriorityScore(score);

        // Grade calculation
        setFormMeetingGrade(gradeMapToUi(getPmoMeetingGrade(score)));

        // Agenda reason calculation
        const agendaParts = [];
        const importance = formImportanceLevel || '중간';
        if (importance === 'PF필수' || importance === '준공필수') {
            agendaParts.push(importance);
        }
        if (formIsBlocker) {
            agendaParts.push('Blocker');
        }
        if (formNeedsDecision) {
            agendaParts.push('의사결정');
        }
        const support = formSupportNeeded || '';
        const cleanSupport = support.trim().toLowerCase();
        const invalidKeywords = ['', '없음', 'n/a', 'na', '해당사항 없음', '해당사항없음', '-', 'none'];
        if (cleanSupport && !invalidKeywords.includes(cleanSupport)) {
            agendaParts.push(`지원:${support.trim()}`);
        }
        
        let isTaskOverdue = false;
        if (formDueDate && formStatus !== '완료') {
            try {
                const dueDate = new Date(formDueDate);
                if (!isNaN(dueDate.getTime())) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (dueDate < today) {
                        isTaskOverdue = true;
                    }
                }
            } catch (e) {}
        }
        
        if (formStatus === '지연' || isTaskOverdue) {
            agendaParts.push(isTaskOverdue ? '지연(기한지남)' : '지연');
        }
        if (formTaskType === '팝업') {
            agendaParts.push('팝업');
        }
        setFormAgendaReason(agendaParts.join(' / '));
    }, [formImportanceLevel, formIsBlocker, formNeedsDecision, formSupportNeeded, formDueDate, formStatus, formTaskType]);

    // Cooperative department helper matching logic
    const isCoopDeptSelected = (dept, currentVal) => {
        if (!currentVal) return false;
        const selectedList = normalizeIotaDepartmentList(currentVal);
        return selectedList.includes(normalizeIotaOrganization(dept));
    };

    const handleCoopDeptToggle = (dept) => {
        const selectedList = formCoopDepts ? formCoopDepts.split(/[,;/]+/).map(d => d.trim()).filter(Boolean) : [];
        const isSelected = isCoopDeptSelected(dept, formCoopDepts);
        
        let newList;
        if (isSelected) {
            const normalizedDept = normalizeIotaOrganization(dept);
            newList = selectedList.filter(item => normalizeIotaOrganization(item) !== normalizedDept);
        } else {
            newList = [...selectedList, dept];
        }
        setFormCoopDepts(newList.join('; '));
    };

    // Authority memo
    const isAuthorized = useMemo(() => {
        // Bypass authority check on localhost/127.0.0.1/DEV mode for development/testing
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || import.meta.env.DEV;
        if (isLocal) return true;

        if (!memberInfo) return false;
        const org = memberInfo.org_name || '';
        const workspace = memberInfo.workspace_code || '';
        const role = memberInfo.role_code || '';
        return (
            org.includes('사업2파트') || 
            org.includes('기획추진') ||
            org.includes('시스템 관리자(기획추진)') ||
            role.toUpperCase().includes('PO') ||
            ['WS_PM2', 'WS_PM'].includes(workspace) ||
            role === 'master' ||
            role === 'director'
        );
    }, [memberInfo]);

    // Unique arrays for Autocomplete Suggestions
    const uniqueSubsectors = useMemo(() => {
        const defaultSubs = subsectors.length > 0 ? subsectors : [
            '업무관리 체계', '현금기부채납', '소공원로', '변경인가', '사용승인', '브랜드', '계약구조',
            '운영수지/FF&E', '현대건설', '삼성물산', '공사비/VE', 'PF 기준도면', '면적표',
            '오피스 TI', '호텔 인테리어', '광장', 'KB/금융권', '삼성/이지스', '단독 PF',
            '통합 PF', '재무모델', '리츠 전환', 'Asset/Share/합병', '의사결정', 'Take-out'
        ];
        const subs = [
            ...defaultSubs,
            ...tasks.map(item => item.sector_detail).filter(Boolean)
        ];
        return Array.from(new Set(subs));
    }, [tasks, subsectors]);

    const uniqueStakeholderNames = useMemo(() => {
        const names = [
            ...stakeholders.map(s => s.stakeholder_name),
            ...masterStakeholders.map(s => s.company_name)
        ];
        return Array.from(new Set(names.filter(Boolean)));
    }, [stakeholders, masterStakeholders]);

    const uniqueSupportOptions = useMemo(() => {
        const defaultOpts = supportOptions.length > 0 ? supportOptions : [
            '없음', '부서별 담당자 입력', '파트장 확인', '의사결정', '법무 검토',
            '외부 법무 검토', '외부 회신', '관청 협의 결과', '도면-관청의견 필요',
            '시공사 Term 회신', '삼성 조건 회신', '도면 기준 정리', '임차조건 회신',
            '내부/삼성 협의', 'Term Sheet 필요', '금융/법무 검토', '외부 자문',
            '모델 입력값', '일정 확정'
        ];
        const opts = [
            ...defaultOpts,
            ...tasks.map(item => item.support_needed).filter(Boolean)
        ];
        return Array.from(new Set(opts));
    }, [tasks, supportOptions]);

    // Unique filter options for table header dropdowns (Standardized static/hybrid lists)
    const uniqueProjectsFilter = useMemo(() => {
        return ['IOTA 공통', '427 PFV', '816 PFV', '421Fund', '외부'];
    }, []);

    const uniqueCategoryMainFilter = useMemo(() => {
        return ['공통 PMO', '인허가', '호텔/운영', '시공/원가', '도면/설계', '인테리어/TI', '임차/마케팅', 'PF/금융', '구조/법무/세무', '주주/보고', '준공/담보대출', '팝업/단발'];
    }, []);



    const uniqueGateStageFilter = useMemo(() => {
        return ['G0 현황정리', 'G1 방향결정', 'G2 PF준비도', 'G3 PF실행', 'G4 착공/공사', 'G5 준공', 'G6 담보대출/운영전환'];
    }, []);

    const uniqueLeadDeptFilter = useMemo(() => {
        return ['사업1파트', '사업2파트', 'LFC', '개발솔루션', '기업마케팅', '공간솔루션', 'KAM'];
    }, []);

    const uniqueCoopDeptFilter = useMemo(() => {
        return ['전부서', '사업1파트', '사업2파트', 'LFC', '개발솔루션', '기업마케팅', '공간솔루션', 'KAM'];
    }, []);

    const uniqueStatusFilter = useMemo(() => {
        return ['미착수', '진행중', '지연', '완료', '보류', '중단'];
    }, []);

    const uniqueImportanceFilter = useMemo(() => {
        return ['PF필수', '준공필수', '높음', '중간', '낮음'];
    }, []);

    const uniqueMeetingGradeFilter = useMemo(() => {
        return ['A_즉시상정', 'B_회의점검', 'C_주간관리', 'D_대기'];
    }, []);

    const applyReferenceData = (referenceData) => {
        if (referenceData.projects.length > 0) setProjects(referenceData.projects);
        if (referenceData.departments.length > 0) {
            let mapped = [...referenceData.departments];
            if (!mapped.some((department) => department.dept_code === 'DEPT_PO')) {
                mapped = [
                    ...mapped.filter((department) => department.dept_code === 'DEPT_PM2'),
                    { dept_code: 'DEPT_PO', dept_name: '기획추진' },
                    ...mapped.filter((department) => department.dept_code !== 'DEPT_PM2'),
                ];
            }
            setDepartments(mapped);
        }
        if (referenceData.stakeholders.length > 0) setStakeholders(referenceData.stakeholders);
        setMasterStakeholders(referenceData.masterStakeholders);
        setSubsectors(referenceData.subsectors);
        setSupportOptions(referenceData.supportOptions);
    };

    async function fetchTasks(showLoading = true, force = false) {
        try {
            if (showLoading && tasks.length === 0) setLoading(true);
            const data = await fetchPmoBoardTasks({ force });
            setTasks(decoratePmoBoardTasks(data));
            setIsDbMode(true);
            initialUrlCheckedRef.current = true;
        } catch (err) {
            console.error("Failed to fetch tasks from DB:", err);
            setTasks([]);
            setIsDbMode(true);
            toast.error('통합업무 DB를 불러오지 못했습니다.', { id: 'pmo-task-db-load' });
            initialUrlCheckedRef.current = true;
        } finally {
            if (showLoading) setLoading(false);
        }
    }

    useEffect(() => {
        let isActive = true;
        let refreshTimeoutId;
        let supportingDataTimeoutId;
        let prioritySyncTimeoutId;

        const scheduleRefresh = () => {
            window.clearTimeout(refreshTimeoutId);
            refreshTimeoutId = window.setTimeout(() => fetchTasks(false, true), 300);
        };

        const channel = supabase
            .channel('desktop-pmo-priority-sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'iota_v2',
                table: 'iota_pmo_tasks',
            }, scheduleRefresh)
            .subscribe();

        const initializeBoard = async () => {
            await fetchTasks(!initialCachedTasksRef.current);
            if (!isActive) return;

            supportingDataTimeoutId = window.setTimeout(async () => {
                const [referenceResult, activeTaskIdsResult] = await Promise.allSettled([
                    fetchPmoBoardReferenceData(),
                    fetchRecentPmoActiveTaskIds(),
                ]);
                if (!isActive) return;
                if (referenceResult.status === 'fulfilled') {
                    applyReferenceData(referenceResult.value);
                } else {
                    console.warn('PMO reference data load failed, using defaults:', referenceResult.reason);
                }
                if (activeTaskIdsResult.status === 'fulfilled') {
                    setActiveTaskIds(activeTaskIdsResult.value);
                } else {
                    console.warn('Failed to fetch recent active tasks:', activeTaskIdsResult.reason);
                }
            }, 0);

            prioritySyncTimeoutId = window.setTimeout(async () => {
                const { error: prioritySyncError } = await supabase
                    .schema('iota_v2')
                    .rpc('sync_pmo_priority_scores');

                if (!prioritySyncError) return;
                const missingFunction = prioritySyncError.code === 'PGRST202'
                    || prioritySyncError.code === '42883';
                if (missingFunction) {
                    console.warn('Priority DB sync function is not installed yet.');
                    toast.error('DB 우선순위 동기화 설정이 필요합니다.', { id: 'pmo-priority-db-sync' });
                } else {
                    console.error('Priority DB sync failed:', prioritySyncError);
                    toast.error('DB 우선순위 점수 저장에 실패했습니다.', { id: 'pmo-priority-db-sync' });
                }
            }, 400);
        };

        initializeBoard();

        return () => {
            isActive = false;
            window.clearTimeout(refreshTimeoutId);
            window.clearTimeout(supportingDataTimeoutId);
            window.clearTimeout(prioritySyncTimeoutId);
            supabase.removeChannel(channel);
        };
    }, []);

    const selectedTaskDetailRef = useRef(selectedTaskDetail);
    useEffect(() => {
        selectedTaskDetailRef.current = selectedTaskDetail;
    }, [selectedTaskDetail]);

    // Handle details drawer click-outside to close, allowing main table row clicks to switch instead of closing
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (isModalOpen) return;
            if (!selectedTaskDetailRef.current) return;

            if (drawerRef.current && !drawerRef.current.contains(e.target)) {
                // Keep drawer open if user clicked a table row, a notification item, a log link, or any button
                if (e.target.closest('tr') || e.target.closest('.activity-log-item') || e.target.closest('.notification-item') || e.target.closest('button')) {
                    return;
                }
                closeSelectedTaskDetail();
                if (embeddedDetailOnly) return;
                const newParams = new URLSearchParams(window.location.search);
                let changed = false;
                if (newParams.has('taskId')) { newParams.delete('taskId'); changed = true; }
                if (newParams.has('logId')) { newParams.delete('logId'); changed = true; }
                if (changed) {
                    const newSearch = newParams.toString();
                    window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
                }
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [embeddedDetailOnly, isModalOpen, onEmbeddedDetailClose]);

    // Watch URL parameter changes dynamically (for mount and popstate events / notification clicks)
    useEffect(() => {
        const checkUrlParams = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlTaskId = params.get('taskId');
            const urlLogId = params.get('logId');
            const currentDetail = selectedTaskDetailRef.current;

            let targetTaskId = urlTaskId || null;

            if (!targetTaskId && urlLogId) {
                try {
                    const { data: logRow, error: logRowErr } = await supabase
                        .from('iota_seoul_logs')
                        .select('metadata')
                        .eq('log_id', urlLogId)
                        .single();
                    if (!logRowErr && logRow && logRow.metadata?.task_id) {
                        targetTaskId = logRow.metadata.task_id;
                    }
                } catch (e) {
                    console.error("Failed to resolve logId to taskId in effect:", e);
                }
            }

            if (targetTaskId) {
                try {
                    // Fetch the task directly from iota_pmo_tasks to verify type and existence
                    const { data: taskRow, error: taskErr } = await supabase
                        .schema('iota_v2')
                        .from('iota_pmo_tasks')
                        .select(`
                            *,
                            lead_dept:iota_departments!lead_dept_code(dept_name),
                            external_party:iota_stakeholders!external_party_code(stakeholder_name)
                        `)
                        .eq('id', targetTaskId)
                        .maybeSingle();

                    if (!taskErr && taskRow) {
                        // If the task type is a popup, redirect to the popup-requests page!
                        if (taskRow.task_type === '팝업') {
                            console.log(`[PmoTaskBoardStaging] Redirecting taskId ${targetTaskId} to popup-requests board since its type is ${taskRow.task_type}`);
                            const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
                            const queryParam = urlLogId ? `logId=${urlLogId}` : `taskId=${targetTaskId}`;
                            window.location.href = `${base}/platform/iotaseoul/popup-requests?${queryParam}`;
                            return;
                        }

                        // It is a normal Integration Board task! Show the detail modal.
                        const matched = tasks.find(item => String(item.id) === String(targetTaskId));
                        if (matched) {
                            if (currentDetail !== matched) {
                                setSelectedTaskDetail(matched);
                            }
                        } else {
                            setSelectedTaskDetail(taskRow);
                        }
                    } else {
                        // Task not found in DB
                        toast.error("요청하신 통합업무(글)가 존재하지 않거나 삭제되었습니다.");
                        const newParams = new URLSearchParams(window.location.search);
                        newParams.delete('taskId');
                        newParams.delete('logId');
                        const newSearch = newParams.toString();
                        window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
                        if (embeddedDetailOnly) onEmbeddedDetailClose?.();
                    }
                } catch (err) {
                    console.error("Error verifying task ID:", err);
                }
                initialUrlCheckedRef.current = true;
            } else if (urlLogId) {
                // If logId was passed but couldn't be resolved to a task_id
                toast.error("요청하신 이력 또는 연계된 통합업무(글)가 존재하지 않거나 삭제되었습니다.");
                const newParams = new URLSearchParams(window.location.search);
                newParams.delete('logId');
                const newSearch = newParams.toString();
                window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
                initialUrlCheckedRef.current = true;
                if (embeddedDetailOnly) onEmbeddedDetailClose?.();
            }
        };

        checkUrlParams();

        const handlePopState = () => {
            checkUrlParams();
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [embeddedDetailOnly, onEmbeddedDetailClose, tasks]);

    // Sync selectedTaskDetail to URL query param
    useEffect(() => {
        // Skip URL deletion if we haven't checked/initialized the URL taskId yet on mount
        if (!selectedTaskDetail && !initialUrlCheckedRef.current) {
            return;
        }

        if (selectedTaskDetail) {
            const params = new URLSearchParams(window.location.search);
            let changed = false;
            if (params.get('taskId') !== String(selectedTaskDetail.id)) {
                params.set('taskId', selectedTaskDetail.id);
                changed = true;
            }
            if (params.has('logId')) {
                params.delete('logId');
                changed = true;
            }
            if (changed) {
                window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
            }
        } else {
            const params = new URLSearchParams(window.location.search);
            let changed = false;
            if (params.has('taskId')) {
                params.delete('taskId');
                changed = true;
            }
            if (params.has('logId')) {
                params.delete('logId');
                changed = true;
            }
            if (changed) {
                const newSearch = params.toString();
                window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
            }
        }
    }, [selectedTaskDetail]);

    // Auto-scroll selected task row into view
    useEffect(() => {
        if (selectedTaskDetail) {
            setTimeout(() => {
                const el = document.getElementById(`task-row-${selectedTaskDetail.id}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 150);
        }
    }, [selectedTaskDetail]);

    // Department code resolver & on-the-fly register
    async function resolveDeptCode(deptName) {
        if (!deptName) return null;
        let dept = departments.find(d => d.dept_name === deptName);
        if (!dept) {
            const code = `DEPT_${Date.now()}`;
            if (isDbMode) {
                try {
                    const { data, error } = await supabase
                        .schema('iota_v2')
                        .from('iota_departments')
                        .insert({ dept_code: code, dept_name: deptName })
                        .select()
                        .single();
                    if (!error && data) {
                        setDepartments(prev => [...prev, data]);
                        return code;
                    }
                } catch (err) {
                    console.error("Failed to insert department on-the-fly:", err);
                }
            }
            return null;
        }
        return dept.dept_code;
    }

    // Stakeholder code resolver & on-the-fly register
    async function resolveStakeholderCode(stakeholderName) {
        if (!stakeholderName) return null;
        let stake = stakeholders.find(s => s.stakeholder_name === stakeholderName);
        if (!stake) {
            const code = `SH_AUTO_${Date.now()}`;
            if (isDbMode) {
                try {
                    // Register in iota_v2.iota_stakeholders
                    const { data, error } = await supabase
                        .schema('iota_v2')
                        .from('iota_stakeholders')
                        .insert({ stakeholder_code: code, stakeholder_name: stakeholderName, category: '기타' })
                        .select()
                        .single();
                    
                    // Register in public.iota_stakeholder_master
                    await supabase
                        .from('iota_stakeholder_master')
                        .insert({ company_name: stakeholderName, role_category: '기타' });
                        
                    if (!error && data) {
                        setStakeholders(prev => [...prev, data]);
                        return code;
                    }
                } catch (err) {
                    console.error("Failed to insert stakeholder on-the-fly:", err);
                }
            }
            return null;
        }
        return stake.stakeholder_code;
    }

    // Project code resolver & on-the-fly register
    async function resolveProjectCode(projectName) {
        if (!projectName) return 'IOTA_SEOUL';
        let searchCode = projectName.toUpperCase();
        if (projectName === '공통' || projectName === 'IOTA 공통') searchCode = 'IOTA_SEOUL';
        if (projectName === '427PFV' || projectName === '427 PFV') searchCode = 'PFV_427';
        if (projectName === '816PFV' || projectName === '816 PFV') searchCode = 'PFV_816';
        if (projectName === '421펀드' || projectName === '421FUND' || projectName === '421Fund') searchCode = 'FUND_421';
        if (projectName === '외부') searchCode = 'EXTERNAL';

        let proj = projects.find(p => p.project_code === searchCode);
        if (!proj) {
            const name = projectName.includes('PFV') ? `${projectName.replace('PFV', '')} PFV` : projectName;
            if (isDbMode) {
                try {
                    const { data, error } = await supabase
                        .schema('iota_v2')
                        .from('iota_projects')
                        .insert({ project_code: searchCode, project_name: name })
                        .select()
                        .single();
                    if (!error && data) {
                        setProjects(prev => [...prev, data]);
                        return searchCode;
                    }
                } catch (err) {
                    console.error("Failed to insert project on-the-fly:", err);
                }
            }
            return 'IOTA_SEOUL';
        }
        return proj.project_code;
    }

    // Subsector on-the-fly register
    async function resolveSubsector(subsectorName) {
        if (!subsectorName) return;
        const exists = subsectors.includes(subsectorName);
        if (!exists && isDbMode) {
            try {
                await supabase
                    .schema('iota_v2')
                    .from('iota_subsectors')
                    .insert({ subsector_name: subsectorName });
                setSubsectors(prev => [...prev, subsectorName]);
            } catch (err) {
                console.error("Failed to insert subsector on-the-fly:", err);
            }
        }
    }

    // Support option on-the-fly register
    async function resolveSupportNeeded(optionName) {
        if (!optionName) return;
        const exists = supportOptions.includes(optionName);
        if (!exists && isDbMode) {
            try {
                await supabase
                    .schema('iota_v2')
                    .from('iota_support_options')
                    .insert({ option_name: optionName });
                setSupportOptions(prev => [...prev, optionName]);
            } catch (err) {
                console.error("Failed to insert support option on-the-fly:", err);
            }
        }
    }

    const handleAddNewClick = () => {
        setEditingItem(null);
        setFormProject(projects[0]?.project_code || 'IOTA_SEOUL');
        setFormCategoryMain('');
        setFormSectorDetail('');
        setFormTaskName('');
        setFormTaskPurpose('');
        setFormDeliverables('');
        setFormGateStage('G0 현황정리');
        setFormPmoManager('사업2파트');
        setFormLeadDept(departments[0]?.dept_name || '사업2파트');
        setFormCoopDepts('');
        setFormAssignee('미정');
        setFormExternalParty('');
        setFormSupportNeeded('');
        setFormIsBlocker(false);
        setFormNeedsDecision(false);
        setFormDueDate('');
        setFormStatus('진행중');
        setFormImportanceLevel('중간');
        setFormTaskType('정규');
        setFormNextAction('');
        setFormPriorityScore(0);
        setFormMeetingGrade('B_회의점검');
        setFormAgendaReason('');
        setFormSortKey('');
        setFormNotes('');
        setIsModalOpen(true);
    };

    const handleEditClick = (item, openModal = true) => {
        const fallbackItem = FALLBACK_BOARD_TASKS.find(fallback => fallback.task_name === item.task_name) || {};
        
        setEditingItem(item);
        setFormProject(item.project_code || item.project || fallbackItem.project || 'IOTA_SEOUL');
        setFormCategoryMain(item.category_main || '');
        setFormSectorDetail(item.sector_detail || '');
        setFormTaskName(item.task_name || '');
        setFormTaskPurpose(item.task_purpose || fallbackItem.task_purpose || '');
        setFormDeliverables(item.deliverables || fallbackItem.deliverables || '');
        
        // Gate stage mapping
        const gateVal = String(item.gate_stage || fallbackItem.gate_stage || 'G0');
        setFormGateStage(gateVal.includes(' ') ? gateVal : gateMapToUi(gateVal));

        setFormPmoManager(item.pmo_manager || fallbackItem.pmo_manager || '사업2파트');
        setFormLeadDept(item.lead_dept?.dept_name || item.lead_dept || item.lead_dept_code || fallbackItem.lead_dept || '사업2파트');
        setFormCoopDepts(item.coop_dept_codes || item.coop_depts || fallbackItem.coop_depts || '');
        setFormAssignee(item.assignee || '미정');
        setFormExternalParty(item.external_party?.stakeholder_name || item.external_party || item.external_party_code || fallbackItem.external_party || '');
        setFormSupportNeeded(item.support_needed || '');
        
        // Boolean conversion fix (checking string 'Y' / 'N' as well)
        setFormIsBlocker(parseBool(item.is_blocker));
        setFormNeedsDecision(parseBool(item.needs_decision));

        // Date string fix (limiting to YYYY-MM-DD)
        const rawDate = String(item.due_date || '');
        setFormDueDate(rawDate ? rawDate.substring(0, 10) : '');

        setFormStatus(item.status || '진행중');
        setFormImportanceLevel(item.importance_level || '중간');
        setFormTaskType(item.task_type || '정규');
        setFormNextAction(item.next_action || fallbackItem.next_action || '');
        setFormPriorityScore(calculatePriorityScore(item));

        // Meeting grade mapping
        const gradeVal = String(item.meeting_grade || fallbackItem.meeting_grade || 'B');
        setFormMeetingGrade(gradeVal.includes('_') ? gradeVal : gradeMapToUi(gradeVal));

        setFormAgendaReason(item.agenda_reason || fallbackItem.agenda_reason || '');
        setFormSortKey(item.sort_key || fallbackItem.sort_key || '');
        setFormNotes(item.notes || fallbackItem.notes || '');
        if (openModal) {
            setIsModalOpen(true);
        }
    };

    const handleDeleteClick = (rowId) => {
        setDeleteConfirmId(rowId);
    };

    const confirmDelete = async (rowId) => {
        setTasks(prev => prev.filter(t => t.id !== rowId));

        if (isDbMode) {
            try {
                const { error } = await supabase
                    .schema('iota_v2')
                    .from('iota_pmo_tasks')
                    .delete()
                    .eq('id', rowId);

                if (error) throw error;
                invalidatePmoBoardTasksCache();
            } catch (err) {
                console.error("Failed to delete task from DB:", err);
                alert("DB 삭제에 실패했습니다.");
            }
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setIsSaveConfirmOpen(true);
    };

    const executeSave = async () => {
        setIsSaveConfirmOpen(false);

        // Resolve codes
        const resolvedProjectCode = await resolveProjectCode(formProject);
        const resolvedLeadDeptCode = await resolveDeptCode(formLeadDept);
        const resolvedExtPartyCode = await resolveStakeholderCode(formExternalParty);
        await resolveSubsector(formSectorDetail);
        await resolveSupportNeeded(formSupportNeeded);

        // Convert UI gate and grade values to DB codes
        const dbGateCode = gateMapToDb(formGateStage);
        const dbMeetingGrade = gradeMapToDb(formMeetingGrade);

        const updatedData = {
            project_code: resolvedProjectCode,
            category_main: formCategoryMain,
            sector_detail: formSectorDetail,
            task_name: formTaskName,
            task_purpose: formTaskPurpose,
            deliverables: formDeliverables,
            gate_stage: dbGateCode,
            pmo_manager: formPmoManager,
            lead_dept_code: resolvedLeadDeptCode,
            coop_dept_codes: (() => {
                const cleanedCoop = formCoopDepts.split(/[,;/]+/).map(c => normalizeDeptName(c.trim(), true)).filter(Boolean);
                return [...new Set(cleanedCoop)].join('; ');
            })(),
            assignee: formAssignee,
            external_party_code: resolvedExtPartyCode,
            is_blocker: formIsBlocker,
            needs_decision: formNeedsDecision,
            due_date: formDueDate || null,
            status: formStatus,
            priority_score: formPriorityScore,
            meeting_grade: dbMeetingGrade,
            next_action: formNextAction,
            importance_level: formImportanceLevel,
            task_type: formTaskType,
            support_needed: formSupportNeeded || null,
            notes: formNotes,
            sort_key: formSortKey,
            agenda_reason: formAgendaReason
        };

        const localMapping = {
            ...updatedData,
            project: projects.find(p => p.project_code === resolvedProjectCode)?.project_name || formProject,
            lead_dept: { dept_name: formLeadDept },
            external_party: { stakeholder_name: formExternalParty },
            gate_stage: formGateStage, // Preserve full string locally
            meeting_grade: formMeetingGrade,
            support_needed: formSupportNeeded,
            importance_level: formImportanceLevel,
            task_type: formTaskType,
            agenda_reason: formAgendaReason,
            sort_key: formSortKey,
            notes: formNotes
        };

        if (editingItem) {
            // EDITING
            setTasks(prev => prev.map(t => t.id === editingItem.id ? { ...t, ...localMapping } : t));
            const changeLogStartedAt = new Date().toISOString();

            if (isDbMode) {
                try {
                    const { error } = await supabase
                        .schema('iota_v2')
                        .from('iota_pmo_tasks')
                        .update(updatedData)
                        .eq('id', editingItem.id);

                    if (error) throw error;
                    invalidatePmoBoardTasksCache();
                } catch (err) {
                    console.error("Failed to update task in DB:", err);
                    alert("DB 저장에 실패했습니다: " + (err.message || err));
                }
            }

            // Always track changes and log to Supabase iota_seoul_logs
            try {
                const changes = [];
                const structuredChanges = [];
                const fallbackItem = FALLBACK_BOARD_TASKS.find(fb => fb.task_name === editingItem.task_name) || {};

                // 1. 상태
                const oldStatus = editingItem.status || fallbackItem.status || '진행중';
                const newStatus = formStatus || '진행중';
                if (oldStatus !== newStatus) {
                    changes.push(`상태가 "${oldStatus}"에서 "${newStatus}"으로 변경되었습니다.`);
                    structuredChanges.push({ field: '상태', from: oldStatus, to: newStatus });
                }

                // 2. 중요도 및 연계 지표 (상정 등급, 우선순위 점수)
                const oldImportance = editingItem.importance_level || fallbackItem.importance_level || '중간';
                const newImportance = formImportanceLevel || '중간';
                if (oldImportance !== newImportance) {
                    changes.push(`중요도가 "${oldImportance}"에서 "${newImportance}"(으)로 변경되었습니다.`);
                    structuredChanges.push({ field: '중요도', from: oldImportance, to: newImportance });
                }

                // 3. 병목
                const oldBlockerRaw = editingItem.is_blocker !== undefined ? editingItem.is_blocker : fallbackItem.is_blocker;
                let oldBlocker = '비활성화';
                if (oldBlockerRaw === '활성화' || oldBlockerRaw === '비활성화') {
                    oldBlocker = oldBlockerRaw;
                } else {
                    oldBlocker = parseBool(oldBlockerRaw) ? '활성화' : '비활성화';
                }
                const newBlocker = formIsBlocker ? '활성화' : '비활성화';
                if (oldBlocker !== newBlocker) {
                    changes.push(`병목(Blocker)이 "${oldBlocker}"에서 "${newBlocker}"으로 변경되었습니다.`);
                    structuredChanges.push({ field: '병목(Blocker)', from: oldBlocker, to: newBlocker });
                }

                // 4. 담당자
                const oldAssignee = editingItem.assignee || '미정';
                const newAssignee = formAssignee || '미정';
                if (oldAssignee !== newAssignee) {
                    changes.push(`담당자가 "${oldAssignee}"에서 "${newAssignee}"으로 변경되었습니다.`);
                    structuredChanges.push({ field: '담당자', from: oldAssignee, to: newAssignee });
                }

                // 5. 외부상대방
                const oldExt = editingItem.external_party?.stakeholder_name || editingItem.external_party || editingItem.external_party_code || fallbackItem.external_party || '';
                const newExt = formExternalParty || '';
                if (oldExt !== newExt) {
                    changes.push(`외부상대방이 "${oldExt || '미지정'}"에서 "${newExt || '미지정'}"으로 변경되었습니다.`);
                    structuredChanges.push({ field: '외부상대방', from: oldExt || '미지정', to: newExt || '미지정' });
                }

                // 6. 협조부서
                const oldCoopRaw = editingItem.coop_dept_codes || editingItem.coop_depts || fallbackItem.coop_depts || '';
                const oldCleanedCoop = oldCoopRaw.split(/[,;/]+/).map(c => normalizeDeptName(c.trim(), true)).filter(Boolean);
                const oldCoop = [...new Set(oldCleanedCoop)].join('; ');
                
                const cleanedCoop = formCoopDepts.split(/[,;/]+/).map(c => normalizeDeptName(c.trim(), true)).filter(Boolean);
                const newCoop = [...new Set(cleanedCoop)].join('; ');
                if (oldCoop !== newCoop) {
                    changes.push(`협조부서가 "${oldCoop || '없음'}"에서 "${newCoop || '없음'}"으로 변경되었습니다.`);
                    structuredChanges.push({ field: '협조부서', from: oldCoop || '없음', to: newCoop || '없음' });
                }

                // 7. 마감기한
                const rawOldDate = String(editingItem.due_date || fallbackItem.due_date || '');
                const oldDue = rawOldDate ? rawOldDate.substring(0, 10) : '';
                const newDue = formDueDate || '';
                if (oldDue !== newDue) {
                    changes.push(`마감기한이 "${oldDue || '미지정'}"에서 "${newDue || '미지정'}"으로 변경되었습니다.`);
                    structuredChanges.push({ field: '마감기한', from: oldDue || '미지정', to: newDue || '미지정' });
                }

                // 8. 의사결정 필요
                const oldDecisionRaw = editingItem.needs_decision !== undefined ? editingItem.needs_decision : fallbackItem.needs_decision;
                let oldDecision = '불필요';
                if (oldDecisionRaw === '필요' || oldDecisionRaw === '불필요') {
                    oldDecision = oldDecisionRaw;
                } else {
                    oldDecision = parseBool(oldDecisionRaw) ? '필요' : '불필요';
                }
                const newDecision = formNeedsDecision ? '필요' : '불필요';
                if (oldDecision !== newDecision) {
                    changes.push(`의사결정 필요 여부가 "${oldDecision}"에서 "${newDecision}"으로 변경되었습니다.`);
                    structuredChanges.push({ field: '의사결정 필요', from: oldDecision, to: newDecision });
                }

                if (changes.length > 0) {
                    await savePmoTaskChangeLog({
                        taskId: editingItem.id,
                        taskProject: resolvedProjectCode || 'IOTA_SEOUL',
                        workspaceLabel: '통합업무보드',
                        editorName: memberInfo?.staff_name || memberInfo?.name || '시스템',
                        changes,
                        structuredChanges,
                        updateStartedAt: changeLogStartedAt,
                    });

                    window.dispatchEvent(new CustomEvent('iota_log_updated', { detail: { taskId: editingItem.id } }));
                }
            } catch (err) {
                console.error("Failed to save change log in DB:", err);
                alert("이력 로그 저장에 실패했습니다: " + (err.message || err));
            }

            // Update drawer detail viewer if the currently viewed task was edited
            if (selectedTaskDetail && selectedTaskDetail.id === editingItem.id) {
                setSelectedTaskDetail({ id: editingItem.id, ...localMapping });
            }
            setIsDrawerEditing(false);
            window.dispatchEvent(new CustomEvent('iota_log_updated', { detail: { taskId: editingItem.id } }));
        } else {
            // ADDING
            const newId = `mock-${Date.now()}`;
            const newItem = { id: newId, ...localMapping };

            setTasks(prev => [...prev, newItem]);

            if (isDbMode) {
                try {
                    const { data, error } = await supabase
                        .schema('iota_v2')
                        .from('iota_pmo_tasks')
                        .insert([updatedData])
                        .select();

                    if (error) throw error;
                    invalidatePmoBoardTasksCache();

                    if (data && data[0]) {
                        window.history.replaceState(null, '', `${window.location.pathname}?taskId=${data[0].id}`);
                        // Notify members on task creation
                        const wsInfo = {
                            code: 'WS_PMO',
                            label: '통합업무보드',
                            orgNames: ['통합업무보드']
                        };
                        notifyMembersOnTaskCreation(
                            data[0].id,
                            data[0].task_name,
                            wsInfo,
                            memberInfo?.email || ''
                        );
                    }
                    fetchTasks(false, true);
                } catch (err) {
                    console.error("Failed to insert task in DB:", err);
                }
            }
        }

        setIsSaveSuccessOpen(true);
    };

    // Filter tasks based on table header selectbox choices
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const fallbackItem = FALLBACK_BOARD_TASKS.find(item => item.task_name === t.task_name) || {};
            
            // Project match
            const projObj = projects.find(p => p.project_code === t.project_code);
            const rawProj = projObj ? projObj.project_name : (t.project || fallbackItem.project || '공통');
            const projectVal = normalizeProjectName(rawProj);
            if (selectedProject !== '전체보기' && projectVal !== selectedProject) return false;

            // Category main match
            if (selectedCategoryMain !== '전체보기' && t.category_main !== selectedCategoryMain) return false;



            // Gate stage match
            const rawGate = t.gate_stage || fallbackItem.gate_stage || 'G0';
            const gateStageVal = rawGate.includes(' ') ? rawGate : gateMapToUi(rawGate);
            if (selectedGateStage !== '전체보기' && gateStageVal !== selectedGateStage) return false;

            // Lead dept match
            const rawLead = t.lead_dept?.dept_name || t.lead_dept || t.lead_dept_code || fallbackItem.lead_dept || '';
            const leadDeptName = normalizeDeptName(rawLead, false);
            if (selectedLeadDept !== '전체보기' && leadDeptName !== selectedLeadDept) return false;

            // Coop dept match
            const rawCoop = t.coop_dept_codes || t.coop_depts || fallbackItem.coop_depts || '';
            const coopDeptNames = normalizeCoopDepts(rawCoop);
            if (selectedCoopDept !== '전체보기') {
                const coops = coopDeptNames.split(',').map(c => c.trim());
                if (!coops.includes(selectedCoopDept)) return false;
            }

            // Blocker match
            const isBlockerVal = parseBool(t.is_blocker !== undefined ? t.is_blocker : fallbackItem.is_blocker);
            if (selectedIsBlocker !== '전체보기') {
                const blockerFilterVal = selectedIsBlocker === 'Y (예)';
                if (isBlockerVal !== blockerFilterVal) return false;
            }

            // Needs decision match
            const needsDecisionVal = parseBool(t.needs_decision !== undefined ? t.needs_decision : fallbackItem.needs_decision);
            if (selectedNeedsDecision !== '전체보기') {
                const decisionFilterVal = selectedNeedsDecision === 'Y (예)';
                if (needsDecisionVal !== decisionFilterVal) return false;
            }

            // Status match
            const statusVal = t.status || fallbackItem.status || '진행중';
            if (!matchesPmoStatusFilter({ status: statusVal }, selectedStatus)) return false;

            // Importance match
            const importanceLevel = t.importance_level || fallbackItem.importance_level || '중간';
            if (selectedImportanceLevel !== '전체보기' && importanceLevel !== selectedImportanceLevel) return false;

            // Meeting grade match
            const rawGrade = t.meeting_grade || fallbackItem.meeting_grade || 'B';
            const meetingGrade = rawGrade.includes('_') ? rawGrade : gradeMapToUi(rawGrade);
            if (selectedMeetingGrade !== '전체보기' && meetingGrade !== selectedMeetingGrade) return false;

            // Support needed match
            const supportNeededVal = t.support_needed || fallbackItem.support_needed || '';
            if (selectedSupportNeeded !== '전체보기') {
                if (selectedSupportNeeded === 'Y' && !supportNeededVal.trim()) return false;
            }

            // Search query match
            const query = normalizeSearchText(searchQuery).trim();
            if (query !== '') {
                const searchTargets = [
                    t.task_name,
                    t.assignee,
                    leadDeptName,
                    coopDeptNames,
                    t.external_party,
                    t.external_party_code,
                    fallbackItem.external_party,
                    t.task_purpose || fallbackItem.task_purpose,
                    t.deliverables || fallbackItem.deliverables,
                    t.next_action || fallbackItem.next_action,
                    t.support_needed || fallbackItem.support_needed
                ];

                if (!searchTargets.some(value => normalizeSearchText(value).includes(query))) return false;
            }

            return true;
        });
    }, [tasks, projects, selectedProject, selectedCategoryMain, selectedGateStage, selectedLeadDept, selectedCoopDept, selectedIsBlocker, selectedNeedsDecision, selectedStatus, selectedImportanceLevel, selectedMeetingGrade, searchQuery]);

    // Sort tasks by priority score (default: descending)
    const sortedAndFilteredTasks = useMemo(() => {
        const list = [...filteredTasks];
        list.sort((firstTask, secondTask) => (
            comparePmoTasksByPriority(firstTask, secondTask, prioritySortOrder)
        ));
        return list;
    }, [filteredTasks, prioritySortOrder]);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);

    // Listen to addNewTaskTrigger from parent header
    useEffect(() => {
        if (addNewTaskTrigger > 0) {
            isAuthorized ? handleAddNewClick() : setShowAuthInfoModal(false); // fall back to warning modal or trigger
            if (!isAuthorized) {
                setShowAuthInfoModal(true);
            }
        }
    }, [addNewTaskTrigger]);

    // Reset currentPage to 1 when filters, search, sorting or pageSize change
    useEffect(() => {
        setCurrentPage(1);
    }, [
        searchQuery,
        selectedProject,
        selectedCategoryMain,
        selectedGateStage,
        selectedLeadDept,
        selectedCoopDept,
        selectedIsBlocker,
        selectedNeedsDecision,
        selectedStatus,
        selectedImportanceLevel,
        selectedMeetingGrade,
        prioritySortOrder,
        pageSize
    ]);

    const totalTasksCount = sortedAndFilteredTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalTasksCount / pageSize));
    
    // Safety check for page boundary
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const paginatedTasks = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedAndFilteredTasks.slice(start, start + pageSize);
    }, [sortedAndFilteredTasks, currentPage, pageSize]);

    const prevTaskIdRef = useRef(null);

    // Auto-update currentPage to the page containing the selected task detail
    useEffect(() => {
        if (selectedTaskDetail) {
            const currentId = String(selectedTaskDetail.id);
            if (prevTaskIdRef.current !== currentId && sortedAndFilteredTasks.length > 0) {
                prevTaskIdRef.current = currentId;
                const taskIndex = sortedAndFilteredTasks.findIndex(t => String(t.id) === currentId);
                if (taskIndex !== -1) {
                    const targetPage = Math.floor(taskIndex / pageSize) + 1;
                    setCurrentPage(targetPage);
                }
            }
        } else {
            prevTaskIdRef.current = null;
        }
    }, [selectedTaskDetail, sortedAndFilteredTasks, pageSize]);

    return (
        <div>
            <style>{`
                body.drawer-open #global-notification-bell,
                body.drawer-open #global-support-button {
                    display: none !important;
                }
                body.drawer-open {
                    overflow: hidden !important;
                }
                body.drawer-open .hide-scrollbar {
                    overflow-y: hidden !important;
                }
            `}</style>
            <div className={embeddedDetailOnly ? '' : 'w-full flex flex-col mb-[36px] text-left'}>
            <div className={embeddedDetailOnly ? 'hidden' : 'contents'}>
            {loading ? (
                <div className="w-full h-[260px] flex items-center justify-center border border-[#333] rounded-[24px]">
                    <span className="text-[#86868B] text-[15px] animate-pulse">원장 정보를 불러오는 중입니다...</span>
                </div>
            ) : (
                <div className="-mr-[calc(50vw-50%)] border border-r-0 border-[#3c3c3c] bg-[#272726] rounded-l-[24px] mb-[10px] shadow-sm select-text overflow-hidden">
                    <div className="w-full overflow-x-auto pr-0 timeline-scrollbar pb-1">
                        <div className="flex items-start transition-all duration-300 ease-out w-fit">
                            <table className={`text-left table-fixed border-collapse bg-[#272726] transition-all duration-300 ease-out ${isAll ? 'w-[2592px] min-w-[2592px] max-w-[2592px]' : 'w-[1417px] min-w-[1417px] max-w-[1417px]'}`}>
                                <thead>
                                    <tr className="border-b border-[#3c3c3c] bg-transparent text-[#86868B] font-bold text-[13px] h-[46px]">
                                        <th className="pl-[10px] text-center w-[50px] min-w-[50px] max-w-[50px] sticky left-0 bg-[#272726] z-30 rounded-tl-[24px]">ID</th>
                                        
                                        {/* 프로젝트 */}
                                        <th className="text-center w-[58px] min-w-[58px] max-w-[58px] sticky left-[50px] bg-[#272726] z-30">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-1.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[74px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap truncate ${selectedProject === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedProject === '전체보기' ? '프로젝트' : selectedProject}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1 shrink-0">▼</span>
                                                <select
                                                    value={selectedProject}
                                                    onChange={(e) => setSelectedProject(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 프로젝트 ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    {uniqueProjectsFilter.map(proj => (
                                                        <option key={proj} value={proj} className="bg-[#222] text-white">{proj}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </th>

                                        {/* 업무분류 */}
                                        <th className="pl-4 w-[71px] min-w-[71px] max-w-[71px] sticky left-[108px] bg-[#272726] z-30">
                                            <div className="relative inline-flex items-center justify-start bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-1.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[74px] overflow-hidden">
                                                <span className={`font-bold text-[11px] whitespace-nowrap truncate ${selectedCategoryMain === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedCategoryMain === '전체보기' ? '업무분류' : selectedCategoryMain}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1 shrink-0">▼</span>
                                                <select
                                                    value={selectedCategoryMain}
                                                    onChange={(e) => setSelectedCategoryMain(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 업무분류 ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    {uniqueCategoryMainFilter.map(cat => (
                                                        <option key={cat} value={cat} className="bg-[#222] text-white">{cat}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </th>

                                        <th className={`sticky left-[179px] bg-[#272726] z-30 transition-all duration-300 ease-out ${isAll ? 'w-[90px] min-w-[90px] max-w-[90px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[90px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                세부섹터
                                            </div>
                                        </th>
                                        <th className={"pl-4 w-[220px] min-w-[220px] max-w-[220px] sticky bg-[#272726] z-30 shadow-[inset_-1px_0_0_0_#3c3c3c] transition-all duration-300 ease-out " + (isAll ? "left-[269px]" : "left-[179px]")}>업무명</th>
                                        <th className="w-[71px] min-w-[71px] max-w-[71px] text-center select-none cursor-pointer hover:text-white transition-colors" onClick={() => setPrioritySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                                            <div className="flex items-center justify-center gap-1">
                                                <span 
                                                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] text-[#86868B] hover:text-white font-bold cursor-pointer -translate-y-[1px]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsCriteriaModalOpen(true);
                                                    }}
                                                    title="우선순위 산정 기준 보기"
                                                >
                                                    ?
                                                </span>
                                                <span className="leading-tight text-[11px]">우선순위</span>
                                                <span className="text-[10px] text-[#2997ff] ml-0.5">{prioritySortOrder === 'desc' ? '▼' : '▲'}</span>
                                            </div>
                                        </th>
                                        <th className={`transition-all duration-300 ease-out ${isAll ? 'w-[220px] min-w-[220px] max-w-[220px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                업무목적 / PF·준공 영향
                                            </div>
                                        </th>
                                        <th className={`transition-all duration-300 ease-out ${isAll ? 'w-[220px] min-w-[220px] max-w-[220px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                필요 산출물
                                            </div>
                                        </th>



                                        {/* Gate */}
                                        <th className={`text-center transition-all duration-300 ease-out ${isAll ? 'w-[90px] min-w-[90px] max-w-[100px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden ${isAll ? 'w-[90px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-2.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[75px] overflow-hidden mx-auto">
                                                    <span className={"font-bold text-[11px] whitespace-nowrap truncate " + (selectedGateStage === "전체보기" ? "text-[#86868B]" : "text-[#2997ff]")}>
                                                        {selectedGateStage === '전체보기' ? 'GATE' : selectedGateStage}
                                                    </span>
                                                    <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1 shrink-0">▼</span>
                                                    <select
                                                        value={selectedGateStage}
                                                        onChange={(e) => setSelectedGateStage(e.target.value)}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    >
                                                        <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ GATE ]</option>
                                                        <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                        {uniqueGateStageFilter.map(gate => (
                                                            <option key={gate} value={gate} className="bg-[#222] text-white">{gate}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </th>

                                        {/* 회의상정등급 */}
                                        <th className="w-[70px] min-w-[70px] max-w-[70px] text-center">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-0.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[62px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap ${selectedMeetingGrade === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedMeetingGrade === '전체보기' ? '회의상정' : selectedMeetingGrade}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-0.5 shrink-0">▼</span>
                                                <select
                                                    value={selectedMeetingGrade}
                                                    onChange={(e) => setSelectedMeetingGrade(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    {uniqueMeetingGradeFilter.map(grade => (
                                                        <option key={grade} value={grade} className="bg-[#222] text-white">{grade}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </th>

                                        {/* 실행주관 */}
                                        <th className="w-[70px] min-w-[70px] max-w-[70px] text-center">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-1 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[62px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap ${selectedLeadDept === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedLeadDept === '전체보기' ? '실행주관' : selectedLeadDept}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-0.5 shrink-0">▼</span>
                                                <select
                                                    value={selectedLeadDept}
                                                    onChange={(e) => setSelectedLeadDept(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 실행주관 ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    {uniqueLeadDeptFilter.map(dept => (
                                                        <option key={dept} value={dept} className="bg-[#222] text-white">{dept}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </th>

                                        {/* 협업부서 */}
                                        <th className="w-[160px] min-w-[160px] max-w-[160px] text-center">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-2.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[145px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap truncate ${selectedCoopDept === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedCoopDept === '전체보기' ? '협업부서' : selectedCoopDept}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1 shrink-0">▼</span>
                                                <select
                                                    value={selectedCoopDept}
                                                    onChange={(e) => setSelectedCoopDept(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 협업부서 ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    {uniqueCoopDeptFilter.map(dept => (
                                                        <option key={dept} value={dept} className="bg-[#222] text-white">{dept}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </th>

                                        <th className={`text-center transition-all duration-300 ease-out ${isAll ? 'w-[70px] min-w-[70px] max-w-[70px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[70px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                담당자
                                            </div>
                                        </th>
                                        <th className="pl-4 w-[90px] min-w-[90px] max-w-[90px]">외부상대방</th>
                                        <th className={`text-center transition-all duration-300 ease-out ${isAll ? 'w-[80px] min-w-[80px] max-w-[80px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[80px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-0.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[76px] overflow-hidden mx-auto">
                                                    <span className={`font-bold text-[11px] whitespace-nowrap ${selectedSupportNeeded === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                        {selectedSupportNeeded === '전체보기' ? '지원필요' : '필요'}
                                                    </span>
                                                    <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-0.5 shrink-0">▼</span>
                                                    <select
                                                        value={selectedSupportNeeded}
                                                        onChange={(e) => setSelectedSupportNeeded(e.target.value)}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    >
                                                        <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                        <option value="Y" className="bg-[#222] text-white">필요</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </th>

                                        {/* Blocker */}
                                        <th className="w-[46px] min-w-[46px] max-w-[46px] text-center">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-0.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[42px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap ${selectedIsBlocker === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedIsBlocker === '전체보기' ? 'Block' : selectedIsBlocker}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-0.5 shrink-0">▼</span>
                                                <select
                                                    value={selectedIsBlocker}
                                                    onChange={(e) => setSelectedIsBlocker(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ Block ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    <option value="Y (예)" className="bg-[#222] text-white">Y (예)</option>
                                                    <option value="N (아니오)" className="bg-[#222] text-white">N (아니오)</option>
                                                </select>
                                            </div>
                                        </th>

                                        {/* 결정필요 */}
                                        <th className="w-[48px] min-w-[48px] max-w-[48px] text-center">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-0.5 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[50px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap ${selectedNeedsDecision === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedNeedsDecision === '전체보기' ? '결정필요' : selectedNeedsDecision}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-0.5 shrink-0">▼</span>
                                                <select
                                                    value={selectedNeedsDecision}
                                                    onChange={(e) => setSelectedNeedsDecision(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 결정필요 ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    <option value="Y (예)" className="bg-[#222] text-white">Y (예)</option>
                                                    <option value="N (아니오)" className="bg-[#222] text-white">N (아니오)</option>
                                                </select>
                                            </div>
                                        </th>

                                        <th className={`transition-all duration-300 ease-out ${isAll ? 'w-[200px] min-w-[200px] max-w-[200px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[200px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                다음 액션
                                            </div>
                                        </th>

                                        {/* 상태 */}
                                        <th className="w-[56px] min-w-[56px] max-w-[56px] text-center">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-1 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[52px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap truncate ${selectedStatus === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedStatus === '전체보기' ? '상태' : selectedStatus}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1 shrink-0">▼</span>
                                                <select
                                                    value={selectedStatus}
                                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 상태 ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    {uniqueStatusFilter.map(stat => (
                                                        <option key={stat} value={stat} className="bg-[#222] text-white">{stat}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </th>

                                        {/* 중요도 */}
                                        <th className="w-[56px] min-w-[56px] max-w-[56px] text-center">
                                            <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-1 h-[22px] py-0 align-middle transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] w-full max-w-[52px] overflow-hidden mx-auto">
                                                <span className={`font-bold text-[11px] whitespace-nowrap truncate ${selectedImportanceLevel === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                    {selectedImportanceLevel === '전체보기' ? '중요도' : selectedImportanceLevel}
                                                </span>
                                                <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1 shrink-0">▼</span>
                                                <select
                                                    value={selectedImportanceLevel}
                                                    onChange={(e) => setSelectedImportanceLevel(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                >
                                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 중요도 ]</option>
                                                    <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                    {uniqueImportanceFilter.map(imp => (
                                                        <option key={imp} value={imp} className="bg-[#222] text-white">{imp}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </th>

                                        <th className={`text-center transition-all duration-300 ease-out ${isAll ? 'w-[100px] min-w-[100px] max-w-[100px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                            <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[100px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                기한
                                            </div>
                                        </th>


                                        <th className="px-2 text-center w-[85px] min-w-[85px] max-w-[85px] border-l border-r border-[#3c3c3c]">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#3c3c3c] text-[13px] text-white">
                                    {sortedAndFilteredTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan={23} className="text-center py-20 text-[#86868B]">
                                                등록된 통합 업무 보드 정보가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedTasks.map((t, idx) => {
                                            const globalIndex = (currentPage - 1) * pageSize + idx;
                                            const fallbackItem = FALLBACK_BOARD_TASKS.find(item => item.task_name === t.task_name) || {};
                                            
                                            // Project mapping
                                            const projObj = projects.find(p => p.project_code === t.project_code);
                                            const rawProj = projObj ? projObj.project_name : (t.project || fallbackItem.project || '공통');
                                            const projectVal = normalizeProjectName(rawProj);

                                            // Data mapping
                                            const rawLeadVal = t.lead_dept?.dept_name || t.lead_dept || t.lead_dept_code || fallbackItem.lead_dept || '';
                                            const leadDeptName = normalizeDeptName(rawLeadVal, false);
                                            const rawCoopVal = t.coop_dept_codes || t.coop_depts || fallbackItem.coop_depts || '';
                                            const coopDeptNames = normalizeCoopDepts(rawCoopVal);
                                            const isSelected = selectedTaskDetail && selectedTaskDetail.id === t.id;
                                            const extPartyName = t.external_party?.stakeholder_name || t.external_party || t.external_party_code || fallbackItem.external_party || '';
                                            
                                            // Gate stage mapping
                                            const rawGate = t.gate_stage || fallbackItem.gate_stage || 'G0';
                                            const gateStageVal = rawGate.includes(' ') ? rawGate : gateMapToUi(rawGate);

                                            const isTaskNew = activeTaskIds.has(t.id) || (
                                                new Date(t.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && 
                                                (new Date() - new Date(t.created_at)) < 48 * 60 * 60 * 1000
                                            );

                                            const supportNeeded = t.support_needed || fallbackItem.support_needed || '';
                                            
                                            // Boolean normalization fixes
                                            const isBlockerVal = parseBool(t.is_blocker !== undefined ? t.is_blocker : fallbackItem.is_blocker);
                                            const needsDecisionVal = parseBool(t.needs_decision !== undefined ? t.needs_decision : fallbackItem.needs_decision);
                                            
                                            const dueDateVal = t.due_date || fallbackItem.due_date || '';
                                            const statusVal = t.status || fallbackItem.status || '진행중';
                                            const importanceLevel = t.importance_level || fallbackItem.importance_level || '중간';
                                            const taskType = t.task_type || fallbackItem.task_type || '정규';
                                            const nextActionVal = t.next_action || fallbackItem.next_action || '';
                                            const priorityScore = Number(t.priority_score) || 0;
                                            
                                            // Meeting grade mapping
                                            const rawGrade = t.meeting_grade || fallbackItem.meeting_grade || 'B';
                                            const meetingGrade = rawGrade.includes('_') ? rawGrade : gradeMapToUi(rawGrade);

                                            const agendaReason = t.agenda_reason || fallbackItem.agenda_reason || '';
                                            const sortKeyVal = t.sort_key || fallbackItem.sort_key || '';
                                            const notesVal = t.notes || fallbackItem.notes || '';
                                            const isLastTask = idx === paginatedTasks.length - 1;
                                            return (
                                                <tr 
                                                    key={t.id || `task-${idx}`} 
                                                    className={`group hover:bg-[#333]/50 transition-colors h-[50px] cursor-pointer ${isSelected ? 'bg-[#3c3c3a] hover:bg-[#3c3c3a]' : ''}`}
                                                    onClick={() => setSelectedTaskDetail(t)}
                                                >
                                                    
                                                    {/* 1. ID */}
                                                    <td className={`pl-[10px] text-center text-[#86868B] text-[11px] font-mono select-none w-[50px] min-w-[50px] max-w-[50px] truncate sticky left-0 transition-colors z-10 ${isSelected ? 'bg-[#3c3c3a] group-hover:bg-[#3c3c3a]' : 'bg-[#272726] group-hover:bg-[#2d2d2c]'} ${isLastTask ? 'rounded-bl-[24px]' : ''}`}>
                                                        {t.displayId || t.id}
                                                    </td>
                                                    
                                                    {/* 2. 프로젝트 */}
                                                    <td className={`text-center font-bold text-[#E5E5E5] w-[58px] min-w-[58px] max-w-[58px] truncate sticky left-[50px] transition-colors z-10 ${isSelected ? 'bg-[#3c3c3a] group-hover:bg-[#3c3c3a]' : 'bg-[#272726] group-hover:bg-[#2d2d2c]'}`}>
                                                         <span className={`px-1.5 h-[22px] py-0 align-middle rounded-[6px] text-[11px] font-bold border inline-flex items-center justify-center max-w-full truncate align-middle ${
                                                             projectVal === 'IOTA 공통' ? 'bg-[#323233] text-[#F5F5F7] border-[#424243]' :
                                                             projectVal === '427 PFV' ? 'bg-[#3A3A3C] text-[#FFFFFF] border-[#48484A]' :
                                                             projectVal === '816 PFV' ? 'bg-[#2C2C2E] text-[#E5E5EA] border-[#3A3A3C]' :
                                                             projectVal === '421Fund' ? 'bg-[#242426] text-[#D1D1D6] border-[#323234]' :
                                                             'bg-[#1C1C1E] text-[#AEAEB2] border-[#2C2C2E]'
                                                         }`}>
                                                             {projectVal}
                                                         </span>
                                                    </td>
                                                    
                                                    {/* 3. 대분류 */}
                                                    <td className={`pl-4 font-bold text-[#E5E5E5] w-[71px] min-w-[71px] max-w-[71px] truncate sticky left-[108px] transition-colors z-10 ${isSelected ? 'bg-[#3c3c3a] group-hover:bg-[#3c3c3a]' : 'bg-[#272726] group-hover:bg-[#2d2d2c]'}`}>
                                                        {t.category_main}
                                                    </td>
                                                    
                                                    {/* 4. 세부섹터 */}
                                                    <td className={`text-[#A1A1AA] truncate sticky left-[179px] z-10 transition-all duration-300 ease-out ${isAll ? 'w-[90px] min-w-[90px] max-w-[90px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'} ${isSelected ? 'bg-[#3c3c3a] group-hover:bg-[#3c3c3a]' : 'bg-[#272726] group-hover:bg-[#2d2d2c]'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[90px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {t.sector_detail}
                                                        </div>
                                                    </td>
                                                    
                                                    {/* 5. 업무명 */}
                                                    <td className={`pl-4 font-bold text-[#bdbba7] w-[220px] min-w-[220px] max-w-[220px] sticky z-10 shadow-[inset_-1px_0_0_0_#3c3c3c] transition-all duration-300 ease-out ${isAll ? 'left-[269px]' : 'left-[179px]'} ${isSelected ? 'bg-[#3c3c3a] group-hover:bg-[#3c3c3a]' : 'bg-[#272726] group-hover:bg-[#2d2d2c]'}`}>
                                                        <div className="flex items-center gap-[6px] w-full min-w-0">
                                                            <span className="truncate min-w-0">{t.task_name}</span>
                                                            {isTaskNew && (
                                                                <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[1px]">
                                                                    N
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* 우선순위점수 */}
                                                    <td className={`pl-[6px] text-center font-mono w-[71px] min-w-[71px] max-w-[71px] font-bold ${priorityScore >= 60 ? 'text-[#FF453A]' : priorityScore >= 40 ? 'text-[#bdbba7]' : 'text-[#86868B]'}`}>{priorityScore}</td>

                                                    {/* 6. 업무목적 / PF·준공 영향 */}
                                                    <td className={`text-[#A1A1AA] truncate transition-all duration-300 ease-out ${isAll ? 'w-[220px] min-w-[220px] max-w-[220px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {t.task_purpose || fallbackItem.task_purpose || '-'}
                                                        </div>
                                                    </td>

                                                    {/* 7. 필요 산출물 */}
                                                    <td className={`text-[#A1A1AA] truncate transition-all duration-300 ease-out ${isAll ? 'w-[220px] min-w-[220px] max-w-[220px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {t.deliverables || fallbackItem.deliverables || '-'}
                                                        </div>
                                                    </td>



                                                    {/* 9. Gate */}
                                                    <td className={`text-center text-[#A1A1AA] truncate transition-all duration-300 ease-out ${isAll ? 'w-[90px] min-w-[90px] max-w-[100px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[90px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {gateStageVal}
                                                        </div>
                                                    </td>

                                                    

                                                    {/* 24. 회의상정등급 */}
                                                    <td className="text-center w-[70px] min-w-[70px] max-w-[70px] truncate">
                                                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                                            meetingGrade.startsWith('A') 
                                                                ? 'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25' 
                                                                : (meetingGrade === 'B_회의점검' || meetingGrade.startsWith('B'))
                                                                    ? 'bg-[#bdbba7]/15 text-[#bdbba7] border border-[#bdbba7]/25'
                                                                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                        }`}>
                                                            {meetingGrade}
                                                        </span>
                                                    </td>

                                                    {/* 11. 실행주관 */}
                                                    <td className="text-center w-[70px] min-w-[70px] max-w-[70px] overflow-hidden">
                                                        {leadDeptName ? (
                                                            <span className="inline-flex items-center justify-center px-2 h-[22px] py-0 align-middle bg-[#27272a] text-[#d4d4d8] border border-[#3f3f46] rounded-[6px] text-[11px] font-medium max-w-full truncate">
                                                                {leadDeptName}
                                                            </span>
                                                        ) : '-'}
                                                    </td>

                                                    {/* 12. 협업부서 */}
                                                    <td className="pl-4 text-left w-[160px] min-w-[160px] max-w-[160px] overflow-hidden">
                                                        {coopDeptNames ? (
                                                            <div className="flex flex-nowrap gap-1 justify-start items-center overflow-hidden w-full">
                                                                {(() => {
                                                                    const depts = coopDeptNames.split(',').map(c => c.trim()).filter(Boolean);
                                                                    const displayDepts = depts.length > 3 ? depts.slice(0, 2) : depts;
                                                                    const hasMore = depts.length > 3;
                                                                    return (
                                                                        <>
                                                                            {displayDepts.map((c, i) => (
                                                                                <span key={i} className="inline-flex items-center justify-center px-2 h-[22px] py-0 align-middle bg-[#27272a] text-[#d4d4d8] border border-[#3f3f46] rounded-[6px] text-[11px] font-medium whitespace-nowrap shrink-0 max-w-[100px] truncate">
                                                                                    {c}
                                                                                </span>
                                                                            ))}
                                                                            {hasMore && (
                                                                                <span className="inline-flex items-center justify-center px-1.5 h-[22px] py-0 align-middle bg-[#27272a] text-[#86868B] border border-[#3f3f46]/50 rounded-[6px] text-[11px] font-bold shrink-0">
                                                                                    ...
                                                                                </span>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : '-'}
                                                    </td>

                                                    {/* 13. 담당자 */}
                                                    <td className={`text-center text-[#A1A1AA] truncate transition-all duration-300 ease-out ${isAll ? 'w-[70px] min-w-[70px] max-w-[70px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[70px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {t.assignee || '미정'}
                                                        </div>
                                                    </td>

                                                    {/* 14. 외부상대방 */}
                                                    <td className="pl-4 text-[#A1A1AA] w-[90px] min-w-[90px] max-w-[90px] truncate">{extPartyName || '-'}</td>

                                                    {/* 15. 지원필요 */}
                                                    <td className={`text-center text-[#86868B] truncate transition-all duration-300 ease-out ${isAll ? 'w-[80px] min-w-[80px] max-w-[80px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[80px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {supportNeeded || '-'}
                                                        </div>
                                                    </td>

                                                    {/* 16. Blocker */}
                                                    <td className="text-center w-[46px] min-w-[46px] max-w-[46px]">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            isBlockerVal ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-gray-500'
                                                        }`}>
                                                            {isBlockerVal ? 'Y' : 'N'}
                                                        </span>
                                                    </td>

                                                    {/* 17. 결정필요 */}
                                                    <td className="text-center w-[48px] min-w-[48px] max-w-[48px]">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            needsDecisionVal ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-gray-500'
                                                        }`}>
                                                            {needsDecisionVal ? 'Y' : 'N'}
                                                        </span>
                                                    </td>

                                                    {/* 18. 다음 액션 */}
                                                    <td className={`text-[#A1A1AA] truncate transition-all duration-300 ease-out ${isAll ? 'w-[200px] min-w-[200px] max-w-[200px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[200px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {nextActionVal || '-'}
                                                        </div>
                                                    </td>

                                                    {/* 19. 상태 */}
                                                    <td className="text-center w-[56px] min-w-[56px] max-w-[56px]">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            statusVal === '지연' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                        }`}>
                                                            {statusVal}
                                                        </span>
                                                    </td>

                                                    {/* 20. 중요도 */}
                                                    <td className="text-center w-[56px] min-w-[56px] max-w-[56px] truncate">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            importanceLevel === 'PF필수' 
                                                                ? 'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25' 
                                                                : importanceLevel === '준공필수'
                                                                    ? 'bg-[#bdbba7]/15 text-[#bdbba7] border border-[#bdbba7]/25'
                                                                    : 'bg-[#86868B]/15 text-[#86868B] border border-[#86868B]/25'
                                                        }`}>
                                                            {importanceLevel}
                                                        </span>
                                                    </td>


                                                    {/* 22. 기한 */}
                                                    <td className={`text-center text-[#A1A1AA] font-mono truncate transition-all duration-300 ease-out ${isAll ? 'w-[100px] min-w-[100px] max-w-[100px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}>
                                                        <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isAll ? 'w-[100px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                                                            {dueDateVal || '-'}
                                                        </div>
                                                    </td>

                                                    




                                                    
                                                    {/* 관리 */}
                                                    <td className="px-2 text-center w-[85px] min-w-[85px] max-w-[85px] border-l border-r border-[#3c3c3c]">
                                                        {isAuthorized ? (
                                                            <div className="flex items-center justify-center gap-3">
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditClick(t);
                                                                    }}
                                                                    className="text-blue-400 hover:text-blue-300 font-bold text-[11px] cursor-pointer"
                                                                >
                                                                    수정
                                                                </button>
                                                                <span className="text-[#555] select-none">|</span>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteClick(t.id);
                                                                    }}
                                                                    className="text-red-400 hover:text-red-300 font-bold text-[11px] cursor-pointer"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-500 font-medium text-[11px] select-none">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    
                                </tbody>
                                {false && (
                                    <tfoot className="border-none bg-[#272726]">
                                        <tr className="bg-[#272726] h-[46px] select-none ">
                                            {/* 1. ID */}
                                            <td className="pl-[10px] text-center w-[50px] min-w-[50px] max-w-[50px] sticky left-0 transition-colors z-30 bg-[#272726] relative">
                                                {/* Top border line extending to the right edge of browser screen with solid color */}
                                                <div className="absolute top-0 left-0 border-t border-[#3c3c3c] pointer-events-none z-30" style={{ width: 'calc(100vw - 260px)' }} />
                                            </td>
                                            
                                            {/* 2. 프로젝트 */}
                                            <td className="text-center w-[58px] min-w-[58px] max-w-[58px] sticky left-[50px] transition-colors z-10 bg-[#272726]"></td>
                                            
                                            {/* 3. 대분류 */}
                                            <td className="pl-4 w-[71px] min-w-[71px] max-w-[71px] sticky left-[108px] transition-colors z-10 bg-[#272726]"></td>
                                            
                                            {/* 4. 세부섹터 */}
                                            <td className={`sticky left-[179px] z-10 transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[90px] min-w-[90px] max-w-[90px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 5. 업무명 (Centered Pagination) */}
                                            <td className={`pl-4 font-bold text-white sticky relative transition-all duration-300 ease-out bg-[#272726] z-10 w-[220px] min-w-[220px] max-w-[220px] ${isAll ? 'left-[269px]' : 'left-[179px]'}`}>
                                                {/* Centered Pagination Wrapper */}
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible z-20">
                                                    <div className="flex items-center justify-center select-none pointer-events-auto" style={{ left: isAll ? '-351px' : '-261px', width: 'calc(100vw - 200px)', position: 'absolute', top: 0, bottom: 0 }}>
                                                        <div className="flex items-center gap-1 translate-y-[2px]">
                                                            {/* Prev Button */}
                                                            <button
                                                                type="button"
                                                                disabled={currentPage === 1}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCurrentPage(prev => Math.max(prev - 1, 1));
                                                                }}
                                                                className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-[#3c3c3c] transition-all text-[#86868B] hover:text-white cursor-pointer hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                                                </svg>
                                                            </button>
                                                            {/* Page Numbers */}
                                                            {Array.from({ length: totalPages }).map((_, pIdx) => {
                                                                const pageNum = pIdx + 1;
                                                                const isCurrent = pageNum === currentPage;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={pageNum}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setCurrentPage(pageNum);
                                                                        }}
                                                                        className={`w-7 h-7 rounded-[6px] text-[12px] font-bold transition-all cursor-pointer ${
                                                                            isCurrent
                                                                                ? 'bg-[#bdbba7] text-black shadow-sm'
                                                                                : 'bg-transparent text-[#86868B] hover:text-white hover:bg-white/5 border border-transparent hover:border-[#3c3c3c]'
                                                                        }`}
                                                                    >
                                                                        {pageNum}
                                                                    </button>
                                                                );
                                                            })}
                                                            {/* Next Button */}
                                                            <button
                                                                type="button"
                                                                disabled={currentPage === totalPages}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                                                                }}
                                                                className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-[#3c3c3c] transition-all text-[#86868B] hover:text-white cursor-pointer hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            {/* 6. 우선순위점수 */}
                                            <td className="w-[71px] min-w-[71px] max-w-[71px] bg-[#272726]"></td>
                                            
                                            {/* 7. 업무목적 */}
                                            <td className={`transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[220px] min-w-[220px] max-w-[220px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 8. 필요 산출물 */}
                                            <td className={`transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[220px] min-w-[220px] max-w-[220px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 9. 최종 목표축 */}
                                            <td className={`text-center transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[91px] min-w-[91px] max-w-[91px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 10. Gate */}
                                            <td className={`text-center transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[90px] min-w-[90px] max-w-[100px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 11. 회의상정등급 */}
                                            <td className="w-[70px] min-w-[70px] max-w-[70px] bg-[#272726]"></td>
                                            
                                            {/* 12. 실행주관 */}
                                            <td className="w-[70px] min-w-[70px] max-w-[70px] bg-[#272726]"></td>
                                            
                                            {/* 13. 협업부서 */}
                                            <td className="w-[160px] min-w-[160px] max-w-[160px] bg-[#272726]"></td>
                                            
                                            {/* 14. 담당자 */}
                                            <td className={`transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[70px] min-w-[70px] max-w-[70px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 15. 외부상대방 */}
                                            <td className="w-[90px] min-w-[90px] max-w-[90px] bg-[#272726]"></td>
                                            
                                            {/* 16. 지원필요 */}
                                            <td className={`transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[80px] min-w-[80px] max-w-[80px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 17. Blocker */}
                                            <td className="w-[46px] min-w-[46px] max-w-[46px] bg-[#272726]"></td>
                                            
                                            {/* 18. 결정필요 */}
                                            <td className="w-[48px] min-w-[48px] max-w-[48px] bg-[#272726]"></td>
                                            
                                            {/* 19. 다음 액션 */}
                                            <td className={`transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[200px] min-w-[200px] max-w-[200px] pl-4 opacity-100' : 'hidden w-0 min-w-0 max-w-0 pl-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 20. 상태 */}
                                            <td className="w-[56px] min-w-[56px] max-w-[56px] bg-[#272726]"></td>
                                            
                                            {/* 21. 중요도 */}
                                            <td className="w-[56px] min-w-[56px] max-w-[56px] bg-[#272726]"></td>
                                            
                                            {/* 22. 기한 */}
                                            <td className={`text-center transition-all duration-300 ease-out bg-[#272726] ${isAll ? 'w-[100px] min-w-[100px] max-w-[100px] opacity-100' : 'hidden w-0 min-w-0 max-w-0 opacity-0 overflow-hidden'}`}></td>
                                            
                                            {/* 23. 관리 */}
                                            <td className="w-[85px] min-w-[85px] max-w-[85px] bg-[#272726]"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                            
                            {/* Watermark Logo */}
                            <div className="w-[800px] shrink-0 self-stretch flex items-center justify-start pl-20 pr-8 select-none pointer-events-none box-border">
                                <div className="text-white opacity-[0.04] font-bold leading-[0.9] tracking-tighter w-full whitespace-nowrap" style={{ fontSize: 'clamp(45px, 8.5vw, 135px)' }}>
                                    IOTA Seoul<br />Cross Functional<br />Team
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Centered Pagination Row outside scrollable wrapper */}
                    {totalPages > 1 && (
                        <div 
                            className="w-full h-[46px] border-t border-[#3c3c3c]/50 flex items-center justify-center bg-[#272726] select-none z-10 rounded-bl-[24px]"
                            style={{ paddingRight: 'calc(50vw - 50%)' }}
                        >
                            <div className="flex items-center gap-1">
                                {/* Prev Button */}
                                <button
                                    type="button"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-[#3c3c3c] transition-all text-[#86868B] hover:text-white cursor-pointer hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                
                                {/* Page Numbers */}
                                {Array.from({ length: totalPages }).map((_, pIdx) => {
                                    const pageNum = pIdx + 1;
                                    const isCurrent = pageNum === currentPage;
                                    return (
                                        <button
                                            type="button"
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-7 h-7 rounded-[6px] text-[12px] font-bold transition-all cursor-pointer ${
                                                isCurrent
                                                    ? 'bg-[#bdbba7] text-black shadow-sm'
                                                    : 'bg-transparent text-[#86868B] hover:text-white hover:bg-white/5 border border-transparent hover:border-[#3c3c3c]'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                
                                {/* Next Button */}
                                <button
                                    type="button"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-[#3c3c3c] transition-all text-[#86868B] hover:text-white cursor-pointer hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            )}
            </div>

            {/* R&R 관리 권한 안내 모달 */}
            {showAuthInfoModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200000] p-4">
                    <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-[16px] w-full max-w-[400px] shadow-2xl p-6 relative">
                        <h3 className="text-[17px] font-bold text-white mb-5 text-left">
                            R&R 및 필요산출물 관리 권한
                        </h3>
                        
                        <div className="bg-[#2C2C2E]/40 border border-[#2C2C2E] rounded-[8px] p-4 space-y-3 mb-6 text-left">
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#2997ff]/10 text-[#2997ff] border border-[#2997ff]/20 shrink-0">조직</span>
                                <div className="text-[13px] text-[#E5E5E5] font-medium space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-[3px] h-[3px] rounded-full bg-[#86868B] shrink-0" />
                                        <span>사업2파트</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-[3px] h-[3px] rounded-full bg-[#86868B] shrink-0" />
                                        <span>시스템 관리자(기획추진)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[1px] bg-[#2C2C2E]" />
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#6366F1]/10 text-[#A5B4FC] border border-[#6366F1]/20 shrink-0">역할</span>
                                <div className="text-[13px] text-[#E5E5E5] font-medium space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-[3px] h-[3px] rounded-full bg-[#86868B] shrink-0" />
                                        <span>PO (Project Owner)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-[3px] h-[3px] rounded-full bg-[#86868B] shrink-0" />
                                        <span>프로젝트 디렉터 및 PM</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button 
                                onClick={() => setShowAuthInfoModal(false)}
                                className="px-5 py-2 rounded-[8px] bg-[#2997ff] hover:bg-[#147ce5] text-[13px] font-bold text-white transition-colors cursor-pointer w-full"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200000] flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
                    <div className="bg-[#272726] border border-[#3c3c3c] rounded-[20px] p-6 w-full max-w-[400px] shadow-2xl transform transition-all scale-100 flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-[17px] font-bold text-white mb-2">업무 삭제 확인</h3>
                        <p className="text-[13px] text-[#86868B] mb-6 leading-relaxed">
                            정말로 이 업무 항목을 삭제하시겠습니까?<br />
                            삭제된 데이터는 원장에서 즉시 제거되며 복구할 수 없습니다.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 rounded-[8px] bg-white/5 hover:bg-white/10 text-white border border-[#3c3c3c] text-[13px] font-bold cursor-pointer transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    confirmDelete(deleteConfirmId);
                                    setDeleteConfirmId(null);
                                }}
                                className="px-4 py-2 rounded-[8px] bg-[#FF453A] hover:bg-[#FF453A]/90 text-white text-[13px] font-bold cursor-pointer transition-all shadow-md shadow-[#FF453A]/10"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSaveConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200001] flex items-center justify-center p-4" onClick={() => setIsSaveConfirmOpen(false)}>
                    <div className="bg-[#272726] border border-[#3c3c3c] rounded-[20px] p-6 w-full max-w-[400px] shadow-2xl transform transition-all scale-100 flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-[17px] font-bold text-white mb-2">업무 저장 확인</h3>
                        <p className="text-[13px] text-[#86868B] mb-6 leading-relaxed">
                            입력한 내용으로 업무 정보를 저장하시겠습니까?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setIsSaveConfirmOpen(false)}
                                className="px-4 py-2 rounded-[8px] bg-white/5 hover:bg-white/10 text-white border border-[#3c3c3c] text-[13px] font-bold cursor-pointer transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={executeSave}
                                className="px-4 py-2 rounded-[8px] bg-[#bdbba7] hover:bg-[#bdbba7]/90 text-black text-[13px] font-bold cursor-pointer transition-all shadow-md shadow-[#bdbba7]/10"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSaveSuccessOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200001] flex items-center justify-center p-4" onClick={() => {
                    setIsSaveSuccessOpen(false);
                    setIsModalOpen(false);
                }}>
                    <div className="bg-[#272726] border border-[#3c3c3c] rounded-[20px] p-6 w-full max-w-[400px] shadow-2xl transform transition-all scale-100 flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-[17px] font-bold text-white mb-2">저장 완료</h3>
                        <p className="text-[13px] text-[#86868B] mb-6 leading-relaxed">
                            업무 정보가 성공적으로 저장되었습니다.
                        </p>
                        <div className="flex justify-end">
                            <button
                                onClick={() => {
                                    setIsSaveSuccessOpen(false);
                                    setIsModalOpen(false);
                                }}
                                className="px-5 py-2 rounded-[8px] bg-[#bdbba7] hover:bg-[#bdbba7]/90 text-black text-[13px] font-bold cursor-pointer transition-all shadow-md shadow-[#bdbba7]/10 w-full text-center"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCriteriaModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200000] p-4" onClick={() => setIsCriteriaModalOpen(false)}>
                    <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-[16px] w-full max-w-[650px] shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setIsCriteriaModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-[18px] cursor-pointer"
                        >
                            ✕
                        </button>
                        <h3 className="text-[18px] font-bold text-white mb-6 text-center flex items-center justify-center gap-2">
                            <span className="text-[#2997ff]">③</span> 우선순위 산정 기준
                        </h3>
                        <div className="overflow-hidden border border-[#2c2c2b] rounded-[8px] bg-[#121214]">
                            <table className="w-full text-left text-[12px] border-collapse">
                                <thead>
                                    <tr className="bg-[#1C1C1E] border-b border-[#2c2c2b] text-[#86868B] font-bold h-10 whitespace-nowrap">
                                        <th className="px-4 py-2">우선순위 산정항목</th>
                                        <th className="px-4 py-2 text-center w-[95px]">점수</th>
                                        <th className="px-4 py-2">의미</th>
                                        <th className="px-4 py-2 text-center w-[110px]">입력 위치</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2c2c2b] text-gray-300">
                                    <tr className="hover:bg-white/[0.02] h-10">
                                        <td className="px-4 py-2 font-bold text-white">준공필수</td>
                                        <td className="px-4 py-2 text-center font-mono text-[#bdbba7] font-bold">30</td>
                                        <td className="px-4 py-2 text-gray-400">준공/사용승인/담보대출과 직결</td>
                                        <td className="px-4 py-2 text-center text-gray-400">중요도</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] h-10">
                                        <td className="px-4 py-2 font-bold text-white">PF필수</td>
                                        <td className="px-4 py-2 text-center font-mono text-[#bdbba7] font-bold">25</td>
                                        <td className="px-4 py-2 text-gray-400">PF 실행 전 선결조건</td>
                                        <td className="px-4 py-2 text-center text-gray-400">중요도</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] h-10">
                                        <td className="px-4 py-2 font-bold text-white">Blocker</td>
                                        <td className="px-4 py-2 text-center font-mono text-[#bdbba7] font-bold">20</td>
                                        <td className="px-4 py-2 text-gray-400">막혀서 일정/판단 지연</td>
                                        <td className="px-4 py-2 text-center text-gray-400">Blocker</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] h-10">
                                        <td className="px-4 py-2 font-bold text-white">결정필요</td>
                                        <td className="px-4 py-2 text-center font-mono text-[#bdbba7] font-bold">15</td>
                                        <td className="px-4 py-2 text-gray-400">대표/본부장/파트장 판단 필요</td>
                                        <td className="px-4 py-2 text-center text-gray-400">결정필요</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] h-10">
                                        <td className="px-4 py-2 font-bold text-white">지원필요</td>
                                        <td className="px-4 py-2 text-center font-mono text-[#bdbba7] font-bold">15</td>
                                        <td className="px-4 py-2 text-gray-400">협력부서 산출물 또는 외부 회신 필요</td>
                                        <td className="px-4 py-2 text-center text-gray-400">지원필요</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] h-10">
                                        <td className="px-4 py-2 font-bold text-white">기한임박</td>
                                        <td className="px-4 py-2 text-center font-mono text-[#bdbba7] font-bold">10</td>
                                        <td className="px-4 py-2 text-gray-400">7일 이내 기한 도래</td>
                                        <td className="px-4 py-2 text-center text-gray-400">기한</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02] h-10">
                                        <td className="px-4 py-2 font-bold text-white">지연</td>
                                        <td className="px-4 py-2 text-center font-mono text-[#bdbba7] font-bold">15</td>
                                        <td className="px-4 py-2 text-gray-400">상태가 지연</td>
                                        <td className="px-4 py-2 text-center text-gray-400">상태</td>
                                    </tr>
                                    <tr className="bg-white/[0.01] h-10 font-bold border-t border-[#2c2c2b] whitespace-nowrap">
                                        <td className="px-4 py-2 text-[#ff453a]">A_즉시상정</td>
                                        <td className="px-4 py-2 text-center text-[#ff453a]">60점 이상</td>
                                        <td className="px-4 py-2 text-gray-400 font-medium text-[11px] whitespace-normal leading-normal">리스크가 매우 높거나 즉각적인 의사결정 및 Blocker 해소가 필요한 최우선 안건</td>
                                        <td className="px-4 py-2 text-center text-gray-500 font-normal">우선순위점수</td>
                                    </tr>
                                    <tr className="bg-white/[0.01] h-10 font-bold border-t border-[#2c2c2b]/30 whitespace-nowrap">
                                        <td className="px-4 py-2 text-[#ff9f0a]">B_회의점검</td>
                                        <td className="px-4 py-2 text-center text-[#ff9f0a]">40점 이상</td>
                                        <td className="px-4 py-2 text-gray-400 font-medium text-[11px] whitespace-normal leading-normal">기한이 임박했거나 타 부서 지원이 필요한 주요 안건으로, 회의 시 상황 점검 필요</td>
                                        <td className="px-4 py-2 text-center text-gray-500 font-normal">우선순위점수</td>
                                    </tr>
                                    <tr className="bg-white/[0.01] h-10 font-bold border-t border-[#2c2c2b]/30 whitespace-nowrap">
                                        <td className="px-4 py-2 text-[#30d158]">C_주간관리</td>
                                        <td className="px-4 py-2 text-center text-[#30d158]">25점 이상</td>
                                        <td className="px-4 py-2 text-gray-400 font-medium text-[11px] whitespace-normal leading-normal">일반적인 진행 단계에 있으며, 특이사항 발생 시에만 리딩하는 안건</td>
                                        <td className="px-4 py-2 text-center text-gray-500 font-normal">우선순위점수</td>
                                    </tr>
                                    <tr className="bg-white/[0.01] h-10 font-bold border-t border-[#2c2c2b]/30 whitespace-nowrap">
                                        <td className="px-4 py-2 text-[#8e8e93]">D_대기</td>
                                        <td className="px-4 py-2 text-center text-[#8e8e93]">25점 미만</td>
                                        <td className="px-4 py-2 text-gray-400 font-medium text-[11px] whitespace-normal leading-normal">시급성이 상대적으로 낮거나 마감 기한에 여유가 있는 안건</td>
                                        <td className="px-4 py-2 text-center text-gray-500 font-normal">우선순위점수</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Add / Edit Task Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200000] p-4">
                    <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-[16px] w-full max-w-[850px] shadow-2xl p-6 relative">
                        <h3 className="text-[18px] font-bold text-white mb-5 text-left border-b border-[#2C2C2E] pb-3">
                            {editingItem ? '통합 업무 수정' : '통합 업무 추가'}
                        </h3>
                        
                        <form onSubmit={handleFormSubmit} className="space-y-5">
                            <div className="max-h-[68vh] overflow-y-auto pr-2 space-y-5 text-left timeline-scrollbar">
                                {/* Top Header Row */}
                                <div className="flex items-center gap-4 flex-wrap text-[12px] font-bold bg-white/5 p-3 rounded-[12px] border border-[#3c3c3c]/50">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[#86868B]">업무 ID:</span>
                                        <span className="font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300">
                                            {editingItem ? (getPmoTaskDisplayId(editingItem, tasks) || '확인 중') : '신규'}
                                        </span>
                                    </div>
                                    
                                    {/* Project Select */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[#86868B]">프로젝트:</span>
                                        <select 
                                            value={formProject} 
                                            onChange={e => setFormProject(e.target.value)} 
                                            className="bg-[#2a2a2c] border border-red-500/30 focus:border-red-500 rounded px-2.5 py-1 text-[12px] text-white outline-none cursor-pointer font-bold"
                                            style={{ appearance: 'auto' }}
                                        >
                                            {projects.map(p => (
                                                <option key={p.project_code} value={p.project_code}>{p.project_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Category Select */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[#86868B]">업무분류:</span>
                                        <select 
                                            value={formCategoryMain} 
                                            onChange={e => setFormCategoryMain(e.target.value)} 
                                            className="bg-[#2a2a2c] border border-red-500/30 focus:border-red-500 rounded px-2.5 py-1 text-[12px] text-white outline-none cursor-pointer font-bold"
                                            style={{ appearance: 'auto' }}
                                            required
                                        >
                                            <option value="">업무분류 선택</option>
                                            <option value="공통 PMO">공통 PMO</option>
                                            <option value="인허가">인허가</option>
                                            <option value="호텔/운영">호텔/운영</option>
                                            <option value="시공/원가">시공/원가</option>
                                            <option value="도면/설계">도면/설계</option>
                                            <option value="인테리어/TI">인테리어/TI</option>
                                            <option value="임차/마케팅">임차/마케팅</option>
                                            <option value="PF/금융">PF/금융</option>
                                            <option value="구조/법무/세무">구조/법무/세무</option>
                                            <option value="주주/보고">주주/보고</option>
                                            <option value="준공/담보대출">준공/담보대출</option>
                                            <option value="일반 요청">일반 요청</option>
                                        </select>
                                    </div>

                                    {/* Sector Detail Input */}
                                    <div className="flex items-center gap-1.5 relative">
                                        <span className="text-[#86868B]">세부섹터:</span>
                                        <input 
                                            type="text" 
                                            value={formSectorDetail} 
                                            onChange={e => {
                                                setFormSectorDetail(e.target.value);
                                                setShowSubsectorSuggestions(true);
                                            }}
                                            onFocus={() => setShowSubsectorSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSubsectorSuggestions(false), 200)}
                                            className="bg-[#2a2a2c] border border-[#3c3c3c] rounded px-2 py-0.5 text-[12px] text-white outline-none w-[120px] font-bold text-center" 
                                            placeholder="검색/입력"
                                        />
                                        {showSubsectorSuggestions && formSectorDetail && (
                                            <div className="absolute top-[32px] left-0 w-full bg-[#222] border border-[#3c3c3c] rounded-[8px] py-1 max-h-[160px] overflow-y-auto z-[200005] shadow-xl">
                                                {uniqueSubsectors
                                                    .filter(name => name.toLowerCase().includes(formSectorDetail.toLowerCase()))
                                                    .map((name, i) => (
                                                        <div 
                                                            key={i} 
                                                            className="px-3 py-2 text-[12px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate text-left"
                                                            onClick={() => {
                                                                setFormSectorDetail(name);
                                                                setShowSubsectorSuggestions(false);
                                                            }}
                                                        >
                                                            {name}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Task Name Title Textarea */}
                                <div className="space-y-1">
                                    <span className="text-[#86868B] text-[11px] font-bold block">업무명</span>
                                    <textarea
                                        value={formTaskName}
                                        onChange={e => setFormTaskName(e.target.value)}
                                        className="w-full bg-[#2c2c2b] border border-red-500/30 focus:border-red-500 rounded-[6px] px-3 py-2 text-[15px] text-[#bdbba7] font-bold outline-none h-16 resize-y"
                                        required
                                    />
                                </div>

                                {/* Badges row (Status, Importance, Blocker, Task Type) */}
                                <div className="flex flex-wrap gap-4 text-[12px] font-bold">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">상태:</span>
                                        <select 
                                            value={formStatus} 
                                            onChange={e => setFormStatus(e.target.value)} 
                                            className="bg-[#2a2a2c] border border-red-500/30 focus:border-red-500 rounded px-2.5 py-1 text-[11.5px] font-bold text-white outline-none cursor-pointer"
                                            style={{ appearance: 'auto' }}
                                        >
                                            <option value="미착수">미착수</option>
                                            <option value="진행중">진행중</option>
                                            <option value="지연">지연</option>
                                            <option value="완료">완료</option>
                                            <option value="보류">보류</option>
                                            <option value="중단">중단</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">중요도:</span>
                                        <select 
                                            value={formImportanceLevel} 
                                            onChange={e => setFormImportanceLevel(e.target.value)} 
                                            className="bg-[#2a2a2c] border border-red-500/30 focus:border-red-500 rounded px-2.5 py-1 text-[11.5px] font-bold text-white outline-none cursor-pointer"
                                            style={{ appearance: 'auto' }}
                                        >
                                            
                                            <option value="PF필수">PF필수</option>
                                            <option value="준공필수">준공필수</option>
                                            <option value="높음">높음</option>
                                            <option value="중간">중간</option>
                                            <option value="낮음">낮음</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">유형:</span>
                                        <select 
                                            value={formTaskType} 
                                            onChange={e => setFormTaskType(e.target.value)} 
                                            className="bg-[#2a2a2c] border border-red-500/30 focus:border-red-500 rounded px-2.5 py-1 text-[11.5px] font-bold text-white outline-none cursor-pointer"
                                            style={{ appearance: 'auto' }}
                                        >
                                            <option value="정규">정규</option>
                                            <option value="팝업">팝업</option>
                                            <option value="회의후속">회의후속</option>
                                            <option value="외부요청">외부요청</option>
                                            <option value="보고">보고</option>
                                        </select>
                                    </div>

                                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 border border-[#3c3c3c] bg-red-500/10 rounded px-2.5 py-0.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formIsBlocker} 
                                            onChange={e => setFormIsBlocker(e.target.checked)} 
                                            className="rounded text-red-500 bg-transparent border-red-500/30"
                                        />
                                        병목(Blocker) 상황 설정
                                    </label>
                                </div>

                                {/* Metadata Card Box */}
                                <div className="p-5 rounded-[16px] bg-white/[0.02] border border-[#2c2c2e] space-y-4 text-[13px]">
                                    {/* Row 1: 실행주관, 담당자, 협조부서 */}
                                    <div className="grid grid-cols-4 gap-4 items-start">
                                        <div className="space-y-1">
                                            <span className="text-[#86868B] text-[11px] block">실행주관</span>
                                            <select 
                                                value={formLeadDept} 
                                                onChange={e => setFormLeadDept(e.target.value)} 
                                                className="bg-[#2c2c2b] border border-red-500/30 focus:border-red-500 rounded px-3 py-1.5 text-[13px] text-white w-full outline-none cursor-pointer font-bold"
                                                style={{ appearance: 'auto' }}
                                            >
                                                {['사업2파트', '사업1파트', 'LFC', '개발솔루션', '기업마케팅', '공간솔루션', 'KAM'].map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1 relative flex flex-col">
                                            <span className="text-[#86868B] text-[11px] block">담당자</span>
                                            <input 
                                                type="text" 
                                                value={formAssignee} 
                                                onChange={e => {
                                                    setFormAssignee(e.target.value);
                                                    setShowAssigneeDropdown(true);
                                                }} 
                                                onFocus={() => setShowAssigneeDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowAssigneeDropdown(false), 200)}
                                                placeholder="담당자명 검색/입력"
                                                className="w-full bg-[#2c2c2b] border border-red-500/30 focus:border-red-500 rounded-[6px] px-3 py-1.5 text-[13px] text-white outline-none" 
                                            />
                                            {showAssigneeDropdown && (
                                                <div className="absolute top-[58px] left-0 w-full bg-[#222] border border-[#3c3c3c] rounded-[8px] py-1 max-h-[160px] overflow-y-auto z-[200005] shadow-xl">
                                                    {Array.from(new Set(masterStakeholders.map(s => s.contact_name).filter(Boolean)))
                                                        .filter(name => !formAssignee || name.toLowerCase().includes(formAssignee.toLowerCase()))
                                                        .map((name, i) => (
                                                            <div 
                                                                key={i} 
                                                                className="px-3 py-2 text-[13px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate text-left"
                                                                onClick={() => {
                                                                    setFormAssignee(name);
                                                                    setShowAssigneeDropdown(false);
                                                                }}
                                                            >
                                                                {name}
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <span className="text-[#86868B] text-[11px] block">협조 부서 (다중 선택 가능)</span>
                                            <div className="flex flex-wrap gap-1.5 bg-[#2c2c2b] p-3 rounded-[8px] border border-red-500/30 max-h-[120px] overflow-y-auto">
                                                {['PO', 'Sub-PO', 'CFT 책임인력', '기획추진', '사업1파트', '사업2파트', 'LFC', '개발솔루션', '기업마케팅', '공간솔루션', 'KAM', 'IPR'].map(dept => {
                                                    const isSelected = isCoopDeptSelected(dept, formCoopDepts);
                                                    return (
                                                        <button 
                                                            key={dept}
                                                            type="button"
                                                            onClick={() => handleCoopDeptToggle(dept)}
                                                            className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer border ${
                                                                isSelected 
                                                                    ? 'bg-[#2997ff] text-white border-[#2997ff] shadow-sm' 
                                                                    : 'bg-[#1a1a1a] text-[#86868B] border-[#444] hover:border-[#666] hover:text-white'
                                                            }`}
                                                        >
                                                            {dept}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: 지원필요, GATE 단계, 외부상대방 */}
                                    <div className="grid grid-cols-4 gap-4 items-end">
                                        <div className="space-y-1 col-span-1 relative flex flex-col">
                                            <span className="text-[#86868B] text-[11px] block">지원필요</span>
                                            <input 
                                                type="text" 
                                                value={formSupportNeeded} 
                                                onChange={e => {
                                                    setFormSupportNeeded(e.target.value);
                                                    setShowSupportSuggestions(true);
                                                }} 
                                                onFocus={() => setShowSupportSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowSupportSuggestions(false), 200)}
                                                className="w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-3 h-[22px] py-0 align-middle text-[13px] text-[#bdbba7] outline-none focus:border-[#2997ff] font-bold" 
                                                placeholder="검색/입력"
                                            />
                                            {showSupportSuggestions && formSupportNeeded && (
                                                <div className="absolute top-[58px] left-0 w-full bg-[#222] border border-[#3c3c3c] rounded-[8px] py-1 max-h-[160px] overflow-y-auto z-[200005] shadow-xl">
                                                    {uniqueSupportOptions
                                                        .filter(opt => opt.toLowerCase().includes(formSupportNeeded.toLowerCase()))
                                                        .map((opt, i) => (
                                                            <div 
                                                                key={i} 
                                                                className="px-3 py-2 text-[12px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate text-left"
                                                                onClick={() => {
                                                                    setFormSupportNeeded(opt);
                                                                    setShowSupportSuggestions(false);
                                                                }}
                                                            >
                                                                {opt}
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1 col-span-1">
                                            <span className="text-[#86868B] text-[11px] block">GATE 단계</span>
                                            <select 
                                                value={formGateStage} 
                                                onChange={e => setFormGateStage(e.target.value)} 
                                                className="bg-[#2c2c2b] border border-red-500/30 focus:border-red-500 rounded px-3 py-1.5 text-[13px] text-white w-full outline-none cursor-pointer font-bold"
                                                style={{ appearance: 'auto' }}
                                            >
                                                <option value="G0 현황정리">G0 현황정리</option>
                                                <option value="G1 방향결정">G1 방향결정</option>
                                                <option value="G2 PF준비도">G2 PF준비도</option>
                                                <option value="G3 PF실행">G3 PF실행</option>
                                                <option value="G4 착공/공사">G4 착공/공사</option>
                                                <option value="G5 준공">G5 준공</option>
                                                <option value="G6 담보대출/운영전환">G6 담보대출/운영전환</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1 col-span-2 relative flex flex-col">
                                            <span className="text-[#86868B] text-[11px] block">외부 상대방</span>
                                            <input 
                                                type="text" 
                                                value={formExternalParty} 
                                                onChange={e => {
                                                    setFormExternalParty(e.target.value);
                                                    setShowStakeholderSuggestions(true);
                                                }}
                                                onFocus={() => setShowStakeholderSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowStakeholderSuggestions(false), 200)}
                                                className="w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-3 h-[22px] py-0 align-middle text-[13px] text-white outline-none focus:border-[#2997ff]" 
                                                placeholder="회사명 검색/입력"
                                            />
                                            {showStakeholderSuggestions && (
                                                <div className="absolute top-[58px] left-0 w-full bg-[#222] border border-[#3c3c3c] rounded-[8px] py-1 max-h-[160px] overflow-y-auto z-[200005] shadow-xl">
                                                    {uniqueStakeholderNames
                                                        .filter(name => !formExternalParty || name.toLowerCase().includes(formExternalParty.toLowerCase()))
                                                        .map((name, i) => (
                                                            <div 
                                                                key={i} 
                                                                className="px-3 py-2 text-[13px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate text-left"
                                                                onClick={() => {
                                                                    setFormExternalParty(name);
                                                                    setShowStakeholderSuggestions(false);
                                                                }}
                                                            >
                                                                {name}
                                                            </div>
                                                        ))}
                                                    {!uniqueStakeholderNames.some(name => name.toLowerCase() === formExternalParty.toLowerCase()) && (
                                                        <div 
                                                            className="px-3 py-2 text-[13px] text-[#2997ff] hover:bg-[#333] cursor-pointer font-bold border-t border-[#3c3c3c]/50 text-left"
                                                            onClick={async () => {
                                                                const nameToRegister = formExternalParty;
                                                                if (window.confirm(`'${nameToRegister}'을(를) 이해관계자 마스터에 새로 등록하시겠습니까?`)) {
                                                                    await resolveStakeholderCode(nameToRegister);
                                                                    alert('이해관계자가 등록되었습니다.');
                                                                }
                                                                setShowStakeholderSuggestions(false);
                                                            }}
                                                        >
                                                            ➕ 새 상대방 등록: "{formExternalParty}"
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 3: 회의상정등급, 마감 기한, 의사결정필요 */}
                                    <div className="grid grid-cols-4 gap-4 items-end">
                                        <div className="space-y-1">
                                            <span className="text-[#86868B] text-[11px] block">회의상정등급</span>
                                            <div className="mt-1.5">
                                                <span className={`px-2.5 py-1 rounded-[4px] text-[11.5px] font-bold ${
                                                    formMeetingGrade.startsWith('A') 
                                                        ? 'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25' 
                                                        : formMeetingGrade.startsWith('B')
                                                            ? 'bg-[#bdbba7]/15 text-[#bdbba7] border border-[#bdbba7]/25'
                                                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                }`}>
                                                    {formMeetingGrade}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[#86868B] text-[11px] block">마감 기한</span>
                                            <input 
                                                type="date" 
                                                value={formDueDate} 
                                                onChange={e => setFormDueDate(e.target.value)} 
                                                className="bg-[#2c2c2b] border border-red-500/30 focus:border-red-500 rounded px-3 py-1.5 text-[13px] text-white w-full outline-none font-bold cursor-pointer" 
                                            />
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <span className="text-[#86868B] text-[11px] block">의사결정필요</span>
                                            <select 
                                                value={formNeedsDecision ? '필요' : '불필요'} 
                                                onChange={e => setFormNeedsDecision(e.target.value === '필요')} 
                                                className="bg-[#2c2c2b] border border-red-500/30 focus:border-red-500 rounded px-3 py-1.5 text-[13px] text-white w-full outline-none cursor-pointer font-bold"
                                                style={{ appearance: 'auto' }}
                                            >
                                                <option value="필요">필요</option>
                                                <option value="불필요">불필요</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Narrative Card Box */}
                                <div className="p-5 rounded-[16px] bg-white/[0.02] border border-[#2c2c2e] space-y-4">
                                    {/* 업무 목적 */}
                                    <div className="space-y-1">
                                        <h4 className="text-[11px] font-bold text-[#86868B]">업무 목적</h4>
                                        <textarea 
                                            value={formTaskPurpose} 
                                            onChange={e => setFormTaskPurpose(e.target.value)} 
                                            className="w-full bg-[#2c2c2b] border border-red-500/30 focus:border-red-500 rounded-[6px] px-3 py-1.5 text-[13px] text-white outline-none h-20 resize-y font-bold" 
                                        />
                                    </div>
                                    
                                    <div className="h-[1px] bg-[#3c3c3c]/30"></div>
                                    
                                    {/* 필요 산출물 */}
                                    <div className="space-y-1">
                                        <h4 className="text-[11px] font-bold text-[#86868B]">필요 산출물</h4>
                                        <textarea 
                                            value={formDeliverables} 
                                            onChange={e => setFormDeliverables(e.target.value)} 
                                            className="w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-3 h-[22px] py-0 align-middle text-[13px] text-white outline-none focus:border-[#2997ff] h-20 resize-y font-bold" 
                                        />
                                    </div>
                                    
                                    <div className="h-[1px] bg-[#3c3c3c]/30"></div>
                                    
                                    {/* 다음 액션 */}
                                    <div className="space-y-1">
                                        <h4 className="text-[11px] font-bold text-[#86868B]">다음 액션</h4>
                                        <textarea 
                                            value={formNextAction} 
                                            onChange={e => setFormNextAction(e.target.value)} 
                                            className="w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-3 h-[22px] py-0 align-middle text-[13px] text-white outline-none focus:border-[#2997ff] h-20 resize-y font-bold" 
                                        />
                                    </div>

                                    <div className="h-[1px] bg-[#3c3c3c]/30"></div>

                                    {/* 회의 상정 사유 */}
                                    <div className="space-y-1">
                                        <h4 className="text-[#86868B] text-[11px] font-bold">회의 상정 사유 (Agenda Context)</h4>
                                        <p className="text-[13px] text-[#E5E5E5] leading-relaxed whitespace-pre-line mt-1.5 min-h-[20px]">
                                            {formAgendaReason || '점수에 의해 자동 상정됩니다.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-[#3c3c3c] flex items-center justify-between mt-4">
                                <span className="text-red-400 text-[11.5px] font-bold">
                                    * 붉은 박스는 필수입력
                                </span>
                                <div className="flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-[8px] bg-white/5 hover:bg-white/10 text-white border border-[#3c3c3c] text-[13px] font-bold cursor-pointer transition-all"
                                >
                                    취소
                                </button>
                                <button 
                                    type="submit"
                                    className="px-5 py-2 rounded-[8px] bg-[#2997ff] hover:bg-[#2997ff]/90 text-[13px] font-bold text-white cursor-pointer transition-all shadow-md shadow-[#2997ff]/10"
                                >
                                    저장
                                </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}            {selectedTaskDetail && (() => {
                const t = selectedTaskDetail;
                const taskDisplayId = getPmoTaskDisplayId(t, tasks);
                const fallbackItem = FALLBACK_BOARD_TASKS.find(fb => fb.task_name === t.task_name) || {};
                
                const isBlockerVal = parseBool(t.is_blocker !== undefined ? t.is_blocker : fallbackItem.is_blocker);
                const needsDecisionVal = parseBool(t.needs_decision !== undefined ? t.needs_decision : fallbackItem.needs_decision);
                const statusVal = t.status || fallbackItem.status || '진행중';
                const importanceLevel = t.importance_level || fallbackItem.importance_level || '중간';
                const priorityScore = Number(t.priority_score) || 0;
                const rawGrade = t.meeting_grade || fallbackItem.meeting_grade || 'B';
                const meetingGrade = rawGrade.includes('_') ? rawGrade : gradeMapToUi(rawGrade);
                
                const coopDeptsVal = t.coop_dept_codes || t.coop_depts || fallbackItem.coop_depts || '';
                const externalPartyVal = t.external_party?.stakeholder_name || t.external_party || t.external_party_code || fallbackItem.external_party || '';
                
                const agendaReason = t.agenda_reason || fallbackItem.agenda_reason || '';
                const nextActionVal = t.next_action || fallbackItem.next_action || '';
                const projObj = projects.find(p => p.project_code === t.project_code);

                return (
                    <div
                        className="fixed inset-0 z-[100000] overflow-hidden pointer-events-none"
                        data-pmo-task-detail-overlay
                    >
                        {embeddedDetailOnly ? (
                            <button
                                type="button"
                                aria-label="업무 상세 닫기"
                                onClick={closeSelectedTaskDetail}
                                className="absolute inset-0 cursor-default bg-transparent pointer-events-auto"
                                data-pmo-task-detail-backdrop
                            />
                        ) : (
                            <div className="absolute inset-0 bg-transparent pointer-events-none" />
                        )}
                        <div
                            ref={drawerRef}
                            className="absolute inset-y-0 right-0 max-w-full flex pl-10 pointer-events-auto"
                            data-pmo-task-detail-drawer
                        >
                            <form onSubmit={handleFormSubmit} className="w-screen max-w-[550px] transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col h-full bg-[#1c1c1e]/95 backdrop-blur-xl border-l border-[#3c3c3c]/80 text-white select-text">
                                {/* Header */}
                                <div className="px-[10px] py-3 border-b border-[#3c3c3c]/80 flex items-center justify-between bg-[#1c1c1e]/80 sticky top-0 z-20">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {taskDisplayId && (
                                            <span className="font-mono text-[12px] font-bold px-2 py-0.5 rounded bg-white/10 text-[#86868B]">
                                                {taskDisplayId}
                                            </span>
                                        )}
                                        <span className="text-[12px] font-bold px-2 py-0.5 rounded border border-[#3c3c3c] bg-[#3A3A3C] text-white">
                                            {normalizeProjectName(projObj ? projObj.project_name : (t.project || fallbackItem.project || 'IOTA_SEOUL'))}
                                        </span>
                                        <span className="text-[12px] font-bold px-2 py-0.5 rounded border border-[#3c3c3c] bg-white/5 text-[#E5E5E5]">
                                            {t.category_main || fallbackItem.category_main || '-'}
                                        </span>
                                        <span className="text-[12px] font-bold px-2 py-0.5 rounded border border-[#3c3c3c] bg-white/5 text-[#E5E5E5]">
                                            {t.sector_detail || fallbackItem.sector_detail || '-'}
                                        </span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={closeSelectedTaskDetail}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#86868B] hover:bg-white/5 hover:text-white text-[20px] font-bold transition-colors cursor-pointer"
                                        aria-label="업무 상세 닫기"
                                        data-pmo-task-detail-close
                                    >
                                        ✕
                                    </button>
                                </div>
                                
                                {/* Content Body */}
                                <div className="flex-1 overflow-y-auto px-[10px] py-6 space-y-[10px] timeline-scrollbar">
                                    {/* Task Name */}
                                    <div className="space-y-1 pl-[16px] relative top-[-6px]">
                                        <h2 className="text-[22px] font-bold text-[#bdbba7] leading-snug">
                                            {t.task_name || ''}
                                        </h2>
                                        <div className="flex flex-wrap gap-2 text-[12px] pt-[2px] pb-[4px]">
                                            <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[11px] ${
                                                statusVal === '완료' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                statusVal === '지연' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                                {statusVal}
                                            </span>
                                            
                                            <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[11px] ${
                                                importanceLevel === 'PF필수' ? 'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25' :
                                                importanceLevel === '준공필수' ? 'bg-[#bdbba7]/15 text-[#bdbba7] border border-[#bdbba7]/25' :
                                                'bg-white/5 text-[#86868B] border border-white/10'
                                            }`}>
                                                중요도: {importanceLevel}
                                            </span>
                                            
                                            <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[11px] ${
                                                priorityScore >= 60
                                                    ? 'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25'
                                                    : priorityScore >= 40
                                                        ? 'bg-[#bdbba7]/15 text-[#bdbba7] border border-[#bdbba7]/25'
                                                        : 'bg-white/5 text-[#86868B] border border-white/10'
                                            }`}>
                                                우선순위: {priorityScore}점 ({meetingGrade})
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Blocker Alert Banner */}
                                    {isBlockerVal && (
                                        <div className="pt-4 pr-4 pb-4 pl-5 rounded-[12px] bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                                            <div className="space-y-1">
                                                <h4 className="text-[13px] font-bold text-red-400">현재 진행 병목(Blocker) 상황</h4>
                                                <p className="text-[12px] text-gray-300 leading-relaxed">
                                                    이 업무는 현재 병목 현상이 활성화되어 주요 보고 및 모니터링 대상으로 지정되어 있습니다.
                                                 </p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Metadata Card Box */}
                                    <div className="p-5 rounded-[16px] bg-white/[0.02] border border-[#2c2c2e] space-y-[14px] text-[13px]">
                                        {/* Row 1: 실행주관, 담당자, 협조부서 */}
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">실행주관</span>
                                                <span className="font-bold text-[#E5E5E5] block">
                                                    {t.lead_dept?.dept_name || t.lead_dept || t.lead_dept_code || fallbackItem.lead_dept || '사업2파트'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">담당자</span>
                                                <span className="font-bold text-[#E5E5E5] block">
                                                    {t.assignee || '미정'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px] col-span-2">
                                                <span className="text-[#86868B] text-[11px] block">협조 부서</span>
                                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                    {coopDeptsVal ? coopDeptsVal.split(';').map((dept, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 text-[11px]">
                                                            {dept.trim()}
                                                        </span>
                                                    )) : <span className="text-[#555]">-</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 2: 지원필요, GATE 단계, 외부상대방 */}
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="space-y-[3px] col-span-1">
                                                <span className="text-[#86868B] text-[11px] block">지원필요</span>
                                                <span className="font-bold text-[#bdbba7] block">
                                                    {t.support_needed || fallbackItem.support_needed || '-'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px] col-span-1">
                                                <span className="text-[#86868B] text-[11px] block">GATE 단계</span>
                                                <span className="font-bold text-[#E5E5E5] block">
                                                    {t.gate_stage || fallbackItem.gate_stage || '-'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px] col-span-2">
                                                <span className="text-[#86868B] text-[11px] block">외부 상대방</span>
                                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                    {externalPartyVal ? externalPartyVal.split(',').map((party, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded bg-[#2997ff]/10 border border-[#2997ff]/20 text-[#2997ff] text-[11px] font-bold">
                                                            {party.trim()}
                                                        </span>
                                                    )) : <span className="text-[#555]">-</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 3: 회의상정등급, 마감 기한, 의사결정필요 */}
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">회의상정등급</span>
                                                <div className="mt-1">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                        meetingGrade.startsWith('A') 
                                                            ? 'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25' 
                                                            : (meetingGrade === 'B_회의점검' || meetingGrade.startsWith('B'))
                                                                ? 'bg-[#bdbba7]/15 text-[#bdbba7] border border-[#bdbba7]/25'
                                                                : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                    }`}>
                                                        {meetingGrade}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">마감 기한</span>
                                                <span className="font-bold text-[#E5E5E5] block">
                                                    {t.due_date || fallbackItem.due_date || '-'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px] col-span-2">
                                                <span className="text-[#86868B] text-[11px] block">의사결정필요</span>
                                                <span className="font-bold block">
                                                    <span className={needsDecisionVal ? 'text-[#ff453a]' : 'text-gray-400'}>
                                                        {needsDecisionVal ? '필요' : '불필요'}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Deep Dive Narrative Cards (Single unified box) */}
                                    <div className="p-5 rounded-[16px] bg-white/[0.02] border border-[#2c2c2e] flex flex-col">
                                        {/* 업무 목적 */}
                                        <div className="space-y-0">
                                            <h4 className="text-[11px] font-bold text-[#86868B]">업무 목적</h4>
                                            <p className="text-[14px] text-[#bdbba7] leading-relaxed whitespace-pre-line mt-[2px]">
                                                {t.task_purpose || fallbackItem.task_purpose || '등록된 내용이 없습니다.'}
                                            </p>
                                        </div>
                                        
                                        <div className="h-[1px] bg-[#3c3c3c]/30 mt-[10px] mb-[12px]"></div>
                                        
                                        {/* 필요 산출물 */}
                                        <div className="space-y-0">
                                            <h4 className="text-[11px] font-bold text-[#86868B]">필요 산출물</h4>
                                            <p className="text-[14px] text-[#bdbba7] leading-relaxed whitespace-pre-line mt-[2px]">
                                                {t.deliverables || fallbackItem.deliverables || '등록된 내용이 없습니다.'}
                                            </p>
                                        </div>
                                        
                                        <div className="h-[1px] bg-[#3c3c3c]/30 mt-[10px] mb-[12px]"></div>
                                        
                                        {/* 다음 액션 */}
                                        <div className="space-y-0">
                                            <h4 className="text-[11px] font-bold text-[#86868B]">다음 액션</h4>
                                            <p className="text-[14px] text-[#bdbba7] leading-relaxed whitespace-pre-line mt-[2px]">
                                                {nextActionVal || '등록된 내용이 없습니다.'}
                                            </p>
                                        </div>

                                        {agendaReason && (
                                            <>
                                                <div className="h-[1px] bg-[#3c3c3c]/30 mt-[10px] mb-[12px]"></div>
                                                {/* 회의 상정 사유 */}
                                                <div className="space-y-0">
                                                    <h4 className="text-[11px] font-bold text-[#86868B]">회의 상정 사유 (Agenda Context)</h4>
                                                    <p className="text-[14px] text-[#bdbba7] leading-relaxed whitespace-pre-line mt-[2px]">
                                                        {agendaReason}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* 업무 협업 게시판 */}
                                    <div className="w-full">
                                        <WorkspaceActivityLog 
                                            isTaskBoard={true} 
                                            taskId={t.id} 
                                            taskProject={t.project_code || t.project || fallbackItem.project || 'IOTA_SEOUL'}
                                            workspaceCode="WS_PMO" 
                                            workspaceLabel="통합업무보드" 
                                        />
                                    </div>
                                </div>
                                
                                {/* Footer Action Buttons */}
                                <div className="px-[10px] py-4 border-t border-[#3c3c3c]/80 flex justify-end gap-3 bg-[#1c1c1e]/90">
                                    <button 
                                        type="button"
                                        onClick={closeSelectedTaskDetail}
                                        className="px-4 py-2 rounded-[8px] bg-white/5 hover:bg-white/10 text-white border border-[#3c3c3c] text-[13px] font-bold cursor-pointer transition-all"
                                        data-pmo-task-detail-close
                                    >
                                        닫기
                                    </button>
                                    {isAuthorized && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                handleEditClick(t, true);
                                            }}
                                            className="px-5 py-2 rounded-[8px] bg-[#2997ff] hover:bg-[#2997ff]/90 text-[13px] font-bold text-white cursor-pointer transition-all shadow-md shadow-[#2997ff]/10"
                                        >
                                            업무 수정하기
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}        </div></div>
    );
}
