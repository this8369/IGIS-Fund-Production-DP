import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../utils/supabaseClient';
import {
    comparePmoTasksByPriority,
    getPmoMeetingGrade,
    getStoredPmoPriorityScore,
    matchesPmoStatusFilter,
    parseTaskBoolean,
} from '../../utils/pmoTaskPriority';
import {
    fetchDirectorWorkflowLogs,
    getDirectorLogCell,
    getDirectorStaffCell,
} from '../../utils/directorWorkflowLogs';
import { getMemberIotaOrganization } from '../../utils/iotaOrganizations';

const GRADE_CONFIG = [
    { grade: 'A', label: '즉시회의', color: '#f87171' },
    { grade: 'B', label: '회의점검', color: '#fbbf24' },
    { grade: 'C', label: '주간관리', color: '#60a5fa' },
    { grade: 'D', label: '대기', color: '#86868B' },
];

const HOME_LIST_LIMIT = 5;
const COLLABORATION_FALLBACK_DEPARTMENT = '사업2파트';

const formatShortDate = (dateString) => {
    if (!dateString) return '기한 미정';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

const getDueLabel = (dateString, status) => {
    if (!dateString || status === '완료') return formatShortDate(dateString);
    const dueDate = new Date(dateString);
    if (Number.isNaN(dueDate.getTime())) return dateString;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const difference = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    if (difference === 0) return 'D-Day';
    if (difference < 0) return `D+${Math.abs(difference)}`;
    return `D-${difference}`;
};

const getTodayLabel = () => {
    const today = new Date();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${today.getMonth() + 1}월 ${today.getDate()}일 ${weekdays[today.getDay()]}요일`;
};

const normalizeMatchText = (value) => String(value || '')
    .replace(/[\s·/_-]+/g, '')
    .toLowerCase();

const hasMeaningfulSupport = (value) => {
    const normalized = normalizeMatchText(value);
    return normalized && !['없음', 'na', '해당사항없음', 'none', '미정'].includes(normalized);
};

const getDaysUntilDue = (dateString) => {
    if (!dateString) return null;
    const dueDate = new Date(dateString);
    if (Number.isNaN(dueDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
};

const getMemberDepartmentTerms = (memberInfo) => {
    const memberName = memberInfo?.staff_name || memberInfo?.name || '';
    const department = getDirectorStaffCell(memberName);
    const values = [
        department,
        memberInfo?.org_name,
        memberInfo?.workspace_code,
    ];

    if (department === '사업1파트') values.push('사업 PM 1', '사업관리1파트', 'PM1', 'DEPT_PM1');
    if (department === '사업2파트') values.push('사업 PM 2', '사업관리2파트', 'PM2', 'DEPT_PM2');
    if (department === 'LFC') values.push('파이낸싱', '파이낸싱-LFC', 'DEPT_LFC');
    if (department === '개발솔루션') values.push('개발관리실', '개발솔루션-DSC', 'DSC', 'DEPT_DEV');
    if (department === '기업마케팅') values.push('기업마케팅-EMC', 'EMC', 'DEPT_MKT');
    if (department === '공간솔루션') values.push('상품디지털', '공간솔루션-SSC', 'SSC', 'DEPT_DESIGN');
    if (department === 'KAM') values.push('펀드운용', '펀드운용-KAM');

    return [...new Set(values.map(normalizeMatchText).filter(Boolean))];
};

const matchesMemberDepartment = (value, memberInfo) => {
    const normalizedValue = normalizeMatchText(value);
    if (!normalizedValue) return false;
    return getMemberDepartmentTerms(memberInfo).some((term) => normalizedValue.includes(term));
};

const getTaskGuidance = (task, memberInfo) => {
    const memberName = memberInfo?.staff_name || memberInfo?.name || '';
    const leadDepartment = task.lead_dept?.dept_name || task.lead_dept_code || '';
    const isAssignedToMember = memberName
        && normalizeMatchText(task.assignee).includes(normalizeMatchText(memberName));
    const isMemberLeadDepartment = matchesMemberDepartment(leadDepartment, memberInfo);
    const isMemberCooperationDepartment = matchesMemberDepartment(task.coop_dept_codes, memberInfo);
    const isBlocker = parseTaskBoolean(task.is_blocker);
    const needsDecision = parseTaskBoolean(task.needs_decision);
    const daysUntilDue = getDaysUntilDue(task.due_date);
    const isOverdue = task.status === '지연' || (daysUntilDue !== null && daysUntilDue < 0);
    const isDueSoon = !isOverdue && daysUntilDue !== null && daysUntilDue <= 7;
    const needsSupport = hasMeaningfulSupport(task.support_needed);
    const reasons = [];

    if (isAssignedToMember) {
        reasons.push('내 담당');
    }
    if (isMemberLeadDepartment) {
        reasons.push('내 부서 실행주관');
    }
    if (isMemberCooperationDepartment) {
        reasons.push('내 부서 협조');
    }
    if (isBlocker) {
        reasons.push('Blocker');
    }
    if (needsDecision) {
        reasons.push('의사결정 필요');
    }
    if (isOverdue) {
        reasons.push('기한 경과');
    } else if (isDueSoon) {
        reasons.push('7일 내 마감');
    }
    if (needsSupport) {
        reasons.push('지원 필요');
    }

    return { reasons };
};

const getNotificationWorkspaceDepartment = (referenceId) => {
    const [, workspaceCode = ''] = String(referenceId || '').split('|');
    if (!workspaceCode || workspaceCode === 'WS_PM') return '전체';
    return getDirectorLogCell({ metadata: { workspace_code: workspaceCode } });
};

const isBusinessPm2LeadTask = (task) => {
    const leadDepartment = normalizeMatchText(
        task?.lead_dept?.dept_name || task?.lead_dept_code
    );
    return ['사업pm2', '사업2파트', '사업관리2파트', 'deptpm2']
        .some((term) => leadDepartment.includes(normalizeMatchText(term)));
};

export default function MobileHome({ memberInfo, onNavigateToTab }) {
    const [tasks, setTasks] = useState([]);
    const [directorReports, setDirectorReports] = useState([]);
    const [pendingCollaborationItems, setPendingCollaborationItems] = useState([]);
    const [selectedSummaryGrade, setSelectedSummaryGrade] = useState(null);
    const [taskLoading, setTaskLoading] = useState(true);
    const [reportLoading, setReportLoading] = useState(true);
    const [collaborationLoading, setCollaborationLoading] = useState(true);
    const [taskError, setTaskError] = useState('');
    const [reportError, setReportError] = useState('');
    const [collaborationError, setCollaborationError] = useState('');

    const fetchTasks = useCallback(async (showLoading = true) => {
        if (showLoading) setTaskLoading(true);
        setTaskError('');

        try {
            const { error: prioritySyncError } = await supabase
                .schema('iota_v2')
                .rpc('sync_pmo_priority_scores');
            if (prioritySyncError) {
                console.warn('Mobile home priority sync failed:', prioritySyncError);
            }

            const { data, error } = await supabase
                .schema('iota_v2')
                .from('iota_pmo_tasks')
                .select(`
                    id,
                    project_code,
                    task_name,
                    lead_dept_code,
                    lead_dept:iota_departments!lead_dept_code(dept_name),
                    coop_dept_codes,
                    assignee,
                    is_blocker,
                    needs_decision,
                    support_needed,
                    priority_score,
                    due_date,
                    status,
                    meeting_grade,
                    task_type,
                    created_at
                `)
                .neq('task_type', '팝업')
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });

            if (error) throw error;
            setTasks((data || []).filter((task) => task.task_type !== '팝업'));
        } catch (error) {
            console.error('Failed to load mobile home tasks:', error);
            setTaskError('통합업무 현황을 불러오지 못했습니다.');
        } finally {
            if (showLoading) setTaskLoading(false);
        }
    }, []);

    const fetchReports = useCallback(async (showLoading = true, force = false) => {
        if (showLoading) setReportLoading(true);
        setReportError('');

        try {
            const reports = await fetchDirectorWorkflowLogs({ force });
            setDirectorReports(reports.slice(0, HOME_LIST_LIMIT));
        } catch (error) {
            console.error('Failed to load mobile home Director reports:', error);
            setReportError('Director 업무보고를 불러오지 못했습니다.');
        } finally {
            if (showLoading) setReportLoading(false);
        }
    }, []);

    const fetchCollaborations = useCallback(async (showLoading = true) => {
        if (showLoading) setCollaborationLoading(true);
        setCollaborationError('');

        try {
            if (!memberInfo?.auth_id) {
                setPendingCollaborationItems([]);
                return;
            }

            const notificationResult = await supabase
                .from('iota_notifications')
                .select('id, title, body, reference_id, created_at, type')
                .eq('user_id', memberInfo.auth_id)
                .eq('is_read', false)
                .in('type', ['log', 'logs', 'comment', 'comments'])
                .order('created_at', { ascending: false })
                .limit(HOME_LIST_LIMIT);

            if (notificationResult.error) {
                console.warn('Mobile home collaboration notification load failed:', notificationResult.error);
                setPendingCollaborationItems([]);
                return;
            }

            const pendingItems = (notificationResult.data || []).map((notification) => {
                const [logId] = String(notification.reference_id || '').split('|');
                return {
                    id: `notification-${notification.id}`,
                    logId: logId || null,
                    department: getNotificationWorkspaceDepartment(notification.reference_id),
                    title: notification.title || '확인할 협업',
                    summary: notification.body || '',
                    date: notification.created_at,
                    isPending: true,
                    type: 'notification',
                };
            });

            setPendingCollaborationItems(pendingItems);
        } catch (error) {
            console.error('Failed to load mobile home collaborations:', error);
            setCollaborationError('협업 내용을 불러오지 못했습니다.');
        } finally {
            if (showLoading) setCollaborationLoading(false);
        }
    }, [memberInfo?.auth_id]);

    useEffect(() => {
        fetchTasks();
        fetchReports();
        fetchCollaborations();

        let refreshTimeoutId;
        const scheduleTaskRefresh = () => {
            window.clearTimeout(refreshTimeoutId);
            refreshTimeoutId = window.setTimeout(() => fetchTasks(false), 300);
        };

        const channel = supabase
            .channel('mobile-home-pmo-summary')
            .on('postgres_changes', {
                event: '*',
                schema: 'iota_v2',
                table: 'iota_pmo_tasks',
            }, scheduleTaskRefresh)
            .subscribe();

        let collaborationChannel = null;
        if (memberInfo?.auth_id) {
            collaborationChannel = supabase
                .channel(`mobile-home-collaboration-${memberInfo.auth_id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'iota_notifications',
                    filter: `user_id=eq.${memberInfo.auth_id}`,
                }, () => fetchCollaborations(false))
                .subscribe();
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            scheduleTaskRefresh();
            fetchReports(false);
            fetchCollaborations(false);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearTimeout(refreshTimeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            supabase.removeChannel(channel);
            if (collaborationChannel) supabase.removeChannel(collaborationChannel);
        };
    }, [fetchCollaborations, fetchReports, fetchTasks, memberInfo?.auth_id]);

    const activeTasks = useMemo(
        () => tasks.filter((task) => matchesPmoStatusFilter(task, '전체')),
        [tasks]
    );

    const guidanceTasks = useMemo(() => {
        const tasksWithGuidance = activeTasks
            .map((task) => ({ ...task, ...getTaskGuidance(task, memberInfo) }));
        const attentionTasks = tasksWithGuidance.filter((task) => task.reasons.length > 0);
        const candidates = attentionTasks.length > 0 ? attentionTasks : tasksWithGuidance;

        return candidates
            .sort(comparePmoTasksByPriority)
            .slice(0, HOME_LIST_LIMIT);
    }, [activeTasks, memberInfo]);

    const collaborationItems = useMemo(() => {
        const fallbackTasks = activeTasks
            .filter(isBusinessPm2LeadTask)
            .sort(comparePmoTasksByPriority)
            .slice(0, HOME_LIST_LIMIT)
            .map((task) => ({
                id: `pm2-task-${task.id}`,
                taskId: task.id,
                department: COLLABORATION_FALLBACK_DEPARTMENT,
                title: task.task_name || '제목 없음',
                summary: task.support_needed || task.sector_detail || '',
                date: task.due_date,
                isPending: false,
                type: 'task',
                priorityScore: getStoredPmoPriorityScore(task),
                status: task.status || '진행중',
            }));

        return [...pendingCollaborationItems, ...fallbackTasks]
            .slice(0, HOME_LIST_LIMIT);
    }, [activeTasks, pendingCollaborationItems]);

    const gradeCounts = useMemo(() => activeTasks.reduce((counts, task) => {
        const grade = getPmoMeetingGrade(getStoredPmoPriorityScore(task));
        counts[grade] += 1;
        return counts;
    }, { A: 0, B: 0, C: 0, D: 0 }), [activeTasks]);

    const selectedGradeTasks = useMemo(() => {
        if (!selectedSummaryGrade) return [];
        return activeTasks
            .filter((task) => getPmoMeetingGrade(getStoredPmoPriorityScore(task)) === selectedSummaryGrade)
            .sort(comparePmoTasksByPriority);
    }, [activeTasks, selectedSummaryGrade]);

    const selectedGradeConfig = GRADE_CONFIG.find(({ grade }) => grade === selectedSummaryGrade);

    const openTaskBoard = (taskId = null) => {
        onNavigateToTab(1, null, {
            viewMode: 'pmo',
            taskId,
            returnToHome: Boolean(taskId),
        });
    };

    const openDirectorReports = (directorLogId = null) => {
        onNavigateToTab(1, null, {
            viewMode: 'director',
            directorLogId,
            returnToHome: Boolean(directorLogId),
        });
    };

    const openCollaborations = (item = null) => {
        onNavigateToTab(2, null, {
            collaborationDept: item?.department || getMemberIotaOrganization(memberInfo),
            collaborationItemId: item?.logId ? `log-${item.logId}` : null,
        });
    };

    return (
        <div className="w-full h-full overflow-y-auto hide-scrollbar px-4 pt-3 pb-8">
            <header className="mb-3 flex items-center justify-between gap-3">
                <h1 className="text-[19px] font-bold tracking-tight text-white">오늘의 CFT 브리핑</h1>
                <p className="shrink-0 text-right text-[11px] font-medium text-[#86868B]">
                    {getTodayLabel()} · {memberInfo?.staff_name || '사용자'}
                </p>
            </header>

            <section className="w-full rounded-[18px] border border-[#3c3c3c] bg-[#272726] px-3.5 py-3">
                <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#A1A1AA]">미완료 통합업무</span>
                    <strong className="text-[18px] font-bold text-white">
                        {taskLoading ? '-' : `${activeTasks.length}건`}
                    </strong>
                </div>

                <div className="mt-2.5 grid grid-cols-4 divide-x divide-white/[0.07]">
                    {GRADE_CONFIG.map(({ grade, label, color }) => {
                        const isSelected = selectedSummaryGrade === grade;
                        return (
                        <button
                            key={grade}
                            type="button"
                            aria-expanded={isSelected}
                            onClick={() => setSelectedSummaryGrade(isSelected ? null : grade)}
                            className={`mx-1 rounded-[9px] px-1 py-1.5 text-center transition-colors first:ml-0 last:mr-0 ${
                                isSelected ? 'bg-white/[0.08]' : 'active:bg-white/[0.05]'
                            }`}
                        >
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-[15px] font-black" style={{ color }}>{grade}</span>
                                <strong className="text-[15px] font-bold text-white">
                                    {taskLoading ? '-' : gradeCounts[grade]}
                                </strong>
                            </div>
                            <span className={`mt-0.5 block truncate text-[10px] ${isSelected ? 'text-white' : 'text-[#86868B]'}`}>
                                {label}
                            </span>
                        </button>
                        );
                    })}
                </div>

                {!taskLoading && activeTasks.length > 0 && (
                    <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-[#1A1A1A]">
                        {GRADE_CONFIG.map(({ grade, color }) => gradeCounts[grade] > 0 && (
                            <span
                                key={grade}
                                style={{ backgroundColor: color, flexGrow: gradeCounts[grade] }}
                            />
                        ))}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {selectedGradeConfig && (
                    <motion.div
                        key={selectedGradeConfig.grade}
                        initial={{ height: 0, opacity: 0, y: -8 }}
                        animate={{
                            height: 'auto',
                            opacity: 1,
                            y: 0,
                            transition: {
                                height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                                opacity: { duration: 0.2, delay: 0.04 },
                                y: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                            },
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                            y: -4,
                            transition: { duration: 0.13, ease: 'easeIn' },
                        }}
                        className="overflow-hidden"
                    >
                    <div className="mt-3 border-t border-white/[0.07] pt-2.5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: selectedGradeConfig.color }}
                                />
                                <strong className="truncate text-[12px] text-white">
                                    {selectedGradeConfig.grade} · {selectedGradeConfig.label}
                                </strong>
                                <span className="shrink-0 text-[10px] text-[#86868B]">
                                    {selectedGradeTasks.length}건
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedSummaryGrade(null)}
                                className="shrink-0 text-[10px] font-semibold text-[#86868B]"
                            >
                                접기
                            </button>
                        </div>

                        {selectedGradeTasks.length === 0 ? (
                            <div className="rounded-[10px] border border-dashed border-[#3c3c3c] py-4 text-center text-[11px] text-[#86868B]">
                                해당 등급의 미완료 업무가 없습니다.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {selectedGradeTasks.map((task) => {
                                    const priorityScore = getStoredPmoPriorityScore(task);
                                    const leadDepartment = task.lead_dept?.dept_name || task.lead_dept_code || '실행주관 미정';
                                    return (
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => openTaskBoard(task.id)}
                                            className="w-full rounded-[11px] border border-white/[0.06] bg-[#1F1F1E] px-3 py-2 text-left active:bg-[#30302f]"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <span className="block truncate text-[9px] font-bold text-[#60a5fa]">
                                                        {task.project_code || '전사'}
                                                    </span>
                                                    <strong className="mt-0.5 block line-clamp-2 break-keep text-[12px] leading-[1.35] text-white">
                                                        {task.task_name || '제목 없음'}
                                                    </strong>
                                                </div>
                                                <span
                                                    className="shrink-0 text-[11px] font-bold"
                                                    style={{ color: selectedGradeConfig.color }}
                                                >
                                                    {priorityScore}점
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-between gap-3 text-[9px] text-[#86868B]">
                                                <span className="truncate">{leadDepartment}</span>
                                                <span className={`shrink-0 font-semibold ${task.status === '지연' ? 'text-[#f87171]' : 'text-[#D1D1D6]'}`}>
                                                    {getDueLabel(task.due_date, task.status)}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    </motion.div>
                    )}
                </AnimatePresence>
            </section>

            <section className="mt-5">
                <div className="mb-2.5 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] font-bold text-white">우선 확인필요 업무</h2>
                        <p className="mt-0.5 text-[10px] text-[#86868B]">지금 먼저 확인해야 할 주요 업무 5건</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openTaskBoard()}
                        className="text-[11px] font-bold text-[#60a5fa]"
                    >
                        전체보기
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    {taskLoading ? (
                        [...Array(HOME_LIST_LIMIT)].map((_, index) => (
                            <div key={index} className="h-[68px] animate-pulse rounded-[15px] border border-[#3c3c3c]/60 bg-[#272726]" />
                        ))
                    ) : taskError ? (
                        <button
                            type="button"
                            onClick={() => fetchTasks()}
                            className="rounded-[15px] border border-[#f87171]/30 bg-[#f87171]/5 px-4 py-5 text-[12px] text-[#f87171]"
                        >
                            {taskError} 다시 시도
                        </button>
                    ) : guidanceTasks.length === 0 ? (
                        <div className="rounded-[15px] border border-dashed border-[#3c3c3c] py-6 text-center text-[12px] text-[#86868B]">
                            확인할 통합업무가 없습니다.
                        </div>
                    ) : guidanceTasks.map((task) => {
                        const priorityScore = getStoredPmoPriorityScore(task);
                        const leadDepartment = task.lead_dept?.dept_name || task.lead_dept_code || '실행주관 미정';
                        const isBlocker = parseTaskBoolean(task.is_blocker);
                        const needsDecision = parseTaskBoolean(task.needs_decision);
                        const supplementalReasons = task.reasons.filter((reason) => (
                            reason !== 'Blocker' && reason !== '의사결정 필요'
                        ));

                        return (
                            <button
                                key={task.id}
                                type="button"
                                onClick={() => openTaskBoard(task.id)}
                                className="relative w-full overflow-hidden rounded-[15px] border border-[#3c3c3c]/70 bg-[#272726] px-3.5 py-2 text-left active:bg-[#30302f]"
                            >
                                {(isBlocker || needsDecision) && (
                                    <span className={`absolute inset-y-0 left-0 w-1 ${isBlocker ? 'bg-[#f87171]' : 'bg-[#fb923c]'}`} />
                                )}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="shrink-0 text-[10px] font-bold text-[#60a5fa]">{task.project_code || '전사'}</span>
                                        <span className="min-w-0 truncate text-[9px] font-semibold text-[#A1A1AA]">{leadDepartment}</span>
                                        {isBlocker && <span className="shrink-0 rounded-[4px] bg-[#f87171]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#f87171]">Blocker</span>}
                                        {needsDecision && <span className="shrink-0 rounded-[4px] bg-[#fb923c]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#fb923c]">의사결정필요</span>}
                                    </div>
                                    <span className={`shrink-0 text-[11px] font-bold ${priorityScore >= 60 ? 'text-[#f87171]' : priorityScore >= 40 ? 'text-[#bdbba7]' : 'text-[#A1A1AA]'}`}>
                                        우선 {priorityScore}
                                    </span>
                                </div>
                                <h3 className="mt-1 line-clamp-2 break-keep text-[16px] font-bold leading-[1.3] text-white">
                                    {task.task_name || '제목 없음'}
                                </h3>
                                {supplementalReasons.length > 0 && (
                                    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] text-[#86868B]">
                                        {supplementalReasons.slice(0, 2).map((reason) => (
                                            <span
                                                key={reason}
                                                className="shrink-0 rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-bold text-[#D1D1D6]"
                                            >
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mt-5">
                <div className="mb-2.5 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] font-bold text-white">Director 최신 보고</h2>
                        <p className="mt-0.5 text-[10px] text-[#86868B]">디렉터 T5T 중 이오타서울 관련업무를 추림</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openDirectorReports()}
                        className="text-[11px] font-bold text-[#60a5fa]"
                    >
                        전체보기
                    </button>
                </div>

                <div className="overflow-hidden rounded-[16px] border border-[#3c3c3c]/70 bg-[#272726]">
                    {reportLoading ? (
                        [...Array(HOME_LIST_LIMIT)].map((_, index) => (
                            <div key={index} className="h-[70px] animate-pulse border-b border-white/[0.06] last:border-b-0" />
                        ))
                    ) : reportError ? (
                        <button
                            type="button"
                            onClick={() => fetchReports(true, true)}
                            className="w-full px-4 py-6 text-[12px] text-[#f87171]"
                        >
                            {reportError} 다시 시도
                        </button>
                    ) : directorReports.length === 0 ? (
                        <div className="py-6 text-center text-[12px] text-[#86868B]">등록된 Director 보고가 없습니다.</div>
                    ) : directorReports.map((report, index) => (
                        <button
                            key={report.id}
                            type="button"
                            onClick={() => openDirectorReports(report.id)}
                            className={`w-full px-3.5 py-3 text-left active:bg-[#30302f] ${index < directorReports.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-3 text-[9px]">
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate rounded-[4px] bg-[#3b82f6]/15 px-1.5 py-0.5 font-bold text-[#60a5fa]">{report.category}</span>
                                    <span className="truncate text-[#86868B]">{report.line}</span>
                                </div>
                                <span className="shrink-0 text-[#86868B]">{formatShortDate(report.work_date)}</span>
                            </div>
                            <h3 className="mt-1.5 line-clamp-2 break-keep text-[13px] font-bold leading-[1.4] text-white">
                                {report.title}
                            </h3>
                            <p className="mt-1.5 line-clamp-3 whitespace-pre-line break-keep text-[13px] leading-[1.5] text-[#A1A1AA]">
                                {report.display_text || '등록된 상세 내용이 없습니다.'}
                            </p>
                            <span className="mt-1.5 block text-[10px] text-[#86868B]">{report.writer_name}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="mt-5">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[16px] font-bold text-white">협업 확인사항</h2>
                        <p className="mt-0.5 truncate text-[10px] text-[#86868B]">
                            협업 요청과 사업2파트 실행주관 업무 5건
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openCollaborations()}
                        className="shrink-0 text-[11px] font-bold text-[#60a5fa]"
                    >
                        협업보기
                    </button>
                </div>

                <div className="overflow-hidden rounded-[16px] border border-[#3c3c3c]/70 bg-[#272726]">
                    {collaborationLoading ? (
                        [...Array(HOME_LIST_LIMIT)].map((_, index) => (
                            <div key={index} className="h-[72px] animate-pulse border-b border-white/[0.06] last:border-b-0" />
                        ))
                    ) : collaborationError ? (
                        <button
                            type="button"
                            onClick={() => fetchCollaborations()}
                            className="w-full px-4 py-6 text-[12px] text-[#f87171]"
                        >
                            {collaborationError} 다시 시도
                        </button>
                    ) : collaborationItems.length === 0 ? (
                        <div className="py-6 text-center text-[12px] text-[#86868B]">
                            표시할 협업 내용이 없습니다.
                        </div>
                    ) : collaborationItems.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => (
                                item.type === 'task'
                                    ? openTaskBoard(item.taskId)
                                    : openCollaborations(item)
                            )}
                            className={`w-full px-3.5 py-3 text-left active:bg-[#30302f] ${index < collaborationItems.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-3 text-[9px]">
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate rounded-[4px] bg-[#30d158]/10 px-1.5 py-0.5 font-bold text-[#34d399]">
                                        {item.department}
                                    </span>
                                    <span className={`shrink-0 font-bold ${item.isPending ? 'text-[#fbbf24]' : 'text-[#86868B]'}`}>
                                        {item.isPending ? '확인 필요' : '실행주관 업무'}
                                    </span>
                                </div>
                                <span className={`shrink-0 font-bold ${
                                    item.type === 'task' && item.priorityScore >= 60
                                        ? 'text-[#f87171]'
                                        : 'text-[#86868B]'
                                }`}>
                                    {item.type === 'task' ? `우선 ${item.priorityScore}` : formatShortDate(item.date)}
                                </span>
                            </div>
                            <h3 className="mt-1.5 truncate text-[13px] font-bold text-white">{item.title}</h3>
                            {item.type === 'task' ? (
                                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-[#A1A1AA]">
                                    <span className="truncate">{item.summary || '등록된 지원사항이 없습니다.'}</span>
                                    <span className="shrink-0 font-bold text-[#D1D1D6]">
                                        {item.status} · {getDueLabel(item.date, item.status)}
                                    </span>
                                </div>
                            ) : item.summary && (
                                <p className="mt-1 line-clamp-2 break-keep text-[10px] leading-[1.4] text-[#A1A1AA]">
                                    {item.summary}
                                </p>
                            )}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
