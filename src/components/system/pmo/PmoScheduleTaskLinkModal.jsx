import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const PROJECT_LABELS = {
    IOTA_SEOUL: 'IOTA 공통',
    PFV_427: '427 PFV',
    PFV_816: '816 PFV',
    FUND_421: '421 Fund',
    EXTERNAL: '외부'
};

const CATEGORY_OPTIONS = [
    '공통 PMO',
    '인허가',
    '호텔/운영',
    '시공/원가',
    '도면/설계',
    '인테리어/TI',
    '임차/마케팅',
    'PF/금융',
    '구조/법무/세무',
    '주주/보고',
    '준공/담보대출'
];

const TARGET_AXIS_OPTIONS = [
    'PF',
    '착공',
    '공사관리',
    '준공/사용승인',
    '담보대출/Take-out',
    '운영전환',
    '공통 PMO'
];

const STATUS_OPTIONS = ['미착수', '진행중', '검토중', '대기', '지연', '완료', '보류', '중단'];
const IMPORTANCE_OPTIONS = ['PF필수', '준공필수', '높음', '중간', '낮음'];
const INACTIVE_STATUSES = new Set(['완료', '중단']);
const TOKEN_STOP_WORDS = new Set([
    '업무',
    '관련',
    '검토',
    '확정',
    '협의',
    '계획',
    '수립',
    '반영',
    '진행',
    '관리',
    '및',
    '대한',
    '위한',
    '서울',
    '이오타'
]);

const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getTokens = (value) => normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 2 && !TOKEN_STOP_WORDS.has(token));

const inferProjectCode = (item) => {
    const text = normalizeText([
        item?.displayName,
        item?.taskName,
        item?.lv1,
        item?.lv2
    ].filter(Boolean).join(' '));
    const has427 = text.includes('427');
    const has816 = text.includes('816');
    if (has427 && !has816) return 'PFV_427';
    if (has816 && !has427) return 'PFV_816';
    return 'IOTA_SEOUL';
};

const inferTargetAxis = (category) => {
    if (category === '공통 PMO') return '공통 PMO';
    if (category === '인허가') return '준공/사용승인';
    if (category === '시공/원가' || category === '도면/설계' || category === '인테리어/TI') {
        return '착공';
    }
    if (category === '준공/담보대출') return '담보대출/Take-out';
    if (category === '호텔/운영') return '운영전환';
    return 'PF';
};

const mapProgressStatus = (status) => {
    if (status === 'in_progress') return '진행중';
    if (status === 'completed') return '완료';
    if (status === 'on_hold') return '보류';
    return '미착수';
};

const buildInitialForm = (item, validDepartmentCodes) => {
    const categoryMain = CATEGORY_OPTIONS.includes(item?.categoryMain)
        ? item.categoryMain
        : '공통 PMO';
    const leadDeptCode = validDepartmentCodes.has(item?.leadDeptCode)
        ? item.leadDeptCode
        : '';

    return {
        projectCode: inferProjectCode(item),
        categoryMain,
        taskName: item?.displayName || item?.taskName || '',
        taskPurpose: '',
        deliverables: '',
        targetAxis: inferTargetAxis(categoryMain),
        leadDeptCode,
        assignee: '',
        dueDate: '',
        status: mapProgressStatus(item?.progressStatus),
        importanceLevel: '중간',
        isBlocker: false,
        needsDecision: false
    };
};

const getTaskSearchText = (task) => normalizeText([
    task.displayId,
    task.projectCode,
    PROJECT_LABELS[task.projectCode],
    task.taskName,
    task.taskPurpose,
    task.deliverables,
    task.categoryMain,
    task.leadDeptName,
    task.assignee
].filter(Boolean).join(' '));

