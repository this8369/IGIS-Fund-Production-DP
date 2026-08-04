import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import SidebarProfileAvatar from './SidebarProfileAvatar';
import SidebarToggleButton from './SidebarToggleButton';
import useSidebarCollapse from './useSidebarCollapse';

const getStaffTitle = (memberInfo) => {
    if (!memberInfo?.staff_name) return '로그인 필요';
    const name = memberInfo.staff_name;
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
    return `${name} ${titles[name] || '매니저'}`;
};

export default function SystemLeftNav({ isCore, isPlatform = false }) {
        const navigate = (path) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.history.pushState(null, '', base + (path.startsWith('/') ? path : '/' + path));
        window.dispatchEvent(new Event('popstate'));
    };
    const { isLightMode, toggleTheme } = useTheme();
    const { user, memberInfo, signOut } = useAuth();
    const [fakeLight, setFakeLight] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const { isCollapsed, isContentVisible, toggleSidebar } = useSidebarCollapse();
    const expandedContentTransition = isContentVisible
        ? 'opacity-100 translate-x-0 delay-100'
        : 'opacity-0 -translate-x-1 pointer-events-none';
    const collapsedProfileTransition = isContentVisible
        ? 'opacity-0 translate-x-1 pointer-events-none'
        : 'opacity-100 translate-x-0 delay-100';

    const activeLight = isCore ? fakeLight : isLightMode;

    const AUTHORIZED_ADMINS = ['전기영', '이시정', '이관용'];
    const isAdmin = AUTHORIZED_ADMINS.includes(memberInfo?.staff_name);

    const handlePasswordChange = async () => {
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('비밀번호가 성공적으로 변경되었습니다.');
            setShowPasswordModal(false);
            setNewPassword('');
        } catch (error) {
            alert('비밀번호 변경 실패: ' + error.message);
        }
    };

    const handleToggle = () => {
        if (isCore) {
            setFakeLight(!fakeLight);
        } else {
            toggleTheme();
        }
    };

    return (
        <div className={`${isCollapsed ? 'w-[56px]' : 'w-[275px]'} h-full overflow-hidden bg-[#FBFBFD] dark:bg-transparent border-r border-black/10 dark:border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-[#1D1D1F] dark:text-white transition-[width,background-color,border-color,color] duration-300 ease-out`}>
            
            {/* Top IFPDP Header & Sidebar Collapse Icon */}
            <div className="relative w-full h-[62px] shrink-0">
                <span
                    onClick={() => {
                        navigate('/');
                    }}
                    className={`absolute left-[20px] top-[18px] whitespace-nowrap font-bold text-[20px] tracking-wide font-inter text-[#1D1D1F] dark:text-white transition-[opacity,transform,color] duration-150 cursor-pointer hover:text-gray-400 dark:hover:text-gray-400 ${expandedContentTransition}`}
                >IFPDP</span>
                <div className={`absolute top-[12px] transition-[left] duration-300 ease-out ${isCollapsed ? 'left-[10px]' : 'left-[224px]'}`}>
                    <SidebarToggleButton isCollapsed={isCollapsed} onToggle={toggleSidebar} />
                </div>
            </div>

            {/* Main Menu */}
            <div className={`w-[275px] flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col px-[9px] transition-[opacity,transform] duration-150 ${expandedContentTransition}`}>
                
                <div
                    onClick={() => {
                        navigate('/');
                    }}
                    className="flex items-center px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer transition-colors duration-300"
                >
                    <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 001 1m-6 0h6" /></svg>
                    <span className="font-light text-[14px]">홈</span>
                </div>

                {/* 1. 포트폴리오 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        <span className="font-light text-[14px]">포트폴리오</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 2. 자산 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        <span className="font-light text-[14px]">자산</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 3. 펀드 & 자본 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="font-light text-[14px]">펀드 & 자본</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 4. 이해관계자 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span className="font-light text-[14px]">이해관계자</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 5. 딜 파이프라인 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                        <span className="font-light text-[14px]">딜 파이프라인</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 6. 거버넌스 & 성과 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        <span className="font-light text-[14px]">거버넌스 & 성과</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                <div 
                    onClick={isPlatform ? () => {
                        navigate('/platform/iotaseoul');
                    } : undefined}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md mt-4 mb-2 transition-colors duration-300 border dark:border-[#3A3A3C] shadow-sm dark:bg-[#2A2A2A] group ${isPlatform ? 'hover:bg-[#18181A] dark:hover:bg-[#18181A] cursor-pointer border-gray-300 bg-white' : 'cursor-not-allowed opacity-40 border-gray-200 bg-gray-50'}`}
                >
                    <div className="flex items-center">
                        <span className="font-semibold text-[14px] text-[#111] dark:text-white group-hover:text-white dark:group-hover:text-white">IOTA Seoul CFT</span>
                    </div>
                    <svg className="w-3.5 h-3.5 text-[#86868B] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {isAdmin && (
                    <div 
                        onClick={() => {
                            window.open(`${import.meta.env.BASE_URL}system-admin`, '_blank');
                        }}
                        className="flex items-center justify-between px-2.5 py-2 hover:bg-[#FCEFD4] dark:hover:bg-[#4A3C2A] rounded-md cursor-pointer mt-4 transition-colors duration-300 border border-[#F5A623] text-[#F5A623]"
                    >
                        <div className="flex items-center">
                            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            <span className="font-semibold text-[14px]">Admin Logs</span>
                        </div>
                    </div>
                )}

                {/* 최근 채팅 영역 */}
                <div className="mt-8 mb-2 px-2.5">
                    <div className="font-semibold mb-2 text-[12px] text-[#86868B] dark:text-[#A1A1AA] transition-colors duration-300">최근 채팅</div>
                    <div className="flex flex-col gap-2.5 mt-4 text-[#888] dark:text-[#737373] transition-colors duration-300">
                        {[
                            "국내 개발중 프라임 자산 원가 비교",
                            "2026년 이지스에서 가장 큰 실물사업..",
                            "모빌리티 임대차 기획 진행 상황",
                            "펀드 만기 기한",
                            "사업 그룹 진행중인 프로젝트 갯수",
                            "데이터센터 중도 구축 자체 시나리오",
                            "아제미티스 매각 준비 현황"
                        ].map((chat, idx) => (
                            <div key={idx} className="font-medium text-[13px] hover:text-[#111] dark:hover:text-[#E5E5E5] cursor-pointer truncate transition-colors duration-200">
                                {chat}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Profile */}
            <div className="relative mt-auto">
                {/* Popover Menu */}
                {showProfileMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                        <div className={`absolute bottom-full mb-2 w-[258px] bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-[#3A3A3C] rounded-[16px] shadow-lg py-2 z-50 ${isContentVisible ? 'left-1/2 -translate-x-1/2' : 'left-[8px]'}`}>
                            <button onClick={() => { setShowProfileMenu(false); setShowPasswordModal(true); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#1D1D1F] dark:text-[#E5E5E5] hover:bg-[#F5F5F7] dark:hover:bg-[#3A3A3C] transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#86868B] dark:text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                비밀번호 변경
                            </button>
                            <button onClick={() => { setShowProfileMenu(false); setShowContactModal(true); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#1D1D1F] dark:text-[#E5E5E5] hover:bg-[#F5F5F7] dark:hover:bg-[#3A3A3C] transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#86868B] dark:text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                플랫폼 이용 문의
                            </button>
                            <div className="my-1 border-t border-black/5 dark:border-white/5"></div>
                            <button onClick={() => { setShowProfileMenu(false); setShowLogoutModal(true); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#FF453A] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#FF453A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                로그아웃
                            </button>
                        </div>
                    </>
                )}

                <div className={`relative transition-[height] duration-300 ease-out ${isContentVisible ? 'h-[80px]' : 'h-[64px]'}`}>
                    <button
                        type="button"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className={`absolute inset-x-0 bottom-0 w-full border-t border-black/10 dark:border-[#3A3A3C] py-3 flex items-center justify-center transition-[opacity,transform,background-color] duration-150 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${collapsedProfileTransition}`}
                        aria-label="프로필 메뉴 열기"
                        title={getStaffTitle(memberInfo)}
                    >
                        <SidebarProfileAvatar memberInfo={memberInfo} />
                    </button>
                    <div
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className={`absolute left-0 bottom-0 px-[15px] pt-4 pb-3 border-t border-black/10 dark:border-[#3A3A3C] w-[275px] flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-[opacity,transform,background-color] duration-150 ${expandedContentTransition}`}
                    >
                        <div className="flex items-center gap-3 p-1.5 -ml-1.5 rounded-lg transition-colors duration-300">
                            <SidebarProfileAvatar memberInfo={memberInfo} className="-ml-[2px]" />
                            <div className="flex flex-col max-w-[130px]">
                                <span className="font-semibold text-[14px] leading-tight mb-0.5 text-[#1D1D1F] dark:text-white transition-colors duration-300 tracking-tight truncate">
                                    {getStaffTitle(memberInfo)}
                                </span>
                                <span className="text-[#86868B] dark:text-gray-400 text-[12px] leading-none font-normal transition-colors duration-300 truncate">
                                    {user?.email || '권한 없음'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Expand Icon */}
                            <div className="text-[#86868B] transition-colors p-1 pointer-events-none">
                                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
                            </div>

                            {/* Theme Toggle Switch */}
                            <div
                                onClick={(e) => { e.stopPropagation(); handleToggle(); }}
                                className="flex shrink-0 items-center justify-center cursor-pointer"
                            >
                                <div className={`w-[42px] h-[24px] rounded-full relative transition-colors duration-300 ${activeLight ? 'bg-[#c3c2b7]' : 'bg-[#3A3A3C]'} border border-black/10 dark:border-[#4A4A4C]`}>
                                    <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-transform duration-300 shadow-sm ${activeLight ? 'translate-x-[20px]' : 'translate-x-[2px]'}`}></div>
                                    {/* Sun/Moon icons */}
                                    <svg className={`absolute left-[4px] top-[4px] w-4 h-4 text-[#111] transition-opacity duration-300 ${activeLight ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    <svg className={`absolute right-[3px] top-[3.5px] w-[15px] h-[15px] text-[#A1A1AA] transition-opacity duration-300 ${activeLight ? 'opacity-0' : 'opacity-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showContactModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-[#1D1D1F] dark:text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-[#1D1D1F] dark:text-white mb-2 tracking-tight">플랫폼 이용 문의</h3>
                        <p className="text-[15px] font-medium text-[#86868B] dark:text-[#A1A1AA] text-center leading-relaxed mb-8">
                            jk.jeon@igisam.com<br/>010-9076-5369<br/>전기영 매니저에게 연락해주세요.
                        </p>
                        <button onClick={() => setShowContactModal(false)} className="w-full py-3.5 rounded-[16px] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-semibold text-[16px] hover:bg-[#E8E8ED] dark:hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                            닫기
                        </button>
                    </div>
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-[#1D1D1F] dark:text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-[#1D1D1F] dark:text-white mb-2 tracking-tight">비밀번호 변경</h3>
                        <p className="text-[15px] font-medium text-[#86868B] dark:text-[#A1A1AA] text-center leading-relaxed mb-6">
                            새로운 비밀번호를 입력해주세요.
                        </p>
                        <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="새 비밀번호"
                            className="w-full h-[52px] bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-[#333333] rounded-[16px] px-5 text-[17px] text-[#1D1D1F] dark:text-white placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] transition-all mb-4"
                        />
                        <div className="flex w-full gap-3">
                            <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-3.5 rounded-[16px] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-semibold text-[16px] hover:bg-[#E8E8ED] dark:hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                                취소
                            </button>
                            <button onClick={handlePasswordChange} disabled={!newPassword} className="flex-1 py-3.5 rounded-[16px] bg-[#0071E3] text-white font-semibold text-[16px] hover:bg-[#0077ED] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                변경하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLogoutModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-[#FF453A]" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-[#1D1D1F] dark:text-white mb-2 tracking-tight">로그아웃</h3>
                        <p className="text-[15px] font-medium text-[#86868B] dark:text-[#A1A1AA] text-center leading-relaxed mb-6">
                            정말 로그아웃 하시겠습니까?
                        </p>
                        <div className="flex w-full gap-3">
                            <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3.5 rounded-[16px] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-semibold text-[16px] hover:bg-[#E8E8ED] dark:hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                                취소
                            </button>
                            <button onClick={async () => {
                                setShowLogoutModal(false);
                                await signOut();
                            }} className="flex-1 py-3.5 rounded-[16px] bg-[#FF453A] text-white font-semibold text-[16px] hover:bg-[#FF3B30] transition-colors cursor-pointer">
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
