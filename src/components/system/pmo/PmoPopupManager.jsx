import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import WorkspaceActivityLog from '../workspace/WorkspaceActivityLog';
import { notifyMembersOnTaskCreation } from '../../../utils/notificationHelpers';

// Local Fallbacks to prevent UI crashes if DB queries return empty or fail
const FALLBACK_PROJECTS = [
    { project_code: 'IOTA_SEOUL', project_name: 'IOTA 공통' },
    { project_code: 'PFV_427', project_name: '427 PFV' },
    { project_code: 'PFV_816', project_name: '816 PFV' },
    { project_code: 'FUND_421', project_name: '421Fund' },
    { project_code: 'EXTERNAL', project_name: '외부' }
];

const FALLBACK_DEPARTMENTS = [
    { dept_code: 'DEPT_PM2', dept_name: '사업2파트' },
    { dept_code: 'DEPT_PO', dept_name: '기획추진' },
    { dept_code: 'DEPT_LFC', dept_name: 'LFC' },
    { dept_code: 'DEPT_DEV', dept_name: '개발솔루션' },
    { dept_code: 'DEPT_DESIGN', dept_name: '공간솔루션' },
    { dept_code: 'DEPT_MKT', dept_name: '기업마케팅' }
];

const CATEGORY_OPTIONS = [
    '공통 PMO', '인허가', '호텔/운영', '시공/원가', '도면/설계', '인테리어/TI',
    '임차/마케팅', 'PF/금융', '구조/법무/세무', '주주/보고', '준공/담보대출', '일반 요청'
];

const IMPACT_OPTIONS = ['높음', '중간', '낮음'];
const STATUS_OPTIONS = ['미착수', '진행중', '지연', '완료', '보류', '중단'];