const getRecommendation = (item, task) => {
    const referenceText = [
        item.displayName,
        item.taskName,
        item.lv1,
        item.lv2,
        item.categoryMain
    ].filter(Boolean).join(' ');
    const taskText = [
        task.taskName,
        task.taskPurpose,
        task.deliverables,
        task.categoryMain
    ].filter(Boolean).join(' ');
    const referenceTokens = new Set(getTokens(referenceText));
    const taskTokens = new Set(getTokens(taskText));
    const sharedTokens = [...referenceTokens].filter((token) => taskTokens.has(token));
    const reasons = [];
    let score = 0;

    if (item.categoryMain && item.categoryMain === task.categoryMain) {
        score += 36;
        reasons.push('업무분류 일치');
    }
    if (item.leadDeptCode && item.leadDeptCode === task.leadDeptCode) {
        score += 32;
        reasons.push('실행주관 일치');
    }

    const inferredProjectCode = inferProjectCode(item);
    if (inferredProjectCode !== 'IOTA_SEOUL' && inferredProjectCode === task.projectCode) {
        score += 22;
        reasons.push('프로젝트 일치');
    }

    const itemTitle = normalizeText(item.displayName || item.taskName);
    const taskTitle = normalizeText(task.taskName);
    if (itemTitle && taskTitle && (itemTitle.includes(taskTitle) || taskTitle.includes(itemTitle))) {
        score += 38;
        reasons.push('업무명 직접 연관');
    } else if (sharedTokens.length) {
        score += Math.min(32, sharedTokens.length * 8);
        reasons.push(`핵심어 일치: ${sharedTokens.slice(0, 3).join(', ')}`);
    }

    if (!INACTIVE_STATUSES.has(task.status)) score += 3;
    return { score, reasons };
};

