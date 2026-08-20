import React, { useRef, useEffect } from 'react';
import GovSystem from './governance/GovSystem';
import GovPrinciples from './governance/GovPrinciples';
import GovRaci from './governance/GovRaci';
import GovRoadmap from './governance/GovRoadmap';
import GovMeetings from './governance/GovMeetings';
import GovFundRnR from './governance/GovFundRnR';
import GovWorkingGroup from './governance/GovWorkingGroup';
import GovExternalComm from './governance/GovExternalComm';
import GovRiskTop10 from './governance/GovRiskTop10';
import GovMeetingLogs from './GovMeetingLogs';
import StakeInternal from './stakeholder/StakeInternal';
import StakeLp from './stakeholder/StakeLp';
import StakeTenant from './stakeholder/StakeTenant';
import StakePartner from './stakeholder/StakePartner';
import WorkspaceMarketing from './workspace/WorkspaceMarketing';
import WorkspacePm from './workspace/WorkspacePm';
import WorkspaceFinancing from './workspace/WorkspaceFinancing';
import WorkspaceDevelopment from './workspace/WorkspaceDevelopment';
import WorkspaceDigital from './workspace/WorkspaceDigital';
import WorkspaceFund from './workspace/WorkspaceFund';
import WorkspaceIpr from './workspace/WorkspaceIpr';
import WorkspaceIprWg from './workspace/WorkspaceIprWg';
import IotaDashboard from './IotaDashboard';
import VehicleIntegrated from './VehicleIntegrated';
import SystemFund421 from './SystemFund421';
import IotaTwo816 from './IotaTwo816';
import IotaOne427 from './IotaOne427';
import DecisionLog from './DecisionLog';
import PmoMeetingMain from './pmo/PmoMeetingMain';
import PmoCategoryMap from './pmo/PmoCategoryMap';
import PmoScheduleGate from './pmo/PmoScheduleGate';
import PmoPopupManager from './pmo/PmoPopupManager';

