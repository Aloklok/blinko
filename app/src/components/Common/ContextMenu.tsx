import React, { useCallback } from 'react';
import {
    Menu,
    MenuItem,
    MenuButton,
    ControlledMenu,
    useMenuState,
} from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/zoom.css';

// 建立一个全局事件系统来模拟 rctx-contextmenu 的触发行为
const contextMenuListeners: Record<string, (e: React.MouseEvent) => void> = {};

export const ContextMenuTrigger = ({
    id,
    children
}: {
    id: string,
    children: React.ReactNode
}) => {
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (contextMenuListeners[id]) {
            contextMenuListeners[id](e);
        }
    }, [id]);

    return (
        <div onContextMenu={handleContextMenu}>
            {children}
        </div>
    );
};

export const ContextMenu = ({
    id,
    children,
    className,
    animation = 'zoom'
}: {
    id: string,
    children: React.ReactNode,
    className?: string,
    animation?: string,
    hideOnLeave?: boolean
}) => {
    const [menuProps, toggleMenu] = useMenuState({ transition: true });
    const [anchorPoint, setAnchorPoint] = React.useState({ x: 0, y: 0 });

    React.useEffect(() => {
        const listener = (e: React.MouseEvent) => {
            setAnchorPoint({ x: e.clientX, y: e.clientY });
            toggleMenu(true);
        };
        contextMenuListeners[id] = listener;
        return () => {
            delete contextMenuListeners[id];
        };
    }, [id, toggleMenu]);

    return (
        <ControlledMenu
            {...menuProps}
            anchorPoint={anchorPoint}
            direction="right"
            onClose={() => toggleMenu(false)}
            className={className}
        >
            {children}
        </ControlledMenu>
    );
};

export const ContextMenuItem = ({
    onClick,
    children,
    disabled
}: {
    onClick?: () => void,
    children: React.ReactNode,
    disabled?: boolean
}) => {
    return (
        <MenuItem onClick={onClick} disabled={disabled}>
            {children}
        </MenuItem>
    );
};