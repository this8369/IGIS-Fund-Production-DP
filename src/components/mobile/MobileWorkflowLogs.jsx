import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import {
    fetchDirectorWorkflowLogs,
    getDirectorLogLineOptions,
    getDirectorWorkspacePath,
} from '../../utils/directorWorkflowLogs';
import { canOpenDirectorReportSource } from '../../utils/iotaOrganizations';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_VISIBLE_COUNT = 20;

export default function MobileWorkflowLogs({
    memberInfo,
    initialLogId,
    onInitialLogHandled,
    returnToHomeOnInitialDetail = false,
    onReturnToHome,
}) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLine, setSelectedLine] = useState('전체');
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    
    // Modal Overlay & Alerts States
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedLogReturnsHome, setSelectedLogReturnsHome] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState('error'); // 'error' | 'success'
    const canOpenOriginal = canOpenDirectorReportSource(memberInfo);

    const fetchWorkflowLogs = useCallback(async (force = false) => {
        setLoading(true);
        setLoadError('');
        try {
            const workflowLogs = await fetchDirectorWorkflowLogs({ force });
            setLogs(workflowLogs);
            setVisibleCount(INITIAL_VISIBLE_COUNT);
        } catch (error) {
            console.error('Error loading mobile workflow logs:', error);
            setLogs([]);
            setLoadError(error?.message || '업무보고를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkflowLogs();
    }, [fetchWorkflowLogs]);

    useEffect(() => {
        if (!initialLogId || logs.length === 0) return;
        const targetLog = logs.find((log) => String(log.id) === String(initialLogId));
        if (targetLog) {
            setSelectedLog(targetLog);
            setSelectedLogReturnsHome(returnToHomeOnInitialDetail);
        }
        onInitialLogHandled?.();
    }, [initialLogId, logs, onInitialLogHandled, returnToHomeOnInitialDetail]);

    const formatExactDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const yearStr = String(d.getFullYear()).slice(-2);
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        return `${yearStr}.${monthStr}.${dayStr}`;
    };

    const getLineBadgeStyle = (cell) => {
        const norm = (cell || '').replace(/\s+/g, '').toUpperCase();
        if (norm.includes('PM')) {
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

    const handleGoToWorkspace = async (log) => {
        if (!canOpenOriginal) {
            setAlertType('error');
            setAlertMessage('Director 및 기획추진실만 원문을 열람할 수 있습니다.');
            return;
        }

        if (log.source_url) {
            window.open(log.source_url, '_blank', 'noopener,noreferrer');
            return;
        }

        const workspacePath = getDirectorWorkspacePath(log);
        if (!workspacePath) {
            setAlertType('error');
            setAlertMessage('원본 게시물로 이동할 수 없습니다. 원본 위치 정보가 올바르지 않거나 이미 삭제되었을 수 있습니다.');
            return;
        }

        const logId = log.log_id || log.id;
        try {
            const { data, error } = await supabase
                .from('iota_seoul_logs')
                .select('log_id')
                .eq('log_id', logId)
                .maybeSingle();

            if (error || !data) {
                setAlertType('error');
                setAlertMessage('해당 업무 로그는 이미 삭제되어 원본 게시물로 이동할 수 없습니다.');
                setLogs((previousLogs) => previousLogs.map((item) => item.id === log.id ? { ...item, isDeleted: true } : item));
                return;
            }
        } catch (error) {
            console.error('Error verifying log:', error);
        }

        localStorage.setItem('iota_target_log_id', logId);
        localStorage.setItem('force_pc_mode', 'true');
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.history.pushState(null, '', `${base}/${workspacePath}?logId=${logId}`);
        window.dispatchEvent(new Event('popstate'));
    };

    const lineOptions = useMemo(() => getDirectorLogLineOptions(logs), [logs]);

    const filteredLogs = useMemo(() => {
        let result = logs;

        // Line Filter
        if (selectedLine !== '전체') {
            result = result.filter(log => log.line === selectedLine);
        }

        // Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            result = result.filter((log) => [
                log.title,
                log.display_text,
                log.writer_name,
                log.writer_email,
                log.line,
                log.source_line,
                log.category,
            ].some((value) => String(value || '').toLowerCase().includes(query)));
        }

        return result;
    }, [logs, selectedLine, searchQuery]);

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, [selectedLine, searchQuery]);

    const visibleLogs = useMemo(
        () => filteredLogs.slice(0, visibleCount),
        [filteredLogs, visibleCount]
    );

    const openLogDetail = (log) => {
        setSelectedLogReturnsHome(false);
        setSelectedLog(log);
    };

    const closeLogDetail = () => {
        setSelectedLog(null);
        if (!selectedLogReturnsHome) return;
        setSelectedLogReturnsHome(false);
        onReturnToHome?.();
    };

    return (
        <div className="flex flex-col w-full bg-[#1F1F1E] h-full pb-8">
            {/* Search and Filters Header */}
            <div className="sticky top-0 bg-[#272726] border-b border-[#3c3c3c] px-4 py-3 z-25 flex flex-col gap-2.5 shrink-0">
                {/* Search Bar */}
                <div className="relative w-full">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="전체 업무 로그 키워드 검색..." 
                        className="w-full bg-[#1A1A1A] border border-[#3c3c3c] text-white text-[13.5px] px-3.5 py-2 pl-9 rounded-[14px] outline-none focus:border-[#555] transition-colors"
                    />
                    <svg className="w-4 h-4 absolute left-3 top-3 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>

                <div className="flex gap-2 overflow-x-auto hide-scrollbar select-none py-0.5">
                    {lineOptions.map(line => {
                        const isSelected = selectedLine === line;
                        return (
                            <button
                                key={line}
                                onClick={() => setSelectedLine(line)}
                                className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all whitespace-nowrap outline-none ${
                                    isSelected 
                                    ? 'bg-[#3b82f6] text-white border-transparent' 
                                    : 'bg-[#1A1A1A]/40 text-[#9A9A98] border-[#3c3c3c] active:bg-[#2c2c2e]'
                                }`}
                            >
                                {line}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* List Body */}
            <div className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-center gap-3 mb-2 px-1">
                    <h1 className="min-w-0 text-[18px] font-bold text-white tracking-tight flex flex-wrap items-center gap-2">
                        <span>Director 주요업무 보고</span>
                        <span className="text-[11px] bg-[#3b82f6]/20 text-[#60a5fa] px-2 py-0.5 rounded-md font-semibold">{filteredLogs.length}건</span>
                    </h1>
                    <button
                        type="button"
                        onClick={() => fetchWorkflowLogs(true)}
                        disabled={loading}
                        className="shrink-0 h-8 px-2.5 rounded-[9px] border border-[#3c3c3c] bg-[#272726] text-[11px] font-bold text-[#A1A1AA] disabled:opacity-50"
                    >
                        새로고침
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col justify-center items-center py-24 gap-4">
                        <div className="animate-spin w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full"></div>
                        <span className="text-[12px] text-[#86868B] text-center px-4">
                            Notion 데이터를 동기화 중입니다...<br/>
                            (최대 20초 정도 소요될 수 있습니다)
                        </span>
                    </div>
                ) : loadError ? (
                    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-[#f87171]/30 bg-[#f87171]/5 px-5 py-14 text-center">
                        <strong className="text-[14px] text-[#f87171]">업무보고를 불러오지 못했습니다.</strong>
                        <span className="text-[12px] leading-relaxed text-[#A1A1AA]">{loadError}</span>
                        <button
                            type="button"
                            onClick={() => fetchWorkflowLogs(true)}
                            className="mt-1 rounded-[10px] bg-[#3b82f6] px-4 py-2 text-[12px] font-bold text-white"
                        >
                            다시 불러오기
                        </button>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-24 text-[#86868B] text-[14.5px] font-medium border border-dashed border-[#3c3c3c] rounded-[24px]">
                        표시할 업무 로그가 없습니다.
                    </div>
                ) : (
                    <div className="flex flex-col gap-3.5">
                        {visibleLogs.map(log => (
                                <div 
                                    key={log.id} 
                                    onClick={() => openLogDetail(log)}
                                    className={`bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-5 flex flex-col transition-all active:bg-[#2c2c2b] relative ${log.isDeleted ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-3 text-[11px] text-[#86868B]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold px-[7px] py-[2.5px] rounded-[5px] bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                                                {log.category}
                                            </span>
                                            {log.line && log.line !== 'Unknown Line' && (
                                                <span className={`text-[10px] font-bold px-[7px] py-[2.5px] rounded-[5px] ${getLineBadgeStyle(log.line)}`}>
                                                    {log.line}
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-semibold">{log.isDeleted ? '삭제됨' : formatExactDate(log.work_date)}</span>
                                    </div>

                                    <h3 className="text-[16px] font-bold text-white leading-snug mb-2 line-clamp-2">
                                        {log.title}
                                    </h3>

                                    <p className="text-[15.5px] text-[#A1A1AA] leading-relaxed line-clamp-6 mb-3.5 whitespace-pre-wrap">
                                        {log.display_text || '내용이 없습니다.'}
                                    </p>

                                    <div className="flex justify-between items-center text-[12px] text-[#86868B] border-t border-[#3c3c3c]/50 pt-3">
                                        <span className="font-bold text-[#E5E5E5]">{log.writer_name}</span>
                                        <span className="text-[#60a5fa] font-bold flex items-center gap-1">
                                            자세히 보기
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                        </span>
                                    </div>
                                </div>
                        ))}
                        {visibleLogs.length < filteredLogs.length && (
                            <button
                                type="button"
                                onClick={() => setVisibleCount((currentCount) => currentCount + INITIAL_VISIBLE_COUNT)}
                                className="w-full rounded-[14px] border border-[#3c3c3c] bg-[#272726] py-3 text-[12px] font-bold text-[#A1A1AA] active:bg-[#30302f]"
                            >
                                20건 더 보기 ({visibleLogs.length}/{filteredLogs.length})
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Detail Overlay */}
            <AnimatePresence>
                {selectedLog && (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/75 backdrop-blur-sm"
                        style={{
                            paddingTop: 'max(1rem, env(safe-area-inset-top))',
                            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                        }}
                    >
                        <motion.div 
                            className="bg-[#1C1C1E] border border-[#2c2c2e] w-full max-w-[450px] rounded-[28px] overflow-hidden flex flex-col max-h-[82vh] shadow-2xl relative"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <div className="p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar text-left">
                                <div className="flex items-center justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={closeLogDetail}
                                        className="h-8 px-2.5 rounded-[9px] flex items-center justify-center gap-1 bg-[#2997ff] text-white shadow-sm active:bg-[#147ce5]"
                                        aria-label={`${selectedLogReturnsHome ? '홈' : '업무'}로 돌아가기`}
                                    >
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                        </svg>
                                        <span className="text-[12px] font-bold whitespace-nowrap">
                                            {selectedLogReturnsHome ? '홈' : '업무'}
                                        </span>
                                    </button>
                                    <span className="text-[13px] font-bold text-white">Director 상세</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-[42px] h-[42px] rounded-full bg-[#2c2c2e] overflow-hidden border border-[#444] shrink-0">
                                        <img 
                                            src={`${import.meta.env.BASE_URL}${selectedLog.writer_name}.webp`} 
                                            alt={selectedLog.writer_name} 
                                            className="w-full h-full object-cover" 
                                            onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} 
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-white font-bold text-[14.5px] truncate">{selectedLog.writer_name}</span>
                                        <span className="text-[#86868B] text-[11.5px] truncate">{selectedLog.writer_email}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5 items-center">
                                    <span className="text-[10px] font-bold px-[8px] py-[3px] rounded-[5px] bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                                        {selectedLog.category}
                                    </span>
                                    {selectedLog.line && selectedLog.line !== 'Unknown Line' && (
                                        <span className={`text-[10px] font-bold px-[8px] py-[3px] rounded-[5px] ${getLineBadgeStyle(selectedLog.line)}`}>
                                            {selectedLog.line}
                                        </span>
                                    )}
                                    <span className="text-[12px] font-semibold text-[#86868b] ml-auto">
                                        {selectedLog.isDeleted ? '삭제됨' : formatExactDate(selectedLog.work_date)}
                                    </span>
                                </div>

                                <div className="w-full h-px bg-[#2c2c2e]" />

                                <div className="flex flex-col gap-3">
                                    <h3 className="text-[18px] font-black text-white leading-snug">
                                        {selectedLog.title}
                                    </h3>

                                    <div className="flex flex-col gap-1.5 mt-1.5">
                                        <span className="text-[11.5px] font-bold text-[#86868b]">업무 기록 상세</span>
                                        <div className="p-4 bg-[#2c2c2e]/30 border border-[#2c2c2e] rounded-[16px] max-h-[220px] overflow-y-auto custom-thin-scrollbar">
                                            <p className="text-[15.5px] text-[#E5E5E5] leading-[1.6] whitespace-pre-wrap break-all">
                                                {selectedLog.display_text || '내용이 없습니다.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Comments List */}
                                    {selectedLog.metadata?.comments?.length > 0 && (
                                        <div className="flex flex-col gap-2 mt-2 border-t border-[#2c2c2e] pt-3.5">
                                            <span className="text-[11.5px] font-bold text-[#86868b]">댓글 ({selectedLog.metadata.comments.length})</span>
                                            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                                                {selectedLog.metadata.comments.map((comment, index) => (
                                                    <div key={index} className="p-2.5 bg-[#1e1e1f] border border-[#2c2c2e] rounded-[12px]">
                                                        <p className="text-[12.5px] text-[#E5E5E5] leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                                                        <div className="flex justify-between mt-1.5 text-[10px] text-[#86868b]">
                                                            <span>{comment.author}</span>
                                                            <span>{new Date(comment.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-2 pt-3 border-t border-[#2c2c2e] shrink-0">
                                    <button 
                                        onClick={closeLogDetail}
                                        className="flex-1 py-3.5 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white text-[13px] font-bold rounded-xl transition-colors cursor-pointer"
                                    >
                                        {selectedLogReturnsHome ? '홈으로' : '업무로'}
                                    </button>
                                    {!selectedLog.isDeleted && (selectedLog.source_url || getDirectorWorkspacePath(selectedLog)) && (
                                        <button 
                                            type="button"
                                            disabled={!canOpenOriginal}
                                            onClick={() => { handleGoToWorkspace(selectedLog); setSelectedLog(null); }}
                                            className={`flex-1 py-3.5 text-[13px] font-bold rounded-xl transition-colors ${
                                                canOpenOriginal
                                                    ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white cursor-pointer'
                                                    : 'bg-[#2c2c2e] text-[#636366] cursor-not-allowed'
                                            }`}
                                        >
                                            {canOpenOriginal ? '원문보기' : '원문보기 · 권한 제한'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Alert Modal Popup (Replaces system alerts) */}
            <AnimatePresence>
                {alertMessage && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            className="bg-[#1C1C1E] border border-[#2c2c2e] w-[320px] rounded-[24px] p-6 shadow-2xl flex flex-col items-center text-center"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                                alertType === 'success' ? 'bg-[#30d158]/10 text-[#30d158]' : 'bg-[#ff453a]/10 text-[#ff453a]'
                            }`}>
                                {alertType === 'success' ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                )}
                            </div>

                            <h4 className="text-white font-bold text-[16px] mb-2">
                                {alertType === 'success' ? '성공' : '이동 불가'}
                            </h4>

                            <p className="text-[#A1A1AA] text-[13px] leading-relaxed mb-5">
                                {alertMessage}
                            </p>

                            <button 
                                onClick={() => setAlertMessage('')}
                                className="w-full py-3 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white text-[13px] font-bold rounded-xl transition-colors cursor-pointer"
                            >
                                확인
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
