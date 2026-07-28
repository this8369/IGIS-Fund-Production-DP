import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { normalizeIotaOrganization } from '../../../utils/iotaOrganizations.js';
import PmoDetailedSchedule from './PmoDetailedSchedule';

const COLUMNS = [
    { key: 'm06', labelTop: '~2026', labelBottom: '06' },
    { key: 'm07', labelTop: '2026', labelBottom: '07' },
    { key: 'm08', labelTop: '2026', labelBottom: '08' },
    { key: 'm09', labelTop: '2026', labelBottom: '09' },
    { key: 'm10', labelTop: '2026', labelBottom: '10' },
    { key: 'm11', labelTop: '2026.11', labelBottom: 'PF 1차', highlight: true },
    { key: 'm03', labelTop: '2027.03', labelBottom: 'PF 2차', highlight: true },
    { key: 'const_start', labelTop: '2027~', labelBottom: '착공' },
    { key: 'const_mid', labelTop: '공사~준공', labelBottom: '', highlight: true },
    { key: 'take_out', labelTop: 'Take-out', labelBottom: '운영', highlight: true }
];

const TIMELINE_DATA = [
    // Gates
    { category: 'Gate', name: 'G0 현황정리', desc: '업무원장·카테고리·우선순위 기준 확정', lead: '사업2파트', coop: '전부서', schedule: { m06: '●', m07: '●' } },
    { category: 'Gate', name: 'G1 방향결정', desc: '단독/통합 PF 방향, 호텔 브랜드, 시공사 조건', lead: '사업2파트', coop: 'LFC;기업마케팅;개발솔루션', schedule: { m07: '●', m08: '●' } },
    { category: 'Gate', name: 'G2 PF준비도', desc: '인허가·도면·임차·금융·법무 CP 준비', lead: '사업2파트', coop: '전부서', schedule: { m07: '●', m08: '●', m09: '●', m10: '●' } },
    { category: 'Gate', name: 'G3 PF실행', desc: '427/816 단독 또는 통합 PF 실행', lead: 'LFC', coop: '사업2파트;전부서', schedule: { m09: '●', m10: '●', m11: '◆', m03: '◆' } },
    { category: 'Gate', name: 'G4 착공/공사', desc: '착공조건, 책임착공, 공정관리 체계 전환', lead: '개발솔루션', coop: '사업2파트;LFC', schedule: { m03: '●', const_start: '●', const_mid: '●' } },
    { category: 'Gate', name: 'G5 준공/사용승인', desc: '준공 CP, 사용승인, 리스크 증빙자료 관리', lead: '개발솔루션', coop: '사업2파트;LFC', schedule: { const_start: '●', const_mid: '●' } },
    { category: 'Gate', name: 'G6 담보대출/운영', desc: 'Take-out, 운영전환, 임대 안정화, 자산관리', lead: '사업2파트', coop: '공간솔루션;기업마케팅', schedule: { const_mid: '●', take_out: '◆' } },
    // Functions
    { category: 'Task', name: '인허가', desc: '현금기부채납·소공원로·변경인가·사용승인', lead: '개발솔루션', coop: '사업2파트;', schedule: { m06: '●', m07: '●', m08: '●', m09: '●', const_start: '●', const_mid: '●' } },
    { category: 'Task', name: '호텔', desc: '브랜드·운영계약·운영수지·FF&E', lead: '사업2파트', coop: '기업마케팅;개발솔루션', schedule: { m07: '●', m08: '●', m09: '●', m10: '●', const_mid: '●' } },
    { category: 'Task', name: '시공/원가', desc: '현대/삼성 도급조건·공사비·신용공여', lead: '사업2파트', coop: '개발솔루션;LFC', schedule: { m07: '●', m08: '●', m09: '●', m10: '●', m11: '◆', m03: '◆', const_start: '●', const_mid: '●' } },
    { category: 'Task', name: '도면/설계', desc: 'PF 기준도면·면적표·실사자료', lead: '개발솔루션', coop: '기업마케팅;공간솔루션', schedule: { m06: '●', m07: '●', m08: '●', m09: '●', const_start: '●', const_mid: '●' } },
    { category: 'Task', name: '임차/마케팅', desc: '광장·KB·삼성/이지스·선임차', lead: '사업2파트', coop: '기업마케팅; 공간솔루션', schedule: { m07: '●', m08: '●', m09: '●', m10: '●', m11: '◆', m03: '◆', const_start: '●', const_mid: '●' } },
    { category: 'Task', name: 'PF/금융', desc: 'Term Sheet·대주단·재무모델·CP', lead: 'LFC', coop: '사업2파트;전부서', schedule: { m06: '●', m07: '●', m08: '●', m09: '●', m10: '●', m11: '◆', m03: '◆', take_out: '◆' } },
    { category: 'Task', name: '법무/세무/구조', desc: '리츠·Asset/Share·합병·주주승인', lead: '법무/세무자문', coop: '사업2파트;LFC', schedule: { m06: '●', m07: '●', m08: '●', m09: '●' } },
    { category: 'Task', name: '팝업업무', desc: '단발 요청 접수/위임/보류/반려', lead: '사업2파트', coop: '요청부서', schedule: { m06: '●', m07: '●', m08: '●', m09: '●', m10: '●', m11: '●', m03: '●', const_start: '●', const_mid: '●', take_out: '●' } }
];

