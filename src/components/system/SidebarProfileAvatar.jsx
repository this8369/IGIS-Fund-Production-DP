export default function SidebarProfileAvatar({ memberInfo, className = '' }) {
    const staffName = memberInfo?.staff_name;

    return (
        <div className={`w-10 h-10 rounded-full overflow-hidden flex shrink-0 items-center justify-center bg-[#E5E5EA] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 transition-colors duration-300 ${className}`}>
            {staffName && (
                <img
                    src={`${import.meta.env.BASE_URL}${staffName}.webp`}
                    alt={`${staffName} 프로필`}
                    className="w-full h-full object-cover"
                    onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        event.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                />
            )}
            <span className={`${staffName ? 'hidden' : ''} text-[#111] dark:text-[#F5F5F7] text-[13px] font-bold tracking-tighter`}>
                {staffName ? staffName.substring(0, 2) : 'U'}
            </span>
        </div>
    );
}
