// SPDX-License-Identifier: GPL-3.0-only
import type { ProductDefinition } from '@elqora/dgp-spec';
import {
    CanvasAPI,
    MemoryWorkspaceBackend,
    type WorkspaceActor,
    type WorkspacePermissions,
} from '@elqora/dgp-workspace';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    ServiceBuilderProvider,
    useCanvasAPI,
    useCanvasOwned,
    useWorkspacePermission,
    useWorkspaceRuntime,
    useWorkspaceSelector,
} from './workspace';

const definition: ProductDefinition = {
    id: 'service-builder-test',
    name: 'Service Builder test',
    description: 'Canonical provider integration fixture.',
    filters: [{ id: 'filter:root', label: 'Root', meta: {} }],
    fields: [],
    order_for_tags: {},
    includes_for_buttons: {},
    excludes_for_buttons: {},
    option_effects_for_buttons: {},
    value_effects_for_triggers: {},
    schema_version: '1',
    fallbacks: { nodes: {}, global: {} },
    notices: [],
    meta: {},
};

const actor: WorkspaceActor = { id: 'actor:test', display_name: 'Test Author', meta: {} };

function createWrapper(permissions?: WorkspacePermissions) {
    const backend = new MemoryWorkspaceBackend({ definition, permissions });
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <ServiceBuilderProvider actor={actor} backend={backend}>
                {children}
            </ServiceBuilderProvider>
        );
    };
}

describe('ServiceBuilderProvider', () => {
    it('boots a real Workspace runtime and exposes its branch-owned CanvasAPI', async () => {
        const { result } = renderHook(
            () => ({
                runtime: useWorkspaceRuntime(),
                status: useWorkspaceSelector((state) => state.status),
                canvas: useCanvasAPI(),
            }),
            { wrapper: createWrapper() },
        );
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.canvas).toBe(result.current.runtime.canvas);
        expect(result.current.canvas?.builder.definition.id).toBe('service-builder-test');
    });

    it('propagates canonical editor mutations without duplicate React state', async () => {
        const { result } = renderHook(
            () => ({
                runtime: useWorkspaceRuntime(),
                definition: useWorkspaceSelector((state) => state.definition),
            }),
            { wrapper: createWrapper() },
        );
        await waitFor(() => expect(result.current.runtime.state.status).toBe('ready'));
        act(() => {
            result.current.runtime.editor?.add_field({
                type: 'text',
                label: 'Target URL',
                bind_id: 'filter:root',
                meta: {},
            });
        });
        await waitFor(() => expect(result.current.definition?.fields).toHaveLength(1));
        expect(result.current.runtime.state.snapshot_state).toBe('dirty');
    });

    it('owns and disposes an isolated canonical CanvasAPI for previews', () => {
        const dispose = vi.spyOn(CanvasAPI.prototype, 'dispose');
        const { result, rerender, unmount } = renderHook(({ current }) => useCanvasOwned(current), {
            initialProps: { current: definition },
        });
        const api = result.current.api;
        rerender({ current: { ...definition, name: 'Updated preview' } });
        expect(result.current.api).toBe(api);
        expect(result.current.builder.definition.name).toBe('Updated preview');
        unmount();
        expect(dispose).toHaveBeenCalled();
        dispose.mockRestore();
    });

    it('uses Workspace default-deny permissions', async () => {
        const permissions = Object.fromEntries(
            [
                'document.mutate',
                'draft.save',
                'commit.create',
                'publish',
                'branch.create',
                'branch.set_main',
                'branch.merge',
                'branch.delete',
                'template.write',
                'comment.write',
            ].map((action) => [action, false]),
        ) as unknown as WorkspacePermissions;
        const { result } = renderHook(
            () => ({
                status: useWorkspaceSelector((state) => state.status),
                canMutate: useWorkspacePermission('document.mutate'),
                canPublish: useWorkspacePermission('publish'),
            }),
            { wrapper: createWrapper(permissions) },
        );
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current).toMatchObject({ canMutate: false, canPublish: false });
    });
});
