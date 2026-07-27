import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { getMemberIotaOrganization } from '../../../utils/iotaOrganizations';
import { notifyMembersOnTaskCreation } from '../../../utils/notificationHelpers';
import {
    IOTA_DETAILED_SCHEDULE_FALLBACK,
    IOTA_SCHEDULE_PERIODS,
    normalizeIotaScheduleLabel
} from '../../../data/iotaDetailedSchedule';
import PmoTaskBoardStaging from './PmoTaskBoardStaging';
import PmoScheduleTaskLinkModal from './PmoScheduleTaskLinkModal';

const PERIOD_INDEX = new Map(
    IOTA_SCHEDULE_PERIODS.map((period, index) => [period.key, index])
);

const SCHEDULE_YEAR = 2026;
const SCHEDULE_START_MONTH = 7;
const SCHEDULE_END_MONTH = 12;
const SCHEDULE_LABEL_COLUMN_WIDTH = 450;
const SCHEDULE_PERIOD_WIDTH = 48;
const DEFAULT_PROGRESS_STATUS = 'not_started';

const PROGRESS_STATUS_OPTIONS = [
    { value: 'not_started', label: '미착수' },
    { value: 'in_progress', label: '진행중' },
    { value: 'completed', label: '완료' },
    { value: 'on_hold', label: '보류' }
];

const DEFAULT_SCHEDULE_DEPARTMENTS = [
    { dept_code: '', dept_name: '미정' },
    { dept_code: 'SPECIAL_CFT', dept_name: 'CFT' },
    { dept_code: 'DEPT_PM1', dept_name: '사업1파트' },
    { dept_code: 'DEPT_PM2', dept_name: '사업2파트' },
    { dept_code: 'DEPT_LFC', dept_name: 'LFC' },
    { dept_code: 'DEPT_DEV', dept_name: '개발솔루션' },
    { dept_code: 'DEPT_DESIGN', dept_name: '공간솔루션' },
    { dept_code: 'DEPT_MKT', dept_name: '기업마케팅' },
    { dept_code: 'DEPT_KAM', dept_name: 'KAM' },
    { dept_code: 'DEPT_PO', dept_name: '기획추진' },
    { dept_code: 'DEPT_ALL', dept_name: '전부서' }
];

const PROGRESS_STATUS_STYLES = {
    not_started: 'border-[#555]/60 bg-white/[0.04] text-[#a1a1aa]',
    in_progress: 'border-[#2997ff]/35 bg-[#2997ff]/10 text-[#60a5fa]',
    completed: 'border-[#30d158]/35 bg-[#30d158]/10 text-[#4ade80]',
    on_hold: 'border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#fbbf24]'
};

const getSeoulDateParts = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts
            .filter((part) => ['year', 'month', 'day'].includes(part.type))
            .map((part) => [part.type, Number(part.value)])
    );
    return values;
};

const getTodayScheduleMarker = () => {
    const { year, month, day } = getSeoulDateParts();
    if (year !== SCHEDULE_YEAR || month < SCHEDULE_START_MONTH || month > SCHEDULE_END_MONTH) {
        return null;
    }

    const weekIndex = Math.min(3, Math.floor((day - 1) / 7));
    const periodIndex = ((month - SCHEDULE_START_MONTH) * 4) + weekIndex;
    const period = IOTA_SCHEDULE_PERIODS[periodIndex];
    if (!period) return null;

    const periodStartDay = (weekIndex * 7) + 1;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const periodEndDay = weekIndex < 3
        ? periodStartDay + 6
        : daysInMonth;
    const periodDayCount = periodEndDay - periodStartDay + 1;
    const periodProgress = (day - periodStartDay + 0.5) / periodDayCount;

    return {
        dateLabel: `오늘 ${month}.${day}`,
        isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        periodIndex,
        left: SCHEDULE_LABEL_COLUMN_WIDTH
            + ((periodIndex + periodProgress) * SCHEDULE_PERIOD_WIDTH)
    };
};

const normalizeDbItem = (item) => ({
    scheduleItemId: item.id || null,
    sourceKey: item.source_key,
    sourceOrder: item.source_order,
    itemType: item.item_type,
    parentSourceKey: item.parent_source_key,
    lv1: normalizeIotaScheduleLabel(item.lv1),
    lv2: normalizeIotaScheduleLabel(item.lv2),
    taskName: normalizeIotaScheduleLabel(item.task_name),
    displayName: normalizeIotaScheduleLabel(item.display_name),
    leadDeptCode: item.lead_dept_code,
    leadLabel: item.lead_label || '미정',
    categoryMain: item.category_main,
    startPeriod: item.start_period,
    endPeriod: item.end_period,
    milestonePeriod: item.milestone_period,
    progressStatus: item.progress_status || DEFAULT_PROGRESS_STATUS,
    actualCompletedDate: item.actual_completed_date || null,
    updatedByName: item.updated_by_name || null,
    updatedAt: item.updated_at || null
});

const getProgressStatusLabel = (status) => (
    PROGRESS_STATUS_OPTIONS.find((option) => option.value === status)?.label || '미착수'
);

const getScheduleAttention = (item, currentPeriodIndex) => {
    if (
        item.itemType !== 'task'
        || item.progressStatus === 'completed'
        || currentPeriodIndex === null
        || currentPeriodIndex === undefined
    ) {
        return null;
    }

    const closingPeriod = item.endPeriod || item.milestonePeriod;
    const closingPeriodIndex = PERIOD_INDEX.get(closingPeriod);
    if (closingPeriodIndex === undefined) return null;
    if (closingPeriodIndex < currentPeriodIndex) return 'overdue';
    if (closingPeriodIndex === currentPeriodIndex) return 'due_this_week';
    return null;
};

const getScheduleState = (item) => {
    if (item.milestonePeriod) return 'milestone';
    if (item.startPeriod && item.endPeriod) return 'scheduled';
    return item.itemType === 'task' ? 'unscheduled' : 'group';
};

const getDepth = (item) => {
    if (item.itemType === 'lv1') return 0;
    if (item.itemType === 'lv2') return 1;
    return 2;
};

const getAncestors = (item, itemMap) => {
    const ancestors = [];
    let parentKey = item.parentSourceKey;
    while (parentKey) {
        ancestors.push(parentKey);
        parentKey = itemMap.get(parentKey)?.parentSourceKey;
    }
    return ancestors;
};

