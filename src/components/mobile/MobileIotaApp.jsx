import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import MobileTaskContainer from './MobileTaskContainer';
import MobileCollaborationContainer from './MobileCollaborationContainer';
import MobileMyTasks from './MobileMyTasks';
import MobileNotifications from './MobileNotifications';
import MobileComposerSheet from './MobileComposerSheet';
import MobileHome from './MobileHome';
import { requestFirebaseNotificationPermission } from '../../utils/firebase';
import { getInitialWorkspace } from './mobileIotaData';
import { getMemberIotaOrganization } from '../../utils/iotaOrganizations';

export default function MobileIotaApp({ navigateTo }) {
    const { user, memberInfo, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState(0); // 0: 주요업무, 1: 협업게시판, 2: 내업무, 3: 알림
    const [highlightLogId, setHighlightLogId] = useState(null);
    const [highlightTaskId, setHighlightTaskId] = useState(null);
    const [taskDefaultFilter, setTaskDefaultFilter] = useState(null);
    const [taskEntryRequest, setTaskEntryRequest] = useState(null);
    const [collaborationEntryRequest, setCollaborationEntryRequest] = useState(null);
    const [targetMobileWorkspace, setTargetMobileWorkspace] = useState(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [unreadNotiCount, setUnreadNotiCount] = useState(0);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showBottomNav, setShowBottomNav] = useState(true);
    const [lastScrollTop, setLastScrollTop] = useState(0);
    const contentRef = useRef(null);

    const [selectedWorkspaceCode, setSelectedWorkspaceCode] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    useEffect(() => {
        if (memberInfo && !selectedWorkspaceCode) {
            setSelectedWorkspaceCode(getInitialWorkspace(memberInfo)?.code);
        }
    }, [memberInfo, selectedWorkspaceCode]);

    useEffect(() => {
        setShowBottomNav(true);
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    const handleScroll = (e) => {
        const scrollTop = e.currentTarget.scrollTop;
        const scrollHeight = e.currentTarget.scrollHeight;
        const clientHeight = e.currentTarget.clientHeight;
        
        // Prevent scroll noise at the extremes
        if (scrollTop <= 10) {
            setShowBottomNav(true);
            setLastScrollTop(scrollTop);
            return;
        }
        if (scrollTop + clientHeight >= scrollHeight - 10) {
            setShowBottomNav(true);
            setLastScrollTop(scrollTop);
            return;
        }

        if (scrollTop > lastScrollTop && scrollTop > 50) {
            setShowBottomNav(false);
        } else if (scrollTop < lastScrollTop) {
            setShowBottomNav(true);
        }
        setLastScrollTop(scrollTop);
    };

    useEffect(() => {
        if (memberInfo?.auth_id) {
            requestFirebaseNotificationPermission(memberInfo.auth_id);
        }
    }, [memberInfo?.auth_id]);

    // Detect Chrome PWA "Add to Home Screen" standalone mode
    useEffect(() => {
        const checkStandalone = () => {
            const isStandaloneMode = 
                window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone || 
                document.referrer.includes('android-app://');
            setIsStandalone(!!isStandaloneMode);
        };
        checkStandalone();

        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e) => setIsStandalone(e.matches);
        
        try {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } catch (err) {
            try {
                mediaQuery.addListener(handleChange);
                return () => mediaQuery.removeListener(handleChange);
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    // Force correct mobile viewport meta tag configuration dynamically (critical for standalone PWA initialization)
    useEffect(() => {
        const setViewportMeta = () => {
            let meta = document.querySelector('meta[name="viewport"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'viewport';
                document.getElementsByTagName('head')[0].appendChild(meta);
            }
            meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
        };
        setViewportMeta();
        const timer = setTimeout(setViewportMeta, 300);
        return () => clearTimeout(timer);
    }, [isStandalone]);

    // Lock html/body scrolling and reset window offset to fix mobile viewport cutoff bugs
    useEffect(() => {
        const originalHtmlOverflow = document.documentElement.style.overflow;
        const originalHtmlHeight = document.documentElement.style.height;
        const originalBodyOverflow = document.body.style.overflow;
        const originalBodyHeight = document.body.style.height;

        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100dvh';
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100dvh';
        
        // Force scroll reset
        window.scrollTo(0, 0);

        return () => {
            document.documentElement.style.overflow = originalHtmlOverflow;
            document.documentElement.style.height = originalHtmlHeight;
            document.body.style.overflow = originalBodyOverflow;
            document.body.style.height = originalBodyHeight;
        };
    }, []);

    // Fetch unread notification count
    useEffect(() => {
        if (!memberInfo?.auth_id) return;
        const fetchUnread = async () => {
            const { count } = await supabase
                .from('iota_notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', memberInfo.auth_id)
                .eq('is_read', false);
            setUnreadNotiCount(count || 0);
        };
        fetchUnread();
    }, [memberInfo?.auth_id, activeTab]);

    const handleLogout = async () => {
        if (window.confirm("로그아웃 하시겠습니까?")) {
            await signOut();
        }
    };

    const sizeStyle = {
        width: '100%',
        height: '100%',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        position: 'absolute',
        top: 0,
        left: 0
    };
    return (
        <div 
            className="flex flex-col bg-[#1F1F1E] text-[#E5E5E5] font-sans relative overflow-hidden"
            style={sizeStyle}
        >
            {/* Status Bar Shield to prevent card text showing through notch safe area when scrolling */}
            <div 
                className="fixed top-0 left-0 w-full z-45 bg-[#272726]"
                style={{ height: 'env(safe-area-inset-top)' }}
            />

            {/* Main Content Area (App Bar is now in normal flow at the top) */}
            <div 
                ref={contentRef}
                onScroll={handleScroll}
                className="w-full flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-[#1F1F1E] flex flex-col"
                style={{
                    paddingBottom: 'calc(48px + env(safe-area-inset-bottom))'
                }}
            >
                {/* App Bar (In-flow layout scrolls naturally) */}
                <div 
                    className="w-full flex items-center justify-between px-4 bg-[#272726] border-b border-[#3c3c3c] z-30 shrink-0"
                    style={{
                        height: 'calc(48px + env(safe-area-inset-top))',
                        paddingTop: 'env(safe-area-inset-top)'
                    }}
                >
                    <div className="flex flex-col">
                        <span className="text-[17px] font-bold text-white tracking-tight">IOTA Seoul CFT</span>
                        {memberInfo && (
                            <span className="text-[12px] text-[#A1A1AA] font-medium mt-[-1.5px]">
                                {memberInfo.staff_name} · {memberInfo.role_code || 'member'}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3 items-center">
                        <button 
                            onClick={() => setActiveTab(4)}
                            className="relative text-[#E5E5E5] hover:text-white transition-colors"
                        >
                            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadNotiCount > 0 && (
                                <div className="absolute -top-[2px] -right-[4px] w-[14px] h-[14px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-[#272726]">
                                    {unreadNotiCount > 9 ? '9+' : unreadNotiCount}
                                </div>
                            )}
                        </button>
                        <button 
                            onClick={() => {
                                localStorage.setItem('force_pc_mode', 'true');
                                navigateTo('platform/iotaseoul/home');
                            }}
                            className="text-[12px] text-[#E5E5E5] bg-[#3c3c3c]/50 hover:bg-[#3c3c3c] transition-colors px-3 py-1.5 rounded-full border border-[#3c3c3c] font-semibold"
                        >
                            PC버전
                        </button>
                        <button onClick={handleLogout} className="text-[12px] text-[#9A9A98] hover:text-white transition-colors bg-[#272726] px-3 py-1.5 rounded-full border border-[#3c3c3c]">
                            로그아웃
                        </button>
                    </div>
                </div>
                {activeTab === 0 && (
                    <MobileHome 
                        memberInfo={memberInfo}
                        onNavigateToTab={(tabIdx, filterStr, options = {}) => {
                            setTaskDefaultFilter(filterStr || null);
                            if (tabIdx === 1) {
                                const url = new URL(window.location.href);
                                if (options.taskId) {
                                    url.searchParams.set('taskId', options.taskId);
                                } else {
                                    url.searchParams.delete('taskId');
                                }
                                window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
                                setTaskEntryRequest({
                                    viewMode: options.viewMode || 'pmo',
                                    directorLogId: options.directorLogId || null,
                                    returnToHome: Boolean(options.returnToHome),
                                    requestedAt: Date.now(),
                                });
                            }
                            if (tabIdx === 2) {
                                setCollaborationEntryRequest({
                                    department: options.collaborationDept || '전체',
                                    itemId: options.collaborationItemId || null,
                                    requestedAt: Date.now(),
                                });
                            }
                            setActiveTab(tabIdx);
                        }}
                    />
                )}
                {activeTab === 1 && (
                    <MobileTaskContainer 
                        memberInfo={memberInfo} 
                        defaultFilter={taskDefaultFilter}
                        onResetFilter={() => setTaskDefaultFilter(null)}
                        entryRequest={taskEntryRequest}
                        onEntryHandled={() => setTaskEntryRequest(null)}
                        onReturnToHome={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.delete('taskId');
                            window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
                            setTaskEntryRequest(null);
                            setActiveTab(0);
                        }}
                    />
                )}
                {activeTab === 2 && (
                    <MobileCollaborationContainer 
                        memberInfo={memberInfo}
                        entryRequest={collaborationEntryRequest}
                        onEntryHandled={() => setCollaborationEntryRequest(null)}
                    />
                )}
                {activeTab === 3 && (
                    <MobileMyTasks
                        memberInfo={memberInfo}
                        onNavigateToSource={(activity) => {
                            if (activity.navigationType === 'workspace') {
                                setCollaborationEntryRequest({
                                    department: activity.department || '전체',
                                    itemId: `log-${activity.logId}`,
                                    requestedAt: Date.now(),
                                });
                                setActiveTab(2);
                                return;
                            }

                            if (activity.navigationType === 'popup') {
                                setCollaborationEntryRequest({
                                    department: '전체',
                                    itemId: `popup-${activity.taskId}`,
                                    requestedAt: Date.now(),
                                });
                                setActiveTab(2);
                                return;
                            }

                            if (activity.navigationType === 'director') {
                                setTaskEntryRequest({
                                    viewMode: 'director',
                                    directorLogId: activity.directorLogId,
                                    returnToHome: false,
                                    requestedAt: Date.now(),
                                });
                                setActiveTab(1);
                                return;
                            }

                            if (activity.navigationType === 'task' && activity.taskId) {
                                const url = new URL(window.location.href);
                                url.searchParams.set('taskId', activity.taskId);
                                window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
                                setTaskEntryRequest({
                                    viewMode: 'pmo',
                                    directorLogId: null,
                                    returnToHome: false,
                                    requestedAt: Date.now(),
                                });
                                setActiveTab(1);
                            }
                        }}
                    />
                )}
                {activeTab === 4 && (
                    <MobileNotifications 
                        memberInfo={memberInfo} 
                        onRead={() => setUnreadNotiCount(Math.max(0, unreadNotiCount - 1))} 
                        onNotificationClick={async (noti) => {
                            try {
                                console.log('[MobileIotaApp] 알림 터치 수신:', noti);
                                const isLogNotif = noti.type === 'log' || 
                                                   noti.type === 'logs' || 
                                                   String(noti.type).toLowerCase() === 'log' ||
                                                   noti.type === 'comment' ||
                                                   noti.type === 'comments' ||
                                                   (noti.title && (
                                                       noti.title.includes('[협업]') || 
                                                       noti.title.includes('[@언급]') || 
                                                       noti.title.includes('댓글')
                                                   ));

                                const isTaskNotif = noti.type === 'task' || 
                                                    String(noti.type).toLowerCase() === 'task' ||
                                                    (noti.title && (noti.title.includes('[Task]') || noti.title.includes('신규 Task')));

                                if (isLogNotif) {
                                    console.log('[MobileIotaApp] 협업글 알림 감지. reference_id:', noti.reference_id);
                                    let logId = null;
                                    let wsCode = null;
                                    
                                    if (noti.reference_id) {
                                        const refStr = String(noti.reference_id);
                                        if (refStr.includes('|')) {
                                            const parts = refStr.split('|');
                                            logId = parts[0];
                                            wsCode = parts[1];
                                        } else {
                                            logId = refStr;
                                        }
                                        setHighlightLogId(logId);
                                        console.log('[MobileIotaApp] highlightLogId 설정:', logId);
                                    }
                                    
                                    // Fallback: Parse workspace code from notification title text
                                    if (!wsCode) {
                                        const title = String(noti.title || '');
                                        const body = String(noti.body || '');
                                        const combinedText = title + ' ' + body;
                                        if (combinedText.includes('사업1파트')) wsCode = 'WS_PM1';
                                        else if (combinedText.includes('사업2파트')) wsCode = 'WS_PM2';
                                        else if (combinedText.includes('사업 PM') || combinedText.includes('사업PM')) wsCode = 'WS_PM';
                                        else if (combinedText.includes('파이낸싱') || combinedText.includes('재원조달')) wsCode = 'WS_LFC';
                                        else if (combinedText.includes('개발') || combinedText.includes('설계')) wsCode = 'WS_DSC';
                                        else if (combinedText.includes('마케팅')) wsCode = 'WS_EMC';
                                        else if (combinedText.includes('공간') || combinedText.includes('SSC') || combinedText.includes('디지털')) wsCode = 'WS_SSC';
                                        else if (combinedText.includes('펀드') || combinedText.includes('KAM')) wsCode = 'WS_KAM';
                                        else if (combinedText.includes('IPR')) wsCode = 'WS_IPR';
                                        console.log('[MobileIotaApp] wsCode Fallback 추론:', wsCode);
                                    }
                                    
                                    if (wsCode) {
                                        setTargetMobileWorkspace(wsCode);
                                        console.log('[MobileIotaApp] targetMobileWorkspace 설정:', wsCode);
                                    }
                                    setActiveTab(1);
                                } else if (isTaskNotif) {
                                    let taskId = null;
                                    let wsCode = null;
                                    
                                    if (noti.reference_id) {
                                        const refStr = String(noti.reference_id);
                                        if (refStr.includes('|')) {
                                            const parts = refStr.split('|');
                                            taskId = parts[0];
                                            wsCode = parts[1];
                                        } else {
                                            taskId = refStr;
                                        }
                                    }

                                    const combinedText = `${noti.title || ''} ${noti.body || ''}`;
                                    let isPopupTask = wsCode === 'WS_POPUP_REQUESTS'
                                        || combinedText.includes('단발성')
                                        || combinedText.includes('팝업');

                                    if (!isPopupTask && taskId) {
                                        const { data: notifiedTask, error: taskTypeError } = await supabase
                                            .schema('iota_v2')
                                            .from('iota_pmo_tasks')
                                            .select('task_type')
                                            .eq('id', taskId)
                                            .maybeSingle();

                                        if (taskTypeError) {
                                            console.warn('[MobileIotaApp] 알림 업무 유형 확인 실패:', taskTypeError);
                                        } else {
                                            isPopupTask = notifiedTask?.task_type === '팝업';
                                        }
                                    }

                                    if (isPopupTask && taskId) {
                                        setCollaborationEntryRequest({
                                            department: '전체',
                                            itemId: `popup-${taskId}`,
                                            requestedAt: Date.now(),
                                        });
                                        setActiveTab(2);
                                        return;
                                    }
                                    
                                    if (!wsCode) {
                                        const title = noti.title || '';
                                        if (title.includes('사업1파트')) wsCode = 'WS_PM1';
                                        else if (title.includes('사업2파트')) wsCode = 'WS_PM2';
                                        else if (title.includes('사업 PM') || title.includes('사업PM')) wsCode = 'WS_PM';
                                        else if (title.includes('파이낸싱')) wsCode = 'WS_LFC';
                                        else if (title.includes('개발')) wsCode = 'WS_DSC';
                                        else if (title.includes('마케팅')) wsCode = 'WS_EMC';
                                        else if (title.includes('공간') || title.includes('SSC')) wsCode = 'WS_SSC';
                                        else if (title.includes('펀드') || title.includes('KAM')) wsCode = 'WS_KAM';
                                        else if (title.includes('IPR')) wsCode = 'WS_IPR';
                                    }
                                    
                                    if (taskId) {
                                        setHighlightTaskId(taskId);
                                    }
                                    if (wsCode) {
                                        setTargetMobileWorkspace(wsCode);
                                    }
                                    setActiveTab(0);
                                }
                            } catch (err) {
                                console.error("Error in onNotificationClick:", err);
                            }
                        }}
                    />
                )}
            </div>

            {/* Floating Action Button (Tasks and My Tasks) */}
            {(activeTab === 1 || activeTab === 2) && (
                <button 
                    onClick={() => setIsComposerOpen(true)}
                    className="absolute right-5 w-14 h-14 bg-[#3b82f6] hover:bg-[#2563eb] rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.3)] z-40 active:scale-95 transition-all duration-300 ease-in-out"
                    style={{
                        bottom: showBottomNav
                            ? 'calc(48px + env(safe-area-inset-bottom) + 12px)'
                            : 'calc(env(safe-area-inset-bottom) + 20px)'
                    }}
                >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            )}

            {/* Bottom Navigation */}
            <div className={`flex absolute bottom-0 left-0 w-full bg-[#272726] border-t border-[#3c3c3c] z-30 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-in-out ${
                showBottomNav ? 'translate-y-0' : 'translate-y-full pointer-events-none'
            }`}>
                {[
                    { id: 0, label: '홈', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
                    { id: 1, label: '통합업무보드', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> },
                    { id: 2, label: '워크스페이스', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
                    { id: 3, label: '마이', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => {
                            if (tab.id === 1) {
                                setTaskDefaultFilter(null);
                                setTaskEntryRequest({
                                    viewMode: 'pmo',
                                    directorLogId: null,
                                    returnToHome: false,
                                    requestedAt: Date.now(),
                                });
                            }
                            if (tab.id === 2) {
                                setCollaborationEntryRequest({
                                    department: getMemberIotaOrganization(memberInfo),
                                    itemId: null,
                                    requestedAt: Date.now(),
                                });
                            }
                            setActiveTab(tab.id);
                        }}
                        className={`flex-1 flex flex-col items-center justify-center pt-[8px] pb-[4px] relative ${activeTab === tab.id ? 'text-[#60a5fa]' : 'text-[#9A9A98]'}`}
                    >
                        <div className="relative">
                            <svg className={`w-[18px] h-[18px] mb-[1px] ${activeTab === tab.id ? 'stroke-2' : 'stroke-[1.5]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {tab.icon}
                            </svg>
                        </div>
                        <span className={`text-[11px] ${activeTab === tab.id ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Composer Sheet Modal */}
            {isComposerOpen && (
                <MobileComposerSheet 
                    memberInfo={memberInfo}
                    onClose={() => setIsComposerOpen(false)} 
                    onSuccess={() => {
                        setIsComposerOpen(false);
                        triggerRefresh();
                    }} 
                    activeTab={activeTab}
                    initialWorkspaceCode={selectedWorkspaceCode}
                />
            )}
        </div>
    );
}
