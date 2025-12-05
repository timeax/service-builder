import * as React from "react";
import { useDroppable } from "@dnd-kit/core";

export interface DropZoneProps {
    id: string;
    height: number;
    className?: string;
    style?: React.CSSProperties;
    onNativeDrop?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
    /** When true, this zone is NOT registered as a droppable (no highlights, no hits). */
    disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
                      id,
                      height,
                      className,
                      style,
                      onNativeDrop,
                      disabled,
                                                  }) => {
    if (disabled) {
        // Not registered with dnd-kit at all → collision detection ignores it
        return (
            <div
                style={{ height, ...style }}
                className={["w-full transition-colors", className ?? ""].join(" ")}
            />
        );
    }

    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            style={{ height, ...style }}
            className={[
                "w-full transition-colors",
                isOver ? "bg-blue-500/25" : "bg-transparent",
                className ?? "",
            ].join(" ")}
            onDragOver={onNativeDrop ? (e) => e.preventDefault() : undefined}
            onDrop={onNativeDrop ? (e) => { e.preventDefault(); onNativeDrop(e, id); } : undefined}
        />
    );
};
