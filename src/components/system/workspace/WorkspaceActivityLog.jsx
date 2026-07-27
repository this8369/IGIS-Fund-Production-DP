import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { executeWithTimeout } from '../../../utils/supabaseHelper';
import { notifyMembersOnCommentCreation } from '../../../utils/notificationHelpers';
import { getDirectorLogCell } from '../../../utils/directorWorkflowLogs';
import { normalizeIotaOrganization } from '../../../utils/iotaOrganizations.js';
import { buildMentionCandidates } from '../../../utils/mentionHelpers.js';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import LogWriteBox from '../LogWriteBox';
import ReactionAvatarStack from '../ReactionAvatarStack';

const getWorkspaceMessageTitle = (workspaceCode, workspaceLabel) => {
    const workspaceTitles = {
        WS_PM1: '사업1파트 업무 메시지',
        WS_PM2: '사업2파트 업무 메시지',
        WS_LFC: 'LFC 업무 메시지',
        WS_DSC: '개발솔루션 업무 메시지',
        WS_EMC: '기업마케팅 업무 메시지',
        WS_SSC: '공간솔루션 업무 메시지',
        WS_KAM: 'KAM 업무 메시지',
        WS_IPR: 'IPR 업무 메시지',
    };

    if (workspaceTitles[workspaceCode]) return workspaceTitles[workspaceCode];
    const cleanLabel = String(workspaceLabel || '').split('-')[0].trim();
    return cleanLabel ? `${cleanLabel} 업무 메시지` : '업무 메시지';
};

