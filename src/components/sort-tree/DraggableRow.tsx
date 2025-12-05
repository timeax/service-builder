import * as React from "react";
import { useDraggable } from "@dnd-kit/core";

export interface DraggableRowProps {
    id: string;
    disabled?: boolean;
    children: React.ReactNode;
}

/**
 * Draggable wrapper that keeps the original element IN PLACE.
 * We do NOT apply transforms; the moving preview is rendered by <DragOverlay />.
 */
export const DraggableRow: React.FC<DraggableRowProps> = ({ id, disabled, children }) => {
    const { attributes, listeners, setNodeRef } = useDraggable({ id, disabled });

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            // No transform here on purpose.
            style={{}}
        >
            {children}
        </div>
    );
};
