import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PMO_PROJECT_LABELS } from '../../../utils/pmoTaskLinks';

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
    '내용',
    '공유',
    '서울',
    '이오타',
]);

const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getTokens = (value) => normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 2 && !TOKEN_STOP_WORDS.has(token));

const getTaskSearchText = (task) => normalizeText([
    task.displayId,
    task.projectCode,
    PMO_PROJECT_LABELS[task.projectCode],
    task.taskName,
    task.taskPurpose,
    task.deliverables,
    task.categoryMain,
    task.leadDeptName,
    task.assignee,
].filter(Boolean).join(' '));

const getRecommendation = (task, reference) => {
    const referenceText = [
        reference.title,
        reference.content,
        reference.workspaceLabel,
    ].filter(Boolean).join(' ');
    const taskText = [
        task.taskName,
        task.taskPurpose,
        task.deliverables,
        task.categoryMain,
        task.leadDeptName,
    ].filter(Boolean).join(' ');
    const referenceTokens = new Set(getTokens(referenceText));
    const taskTokens = new Set(getTokens(taskText));
    const sharedTokens = [...referenceTokens].filter((token) => taskTokens.has(token));
    const reasons = [];
    let score = 0;

    if (reference.projectCode && reference.projectCode === task.projectCode) {
        score += 28;
        reasons.push('프로젝트 일치');
    }

    const workspaceName = normalizeText(reference.workspaceLabel);
    const leadDepartmentName = normalizeText(task.leadDeptName);
    if (
        workspaceName
        && leadDepartmentName
        && (workspaceName.includes(leadDepartmentName) || leadDepartmentName.includes(workspaceName))
    ) {
        score += 34;
        reasons.push('실행주관 일치');
    }

    if (sharedTokens.length > 0) {
        score += Math.min(40, sharedTokens.length * 10);
        reasons.push(`핵심어 일치: ${sharedTokens.slice(0, 3).join(', ')}`);
    }

    if (!INACTIVE_STATUSES.has(task.status)) score += 3;
    return { score, reasons };
};

