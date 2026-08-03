import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PmoVision() {
    const { memberInfo, loading } = useAuth();
    const [selectedMenu, setSelectedMenu] = useState('ifpdp-proposal');
    const [copied, setCopied] = useState(false);
    
    // Filtering/Search state for Requirements grid
    const [reqSearchQuery, setReqSearchQuery] = useState('');
    const [reqFilterScope, setReqFilterScope] = useState('all');

    // Filtering/Search state for Phase 1 Requirements grid
    const [phase1ReqSearchQuery, setPhase1ReqSearchQuery] = useState('');
    const [phase1ReqFilterScope, setPhase1ReqFilterScope] = useState('all');

    // Only allow '전기영' to access this page
    const isAuthorized = memberInfo?.staff_name === '전기영';

    const getStaffTitle = (info) => {
        if (!info?.staff_name) return '로그인 필요';
        return `${info.staff_name} 부장`;
    };

    // Clean Blackstone style Inter font inline style (no tracking letter-spacing)
    const interFont = { fontFamily: "'Inter', sans-serif" };

    // Static structures parsed and compiled
    const requirementsData = [
    {
        "scope": "내부",
        "category": "그룹 정보",
        "subcategory": "사업 매출",
        "actor": "Tier 3는",
        "detail": "리얼에셋 그룹 및 조직의 매출 목표와 현재 달성 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "그룹 정보",
        "subcategory": "센터 OKR",
        "actor": "Tier 3는",
        "detail": "각 센터의 OKR 계획과 진척도 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "All 센터",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "그룹 정보",
        "subcategory": "인력 배분 정보",
        "actor": "Tier 3는",
        "detail": "각 프로젝트에 할당 된 인력 배분 정보를 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "ALL",
        "note": "-"
    },
    {
        "scope": "내부",
        "category": "소싱 정보",
        "subcategory": "입찰 접수현황",
        "actor": "Tier 2는",
        "detail": "티저로 접수되는 입찰 접수건의 정보와 수량를 파악할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "소싱 정보",
        "subcategory": "CA 검토 현황",
        "actor": "Tier 3는",
        "detail": "CA 검토되는 프로젝트의 히스토리와 현황을 파악할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "소싱 정보",
        "subcategory": "실사 현황",
        "actor": "Tier 3는",
        "detail": "프로젝트의 실사 히스토리와 현재 실사 현황을 파악할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "소싱 정보",
        "subcategory": "우협 선정",
        "actor": "Tier 3는",
        "detail": "각 부서의 프로젝트 소싱 및 우협선정 히스토리를 파악할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "투자자 정보",
        "subcategory": "투자자 통합정보",
        "actor": "Tier 3는",
        "detail": "이지스에 투자된 투자사 통합 현황 대시보드를 편리하게 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "투자자 정보",
        "subcategory": "투자자 통합정보",
        "actor": "Tier 3는",
        "detail": "개별 투자사에 대한 투자사 현황을 편리하게 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "투자자 정보",
        "subcategory": "투자자 담당자",
        "actor": "Tier 3는",
        "detail": "각 투자사의 담당자 및 키맨 정보, 및 커뮤니케이션 히스토리, 특이사항 등을 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    },
    {
        "scope": "내부",
        "category": "자산통합정보",
        "subcategory": "10단계 가치사슬",
        "actor": "Tier 3는",
        "detail": "모든 프로젝트의 10단계 가치사슬 단계 및 특이사항 현황을 한 화면의 대시보드로 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "ALL",
        "note": "-"
    },
    {
        "scope": "내부",
        "category": "자산통합정보",
        "subcategory": "프로젝트 개수",
        "actor": "Tier 3는",
        "detail": "현재 진행중인 프로젝트의 갯수를 다양한 분류방법을 통해 편리하게 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "ALL",
        "note": "-"
    },
    {
        "scope": "내부",
        "category": "자산통합정보",
        "subcategory": "설계/시공사 정보",
        "actor": "Tier 2는",
        "detail": "프로젝트별 담당 설계사, 시공사, 담당자 연락처 및 담당자별 특징을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자, 사업",
        "note": "All 센터"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "자산 통합 정보",
        "actor": "Tier 3는",
        "detail": "모든 개별 자산의 10단계 가치사슬 전체 상황 및 특이사항 현황을 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "ALL",
        "note": "-"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "소싱",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 소싱 히스토리와 현재 현황을 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자",
        "note": "CM"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "투자",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 투자(심의) 히스토리와 현재 현황을 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자",
        "note": "CM"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "브랜드",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 브랜드(컨셉,포지셔닝) 히스토리와 현재 현황을 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "공간솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "CF",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 CF 히스토리와 현재 현황을 확인할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "투자"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "Finanacing",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 Financing 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "LFC"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "PFV/펀드 운영",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 PFV/Fund 운영 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "준법,리스크.."
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "개발 공정",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 공정/인허가 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "개발솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "상품기획",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 [공간UX/Tech] 상품 기획 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "공간솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "호텔 상품 개발",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 [호텔/레지던스] 상품 개발 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "공간솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "리테일",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 [리테일] 상품 개발 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "리테일솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "마케팅",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 마케팅 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "기업마케팅"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "마케팅",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 플레이스메이킹 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "공간솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "자산 스팩",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 스팩 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "공간솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "자산 스팩",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 전력공급 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "개발솔루션"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "자산 스팩",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 관리/운영 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "관리운영",
        "note": "All 센터"
    },
    {
        "scope": "내부",
        "category": "복합/개별 자산",
        "subcategory": "세일즈",
        "actor": "Tier 2는",
        "detail": "모든 개별 자산의 세일즈(리징) 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "사업",
        "note": "기업마케팅"
    },
    {
        "scope": "내부",
        "category": "기업통합정보",
        "subcategory": "세일즈",
        "actor": "Tier 2는",
        "detail": "기업 관점에서 이지스 자산에 임차된 기업의 통합 현황을 편리하게 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "기업마케팅",
        "note": "ALL"
    },
    {
        "scope": "외부",
        "category": "시공/설계사",
        "subcategory": "도급순위 및 이슈",
        "actor": "Tier 2는",
        "detail": "시공사별 도급순위와 현재 시점에서의 시공사별 이슈, 담당자 연락처 및 담당자별 특징을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자, 사업",
        "note": "All 센터"
    },
    {
        "scope": "외부",
        "category": "기업통합정보",
        "subcategory": "기업 임차정보",
        "actor": "Tier 2는",
        "detail": "다양한 조건을 통해 기업의 오피스/데이터센터/물류 임차 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "기업마케팅",
        "note": "ALL"
    },
    {
        "scope": "외부",
        "category": "기업통합정보",
        "subcategory": "기업 임차정보",
        "actor": "Tier 2는",
        "detail": "특정 기업이 임차한 자산의 세부정보를 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "기업마케팅",
        "note": "ALL"
    },
    {
        "scope": "외부",
        "category": "기업통합정보",
        "subcategory": "유형별 기업 형태",
        "actor": "Tier 2는",
        "detail": "특정 기업유형에 따른 자산 환경 니즈를 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "기업마케팅",
        "note": "ALL"
    },
    {
        "scope": "외부",
        "category": "기업통합정보",
        "subcategory": "기업 별 니즈",
        "actor": "Tier 2는",
        "detail": "국내 Top 100 기업에 대해, 각 기업이 처한 고유한 환경과 임차 니즈를 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "기업마케팅",
        "note": "ALL"
    },
    {
        "scope": "외부",
        "category": "기업통합정보",
        "subcategory": "기업 담장자 정보",
        "actor": "Tier 2는",
        "detail": "주요 기업들의 메인컨텍포인트, 연락처, 해당 인물에 대한 현재 이슈, 특이사항 등을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "기업마케팅",
        "note": "ALL"
    },
    {
        "scope": "외부",
        "category": "복합/개별 자산",
        "subcategory": "매입/매각정보",
        "actor": "Tier 2는",
        "detail": "3대권역 주요 자산의 매입/매각 히스토리와 현재 현황을 확인 할 수 있다.",
        "main_dept": "",
        "sub_dept": "투자/사업",
        "note": "All"
    }
];
    const phase1RequirementsData = [
    {
        "classification": "",
        "scope": "내부",
        "category": "인증/보안",
        "subcategory": "로그인 및 권한 진입",
        "actor": "사용자",
        "detail": "사전에 어드민을 통해 등록된 이지스 임직원 이메일로 보안 로그인을 수행할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "iota_members 매핑"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "인증/보안",
        "subcategory": "비인증 접근 차단",
        "actor": "사용자",
        "detail": "미인증 사용자 혹은 로그인 세션 만료자가 다이렉트 URL로 강제 진입 시 로그인 페이지로 리다이렉션됨을 확인할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "-",
        "note": "보안 인증 가드 적용"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "인증/보안",
        "subcategory": "부서별 쓰기 통제",
        "actor": "사용자",
        "detail": "소속 부서(사업1, 사업2 등) 권한에 맞춰 본인 부서의 실행주관 업무 영역만 수정/쓰기 권한이 활성화되고 타 부서 영역은 읽기만 허용됨을 확인할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "Supabase RLS 규칙에 의한 차단"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "인증/보안",
        "subcategory": "세션 폐기",
        "actor": "사용자",
        "detail": "로그아웃 버튼 클릭 시 사용자 토큰 및 세션 정보가 완전히 제거되고 로그인 화면으로 즉시 복귀됨을 확인할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "-",
        "note": "완전 세션 삭제 로그"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "모바일 활용",
        "subcategory": "모바일 태스크 확인",
        "actor": "실무자/임원",
        "detail": "이동 중이나 외부 미팅 시 모바일 기기를 통해 부서별 업무 상태 및 담당자를 편리하게 확인할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "모바일 최적화 뷰"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "알림 수신",
        "subcategory": "실시간 알림 수신",
        "actor": "실무 담당자",
        "detail": "담당 업무에 병목(Blocker)이 활성화되거나 신규 태스크가 지정되었을 때 실시간 알림을 받아볼 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "백그라운드 메시지 브릿지"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "실무 할일 관리",
        "actor": "실무자",
        "detail": "본인 부서에 배정된 실행주관 업무의 상태(신규/진행/완료 등)를 클릭 한 번으로 빠르게 수정할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "그리드 내 인라인 최신화"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "병목(Blocker) 공유",
        "actor": "실무자",
        "detail": "업무 진행 중 지연 리스크가 생기면 원클릭으로 Blocker 경고등을 켜서 전사에 지연 요소를 신속하게 공유할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "적색 병목 마커 표출"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "업무 현황 검색",
        "actor": "실무자/임원",
        "detail": "텍스트 검색창을 통해 수많은 할일 목록 중 특정 프로젝트나 검색어 관련 업무를 실시간으로 필터링하여 조회할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "키워드 실시간 매칭"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "비히클 관제",
        "subcategory": "자금 조달 구조 파악",
        "actor": "임원/LFC",
        "detail": "특정 펀드 및 PFV의 에쿼티 비율, 선/후순위 대주단 구성 및 조달 금리 변천사를 시계열 순서로 파악할 수 있다.",
        "main_dept": "LFC",
        "sub_dept": "사업 PM",
        "note": "Capital Stack 모듈"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "비히클 관제",
        "subcategory": "재무 리스크 모니터링",
        "actor": "임원/LFC",
        "detail": "비히클별 기금 인출(Drawdown) 시점과 이자 납입 일정을 연계하여 재무적 리스크를 선제적으로 모니터링할 수 있다.",
        "main_dept": "LFC",
        "sub_dept": "ALL",
        "note": "인출 스케줄 아카이브"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "비히클 관제",
        "subcategory": "자산 마일스톤 점검",
        "actor": "임원/사업",
        "detail": "토지 매입일, 착공일, 준공 예정일, 대출 만기일 등 자산 생애주기 일정을 한눈에 점검할 수 있다.",
        "main_dept": "사업 PM",
        "sub_dept": "개발관리",
        "note": "시계열 일정 아카이브"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "의사결정 맥락",
        "subcategory": "의사결정 판단 근거 기록",
        "actor": "실무자/임원",
        "detail": "PF 금리 인상, 시공 도급 조건 변경 등 핵심 조건 변경 시 배경 사유와 정성적인 의사결정 판단 근거를 기록할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "Context Graph 엔진"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "의사결정 맥락",
        "subcategory": "기록 위변조 방지",
        "actor": "어드민",
        "detail": "중요 결정 사안의 임의 조작을 막기 위해 의사결정 로그가 작성되는 즉시 이력을 자동 잠금(Lock)할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "-",
        "note": "is_locked 컬럼 기반 RLS"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "의사결정 맥락",
        "subcategory": "회의록 태스크 배정",
        "actor": "회의 참석자",
        "detail": "회의 진행 중 즉석에서 액션 아이템을 실행주관과 담당자에게 등록 및 배정하여 실무 테이블로 보낼 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "MeetingWriteBox 연동"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "스냅샷/알림",
        "subcategory": "주간 단위 상태 비교",
        "actor": "임원/어드민",
        "detail": "매주 금요일 퇴근 시점 기준으로 전사 업무 현황 원장이 자동 캡처 보존되므로 주간 단위 업무 변동 내역을 편리하게 비교 파악할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "iota_weekly_snapshots"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "스냅샷/알림",
        "subcategory": "네트워크 단절 방지",
        "actor": "사용자",
        "detail": "네트워크 단절이나 데이터베이스 장애 시에도 로컬 브라우저에 저장된 데이터 버퍼를 통해 실시간으로 작업 내역을 백업 보존할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "-",
        "note": "로컬 웹 스토리지 백업"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "이해관계자",
        "subcategory": "파트너 연락처 조회",
        "actor": "실무자",
        "detail": "자산별 시행사, 설계사, 대주단 금융기관 등 주요 이해관계자들의 비상 연락처 및 특이사항을 빠르게 조회할 수 있다.",
        "main_dept": "사업 PM",
        "sub_dept": "LFC",
        "note": "iota_stakeholder_master"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "권한 관리",
        "subcategory": "부서별 권한 매핑",
        "actor": "사용자",
        "detail": "로그인한 사용자의 이메일 및 직급 정보를 식별하여 사업1파트, 사업2파트 및 임원진 권한으로 분기 매핑함.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "iota_members 정보 활용"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "사업 PM 업무 관리",
        "actor": "사업 PM",
        "detail": "iota_pm_tasks 테이블을 통해 실행주관 일정, 소싱 타겟, 계약 정보 등의 현황을 상세 등록하고 조회할 수 있음.",
        "main_dept": "사업 PM",
        "sub_dept": "All",
        "note": "부서 전용 필드 제공"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "LFC 금융 업무 관리",
        "actor": "LFC",
        "detail": "iota_financing_tasks 테이블을 활용하여 PF 조달 구조, 금리, 금융비 및 대주단 매핑 상태를 관리함.",
        "main_dept": "LFC",
        "sub_dept": "All",
        "note": "조달 트랜치별 금리 추적"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "개발관리 업무 관리",
        "actor": "개발관리",
        "detail": "iota_development_tasks 테이블을 활용하여 건축인허가 단계, 시공 도급 계약, 공사/준공 마일스톤 일정을 기록함.",
        "main_dept": "개발관리",
        "sub_dept": "All",
        "note": "준공 만기일 추적"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "마케팅/임차 관리",
        "actor": "마케팅",
        "detail": "iota_marketing_tasks 및 iota_fund_tasks 테이블을 통해 마케팅 타겟 테넌트 입점 이력 및 펀드 설정 정보를 관리함.",
        "main_dept": "마케팅",
        "sub_dept": "All",
        "note": "임차 앵커 관리"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "시계열 관리",
        "subcategory": "주간 스냅샷 아카이빙",
        "actor": "시스템",
        "detail": "매주 금요일 퇴근 시점의 실무 업무 원장 상태를 스냅샷 이미지로 아카이빙하여 시계열 변천사를 보존함.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "iota_weekly_snapshots 활용"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "시계열 관리",
        "subcategory": "백업 및 이중화",
        "actor": "시스템",
        "detail": "Supabase 네트워크 장애에 대비하기 위해 로컬 웹 스토리지에 스냅샷 데이터를 실시간 백업 기동함.",
        "main_dept": "IT/기획",
        "sub_dept": "-",
        "note": "네트워크 단절 방지용 버퍼"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "의사결정",
        "subcategory": "의사결정 로그 기록",
        "actor": "임원/어드민",
        "detail": "론 조건 변경, 수익률 조정, 매각 시기 연기 등 중대한 결정의 배경 사유와 정성적 판단 근거를 영구 기록함.",
        "main_dept": "IT/기획",
        "sub_dept": "All",
        "note": "iota_decision_logs 활용"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "의사결정",
        "subcategory": "히스토리 잠금",
        "actor": "어드민",
        "detail": "기록된 의사결정 로그가 훼손되거나 조작되지 않도록 이력 수정 방지 및 잠금 기능을 제공함.",
        "main_dept": "IT/기획",
        "sub_dept": "-",
        "note": "is_locked 컬럼 RLS 제어"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "협업 관리",
        "subcategory": "실시간 액션 아이템 배정",
        "actor": "실무자",
        "detail": "회의 중 실시간으로 발생한 액션 아이템을 에디터 창을 통해 실행주관 및 담당자에게 즉시 등록 및 배정함.",
        "main_dept": "ALL",
        "sub_dept": "All",
        "note": "MeetingWriteBox 에디터 활용"
    },
    {
        "classification": "",
        "scope": "외부",
        "category": "알림 연동",
        "subcategory": "스마트 알림 발송",
        "actor": "시스템",
        "detail": "업무 원장에 새로운 태스크나 지연 요소(Blocker) 등록 시 지정 부서원 및 임원진에게 메일/메시지를 백그라운드로 발송함.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "백그라운드 알림 대기열"
    },
    {
        "classification": "",
        "scope": "외부",
        "category": "대외 연계",
        "subcategory": "이해관계자 관리",
        "actor": "실무자",
        "detail": "빌딩별 출자자(LP), 시행사, 자산관리 회사 등 주요 파트너 연락처 및 컨택 히스토리를 마스터 테이블로 조회함.",
        "main_dept": "사업 PM",
        "sub_dept": "LFC",
        "note": "iota_stakeholder_master 활용"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "협업 관리",
        "subcategory": "화면 이동 동선",
        "actor": "시스템",
        "detail": "대시보드 내 활동 로그 클릭 시 해당 부서 워크스페이스로 이동함과 동시에 로컬스토리지에 저장된 ID를 기반으로 해당 업무 카드로 자동 포커싱 및 스크롤함.",
        "main_dept": "ALL",
        "sub_dept": "All",
        "note": "localStorage 기반 cross-focusing"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "우선순위 재정렬",
        "actor": "실무자",
        "detail": "업무 상태 그리드에서 상/하 정렬 버튼 클릭 시 백엔드 DB의 created_at 가중치를 실시간 스왑하여 업무 우선순위 노출 순서를 동적으로 변경함.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "custom weight 정렬 알고리즘"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "거버넌스 관리",
        "subcategory": "거버넌스 SSOT",
        "actor": "사용자",
        "detail": "전사 조직체계, 부서별 책임한계(RACI), 핵심 회의체 주기, Risk Top 10을 열람할 수 있는 거버넌스 뷰어를 구축하여 오프라인 지침을 시스템화함.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "GovSystem / GovRaci / GovMeetings / GovRiskTop10"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "데이터 관리",
        "subcategory": "RAG 검색 대비",
        "actor": "시스템",
        "detail": "실무 코멘트 등록 시 본문 텍스트와 메타데이터(인물, 자산, URL)를 Supabase DB 상에 분할 적재하여 RAG 기반 AI 검색 성능 최적화 구조를 수립함.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "raw_text / metadata JSONB 분할 적재"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "데이터 관리",
        "subcategory": "대외 파트너 조회",
        "actor": "실무자",
        "detail": "대외 파트너사 정보와 앵커 임차인(Tenant) 이전 및 매핑 상태를 조회하는 데이터 관리용 명부를 설계하여 관계사 마스터 테이블과 연동함.",
        "main_dept": "사업 PM",
        "sub_dept": "LFC",
        "note": "StakeLp / StakeTenant / StakePartner"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "시계열 관리",
        "subcategory": "핫 테스크 자동 추출",
        "actor": "시스템",
        "detail": "각 부서 DB 테이블에서 최근 14일 내 생성/변경된 활성 과제만 쿼리 슬라이싱하여 대시보드 첫 화면에 모아서 노출함.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "최근 14일 기준 Date Filter"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "모바일/UX",
        "subcategory": "자동 포커싱 화면 이동",
        "actor": "사용자",
        "detail": "대시보드에서 최근 업무 피드를 클릭하면 해당 부서 페이지로 이동함과 동시에 타겟 업무 카드가 화면 상단 여백 100px 위치에 자동 포커싱되어 눈의 피로 없이 즉시 확인할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "PlatformCenter.jsx 동적 스크롤"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "인증/보안",
        "subcategory": "뷰어/에디터 권한 분리",
        "actor": "사용자",
        "detail": "조회 전용 권한을 가진 유저로 로그인했을 경우, 과제 추가/편집/삭제 및 정렬 화살표 버튼들이 화면에서 자동으로 감추어짐을 확인할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "-",
        "note": "Workspace* 권한 필터"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "거버넌스 관리",
        "subcategory": "거버넌스 정보 열람",
        "actor": "사용자",
        "detail": "오프라인 책자로 찾아볼 필요 없이 플랫폼 내 거버넌스 메뉴에서 전사 조직도, 부서별 RACI 매트릭스, 경영 리스크 대응 상태를 손쉽게 확인할 수 있다.",
        "main_dept": "IT/기획",
        "sub_dept": "ALL",
        "note": "GovMenu 9종 연동"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "이해관계자",
        "subcategory": "인물 검색 자동완성",
        "actor": "회의 참석자/실무자",
        "detail": "회의록이나 업무 코멘트 작성 중 담당자 이름을 타이핑하면 마스터 주소록 기반 인물이 실시간 검색 및 자동 완성(Autocomplete) 매핑되는 편리함을 확인할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "LogWriteBox 오토컴플릿"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "최근 갱신 과제 필터",
        "actor": "실무자/임원",
        "detail": "첫 대시보드 화면 진입 시 전사 부서에서 최근 2주 동안 새로 갱신된 핫 테스크(Hot Tasks) 목록만 자동으로 모아서 한눈에 파악할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "DecisionLog 최근 14일 필터"
    },
    {
        "classification": "",
        "scope": "내부",
        "category": "부서별 업무",
        "subcategory": "활동 내역 조회",
        "actor": "실무자",
        "detail": "부서별 독립된 공간에서 각 태스크별로 작성된 회의 코멘트와 URL 첨부파일 등 실무 활동 이력(Activity Log)을 통합 히스토리 형태로 간편하게 파악할 수 있다.",
        "main_dept": "ALL",
        "sub_dept": "ALL",
        "note": "WorkspaceActivityLog 모듈"
    }
];
    const schemaFieldsData = [
    {
        "ui_layer": "Section 1 (최상단)",
        "attr": "① Static 프로필 (불변)",
        "field": "missionId / assetName",
        "structure": "단일 구조",
        "datatype": "String",
        "desc": "더케이트윈타워 매입 프로젝트"
    },
    {
        "ui_layer": "Section 1",
        "attr": "① Static 프로필 (불변)",
        "field": "assetClass / address",
        "structure": "단일 구조",
        "datatype": "Enum/String",
        "desc": "오피스/리테일"
    },
    {
        "ui_layer": "Section 1",
        "attr": "② Dynamic 지표 (변동)",
        "field": "aum (총 사업규모)",
        "structure": "Time-Series (시계열 배열)",
        "datatype": "Array of Objects",
        "desc": "UW, BP, 실제 연도별 사업비 변동 추이 누적"
    },
    {
        "ui_layer": "Section 1",
        "attr": "① Static 프로필 (불변)",
        "field": "director / pm",
        "structure": "단일 구조",
        "datatype": "String",
        "desc": "정영진 / 장민호"
    },
    {
        "ui_layer": "Section 1",
        "attr": "③ Context 텍스트 (RAG)",
        "field": "redFlagsStatus",
        "structure": "Log Series (로그 누적 배열)",
        "datatype": "Array of Objects",
        "desc": "시점별 리스크 발생 및 해소 내역 누적 로깅"
    },
    {
        "ui_layer": "Section 2 (상단)",
        "attr": "③ Context 텍스트 (RAG)",
        "field": "valueChainStatus",
        "structure": "단일 컨텍스트 구조",
        "datatype": "Text",
        "desc": "진척률 프로그레스 바 밑에 한 줄 설명"
    },
    {
        "ui_layer": "Section 1",
        "attr": "② Dynamic 지표 (변동)",
        "field": "irr (수익률)",
        "structure": "Time-Series (시계열 배열)",
        "datatype": "Array of Objects",
        "desc": "목표(UW), 분기별 추정 IRR, 엑시트 확정 IRR 등 궤적"
    },
    {
        "ui_layer": "Section 1",
        "attr": "② Dynamic 지표 (변동)",
        "field": "completionDate (준공일)",
        "structure": "Date Series (마일스톤 배열)",
        "datatype": "Array of Objects",
        "desc": "최초 계획일, 변경 승인일, 실제 완료일 누적"
    },
    {
        "ui_layer": "Section 1",
        "attr": "③ Context 텍스트 (RAG)",
        "field": "decisionContextLog",
        "structure": "Log Series (로그 누적 배열)",
        "datatype": "Array of Objects",
        "desc": "월간/분기별 의사결정 맥락(금리, 전략 수정) 타임라인"
    },
    {
        "ui_layer": "Section 3 (중단)",
        "attr": "② Dynamic 지표 (변동)",
        "field": "equity_loan_ratio (LTV)",
        "structure": "Time-Series (시계열 배열)",
        "datatype": "Array of Objects",
        "desc": "기표 시점 LTV, 리파이낸싱 후 LTV 추이"
    },
    {
        "ui_layer": "Section 1",
        "attr": "② Dynamic 지표 (변동)",
        "field": "occupancy (전체 임대율)",
        "structure": "Time-Series (시계열 배열)",
        "datatype": "Array of Objects",
        "desc": "분기별 전체 임대율 꺾은선 차트용 시계열"
    },
    {
        "ui_layer": "Section 1",
        "attr": "② Dynamic 지표 (변동)",
        "field": "walt (잔여 임대기간)",
        "structure": "Time-Series (시계열 배열)",
        "datatype": "Array of Objects",
        "desc": "분기/반기별 잔여 임대기간 평균 변동 폭"
    },
    {
        "ui_layer": "Section 1",
        "attr": "② Dynamic 지표 (변동)",
        "field": "closingDate (딜 클로징)",
        "structure": "Date Series (마일스톤 배열)",
        "datatype": "Array of Objects",
        "desc": "지연 히스토리 및 최종 완료 노드 관리"
    },
    {
        "ui_layer": "Section 1",
        "attr": "② Dynamic 지표 (변동)",
        "field": "pfDrawdown (기표일)",
        "structure": "Date Series (마일스톤 배열)",
        "datatype": "Array of Objects",
        "desc": "트랜치(Tranche)별 기표 내역 및 일정 관리"
    },
    {
        "ui_layer": "Section 1",
        "attr": "③ Context 텍스트 (RAG)",
        "field": "productStrategy",
        "structure": "단일 컨텍스트 구조",
        "datatype": "Text",
        "desc": "상품/브랜드 전략"
    },
    {
        "ui_layer": "Section 1",
        "attr": "③ Context 텍스트 (RAG)",
        "field": "retailTenantStrategy",
        "structure": "단일 컨텍스트 구조",
        "datatype": "Text",
        "desc": "저층 F&B 60% 우선유치 타겟팅 등"
    },
    {
        "ui_layer": "Section 4 (하단)",
        "attr": "① Static 프로필 (불변)",
        "field": "vehicle_type / name",
        "structure": "단일 구조",
        "datatype": "Enum/String",
        "desc": "이지스전문투자형 389호"
    },
    {
        "ui_layer": "Section 1",
        "attr": "① Static 프로필 (불변)",
        "field": "partners",
        "structure": "단일 구조 (혹은 Array)",
        "datatype": "Array of Strings",
        "desc": "시공/설계/파트너 연락망 배열"
    }
];
    const schemaNotesData = [
    "1. 데이터 속성 (Data Attribute)",
    "비즈니스 관점에서 이 데이터가 \"어떤 성격과 주기를 띠는가?\"를 정의",
    "데이터가 시간에 따라 변하는지, 아니면 고유한 이름으로 존재하는지를 비즈니스 로직 기준으로 세 가지로 분류.",
    "① Static 프로필 (불변): 자산의 이름, 건축 목적, 펀드명, 담당자 이름 등.",
    "② Dynamic 지표 (변동): 임대율, 수익률(IRR), 사업비(AUM), 매각가 등 운영 효율이나 시장 상황에 따라 실시간 혹은 주기적으로 숫자가 변하는 핵심 성과 지표. (대표님 C레벨 트래킹)",
    "③ Context Text (RAG): 리스크 로그, 의사결정 맥락 등 단순 숫자가 아니라 왜 그렇게 되었는지 이야기가 필요한 정성적 데이터\" 이 시스템의 핵심 고도화 요소인 RAG(검색 증강 생성) AI가 사용자 질문에 대답하기 위해 긁어가는 핵심 지식 창고 역할.",
    "2. 데이터 구조 (Data Structure)",
    "정보 설계 관점에서 이 데이터를 \"어떻게 담아둘 것인가?\"를 정의.",
    "이 데이터가 단순히 하나의 칸에만 입력되는지, 아니면 차트를 그리기 위해 층층이 쌓여야 하는지를 정의하는 '설계도(Architecture)' 개념.",
    "- 단일 구조 / 단일 컨텍스트 구조: 현재 시점의 \"딱 하나의 값\"만 가지는 1차원적 구조. (예: assetName = \"더케이트윈타워\")",
    "- Time-Series (시계열 배열): 하나의 지표(예: 평당 임대료)에 대해 \"목표는 얼마였는데, 1분기엔 얼마였고, 2분기엔 얼마였다\"를 선(Line)처럼 누적해서 그려내는 구조.",
    "- Date Series (마일스톤 배열): \"사전임대 시작 노드\"처럼 날짜 자체의 궤적(예시: 원래 8월 예정이었으나 우천 지연으로 9월 승인, 최종 10월 완료결재)을 쌓아두는 구조.",
    "- Log Series (로그 누적 배열): 카카오톡 대화방이나 회의록처럼, 특정 일자마다 발생한 리스크 메모나 의사결정 코멘트들을 차곡차곡 쌓아가는 구조.",
    "3. 데이터 타입 (Data Type)",
    "프로그래밍 관점에서 이 데이터에 \"어떤 형태의 값을 입력할 수 있는가?\"를 정의한다.",
    "프로그래머들이 실제 데이터베이스 제약 조건(Validation)을 걸 때 사용하는 원시적인(Primitive) 프로그래밍 단위.",
    "- String / Text: 평범한 글자(문자열). (예: \"정영진\", \"하층부 F&B 전략\")",
    "- Enum (선택형): 정해진 드롭다운 목록에서 선택 (예: \"커머셜, 입찰단계, 오피스\")",
    "- Number / Float: 연산(더하기, 빼기 등)이 가능한 순수 숫자나 소수점. 단위 글자인 '원', '%' 등은 숫자 뒤에 UI에서 따로 붙인다.",
    "- Date: 날짜 연산(목표일-현재일=D-day)이 가능한 표준 시각 규격만. (예: 2025-08-30)",
    "- Array (배열) / Array of Objects: 위에 설명한 Time-Series나 Log Series를 실제로 구현하기 위해, 괄호 [ ] 안에 여러 개의 덩어리(Object)들을 콤마로 무한정 집어넣을 수 있는 데이터 타입."
];
    const schemaDraftsData = [
    "보여줘야할 화면의 정리(Draft-개발자산상세) (최상위부터, DB 테이블 구성을 위함)",
    "- 이 프로젝트의 이름은 : \"이오타서울(816)\" - Static / 단일구조 / String",
    "- 비히클 : PFV (Fund/PFV)",
    "- 이 프로젝트의 리스크 우선순위는 : \"High\" - Static / 단일구조 / Enum",
    "ㄴ 다른 High 프로젝트 보기",
    "- 이 프로젝트의 섹터/주용도/사업형태는 : \"커머셜, 오피스, 개발\" - Static / 단일구조 / Enum",
    "ㄴ 각 텍스트는 클릭할 수 있으며, 클릭하면 해당 프로젝트가 리스트된 화면으로 이동한다.",
    "- 이 프로젝트의 입찰/수의 분류는 : \"입찰\" - Static / 단일구조 / Enum",
    "- 지금까지 이러이러한 이슈가 있었고, 이렇게 처리했다 : \"2026년 3월 클로징 목표로 리파이낸싱을 추진했으나 KB증권 안이 부결되어 현재는 선순위 일부는 메리츠증권, 잔여분은 NH증권이 참여하는 구조를 협의 중임\" - Context Text / Log Series / Text",
    "ㄴ 최근 주요 2~3건을 보여주고 더보기를 통해 창이 확대되며 모든 내용을 확인할 수 있다.",
    "- 이 프로젝트는 현재 10단계 가치 사슬 중 어디에 있다 : \"개발중\" - Static / 단일구조 / Enum",
    "ㄴ 클릭하면 창이 넓어지면서 프로젝트 일정 상세를 확인할 수 있다.",
    "- 예정공급년도 : 2032년",
    "- 권역 : CBD (CBD/GBD/YBD/PBD/기타)",
    "- 오피스등급 : Prime",
    "- 이 프로젝트의 연멱적은 : \"36,537평\"",
    "- 이 사업의 담당자는 이렇다 : \"조직장 000, PO 000, 담당 000\" - Static / 단일구조 / String, Text, Enum",
    "ㄴ 클릭하면 각 담당자 상세페이지로 이동한다 (담당자가 진행중인 모든 프로젝트 및 관련 내용을 망라한 담당자 상세페이지)",
    "- 이 사업의 원가는 : \"8000억(2025.03) -> 9500억(2026.04)\" - Dynamic / Date Series / Number",
    "ㄴ 클릭하면 창이 넓어지면서 원가 변화 히스토리를 확인할 수 있다.(토지비, 공사비, 금융비 및 기타)",
    "- CF",
    "- Financing",
    "- 공정/인허가",
    "- 투자구조 : \"\"",
    "- 고유 투자금은 : \"\"",
    "- 투자자 담당자는 : \"\"",
    "- 수익자 정보 :",
    "- 대주정보 :",
    "- 에쿼티 : \"780억\"",
    "- 론 : \"\"",
    "- 예상 수익률은 : \"\"",
    "- 예상 매각시점 & 매각가",
    "- 개발기간은 :",
    "- 예상 NOC (준공년 기준)",
    "- 자산 개요 : \"사진, 자산명, 소재지, 연면적, 대지면적, 규모(층), 준공일, 기준층전용면적\" - Static / 단일구조 / String, Text, Enum",
    "ㄴ 위 주요 정보만 노출하고 나머지는 더보기를 통해 창이 확대되며 모든 내용을 확인할 수 있다.",
    "- 설계사",
    "- 시공사",
    "- 공간UX 상품기획",
    "- 브랜드 : IOTA (컨셉, 포지셔닝, 계획 등)",
    "- 마케팅(+플레이스메이킹)",
    "- 기업파트너십(SI)",
    "- 리징",
    "- 자료실 : 티저, IM, 심의보고서, 실사보고서, 등",
    "- 리테일",
    "- 전력공급",
    "- 상세스팩",
    "- 이 프로젝트의 자금조달 계획은 : \"PFV는 브릿지론 후순위 대여 700억원(All-in 10.0%)에 대해 소노인터내셔널 확약을 확보했고, 힐튼 재개발사업과 통합 프로젝트 리츠를 설립한 후 통합 PF를 조달해 전반적인 사업구조를 안정화하는 방안도 함께 검토 중임\" - Context Text / Log Series / String, Text",
    "- 이 프로젝트의 펀딩 현황 : \"ㅇㅇㅇㅇ\" - Context Text / Log Series / String, Text",
    "ㄴ 클릭하면 입찰중 프로젝트 리스트로 이동한다.",
    "- 매입 보수는 : \"40억\"",
    "- 펀드 설정일/만기일 :",
    "- 관리 후보자는 : \"사업 : 000 / 관리 : 000\"",
    "- 이 프로젝트의 소싱 컨텍포인트는 : \"CBRE, CW\" - Static / 단일구조 / String, Text, Enum",
    "ㄴ 각 텍스트를 클릭하면 해당 컨텍포인트사(매각자문사)의 상세페이지로 이동한다."
];

    // Sidebar structure
    const navigationStructure = [
        {
            title: 'IFPDP SYSTEMS',
            items: [
                { id: 'ifpdp-proposal', label: '시스템 기획안' },
                { id: 'ifpdp-requirements', label: '기능요구사항' },
                { id: 'ifpdp-schema', label: 'DB Schema' }
            ]
        },
        {
            title: 'IOTA CFT Phase 1',
            items: [
                { id: 'phase1-proposal', label: '시스템 기획안' },
                { id: 'phase1-requirements', label: '기능요구사항' },
                { id: 'phase1-schema', label: 'DB Schema' }
            ]
        },
        {
            title: 'IOTA CFT Phase 2',
            items: [
                { id: 'phase2-proposal', label: '시스템 기획안' },
                { id: 'phase2-requirements', label: '기능요구사항' },
                { id: 'phase2-schema', label: 'DB Schema' }
            ]
        }
    ];

    const handleCopyText = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Filter requirements
    const filteredReqs = requirementsData.filter(r => {
        const matchesSearch = r.detail.toLowerCase().includes(reqSearchQuery.toLowerCase()) || 
                              r.category.toLowerCase().includes(reqSearchQuery.toLowerCase()) || 
                              r.subcategory.toLowerCase().includes(reqSearchQuery.toLowerCase()) ||
                              r.actor.toLowerCase().includes(reqSearchQuery.toLowerCase());
        const matchesScope = reqFilterScope === 'all' || r.scope === reqFilterScope;
        return matchesSearch && matchesScope;
    });

    const filteredPhase1Reqs = phase1RequirementsData.filter(r => {
        const matchesSearch = r.detail.toLowerCase().includes(phase1ReqSearchQuery.toLowerCase()) || 
                              r.category.toLowerCase().includes(phase1ReqSearchQuery.toLowerCase()) || 
                              r.subcategory.toLowerCase().includes(phase1ReqSearchQuery.toLowerCase()) ||
                              r.actor.toLowerCase().includes(phase1ReqSearchQuery.toLowerCase());
        const matchesScope = phase1ReqFilterScope === 'all' || r.scope === phase1ReqFilterScope;
        return matchesSearch && matchesScope;
    });

    if (loading) {
        return (
            <div className="w-full h-screen bg-[#FFFFFF] flex flex-col items-center justify-center text-[#1C1C1C]" style={interFont}>
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[12px] text-gray-500">VERIFYING SESSION...</span>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="w-full h-screen bg-[#FFFFFF] flex flex-col items-center justify-center p-8 text-center text-[#1C1C1C] select-none" style={interFont}>
                <h2 className="text-[20px] font-bold text-black mb-2 uppercase">Access Restricted</h2>
                <p className="text-[13px] text-gray-500 max-w-[420px] leading-relaxed">
                    This platform is restricted to executive management. Authorized credentials are required for entry.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-[#FFFFFF] text-[#1C1C1C] font-sans flex overflow-hidden">
            {/* Sidebar Navigator - Clean Blackstone Light Style */}
            <aside className="w-[230px] border-r border-gray-200 bg-[#F9F9FB] flex flex-col justify-between shrink-0 select-none">
                <div className="flex flex-col flex-1 overflow-y-auto hide-scrollbar p-6">
                    {/* Header Anchor */}
                    <div className="mb-8">
                        <h2 className="text-[16px] font-bold text-[#1C1C1C] mt-1 leading-tight" style={interFont}>IFPDP System Report</h2>
                        <div className="h-[1px] bg-gray-200 w-full mt-4"></div>
                    </div>

                    {/* Nav Sections */}
                    <nav className="flex flex-col gap-6">
                        {navigationStructure.map((section, sIdx) => (
                            <div key={sIdx} className="flex flex-col">
                                <h3 className="text-[10px] font-bold text-gray-400 mb-2 px-2 uppercase" style={interFont}>
                                    {section.title}
                                </h3>
                                <div className="flex flex-col gap-0.5">
                                    {section.items.map((item) => {
                                        const isSelected = selectedMenu === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setSelectedMenu(item.id)}
                                                className={`text-left px-3 py-1.5 rounded-none text-[12.5px] transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-white text-black font-semibold pl-3' 
                                                        : 'text-gray-500 hover:text-black hover:bg-gray-100/50 font-normal pl-3'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Bottom User profile */}
                <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none border border-gray-300 bg-gray-50 text-black flex items-center justify-center font-bold text-[12px]" style={interFont}>
                            {memberInfo?.staff_name ? memberInfo.staff_name.substring(0,1) : 'U'}
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-[12px] font-bold text-black leading-tight">
                                {getStaffTitle(memberInfo)}
                            </span>
                            <span className="text-gray-400 text-[10px] leading-none mt-0.5 truncate max-w-[150px]" style={interFont}>
                                {memberInfo?.email || 'authenticated'}
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Content Panel */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#FFFFFF]">
                {/* 1. IFPDP - 시스템 기획안 */}
                {selectedMenu === 'ifpdp-proposal' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IFPDP</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>System Proposal</span>
                            </div>
                            <button onClick={() => handleCopyText(`
 | IFPDP 시스템 기획안


1. 플랫폼 기획 의도 및 목적

부서 간 데이터 통합 및 의사결정 지원 
현재 자산운용 과정에서 부서별(소싱, 투자, 개발, 운영 등)로 분산된 데이터와 문서(엑셀, PDF 등)를 중앙화한다. 
IFPDP는 각 부서의 정량적 데이터와 정성적인 의사결정 이력(Context Graph)을 통합하여 정보 취합에 소요되는 지연 시간을 없애고 정확한 의사결정을 지원하는 전사(Enterprise) 통합 시스템을 지향한다.

3-Pane 하이브리드 UX 도입
단순 텍스트 챗봇의 시각적 한계를 극복하기 위해, '고정형 데이터 대시보드'와 '대화형 AI 보조 패널'을 결합한 3분할(3-Pane) 인터페이스를 도입했다. 
좌측 내비게이션으로 시스템을 탐색하고, 중앙 대시보드에서 주요 정보(데이터 차트, 문서 등)를 확인하며, 우측 패널의 AI를 통해 즉각적인 데이터 요약 및 조작을 지시하는 직관적인 워크플로우를 제공한다.



2. SSOT (Single Source of Truth) 코어 시스템 아키텍처

자산 객체 기반의 그룹 데이터 통합 (SSOT의 확장)
플랫폼의 기능 요구사항을 각각 별도의 메뉴와 테이블로 파편화하여 개발하지 않는다. 플랫폼의 근간 원자(Atom) 단위인 [개별 자산 상세 객체]를 단일 진실 공급원(SSOT)으로 둔다.

개별 자산 객체에 입력되는 기초 데이터(AUM, 일정, 수익률, 담당자 등)가 완벽하게 통제될 경우, "그룹 거시 지표(센터별 매출, OKR 등)" 및 "투자자(LP) 종합 뷰"는 시스템이 개별 자산들을 취합(Aggregation)하여 자동 산출하는 구조다. 
즉, 자산의 10대 가치사슬, 기업 임차 정보, 파이낸싱 등 미시적 정보들이 모여 전사 관점의 거시적 대시보드를 렌더링하는 완벽한 정합성을 보장한다.



3. IFPDP 통합 플랫폼 7대 핵심 데이터베이스(DB) 모듈
파이프라인 실무 시트, 기능 요구사항 명세서 및 종합 자산운용사의 필수 컴플라이언스(Compliance) 요건을 모두 망라하여 구조화한 7대 데이터 모듈

① 자산 개요, 비히클 및 조직 (Core Identity & Vehicle)
자산 기본 구조: 자산/프로젝트명, 주요 용도(상업용, 물류, 주거, 코리빙, 복합 등), 대지/연면적 정보.
비히클(Vehicle) 통제: 설정 형태(Fund, PFV, REITs, SPC), 펀드 호수명(Ex. 468-2호).
조직 및 인력 배분: 의사결정권자(Director), 책임(PD), 실무 담당(PM) 지정 내역 및 리얼에셋 그룹 내 인력 배분 현황.

② 자본 스택 및 수익자(LP) 관리 (Capital & LP Reporting)
파이낸싱 구조(LFC): 에쿼티/론 총액, 조달 트랜치별 금리(선순위/중순위/후순위), LTV, 리파이낸싱 스케줄.
현금흐름(CF) 및 펀드 분배: 누적 배당 현황, 예상 vs 실제 매입가/평가액 비교, 캐피탈 콜(Capital Call) 일정, 수익자 워터폴(Waterfall) 결산.
투자자(LP) 통합 연계: 기관 유형 및 투자 성향별 LP 분류, 매각/매입 주관사(SI, PB 등) 컨택 이력, 이지스 예상 수취 보수(매입/운용/매각 보수).

③ 10단계 가치사슬 및 시계열 트래킹 (Value Chain & Time-Series)
소싱 파이프라인: 딜 티저 접수 이력, CA 검토, 실사, 우선협상자 선정에 이르는 모든 소싱 히스토리.
전체 생애주기 일정 (시계열 캘린더링): 매입(투자)일, PF 인출일, 착공일, 준공일, 대출 만기(연장)일, 펀드 만기일 및 예상 엑시트(매각) 완료 일정 등 타임라인 데이터베이스화.

④ 개발 상품 기획 및 ESG 전략 (Product, Construction & ESG)
투자/개발 전략: Core, Value-added, Opportunistic 등 전략 분류. 부실 자산(NPL) 정상화 플랜 유무. 단일 건축안 vs 인접 부지 통합 개발안 등 복수 시나리오 타당성 비교 데이터.
하드 코스트 및 인허가: 증축, 리모델링, 철거, 관할청 사업 인허가 상황, 전력 공급 및 주요 설비(건축, 구조, 공조, 통신) 스펙.
설계 및 시공 파트너: 시공사 도급 순위, 설계사 기본 정보 및 사업 이력 현황.
공간 기획 및 ESG: 프롭테크(Space UX/Tech) 도입 현황, 친환경 설계(LEED, GRESB 등 인증), 에너지 효율화 지표.

⑤ 실물 운영 및 임차인 네트워크 (Asset Ops & Corporate Leasing)
임대차 및 수익률 방어: 오피스 및 리테일 MD 앵커 테넌트 입점 이력, 임대율(Occupancy), 가중평균 잔여 임대기간(WALT) 방어율, 자본적 지출(CAPEX) 내역.
FM/PM 관리: 주요 하자 보수 이력 플랫폼 연동.
임차 기업 니즈(Needs) 타겟팅: 국내 Top 100 기업별 특수 임차 조건(산업 유형별 선호 면적 및 위치) 트래킹 및 당사 보유/신규 자산과의 매칭 가능성 분석 데이터.

⑥ 거시 지표 및 부서별 성과 관리 (Macro OKR & Market)
그룹 전사 목표(OKR): 펀드 수익 및 수수료 기반의 전사 매출 달성률 현황, 하부 부서별(본부 센터) 진척도 자동 추적.
외부 마켓 인텔리전스: 주요 대형 임차인의 이탈/이동 시장 동향, 대형 시공사의 외부 재무 리스크 이슈 타임라인 모니터링.

⑦ 의사결정 맥락 엔진 및 리스크 통제 (Context Graph & Compliance)
레드 플래그(Red Flags) 우선순위: 준공 지연, 대규모 공실 우려, 재융자 불가 등 딜 브레이커 요소를 심각도(Red/Yellow/Green) 기준으로 시각화 및 알림 표출.
의사결정 이력 (Context Graph): 론 조건 변경, 수익률 하향 조정, 매각 시기 연기 등 재단/투자위에서 중대한 결정이 내려질 당시의 배경 사유와 정성적 판단 근거 기록.
내부 통제(Compliance): 자산운용사 필수 법적 준수 요건, 이해상충 방지, 특정 문서 제출 기한 및 위원회 결재 로그 아카이빙.



4. 시스템 설계 구현 타당성

초기 프론트엔드 플랫폼 개발 관점에서의 작동 타당성 및 구현 전략은 아래와 같다.

1. 상세 자산 단위의 시나리오 구현: 7대 DB 모듈에 담길 수많은 전사 데이터를 후방에서 일시 구축하는 것은 현실적으로 불가능하다. 
따라서 프론트엔드 단계에서는 1~2개 핵심 자산(예: 더케이트윈타워)에 대한 기능적 흐름(Golden Path)만을 하드코딩된 API 모크업(Mock-up) 단위로 시각화하여 플랫폼의 거대 커버리지를 입증한다.

2. 모듈형 아키텍처 (패널 간 분리 기능): 시각 리소스를 압도적으로 요구하는 중앙 메인 대시보드(시스템 데이터 화면)와 상황 인식 연산이 필요한 대화형 AI 패널 영역을 코드 레벨에서 상호 격리(Decoupling)한다. 
이를 통해 각 모듈(1~7번)의 데이터 패시징 및 기능 확장을 상호 충돌이나 성능 저하 없이 구현할 수 있다.



`)} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Plain Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-12 hide-scrollbar">
                            <div className="max-w-[800px] flex flex-col gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase" style={interFont}>MEMORANDUM</span>
                                    <h1 className="text-[16px] font-bold text-black leading-tight mt-1" style={interFont}>IFPDP 시스템 기획안</h1>
                                    <p className="text-[13px] text-gray-500 mt-2 font-sans" style={interFont}>부서 간 데이터 통합 및 의사결정 지원을 위한 전사 자산 관제 시스템 설계안</p>
                                    <div className="h-[1px] bg-black w-full mt-6"></div>
                                </div>

                                {/* Section 1 */}
                                <div className="flex flex-col gap-4 border-b border-gray-200 pb-8">
                                    <h2 className="text-[16px] font-bold text-black uppercase border-b border-gray-100 pb-2" style={interFont}>
                                        1. 플랫폼 기획 의도 및 목적
                                    </h2>
                                    <div className="flex flex-col gap-6 pl-1">
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className="text-[14px] font-bold text-black">
                                                가. 부서 간 데이터 통합 및 의사결정 지원
                                            </h3>
                                            <p className="text-[13.5px] text-gray-700 leading-relaxed font-sans">
                                                현재 자산운용 과정에서 부서별(소싱, 투자, 개발, 운영 등)로 분산된 데이터와 문서(엑셀, PDF 등)를 중앙화한다. IFPDP는 각 부서의 정량적 데이터와 정성적인 의사결정 이력(Context Graph)을 통합하여 정보 취합에 소요되는 지연 시간을 없애고 정확한 의사결정을 지원하는 전사(Enterprise) 통합 시스템을 지향한다.
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className="text-[14px] font-bold text-black">
                                                나. 3-Pane 하이브리드 UX 도입
                                            </h3>
                                            <p className="text-[13.5px] text-gray-700 leading-relaxed font-sans">
                                                단순 텍스트 챗봇의 시각적 한계를 극복하기 위해, '고정형 데이터 대시보드'와 '대화형 AI 보조 패널'을 결합한 3분할(3-Pane) 인터페이스를 도입했다. 좌측 내비게이션으로 시스템을 탐색하고, 중앙 대시보드에서 주요 정보(데이터 차트, 문서 등)를 확인하며, 우측 패널의 AI를 통해 즉각적인 데이터 요약 및 조작을 지시하는 직관적인 워크플로우를 제공한다.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2 */}
                                <div className="flex flex-col gap-4 border-b border-gray-200 pb-8">
                                    <h2 className="text-[16px] font-bold text-black uppercase border-b border-gray-100 pb-2" style={interFont}>
                                        2. SSOT (Single Source of Truth) 코어 시스템 아키텍처
                                    </h2>
                                    <div className="flex flex-col gap-2 pl-1">
                                        <h3 className="text-[14px] font-bold text-black">가. 자산 객체 기반의 그룹 데이터 통합 (SSOT의 확장)</h3>
                                        <p className="text-[13.5px] text-gray-700 leading-relaxed font-sans">
                                            플랫폼의 기능 요구사항을 각각 별도의 메뉴와 테이블로 파편화하여 개발하지 않는다. 플랫폼의 근간 원자(Atom) 단위인 [개별 자산 상세 객체]를 단일 진실 공급원(SSOT)으로 둔다. 개별 자산 객체에 입력되는 기초 데이터(AUM, 일정, 수익률, 담당자 등)가 완벽하게 통제될 경우, "그룹 거시 지표(센터별 매출, OKR 등)" 및 "투자자(LP) 종합 뷰"는 시스템이 개별 자산들을 취합(Aggregation)하여 자동 산출하는 구조다. 즉, 자산의 10대 가치사슬, 기업 임차 정보, 파이낸싱 등 미시적 정보들이 모여 전사 관점의 거시적 대시보드를 렌더링하는 완벽한 정합성을 보장한다.
                                        </p>
                                    </div>
                                </div>

                                {/* Section 3 */}
                                <div className="flex flex-col gap-4 border-b border-gray-200 pb-8">
                                    <h2 className="text-[16px] font-bold text-black uppercase border-b border-gray-100 pb-2" style={interFont}>
                                        3. IFPDP 통합 플랫폼 7대 핵심 데이터베이스(DB) 모듈
                                    </h2>
                                    <p className="text-[13px] text-gray-500 -mt-2">파이프라인 실무 시트, 기능 요구사항 명세서 및 종합 자산운용사의 필수 컴플라이언스(Compliance) 요건을 모두 망라하여 구조화한 7대 데이터 모듈</p>
                                    <div className="flex flex-col gap-4 pl-1">
                                        {[
                                            { title: '① 자산 개요, 비히클 및 조직 (Core Identity & Vehicle)', desc: '자산 기본 구조: 자산/프로젝트명, 주요 용도(상업용, 물류, 주거, 코리빙, 복합 등), 대지/연면적 정보. 비히클(Vehicle) 통제: 설정 형태(Fund, PFV, REITs, SPC), 펀드 호수명(Ex. 468-2호). 조직 및 인력 배분: 의사결정권자(Director), 책임(PD), 실무 담당(PM) 지정 내역 및 리얼에셋 그룹 내 인력 배분 현황.' },
                                            { title: '② 자본 스택 및 수익자(LP) 관리 (Capital & LP Reporting)', desc: '파이낸싱 구조(LFC): 에쿼티/론 총액, 조달 트랜치별 금리(선순위/중순위/후순위), LTV, 리파이낸싱 스케줄. 현금흐름(CF) 및 펀드 분배: 누적 배당 현황, 예상 vs 실제 매입가/평가액 비교, 캐피탈 콜(Capital Call) 일정, 수익자 워터폴(Waterfall) 결산. 투자자(LP) 통합 연계: 기관 유형 및 투자 성향별 LP 분류, 매각/매입 주관사(SI, PB 등) 컨택 이력, 이지스 예상 수취 보수(매입/운용/매각 보수).' },
                                            { title: '③ 10단계 가치사슬 및 시계열 트래킹 (Value Chain & Time-Series)', desc: '소싱 파이프라인: 딜 티저 접수 이력, CA 검토, 실사, 우선협상자 선정에 이르는 모든 소싱 히스토리. 전체 생애주기 일정 (시계열 캘린더링): 매입(투자)일, PF 인출일, 착공일, 준공일, 대출 만기(연장)일, 펀드 만기일 및 예상 엑시트(매각) 완료 일정 등 타임라인 데이터베이스화.' },
                                            { title: '④ 개발 상품 기획 및 ESG 전략 (Product, Construction & ESG)', desc: '투자/개발 전략: Core, Value-added, Opportunistic 등 전략 분류. 부실 자산(NPL) 정상화 플랜 유무. 단일 건축안 vs 인접 부지 통합 개발안 등 복수 시나리오 타당성 비교 데이터. 하드 코스트 및 인허가: 증축, 리모델링, 철거, 관할청 사업 인허가 상황, 전력 공급 및 주요 설비(건축, 구조, 공조, 통신) 스펙. 설계 및 시공 파트너: 시공사 도급 순위, 설계사 기본 정보 및 사업 이력 현황. 공간 기획 및 ESG: 프롭테크(Space UX/Tech) 도입 현황, 친환경 설계(LEED, GRESB 등 인증), 에너지 효율화 지표.' },
                                            { title: '⑤ 실물 운영 및 임차인 네트워크 (Asset Ops & Corporate Leasing)', desc: '임대차 및 수익률 방어: 오피스 및 리테일 MD 앵커 테넌트 입점 이력, 임대율(Occupancy), 가중평균 잔여 임대기간(WALT) 방어율, 자본적 지출(CAPEX) 내역. FM/PM/관리: 주요 하자 보수 이력 플랫폼 연동. 임차 기업 니즈(Needs) 타겟팅: 국내 Top 100 기업별 특수 임차 조건(산업 유형별 선호 면적 및 위치) 트래킹 및 당사 보유/신규 자산과의 매칭 가능성 분석 데이터.' },
                                            { title: '⑥ 거시 지표 및 부서별 성과 관리 (Macro OKR & Market)', desc: '그룹 전사 목표(OKR): 펀드 수익 및 수수료 기반의 전사 매출 달성률 현황, 하부 부서별(본부 센터) 진척도 자동 추적. 외부 마켓 인텔리전스: 주요 대형 임차인의 이탈/이동 시장 동향, 대형 시공사의 외부 재무 리스크 이슈 타임라인 모니터링.' },
                                            { title: '⑦ 의사결정 맥락 엔진 및 리스크 통제 (Context Graph & Compliance)', desc: '레드 플래그(Red Flags) 우선순위: 준공 지연, 대규모 공실 우려, 재융자 불가 등 딜 브레이커 요소를 심각도(Red/Yellow/Green) 기준으로 시각화 및 알림 표출. 의사결정 이력 (Context Graph): 론 조건 변경, 수익률 하향 조정, 매각 시기 연기 등 재단/투자위에서 중대한 결정이 내려질 당시의 배경 사유와 정성적 판단 근거 기록. 내부 통제(Compliance): 자산운용사 필수 법적 준수 요건, 이해상충 방지, 특정 문서 제출 기한 및 위원회 결재 로그 아카이빙.' }
                                        ].map((mod, idx) => (
                                            <div key={idx} className="flex flex-col gap-1 pl-1 py-1">
                                                <h4 className="text-[13.5px] font-bold text-black">{mod.title}</h4>
                                                <p className="text-[13px] text-gray-600 leading-relaxed font-sans">{mod.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 4 */}
                                <div className="flex flex-col gap-4">
                                    <h2 className="text-[16px] font-bold text-black uppercase border-b border-gray-100 pb-2" style={interFont}>
                                        4. 시스템 설계 구현 타당성
                                    </h2>
                                    <div className="flex flex-col gap-4 pl-1">
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-[13.5px] font-bold text-black">가. 상세 자산 단위의 시나리오 구현</h4>
                                            <p className="text-[13px] text-gray-700 leading-relaxed">
                                                7대 DB 모듈에 담길 수많은 전사 데이터를 후방에서 일시 구축하는 것은 현실적으로 불가능하다. 따라서 프론트엔드 단계에서는 1~2개 핵심 자산(예: 더케이트윈타워)에 대한 기능적 흐름(Golden Path)만을 하드코딩된 API 모크업(Mock-up) 단위로 시각화하여 플랫폼의 거대 커버리지를 입증한다.
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-[13.5px] font-bold text-black">나. 모듈형 아키텍처 (패널 간 분리 기능)</h4>
                                            <p className="text-[13px] text-gray-700 leading-relaxed">
                                                시각 리소스를 압도적으로 요구하는 중앙 메인 대시보드(시스템 데이터 화면)와 상황 인식 연산이 필요한 대화형 AI 패널 영역을 코드 레벨에서 상호 격리(Decoupling)한다. 이를 통해 각 모듈(1~7번)의 데이터 패시징 및 기능 확장을 상호 충돌이나 성능 저하 없이 구현할 수 있다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. IFPDP - 기능요구사항 */}
                {selectedMenu === 'ifpdp-requirements' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IFPDP</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>Functional Specifications</span>
                            </div>
                            <button onClick={() => handleCopyText(requirementsData.map(r => `${r.scope} | ${r.category} | ${r.subcategory} | ${r.actor} | ${r.detail}`).join('\n'))} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 flex flex-col overflow-hidden p-12 gap-4 max-w-[1000px] w-full">
                            {/* Filter Bar - Dry Blackstone Style */}
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-200 pb-4 shrink-0">
                                <div className="flex border border-gray-300 divide-x divide-gray-300">
                                    {['all', '내부', '외부'].map(sc => (
                                        <button
                                            key={sc}
                                            onClick={() => setReqFilterScope(sc)}
                                            className={`px-4 py-1 text-[11px] font-semibold uppercase transition-all cursor-pointer ${
                                                reqFilterScope === sc 
                                                    ? 'bg-black text-white' 
                                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                            }`}
                                            style={interFont}
                                        >
                                            {sc === 'all' ? 'All Scope' : sc}
                                        </button>
                                    ))}
                                </div>
                                <div className="w-full sm:w-[280px]">
                                    <input 
                                        type="text" 
                                        placeholder="SEARCH KEYWORD..." 
                                        value={reqSearchQuery}
                                        onChange={(e) => setReqSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-none px-3 py-1 text-black text-[11px] outline-none focus:border-black uppercase placeholder-gray-400"
                                        style={interFont}
                                    />
                                </div>
                            </div>

                            {/* Requirements Grid Table - Institutional Minimal Style */}
                            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                <div className="w-full overflow-x-auto overflow-y-auto flex-1 border border-gray-200 select-text">
                                    <table className="w-full border-collapse text-[12px] text-left">
                                        <thead className="bg-[#F9F9FB] text-black font-semibold border-b border-gray-200 sticky top-0 z-10 select-none">
                                            <tr>
                                                <th className="px-4 py-3 w-[80px]" style={interFont}>구분</th>
                                                <th className="px-4 py-3 w-[110px]" style={interFont}>대분류</th>
                                                <th className="px-4 py-3 w-[110px]" style={interFont}>세부분류</th>
                                                <th className="px-4 py-3 w-[90px]" style={interFont}>엑터</th>
                                                <th className="px-4 py-3" style={interFont}>기능상세</th>
                                                <th className="px-4 py-3 w-[100px]" style={interFont}>실행주관</th>
                                                <th className="px-4 py-3 w-[120px]" style={interFont}>비고</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 text-gray-700 bg-white">
                                            {filteredReqs.length > 0 ? (
                                                filteredReqs.map((req, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-3 font-semibold text-black">{req.scope}</td>
                                                        <td className="px-4 py-3 text-black font-medium">{req.category}</td>
                                                        <td className="px-4 py-3 text-gray-500">{req.subcategory}</td>
                                                        <td className="px-4 py-3 text-gray-500">{req.actor}</td>
                                                        <td className="px-4 py-3 text-black leading-relaxed font-sans">{req.detail}</td>
                                                        <td className="px-4 py-3 text-black font-medium">{req.main_dept}</td>
                                                        <td className="px-4 py-3 text-[11.5px] text-gray-500">{req.note || '-'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-20 text-gray-400">데이터가 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="py-2.5 text-[11px] text-gray-500 font-semibold flex justify-between select-none" style={interFont}>
                                    <span>TOTAL: {requirementsData.length} ITEMS</span>
                                    <span>FILTERED: {filteredReqs.length} ITEMS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. IFPDP - DB Schema */}
                {selectedMenu === 'ifpdp-schema' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IFPDP</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>Schema Specification</span>
                            </div>
                            <button onClick={() => handleCopyText(` | IFPDP Asset Data Schema v2.0 (다중 필드/시계열 반영)
 | 화면영역 (UI 계층) | 데이터 속성  | DB 필드명 | 데이터 구조  | 데이터 타입 | 설명 및 화면 맵핑 예제
 | Section 1 (최상단) | ① Static 프로필 (불변) | missionId / assetName | 단일 구조 | String | 더케이트윈타워 매입 프로젝트
 |  | ① Static 프로필 (불변) | assetClass / address | 단일 구조 | Enum/String | 오피스/리테일
 |  | ② Dynamic 지표 (변동) | aum (총 사업규모) | Time-Series (시계열 배열) | Array of Objects | UW, BP, 실제 연도별 사업비 변동 추이 누적
 |  | ① Static 프로필 (불변) | director / pm | 단일 구조 | String | 정영진 / 장민호
 |  | ③ Context 텍스트 (RAG) | redFlagsStatus | Log Series (로그 누적 배열) | Array of Objects | 시점별 리스크 발생 및 해소 내역 누적 로깅
 | Section 2 (상단) | ③ Context 텍스트 (RAG) | valueChainStatus | 단일 컨텍스트 구조 | Text | 진척률 프로그레스 바 밑에 한 줄 설명
 |  | ② Dynamic 지표 (변동) | irr (수익률) | Time-Series (시계열 배열) | Array of Objects | 목표(UW), 분기별 추정 IRR, 엑시트 확정 IRR 등 궤적
 |  | ② Dynamic 지표 (변동) | completionDate (준공일) | Date Series (마일스톤 배열) | Array of Objects | 최초 계획일, 변경 승인일, 실제 완료일 누적
 |  | ③ Context 텍스트 (RAG) | decisionContextLog | Log Series (로그 누적 배열) | Array of Objects | 월간/분기별 의사결정 맥락(금리, 전략 수정) 타임라인
 | Section 3 (중단) | ② Dynamic 지표 (변동) | equity_loan_ratio (LTV) | Time-Series (시계열 배열) | Array of Objects | 기표 시점 LTV, 리파이낸싱 후 LTV 추이
 |  | ② Dynamic 지표 (변동) | occupancy (전체 임대율) | Time-Series (시계열 배열) | Array of Objects | 분기별 전체 임대율 꺾은선 차트용 시계열
 |  | ② Dynamic 지표 (변동) | walt (잔여 임대기간) | Time-Series (시계열 배열) | Array of Objects | 분기/반기별 잔여 임대기간 평균 변동 폭
 |  | ② Dynamic 지표 (변동) | closingDate (딜 클로징) | Date Series (마일스톤 배열) | Array of Objects | 지연 히스토리 및 최종 완료 노드 관리
 |  | ② Dynamic 지표 (변동) | pfDrawdown (기표일) | Date Series (마일스톤 배열) | Array of Objects | 트랜치(Tranche)별 기표 내역 및 일정 관리
 |  | ③ Context 텍스트 (RAG) | productStrategy | 단일 컨텍스트 구조 | Text | 상품/브랜드 전략
 |  | ③ Context 텍스트 (RAG) | retailTenantStrategy | 단일 컨텍스트 구조 | Text | 저층 F&B 60% 우선유치 타겟팅 등
 | Section 4 (하단) | ① Static 프로필 (불변) | vehicle_type / name | 단일 구조 | Enum/String | 이지스전문투자형 389호
 |  | ① Static 프로필 (불변) | partners | 단일 구조 (혹은 Array) | Array of Strings | 시공/설계/파트너 연락망 배열

 | 1. 데이터 속성 (Data Attribute)
비즈니스 관점에서 이 데이터가 "어떤 성격과 주기를 띠는가?"를 정의
데이터가 시간에 따라 변하는지, 아니면 고유한 이름으로 존재하는지를 비즈니스 로직 기준으로 세 가지로 분류.

① Static 프로필 (불변): 자산의 이름, 건축 목적, 펀드명, 담당자 이름 등.
② Dynamic 지표 (변동): 임대율, 수익률(IRR), 사업비(AUM), 매각가 등 운영 효율이나 시장 상황에 따라 실시간 혹은 주기적으로 숫자가 변하는 핵심 성과 지표. (대표님 C레벨 트래킹)
③ Context Text (RAG): 리스크 로그, 의사결정 맥락 등 단순 숫자가 아니라 왜 그렇게 되었는지 이야기가 필요한 정성적 데이터" 이 시스템의 핵심 고도화 요소인 RAG(검색 증강 생성) AI가 사용자 질문에 대답하기 위해 긁어가는 핵심 지식 창고 역할.


2. 데이터 구조 (Data Structure)
정보 설계 관점에서 이 데이터를 "어떻게 담아둘 것인가?"를 정의.
이 데이터가 단순히 하나의 칸에만 입력되는지, 아니면 차트를 그리기 위해 층층이 쌓여야 하는지를 정의하는 '설계도(Architecture)' 개념.

- 단일 구조 / 단일 컨텍스트 구조: 현재 시점의 "딱 하나의 값"만 가지는 1차원적 구조. (예: assetName = "더케이트윈타워")
- Time-Series (시계열 배열): 하나의 지표(예: 평당 임대료)에 대해 "목표는 얼마였는데, 1분기엔 얼마였고, 2분기엔 얼마였다"를 선(Line)처럼 누적해서 그려내는 구조.
- Date Series (마일스톤 배열): "사전임대 시작 노드"처럼 날짜 자체의 궤적(예시: 원래 8월 예정이었으나 우천 지연으로 9월 승인, 최종 10월 완료결재)을 쌓아두는 구조.
- Log Series (로그 누적 배열): 카카오톡 대화방이나 회의록처럼, 특정 일자마다 발생한 리스크 메모나 의사결정 코멘트들을 차곡차곡 쌓아가는 구조.


3. 데이터 타입 (Data Type)
프로그래밍 관점에서 이 데이터에 "어떤 형태의 값을 입력할 수 있는가?"를 정의한다.
프로그래머들이 실제 데이터베이스 제약 조건(Validation)을 걸 때 사용하는 원시적인(Primitive) 프로그래밍 단위.

- String / Text: 평범한 글자(문자열). (예: "정영진", "하층부 F&B 전략")
- Enum (선택형): 정해진 드롭다운 목록에서 선택 (예: "커머셜, 입찰단계, 오피스")
- Number / Float: 연산(더하기, 빼기 등)이 가능한 순수 숫자나 소수점. 단위 글자인 '원', '%' 등은 숫자 뒤에 UI에서 따로 붙인다.
- Date: 날짜 연산(목표일-현재일=D-day)이 가능한 표준 시각 규격만. (예: 2025-08-30)
- Array (배열) / Array of Objects: 위에 설명한 Time-Series나 Log Series를 실제로 구현하기 위해, 괄호 [ ] 안에 여러 개의 덩어리(Object)들을 콤마로 무한정 집어넣을 수 있는 데이터 타입.

 | 보여줘야할 화면의 정리(Draft-개발자산상세) (최상위부터, DB 테이블 구성을 위함)
- 이 프로젝트의 이름은 : "이오타서울(816)" - Static / 단일구조 / String
- 비히클 : PFV (Fund/PFV)
- 이 프로젝트의 리스크 우선순위는 : "High" - Static / 단일구조 / Enum
  ㄴ 다른 High 프로젝트 보기
- 이 프로젝트의 섹터/주용도/사업형태는 : "커머셜, 오피스, 개발" - Static / 단일구조 / Enum
  ㄴ 각 텍스트는 클릭할 수 있으며, 클릭하면 해당 프로젝트가 리스트된 화면으로 이동한다. 
- 이 프로젝트의 입찰/수의 분류는 : "입찰" - Static / 단일구조 / Enum
- 지금까지 이러이러한 이슈가 있었고, 이렇게 처리했다 : "2026년 3월 클로징 목표로 리파이낸싱을 추진했으나 KB증권 안이 부결되어 현재는 선순위 일부는 메리츠증권, 잔여분은 NH증권이 참여하는 구조를 협의 중임" - Context Text / Log Series / Text
  ㄴ 최근 주요 2~3건을 보여주고 더보기를 통해 창이 확대되며 모든 내용을 확인할 수 있다. 
- 이 프로젝트는 현재 10단계 가치 사슬 중 어디에 있다 : "개발중" - Static / 단일구조 / Enum
  ㄴ 클릭하면 창이 넓어지면서 프로젝트 일정 상세를 확인할 수 있다.
- 예정공급년도 : 2032년
- 권역 : CBD (CBD/GBD/YBD/PBD/기타)
- 오피스등급 : Prime
- 이 프로젝트의 연멱적은 : "36,537평"
- 이 사업의 담당자는 이렇다 : "조직장 000, PO 000, 담당 000" - Static / 단일구조 / String, Text, Enum
  ㄴ 클릭하면 각 담당자 상세페이지로 이동한다 (담당자가 진행중인 모든 프로젝트 및 관련 내용을 망라한 담당자 상세페이지)
- 이 사업의 원가는 : "8000억(2025.03) -> 9500억(2026.04)" - Dynamic / Date Series / Number
  ㄴ 클릭하면 창이 넓어지면서 원가 변화 히스토리를 확인할 수 있다.(토지비, 공사비, 금융비 및 기타) 
- CF
- Financing
- 공정/인허가
- 투자구조 : ""
- 고유 투자금은 : ""
- 투자자 담당자는 : ""
- 수익자 정보 : 
- 대주정보 : 
- 에쿼티 : "780억"
- 론 : ""
- 예상 수익률은 : ""
- 예상 매각시점 & 매각가
- 개발기간은 : 
- 예상 NOC (준공년 기준) 
- 자산 개요 : "사진, 자산명, 소재지, 연면적, 대지면적, 규모(층), 준공일, 기준층전용면적" - Static / 단일구조 / String, Text, Enum
  ㄴ 위 주요 정보만 노출하고 나머지는 더보기를 통해 창이 확대되며 모든 내용을 확인할 수 있다. 
- 설계사
- 시공사
- 공간UX 상품기획
- 브랜드 : IOTA (컨셉, 포지셔닝, 계획 등)
- 마케팅(+플레이스메이킹)
- 기업파트너십(SI)
- 리징 

- 자료실 : 티저, IM, 심의보고서, 실사보고서, 등
- 리테일
- 전력공급
- 상세스팩


- 이 프로젝트의 자금조달 계획은 : "PFV는 브릿지론 후순위 대여 700억원(All-in 10.0%)에 대해 소노인터내셔널 확약을 확보했고, 힐튼 재개발사업과 통합 프로젝트 리츠를 설립한 후 통합 PF를 조달해 전반적인 사업구조를 안정화하는 방안도 함께 검토 중임" - Context Text / Log Series / String, Text
- 이 프로젝트의 펀딩 현황 : "ㅇㅇㅇㅇ" - Context Text / Log Series / String, Text
  ㄴ 클릭하면 입찰중 프로젝트 리스트로 이동한다. 
- 매입 보수는 : "40억"
- 펀드 설정일/만기일 : 
- 관리 후보자는 : "사업 : 000 / 관리 : 000"
- 이 프로젝트의 소싱 컨텍포인트는 : "CBRE, CW" - Static / 단일구조 / String, Text, Enum
  ㄴ 각 텍스트를 클릭하면 해당 컨텍포인트사(매각자문사)의 상세페이지로 이동한다. 
`)} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-12 hide-scrollbar bg-white">
                            <div className="max-w-[1000px] flex flex-col gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase" style={interFont}>DATABASE SPECIFICATION</span>
                                    <h1 className="text-[16px] font-bold text-black leading-tight mt-1" style={interFont}>IFPDP Asset Data Schema</h1>
                                    <p className="text-[13px] text-gray-500 mt-2 font-sans" style={interFont}>화면 영역 및 UI 계층별 메타데이터 속성 맵핑 구조 정의</p>
                                    <div className="h-[1px] bg-black w-full mt-6"></div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <h3 className="text-[15px] font-bold text-black uppercase border-b border-gray-100 pb-2" style={interFont}>1. UI 계층별 DB 필드 정의 및 맵핑</h3>
                                    <div className="border border-gray-200 overflow-hidden bg-white">
                                        <table className="w-full border-collapse text-[12px] text-left">
                                            <thead className="bg-[#F9F9FB] text-black font-semibold border-b border-gray-200 select-none">
                                                <tr>
                                                    <th className="px-4 py-2.5 w-[140px]" style={interFont}>화면 영역</th>
                                                    <th className="px-4 py-2.5 w-[130px]" style={interFont}>데이터 속성</th>
                                                    <th className="px-4 py-2.5 w-[160px] font-mono" style={interFont}>DB 필드명</th>
                                                    <th className="px-4 py-2.5 w-[110px]" style={interFont}>데이터 구조</th>
                                                    <th className="px-4 py-2.5 w-[100px] font-mono" style={interFont}>데이터 타입</th>
                                                    <th className="px-4 py-2.5" style={interFont}>설명 및 화면 맵핑 예제</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 text-gray-700 bg-white">
                                                {schemaFieldsData.map((f, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-2.5 font-bold text-black">{f.ui_layer}</td>
                                                        <td className="px-4 py-2.5 text-gray-500">{f.attr}</td>
                                                        <td className="px-4 py-2.5 font-mono text-black font-semibold">{f.field}</td>
                                                        <td className="px-4 py-2.5 text-gray-500">{f.structure}</td>
                                                        <td className="px-4 py-2.5 font-mono text-[11.5px] text-gray-800">{f.datatype}</td>
                                                        <td className="px-4 py-2.5 text-gray-600 leading-relaxed font-sans">{f.desc}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 border-t border-gray-200 pt-8">
                                    <h3 className="text-[15px] font-bold text-black uppercase" style={interFont}>
                                        2. 보여줘야할 화면의 정리 (Draft - 개발자산상세 예시)
                                    </h3>
                                    <div className="grid grid-cols-1 gap-1">
                                        {schemaDraftsData.map((draft, idx) => {
                                            const cleanText = draft.replace(/^-/, '').trim();
                                            return (
                                                <div key={idx} className="border-b border-gray-100 py-2.5 text-[13px] text-gray-700 font-sans">
                                                    {cleanText}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. IOTA CFT Phase 1 - 시스템 기획안 */}
                {selectedMenu === 'phase1-proposal' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IOTA CFT Phase 1</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>Proposal</span>
                            </div>
                            <button onClick={() => handleCopyText(`
 | 이오타 CFT 플랫폼 - Phase 1 (2026.05.21~2026.07.01)

본 문서는 이오타 CFT 협업 플랫폼의 초기 기틀을 마련하고 안정적인 운영 환경을 수립한 Phase 1의 설계 사양과 마이그레이션 이력을 역사적 기록으로 보존하고 관리하기 위해 작성됨. 
본 플랫폼은 단순 협업 툴이 아니라 이지스의 전사 메타데이터 관제망인 IFPDP(IGIS Fund Production Data Platform) 프로젝트의 일환으로서 핵심 비히클 정보를 시계열로 영구 추적하는 자산 플랫폼을 지향함.
이오타 CFT 플랫폼의 여정에서 Phase 1은 자산 정보 관제 및 협업 체계의 기술적 기틀을 완벽하게 다진 프레임워크 구축 단계이며, 
향후 Phase 2는 이를 토대로 실질적인 비즈니스 관리와 통제 운영을 개시하는 실전 운영화 단계로 구분됨. 현재 Phase 1 검증이 마감되고 Phase 2 실전 운영화 설계가 공식 착수되었으며, 엑셀 컬럼의 1:1 단순 복제에서 탈피하여 실무 사용성(UI/UX) 기반으로 비즈니스 금융/개발 연계 규칙을 플랫폼에 유기적으로 녹여내는 방향성을 지향함.


1. Phase 1 구축 배경 및 목적

   1) IFPDP 전사 프레임워크와의 연동
    IOTA CFT 플랫폼은 이지스자산운용의 전사 통합 자산 관제 및 의사결정 메타데이터 시스템인 IFPDP의 설계 철학에서 출발함. 
    전사 데이터 통합이라는 거시적 프레임워크 아래, 실제 실무 비즈니스(Deal)와 사업 관리를 유기적으로 연결하는 첫 번째 실천적 하이브리드 형태의 플랫폼으로 기능함.

   2) 비히클 정보의 시계열 관리 당위성
    운용사(AMC)에서 가장 핵심적인 자산 정보인 프로젝트별 비히클 정보(자금 조달 구조, 리파이낸싱 경과, 사업성 지표 등)는 그동안 이지스 내부의 표준 ERP 등 
    레거시 시스템에서도 추적 관리하기 어려웠던 극도로 세부적인 성격을 띰. 
    본 플랫폼은 이러한 데이터 공백을 해결하고 금융기관별 파이넌스 스택 추이와 사업 마일스톤 이력을 영구적으로 기록 보존하기 위해 기획됨.

   3) 대형 프로젝트에 대한 전통적 업무 방식의 한계
    이오타 사업단 내의 각 전문 부서(사업관리, LFC, 개발관리, 마케팅, 설계 등)가 담당하는 대형 프로젝트(예: 427 PFV 등)는 복잡도가 높고 산출물이 얽혀 있어, 
    부서 간 정보 비대칭성과 업무 과중, 업무 누수 현상이 반복됨.

   4) Phase 1의 핵심 목표
    a. 부서별로 흩어져 있던 업무 원장(할일 및 마일스톤)을 단일 수파베이스 데이터베이스 및 웹 플랫폼으로 통합하여 업무 협업툴의 기반 수립.
    b. 비히클 통합 관리, 이오타 원 427, 421 펀드 등 자산 데이터를 구축하여 이지스 사내 시스템에 없던 시계열 자금 스택 및 사업성 지표를 체계화.
    c. 부서별 실행주관 업무와 산출물의 상태를 가독성 높은 인터페이스로 공유하여 실시간으로 진척도를 모니터링.
    d. 실무진의 수작업 보고 체계를 전산화하고, 의결 사항 및 지연 요소의 기록 역사를 투명하게 아카이빙.



2. 플랫폼 시스템 아키텍처 및 권한 체계
Phase 1은 전사 통합망(IFPDP)과 연동을 목표로, 이지스 임직원 인증 기반의 부서별 권한 통제를 최초로 확립했음.

   1) 사용자 권한 매핑 규칙
    초기 플랫폼 진입 시 각 사용자의 이메일 및 직급 정보를 통해 본인의 전용 워크스페이스에 대한 접근 및 쓰기 권한을 확인함.
    *e.g. 사업1파트: 권순일, 윤주형, 김제익, 류홍, 박만진, 박일훈, 이정원, 전무경
    *e.g. 사업2파트: 강순용, 한찬호, 박석제, 박채현, 소현준, 이수정, 조영비, 한수정
    *e.g. 플랫폼 어드민 및 Director: 전기영, 이시정, 이관용, 이철승, 윤관식, 정조민, 우형석

   2) 다중 테넌트 워크스페이스 구조
    인증 세션에 따라 좌측 내비게이션 바에서 본인 소관 부서에 맞는 워크스페이스로 즉시 리다이렉팅하는 하이브리드 라우팅을 적용했다.



3. IFPDP 통합 연계 및 핵심 비히클 시계열 자산 관리 체계
이지스 내부 레거시 시스템에 부재한 상세 비히클 금융 조달 구조 및 사업성 지표를 통합 수집하여 시간 흐름에 따라 누적 추적하는 이오타 자산 관리의 핵심 중추임. 
본 데이터베이스는 IFPDP 전사 7대 핵심 데이터베이스 모듈의 뼈대를 실제 비즈니스에 최초로 투영한 사례임.

   1) 자산 개요, 비히클 및 조직 연계 (IFPDP 모듈 1 연동)
    프로젝트 구분 및 설정 형태인 기금(Fund), 프로젝트금융투자회사(PFV) 등의 비히클 기본 속성과 리얼에셋 그룹 내 담당 인력 배분 내역을 단일 객체 기반으로 통합 관리함.

   2) 자본 스택 및 수익자 관리 (IFPDP 모듈 2 연동)
    - 캐피탈 스택 (Capital Stack) 시계열 관리 
      브릿지론에서 본 PF, 리파이낸싱 단계로 이어지는 자본 구조 변화를 보통주, 종류주, 주주대여금 등의 자본금(Equity) 항목과 대주단 선/후순위 대출금(Debt) 항목별로 기록하고, 
      참여한 금융기관별 투자 규모와 조달 금리를 추적함.
    - 프로젝트 재무 및 사업성 지표 (Project Metrics) 이력 보존 
      예상 총수입(GI), 연간 순영업소득(NOI), 목표 자본환원율(Cap Rate) 등 프로젝트 가치 산정의 기초 지표를 연도 및 분기별 시계열로 저장하여 최신화함.
    - 기금 인출(Drawdown) 스케줄 및 집행 경과를 일자별로 추적할 수 있도록 하여 재무 위험을 예방함.

   3) 10단계 가치사슬 및 시계열 트래킹 (IFPDP 모듈 3 연동)
    마일스톤 및 히스토리 아카이브 (Project History): 토지 매입, 인허가 완료, 착공, 금융 종결, 준공 등 사업 추진에 수반되는 핵심 일정의 선후 관계를 일목요연한 역사적 시계열 
    기록물로 보존하여 자산 라이프사이클의 진행 단계를 역산할 수 있는 데이터를 제공함.

   4) 의사결정 맥락 및 리스크 통제 (IFPDP 모듈 7 연동)
    의사결정 로그 (DecisionLog): 론 조건 변경, 수익률 조정, 매각 시기 연기 등 재단/투자위에서 중대한 결정이 내려질 당시의 배경 사유와 정성적 판단 근거를 투명하게 기록하여 내부 통제 및 의사결정 맥락을 보존함.



4. 협업 워크스페이스 및 이종 데이터베이스 구축
Phase 1은 업무 특성별로 고유 스키마를 구성하여 총 6대 테이블과 이력 관리 모듈을 신설 및 주입함.

   1) 부서별 업무 관리 테이블
    * iota_pm_tasks: 사업1파트, 사업2파트의 실행주관 일정, 소싱 타겟, 계약 정보 관리.
    * iota_financing_tasks: LFC(금융) 부서의 PF 조달, 금리 구조, 금융비, 대주단 연동 상태 관리.
    * iota_development_tasks: 개발솔루션의 건축인허가, 시공사 도급 계약, 준공 일정 관리.
    * iota_fund_tasks 및 iota_marketing_tasks: 펀드 설정 및 임차 마케팅 원장 관리.

   2) 주간 스냅샷 아카이빙 시스템 (iota_weekly_snapshots)
    * 목적: 매주 금요일 퇴근 시점의 실무 업무 원장 상태를 스냅샷 이미지로 아카이빙하여 시계열 변천사 추적.
    * 백업 정책: 수파베이스 네트워크 장애 대비를 위해 로컬 스토리지로 실시간 백업 기동.

   3) 로그 및 회의록 입력 창 (LogWriteBox, MeetingWriteBox)
    * 회의 중 실시간으로 발생한 액션 아이템을 실행주관 부서원에게 바로 등록 및 배정하는 에디터 인터페이스를 구축하여 협업 툴의 기틀을 완성함.

   4) 의사결정 맥락 및 리스크 통제 (IFPDP 모듈 7 연동)
    의사결정 로그 (DecisionLog): 론 조건 변경, 수익률 조정, 매각 시기 연기 등 재단/투자위에서 중대한 결정이 내려질 당시의 배경 사유와 정성적 판단 근거를 투명하게 기록하여 내부 통제 및 의사결정 맥락을 보존함.



