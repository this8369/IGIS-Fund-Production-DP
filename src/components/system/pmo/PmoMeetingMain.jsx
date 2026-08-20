import React from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { comparePmoTasksByPriority, matchesPmoStatusFilter } from '../../../utils/pmoTaskPriority';
import { FALLBACK_BOARD_TASKS } from './PmoTaskBoardStaging';

export default function PmoMeetingMain() {
    const [counts, setCounts] = React.useState({
        total: 0,
        delayed: 0,
        blockers: 0,
        decisions: 0,
        meetings: 0,
        inProgress: 0,
        pfRequired: 0,
        constRequired: 0,
        notStarted: 0,
        completed: 0,
        onHold: 0,
        stopped: 0,
        popupCount: 0,
        supportNeeded: 0
    });
        const [loading, setLoading] = React.useState(true);
    const [tasks, setTasks] = React.useState([]);
    const [selectedFilter, setSelectedFilter] = React.useState('전체업무');
    const [dbError, setDbError] = React.useState(null);
    const [activeMetric, setActiveMetric] = React.useState('총관여');
    const [hoveredDept, setHoveredDept] = React.useState(null);
    const [tooltipData, setTooltipData] = React.useState(null);
 
    const calculateAndSetCounts = (taskList) => {
        const parseBool = (v) => v === true || String(v).toLowerCase() === 'true' || String(v).toUpperCase() === 'Y';
 
        const pmoTasks = taskList.filter(t => t.task_type !== '팝업');
        const popupTasks = taskList.filter(t => t.task_type === '팝업');
        const activePmoTasks = pmoTasks.filter(t => matchesPmoStatusFilter(t, '전체보기'));

        const total = activePmoTasks.length;
        const delayed = pmoTasks.filter(t => t.status === '지연').length;
        const blockers = activePmoTasks.filter(t => parseBool(t.is_blocker)).length;
        const decisions = activePmoTasks.filter(t => parseBool(t.needs_decision)).length;
        const meetings = activePmoTasks.filter(t => t.meeting_grade === 'A' || t.meeting_grade === 'A_즉시상정').length;
        const inProgress = pmoTasks.filter(t => t.status === '진행중').length;
        const pfRequired = activePmoTasks.filter(t => t.importance_level === 'PF필수').length;
        const constRequired = activePmoTasks.filter(t => t.importance_level === '준공필수').length;
        const notStarted = pmoTasks.filter(t => t.status === '미착수').length;
        const completed = pmoTasks.filter(t => t.status === '완료').length;
        const onHold = pmoTasks.filter(t => t.status === '보류').length;
        const stopped = pmoTasks.filter(t => t.status === '중단').length;
        const supportNeeded = activePmoTasks.filter(t => {
            const fallbackItem = FALLBACK_BOARD_TASKS.find(fb => fb.task_name === t.task_name) || {};
            const val = t.support_needed || fallbackItem.support_needed || '';
            const s = val.trim().toLowerCase();
            const invalidKeywords = ['', '없음', 'n/a', 'na', '해당사항 없음', '해당사항없음', '-', 'none'];
            return s && !invalidKeywords.includes(s);
        }).length;
 
        const popupCount = popupTasks.filter(t => t.status === '진행중').length;
 
        setCounts({
            total,
            delayed,
            blockers,
            decisions,
            meetings,
            inProgress,
            pfRequired,
            constRequired,
            notStarted,
            completed,
            onHold,
            stopped,
            popupCount,
            supportNeeded
        });
    };
 
    React.useEffect(() => {
        async function fetchDashboardData() {
            try {
                setDbError(null);
                // Fetch stats and tasks from staging iota_v2 schema with correct fields and join relationships
                const { data: allTasks, error } = await supabase
                    .schema('iota_v2')
                    .from('iota_pmo_tasks')
                    .select('id, project_code, task_name, sector_detail, lead_dept_code, lead_dept:iota_departments!lead_dept_code(dept_name), coop_dept_codes, assignee, is_blocker, needs_decision, priority_score, due_date, status, category_main, importance_level, meeting_grade, task_type, support_needed, created_at');
 
                if (error) throw error;
 
                const finalTasks = allTasks || [];
                setTasks(finalTasks);
                calculateAndSetCounts(finalTasks);
            } catch (err) {
                console.error("Failed to load dashboard data from database:", err);
                setDbError(err.message || String(err));
                setTasks([]);
                calculateAndSetCounts([]);
            } finally {
                setLoading(false);
            }
        }
        fetchDashboardData();
    }, []);

    const handleFilterClick = (btn) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        const targetPath = btn.path.startsWith('/') ? btn.path : '/' + btn.path;
        window.history.pushState(null, '', base + targetPath);
        window.dispatchEvent(new Event('popstate'));
    };

    const upperFilters = [
        { label: '전체업무', path: 'platform/iotaseoul/workflow', count: counts.total, highlightClass: 'text-[#1F1F1E]', hoverClass: 'group-hover:text-[#000000]' },
        { label: '즉시 상정안건', path: 'platform/iotaseoul/workflow?filterMeetingGrade=A_즉시상정', count: counts.meetings, highlightClass: 'text-[#E35D5D]', hoverClass: 'group-hover:text-[#FF3B30]' },
        { label: '지연 리스크', path: 'platform/iotaseoul/workflow?filterStatus=지연', count: counts.delayed, highlightClass: 'text-[#E35D5D]', hoverClass: 'group-hover:text-[#FF3B30]' },
        { label: '정상 진행중', path: 'platform/iotaseoul/workflow?filterStatus=진행중', count: counts.inProgress, highlightClass: 'text-[#1F1F1E]', hoverClass: 'group-hover:text-[#000000]' },
        { label: '미착수 과제', path: 'platform/iotaseoul/workflow?filterStatus=미착수', count: counts.notStarted, highlightClass: 'text-[#8E8E93]', hoverClass: 'group-hover:text-[#A1A1AA]' },
        { label: '단발/팝업', path: 'platform/iotaseoul/popup-requests', count: counts.popupCount, highlightClass: 'text-[#E67E22]', hoverClass: 'group-hover:text-[#FF9500]' }
    ];

    const getFilteredTasks = () => {
        const parseBool = (v) => v === true || String(v).toLowerCase() === 'true' || String(v).toUpperCase() === 'Y';
        
        // Filter out popup tasks from standard listings except when selecting '단발/팝업'
        const pmoTasks = tasks.filter(t => t.task_type !== '팝업');
        const popupTasks = tasks.filter(t => t.task_type === '팝업');
        const activePmoTasks = pmoTasks.filter(t => matchesPmoStatusFilter(t, '전체보기'));
        let filteredTasks;
        
        switch (selectedFilter) {
            case '즉시 상정안건':
            case '즉시 회의 필요':
                filteredTasks = activePmoTasks.filter(t => t.meeting_grade === 'A' || t.meeting_grade === 'A_즉시상정');
                break;
            case '지연 리스크':
            case '지연':
                filteredTasks = pmoTasks.filter(t => t.status === '지연');
                break;
            case '정상 진행중':
            case '진행중':
                filteredTasks = pmoTasks.filter(t => t.status === '진행중');
                break;
            case '미착수 과제':
            case '미착수':
                filteredTasks = pmoTasks.filter(t => t.status === '미착수');
                break;
            case '단발/팝업':
            case '단발업무':
                return popupTasks.filter(t => t.status === '진행중');
            case 'Blocker(병목)':
                filteredTasks = activePmoTasks.filter(t => parseBool(t.is_blocker));
                break;
            case '의사결정 필요':
                filteredTasks = activePmoTasks.filter(t => parseBool(t.needs_decision));
                break;
            case '지원필요':
                filteredTasks = activePmoTasks.filter(t => {
                    const fallbackItem = FALLBACK_BOARD_TASKS.find(fb => fb.task_name === t.task_name) || {};
                    const val = t.support_needed || fallbackItem.support_needed || '';
                    const s = val.trim().toLowerCase();
                    const invalidKeywords = ['', '없음', 'n/a', 'na', '해당사항 없음', '해당사항없음', '-', 'none'];
                    return s && !invalidKeywords.includes(s);
                });
                break;
            case 'PF필수':
                filteredTasks = activePmoTasks.filter(t => t.importance_level === 'PF필수');
                break;
            case '준공필수':
                filteredTasks = activePmoTasks.filter(t => t.importance_level === '준공필수');
                break;
            case '완료':
                filteredTasks = pmoTasks.filter(t => t.status === '완료');
                break;
            case '보류':
                filteredTasks = pmoTasks.filter(t => t.status === '보류');
                break;
            case '중단':
                filteredTasks = pmoTasks.filter(t => t.status === '중단');
                break;
            case '전체업무':
            default:
                filteredTasks = activePmoTasks;
        }
        const getDueDateTimestamp = (t) => {
            if (!t.due_date) return 9999999999999;
            const time = new Date(t.due_date).getTime();
            return Number.isNaN(time) ? 9999999999999 : time;
        };

        const getImportanceRank = (t) => {
            const imp = t.importance_level || '';
            if (imp === '준공필수') return 1;
            if (imp === 'PF필수') return 2;
            return 3;
        };

        return [...filteredTasks].sort((a, b) => {
            switch (selectedFilter) {
                case '즉시 상정안건':
                case '즉시 회의 필요': {
                    // 1순위: 의사결정 필요(needs_decision) 여부
                    const decisionDiff = Number(parseBool(b.needs_decision)) - Number(parseBool(a.needs_decision));
                    if (decisionDiff !== 0) return decisionDiff;
                    // 2순위: 병목(is_blocker) 여부
                    const blockerDiff = Number(parseBool(b.is_blocker)) - Number(parseBool(a.is_blocker));
                    if (blockerDiff !== 0) return blockerDiff;
                    // 3순위: 우선순위 점수
                    return comparePmoTasksByPriority(a, b, 'desc');
                }
                case '지연 리스크':
                case '지연': {
                    // 1순위: 마감일 오름차순 (오래 지연된 과제일수록 최상단 노출)
                    const dateDiff = getDueDateTimestamp(a) - getDueDateTimestamp(b);
                    if (dateDiff !== 0) return dateDiff;
                    // 2순위: 병목(is_blocker) 여부
                    const blockerDiff = Number(parseBool(b.is_blocker)) - Number(parseBool(a.is_blocker));
                    if (blockerDiff !== 0) return blockerDiff;
                    // 3순위: 우선순위 점수
                    return comparePmoTasksByPriority(a, b, 'desc');
                }
                case '정상 진행중':
                case '진행중': {
                    // 1순위: 마감일 임박순 (due_date 오름차순)
                    const dateDiff = getDueDateTimestamp(a) - getDueDateTimestamp(b);
                    if (dateDiff !== 0) return dateDiff;
                    // 2순위: 우선순위 점수
                    return comparePmoTasksByPriority(a, b, 'desc');
                }
                case '미착수 과제':
                case '미착수': {
                    // 1순위: 중요도 (준공필수 > PF필수 > 일반)
                    const impDiff = getImportanceRank(a) - getImportanceRank(b);
                    if (impDiff !== 0) return impDiff;
                    // 2순위: 마감일 임박순
                    const dateDiff = getDueDateTimestamp(a) - getDueDateTimestamp(b);
                    if (dateDiff !== 0) return dateDiff;
                    // 3순위: 우선순위 점수
                    return comparePmoTasksByPriority(a, b, 'desc');
                }
                case '전체업무':
                default:
                    return comparePmoTasksByPriority(a, b, 'desc');
            }
        });
    };

    const getFilterPath = () => {
        const matched = upperFilters.find(f => f.label === selectedFilter);
        return matched ? matched.path : 'platform/iotaseoul/workflow';
    };

    const handleGoToFullPage = () => {
        const filterPath = getFilterPath();
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        const targetPath = filterPath.startsWith('/') ? filterPath : '/' + filterPath;
        window.history.pushState(null, '', base + targetPath);
        window.dispatchEvent(new Event('popstate'));
    };

    const handleTaskClick = (task) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        const pagePath = task.task_type === '팝업' ? 'platform/iotaseoul/popup-requests' : 'platform/iotaseoul/workflow';
        window.history.pushState(null, '', `${base}/${pagePath}?taskId=${task.id}`);
        window.dispatchEvent(new Event('popstate'));
    };

    const handleRowClick = (row) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.history.pushState(null, '', `${base}/platform/iotaseoul/workflow?filterLeadDept=${encodeURIComponent(row.dept)}`);
        window.dispatchEvent(new Event('popstate'));
    };

    const getProjectBadgeStyle = (codeOrProj) => {
        const c = String(codeOrProj || '').toUpperCase();
        if (c.includes('816')) return 'bg-[#c7c7cc]/10 text-[#d1d1d6] border border-[#c7c7cc]/25';
        if (c.includes('421')) return 'bg-[#737373]/15 text-[#a1a1aa] border border-[#737373]/25';
        if (c.includes('427')) return 'bg-[#30b0c7]/15 text-[#5ac8fa] border border-[#30b0c7]/25';
        return 'bg-[#bf5af2]/10 text-[#da9ff9] border border-[#bf5af2]/25'; // Purple for others/common
    };

    const getMeetingGradeBadge = (grade) => {
        if (!grade || grade === '-') return <span className="text-[12px] text-[#555] font-semibold">-</span>;
        const g = String(grade).toUpperCase();
        if (g.includes('A')) {
            return <span className="px-[6px] py-[1.5px] rounded-[4px] text-[10px] font-bold bg-[#ff375f]/15 text-[#ff375f] border border-[#ff375f]/25">A_즉시상정</span>;
        }
        if (g.includes('B')) {
            return <span className="px-[6px] py-[1.5px] rounded-[4px] text-[10px] font-bold bg-[#8e8e93]/15 text-[#a1a1aa] border border-[#8e8e93]/25">B_회의점검</span>;
        }
        if (g.includes('C')) {
            return <span className="px-[6px] py-[1.5px] rounded-[4px] text-[10px] font-bold bg-[#8e8e93]/15 text-[#a1a1aa] border border-[#8e8e93]/25">C_주간관리</span>;
        }
        if (g.includes('D')) {
            return <span className="px-[6px] py-[1.5px] rounded-[4px] text-[10px] font-bold bg-[#8e8e93]/15 text-[#a1a1aa] border border-[#8e8e93]/25">D_대기</span>;
        }
        return <span className="px-[6px] py-[1.5px] rounded-[4px] text-[10px] font-bold bg-[#8e8e93]/15 text-[#a1a1aa] border border-[#8e8e93]/25">{grade}</span>;
    };

    const normalizeProjectName = (code) => {
        const c = String(code || '').toUpperCase();
        if (c.includes('PFV_427') || c.includes('427')) return '427 PFV';
        if (c.includes('PFV_816') || c.includes('816')) return '816 PFV';
        if (c.includes('FUND_421') || c.includes('421')) return '421 Fund';
        return '공통';
    };

    const resolveDeptName = (code) => {
        const c = String(code || '').toUpperCase();
        if (c === 'DEPT_LFC' || c.includes('LFC')) return 'LFC';
        if (c === 'DEPT_DEV' || c.includes('DEV') || c.includes('DSC')) return '개발솔루션';
        if (c === 'DEPT_DESIGN' || c.includes('DESIGN') || c.includes('SSC')) return '공간솔루션';
        if (c === 'DEPT_MKT' || c.includes('MKT') || c.includes('EMC')) return '기업마케팅';
        if (c === 'DEPT_PM2' || c.includes('PM2')) return '사업2파트';
        if (c === 'DEPT_PM1' || c.includes('PM1')) return '사업1파트';
        return code || '미정';
    };

    const getTaskDeptName = (t) => {
        const raw = t.lead_dept?.dept_name || t.lead_dept || resolveDeptName(t.lead_dept_code) || '';
        const c = String(raw).toUpperCase().trim();
        if (c.includes('PM2') || c.includes('사업관리2파트') || c.includes('사업2파트')) return '사업2파트';
        if (c.includes('PM1') || c.includes('사업관리1파트') || c.includes('사업1파트')) return '사업1파트';
        if (c.includes('DEV') || c.includes('개발관리실') || c.includes('개발솔루션')) return '개발솔루션';
        if (c.includes('DESIGN') || c.includes('공간솔루션실') || c.includes('공간솔루션')) return '공간솔루션';
        if (c.includes('MKT') || c.includes('기업마케팅실') || c.includes('기업마케팅')) return '기업마케팅';
        if (c.includes('LFC') || c.includes('DEPT_LFC')) return 'LFC';
        return '기타';
    };

    const isCoopDept = (t, deptName) => {
        const coopVal = t.coop_dept_codes || t.coop_depts || '';
        if (!coopVal) return false;
        const coopStr = String(coopVal).toUpperCase();
        if (deptName === '사업2파트') {
            return coopStr.includes('PM2') || coopStr.includes('사업관리2파트') || coopStr.includes('사업2파트');
        }
        if (deptName === '사업1파트') {
            return coopStr.includes('PM1') || coopStr.includes('사업관리1파트') || coopStr.includes('사업1파트');
        }
        if (deptName === '개발솔루션') {
            return coopStr.includes('DEV') || coopStr.includes('개발관리실') || coopStr.includes('개발솔루션');
        }
        if (deptName === '공간솔루션') {
            return coopStr.includes('DESIGN') || coopStr.includes('공간솔루션실') || coopStr.includes('공간솔루션');
        }
        if (deptName === '기업마케팅') {
            return coopStr.includes('MKT') || coopStr.includes('기업마케팅실') || coopStr.includes('기업마케팅');
        }
        if (deptName === 'LFC') {
            return coopStr.includes('LFC');
        }
        return false;
    };

    const isSupportNeededTask = (t) => {
        const fallbackItem = FALLBACK_BOARD_TASKS.find(fb => fb.task_name === t.task_name) || {};
        const val = t.support_needed || fallbackItem.support_needed || '';
        const s = val.trim().toLowerCase();
        const invalidKeywords = ['', '없음', 'n/a', 'na', '해당사항 없음', '해당사항없음', '-', 'none'];
        return s && !invalidKeywords.includes(s);
    };

    const isWithin7DaysOrDelayed = (t) => {
        if (t.status === '지연') return true;
        if (!t.due_date) return false;
        try {
            const today = new Date('2026-07-20');
            const dueDate = new Date(t.due_date);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const activeStatus = t.status !== '완료' && t.status !== '중단';
            return activeStatus && (diffDays <= 7);
        } catch (e) {
            return false;
        }
    };

    const departmentsList = ['사업2파트', '사업1파트', '개발솔루션', '공간솔루션', '기업마케팅', 'LFC'];

    const parseBool = (v) => v === true || String(v).toLowerCase() === 'true' || String(v).toUpperCase() === 'Y';

    const deptRowsData = departmentsList.map(dept => {
        const leadTasks = tasks.filter(t => t.task_type !== '팝업' && getTaskDeptName(t) === dept);
        const coopTasks = tasks.filter(t => t.task_type !== '팝업' && isCoopDept(t, dept));
        
        const leadCount = leadTasks.length;
        const coopCount = coopTasks.length;
        const totalCount = leadCount + coopCount;
        
        const pfCount = leadTasks.filter(t => t.importance_level === 'PF필수').length;
        const constCount = leadTasks.filter(t => t.importance_level === '준공필수').length;
        const blockerCount = leadTasks.filter(t => parseBool(t.is_blocker)).length;
        const decisionCount = leadTasks.filter(t => parseBool(t.needs_decision)).length;
        const supportCount = leadTasks.filter(t => isSupportNeededTask(t)).length;
        const delayedOr7DaysCount = leadTasks.filter(t => isWithin7DaysOrDelayed(t)).length;

        return {
            dept,
            leadCount,
            coopCount,
            totalCount,
            pfCount,
            constCount,
            blockerCount,
            decisionCount,
            supportCount,
            delayedOr7DaysCount
        };
    });

    const maxActiveCount = Math.max(...deptRowsData.map(d => {
        if (activeMetric === '실행주관 업무') return d.leadCount;
        if (activeMetric === '협업업무') return d.coopCount;
        return d.totalCount;
    }), 1);

    // ==========================================
    // 카테고리별 진행현황 추가 데이터 모델
    // ==========================================
    const categoriesList = ['공통 PMO', '호텔/운영', '인허가', '시공/원가', '도면/설계', '인테리어/TI', '임차/마케팅', 'PF/금융', '구조/법무/세무', '주주/보고', '준공/담보대출'];

    const categoryRowsData = categoriesList.map(cat => {
        const catTasks = tasks.filter(t => t.task_type !== '팝업' && (t.category_main === cat || (cat === '공통 PMO' && !t.category_main)));
        
        const totalCount = catTasks.length;
        const pfCount = catTasks.filter(t => t.importance_level === 'PF필수').length;
        const constCount = catTasks.filter(t => t.importance_level === '준공필수').length;
        const blockerCount = catTasks.filter(t => parseBool(t.is_blocker)).length;
        const decisionCount = catTasks.filter(t => parseBool(t.needs_decision)).length;
        const supportCount = catTasks.filter(t => isSupportNeededTask(t)).length;
        const delayedCount = catTasks.filter(t => t.status === '지연').length;
        const inProgressCount = catTasks.filter(t => t.status === '진행중').length;
        
        // Find main departments involved
        const depts = Array.from(new Set(catTasks.map(t => getTaskDeptName(t)).filter(Boolean)));
        const shortDepts = depts.map(d => {
            if (d === '사업2파트') return '사업2';
            if (d === '사업1파트') return '사업1';
            if (d === '개발솔루션') return '개발';
            if (d === '공간솔루션') return '공간';
            if (d === '기업마케팅') return '마케팅';
            return d;
        }).slice(0, 3).join(', ') || '-';

        return {
            category: cat,
            totalCount,
            pfCount,
            constCount,
            blockerCount,
            decisionCount,
            supportCount,
            delayedCount,
            inProgressCount,
            shortDepts
        };
    });

    const maxTotalCountCat = Math.max(...categoryRowsData.map(c => c.totalCount), 1);
    const maxPfCountCat = Math.max(...categoryRowsData.map(c => c.pfCount), 1);
    const maxConstCountCat = Math.max(...categoryRowsData.map(c => c.constCount), 1);
    const maxDelayedCountCat = Math.max(...categoryRowsData.map(c => c.delayedCount), 1);

    const handleCategoryRowClick = (row) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.history.pushState(null, '', `${base}/platform/iotaseoul/workflow?filterCategoryMain=${encodeURIComponent(row.category)}`);
        window.dispatchEvent(new Event('popstate'));
    };

    return (
        <div className="w-[1290px] mx-auto flex-1 flex flex-col pt-[28px] pb-[60px] select-text">
            {/* Header */}
            <div className="w-full flex justify-between items-start mb-[12px]">
                <div>
                    <h1 className="text-[32px] font-bold text-white tracking-tight leading-none">IOTA Seoul Main Board</h1>
                </div>
            </div>

            {/* DB Error Banner */}
            {dbError && (
                <div className="w-full bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-[16px] p-4 mb-4 flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ff3b30] animate-pulse" />
                        <div>
                            <p className="text-[13px] font-bold text-white">데이터베이스 연결 및 연동 오류</p>
                            <p className="text-[11.5px] text-[#8e8e93] mt-0.5">{dbError}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Single Row 6-Column KPI Filter Buttons */}
            <div className="w-[calc(100%+14px)] ml-[-7px] border border-[#4b4b4b]/70 rounded-[30px] p-[6px] mb-[16px] select-none text-center bg-[#1c1c1e]/40">
                <div className="grid grid-cols-6 gap-[6px]">
                    {upperFilters.map((btn, idx) => {
                        const isActive = selectedFilter === btn.label;
                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedFilter(btn.label)}
                                className={`w-full bg-[#b4b6b5] h-[94px] rounded-[24px] flex items-center justify-center cursor-pointer group transition-all duration-200 ${isActive ? 'relative z-20' : 'hover:relative hover:z-20'}`}
                            >
                                <div className={`w-full h-full rounded-[24px] transition-all duration-200 flex flex-col items-center justify-center relative ${isActive ? 'bg-[#d4d7d5] ring-[5px] ring-[#2997ff] ring-inset' : 'bg-transparent group-hover:bg-[#d4d7d5] group-hover:ring-[5px] group-hover:ring-[#2997ff] group-hover:ring-inset'}`}>
                                    <span className="text-[13px] font-bold text-[#3C3C3C] group-hover:text-[#000000] transition-colors duration-200 mb-0.5 flex items-center gap-[4px]">
                                        {btn.label}
                                    </span>
                                    <span className={`text-[32px] font-black leading-none transition-colors duration-200 ${btn.highlightClass} ${btn.hoverClass}`}>
                                        {btn.count}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <div className="w-full h-[150px] flex items-center justify-center">
                    <span className="text-[#86868B] text-[13px] animate-pulse">데이터를 집계하고 있습니다...</span>
                </div>
            ) : (
                <>
                    {/* Bottom Box for Brief Listing - Card based view */}
                    <div className="w-[calc(100%+14px)] ml-[-7px] border border-[#3c3c3c] rounded-[24px] p-[6px] mb-[30px] flex flex-col">
                        {/* Header Row */}
                        <div className="flex justify-between items-center pl-[20px] pr-[6px] pt-[6px] pb-[8px]">
                            <div className="flex items-center gap-[10px]">
                                <h2 className="text-[16px] font-bold text-white tracking-tight flex items-center gap-[8px]">
                                    <span>{selectedFilter} 현황 목록</span>
                                </h2>
                            </div>
                            <button
                                onClick={handleGoToFullPage}
                                className="flex items-center gap-[6px] text-[12px] text-[#E5E5E5] hover:text-white font-bold transition-all px-[12px] py-[6px] bg-white/5 hover:bg-white/10 rounded-[8px] border border-white/10 hover:border-white/20 cursor-pointer -translate-y-[2px]"
                            >
                                <span>{selectedFilter === '단발업무' ? '단발업무 요건판 전체 보기' : '통합업무보드에서 전체 보기'}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </button>
                        </div>
 
                        {/* Card-based grid row container */}
                        <div className="h-[340px] min-h-[200px] max-h-[800px] resize-y overflow-y-auto px-0 hide-scrollbar">
                            {getFilteredTasks().length === 0 ? (
                                <div className="py-[60px] text-center text-[#86868B] text-[14px]">
                                    조건에 일치하는 업무 항목이 없습니다.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-[6px] px-0">
                                    {getFilteredTasks().map((task, index) => {
                                        const hasDecision = task.needs_decision === true || String(task.needs_decision).toLowerCase() === 'true' || String(task.needs_decision).toUpperCase() === 'Y';
                                        const hasBlocker = task.is_blocker === true || String(task.is_blocker).toLowerCase() === 'true' || String(task.is_blocker).toUpperCase() === 'Y';
                                        const projName = normalizeProjectName(task.project_code || task.project);
                                        const deptName = task.lead_dept?.dept_name || task.lead_dept || resolveDeptName(task.lead_dept_code) || '미정';
                                        const fallbackItem = FALLBACK_BOARD_TASKS.find(fb => fb.task_name === task.task_name) || {};
                                        const priorityScore = Number(task.priority_score) || 0;
                                        const priorityScoreClass = priorityScore >= 60
                                            ? 'text-[#FF453A]'
                                            : priorityScore >= 40
                                                ? 'text-[#bdbba7]'
                                                : 'text-[#86868B]';
 
                                        return (
                                            <div 
                                                key={task.id} 
                                                onClick={() => handleTaskClick(task)}
                                                className="bg-[#252525] hover:bg-[#2c2c2e] border border-white/[0.06] hover:border-[#2997ff] hover:ring-[2px] hover:ring-[#2997ff] hover:ring-inset hover:shadow-[0_4px_20px_rgba(41,151,255,0.06)] transition-all rounded-[14px] px-[20px] py-[12px] cursor-pointer flex flex-row items-center justify-between group gap-[20px]"
                                            >
                                                {/* Task Name */}
                                                <div className="flex-[0_0_30%] min-w-[200px] flex items-center gap-[12px]">
                                                    <span className="text-[13.5px] font-bold text-white shrink-0 min-w-[16px] text-right font-['Inter'] -ml-[4px]">
                                                        {index + 1}
                                                    </span>
                                                    <h3 className="text-[16px] font-bold text-[#cccaba] leading-snug group-hover:text-white transition-colors truncate" title={task.task_name}>
                                                        {task.task_name}
                                                    </h3>
                                                </div>

                                                {/* Snippet (Preview) */}
                                                <div className="flex-1 min-w-0 px-[10px] ml-[5px]">
                                                    <p className="text-[13.5px] text-white/40 truncate font-light group-hover:text-white/60 transition-colors" title={fallbackItem.task_purpose || fallbackItem.deliverables || ''}>
                                                        {fallbackItem.task_purpose || fallbackItem.deliverables || '상세 내용 없음'}
                                                    </p>
                                                </div>
 
                                                {/* Metadata & Badges Container */}
                                                <div className="flex items-center gap-[20px] shrink-0">
                                                    <span className={`text-[13px] font-bold tabular-nums whitespace-nowrap ${priorityScoreClass}`}>
                                                        우선 {priorityScore}
                                                    </span>
                                                    <div className="flex items-center gap-[10px] text-[13px] text-white/50">
                                                        <div className="flex items-center gap-[4px]">
                                                            <span className="text-white/40 font-normal">실행주관</span>
                                                            <span className="text-white/80 font-normal">{deptName}</span>
                                                        </div>
                                                        <span className="text-white/20">|</span>
                                                        <div className="flex items-center gap-[4px]">
                                                            <span className="text-white/40 font-normal">섹터</span>
                                                            <span className="text-white/80 font-normal">{task.sector_detail || fallbackItem.sector_detail || '공통'}</span>
                                                        </div>
                                                    </div>
                                                    {/* If it's a blocker or decision needed, show a tiny elegant badge */}
                                                    {(hasBlocker || hasDecision) && (
                                                        <div className="flex gap-[6px] shrink-0 min-w-[50px] justify-end">
                                                            {hasBlocker && (
                                                                <span className="flex items-center text-[10.5px] font-bold bg-[#ff3b30]/10 text-[#ff453a] border border-[#ff3b30]/15 px-2 py-0.5 rounded-[4px]">
                                                                    병목
                                                                </span>
                                                            )}
                                                            {hasDecision && (
                                                                <span className="flex items-center text-[10.5px] font-bold bg-[#ff3b30]/10 text-[#ff453a] border border-[#ff3b30]/15 px-2 py-0.5 rounded-[4px]">
                                                                    의사결정필요
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 부서별 실행 현황 섹션 */}
                    <div className="w-full flex flex-col gap-[8px] mb-[30px] mt-[12px] select-text">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-[16px]">
                                <h3 className="text-[20px] font-bold text-white tracking-tight mt-[4px]">부서별 실행 현황</h3>
                                <p className="text-[14px] text-[#A1A1AA] font-medium translate-y-[2px]">실행주관 및 협업 부서의 업무 현황을 확인합니다.</p>
                            </div>
                        </div>
 
                        {/* Grid 3:7 Layout for Chart and Table */}
                        <div className="grid grid-cols-10 gap-4 mt-[2px]">
                            {/* Left Area: Donut Chart (30% equivalent / col-span-3) */}
                            <div className="col-span-3 bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-4 flex flex-col items-center justify-start h-full">
                                {/* Segmented Toggles */}
                                <div className="flex bg-[#2c2c2b] p-0.5 rounded-[8px] border border-[#3c3c3c] text-[13px] font-semibold mb-4 w-full">
                                    {['총관여', '실행주관 업무', '협업업무'].map(m => {
                                        const isActive = activeMetric === m;
                                        return (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setActiveMetric(m)}
                                                className={`flex-1 py-1 px-1 text-center rounded-[6px] text-[12px] whitespace-nowrap transition-all cursor-pointer font-bold ${isActive ? 'bg-[#48484a] text-white shadow-sm' : 'text-[#86868b] hover:text-white'}`}
                                            >
                                                {m}
                                            </button>
                                        );
                                    })}
                                </div>
 
                                {/* Donut SVG Chart */}
                                {(() => {
                                    const deptColors = {
                                        '사업2파트': '#aeaeb2',
                                        '사업1파트': '#f5f5f7',
                                        '개발솔루션': '#636366',
                                        '공간솔루션': '#e5e5ea',
                                        '기업마케팅': '#8e8e93',
                                        'LFC': '#d1d1d6'
                                    };
 
                                    const metricValues = deptRowsData.map(row => {
                                        const val = activeMetric === '총관여' ? row.totalCount : (activeMetric === '실행주관 업무' ? row.leadCount : row.coopCount);
                                        return { dept: row.dept, val };
                                    });
 
                                    const sum = metricValues.reduce((acc, curr) => acc + curr.val, 0);
 
                                    // SVG Circle properties - radius 35 and scaled stroke (default 14, hover 18) for outer label margin
                                    const radius = 35;
                                    const circumference = 2 * Math.PI * radius; // ~219.9
                                    let accumulatedLength = 0;
                                    let accumulatedPercent = 0;
 
                                    return (
                                        <div className="w-full flex flex-col items-center justify-center flex-1 py-1">
                                            {/* Donut graphic - container 270px (10% larger than 245px) and translated up by 10px */}
                                            <div className="relative w-[270px] h-[270px] flex items-center justify-center -translate-y-[10px]">
                                                <svg className="w-full h-full" viewBox="0 0 120 120">
                                                    {/* Background base circle */}
                                                    <circle 
                                                        cx="60" 
                                                        cy="60" 
                                                        r={radius} 
                                                        fill="none" 
                                                        stroke="rgba(255,255,255,0.03)" 
                                                        strokeWidth="14" 
                                                    />
                                                    
                                                    {sum === 0 ? (
                                                        <circle 
                                                            cx="60" 
                                                            cy="60" 
                                                            r={radius} 
                                                            fill="none" 
                                                            stroke="rgba(255,255,255,0.1)" 
                                                            strokeWidth="14" 
                                                        />
                                                    ) : (
                                                        metricValues.map((item, idx) => {
                                                            const color = deptColors[item.dept] || '#86868b';
                                                            const pct = item.val / sum;
                                                            const strokeLength = pct * circumference;
                                                            const offset = -accumulatedLength;
                                                            accumulatedLength += strokeLength;
 
                                                            if (item.val === 0) return null;
 
                                                            return (
                                                                <circle 
                                                                    key={idx}
                                                                    cx="60" 
                                                                    cy="60" 
                                                                    r={radius} 
                                                                    fill="none" 
                                                                    stroke={color} 
                                                                    strokeWidth={hoveredDept === item.dept ? "18" : "14"} 
                                                                    strokeDasharray={`${strokeLength} ${circumference}`}
                                                                    strokeDashoffset={offset}
                                                                    transform="rotate(-90 60 60)"
                                                                    onMouseEnter={() => setHoveredDept(item.dept)}
                                                                    onMouseLeave={() => setHoveredDept(null)}
                                                                    className="transition-all duration-300 ease-out cursor-pointer"
                                                                />
                                                            );
                                                        })
                                                    )}
 
                                                    {/* Text Labels written OUTSIDE the donut slices in white, no drop-shadow */}
                                                    {sum > 0 && metricValues.map((item, idx) => {
                                                        if (item.val === 0) return null;
                                                        const pct = item.val / sum;
                                                        const startPercent = accumulatedPercent;
                                                        const endPercent = accumulatedPercent + pct;
                                                        accumulatedPercent = endPercent;
 
                                                        const midPercent = (startPercent + endPercent) / 2;
                                                        const midAngleDeg = (midPercent * 360) - 90;
                                                        const midAngleRad = (midAngleDeg * Math.PI) / 180;
 
                                                        // Position text outside the donut ring (radius 45)
                                                        const textRadius = 45;
                                                        const x = 60 + textRadius * Math.cos(midAngleRad);
                                                        const y = 60 + textRadius * Math.sin(midAngleRad);
 
                                                        // Align anchor dynamically to avoid overlapping the donut
                                                        const textAnchor = Math.cos(midAngleRad) > 0.15 ? 'start' : (Math.cos(midAngleRad) < -0.15 ? 'end' : 'middle');
 
                                                        const shortName = item.dept === '사업2파트' ? '사업2' :
                                                                          item.dept === '사업1파트' ? '사업1' :
                                                                          item.dept === '개발솔루션' ? '개발' :
                                                                          item.dept === '공간솔루션' ? '공간' :
                                                                          item.dept === '기업마케팅' ? '마케팅' : item.dept;
 
                                                        return (
                                                            <text
                                                                key={`label-${idx}`}
                                                                x={x}
                                                                y={y + 0.5}
                                                                fill="#ffffff"
                                                                fontSize="7px"
                                                                fontWeight="bold"
                                                                textAnchor={textAnchor}
                                                                dominantBaseline="middle"
                                                                className="pointer-events-none select-none"
                                                            >
                                                                {shortName}
                                                            </text>
                                                        );
                                                    })}
                                                </svg>
                                                {/* Text center label - scaled for 270px donut, displaying percentage on hover */}
                                                <div className="absolute flex flex-col items-center justify-center text-center px-1 pointer-events-none w-[150px] overflow-hidden">
                                                    {hoveredDept ? (
                                                        <>
                                                            <span className="text-[13px] font-bold text-[#86868b] leading-none mb-1.5 truncate w-full">{hoveredDept}</span>
                                                            <span className="text-[24px] font-black leading-none" style={{ color: deptColors[hoveredDept] }}>
                                                                {metricValues.find(mv => mv.dept === hoveredDept)?.val || 0}건
                                                            </span>
                                                            <span className="text-[12px] font-bold text-[#86868b] mt-1.5">
                                                                비중 {sum > 0 ? Math.round((metricValues.find(mv => mv.dept === hoveredDept)?.val || 0) / sum * 100) : 0}%
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-[30px] font-black text-white leading-none">{sum}</span>
                                                            <span className="text-[12px] font-bold text-[#86868b] mt-1.5">총 건수</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
 
                            {/* Right Area: Table Container (70% equivalent / col-span-7) */}
                            <div className="col-span-7 bg-[#272726] border border-[#3c3c3c] rounded-[24px] overflow-hidden flex flex-col justify-start">
                                <table className="w-full text-left border-collapse bg-[#272726]">
                                    <thead>
                                        <tr className="border-b border-[#3c3c3c] bg-transparent text-[#86868B] font-bold text-[13px] h-[46px] whitespace-nowrap">
                                            <th className="py-[16px] px-[16px] w-[130px] font-bold text-[#86868B] text-center whitespace-nowrap">부서</th>
                                            <th className={`py-[16px] px-[16px] text-center font-bold text-[#86868B] transition-all duration-300 whitespace-nowrap ${activeMetric === '총관여' ? 'w-[140px]' : 'w-[80px]'}`}>총관여</th>
                                            <th className={`py-[16px] px-[16px] text-center font-bold text-[#86868B] transition-all duration-300 whitespace-nowrap ${activeMetric === '실행주관 업무' ? 'w-[140px]' : 'w-[80px]'}`}>실행주관 업무</th>
                                            <th className={`py-[16px] px-[16px] text-center font-bold text-[#86868B] transition-all duration-300 whitespace-nowrap ${activeMetric === '협업업무' ? 'w-[140px]' : 'w-[80px]'}`}>협업업무</th>
                                            <th className="py-[16px] px-[16px] text-center font-bold text-[#86868B] whitespace-nowrap">PF필수</th>
                                            <th className="py-[16px] px-[16px] text-center font-bold text-[#86868B] whitespace-nowrap">준공필수</th>
                                            <th className="py-[16px] px-[16px] text-center font-bold text-[#86868B] whitespace-nowrap">Blocker</th>
                                            <th className="py-[16px] px-[16px] text-center font-bold text-[#86868B] whitespace-nowrap">의사결정</th>
                                            <th className="py-[16px] px-[16px] text-center font-bold text-[#86868B] whitespace-nowrap">지원요청</th>
                                            <th className="py-[16px] px-[16px] text-center font-bold text-[#86868B] whitespace-nowrap">7일내/지연</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#3c3c3c]/50 text-[13px]">
                                        {deptRowsData.map((row, idx) => {
                                            const percentage = (row.totalCount / maxActiveCount) * 100;
                                            return (
                                                <tr 
                                                     key={idx} 
                                                     onClick={() => handleRowClick(row)}
                                                     className="hover:bg-[#2b2b2b]/40 transition-colors cursor-pointer"
                                                     onMouseEnter={(e) => setTooltipData({
                                                         text: `${row.dept} 실행주관 업무 페이지 보기`,
                                                         x: e.clientX,
                                                         y: e.clientY
                                                     })}
                                                     onMouseMove={(e) => setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                                                     onMouseLeave={() => setTooltipData(null)}
                                                 >
                                                    {/* 부서 */}
                                                    <td className="py-[16px] px-[16px] text-center font-bold text-[#E5E5E5]">
                                                        {row.dept}
                                                    </td>
                                                    {/* 총관여 with Gradient Bar chart */}
                                                    <td className={`py-[16px] px-[16px] text-center transition-all duration-300 relative ${activeMetric === '총관여' ? 'font-bold text-white w-[140px]' : 'text-[#E5E5E5] font-semibold w-[80px]'}`}>
                                                        {activeMetric === '총관여' && (
                                                            <div className="absolute inset-y-[6px] left-[6px] right-[6px] z-0">
                                                                <div 
                                                                    className="h-full bg-gradient-to-r from-[#86868b]/15 to-[#86868b]/30 rounded-[4px]"
                                                                    style={{ width: `${(row.totalCount / maxActiveCount) * 100}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                        <span className="relative z-10">{row.totalCount}</span>
                                                    </td>
                                                    {/* 실행주관 업무 */}
                                                    <td className={`py-[16px] px-[16px] text-center transition-all duration-300 relative ${activeMetric === '실행주관 업무' ? 'font-bold text-white w-[140px]' : 'text-[#E5E5E5] font-semibold w-[80px]'}`}>
                                                        {activeMetric === '실행주관 업무' && (
                                                            <div className="absolute inset-y-[6px] left-[6px] right-[6px] z-0">
                                                                <div 
                                                                    className="h-full bg-gradient-to-r from-[#86868b]/15 to-[#86868b]/30 rounded-[4px]"
                                                                    style={{ width: `${(row.leadCount / maxActiveCount) * 100}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                        <span className="relative z-10">{row.leadCount}</span>
                                                    </td>
                                                    {/* 협업업무 */}
                                                    <td className={`py-[16px] px-[16px] text-center transition-all duration-300 relative ${activeMetric === '협업업무' ? 'font-bold text-white w-[140px]' : 'text-[#E5E5E5] font-semibold w-[80px]'}`}>
                                                        {activeMetric === '협업업무' && (
                                                            <div className="absolute inset-y-[6px] left-[6px] right-[6px] z-0">
                                                                <div 
                                                                    className="h-full bg-gradient-to-r from-[#86868b]/15 to-[#86868b]/30 rounded-[4px]"
                                                                    style={{ width: `${(row.coopCount / maxActiveCount) * 100}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                        <span className="relative z-10">{row.coopCount}</span>
                                                    </td>
                                                    {/* PF필수 */}
                                                    <td className="py-[16px] px-[16px] text-center text-[#E5E5E5] font-medium">
                                                        {row.pfCount}
                                                    </td>
                                                    {/* 준공필수 */}
                                                    <td className="py-[16px] px-[16px] text-center text-[#E5E5E5] font-medium">
                                                        {row.constCount}
                                                    </td>
                                                    {/* Blocker (No bg background) */}
                                                    <td className={`py-[16px] px-[16px] text-center font-semibold ${row.blockerCount > 0 ? 'text-[#ff453a]' : 'text-[#86868B]'}`}>
                                                        {row.blockerCount}
                                                    </td>
                                                    {/* 의사결정 (No bg background) */}
                                                    <td className={`py-[16px] px-[16px] text-center font-semibold ${row.decisionCount > 0 ? 'text-[#ff453a]' : 'text-[#86868B]'}`}>
                                                        {row.decisionCount}
                                                    </td>
                                                    {/* 지원요청 */}
                                                    <td className="py-[16px] px-[16px] text-center text-[#E5E5E5] font-medium">
                                                        {row.supportCount}
                                                    </td>
                                                    {/* 7일내/지연 */}
                                                    <td className="py-[16px] px-[16px] text-center text-[#E5E5E5] font-medium">
                                                        {row.delayedOr7DaysCount}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* 카테고리별 진행현황 섹션 */}
                    <div className="w-full flex flex-col gap-[8px] mb-[30px] mt-[12px] select-text">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-[16px]">
                                <h3 className="text-[20px] font-bold text-white tracking-tight mt-[4px]">카테고리별 진행현황</h3>
                                <p className="text-[14px] text-[#A1A1AA] font-medium translate-y-[2px]">대분류 카테고리별 업무 현황을 확인합니다.</p>
                            </div>
                        </div>

                        {/* Full Width Table Container */}
                        <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] overflow-hidden flex flex-col justify-start mt-[2px]">
                            <table className="w-full text-left border-collapse bg-[#272726]">
                                <thead>
                                    <tr className="border-b border-[#3c3c3c] bg-transparent text-[#86868B] font-bold text-[13px] h-[38px] whitespace-nowrap">
                                        <th className="py-[9px] px-[16px] w-[140px] font-bold text-[#86868B] text-center whitespace-nowrap">대분류</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[165px] whitespace-nowrap">전체업무</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[165px] whitespace-nowrap">PF필수</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[165px] whitespace-nowrap">준공필수</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[90px] border-l border-[#3c3c3c] whitespace-nowrap">진행중</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[90px] border-l border-[#3c3c3c] whitespace-nowrap">Blocker</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[90px] border-l border-[#3c3c3c] whitespace-nowrap">의사결정필요</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[90px] border-l border-[#3c3c3c] whitespace-nowrap">지원필요</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[90px] border-l border-[#3c3c3c] whitespace-nowrap">지연</th>
                                        <th className="py-[9px] px-[16px] text-center font-bold text-[#86868B] w-[105px] border-l border-[#3c3c3c] whitespace-nowrap">실행주관</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#3c3c3c]/50 text-[13px]">
                                    {categoryRowsData.map((row, idx) => {
                                        return (
                                            <tr 
                                                 key={idx} 
                                                 onClick={() => handleCategoryRowClick(row)}
                                                 className="hover:bg-[#2b2b2b]/40 transition-colors cursor-pointer"
                                                 onMouseEnter={(e) => setTooltipData({
                                                     text: `${row.category} 상세 업무 페이지 보기`,
                                                     x: e.clientX,
                                                     y: e.clientY
                                                 })}
                                                 onMouseMove={(e) => setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                                                 onMouseLeave={() => setTooltipData(null)}
                                             >
                                                {/* 대분류 */}
                                                <td className="py-[9px] px-[16px] text-center font-bold text-[#E5E5E5] w-[140px] whitespace-nowrap">
                                                    {row.category}
                                                </td>
                                                {/* 전체업무 */}
                                                <td className="py-[9px] px-[16px] text-center text-white font-bold relative w-[165px] whitespace-nowrap">
                                                    <div className="absolute inset-y-[4px] left-[6px] right-[6px] z-0">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-[#86868b]/15 to-[#86868b]/30 rounded-[4px]"
                                                            style={{ width: `${(row.totalCount / maxTotalCountCat) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="relative z-10">{row.totalCount}</span>
                                                </td>
                                                {/* PF필수 */}
                                                <td className="py-[9px] px-[16px] text-center text-white font-bold relative w-[165px] whitespace-nowrap">
                                                    <div className="absolute inset-y-[4px] left-[6px] right-[6px] z-0">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-[#86868b]/15 to-[#86868b]/30 rounded-[4px]"
                                                            style={{ width: `${(row.pfCount / maxPfCountCat) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="relative z-10">{row.pfCount}</span>
                                                </td>
                                                {/* 준공필수 */}
                                                <td className="py-[9px] px-[16px] text-center text-white font-bold relative w-[165px] whitespace-nowrap">
                                                    <div className="absolute inset-y-[4px] left-[6px] right-[6px] z-0">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-[#86868b]/15 to-[#86868b]/30 rounded-[4px]"
                                                            style={{ width: `${(row.constCount / maxConstCountCat) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="relative z-10">{row.constCount}</span>
                                                </td>
                                                {/* 진행중 */}
                                                <td className="py-[9px] px-[16px] text-center text-[#E5E5E5] font-semibold border-l border-[#3c3c3c]/50 w-[90px] whitespace-nowrap bg-[#2c2c2b]/30">
                                                    {row.inProgressCount} of {row.totalCount}
                                                </td>
                                                {/* Blocker */}
                                                <td className={`py-[9px] px-[16px] text-center font-semibold w-[90px] border-l border-[#3c3c3c]/50 whitespace-nowrap ${row.blockerCount > 0 ? 'text-[#ff453a]' : 'text-[#86868B]'}`}>
                                                    {row.blockerCount}
                                                </td>
                                                {/* 의사결정필요 */}
                                                <td className={`py-[9px] px-[16px] text-center font-semibold w-[90px] border-l border-[#3c3c3c]/50 whitespace-nowrap ${row.decisionCount > 0 ? 'text-[#ff453a]' : 'text-[#86868B]'}`}>
                                                    {row.decisionCount}
                                                </td>
                                                {/* 지원필요 */}
                                                <td className="py-[9px] px-[16px] text-center text-[#E5E5E5] font-medium w-[90px] border-l border-[#3c3c3c]/50 whitespace-nowrap">
                                                    {row.supportCount}
                                                </td>
                                                {/* 지연 */}
                                                <td className="py-[9px] px-[16px] text-center text-white font-bold relative w-[90px] border-l border-[#3c3c3c]/50 whitespace-nowrap">
                                                    <div className="absolute inset-y-[4px] left-[6px] right-[6px] z-0">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-[#86868b]/15 to-[#86868b]/30 rounded-[4px]"
                                                            style={{ width: `${(row.delayedCount / maxDelayedCountCat) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="relative z-10">{row.delayedCount}</span>
                                                </td>
                                                {/* 실행주관 */}
                                                <td className="py-[9px] px-[16px] text-center text-[#E5E5E5] font-medium w-[105px] border-l border-[#3c3c3c]/50 whitespace-nowrap">
                                                    {row.shortDepts}
                                                </td>                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {tooltipData && (
                <div 
                    className="fixed z-[100] pointer-events-none px-3 py-1.5 bg-[#1a1a19]/95 border border-[#444] text-[12px] font-bold text-white rounded-[8px] shadow-2xl backdrop-blur-md transition-opacity duration-150 ease-out"
                    style={{ 
                        left: `${tooltipData.x + 12}px`, 
                        top: `${tooltipData.y + 12}px` 
                    }}
                >
                    {tooltipData.text}
                </div>
            )}
        </div>
    );
}