const CATEGORY_MAP_DATA = [
    { majorCategory: '금융', category: 'PF/금융', subsector: '단독 PF', task: '427/816 단독 PF Term', pf: true, const: false, op: false, lead: '사업2파트', coop: ['사업1파트', 'LFC'], need: '대주단 Term', partner: '대주단, 주주사', point: '단독 가능성 기준' },
    { majorCategory: '금융', category: 'PF/금융', subsector: '통합 PF', task: '대주단 일치화·통합담보 구조', pf: true, const: false, op: false, lead: '사업2파트', coop: ['사업2파트', '법무/세무 외부자문'], need: '금융·법무 검토안', partner: '대주단, 주주사', point: '구조 전환 의사결정' },
    { majorCategory: '금융', category: 'PF/금융', subsector: '재무모델', task: '원가·임차·호텔·신용공여 모델 반영', pf: true, const: false, op: false, lead: '사업2파트', coop: ['전 부서'], need: '통합 재무모델', partner: '회계법인', point: '모든 조건의 숫자화' },
    { majorCategory: '금융', category: '구조/법무/세무', subsector: '리츠 전환', task: '427 리츠 전환+816 편입 검토', pf: true, const: false, op: false, lead: '사업2파트', coop: ['LFC', '법무/세무 외부자문', '사업1파트'], need: '구조 검토안', partner: '법무/세무법인', point: '기본 구조 재정의' },
    { majorCategory: '금융', category: '구조/법무/세무', subsector: 'Asset/Share/합병', task: '구조별 절차·세금·주주동의 비교', pf: true, const: false, op: false, lead: '사업1파트', coop: ['사업2파트', 'LFC'], need: '구조 비교표', partner: '법무/세무법인', point: '실행가능성 중심' },
    { majorCategory: '금융', category: '주주/보고', subsector: '의사결정', task: '6~7월 내부 의사결정 회의', pf: true, const: false, op: false, lead: '사업2파트', coop: ['전 부서'], need: '의사결정 자료', partner: '대표/본부장', point: '자료작업 반복 차단' },
    { majorCategory: '금융', category: '준공/담보대출', subsector: 'Take-out', task: '준공 후 담보대출/운영전환 전략', pf: false, const: false, op: true, lead: '사업2파트', coop: ['사업2파트', '기업마케팅', '개발솔루션'], need: '장기 금융전략', partner: '외부 기관', point: 'PF 조건과 연결' },
    { majorCategory: '개발', category: '인허가', subsector: '현금기부채납', task: '현금기부채납 규모·시기·조건 협의', pf: true, const: false, op: false, lead: '개발솔루션', coop: ['사업2파트', '사업1파트'], need: '관청 협의결과', partner: '서울시/중구청', point: '사업비 및 PF 조건에 직접 반영' },
    { majorCategory: '개발', category: '인허가', subsector: '소공원로', task: '도로/공공기여/공사동선 협의', pf: true, const: true, op: false, lead: '개발솔루션', coop: ['사업2파트'], need: '도로·공공기여 협의안', partner: '서울시/중구청', point: '착공·준공 일정 리스크' },
    { majorCategory: '개발', category: '인허가', subsector: '변경인가', task: '427/816 변경 가능성 및 리스크 검토', pf: true, const: true, op: false, lead: '개발솔루션', coop: ['사업2파트', '사업1파트'], need: '변경인가 검토안', partner: '관청', point: 'PF 전 설명 가능한 리스크로 정리' },
    { majorCategory: '개발', category: '인허가', subsector: '사용승인', task: '사용승인 CP/증빙자료 로드맵', pf: false, const: false, op: true, lead: '개발솔루션', coop: ['사업2파트'], need: '사용승인 로드맵', partner: '관청/대주단', point: 'Take-out 전제조건' },
    { majorCategory: '개발', category: '호텔/운영', subsector: '브랜드', task: '리츠칼튼/소노/대안 브랜드 의사결정', pf: true, const: false, op: false, lead: '사업2파트', coop: ['기업마케팅', '공간솔루션'], need: '브랜드 비교안', partner: 'Marriott, 대명소노', point: '427 PF 핵심 Blocker' },
    { majorCategory: '개발', category: '호텔/운영', subsector: '계약구조', task: 'HMA/Franchise/운영위탁 비교', pf: true, const: false, op: false, lead: '사업2파트', coop: ['법무/세무 외부자문'], need: '계약구조 비교안', partner: '브랜드사', point: 'Owner control과 termination' },
    { majorCategory: '개발', category: '호텔/운영', subsector: '운영수지/FF&E', task: '운영수지·FF&E·CAPEX 모델 반영', pf: true, const: false, op: false, lead: '사업2파트', coop: ['CFT'], need: '운영수지 모델', partner: '브랜드사', point: '사업비와 상환가능성 영향' },
    { majorCategory: '개발', category: '시공/원가', subsector: '현대건설', task: '427 도급조건·신용공여', pf: true, const: true, op: false, lead: '사업2파트', coop: ['사업1파트', '개발솔루션'], need: '현대 Term', partner: '현대건설', point: '427 PF 실행조건' },
    { majorCategory: '개발', category: '시공/원가', subsector: '삼성물산', task: '816 도급조건·책임임차·LOC', pf: true, const: true, op: false, lead: '사업2파트', coop: ['사업1파트', '개발솔루션'], need: '삼성 Term', partner: '삼성물산', point: '816 단독/통합 PF' },
    { majorCategory: '개발', category: '시공/원가', subsector: '공사비/VE', task: '공사비 검증·VE·공기단축', pf: true, const: true, op: true, lead: '개발솔루션', coop: ['사업2파트'], need: '공사비 검증안', partner: '시공사/CM', point: '원가 부담 완화' },
    { majorCategory: '개발', category: '도면/설계', subsector: 'PF 기준도면', task: '대주단 제출용 기준도면', pf: true, const: false, op: false, lead: '개발솔루션', coop: ['공간솔루션', '사업2파트'], need: 'PF 기준도면', partner: '설계사/CM', point: '모든 자료의 기준' },
    { majorCategory: '개발', category: '도면/설계', subsector: '면적표', task: 'GFA/NLA/전용률/임대면적 기준', pf: true, const: false, op: false, lead: '개발솔루션', coop: ['공간솔루션', '사업2파트'], need: '기준 면적표', partner: '설계사/CM', point: '임차/모델 불일치 방지' },
    { majorCategory: '개발', category: '인테리어', subsector: '오피스/호텔', task: '상품기획/Tech/FF&E 설계반영, CAPEX 반영', pf: false, const: true, op: false, lead: '공간솔루션', coop: ['개발솔루션'], need: '상품기획·설계안', partner: '다원, da', point: '임차조건 및 모델 반영' },
    { majorCategory: '운영/마케팅', category: '임차/마케팅', subsector: '816 화우', task: '제안PT, 임차 조건·면적·Term', pf: true, const: false, op: false, lead: '기업마케팅', coop: ['사업2파트', '공간솔루션'], need: '임차 제안안', partner: 'PWC', point: '제안 및 선임차 확보' },
    { majorCategory: '운영/마케팅', category: '임차/마케팅', subsector: '427 광장', task: '제안PT, 임차 조건·면적·Term', pf: true, const: false, op: false, lead: '기업마케팅', coop: ['사업2파트', '공간솔루션'], need: '임차 제안안', partner: 'PWC', point: '제안 및 선임차 확보' },
    { majorCategory: '운영/마케팅', category: '임차/마케팅', subsector: '816 KB증권', task: '제안PT, 임차 조건·면적·Term', pf: true, const: false, op: false, lead: '기업마케팅', coop: ['사업2파트', '공간솔루션'], need: '임차 제안안', partner: 'PWC', point: '제안 및 선임차 확보' },
    { majorCategory: '운영/마케팅', category: '임차/마케팅', subsector: '427 LG전자', task: '제안PT, 임차 조건·면적·Term', pf: true, const: false, op: false, lead: '기업마케팅', coop: ['사업2파트', '공간솔루션'], need: '임차 제안안', partner: 'PWC', point: '제안 및 선임차 확보' },
    { majorCategory: '운영/마케팅', category: '임차/마케팅', subsector: '816 이지스', task: '816 선임차·책임임차·이전 가능성', pf: true, const: false, op: false, lead: '사업2파트', coop: ['이지스 경영지원'], need: '내부 이전 검토안', partner: '이사회', point: '제안 및 선임차 확보' },
    { majorCategory: '운영/마케팅', category: '임차/마케팅', subsector: '816 삼성물산', task: '816 선임차·책임임차·이전 가능성', pf: true, const: false, op: false, lead: '사업2파트', coop: ['삼성물산'], need: '책임임차 검토안', partner: '주주', point: '제안 및 선임차 확보' }
];

