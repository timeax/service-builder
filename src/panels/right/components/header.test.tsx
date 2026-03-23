import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from './header.tsx';

const { mockUseWorkspace, mockUseCanvas } = vi.hoisted(() => ({
    mockUseWorkspace: vi.fn(),
    mockUseCanvas: vi.fn(),
}));

vi.mock('@/components/builder/index.tsx', () => ({
    BuilderIconButton: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
}));

vi.mock('@/panels/right/components/users.tsx', () => ({
    default: () => <div>Users</div>,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useWorkspace: () => mockUseWorkspace(),
    useCanvas: () => mockUseCanvas(),
}));

describe('RightPanel Header callbacks', () => {
    beforeEach(() => {
        mockUseWorkspace.mockReset();
        mockUseCanvas.mockReset();
    });

    it('calls onShare with snapshot data and onPlay with current canvas props payload', () => {
        const snapshotData = { props: { filters: [], fields: [] } } as any;
        const serviceProps = { filters: [{ id: 't:root', label: 'Root' }], fields: [], fallbackSettings: { mode: 'dev' } } as any;
        const capabilitiesMap = { 1: { id: 1, rate: 10 } } as any;

        mockUseWorkspace.mockReturnValue({
            participants: { data: [] },
            authors: { data: [] },
            actor: { id: 'actor:1', meta: {} },
            services: { data: capabilitiesMap },
            info: { id: 'ws:local' },
            branches: { currentId: 'branch:main' },
            snapshot: { data: snapshotData },
        });
        mockUseCanvas.mockReturnValue({
            props: serviceProps,
            api: {
                getServiceProps: vi.fn(),
            },
        });

        const onPlay = vi.fn();
        const onShare = vi.fn();
        render(<Header onPlay={onPlay} onShare={onShare} />);

        fireEvent.click(screen.getByTitle('Preview current branch'));
        fireEvent.click(screen.getByTitle('Share branch'));

        expect(onPlay).toHaveBeenCalledTimes(1);
        expect(onPlay).toHaveBeenCalledWith({
            serviceProps,
            capabilitiesMap,
            workspaceId: 'ws:local',
            branchId: 'branch:main',
        });
        expect(onPlay.mock.calls[0]?.[0]?.serviceProps?.fallbackSettings).toEqual({ mode: 'dev' });
        expect(onShare).toHaveBeenCalledTimes(1);
        expect(onShare).toHaveBeenCalledWith(snapshotData);
    });

    it('falls back to api.getServiceProps when canvas.props is missing', () => {
        const fallbackServiceProps = { filters: [{ id: 't:root', label: 'Root' }], fields: [] } as any;
        const getServiceProps = vi.fn(() => fallbackServiceProps);

        mockUseWorkspace.mockReturnValue({
            participants: { data: [] },
            authors: { data: [] },
            actor: { id: 'actor:1', meta: {} },
            services: { data: {} },
            info: { id: 'ws:local' },
            branches: { currentId: undefined },
            snapshot: { data: undefined },
        });
        mockUseCanvas.mockReturnValue({
            props: undefined,
            api: {
                getServiceProps,
            },
        });

        const onPlay = vi.fn();
        render(<Header onPlay={onPlay} />);

        fireEvent.click(screen.getByTitle('Preview current branch'));

        expect(getServiceProps).toHaveBeenCalledTimes(1);
        expect(onPlay).toHaveBeenCalledWith({
            serviceProps: fallbackServiceProps,
            capabilitiesMap: {},
            workspaceId: 'ws:local',
            branchId: undefined,
        });
    });

    it('does not throw when callbacks are not provided', () => {
        mockUseWorkspace.mockReturnValue({
            participants: { data: [] },
            authors: { data: [] },
            actor: { id: 'actor:1', meta: {} },
            services: { data: {} },
            info: { id: 'ws:local' },
            branches: { currentId: 'branch:main' },
            snapshot: { data: undefined },
        });
        mockUseCanvas.mockReturnValue({
            props: { filters: [], fields: [] },
            api: {
                getServiceProps: vi.fn(() => ({ filters: [], fields: [] })),
            },
        });

        render(<Header />);

        expect(() => fireEvent.click(screen.getByTitle('Preview current branch'))).not.toThrow();
        expect(() => fireEvent.click(screen.getByTitle('Share branch'))).not.toThrow();
    });
});