const parseSystemLogText = (rawText) => {
    if (!rawText) return [];
    
    const lines = rawText.split('\n').filter(Boolean);
    const parsedChanges = [];

    lines.forEach(line => {
        // Case 1: 중요도 and 회의 상정 기준 (Combined)
        if (line.includes('중요도') && line.includes('회의 상정 기준')) {
            const impMatch = line.match(/중요도가\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            const gradeMatch = line.match(/회의\s*상정\s*기준이\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (impMatch) {
                parsedChanges.push({
                    type: 'importance_level',
                    label: '중요도',
                    oldVal: impMatch[1],
                    newVal: impMatch[2]
                });
            }
            if (gradeMatch) {
                parsedChanges.push({
                    type: 'meeting_grade',
                    label: '상정기준',
                    oldVal: gradeMatch[1],
                    newVal: gradeMatch[2]
                });
            }
            return;
        }

        // Case 2: 중요도 only
        if (line.includes('중요도가') && line.includes('변경되었습니다')) {
            const match = line.match(/중요도가\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'importance_level',
                    label: '중요도',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 3: 회의 상정 기준 only
        if (line.includes('회의 상정 기준') && line.includes('변경되었습니다')) {
            const match = line.match(/회의\s*상정\s*기준이\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'meeting_grade',
                    label: '상정기준',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 4: 상태 (Status)
        if (line.includes('상태가') && line.includes('변경되었습니다')) {
            const match = line.match(/상태가\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'status',
                    label: '상태',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 5: 병목 (Blocker)
        if (line.includes('병목(Blocker)이') && line.includes('변경되었습니다')) {
            const match = line.match(/병목\(Blocker\)이\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'is_blocker',
                    label: '병목',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 6: 담당자 (Assignee)
        if (line.includes('담당자가') && line.includes('변경되었습니다')) {
            const match = line.match(/담당자가\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'assignee',
                    label: '담당자',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 7: 외부상대방 (External Party)
        if (line.includes('외부상대방이') && line.includes('변경되었습니다')) {
            const match = line.match(/외부상대방이\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'external_party',
                    label: '외부상대방',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 8: 협조부서 (Coop Dept)
        if (line.includes('협조부서가') && line.includes('변경되었습니다')) {
            // 사용자 요청: 협조부서 이력은 아예 노출하지 않음
            return;
        }

        // Case 9: 마감기한 (Due Date)
        if (line.includes('마감기한이') && line.includes('변경되었습니다')) {
            const match = line.match(/마감기한이\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'due_date',
                    label: '마감기한',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 10: 의사결정 필요 (Needs Decision)
        if (line.includes('의사결정 필요 여부가') && line.includes('변경되었습니다')) {
            const match = line.match(/의사결정\s*필요\s*여부가\s*"([^"]+)"에서\s*"([^"]+)"으로/);
            if (match) {
                parsedChanges.push({
                    type: 'needs_decision',
                    label: '결정필요',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 11: 회의 상정 등급
        if (line.includes('회의 상정 등급이') && line.includes('변경되었습니다')) {
            const match = line.match(/회의 상정 등급이\s*"([^"]+)"에서\s*"([^"]+)"\(으\)로/);
            if (match) {
                parsedChanges.push({
                    type: 'meeting_grade',
                    label: '상정등급',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Case 12: 우선순위 점수
        if (line.includes('우선순위 점수가')) {
            const match = line.match(/우선순위 점수가\s*"([^"]+)"에서\s*"([^"]+)"\(으\)로/);
            if (match) {
                parsedChanges.push({
                    type: 'priority_score',
                    label: '우선순위',
                    oldVal: match[1],
                    newVal: match[2]
                });
                return;
            }
        }

        // Fallback
        parsedChanges.push({
            type: 'text',
            label: '이력',
            oldVal: null,
            newVal: line
        });
    });

    return parsedChanges;
};

const renderBadge = (type, val) => {
    if (!val) return null;
    const cleanVal = val.replace(/^[A-D]_/, '');

    if (type === 'importance_level') {
        if (cleanVal === 'PF필수') {
            return <span className="bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        } else if (cleanVal === '준공필수') {
            return <span className="bg-[#bdbba7]/15 text-[#bdbba7] border border-[#bdbba7]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        }
        return <span className="bg-[#8e8e93]/10 text-[#8e8e93] border border-[#8e8e93]/20 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
    }

    if (type === 'meeting_grade') {
        if (cleanVal === '즉시상정') {
            return <span className="bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        } else if (cleanVal === '회의점검') {
            return <span className="bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        } else if (cleanVal === '주간관리') {
            return <span className="bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        }
        return <span className="bg-[#8e8e93]/10 text-[#8e8e93] border border-[#8e8e93]/20 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
    }

    if (type === 'priority_score') {
        const score = parseInt(cleanVal.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(score) && score >= 60) {
            return <span className="bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        }
        return <span className="bg-[#8e8e93]/10 text-[#8e8e93] border border-[#8e8e93]/20 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
    }

    if (type === 'status') {
        if (cleanVal === '지연') {
            return <span className="bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        } else if (cleanVal === '완료') {
            return <span className="bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        } else if (cleanVal === '진행중') {
            return <span className="bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        }
        return <span className="bg-[#8e8e93]/10 text-[#8e8e93] border border-[#8e8e93]/20 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
    }

    if (type === 'assignee') {
        if (cleanVal === '미정') {
            return <span className="text-[#86868B] border border-[#3c3c3c] border-dashed text-[11px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap bg-transparent">{cleanVal}</span>;
        }
        return <span className="bg-[#8e8e93]/10 text-[#8e8e93] border border-[#8e8e93]/20 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
    }

    if (type === 'external_party') {
        if (cleanVal === '미지정' || cleanVal === '없음' || cleanVal === '') {
            return <span className="text-[#86868B] text-[11px] font-medium px-1.5 py-0.5 whitespace-nowrap">{cleanVal || '미지정'}</span>;
        }
        return <span className="bg-[#bf5af2]/10 text-[#bf5af2] border border-[#bf5af2]/20 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
    }

    if (type === 'coop_depts') {
        const depts = cleanVal.split(/;+/).map(d => d.trim()).filter(Boolean);
        if (depts.length === 0 || cleanVal === '없음') {
            return <span className="text-[#86868B] text-[11px] font-medium px-1.5 py-0.5 whitespace-nowrap">없음</span>;
        }
        return (
            <div className="flex flex-wrap gap-1 items-center">
                {depts.map((d, idx) => (
                    <span key={idx} className="bg-[#27272a] text-[#d4d4d8] border border-[#3f3f46] text-[11px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">{d}</span>
                ))}
            </div>
        );
    }

    if (type === 'due_date') {
        if (cleanVal === '미지정' || cleanVal === '') {
            return <span className="text-[#86868B] text-[11px] font-medium px-1.5 py-0.5 whitespace-nowrap">미지정</span>;
        }
        return <span className="bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/20 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
    }

    if (type === 'is_blocker' || type === 'needs_decision') {
        const isYes = cleanVal === '활성화' || cleanVal === '필요' || cleanVal === 'Y';
        if (isYes) {
            return <span className="bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">{cleanVal}</span>;
        }
        return <span className="text-[#86868B] text-[11px] font-medium px-1.5 py-0.5 whitespace-nowrap">{cleanVal}</span>;
    }

    return <span className="bg-white/5 text-[#E5E5E5] px-1.5 py-0.5 rounded text-[11px] font-medium border border-[#3c3c3c]/50 whitespace-nowrap">{cleanVal}</span>;
};

const renderSystemLogChanges = (rawText) => {
    const changes = parseSystemLogText(rawText);
    if (!changes || changes.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[6px] mt-[4px]">
            {changes.map((change, idx) => {
                if (change.type === 'text') {
                    return (
                        <div key={idx} className="col-span-1 sm:col-span-2 text-[13px] text-[#A1A1AA] bg-[#2C2C2E]/40 px-[10px] py-[6px] rounded-[6px] border border-white/[0.03]">
                            {change.newVal}
                        </div>
                    );
                }
                return (
                    <div key={idx} className="flex items-center bg-[#2C2C2E]/40 border border-white/[0.03] rounded-[6px] px-[10px] py-[6px]">
                        <span className="text-[#86868B] font-bold text-[12px] min-w-[56px] select-none">{change.label}</span>
                        <div className="flex items-center gap-[6px] flex-1 min-w-0">
                            {renderBadge(change.type, change.oldVal)}
                            <svg className="w-[12px] h-[12px] text-[#666] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            {renderBadge(change.type, change.newVal)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default function WorkspaceActivityLog({ workspaceCode, workspaceLabel, isTaskBoard = false, taskId = null, taskProject = null, mobileMode = false }) {
    const { memberInfo } = useAuth();
    
    // Logs State
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [logsViewMode, setLogsViewMode] = useState('summary');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const [pilotMembers, setPilotMembers] = useState([]);
    
    // Delete states
    const [logToDelete, setLogToDelete] = useState(null);
    const [commentToDelete, setCommentToDelete] = useState(null); // { logId, commentId }
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Filter states
    const [filterStakeholder, setFilterStakeholder] = useState('');
    const [filterCell, setFilterCell] = useState(() => {
        if (workspaceLabel === '사업 PM') return '사업PM';
        return workspaceLabel || '';
    });
    const [filterPurpose, setFilterPurpose] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    
    // Edit states
    const [editingLogId, setEditingLogId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Comment states
    const [commentingLogId, setCommentingLogId] = useState(null);
    const [commentContent, setCommentContent] = useState('');
    const [isSavingComment, setIsSavingComment] = useState(false);

    // Comment Mention states
    const [commentShowMentionDropdown, setCommentShowMentionDropdown] = useState(false);
    const [commentMentionQuery, setCommentMentionQuery] = useState('');
    const [commentMentionCursorIndex, setCommentMentionCursorIndex] = useState(0);
    const [commentMentionPosition, setCommentMentionPosition] = useState({ top: 0, left: 0 });

    const commentMentionCandidates = Array.from(new Set([
        ...(masterStakeholders?.map(s => s.contact_name) || []),
        ...(pilotMembers?.map(m => m.staff_name) || [])
    ].filter(Boolean)));
    const filteredCommentMentions = commentMentionCandidates.filter(name => name.toLowerCase().includes(commentMentionQuery.toLowerCase())).slice(0, 5);

    const renderLogTextWithMentions = (text) => {
        if (!text) return null;
        const names = Array.from(new Set([
            ...(masterStakeholders?.map(s => s.contact_name) || []),
            ...buildMentionCandidates(pilotMembers).map((mention) => mention.label),
        ].filter(Boolean)));
        if (names.length === 0) return text;

        const escapedNames = names
            .sort((left, right) => right.length - left.length)
            .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(@?(?:${escapedNames.join('|')}))`, 'g');
        const parts = text.split(regex);

        return parts.map((part, i) => {
            const label = part.startsWith('@') ? part.slice(1) : part;
            if (names.includes(label)) {
                return <span key={i} className="text-[#82afb9] font-bold">{part}</span>;
            }
            return part;
        });
    };

    const fetchMasterStakeholders = async () => {
        const { data, error } = await supabase
            .from('iota_stakeholder_master')
            .select('*')
            .limit(5000);
        if (data && !error) {
            setMasterStakeholders(data);
        }
        
        const { data: pilotData, error: pilotError } = await supabase
            .from('iota_seoul_pilot_members')
            .select('auth_id, email, staff_name, org_name, role_code, workspace_code, is_active');
        if (!pilotError && pilotData) {
            setPilotMembers(pilotData);
        }
    };

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('iota_seoul_logs')
                .select('*, iota_seoul_log_stakeholders(sh_name, role_category)');

            if (isTaskBoard && taskId) {
                query = query.eq('metadata->>task_id', String(taskId));
            }

            const { data, error } = await query
                .order('work_date', { ascending: isTaskBoard })
                .order('created_at', { ascending: isTaskBoard });
            if (error) throw error;
            
            const fetchedLogs = data || [];
            setLogs(fetchedLogs);
            if (mobileMode) {
                setExpandedLogs((current) => fetchedLogs.reduce((expanded, log) => {
                    if (log.writer_name !== '시스템' && log.metadata?.comments?.length > 0) {
                        expanded[log.log_id] = true;
                    }
                    return expanded;
                }, { ...current }));
            }
        } catch (e) {
            console.error('Error fetching logs:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchMasterStakeholders();
    }, [taskId]);

    useEffect(() => {
        const handleUpdate = (e) => {
            if (e.detail?.taskId === taskId) {
                fetchLogs();
            }
        };
        window.addEventListener('iota_log_updated', handleUpdate);
        return () => window.removeEventListener('iota_log_updated', handleUpdate);
    }, [taskId]);

    const handleTargetLog = () => {
        const params = new URLSearchParams(window.location.search);
        let targetLogId = params.get('logId') || localStorage.getItem('iota_target_log_id');
        console.log('[WorkspaceActivityLog] handleTargetLog 실행됨. targetLogId:', targetLogId, 'logs.length:', logs.length);
        if (targetLogId && logs.length > 0) {
            const targetLog = logs.find(l => {
                console.log('[WorkspaceActivityLog] logs 비교 중... l.log_id:', l.log_id, 'String(l.log_id):', String(l.log_id), 'String(targetLogId):', String(targetLogId));
                return String(l.log_id) === String(targetLogId);
            });
            console.log('[WorkspaceActivityLog] targetLog 찾음 결과:', targetLog);
            if (targetLog) {
                const logIdStr = targetLog.log_id;
                
                // Sync filters to guarantee target log is visible
                setFilterStakeholder('');
                setFilterPurpose('');
                setFilterStatus('');
                setFilterPriority('');
                setLogSearchQuery('');
                
                const targetCell = getLogCell(targetLog);
                setFilterCell(targetCell);
                
                // Calculate which page targetLog belongs to in the filtered list
                const tempFiltered = logs.filter(log => {
                    if (getCellName(log.writer_name) === '기타') return false;
                    const cell = getLogCell(log);
                    if (targetCell && cell !== targetCell) return false;
                    return true;
                });
                
                const logIndex = tempFiltered.findIndex(l => String(l.log_id) === String(targetLogId));
                if (logIndex !== -1) {
                    const page = Math.floor(logIndex / logsPerPage) + 1;
                    setCurrentPage(page);
                    console.log('[WorkspaceActivityLog] targetLog가 위치한 페이지로 이동:', page, 'index:', logIndex);
                }

                // 1. Expand the card
                setExpandedLogs(prev => ({ ...prev, [logIdStr]: true }));
                console.log('[WorkspaceActivityLog] expandedLogs 설정 완료:', logIdStr);
                
                // 2. Scroll into view and highlight after a slight render delay
                setTimeout(() => {
                    const el = document.getElementById(logIdStr);
                    console.log('[WorkspaceActivityLog] DOM 엘리먼트 찾음 결과 (el):', el);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Apply pulse visual feedback
                        el.classList.add('bg-blue-500/10', 'border-t', 'border-b', 'border-blue-500/40');
                        setTimeout(() => {
                            el.classList.remove('bg-blue-500/10', 'border-t', 'border-b', 'border-blue-500/40');
                        }, 2500);
                    }
                    localStorage.removeItem('iota_target_log_id');
                    const newParams = new URLSearchParams(window.location.search);
                    newParams.delete('logId');
                    const newSearch = newParams.toString();
                    const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
                    window.history.replaceState(null, '', newUrl);
                }, 500);
            } else {
                console.warn('[WorkspaceActivityLog] logs 목록 내에 targetLogId가 존재하지 않음:', targetLogId);
            }
        }
    };

    useEffect(() => {
        console.log('[WorkspaceActivityLog] useEffect 실행됨 (logs 변경). logs.length:', logs.length, 'workspaceCode:', workspaceCode);
        handleTargetLog();
    }, [logs]);

    useEffect(() => {
        window.addEventListener('popstate', handleTargetLog);
        return () => window.removeEventListener('popstate', handleTargetLog);
    }, [logs]);

    const handleDelete = async (logId) => {
        setIsDeleting(true);
        try {
            await supabase.from('iota_seoul_log_links').delete().eq('log_id', logId);
            await supabase.from('iota_seoul_log_stakeholders').delete().eq('log_id', logId);
            const { error } = await supabase.from('iota_seoul_logs').delete().eq('log_id', logId);
            if (error) throw error;
            
            setLogs(prev => prev.filter(l => l.log_id !== logId));
            setLogToDelete(null);
        } catch (error) {
            console.error('Error deleting log:', error);
            alert('서버 연결 지연으로 인해 일시적인 오류가 발생했습니다. 페이지를 새로고침합니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveEdit = async (logId) => {
        if (!editingContent.trim()) return;
        setIsSavingEdit(true);
        try {
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ raw_text: editingContent, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
            
            if (error) throw error;
            
            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, raw_text: editingContent, updated_at: new Date().toISOString() } : l));
            setEditingLogId(null);
            setEditingContent('');
        } catch (err) {
            console.error('Error updating log:', err);
            alert('서버 연결 지연으로 인해 일시적인 오류가 발생했습니다. 페이지를 새로고침합니다.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const getCaretCoordinates = (element, position) => {
        const div = document.createElement('div');
        const style = window.getComputedStyle(element);
        for (const prop of style) {
            div.style[prop] = style[prop];
        }
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.textContent = element.value.substring(0, position);
        const span = document.createElement('span');
        span.textContent = element.value.substring(position) || '.';
        div.appendChild(span);
        document.body.appendChild(div);
        const coordinates = {
            top: span.offsetTop - element.scrollTop,
            left: span.offsetLeft
        };
        document.body.removeChild(div);
        return coordinates;
    };

    const handleCommentContentChange = (e, logId) => {
        const text = e.target.value;
        setCommentContent(text);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = text.slice(0, cursorPosition);
        
        const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);

        if (mentionMatch) {
            setCommentShowMentionDropdown(true);
            setCommentMentionQuery(mentionMatch[1]);
            setCommentMentionCursorIndex(mentionMatch.index);
            
            const coords = getCaretCoordinates(e.target, cursorPosition);
            setCommentMentionPosition({ 
                top: coords.top + 24, 
                left: coords.left     
            });
        } else {
            setCommentShowMentionDropdown(false);
        }
    };

    const handleCommentMentionSelect = (name, logId) => {
        const textBeforeMention = commentContent.slice(0, commentMentionCursorIndex);
        const textAfterCursor = commentContent.slice(commentMentionCursorIndex + commentMentionQuery.length + 1);
        
        const newText = textBeforeMention + `@${name} ` + textAfterCursor;
        setCommentContent(newText);
        setCommentShowMentionDropdown(false);
        
        setTimeout(() => {
            const textarea = document.getElementById(`comment-textarea-${logId}`);
            if (textarea) {
                textarea.focus();
                const newPos = commentMentionCursorIndex + name.length + 2; // +2 for '@' and ' '
                textarea.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleSaveComment = async (logId) => {
        if (!commentContent.trim()) return;
        setIsSavingComment(true);
        try {
            const log = logs.find(l => l.log_id === logId);
            const metadata = log.metadata || {};
            const comments = metadata.comments || [];
            
            const newComment = {
                id: Date.now().toString(),
                author: memberInfo?.staff_name || memberInfo?.name || '익명',
                author_email: memberInfo?.email || 'unknown',
                text: commentContent,
                created_at: new Date().toISOString()
            };
            
            const updatedMetadata = { ...metadata, comments: [...comments, newComment] };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, metadata: updatedMetadata } : l));
            setCommentingLogId(null);
            
            // Trigger background mention notification
            const workspace = {
                code: workspaceCode,
                label: workspaceLabel
            };
            notifyMembersOnCommentCreation(logId, commentContent, workspace, memberInfo?.email);
            
            setCommentContent('');
        } catch (e) {
            console.error('Error saving comment:', e);
            alert('서버 연결 지연으로 인해 일시적인 오류가 발생했습니다. 페이지를 새로고침합니다.');
        } finally {
            setIsSavingComment(false);
        }
    };

    const handleDeleteComment = async (logId, commentId) => {
        setIsDeleting(true);
        try {
            const log = logs.find(l => l.log_id === logId);
            const metadata = log.metadata || {};
            const comments = (metadata.comments || []).filter(c => c.id !== commentId);
            
            const updatedMetadata = { ...metadata, comments };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, metadata: updatedMetadata } : l));
        } catch (e) {
            console.error('Error deleting comment:', e);
            alert('서버 연결 지연으로 인해 일시적인 오류가 발생했습니다. 페이지를 새로고침합니다.');
        } finally {
            setIsDeleting(false);
            setCommentToDelete(null);
        }
    };

    const handleToggleReaction = async (logId, type, commentId = null) => {
        try {
            const log = logs.find(l => l.log_id === logId);
            if (!log) return;
            const myEmail = memberInfo?.email;
            if (!myEmail) {
                alert('로그인이 필요합니다.');
                return;
            }

            const metadata = JSON.parse(JSON.stringify(log.metadata || {}));
            
            if (commentId) {
                const comments = metadata.comments || [];
                const commentIndex = comments.findIndex(c => c.id === commentId);
                if (commentIndex === -1) return;
                
                const comment = comments[commentIndex];
                const reactions = comment.reactions || { like: [], check: [] };
                const currentReactionList = reactions[type] || [];
                
                let newReactionList;
                if (currentReactionList.includes(myEmail)) {
                    newReactionList = currentReactionList.filter(email => email !== myEmail);
                } else {
                    newReactionList = [...currentReactionList, myEmail];
                }
                
                comments[commentIndex] = {
                    ...comment,
                    reactions: { ...reactions, [type]: newReactionList }
                };
                metadata.comments = comments;
            } else {
                const reactions = metadata.reactions || { like: [], check: [] };
                const currentReactionList = reactions[type] || [];
                
                let newReactionList;
                if (currentReactionList.includes(myEmail)) {
                    newReactionList = currentReactionList.filter(email => email !== myEmail);
                } else {
                    newReactionList = [...currentReactionList, myEmail];
                }
                metadata.reactions = { ...reactions, [type]: newReactionList };
            }

            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, metadata } : l));

            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata })
                .eq('log_id', logId);

            if (error) throw error;
        } catch (e) {
            console.error('Error toggling reaction:', e);
            alert('일시적인 오류가 발생했습니다.');
            fetchLogs();
        }
    };

    const handleDownloadFile = async (e, filePath, fileName) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const { data, error } = await supabase.storage
                .from('task-attachments')
                .createSignedUrl(filePath, 60);

            if (error) throw error;

            const response = await fetch(data.signedUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('파일 다운로드 중 오류가 발생했습니다.');
        }
    };

    const getCellName = (name) => {
        if (pilotMembers && pilotMembers.length > 0) {
            const member = pilotMembers.find(m => m.staff_name === name);
            if (member && member.org_name) {
                return normalizeIotaOrganization(member.org_name);
            }
        }
        if (!masterStakeholders || masterStakeholders.length === 0) return '기타';
        const stakeholder = masterStakeholders.find(s => s.contact_name === name);
        if (stakeholder && stakeholder.role_category && stakeholder.role_category !== 'IGIS 내부인력') {
            return stakeholder.role_category;
        }
        return '기타';
    };

    const getLogCell = (log) => {
        if (log.writer_name === '시스템') {
            return '변경이력';
        }
        if (isTaskBoard) {
            return getCellName(log.writer_name);
        }
        return getDirectorLogCell(log);
    };


    const hasRestrictedPermissions = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return false;
        return (perms.groups && perms.groups.length > 0) || (perms.individuals && perms.individuals.length > 0);
    };

    const getPermissionString = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return '';
        const parts = [];
        if (perms.groups && perms.groups.length > 0) parts.push(...perms.groups);
        if (perms.individuals && perms.individuals.length > 0) parts.push(...perms.individuals);
        return parts.join(', ');
    };


    const getShortPermissionString = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return '';
        const parts = [];
        if (perms.groups && perms.groups.length > 0) parts.push(...perms.groups);
        if (perms.individuals && perms.individuals.length > 0) parts.push(...perms.individuals);
        
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0];
        return `${parts[0]} 외 ${parts.length - 1}`;
    };

    const formatDateYYMMDD = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}.${mm}.${dd}`;
    };

    const toggleExpand = (id) => {
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const logsPerPage = isTaskBoard ? 9999 : (logsViewMode === 'summary' ? 5 : 20);
    const checkUserAccess = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return true;
        
        const hasGroups = perms.groups && perms.groups.length > 0;
        const hasIndivs = perms.individuals && perms.individuals.length > 0;
        
        if (!hasGroups && !hasIndivs) return true;

        const myEmail = memberInfo?.email;
        const myName = memberInfo?.staff_name || memberInfo?.name;
        const isAuthor = log.writer_staff_id === myEmail || log.writer_name === myName;
        
        if (isAuthor) return true;
        
        if (hasIndivs && perms.individuals.includes(myName)) return true;
        
        if (hasGroups) {
            const myStakeholderRecords = masterStakeholders.filter(s => s.contact_name === myName);
            const myRoles = myStakeholderRecords.map(s => s.role_category).filter(Boolean);
            const myOrganization = normalizeIotaOrganization(memberInfo?.org_name);
            
            for (const group of perms.groups) {
                if (group === "각 워크스페이스" && myStakeholderRecords.length > 0) return true;
                if (myRoles.includes(group)) return true;
                if (myOrganization && normalizeIotaOrganization(group) === myOrganization) return true;
                
                if (group === "PO" && myName === "이철승") return true;
                if (group === "Sub-PO" && ["윤관식", "정조민", "우형석"].includes(myName)) return true;
            }
        }
        
        return false;
    };

    const filteredLogs = logs.filter(log => {
        if (isTaskBoard) {
            if (String(log.metadata?.task_id) !== String(taskId)) return false;
            if (filterStakeholder && log.iota_seoul_log_stakeholders?.[0]?.role_category !== filterStakeholder) return false;
            if (!logSearchQuery) return true;
            const query = logSearchQuery.toLowerCase();
            return (
                log.raw_text?.toLowerCase().includes(query) ||
                log.writer_name?.toLowerCase().includes(query)
            );
        }
        // Filter out non-members
        if (getCellName(log.writer_name) === '기타') return false;

        // Prevent Phase 2 Task Board test logs from leaking into Phase 1 workspaces
        if (log.metadata?.is_task_board) return false;

        const cell = getLogCell(log);
        
        if (filterStakeholder && log.iota_seoul_log_stakeholders?.[0]?.role_category !== filterStakeholder) return false;
        if (filterCell && cell !== filterCell) return false;
        if (filterPurpose && (log.metadata?.triage_type || '공유') !== filterPurpose) return false;
        if (filterStatus && (log.metadata?.issue_status || '진행중') !== filterStatus) return false;
        if (filterPriority && (log.metadata?.priority || '중간') !== filterPriority) return false;

        if (!logSearchQuery) return true;
        const query = logSearchQuery.toLowerCase();
        return (
            log.raw_text?.toLowerCase().includes(query) ||
            log.writer_name?.toLowerCase().includes(query) ||
            log.metadata?.workspace_label?.toLowerCase().includes(query) ||
            log.metadata?.iota_matches?.[0]?.label?.toLowerCase().includes(query)
        );
    });
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
    const displayedLogs = filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

    return (
        <div className="w-full flex flex-col mt-0">
            {/* Log Viewer */}
            {!isTaskBoard && (
                <div className="flex justify-between items-center mt-[-14px] mb-[12px]">
                    <h2 className="text-[16px] font-bold text-white tracking-tight translate-y-[6px]">
                        {getWorkspaceMessageTitle(workspaceCode, workspaceLabel)}
                    </h2>
                    <div className="flex items-center gap-[12px]">
                        {/* Search Box */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-[12px] flex items-center pointer-events-none">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                            <input 
                                type="text" 
                                placeholder="검색어 입력..." 
                                value={logSearchQuery}
                                onChange={(e) => setLogSearchQuery(e.target.value)}
                                className="bg-[#222] border border-[#333] hover:border-[#444] rounded-[8px] pl-[32px] pr-[12px] py-[6px] text-[12px] text-white w-[180px] focus:outline-none focus:border-[#2997ff] transition-all"
                            />
                        </div>
                        <button 
                            type="button"
                            onClick={() => { setLogsViewMode(prev => prev === 'summary' ? 'full' : 'summary'); setCurrentPage(1); }} 
                            className="px-[12px] py-[6px] rounded-[8px] bg-[#222] border border-[#333] text-[12px] text-[#A1A1AA] hover:text-white hover:border-[#444] transition-all font-medium"
                        >
                            {logsViewMode === 'summary' ? '전체보기' : '간략히 보기'}
                        </button>
                    </div>
                </div>
            )}
            
            
            <div className={isTaskBoard ? "mt-0 mb-0" : "-mx-[7px] p-[6px] border border-[#333] rounded-[30px] mb-[40px]"}>
                <div className="w-full flex flex-col mt-0">{/* Task Input Form */}
            {!isTaskBoard && (
                <LogWriteBox 
                    memberInfo={memberInfo}
                    masterStakeholders={masterStakeholders}
                    pilotMembers={pilotMembers}
                    fetchLogs={fetchLogs}
                    fetchMasterStakeholders={fetchMasterStakeholders}
                    workspaceCode={workspaceCode}
                    workspaceLabel={workspaceLabel}
                    isTaskBoard={isTaskBoard}
                    taskId={taskId}
                    taskProject={taskProject}
                />
            )}
            <div className={isTaskBoard ? "w-full flex flex-col gap-4 bg-transparent border-0 rounded-none shadow-none" : "w-full border border-[#3c3c3c] rounded-[24px] flex flex-col bg-[#252525]"}>
                {/* Header Row (Only for workspace mode) */}
                {!isTaskBoard && (
                    <div className="w-full px-[20px] py-[12px] flex items-center border-b border-[#3c3c3c] bg-transparent rounded-t-[24px]">
                        <div className="flex flex-1 min-w-0">
                            <div className="w-[86px] mr-[16px] text-center">
                                <span className="text-[13px] font-bold text-[#86868B]">프로젝트</span>
                            </div>
                            <div className="flex flex-1 min-w-0 translate-x-[-20px]">
                                <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                    <div className="text-[13px] font-bold text-[#86868B] px-[2px] py-[4px] text-center w-[60px]">
                                        기능셀
                                    </div>
                                </div>
                                <div className="w-[110px] shrink-0 translate-x-[10px] flex items-center">
                                    <span className="text-[13px] font-bold text-[#86868B] pl-[20px]">등록자</span>
                                </div>
                                <div className="flex-1 min-w-0 translate-x-[2px] flex items-center">
                                    <span className="text-[13px] font-bold text-[#86868B] px-[4px]">내용</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[12px] shrink-0 ml-[12px] justify-end items-center">
                            <div className="w-[90px] shrink-0"></div>
                            <div className="w-[110px] mr-[4px] text-center flex items-center justify-center">
                                <select 
                                    value={filterStakeholder}
                                    onChange={e => { setFilterStakeholder(e.target.value); setCurrentPage(1); }}
                                    className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[76px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterStakeholder ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="" className="bg-[#222] text-[#E5E5E5]">이해관계자</option>
                                    {['투자자', '대주', 'SI', '잠재임차자', '운영 파트너', 'IGIS 내부인력'].map(val => (
                                        <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-[60px] flex items-center justify-center translate-x-[6px]">
                                <select 
                                    value={filterPurpose}
                                    onChange={e => { setFilterPurpose(e.target.value); setCurrentPage(1); }}
                                    className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[44px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterPurpose ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="" className="bg-[#222] text-[#E5E5E5]">목적</option>
                                    {['공유', '협업', '리스크 판단', '의사결정'].map(val => (
                                        <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-[60px] flex items-center justify-center">
                                <select 
                                    value={filterStatus}
                                    onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                                    className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[54px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterStatus ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="" className="bg-[#222] text-[#E5E5E5]">진행상태</option>
                                    {['신규', '검토중', '진행중', '보류', '완료'].map(val => (
                                        <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-[40px] flex items-center justify-center">
                                <select 
                                    value={filterPriority}
                                    onChange={e => { setFilterPriority(e.target.value); setCurrentPage(1); }}
                                    className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[50px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterPriority ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="" className="bg-[#222] text-[#E5E5E5]">중요도</option>
                                    {['높음', '중간', '낮음'].map(val => (
                                        <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-[60px] text-center flex items-center justify-center">
                                <span className="text-[13px] font-bold text-[#86868B] px-[4px]">등록일</span>
                            </div>
                        </div>
                    </div>
                )}

                {displayedLogs.map((log, index) => {
                    if (isTaskBoard) {
                        return (
                            <div id={log.log_id} key={log.log_id} className={`w-full flex flex-col bg-[#1c1c1e] border border-[#2c2c2e] rounded-[16px] transition-all hover:border-[#444] relative group ${mobileMode ? 'gap-[10px] p-[12px]' : 'gap-[12px] p-[20px]'}`}>
                                {/* Card Header */}
                                <div className={`w-full flex items-start gap-[10px] ${mobileMode ? '' : 'ml-[-4px]'}`}>
                                    <div className="w-[32px] h-[32px] rounded-full bg-[#2c2c2e] flex items-center justify-center border border-[#3c3c3c] shrink-0 overflow-hidden mt-[2px]">
                                        {log.writer_name === '시스템' ? (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                        ) : (
                                            <img 
                                                src={`${import.meta.env.BASE_URL}${log.writer_name}.webp`} 
                                                alt={log.writer_name} 
                                                className="w-full h-full object-cover rounded-full"
                                                onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 flex flex-col min-w-0">
                                        <div className="w-full flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[14px] font-bold text-white leading-tight">{log.writer_name}</span>
                                                {((log.created_at && new Date(log.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(log.created_at)) < 48 * 60 * 60 * 1000) || (log.updated_at && new Date(log.updated_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(log.updated_at)) < 48 * 60 * 60 * 1000)) && (
                                                    <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[0px]">
                                                        N
                                                    </span>
                                                )}
                                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                                    log.writer_name === '시스템'
                                                        ? 'text-[#30d158] bg-[#30d158]/10'
                                                        : 'text-[#82afb9] bg-[#82afb9]/10'
                                                }`}>
                                                    {getLogCell(log).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '')}
                                                </span>
                                            </div>
                                            <div className={`items-center gap-3 shrink-0 ${mobileMode ? 'hidden' : 'flex'}`}>
                                                {log.writer_name === '시스템' && (
                                                    <div className="flex items-center gap-1.5 text-[12px] text-[#86868B] select-none">
                                                        <span>변경자:</span>
                                                        <span className="font-bold text-white">{log.metadata?.editor_name || '시스템'}</span>
                                                        <span className="text-[10px] font-bold text-[#82afb9] bg-[#82afb9]/10 px-1.5 py-0.5 rounded">
                                                            {log.metadata?.editor_name ? getCellName(log.metadata.editor_name).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '') : '이력'}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Delete Button (Writer only) */}
                                                {log.writer_staff_id === memberInfo?.email && (
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setLogToDelete(log); }}
                                                        className="w-[24px] h-[24px] rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#86868B] hover:text-[#FF453A] hover:bg-[#FF453A]/10 hover:border-[#FF453A]/30 transition-all cursor-pointer"
                                                        title="삭제"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-[#86868B] font-['Inter'] mt-0.5">
                                            {formatDateYYMMDD(log.work_date)} {log.created_at && new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Card Body - Content */}
                                <div className={`text-[14px] text-[#E5E5E5] leading-relaxed whitespace-pre-wrap break-words ${mobileMode ? 'px-0' : 'pl-[42px] pr-[10px]'}`}>
                                    {hasRestrictedPermissions(log) && (
                                        <div className="inline-flex items-center gap-[4px] cursor-default text-[#ef4444] text-[12px] font-bold mb-[6px]">
                                            🔒 [{getShortPermissionString(log)}]
                                        </div>
                                    )}
                                    {checkUserAccess(log) ? (
                                        <div className="text-[#E5E5E5]">
                                            {log.writer_name === '시스템' ? (
                                                <div className="text-[#E5E5E5] pl-[4px]">
                                                    {renderSystemLogChanges(log.raw_text)}
                                                </div>
                                            ) : (
                                                renderLogTextWithMentions(log.raw_text)
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[#86868B] text-[13px] italic py-2 text-center border border-[#333] rounded-[8px] bg-[#1a1a1a]">
                                            🔒 열람 권한이 없습니다.
                                        </div>
                                    )}
                                    
                                    {/* File Attachments Summary */}
                                    {checkUserAccess(log) && log.metadata?.attachedFiles && log.metadata.attachedFiles.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-[#333]/30">
                                            {log.metadata.attachedFiles.map((file, idx) => (
                                                <button 
                                                    key={idx} 
                                                    type="button"
                                                    className="flex items-center gap-[6px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-[8px] px-[10px] py-[6px] transition-colors group cursor-pointer"
                                                    onClick={(e) => handleDownloadFile(e, file.path, file.name)}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                                    <span className="text-[11px] text-[#A1A1AA] group-hover:text-white transition-colors truncate max-w-[150px] font-medium" title={file.name}>{file.name}</span>
                                                    <span className="text-[9px] text-[#555] ml-[2px]">{(file.size ? file.size / 1024 / 1024 : 0).toFixed(2)}MB</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Card Footer - Interactions (Reactions & Comments) */}
                                {log.writer_name !== '시스템' && (
                                    <div className={`flex items-center justify-between mt-[-2px] pt-2 border-t border-[#333]/20 ${mobileMode ? 'pl-0 gap-2 flex-wrap' : 'pl-[42px]'}`}>
                                        <div className={`flex items-center ${mobileMode ? 'gap-[6px]' : 'gap-[12px]'}`}>
                                            {/* Like Reaction Button */}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'like'); }}
                                                className={`flex items-center gap-[4px] px-[8px] py-[4px] rounded-[6px] transition-colors border cursor-pointer text-[12px] ${log.metadata?.reactions?.like?.includes(memberInfo?.email) ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' : 'bg-transparent border-[#333] hover:border-[#444] text-[#86868B] hover:text-[#E5E5E5]'}`}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill={log.metadata?.reactions?.like?.includes(memberInfo?.email) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                                <span className="font-semibold">{log.metadata?.reactions?.like?.length || 0}</span>
                                            </button>
                                            
                                            {/* Check Reaction Button */}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'check'); }}
                                                className={`flex items-center gap-[4px] px-[8px] py-[4px] rounded-[6px] transition-colors border cursor-pointer text-[12px] ${log.metadata?.reactions?.check?.includes(memberInfo?.email) ? 'bg-[#2997ff]/10 border-[#2997ff]/30 text-[#2997ff]' : 'bg-transparent border-[#333] hover:border-[#444] text-[#86868B] hover:text-[#E5E5E5]'}`}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                <span className="font-semibold">{log.metadata?.reactions?.check?.length || 0}</span>
                                            </button>
                                            
                                            {/* Comment Thread Toggle Button */}
                                            <button
                                                type="button"
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    toggleExpand(log.log_id);
                                                }}
                                                className={`flex items-center gap-[6px] px-[10px] py-[4px] rounded-[6px] border text-[12px] font-medium transition-all cursor-pointer ${expandedLogs[log.log_id] ? 'bg-[#2997ff]/10 border-[#2997ff]/30 text-[#2997ff]' : 'bg-transparent border-[#333] hover:border-[#444] text-[#86868B] hover:text-white'}`}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                <span>댓글 {log.metadata?.comments?.length || 0}</span>
                                            </button>
                                        </div>
                                        
                                        <div className="flex items-center gap-[8px]">
                                            {/* Edit Post Button (Owner only) */}
                                            {!editingLogId && (memberInfo?.email === log.writer_staff_id || memberInfo?.name === log.writer_name) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setEditingLogId(log.log_id);
                                                        setCommentingLogId(null);
                                                    }}
                                                    className="text-[12px] text-[#A1A1AA] hover:text-white font-medium cursor-pointer transition-colors"
                                                >
                                                    수정하기
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Nested Expanded Comments/Replies Inside Card */}
                                {log.writer_name !== '시스템' && expandedLogs[log.log_id] && (
                                    <div className={`mt-3 border-t border-[#333]/20 pt-3 w-full flex flex-col gap-3 ${mobileMode ? 'pl-0' : 'pl-[42px]'}`}>
                                        {/* Comments list */}
                                        {checkUserAccess(log) && log.metadata?.comments && log.metadata.comments.length > 0 && (
                                            <div className="flex flex-col gap-[8px] w-full">
                                                {log.metadata.comments.map(comment => (
                                                    <div key={comment.id} className="bg-white/[0.02] border border-[#2c2c2e] rounded-[8px] p-[10px] flex justify-between group">
                                                        <div className={`flex-1 min-w-0 ${mobileMode ? 'pr-[6px]' : 'pr-[16px]'}`}>
                                                            <div className="flex items-center gap-[8px] mb-[4px]">
                                                                <div className="w-[24px] h-[24px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                                    <img 
                                                                        src={`${import.meta.env.BASE_URL}${comment.author}.webp`} 
                                                                        alt={comment.author} 
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-[6px]">
                                                                    <span className="text-[12px] font-bold text-white">{comment.author}</span>
                                                                    {comment.created_at && new Date(comment.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(comment.created_at)) < 48 * 60 * 60 * 1000 && (
                                                                        <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[0px]">
                                                                            N
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-[#86868B]">
                                                                    {new Date(comment.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                </span>
                                                            </div>
                                                            <div className={`text-[13px] text-[#A1A1AA] whitespace-pre-wrap break-words mb-[6px] ${mobileMode ? 'ml-0 mt-2' : 'ml-[32px]'}`}>{comment.text}</div>
                                                            <div className={`flex items-center gap-[8px] ${mobileMode ? 'ml-0' : 'ml-[32px]'}`}>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'like', comment.id); }}
                                                                    className={`flex items-center gap-[4px] transition-colors cursor-pointer ${comment.reactions?.like?.includes(memberInfo?.email) ? 'text-[#ff3b30]' : 'text-[#86868B] hover:text-[#A1A1AA]'}`}
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill={comment.reactions?.like?.includes(memberInfo?.email) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                                                    <span className="text-[10px]">{comment.reactions?.like?.length || 0}</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'check', comment.id); }}
                                                                    className={`flex items-center gap-[4px] transition-colors cursor-pointer ${comment.reactions?.check?.includes(memberInfo?.email) ? 'text-[#2997ff]' : 'text-[#86868B] hover:text-[#A1A1AA]'}`}
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                                    <span className="text-[10px]">{comment.reactions?.check?.length || 0}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {comment.author_email === memberInfo?.email && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setCommentToDelete({ logId: log.log_id, commentId: comment.id }); }}
                                                                className={`text-[11px] text-[#FF453A] group-hover:opacity-100 transition-opacity hover:underline cursor-pointer align-self-start ${mobileMode ? 'opacity-100' : 'opacity-0'}`}
                                                            >
                                                                삭제
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Reply write box */}
                                        <div className="w-full relative mt-1">
                                            <textarea
                                                id={`comment-textarea-${log.log_id}`}
                                                value={commentingLogId === log.log_id ? commentContent : ''}
                                                onChange={(e) => handleCommentContentChange(e, log.log_id)}
                                                onFocus={() => setCommentingLogId(log.log_id)}
                                                placeholder="댓글을 입력하세요... (@를 입력하여 담당자를 멘션할 수 있습니다)"
                                                className="w-full bg-[#2a2a2c]/50 border border-[#333] rounded-[8px] p-[10px] text-[13px] text-[#E5E5E5] leading-relaxed resize-y focus:outline-none focus:border-[#2997ff] min-h-[60px]"
                                            />
                                            {commentingLogId === log.log_id && (
                                                <div className="flex justify-end gap-[8px] mt-[6px]">
                                                    <button
                                                        onClick={() => { setCommentingLogId(null); setCommentContent(''); }}
                                                        className="px-[10px] py-[4px] bg-transparent border border-[#444] rounded-[6px] text-[11px] text-[#A1A1AA] hover:text-[#E5E5E5] transition-colors cursor-pointer"
                                                    >
                                                        취소
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveComment(log.log_id)}
                                                        disabled={isSavingComment}
                                                        className="px-[12px] py-[4px] bg-[#2997ff] hover:bg-[#0071e3] border border-transparent rounded-[6px] text-[11px] text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {isSavingComment ? '등록 중...' : '댓글 등록'}
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* Mention Dropdown inside card reply */}
                                            {commentingLogId === log.log_id && commentShowMentionDropdown && filteredCommentMentions.length > 0 && (
                                                <div 
                                                    className="absolute bg-[#222] border border-[#333] rounded-[8px] py-[6px] w-[180px] max-h-[150px] overflow-y-auto z-[60] shadow-xl"
                                                    style={{ top: `${commentMentionPosition.top}px`, left: `${commentMentionPosition.left}px` }}
                                                >
                                                    {filteredCommentMentions.map((name, i) => (
                                                        <div 
                                                            key={i} 
                                                            className="px-[12px] py-[8px] text-[13px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate flex items-center gap-[4px]"
                                                            onClick={() => handleCommentMentionSelect(name, log.log_id)}
                                                        >
                                                            <span className="text-[#86868B]">@</span>{name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // Render original workspace table-row layout
                    return (
                        <div id={log.log_id} key={log.log_id} className={`relative w-full px-[20px] py-[16px] flex flex-col group transition-all duration-500 hover:bg-white/5 last:rounded-b-[24px] ${index !== displayedLogs.length - 1 ? 'border-b border-[#3c3c3c]' : ''}`}>
                            {/* Main Row */}
                            <div 
                                className="w-full flex items-center justify-between cursor-pointer"
                                onClick={() => toggleExpand(log.log_id)}
                            >
                                {/* Left Section */}
                                <div className="flex items-center flex-1 min-w-0">
                                    {/* Project Button */}
                                    {!isTaskBoard && (() => {
                                        let projName = '427 PFV';
                                        if (log.metadata?.project_name) {
                                            let name = log.metadata.project_name;
                                            if (name === 'IOTA 427') name = '427 PFV';
                                            if (name === 'IOTA 816') name = '816 PFV';
                                            projName = name;
                                        } else {
                                            const text = log.metadata?.workspace_label || log.metadata?.source_project_text || '';
                                            if (text.includes('816') || text.includes('서울 2') || text.includes('IOTA 2') || text.includes('Two')) projName = '816 PFV';
                                            else if (text.includes('421')) projName = '421 Fund';
                                        }
                                        
                                        let textColorClass = 'text-[#E5E5E5] border-[#444]'; // 427 PFV (Lightest)
                                        if (projName === '816 PFV') textColorClass = 'text-[#A1A1AA] border-[#333]'; // 816 PFV (Medium)
                                        else if (projName === '421 Fund') textColorClass = 'text-[#737373] border-[#222]'; // 421 Fund (Darkest)
                                        else if (projName === 'IOTA 공통') textColorClass = 'text-[#A1A1AA] border-[#333]';
                                        
                                        return (
                                            <div className={`py-[6px] border rounded-[8px] text-[12px] font-bold ${textColorClass} shrink-0 mr-[16px] w-[86px] text-center bg-transparent`}>
                                                {projName}
                                            </div>
                                        );
                                    })()}

                                    <div className={`flex items-center flex-1 min-w-0 ${isTaskBoard ? '' : 'translate-x-[-20px]'}`}>
                                        {/* Cell Name */}
                                        <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                            <span className="text-[13px] font-medium text-[#86868B]">
                                                {getLogCell(log).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '')}
                                            </span>
                                        </div>

                                        {/* Avatar & Name */}
                                        <div className="flex items-center gap-[8px] w-[110px] shrink-0 translate-x-[10px]">
                                            <div className="w-[28px] h-[28px] rounded-full bg-[#333] overflow-hidden border border-[#444]">
                                                <img 
                                                    src={`${import.meta.env.BASE_URL}${log.writer_name}.webp`} 
                                                    alt={log.writer_name} 
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                                />
                                            </div>
                                            <div className="flex items-center gap-[6px]">
                                                <span className="text-[14px] font-bold text-white">{log.writer_name}</span>
                                                {((log.created_at && new Date(log.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(log.created_at)) < 48 * 60 * 60 * 1000) || (log.updated_at && new Date(log.updated_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(log.updated_at)) < 48 * 60 * 60 * 1000)) && (
                                                    <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[1px]">
                                                        N
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pr-0 flex items-center gap-[8px] translate-x-[2px]">
                                            <div 
                                                className="flex-1 min-w-0 text-[14px] text-[#E5E5E5] hover:text-white transition-colors flex items-center gap-[6px]"
                                            >
                                                {hasRestrictedPermissions(log) && (
                                                    <div className="group relative flex items-center gap-[4px] shrink-0 cursor-default">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                        <span className="text-[#ef4444] text-[12px] font-bold">[{getShortPermissionString(log)}]</span>
                                                        <div className="absolute left-0 bottom-[100%] mb-[8px] hidden group-hover:flex bg-[#222] border border-[#333] px-[10px] py-[6px] rounded-[6px] whitespace-nowrap text-[12px] text-[#E5E5E5] shadow-xl z-[99] pointer-events-none font-medium">
                                                            🔒 열람 권한: {getPermissionString(log)}
                                                        </div>
                                                    </div>
                                                )}
                                                <span className="truncate">{log.summary || (log.raw_text ? log.raw_text.split('\n')[0] : '')}</span>
                                                {log.metadata?.comments?.length > 0 && <span className="text-[#3b82f6] ml-[6px] font-bold text-[13px] shrink-0">({log.metadata.comments.length})</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Section */}
                                <div className="flex items-center gap-[12px] shrink-0 ml-[12px] justify-end">
                                    {/* Reactions Indicator */}
                                    <div className="shrink-0 flex items-center justify-end gap-[6px] w-[90px]">
                                        {(log.metadata?.reactions?.like?.length > 0 || log.metadata?.reactions?.check?.length > 0) && (
                                            <div className="flex items-center gap-[8px]">
                                                {log.metadata?.reactions?.like?.length > 0 && (
                                                    <div className="flex items-center gap-[4px]">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff3b30" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                                        <ReactionAvatarStack reactionEmails={log.metadata.reactions.like} pilotMembers={pilotMembers} />
                                                    </div>
                                                )}
                                                {log.metadata?.reactions?.check?.length > 0 && (
                                                    <div className="flex items-center gap-[4px]">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2997ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                        <ReactionAvatarStack reactionEmails={log.metadata.reactions.check} pilotMembers={pilotMembers} />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Stakeholder Info */}
                                    <div className="shrink-0 flex justify-center w-[110px] mr-[4px]">
                                        {checkUserAccess(log) && log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                            <span className="text-[13px] text-[#A1A1AA] text-center truncate" title={log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}>
                                                {log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}
                                            </span>
                                        )}
                                    </div>
                                    {!isTaskBoard && (
                                        <>
                                            <div className="h-[24px] flex items-center w-[60px] justify-center translate-x-[6px]"><span className="text-[13px] text-[#A1A1AA] truncate">{log.metadata?.triage_type || '공유'}</span></div>
                                            <div className="h-[24px] flex items-center w-[60px] justify-center"><span className="text-[13px] text-[#E5E5E5]">{log.metadata?.issue_status || '진행중'}</span></div>
                                            <div className="h-[24px] flex items-center w-[40px] justify-center">
                                                <span className={`text-[13px] font-bold ${log.metadata?.priority === '높음' ? 'text-[#FF453A]' : (log.metadata?.priority === '낮음' ? 'text-[#86868B]' : 'text-[#3b82f6]')}`}>
                                                    {log.metadata?.priority || '중간'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    <div className="relative flex flex-col items-center w-[60px] shrink-0 justify-center">
                                        <span className="text-[13px] text-[#86868B] font-['Inter'] leading-tight">
                                            {formatDateYYMMDD(log.work_date)}
                                        </span>
                                        {expandedLogs[log.log_id] && log.created_at && (
                                            <span className="absolute top-[100%] text-[11px] text-[#555] font-['Inter'] leading-tight mt-[2px] whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Delete Button (Absolute positioned outside content flow) */}
                                    {log.writer_staff_id === memberInfo?.email && (
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setLogToDelete(log); }}
                                            className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-[24px] h-[24px] bg-black rounded-none flex items-center justify-center transition-opacity opacity-100 border border-[#333] shadow-none cursor-pointer hover:bg-[#222]"
                                            title="삭제"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Box */}
                            <AnimatePresence>
                                {expandedLogs[log.log_id] && (
                                    <motion.div 
                                        className="w-full flex overflow-hidden"
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                        animate={{ height: 'auto', opacity: 1, marginTop: 14 }}
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                    >
                                    <div 
                                        className="rounded-[12px] p-[1px] bg-gradient-to-br from-[#d6efe9] via-[#82afb9] to-[#4c6e86] flex-1"
                                        style={{ marginLeft: '166px', marginRight: '72px' }}
                                    >
                                        <div className="bg-[#1c1c1e] rounded-[11px] p-[16px] w-full h-full">
                                        {/* Right Floating Badges */}
                                        <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[12px]">
                                            {hasRestrictedPermissions(log) && (
                                                <div className="flex flex-col items-end gap-[4px]">
                                                    <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">열람 권한</span>
                                                    <div className="bg-[#1e293b] border border-[#334155] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                        <span className="text-[12px] font-medium text-[#e2e8f0]">
                                                            제한됨: {getPermissionString(log)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {checkUserAccess(log) && log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                                <div className="flex flex-col items-end gap-[4px]">
                                                    <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">이해관계자</span>
                                                    <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                        <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                            {log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Original Text */}
                                        {checkUserAccess(log) ? (
                                            log.writer_name === '시스템' ? (
                                                <div className="flex flex-col gap-2.5">
                                                    <div className="flex items-center gap-1.5 text-[13px] text-[#A1A1AA] select-none mb-1.5">
                                                        <span>변경자:</span>
                                                        <span className="font-bold text-white text-[13px]">{log.metadata?.editor_name || '시스템'}</span>
                                                        <span className="text-[10px] font-bold text-[#82afb9] bg-[#82afb9]/10 px-1.5 py-0.5 rounded">
                                                            {log.metadata?.editor_name ? getCellName(log.metadata.editor_name).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '') : '이력'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[#E5E5E5] pl-[4px]">
                                                        {renderSystemLogChanges(log.raw_text)}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${commentingLogId === log.log_id ? 'text-[#86868B] opacity-70' : 'text-[#E5E5E5]'}`}>
                                                    {renderLogTextWithMentions(log.raw_text)}
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-[#86868B] text-[14px] italic py-[20px] text-center border border-[#333] rounded-[8px] bg-[#1a1a1a]">
                                                🔒 열람 권한이 없습니다.
                                            </div>
                                        )}
                                        <div className="clear-both mb-[16px]"></div>
                                        
                                        {/* Attached Files List */}
                                        {checkUserAccess(log) && log.metadata?.attachedFiles && log.metadata.attachedFiles.length > 0 && (
                                            <div className="flex flex-col gap-[8px] mb-[16px] border-t border-[#333] pt-[12px]">
                                                <div className="text-[12px] font-bold text-[#86868B] mb-[4px]">첨부파일</div>
                                                <div className="flex flex-wrap gap-[8px]">
                                                    {log.metadata.attachedFiles.map((file, idx) => (
                                                        <button 
                                                            key={idx} 
                                                            type="button"
                                                            className="flex items-center gap-[6px] bg-[#222] hover:bg-[#333] border border-[#444] rounded-[8px] px-[12px] py-[8px] transition-colors group cursor-pointer"
                                                            onClick={(e) => handleDownloadFile(e, file.path, file.name)}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                                            <span className="text-[12px] text-[#A1A1AA] group-hover:text-[#E5E5E5] transition-colors truncate max-w-[200px]" title={file.name}>{file.name}</span>
                                                            <span className="text-[10px] text-[#555] ml-[4px]">{(file.size ? file.size / 1024 / 1024 : 0).toFixed(2)}MB</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Comments List */}
                                        {log.writer_name !== '시스템' && checkUserAccess(log) && log.metadata?.comments && log.metadata.comments.length > 0 && (
                                            <div className="flex flex-col gap-[8px] mb-[16px] border-t border-[#333] pt-[12px]">
                                                {log.metadata.comments.map(comment => (
                                                    <div key={comment.id} className="bg-[#222] rounded-[8px] p-[12px] flex justify-between group">
                                                        <div className="flex-1 min-w-0 pr-[16px]">
                                                            <div className="flex items-center gap-[8px] mb-[4px]">
                                                                <div className="w-[28px] h-[28px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                                    <img 
                                                                        src={`${import.meta.env.BASE_URL}${comment.author}.webp`} 
                                                                        alt={comment.author} 
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-[6px]">
                                                                    <span className="text-[13px] font-bold text-[#E5E5E5]">{comment.author}</span>
                                                                    {comment.created_at && new Date(comment.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(comment.created_at)) < 48 * 60 * 60 * 1000 && (
                                                                        <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[1px]">
                                                                            N
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] text-[#86868B]">
                                                                    {new Date(comment.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                </span>
                                                            </div>
                                                            <div className="text-[13px] text-[#A1A1AA] whitespace-pre-wrap break-words ml-[36px] mb-[6px]">{comment.text}</div>
                                                            <div className="flex items-center gap-[8px] ml-[36px]">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'like', comment.id); }}
                                                                    className={`flex items-center gap-[4px] transition-colors cursor-pointer ${comment.reactions?.like?.includes(memberInfo?.email) ? 'text-[#ff3b30]' : 'text-[#86868B] hover:text-[#A1A1AA]'}`}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill={comment.reactions?.like?.includes(memberInfo?.email) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                                                    {comment.reactions?.like?.length > 0 ? (
                                                                        <ReactionAvatarStack reactionEmails={comment.reactions.like} pilotMembers={pilotMembers} />
                                                                    ) : (
                                                                        <span className="text-[11px] font-medium">좋아요</span>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'check', comment.id); }}
                                                                    className={`flex items-center gap-[4px] transition-colors cursor-pointer ${comment.reactions?.check?.includes(memberInfo?.email) ? 'text-[#2997ff]' : 'text-[#86868B] hover:text-[#A1A1AA]'}`}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                                    {comment.reactions?.check?.length > 0 ? (
                                                                        <ReactionAvatarStack reactionEmails={comment.reactions.check} pilotMembers={pilotMembers} />
                                                                    ) : (
                                                                        <span className="text-[11px] font-medium">확인</span>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {comment.author_email === memberInfo?.email && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setCommentToDelete({ logId: log.log_id, commentId: comment.id }); }}
                                                                className="text-[12px] text-[#FF453A] opacity-0 group-hover:opacity-100 transition-opacity hover:underline cursor-pointer"
                                                            >
                                                                삭제
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Commenting Box */}
                                        {log.writer_name !== '시스템' && commentingLogId === log.log_id && (
                                            <div className="w-full mt-[16px] relative">
                                                <textarea
                                                    id={`comment-textarea-${log.log_id}`}
                                                    value={commentContent}
                                                    onChange={(e) => handleCommentContentChange(e, log.log_id)}
                                                    placeholder="댓글을 입력하세요... (@를 입력하여 담당자를 멘션할 수 있습니다)"
                                                    className="w-full bg-[#2a2a2c] border border-[#444] rounded-[8px] p-[12px] text-[14px] text-[#E5E5E5] leading-relaxed resize-y focus:outline-none focus:border-[#2997ff] min-h-[90px]"
                                                />
                                                {/* Comment Mention Dropdown */}
                                                {commentShowMentionDropdown && filteredCommentMentions.length > 0 && (
                                                    <div 
                                                        className="absolute bg-[#222] border border-[#333] rounded-[8px] py-[6px] w-[180px] max-h-[150px] overflow-y-auto z-[60] shadow-xl"
                                                        style={{ top: `${commentMentionPosition.top}px`, left: `${commentMentionPosition.left}px` }}
                                                    >
                                                        {filteredCommentMentions.map((name, i) => (
                                                            <div 
                                                                key={i} 
                                                                className="px-[12px] py-[8px] text-[13px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate flex items-center gap-[4px]"
                                                                onClick={() => handleCommentMentionSelect(name, log.log_id)}
                                                            >
                                                                <span className="text-[#86868B]">@</span>{name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex justify-end gap-[8px] mt-[8px]">
                                                    <button
                                                        onClick={() => setCommentingLogId(null)}
                                                        className="px-[12px] py-[6px] bg-transparent border border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] transition-colors cursor-pointer"
                                                    >
                                                        취소
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveComment(log.log_id)}
                                                        disabled={isSavingComment}
                                                        className="px-[12px] py-[6px] bg-[#2997ff] hover:bg-[#0071e3] border border-transparent rounded-[6px] text-[12px] text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {isSavingComment ? '저장 중...' : '등록'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="mt-[14px] flex items-end justify-between">
                                            <div className="text-[12px] text-[#555] font-medium">
                                                수정일자: {log.updated_at ? new Date(log.updated_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : new Date(log.created_at || log.work_date).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {log.writer_name !== '시스템' && checkUserAccess(log) && (
                                                <div className="flex items-center gap-[8px]">
                                                    {/* Post Reactions */}
                                                    <div className="flex items-center gap-[6px] mr-[8px]">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'like'); }}
                                                            className={`flex items-center gap-[4px] px-[8px] py-[4px] rounded-[6px] transition-colors border cursor-pointer ${log.metadata?.reactions?.like?.includes(memberInfo?.email) ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' : 'bg-[#222] border-[#333] hover:border-[#444] text-[#A1A1AA] hover:text-[#E5E5E5]'}`}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill={log.metadata?.reactions?.like?.includes(memberInfo?.email) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                                            {log.metadata?.reactions?.like?.length > 0 ? (
                                                                <ReactionAvatarStack reactionEmails={log.metadata.reactions.like} pilotMembers={pilotMembers} />
                                                            ) : (
                                                                <span className="text-[12px] font-medium">0</span>
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleToggleReaction(log.log_id, 'check'); }}
                                                            className={`flex items-center gap-[4px] px-[8px] py-[4px] rounded-[6px] transition-colors border cursor-pointer ${log.metadata?.reactions?.check?.includes(memberInfo?.email) ? 'bg-[#2997ff]/10 border-[#2997ff]/30 text-[#2997ff]' : 'bg-[#222] border-[#333] hover:border-[#444] text-[#A1A1AA] hover:text-[#E5E5E5]'}`}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                            {log.metadata?.reactions?.check?.length > 0 ? (
                                                                <ReactionAvatarStack reactionEmails={log.metadata.reactions.check} pilotMembers={pilotMembers} />
                                                            ) : (
                                                                <span className="text-[12px] font-medium">0</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {!editingLogId && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setCommentingLogId(log.log_id);
                                                                setCommentContent('');
                                                                setEditingLogId(null);
                                                            }}
                                                            className="px-[12px] py-[6px] bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] font-medium transition-all flex items-center gap-[6px] cursor-pointer"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                            댓글
                                                        </button>
                                                    )}
                                                    {!editingLogId && (memberInfo?.email === log.writer_staff_id || memberInfo?.name === log.writer_name) && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setEditingLogId(log.log_id);
                                                                setCommentingLogId(null);
                                                            }}
                                                            className="px-[12px] py-[6px] bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] font-medium transition-all cursor-pointer"
                                                        >
                                                            수정하기
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            </div>
                                        </div>
                                    </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
                {displayedLogs.length === 0 && (
                    <div className={isTaskBoard 
                        ? `${mobileMode ? 'py-[24px]' : 'py-[40px]'} text-center text-[14px] text-[#86868B] bg-[#1c1c1e] border border-[#2c2c2e] rounded-[16px] w-full`
                        : "py-[60px] text-center text-[14px] text-[#86868B]"
                    }>
                        {isLoading ? '데이터를 불러오는 중입니다...' : (isTaskBoard ? '등록된 글이 없습니다.' : '등록된 업무가 없습니다.')}
                    </div>
                )}

                {logsViewMode === 'full' && totalPages > 1 && (
                    <div className="w-full py-[24px] flex justify-center items-center gap-[12px]">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-[12px] py-[6px] rounded bg-[#222] border border-[#333] text-[#E5E5E5] text-[13px] hover:bg-[#333] disabled:opacity-50 transition-colors"
                        >이전</button>
                        <span className="text-[13px] text-[#A1A1AA] font-bold">{currentPage} / {totalPages}</span>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-[12px] py-[6px] rounded bg-[#222] border border-[#333] text-[#E5E5E5] text-[13px] hover:bg-[#333] disabled:opacity-50 transition-colors"
                        >다음</button>
                    </div>
                )}
            </div>

            {isTaskBoard && (
                <div className="mt-[10px] w-full">
                    <LogWriteBox 
                        memberInfo={memberInfo}
                        masterStakeholders={masterStakeholders}
                        pilotMembers={pilotMembers}
                        fetchLogs={fetchLogs}
                        fetchMasterStakeholders={fetchMasterStakeholders}
                        workspaceCode={workspaceCode}
                        workspaceLabel={workspaceLabel}
                        isTaskBoard={true}
                        taskId={taskId}
                        taskProject={taskProject}
                        defaultExpanded={true}
                        mobileMode={mobileMode}
                    />
                </div>
            )}

            {/* Edit Modal */}
            {editingLogId && (
                <div 
                    className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-[40px] overflow-y-auto"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    <div 
                        className="w-full max-w-[1000px] rounded-[24px] p-[2px] my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <LogWriteBox 
                            memberInfo={memberInfo}
                            masterStakeholders={masterStakeholders}
                            pilotMembers={pilotMembers}
                            fetchLogs={fetchLogs}
                            fetchMasterStakeholders={fetchMasterStakeholders}
                            workspaceCode={workspaceCode}
                            workspaceLabel={workspaceLabel}
                            editMode={true}
                            initialData={logs.find(l => l.log_id === editingLogId)}
                            onCancel={() => setEditingLogId(null)}
                            onSuccess={() => setEditingLogId(null)}
                            isTaskBoard={isTaskBoard}
                            taskId={taskId}
                            taskProject={taskProject}
                            mobileMode={mobileMode}
                        />
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {(logToDelete || commentToDelete) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px] text-center">{logToDelete ? '해당 업무를 삭제하시겠습니까?' : '댓글을 삭제하시겠습니까?'}</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">이 작업은 되돌릴 수 없습니다.</p>
                        <div className="flex items-center gap-[12px] w-full">
                            <button 
                                type="button"
                                onClick={() => { setLogToDelete(null); setCommentToDelete(null); }}
                                className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors"
                                disabled={isDeleting}
                            >
                                취소
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    if (logToDelete) handleDelete(logToDelete.log_id);
                                    else if (commentToDelete) handleDeleteComment(commentToDelete.logId, commentToDelete.commentId);
                                }}
                                className="flex-1 py-[10px] rounded-[8px] bg-white hover:bg-gray-200 text-black text-[13px] font-bold transition-colors flex justify-center items-center"
                                disabled={isDeleting}
                            >
                                {isDeleting ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </div>
            </div>
        </div>
    );
}
