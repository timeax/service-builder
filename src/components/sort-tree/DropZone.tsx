import * as React from "react";
import {useDroppable} from "@dnd-kit/core";

export interface DropZoneProps {
    id: string;
    height: number;
    className?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({id, height, className}) => {
    const {setNodeRef, isOver} = useDroppable({id});
    return (
        <div
            ref={setNodeRef}
            style={{height}}
            className={[
                "w-full transition-colors",
                isOver ? "bg-blue-500/25" : "bg-transparent",
                className ?? "",
            ].join(" ")}
        />
    );
};