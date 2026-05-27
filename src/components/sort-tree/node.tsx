import * as React from 'react';
import type { TreeNode } from './types';

export interface DefaultNodeProps<T = unknown> {
    node: TreeNode<T>;
    matched: boolean;
    isEditing?: boolean;
    onCommit?: (newTitle: string) => void;
    onCancel?: () => void;
}

export function Node<T = unknown>({ node, matched, isEditing, onCommit, onCancel }: DefaultNodeProps<T>) {
    const spanRef = React.useRef<HTMLSpanElement>(null);

    React.useEffect(() => {
        const span = spanRef.current;
        if (!span || isEditing) return;
        if (span.textContent !== node.title) {
            span.textContent = node.title;
        }
    }, [isEditing, node.title]);

    React.useEffect(() => {
        if (isEditing && spanRef.current) {
            spanRef.current.focus();
            // Move cursor to end
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(spanRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    }, [isEditing]);

    const commitFromDom = React.useCallback(() => {
        if (!isEditing || !onCommit || !spanRef.current) return;
        onCommit(spanRef.current.innerText || '');
    }, [isEditing, onCommit]);

    const handleBlur = () => {
        commitFromDom();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isEditing) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            spanRef.current?.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel?.();
        }
    };

    return (
        <div className={'flex items-center gap-2 truncate ' + (matched ? 'rounded bg-yellow-200/50 px-1' : '')}>
            {node.icon ? <span className="inline-flex items-center">{node.icon}</span> : null}
            <span
                ref={spanRef}
                className="truncate outline-none select-none"
                contentEditable={isEditing}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                suppressContentEditableWarning
            >
                {node.title}
            </span>
        </div>
    );
}