const PickerTaskCard = ({ task, selected, reasons, onToggle }) => (
    <button
        type="button"
        onClick={() => onToggle(task.id)}
        className={`w-full rounded-[13px] border p-[14px] text-left transition-colors ${
            selected
                ? 'border-[#30d158]/45 bg-[#30d158]/10'
                : 'border-[#40454b] bg-[#282b2f] hover:border-[#59616a] hover:bg-[#2d3035]'
        }`}
    >
        <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-black text-[#60a5fa]">{task.displayId}</span>
            <span className="rounded-[5px] border border-[#494949] bg-[#343434] px-1.5 py-0.5 text-[12px] font-bold text-[#d8d8d4]">
                {PMO_PROJECT_LABELS[task.projectCode] || task.projectCode || 'IOTA 공통'}
            </span>
            <span className="text-[13px] font-bold text-[#a1a1aa]">{task.status || '미착수'}</span>
            <span className="ml-auto text-[14px] font-black text-[#ff7169]">
                우선 {task.priorityScore ?? 0}
            </span>
        </div>
        <div className="mt-2 text-[17px] font-bold leading-[1.45] text-white">{task.taskName}</div>
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
        {reasons?.length > 0 && (
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
        <div className={`mt-3 text-right text-[13px] font-bold ${selected ? 'text-[#4ade80]' : 'text-[#7cc0ff]'}`}>
            {selected ? '선택됨' : '선택'}
        </div>
    </button>
);

export default function PmoTaskPickerModal({
    tasks,
    selectedTaskIds,
    reference,
    loading,
    errorMessage,
    onClose,
    onApply,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [draftSelectedTaskIds, setDraftSelectedTaskIds] = useState(selectedTaskIds || []);

    useEffect(() => {
        setDraftSelectedTaskIds(selectedTaskIds || []);
        setSearchTerm('');
    }, [selectedTaskIds]);

    const selectedTaskIdSet = useMemo(
        () => new Set(draftSelectedTaskIds.map(String)),
        [draftSelectedTaskIds]
    );

    const selectedTasks = useMemo(
        () => tasks.filter((task) => selectedTaskIdSet.has(String(task.id))),
        [selectedTaskIdSet, tasks]
    );

    const recommendations = useMemo(() => tasks
        .filter((task) => !selectedTaskIdSet.has(String(task.id)))
        .map((task) => ({ task, ...getRecommendation(task, reference || {}) }))
        .filter((entry) => entry.score >= 20)
        .sort((firstEntry, secondEntry) => (
            secondEntry.score - firstEntry.score
            || (secondEntry.task.priorityScore || 0) - (firstEntry.task.priorityScore || 0)
            || firstEntry.task.displayId.localeCompare(secondEntry.task.displayId)
        ))
        .slice(0, 5), [reference, selectedTaskIdSet, tasks]);

    const filteredTasks = useMemo(() => {
        const normalizedSearchTerm = normalizeText(searchTerm);
        return [...tasks]
            .filter((task) => (
                !normalizedSearchTerm || getTaskSearchText(task).includes(normalizedSearchTerm)
            ))
            .sort((firstTask, secondTask) => {
                const firstInactive = INACTIVE_STATUSES.has(firstTask.status) ? 1 : 0;
                const secondInactive = INACTIVE_STATUSES.has(secondTask.status) ? 1 : 0;
                return firstInactive - secondInactive
                    || (secondTask.priorityScore || 0) - (firstTask.priorityScore || 0)
                    || firstTask.displayId.localeCompare(secondTask.displayId);
            });
    }, [searchTerm, tasks]);

    const toggleTask = (taskId) => {
        setDraftSelectedTaskIds((currentTaskIds) => {
            const normalizedTaskId = String(taskId);
            return currentTaskIds.some((currentTaskId) => String(currentTaskId) === normalizedTaskId)
                ? currentTaskIds.filter((currentTaskId) => String(currentTaskId) !== normalizedTaskId)
                : [...currentTaskIds, taskId];
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-5">
            <button
                type="button"
                aria-label="통합업무 선택 닫기"
                className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
                onClick={onClose}
            />
            <div className="relative flex max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[22px] border border-[#42464b] bg-[#202020] shadow-2xl">
                <header className="flex items-center gap-4 border-b border-[#363636] px-6 py-5">
                    <div>
                        <h3 className="text-[22px] font-black text-white">통합업무 연결</h3>
                        <p className="mt-1 text-[14px] text-[#8e8e93]">
                            게시글과 관련된 기존 통합업무를 선택합니다.
                        </p>
                    </div>
                    <span className="ml-auto rounded-full border border-[#30d158]/35 bg-[#30d158]/10 px-3 py-1 text-[14px] font-bold text-[#4ade80]">
                        {draftSelectedTaskIds.length}건 선택
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#444] text-[#a1a1aa] hover:border-[#666] hover:text-white"
                    >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading && (
                        <div className="py-20 text-center text-[15px] font-bold text-[#a1a1aa]">
                            통합업무 원장을 불러오는 중입니다.
                        </div>
                    )}

                    {!loading && errorMessage && (
                        <div className="rounded-[12px] border border-[#ff453a]/35 bg-[#ff453a]/10 px-4 py-3 text-[14px] font-bold text-[#ff7169]">
                            {errorMessage}
                        </div>
                    )}

                    {!loading && !errorMessage && (
                        <div className="space-y-7">
                            {selectedTasks.length > 0 && (
                                <section>
                                    <div className="mb-3 flex items-center justify-between">
                                        <h4 className="text-[15px] font-black text-white">선택한 통합업무</h4>
                                        <span className="text-[14px] font-bold text-[#4ade80]">{selectedTasks.length}건</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {selectedTasks.map((task) => (
                                            <PickerTaskCard
                                                key={task.id}
                                                task={task}
                                                selected
                                                onToggle={toggleTask}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {recommendations.length > 0 && (
                                <section>
                                    <div className="mb-3">
                                        <h4 className="text-[15px] font-black text-white">추천 업무</h4>
                                        <p className="mt-1 text-[13px] text-[#73737a]">
                                            게시글 제목·내용·워크스페이스와의 연관성을 기준으로 제안합니다.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {recommendations.map(({ task, reasons }) => (
                                            <PickerTaskCard
                                                key={task.id}
                                                task={task}
                                                reasons={reasons}
                                                selected={false}
                                                onToggle={toggleTask}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section>
                                <div className="mb-3 flex flex-wrap items-end gap-3">
                                    <div>
                                        <h4 className="text-[15px] font-black text-white">전체 통합업무</h4>
                                        <p className="mt-1 text-[13px] text-[#73737a]">
                                            검색하지 않으면 진행 중인 업무와 우선순위가 높은 업무부터 표시합니다.
                                        </p>
                                    </div>
                                    <label className="relative ml-auto w-full max-w-[360px]">
                                        <svg
                                            className="absolute left-3 top-1/2 -translate-y-1/2"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#8e8e93"
                                            strokeWidth="2"
                                        >
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                        <input
                                            type="search"
                                            value={searchTerm}
                                            onChange={(event) => setSearchTerm(event.target.value)}
                                            placeholder="업무명·담당자·실행주관 검색"
                                            className="h-11 w-full rounded-[10px] border border-[#454545] bg-[#282828] pl-10 pr-3 text-[14px] text-white outline-none focus:border-[#2997ff]"
                                        />
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {filteredTasks.map((task) => (
                                        <PickerTaskCard
                                            key={task.id}
                                            task={task}
                                            selected={selectedTaskIdSet.has(String(task.id))}
                                            onToggle={toggleTask}
                                        />
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                <footer className="flex items-center justify-end gap-3 border-t border-[#363636] px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-[9px] border border-[#4b4b4b] px-5 text-[14px] font-bold text-[#c5c5c7] hover:bg-white/5"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={loading || Boolean(errorMessage)}
                        onClick={() => onApply(draftSelectedTaskIds)}
                        className="h-10 rounded-[9px] border border-[#2477b8] bg-[#2997ff]/20 px-6 text-[14px] font-black text-[#7cc0ff] hover:bg-[#2997ff]/30 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        선택 적용
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
}
