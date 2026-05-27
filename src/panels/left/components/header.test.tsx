import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from './header.tsx';

const { mockUseWorkspace } = vi.hoisted(() => ({
    mockUseWorkspace: vi.fn(),
}));
const { mockUseCanvas } = vi.hoisted(() => ({
    mockUseCanvas: vi.fn(),
}));

vi.mock('@/components/builder/index.tsx', () => ({
    BuilderIconButton: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/popover', () => ({
    Popover: ({ children }: PropsWithChildren) => <div>{children}</div>,
    PopoverTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
    PopoverContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/panels/left/components/drafts.tsx', () => ({
    default: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useWorkspace: () => mockUseWorkspace(),
    useCanvas: () => mockUseCanvas(),
}));

describe('Left header menu commands', () => {
    const workspaceApi = {
        branches: {
            data: [{ id: 'branch:main', name: 'Main' }],
            currentId: 'branch:main',
        },
        services: {
            data: { 101: { id: 101, name: 'Sample service' } },
        },
        policies: {
            policies: { data: [{ id: 'p:1', kind: 'test' }] },
        },
        boot: {
            isReady: true,
            hasPartialFailure: false,
            hasErrors: false,
            isBooting: false,
            isSeededView: false,
        },
    } as any;

    beforeEach(() => {
        mockUseWorkspace.mockReset();
        mockUseWorkspace.mockReturnValue(workspaceApi);
        mockUseCanvas.mockReset();
        mockUseCanvas.mockReturnValue({
            props: {},
            api: {
                builder: {
                    getProps: vi.fn(() => ({})),
                    getOptions: vi.fn(() => ({})),
                },
            },
        });
    });

    it('calls a leaf menu command with workspace', () => {
        const command = vi.fn();

        render(
            <Header
                menu={[
                    {
                        name: 'Save workspace',
                        command,
                    },
                ]}
            />,
        );

        fireEvent.click(screen.getByText('Save workspace'));

        expect(command).toHaveBeenCalledTimes(1);
        expect(command).toHaveBeenCalledWith(workspaceApi);
    });

    it('calls nested child menu commands with workspace', () => {
        const childCommand = vi.fn();

        render(
            <Header
                menu={[
                    {
                        name: 'Workspace',
                        children: [
                            {
                                name: 'Load snapshot',
                                command: childCommand,
                            },
                        ],
                    },
                ]}
            />,
        );

        fireEvent.click(screen.getByText('Workspace'));
        fireEvent.click(screen.getByText('Load snapshot'));

        expect(childCommand).toHaveBeenCalledTimes(1);
        expect(childCommand).toHaveBeenCalledWith(workspaceApi);
    });

    it('still executes zero-arg command handlers', () => {
        const legacyCommand = vi.fn(() => undefined);

        render(
            <Header
                menu={[
                    {
                        name: 'Legacy action',
                        command: legacyCommand,
                    },
                ]}
            />,
        );

        fireEvent.click(screen.getByText('Legacy action'));

        expect(legacyCommand).toHaveBeenCalledTimes(1);
    });

    it('shows default prompts menu item and opens prompts dialog', () => {
        render(<Header menu={[]} />);

        fireEvent.click(screen.getByText('prompts'));
        expect(screen.getByText('Catalog prompt')).toBeInTheDocument();
        expect(screen.getByText('Service props generator prompt')).toBeInTheDocument();
        expect(screen.getByText('Prompts')).toBeInTheDocument();
        expect(screen.getByText('Copy services props')).toBeInTheDocument();
        expect(screen.getByText('Copy policies')).toBeInTheDocument();
        expect(screen.getByText('Copy rate policy')).toBeInTheDocument();
        expect(screen.getByText('Copy fallback settings')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Service props generator prompt' })).toBeInTheDocument();
    });
});
