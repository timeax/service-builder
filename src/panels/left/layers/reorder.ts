import type { ChangeDetail, SortTreeProps } from '@/components/sort-tree/types.ts';

type DropArgs = Parameters<NonNullable<SortTreeProps['canDrop']>>[0];

export type LayersEditorPlacementApi = {
    placeNode: (id: string, opts: { index?: number; scopeTagId?: string }) => void;
    placeOption: (id: string, opts: { index?: number }) => void;
    transact?: (label: string, fn: () => void) => void;
    patchProps?: (fn: (props: { order_for_tags?: Record<string, string[]> }) => void) => void;
};

function isOptionId(id: string) {
    return id.startsWith('o:');
}

function parentPathKey(path: Array<string | number> | null | undefined) {
    if (!path?.length) return '';
    return path.map(String).join('/');
}

export function canDropSameParentOnly(args: DropArgs): boolean {
    if (!args.from) return true;
    return parentPathKey(args.from.parentPath) === parentPathKey(args.to.parentPath);
}

export function canDropFieldsSameParentOnly(args: DropArgs): boolean {
    if (!canDropSameParentOnly(args)) return false;
    if (!args.dragged) return true;

    const draggedId = String(args.dragged.id);
    const parentId = args.to.parent ? String(args.to.parent.id) : '';

    if (isOptionId(draggedId)) {
        return parentId.startsWith('f:');
    }

    return parentId === '';
}

export function isReorderLike(detail: ChangeDetail<unknown>): detail is Extract<ChangeDetail<unknown>, { type: 'move' | 'reorder' }> {
    return detail.type === 'move' || detail.type === 'reorder';
}

export function applyTagTreeReorder(detail: ChangeDetail<unknown>, editor: LayersEditorPlacementApi): boolean {
    if (!isReorderLike(detail)) return false;

    detail.preventDefault();
    editor.placeNode(String(detail.node.id), { index: detail.to.index });
    return true;
}

export function applyFieldTreeReorder(
    detail: ChangeDetail<unknown>,
    args: {
        editor: LayersEditorPlacementApi;
        currentTagId: string;
        contextFieldOrder: string[];
    },
): boolean {
    if (!isReorderLike(detail)) return false;

    detail.preventDefault();
    const nodeId = String(detail.node.id);

    if (isOptionId(nodeId)) {
        args.editor.placeOption(nodeId, { index: detail.to.index });
        return true;
    }

    const writeAndPlace = () => {
        args.editor.patchProps?.((props) => {
            const map = (props.order_for_tags ??= {});
            map[args.currentTagId] = [...args.contextFieldOrder];
        });
        args.editor.placeNode(nodeId, {
            scopeTagId: args.currentTagId,
            index: detail.to.index,
        });
    };

    if (typeof args.editor.transact === 'function' && typeof args.editor.patchProps === 'function') {
        args.editor.transact('Reorder field in context', writeAndPlace);
        return true;
    }

    args.editor.placeNode(nodeId, {
        scopeTagId: args.currentTagId,
        index: detail.to.index,
    });
    return true;
}