const buildScheduleSummaries = (items) => {
    const children = new Map();
    for (const item of items) {
        if (!item.parentSourceKey) continue;
        const siblings = children.get(item.parentSourceKey) || [];
        siblings.push(item);
        children.set(item.parentSourceKey, siblings);
    }

    const summaries = new Map();
    const visit = (item) => {
        const descendants = children.get(item.sourceKey) || [];
        const childSummaries = descendants.map(visit);
        const ownStart = PERIOD_INDEX.get(item.startPeriod);
        const ownEnd = PERIOD_INDEX.get(item.endPeriod);
        const starts = [
            ...(ownStart === undefined ? [] : [ownStart]),
            ...childSummaries.flatMap((summary) => (
                summary.startIndex === null ? [] : [summary.startIndex]
            ))
        ];
        const ends = [
            ...(ownEnd === undefined ? [] : [ownEnd]),
            ...childSummaries.flatMap((summary) => (
                summary.endIndex === null ? [] : [summary.endIndex]
            ))
        ];
        const ownTask = item.itemType === 'task';
        const scheduledTaskCount = (ownTask && item.startPeriod && item.endPeriod ? 1 : 0)
            + childSummaries.reduce((sum, summary) => sum + summary.scheduledTaskCount, 0);
        const unscheduledTaskCount = (ownTask && (!item.startPeriod || !item.endPeriod) ? 1 : 0)
            + childSummaries.reduce((sum, summary) => sum + summary.unscheduledTaskCount, 0);
        const milestoneCount = (item.milestonePeriod ? 1 : 0)
            + childSummaries.reduce((sum, summary) => sum + summary.milestoneCount, 0);
        const summary = {
            startIndex: starts.length ? Math.min(...starts) : null,
            endIndex: ends.length ? Math.max(...ends) : null,
            scheduledTaskCount,
            unscheduledTaskCount,
            milestoneCount
        };
        summaries.set(item.sourceKey, summary);
        return summary;
    };

    items.filter((item) => item.itemType === 'lv1').forEach(visit);
    return summaries;
};

