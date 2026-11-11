// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalFallbackProvider, CanonicalNodeFallbacks, clearNodeServiceWithFallbackPromotion, DEFAULT_CANONICAL_FALLBACK_POLICY, useCanonicalFallbacks } from './canonical-fallbacks';
import { ServiceBuilderProvider, useWorkspaceSelector } from './workspace';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ label, value, onChange, ...props }: any) => <input {...props} aria-label={label ?? props['aria-label'] ?? 'Fallback setting'} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} />,
}));

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

function Harness() {
    const fallbacks = useCanonicalFallbacks();
    const registered = useWorkspaceSelector((state) => state.definition?.fallbacks?.global?.['10147']?.length ?? 0);
    return <><output aria-label="Registered fallbacks">{registered}</output><button type="button" onClick={() => fallbacks.open_quick_add_for_service({ service_id: 10147, service_name: 'Instagram followers - fast' })}>Open quick add</button><button type="button" onClick={() => fallbacks.open_editor_for_service({ service_id: 10147, service_name: 'Instagram followers - fast' })}>Open full editor</button></>;
}

function NodeFallbackHarness() {
    const fallbacks = useCanonicalFallbacks();
    const registered = useWorkspaceSelector((state) => state.definition?.fallbacks?.nodes?.['option:instagram-followers']?.length ?? 0);
    return <><output aria-label="Registered node fallbacks">{registered}</output><button type="button" onClick={() => fallbacks.open_quick_add_for_node({ node_id: 'option:instagram-followers', node_kind: 'option', node_label: 'Instagram followers - fast', service_id: 10147 })}>Open node quick add</button></>;
}

function InlineFallbackHarness({ primaryServiceId = 10147 }: { primaryServiceId?: number | null } = {}) {
    const registered = useWorkspaceSelector((state) => state.definition?.fallbacks?.nodes?.['option:instagram-followers']?.length ?? 0);
    return <><output aria-label="Inline fallback count">{registered}</output><CanonicalNodeFallbacks nodeId="option:instagram-followers" primaryServiceId={primaryServiceId} disabled={false} /></>;
}


function createIsolatedBackend() {
    return new MemoryWorkspaceBackend({ ...workspaceSeed, services: workspaceSeed.services.slice(0, 4), persistence: undefined });
}

function createInlineFallbackBackend() {
    return new MemoryWorkspaceBackend({ ...workspaceSeed, services: workspaceSeed.services.filter((service) => ['10147', '9435', '2946'].includes(String(service.id))), persistence: undefined });
}