5. 실무 알림 연동 및 데이터 연계
- 스마트 알림 연동: 새로운 태스크나 지연 요소가 등록되면 지정된 부서원 및 주요 의사결정권자에게 알림 메일 및 메시지를 백그라운드로 자동 발송.
- 이해관계자 마스터 관리 (iota_stakeholder_master): 각 거래 빌딩별 LP(출자자), 시행사, 자산관리 회사 연락처 및 특이사항을 통합 조회하는 VVIP 인물 데이터베이스 적재.


6. Phase 1 운영 성과 및 검증 상태
- 데이터 무결성: 로컬 엑셀의 복잡한 컬럼 130여 개를 수파베이스 데이터베이스 내 4대 마스터 테이블로 완전히 매핑하여 데이터 유실 없는 전산 마이그레이션 완수.
- 화면 구성 안정성: 대량의 테이블 렌더링 시 브라우저 성능이 저하되지 않도록 코드 수준에서 분리 적용 완료.


`)} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-12 hide-scrollbar">
                            <div className="max-w-[800px] flex flex-col gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase" style={interFont}>MEMORANDUM</span>
                                    <h1 className="text-[16px] font-bold text-black leading-tight mt-1" style={interFont}>IOTA CFT 플랫폼 Phase 1 기획안</h1>
                                    <p className="text-[13px] text-gray-500 mt-2 font-sans" style={interFont}>이오타 CFT 협업 플랫폼의 초기 기틀 및 비히클 시계열 관제 기틀 수립 사양</p>
                                    <div className="h-[1px] bg-black w-full mt-6"></div>
                                </div>

                                <div className="text-[13.5px] text-gray-800 leading-[26px] font-light whitespace-pre-wrap font-sans space-y-6 select-text">
                                    
 | 이오타 CFT 플랫폼 - Phase 1 (2026.05.21~2026.07.01)

본 문서는 이오타 CFT 협업 플랫폼의 초기 기틀을 마련하고 안정적인 운영 환경을 수립한 Phase 1의 설계 사양과 마이그레이션 이력을 역사적 기록으로 보존하고 관리하기 위해 작성됨. 
본 플랫폼은 단순 협업 툴이 아니라 이지스의 전사 메타데이터 관제망인 IFPDP(IGIS Fund Production Data Platform) 프로젝트의 일환으로서 핵심 비히클 정보를 시계열로 영구 추적하는 자산 플랫폼을 지향함.
이오타 CFT 플랫폼의 여정에서 Phase 1은 자산 정보 관제 및 협업 체계의 기술적 기틀을 완벽하게 다진 프레임워크 구축 단계이며, 
향후 Phase 2는 이를 토대로 실질적인 비즈니스 관리와 통제 운영을 개시하는 실전 운영화 단계로 구분됨. 현재 Phase 1 검증이 마감되고 Phase 2 실전 운영화 설계가 공식 착수되었으며, 엑셀 컬럼의 1:1 단순 복제에서 탈피하여 실무 사용성(UI/UX) 기반으로 비즈니스 금융/개발 연계 규칙을 플랫폼에 유기적으로 녹여내는 방향성을 지향함.


1. Phase 1 구축 배경 및 목적

   1) IFPDP 전사 프레임워크와의 연동
    IOTA CFT 플랫폼은 이지스자산운용의 전사 통합 자산 관제 및 의사결정 메타데이터 시스템인 IFPDP의 설계 철학에서 출발함. 
    전사 데이터 통합이라는 거시적 프레임워크 아래, 실제 실무 비즈니스(Deal)와 사업 관리를 유기적으로 연결하는 첫 번째 실천적 하이브리드 형태의 플랫폼으로 기능함.

   2) 비히클 정보의 시계열 관리 당위성
    운용사(AMC)에서 가장 핵심적인 자산 정보인 프로젝트별 비히클 정보(자금 조달 구조, 리파이낸싱 경과, 사업성 지표 등)는 그동안 이지스 내부의 표준 ERP 등 
    레거시 시스템에서도 추적 관리하기 어려웠던 극도로 세부적인 성격을 띰. 
    본 플랫폼은 이러한 데이터 공백을 해결하고 금융기관별 파이넌스 스택 추이와 사업 마일스톤 이력을 영구적으로 기록 보존하기 위해 기획됨.

   3) 대형 프로젝트에 대한 전통적 업무 방식의 한계
    이오타 사업단 내의 각 전문 부서(사업관리, LFC, 개발관리, 마케팅, 설계 등)가 담당하는 대형 프로젝트(예: 427 PFV 등)는 복잡도가 높고 산출물이 얽혀 있어, 
    부서 간 정보 비대칭성과 업무 과중, 업무 누수 현상이 반복됨.

   4) Phase 1의 핵심 목표
    a. 부서별로 흩어져 있던 업무 원장(할일 및 마일스톤)을 단일 수파베이스 데이터베이스 및 웹 플랫폼으로 통합하여 업무 협업툴의 기반 수립.
    b. 비히클 통합 관리, 이오타 원 427, 421 펀드 등 자산 데이터를 구축하여 이지스 사내 시스템에 없던 시계열 자금 스택 및 사업성 지표를 체계화.
    c. 부서별 실행주관 업무와 산출물의 상태를 가독성 높은 인터페이스로 공유하여 실시간으로 진척도를 모니터링.
    d. 실무진의 수작업 보고 체계를 전산화하고, 의결 사항 및 지연 요소의 기록 역사를 투명하게 아카이빙.



2. 플랫폼 시스템 아키텍처 및 권한 체계
Phase 1은 전사 통합망(IFPDP)과 연동을 목표로, 이지스 임직원 인증 기반의 부서별 권한 통제를 최초로 확립했음.

   1) 사용자 권한 매핑 규칙
    초기 플랫폼 진입 시 각 사용자의 이메일 및 직급 정보를 통해 본인의 전용 워크스페이스에 대한 접근 및 쓰기 권한을 확인함.
    *e.g. 사업1파트: 권순일, 윤주형, 김제익, 류홍, 박만진, 박일훈, 이정원, 전무경
    *e.g. 사업2파트: 강순용, 한찬호, 박석제, 박채현, 소현준, 이수정, 조영비, 한수정
    *e.g. 플랫폼 어드민 및 Director: 전기영, 이시정, 이관용, 이철승, 윤관식, 정조민, 우형석

   2) 다중 테넌트 워크스페이스 구조
    인증 세션에 따라 좌측 내비게이션 바에서 본인 소관 부서에 맞는 워크스페이스로 즉시 리다이렉팅하는 하이브리드 라우팅을 적용했다.



3. IFPDP 통합 연계 및 핵심 비히클 시계열 자산 관리 체계
이지스 내부 레거시 시스템에 부재한 상세 비히클 금융 조달 구조 및 사업성 지표를 통합 수집하여 시간 흐름에 따라 누적 추적하는 이오타 자산 관리의 핵심 중추임. 
본 데이터베이스는 IFPDP 전사 7대 핵심 데이터베이스 모듈의 뼈대를 실제 비즈니스에 최초로 투영한 사례임.

   1) 자산 개요, 비히클 및 조직 연계 (IFPDP 모듈 1 연동)
    프로젝트 구분 및 설정 형태인 기금(Fund), 프로젝트금융투자회사(PFV) 등의 비히클 기본 속성과 리얼에셋 그룹 내 담당 인력 배분 내역을 단일 객체 기반으로 통합 관리함.

   2) 자본 스택 및 수익자 관리 (IFPDP 모듈 2 연동)
    - 캐피탈 스택 (Capital Stack) 시계열 관리 
      브릿지론에서 본 PF, 리파이낸싱 단계로 이어지는 자본 구조 변화를 보통주, 종류주, 주주대여금 등의 자본금(Equity) 항목과 대주단 선/후순위 대출금(Debt) 항목별로 기록하고, 
      참여한 금융기관별 투자 규모와 조달 금리를 추적함.
    - 프로젝트 재무 및 사업성 지표 (Project Metrics) 이력 보존 
      예상 총수입(GI), 연간 순영업소득(NOI), 목표 자본환원율(Cap Rate) 등 프로젝트 가치 산정의 기초 지표를 연도 및 분기별 시계열로 저장하여 최신화함.
    - 기금 인출(Drawdown) 스케줄 및 집행 경과를 일자별로 추적할 수 있도록 하여 재무 위험을 예방함.

   3) 10단계 가치사슬 및 시계열 트래킹 (IFPDP 모듈 3 연동)
    마일스톤 및 히스토리 아카이브 (Project History): 토지 매입, 인허가 완료, 착공, 금융 종결, 준공 등 사업 추진에 수반되는 핵심 일정의 선후 관계를 일목요연한 역사적 시계열 
    기록물로 보존하여 자산 라이프사이클의 진행 단계를 역산할 수 있는 데이터를 제공함.

   4) 의사결정 맥락 및 리스크 통제 (IFPDP 모듈 7 연동)
    의사결정 로그 (DecisionLog): 론 조건 변경, 수익률 조정, 매각 시기 연기 등 재단/투자위에서 중대한 결정이 내려질 당시의 배경 사유와 정성적 판단 근거를 투명하게 기록하여 내부 통제 및 의사결정 맥락을 보존함.



4. 협업 워크스페이스 및 이종 데이터베이스 구축
Phase 1은 업무 특성별로 고유 스키마를 구성하여 총 6대 테이블과 이력 관리 모듈을 신설 및 주입함.

   1) 부서별 업무 관리 테이블
    * iota_pm_tasks: 사업1파트, 사업2파트의 실행주관 일정, 소싱 타겟, 계약 정보 관리.
    * iota_financing_tasks: LFC(금융) 부서의 PF 조달, 금리 구조, 금융비, 대주단 연동 상태 관리.
    * iota_development_tasks: 개발솔루션의 건축인허가, 시공사 도급 계약, 준공 일정 관리.
    * iota_fund_tasks 및 iota_marketing_tasks: 펀드 설정 및 임차 마케팅 원장 관리.

   2) 주간 스냅샷 아카이빙 시스템 (iota_weekly_snapshots)
    * 목적: 매주 금요일 퇴근 시점의 실무 업무 원장 상태를 스냅샷 이미지로 아카이빙하여 시계열 변천사 추적.
    * 백업 정책: 수파베이스 네트워크 장애 대비를 위해 로컬 스토리지로 실시간 백업 기동.

   3) 로그 및 회의록 입력 창 (LogWriteBox, MeetingWriteBox)
    * 회의 중 실시간으로 발생한 액션 아이템을 실행주관 부서원에게 바로 등록 및 배정하는 에디터 인터페이스를 구축하여 협업 툴의 기틀을 완성함.

   4) 의사결정 맥락 및 리스크 통제 (IFPDP 모듈 7 연동)
    의사결정 로그 (DecisionLog): 론 조건 변경, 수익률 조정, 매각 시기 연기 등 재단/투자위에서 중대한 결정이 내려질 당시의 배경 사유와 정성적 판단 근거를 투명하게 기록하여 내부 통제 및 의사결정 맥락을 보존함.



5. 실무 알림 연동 및 데이터 연계
- 스마트 알림 연동: 새로운 태스크나 지연 요소가 등록되면 지정된 부서원 및 주요 의사결정권자에게 알림 메일 및 메시지를 백그라운드로 자동 발송.
- 이해관계자 마스터 관리 (iota_stakeholder_master): 각 거래 빌딩별 LP(출자자), 시행사, 자산관리 회사 연락처 및 특이사항을 통합 조회하는 VVIP 인물 데이터베이스 적재.


6. Phase 1 운영 성과 및 검증 상태
- 데이터 무결성: 로컬 엑셀의 복잡한 컬럼 130여 개를 수파베이스 데이터베이스 내 4대 마스터 테이블로 완전히 매핑하여 데이터 유실 없는 전산 마이그레이션 완수.
- 화면 구성 안정성: 대량의 테이블 렌더링 시 브라우저 성능이 저하되지 않도록 코드 수준에서 분리 적용 완료.



                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. IOTA CFT Phase 1 - 기능요구사항 */}
                {selectedMenu === 'phase1-requirements' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IOTA CFT Phase 1</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>Functional Specifications</span>
                            </div>
                            <button onClick={() => handleCopyText(phase1RequirementsData.map(r => `${r.scope} | ${r.category} | ${r.subcategory} | ${r.actor} | ${r.detail}`).join('\n'))} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 flex flex-col overflow-hidden p-12 gap-4 max-w-[1000px] w-full">
                            {/* Filter Bar - Dry Blackstone Style */}
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-200 pb-4 shrink-0">
                                <div className="flex border border-gray-300 divide-x divide-gray-300">
                                    {['all', '내부', '외부'].map(sc => (
                                        <button
                                            key={sc}
                                            onClick={() => setPhase1ReqFilterScope(sc)}
                                            className={`px-4 py-1 text-[11px] font-semibold uppercase transition-all cursor-pointer ${
                                                phase1ReqFilterScope === sc 
                                                    ? 'bg-black text-white' 
                                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                            }`}
                                            style={interFont}
                                        >
                                            {sc === 'all' ? 'All Scope' : sc}
                                        </button>
                                    ))}
                                </div>
                                <div className="w-full sm:w-[280px]">
                                    <input 
                                        type="text" 
                                        placeholder="SEARCH KEYWORD..." 
                                        value={phase1ReqSearchQuery}
                                        onChange={(e) => setPhase1ReqSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-none px-3 py-1 text-black text-[11px] outline-none focus:border-black uppercase placeholder-gray-400"
                                        style={interFont}
                                    />
                                </div>
                            </div>

                            {/* Requirements Grid Table - Institutional Minimal Style */}
                            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                <div className="w-full overflow-x-auto overflow-y-auto flex-1 border border-gray-200 select-text">
                                    <table className="w-full border-collapse text-[12px] text-left">
                                        <thead className="bg-[#F9F9FB] text-black font-semibold border-b border-gray-200 sticky top-0 z-10 select-none">
                                            <tr>
                                                <th className="px-4 py-3 w-[80px]" style={interFont}>구분</th>
                                                <th className="px-4 py-3 w-[110px]" style={interFont}>대분류</th>
                                                <th className="px-4 py-3 w-[110px]" style={interFont}>세부분류</th>
                                                <th className="px-4 py-3 w-[90px]" style={interFont}>엑터</th>
                                                <th className="px-4 py-3" style={interFont}>기능상세</th>
                                                <th className="px-4 py-3 w-[100px]" style={interFont}>실행주관</th>
                                                <th className="px-4 py-3 w-[120px]" style={interFont}>비고</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 text-gray-700 bg-white">
                                            {filteredPhase1Reqs.length > 0 ? (
                                                filteredPhase1Reqs.map((req, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-3 font-semibold text-black">{req.scope}</td>
                                                        <td className="px-4 py-3 text-black font-medium">{req.category}</td>
                                                        <td className="px-4 py-3 text-gray-500">{req.subcategory}</td>
                                                        <td className="px-4 py-3 text-gray-500">{req.actor}</td>
                                                        <td className="px-4 py-3 text-black leading-relaxed font-sans">{req.detail}</td>
                                                        <td className="px-4 py-3 text-black font-medium">{req.main_dept}</td>
                                                        <td className="px-4 py-3 text-[11.5px] text-gray-500">{req.note || '-'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-20 text-gray-400">데이터가 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="py-2.5 text-[11px] text-gray-500 font-semibold flex justify-between select-none" style={interFont}>
                                    <span>TOTAL: {phase1RequirementsData.length} ITEMS</span>
                                    <span>FILTERED: {filteredPhase1Reqs.length} ITEMS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. IOTA CFT Phase 1 - DB Schema */}
                {selectedMenu === 'phase1-schema' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IOTA CFT Phase 1</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>DDL Specification</span>
                            </div>
                            <button onClick={() => handleCopyText(`-- 1. 이오타 파트별 태스크 테이블