const R_R_DATA_VERSION = '2026-07-23-r2';
const R_R_STORAGE_KEY = 'iota_rr_matrix';
const R_R_MAJOR_CATEGORIES = ['전체보기', '금융', '개발', '운영/마케팅'];
const R_R_CATEGORIES = [
    '전체보기', 'PF/금융', '구조/법무/세무', '주주/보고', '준공/담보대출',
    '인허가', '호텔/운영', '시공/원가', '도면/설계', '인테리어', '임차/마케팅'
];
const normalizeRrItem = (item, index) => ({
    ...item,
    id: item.id || `mock-${index}`,
    lead: normalizeIotaOrganization(item.lead),
    coop: Array.from(new Set((item.coop || []).map((name) => normalizeIotaOrganization(name))))
});

export default function PmoScheduleGate() {
    const [timelineView, setTimelineView] = useState('detail');
    const [filterCategory, setFilterCategory] = React.useState('All'); // All, Gate, Task
    const [selectedRrMajorCategory, setSelectedRrMajorCategory] = React.useState('전체보기');
    const [selectedRrCategory, setSelectedRrCategory] = React.useState('전체보기');
    const [selectedRrLead, setSelectedRrLead] = React.useState('전체보기');
    const [selectedRrCoop, setSelectedRrCoop] = React.useState('전체보기');
    const [scrollLeft, setScrollLeft] = React.useState(0);

    const [rrData, setRrData] = useState(() => {
        const local = localStorage.getItem(R_R_STORAGE_KEY);
        if (local) {
            try {
                const stored = JSON.parse(local);
                if (stored?.version === R_R_DATA_VERSION && Array.isArray(stored.items)) {
                    return stored.items.map(normalizeRrItem);
                }
            } catch (e) {
                console.error("Failed to parse local rr matrix:", e);
            }
        }
        return CATEGORY_MAP_DATA.map(normalizeRrItem);
    });

    useEffect(() => {
        localStorage.setItem(R_R_STORAGE_KEY, JSON.stringify({
            version: R_R_DATA_VERSION,
            items: rrData
        }));
    }, [rrData]);

    const DEPARTMENTS_LIST = [
        '개발솔루션', '사업2파트', '사업1파트',
        '공간솔루션', '기업마케팅', 'LFC', '법무/세무 외부자문', 'CFT',
        '이지스 경영지원', '삼성물산', '전부서'
    ];
    const PARTNERS_LIST = [
        '대주단, 주주사', '회계법인', '법무/세무법인', '대표/본부장', '외부 기관',
        '서울시/중구청', '관청', '관청/대주단', 'Marriott, 대명소노', '브랜드사',
        '현대건설', '삼성물산', '시공사/CM', '설계사/CM', '다원, da', 'PWC', '이사회', '주주'
    ];

    // Authorization & User session
    const { memberInfo } = useAuth();
    const isAuthorized = useMemo(() => {
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

    // Modal Control States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [editingItem, setEditingItem] = useState(null);

    // Form inputs
    const [formMajorCategory, setFormMajorCategory] = useState('금융');
    const [formCategory, setFormCategory] = useState('PF/금융');
    const [formSubsector, setFormSubsector] = useState('');
    const [formTaskName, setFormTaskName] = useState('');
    const [formPf, setFormPf] = useState(false);
    const [formConst, setFormConst] = useState(false);
    const [formOp, setFormOp] = useState(false);
    const [formLead, setFormLead] = useState('');
    const [formCoop, setFormCoop] = useState([]);
    const [formPartner, setFormPartner] = useState('');
    const [formNeed, setFormNeed] = useState('');
    const [formPoint, setFormPoint] = useState('');

    const handleOpenEditModal = (item) => {
        setModalMode('edit');
        setEditingItem(item);
        setFormMajorCategory(item.majorCategory);
        setFormCategory(item.category);
        setFormSubsector(item.subsector);
        setFormTaskName(item.task);
        setFormPf(item.pf);
        setFormConst(item.const);
        setFormOp(item.op);
        setFormLead(item.lead || DEPARTMENTS_LIST[0]);
        setFormCoop(item.coop || []);
        setFormPartner(item.partner || '');
        setFormNeed(item.need || '');
        setFormPoint(item.point || '');
        setIsModalOpen(true);
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setEditingItem(null);
        setFormMajorCategory('금융');
        setFormCategory('PF/금융');
        setFormSubsector('');
        setFormTaskName('');
        setFormPf(false);
        setFormConst(false);
        setFormOp(false);
        setFormLead(DEPARTMENTS_LIST[0]);
        setFormCoop([]);
        setFormPartner('');
        setFormNeed('');
        setFormPoint('');
        setIsModalOpen(true);
    };

    const handleSaveRrItem = (e) => {
        e.preventDefault();
        const payload = normalizeRrItem({
            id: modalMode === 'add' ? `custom-${Date.now()}` : editingItem.id,
            majorCategory: formMajorCategory,
            category: formCategory,
            subsector: formSubsector,
            task: formTaskName,
            pf: formPf,
            const: formConst,
            op: formOp,
            lead: formLead,
            coop: formCoop,
            need: formNeed,
            partner: formPartner,
            point: formPoint
        });

        if (modalMode === 'add') {
            setRrData(prev => [...prev, payload]);
        } else {
            setRrData(prev => prev.map(item => item.id === editingItem.id ? payload : item));
        }
        setIsModalOpen(false);
    };

    const handleDeleteRrItem = (item) => {
        if (!window.confirm("정말 이 R&R 항목을 삭제하시겠습니까?")) return;
        setRrData(prev => prev.filter(i => i.id !== item.id));
    };

    const handleExportJson = () => {
        const cleanData = rrData.map(({ id, ...rest }) => rest);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "rr_matrix_data.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    const handleCopyToClipboard = () => {
        const cleanData = rrData.map(({ id, ...rest }) => rest);
        navigator.clipboard.writeText(JSON.stringify(cleanData, null, 2));
        alert("R&R 데이터가 클립보드에 복사되었습니다. PmoScheduleGate.jsx의 CATEGORY_MAP_DATA에 덮어씌울 수 있습니다.");
    };

    // Timeline Drag-to-Scroll Logic
    const sliderRef = React.useRef(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [startX, setStartX] = React.useState(0);
    const [dragScrollLeft, setDragScrollLeft] = React.useState(0);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setStartX(e.pageX - sliderRef.current.offsetLeft);
        setDragScrollLeft(sliderRef.current.scrollLeft);
    };
    const handleMouseLeave = () => { setIsDragging(false); };
    const handleMouseUp = () => { setIsDragging(false); };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - sliderRef.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        sliderRef.current.scrollLeft = dragScrollLeft - walk;
    };

    const getSelectWidth = (value, defaultLabel) => {
        const text = value === '전체보기' ? defaultLabel : value;
        let len = 0;
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code >= 0 && code <= 128) len += 6.5;
            else len += 12.0;
        }
        return `${Math.max(len - 4, 16)}px`;
    };

    const R_R_LEADS = React.useMemo(() => {
        const leads = rrData.map(item => item.lead).filter(Boolean);
        return ['전체보기', ...Array.from(new Set(leads))];
    }, [rrData]);

    const R_R_COOPS = React.useMemo(() => {
        const coops = rrData.flatMap(item => item.coop).filter(Boolean);
        return ['전체보기', ...Array.from(new Set(coops))];
    }, [rrData]);

    const filteredData = TIMELINE_DATA.filter(item => {
        if (filterCategory === 'All') return true;
        return item.category === filterCategory;
    });

    const renderCategoryName = (name) => {
        if (name.startsWith('G') && name.includes(' ')) {
            const parts = name.split(' ');
            return (
                <div className="leading-[1.2] text-center">
                    <div className="text-[11px] font-bold">{parts[0]}</div>
                    <div className="text-[11px] font-bold mt-0.5 opacity-90">{parts[1]}</div>
                </div>
            );
        }
        return <div className="text-center text-[11px] font-bold">{name}</div>;
    };

    return (
        <div className="w-full flex-1 flex flex-col px-[60px] pt-[28px] pb-[200px] box-border select-text text-white bg-transparent text-left">
            <style>{`
                .timeline-scrollbar::-webkit-scrollbar {
                    height: 8px;
                    width: 8px;
                }
                .timeline-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 10px;
                }
                .timeline-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.12);
                    border-radius: 10px;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
                .timeline-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.25);
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
                .timeline-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.12) rgba(255, 255, 255, 0.02);
                }
                @keyframes scheduleDueIndicatorPulse {
                    0%, 100% {
                        opacity: 0.58;
                        box-shadow: 0 0 0 rgba(245, 158, 11, 0);
                    }
                    50% {
                        opacity: 1;
                        box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
                    }
                }
                @keyframes scheduleOverdueIndicatorPulse {
                    0%, 100% {
                        opacity: 0.58;
                        box-shadow: 0 0 0 rgba(255, 95, 87, 0);
                    }
                    50% {
                        opacity: 1;
                        box-shadow: 0 0 8px rgba(255, 95, 87, 0.5);
                    }
                }
                .schedule-attention-indicator-due {
                    animation: scheduleDueIndicatorPulse 1.6s ease-in-out infinite;
                }
                .schedule-attention-indicator-overdue {
                    animation: scheduleOverdueIndicatorPulse 1.4s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .schedule-attention-indicator-due,
                    .schedule-attention-indicator-overdue {
                        animation: none;
                    }
                }
            `}</style>
            {/* Header */}
            <div className="w-full flex items-end justify-between mb-[12px]">
                <div className="flex items-center gap-[16px]">
                    <h1 className="text-[32px] font-bold text-white tracking-tight leading-none">마일스톤</h1>
                    <div className="flex h-[30px] items-center rounded-[9px] border border-[#3c3c3c] bg-[#252524]">
                        <button
                            type="button"
                            onClick={() => setTimelineView('detail')}
                            className={`h-[28px] rounded-[7px] border px-3 text-[11px] font-bold transition-colors ${
                                timelineView === 'detail'
                                    ? 'border-[#263b52] bg-[#3b4f68] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]'
                                    : 'border-transparent text-[#86868B] hover:text-white'
                            }`}
                        >
                            상세 일정
                        </button>
                        <button
                            type="button"
                            onClick={() => setTimelineView('summary')}
                            className={`h-[28px] rounded-[7px] border px-3 text-[11px] font-bold transition-colors ${
                                timelineView === 'summary'
                                    ? 'border-[#263b52] bg-[#3b4f68] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]'
                                    : 'border-transparent text-[#86868B] hover:text-white'
                            }`}
                        >
                            Gate 요약
                        </button>
                    </div>
                </div>
            </div>

            {timelineView === 'detail' ? (
                <PmoDetailedSchedule />
            ) : (
                /* Timeline Matrix Grid */
                <div className="w-[1290px] border border-[#3c3c3c] bg-[#272726] rounded-[32px] overflow-visible relative">
                <div className="absolute right-4 top-[-38px] flex items-center gap-4 text-[12px] font-bold">
                    <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2997ff]"></span>
                        <span className="text-[#E5E5E5]">수행 진행 기간</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="mb-0.5 flex h-[12px] items-center font-mono text-[16px] leading-none text-[#F59E0B]">◆</span>
                        <span className="text-[#E5E5E5]">마일스톤 달성</span>
                    </div>
                </div>
                
                {/* Speech Bubbles Overlay */}
                <div className="absolute top-[-68px] left-0 w-full h-[36px] pointer-events-none z-50 overflow-visible">
                    {/* PF 1차 */}
                    {(() => {
                        const x = 952.5;
                        return (
                            <div 
                                style={{ left: `${x}px`, opacity: 1 }} 
                                className="absolute -translate-x-1/2 top-[14px] bg-[#ff9f0a] text-[#1c1c1e] rounded-[6px] text-[11px] font-bold shadow-lg text-center leading-tight w-[58px] h-[44px] flex flex-col justify-center items-center pointer-events-auto"
                            >
                                <div>PF 달성</div>
                                <div>1차목표</div>
                                <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[6px] border-t-[#ff9f0a]"></div>
                            </div>
                        );
                    })()}
                    
                    {/* PF 2차 */}
                    {(() => {
                        const x = 1027.5;
                        return (
                            <div 
                                style={{ left: `${x}px`, opacity: 1 }} 
                                className="absolute -translate-x-1/2 top-[4px] bg-[#2c2c2e] text-white border border-[#3c3c3c] rounded-[6px] text-[11px] font-bold shadow-lg text-center leading-tight w-[70px] h-[54px] flex flex-col justify-center items-center pointer-events-auto"
                            >
                                <div>1차목표</div>
                                <div>미달성시</div>
                                <div>2차목표</div>
                                <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[6px] border-t-[#2c2c2e]"></div>
                                <div className="absolute bottom-[-7px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[6px] border-t-[#3c3c3c] z-[-1]"></div>
                            </div>
                        );
                    })()}
                </div>

                <div className="w-full rounded-[32px] select-text">
                    <div className="flex items-center w-full overflow-visible pointer-events-none">
                        <table className="text-left table-fixed w-[1290px] min-w-[1290px] max-w-[1290px] pointer-events-auto">
                            <thead>
                                <tr className="border-b border-[#3c3c3c] bg-transparent text-[#86868B] font-bold text-[13px] h-12">
                                    <th className="pl-[10px] pr-1 w-[94px] min-w-[94px] max-w-[94px] text-center bg-[#272726] rounded-tl-[31px]">구분</th>
                                    <th className="pl-3 w-[258px] min-w-[258px] max-w-[258px] bg-[#272726]">세부업무</th>
                                    <th className="px-1 w-[94px] min-w-[94px] max-w-[94px] text-center bg-[#272726]">주관</th>
                                    <th className="px-1 w-[94px] min-w-[94px] max-w-[94px] text-center bg-[#272726] border-r border-[#3c3c3c]">협업</th>
                                    {COLUMNS.map((col, cIdx) => {
                                        const isLast = cIdx === COLUMNS.length - 1;
                                        const borderClass = col.highlight
                                            ? `bg-white/[0.03] text-[#60a5fa] ${isLast ? '' : 'border-r border-[#4c4c4c]/50'}`
                                            : `text-[#86868B] ${isLast ? '' : 'border-r border-[#4c4c4c]/50'}`;
                                        return (
                                            <th key={col.key} className={`text-center font-['Inter'] text-[11px] leading-tight px-1 font-bold w-[75px] min-w-[75px] max-w-[75px] ${borderClass} ${isLast ? 'rounded-tr-[31px]' : ''}`}>
                                                <div>{col.labelTop}</div>
                                                {col.labelBottom && <div className="text-[11px] opacity-75 mt-0.5">{col.labelBottom}</div>}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#3c3c3c] text-[13px]">
                                {filteredData.map((item, idx) => {
                                    const isGate = item.category === 'Gate';
                                    const isLastRow = idx === filteredData.length - 1;
                                    return (
                                        <tr key={idx} className="hover:bg-[#333] transition-colors h-[50px] group">
                                            {/* 구분 */}
                                            <td className={`pl-[10px] pr-1 bg-[#272726] group-hover:bg-[#333] transition-colors text-center w-[94px] min-w-[94px] max-w-[94px] ${
                                                isLastRow ? 'rounded-bl-[31px]' : ''
                                            }`}>
                                                <span className={`px-1.5 py-1 rounded-md font-bold block ${
                                                    isGate 
                                                        ? 'bg-[#2997ff]/10 text-[#60a5fa] border border-[#2997ff]/20' 
                                                        : 'bg-[#a1a1aa]/10 text-[#e4e4e7] border border-[#a1a1aa]/20'
                                                }`}>
                                                    {renderCategoryName(item.name)}
                                                </span>
                                            </td>
                                            
                                            {/* 세부업무 */}
                                            <td className="pl-3 font-medium text-[#bdbba7] leading-snug text-left pr-2 whitespace-normal break-words bg-[#272726] group-hover:bg-[#333] transition-colors text-[13px] tracking-tight w-[258px] min-w-[258px] max-w-[258px]">
                                                {item.desc}
                                            </td>
                                            
                                            {/* 주관 */}
                                            <td className="px-1 text-[#E5E5E5] font-semibold text-center bg-[#272726] group-hover:bg-[#333] transition-colors text-[12px] leading-tight tracking-tight whitespace-normal break-words w-[94px] min-w-[94px] max-w-[94px]">
                                                {item.lead.includes(' ') ? (
                                                    item.lead.split(' ').map((part, pIdx) => (
                                                        <div key={pIdx}>{part}</div>
                                                    ))
                                                ) : (
                                                    item.lead
                                                )}
                                            </td>
                                            
                                            {/* 협업 */}
                                            <td className="px-1 text-[#c2c2c6] leading-tight text-center whitespace-normal break-words bg-[#272726] group-hover:bg-[#333] transition-colors border-r border-[#3c3c3c]  w-[94px] min-w-[94px] max-w-[94px]">
                                                {item.coop.split(';').map((c, cIdx) => (
                                                    c && <div key={cIdx} className="text-[11px]">{c}</div>
                                                ))}
                                            </td>

                                            {/* Grid Columns */}
                                            {COLUMNS.map((col, cIdx) => {
                                                const isLastCol = cIdx === COLUMNS.length - 1;
                                                const mark = item.schedule[col.key];
                                                const borderClass = isLastCol ? '' : 'border-r border-[#4c4c4c]/40';
                                                return (
                                                    <td key={col.key} className={`text-center ${
                                                        col.highlight ? 'bg-white/[0.015] group-hover:bg-white/[0.04]' : ''
                                                    } ${borderClass} w-[75px] min-w-[75px] max-w-[75px] ${isLastRow && isLastCol ? 'rounded-br-[31px]' : ''}`}>
                                                        {mark === '●' && (
                                                            <span className="w-3.5 h-3.5 rounded-full bg-[#2997ff] inline-block shadow-sm shadow-[#2997ff]/20"></span>
                                                        )}
                                                        {mark === '◆' && (
                                                            <span className="text-[#F59E0B] font-mono text-[28px] font-extrabold block translate-y-[-1px] animate-pulse">◆</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                </div>
            )}

            {/* Category Map & R&R Section */}
            <div className="w-full flex items-end justify-between mt-[41px] mb-[16px]">
                <div className="flex items-baseline gap-[16px]">
                    <h2 className="text-[32px] font-bold text-white tracking-tight leading-none text-left">R&R 및 필요산출물</h2>
                    <p className="text-[15px] text-[#86868B] leading-none">회의체 협업 부서 및 필요산출물, 핵심 관리 포인트를 조회합니다.</p>
                </div>
                {isAuthorized && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsExportOpen(true)}
                            className="bg-[#2c2c2b] border border-[#3c3c3c] text-[#bdbba7] hover:text-white hover:border-[#4c4c4b] transition-colors rounded-full px-4 py-2 text-[13px] font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                            <span>JSON 내보내기</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenAddModal}
                            className="bg-[#2997ff] text-white hover:bg-[#0071e3] transition-colors rounded-full px-4 py-2 text-[13px] font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                            <span>+ R&R 추가</span>
                        </button>
                    </div>
                )}
            </div>

            {/* R&R Matrix Table */}
            <div className="w-full border border-[#3c3c3c] bg-[#272726] rounded-[32px] overflow-x-auto relative mb-[40px] shadow-sm h-auto timeline-scrollbar">
                <div className="w-full rounded-[32px] select-text">
                    <div className="flex items-center w-full overflow-visible pointer-events-none">
                        <table className={`text-left table-fixed pointer-events-auto border-collapse border-b border-[#3c3c3c] bg-[#272726] ${
                            isAuthorized 
                                ? 'w-[1435px] min-w-[1435px] max-w-[1435px]'
                                : 'w-[1375px] min-w-[1375px] max-w-[1375px]'
                        }`}>
                            <thead>
                                <tr className="border-b border-[#3c3c3c] bg-[#272726] text-[#86868B] font-bold text-[12px] h-[56px]">
                                    <th className="px-1 w-[85px] min-w-[85px] max-w-[85px] text-center bg-[#272726] rounded-tl-[31px] z-30">
                                        <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-2 py-1 transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b]">
                                            <span className={`font-bold text-[12px] whitespace-nowrap ${selectedRrMajorCategory === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                {selectedRrMajorCategory === '전체보기' ? '대분류' : selectedRrMajorCategory}
                                            </span>
                                            <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1">▼</span>
                                            <select
                                                value={selectedRrMajorCategory}
                                                onChange={(e) => {
                                                    setSelectedRrMajorCategory(e.target.value);
                                                    setSelectedRrCategory('전체보기');
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            >
                                                {R_R_MAJOR_CATEGORIES.map(category => (
                                                    <option key={category} value={category} className="bg-[#222] text-white">
                                                        {category}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </th>
                                    <th className="px-1 w-[110px] min-w-[110px] max-w-[110px] text-center bg-[#272726] z-30">
                                        <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-2 py-1 transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b]">
                                            <span className={`font-bold text-[12px] whitespace-nowrap ${selectedRrCategory === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                {selectedRrCategory === '전체보기' ? '업무분류' : selectedRrCategory}
                                            </span>
                                            <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1">▼</span>
                                            <select
                                                value={selectedRrCategory}
                                                onChange={(e) => setSelectedRrCategory(e.target.value)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            >
                                                {R_R_CATEGORIES.map(category => (
                                                    <option key={category} value={category} className="bg-[#222] text-white">
                                                        {category}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </th>
                                    <th className="px-1 w-[80px] min-w-[80px] max-w-[80px] text-center bg-[#272726] z-30 whitespace-nowrap">세부섹터</th>
                                    <th className="pl-3 w-[230px] min-w-[230px] max-w-[230px] bg-[#272726] border-r border-[#3c3c3c] ">대표 업무</th>
                                    <th className="px-2 w-[65px] min-w-[65px] max-w-[65px] text-center bg-[#272726] text-[11px] leading-tight">PF 전<br />필요</th>
                                    <th className="px-2 w-[65px] min-w-[65px] max-w-[65px] text-center bg-[#272726] text-[11px] leading-tight">착공 전<br />필요</th>
                                    <th className="px-2 w-[65px] min-w-[65px] max-w-[65px] text-center bg-[#272726] text-[11px] leading-tight border-r border-[#3c3c3c]">준공 전<br />필요</th>
                                    <th className="w-[90px] min-w-[90px] max-w-[90px] text-center bg-[#272726]">
                                        <div className="relative inline-flex items-center justify-center bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-2 py-1 transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b] translate-x-[6px]">
                                            <span className={`font-bold text-[12px] whitespace-nowrap ${selectedRrLead === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                {selectedRrLead === '전체보기' ? '주관 부서' : selectedRrLead}
                                            </span>
                                            <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1">▼</span>
                                            <select
                                                value={selectedRrLead}
                                                onChange={(e) => setSelectedRrLead(e.target.value)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            >
                                                <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 주관 부서 ]</option>
                                                <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                {R_R_LEADS.slice(1).map(lead => (
                                                    <option key={lead} value={lead} className="bg-[#222] text-white">{lead}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </th>
                                    <th className="pl-3 w-[245px] min-w-[245px] max-w-[245px] text-left bg-[#272726] border-r border-[#3c3c3c]">
                                        <div className="relative inline-flex items-center justify-start bg-[#2c2c2b] border border-[#3c3c3c] rounded-[6px] px-2.5 py-1 transition-colors cursor-pointer hover:bg-[#323231] hover:border-[#4c4c4b]">
                                            <span className={`font-bold text-[12px] whitespace-nowrap ${selectedRrCoop === '전체보기' ? 'text-[#86868B]' : 'text-[#2997ff]'}`}>
                                                {selectedRrCoop === '전체보기' ? '협업 부서' : selectedRrCoop}
                                            </span>
                                            <span className="text-[8px] text-[#86868B]/70 pointer-events-none select-none translate-y-[0.5px] ml-1">▼</span>
                                            <select
                                                value={selectedRrCoop}
                                                onChange={(e) => setSelectedRrCoop(e.target.value)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            >
                                                <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 협업 부서 ]</option>
                                                <option value="전체보기" className="bg-[#222] text-[#86868B]">전체보기</option>
                                                {R_R_COOPS.slice(1).map(coop => (
                                                    <option key={coop} value={coop} className="bg-[#222] text-white">{coop}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </th>
                                    <th className="px-1 tracking-tighter whitespace-nowrap w-[95px] min-w-[95px] max-w-[95px] text-center bg-[#272726]">외부 상대방</th>
                                    <th className="px-1 tracking-tighter whitespace-nowrap w-[75px] min-w-[75px] max-w-[75px] text-center bg-[#272726]">필요산출물</th>
                                    <th className={`px-3 text-left bg-[#272726] w-[170px] min-w-[170px] max-w-[170px] whitespace-nowrap ${
                                        isAuthorized 
                                            ? 'border-r border-[#3c3c3c]' 
                                            : 'border-r border-[#3c3c3c] rounded-tr-[31px]'
                                    }`}>2026 관리/성과 포인트</th>
                                    {isAuthorized && (
                                        <th className="px-1 w-[60px] min-w-[60px] max-w-[60px] text-center bg-[#272726] border-r border-[#3c3c3c] rounded-tr-[31px] whitespace-nowrap">관리</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#3c3c3c]/60 text-[12px]">
                                {rrData.filter(item => {
                                    const matchMajorCategory = selectedRrMajorCategory === '전체보기' || item.majorCategory === selectedRrMajorCategory;
                                    const matchCat = selectedRrCategory === '전체보기' || item.category === selectedRrCategory;
                                    const matchLead = selectedRrLead === '전체보기' || item.lead === selectedRrLead;
                                    const matchCoop = selectedRrCoop === '전체보기' || item.coop.includes(selectedRrCoop);
                                    return matchMajorCategory && matchCat && matchLead && matchCoop;
                                }).map((item, index, array) => {
                                    const isLastItem = index === array.length - 1;
                                    return (
                                        <tr key={item.id} className={`bg-[#272726] hover:bg-[#333] transition-colors h-12 group ${isAuthorized ? 'cursor-pointer' : ''}`} onClick={() => isAuthorized && handleOpenEditModal(item)}>
                                            {/* 대분류 */}
                                            <td className={`px-2 bg-[#272726] group-hover:bg-[#333] transition-colors text-center font-bold text-[#60a5fa] text-[12px] w-[85px] min-w-[85px] max-w-[85px] ${isLastItem ? 'rounded-bl-[31px]' : ''}`}>
                                                {item.majorCategory}
                                            </td>

                                            {/* 업무분류 */}
                                            <td className="px-2 bg-[#272726] group-hover:bg-[#333] transition-colors text-center font-bold text-white text-[12px] w-[110px] min-w-[110px] max-w-[110px]">
                                                {item.category}
                                            </td>
                                            
                                            {/* 세부섹터 */}
                                            <td className="px-1 bg-[#272726] group-hover:bg-[#333] transition-colors text-center font-bold text-[#E5E5E5] text-[12px] whitespace-nowrap overflow-hidden text-ellipsis w-[80px] min-w-[80px] max-w-[80px]">
                                                {item.subsector}
                                            </td>
                                            
                                            {/* 대표 업무 */}
                                            <td className="pl-3 font-bold text-[#bdbba7] leading-snug text-left pr-2 whitespace-normal break-words bg-[#272726] group-hover:bg-[#333] transition-colors border-r border-[#3c3c3c] text-[13px] w-[230px] min-w-[230px] max-w-[230px]">
                                                {item.task}
                                            </td>
                                            
                                            {/* PF 전 필요 */}
                                            <td className="px-2 text-center w-[65px] min-w-[65px] max-w-[65px]">
                                                {item.pf ? (
                                                    <span className="px-2 py-0.5 text-[10.5px] font-bold rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap">필수</span>
                                                ) : (
                                                    <span className="text-[#555] font-bold">-</span>
                                                )}
                                            </td>
 
                                            {/* 착공 전 필요 */}
                                            <td className="px-2 text-center w-[65px] min-w-[65px] max-w-[65px]">
                                                {item.const ? (
                                                    <span className="px-2 py-0.5 text-[10.5px] font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">필수</span>
                                                ) : (
                                                    <span className="text-[#555] font-bold">-</span>
                                                )}
                                            </td>
 
                                            {/* 준공 전 필요 */}
                                            <td className="px-2 text-center border-r border-[#3c3c3c] w-[65px] min-w-[65px] max-w-[65px]">
                                                {item.op ? (
                                                    <span className="px-2 py-0.5 text-[10.5px] font-bold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">필수</span>
                                                ) : (
                                                    <span className="text-[#555] font-bold">-</span>
                                                )}
                                            </td>
 
                                            {/* 주관 부서 */}
                                            <td className="text-center w-[90px] min-w-[90px] max-w-[90px] bg-[#272726] group-hover:bg-[#333] transition-colors">
                                                <span className="px-2.5 py-0.5 rounded font-bold bg-[#2997ff]/10 text-white border border-[#2997ff]/20 text-[11px] whitespace-nowrap inline-block translate-x-[6px]">
                                                    {item.lead}
                                                </span>
                                            </td>
                                            
                                            {/* 협업 부서 */}
                                            <td className="pl-3 text-left w-[245px] min-w-[245px] max-w-[245px] border-r border-[#3c3c3c] whitespace-normal break-words leading-tight pr-2 text-[#E5E5E5] bg-[#272726] group-hover:bg-[#333] transition-colors">
                                                <div className="flex flex-row gap-1.5 justify-start items-center whitespace-nowrap">
                                                    {item.coop.map((c, cIdx) => (
                                                        c && <span key={cIdx} className="px-2 py-0.5 rounded bg-[#1F1F1E] text-[#C2C2C6] border border-[#3c3c3c] text-[11px] whitespace-nowrap">{c}</span>
                                                    ))}
                                                </div>
                                            </td>
 
                                            {/* 외부 상대방 */}
                                            <td className="px-1 text-center text-[#A1A1AA] font-semibold whitespace-nowrap overflow-hidden text-ellipsis w-[95px] min-w-[95px] max-w-[95px] bg-[#272726] group-hover:bg-[#333] transition-colors">
                                                {item.partner || '-'}
                                            </td>
 
                                            {/* 필요산출물 */}
                                            <td className="px-1 text-center text-[#F59E0B] font-semibold whitespace-nowrap overflow-hidden text-ellipsis w-[75px] min-w-[75px] max-w-[75px] bg-[#272726] group-hover:bg-[#333] transition-colors">
                                                {item.need || '-'}
                                            </td>
 
                                            {/* 관리 포인트 */}
                                            <td className={`px-2 text-left text-[#A1A1AA] font-normal whitespace-nowrap overflow-hidden text-ellipsis w-[170px] min-w-[170px] max-w-[170px] border-r border-[#3c3c3c] bg-[#272726] group-hover:bg-[#333] transition-colors ${
                                                isLastItem && !isAuthorized ? 'rounded-br-[31px]' : ''
                                            }`}>
                                                {item.point}
                                            </td>
                                            {isAuthorized && (
                                                <td className={`px-1 text-center w-[60px] min-w-[60px] max-w-[60px] border-r border-[#3c3c3c] bg-[#272726] group-hover:bg-[#333] transition-colors ${
                                                    isLastItem ? 'rounded-br-[31px]' : ''
                                                }`}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEditModal(item); }}
                                                            className="text-[#2997ff] hover:text-[#0071e3] transition-colors cursor-pointer text-[12px] font-bold p-0.5"
                                                            title="수정"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteRrItem(item); }}
                                                            className="text-red-500 hover:text-red-700 transition-colors cursor-pointer text-[12px] font-bold p-0.5"
                                                            title="삭제"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* R&R Edit/Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] select-none" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-[#272726] border border-[#3c3c3c] text-white rounded-[24px] shadow-2xl p-[24px] w-[520px] max-w-[95%] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-[#3c3c3c] pb-3">
                            <h3 className="text-[18px] font-bold text-white">
                                {modalMode === 'add' ? 'R&R 및 필요산출물 추가' : 'R&R 및 필요산출물 수정'}
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-[#86868B] hover:text-white transition-colors text-[18px] font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveRrItem} className="flex flex-col gap-3.5 overflow-y-auto max-h-[70vh] pr-1 scrollbar-thin">
                            {/* 대분류 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">대분류</label>
                                <select
                                    value={formMajorCategory}
                                    onChange={(e) => setFormMajorCategory(e.target.value)}
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1"
                                >
                                    {R_R_MAJOR_CATEGORIES.slice(1).map(category => (
                                        <option key={category} value={category} className="bg-[#222] text-white">{category}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 업무분류 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">업무분류</label>
                                <select 
                                    value={formCategory} 
                                    onChange={(e) => setFormCategory(e.target.value)}
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1"
                                >
                                    {R_R_CATEGORIES.slice(1).map(cat => (
                                        <option key={cat} value={cat} className="bg-[#222] text-white">{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 세부섹터 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">세부섹터</label>
                                <input 
                                    type="text" 
                                    value={formSubsector}
                                    onChange={(e) => setFormSubsector(e.target.value)}
                                    placeholder="예: 현금기부채납, 브랜드"
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1"
                                    required
                                />
                            </div>

                            {/* 대표 업무 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">대표 업무</label>
                                <input 
                                    type="text" 
                                    value={formTaskName}
                                    onChange={(e) => setFormTaskName(e.target.value)}
                                    placeholder="업무 내용을 입력하세요"
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1"
                                    required
                                />
                            </div>

                            {/* 필요 마일스톤 단계 */}
                            <div className="flex flex-col gap-2 bg-[#1c1c1e] border border-[#3c3c3c] rounded-[12px] p-3 mt-1">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">필요 단계 설정</label>
                                <div className="flex items-center gap-6 mt-1 text-[13px]">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={formPf}
                                            onChange={(e) => setFormPf(e.target.checked)}
                                            className="rounded border-[#3c3c3c] bg-[#1c1c1e] text-[#2997ff] focus:ring-0 w-4 h-4 cursor-pointer"
                                        />
                                        <span>PF 전 필요</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={formConst}
                                            onChange={(e) => setFormConst(e.target.checked)}
                                            className="rounded border-[#3c3c3c] bg-[#1c1c1e] text-[#2997ff] focus:ring-0 w-4 h-4 cursor-pointer"
                                        />
                                        <span>착공 전 필요</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={formOp}
                                            onChange={(e) => setFormOp(e.target.checked)}
                                            className="rounded border-[#3c3c3c] bg-[#1c1c1e] text-[#2997ff] focus:ring-0 w-4 h-4 cursor-pointer"
                                        />
                                        <span>준공 전 필요</span>
                                    </label>
                                </div>
                            </div>

                            {/* 주관 부서 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">주관 부서</label>
                                <select 
                                    value={formLead} 
                                    onChange={(e) => setFormLead(e.target.value)}
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1"
                                >
                                    {DEPARTMENTS_LIST.map(d => (
                                        <option key={d} value={d} className="bg-[#222] text-white">
                                            {d}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 협업 부서 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase mb-1.5">협업 부서 (복수 선택 가능)</label>
                                <div className="grid grid-cols-2 gap-2 bg-[#1c1c1e] border border-[#3c3c3c] rounded-[12px] p-3 text-[13px]">
                                    {DEPARTMENTS_LIST.map(d => {
                                        const isChecked = formCoop.includes(d);
                                        return (
                                            <label key={d} className="flex items-center gap-2 cursor-pointer select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormCoop([...formCoop, d]);
                                                        } else {
                                                            setFormCoop(formCoop.filter(name => name !== d));
                                                        }
                                                    }}
                                                    className="rounded border-[#3c3c3c] bg-[#1c1c1e] text-[#2997ff] focus:ring-0 w-4 h-4 cursor-pointer"
                                                />
                                                <span>{d}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 외부 상대방 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">외부 상대방</label>
                                <select 
                                    value={formPartner} 
                                    onChange={(e) => setFormPartner(e.target.value)}
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1"
                                >
                                    <option value="" className="bg-[#222] text-[#86868B]">선택 안함 (-)</option>
                                    {PARTNERS_LIST.map(p => (
                                        <option key={p} value={p} className="bg-[#222] text-white">
                                            {p}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 필요산출물 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">필요산출물</label>
                                <input 
                                    type="text" 
                                    value={formNeed}
                                    onChange={(e) => setFormNeed(e.target.value)}
                                    placeholder="예: 임차조건, 관청 협의결과"
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1"
                                />
                            </div>

                            {/* 관리 포인트 */}
                            <div className="flex flex-col">
                                <label className="text-[11px] font-bold text-[#86868B] uppercase">관리 포인트</label>
                                <textarea 
                                    value={formPoint}
                                    onChange={(e) => setFormPoint(e.target.value)}
                                    placeholder="예: 인허가 마감 및 대주 조건"
                                    className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[13px] text-white focus:outline-none focus:border-[#2997ff] mt-1 resize-none h-16"
                                />
                            </div>

                            {/* 수정 권한 안내 */}
                            <div className="text-[11.5px] text-[#86868B] leading-relaxed bg-[#1c1c1e] p-2.5 rounded-lg border border-[#3c3c3c]/50 mt-1">
                                ℹ️ <strong>편집 권한 조직:</strong> 사업2파트, 기획추진(시스템 관리자 포함), WS_PM2 워크스페이스 권한자, master / director / PO 역할군에 한해 추가 및 수정 기능이 제공됩니다.
                            </div>

                            {/* Form Actions */}
                            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-[#3c3c3c]">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-[13px] font-bold text-[#86868B] hover:text-white transition-colors cursor-pointer"
                                >
                                    취소
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 bg-[#2997ff] text-white hover:bg-[#0071e3] transition-colors rounded-xl text-[13px] font-bold shadow-md cursor-pointer"
                                >
                                    저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* R&R Export JSON Modal */}
            {isExportOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] select-none" onClick={() => setIsExportOpen(false)}>
                    <div className="bg-[#272726] border border-[#3c3c3c] text-white rounded-[24px] shadow-2xl p-[24px] w-[600px] max-w-[95%] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-[#3c3c3c] pb-3">
                            <h3 className="text-[18px] font-bold text-white">R&R 데이터 JSON 내보내기</h3>
                            <button 
                                onClick={() => setIsExportOpen(false)}
                                className="text-[#86868B] hover:text-white transition-colors text-[18px] font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-[13px] text-[#bdbba7] leading-relaxed">
                            아래 JSON 데이터를 복사하여 `PmoScheduleGate.jsx`의 `CATEGORY_MAP_DATA` 배열 변수값에 바로 덮어씌워 소스코드로 커밋하면 영구 보존할 수 있습니다.
                        </p>
                        <textarea
                            readOnly
                            value={JSON.stringify(rrData.map(({ id, ...rest }) => rest), null, 2)}
                            className="w-full bg-[#1c1c1e] border border-[#3c3c3c] rounded-[10px] p-[10px] text-[12px] text-white focus:outline-none h-[280px] font-mono whitespace-pre overflow-y-auto"
                            onClick={(e) => e.target.select()}
                        />
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#3c3c3c]">
                            <button 
                                type="button"
                                onClick={() => setIsExportOpen(false)}
                                className="px-4 py-2 text-[13px] font-bold text-[#86868B] hover:text-white transition-colors cursor-pointer"
                            >
                                닫기
                            </button>
                            <button 
                                type="button"
                                onClick={handleCopyToClipboard}
                                className="px-4 py-2 bg-[#2c2c2b] border border-[#3c3c3c] text-[#bdbba7] hover:text-white transition-colors rounded-xl text-[13px] font-bold cursor-pointer"
                            >
                                클립보드 복사
                            </button>
                            <button 
                                type="button"
                                onClick={handleExportJson}
                                className="px-4 py-2 bg-[#2997ff] text-white hover:bg-[#0071e3] transition-colors rounded-xl text-[13px] font-bold shadow-md cursor-pointer"
                            >
                                JSON 파일 다운로드
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
