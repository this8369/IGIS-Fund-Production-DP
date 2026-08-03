import React from 'react';
import { createPortal } from 'react-dom';
import WorkspaceActivityLog from '../system/workspace/WorkspaceActivityLog';
import { parseTaskBoolean } from '../../utils/pmoTaskPriority';

const formatDate = (dateString) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

const splitValues = (value) => String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const getStatusClassName = (status) => {
    if (status === '완료') return 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/10';
    if (status === '지연') return 'text-[#f87171] border-[#f87171]/30 bg-[#f87171]/10';
    if (status === '보류') return 'text-[#facc15] border-[#facc15]/30 bg-[#facc15]/10';
    return 'text-[#60a5fa] border-[#60a5fa]/30 bg-[#60a5fa]/10';
};

const DetailSection = ({ label, children }) => (
    <section className="rounded-[16px] border border-white/[0.08] bg-[#1A1A1A] px-4 py-3.5">
        <h3 className="text-[11px] font-bold text-[#86868B] mb-1.5">{label}</h3>
        <div className="text-[14px] text-[#D1D1D6] leading-relaxed whitespace-pre-line break-words">
            {children || '등록된 내용이 없습니다.'}
        </div>
    </section>
);

export default function MobilePmoTaskDetail({ task, onClose, backLabel = '업무' }) {
    if (!task) return null;

    const priorityScore = Number(task.priority_score) || 0;
    const isBlocker = parseTaskBoolean(task.is_blocker);
    const needsDecision = parseTaskBoolean(task.needs_decision);
    const leadDepartment = task.lead_dept?.dept_name || task.lead_dept || task.lead_dept_code || '-';
    const cooperativeDepartments = splitValues(task.coop_dept_codes || task.coop_depts);
    const externalParty = task.external_party?.stakeholder_name || task.external_party || task.external_party_code || '';
    const externalParties = splitValues(externalParty);

    return createPortal(
        <div className="fixed inset-0 z-[2147483647] flex h-[100dvh] max-h-[100dvh] w-screen flex-col overflow-hidden bg-[#111111] text-[#E5E5E5]">
            <header
                className="shrink-0 border-b border-[#3c3c3c] bg-[#1A1A1A]/95 backdrop-blur-xl"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="relative h-10 px-2.5 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="relative z-10 h-8 px-2 rounded-[9px] flex items-center justify-center gap-0.5 bg-[#2997ff] text-white shadow-sm active:bg-[#147ce5]"
                        aria-label={`${backLabel}로 돌아가기`}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-[12px] font-bold whitespace-nowrap">{backLabel}</span>
                    </button>
                    <span className="absolute left-1/2 -translate-x-1/2 text-[14px] font-bold whitespace-nowrap">업무 상세</span>
                    <span className="min-w-[72px] max-w-[72px] text-right text-[9px] font-mono text-[#86868B] truncate">
                        {task.displayId || task.id}
                    </span>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 space-y-3 hide-scrollbar" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
                <div className="px-1 pb-2">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-[11px] font-bold text-[#60a5fa] border border-[#60a5fa]/25 bg-[#60a5fa]/10 px-2 py-1 rounded-[6px]">
                            {task.project_code || task.project || '전사'}
                        </span>
                        <span className={`text-[11px] font-bold border px-2 py-1 rounded-[6px] ${getStatusClassName(task.status)}`}>
                            {task.status || '진행중'}
                        </span>
                        <span className="text-[11px] font-bold text-[#E5E5E5] border border-white/10 bg-white/5 px-2 py-1 rounded-[6px]">
                            우선순위 {priorityScore}점
                        </span>
                        {isBlocker && (
                            <span className="text-[11px] font-bold text-[#f87171] border border-[#f87171]/25 bg-[#f87171]/10 px-2 py-1 rounded-[6px]">Blocker</span>
                        )}
                        {needsDecision && (
                            <span className="text-[11px] font-bold text-[#fb923c] border border-[#fb923c]/25 bg-[#fb923c]/10 px-2 py-1 rounded-[6px]">의사결정필요</span>
                        )}
                    </div>
                    <h1 className="text-[22px] font-bold text-[#F5F5F7] leading-snug break-keep">
                        {task.task_name || '제목 없음'}
                    </h1>
                    <p className="text-[12px] text-[#86868B] mt-2">
                        {task.category_main || '분류 미정'} · {task.sector_detail || '세부섹터 미정'}
                    </p>
                </div>

                <section className="rounded-[16px] border border-white/[0.08] bg-[#1A1A1A] p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
                        <div>
                            <span className="block text-[11px] text-[#86868B] mb-1">실행주관</span>
                            <span className="font-semibold text-[#E5E5E5]">{leadDepartment}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] text-[#86868B] mb-1">담당자</span>
                            <span className="font-semibold text-[#E5E5E5]">{task.assignee || '미정'}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] text-[#86868B] mb-1">마감 기한</span>
                            <span className="font-semibold text-[#E5E5E5]">{formatDate(task.due_date)}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] text-[#86868B] mb-1">회의상정등급</span>
                            <span className="font-semibold text-[#E5E5E5]">{task.meeting_grade || '-'}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] text-[#86868B] mb-1">GATE 단계</span>
                            <span className="font-semibold text-[#E5E5E5]">{task.gate_stage || '-'}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] text-[#86868B] mb-1">중요도</span>
                            <span className="font-semibold text-[#E5E5E5]">{task.importance_level || '중간'}</span>
                        </div>
                    </div>

                    <div className="border-t border-white/[0.06] mt-4 pt-4">
                        <span className="block text-[11px] text-[#86868B] mb-2">협조 부서</span>
                        <div className="flex flex-wrap gap-1.5">
                            {cooperativeDepartments.length > 0 ? cooperativeDepartments.map((department) => (
                                <span key={department} className="px-2 py-1 rounded-[6px] bg-white/5 border border-white/10 text-[#D1D1D6] text-[11px]">
                                    {department}
                                </span>
                            )) : <span className="text-[12px] text-[#555]">-</span>}
                        </div>
                    </div>

                    {(task.support_needed || externalParties.length > 0) && (
                        <div className="border-t border-white/[0.06] mt-4 pt-4 grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-[11px] text-[#86868B] mb-1">지원 필요</span>
                                <span className="text-[12px] text-[#D1D1D6] leading-relaxed">{task.support_needed || '-'}</span>
                            </div>
                            <div>
                                <span className="block text-[11px] text-[#86868B] mb-1">외부 상대방</span>
                                <span className="text-[12px] text-[#D1D1D6] leading-relaxed">{externalParties.join(', ') || '-'}</span>
                            </div>
                        </div>
                    )}
                </section>

                <DetailSection label="업무 목적">{task.task_purpose}</DetailSection>
                <DetailSection label="필요 산출물">{task.deliverables}</DetailSection>
                <DetailSection label="다음 액션">{task.next_action}</DetailSection>
                {task.agenda_reason && <DetailSection label="회의 상정 사유">{task.agenda_reason}</DetailSection>}

                <section className="pt-2">
                    <div className="flex items-center justify-between px-1 mb-2.5">
                        <h2 className="text-[15px] font-bold text-[#F5F5F7]">업무 협업·댓글</h2>
                        <span className="text-[10px] text-[#86868B]">PC와 동일한 기록</span>
                    </div>
                    <WorkspaceActivityLog
                        isTaskBoard
                        taskId={task.id}
                        taskProject={task.project_code || task.project || 'IOTA_SEOUL'}
                        workspaceCode="WS_PMO"
                        workspaceLabel="통합업무보드"
                        mobileMode
                    />
                </section>
            </main>
        </div>,
        document.body,
    );
}