export default function PmoPopupManager() {
    const { memberInfo, user } = useAuth();
    const [popups, setPopups] = useState([]);
    const [projects, setProjects] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [pilotMembers, setPilotMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePopupIds, setActivePopupIds] = useState(new Set());

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterProject, setFilterProject] = useState('전체보기');
    const [filterCategory, setFilterCategory] = useState('전체보기');
    const [filterStatus, setFilterStatus] = useState('전체보기');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [selectedPopup, setSelectedPopup] = useState(null);
    const [selectedPopupDetail, setSelectedPopupDetail] = useState(null);
    const initialUrlCheckedRef = useRef(false);

    // Form state
    const [formRequestDate, setFormRequestDate] = useState('');
    const [formRequester, setFormRequester] = useState('');
    const [formProjectCode, setFormProjectCode] = useState('');
    const [formCategoryName, setFormCategoryName] = useState('');
    const [formRequestDetail, setFormRequestDetail] = useState('');
    const [formPurpose, setFormPurpose] = useState('');
    const [formDeliverables, setFormDeliverables] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formAssignedDeptCode, setFormAssignedDeptCode] = useState('');
    const [formCoopDeptCodes, setFormCoopDeptCodes] = useState('');
    const [formImpactLevel, setFormImpactLevel] = useState('중간');
    const [formHandlingStatus, setFormHandlingStatus] = useState('미착수');
    const [formMemo, setFormMemo] = useState('');

    // Inline edit state
    const [activeStatusSelectId, setActiveStatusSelectId] = useState(null);

    // Delete confirmation state
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    // Autocomplete states
    const [showRequesterSuggestions, setShowRequesterSuggestions] = useState(false);
    const [showCoopSuggestions, setShowCoopSuggestions] = useState(false);
    const [tempRequesterVal, setTempRequesterVal] = useState('');

    // Check Roles
    const currentUserEmail = user?.email || memberInfo?.email || '';
    const isAdmin = memberInfo ? (['WS_PM2', 'WS_PM'].includes(memberInfo.workspace_code) || ['master', 'director'].includes(memberInfo.role_code)) : true;
    const canEditFormStatus = isAdmin || Boolean(
        modalMode === 'edit'
        && currentUserEmail
        && selectedPopup?.created_by_email === currentUserEmail
    );

    // Load Initial Data
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Popup Requests (unified table)
            const { data: popupData, error: popupErr } = await supabase
                .schema('iota_v2')
                .from('iota_pmo_tasks')
                .select('*')
                .eq('task_type', '팝업')
                .order('request_date', { ascending: false })
                .order('created_at', { ascending: false });
            if (popupErr) throw popupErr;

            const normalizedData = (popupData || []).map(p => {
                let status = p.status;
                if (!status || status === '접수' || status === '위임' || status === '반려') {
                    status = '미착수';
                }
                return {
                    id: p.id,
                    request_date: p.request_date,
                    requester: p.requester,
                    project_code: p.project_code,
                    category_name: p.category_main,
                    request_detail: p.task_name,
                    purpose: p.task_purpose,
                    deliverables: p.deliverables,
                    due_date: p.due_date,
                    assigned_dept_code: p.lead_dept_code,
                    coop_dept_codes: p.coop_dept_codes,
                    impact_level: p.importance_level,
                    handling_status: status,
                    memo: p.notes,
                    created_by_email: p.created_by_email
                };
            });
            setPopups(normalizedData);



            // 2. Fetch Projects
            const { data: projData, error: projErr } = await supabase
                .schema('iota_v2')
                .from('iota_projects')
                .select('*');
            if (!projErr && projData) setProjects(projData);
            else setProjects(FALLBACK_PROJECTS);

            // Fetch active popup IDs (recent logs within 48 hours, but only after feature deployment)
            try {
                const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
                const featureStartTime = '2026-07-13T09:02:39.000Z';
                const fetchStartTime = fortyEightHoursAgo > featureStartTime ? fortyEightHoursAgo : featureStartTime;

                const { data: recentLogs } = await supabase
                    .from('iota_seoul_logs')
                    .select('metadata')
                    .gte('created_at', fetchStartTime)
                    .contains('metadata', { workspace_label: '단발성 업무 요청' });
                
                const activeIds = new Set();
                if (recentLogs) {
                    recentLogs.forEach(log => {
                        if (log.metadata && log.metadata.task_id) {
                            activeIds.add(log.metadata.task_id);
                        }
                    });
                }
                setActivePopupIds(activeIds);
            } catch (e) {
                console.warn("Failed to fetch recent active popups:", e);
            }

            // 3. Fetch Departments
            const { data: deptData, error: deptErr } = await supabase
                .schema('iota_v2')
                .from('iota_departments')
                .select('*');
            if (!deptErr && deptData && deptData.length > 0) {
                // Map names dynamically to match user request (PM ➔ 파트, 펀드운용 ➔ KAM)
                let mappedDepts = deptData.map(d => {
                    if (d.dept_code === 'DEPT_PM2') return { ...d, dept_name: '사업2파트' };
                    return d;
                });
                // Ensure 기획추진 is always in the list
                if (!mappedDepts.some(d => d.dept_code === 'DEPT_PO')) {
                    mappedDepts = [
                        ...mappedDepts.filter(d => d.dept_code === 'DEPT_PM2'),
                        { dept_code: 'DEPT_PO', dept_name: '기획추진' },
                        ...mappedDepts.filter(d => d.dept_code !== 'DEPT_PM2')
                    ];
                }
                setDepartments(mappedDepts);
            } else {
                setDepartments(FALLBACK_DEPARTMENTS);
            }

            // 4. Fetch Pilot Members for autocomplete (public schema)
            const { data: memberData, error: memberErr } = await supabase
                .from('iota_seoul_pilot_members')
                .select('staff_name, org_name');
            if (!memberErr && memberData) setPilotMembers(memberData);

        } catch (err) {
            console.error("Failed to load popups dashboard data:", err);
            toast.error("데이터 로드에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const selectedPopupDetailRef = useRef(selectedPopupDetail);
    useEffect(() => {
        selectedPopupDetailRef.current = selectedPopupDetail;
    }, [selectedPopupDetail]);

    // Watch URL parameter changes dynamically (for mount and popstate events / notification clicks)
    useEffect(() => {
        const checkUrlParams = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlPopupId = params.get('popupId') || params.get('taskId');
            const urlLogId = params.get('logId');
            const currentDetail = selectedPopupDetailRef.current;

            let targetTaskId = urlPopupId || null;

            if (!targetTaskId && urlLogId) {
                try {
                    const { data: logRow, error: logRowErr } = await supabase
                        .from('iota_seoul_logs')
                        .select('metadata')
                        .eq('log_id', urlLogId)
                        .single();
                    if (!logRowErr && logRow && logRow.metadata?.task_id) {
                        targetTaskId = logRow.metadata.task_id;
                    }
                } catch (e) {
                    console.error("Failed to resolve logId to taskId:", e);
                }
            }

            if (targetTaskId) {
                try {
                    // Fetch the task directly from iota_pmo_tasks to verify type and existence
                    const { data: taskRow, error: taskErr } = await supabase
                        .schema('iota_v2')
                        .from('iota_pmo_tasks')
                        .select('*')
                        .eq('id', targetTaskId)
                        .maybeSingle();

                    if (!taskErr && taskRow) {
                        // If the task type is NOT a popup, redirect to the integration board page!
                        if (taskRow.task_type !== '팝업') {
                            console.log(`[PmoPopupManager] Redirecting taskId ${targetTaskId} to workflow board since its type is ${taskRow.task_type}`);
                            const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
                            const queryParam = urlLogId ? `logId=${urlLogId}` : `taskId=${targetTaskId}`;
                            window.location.href = `${base}/platform/iotaseoul/workflow?${queryParam}`;
                            return;
                        }

                        // It is indeed a popup task! Show the detail popup.
                        const matched = popups.find(item => String(item.id) === String(targetTaskId));
                        if (matched) {
                            if (!currentDetail || String(currentDetail.id) !== String(targetTaskId)) {
                                setSelectedPopupDetail(matched);
                            }
                        } else {
                            // If not found in popups state array yet (or filtered/not loaded), normalize from DB row
                            const normalized = {
                                id: taskRow.id,
                                request_date: taskRow.request_date,
                                requester: taskRow.requester,
                                project_code: taskRow.project_code,
                                category_name: taskRow.category_main,
                                request_detail: taskRow.task_name,
                                purpose: taskRow.task_purpose,
                                deliverables: taskRow.deliverables,
                                due_date: taskRow.due_date,
                                assigned_dept_code: taskRow.lead_dept_code,
                                coop_dept_codes: taskRow.coop_dept_codes,
                                impact_level: taskRow.importance_level,
                                handling_status: taskRow.status || '미착수',
                                memo: taskRow.notes,
                                created_by_email: taskRow.created_by_email
                            };
                            setSelectedPopupDetail(normalized);
                        }
                    } else {
                        // Task not found in DB
                        toast.error("요청하신 단발성 업무(글)가 존재하지 않거나 삭제되었습니다.");
                        const newParams = new URLSearchParams(window.location.search);
                        newParams.delete('popupId');
                        newParams.delete('taskId');
                        newParams.delete('logId');
                        const newSearch = newParams.toString();
                        window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
                    }
                } catch (err) {
                    console.error("Error verifying task ID:", err);
                }
                initialUrlCheckedRef.current = true;
            } else if (urlLogId) {
                // If logId was passed but couldn't be resolved to a task_id
                toast.error("요청하신 이력 또는 연계된 단발성 업무(글)가 존재하지 않거나 삭제되었습니다.");
                const newParams = new URLSearchParams(window.location.search);
                newParams.delete('logId');
                const newSearch = newParams.toString();
                window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
                initialUrlCheckedRef.current = true;
            }
        };

        checkUrlParams();

        const handlePopState = () => {
            checkUrlParams();
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [popups]);

    // Sync selectedPopupDetail to URL query param
    useEffect(() => {
        if (!selectedPopupDetail && !initialUrlCheckedRef.current) {
            return;
        }

        if (selectedPopupDetail) {
            const params = new URLSearchParams(window.location.search);
            let changed = false;
            if (params.get('popupId') !== String(selectedPopupDetail.id)) {
                params.set('popupId', selectedPopupDetail.id);
                changed = true;
            }
            if (params.has('logId')) {
                params.delete('logId');
                changed = true;
            }
            if (changed) {
                window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
            }
        } else {
            const params = new URLSearchParams(window.location.search);
            let changed = false;
            if (params.has('popupId')) {
                params.delete('popupId');
                changed = true;
            }
            if (params.has('taskId')) {
                params.delete('taskId');
                changed = true;
            }
            if (params.has('logId')) {
                params.delete('logId');
                changed = true;
            }
            if (changed) {
                const newSearch = params.toString();
                window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
            }
        }
    }, [selectedPopupDetail]);

    // Auto-scroll selected row into view
    useEffect(() => {
        if (selectedPopupDetail) {
            setTimeout(() => {
                const el = document.getElementById(`popup-row-${selectedPopupDetail.id}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 150);
        }
    }, [selectedPopupDetail]);

    // Summary Metric Counts
    const metrics = useMemo(() => {
        const counts = {
            total: popups.length,
            notStarted: 0,
            inProgress: 0,
            reviewing: 0,
            waiting: 0,
            delayed: 0,
            completed: 0,
            suspended: 0,
            stopped: 0
        };
        popups.forEach(p => {
            const status = p.handling_status;
            if (status === '미착수' || !status) counts.notStarted++;
            else if (status === '진행중') counts.inProgress++;
            else if (status === '검토중') counts.reviewing++;
            else if (status === '대기') counts.waiting++;
            else if (status === '지연') counts.delayed++;
            else if (status === '완료') counts.completed++;
            else if (status === '보류') counts.suspended++;
            else if (status === '중단') counts.stopped++;
        });
        return counts;
    }, [popups]);

    // Filter Tasks
    const filteredPopups = useMemo(() => {
        return popups.filter(p => {
            // Search Query
            const textMatch = searchQuery.trim() === '' || 
                (p.requester || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.request_detail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.purpose || '').toLowerCase().includes(searchQuery.toLowerCase());
            if (!textMatch) return false;

            // Project code
            if (filterProject !== '전체보기' && p.project_code !== filterProject) return false;

            // Category name
            if (filterCategory !== '전체보기' && p.category_name !== filterCategory) return false;

            // Handling status
            if (filterStatus !== '전체보기' && p.handling_status !== filterStatus) return false;

            return true;
        });
    }, [popups, searchQuery, filterProject, filterCategory, filterStatus]);

    // Handle Open Create Modal
    const openCreateModal = () => {
        setModalMode('create');
        setSelectedPopup(null);
        setFormRequestDate(new Date().toISOString().slice(0, 10));
        setFormRequester(memberInfo ? `${memberInfo.staff_name || memberInfo.name || ''} / ${memberInfo.org_name || ''}` : '');
        setFormProjectCode('IOTA_SEOUL');
        setFormCategoryName('일반 요청');
        setFormRequestDetail('');
        setFormPurpose('');
        setFormDeliverables('');
        setFormDueDate('');
        setFormAssignedDeptCode('DEPT_PM2');
        setFormCoopDeptCodes('');
        setFormImpactLevel('중간');
        setFormHandlingStatus('미착수');
        setFormMemo('');
        setIsModalOpen(true);
    };

    // Handle Open Edit Modal
    const openEditModal = (p) => {
        // Owner checking
        const isOwner = p.created_by_email === currentUserEmail;
        if (!isAdmin && !isOwner) {
            toast.error("직접 등록한 요청사항만 수정이 가능합니다.");
            return;
        }

        setModalMode('edit');
        setSelectedPopup(p);
        setFormRequestDate(p.request_date || '');
        setFormRequester(p.requester || '');
        setFormProjectCode(p.project_code || '');
        setFormCategoryName(p.category_name || '');
        setFormRequestDetail(p.request_detail || '');
        setFormPurpose(p.purpose || '');
        setFormDeliverables(p.deliverables || '');
        setFormDueDate(p.due_date || '');
        setFormAssignedDeptCode(p.assigned_dept_code || '');
        setFormCoopDeptCodes(p.coop_dept_codes || '');
        setFormImpactLevel(p.impact_level || '중간');
        setFormHandlingStatus(p.handling_status || '미착수');
        setFormMemo(p.memo || '');
        setIsModalOpen(true);
    };

    // Save Data (Insert / Update)
    const handleSave = async (e) => {
        e.preventDefault();
        if (!formRequester.trim() || !formRequestDetail.trim()) {
            toast.error("요청자와 요청업무는 필수 입력 사항입니다.");
            return;
        }

        const payload = {
            request_date: formRequestDate || null,
            requester: formRequester,
            project_code: formProjectCode || null,
            category_main: formCategoryName || null,
            task_name: formRequestDetail,
            task_purpose: formPurpose || null,
            deliverables: formDeliverables || null,
            due_date: formDueDate || null,
            lead_dept_code: formAssignedDeptCode || null,
            coop_dept_codes: formCoopDeptCodes || null,
            importance_level: formImpactLevel || null,
            status: formHandlingStatus || '미착수',
            notes: formMemo || null,
            task_type: '팝업',
            created_by_email: modalMode === 'create' ? currentUserEmail : selectedPopup.created_by_email
        };

        try {
            if (modalMode === 'create') {
                const { data, error } = await supabase
                    .schema('iota_v2')
                    .from('iota_pmo_tasks')
                    .insert([payload])
                    .select();

                if (error) throw error;
                toast.success("단발성 업무 요청이 성공적으로 등록되었습니다.");
            } else {
                // Track changes first
                const changes = [];
                
                const oldStatus = selectedPopup.handling_status || '미착수';
                const newStatus = formHandlingStatus || '미착수';
                if (oldStatus !== newStatus) {
                    changes.push(`상태가 "${oldStatus}"에서 "${newStatus}"으로 변경되었습니다.`);
                }

                const oldImportance = selectedPopup.impact_level || '중간';
                const newImportance = formImpactLevel || '중간';
                if (oldImportance !== newImportance) {
                    changes.push(`중요도가 "${oldImportance}"에서 "${newImportance}"으로 변경되었습니다.`);
                }

                const oldRequester = selectedPopup.requester || '';
                const newRequester = formRequester || '';
                if (oldRequester !== newRequester) {
                    changes.push(`요청부서가 "${oldRequester}"에서 "${newRequester}"으로 변경되었습니다.`);
                }

                const oldProj = getProjectName(selectedPopup.project_code);
                const newProj = getProjectName(formProjectCode);
                if (oldProj !== newProj) {
                    changes.push(`연계 프로젝트가 "${oldProj || '미지정'}"에서 "${newProj || '미지정'}"으로 변경되었습니다.`);
                }

                const oldCat = selectedPopup.category_name || '';
                const newCat = formCategoryName || '';
                if (oldCat !== newCat) {
                    changes.push(`업무 분류가 "${oldCat}"에서 "${newCat}"으로 변경되었습니다.`);
                }

                const oldDetail = selectedPopup.request_detail || '';
                const newDetail = formRequestDetail || '';
                if (oldDetail !== newDetail) {
                    changes.push(`업무명이 "${oldDetail}"에서 "${newDetail}"으로 변경되었습니다.`);
                }

                const oldPurpose = selectedPopup.purpose || '';
                const newPurpose = formPurpose || '';
                if (oldPurpose !== newPurpose) {
                    changes.push(`요청목적이 변경되었습니다.`);
                }

                const oldDeliv = selectedPopup.deliverables || '';
                const newDeliv = formDeliverables || '';
                if (oldDeliv !== newDeliv) {
                    changes.push(`필요 산출물이 변경되었습니다.`);
                }

                const oldDue = selectedPopup.due_date || '';
                const newDue = formDueDate || '';
                if (oldDue !== newDue) {
                    changes.push(`요청기한이 "${oldDue || '미지정'}"에서 "${newDue || '미지정'}"으로 변경되었습니다.`);
                }

                const oldDept = getDeptName(selectedPopup.assigned_dept_code);
                const newDept = getDeptName(formAssignedDeptCode);
                if (oldDept !== newDept) {
                    changes.push(`수행부서가 "${oldDept || '미지정'}"에서 "${newDept || '미지정'}"으로 변경되었습니다.`);
                }

                const { error } = await supabase
                    .schema('iota_v2')
                    .from('iota_pmo_tasks')
                    .update(payload)
                    .eq('id', selectedPopup.id);

                if (error) throw error;
                toast.success("정보가 성공적으로 수정되었습니다.");

                // If changes occurred, insert system log
                if (changes.length > 0) {
                    const logId = `iota_issue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    const logData = {
                        log_id: logId,
                        writer_name: '시스템',
                        writer_staff_id: 'system',
                        work_date: new Date().toISOString().slice(0, 10),
                        summary: '업무 변경 이력',
                        raw_text: `${changes.join('\n')}`,
                        input_status: 'submitted',
                        source_system: 'task_board',
                        metadata: {
                            is_task_board: true,
                            task_id: selectedPopup.id,
                            task_project: formProjectCode || 'IOTA_SEOUL',
                            workspace_code: 'WS_PMO',
                            workspace_label: '단발성 업무 요청',
                            editor_name: memberInfo?.staff_name || memberInfo?.name || '시스템'
                        }
                    };
                    await supabase.from('iota_seoul_logs').insert(logData);
                    await supabase.from('iota_seoul_log_links').insert({
                        link_id: `link_${logId}`,
                        log_id: logId,
                        proj_id: formProjectCode || 'IOTA_SEOUL',
                        relation_type: 'direct_input'
                    });
                    
                    window.dispatchEvent(new CustomEvent('iota_log_updated', { detail: { taskId: selectedPopup.id } }));
                }

                // Update selectedPopupDetail dynamically to keep drawer open and updated
                if (selectedPopupDetail && String(selectedPopupDetail.id) === String(selectedPopup.id)) {
                    setSelectedPopupDetail({
                        id: selectedPopup.id,
                        request_date: formRequestDate || null,
                        requester: formRequester,
                        project_code: formProjectCode || null,
                        category_name: formCategoryName || null,
                        request_detail: formRequestDetail,
                        purpose: formPurpose || null,
                        deliverables: formDeliverables || null,
                        due_date: formDueDate || null,
                        assigned_dept_code: formAssignedDeptCode || null,
                        coop_dept_codes: formCoopDeptCodes || null,
                        impact_level: formImpactLevel || null,
                        handling_status: formHandlingStatus || '미착수',
                        memo: formMemo || null,
                        created_by_email: selectedPopup.created_by_email
                    });
                }
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error("Failed to save popup request:", err);
            toast.error("저장에 실패했습니다: " + (err.message || err.details || err));
        }
    };

    // Quick Status Update
    const handleInlineStatusChange = async (popupId, newStatus) => {
        if (!isAdmin) {
            toast.error("처리방침은 관리자(PMO)만 변경 가능합니다.");
            return;
        }

        try {
            const popupObj = popups.find(p => p.id === popupId);
            const oldStatus = popupObj ? popupObj.handling_status : '미착수';

            const { error } = await supabase
                .schema('iota_v2')
                .from('iota_pmo_tasks')
                .update({ status: newStatus })
                .eq('id', popupId);

            if (error) throw error;
            setPopups(prev => prev.map(p => p.id === popupId ? { ...p, handling_status: newStatus } : p));
            toast.success(`처리방침이 '${newStatus}' 상태로 변경되었습니다.`);

            // Log changes
            if (oldStatus !== newStatus) {
                const changes = [`상태가 "${oldStatus}"에서 "${newStatus}"으로 변경되었습니다.`];
                const logId = `iota_issue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const logData = {
                    log_id: logId,
                    writer_name: '시스템',
                    writer_staff_id: 'system',
                    work_date: new Date().toISOString().slice(0, 10),
                    summary: '업무 변경 이력',
                    raw_text: `${changes.join('\n')}`,
                    input_status: 'submitted',
                    source_system: 'task_board',
                    metadata: {
                        is_task_board: true,
                        task_id: popupId,
                        task_project: popupObj?.project_code || 'IOTA_SEOUL',
                        workspace_code: 'WS_PMO',
                        workspace_label: '단발성 업무 요청',
                        editor_name: memberInfo?.staff_name || memberInfo?.name || '시스템'
                    }
                };
                await supabase.from('iota_seoul_logs').insert(logData);
                await supabase.from('iota_seoul_log_links').insert({
                    link_id: `link_${logId}`,
                    log_id: logId,
                    proj_id: popupObj?.project_code || 'IOTA_SEOUL',
                    relation_type: 'direct_input'
                });

                window.dispatchEvent(new CustomEvent('iota_log_updated', { detail: { taskId: popupId } }));
            }
        } catch (err) {
            console.error("Failed to update status in-place:", err);
            toast.error("상태 변경에 실패했습니다.");
        } finally {
            setActiveStatusSelectId(null);
        }
    };

    // Delete popup request
    const handleDelete = async () => {
        if (!deleteTargetId) return;
        try {
            const { error } = await supabase
                .schema('iota_v2')
                .from('iota_pmo_tasks')
                .delete()
                .eq('id', deleteTargetId);

            if (error) throw error;
            toast.success("요청 정보가 삭제되었습니다.");
            fetchData();
        } catch (err) {
            console.error("Failed to delete popup request:", err);
            toast.error("삭제에 실패했습니다. 권한을 확인하세요.");
        } finally {
            setDeleteTargetId(null);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case '미착수': return 'bg-white/5 text-[#a1a1aa] border border-white/10';
            case '진행중': return 'bg-[#2997ff]/10 text-[#2997ff] border border-[#2997ff]/20';
            case '검토중': return 'bg-[#bf5af2]/10 text-[#bf5af2] border border-[#bf5af2]/20';
            case '대기': return 'bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/20';
            case '지연': return 'bg-[#ff453a]/10 text-[#ff453a] border border-[#ff453a]/20';
            case '완료': return 'bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/20';
            case '보류': return 'bg-[#ffd60a]/10 text-[#ffd60a] border border-[#ffd60a]/20';
            case '중단': return 'bg-[#8e8e93]/10 text-[#8e8e93] border border-[#8e8e93]/20';
            default: return 'bg-white/5 text-[#a1a1aa] border border-white/10';
        }
    };

    const getImpactStyle = (level) => {
        switch (level) {
            case '높음': return 'text-[#ff453a] font-bold';
            case '보통':
            case '중간': return 'text-white font-medium';
            case '낮음': return 'text-[#8e8e93] font-medium';
            default: return 'text-[#8e8e93]';
        }
    };

    const getProjectName = (code) => {
        const match = projects.find(p => p.project_code === code);
        return match ? match.project_name : code || '-';
    };

    const getDeptName = (code) => {
        const match = departments.find(d => d.dept_code === code);
        return match ? match.dept_name : code || '-';
    };

    const getRequesterDeptOnly = (requesterStr) => {
        if (!requesterStr) return '-';
        if (requesterStr.includes('/')) {
            return requesterStr.split('/')[1].trim();
        }
        return requesterStr;
    };

    const mapOrgName = (staffName, orgName) => {
        if (!orgName) return '';
        const trimmedOrg = orgName.trim();
        if (trimmedOrg === '사업 PM' || trimmedOrg === '사업PM' || trimmedOrg === '사업 PM 1' || trimmedOrg === '사업 PM 2') {
            const pm2Members = ['강순용', '한찬호', '박석제', '박채현', '소현준', '이수정', '조영비', '한수정'];
            return pm2Members.includes(staffName.trim()) ? '사업2파트' : '사업1파트';
        }
        return trimmedOrg;
    };

    // Autocomplete filtering logic
    const filteredRequesters = useMemo(() => {
        if (!formRequester.trim()) return pilotMembers;
        const exactMatch = pilotMembers.some(m => `${m.staff_name} / ${mapOrgName(m.staff_name, m.org_name)}` === formRequester.trim());
        if (exactMatch) return [];
        return pilotMembers.filter(m => {
            const mappedOrg = mapOrgName(m.staff_name, m.org_name);
            return m.staff_name.toLowerCase().includes(formRequester.toLowerCase()) ||
                mappedOrg.toLowerCase().includes(formRequester.toLowerCase());
        });
    }, [formRequester, pilotMembers]);

    const lastCoopToken = useMemo(() => {
        const parts = formCoopDeptCodes.split(',');
        return parts[parts.length - 1].trim();
    }, [formCoopDeptCodes]);

    const filteredCoopDepts = useMemo(() => {
        if (!lastCoopToken) return [];
        return departments.filter(d => 
            d.dept_name.toLowerCase().includes(lastCoopToken.toLowerCase()) &&
            !formCoopDeptCodes.includes(d.dept_name)
        );
    }, [lastCoopToken, departments, formCoopDeptCodes]);

    const handleSelectCoop = (deptName) => {
        const parts = formCoopDeptCodes.split(',');
        parts[parts.length - 1] = ` ${deptName}`;
        setFormCoopDeptCodes(parts.join(',').trim() + ', ');
        setShowCoopSuggestions(false);
    };

    return (
        <div className="w-[1290px] mx-auto flex-1 flex flex-col pt-[28px] pb-[200px] box-border select-text text-white bg-transparent">
            <Toaster position="top-center" reverseOrder={false} />

            {/* Header Title Section */}
            <div className="w-full flex justify-between items-end mb-[18px]">
                <div className="flex flex-col text-left">
                    <h1 className="text-[32px] font-bold text-white tracking-tight leading-none mb-[8px]">단발성 업무 요청</h1>
                    <p className="text-[16px] text-[#86868B] leading-[26px]">정규 마일스톤 외에 개별적으로 발생하는 단발성 업무 요청 및 협업 사항을 관리합니다.</p>
                </div>

                <div className="flex items-center gap-3 select-none">
                    <button 
                        onClick={openCreateModal}
                        className="px-4 py-2 bg-[#2997ff]/10 border border-[#2997ff]/20 hover:bg-[#2997ff]/20 text-[#2997ff] rounded-[8px] text-[13px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        단발성 업무 요청 등록
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard Banner */}
            <div className="grid grid-cols-7 gap-2.5 mb-[12px]">
                <div 
                    onClick={() => setFilterStatus('전체보기')}
                    className={`py-2 px-1.5 rounded-[12px] border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${filterStatus === '전체보기' ? 'bg-[#2997ff]/10 border-[#2997ff] shadow-md shadow-[#2997ff]/5' : 'bg-[#2c2c2b]/60 border-[#3c3c3c] hover:border-[#555]'}`}
                >
                    <span className="text-[12px] font-medium text-[#86868B] mb-1">전체 요청</span>
                    <span className="text-[19px] font-extrabold text-white leading-none">{metrics.total}</span>
                </div>
                <div 
                    onClick={() => setFilterStatus('미착수')}
                    className={`py-2 px-1.5 rounded-[12px] border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${filterStatus === '미착수' ? 'bg-white/10 border-white/20 shadow-md' : 'bg-[#2c2c2b]/60 border-[#3c3c3c] hover:border-[#555]'}`}
                >
                    <span className="text-[12px] font-medium text-[#a1a1aa] mb-1">미착수</span>
                    <span className="text-[19px] font-extrabold text-[#a1a1aa] leading-none">{metrics.notStarted}</span>
                </div>
                <div 
                    onClick={() => setFilterStatus('진행중')}
                    className={`py-2 px-1.5 rounded-[12px] border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${filterStatus === '진행중' ? 'bg-[#2997ff]/10 border-[#2997ff] shadow-md shadow-[#2997ff]/5' : 'bg-[#2c2c2b]/60 border-[#3c3c3c] hover:border-[#555]'}`}
                >
                    <span className="text-[12px] font-medium text-[#2997ff] mb-1">진행중</span>
                    <span className="text-[19px] font-extrabold text-[#2997ff] leading-none">{metrics.inProgress}</span>
                </div>
                <div 
                    onClick={() => setFilterStatus('지연')}
                    className={`py-2 px-1.5 rounded-[12px] border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${filterStatus === '지연' ? 'bg-[#ff453a]/10 border-[#ff453a] shadow-md shadow-[#ff453a]/5' : 'bg-[#2c2c2b]/60 border-[#3c3c3c] hover:border-[#555]'}`}
                >
                    <span className="text-[12px] font-medium text-[#ff453a] mb-1">지연</span>
                    <span className="text-[19px] font-extrabold text-[#ff453a] leading-none">{metrics.delayed}</span>
                </div>
                <div 
                    onClick={() => setFilterStatus('완료')}
                    className={`py-2 px-1.5 rounded-[12px] border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${filterStatus === '완료' ? 'bg-[#30d158]/10 border-[#30d158] shadow-md shadow-[#30d158]/5' : 'bg-[#2c2c2b]/60 border-[#3c3c3c] hover:border-[#555]'}`}
                >
                    <span className="text-[12px] font-medium text-[#30d158] mb-1">완료</span>
                    <span className="text-[19px] font-extrabold text-[#30d158] leading-none">{metrics.completed}</span>
                </div>
                <div 
                    onClick={() => setFilterStatus('보류')}
                    className={`py-2 px-1.5 rounded-[12px] border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${filterStatus === '보류' ? 'bg-[#ffd60a]/10 border-[#ffd60a] shadow-md shadow-[#ffd60a]/5' : 'bg-[#2c2c2b]/60 border-[#3c3c3c] hover:border-[#555]'}`}
                >
                    <span className="text-[12px] font-medium text-[#ffd60a] mb-1">보류</span>
                    <span className="text-[19px] font-extrabold text-[#ffd60a] leading-none">{metrics.suspended}</span>
                </div>
                <div 
                    onClick={() => setFilterStatus('중단')}
                    className={`py-2 px-1.5 rounded-[12px] border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${filterStatus === '중단' ? 'bg-[#8e8e93]/10 border-[#8e8e93] shadow-md shadow-[#8e8e93]/5' : 'bg-[#2c2c2b]/60 border-[#3c3c3c] hover:border-[#555]'}`}
                >
                    <span className="text-[12px] font-medium text-[#8e8e93] mb-1">중단</span>
                    <span className="text-[19px] font-extrabold text-[#8e8e93] leading-none">{metrics.stopped}</span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-[#2c2c2b]/30 border border-[#3c3c3c]/40 rounded-[16px] py-3 pl-3 pr-4 mb-[12px] flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                    {/* Search query */}
                    <div className="relative w-[280px] shrink-0">
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="요청자, 업무명, 목적 검색..."
                            className="w-full pl-9 pr-4 py-2 bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] text-[13px] font-medium text-white placeholder-[#86868B] focus:border-[#2997ff] focus:outline-none transition-colors"
                        />
                        <svg className="w-4 h-4 text-[#86868B] absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Filter Project */}
                    <div className="flex items-center gap-1.5 select-none">
                        <span className="text-[12px] text-[#86868B] font-bold">프로젝트:</span>
                        <div className="relative inline-block">
                            <select 
                                value={filterProject}
                                onChange={(e) => setFilterProject(e.target.value)}
                                className="appearance-none bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] pl-3 pr-8 py-1.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                            >
                                <option value="전체보기">전체보기</option>
                                {projects.map(p => (
                                    <option key={p.project_code} value={p.project_code}>{p.project_name}</option>
                                ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Filter Category */}
                    <div className="flex items-center gap-1.5 select-none">
                        <span className="text-[12px] text-[#86868B] font-bold">업무분류:</span>
                        <div className="relative inline-block">
                            <select 
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="appearance-none bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] pl-3 pr-8 py-1.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                            >
                                <option value="전체보기">전체보기</option>
                                {CATEGORY_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Filter Status */}
                    <div className="flex items-center gap-1.5 select-none">
                        <span className="text-[12px] text-[#86868B] font-bold">상태:</span>
                        <div className="relative inline-block">
                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="appearance-none bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] pl-3 pr-8 py-1.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                            >
                                <option value="전체보기">전체보기</option>
                                {STATUS_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spreadsheet Grid Table */}
            {loading ? (
                <div className="h-[360px] bg-transparent border border-[#3c3c3c] rounded-[24px] flex items-center justify-center">
                    <span className="text-[#86868B] text-[15px] animate-pulse">요청 데이터를 연동하고 있습니다...</span>
                </div>
            ) : (
                <div className="border border-[#3c3c3c] bg-[#272726] rounded-[24px] overflow-hidden shadow-2xl flex flex-col">
                    <div className="w-full overflow-x-auto pr-0 timeline-scrollbar pb-1">
                        <table className="text-left table-fixed border-collapse w-[1290px] min-w-[1290px] select-text">
                            <thead className="bg-transparent">
                                <tr className="border-b border-[#3c3c3c] h-[46px]">
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[74px]">접수일</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[84px]">요청부서</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[80px]">프로젝트</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[90px]">업무분류</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 w-[278px]">업무명</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 w-[150px]">요청목적</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 w-[150px]">필요 산출물</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[74px]">요청기한</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[80px]">수행부서</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[70px]">중요도</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] border-r border-[#3c3c3c]/50 text-center w-[70px]">상태</th>
                                    <th className="px-3 py-0 text-[13px] font-bold text-[#86868B] text-center w-[90px]">작업</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#3c3c3c]/50 bg-transparent">
                                {filteredPopups.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="py-20 text-center text-[#86868B] text-[14px]">
                                            조건에 만족하는 단발성 업무 요청 정보가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPopups.map((p, index) => {
                                        const isOwner = p.created_by_email === currentUserEmail;
                                        const canEdit = isAdmin || (currentUserEmail && isOwner);
                                        const isPopupNew = activePopupIds.has(p.id) || (
                                            p.request_date && 
                                            new Date(p.request_date).getTime() >= new Date('2026-07-13T09:02:39Z').getTime() && 
                                            (new Date() - new Date(p.request_date)) < 48 * 60 * 60 * 1000
                                        );

                                        return (
                                            <tr 
                                                key={p.id} 
                                                id={`popup-row-${p.id}`}
                                                onDoubleClick={() => canEdit && openEditModal(p)}
                                                onClick={() => setSelectedPopupDetail(p)}
                                                className={`hover:bg-white/[0.06] transition-colors group text-[13px] h-[50px] cursor-pointer ${
                                                    selectedPopupDetail && selectedPopupDetail.id === p.id 
                                                        ? 'bg-[#3c3c3a] text-white' 
                                                        : 'bg-transparent text-white/80'
                                                }`}
                                            >
                                                {/* Date (Format: yy.mm.dd, font 1px smaller) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-[#86868B] text-center font-medium text-[12px] align-middle">
                                                    {p.request_date ? p.request_date.slice(2).replace(/-/g, '.') : '-'}
                                                </td>

                                                {/* Requesting Department (Center aligned, requester name deleted) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-center font-bold text-[#E5E5E5] truncate align-middle" title={getRequesterDeptOnly(p.requester)}>
                                                    {getRequesterDeptOnly(p.requester)}
                                                </td>

                                                {/* Project (with badge, 80px, center-aligned) */}
                                                <td className="px-1.5 py-2 border-r border-[#3c3c3c]/50 text-center font-bold align-middle">
                                                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold border inline-block align-middle max-w-full truncate ${
                                                        p.project_code === 'IOTA_SEOUL' ? 'bg-[#323233] text-[#F5F5F7] border-[#424243]' :
                                                        p.project_code === 'PFV_427' ? 'bg-[#3A3A3C] text-[#FFFFFF] border-[#48484A]' :
                                                        p.project_code === 'PFV_816' ? 'bg-[#2C2C2E] text-[#E5E5EA] border-[#3A3A3C]' :
                                                        p.project_code === 'FUND_421' ? 'bg-[#242426] text-[#D1D1D6] border-[#323234]' :
                                                        'bg-[#1C1C1E] text-[#AEAEB2] border-[#2C2C2E]'
                                                    }`}>
                                                        {getProjectName(p.project_code)}
                                                    </span>
                                                </td>

                                                {/* Category (업무분류, 90px, Center aligned) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-center text-white/80 font-medium truncate align-middle" title={p.category_name}>
                                                    {p.category_name || '-'}
                                                </td>

                                                {/* Task Details (업무명, 220px, truncate) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-[#bdbba7] font-bold truncate align-middle" title={p.request_detail}>
                                                    <div className="flex items-center gap-[6px] truncate w-full">
                                                        <span className="truncate">{p.request_detail}</span>
                                                        {isPopupNew && (
                                                            <span className="shrink-0 inline-flex items-center justify-center px-[4px] py-[2px] rounded-[3px] text-[10px] font-black bg-[#ff3b30] text-white leading-none tracking-wider relative top-[0px]">
                                                                N
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Purpose (요청목적, 150px, truncate) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-[#86868B] truncate align-middle" title={p.purpose || '-'}>
                                                    {p.purpose || '-'}
                                                </td>

                                                {/* Deliverables (필요 산출물, 150px, truncate) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-[#86868B] font-medium truncate align-middle" title={p.deliverables || '-'}>
                                                    {p.deliverables || '-'}
                                                </td>

                                                {/* Deadline (Format: yy.mm.dd, text-[12px], c3c2b7 color) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-[#c3c2b7] text-center font-semibold text-[12px] align-middle">
                                                    {p.due_date ? p.due_date.slice(2).replace(/-/g, '.') : '-'}
                                                </td>

                                                {/* Executing Department (Nametag Style, 80px, center-aligned) */}
                                                <td className="px-1.5 py-2 border-r border-[#3c3c3c]/50 text-center align-middle">
                                                    {(() => {
                                                        const deptName = getDeptName(p.assigned_dept_code);
                                                        return deptName && deptName !== '-' ? (
                                                            <span className="inline-flex items-center justify-center px-2 py-0.5 bg-[#27272a] text-[#d4d4d8] border border-[#3f3f46] rounded-[4px] text-[11px] font-medium max-w-full truncate align-middle">
                                                                {deptName}
                                                            </span>
                                                        ) : '-';
                                                    })()}
                                                </td>

                                                {/* Importance (중요도, 80px, center-aligned) */}
                                                <td className="px-3 py-2 border-r border-[#3c3c3c]/50 text-center align-middle">
                                                    <span className={getImpactStyle(p.impact_level)}>
                                                        {p.impact_level || '중간'}
                                                    </span>
                                                </td>

                                                {/* Status (상태, 70px, center-aligned) */}
                                                <td className="px-1.5 py-2 border-r border-[#3c3c3c]/50 text-center select-none align-middle">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono tracking-tight align-middle ${getStatusStyle(p.handling_status)}`}>
                                                        {p.handling_status || '미착수'}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3 py-2 text-center align-middle">
                                                    {canEdit ? (
                                                        <div className="flex items-center justify-center gap-1.5 select-none opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                                                                title="수정하기"
                                                                className="p-1 hover:bg-[#3A3A3C] text-[#2997ff] rounded-md transition-colors cursor-pointer align-middle"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setDeleteTargetId(p.id); }}
                                                                title="삭제하기"
                                                                className="p-1 hover:bg-[#3A3A3C] text-[#ff453a] rounded-md transition-colors cursor-pointer align-middle"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-white/20 select-none align-middle">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTargetId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200000] transition-all select-none">
                    <div className="bg-[#272726] border border-[#3c3c3c] w-full max-w-[360px] rounded-[20px] p-6 text-center shadow-2xl">
                        <h3 className="text-[17px] font-bold text-white mb-2">단발성 업무 요청 삭제</h3>
                        <p className="text-[13px] text-[#A1A1AA] mb-6 leading-relaxed">정말로 이 요청 정보를 영구 삭제하시겠습니까?<br />삭제된 데이터는 복구할 수 없습니다.</p>
                        <div className="flex gap-2 justify-center">
                            <button 
                                onClick={() => setDeleteTargetId(null)}
                                className="px-4 py-2 bg-[#2c2c2b] border border-[#3c3c3c] text-[#86868B] hover:text-white rounded-[8px] text-[13px] font-bold transition-all cursor-pointer flex-1"
                            >
                                취소
                            </button>
                            <button 
                                onClick={handleDelete}
                                className="px-4 py-2 bg-[#ff453a] hover:bg-[#e03b30] text-white rounded-[8px] text-[13px] font-bold transition-all cursor-pointer flex-1"
                            >
                                삭제확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Create / Edit Modal Dialog */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[200000] transition-all select-none">
                    <div className="bg-[#272726] border border-[#3c3c3c] w-full max-w-2xl rounded-[24px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-[#3c3c3c] flex justify-between items-center bg-[#2c2c2b]/30">
                            <div className="text-left">
                                <span className="text-[11px] font-bold text-[#82afb9] bg-[#82afb9]/10 border border-[#82afb9]/25 px-2 py-0.5 rounded-[4px] uppercase tracking-wide">
                                    {modalMode === 'create' ? '새 안건 등록' : '정보 수정'}
                                </span>
                                <h3 className="text-[18px] font-bold text-white mt-1">
                                    {modalMode === 'create' ? '단발성 업무 요청 등록' : '단발성 업무 요청 상세 편집'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 hover:bg-[#333] rounded-full text-[#86868B] hover:text-white transition-colors cursor-pointer"
                            >
                                <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Form Content */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 text-left flex flex-col gap-5 select-text">
                            
                            {/* Line 1: 접수일 & 요청기한 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-bold text-[#86868B]">접수일</label>
                                    <input 
                                        type="date"
                                        value={formRequestDate}
                                        onChange={(e) => setFormRequestDate(e.target.value)}
                                        onClick={(e) => {
                                            try { e.target.showPicker(); } catch (err) {}
                                        }}
                                        onFocus={(e) => {
                                            try { e.target.showPicker(); } catch (err) {}
                                        }}
                                        className="bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] px-3.5 py-2.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-bold text-[#86868B]">요청기한 (마감일)</label>
                                    <input 
                                        type="date"
                                        value={formDueDate}
                                        onChange={(e) => setFormDueDate(e.target.value)}
                                        onClick={(e) => {
                                            try { e.target.showPicker(); } catch (err) {}
                                        }}
                                        onFocus={(e) => {
                                            try { e.target.showPicker(); } catch (err) {}
                                        }}
                                        className="bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] px-3.5 py-2.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Line 2: 요청자 & 프로젝트 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 relative">
                                    <label className="text-[12px] font-bold text-[#86868B]">요청자 및 소속 부서 <span className="text-[#ff453a]">*</span></label>
                                    <input 
                                        type="text"
                                        required
                                        value={formRequester}
                                        onChange={(e) => setFormRequester(e.target.value)}
                                        onFocus={() => {
                                            setTempRequesterVal(formRequester);
                                            setFormRequester('');
                                            setShowRequesterSuggestions(true);
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setShowRequesterSuggestions(false);
                                                setFormRequester(currentVal => {
                                                    const val = currentVal.trim();
                                                    if (!val) {
                                                        return tempRequesterVal;
                                                    }
                                                    if (!val.includes('/')) {
                                                        const match = pilotMembers.find(m => m.staff_name.trim() === val);
                                                        if (match) {
                                                            return `${match.staff_name} / ${mapOrgName(match.staff_name, match.org_name)}`;
                                                        }
                                                    }
                                                    return currentVal;
                                                });
                                            }, 200);
                                        }}
                                        placeholder="예시: 홍길동 / 메리츠증권"
                                        className="bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] px-3.5 py-2.5 text-[13px] font-medium text-white placeholder-gray-600 focus:border-[#2997ff] focus:outline-none transition-colors"
                                    />
                                    {showRequesterSuggestions && filteredRequesters.length > 0 && (
                                        <div className="absolute left-0 right-0 top-[100%] mt-1 max-h-40 overflow-y-auto bg-[#2c2c2b] border border-[#4c4c4b] rounded-[8px] z-[99999] shadow-xl timeline-scrollbar">
                                            {filteredRequesters.map((m, idx) => (
                                                <div 
                                                    key={idx}
                                                    onClick={() => setFormRequester(`${m.staff_name} / ${mapOrgName(m.staff_name, m.org_name)}`)}
                                                    className="px-3.5 py-2 hover:bg-white/5 cursor-pointer text-left text-[13px] text-white transition-colors"
                                                >
                                                    {m.staff_name} <span className="text-[#86868B]">({mapOrgName(m.staff_name, m.org_name)})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1.5 select-none">
                                    <label className="text-[12px] font-bold text-[#86868B]">프로젝트</label>
                                    <div className="relative w-full">
                                        <select 
                                            value={formProjectCode}
                                            onChange={(e) => setFormProjectCode(e.target.value)}
                                            className="appearance-none w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] pl-3.5 pr-10 py-2.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                                        >
                                            {projects.map(p => (
                                                <option key={p.project_code} value={p.project_code}>{p.project_name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Line 3: 업무분류 & 중요도 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 select-none">
                                    <label className="text-[12px] font-bold text-[#86868B]">업무분류</label>
                                    <div className="relative w-full">
                                        <select 
                                            value={formCategoryName}
                                            onChange={(e) => setFormCategoryName(e.target.value)}
                                            className="appearance-none w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] pl-3.5 pr-10 py-2.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                                        >
                                            {CATEGORY_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5 select-none">
                                    <label className="text-[12px] font-bold text-[#86868B]">중요도</label>
                                    <div className="relative w-full">
                                        <select 
                                            value={formImpactLevel}
                                            onChange={(e) => setFormImpactLevel(e.target.value)}
                                            className="appearance-none w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] pl-3.5 pr-10 py-2.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                                        >
                                            {IMPACT_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Line 4: 수행부서 & 상태 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 select-none">
                                    <label className="text-[12px] font-bold text-[#86868B]">수행부서</label>
                                    <div className="relative w-full">
                                        <select 
                                            value={formAssignedDeptCode}
                                            onChange={(e) => setFormAssignedDeptCode(e.target.value)}
                                            className="appearance-none w-full bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] pl-3.5 pr-10 py-2.5 text-[13px] font-bold text-white focus:border-[#2997ff] focus:outline-none transition-colors cursor-pointer"
                                        >
                                            {departments.map(d => (
                                                <option key={d.dept_code} value={d.dept_code}>{d.dept_name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5 select-none">
                                    <label className="text-[12px] font-bold text-[#86868B]">상태</label>
                                    <div className="relative w-full">
                                        <select 
                                            value={formHandlingStatus}
                                            onChange={(e) => setFormHandlingStatus(e.target.value)}
                                            disabled={!canEditFormStatus}
                                            className={`appearance-none w-full border rounded-[8px] pl-3.5 pr-10 py-2.5 text-[13px] font-bold outline-none transition-colors ${
                                                canEditFormStatus
                                                ? 'bg-[#2c2c2b] border-[#3c3c3c] text-white focus:border-[#2997ff] cursor-pointer' 
                                                : 'bg-[#222]/30 border-transparent text-[#86868B] cursor-not-allowed'
                                            }`}
                                        >
                                            {STATUS_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt === '미착수' ? '미착수(접수)' : opt}</option>
                                            ))}
                                        </select>
                                        {canEditFormStatus && (
                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B] z-10">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Text Area 1: 업무명 */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[12px] font-bold text-[#86868B]">업무명 <span className="text-[#ff453a]">*</span></label>
                                <textarea 
                                    required
                                    rows={3}
                                    value={formRequestDetail}
                                    onChange={(e) => setFormRequestDetail(e.target.value)}
                                    placeholder="구체적인 업무 내용을 입력하세요."
                                    className="bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] px-3.5 py-2.5 text-[13px] font-medium text-white placeholder-gray-600 focus:border-[#2997ff] focus:outline-none transition-colors resize-none leading-relaxed"
                                />
                            </div>

                            {/* Text Area 2: 요청목적 & 필요산출물 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-bold text-[#86868B]">요청 목적</label>
                                    <input 
                                        type="text"
                                        value={formPurpose}
                                        onChange={(e) => setFormPurpose(e.target.value)}
                                        placeholder="예시: 대주단 보고 보고서용"
                                        className="bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] px-3.5 py-2.5 text-[13px] font-medium text-white placeholder-gray-600 focus:border-[#2997ff] focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-bold text-[#86868B]">필요 산출물</label>
                                    <input 
                                        type="text"
                                        value={formDeliverables}
                                        onChange={(e) => setFormDeliverables(e.target.value)}
                                        placeholder="예시: 한 장짜리 요약 PDF"
                                        className="bg-[#2c2c2b] border border-[#3c3c3c] rounded-[8px] px-3.5 py-2.5 text-[13px] font-medium text-white placeholder-gray-600 focus:border-[#2997ff] focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Save Actions */}
                            <div className="flex gap-2 justify-end mt-4 select-none">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 bg-[#2c2c2b] border border-[#3c3c3c] hover:bg-[#323231] hover:border-[#4c4c4b] text-[#A1A1AA] hover:text-white rounded-[8px] text-[13px] font-bold transition-all cursor-pointer"
                                >
                                    취소
                                </button>
                                <button 
                                    type="submit"
                                    className="px-5 py-2 bg-[#2997ff] hover:bg-[#147ce5] text-white rounded-[8px] text-[13px] font-bold transition-all cursor-pointer shadow-lg shadow-[#2997ff]/10"
                                >
                                    {modalMode === 'create' ? '업무 등록' : '수정 완료'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Popup Detail Slide Panel Drawer */}
            {selectedPopupDetail && (() => {
                const p = selectedPopupDetail;
                const isOwner = p.created_by_email === currentUserEmail;
                const canEditDetail = isAdmin || (currentUserEmail && isOwner);

                return (
                    <div className="fixed inset-0 z-[100000] overflow-hidden pointer-events-none">
                        <style>{`
                            #global-notification-bell,
                            #global-support-button {
                                display: none !important;
                            }
                        `}</style>
                        {/* Clickable backdrop that closes the drawer */}
                        <div className="absolute inset-0 pointer-events-auto bg-black/40" onClick={() => setSelectedPopupDetail(null)} />
                        
                        <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 pointer-events-auto">
                            <div className="w-screen max-w-[550px] transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col h-full bg-[#1c1c1e]/95 border-l border-[#3c3c3c]/80 text-white select-text">
                                {/* Header */}
                                <div className="px-[10px] py-3 border-b border-[#3c3c3c]/80 flex items-center justify-between bg-[#1c1c1e]/80 sticky top-0 z-20">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-[12px] font-bold px-2 py-0.5 rounded border border-[#3c3c3c] bg-[#3A3A3C] text-white">
                                            {getProjectName(p.project_code)}
                                        </span>
                                        <span className="text-[12px] font-bold px-2 py-0.5 rounded border border-[#3c3c3c] bg-white/5 text-[#E5E5E5]">
                                            {p.category_name || '-'}
                                        </span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedPopupDetail(null)}
                                        className="text-[#86868B] hover:text-white text-[20px] font-bold transition-colors cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>
                                
                                {/* Content Body */}
                                <div className="flex-1 overflow-y-auto px-[10px] py-6 space-y-[10px] timeline-scrollbar">
                                    {/* Task Name */}
                                    <div className="space-y-1 pl-[20px]">
                                        <h2 className="text-[22px] font-bold text-[#bdbba7] leading-snug">
                                            {p.request_detail}
                                        </h2>
                                    </div>
                                    
                                    {/* Metadata Card Box */}
                                    <div className="p-5 rounded-[16px] bg-white/[0.02] border border-[#2c2c2e] space-y-[14px] text-[13px]">
                                        {/* Row 1: 요청부서, 수행부서, 중요도 */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">요청 부서</span>
                                                <span className="font-bold text-[#E5E5E5] block truncate" title={p.requester}>
                                                    {p.requester || '-'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">수행 부서</span>
                                                <span className="font-bold text-[#E5E5E5] block truncate" title={getDeptName(p.assigned_dept_code)}>
                                                    {getDeptName(p.assigned_dept_code) || '-'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">중요도</span>
                                                <span className="font-bold block">
                                                    <span className={`${getImpactStyle(p.impact_level)} text-[12px] font-bold`}>
                                                        {p.impact_level || '중간'}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Row 2: 접수일, 요청기한, 상태 */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">접수일</span>
                                                <span className="font-bold text-[#E5E5E5] block">
                                                    {p.request_date ? p.request_date.replace(/-/g, '.') : '-'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">요청 기한</span>
                                                <span className="font-bold text-[#E5E5E5] block">
                                                    {p.due_date ? p.due_date.replace(/-/g, '.') : '-'}
                                                </span>
                                            </div>
                                            <div className="space-y-[3px]">
                                                <span className="text-[#86868B] text-[11px] block">상태</span>
                                                <span className="font-bold block">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono tracking-tight ${getStatusStyle(p.handling_status)}`}>
                                                        {p.handling_status === '미착수' ? '미착수(접수)' : (p.handling_status || '미착수')}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Deep Dive Narrative Cards */}
                                    <div className="p-5 rounded-[16px] bg-white/[0.02] border border-[#2c2c2e] flex flex-col">
                                        {/* 요청 목적 */}
                                        <div className="space-y-0">
                                            <h4 className="text-[11px] font-bold text-[#86868B]">요청 목적</h4>
                                            <p className="text-[14px] text-[#bdbba7] leading-relaxed whitespace-pre-line mt-[2px]">
                                                {p.purpose || '등록된 내용이 없습니다.'}
                                            </p>
                                        </div>
                                        
                                        <div className="h-[1px] bg-[#3c3c3c]/30 mt-[10px] mb-[12px]"></div>
                                        
                                        {/* 필요 산출물 */}
                                        <div className="space-y-0">
                                            <h4 className="text-[11px] font-bold text-[#86868B]">필요 산출물</h4>
                                            <p className="text-[14px] text-[#bdbba7] leading-relaxed whitespace-pre-line mt-[2px]">
                                                {p.deliverables || '등록된 내용이 없습니다.'}
                                            </p>
                                        </div>

                                        {p.memo && (
                                            <>
                                                <div className="h-[1px] bg-[#3c3c3c]/30 mt-[10px] mb-[12px]"></div>
                                                {/* 메모 */}
                                                <div className="space-y-0">
                                                    <h4 className="text-[11px] font-bold text-[#86868B]">상세 메모</h4>
                                                    <p className="text-[14px] text-[#bdbba7] leading-relaxed whitespace-pre-line mt-[2px]">
                                                        {p.memo}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* 업무 협업 게시판 */}
                                    <div className="w-full">
                                        <WorkspaceActivityLog 
                                            isTaskBoard={true} 
                                            taskId={String(p.id)} 
                                            taskProject={p.project_code || 'IOTA_SEOUL'}
                                            workspaceCode="WS_PMO" 
                                            workspaceLabel="단발성 업무 요청" 
                                        />
                                    </div>
                                </div>
                                
                                {/* Footer Action Buttons */}
                                <div className="px-[10px] py-4 border-t border-[#3c3c3c]/80 flex justify-end gap-3 bg-[#1c1c1e]/90">
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedPopupDetail(null)}
                                        className="px-4 py-2 rounded-[8px] bg-white/5 hover:bg-white/10 text-white border border-[#3c3c3c] text-[13px] font-bold cursor-pointer transition-all"
                                    >
                                        닫기
                                    </button>
                                    {canEditDetail && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                openEditModal(p);
                                            }}
                                            className="px-5 py-2 rounded-[8px] bg-[#2997ff] hover:bg-[#2997ff]/90 text-[13px] font-bold text-white cursor-pointer transition-all shadow-md shadow-[#2997ff]/10"
                                        >
                                            업무 수정하기
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
