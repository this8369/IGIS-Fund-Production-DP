export default function SidebarToggleButton({ isCollapsed, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#86868B] transition-colors hover:bg-black/5 hover:text-[#1D1D1F] dark:text-[#A1A1AA] dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
            aria-label={isCollapsed ? '왼쪽 메뉴 열기' : '왼쪽 메뉴 닫기'}
            title={isCollapsed ? '메뉴 열기' : '메뉴 닫기'}
        >
            <svg className="h-[21px] w-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.7">
                <rect x="2" y="3.5" width="20" height="17" rx="3" />
                <line x1="8" y1="3.5" x2="8" y2="20.5" />
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={isCollapsed ? 'm11.5 8.5 3.5 3.5-3.5 3.5' : 'm15 8.5-3.5 3.5 3.5 3.5'}
                />
            </svg>
        </button>
    );
}
