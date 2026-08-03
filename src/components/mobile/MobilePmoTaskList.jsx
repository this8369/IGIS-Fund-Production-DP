import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { comparePmoTasksByPriority, getPmoTaskConditionKey, getStoredPmoPriorityScore, matchesPmoStatusFilter, parseTaskBoolean } from '../../utils/pmoTaskPriority';
import MobilePmoTaskDetail from './MobilePmoTaskDetail';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['전체', '진행중', '미착수', '지연', '완료', '보류', '중단'];
const CONDITION_SECTIONS = [
    { key: 'both', title: 'Blocker + 의사결정 필요', description: '두 조건 모두 해당', accentClassName: 'bg-[#f87171]' },
    { key: 'blocker', title: 'Blocker만', description: '의사결정 필요 제외', accentClassName: 'bg-[#f87171]' },
    { key: 'decision', title: '의사결정 필요만', description: 'Blocker 제외', accentClassName: 'bg-[#fb923c]' },
    { key: 'general', title: '일반 업무', description: '두 조건 모두 미해당', accentClassName: 'bg-[#86868B]' },
];

const formatDate = (dateString) => {
    if (!dateString) return '마감 미정';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

const getDueLabel = (dateString, status) => {
    if (!dateString || status === '완료') return formatDate(dateString);

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

const getStatusClassName = (status) => {
    if (status === '완료') return 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/10';
    if (status === '지연') return 'text-[#f87171] border-[#f87171]/30 bg-[#f87171]/10';
    if (status === '보류') return 'text-[#facc15] border-[#facc15]/30 bg-[#facc15]/10';
    return 'text-[#60a5fa] border-[#60a5fa]/30 bg-[#60a5fa]/10';
};

export default function MobilePmoTaskList({
    defaultFilter,
    onResetFilter,
    returnToHomeOnDetailClose = false,
    onReturnToHome,
}) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listMode, setListMode] = useState('priority');
    const [statusFilter, setStatusFilter] = useState('전체');
    const [selectedTask, setSelectedTask] = useState(null);
    const detailHistoryPushedRef = useRef(false);

    useEffect(() => {
        if (!defaultFilter) return;

        setListMode(defaultFilter === 'Blocker' || defaultFilter === 'Decision' ? 'condition' : 'priority');
        setStatusFilter(defaultFilter === 'Delay' ? '지연' : defaultFilter === 'Pending' ? '보류' : '전체');
    }, [defaultFilter]);

    useEffect(() => {
        let isActive = true;
        let refreshTimeoutId;

        const fetchTasks = async (showLoading = true) => {
            if (showLoading) setLoading(true);

            try {
                const { error: prioritySyncError } = await supabase
                    .schema('iota_v2')
                    .rpc('sync_pmo_priority_scores');

                if (prioritySyncError) {
                    const missingFunction = prioritySyncError.code === 'PGRST202' || prioritySyncError.code === '42883';
                    if (missingFunction) {
                        console.warn('Priority DB sync function is not installed yet.');
                        toast.error('DB 우선순위 동기화 설정이 필요합니다.', { id: 'pmo-priority-db-sync' });
                    } else {
                        console.error('Priority DB sync failed:', prioritySyncError);
                        toast.error('DB 우선순위 점수 저장에 실패했습니다.', { id: 'pmo-priority-db-sync' });
                    }
                }

                const { data, error } = await supabase
                    .schema('iota_v2')
                    .from('iota_pmo_tasks')
                    .select(`
                        *,
                        lead_dept:iota_departments!lead_dept_code(dept_name),
                        external_party:iota_stakeholders!external_party_code(stakeholder_name)
                    `)
                    .neq('task_type', '팝업')
                    .order('created_at', { ascending: true })
                    .order('id', { ascending: true });

                if (error) throw error;
                if (isActive) {
                    setTasks((data || [])
                        .filter((task) => task.task_type !== '팝업'));
                }
            } catch (error) {
                console.error('Failed to fetch PMO tasks:', error);
                if (isActive) setTasks([]);
            } finally {
                if (isActive && showLoading) setLoading(false);
            }
        };

        fetchTasks();

        const scheduleRefresh = () => {
            window.clearTimeout(refreshTimeoutId);
            refreshTimeoutId = window.setTimeout(() => fetchTasks(false), 300);
        };

        const channel = supabase
            .channel('mobile-pmo-priority-sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'iota_v2',
                table: 'iota_pmo_tasks',
            }, scheduleRefresh)
            .subscribe();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') scheduleRefresh();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isActive = false;
            window.clearTimeout(refreshTimeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (tasks.length === 0) return;

        const syncTaskFromUrl = () => {
            const taskId = new URLSearchParams(window.location.search).get('taskId');
            if (!taskId) detailHistoryPushedRef.current = false;
            setSelectedTask(taskId ? tasks.find((task) => String(task.id) === String(taskId)) || null : null);
        };

        syncTaskFromUrl();
        window.addEventListener('popstate', syncTaskFromUrl);
        return () => window.removeEventListener('popstate', syncTaskFromUrl);
    }, [tasks]);

    const filteredTasks = useMemo(() => tasks.filter((task) => {
        if (!matchesPmoStatusFilter(task, statusFilter)) return false;
        return true;
    }), [tasks, statusFilter]);

    const sortedTasks = useMemo(
        () => [...filteredTasks].sort(comparePmoTasksByPriority),
        [filteredTasks]
    );

    const conditionStats = useMemo(() => filteredTasks.reduce((stats, task) => {
        const isBlocker = parseTaskBoolean(task.is_blocker);
        const needsDecision = parseTaskBoolean(task.needs_decision);

        if (isBlocker) stats.blocker += 1;
        if (needsDecision) stats.decision += 1;
        if (isBlocker && needsDecision) stats.overlap += 1;
        return stats;
    }, { blocker: 0, decision: 0, overlap: 0 }), [filteredTasks]);

    const conditionSections = useMemo(() => {
        const groupedTasks = {
            both: [],
            blocker: [],
            decision: [],
            general: [],
        };

        sortedTasks.forEach((task) => {
            groupedTasks[getPmoTaskConditionKey(task)].push(task);
        });

        return CONDITION_SECTIONS.map((section) => ({
            ...section,
            tasks: groupedTasks[section.key],
        }));
    }, [sortedTasks]);

    const resetFilters = () => {
        setListMode('priority');
        setStatusFilter('전체');
        onResetFilter?.();
    };

    const showConditionView = () => {
        setListMode('condition');
        onResetFilter?.();
    };

    const openTaskDetail = (task) => {
        const url = new URL(window.location.href);
        url.searchParams.set('taskId', task.id);
        window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
        detailHistoryPushedRef.current = true;
        setSelectedTask(task);
    };

    const closeTaskDetail = () => {
        if (returnToHomeOnDetailClose) {
            const url = new URL(window.location.href);
            url.searchParams.delete('taskId');
            window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
            setSelectedTask(null);
            onReturnToHome?.();
            return;
        }

        if (detailHistoryPushedRef.current) {
            detailHistoryPushedRef.current = false;
            window.history.back();
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.delete('taskId');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        setSelectedTask(null);
    };

    const renderTaskCard = (task) => {
        const isBlocker = parseTaskBoolean(task.is_blocker);
        const needsDecision = parseTaskBoolean(task.needs_decision);
        const priorityScore = getStoredPmoPriorityScore(task);
        const leadDepartment = task.lead_dept?.dept_name || task.lead_dept || task.lead_dept_code || '실행주관 미정';

        return (
            <button
                key={task.id}
                type="button"
                onClick={() => openTaskDetail(task)}
                className="shrink-0 w-full text-left bg-[#272726] rounded-[16px] px-4 py-2.5 border border-[#3c3c3c]/60 relative overflow-hidden active:bg-[#30302f] active:scale-[0.995] transition-all"
            >
                {(isBlocker || needsDecision) && (
                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${isBlocker ? 'bg-[#f87171]' : 'bg-[#fb923c]'}`} />
                )}

                <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#60a5fa] truncate">{task.project_code || '전사'}</span>
                        {isBlocker && <span className="text-[9px] font-bold text-[#f87171] bg-[#f87171]/10 px-1.5 py-0.5 rounded-[5px] border border-[#f87171]/20">Blocker</span>}
                        {needsDecision && <span className="text-[9px] font-bold text-[#fb923c] bg-[#fb923c]/10 px-1.5 py-0.5 rounded-[5px] border border-[#fb923c]/20">의사결정</span>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 border rounded-full ${getStatusClassName(task.status)}`}>
                        {task.status || '진행중'}
                    </span>
                </div>

                <h3 className="text-[16px] font-bold text-white leading-[1.35] line-clamp-2 break-keep">
                    {task.task_name || '제목 없음'}
                </h3>

                <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-3 text-[11px]">
                    <div className="min-w-0 flex items-center gap-2 text-[#A1A1AA]">
                        <span className={`font-bold ${priorityScore >= 60 ? 'text-[#f87171]' : priorityScore >= 40 ? 'text-[#bdbba7]' : 'text-[#A1A1AA]'}`}>
                            우선 {priorityScore}
                        </span>
                        <span className="text-white/20">·</span>
                        <span className="truncate">{leadDepartment}</span>
                    </div>
                    <span className={`shrink-0 font-bold ${task.status === '지연' ? 'text-[#f87171]' : 'text-[#D1D1D6]'}`}>
                        {getDueLabel(task.due_date, task.status)} <span className="font-normal text-[#86868B]">{formatDate(task.due_date)}</span>
                    </span>
                </div>
            </button>
        );
    };

    return (
        <div className="flex flex-col w-full h-full min-h-0 bg-[#111111]">
            <div className="shrink-0 border-b border-[#3c3c3c]/40 bg-[#111111]">
                <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto hide-scrollbar">
                    <button
                        type="button"
                        onClick={resetFilters}
                        className={`h-8 px-2.5 rounded-[9px] text-[11px] font-bold whitespace-nowrap border transition-colors ${listMode === 'priority' ? 'text-white bg-[#3c3c3c] border-[#555]' : 'text-[#A1A1AA] bg-[#1A1A1A] border-[#3c3c3c]'}`}
                    >
                        우선순위순
                    </button>
                    <button
                        type="button"
                        onClick={showConditionView}
                        className={`h-8 px-2.5 rounded-[9px] text-[11px] font-bold whitespace-nowrap border transition-colors ${listMode === 'condition' ? 'text-white bg-[#3c3c3c] border-[#555]' : 'text-[#A1A1AA] bg-[#1A1A1A] border-[#3c3c3c]'}`}
                    >
                        조건별 보기
                    </button>
                    <label className={`relative h-8 px-2.5 rounded-[9px] text-[11px] font-bold whitespace-nowrap border flex items-center gap-1 ${statusFilter !== '전체' ? 'text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/40' : 'text-[#A1A1AA] bg-[#1A1A1A] border-[#3c3c3c]'}`}>
                        <span>{statusFilter === '전체' ? '상태' : statusFilter}</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0"
                            aria-label="업무 상태 선택"
                        >
                            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-6 flex flex-col gap-2 hide-scrollbar">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin w-7 h-7 border-[3px] border-[#3b82f6] border-t-transparent rounded-full" />
                    </div>
                ) : sortedTasks.length === 0 ? (
                    <div className="text-center py-20 text-[#86868B] text-[14px] font-medium">
                        조건에 맞는 통합업무가 없습니다.
                    </div>
                ) : listMode === 'priority' ? (
                    sortedTasks.map(renderTaskCard)
                ) : (
                    <div className="flex flex-col gap-3">
                        <section className="rounded-[14px] border border-[#3c3c3c]/70 bg-[#1A1A1A] px-3.5 py-3">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-[14px] font-bold text-white">조건별 보기</h2>
                                <span className="text-[10px] font-medium text-[#86868B]">
                                    {statusFilter === '전체' ? '미완료 업무 기준' : `${statusFilter} 업무 기준`}
                                </span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-[1.55] text-[#A1A1AA] break-keep">
                                Blocker와 의사결정 필요가 겹치는 업무를 중복 없이 한 번씩 나눠 보여줍니다. 아래 네 구간 안에서는 우선순위가 높은 순서로 정렬됩니다.
                            </p>
                            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                                <div className="rounded-[8px] bg-[#272726] px-2 py-1.5 text-center">
                                    <span className="block text-[9px] text-[#86868B]">Blocker 전체</span>
                                    <strong className="mt-0.5 block text-[13px] text-[#f87171]">{conditionStats.blocker}건</strong>
                                </div>
                                <div className="rounded-[8px] bg-[#272726] px-2 py-1.5 text-center">
                                    <span className="block text-[9px] text-[#86868B]">의사결정 필요 전체</span>
                                    <strong className="mt-0.5 block text-[13px] text-[#fb923c]">{conditionStats.decision}건</strong>
                                </div>
                                <div className="rounded-[8px] bg-[#272726] px-2 py-1.5 text-center">
                                    <span className="block text-[9px] text-[#86868B]">두 조건 중복</span>
                                    <strong className="mt-0.5 block text-[13px] text-white">{conditionStats.overlap}건</strong>
                                </div>
                            </div>
                        </section>

                        {conditionSections.map((section) => (
                            <section key={section.key} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between px-1 pt-1">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${section.accentClassName}`} />
                                        <h3 className="truncate text-[12px] font-bold text-white">{section.title}</h3>
                                        <span className="truncate text-[10px] text-[#86868B]">{section.description}</span>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-bold text-[#A1A1AA]">{section.tasks.length}건</span>
                                </div>
                                {section.tasks.length > 0 ? (
                                    section.tasks.map(renderTaskCard)
                                ) : (
                                    <div className="rounded-[12px] border border-dashed border-[#3c3c3c]/60 py-3 text-center text-[11px] text-[#666]">
                                        해당 업무가 없습니다.
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                )}
            </div>

            {selectedTask && (
                <MobilePmoTaskDetail
                    task={selectedTask}
                    onClose={closeTaskDetail}
                    backLabel={returnToHomeOnDetailClose ? '홈' : '업무'}
                />
            )}
        </div>
    );
}
