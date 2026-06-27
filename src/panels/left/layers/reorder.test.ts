import { describe, expect, it, vi } from 'vitest';
import {
    applyFieldTreeReorder,
    applyTagTreeReorder,
    canDropFieldsSameParentOnly,
    canDropSameParentOnly,
} from './reorder.ts';

describe('layers reorder helpers', () => {
    it('dispatches tag reorder via editor.placeNode and prevents local mutation', () => {
        const preventDefault = vi.fn();
        const placeNode = vi.fn();

        const handled = applyTagTreeReorder(
            {
                type: 'reorder',
                node: { id: 't:a', title: 'A' },
                from: { parent: null, parentPath: null, index: 0, depth: 1 },
                to: { parent: null, parentPath: null, index: 2, depth: 1 },
                preventDefault,
            } as any,
            {
                placeNode,
                placeOption: vi.fn(),
            },
        );

        expect(handled).toBe(true);
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(placeNode).toHaveBeenCalledWith('t:a', { index: 2 });
    });

    it('dispatches field reorder in context by seeding order map then placing field', () => {
        const patchProps = vi.fn((fn: (props: { order_for_tags?: Record<string, string[]> }) => void) => fn({}));
        const placeNode = vi.fn();
        const transact = vi.fn((_: string, fn: () => void) => fn());
        const preventDefault = vi.fn();

        const handled = applyFieldTreeReorder(
            {
                type: 'reorder',
                node: { id: 'f:alpha', title: 'Alpha' },
                from: { parent: null, parentPath: null, index: 0, depth: 1 },
                to: { parent: null, parentPath: null, index: 1, depth: 1 },
                preventDefault,
            } as any,
            {
                editor: {
                    placeNode,
                    placeOption: vi.fn(),
                    transact,
                    patchProps,
                },
                currentTagId: 't:root',
                contextFieldOrder: ['f:alpha', 'f:beta'],
            },
        );

        expect(handled).toBe(true);
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(transact).toHaveBeenCalledTimes(1);
        expect(patchProps).toHaveBeenCalledTimes(1);
        expect(placeNode).toHaveBeenCalledWith('f:alpha', { scopeTagId: 't:root', index: 1 });
    });

    it('dispatches option reorder via editor.placeOption', () => {
        const placeOption = vi.fn();
        const preventDefault = vi.fn();

        const handled = applyFieldTreeReorder(
            {
                type: 'move',
                node: { id: 'o:1', title: 'Option 1' },
                from: { parent: { id: 'f:1', title: 'Field 1' }, parentPath: ['f:1'], index: 0, depth: 2 },
                to: { parent: { id: 'f:1', title: 'Field 1' }, parentPath: ['f:1'], index: 1, depth: 2 },
                preventDefault,
            } as any,
            {
                editor: {
                    placeNode: vi.fn(),
                    placeOption,
                },
                currentTagId: 't:root',
                contextFieldOrder: ['f:1'],
            },
        );

        expect(handled).toBe(true);
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(placeOption).toHaveBeenCalledWith('o:1', { index: 1 });
    });

    it('reorders nested options within their child sibling list when patchProps is available', () => {
        const preventDefault = vi.fn();
        const placeOption = vi.fn();
        const props = {
            fields: [
                {
                    id: 'f:1',
                    options: [
                        {
                            id: 'o:parent',
                            label: 'Parent',
                            children: [
                                { id: 'o:a', label: 'A' },
                                { id: 'o:b', label: 'B' },
                            ],
                        },
                    ],
                },
            ],
        };
        const patchProps = vi.fn((fn: (input: typeof props) => void) => fn(props));

        const handled = applyFieldTreeReorder(
            {
                type: 'move',
                node: { id: 'o:b', title: 'Option B' },
                from: { parent: { id: 'o:parent', title: 'Parent' }, parentPath: ['f:1', 'o:parent'], index: 1, depth: 3 },
                to: { parent: { id: 'o:parent', title: 'Parent' }, parentPath: ['f:1', 'o:parent'], index: 0, depth: 3 },
                preventDefault,
            } as any,
            {
                editor: {
                    placeNode: vi.fn(),
                    placeOption,
                    patchProps,
                },
                currentTagId: 't:root',
                contextFieldOrder: ['f:1'],
            },
        );

        expect(handled).toBe(true);
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(placeOption).not.toHaveBeenCalled();
        expect(props.fields[0].options[0].children.map((option) => option.id)).toEqual(['o:b', 'o:a']);
    });

    it('blocks reparenting in same-parent drop guard', () => {
        const allowed = canDropSameParentOnly({
            from: { parent: { id: 't:1' }, parentPath: ['t:1'], index: 0, depth: 2 },
            to: { parent: null, parentPath: null, index: 0, depth: 1 },
        } as any);

        expect(allowed).toBe(false);
    });

    it('blocks invalid cross-kind nesting in fields tree', () => {
        const allowed = canDropFieldsSameParentOnly({
            dragged: { id: 'f:1' },
            from: { parent: null, parentPath: null, index: 0, depth: 1 },
            to: { parent: { id: 'f:2' }, parentPath: ['f:2'], index: 0, depth: 2 },
        } as any);

        expect(allowed).toBe(false);
    });

    it('allows option drops under option parents for capability checks in the insert handler', () => {
        const allowed = canDropFieldsSameParentOnly({
            dragged: { id: 'o:child' },
            from: { parent: { id: 'o:old-parent' }, parentPath: ['f:1', 'o:old-parent'], index: 0, depth: 3 },
            to: { parent: { id: 'o:new-parent' }, parentPath: ['f:1', 'o:new-parent'], index: 0, depth: 3 },
        } as any);

        expect(allowed).toBe(false);

        const sameParentAllowed = canDropFieldsSameParentOnly({
            dragged: { id: 'o:child' },
            from: { parent: { id: 'o:parent' }, parentPath: ['f:1', 'o:parent'], index: 0, depth: 3 },
            to: { parent: { id: 'o:parent' }, parentPath: ['f:1', 'o:parent'], index: 1, depth: 3 },
        } as any);

        expect(sameParentAllowed).toBe(true);
    });
});
