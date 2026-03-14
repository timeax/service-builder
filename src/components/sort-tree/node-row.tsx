import * as React from 'react';
import { TbChevronDownRight } from 'react-icons/tb';
import { VscChevronRight } from 'react-icons/vsc';
import { Node } from './node.tsx';
import './node-row.css';
import type { NodePath, TreeNode } from './types';

export interface NodeRowProps<T = unknown> {
    node: TreeNode<T>;
    path: NodePath;
    depth: number;
    indent: number; // px per depth
    matched: boolean;
    isDragging: boolean;

    hasChildren?: boolean;
    renderNode?: (args: {
        node: TreeNode<T>;
        depth: number;
        isDragging: boolean;
        path: NodePath;
        toggle(): void;
        matched: boolean;
        isEditing?: boolean;
        onCommit?: (newTitle: string) => void;
        onCancel?: () => void;
    }) => React.ReactNode;
    onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
    /** Optional binding lines config */
    binding?: {
        show: boolean;
        guides: boolean[]; // length = depth - 1 (true => draw vertical in that ancestor column)
        isLast: boolean; // is last among siblings
        lineStyle?: 'solid' | 'dashed' | 'dotted';
        lineWidth?: number; // px
        color?: string; // CSS color
    };
    /** Optional extra class for the row, supplied by SortTree */
    rowClassName?: string;

    onToggle(): void;
    onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    isEditing?: boolean;
    onCommit?: (newTitle: string) => void;
    onCancel?: () => void;
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
    rowClassName,
    onDoubleClick,
    isEditing,
    onCommit,
    onCancel,
}: NodeRowProps<T>) {
    const hasParent = depth > 1;
    const showBinding = !!binding?.show && hasParent;

    const lineVars = {
        ['--tree-line-color' as any]: binding?.color ?? 'var(--tree-line, #d1d5db)',
        ['--tree-line-width' as any]: `${binding?.lineWidth ?? 1}px`,
        ['--tree-line-style' as any]: binding?.lineStyle ?? 'solid',
        ['--elbow-v-h' as any]: binding?.isLast ? '50%' : '100%',
    } as React.CSSProperties;

    const pad = Math.max(0, depth - 1) * indent;

    const stopPropagation = (e: React.MouseEvent, callback?: (e?: any) => void) => {
        e.stopPropagation();
        callback?.(e);
    };

    return (
        <div
            className={['tree-row', rowClassName || '', isDragging ? 'is-dragging' : ''].join(' ')}
            style={{
                ...lineVars,
                // Your request: prevent the dragged row itself from catching pointer events
                pointerEvents: isDragging ? 'none' : undefined,
            }}
            onContextMenu={onContextMenu}
            onDoubleClick={onDoubleClick}
        >
            {showBinding ? (
                <div className="tree-rail" style={{ width: pad }}>
                    {binding!.guides.map((g, i) => (
                        <span key={i} className="tree-col" data-show={g ? '1' : '0'} style={{ width: indent }} />
                    ))}
                </div>
            ) : (
                <div style={{ width: pad }} />
            )}

            {showBinding && <div className="tree-elbow" style={{ width: indent }} />}

            <div className="min-w-0 flex-1">
                {isDragging ? (
                    <div
                        aria-hidden="true"
                        style={{
                            height: '100%',
                            border: '2px dashed var(--tree-line-color, #cbd5e1)',
                            borderRadius: 8,
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.06) 50%, rgba(148,163,184,0.12))',
                        }}
                    >
                        <span
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: 4,
                                background: 'rgba(148,163,184,0.35)',
                                flex: '0 0 auto',
                            }}
                        />
                        <span
                            style={{
                                height: 10,
                                width: '40%',
                                borderRadius: 4,
                                background: 'rgba(148,163,184,0.35)',
                                display: 'inline-block',
                            }}
                        />
                    </div>
                ) : renderNode ? (
                    renderNode({
                        node,
                        depth,
                        isDragging,
                        path,
                        toggle: onToggle,
                        matched,
                        isEditing,
                        onCommit,
                        onCancel,
                    })
                ) : (
                    <Node node={node} matched={matched} isEditing={isEditing} onCommit={onCommit} onCancel={onCancel} />
                )}
            </div>

            {!isDragging && Boolean(node.children) && (
                <button
                    type="button"
                    onClick={(e) => stopPropagation(e, onToggle)}
                    onMouseDown={stopPropagation}
                    onPointerDown={stopPropagation}
                    className="inline-flex h-5 w-7 cursor-pointer items-center justify-center rounded hover:font-black"
                    aria-label={node.expanded ? 'Collapse' : 'Expand'}
                    title={node.expanded ? 'Collapse' : 'Expand'}
                    style={{ position: 'relative', zIndex: 1 }}
                >
                    {node.children?.length ? (
                        !node.expanded ? (
                            <VscChevronRight className={'pointer-events-none'} />
                        ) : (
                            <TbChevronDownRight className={'pointer-events-none'} />
                        )
                    ) : (
                        ''
                    )}
                </button>
            )}
        </div>
    );
}
