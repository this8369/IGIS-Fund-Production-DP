import React, { useState, useEffect } from 'react';
import MobilePmoTaskList from './MobilePmoTaskList';
import MobileWorkflowLogs from './MobileWorkflowLogs';
import { motion } from 'framer-motion';

export default function MobileTaskContainer({
    memberInfo,
    defaultFilter,
    onResetFilter,
    entryRequest,
    onEntryHandled,
    onReturnToHome,
}) {
    // viewMode: 'pmo' | 'director'
    const [viewMode, setViewMode] = useState(entryRequest?.viewMode || 'pmo');
    const [returnToHomeOnDetailClose, setReturnToHomeOnDetailClose] = useState(
        Boolean(entryRequest?.returnToHome)
    );

    // 홈에서 대시보드 클릭을 통해 defaultFilter가 들어왔을 때,
    // viewMode가 director로 되어있다면 자동으로 pmo로 전환해줍니다.
    useEffect(() => {
        if (defaultFilter) {
            setViewMode('pmo');
        }
    }, [defaultFilter]);

    useEffect(() => {
        if (!entryRequest?.viewMode) return;
        setViewMode(entryRequest.viewMode);
        setReturnToHomeOnDetailClose(Boolean(entryRequest.returnToHome));
        if (entryRequest.viewMode !== 'director' || !entryRequest.directorLogId) {
            onEntryHandled?.();
        }
    }, [entryRequest, onEntryHandled]);

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full bg-[#111111] overflow-hidden">
            {/* Header Area with Segmented Control */}
            <div className="bg-[#1A1A1A]/95 backdrop-blur-md z-10 sticky top-0 border-b border-[#3c3c3c]">
                <div className="px-3 py-1.5 flex items-center justify-center">
                    <div className="flex p-0.5 bg-[#111111] border border-[#3c3c3c] rounded-[12px] w-full max-w-[320px] relative shadow-inner">
                        {/* Sliding Background */}
                        <motion.div
                            className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-[#3b82f6] border border-[#60a5fa]/50 rounded-[10px] shadow-[0_2px_10px_rgba(59,130,246,0.28)]"
                            initial={false}
                            animate={{
                                x: viewMode === 'pmo' ? 0 : '100%',
                            }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                        
                        <button
                            type="button"
                            onClick={() => setViewMode('pmo')}
                            className={`flex-1 py-1 flex items-center justify-center gap-1.5 text-[13px] font-bold rounded-[10px] relative z-10 transition-colors ${
                                viewMode === 'pmo' ? 'text-white' : 'text-[#A1A1AA]'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h6" />
                            </svg>
                            통합업무보드
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('director')}
                            className={`flex-1 py-1 flex items-center justify-center gap-1.5 text-[13px] font-bold rounded-[10px] relative z-10 transition-colors ${
                                viewMode === 'director' ? 'text-white' : 'text-[#A1A1AA]'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414A1 1 0 0117 7.414V19a2 2 0 01-2 2z" />
                            </svg>
                            Director 업무보고
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto w-full relative">
                {viewMode === 'pmo' ? (
                    <MobilePmoTaskList 
                        memberInfo={memberInfo} 
                        defaultFilter={defaultFilter}
                        onResetFilter={onResetFilter}
                        returnToHomeOnDetailClose={returnToHomeOnDetailClose}
                        onReturnToHome={onReturnToHome}
                    />
                ) : (
                    <MobileWorkflowLogs
                        memberInfo={memberInfo}
                        initialLogId={entryRequest?.directorLogId}
                        onInitialLogHandled={onEntryHandled}
                        returnToHomeOnInitialDetail={returnToHomeOnDetailClose}
                        onReturnToHome={onReturnToHome}
                    />
                )}
            </div>
        </div>
    );
}
