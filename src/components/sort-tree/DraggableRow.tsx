import * as React from "react";
import {useDraggable} from "@dnd-kit/core";

export interface DraggableRowProps {
    id: string;
    disabled?: boolean;
    children: React.ReactNode;
}

export const DraggableRow: React.FC<DraggableRowProps> = ({id, disabled, children}) => {
    const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({id, disabled});
    const style: React.CSSProperties = (transform
        ? {transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`}
        : undefined) as React.CSSProperties;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={isDragging ? "opacity-60" : ""}
        >
            {children}
        </div>
    );
};