CREATE TABLE public.iota_pm_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    related_asset VARCHAR NOT NULL,          -- 관련 자산 (427 PFV, 816 PFV, 421 Fund 등)
    task_name VARCHAR NOT NULL,             -- 업무명
    status VARCHAR DEFAULT '신규',          -- 상태 (신규, 진행중, 보류, 완료)
    priority VARCHAR DEFAULT '중간',        -- 우선순위
    due_date DATE,                          -- 마감일
    next_action TEXT,                       -- 다음 액션
    notes TEXT,                             -- 비고
    assignee VARCHAR,                       -- 담당자
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 의사결정 로그 테이블 (Decision Log)
CREATE TABLE public.iota_decision_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,                 -- 안건명
    decision_detail TEXT NOT NULL,          -- 결정사항 상세
    reason TEXT,                            -- 정성적 판단 근거 및 배경 사유
    decision_date DATE DEFAULT CURRENT_DATE,
    created_by VARCHAR,                     -- 등록자
    is_locked BOOLEAN DEFAULT false,        -- 히스토리 변경 방지 잠금
    created_at TIMESTAMPTZ DEFAULT NOW()
);`)} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-12 hide-scrollbar">
                            <div className="max-w-[1000px] flex flex-col gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase" style={interFont}>SCHEMA SPECIFICATION</span>
                                    <h1 className="text-[16px] font-bold text-black leading-tight mt-1" style={interFont}>IOTA CFT Phase 1 DB Schema</h1>
                                    <p className="text-[13px] text-gray-500 mt-2 font-sans" style={interFont}>부서 태스크 원장 및 의사결정 로그 테이블 DDL 명세서</p>
                                    <div className="h-[1px] bg-black w-full mt-6"></div>
                                </div>

                                <pre className="bg-[#F9F9FB] p-6 border border-gray-200 text-[12px] font-mono text-black overflow-x-auto whitespace-pre leading-relaxed select-text font-sans">
                                    <code>{`-- 1. 이오타 파트별 태스크 테이블