const TaskCard = ({
    task,
    reasons = [],
    linked,
    busy,
    canManage,
    onLink,
    onOpenTask
}) => (
    <div
        data-pmo-task-id={task.id}
        className="rounded-[13px] border border-[#40454b] bg-[#282b2f] p-3.5"
    >
        <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-black text-[#60a5fa]">{task.displayId}</span>
            <span className="rounded-[5px] border border-[#494949] bg-[#343434] px-1.5 py-0.5 text-[12px] font-bold text-[#d8d8d4]">
                {PROJECT_LABELS[task.projectCode] || task.projectCode || 'IOTA 공통'}
            </span>
            <span className="text-[13px] font-bold text-[#a1a1aa]">{task.status || '미착수'}</span>
            <span className="ml-auto text-[14px] font-black text-[#ff7169]">
                우선 {task.priorityScore ?? 0}
            </span>
        </div>
        <button
            type="button"
            onClick={() => onOpenTask(task.id)}
            className="mt-2 block w-full text-left"
        >
            <div className="text-[17px] font-bold leading-[1.45] text-white">{task.taskName}</div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-[#8e8e93]">
                <span>{task.categoryMain || '업무분류 미정'}</span>
                <span>·</span>
                <span>{task.leadDeptName || '실행주관 미정'}</span>
                {task.assignee && (
                    <>
                        <span>·</span>
                        <span>{task.assignee}</span>
                    </>
                )}
            </div>
        </button>
        {reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
                {reasons.map((reason) => (
                    <span
                        key={reason}
                        className="rounded-[5px] border border-[#3f5265] bg-[#2997ff]/5 px-1.5 py-0.5 text-[12px] font-bold text-[#93c5fd]"
                    >
                        {reason}
                    </span>
                ))}
            </div>
        )}
        <div className="mt-3 flex justify-end">
            <button
                type="button"
                disabled={linked || busy || !canManage}
                onClick={() => onLink(task.id)}
                data-link-task-id={task.id}
                className={`h-8 rounded-[7px] border px-3 text-[13px] font-bold ${
                    linked
                        ? 'border-[#30d158]/35 bg-[#30d158]/10 text-[#4ade80]'
                        : 'border-[#296da8] bg-[#2997ff]/15 text-[#7cc0ff] hover:bg-[#2997ff]/25 disabled:cursor-not-allowed disabled:opacity-45'
                }`}
            >
                {linked ? '연결됨' : canManage ? '연결' : '열람 전용'}
            </button>
        </div>
    </div>
);

const LinkedTaskList = ({
    linkedTasks,
    canManage,
    busy,
    onUnlink,
    onOpenTask
}) => (
    <section data-linked-task-list>
        <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[12px] font-bold text-white">연결된 통합업무</h4>
            <span className="text-[13px] font-bold text-[#4ade80]">{linkedTasks.length}건</span>
        </div>
        {linkedTasks.length > 0 ? (
            <div className="space-y-2">
                {linkedTasks.map(({ link, task }) => (
                    <div
                        key={link.id}
                        className="flex items-center gap-3 rounded-[12px] border border-[#30d158]/25 bg-[#30d158]/5 px-3 py-3"
                    >
                        <button
                            type="button"
                            onClick={() => onOpenTask(task.id)}
                            className="min-w-0 flex-1 text-left"
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[13px] font-black text-[#60a5fa]">{task.displayId}</span>
                                <span className="truncate text-[15px] font-bold text-white">{task.taskName}</span>
                                <span className="ml-auto shrink-0 text-[13px] font-bold text-[#60a5fa]">상세보기 →</span>
                            </div>
                            <div className="mt-1 text-[12px] text-[#86868B]">
                                {task.categoryMain} · {task.leadDeptName || '실행주관 미정'}
                            </div>
                        </button>
                        {canManage && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => onUnlink(link.id)}
                                data-unlink-id={link.id}
                                className="h-8 shrink-0 rounded-[7px] border border-[#555] px-2.5 text-[13px] font-bold text-[#a1a1aa] hover:border-[#ff5f57]/50 hover:text-[#ff7169] disabled:opacity-50"
                            >
                                연결 해제
                            </button>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <div className="rounded-[12px] border border-dashed border-[#454545] bg-white/[0.02] px-4 py-6 text-center">
                <p className="text-[15px] font-bold text-[#a1a1aa]">연결된 통합업무가 없습니다.</p>
                {canManage && (
                    <p className="mt-1 text-[13px] text-[#68686d]">
                        아래 관리 메뉴에서 기존 통합업무를 연결하거나 새 통합업무를 등록할 수 있습니다.
                    </p>
                )}
            </div>
        )}
    </section>
);

export default function PmoScheduleTaskLinkModal({
    item,
    tasks,
    links,
    projects,
    departments,
    canManage,
    busy,
    errorMessage,
    onClose,
    onLink,
    onUnlink,
    onCreateTask,
    onEditSchedule,
    onOpenTask
}) {
    const [activeTab, setActiveTab] = useState('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const isLeadUnassigned = !item.leadLabel || item.leadLabel === '미정';
    const validDepartments = useMemo(
        () => departments.filter((department) => (
            department.dept_code
            && department.dept_code !== 'SPECIAL_CFT'
        )),
        [departments]
    );
    const validDepartmentCodes = useMemo(
        () => new Set(validDepartments.map((department) => department.dept_code)),
        [validDepartments]
    );
    const [form, setForm] = useState(() => buildInitialForm(item, validDepartmentCodes));

    useEffect(() => {
        setActiveTab('overview');
        setSearchTerm('');
        setForm(buildInitialForm(item, validDepartmentCodes));
    }, [item, validDepartmentCodes]);

    const linkedTaskIds = useMemo(
        () => new Set(links.map((link) => link.taskId)),
        [links]
    );
    const linkedTasks = useMemo(
        () => links
            .map((link) => ({
                link,
                task: tasks.find((task) => task.id === link.taskId)
            }))
            .filter((entry) => entry.task),
        [links, tasks]
    );
    const recommendations = useMemo(() => tasks
        .filter((task) => !linkedTaskIds.has(task.id))
        .map((task) => ({ task, ...getRecommendation(item, task) }))
        .filter((entry) => entry.score >= 30)
        .sort((first, second) => (
            second.score - first.score
            || (second.task.priorityScore || 0) - (first.task.priorityScore || 0)
            || first.task.displayId.localeCompare(second.task.displayId)
        ))
        .slice(0, 5), [item, linkedTaskIds, tasks]);
    const filteredTasks = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm);
        return [...tasks]
            .filter((task) => (
                !normalizedSearch || getTaskSearchText(task).includes(normalizedSearch)
            ))
            .sort((first, second) => {
                const firstInactive = INACTIVE_STATUSES.has(first.status) ? 1 : 0;
                const secondInactive = INACTIVE_STATUSES.has(second.status) ? 1 : 0;
                return firstInactive - secondInactive
                    || (second.priorityScore || 0) - (first.priorityScore || 0)
                    || first.displayId.localeCompare(second.displayId);
            });
    }, [searchTerm, tasks]);

    const updateForm = (field, value) => {
        setForm((current) => {
            const next = { ...current, [field]: value };
            if (field === 'categoryMain') next.targetAxis = inferTargetAxis(value);
            return next;
        });
    };

    const submitNewTask = (event) => {
        event.preventDefault();
        if (!form.taskName.trim()) return;
        onCreateTask({
            ...form,
            taskName: form.taskName.trim(),
            taskPurpose: form.taskPurpose.trim(),
            deliverables: form.deliverables.trim(),
            assignee: form.assignee.trim()
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-5 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-task-link-title"
            data-schedule-task-link-modal
        >
            <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label={`${item.displayName} 닫기`}
                onClick={onClose}
            />
            <div className="relative flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[20px] border border-[#454545] bg-[#20201f] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
                <div className="flex items-start justify-between border-b border-[#393939] px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[14px] font-bold text-[#60a5fa]">{item.sourceKey}</span>
                            {links.length > 0 && (
                                <span className="rounded-full border border-[#30d158]/35 bg-[#30d158]/10 px-2 py-0.5 text-[12px] font-bold text-[#4ade80]">
                                    연결 {links.length}
                                </span>
                            )}
                        </div>
                        <h3 id="schedule-task-link-title" className="mt-2 truncate text-[22px] font-bold text-white">
                            {item.displayName}
                        </h3>
                        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-[#86868B]">
                            <span className={isLeadUnassigned ? 'font-bold text-[#ff5f57]' : ''}>
                                {isLeadUnassigned ? '실행주관 미정' : item.leadLabel}
                            </span>
                            <span>{item.categoryMain || '업무분류 미정'}</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#444] text-[18px] text-[#a1a1aa] hover:bg-white/5 hover:text-white disabled:opacity-50"
                        aria-label="닫기"
                    >
                        ×
                    </button>
                </div>

                {activeTab !== 'overview' && (
                    <div className="flex h-12 items-center gap-3 border-b border-[#393939] bg-[#242423] px-5">
                        <button
                            type="button"
                            onClick={() => setActiveTab('overview')}
                            className="h-8 rounded-[7px] border border-[#444] px-3 text-[13px] font-bold text-[#a1a1aa] hover:bg-white/5 hover:text-white"
                        >
                            ← 요약으로
                        </button>
                        <span className="text-[12px] font-bold text-white">
                            {activeTab === 'existing' ? '기존 통합업무 연결' : '새 통합업무 등록'}
                        </span>
                    </div>
                )}

                {errorMessage && (
                    <div className="mx-5 mt-4 rounded-[8px] border border-[#ff5f57]/40 bg-[#ff5f57]/10 px-3 py-2 text-[14px] font-bold text-[#ff7b74]">
                        {errorMessage}
                    </div>
                )}

                {activeTab === 'overview' ? (
                    <div className="timeline-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
                        <LinkedTaskList
                            linkedTasks={linkedTasks}
                            canManage={canManage}
                            busy={busy}
                            onUnlink={onUnlink}
                            onOpenTask={onOpenTask}
                        />

                        {canManage && (
                            <section className="mt-5">
                                <div className="mb-2">
                                    <h4 className="text-[12px] font-bold text-white">관리 메뉴</h4>
                                    <p className="mt-0.5 text-[13px] text-[#86868B]">필요한 작업 하나를 선택하세요.</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <button
                                        type="button"
                                        data-admin-action="existing"
                                        onClick={() => setActiveTab('existing')}
                                        className="rounded-[13px] border border-[#36658d] bg-[#2997ff]/10 p-4 text-left transition-colors hover:border-[#4f86b5] hover:bg-[#2997ff]/15"
                                    >
                                        <span className="block text-[13px] font-bold text-[#7cc0ff]">기존 통합업무 연결</span>
                                        <span className="mt-1.5 block text-[13px] leading-[1.5] text-[#8e8e93]">
                                            추천 또는 검색으로 통합업무를 찾습니다.
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        data-admin-action="new"
                                        onClick={() => setActiveTab('new')}
                                        className="rounded-[13px] border border-[#347247] bg-[#30d158]/8 p-4 text-left transition-colors hover:border-[#478f5d] hover:bg-[#30d158]/12"
                                    >
                                        <span className="block text-[13px] font-bold text-[#4ade80]">새 통합업무 등록</span>
                                        <span className="mt-1.5 block text-[13px] leading-[1.5] text-[#8e8e93]">
                                            새 통합업무를 만들고 즉시 연결합니다.
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        data-admin-action="schedule"
                                        onClick={onEditSchedule}
                                        className="rounded-[13px] border border-[#806329] bg-[#f59e0b]/8 p-4 text-left transition-colors hover:border-[#a17b31] hover:bg-[#f59e0b]/12"
                                    >
                                        <span className="block text-[13px] font-bold text-[#fbbf24]">마일스톤 및 일정 수정</span>
                                        <span className="mt-1.5 block text-[13px] leading-[1.5] text-[#8e8e93]">
                                            마일스톤·업무명·실행주관·기간·진행상태를 수정합니다.
                                        </span>
                                    </button>
                                </div>
                            </section>
                        )}
                    </div>
                ) : activeTab === 'existing' ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div
                            className="shrink-0 border-b border-[#393939] bg-[#20201f] p-5 pb-4"
                            data-fixed-linked-tasks
                        >
                            <div className="timeline-scrollbar max-h-[220px] overflow-y-auto pr-1">
                                <LinkedTaskList
                                    linkedTasks={linkedTasks}
                                    canManage={canManage}
                                    busy={busy}
                                    onUnlink={onUnlink}
                                    onOpenTask={onOpenTask}
                                />
                            </div>
                        </div>

                        <div className="timeline-scrollbar min-h-0 flex-1 overflow-y-auto p-5" data-task-candidate-scroll>
                            {recommendations.length > 0 && (
                                <section>
                                    <div className="mb-2">
                                        <h4 className="text-[12px] font-bold text-white">추천 업무</h4>
                                        <p className="mt-0.5 text-[13px] text-[#86868B]">
                                            업무명·실행주관·업무분류·프로젝트 문맥을 기준으로 제안합니다.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {recommendations.map(({ task, reasons }) => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                reasons={reasons}
                                                linked={false}
                                                busy={busy}
                                                canManage={canManage}
                                                onLink={onLink}
                                                onOpenTask={onOpenTask}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className={recommendations.length ? 'mt-5' : ''}>
                                <div className="mb-2 flex items-end justify-between gap-4">
                                    <div>
                                        <h4 className="text-[12px] font-bold text-white">전체 통합업무</h4>
                                        <p className="mt-0.5 text-[13px] text-[#86868B]">
                                            검색하지 않아도 전체 업무를 우선순위 순으로 표시합니다.
                                        </p>
                                    </div>
                                    <label className="relative w-[310px]">
                                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#86868B]">⌕</span>
                                        <input
                                            value={searchTerm}
                                            onChange={(event) => setSearchTerm(event.target.value)}
                                            placeholder="업무명·담당자·실행주관·분류 검색"
                                            className="h-9 w-full rounded-[8px] border border-[#444] bg-[#292929] pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-[#68686d] focus:border-[#2997ff]"
                                        />
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {filteredTasks.map((task) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            linked={linkedTaskIds.has(task.id)}
                                            busy={busy}
                                            canManage={canManage}
                                            onLink={onLink}
                                            onOpenTask={onOpenTask}
                                        />
                                    ))}
                                </div>
                                {!filteredTasks.length && (
                                    <div className="rounded-[12px] border border-[#3c3c3c] py-8 text-center text-[14px] text-[#86868B]">
                                        검색 조건에 맞는 통합업무가 없습니다.
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submitNewTask} className="timeline-scrollbar min-h-0 flex-1 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4 p-5">
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">프로젝트</span>
                                <select
                                    value={form.projectCode}
                                    onChange={(event) => updateForm('projectCode', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none focus:border-[#2997ff]"
                                >
                                    {projects.map((project) => (
                                        <option key={project.project_code} value={project.project_code}>
                                            {project.project_name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">업무분류</span>
                                <select
                                    value={form.categoryMain}
                                    onChange={(event) => updateForm('categoryMain', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none focus:border-[#2997ff]"
                                >
                                    {CATEGORY_OPTIONS.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="col-span-2 block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">업무명</span>
                                <input
                                    required
                                    value={form.taskName}
                                    onChange={(event) => updateForm('taskName', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[16px] font-bold text-white outline-none focus:border-[#2997ff]"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">업무 목적</span>
                                <textarea
                                    value={form.taskPurpose}
                                    onChange={(event) => updateForm('taskPurpose', event.target.value)}
                                    rows={3}
                                    className="w-full resize-none rounded-[8px] border border-[#444] bg-[#292929] px-3 py-2 text-[14px] leading-[1.6] text-white outline-none focus:border-[#2997ff]"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">필요 산출물</span>
                                <textarea
                                    value={form.deliverables}
                                    onChange={(event) => updateForm('deliverables', event.target.value)}
                                    rows={3}
                                    className="w-full resize-none rounded-[8px] border border-[#444] bg-[#292929] px-3 py-2 text-[14px] leading-[1.6] text-white outline-none focus:border-[#2997ff]"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">실행주관</span>
                                <select
                                    value={form.leadDeptCode}
                                    onChange={(event) => updateForm('leadDeptCode', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none focus:border-[#2997ff]"
                                >
                                    <option value="">미정</option>
                                    {validDepartments.map((department) => (
                                        <option key={department.dept_code} value={department.dept_code}>
                                            {department.dept_name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">담당자</span>
                                <input
                                    value={form.assignee}
                                    onChange={(event) => updateForm('assignee', event.target.value)}
                                    placeholder="미정"
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none placeholder:text-[#68686d] focus:border-[#2997ff]"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">최종 목표축</span>
                                <select
                                    value={form.targetAxis}
                                    onChange={(event) => updateForm('targetAxis', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none focus:border-[#2997ff]"
                                >
                                    {TARGET_AXIS_OPTIONS.map((targetAxis) => (
                                        <option key={targetAxis} value={targetAxis}>{targetAxis}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">마감기한</span>
                                <input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(event) => updateForm('dueDate', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none focus:border-[#2997ff]"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">상태</span>
                                <select
                                    value={form.status}
                                    onChange={(event) => updateForm('status', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none focus:border-[#2997ff]"
                                >
                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#a1a1aa]">중요도</span>
                                <select
                                    value={form.importanceLevel}
                                    onChange={(event) => updateForm('importanceLevel', event.target.value)}
                                    className="h-10 w-full rounded-[8px] border border-[#444] bg-[#292929] px-3 text-[15px] text-white outline-none focus:border-[#2997ff]"
                                >
                                    {IMPORTANCE_OPTIONS.map((importance) => (
                                        <option key={importance} value={importance}>{importance}</option>
                                    ))}
                                </select>
                            </label>
                            <div className="col-span-2 flex gap-2">
                                {[
                                    ['isBlocker', 'Blocker'],
                                    ['needsDecision', '의사결정 필요']
                                ].map(([field, label]) => (
                                    <button
                                        key={field}
                                        type="button"
                                        aria-pressed={form[field]}
                                        onClick={() => updateForm(field, !form[field])}
                                        className={`h-9 rounded-[8px] border px-3 text-[14px] font-bold ${
                                            form[field]
                                                ? 'border-[#9a3e39] bg-[#ff453a]/15 text-[#ff7169]'
                                                : 'border-[#444] bg-[#292929] text-[#a1a1aa]'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="col-span-2 rounded-[10px] border border-[#3f4852] bg-[#252b31] px-3 py-2.5 text-[13px] leading-[1.6] text-[#a1a1aa]">
                                저장하면 통합업무보드에 정규 업무가 등록되고 이 일정과 즉시 연결됩니다.
                                우선순위 점수와 회의상정 등급은 현재 DB 정책으로 자동 계산됩니다.
                            </div>
                        </div>
                        <div className="sticky bottom-0 flex gap-2 border-t border-[#3a3a3a] bg-[#20201f] px-5 py-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={busy}
                                className="h-10 flex-1 rounded-[8px] border border-[#444] text-[15px] font-bold text-[#a1a1aa] hover:bg-white/5 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={busy || !canManage || !form.taskName.trim()}
                                className="h-10 flex-1 rounded-[8px] border border-[#1f6fb2] bg-[#2997ff] text-[15px] font-bold text-white hover:bg-[#3ba1ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {busy ? '등록 중' : canManage ? '등록하고 연결' : '등록 권한 없음'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
}
