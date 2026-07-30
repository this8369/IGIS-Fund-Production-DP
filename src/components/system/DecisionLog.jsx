import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { notifyMembersOnCommentCreation } from '../../utils/notificationHelpers';
import { fetchDirectorWorkflowLogs, getDirectorLogCell, getDirectorStaffCell } from '../../utils/directorWorkflowLogs';
import { normalizeIotaOrganization } from '../../utils/iotaOrganizations.js';
import { fetchPmoBoardTasks } from '../../utils/pmoBoardDataCache.js';
import { fetchWorkspaceDirectoryData } from '../../utils/workspaceDirectoryCache.js';
import { motion, AnimatePresence } from 'framer-motion';
import ReactionAvatarStack from './ReactionAvatarStack';
import PmoTaskBoardStaging, { FALLBACK_BOARD_TASKS } from './pmo/PmoTaskBoardStaging';

export default function DecisionLog() {
        const navigate = (path) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.history.pushState(null, '', base + (path.startsWith('/') ? path : '/' + path));
        window.dispatchEvent(new Event('popstate'));
    };
    const { memberInfo } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('key');
    const [pageSize, setPageSize] = useState(10);
    const [addNewTaskTrigger, setAddNewTaskTrigger] = useState(0);
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [logsViewMode, setLogsViewMode] = useState('full');
    const [currentPage, setCurrentPage] = useState(1);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    
    // Header Filter states
    const [filterStakeholder, setFilterStakeholder] = useState('');
    const [filterCell, setFilterCell] = useState('');
    const [filterPurpose, setFilterPurpose] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    // Delete states
    const [logToDelete, setLogToDelete] = useState(null);
    const [commentToDelete, setCommentToDelete] = useState(null); // { logId, commentId }
    const [isDeleting, setIsDeleting] = useState(false);
    const [showMeetingsInfo, setShowMeetingsInfo] = useState(false);
    const [showMyLogsOnly, setShowMyLogsOnly] = useState(false);
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const [pilotMembers, setPilotMembers] = useState([]);
    const [showAllCrossFunctional, setShowAllCrossFunctional] = useState(false);
    const [activeCadenceTab, setActiveCadenceTab] = useState('internal');
    const [pmoTasks, setPmoTasks] = useState([]);
    const [expandedCadenceRow, setExpandedCadenceRow] = useState(null);
    const [cadenceLogs, setCadenceLogs] = useState({});
    const [isLoadingCadenceLogs, setIsLoadingCadenceLogs] = useState(false);

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

    // IOTA Edge Function Logs states
    const [iotaLogs, setIotaLogs] = useState([]);
    const [isLoadingIotaLogs, setIsLoadingIotaLogs] = useState(true);
    const [iotaLogsError, setIotaLogsError] = useState(null);
    const [iotaLogsLineFilter, setIotaLogsLineFilter] = useState('전체');
    const [iotaLogsSearchQuery, setIotaLogsSearchQuery] = useState('');
    const [selectedIotaLog, setSelectedIotaLog] = useState(null);

    const handleCadenceRowClick = async (rowId, meetingName) => {
        if (expandedCadenceRow === rowId) {
            setExpandedCadenceRow(null);
            return;
        }
        setExpandedCadenceRow(rowId);
        
        if (!cadenceLogs[meetingName]) {
            setIsLoadingCadenceLogs(true);
            try {
                const { data } = await supabase
                    .from('iota_meeting_logs')
                    .select('*')
                    .eq('meeting_type', meetingName)
                    .order('meeting_date', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(3);
                setCadenceLogs(prev => ({ ...prev, [meetingName]: data || [] }));
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingCadenceLogs(false);
            }
        }
    };

    const commentMentionCandidates = Array.from(new Set([
        ...(masterStakeholders?.map(s => s.contact_name) || []),
        ...(pilotMembers?.map(m => m.staff_name) || [])
    ].filter(Boolean)));
    const filteredCommentMentions = commentMentionCandidates.filter(name => name.toLowerCase().includes(commentMentionQuery.toLowerCase())).slice(0, 5);

    const renderLogTextWithMentions = (text) => {
        if (!text) return null;
        if (!masterStakeholders || masterStakeholders.length === 0) return text;
        const names = Array.from(new Set(masterStakeholders.map(s => s.contact_name).filter(Boolean)));
        if (names.length === 0) return text;

        const escapedNames = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedNames.join('|')})`, 'g');
        const parts = text.split(regex);

        return parts.map((part, i) => {
            if (names.includes(part)) {
                return <span key={i} className="text-[#82afb9] font-bold">{part}</span>;
            }
            return part;
        });
    };

    const internalMeetings = [
        { meeting: 'Iota 임원 보고회', period: '월 1회 (3주차)', leader: '부문대표(이철승)', attendees: '부대표진·CFT 총괄·셀 리드 5인', output: '월간 사업보고서, T1 의사결정 사안 통과' },
        { meeting: 'CFT 운영위', period: '격주 (수)', leader: 'CFT 총괄(부문대표 겸직)', attendees: 'PM·5개 셀 리드·KAM 1파트', output: 'UW 범위 외 의사결정, 변경관리 승인' },
        { meeting: '주간 PM Stand-up', period: '주 1회 (월)', leader: 'PM(강순용)', attendees: '5개 셀 실무 책임자', output: '주간 진척, Top10 리스크, 7일 액션' },
        { meeting: 'LP 정기보고 미팅', period: '분기 1회', leader: 'KAM 1파트(김행단)', attendees: 'PM·LFC·운용지원·외부 LP', output: '분기보고서, Q&A 로그' },
        { meeting: '대주단 보고', period: '월/분기', leader: 'LFC(박준호)', attendees: 'PM·KAM·외부 대주단', output: 'Covenants 모니터링 보드, 차주 통지' },
        { meeting: 'IPR WG', period: '격주 (목)', leader: '프리츠 TFT (권순일)', attendees: 'CFT 총괄·PM·외부자문(법무·회계·감정)', output: 'Forward Purchase 구조설계서, 약정 초안' },
        { meeting: '분기 회고(Retro)', period: '분기 말', leader: 'CFT 총괄', attendees: '전 셀 리드·실무 핵심 인력', output: 'KPI/OKR 리뷰, 원인분석, 차분기 OKR' }
    ];

    const externalMeetings = [
        { meeting: '이오타 1 (현대건설)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: '현대건설 및 금융주관사들', output: '' },
        { meeting: '이오타 2 (삼성물산)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: '삼성물산 및 금융주관사들', output: '' },
        { meeting: '통합PF (NH투자증권)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: 'NH투자증권', output: '' }
    ];

    const triggers = [
        { condition: 'UW 범위 외 일정/예산 변경이 식별된 경우', action: 'CFT 운영위 임시 소집' },
        { condition: '대주단 Covenants 위반 가능성 식별', action: 'LFC 주재 긴급 라운드' },
        { condition: '핵심 임차인 협상 결렬 또는 LOI 철회', action: 'EMC 주재 임시 LM 회의' },
        { condition: '규제·인허가·소송 이슈 발생', action: 'CFT 총괄 직속 비상 회의' },
        { condition: 'LP 임시 출자·임시 분배 요청', action: 'KAM 1파트 주재 펀드 회의' }
    ];

    const formatDateYYMMDD = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}.${mm}.${dd}`;
    };

    const formatIotaWeekRange = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const yearStr = String(monday.getFullYear()).slice(-2);
        const mondayMonth = monday.getMonth() + 1;
        const sundayMonth = sunday.getMonth() + 1;
        return `${yearStr}.${mondayMonth}.${monday.getDate()}~${sundayMonth}.${sunday.getDate()}`;
    };

    const formatDateWithTime = (dateString, timeString) => {
        if (!timeString && !dateString) return { date: '', time: '' };
        const dDate = new Date(dateString || timeString);
        const yy = String(dDate.getFullYear()).slice(2);
        const mm = String(dDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dDate.getDate()).padStart(2, '0');
        
        const dTime = new Date(timeString || dateString);
        const hh = String(dTime.getHours()).padStart(2, '0');
        const min = String(dTime.getMinutes()).padStart(2, '0');
        
        return {
            date: `${yy}.${mm}.${dd}`,
            time: `${hh}:${min}`
        };
    };

    const getCellName = getDirectorStaffCell;
    const getLogCell = getDirectorLogCell;

    const getWorkspacePath = (log) => {
        if (log.metadata?.workspace_code) {
            const code = log.metadata.workspace_code.toLowerCase();
            if (code.includes('pm1')) return 'platform/iotaseoul/workspace/pm1';
            if (code.includes('pm2')) return 'platform/iotaseoul/workspace/pm2';
            if (code.includes('pm')) return 'platform/iotaseoul/workspace/pm1';
            if (code.includes('financing') || code.includes('lfc')) return 'platform/iotaseoul/workspace/financing';
            if (code.includes('development') || code.includes('dsc')) return 'platform/iotaseoul/workspace/development';
            if (code.includes('marketing') || code.includes('emc')) return 'platform/iotaseoul/workspace/marketing';
            if (code.includes('digital') || code.includes('ssc')) return 'platform/iotaseoul/workspace/digital';
            if (code.includes('fund') || code.includes('kam')) return 'platform/iotaseoul/workspace/fund';
            if (code.includes('ipr')) return 'platform/iotaseoul/workspace/ipr';
        }
        const cell = getLogCell(log);
        if (cell.includes('사업1파트')) return 'platform/iotaseoul/workspace/pm1';
        if (cell.includes('사업2파트')) return 'platform/iotaseoul/workspace/pm2';
        if (cell.includes('LFC')) return 'platform/iotaseoul/workspace/financing';
        if (cell.includes('개발솔루션')) return 'platform/iotaseoul/workspace/development';
        if (cell.includes('기업마케팅')) return 'platform/iotaseoul/workspace/marketing';
        if (cell.includes('공간솔루션')) return 'platform/iotaseoul/workspace/digital';
        if (cell.includes('KAM')) return 'platform/iotaseoul/workspace/fund';
        if (cell.includes('IPR')) return 'platform/iotaseoul/workspace/ipr';
        return null;
    };

    const fetchMasterStakeholders = async () => {
        try {
            const directory = await fetchWorkspaceDirectoryData();
            setMasterStakeholders(directory.stakeholders);
            setPilotMembers(directory.pilotMembers);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('iota_seoul_logs')
                .select('*, iota_seoul_log_stakeholders(sh_name, role_category)')
                .order('work_date', { ascending: false })
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            const validLogs = (data || []).filter(log => getCellName(log.writer_name) !== '기타');
            setLogs(validLogs);

            try {
                const taskData = await fetchPmoBoardTasks();
                const sorted = [...taskData].sort((a, b) => {
                    const dateA = new Date(a.created_at || 0).getTime();
                    const dateB = new Date(b.created_at || 0).getTime();
                    if (dateA !== dateB) return dateA - dateB;
                    return String(a.id).localeCompare(String(b.id));
                });
                setPmoTasks(sorted.map((task, index) => ({
                    ...task,
                    displayId: `T-${String(index + 1).padStart(3, '0')}`,
                })));
            } catch (err) {
                console.warn("Failed to fetch PMO tasks in DecisionLog:", err);
            }
        } catch (e) {
            console.error('Error fetching logs:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchIotaLogs = async (force = false) => {
        setIsLoadingIotaLogs(true);
        setIotaLogsError(null);
        try {
            const workflowLogs = await fetchDirectorWorkflowLogs({ force });
            setIotaLogs(workflowLogs);
        } catch (err) {
            console.error('Error fetching iota-logs:', err);
            setIotaLogsError(err.message || '로그를 불러오는 데 실패했습니다.');
        } finally {
            setIsLoadingIotaLogs(false);
        }
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

    useEffect(() => {
        const deferredDataTimer = window.setTimeout(() => {
            fetchLogs();
            fetchMasterStakeholders();
            fetchIotaLogs();
        }, 300);
        
        const handleRefetch = () => {
            fetchLogs();
            fetchMasterStakeholders();
            fetchIotaLogs(true);
        };
        window.addEventListener('refetch-data', handleRefetch);
        
        return () => {
            window.clearTimeout(deferredDataTimer);
            window.removeEventListener('refetch-data', handleRefetch);
        };
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const logId = queryParams.get('logId');
        if (logId && logs.length > 0) {
            setExpandedLogs(prev => ({ ...prev, [logId]: true }));
            setTimeout(() => {
                const el = document.getElementById(`log-card-${logId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('bg-[#3b82f6]/10', 'border-[#3b82f6]/30');
                    setTimeout(() => {
                        el.classList.remove('bg-[#3b82f6]/10', 'border-[#3b82f6]/30');
                    }, 2500);
                }
                const cleanUrl = window.location.pathname + window.location.hash;
                window.history.replaceState(null, '', cleanUrl);
            }, 500);
        }
    }, [logs]);

    const toggleExpand = (id) => {
        setExpandedLogs(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleDeleteClick = (log) => {
        setLogToDelete(log);
    };

    const confirmDelete = async () => {
        if (!logToDelete) return;
        setIsDeleting(true);
        try {
            const { error: stakeholdersError } = await supabase
                .from('iota_seoul_log_stakeholders')
                .delete()
                .eq('log_id', logToDelete.log_id);

            if (stakeholdersError) {
                console.error('Error deleting stakeholders:', stakeholdersError);
                throw stakeholdersError;
            }

            const { error } = await supabase
                .from('iota_seoul_logs')
                .delete()
                .eq('log_id', logToDelete.log_id);

            if (error) throw error;
            
            setLogs(logs.filter(l => l.log_id !== logToDelete.log_id));
            setLogToDelete(null);
        } catch (err) {
            console.error('Delete error:', err);
            alert('삭제 중 오류가 발생했습니다.');
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
        } catch (e) {
            console.error('Error saving edit:', e);
            alert('수정 중 오류가 발생했습니다.');
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
                code: log.metadata?.workspace_code || 'all',
                label: log.metadata?.workspace_label || '전체업무현황'
            };
            notifyMembersOnCommentCreation(logId, commentContent, workspace, memberInfo?.email);
            
            setCommentContent('');
        } catch (e) {
            console.error('Error saving comment:', e);
            alert('댓글 저장 중 오류가 발생했습니다.');
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
            alert('댓글 삭제 중 오류가 발생했습니다.');
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

    const itemsPerPage = logsViewMode === 'summary' ? 5 : 15;
    
    // Filter by search query and dropdowns
    const searchFilteredLogs = logs.filter(log => {
        if (log.writer_name === '시스템 스케줄러') return false;
        if (showMyLogsOnly && log.writer_staff_id !== memberInfo?.email) return false;
        if (filterStakeholder && log.iota_seoul_log_stakeholders?.[0]?.role_category !== filterStakeholder) return false;
        if (filterCell && getLogCell(log) !== filterCell) return false;
        if (filterPurpose && (log.metadata?.triage_type || '공유') !== filterPurpose) return false;
        if (filterStatus && (log.metadata?.issue_status || '진행중') !== filterStatus) return false;
        if (filterPriority && (log.metadata?.priority || '중간') !== filterPriority) return false;

        if (!logSearchQuery) return true;
        const query = logSearchQuery.toLowerCase();
        const rawMatch = (log.raw_text || '').toLowerCase().includes(query);
        const nameMatch = (log.writer_name || '').toLowerCase().includes(query);
        const cellMatch = getLogCell(log).toLowerCase().includes(query);
        const shMatch = (log.iota_seoul_log_stakeholders?.[0]?.sh_name || '').toLowerCase().includes(query);
        return rawMatch || nameMatch || cellMatch || shMatch;
    });

    const totalPages = Math.ceil(searchFilteredLogs.length / itemsPerPage);
    const displayedLogs = searchFilteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


    const workspaces = [
        { id: 'ws1', label: '사업 PM', cell: '사업PM', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { id: 'ws2', label: 'LFC', cell: 'LFC', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'ws3', label: '개발솔루션', cell: '개발솔루션', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543-.94-3.31.826-2.37 2.37a1.724 1.724 0 00-1.065 2.572c-1.756.426-1.756 2.924 0 3.35a1.724 1.724 0 001.066 2.573c-.94 1.543.826 3.31 2.37 2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg> },
        { id: 'ws4', label: '기업마케팅', cell: '기업마케팅', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
        { id: 'ws5', label: '공간솔루션', cell: '공간솔루션', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
        { id: 'ws6', label: 'KAM', cell: 'KAM', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'ws7', label: 'IPR', cell: 'IPR', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
        { id: 'ws8', label: '기획추진', cell: '기획추진', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="1.5"></circle><circle cx="12" cy="12" r="6" strokeWidth="1.5"></circle><circle cx="12" cy="12" r="2" strokeWidth="1.5"></circle></svg> }
    ];

    const activeStatus = ['신규', '검토중', '진행중'];
    const activeLogs = logs.filter(l => activeStatus.includes(l.metadata?.issue_status || '진행중'));
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Group active logs by cell
    const issuesByWorkspace = workspaces.map(ws => {
        const cellLogs = activeLogs.filter(l => getLogCell(l) === ws.cell);
        const totalCount = cellLogs.length;
        const recentLogs = cellLogs.filter(l => new Date(l.work_date || l.created_at) >= twoWeeksAgo);
        const recentCount = recentLogs.length;
        const wsLogs = recentLogs.slice(0, 3);
        
        return { ...ws, logs: wsLogs, recentCount, totalCount };
    });

    const today = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${days[today.getDay()]})`;

    const CELL_REPRESENTATIVES = {
        '사업PM': '권순일/강순용',
        '기업마케팅': '김민지'
    };

    const crossFunctionalLogs = logs.filter(log => {
        if (log.writer_name === '시스템 스케줄러') return false;
        const logDate = new Date(log.work_date || log.created_at);
        if (logDate < oneWeekAgo) return false;
        if (!log.metadata?.workspace_label) return false; // Only workspace logs

        const writerCell = getCellName(log.writer_name);
        const isTaskLog = !!log.metadata?.task_id;
        if (!isTaskLog) return false; // 상단 영역은 통합업무보드 크로스펑셔널 업무만 노출
        const targetCell = "통합업무보드";
        
        const normWriter = writerCell.replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');
        const normTarget = targetCell.replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');

        if (normWriter === '기타') return false;

        return normWriter !== normTarget;
    });

    const getLineBadgeStyle = (cell) => {
        const norm = (cell || '').replace(/\s+/g, '').toUpperCase();
        if (norm.includes('PM') || norm.includes('사업1파트') || norm.includes('사업2파트')) {
            return 'bg-[#30d158]/10 text-[#34d399] border border-[#30d158]/20'; // Green
        } else if (norm.includes('LFC') || norm.includes('파이낸싱')) {
            return 'bg-[#0a84ff]/10 text-[#60a5fa] border border-[#0a84ff]/20'; // Blue
        } else if (norm.includes('DSC') || norm.includes('개발솔루션')) {
            return 'bg-[#ffd60a]/10 text-[#fbbf24] border border-[#ffd60a]/20'; // Yellow
        } else if (norm.includes('EMC') || norm.includes('기업마케팅')) {
            return 'bg-[#ff375f]/10 text-[#ff6b8b] border border-[#ff375f]/20'; // Rose/Pink
        } else if (norm.includes('SSC') || norm.includes('공간솔루션')) {
            return 'bg-[#30b0c7]/10 text-[#5ac8fa] border border-[#30b0c7]/20'; // Cyan/Teal
        } else if (norm.includes('KAM') || norm.includes('펀드운용')) {
            return 'bg-[#34c759]/10 text-[#30d158] border border-[#34c759]/20'; // Emerald/Green
        } else if (norm.includes('IPR')) {
            return 'bg-[#bf5af2]/10 text-[#c084fc] border border-[#bf5af2]/20'; // Purple
        }
        return 'bg-[#8e8e93]/10 text-[#9ca3af] border border-[#8e8e93]/20'; // Gray
    };

    const filteredIotaLogs = iotaLogs.filter(log => {
        if (iotaLogsLineFilter !== '전체') {
            const line = log.line || '';
            if (line !== iotaLogsLineFilter) return false;
        }
        if (iotaLogsSearchQuery.trim()) {
            const query = iotaLogsSearchQuery.toLowerCase();
            const title = (log.title || '').toLowerCase();
            const summary = (log.summary || '').toLowerCase();
            const rawText = (log.raw_text || '').toLowerCase();
            const writer = (log.writer_name || '').toLowerCase();
            const lineVal = (log.line || '').toLowerCase();
            if (!title.includes(query) && !summary.includes(query) && !rawText.includes(query) && !writer.includes(query) && !lineVal.includes(query)) {
                return false;
            }
        }
        return true;
    });

    const isStaging = true; // Forced true to deploy the new integrated task board to production

    return (
        <div className="w-full flex-1 flex flex-col pt-[28px] pb-[60px] pl-[60px] pr-[60px] box-border">
            {/* Header Metadata (Staging Only) */}
            {isStaging && (
                <div className="w-full flex flex-col mb-[12px] gap-[10px] min-w-[1200px]">
                    <div className="flex justify-between items-end w-full">
                        {/* Left: Title & Search Box */}
                        <div className="flex items-center gap-[16px]">
                            <h1 className="text-[32px] font-bold text-white tracking-tight leading-none font-['Inter']">통합업무보드</h1>
                            {/* Search Input Box directly to the right of title */}
                            <div className="relative w-[280px] self-center ml-[10px]">
                                <input 
                                    type="text" 
                                    placeholder="업무명, 담당자, 부서, 산출물 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#1c1c1e]/60 border border-[#3c3c3c] rounded-[10px] pl-9 pr-8 py-1.5 text-[13px] text-white outline-none focus:border-[#2997ff] focus:ring-1 focus:ring-[#2997ff] transition-all placeholder-[#86868B]"
                                />
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-white text-[11px] font-bold bg-white/5 hover:bg-white/10 rounded-full w-4.5 h-4.5 flex items-center justify-center cursor-pointer transition-colors"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            {/* View mode toggle button group */}
                            <div className="flex bg-[#1c1c1e]/60 border border-[#3c3c3c] rounded-[10px] p-0.5 ml-3 self-center shrink-0">
                                <button
                                    onClick={() => setViewMode('key')}
                                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer ${
                                        viewMode === 'key' 
                                            ? 'bg-[#3a3a3c] text-white shadow-sm' 
                                            : 'text-[#86868B] hover:text-[#f5f5f7] bg-transparent'
                                    }`}
                                >
                                    간추려보기
                                </button>
                                <button
                                    onClick={() => setViewMode('all')}
                                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer ${
                                        viewMode === 'all' 
                                            ? 'bg-[#3a3a3c] text-white shadow-sm' 
                                            : 'text-[#86868B] hover:text-[#f5f5f7] bg-transparent'
                                    }`}
                                >
                                    자세히보기
                                </button>
                            </div>

                            {/* Page size toggle button group */}
                            <div className="flex bg-[#1c1c1e]/60 border border-[#3c3c3c] rounded-[10px] p-0.5 ml-3 self-center shrink-0">
                                <button
                                    onClick={() => setPageSize(10)}
                                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer ${
                                        pageSize === 10 
                                            ? 'bg-[#3a3a3c] text-white shadow-sm' 
                                            : 'text-[#86868B] hover:text-[#f5f5f7] bg-transparent'
                                    }`}
                                >
                                    10개씩 보기
                                </button>
                                <button
                                    onClick={() => setPageSize(20)}
                                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer ${
                                        pageSize === 20 
                                            ? 'bg-[#3a3a3c] text-white shadow-sm' 
                                            : 'text-[#86868B] hover:text-[#f5f5f7] bg-transparent'
                                    }`}
                                >
                                    20개씩 보기
                                </button>
                            </div>

                            {/* 새 업무 추가 버튼 */}
                            <button
                                onClick={() => setAddNewTaskTrigger(prev => prev + 1)}
                                className="px-4 py-1.5 bg-[#bdbba7]/10 hover:bg-[#bdbba7]/20 border border-[#bdbba7]/30 hover:border-[#bdbba7] rounded-[10px] text-[12px] font-bold text-[#bdbba7] transition-all cursor-pointer ml-3 flex items-center gap-1.5 shrink-0"
                            >
                                <span>+ 새 업무 추가</span>
                            </button>

                            {/* Date Pill (moved to the right of Add Task button) */}
                            <span className="text-[15px] font-bold text-[#86868B] tracking-tight bg-[#222] px-[16px] py-[6px] rounded-full shadow-sm leading-none ml-6 self-center shrink-0">
                                {formattedDate}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 통합 업무 보드 (Staging Only) */}
            {isStaging && (
                <PmoTaskBoardStaging 
                    searchQuery={searchQuery} 
                    setSearchQuery={setSearchQuery} 
                    viewMode={viewMode} 
                    setViewMode={setViewMode}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    addNewTaskTrigger={addNewTaskTrigger}
                />
            )}

            {/* IOTA CFT 실시간 통합 업무 로그 */}
            <div className="w-full mb-[44px]">
                {/* Header with Title, Search and Line Filters */}
                <div className="flex flex-col gap-[10px] mb-[12px]">
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-[20px] font-bold text-white tracking-tight shrink-0 flex items-center gap-2">
                            <span>{isStaging ? 'Director 주요업무 보고' : 'IOTA CFT 통합 업무 로그'}</span>
                            <span className="text-[12px] bg-[#3b82f6]/20 text-[#60a5fa] px-2 py-0.5 rounded-md font-semibold font-mono animate-pulse">LIVE</span>
                        </h2>
                        
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('platform/iotaseoul/workflow/logs-archive')}
                                className="px-4 py-1.5 bg-[#272726] hover:bg-[#333] border border-[#3c3c3c] hover:border-[#555] rounded-full text-[13px] font-bold text-[#A1A1AA] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                                <span>지난 업무 전체보기</span>
                                <svg className="w-3.5 h-3.5 text-[#86868B] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </button>

                            {/* Search Input */}
                            <div className="relative w-[280px]">
                                <input
                                    type="text"
                                    value={iotaLogsSearchQuery}
                                    onChange={(e) => setIotaLogsSearchQuery(e.target.value)}
                                    placeholder="피드 내용 검색..."
                                    className="w-full bg-[#1A1A1A] border border-[#3c3c3c] rounded-full pl-9 pr-4 py-1.5 text-white text-[13px] outline-none focus:border-[#86868b] transition-colors"
                                />
                                <svg className="w-4 h-4 absolute left-3 top-2 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {iotaLogsSearchQuery && (
                                    <button 
                                        onClick={() => setIotaLogsSearchQuery('')}
                                        className="absolute right-3 top-2 text-[#86868b] hover:text-white"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-[8px] overflow-x-auto scrollbar-hide">
                        {['전체', '사업1파트', '사업2파트', 'LFC', '개발솔루션', '기업마케팅', '공간솔루션', 'KAM', 'IPR'].map(lineFilter => (
                            <button
                                key={lineFilter}
                                onClick={() => setIotaLogsLineFilter(lineFilter)}
                                className={`px-[14px] py-[2px] rounded-full text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                                    iotaLogsLineFilter === lineFilter
                                        ? 'text-white border-[1px] border-transparent [background:linear-gradient(#1F1F1E,#1F1F1E)_padding-box,linear-gradient(to_bottom_right,#d6efe9,#82afb9,#4c6e86)_border-box]'
                                        : 'bg-transparent border border-[#333] text-[#86868B] hover:text-white hover:border-[#555]'
                                }`}
                            >
                                {lineFilter}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoadingIotaLogs ? (
                    <div className="w-full h-[260px] flex items-center justify-center border border-[#333] rounded-[24px]">
                        <span className="text-[#86868B] text-[15px] animate-pulse">실시간 로그를 불러오는 중입니다...</span>
                    </div>
                ) : iotaLogsError ? (
                    <div className="w-full h-[260px] flex flex-col items-center justify-center border border-[#ef4444]/30 rounded-[24px] bg-[#ef4444]/5">
                        <span className="text-[#ef4444] text-[15px] font-bold mb-2">연동 중 에러 발생</span>
                        <span className="text-[#86868B] text-[13px]">{iotaLogsError}</span>
                    </div>
                ) : filteredIotaLogs.length === 0 ? (
                    <div className="w-full h-[260px] flex items-center justify-center border border-[#333] rounded-[24px] bg-[#1a1a1a]/50">
                        <span className="text-[#86868B] text-[14px]">조건에 일치하는 업무 로그가 없습니다.</span>
                    </div>
                ) : (
                    <div className="-ml-[7px] -mr-[calc(50vw-50%)] p-[6px] border-y border-l border-[#333] rounded-l-[30px]">
                        <div 
                            className="w-full flex gap-[12px] overflow-x-auto snap-x pr-[40px] custom-thin-scrollbar rounded-l-[24px]"
                        >
                            {filteredIotaLogs.slice(0, 20).map(log => (
                                <div 
                                    key={log.id}
                                    onClick={() => setSelectedIotaLog(log)}
                                    className="min-w-[400px] max-w-[400px] min-h-[360px] shrink-0 rounded-[24px] px-[24px] pt-[20px] pb-[30px] snap-start flex flex-col gap-[14px] bg-[#272727] border border-[#3c3c3c] hover:bg-[#323232] hover:border-[#555] transition-all cursor-pointer group"
                                >
                                    {/* Author & Badge */}
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-[10px]">
                                            <div className="w-[36px] h-[36px] rounded-full bg-[#3c3c3c] overflow-hidden border border-[#555] shrink-0">
                                                <img 
                                                    src={`${import.meta.env.BASE_URL}${log.writer_name}.webp`} 
                                                    alt={log.writer_name} 
                                                    className="w-full h-full object-cover" 
                                                    onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} 
                                                />
                                            </div>
                                            <div className="flex flex-col text-left">
                                                <span className="text-white font-bold text-[13.5px] leading-tight">{log.writer_name}</span>
                                                <span className="text-[#86868B] text-[11px] mt-[1px] leading-tight truncate max-w-[180px]">{log.writer_email}</span>
                                            </div>
                                        </div>
                                        <span className={`text-[11px] font-bold px-[8px] py-[3px] rounded-[6px] tracking-tight ${getLineBadgeStyle(log.line)}`}>
                                            {log.line || 'Unknown Line'}
                                        </span>
                                    </div>

                                    {/* Title & Summary */}
                                    <div className="flex flex-col gap-[6px] flex-1">
                                        <h4 className="text-[17px] font-bold text-white leading-snug group-hover:text-[#60a5fa] transition-colors line-clamp-1 text-left">
                                            {log.title || '업무 로그'}
                                        </h4>
                                        {(log.raw_text || log.body_text) && (
                                            <p className="text-[15px] text-[#A1A1AA] line-clamp-6 leading-relaxed text-left mt-2 border-t border-[#3a3a3c]/40 pt-2 font-normal whitespace-pre-wrap">
                                                {(() => {
                                                    const text = log.raw_text || log.body_text || '';
                                                    let formatted = text;
                                                    formatted = formatted.replace(/\s+([가-하])\.\s+/g, '\n$1. ');
                                                    formatted = formatted.replace(/\s+(\d+)\)\s+/g, '\n$1) ');
                                                    return formatted.replace(/\n+/g, '\n').trim();
                                                })()}
                                            </p>
                                        )}
                                    </div>

                                    {/* Date */}
                                    <div className="flex justify-between items-center pt-[10px] border-t border-[#3a3a3c]/40 mt-auto">
                                        <span className="text-[12px] font-medium text-[#86868B]">{formatIotaWeekRange(log.work_date)}</span>
                                        <div className="flex items-center gap-1 text-[13px] font-bold text-[#60a5fa] opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span>자세히 보기</span>
                                            <svg className="w-3.5 h-3.5 transform translate-x-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* Spacer */}
                            <div className="min-w-[calc(100vw-400px)] shrink-0 flex items-center justify-start px-[40px] select-none pointer-events-none box-border">
                                <div className="text-white opacity-[0.04] font-bold leading-[0.9] tracking-tighter w-full" style={{ fontSize: 'clamp(35px, 6vw, 100px)' }}>
                                    IOTA Seoul<br />Cross Functional<br />Team
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

                        {/* Workspace Issues Overview */}
            <div className="w-full flex flex-col gap-[12px] mb-[16px] -mt-[4px]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[16px]">
                        <h3 className="text-[20px] font-bold text-white tracking-tight mt-[4px]">지금 사람들이 모여 논의하는 주제</h3>
                        <p className="text-[14px] text-[#A1A1AA] font-medium translate-y-[2px]">최근 한주간 통합업무보드에 등록된 크로스펑셔널 업무 내역입니다.</p>
                    </div>
                    {crossFunctionalLogs.length > 6 && (
                        <button 
                            onClick={() => setShowAllCrossFunctional(!showAllCrossFunctional)}
                            className="px-[12px] py-[6px] text-[13px] font-bold text-[#86868B] hover:text-white border border-[#3c3c3c] hover:border-[#555] rounded-[8px] transition-colors"
                        >
                            {showAllCrossFunctional ? '간략히 보기' : '전체보기'}
                        </button>
                    )}
                </div>

                {crossFunctionalLogs.length === 0 ? (
                    <div className="w-full py-[60px] flex items-center justify-center border border-[#333] rounded-[24px] bg-[#222]">
                        <span className="text-[#86868B] text-[14px]">최근 2주간 크로스펑셔널 협업 내역이 없습니다.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px] items-start">
                        {(showAllCrossFunctional ? crossFunctionalLogs : crossFunctionalLogs.slice(0, 6)).map(log => {
                            const isTaskLog = !!log.metadata?.task_id;
                            const normWriter = getCellName(log.writer_name).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');
                            const normTarget = isTaskLog ? "통합업무보드" : getLogCell(log).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');
                            const targetRep = CELL_REPRESENTATIVES[normTarget];
                            const isRestricted = hasRestrictedPermissions(log);
                            
                            const taskId = log.metadata?.task_id;
                            const matchedTask = taskId ? (pmoTasks.find(t => String(t.id) === String(taskId)) || FALLBACK_BOARD_TASKS.find(t => String(t.id) === String(taskId))) : null;
                            const workspacePath = getWorkspacePath(log);

                            return (
                                <div key={log.log_id} className="bg-[#292928] border border-[#3c3c3c] hover:border-[#82afb9]/50 rounded-[24px] p-[16px] px-[20px] transition-all cursor-pointer group flex flex-col h-auto" onClick={() => toggleExpand(log.log_id)}>
                                    <div className="flex items-center gap-[20px]">
                                        {/* Sender -> Target Box */}
                                        <div className="shrink-0 bg-[#222] rounded-[16px] px-[12px] py-[12px] border border-[#333] flex items-center justify-between w-[210px]">
                                            <div className="flex flex-col items-center justify-center flex-1 w-0">
                                                <span className="text-[11px] font-bold text-[#A1A1AA] mb-[4px] truncate w-full text-center">{normWriter}</span>
                                                <div className="flex items-center gap-[4px] justify-center w-full min-w-0">
                                                    {log.writer_name === '시스템' ? (
                                                        <div className="w-[20px] h-[20px] rounded-full bg-[#1e2d24] border border-[#2e5c3e] flex items-center justify-center shrink-0">
                                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[11px] h-[11px]">
                                                                <circle cx="12" cy="12" r="3"></circle>
                                                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                                            </svg>
                                                        </div>
                                                    ) : (
                                                        <div className="w-[20px] h-[20px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                            <img src={`${import.meta.env.BASE_URL}${log.writer_name}.webp`} alt={log.writer_name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                                        </div>
                                                    )}
                                                    <span className="text-[13px] font-bold text-white truncate">{log.writer_name}</span>
                                                </div>
                                            </div>
                                            
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#82afb9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mx-[4px]"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
 
                                            <div className="flex flex-col items-center justify-center flex-1 w-0">
                                                {targetRep ? (
                                                    <React.Fragment>
                                                        <span className="text-[11px] font-bold text-[#82afb9] mb-[4px] truncate w-full text-center">{normTarget}</span>
                                                        <div className="flex items-center gap-[4px] justify-center w-full min-w-0">
                                                            <div className="w-[20px] h-[20px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                                <img src={`${import.meta.env.BASE_URL}${targetRep.split('/')[0].trim()}.webp`} alt={targetRep.split('/')[0].trim()} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                                            </div>
                                                            <span className="text-[13px] font-bold text-white truncate">{targetRep.split('/')[0].trim()}</span>
                                                        </div>
                                                    </React.Fragment>
                                                ) : (
                                                    <span className="text-[13px] font-bold text-[#82afb9] truncate w-full text-center">{normTarget}</span>
                                                )}
                                            </div>
                                        </div>
 
                                        {/* Title and Metadata on the right */}
                                        <div className="flex-1 flex flex-col pt-[4px]">
                                            {/* Header Row: Matched Task (left) & Date + Button (right) */}
                                            <div className="flex items-center justify-between w-full mb-[8px]">
                                                {matchedTask ? (
                                                    <div className="text-[12px] text-[#82afb9] font-bold flex items-center gap-[6px] min-w-0">
                                                        <span className="bg-[#82afb9]/10 border border-[#82afb9]/20 px-[6px] py-[1.5px] rounded-[4px] text-[10px] font-mono shrink-0">
                                                            {matchedTask.displayId || matchedTask.id}
                                                        </span>
                                                        <span className="truncate max-w-[150px] md:max-w-[180px]" title={matchedTask.task_name}>
                                                            {matchedTask.task_name}
                                                        </span>
                                                        {isRestricted && (
                                                            <span className="text-[10px] font-bold text-[#ef4444] bg-[#ef4444]/10 px-[5px] py-[1px] rounded-[4px] border border-[#ef4444]/20 shrink-0">
                                                                🔒 {getShortPermissionString(log)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-[6px]">
                                                        {isRestricted && (
                                                            <span className="text-[10px] font-bold text-[#ef4444] bg-[#ef4444]/10 px-[5px] py-[1px] rounded-[4px] border border-[#ef4444]/20 shrink-0">
                                                                🔒 {getShortPermissionString(log)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-[8px] shrink-0">
                                                    <span className="text-[12px] text-[#555] font-medium">{formatDateYYMMDD(log.work_date || log.created_at)}</span>
                                                    {(log.metadata?.task_id || workspacePath) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (log.metadata?.task_id) {
                                                                    window.location.href = `${import.meta.env.BASE_URL}platform/iotaseoul/workflow?taskId=${log.metadata.task_id}`;
                                                                } else {
                                                                    window.location.href = `${import.meta.env.BASE_URL}${workspacePath}`;
                                                                }
                                                            }}
                                                            className="text-[11px] text-[#82afb9] hover:text-white font-bold bg-[#82afb9]/10 border border-[#82afb9]/25 hover:bg-[#82afb9]/20 px-[8px] py-[2.5px] rounded-[6px] transition-all cursor-pointer whitespace-nowrap"
                                                        >
                                                            원문보기 ↗
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="text-[15px] font-bold text-[#E5E5E5] line-clamp-2 leading-snug group-hover:text-white transition-colors">
                                                {log.summary || (log.raw_text ? log.raw_text.split('\n')[0] : '')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Box for Cross Functional */}
                                    <AnimatePresence>
                                        {expandedLogs[log.log_id] && (
                                            <motion.div 
                                                className="w-full flex overflow-hidden mt-[16px] cursor-auto"
                                                onClick={(e) => e.stopPropagation()}
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                            >
                                                <div className="bg-[#222] border border-[#333] rounded-[12px] p-[16px] flex-1 relative w-full">
                                                    {/* Right Floating Badges */}
                                                    <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[12px]">
                                                        {isRestricted && (
                                                            <div className="flex flex-col items-end gap-[4px]">
                                                                <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">열람 권한</span>
                                                                <div className="bg-[#1e293b] border border-[#334155] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                                    <div className="flex flex-col leading-[1.2]">
                                                                        <span className="text-[12px] font-medium text-[#e2e8f0]">제한됨</span>
                                                                        {(memberInfo?.email === log.writer_staff_id || (memberInfo?.staff_name || memberInfo?.name) === (log.writer_name || log.author)) && (
                                                                            <span className="text-[10px] text-[#94a3b8] mt-[1px]">(내글)</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Original Text */}
                                                    {checkUserAccess(log) ? (
                                                        <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#E5E5E5]">
                                                            {log.metadata?.structured_changes?.length > 0 ? (
                                                                <div className="flex flex-col gap-[10px] mt-[4px]">
                                                                    {log.metadata.structured_changes.map((change, idx) => (
                                                                        <div key={idx} className="flex items-center gap-[8px] text-[13px]">
                                                                            <span className="text-[#86868B] font-medium w-[100px] shrink-0">{change.field}</span>
                                                                            <div className="flex items-center gap-[6px] flex-wrap">
                                                                                <span className="px-[8px] py-[3px] rounded-[4px] bg-[#222] text-[#86868B] border border-[#333] line-through decoration-[#86868B]/50">{change.from}</span>
                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" className="shrink-0">
                                                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                                                </svg>
                                                                                <span className="px-[8px] py-[3px] rounded-[4px] bg-[#3A3A3C] text-[#E5E5EA] border border-[#48484A] font-bold">{change.to}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                renderLogTextWithMentions(log.raw_text)
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[#86868B] text-[14px] italic py-[20px] text-center">
                                                            🔒 열람 권한이 없습니다.
                                                        </div>
                                                    )}
                                                    
                                                    {/* Post Reactions for Cross Functional */}
                                                    {checkUserAccess(log) && (
                                                        <div className="mt-[12px] flex items-center gap-[6px]">
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
                                                    )}

                                                    <div className="clear-both mb-[16px]"></div>
                                                    
                                                    {/* Comments List */}
                                                    {checkUserAccess(log) && log.metadata?.comments && log.metadata.comments.length > 0 && (
                                                        <div className="flex flex-col gap-[8px] mb-[16px] border-t border-[#333] pt-[12px]">
                                                            {log.metadata.comments.map(comment => (
                                                                <div key={comment.id} className="bg-[#292928] rounded-[8px] p-[12px] flex justify-between group/comment">
                                                                    <div className="flex-1 min-w-0 pr-[16px]">
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
                                                                                <span className="text-[13px] font-bold text-[#E5E5E5]">{comment.author}</span>
                                                                                {comment.created_at && new Date(comment.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(comment.created_at)) < 48 * 60 * 60 * 1000 && (
                                                                                    <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[1px]">
                                                                                        N
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-[13px] text-[#A1A1AA] whitespace-pre-wrap break-words ml-[32px] mb-[6px]">{comment.text}</div>
                                                                        <div className="flex items-center gap-[8px] ml-[32px]">
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
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 주요 회의체 히스토리 */}
            {!isStaging && (
                <div className="w-full flex flex-col mt-[22px] mb-[10px]">
                    <div className="flex items-center justify-between mb-[8px]">
                        <h3 className="text-[20px] font-bold text-white tracking-tight">주요 회의체 히스토리</h3>
                        
                        {/* Segmented Control */}
                        <div className="flex items-center bg-[#222] border border-[#333] rounded-[8px] p-[4px]">
                            <button
                                onClick={() => setActiveCadenceTab('internal')}
                                className={`px-[16px] py-[6px] text-[13px] font-bold rounded-[6px] transition-colors cursor-pointer ${activeCadenceTab === 'internal' ? 'bg-[#3c3c3c] text-white' : 'text-[#86868B] hover:text-white'}`}
                            >
                                이지스 내부
                            </button>
                            <button
                                onClick={() => setActiveCadenceTab('external')}
                                className={`px-[16px] py-[6px] text-[13px] font-bold rounded-[6px] transition-colors cursor-pointer ${activeCadenceTab === 'external' ? 'bg-[#3c3c3c] text-white' : 'text-[#86868B] hover:text-white'}`}
                            >
                                이지스 외부
                            </button>
                        </div>
                    </div>
                    
                    <div className="w-full border border-[#3c3c3c] bg-[#272726] rounded-[16px] overflow-hidden">
                        <table className="w-full text-left table-fixed">
                            <thead className="bg-transparent">
                                <tr>
                                    <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[210px]">회의체</th>
                                    <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[130px]">주기</th>
                                    <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[160px]">주재자</th>
                                    <th className="pl-[42px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[280px]">주요 참석자</th>
                                    <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c]">핵심 산출물</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#3c3c3c]">
                                {(activeCadenceTab === 'internal' ? internalMeetings : externalMeetings).map((row, idx) => {
                                    const rowId = `${activeCadenceTab}-${idx}`;
                                    const isExpanded = expandedCadenceRow === rowId;
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr 
                                                className={`hover:bg-[#333] transition-colors group cursor-pointer ${isExpanded ? 'bg-[#333]' : ''}`} 
                                                onClick={() => {
                                                    navigate(`/platform/iotaseoul/meeting-logs?type=${encodeURIComponent(row.meeting)}`);
                                                }}
                                            >
                                                <td className="pl-[22px] pr-[12px] py-[12px] text-[17px] text-[#E5E5E5] group-hover:text-white transition-colors text-left font-semibold whitespace-pre-wrap">{row.meeting}</td>
                                                <td className="pl-[22px] pr-[12px] py-[12px] text-[13px] transition-colors"><span className="inline-block px-[10px] py-[4px] rounded-[6px] bg-[#333] text-[#bdbba7] group-hover:bg-[#2997ff] group-hover:text-white transition-colors whitespace-nowrap">{row.period}</span></td>
                                                <td className="pl-[22px] pr-[12px] py-[12px] text-[13px] font-bold text-white whitespace-nowrap transition-colors">{row.leader}</td>
                                                <td className="pl-[42px] pr-[12px] py-[12px] text-[13px] text-[#bdbba7] text-left group-hover:text-[#E5E5E5] transition-colors">{row.attendees}</td>
                                                <td className="pl-[22px] pr-[12px] py-[12px] text-[13px] text-[#bdbba7] text-left group-hover:text-[#E5E5E5] transition-colors">{row.output}</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={5} className="bg-[#1F1F1E] p-[20px] border-b border-[#3c3c3c]">
                                                        {isLoadingCadenceLogs && !cadenceLogs[row.meeting] ? (
                                                            <div className="text-center text-[#86868B] text-[13px] py-[20px]">회의록 불러오는 중...</div>
                                                        ) : (
                                                            cadenceLogs[row.meeting]?.length === 0 ? (
                                                                <div className="text-center text-[#86868B] text-[13px] py-[20px]">최근 등록된 회의록이 없습니다.</div>
                                                            ) : (
                                                                <div className="flex gap-[12px]">
                                                                    {cadenceLogs[row.meeting]?.map(log => (
                                                                        <div 
                                                                            key={log.id} 
                                                                            onClick={() => {
                                                                                navigate(`/platform/iotaseoul/meeting-logs?type=${encodeURIComponent(row.meeting)}`);
                                                                            }}
                                                                            className="flex-1 bg-[#262626] rounded-[12px] border border-[#333] p-[16px] hover:border-[#444] transition-colors flex flex-col justify-between max-w-[33%] cursor-pointer group"
                                                                        >
                                                                            <div>
                                                                                <div className="flex justify-between items-start mb-[8px]">
                                                                                    <div className="flex items-center gap-[4px]">
                                                                                        <span className="text-[12px] text-[#2997ff] font-bold">{formatDateWithTime(log.meeting_date, log.created_at).date}</span>
                                                                                        <span className="text-[12px] text-[#86868B] font-medium">{formatDateWithTime(log.meeting_date, log.created_at).time}</span>
                                                                                    </div>
                                                                                    <span className="text-[11px] bg-[#333] text-[#E5E5E5] px-[6px] py-[2px] rounded-[4px]">{log.author_name}</span>
                                                                                </div>
                                                                                <h4 className="text-[14px] font-bold text-white mb-[8px] line-clamp-1">{log.title}</h4>
                                                                                <p className="text-[12px] text-[#A1A1AA] line-clamp-1 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                                                                            </div>
                                                                            <div className="mt-[12px] flex justify-between items-center">
                                                                                {log.metadata?.attachedFiles?.length > 0 ? (
                                                                                    <div className="flex items-center gap-[4px]">
                                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                                                                        <span className="text-[11px] text-[#86868B]">{log.metadata.attachedFiles.length}개 파일</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div></div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )
                                                        )}
                                                        {cadenceLogs[row.meeting]?.length > 0 && (
                                                            <div className="mt-[12px] flex justify-end">
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/platform/iotaseoul/meeting-logs?type=${encodeURIComponent(row.meeting)}`);
                                                                    }}
                                                                    className="flex items-center gap-[4px] text-[12px] text-[#2997ff] hover:text-[#5eb0ff] font-bold transition-colors bg-[#222] hover:bg-[#333] px-[12px] py-[6px] rounded-[6px] border border-[#333]"
                                                                >
                                                                    {row.meeting} 전체 회의록 보기
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Log Viewer */}
            <div id="log-viewer-header" className="flex justify-between items-center mt-[26px] mb-[12px] scroll-mt-[80px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight translate-y-[2px] mt-[4px]">CFT 협업 활동 전체보기</h2>
                <div className="flex items-center gap-[12px]">
                    

                    {/* My Logs Toggle */}
                    <button 
                        onClick={() => { setShowMyLogsOnly(!showMyLogsOnly); setCurrentPage(1); }}
                        className={`flex items-center px-[12px] py-[6px] rounded-[8px] text-[12px] font-bold border cursor-pointer transition-colors ${showMyLogsOnly ? 'bg-[#2997ff]/10 text-[#2997ff] border-[#2997ff]/30' : 'bg-transparent text-[#86868B] border-[#333] hover:text-[#E5E5E5] hover:border-[#444]'}`}
                    >
                        내 활동내역만 보기
                    </button>

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
                </div>
            </div>
            <div className="w-full border border-[#3c3c3c] rounded-[24px] mb-[30px] flex flex-col bg-[#252525]">
                {/* Header Row */}
                <div className="w-full px-[20px] py-[12px] flex items-center border-b border-[#3c3c3c] bg-transparent rounded-t-[24px]">
                    {/* Left Section */}
                    <div className="flex flex-1 min-w-0">
                        <div className="w-[86px] mr-[16px] text-center">
                            <span className="text-[13px] font-bold text-[#86868B]">프로젝트</span>
                        </div>
                        <div className="flex flex-1 min-w-0 translate-x-[-20px]">
                            <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                <select 
                                    value={filterCell}
                                    onChange={e => { setFilterCell(e.target.value); setCurrentPage(1); }}
                                    className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[60px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterCell ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 기능셀 ]</option>
                                    <option value="" className="bg-[#222] text-[#E5E5E5]">전체보기</option>
                                    {['사업1파트', '사업2파트', 'LFC', '개발솔루션', '기업마케팅', '공간솔루션', 'KAM', 'IPR', '기획추진', 'CFT 총괄'].map(val => (
                                        <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-[110px] shrink-0 translate-x-[10px] flex items-center">
                                <span className="text-[13px] font-bold text-[#86868B] pl-[20px]">등록자</span>
                            </div>
                            <div className="flex-1 min-w-0 translate-x-[2px] flex items-center">
                                <span className="text-[13px] font-bold text-[#86868B] px-[4px]">내용</span>
                            </div>
                        </div>
                    </div>
                    {/* Right Section */}
                    <div className="flex gap-[12px] shrink-0 ml-[12px] justify-end items-center">
                        <div className="w-[90px] shrink-0"></div>
                        <div className="w-[110px] mr-[4px] text-center flex items-center justify-center">
                            <select 
                                value={filterStakeholder}
                                onChange={e => { setFilterStakeholder(e.target.value); setCurrentPage(1); }}
                                className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[76px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterStakeholder ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                style={{ textAlignLast: 'center' }}
                            >
                                <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 이해관계자 ]</option>
                                <option value="" className="bg-[#222] text-[#E5E5E5]">전체보기</option>
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
                                <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 목적 ]</option>
                                <option value="" className="bg-[#222] text-[#E5E5E5]">전체보기</option>
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
                                <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 진행상태 ]</option>
                                <option value="" className="bg-[#222] text-[#E5E5E5]">전체보기</option>
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
                                <option disabled value="" className="bg-[#222] text-[#86868B] font-bold">[ 중요도 ]</option>
                                <option value="" className="bg-[#222] text-[#E5E5E5]">전체보기</option>
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
                {displayedLogs.map((log, index) => (
                    <div key={log.log_id} id={`log-card-${log.log_id}`} className="relative w-full px-[20px] py-[16px] flex flex-col group transition-colors hover:bg-white/5 last:rounded-b-[24px] border-b border-[#3c3c3c] transition-all duration-300">
                        {/* Main Row */}
                        <div 
                            className="w-full flex items-center justify-between cursor-pointer"
                            onClick={() => toggleExpand(log.log_id)}
                        >
                            {/* Left Section */}
                            <div className="flex items-center flex-1 min-w-0">
                                {/* Project Button */}
                                {(() => {
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

                                <div className="flex items-center flex-1 min-w-0 translate-x-[-20px]">
                                    {/* Cell Name */}
                                    <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                        <span className="text-[13px] font-medium text-[#86868B]">
                                            {getLogCell(log).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '')}
                                        </span>
                                    </div>

                                    {/* Avatar & Name */}
                                    <div className="flex items-center gap-[8px] w-[110px] shrink-0 translate-x-[10px]">
                                        <div className="w-[28px] h-[28px] rounded-full bg-[#333] overflow-hidden border border-[#444] flex items-center justify-center">
                                            {(log.writer_staff_id === 'system' || log.writer_staff_id === 'system_auto' || log.writer_name?.includes('시스템')) ? (
                                                <span className="text-[16px]">🤖</span>
                                            ) : (
                                                <img 
                                                    src={`${import.meta.env.BASE_URL}${log.writer_name}.webp`} 
                                                    alt={log.writer_name} 
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-[6px]">
                                            <span className="text-[14px] font-bold text-white">{log.writer_name}</span>
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
                                            {((log.created_at && new Date(log.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(log.created_at)) < 48 * 60 * 60 * 1000) || (log.updated_at && new Date(log.updated_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(log.updated_at)) < 48 * 60 * 60 * 1000)) && (
                                                <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[1px] ml-[4px]">
                                                    N
                                                </span>
                                            )}
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
                                    {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                        <span className="text-[13px] text-[#A1A1AA] text-center truncate" title={log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}>
                                            {log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}
                                        </span>
                                    )}
                                </div>
                                <div className="h-[24px] flex items-center w-[60px] justify-center translate-x-[6px]"><span className="text-[13px] text-[#A1A1AA] truncate">{log.metadata?.triage_type || '공유'}</span></div>
                                <div className="h-[24px] flex items-center w-[60px] justify-center"><span className="text-[13px] text-[#E5E5E5]">{log.metadata?.issue_status || '진행중'}</span></div>
                                <div className="h-[24px] flex items-center w-[40px] justify-center">
                                    <span className={`text-[13px] font-bold ${log.metadata?.priority === '높음' ? 'text-[#FF453A]' : (log.metadata?.priority === '낮음' ? 'text-[#86868B]' : 'text-[#3b82f6]')}`}>
                                        {log.metadata?.priority || '중간'}
                                    </span>
                                </div>
                                <div className="relative flex flex-col items-center w-[60px] shrink-0 justify-center">
                                    <span className="text-[13px] text-[#86868B] font-['Inter'] leading-tight">
                                        {formatDateYYMMDD(log.work_date || log.created_at)}
                                    </span>
                                    {expandedLogs[log.log_id] && log.created_at && (
                                        <span className="absolute top-[100%] text-[11px] text-[#555] font-['Inter'] leading-tight mt-[2px] whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Delete Button */}
                                {(memberInfo?.email === log.writer_staff_id || memberInfo?.name === log.writer_name) && (
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(log); }}
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
                                    className="bg-[#1c1c1e] border border-[#333] rounded-[12px] p-[16px] flex-1 relative"
                                    style={{ marginLeft: '166px', marginRight: '72px' }}
                                >
                                    {/* Right Floating Badges */}
                                    <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[12px]">
                                        {hasRestrictedPermissions(log) && (
                                            <div className="flex flex-col items-end gap-[4px]">
                                                <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">열람 권한</span>
                                                <div className="bg-[#1e293b] border border-[#334155] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    <div className="flex flex-col leading-[1.2]">
                                                        <span className="text-[12px] font-medium text-[#e2e8f0]">제한됨: {getPermissionString(log)}</span>
                                                        {(memberInfo?.email === log.writer_staff_id || (memberInfo?.staff_name || memberInfo?.name) === (log.writer_name || log.author)) && (
                                                            <span className="text-[10px] text-[#94a3b8] mt-[1px]">(내글)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
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
                                    {editingLogId === log.log_id ? (
                                        <div className="w-full">
                                            <textarea
                                                value={editingContent}
                                                onChange={(e) => setEditingContent(e.target.value)}
                                                className="w-full bg-[#2a2a2c] border border-[#444] rounded-[8px] p-[12px] text-[15px] text-[#E5E5E5] leading-relaxed resize-y focus:outline-none focus:border-[#2997ff] min-h-[180px]"
                                            />
                                            <div className="flex justify-end gap-[8px] mt-[12px]">
                                                <button
                                                    onClick={() => setEditingLogId(null)}
                                                    className="px-[12px] py-[6px] bg-transparent border border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] transition-colors cursor-pointer"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => handleSaveEdit(log.log_id)}
                                                    disabled={isSavingEdit}
                                                    className="px-[12px] py-[6px] bg-[#2997ff] hover:bg-[#0071e3] border border-transparent rounded-[6px] text-[12px] text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isSavingEdit ? '저장 중...' : '저장'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        checkUserAccess(log) ? (
                                            <div className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${commentingLogId === log.log_id ? 'text-[#86868B] opacity-70' : 'text-[#E5E5E5]'}`}>
                                                {log.metadata?.structured_changes?.length > 0 ? (
                                                    <div className="flex flex-col gap-[10px] mt-[4px]">
                                                        {log.metadata.structured_changes.map((change, idx) => (
                                                            <div key={idx} className="flex items-center gap-[8px] text-[13px]">
                                                                <span className="text-[#86868B] font-medium w-[100px] shrink-0">{change.field}</span>
                                                                <div className="flex items-center gap-[6px] flex-wrap">
                                                                    <span className="px-[8px] py-[3px] rounded-[4px] bg-[#222] text-[#86868B] border border-[#333] line-through decoration-[#86868B]/50">{change.from}</span>
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" className="shrink-0">
                                                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                                                    </svg>
                                                                    <span className="px-[8px] py-[3px] rounded-[4px] bg-[#3A3A3C] text-[#E5E5EA] border border-[#48484A] font-bold">{change.to}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    renderLogTextWithMentions(log.raw_text)
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-[#86868B] text-[14px] italic py-[20px] text-center">
                                                🔒 열람 권한이 없습니다.
                                            </div>
                                        )
                                    )}
                                    <div className="clear-both mb-[16px]"></div>
                                    
                                    {/* Comments List */}
                                    {checkUserAccess(log) && log.metadata?.comments && log.metadata.comments.length > 0 && (
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
                                                                {new Date(comment.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
                                    {checkUserAccess(log) && commentingLogId === log.log_id && (
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
                                    
                                    <div className="mt-[12px] flex items-end justify-between">
                                        <div className="text-[12px] text-[#555] font-medium">
                                            수정일자: {log.updated_at ? new Date(log.updated_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : new Date(log.created_at || log.work_date).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {checkUserAccess(log) && (
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
                                                        setEditingContent(log.raw_text);
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
                {isLoading ? (
                    <div className="py-[60px] flex flex-col items-center justify-center text-[14px] text-[#86868B]">
                        <div className="w-[24px] h-[24px] border-2 border-[#86868B]/30 border-t-[#86868B] rounded-full animate-spin mb-[12px]" />
                        데이터를 불러오는 중입니다...
                    </div>
                ) : displayedLogs.length === 0 && (
                    <div className="py-[60px] text-center text-[14px] text-[#86868B]">등록된 업무가 없습니다.</div>
                )}

                {logsViewMode === 'full' && totalPages > 1 && (
                    <div className="w-full py-3 flex justify-center items-center gap-[12px]">
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
                                    if (logToDelete) confirmDelete();
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

            {/* IOTA Log Detail Modal */}
            {selectedIotaLog && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-black/75 p-4"
                    onClick={() => setSelectedIotaLog(null)}
                >
                    <div 
                        className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-[32px] w-full max-w-[700px] max-h-[85vh] overflow-y-auto p-[32px] shadow-2xl flex flex-col gap-6 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button 
                            onClick={() => setSelectedIotaLog(null)}
                            className="absolute top-[24px] right-[24px] w-8 h-8 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] flex items-center justify-center text-[#86868b] hover:text-white transition-colors cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Modal Header */}
                        <div className="flex justify-between items-start gap-4 pr-10">
                            <div className="flex items-center gap-[14px]">
                                <div className="w-[48px] h-[48px] rounded-full bg-[#2c2c2e] overflow-hidden border border-[#444] shrink-0 flex items-center justify-center">
                                    {(selectedIotaLog.writer_staff_id === 'system' || selectedIotaLog.writer_staff_id === 'system_auto' || selectedIotaLog.writer_name?.includes('시스템')) ? (
                                        <span className="text-[28px]">🤖</span>
                                    ) : (
                                        <img 
                                            src={`${import.meta.env.BASE_URL}${selectedIotaLog.writer_name}.webp`} 
                                            alt={selectedIotaLog.writer_name} 
                                            className="w-full h-full object-cover" 
                                            onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} 
                                        />
                                    )}
                                </div>
                                <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-[6px]">
                                        <span className="text-white font-bold text-[16px] leading-tight">{selectedIotaLog.writer_name}</span>
                                        {((selectedIotaLog.created_at && new Date(selectedIotaLog.created_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(selectedIotaLog.created_at)) < 48 * 60 * 60 * 1000) || (selectedIotaLog.updated_at && new Date(selectedIotaLog.updated_at).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && (new Date() - new Date(selectedIotaLog.updated_at)) < 48 * 60 * 60 * 1000)) && (
                                            <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[0px]">
                                                N
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[#86868B] text-[13px] mt-[2px] leading-tight">{selectedIotaLog.writer_email}</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className={`text-[11px] font-bold px-[10px] py-[4px] rounded-[6px] tracking-tight ${getLineBadgeStyle(selectedIotaLog.line)}`}>
                                    {selectedIotaLog.line || 'Unknown Line'}
                                </span>
                                <span className="text-[13px] font-semibold text-[#86868b]">{formatIotaWeekRange(selectedIotaLog.work_date)}</span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-[#2c2c2e]" />

                        {/* Modal Content */}
                        <div className="flex flex-col gap-4 text-left">
                            <h3 className="text-[22px] font-black text-white tracking-tight leading-snug">
                                {selectedIotaLog.title || '업무 로그'}
                            </h3>

                            {/* Raw text */}
                            <div className="flex flex-col gap-2 mt-2">
                                <span className="text-[13px] font-bold text-[#86868b]">업무 기록 및 상세 내용</span>
                                <div className="p-5 bg-[#2c2c2e]/40 border border-[#2c2c2e] rounded-[20px] max-h-[350px] overflow-y-auto custom-thin-scrollbar">
                                    <p className="text-[17.5px] text-[#E5E5E5] leading-[1.7] whitespace-pre-wrap break-all">
                                        {(() => {
                                            const text = selectedIotaLog.raw_text || selectedIotaLog.body_text || '';
                                            let formatted = text;
                                            formatted = formatted.replace(/\s+([가-하])\.\s+/g, '\n$1. ');
                                            formatted = formatted.replace(/\s+(\d+)\)\s+/g, '\n$1) ');
                                            return formatted.replace(/\n+/g, '\n').trim() || '내용이 없습니다.';
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Notion Link Footer if present */}
                        {selectedIotaLog.source_url && (
                            <div className="flex justify-end mt-4">
                                <a 
                                    href={selectedIotaLog.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#ffffff] hover:bg-[#eaeaea] text-black text-[14px] font-bold rounded-xl transition-colors cursor-pointer"
                                >
                                    <svg className="w-4 h-4 text-black fill-current" viewBox="0 0 24 24">
                                        <path d="M4.6 2.05h14.8c1.37 0 2.5 1.13 2.5 2.5v14.8c0 1.37-1.13 2.5-2.5 2.5H4.6c-1.37 0-2.5-1.13-2.5-2.5V4.55c0-1.37 1.13-2.5 2.5-2.5zm.9 3.4c-.61 0-1.1.49-1.1 1.1v10.9c0 .61.49 1.1 1.1 1.1h12.8c.61 0 1.1-.49 1.1-1.1V6.55c0-.61-.49-1.1-1.1-1.1H5.5zm1.5 2h9.8c.28 0 .5.22.5.5v6.8c0 .28-.22.5-.5.5H7c-.28 0-.5-.22-.5-.5V7.95c0-.28.22-.5.5-.5z"/>
                                    </svg>
                                    <span>Notion에서 원문 보기</span>
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