const SelectControl = ({ value, onChange, options, label }) => (
    <label className="relative h-[34px] min-w-[126px]">
        <span className="sr-only">{label}</span>
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-full w-full appearance-none rounded-[8px] border border-[#3c3c3c] bg-[#2c2c2b] pl-3 pr-8 text-[12px] font-bold text-[#E5E5E5] outline-none transition-colors hover:border-[#555] focus:border-[#2997ff]"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#222] text-white">
                    {option.label}
                </option>
            ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-[#86868B]">▼</span>
    </label>
);

const ScheduleEditModal = ({
    item,
    departments,
    categories,
    saving,
    errorMessage,
    onClose,
    onSave
}) => {
    const initialLeadValue = item.leadDeptCode
        || (item.leadLabel === 'CFT' ? 'SPECIAL_CFT' : '');
    const [form, setForm] = useState({
        displayName: item.displayName || '',
        leadValue: initialLeadValue,
        categoryMain: item.categoryMain || '',
        startPeriod: item.startPeriod || '',
        endPeriod: item.endPeriod || '',
        milestonePeriod: item.milestonePeriod || '',
        progressStatus: item.progressStatus || DEFAULT_PROGRESS_STATUS,
        actualCompletedDate: item.actualCompletedDate || ''
    });

    const updateForm = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
            ...(field === 'progressStatus' && value !== 'completed'
                ? { actualCompletedDate: '' }
                : {})
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const selectedDepartment = departments.find(
            (department) => department.dept_code === form.leadValue
        );
        onSave({
            ...form,
            leadDeptCode: form.leadValue && form.leadValue !== 'SPECIAL_CFT'
                ? form.leadValue
                : null,
            leadLabel: selectedDepartment?.dept_name || '미정'
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex justify-end bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-edit-title"
            data-schedule-edit-modal
        >
            <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="일정 수정 닫기"
                onClick={onClose}
            />
            <form
                onSubmit={handleSubmit}
                className="relative flex h-full w-[430px] flex-col border-l border-[#444] bg-[#20201f] shadow-[-16px_0_40px_rgba(0,0,0,0.35)]"
            >
                <div className="flex items-start justify-between border-b border-[#3a3a3a] px-6 py-5">
                    <div>
                        <div className="mb-1 font-mono text-[11px] font-bold text-[#60a5fa]">
                            {item.sourceKey}
                        </div>
                        <h3 id="schedule-edit-title" className="text-[20px] font-bold text-white">
                            일정 행 수정
                        </h3>
                        <p className="mt-1 text-[11px] text-[#86868B]">
                            저장한 변경사항은 수정자와 함께 자동 기록됩니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#444] text-[18px] text-[#a1a1aa] hover:bg-white/5 hover:text-white"
                        aria-label="닫기"
                    >
                        ×
                    </button>
                </div>

                <div className="timeline-scrollbar flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    <label className="block">
                        <span className="mb-2 block text-[12px] font-bold text-[#a1a1aa]">업무명</span>
                        <input
                            value={form.displayName}
                            onChange={(event) => updateForm('displayName', event.target.value)}
                            className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292928] px-3 text-[13px] text-white outline-none focus:border-[#60a5fa]"
                            required
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="mb-2 block text-[12px] font-bold text-[#a1a1aa]">주관 조직</span>
                            <select
                                value={form.leadValue}
                                onChange={(event) => updateForm('leadValue', event.target.value)}
                                className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292928] px-3 text-[12px] text-white outline-none focus:border-[#60a5fa]"
                            >
                                {departments.map((department) => (
                                    <option key={department.dept_code || 'unassigned'} value={department.dept_code}>
                                        {department.dept_name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-[12px] font-bold text-[#a1a1aa]">업무분류</span>
                            <input
                                value={form.categoryMain}
                                onChange={(event) => updateForm('categoryMain', event.target.value)}
                                list="schedule-category-options"
                                className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292928] px-3 text-[12px] text-white outline-none focus:border-[#60a5fa]"
                                required
                            />
                            <datalist id="schedule-category-options">
                                {categories.map((category) => <option key={category} value={category} />)}
                            </datalist>
                        </label>
                    </div>

                    <div className="rounded-[12px] border border-[#393939] bg-[#252524] p-4">
                        <div className="mb-3 text-[12px] font-bold text-[#a1a1aa]">수행 기간</div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] text-[#86868B]">시작</span>
                                <select
                                    value={form.startPeriod}
                                    onChange={(event) => updateForm('startPeriod', event.target.value)}
                                    className="h-9 w-full rounded-[7px] border border-[#444] bg-[#2b2b2a] px-2 text-[11px] text-white outline-none focus:border-[#60a5fa]"
                                >
                                    <option value="">일정 미정</option>
                                    {IOTA_SCHEDULE_PERIODS.map((period) => (
                                        <option key={period.key} value={period.key}>{period.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] text-[#86868B]">종료</span>
                                <select
                                    value={form.endPeriod}
                                    onChange={(event) => updateForm('endPeriod', event.target.value)}
                                    className="h-9 w-full rounded-[7px] border border-[#444] bg-[#2b2b2a] px-2 text-[11px] text-white outline-none focus:border-[#60a5fa]"
                                >
                                    <option value="">일정 미정</option>
                                    {IOTA_SCHEDULE_PERIODS.map((period) => (
                                        <option key={period.key} value={period.key}>{period.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <label className="mt-3 block">
                            <span className="mb-1.5 block text-[10px] text-[#86868B]">마일스톤</span>
                            <select
                                value={form.milestonePeriod}
                                onChange={(event) => updateForm('milestonePeriod', event.target.value)}
                                className="h-9 w-full rounded-[7px] border border-[#444] bg-[#2b2b2a] px-2 text-[11px] text-white outline-none focus:border-[#60a5fa]"
                            >
                                <option value="">마일스톤 없음</option>
                                {IOTA_SCHEDULE_PERIODS.map((period) => (
                                    <option key={period.key} value={period.key}>{period.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="rounded-[12px] border border-[#3f4852] bg-[#252b31] p-4">
                        <label className="block">
                            <span className="mb-2 block text-[12px] font-bold text-[#c7c7c2]">진행상태</span>
                            <select
                                value={form.progressStatus}
                                onChange={(event) => updateForm('progressStatus', event.target.value)}
                                className="h-10 w-full rounded-[8px] border border-[#4b5661] bg-[#20252a] px-3 text-[12px] font-bold text-white outline-none focus:border-[#60a5fa]"
                            >
                                {PROGRESS_STATUS_OPTIONS.map((status) => (
                                    <option key={status.value} value={status.value}>{status.label}</option>
                                ))}
                            </select>
                        </label>
                        {form.progressStatus === 'completed' && (
                            <label className="mt-3 block">
                                <span className="mb-1.5 block text-[10px] text-[#a1a1aa]">실제 완료일</span>
                                <input
                                    type="date"
                                    value={form.actualCompletedDate}
                                    onChange={(event) => updateForm('actualCompletedDate', event.target.value)}
                                    className="h-9 w-full rounded-[7px] border border-[#4b5661] bg-[#20252a] px-3 text-[12px] text-white outline-none focus:border-[#60a5fa]"
                                />
                            </label>
                        )}
                    </div>

                    {errorMessage && (
                        <div className="rounded-[8px] border border-[#ff5f57]/40 bg-[#ff5f57]/10 px-3 py-2 text-[11px] font-bold text-[#ff7b74]">
                            {errorMessage}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 border-t border-[#3a3a3a] px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="h-10 flex-1 rounded-[8px] border border-[#444] text-[12px] font-bold text-[#a1a1aa] hover:bg-white/5 disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="h-10 flex-1 rounded-[8px] border border-[#1f6fb2] bg-[#2997ff] text-[12px] font-bold text-white hover:bg-[#3ba1ff] disabled:cursor-wait disabled:opacity-60"
                    >
                        {saving ? '저장 중' : '변경 저장'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
};

export default function PmoDetailedSchedule() {
    const { memberInfo } = useAuth();
    const [items, setItems] = useState(IOTA_DETAILED_SCHEDULE_FALLBACK);
    const [dataSource, setDataSource] = useState('fallback');
    const [loading, setLoading] = useState(true);
    const [todayMarker, setTodayMarker] = useState(getTodayScheduleMarker);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedLead, setSelectedLead] = useState('전체');
    const [selectedState, setSelectedState] = useState('전체');
    const [departments, setDepartments] = useState(DEFAULT_SCHEDULE_DEPARTMENTS);
    const [editingItem, setEditingItem] = useState(null);
    const [savingItem, setSavingItem] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [pmoTasks, setPmoTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [scheduleTaskLinks, setScheduleTaskLinks] = useState([]);
    const [linkingSourceKey, setLinkingSourceKey] = useState(null);
    const [linkBusy, setLinkBusy] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [linkDataVersion, setLinkDataVersion] = useState(0);
    const [embeddedTaskDetailOpen, setEmbeddedTaskDetailOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState(() => new Set(
        IOTA_DETAILED_SCHEDULE_FALLBACK
            .filter((item) => item.itemType !== 'task')
            .map((item) => item.sourceKey)
    ));
    const memberOrganization = getMemberIotaOrganization(memberInfo, '');
    const canEditSchedule = ['기획추진', '사업2파트'].includes(memberOrganization);

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setTodayMarker(getTodayScheduleMarker());
        }, 60 * 60 * 1000);
        return () => window.clearInterval(timerId);
    }, []);

    useEffect(() => {
        const syncEmbeddedTaskDetail = () => {
            const taskId = new URLSearchParams(window.location.search).get('taskId');
            setEmbeddedTaskDetailOpen(Boolean(taskId));
        };

        syncEmbeddedTaskDetail();
        window.addEventListener('popstate', syncEmbeddedTaskDetail);
        return () => window.removeEventListener('popstate', syncEmbeddedTaskDetail);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const loadSchedule = async () => {
            const { data, error } = await supabase
                .schema('iota_v2')
                .from('iota_schedule_items')
                .select(`
                    id,
                    source_key,
                    source_order,
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
                    progress_status,
                    actual_completed_date,
                    updated_by_name,
                    updated_at
                `)
                .eq('is_active', true)
                .order('source_order', { ascending: true });

            if (!isMounted) return;
            if (!error && data?.length) {
                const normalized = data.map(normalizeDbItem);
                setItems(normalized);
                setExpandedGroups(new Set(
                    normalized
                        .filter((item) => item.itemType !== 'task')
                        .map((item) => item.sourceKey)
                ));
                setDataSource('database');
            } else if (error) {
                console.warn('Detailed schedule DB load failed; using fallback data.', error);
            }
            setLoading(false);
        };

        loadSchedule();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const loadDepartments = async () => {
            const { data, error } = await supabase
                .schema('iota_v2')
                .from('iota_departments')
                .select('dept_code, dept_name')
                .order('dept_name', { ascending: true });

            if (!isMounted || error || !data?.length) return;
            const merged = [
                DEFAULT_SCHEDULE_DEPARTMENTS[0],
                DEFAULT_SCHEDULE_DEPARTMENTS[1],
                ...data
            ].filter((department, index, allDepartments) => (
                allDepartments.findIndex(
                    (candidate) => candidate.dept_code === department.dept_code
                ) === index
            ));
            setDepartments(merged);
        };

        loadDepartments();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const loadTaskLinkData = async () => {
            const [
                { data: taskRows, error: taskLoadError },
                { data: projectRows, error: projectLoadError },
                { data: linkRows, error: linkLoadError }
            ] = await Promise.all([
                supabase
                    .schema('iota_v2')
                    .from('iota_pmo_tasks')
                    .select(`
                        id,
                        project_code,
                        task_name,
                        task_purpose,
                        deliverables,
                        category_main,
                        lead_dept_code,
                        assignee,
                        due_date,
                        status,
                        priority_score,
                        task_type,
                        created_at,
                        lead_dept:iota_departments!lead_dept_code(dept_name)
                    `)
                    .neq('task_type', '팝업')
                    .order('created_at', { ascending: true })
                    .order('id', { ascending: true }),
                supabase
                    .schema('iota_v2')
                    .from('iota_projects')
                    .select('project_code, project_name')
                    .order('created_at', { ascending: true }),
                supabase
                    .schema('iota_v2')
                    .from('iota_schedule_task_links')
                    .select(`
                        id,
                        schedule_item_id,
                        task_id,
                        link_source,
                        linked_by_name,
                        created_at
                    `)
                    .order('created_at', { ascending: true })
            ]);

            if (!isMounted) return;
            if (taskLoadError) {
                console.warn('PMO task load for schedule linking failed.', taskLoadError);
                setPmoTasks([]);
            } else {
                setPmoTasks((taskRows || []).map((task, index) => ({
                    id: task.id,
                    displayId: `T-${String(index + 1).padStart(3, '0')}`,
                    projectCode: task.project_code,
                    taskName: task.task_name,
                    taskPurpose: task.task_purpose,
                    deliverables: task.deliverables,
                    categoryMain: task.category_main,
                    leadDeptCode: task.lead_dept_code,
                    leadDeptName: task.lead_dept?.dept_name || '',
                    assignee: task.assignee,
                    dueDate: task.due_date,
                    status: task.status,
                    priorityScore: task.priority_score,
                    createdAt: task.created_at
                })));
            }

            if (projectLoadError) {
                console.warn('PMO project load for schedule linking failed.', projectLoadError);
                setProjects([]);
            } else {
                setProjects(projectRows || []);
            }

            if (linkLoadError) {
                console.warn('Schedule task link load failed.', linkLoadError);
                setScheduleTaskLinks([]);
            } else {
                setScheduleTaskLinks((linkRows || []).map((link) => ({
                    id: link.id,
                    scheduleItemId: link.schedule_item_id,
                    taskId: link.task_id,
                    linkSource: link.link_source,
                    linkedByName: link.linked_by_name,
                    createdAt: link.created_at
                })));
            }
        };

        loadTaskLinkData();
        return () => {
            isMounted = false;
        };
    }, [linkDataVersion]);

    const itemMap = useMemo(
        () => new Map(items.map((item) => [item.sourceKey, item])),
        [items]
    );
    const summaries = useMemo(() => buildScheduleSummaries(items), [items]);
    const taskItems = useMemo(
        () => items.filter((item) => item.itemType === 'task'),
        [items]
    );
    const statistics = useMemo(() => ({
        total: taskItems.length,
        scheduled: taskItems.filter((item) => item.startPeriod && item.endPeriod).length,
        unscheduled: taskItems.filter((item) => !item.startPeriod || !item.endPeriod).length,
        milestones: items.filter((item) => item.milestonePeriod).length
    }), [items, taskItems]);

    const filterOptions = useMemo(() => ({
        category: [...new Set(items.map((item) => item.categoryMain).filter(Boolean))],
        lead: [...new Set(items
            .map((item) => item.leadLabel)
            .filter((value) => value && value !== '미정'))]
    }), [items]);

    const includedKeys = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const hasFilters = normalizedSearch
            || selectedCategory !== '전체'
            || selectedLead !== '전체'
            || selectedState !== '전체';

        if (!hasFilters) {
            return new Set(items.map((item) => item.sourceKey));
        }

        const included = new Set();
        const addWithAncestors = (item) => {
            included.add(item.sourceKey);
            getAncestors(item, itemMap).forEach((key) => included.add(key));
        };

        for (const item of items) {
            if (item.itemType !== 'task') continue;
            const searchable = [
                item.sourceKey,
                item.displayName,
                item.lv1,
                item.lv2,
                item.leadLabel,
                item.categoryMain
            ].filter(Boolean).join(' ').toLowerCase();
            const state = getScheduleState(item);
            const matches = (!normalizedSearch || searchable.includes(normalizedSearch))
                && (selectedCategory === '전체' || item.categoryMain === selectedCategory)
                && (selectedLead === '전체' || item.leadLabel === selectedLead)
                && (
                    selectedState === '전체'
                    || selectedState === state
                    || (selectedState === 'milestone' && Boolean(item.milestonePeriod))
                );
            if (matches) addWithAncestors(item);
        }

        for (const item of items) {
            if (item.itemType === 'task') continue;
            const searchable = [
                item.sourceKey,
                item.displayName,
                item.lv1,
                item.lv2,
                item.leadLabel,
                item.categoryMain
            ].filter(Boolean).join(' ').toLowerCase();
            const matchesCommonFilters = (!normalizedSearch || searchable.includes(normalizedSearch))
                && (selectedCategory === '전체' || item.categoryMain === selectedCategory)
                && (selectedLead === '전체' || item.leadLabel === selectedLead);
            const matchesSearchGroup = Boolean(normalizedSearch) && matchesCommonFilters;
            const matchesMilestoneGroup = selectedState === 'milestone'
                && Boolean(item.milestonePeriod)
                && matchesCommonFilters;
            if (matchesSearchGroup || matchesMilestoneGroup) {
                addWithAncestors(item);
                if (matchesSearchGroup) {
                    items
                        .filter((candidate) => getAncestors(candidate, itemMap).includes(item.sourceKey))
                        .forEach((candidate) => included.add(candidate.sourceKey));
                }
            }
        }

        return included;
    }, [
        itemMap,
        items,
        searchTerm,
        selectedCategory,
        selectedLead,
        selectedState
    ]);

    const visibleItems = useMemo(() => items.filter((item) => {
        if (!includedKeys.has(item.sourceKey)) return false;
        return getAncestors(item, itemMap).every((ancestorKey) => expandedGroups.has(ancestorKey));
    }), [expandedGroups, includedKeys, itemMap, items]);
    const linksByScheduleItemId = useMemo(() => {
        const grouped = new Map();
        for (const link of scheduleTaskLinks) {
            const itemLinks = grouped.get(link.scheduleItemId) || [];
            itemLinks.push(link);
            grouped.set(link.scheduleItemId, itemLinks);
        }
        return grouped;
    }, [scheduleTaskLinks]);
    const linkingItem = linkingSourceKey
        ? itemMap.get(linkingSourceKey)
        : null;
    const linkingItemLinks = linkingItem?.scheduleItemId
        ? linksByScheduleItemId.get(linkingItem.scheduleItemId) || []
        : [];

    const toggleGroup = (sourceKey) => {
        setExpandedGroups((current) => {
            const next = new Set(current);
            if (next.has(sourceKey)) next.delete(sourceKey);
            else next.add(sourceKey);
            return next;
        });
    };

    const openScheduleEditor = (item) => {
        if (!canEditSchedule || dataSource !== 'database' || item.itemType !== 'task') return;
        setSaveError('');
        setEditingItem(item);
    };

    const closeScheduleEditor = () => {
        if (savingItem) return;
        setSaveError('');
        setEditingItem(null);
    };

    const openTaskLinkModal = (item) => {
        if (dataSource !== 'database' || item.itemType !== 'task' || !item.scheduleItemId) return;
        setLinkError('');
        setLinkingSourceKey(item.sourceKey);
    };

    const closeTaskLinkModal = () => {
        if (linkBusy) return;
        setLinkError('');
        setLinkingSourceKey(null);
    };

    const openScheduleEditorFromTaskLink = () => {
        if (!linkingItem || !canEditSchedule) return;
        setLinkingSourceKey(null);
        openScheduleEditor(linkingItem);
    };

    const linkExistingTask = async (taskId) => {
        if (!canEditSchedule || !linkingItem?.scheduleItemId) return;
        setLinkBusy(true);
        setLinkError('');

        const { error } = await supabase
            .schema('iota_v2')
            .from('iota_schedule_task_links')
            .insert({
                schedule_item_id: linkingItem.scheduleItemId,
                task_id: taskId,
                link_source: 'existing'
            });

        if (error) {
            console.error('Schedule task link insert failed.', error);
            setLinkError(
                error.code === '23505'
                    ? '이미 연결된 통합업무입니다.'
                    : error.message || '통합업무를 연결하지 못했습니다.'
            );
            setLinkBusy(false);
            return;
        }

        setLinkDataVersion((current) => current + 1);
        setLinkBusy(false);
    };

    const unlinkTask = async (linkId) => {
        if (!canEditSchedule) return;
        setLinkBusy(true);
        setLinkError('');

        const { error } = await supabase
            .schema('iota_v2')
            .from('iota_schedule_task_links')
            .delete()
            .eq('id', linkId);

        if (error) {
            console.error('Schedule task unlink failed.', error);
            setLinkError(error.message || '통합업무 연결을 해제하지 못했습니다.');
            setLinkBusy(false);
            return;
        }

        setLinkDataVersion((current) => current + 1);
        setLinkBusy(false);
    };

    const createAndLinkTask = async (form) => {
        if (!canEditSchedule || !linkingItem?.scheduleItemId) return;
        setLinkBusy(true);
        setLinkError('');

        const { data: taskId, error } = await supabase
            .schema('iota_v2')
            .rpc('create_pmo_task_and_link_schedule', {
                p_schedule_item_id: linkingItem.scheduleItemId,
                p_project_code: form.projectCode,
                p_category_main: form.categoryMain,
                p_task_name: form.taskName,
                p_task_purpose: form.taskPurpose,
                p_deliverables: form.deliverables,
                p_target_axis: form.targetAxis,
                p_lead_dept_code: form.leadDeptCode || null,
                p_assignee: form.assignee,
                p_due_date: form.dueDate || null,
                p_status: form.status,
                p_importance_level: form.importanceLevel,
                p_is_blocker: form.isBlocker,
                p_needs_decision: form.needsDecision
            });

        if (error || !taskId) {
            console.error('PMO task create and schedule link failed.', error);
            setLinkError(error?.message || '새 통합업무를 등록하지 못했습니다.');
            setLinkBusy(false);
            return;
        }

        notifyMembersOnTaskCreation(
            taskId,
            form.taskName,
            {
                code: 'WS_PMO',
                label: '통합업무보드',
                orgNames: ['통합업무보드']
            },
            memberInfo?.email || ''
        );
        setLinkDataVersion((current) => current + 1);
        setLinkBusy(false);
        setLinkingSourceKey(null);
    };

    const openTaskDetail = useCallback((taskId) => {
        if (!taskId) return;
        const url = new URL(window.location.href);
        url.searchParams.set('taskId', taskId);
        const currentState = window.history.state && typeof window.history.state === 'object'
            ? window.history.state
            : {};
        window.history.pushState(
            { ...currentState, timelineTaskDetail: String(taskId) },
            '',
            `${url.pathname}${url.search}${url.hash}`
        );
        setEmbeddedTaskDetailOpen(true);
    }, []);

    const closeEmbeddedTaskDetail = useCallback(() => {
        const url = new URL(window.location.href);
        const currentTaskId = url.searchParams.get('taskId');
        const currentState = window.history.state && typeof window.history.state === 'object'
            ? window.history.state
            : {};

        if (currentTaskId && currentState.timelineTaskDetail === currentTaskId) {
            window.history.back();
            return;
        }

        url.searchParams.delete('taskId');
        const nextState = { ...currentState };
        delete nextState.timelineTaskDetail;
        window.history.replaceState(
            nextState,
            '',
            `${url.pathname}${url.search}${url.hash}`
        );
        setEmbeddedTaskDetailOpen(false);
    }, []);

    const saveScheduleItem = async (form) => {
        const displayName = form.displayName.trim();
        const categoryMain = form.categoryMain.trim();
        const hasStart = Boolean(form.startPeriod);
        const hasEnd = Boolean(form.endPeriod);
        if (!displayName || !categoryMain) {
            setSaveError('업무명과 업무분류를 입력해 주세요.');
            return;
        }
        if (hasStart !== hasEnd) {
            setSaveError('시작 주차와 종료 주차는 함께 설정하거나 함께 비워야 합니다.');
            return;
        }
        if (
            hasStart
            && PERIOD_INDEX.get(form.startPeriod) > PERIOD_INDEX.get(form.endPeriod)
        ) {
            setSaveError('종료 주차는 시작 주차보다 빠를 수 없습니다.');
            return;
        }

        setSavingItem(true);
        setSaveError('');
        const payload = {
            task_name: displayName,
            display_name: displayName,
            lead_dept_code: form.leadDeptCode,
            lead_label: form.leadLabel,
            category_main: categoryMain,
            start_period: form.startPeriod || null,
            end_period: form.endPeriod || null,
            milestone_period: form.milestonePeriod || null,
            progress_status: form.progressStatus,
            actual_completed_date: form.progressStatus === 'completed'
                ? form.actualCompletedDate || null
                : null
        };

        const { data, error } = await supabase
            .schema('iota_v2')
            .from('iota_schedule_items')
            .update(payload)
            .eq('source_key', editingItem.sourceKey)
            .eq('item_type', 'task')
            .select(`
                id,
                source_key,
                source_order,
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
                progress_status,
                actual_completed_date,
                updated_by_name,
                updated_at
            `)
            .single();

        if (error || !data) {
            console.error('Schedule item update failed.', error);
            setSaveError(error?.message || '일정 변경사항을 저장하지 못했습니다.');
            setSavingItem(false);
            return;
        }

        const normalizedItem = normalizeDbItem(data);
        setItems((current) => current.map((item) => (
            item.sourceKey === normalizedItem.sourceKey ? normalizedItem : item
        )));
        setSavingItem(false);
        setEditingItem(null);
    };

    const handleScheduleWheel = (event) => {
        const scrollContainer = event.currentTarget;
        const atTop = scrollContainer.scrollTop <= 0;
        const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight
            >= scrollContainer.scrollHeight - 1;
        const shouldContinuePageScroll = (event.deltaY < 0 && atTop)
            || (event.deltaY > 0 && atBottom);

        if (shouldContinuePageScroll) {
            event.preventDefault();
            let pageScrollContainer = scrollContainer.parentElement;
            while (pageScrollContainer) {
                const style = window.getComputedStyle(pageScrollContainer);
                const canScrollVertically = /(auto|scroll)/.test(style.overflowY)
                    && pageScrollContainer.scrollHeight > pageScrollContainer.clientHeight;
                if (canScrollVertically) break;
                pageScrollContainer = pageScrollContainer.parentElement;
            }

            if (pageScrollContainer) pageScrollContainer.scrollBy(0, event.deltaY);
            else window.scrollBy(0, event.deltaY);
        }
    };

    return (
        <section className="w-full overflow-hidden rounded-[32px] border border-[#3c3c3c] bg-[#272726] shadow-sm">
            <div className="border-b border-[#3c3c3c] bg-[#242423] px-5 py-4">
                <div className="flex items-center justify-between gap-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <h2 className="shrink-0 text-[17px] font-bold text-white">2026 통합 상세 일정</h2>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            dataSource === 'database'
                                ? 'border-[#2997ff]/30 bg-[#2997ff]/10 text-[#60a5fa]'
                                : 'border-[#555]/60 bg-white/[0.04] text-[#a1a1aa]'
                        }`}>
                            {loading ? '불러오는 중' : dataSource === 'database' ? 'DB 일정 원장' : '기본 일정 데이터'}
                        </span>
                        <p className="truncate text-[12px] text-[#86868B]">
                            대분류·중분류를 펼쳐 세부업무의 주차별 수행기간과 마일스톤을 확인합니다.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <SelectControl
                            label="대분류"
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            options={[
                                { value: '전체', label: '대분류 전체' },
                                ...filterOptions.category.map((value) => ({ value, label: value }))
                            ]}
                        />
                        <SelectControl
                            label="주관"
                            value={selectedLead}
                            onChange={setSelectedLead}
                            options={[
                                { value: '전체', label: '주관 전체' },
                                ...filterOptions.lead.map((value) => ({ value, label: value }))
                            ]}
                        />
                        <SelectControl
                            label="일정 상태"
                            value={selectedState}
                            onChange={setSelectedState}
                            options={[
                                { value: '전체', label: '일정 전체' },
                                { value: 'scheduled', label: '일정 등록' },
                                { value: 'unscheduled', label: '일정 미정' },
                                { value: 'milestone', label: '마일스톤' }
                            ]}
                        />
                    </div>
                </div>

                <div className="mt-[10px] flex items-stretch gap-2">
                    {[
                        ['전체 세부업무', statistics.total, '#E5E5E5', '전체'],
                        ['일정 등록', statistics.scheduled, '#60a5fa', 'scheduled'],
                        ['일정 미정', statistics.unscheduled, '#ff5f57', 'unscheduled'],
                        ['마일스톤', statistics.milestones, '#F59E0B', 'milestone']
                    ].map(([label, value, color, stateValue]) => (
                        <button
                            type="button"
                            key={label}
                            onClick={() => setSelectedState(stateValue)}
                            aria-pressed={selectedState === stateValue}
                            className={`flex h-[46px] shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-[10px] border px-2.5 text-left transition-colors ${
                                selectedState === stateValue
                                    ? 'border-[#60a5fa] bg-[#334155]'
                                    : 'border-[#363636] bg-[#2b2b2a] hover:border-[#505050] hover:bg-[#323231]'
                            }`}
                            style={{ width: 'max(112px, calc((100% - 32px) / 5.6 - 150px))' }}
                        >
                            <div className="text-[12px] font-bold text-[#86868B]">{label}</div>
                            <div className="text-[22px] font-bold" style={{ color }}>{value}</div>
                        </button>
                    ))}
                    <div className="relative h-[46px] min-w-[280px] flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[22px] font-bold text-[#86868B]">⌕</span>
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="일정·업무·주관 검색"
                            className="h-full w-full rounded-[8px] border border-[#3c3c3c] bg-[#2c2c2b] pl-10 pr-3 text-[13px] text-white outline-none placeholder:text-[#68686d] focus:border-[#2997ff]"
                        />
                    </div>
                </div>
            </div>

            <div
                data-schedule-scroll
                className="timeline-scrollbar max-h-[calc(100vh-250px)] w-full overflow-auto"
                onWheel={handleScheduleWheel}
            >
                <div className="relative w-[1602px] min-w-[1602px]">
                {todayMarker && (
                    <div className="pointer-events-none sticky top-0 z-[40] -mb-[58px] h-[58px]">
                        <div
                            className="absolute top-[4px] flex h-[22px] -translate-x-1/2 items-center whitespace-nowrap rounded-[5px] border border-[#fbbf24]/70 bg-[#F59E0B] px-2 text-[10px] font-black tracking-[-0.02em] text-[#1c1c1e] shadow-[0_2px_8px_rgba(245,158,11,0.3)]"
                            style={{ left: `${todayMarker.left}px` }}
                        >
                            {todayMarker.dateLabel}
                        </div>
                        <div
                            aria-hidden="true"
                            className="absolute top-[25px] h-[33px] -translate-x-1/2"
                            style={{ left: `${todayMarker.left}px` }}
                        >
                            <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#F59E0B]/80 shadow-[0_0_5px_rgba(245,158,11,0.3)]" />
                        </div>
                    </div>
                )}
                <table className="w-full table-fixed border-collapse text-left">
                    <thead className="sticky top-0 z-20 bg-[#242423] shadow-[0_1px_0_#464646]">
                        <tr className="h-[30px] border-b border-[#3c3c3c] bg-[#242423]">
                            <th
                                rowSpan={2}
                                className="sticky left-0 z-30 w-[450px] min-w-[450px] bg-[#242423] px-4 text-[12px] font-bold text-[#86868B] shadow-[inset_-1px_0_0_#464646]"
                            >
                                업무명 / 주관 조직 / 기간
                            </th>
                            {[7, 8, 9, 10, 11, 12].map((month) => (
                                <th
                                    key={month}
                                    colSpan={4}
                                    className="bg-[#242423] text-center text-[11px] font-bold text-[#bdbba7] shadow-[inset_-1px_0_0_#505050]"
                                >
                                    {month}월
                                </th>
                            ))}
                        </tr>
                        <tr className="h-[28px] bg-[#292928]">
                            {IOTA_SCHEDULE_PERIODS.map((period, index) => (
                                <th
                                    key={period.key}
                                    title={period.label}
                                    className={`w-[48px] min-w-[48px] bg-[#292928] text-center text-[10px] font-bold text-[#86868B] ${
                                        (index + 1) % 4 === 0
                                            ? 'shadow-[inset_-1px_0_0_#505050]'
                                            : 'shadow-[inset_-1px_0_0_#3a3a3a]'
                                    }`}
                                >
                                    {period.weekLabel}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleItems.map((item) => {
                            const depth = getDepth(item);
                            const isGroup = item.itemType !== 'task';
                            const isExpanded = expandedGroups.has(item.sourceKey);
                            const summary = summaries.get(item.sourceKey) || {};
                            const startIndex = item.startPeriod
                                ? PERIOD_INDEX.get(item.startPeriod)
                                : summary.startIndex;
                            const endIndex = item.endPeriod
                                ? PERIOD_INDEX.get(item.endPeriod)
                                : summary.endIndex;
                            const state = getScheduleState(item);
                            const progressStatus = item.progressStatus || DEFAULT_PROGRESS_STATUS;
                            const scheduleAttention = getScheduleAttention(
                                item,
                                todayMarker?.periodIndex
                            );
                            const attentionAnimationClass = scheduleAttention === 'overdue'
                                ? 'schedule-attention-overdue'
                                : scheduleAttention === 'due_this_week'
                                    ? 'schedule-attention-due'
                                    : '';
                            const attentionTitleClass = scheduleAttention === 'overdue'
                                ? 'schedule-attention-title-overdue'
                                : scheduleAttention === 'due_this_week'
                                    ? 'schedule-attention-title-due'
                                    : '';
                            const itemLinks = item.scheduleItemId
                                ? linksByScheduleItemId.get(item.scheduleItemId) || []
                                : [];
                            const canOpenTaskLink = dataSource === 'database'
                                && item.itemType === 'task'
                                && Boolean(item.scheduleItemId);
                            const hasSchedule = startIndex !== null && startIndex !== undefined;
                            const periodLabel = !hasSchedule
                                ? isGroup ? '' : '일정 미정'
                                : startIndex === endIndex
                                    ? IOTA_SCHEDULE_PERIODS[startIndex]?.label
                                    : `${IOTA_SCHEDULE_PERIODS[startIndex]?.label} ~ ${IOTA_SCHEDULE_PERIODS[endIndex]?.label}`;
                            const isLeadUnassigned = !item.leadLabel || item.leadLabel === '미정';
                            const showLead = !isGroup || !isLeadUnassigned;

                            return (
                                <tr
                                    key={item.sourceKey}
                                    onClick={() => {
                                        if (canOpenTaskLink) openTaskLinkModal(item);
                                    }}
                                    data-task-link-source={canOpenTaskLink ? item.sourceKey : undefined}
                                    className={`group h-[48px] border-b border-[#393939] ${attentionAnimationClass} ${
                                        canOpenTaskLink ? 'cursor-pointer' : ''
                                    } ${
                                        item.itemType === 'lv1'
                                            ? 'bg-[#2c3440] hover:bg-[#343e4d]'
                                            : item.itemType === 'lv2'
                                                ? 'bg-[#2d2d2c] hover:bg-[#363635]'
                                                : scheduleAttention === 'overdue'
                                                    ? 'bg-[#3a2525] hover:bg-[#482c2c]'
                                                    : scheduleAttention === 'due_this_week'
                                                        ? 'bg-[#393020] hover:bg-[#453923]'
                                                        : state === 'unscheduled'
                                                            ? 'bg-[#342727] hover:bg-[#422e2e]'
                                                            : 'bg-[#272726] hover:bg-[#30302f]'
                                    }`}
                                >
                                    <td className={`sticky left-0 z-10 w-[450px] min-w-[450px] px-3 shadow-[inset_-1px_0_0_#464646] ${attentionAnimationClass} ${
                                        item.itemType === 'lv1'
                                            ? 'bg-[#2c3440] group-hover:bg-[#343e4d]'
                                            : item.itemType === 'lv2'
                                                ? 'bg-[#2d2d2c] group-hover:bg-[#363635]'
                                                : scheduleAttention === 'overdue'
                                                    ? 'bg-[#3a2525] group-hover:bg-[#482c2c]'
                                                    : scheduleAttention === 'due_this_week'
                                                        ? 'bg-[#393020] group-hover:bg-[#453923]'
                                                        : state === 'unscheduled'
                                                            ? 'bg-[#342727] group-hover:bg-[#422e2e]'
                                                            : 'bg-[#272726] group-hover:bg-[#30302f]'
                                    }`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div
                                                className="min-w-0 flex-1"
                                                style={{ paddingLeft: `${depth * 18}px` }}
                                            >
                                                <div className="flex min-w-0 items-center gap-2">
                                                    {isGroup ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleGroup(item.sourceKey)}
                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] text-[#a1a1aa] hover:bg-white/10 hover:text-white"
                                                            aria-label={`${item.displayName} ${isExpanded ? '접기' : '펼치기'}`}
                                                        >
                                                            {isExpanded ? '▼' : '▶'}
                                                        </button>
                                                    ) : (
                                                        <span className="w-5 shrink-0 text-center font-mono text-[8px] text-[#666]">•</span>
                                                    )}
                                                    <span className={`truncate ${attentionTitleClass} ${
                                                        item.itemType === 'lv1'
                                                            ? 'text-[14px] font-bold text-white'
                                                            : item.itemType === 'lv2'
                                                                ? 'text-[13px] font-bold text-[#E5E5E5]'
                                                                : scheduleAttention === 'overdue'
                                                                    ? 'text-[13px] font-bold text-[#ff7169]'
                                                                    : scheduleAttention === 'due_this_week'
                                                                        ? 'text-[13px] font-bold text-[#f6ad3c]'
                                                                        : 'text-[13px] font-medium text-[#c7c7c2]'
                                                    }`}>
                                                        {item.displayName}
                                                    </span>
                                                    {item.itemType === 'task' && (
                                                        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${
                                                            PROGRESS_STATUS_STYLES[progressStatus]
                                                            || PROGRESS_STATUS_STYLES.not_started
                                                        }`}>
                                                            {getProgressStatusLabel(progressStatus)}
                                                        </span>
                                                    )}
                                                    {itemLinks.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openTaskLinkModal(item);
                                                            }}
                                                            className="shrink-0 rounded-full border border-[#30d158]/35 bg-[#30d158]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#4ade80]"
                                                        >
                                                            연결 {itemLinks.length}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="mt-0 flex items-center gap-2 pl-7 text-[10px] text-[#86868B]">
                                                    {showLead && (
                                                        <span className={isLeadUnassigned ? 'font-bold text-[#ff5f57]' : ''}>
                                                            {isLeadUnassigned ? '주관부서미정' : item.leadLabel}
                                                        </span>
                                                    )}
                                                    <span>{item.categoryMain}</span>
                                                    {isGroup && (
                                                        <>
                                                            <span className="text-[#4f4f52]">·</span>
                                                            <span>일정 {summary.scheduledTaskCount || 0}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-[108px] shrink-0 text-right">
                                                <div className={`text-[10px] font-bold ${
                                                    state === 'milestone'
                                                        ? 'text-[#F59E0B]'
                                                        : !hasSchedule
                                                            ? 'text-[#ff5f57]'
                                                            : 'text-[#60a5fa]'
                                                }`}>
                                                    {periodLabel}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {IOTA_SCHEDULE_PERIODS.map((period, periodIndex) => {
                                        const inRange = startIndex !== null
                                            && startIndex !== undefined
                                            && endIndex !== null
                                            && endIndex !== undefined
                                            && periodIndex >= startIndex
                                            && periodIndex <= endIndex;
                                        const isStart = inRange && periodIndex === startIndex;
                                        const isEnd = inRange && periodIndex === endIndex;
                                        const isMilestone = item.milestonePeriod === period.key;
                                        return (
                                            <td
                                                key={period.key}
                                                className={`relative h-[48px] w-[48px] min-w-[48px] ${
                                                    (periodIndex + 1) % 4 === 0
                                                        ? 'shadow-[inset_-1px_0_0_#505050]'
                                                        : 'shadow-[inset_-1px_0_0_#383838]'
                                                }`}
                                            >
                                                {inRange && (
                                                    <div
                                                        className={`absolute left-0 right-0 top-1/2 h-[12px] -translate-y-1/2 ${
                                                            isGroup ? 'bg-[#5279a5]/55' : 'bg-[#2997ff]/70'
                                                        } ${isStart ? 'rounded-l-full' : ''} ${isEnd ? 'rounded-r-full' : ''}`}
                                                    />
                                                )}
                                                {isMilestone && (
                                                    <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[20px] font-black leading-none text-[#F59E0B] drop-shadow-[0_0_5px_rgba(245,158,11,0.45)]">
                                                        ◆
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {todayMarker && (
                    <div
                        aria-hidden="true"
                        data-current-date={todayMarker.isoDate}
                        className="pointer-events-none absolute bottom-0 top-[58px] z-[5] -translate-x-1/2"
                        style={{ left: `${todayMarker.left}px` }}
                    >
                        <div className="absolute inset-y-0 left-1/2 w-[5px] -translate-x-1/2 bg-[#F59E0B]/10" />
                        <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#F59E0B]/80 shadow-[0_0_5px_rgba(245,158,11,0.3)]" />
                    </div>
                )}
                </div>
            </div>

            {!visibleItems.length && (
                <div className="flex h-[120px] items-center justify-center text-[13px] text-[#86868B]">
                    조건에 맞는 일정이 없습니다.
                </div>
            )}

            {editingItem && (
                <ScheduleEditModal
                    key={editingItem.sourceKey}
                    item={editingItem}
                    departments={departments}
                    categories={filterOptions.category}
                    saving={savingItem}
                    errorMessage={saveError}
                    onClose={closeScheduleEditor}
                    onSave={saveScheduleItem}
                />
            )}

            {linkingItem && (
                <PmoScheduleTaskLinkModal
                    item={linkingItem}
                    tasks={pmoTasks}
                    links={linkingItemLinks}
                    projects={projects}
                    departments={departments}
                    canManage={canEditSchedule}
                    busy={linkBusy}
                    errorMessage={linkError}
                    onClose={closeTaskLinkModal}
                    onLink={linkExistingTask}
                    onUnlink={unlinkTask}
                    onCreateTask={createAndLinkTask}
                    onEditSchedule={openScheduleEditorFromTaskLink}
                    onOpenTask={openTaskDetail}
                />
            )}

            {embeddedTaskDetailOpen && createPortal(
                <PmoTaskBoardStaging
                    embeddedDetailOnly
                    onEmbeddedDetailClose={closeEmbeddedTaskDetail}
                />,
                document.body
            )}
        </section>
    );
}