describe('canonical fallback workflows', () => {
    it('persists quick-add registrations through the canonical Editor', async () => {
        render(<ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalFallbackProvider><Harness /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0'));
        fireEvent.click(screen.getByRole('button', { name: 'Open quick add' }));
        const candidates = await screen.findAllByRole('checkbox');
        fireEvent.click(candidates[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Add fallbacks' }));
        await waitFor(() => expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('1'));
    }, 10_000);

    it('adds and saves a registration through the preserved full fallback editor', async () => {
        render(<ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalFallbackProvider><Harness /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0'));
        fireEvent.click(screen.getByRole('button', { name: 'Open full editor' }));
        expect(await screen.findByRole('heading', { name: 'Fallback editor for Instagram followers - fast' })).toBeInTheDocument();
        expect(screen.getByText('Synced')).toBeInTheDocument();
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Add registration' }));
        const candidates = await screen.findAllByRole('checkbox');
        fireEvent.click(candidates[0]!);
        fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('1'));
        await waitFor(() => expect(screen.getByText('Synced')).toBeInTheDocument());
        expect(screen.getByText('Fallback registrations saved.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Remove candidate/ }));
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0'));
        await waitFor(() => expect(screen.getByText('Synced')).toBeInTheDocument());
    }, 30_000);

    it('sends edited fallback policy settings to the host without changing the canonical definition payload', async () => {
        const onPolicyChange = vi.fn();
        render(<ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalFallbackProvider onPolicyChange={onPolicyChange}><Harness /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0'));
        fireEvent.click(screen.getByRole('button', { name: 'Open full editor' }));
        await screen.findByRole('heading', { name: 'Fallback editor for Instagram followers - fast' });
        const settings = screen.getByRole('tab', { name: 'Settings' });
        fireEvent.mouseDown(settings, { button: 0, ctrlKey: false });
        await screen.findByText('Require capability fit');
        fireEvent.change(screen.getByDisplayValue('priority'), { target: { value: 'cheapest' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
        await waitFor(() =>
            expect(onPolicyChange).toHaveBeenCalledWith(
                expect.objectContaining({ selection_strategy: 'cheapest', mode: 'strict', require_capability_fit: true }),
            ),
        );
        expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0');
    }, 15_000);

    it('resets an unsaved registration and closes by keyboard without mutating the definition', async () => {
        render(<ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}><CanonicalFallbackProvider><Harness /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0'));
        fireEvent.click(screen.getByRole('button', { name: 'Open full editor' }));
        await screen.findByRole('heading', { name: 'Fallback editor for Instagram followers - fast' });
        fireEvent.click(screen.getByRole('button', { name: 'Add registration' }));
        fireEvent.click((await screen.findAllByRole('checkbox'))[0]!);
        fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
        await waitFor(() => expect(screen.getByText('Synced')).toBeInTheDocument());
        expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0');
        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Fallback editor for Instagram followers - fast' })).not.toBeInTheDocument());
        expect(screen.getByLabelText('Registered fallbacks')).toHaveTextContent('0');
    }, 20_000);

    it.each([
        { mode: 'strict' as const, incompatibleVisible: false },
        { mode: 'dev' as const, incompatibleVisible: true },
    ])('applies canonical node eligibility in $mode fallback mode', async ({ mode, incompatibleVisible }) => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.filters[0] = { ...definition.filters[0]!, capabilities: { refill: true } };
        const services = workspaceSeed.services.filter((service) => ['10147', '9435', '3456'].includes(String(service.id)));
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, services, persistence: undefined });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalFallbackProvider policy={{ ...DEFAULT_CANONICAL_FALLBACK_POLICY, mode }}>
                    <NodeFallbackHarness />
                </CanonicalFallbackProvider>
            </ServiceBuilderProvider>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Open node quick add' }));
        expect(await screen.findByText(/Service #9435/)).toBeInTheDocument();
        if (incompatibleVisible) expect(screen.getByText(/Service #3456/)).toBeInTheDocument();
        else expect(screen.queryByText(/Service #3456/)).not.toBeInTheDocument();
    });

    it.each([
        { mode: 'strict' as const, incompatibleVisible: false },
        { mode: 'dev' as const, incompatibleVisible: true },
    ])('filters inline candidates by canonical eligibility in $mode mode', async ({ mode, incompatibleVisible }) => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.filters[0] = { ...definition.filters[0]!, capabilities: { refill: true } };
        const services = workspaceSeed.services.filter((service) => ['10147', '9435', '3456'].includes(String(service.id)));
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, services, persistence: undefined });
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalFallbackProvider policy={{ ...DEFAULT_CANONICAL_FALLBACK_POLICY, mode }}><InlineFallbackHarness /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        fireEvent.click(await screen.findByRole('button', { name: 'Add fallback' }));
        expect(await screen.findByRole('checkbox', { name: /9435/ })).toBeInTheDocument();
        if (incompatibleVisible) expect(screen.getByRole('checkbox', { name: /3456/ })).toBeInTheDocument();
        else expect(screen.queryByRole('checkbox', { name: /3456/ })).not.toBeInTheDocument();
    });

    it('persists a node-scoped fallback registration through the canonical Editor', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.filters[0] = { ...definition.filters[0]!, capabilities: { refill: true } };
        const services = workspaceSeed.services.filter((service) => ['10147', '9435'].includes(String(service.id)));
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, services, persistence: undefined });
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalFallbackProvider><NodeFallbackHarness /></CanonicalFallbackProvider></ServiceBuilderProvider>);

        await waitFor(() => expect(screen.getByLabelText('Registered node fallbacks')).toHaveTextContent('0'));
        fireEvent.click(screen.getByRole('button', { name: 'Open node quick add' }));
        fireEvent.click((await screen.findAllByRole('checkbox'))[0]!);
        fireEvent.click(screen.getByRole('button', { name: 'Add fallbacks' }));
        await waitFor(() => expect(screen.getByLabelText('Registered node fallbacks')).toHaveTextContent('1'));
    });

    it('adds multiple policy-allowed services and removes an inline node fallback immediately', async () => {
        render(<ServiceBuilderProvider backend={createInlineFallbackBackend()} actor={workspaceActor}><CanonicalFallbackProvider policy={{ ...DEFAULT_CANONICAL_FALLBACK_POLICY, mode: 'dev' }}><InlineFallbackHarness /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByLabelText('Inline fallback count')).toHaveTextContent('0'));
        fireEvent.click(screen.getByRole('button', { name: 'Add fallback' }));
        const candidates = await screen.findAllByRole('checkbox');
        fireEvent.click(candidates[0]!);
        fireEvent.click(candidates[1]!);
        fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
        await waitFor(() => expect(screen.getByLabelText('Inline fallback count')).toHaveTextContent('2'));
        fireEvent.click(screen.getAllByRole('button', { name: /Remove fallback/ })[0]!);
        await waitFor(() => expect(screen.getByLabelText('Inline fallback count')).toHaveTextContent('1'));
        const addButton = screen.getByRole('button', { name: 'Add fallback' });
        fireEvent.click(addButton);
        expect(await screen.findByRole('textbox', { name: 'Search fallback services' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Search fallback services' })).not.toBeInTheDocument());
        expect(document.activeElement).toBe(addButton);
    }, 15_000);

    it('promotes the first available fallback in saved order when clearing a node service', () => {
        const candidate = workspaceSeed.services.find((service) => String(service.id) !== '10147' && service.state === 'enabled')!;
        const definition = structuredClone(workspaceSeed.definition);
        definition.fallbacks = { nodes: { 'option:instagram-followers': [999999, candidate.id] }, global: {} };
        const result = clearNodeServiceWithFallbackPromotion(definition, workspaceSeed.services, 'option:instagram-followers');
        expect(result.promoted?.id).toBe(candidate.id);
        expect(result.definition.fields[0]?.options?.[0]?.service_id).toBe(candidate.id);
        expect(result.definition.fallbacks?.nodes?.['option:instagram-followers']).toEqual([999999]);
    });

    it('clears the primary service but retains the fallback list when none are available', () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.fallbacks = { nodes: { 'option:instagram-followers': [999999] }, global: {} };
        const result = clearNodeServiceWithFallbackPromotion(definition, workspaceSeed.services, 'option:instagram-followers');
        expect(result.promoted).toBeUndefined();
        expect(result.definition.fields[0]?.options?.[0]?.service_id).toBeUndefined();
        expect(result.definition.fallbacks?.nodes?.['option:instagram-followers']).toEqual([999999]);
    });

    it('hides Add fallback when no primary service is attached but keeps existing fallbacks removable', async () => {
        const definition = structuredClone(workspaceSeed.definition);
        definition.fallbacks = { nodes: { 'option:instagram-followers': [9435] }, global: {} };
        const services = workspaceSeed.services.filter((service) => ['10147', '9435'].includes(String(service.id)));
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition, services, persistence: undefined });
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalFallbackProvider><InlineFallbackHarness primaryServiceId={null} /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        expect(await screen.findByText(/#9435/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add fallback' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove fallback 9435' })).toBeEnabled();
    });

});