export default function PlatformCenter({ currentPath = '' }) {
    const scrollRef = useRef(null);

    const handleScroll = () => {
        if (scrollRef.current) {
            const state = window.history.state || {};
            window.history.replaceState({ ...state, scroll: scrollRef.current.scrollTop }, '');
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            const state = window.history.state;
            if (state && state.scroll !== undefined) {
                if (state.scroll === 0) {
                    scrollRef.current.scrollTop = 0;
                } else {
                    // Try multiple times since data might be loading asynchronously (e.g. Supabase fetches)
                    let attempts = 0;
                    const interval = setInterval(() => {
                        if (scrollRef.current) {
                            scrollRef.current.scrollTop = state.scroll;
                            attempts++;
                            // If the browser successfully applied the scroll (meaning DOM is now tall enough) or we timed out
                            if (scrollRef.current.scrollTop > 0 || attempts >= 15) {
                                clearInterval(interval);
                            }
                        } else {
                            clearInterval(interval);
                        }
                    }, 100);
                    return () => clearInterval(interval);
                }
            } else {
                scrollRef.current.scrollTop = 0;
            }
        }
    }, [currentPath]);

    const cleanPath = (currentPath || '').split('?')[0].replace(/\/$/, '');

    const renderGovernance = () => {
        switch(cleanPath) {
            case 'platform/iotaseoul/governance/system': return <GovSystem />;
            case 'platform/iotaseoul/governance/principles': return <GovPrinciples />;
            case 'platform/iotaseoul/governance/raci': return <GovRaci />;
            case 'platform/iotaseoul/governance/roadmap': return <GovRoadmap />;
            case 'platform/iotaseoul/governance/meetings': return <GovMeetings />;
            case 'platform/iotaseoul/governance/fund-rnr': return <GovFundRnR />;
            case 'platform/iotaseoul/governance/working-group': return <GovWorkingGroup />;
            case 'platform/iotaseoul/governance/external-comm': return <GovExternalComm />;
            case 'platform/iotaseoul/governance/risk-top10': return <GovRiskTop10 />;
            case 'platform/iotaseoul/meeting-logs': return <GovMeetingLogs />;
            default: return null;
        }
    };

    const renderStakeholder = () => {
        if (cleanPath === 'platform/iotaseoul/stakeholder/internal') return <StakeInternal />;
        if (cleanPath === 'platform/iotaseoul/stakeholder/lp') return <StakeLp />;
        if (cleanPath === 'platform/iotaseoul/stakeholder/tenant' || cleanPath.startsWith('platform/iotaseoul/stakeholder/tenant/')) {
            let tab = 'list';
            if (cleanPath.endsWith('/si')) tab = 'si';
            if (cleanPath.endsWith('/register')) tab = 'register';
            return <StakeTenant defaultTab={tab} />;
        }
        if (cleanPath === 'platform/iotaseoul/stakeholder/partner') return <StakePartner />;
        return null;
    };

    const renderWorkspace = () => {
        switch(cleanPath) {
            case 'platform/iotaseoul/workspace/marketing': return <WorkspaceMarketing />;
            case 'platform/iotaseoul/workspace/pm1': return <WorkspacePm part={1} />;
            case 'platform/iotaseoul/workspace/pm2': return <WorkspacePm part={2} />;
            case 'platform/iotaseoul/workspace/financing': return <WorkspaceFinancing />;
            case 'platform/iotaseoul/workspace/development': return <WorkspaceDevelopment />;
            case 'platform/iotaseoul/workspace/digital': return <WorkspaceDigital />;
            case 'platform/iotaseoul/workspace/fund': return <WorkspaceFund />;
            case 'platform/iotaseoul/workspace/ipr': return <WorkspaceIpr />;
            case 'platform/iotaseoul/project-reits': return <WorkspaceIprWg />;
            case 'platform/iotaseoul/vehicle-integrated': return <VehicleIntegrated />;
            case 'platform/iotaseoul/421-fund': return <SystemFund421 />;
            case 'platform/iotaseoul/iota-one-427': return <IotaOne427 />;
            case 'platform/iotaseoul/iota-two-816': return <IotaTwo816 />;
            case 'platform/iotaseoul/home': return <PmoMeetingMain />;
            case 'platform/iotaseoul/rr-matrix': return <PmoCategoryMap />;
            case 'platform/iotaseoul/timeline': return <PmoScheduleGate />;
            case 'platform/iotaseoul/popup-requests': return <PmoPopupManager />;
            case 'platform/iotaseoul/workflow': return <DecisionLog />;
            default: return null;
        }
    };

    const govContent = renderGovernance();
    const stakeContent = renderStakeholder();
    const workspaceContent = renderWorkspace();
    
    const isStaging = import.meta.env.MODE === 'staging';
    let activeContent = govContent || stakeContent || workspaceContent;
    if (!cleanPath || cleanPath === '' || cleanPath === 'platform/iotaseoul') {
        activeContent = <PmoMeetingMain />;
    } else if (cleanPath === 'platform/iotaseoul/dashboard') {
        activeContent = <IotaDashboard />;
    }

    if (activeContent) {
        return (
            <div className="flex-1 h-full bg-transparent flex flex-col relative font-sans text-[#1D1D1F] dark:text-[#E5E5E5] overflow-hidden transition-colors duration-300">
                <div ref={scrollRef} onScroll={handleScroll} className="flex-1 w-full overflow-y-auto hide-scrollbar flex flex-col relative">
                    <div key={currentPath} className="animate-content-blink flex-1 flex flex-col w-full min-h-full relative max-w-full overflow-x-hidden pt-[8px]">
                        {activeContent}
                    </div>
                </div>
            </div>
        );
    }

    // Default Fallback
    return (
        <div className="flex-1 h-full bg-transparent flex flex-col items-center justify-center relative font-sans text-[#E5E5E5] overflow-hidden transition-colors duration-300">
            <div className="w-16 h-16 mb-6 text-[#444] opacity-50">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>
            <h2 className="text-[20px] font-bold tracking-tight text-[#86868B] opacity-70">모듈 연결 필요</h2>
        </div>
    );
}
