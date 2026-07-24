import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import {
    IOTA_DETAILED_SCHEDULE_FALLBACK,
    IOTA_SCHEDULE_PERIODS
} from '../../../data/iotaDetailedSchedule';

const PERIOD_INDEX = new Map(
    IOTA_SCHEDULE_PERIODS.map((period, index) => [period.key, index])
);

const normalizeDbItem = (item) => ({
    sourceKey: item.source_key,
    sourceOrder: item.source_order,
    sourceRow: item.source_row,
    itemType: item.item_type,
    parentSourceKey: item.parent_source_key,
    lv1: item.lv1,
    lv2: item.lv2,
    taskName: item.task_name,
    displayName: item.display_name,
    leadDeptCode: item.lead_dept_code,
    leadLabel: item.lead_label || '미정',
    categoryMain: item.category_main,
    startPeriod: item.start_period,
    endPeriod: item.end_period,
    milestonePeriod: item.milestone_period,
    managementNote: item.management_note,
    boardLinkState: item.board_link_state,
    linkedTaskId: item.linked_task_id
});

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

export default function PmoDetailedSchedule() {
    const [items, setItems] = useState(IOTA_DETAILED_SCHEDULE_FALLBACK);
    const [dataSource, setDataSource] = useState('fallback');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLv1, setSelectedLv1] = useState('전체');
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedLead, setSelectedLead] = useState('전체');
    const [selectedState, setSelectedState] = useState('전체');
    const [expandedGroups, setExpandedGroups] = useState(() => new Set(
        IOTA_DETAILED_SCHEDULE_FALLBACK
            .filter((item) => item.itemType !== 'task')
            .map((item) => item.sourceKey)
    ));

    useEffect(() => {
        let isMounted = true;
        const loadSchedule = async () => {
            const { data, error } = await supabase
                .schema('iota_v2')
                .from('iota_schedule_items')
                .select(`
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
                    linked_task_id
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
        lv1: [...new Set(items.map((item) => item.lv1).filter(Boolean))],
        category: [...new Set(items.map((item) => item.categoryMain).filter(Boolean))],
        lead: [...new Set(items.map((item) => item.leadLabel).filter(Boolean))]
    }), [items]);

    const includedKeys = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const hasFilters = normalizedSearch
            || selectedLv1 !== '전체'
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
                && (selectedLv1 === '전체' || item.lv1 === selectedLv1)
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
                && (selectedLv1 === '전체' || item.lv1 === selectedLv1)
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
        selectedLv1,
        selectedState
    ]);

    const visibleItems = useMemo(() => items.filter((item) => {
        if (!includedKeys.has(item.sourceKey)) return false;
        return getAncestors(item, itemMap).every((ancestorKey) => expandedGroups.has(ancestorKey));
    }), [expandedGroups, includedKeys, itemMap, items]);

    const toggleGroup = (sourceKey) => {
        setExpandedGroups((current) => {
            const next = new Set(current);
            if (next.has(sourceKey)) next.delete(sourceKey);
            else next.add(sourceKey);
            return next;
        });
    };

    const expandAll = () => setExpandedGroups(new Set(
        items.filter((item) => item.itemType !== 'task').map((item) => item.sourceKey)
    ));
    const collapseDetails = () => setExpandedGroups(new Set(
        items.filter((item) => item.itemType === 'lv1').map((item) => item.sourceKey)
    ));

    return (
        <section className="w-full overflow-hidden rounded-[32px] border border-[#3c3c3c] bg-[#272726] shadow-sm">
            <div className="border-b border-[#3c3c3c] bg-[#242423] px-5 py-4">
                <div className="flex items-start justify-between gap-5">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-[17px] font-bold text-white">2026 통합 상세 일정</h2>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                dataSource === 'database'
                                    ? 'border-[#2997ff]/30 bg-[#2997ff]/10 text-[#60a5fa]'
                                    : 'border-[#555]/60 bg-white/[0.04] text-[#a1a1aa]'
                            }`}>
                                {loading ? '불러오는 중' : dataSource === 'database' ? 'DB 일정 원장' : '기본 일정 데이터'}
                            </span>
                        </div>
                        <p className="mt-1 text-[12px] text-[#86868B]">
                            대분류·중분류를 펼쳐 세부업무의 주차별 수행기간과 마일스톤을 확인합니다.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={collapseDetails}
                            className="h-[32px] rounded-[8px] border border-[#3c3c3c] bg-[#2c2c2b] px-3 text-[11px] font-bold text-[#a1a1aa] transition-colors hover:text-white"
                        >
                            세부 접기
                        </button>
                        <button
                            type="button"
                            onClick={expandAll}
                            className="h-[32px] rounded-[8px] border border-[#3c3c3c] bg-[#2c2c2b] px-3 text-[11px] font-bold text-[#a1a1aa] transition-colors hover:text-white"
                        >
                            모두 펼치기
                        </button>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                    {[
                        ['전체 세부업무', statistics.total, '#E5E5E5'],
                        ['일정 등록', statistics.scheduled, '#60a5fa'],
                        ['일정 미정', statistics.unscheduled, '#a1a1aa'],
                        ['마일스톤', statistics.milestones, '#F59E0B']
                    ].map(([label, value, color]) => (
                        <div key={label} className="rounded-[10px] border border-[#363636] bg-[#2b2b2a] px-3 py-2">
                            <div className="text-[10px] font-bold text-[#86868B]">{label}</div>
                            <div className="mt-0.5 text-[18px] font-bold" style={{ color }}>{value}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-3 flex items-center gap-2">
                    <div className="relative h-[34px] min-w-[220px] flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#86868B]">⌕</span>
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="일정·업무·주관 검색"
                            className="h-full w-full rounded-[8px] border border-[#3c3c3c] bg-[#2c2c2b] pl-8 pr-3 text-[12px] text-white outline-none placeholder:text-[#68686d] focus:border-[#2997ff]"
                        />
                    </div>
                    <SelectControl
                        label="대분류"
                        value={selectedLv1}
                        onChange={setSelectedLv1}
                        options={[
                            { value: '전체', label: '대분류 전체' },
                            ...filterOptions.lv1.map((value) => ({ value, label: value }))
                        ]}
                    />
                    <SelectControl
                        label="연동분류"
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        options={[
                            { value: '전체', label: '연동분류 전체' },
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

            <div className="timeline-scrollbar w-full overflow-x-auto">
                <table className="w-[1616px] min-w-[1616px] table-fixed border-collapse text-left">
                    <thead className="sticky top-0 z-20">
                        <tr className="h-[30px] border-b border-[#3c3c3c] bg-[#242423]">
                            <th
                                rowSpan={2}
                                className="sticky left-0 z-30 w-[464px] min-w-[464px] border-r border-[#464646] bg-[#242423] px-4 text-[11px] font-bold text-[#86868B]"
                            >
                                일정 계층 / 주관 / 기간
                            </th>
                            {[7, 8, 9, 10, 11, 12].map((month) => (
                                <th
                                    key={month}
                                    colSpan={4}
                                    className="border-r border-[#505050] text-center text-[11px] font-bold text-[#bdbba7]"
                                >
                                    {month}월
                                </th>
                            ))}
                        </tr>
                        <tr className="h-[28px] border-b border-[#464646] bg-[#292928]">
                            {IOTA_SCHEDULE_PERIODS.map((period, index) => (
                                <th
                                    key={period.key}
                                    className={`w-[48px] min-w-[48px] text-center text-[10px] font-bold text-[#86868B] ${
                                        (index + 1) % 4 === 0
                                            ? 'border-r border-[#505050]'
                                            : 'border-r border-[#3a3a3a]'
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
                            const periodLabel = startIndex === null || startIndex === undefined
                                ? '일정 미정'
                                : startIndex === endIndex
                                    ? IOTA_SCHEDULE_PERIODS[startIndex]?.label
                                    : `${IOTA_SCHEDULE_PERIODS[startIndex]?.label} ~ ${IOTA_SCHEDULE_PERIODS[endIndex]?.label}`;

                            return (
                                <tr
                                    key={item.sourceKey}
                                    className={`h-[48px] border-b border-[#393939] ${
                                        item.itemType === 'lv1'
                                            ? 'bg-[#2c3440]'
                                            : item.itemType === 'lv2'
                                                ? 'bg-[#2d2d2c]'
                                                : 'bg-[#272726] hover:bg-[#30302f]'
                                    }`}
                                >
                                    <td className={`sticky left-0 z-10 w-[464px] min-w-[464px] border-r border-[#464646] px-3 ${
                                        item.itemType === 'lv1'
                                            ? 'bg-[#2c3440]'
                                            : item.itemType === 'lv2'
                                                ? 'bg-[#2d2d2c]'
                                                : 'bg-[#272726]'
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
                                                    <span className={`truncate ${
                                                        item.itemType === 'lv1'
                                                            ? 'text-[13px] font-bold text-white'
                                                            : item.itemType === 'lv2'
                                                                ? 'text-[12px] font-bold text-[#E5E5E5]'
                                                                : 'text-[12px] font-medium text-[#c7c7c2]'
                                                    }`}>
                                                        {item.displayName}
                                                    </span>
                                                    <span className="shrink-0 font-mono text-[9px] text-[#68686d]">
                                                        {item.sourceKey}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 pl-7 text-[10px] text-[#86868B]">
                                                    <span>{item.leadLabel || '미정'}</span>
                                                    <span className="text-[#4f4f52]">·</span>
                                                    <span>{item.categoryMain}</span>
                                                    {isGroup && (
                                                        <>
                                                            <span className="text-[#4f4f52]">·</span>
                                                            <span>
                                                                일정 {summary.scheduledTaskCount || 0}
                                                                {summary.unscheduledTaskCount ? ` / 미정 ${summary.unscheduledTaskCount}` : ''}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-[122px] shrink-0 text-right">
                                                <div className={`text-[10px] font-bold ${
                                                    state === 'milestone'
                                                        ? 'text-[#F59E0B]'
                                                        : startIndex === null || startIndex === undefined
                                                            ? 'text-[#6e6e73]'
                                                            : 'text-[#60a5fa]'
                                                }`}>
                                                    {periodLabel}
                                                </div>
                                                {item.linkedTaskId && (
                                                    <div className="mt-0.5 text-[9px] text-[#34c759]">업무판 연결</div>
                                                )}
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
                                                        ? 'border-r border-[#505050]'
                                                        : 'border-r border-[#383838]'
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
            </div>

            {!visibleItems.length && (
                <div className="flex h-[120px] items-center justify-center text-[13px] text-[#86868B]">
                    조건에 맞는 일정이 없습니다.
                </div>
            )}
        </section>
    );
}