CREATE TABLE public.iota_pm_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    related_asset VARCHAR NOT NULL,          -- 관련 자산 (427 PFV, 816 PFV, 421 Fund 등)
    task_name VARCHAR NOT NULL,             -- 업무명
    status VARCHAR DEFAULT '신규',          -- 상태 (신규, 진행중, 보류, 완료)
    priority VARCHAR DEFAULT '중간',        -- 우선순위
    due_date DATE,                          -- 마감일
    next_action TEXT,                       -- 다음 액션
    notes TEXT,                             -- 비고
    assignee VARCHAR,                       -- 담당자
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 의사결정 로그 테이블 (Decision Log)
CREATE TABLE public.iota_decision_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,                 -- 안건명
    decision_detail TEXT NOT NULL,          -- 결정사항 상세
    reason TEXT,                            -- 정성적 판단 근거 및 배경 사유
    decision_date DATE DEFAULT CURRENT_DATE,
    created_by VARCHAR,                     -- 등록자
    is_locked BOOLEAN DEFAULT false,        -- 히스토리 변경 방지 잠금
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. IOTA CFT Phase 2 - 시스템 기획안 */}
                {selectedMenu === 'phase2-proposal' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IOTA CFT Phase 2</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>Proposal</span>
                            </div>
                            <button onClick={() => handleCopyText(`IOTA CFT Phase 2 시스템 기획안: 실전 운영화 및 사용성 혁신

1. Phase 2 핵심 기획 방향 및 설계 철학
- 기계적 그리드 렌더링 배격: 대량의 셀 데이터를 브라우저에 단순 열거하는 스프레드시트 덤프 방식을 지양함. 사용자의 직무 맥락(PM, LFC, 임원)에 필요한 정보만 시기적절하게 노출하는 사용자 중심 인터페이스로 개편함.
- 엑셀 계산 규칙의 시스템 내재화: 대주단 금리 스택, 기금 인출(Drawdown) 시점 연계, 우선순위 계산식 등 수작업 엑셀 수식을 데이터베이스 트리거와 UI 내 가상 시뮬레이터로 자동화함.
- 의사결정 맥락(Context) 중심의 아카이빙: 단순 텍스트 기록을 넘어, 리파이낸싱 경과나 의사결정 로그가 자산 타임라인과 연계되어 생성 즉시 자동 보호/통제되는 신뢰성 있는 협업 아키텍처를 구현함.

2. 사용성 기반 5대 핵심 기능 명세
- 스프레드시트 뷰 기반 스마트 인라인 에디터 (Inline Edit): 각 부서별 태스크 그리드 내에서 상태, 마감일, 담당자, 다음 액션 등의 셀을 더블클릭하는 즉시 인라인 입력 폼으로 변환하여 수정 가능하도록 구현함. 병목 여부(Blocker) 및 의사결정 필요 여부는 마우스 원클릭 토글로 반영.
- 다차원 비주얼 캐피탈 스택 & NOI 시뮬레이터 (Visual Capital Stack): 에쿼티 및 론 상세 내역을 연계하여 자본 구조 변화 추이를 누적 막대 차트 형태로 자동 시각화함. 금리 인상 또는 대주단 구성 변경 시, 예상 NOI와 Cap Rate의 임계치 한계를 시뮬레이션할 수 있는 인터랙티브 슬라이더 뷰 구축.
- 맥락 인지형 인물 자동완성 연동: 업무 코멘트 및 회의록 입력 창에서 이름 초성 또는 단어 타이핑 시 iota_stakeholder_master 테이블을 백그라운드로 실시간 조회하여 매핑하는 자동완성 엔진을 구축함.
- 자동 락킹(Auto-Locking) 의사결정 맥락 타임라인: PF 조건 변경 등 전사 차원의 결정 사항을 기록하는 iota_decision_logs에 로그가 인서트되는 즉시, 시스템 레벨에서 is_locked = true로 전환하여 무단 수정을 자동 방어함.
- 회의체 상정 자동 필터링 대시보드 (A-Grade Escalation): 업무 우선순위 가중치가 80점 이상이거나 Blocker(병목)가 활성화된 중요 태스크를 시스템이 자동 감지하여 'A등급 즉시 상정' 카드로 최상단에 자동 배치함.

3. 모바일 활용도 극대화 및 하이브리드 알림 체계
- 반응형 '핫 테스크' 피드 제공: 모바일 환경에서 거대한 엑셀 테이블 렌더링을 차단하고, 대신 최근 2주 동안 업데이트되었거나 Blocker가 켜진 업무들만 모아둔 카드 피드 형태로 간소화 노출함.
- 이벤트 기반 스마트 푸시 알림: 업무 원장에 Blocker 표시가 켜지거나 실무자가 액션 아이템 배정자로 태깅되는 즉시, 연동된 이메일 또는 슬랙 브릿지를 통해 지연 리스크와 담당자 정보를 실시간 전송함.

4. 데이터베이스 및 인프라 보안 강화 (RLS 수립)
- 테이블별 RLS(행 레벨 보안) 전면 가동: RLS가 비활성화되어 외부 악성 API 요청에 취약하던 테이블들에 대해 보안 패치를 적용하여 외부 악성 API 요청으로부터 플랫폼 자산 데이터를 보호함.`)} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-12 hide-scrollbar bg-white">
                            <div className="max-w-[800px] flex flex-col gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase" style={interFont}>MEMORANDUM</span>
                                    <h1 className="text-[16px] font-bold text-black leading-tight mt-1" style={interFont}>IOTA CFT Phase 2 시스템 기획안</h1>
                                    <p className="text-[13px] text-gray-500 mt-2 font-sans" style={interFont}>보안 권한 제어, 스프레드시트 인라인 편집 및 실전 PMO 운영화 로드맵</p>
                                    <div className="h-[1px] bg-black w-full mt-6"></div>
                                </div>

                                <div className="text-[13.5px] text-gray-800 leading-[26px] font-light whitespace-pre-wrap font-sans space-y-6 select-text">
                                    IOTA CFT Phase 2 시스템 기획안: 실전 운영화 및 사용성 혁신

1. Phase 2 핵심 기획 방향 및 설계 철학
- 기계적 그리드 렌더링 배격: 대량의 셀 데이터를 브라우저에 단순 열거하는 스프레드시트 덤프 방식을 지양함. 사용자의 직무 맥락(PM, LFC, 임원)에 필요한 정보만 시기적절하게 노출하는 사용자 중심 인터페이스로 개편함.
- 엑셀 계산 규칙의 시스템 내재화: 대주단 금리 스택, 기금 인출(Drawdown) 시점 연계, 우선순위 계산식 등 수작업 엑셀 수식을 데이터베이스 트리거와 UI 내 가상 시뮬레이터로 자동화함.
- 의사결정 맥락(Context) 중심의 아카이빙: 단순 텍스트 기록을 넘어, 리파이낸싱 경과나 의사결정 로그가 자산 타임라인과 연계되어 생성 즉시 자동 보호/통제되는 신뢰성 있는 협업 아키텍처를 구현함.

2. 사용성 기반 5대 핵심 기능 명세
- 스프레드시트 뷰 기반 스마트 인라인 에디터 (Inline Edit): 각 부서별 태스크 그리드 내에서 상태, 마감일, 담당자, 다음 액션 등의 셀을 더블클릭하는 즉시 인라인 입력 폼으로 변환하여 수정 가능하도록 구현함. 병목 여부(Blocker) 및 의사결정 필요 여부는 마우스 원클릭 토글로 반영.
- 다차원 비주얼 캐피탈 스택 & NOI 시뮬레이터 (Visual Capital Stack): 에쿼티 및 론 상세 내역을 연계하여 자본 구조 변화 추이를 누적 막대 차트 형태로 자동 시각화함. 금리 인상 또는 대주단 구성 변경 시, 예상 NOI와 Cap Rate의 임계치 한계를 시뮬레이션할 수 있는 인터랙티브 슬라이더 뷰 구축.
- 맥락 인지형 인물 자동완성 연동: 업무 코멘트 및 회의록 입력 창에서 이름 초성 또는 단어 타이핑 시 iota_stakeholder_master 테이블을 백그라운드로 실시간 조회하여 매핑하는 자동완성 엔진을 구축함.
- 자동 락킹(Auto-Locking) 의사결정 맥락 타임라인: PF 조건 변경 등 전사 차원의 결정 사항을 기록하는 iota_decision_logs에 로그가 인서트되는 즉시, 시스템 레벨에서 is_locked = true로 전환하여 무단 수정을 자동 방어함.
- 회의체 상정 자동 필터링 대시보드 (A-Grade Escalation): 업무 우선순위 가중치가 80점 이상이거나 Blocker(병목)가 활성화된 중요 태스크를 시스템이 자동 감지하여 'A등급 즉시 상정' 카드로 최상단에 자동 배치함.

3. 모바일 활용도 극대화 및 하이브리드 알림 체계
- 반응형 '핫 테스크' 피드 제공: 모바일 환경에서 거대한 엑셀 테이블 렌더링을 차단하고, 대신 최근 2주 동안 업데이트되었거나 Blocker가 켜진 업무들만 모아둔 카드 피드 형태로 간소화 노출함.
- 이벤트 기반 스마트 푸시 알림: 업무 원장에 Blocker 표시가 켜지거나 실무자가 액션 아이템 배정자로 태깅되는 즉시, 연동된 이메일 또는 슬랙 브릿지를 통해 지연 리스크와 담당자 정보를 실시간 전송함.

4. 데이터베이스 및 인프라 보안 강화 (RLS 수립)
- 테이블별 RLS(행 레벨 보안) 전면 가동: RLS가 비활성화되어 외부 악성 API 요청에 취약하던 테이블들에 대해 보안 패치를 적용하여 외부 악성 API 요청으로부터 플랫폼 자산 데이터를 보호함.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 8. IOTA CFT Phase 2 - 기능요구사항 */}
                {selectedMenu === 'phase2-requirements' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IOTA CFT Phase 2</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>Requirements</span>
                            </div>
                            <button onClick={() => handleCopyText(`IOTA CFT Phase 2 기능요구사항 명세

1. 스프레드시트 뷰 기반 스마트 인라인 에디터 (Inline Edit UX)
- 태스크 테이블의 상태, 마감일, 다음 액션을 상세 팝업 창을 켜지 않고 그리드 내부에서 더블클릭하여 즉각 수정 및 비동기 저장.
- 병목(Blocker) 여부 및 의사결정 필요 여부 필드는 마우스 클릭 한 번으로 참/거짓 값을 토글하여 데이터베이스에 실시간 즉시 반영 및 임원 대시보드 연계.

2. 다차원 비주얼 캐피탈 스택 & NOI 시뮬레이션 (Visual Capital Stack UX)
- 에쿼티 및 론 상세 내역을 누적 막대 차트로 시각화하고 금리 변동 시 예상 NOI 및 Cap Rate의 민감도를 시뮬레이션할 수 있는 슬라이더 뷰 제공.

3. 맥락 인지형 인물 자동완성 연동 (Autocomplete Stakeholder Catalog)
- 활동 로그 및 회의록 입력 창에서 이름 초성 타이핑 시 마스터 데이터베이스 주소록 기반 인물을 실시간 검색하고 Chip 태그 형태로 본문에 매핑.

4. 자동 락킹(Auto-Locking) 의사결정 맥락 타임라인 (Timeline & Auto-Lock)
- 의사결정 로그 등록 즉시 DB 단에서 is_locked = true 상태로 고정하며 임원 권한 외의 일반 유저 수정을 원천적으로 차단.

5. 회의체 상정 자동 필터링 대시보드 (A-Grade Escalation Dashboard)
- 중요도 가중치 80점 이상 혹은 Blocker 활성 업무를 최상단 A등급 영역으로 자동 정렬하여 배치하고, 부서별 지연 분포도를 막대 그래프로 자동 집계 시각화.`)} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copied' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-12 hide-scrollbar bg-white">
                            <div className="max-w-[1000px] flex flex-col gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase" style={interFont}>FUNCTIONAL SPECIFICATION</span>
                                    <h1 className="text-[16px] font-bold text-black leading-tight mt-1" style={interFont}>IOTA CFT Phase 2 기능요구사항</h1>
                                    <p className="text-[13px] text-gray-500 mt-2 font-sans" style={interFont}>비즈니스 실전 가동을 위한 PMO 핵심 기능 명세 및 세부 사양</p>
                                    <div className="h-[1px] bg-black w-full mt-6"></div>
                                </div>

                                <div className="flex flex-col gap-6 pl-1 select-text">
                                    {[
                                        { title: '가. 스프레드시트 뷰 기반 인라인 편집 (Inline Edit)', desc: '태스크 테이블의 상태, 마감일, 다음 액션을 상세 수정 팝업창 없이 그리드 내부에서 더블클릭하여 바로 변경 및 비동기(Async) 저장. Blocker 및 의사결정 필요 여부 필드는 원클릭 마우스 토글로 즉시 데이터베이스에 반영하여 정보 최신화 고속화.' },
                                        { title: '나. 단발성 업무 요청 관리 (iota_pmo_popup_requests)', desc: '정규 마일스톤 외에 개별적으로 발생하는 단발성 업무 요청 및 협업 사항을 수집하고, 승인/위임/반려/보류 프로세스를 제공하여 CFT 전체 리소스 영향도를 실시간으로 모니터링.' },
                                        { title: '다. 실시간 회의체 상정용 임원 대시보드', desc: '우선순위 점수가 80점 이상이거나 의사결정필요가 참인 Blocker 업무를 A등급 즉시 상정 카드로 최상단 자동 정렬 노출. 현재 업무 병목이 발생하고 있는 부서와 실무 담당자를 실시간 막대 차트로 집계 표현.' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex flex-col gap-1.5 border-b border-gray-100 pb-5">
                                            <h3 className="text-[14px] font-bold text-black">
                                                {item.title}
                                            </h3>
                                            <p className="text-[13px] text-gray-700 leading-relaxed font-sans pl-1">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 9. IOTA CFT Phase 2 - DB Schema */}
                {selectedMenu === 'phase2-schema' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <header className="h-[56px] border-b border-gray-200 px-8 flex items-center justify-between bg-white shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black uppercase" style={interFont}>IOTA CFT Phase 2</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[12px] text-gray-500" style={interFont}>DDL Specification</span>
                            </div>
                            <button onClick={() => handleCopyText(`-- 1. PMO 통합 원장 테이블 (PMO Control Ledger)
CREATE TABLE public.iota_pmo_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_type VARCHAR NOT NULL,          -- 프로젝트 구분 (공통, 427PFV 등)
    category_main VARCHAR,                  -- 대분류 (PMO, 호텔, 인허가 등)
    task_name VARCHAR NOT NULL,             -- 업무명
    task_purpose TEXT,                      -- 업무목적 및 영향도
    lead_department VARCHAR,                -- 실행주관
    assignee VARCHAR,                       -- 담당자
    is_blocker BOOLEAN DEFAULT false,       -- Blocker 여부
    needs_decision BOOLEAN DEFAULT false,    -- 의사결정 필요 여부
    due_date DATE,                          -- 기한
    status VARCHAR DEFAULT '미착수',        -- 상태 (미착수, 진행중, 완료, 지연)
    priority_score INTEGER DEFAULT 0,       -- 우선순위 점수
    meeting_grade VARCHAR DEFAULT 'B',      -- 회의상정등급 (A_즉시상정, B_회의점검)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Supabase RLS (Row Level Security) 설정 예시
ALTER TABLE public.iota_pmo_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PM2 파트 및 어드민만 편집 가능" ON public.iota_pmo_tasks
    FOR ALL
    USING (
        auth.jwt() ->> 'email' IN (
            SELECT email FROM public.iota_members 
            WHERE department = '사업2파트' OR role_grade IN ('임원', '어드민')
        )
    );`)} className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-none text-[11.5px] font-medium text-black transition-all cursor-pointer" style={interFont}>
                                {copied ? 'Copy Text' : 'Copy Text'}
                            </button>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-12 hide-scrollbar">
                            <div className="max-w-[1000px] flex flex-col gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase" style={interFont}>SCHEMA SPECIFICATION</span>
                                    <h1 className="text-[16px] font-bold text-black leading-tight mt-1" style={interFont}>IOTA CFT Phase 2 DB Schema</h1>
                                    <p className="text-[13px] text-gray-500 mt-2 font-sans" style={interFont}>PMO 통합 제어 테이블 및 Supabase RLS 정책 DDL 명세서</p>
                                    <div className="h-[1px] bg-black w-full mt-6"></div>
                                </div>

                                <pre className="bg-[#F9F9FB] p-6 border border-gray-200 text-[12px] font-mono text-black overflow-x-auto whitespace-pre leading-relaxed select-text font-sans">
                                    <code>{`-- 1. PMO 통합 원장 테이블 (PMO Control Ledger)
CREATE TABLE public.iota_pmo_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_type VARCHAR NOT NULL,          -- 프로젝트 구분 (공통, 427PFV 등)
    category_main VARCHAR,                  -- 대분류 (PMO, 호텔, 인허가 등)
    task_name VARCHAR NOT NULL,             -- 업무명
    task_purpose TEXT,                      -- 업무목적 및 영향도
    lead_department VARCHAR,                -- 실행주관
    assignee VARCHAR,                       -- 담당자
    is_blocker BOOLEAN DEFAULT false,       -- Blocker 여부
    needs_decision BOOLEAN DEFAULT false,    -- 의사결정 필요 여부
    due_date DATE,                          -- 기한
    status VARCHAR DEFAULT '미착수',        -- 상태 (미착수, 진행중, 완료, 지연)
    priority_score INTEGER DEFAULT 0,       -- 우선순위 점수
    meeting_grade VARCHAR DEFAULT 'B',      -- 회의상정등급 (A_즉시상정, B_회의점검)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Supabase RLS (Row Level Security) 설정 예시
ALTER TABLE public.iota_pmo_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PM2 파트 및 어드민만 편집 가능" ON public.iota_pmo_tasks
    FOR ALL
    USING (
        auth.jwt() ->> 'email' IN (
            SELECT email FROM public.iota_members 
            WHERE department = '사업2파트' OR role_grade IN ('임원', '어드민')
        )
    );`}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
