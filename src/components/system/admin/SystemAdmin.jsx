import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { tasksData } from './tasksData';

export default function SystemAdmin({ currentPage, navigateTo }) {
    const { user, memberInfo, loading: authLoading } = useAuth();
    const [logs, setLogs] = useState([]);
    const [supportRequests, setSupportRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    const activeTab = currentPage === 'system-admin/support-requests' ? 'support_requests' :
                      currentPage === 'system-admin/project-tasks' ? 'project_tasks' : 'access_logs';

    const setActiveTab = (tab) => {
        if (tab === 'support_requests') navigateTo('system-admin/support-requests');
        else if (tab === 'project_tasks') navigateTo('system-admin/project-tasks');
        else navigateTo('system-admin/access-logs');
    };

    useEffect(() => {
        if (currentPage === 'system-admin') {
            navigateTo('system-admin/access-logs');
        }
    }, [currentPage]);
    
    // Login History Modal State
    const [selectedUser, setSelectedUser] = useState(null);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Comment States
    const [commentInputs, setCommentInputs] = useState({});
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const AUTHORIZED_USERS = ['전기영', '이시정', '이관용'];

    useEffect(() => {
        const checkAccessAndFetch = async () => {
            // Wait for AuthContext initialization
            if (authLoading) return;

            // Check Authorization
            if (!memberInfo || !AUTHORIZED_USERS.includes(memberInfo.staff_name)) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            setAccessDenied(false);

            try {
                // Fetch Logs
                const { data, error } = await supabase
                    .from('iota_seoul_pilot_members')
                    .select('staff_name, email, org_name, role_code, last_login_at')
                    .order('last_login_at', { ascending: false, nullsFirst: false });

                if (error) {
                    console.error("Error fetching logs:", error);
                } else {
                    setLogs(data || []);
                }

                // Fetch Support Requests
                const { data: supportData, error: supportError } = await supabase
                    .from('iota_seoul_logs')
                    .select('*')
                    .eq('metadata->>workspace_code', 'WS_SUPPORT')
                    .order('created_at', { ascending: false });
                
                if (!supportError) {
                    setSupportRequests(supportData || []);
                }

            } catch (err) {
                console.error("Unexpected error fetching logs:", err);
            } finally {
                setLoading(false);
            }
        };

        checkAccessAndFetch();
    }, [memberInfo, authLoading]);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    if (loading) {
        const handleAddComment = async (logId, currentMetadata) => {
        const text = commentInputs[logId]?.trim();
        if (!text) return;
        
        setIsSubmittingComment(true);
        try {
            const comments = currentMetadata.comments || [];
            const newComment = {
                id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                text: text,
                author: memberInfo?.staff_name || memberInfo?.name || '관리자',
                created_at: new Date().toISOString()
            };
            
            const updatedMetadata = { ...currentMetadata, comments: [...comments, newComment] };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            setCommentInputs(prev => ({ ...prev, [logId]: '' }));
            
            // Refresh Support Requests
            const { data: supportData, error: supportError } = await supabase
                .from('iota_seoul_logs')
                .select('*')
                .eq('metadata->>workspace_code', 'WS_SUPPORT')
                .order('created_at', { ascending: false });
            if (!supportError) {
                setSupportRequests(supportData || []);
            }
        } catch (err) {
            console.error('Error adding comment:', err);
            alert('댓글 작성 중 오류가 발생했습니다.');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (logId, commentId, currentMetadata) => {
        if (!window.confirm('정말 이 댓글을 삭제하시겠습니까?')) return;
        
        try {
            const comments = (currentMetadata.comments || []).filter(c => c.id !== commentId);
            const updatedMetadata = { ...currentMetadata, comments };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            // Refresh Support Requests
            const { data: supportData, error: supportError } = await supabase
                .from('iota_seoul_logs')
                .select('*')
                .eq('metadata->>workspace_code', 'WS_SUPPORT')
                .order('created_at', { ascending: false });
            if (!supportError) {
                setSupportRequests(supportData || []);
            }
        } catch (err) {
            console.error('Error deleting comment:', err);
            alert('댓글 삭제 중 오류가 발생했습니다.');
        }
    };

    return (
            <div className="w-full h-screen bg-[#FDFDFD] dark:bg-[#111111] flex items-center justify-center">
                <div className="w-6 h-6 relative mb-5 animate-spin">
                    <div className="absolute top-0 left-1/2 -ml-[3px] w-[6px] h-[6px] bg-[#111] dark:bg-white rounded-full"></div>
                </div>
            </div>
        );
    }

    if (accessDenied) {
        const handleAddComment = async (logId, currentMetadata) => {
        const text = commentInputs[logId]?.trim();
        if (!text) return;
        
        setIsSubmittingComment(true);
        try {
            const comments = currentMetadata.comments || [];
            const newComment = {
                id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                text: text,
                author: memberInfo?.staff_name || memberInfo?.name || '관리자',
                created_at: new Date().toISOString()
            };
            
            const updatedMetadata = { ...currentMetadata, comments: [...comments, newComment] };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            setCommentInputs(prev => ({ ...prev, [logId]: '' }));
            
            // Refresh Support Requests
            const { data: supportData, error: supportError } = await supabase
                .from('iota_seoul_logs')
                .select('*')
                .eq('metadata->>workspace_code', 'WS_SUPPORT')
                .order('created_at', { ascending: false });
            if (!supportError) {
                setSupportRequests(supportData || []);
            }
        } catch (err) {
            console.error('Error adding comment:', err);
            alert('댓글 작성 중 오류가 발생했습니다.');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (logId, commentId, currentMetadata) => {
        if (!window.confirm('정말 이 댓글을 삭제하시겠습니까?')) return;
        
        try {
            const comments = (currentMetadata.comments || []).filter(c => c.id !== commentId);
            const updatedMetadata = { ...currentMetadata, comments };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            // Refresh Support Requests
            const { data: supportData, error: supportError } = await supabase
                .from('iota_seoul_logs')
                .select('*')
                .eq('metadata->>workspace_code', 'WS_SUPPORT')
                .order('created_at', { ascending: false });
            if (!supportError) {
                setSupportRequests(supportData || []);
            }
        } catch (err) {
            console.error('Error deleting comment:', err);
            alert('댓글 삭제 중 오류가 발생했습니다.');
        }
    };

    return (
            <div className="w-full h-screen bg-[#FDFDFD] dark:bg-[#111111] flex flex-col items-center justify-center text-[#1D1D1F] dark:text-[#E5E5E5]">
                <svg className="w-16 h-16 text-red-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="text-[12px] font-bold mb-2">Access Denied</h1>
                <p className="text-[#86868B] mb-8">You do not have permission to view this page.</p>
                <button 
                    onClick={() => window.history.back()}
                    className="px-6 py-3 bg-[#111] dark:bg-white text-white dark:text-[#111111] font-semibold rounded-xl hover:opacity-80 transition-opacity"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const getStaffTitle = (staffName) => {
        if (!staffName) return '-';
        const titles = {
            '이철승': '부문대표',
            '윤관식': '부대표',
            '정조민': '부대표',
            '우형석': '그룹장',
            '권술일': '파트장',
            '권순일': '파트장',
            '강순용': '파트장',
            '윤주형': 'Sr.Manager',
            '한찬호': 'Sr.Manager',
            '박준호': '센터장',
            '강석민': 'Sr.Manager',
            '정리훈': 'Sr.Manager',
            '홍장군': '센터장',
            '채원': '담당',
            '김대익': '마스터',
            '장성진': '마스터',
            '김보성': '마스터',
            '박봉서': '전문위원',
            '이정훈': '담당',
            '김민지': 'Sr.Manager',
            '김현수': '센터장',
            '이가현': '리더',
            '이시정': '리더',
            '현철호': '그룹장',
            '홍창의': '파트장',
            '신민호': 'Sr.Manager',
            '김행단': '그룹장',
            '윤용택': 'Sr.Manager'
        };
        return titles[staffName] || '매니저';
    };

    const getDepartment = (staffName, originalOrg) => {
        if (['홍창의', '현철호', '신민호'].includes(staffName)) {
            return '디지털 사업그룹';
        }
        return originalOrg || '-';
    };

    const handleRowClick = async (email, staffName) => {
        setSelectedUser({ email, staffName });
        setLoadingHistory(true);
        setHistoryLogs([]);

        try {
            const { data, error } = await supabase
                .from('iota_seoul_login_history')
                .select('login_time')
                .eq('email', email)
                .order('login_time', { ascending: false });

            if (error) {
                console.error("Error fetching history:", error);
            } else {
                setHistoryLogs(data || []);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteRequest = async (logId) => {
        if (!window.confirm('정말 이 요청사항을 삭제하시겠습니까?')) return;
        
        setIsDeleting(true);
        try {
            // 연관된 링크 데이터 삭제
            await supabase.from('iota_seoul_log_links').delete().eq('log_id', logId);
            const { error } = await supabase.from('iota_seoul_logs').delete().eq('log_id', logId);
            if (error) throw error;
            
            setSupportRequests(prev => prev.filter(req => req.log_id !== logId));
            alert('삭제되었습니다.');
        } catch (err) {
            console.error('Error deleting request:', err);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAddComment = async (logId, currentMetadata) => {
        const text = commentInputs[logId]?.trim();
        if (!text) return;
        
        setIsSubmittingComment(true);
        try {
            const comments = currentMetadata.comments || [];
            const newComment = {
                id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                text: text,
                author: memberInfo?.staff_name || memberInfo?.name || '관리자',
                created_at: new Date().toISOString()
            };
            
            const updatedMetadata = { ...currentMetadata, comments: [...comments, newComment] };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            setCommentInputs(prev => ({ ...prev, [logId]: '' }));
            
            // Refresh Support Requests
            const { data: supportData, error: supportError } = await supabase
                .from('iota_seoul_logs')
                .select('*')
                .eq('metadata->>workspace_code', 'WS_SUPPORT')
                .order('created_at', { ascending: false });
            if (!supportError) {
                setSupportRequests(supportData || []);
            }
        } catch (err) {
            console.error('Error adding comment:', err);
            alert('댓글 작성 중 오류가 발생했습니다.');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (logId, commentId, currentMetadata) => {
        if (!window.confirm('정말 이 댓글을 삭제하시겠습니까?')) return;
        
        try {
            const comments = (currentMetadata.comments || []).filter(c => c.id !== commentId);
            const updatedMetadata = { ...currentMetadata, comments };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            // Refresh Support Requests
            const { data: supportData, error: supportError } = await supabase
                .from('iota_seoul_logs')
                .select('*')
                .eq('metadata->>workspace_code', 'WS_SUPPORT')
                .order('created_at', { ascending: false });
            if (!supportError) {
                setSupportRequests(supportData || []);
            }
        } catch (err) {
            console.error('Error deleting comment:', err);
            alert('댓글 삭제 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="w-full h-screen overflow-y-auto bg-[#FDFDFD] dark:bg-[#111111] text-[#1D1D1F] dark:text-[#E5E5E5] font-sans p-10 md:p-16">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-[18px] font-bold tracking-tight mb-2">Admin Dashboard</h1>
                        <p className="text-[#86868B]">System Access Logs & Support Requests</p>
                    </div>
                    <button 
                        onClick={() => {
                            window.close();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-[#F5F5F7] dark:bg-[#1C1C1E] rounded-lg text-sm font-medium hover:bg-[#E8E8ED] dark:hover:bg-[#2C2C2E] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        Close Window
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-4 mb-6 border-b border-black/10 dark:border-white/10">
                    <button 
                        onClick={() => setActiveTab('access_logs')}
                        className={`pb-3 px-2 text-[15px] font-semibold transition-colors ${activeTab === 'access_logs' ? 'text-[#1D1D1F] dark:text-white border-b-2 border-[#111] dark:border-white translate-y-[1px]' : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'}`}
                    >
                        Access Logs
                    </button>
                    <button 
                        onClick={() => setActiveTab('support_requests')}
                        className={`pb-3 px-2 text-[15px] font-semibold transition-colors ${activeTab === 'support_requests' ? 'text-[#1D1D1F] dark:text-white border-b-2 border-[#111] dark:border-white translate-y-[1px]' : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'}`}
                    >
                        플랫폼 개선 요청
                    </button>
                    <button 
                        onClick={() => setActiveTab('project_tasks')}
                        className={`pb-3 px-2 text-[15px] font-semibold transition-colors ${activeTab === 'project_tasks' ? 'text-[#1D1D1F] dark:text-white border-b-2 border-[#111] dark:border-white translate-y-[1px]' : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'}`}
                    >
                        기획 및 구축 총괄 내역
                    </button>
                </div>

                {activeTab === 'access_logs' && (
                    <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border-b border-black/10 dark:border-white/10">
                                    <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider">Name</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider">Department</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider">Position</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider">Email</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider">Last Login At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {logs.map((log, index) => (
                                    <tr 
                                        key={index} 
                                        onClick={() => handleRowClick(log.email, log.staff_name)}
                                        className="hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                                    >
                                        <td className="py-4 px-6 text-[15px] font-medium">{log.staff_name}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#666] dark:text-[#A1A1AA]">{getDepartment(log.staff_name, log.org_name)}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#666] dark:text-[#A1A1AA]">{getStaffTitle(log.staff_name)}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#666] dark:text-[#A1A1AA]">{log.email}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#666] dark:text-[#A1A1AA] font-mono tracking-tight">{formatDate(log.last_login_at)}</td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="py-10 text-center text-[#86868B]">No access logs found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}

                {activeTab === 'support_requests' && (
                    <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
                        {supportRequests.map(req => (
                            <div key={req.log_id} className="border border-black/10 dark:border-white/10 rounded-xl p-5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-[17px] font-bold text-[#1D1D1F] dark:text-white">{req.summary}</h3>
                                        <span className="text-[11px] font-bold px-2 py-1 rounded bg-[#F5F5F7] dark:bg-[#333] text-[#86868B]">{req.metadata?.issue_status || '신규'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] text-[#86868B] font-mono tracking-tight">{formatDate(req.created_at)}</span>
                                        <button 
                                            onClick={() => handleDeleteRequest(req.log_id)}
                                            disabled={isDeleting}
                                            className="text-[#86868B] hover:text-[#ff3b30] p-1 rounded transition-colors disabled:opacity-50"
                                            title="삭제"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[15px] leading-relaxed text-[#666] dark:text-[#A1A1AA] whitespace-pre-wrap mb-5">{req.raw_text}</p>
                                <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-[24px] h-[24px] rounded-full bg-[#E5E5E5] dark:bg-[#333] overflow-hidden">
                                            <img 
                                                src={`${import.meta.env.BASE_URL}${req.writer_name}.webp`} 
                                                alt={req.writer_name} 
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                            />
                                        </div>
                                        <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-white">{req.writer_name}</span>
                                    </div>
                                    {req.metadata?.attachedFiles?.length > 0 && (
                                        <div className="flex gap-2">
                                            {req.metadata.attachedFiles.map((f, i) => (
                                                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-[6px] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-[#E8E8ED] dark:hover:bg-[#3C3C3E] transition-colors text-[#1D1D1F] dark:text-white">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                                    첨부파일 {i+1}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Admin Comments Section */}
                                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex flex-col gap-3">
                                    {(req.metadata?.comments || []).map(comment => (
                                        <div key={comment.id} className="bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-[18px] h-[18px] rounded-full bg-[#E5E5E5] dark:bg-[#333] overflow-hidden">
                                                        <img 
                                                            src={`${import.meta.env.BASE_URL}${comment.author}.webp`} 
                                                            alt={comment.author} 
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                                        />
                                                    </div>
                                                    <span className="text-[13px] font-bold text-[#1D1D1F] dark:text-white">{comment.author}</span>
                                                </div>
                                                <div className="flex items-center gap-[8px]">
                                                    <span className="text-[12px] text-[#86868B] font-mono">
                                                        {new Date(comment.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleDeleteComment(req.log_id, comment.id, req.metadata || {})}
                                                        className="text-[#86868B] hover:text-[#ff3b30] transition-colors p-[2px]"
                                                        title="삭제"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-[14px] text-[#666] dark:text-[#A1A1AA] whitespace-pre-wrap pl-[26px] leading-relaxed">
                                                {comment.text}
                                            </p>
                                        </div>
                                    ))}
                                    
                                    <div className="flex items-start gap-2 mt-1">
                                        <input
                                            type="text"
                                            value={commentInputs[req.log_id] || ''}
                                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [req.log_id]: e.target.value }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleAddComment(req.log_id, req.metadata || {});
                                                }
                                            }}
                                            placeholder="답변이나 추가 의견을 남겨주세요..."
                                            className="flex-1 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#E5E5E5] outline-none focus:border-[#111] dark:focus:border-white transition-colors placeholder:text-[#86868B]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddComment(req.log_id, req.metadata || {})}
                                            disabled={isSubmittingComment || !commentInputs[req.log_id]?.trim()}
                                            className="px-5 py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111111] rounded-xl text-[14px] font-bold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            등록
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {supportRequests.length === 0 && (
                            <div className="py-16 flex flex-col items-center justify-center text-center">
                                <svg className="w-12 h-12 text-[#86868B] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-white">등록된 플랫폼 개선 요청이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'project_tasks' && (
                    <ProjectTasksView />
                )}
            </div>

            {/* History Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedUser(null)}>
                    <div className="bg-white dark:bg-[#1C1C1E] w-[500px] max-h-[80vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        
                        <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                            <div>
                                <h3 className="text-[20px] font-bold text-[#1D1D1F] dark:text-white tracking-tight">{selectedUser.staffName} 접속 기록</h3>
                                <p className="text-[14px] text-[#86868B] dark:text-[#A1A1AA] mt-1">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <svg className="w-5 h-5 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-[#FDFDFD] dark:bg-[#111111]">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-10">
                                    <div className="w-5 h-5 border-2 border-[#111] dark:border-white border-t-transparent rounded-full animate-spin mb-3"></div>
                                    <p className="text-[14px] text-[#86868B]">기록을 불러오는 중...</p>
                                </div>
                            ) : historyLogs.length > 0 ? (
                                <>
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-1 rounded-full">
                                            총 {historyLogs.length}회 접속
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {historyLogs.map((h, i) => (
                                            <div key={i} className="flex items-center px-4 py-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-white dark:bg-[#1C1C1E] shadow-sm">
                                                <span className="text-[15px] font-medium text-[#1D1D1F] dark:text-white font-mono tracking-tight">
                                                    {formatDate(h.login_time)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-12 h-12 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center mb-4">
                                        <svg className="w-6 h-6 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-white mb-1">상세 기록이 없습니다.</p>
                                    <p className="text-[14px] text-[#86868B]">이 사용자는 새로운 로그인 히스토리 시스템<br/>도입 이후 접속한 기록이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProjectTasksView() {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('전체');
    const [priorityFilter, setPriorityFilter] = useState('전체');
    const [phaseFilter, setPhaseFilter] = useState('전체');
    const [sortOrder, setSortOrder] = useState('latest'); // 'latest' or 'oldest'
    const [visibleCount, setVisibleCount] = useState(40);
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const loaderRef = useRef(null);

    // Reset visible count and expansion when search/filter/sort parameters change
    useEffect(() => {
        setVisibleCount(40);
        setExpandedTaskId(null);
    }, [searchTerm, categoryFilter, priorityFilter, phaseFilter, sortOrder]);

    const categories = ['전체', ...new Set(tasksData.map(t => t['대분류']).filter(Boolean))];
    const priorities = ['전체', '최고', '높음 이상', '보통 이상', '낮음 이상'];

    // Map tasks to include their stable originalIndex (which is their input order)
    const tasksWithIndex = tasksData.map((task, idx) => ({ ...task, originalIndex: idx }));

    const priorityScore = {
        '최고': 5,
        '높음': 4,
        '보통': 3,
        '낮음': 2,
        '최하': 1
    };

    const getTitleColorClass = (priority) => {
        if (priority === '최고') {
            return 'text-red-500 dark:text-red-400';
        } else if (priority === '높음') {
            return 'text-amber-500 dark:text-amber-400';
        }
        return 'text-[#1D1D1F] dark:text-white';
    };

    const filteredTasks = tasksWithIndex.filter(task => {
        const matchesSearch = 
            (task['작업 이름'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task['내용 상세'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task['URL'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task['작업 유형'] || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCategory = categoryFilter === '전체' || task['대분류'] === categoryFilter;
        
        let matchesPriority = true;
        if (priorityFilter !== '전체') {
            const taskScore = priorityScore[task['우선순위']] || 1;
            if (priorityFilter === '최고') {
                matchesPriority = task['우선순위'] === '최고';
            } else if (priorityFilter === '높음 이상') {
                matchesPriority = taskScore >= 4;
            } else if (priorityFilter === '보통 이상') {
                matchesPriority = taskScore >= 3;
            } else if (priorityFilter === '낮음 이상') {
                matchesPriority = taskScore >= 2;
            }
        }

        const isP2 = (task['작업 이름'] || '').includes('Phase 2') || (task['내용 상세'] || '').includes('Phase 2') || (task['마감일'] && task['마감일'] >= '2026/07/01');
        const matchesPhase = phaseFilter === '전체' || (phaseFilter === 'Phase 2' && isP2) || (phaseFilter === 'Phase 1' && !isP2);

        return matchesSearch && matchesCategory && matchesPriority && matchesPhase;
    });

    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (sortOrder === 'latest') {
            return b.originalIndex - a.originalIndex; // descending
        } else {
            return a.originalIndex - b.originalIndex; // ascending
        }
    });

    const visibleTasks = sortedTasks.slice(0, visibleCount);

    const phase2Tasks = visibleTasks.filter(t => (t['작업 이름'] || '').includes('Phase 2') || (t['내용 상세'] || '').includes('Phase 2') || (t['마감일'] && t['마감일'] >= '2026/07/01'));
    const phase1Tasks = visibleTasks.filter(t => !((t['작업 이름'] || '').includes('Phase 2') || (t['내용 상세'] || '').includes('Phase 2') || (t['마감일'] && t['마감일'] >= '2026/07/01')));

    const totalTasks = tasksData.length;
    const completedTasks = tasksData.filter(t => t['상태'] === '완료').length;
    const pendingTasks = totalTasks - completedTasks;

    const getPriorityColor = (p) => {
        switch (p) {
            case '최고': return 'bg-red-500/10 text-red-500 border border-red-500/20';
            case '높음': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
            case '보통': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
            case '낮음': return 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20';
            default: return 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20';
        }
    };

    const getStatusColor = (s) => {
        return s === '완료' 
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    };

    const renderTaskRow = (task) => {
        const isExpanded = expandedTaskId === task.originalIndex;
        return (
            <React.Fragment key={task.originalIndex}>
                <tr 
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.originalIndex)}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                    <td className="py-4 px-6">
                        <span className="text-[12px] font-bold px-2 py-1 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/5 text-[#86868B] whitespace-nowrap">
                            {task['대분류']}
                        </span>
                    </td>
                    <td className="py-4 px-6">
                        <div className="flex flex-col">
                            <span className={`text-[15px] font-semibold leading-snug ${getTitleColorClass(task['우선순위'])}`}>
                                {task['작업 이름']}
                            </span>
                            <span className="text-[12px] text-[#86868B] mt-0.5 font-medium">
                                {task['작업 유형']} {task['URL'] && `· ${task['URL']}`}
                            </span>
                        </div>
                    </td>
                    <td className="py-4 px-6">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getPriorityColor(task['우선순위'])}`}>
                            {task['우선순위']}
                        </span>
                    </td>
                    <td className="py-4 px-6 text-[13px] font-mono text-[#86868B] dark:text-[#A1A1AA]">
                        {task['마감일'] || '-'}
                    </td>
                    <td className="py-4 px-6">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(task['상태'])}`}>
                            {task['상태']}
                        </span>
                    </td>
                </tr>
                {isExpanded && (
                    <tr className="bg-[#F5F5F7]/30 dark:bg-[#1C1C1E]/30">
                        <td colSpan="5" className="py-4 px-8 border-b border-black/5 dark:border-white/5">
                            <div className="space-y-3 py-1">
                                <div>
                                    <span className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider block mb-1">상세 내용</span>
                                    <p className="text-[14px] leading-relaxed text-[#555] dark:text-[#C5C5C7] whitespace-pre-wrap">
                                        {task['내용 상세']}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-x-8 gap-y-2 pt-2 border-t border-black/5 dark:border-white/5 text-[12px]">
                                    <div>
                                        <span className="text-[#86868B] font-medium mr-1.5">작업 구분:</span>
                                        <span className="font-semibold text-[#1D1D1F] dark:text-white">{task['작업 유형']}</span>
                                    </div>
                                    {task['URL'] && (
                                        <div>
                                            <span className="text-[#86868B] font-medium mr-1.5">관련 파일/URL:</span>
                                            <span className="font-semibold text-[#1D1D1F] dark:text-white font-mono">{task['URL']}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && visibleCount < sortedTasks.length) {
                setVisibleCount(prev => prev + 40);
            }
        }, { threshold: 0.1, rootMargin: '100px' });

        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader);
        }

        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader);
            }
        };
    }, [visibleCount, sortedTasks.length]);

    return (
        <div className="space-y-6 animate-fade-in text-[#1D1D1F] dark:text-[#E5E5E5]">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm">
                    <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">총 작업 건수</span>
                    <h2 className="text-3xl font-bold mt-1 text-[#1D1D1F] dark:text-white">{totalTasks} <span className="text-base font-normal text-[#86868B]">건</span></h2>
                </div>
                <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm">
                    <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">구축 완료</span>
                    <h2 className="text-3xl font-bold mt-1 text-emerald-500">{completedTasks} <span className="text-base font-normal text-[#86868B]">건</span></h2>
                </div>
                <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm">
                    <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">진행 중 / 대기</span>
                    <h2 className="text-3xl font-bold mt-1 text-blue-500">{pendingTasks} <span className="text-base font-normal text-[#86868B]">건</span></h2>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input 
                        type="text"
                        placeholder="작업 이름, 상세 내용, 파일/URL 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border-transparent focus:border-black/20 dark:focus:border-white/20 rounded-xl pl-11 pr-4 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#E5E5E5] outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="flex flex-col">
                        <select 
                            value={phaseFilter}
                            onChange={(e) => setPhaseFilter(e.target.value)}
                            className="bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white border-transparent focus:border-black/20 dark:focus:border-white/20 rounded-xl px-4 py-2.5 text-[14px] outline-none transition-colors cursor-pointer font-semibold"
                        >
                            <option value="전체">구분: 전체</option>
                            <option value="Phase 1">Phase 1 (Production)</option>
                            <option value="Phase 2">Phase 2 (Staging)</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <select 
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white border-transparent focus:border-black/20 dark:focus:border-white/20 rounded-xl px-4 py-2.5 text-[14px] outline-none transition-colors cursor-pointer"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat === '전체' ? '대분류: 전체' : cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <select 
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white border-transparent focus:border-black/20 dark:focus:border-white/20 rounded-xl px-4 py-2.5 text-[14px] outline-none transition-colors cursor-pointer"
                        >
                            {priorities.map(prio => (
                                <option key={prio} value={prio}>{prio === '전체' ? '우선순위: 전체' : prio}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <select 
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white border-transparent focus:border-black/20 dark:focus:border-white/20 rounded-xl px-4 py-2.5 text-[14px] outline-none transition-colors cursor-pointer font-semibold"
                        >
                            <option value="latest">최근 입력순</option>
                            <option value="oldest">과거 입력순</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tasks Table */}
            <div className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm p-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#F5F5F7] dark:bg-[#2C2C2E] border-b border-black/10 dark:border-white/10">
                                <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider w-[15%]">대분류</th>
                                <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider w-[51%]">작업 정보</th>
                                <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider w-[12%]">우선순위</th>
                                <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider w-[12%]">마감일</th>
                                <th className="py-4 px-6 text-xs font-semibold text-[#86868B] uppercase tracking-wider w-[10%]">상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {phaseFilter === '전체' ? (
                                <>
                                    {phase2Tasks.length > 0 && (
                                        <tr className="bg-[#F5F5F7]/40 dark:bg-[#2C2C2E]/40 pointer-events-none">
                                            <td colSpan="5" className="py-2.5 px-6 border-b border-black/5 dark:border-white/5">
                                                <span className="text-[11px] font-bold text-[#0A84FF] tracking-wider uppercase">Phase 2 (Staging)</span>
                                            </td>
                                        </tr>
                                    )}
                                    {phase2Tasks.map(renderTaskRow)}
                                    {phase1Tasks.length > 0 && (
                                        <tr className="bg-[#F5F5F7]/40 dark:bg-[#2C2C2E]/40 border-t-[3px] border-[#0A84FF]/40 pointer-events-none">
                                            <td colSpan="5" className="py-2.5 px-6 border-b border-black/5 dark:border-white/5">
                                                <span className="text-[11px] font-bold text-[#86868B] tracking-wider uppercase">Phase 1 (Production)</span>
                                            </td>
                                        </tr>
                                    )}
                                    {phase1Tasks.map(renderTaskRow)}
                                </>
                            ) : (
                                visibleTasks.map(renderTaskRow)
                            )}
                            {visibleTasks.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-[#86868B]">
                                        검색 조건에 맞는 작업 내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Infinite Scroll Loader & Trigger */}
                <div ref={loaderRef} className="py-6 flex items-center justify-center text-[#86868B] border-t border-black/5 dark:border-white/5 mt-4">
                    {visibleCount < sortedTasks.length ? (
                        <div className="flex items-center">
                            <div className="w-5 h-5 border-2 border-[#111] dark:border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            <span className="text-sm font-medium">추가 작업 불러오는 중...</span>
                        </div>
                    ) : (
                        <span className="text-xs">모든 작업 내역을 불러왔습니다 (총 {sortedTasks.length}건)</span>
                    )}
                </div>
            </div>
        </div>
    );
}
