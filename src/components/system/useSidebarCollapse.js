import { useEffect, useRef, useState } from 'react';

const LEFT_NAV_COLLAPSED_KEY = 'systemLeftNavCollapsed';

export default function useSidebarCollapse() {
    const initialCollapsed = localStorage.getItem(LEFT_NAV_COLLAPSED_KEY) === 'true';
    const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
    const [isContentVisible, setIsContentVisible] = useState(!initialCollapsed);
    const targetCollapsedRef = useRef(initialCollapsed);
    const transitionTimerRef = useRef(null);

    useEffect(() => () => clearTimeout(transitionTimerRef.current), []);

    const toggleSidebar = () => {
        const nextCollapsed = !targetCollapsedRef.current;
        targetCollapsedRef.current = nextCollapsed;
        localStorage.setItem(LEFT_NAV_COLLAPSED_KEY, String(nextCollapsed));
        clearTimeout(transitionTimerRef.current);

        if (nextCollapsed) {
            setIsContentVisible(false);
            transitionTimerRef.current = setTimeout(() => setIsCollapsed(true), 110);
            return;
        }

        setIsCollapsed(false);
        transitionTimerRef.current = setTimeout(() => setIsContentVisible(true), 150);
    };

    return { isCollapsed, isContentVisible, toggleSidebar };
}
