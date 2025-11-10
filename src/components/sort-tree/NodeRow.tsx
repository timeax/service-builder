import * as React from "react";
import "./NodeRow.css";
import { DefaultNode } from "./DefaultNode";
import type { NodePath, TreeNode } from "./types";
import { VscChevronRight } from "react-icons/vsc";
import { TbChevronDownRight } from "react-icons/tb";

export interface NodeRowProps<T = unknown> {
    node: TreeNode<T>;
    path: NodePath;
    depth: number;
    indent: number; // px per depth
    matched: boolean;
    isDragging: boolean;

    onToggle(): void;

    renderNode?: (args: {
        node: TreeNode<T>;
        depth: number;
        isDragging: boolean;
        path: NodePath;
        toggle(): void;
        matched: boolean;
    }) => React.ReactNode;

    onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;

    /** Optional binding lines config */
    binding?: {
        show: boolean;
        guides: boolean[]; // length = depth - 1 (true => draw vertical in that ancestor column)
        isLast: boolean;   // is last among siblings

        /** Optional styling */
        lineStyle?: "solid" | "dashed" | "dotted";
        lineWidth?: number; // px
        color?: string;     // CSS color
    };
}

export function NodeRow<T = unknown>({
    node,
    path,
    depth,
    indent,
    matched,
    isDragging,
    onToggle,
    renderNode,
    onContextMenu,
    binding,
}: NodeRowProps<T>) {
    const hasParent = depth > 1;
    const showBinding = !!binding?.show && hasParent;

    // CSS variables for theming the lines (safe cast for custom props)
    const lineVars = {
        ["--tree-line-color" as any]: binding?.color ?? "var(--tree-line, #d1d5db)",
        ["--tree-line-width" as any]: `${binding?.lineWidth ?? 1}px`,
        ["--tree-line-style" as any]: binding?.lineStyle ?? "solid",
        // elbow vertical height: 50% if last sibling, else full
        ["--elbow-v-h" as any]: binding?.isLast ? "50%" : "100%",
    } as React.CSSProperties;

    const pad = Math.max(0, depth - 1) * indent;

    return (
        <div className="tree-row" style={lineVars} onContextMenu={onContextMenu}>
            {/* === Binding columns (ancestors) via ::before === */}
            {showBinding ? (
                <div className="tree-rail" style={{ width: pad }}>
                    {binding!.guides.map((g, i) => (
                        <span
                            key={i}
                            className="tree-col"
                            data-show={g ? "1" : "0"}
                            style={{ width: indent }}
                        />
                    ))}
                </div>
            ) : (
                <div style={{ width: pad }} />
            )}
            {/* === Elbow for this node (vertical + horizontal via ::before/::after) === */}
            {showBinding && (
                <div className="tree-elbow" style={{ width: indent }}>
                    {/* pseudo-elements draw the elbow; nothing needed here */}
                </div>
            )}

            {/* === Content === */}
            <div className="flex-1 min-w-0">
                {renderNode ? (
                    renderNode({
                        node,
                        depth,
                        isDragging,
                        path,
                        toggle: onToggle,
                        matched,
                    })
                ) : (
                    <DefaultNode node={node} matched={matched} />
                )}
            </div>

            {/* Right-side toggle as in your screenshot */}
            <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-black/5"
                aria-label={node.expanded ? "Collapse" : "Expand"}
                title={node.expanded ? "Collapse" : "Expand"}
                style={{ position: "relative", zIndex: 1 }}
            >
                {node.children?.length ? (!node.expanded ? <VscChevronRight /> : <TbChevronDownRight />) : ""}
            </button>
        </div>
    );
}
