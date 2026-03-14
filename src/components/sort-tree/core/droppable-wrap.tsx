import { useDroppable } from '@dnd-kit/core';
import * as React from 'react';

export function OnDroppableWrap(props: {
    id: string;
    onNativeDrop?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
    children: React.ReactNode;
    /** When true, skip registration so dnd-kit ignores it (prevents child zones from activating). */
    disabled?: boolean;
}) {
    const { id, onNativeDrop, children, disabled } = props;

    if (disabled) return <div>{children}</div>;

    const { setNodeRef } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            onDragOver={onNativeDrop ? (e) => e.preventDefault() : undefined}
            onDrop={
                onNativeDrop
                    ? (e) => {
                          e.preventDefault();
                          onNativeDrop(e, id);
                      }
                    : undefined
            }
        >
            {children}
        </div>
    );
}
