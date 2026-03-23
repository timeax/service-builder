import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FallbackEditorModalProvider, useFallbackEditorModal } from './fallback-editor-modal.tsx';

const replaceProps = vi.fn();
const transact = vi.fn((_: string, work: () => void) => work());

const baseProps = {
    filters: [],
    fields: [],
    fallbacks: { global: { '101': [201] } },
    fallbackSettings: { mode: 'strict' },
};

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        props: baseProps,
        api: {
            builder: {
                getProps: () => baseProps,
            },
            editor: {
                transact,
                replaceProps,
            },
        },
    }),
    useWorkspace: () => ({
        services: {
            data: {
                101: { id: 101, name: 'Primary service' },
                902: { id: 902, name: 'Fallback service' },
            },
        },
    }),
}));

vi.mock('@timeax/digital-service-engine/react', () => ({
    FallbackEditor: ({
        initialServiceId,
        onSave,
        onSettingsChange,
    }: {
        initialServiceId?: number | string;
        onSave?: (next: unknown) => Promise<unknown> | unknown;
        onSettingsChange?: (next: unknown) => Promise<unknown> | unknown;
    }) => (
        <div>
            <div>Fallback editor for {String(initialServiceId)}</div>
            <button
                type="button"
                onClick={() =>
                    void onSave?.({
                        global: {
                            [String(initialServiceId)]: [902],
                        },
                    })
                }
            >
                Save fallbacks
            </button>
            <button type="button" onClick={() => void onSettingsChange?.({ mode: 'dev' })}>
                Save settings
            </button>
        </div>
    ),
}));

function Trigger() {
    const modal = useFallbackEditorModal();

    return (
        <div>
            <button type="button" onClick={() => modal.openForService({ serviceId: 101, serviceName: 'Primary service' })}>
                Open service modal
            </button>
        </div>
    );
}

function renderWithProvider(ui: ReactNode) {
    return render(<FallbackEditorModalProvider>{ui}</FallbackEditorModalProvider>);
}

describe('FallbackEditorModalProvider', () => {
    beforeEach(() => {
        replaceProps.mockReset();
        transact.mockClear();
    });

    it('opens for a service and persists fallback edits through the canvas editor', async () => {
        renderWithProvider(<Trigger />);

        fireEvent.click(screen.getByText('Open service modal'));

        expect(await screen.findByText('Fallback editor for Primary service')).toBeInTheDocument();
        expect(await screen.findByText('Fallback editor for 101')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Save fallbacks'));

        await waitFor(() => {
            expect(transact).toHaveBeenCalledWith('Update fallbacks', expect.any(Function));
            expect(replaceProps).toHaveBeenCalledWith(
                expect.objectContaining({
                    fallbacks: {
                        global: {
                            '101': [902],
                        },
                    },
                }),
            );
        });

        await waitFor(() => {
            expect(screen.queryByText('Fallback editor for Primary service')).not.toBeInTheDocument();
        });
    });

    it('persists fallback settings through the canvas editor', async () => {
        renderWithProvider(<Trigger />);

        fireEvent.click(screen.getByText('Open service modal'));
        await screen.findByText('Fallback editor for 101');

        fireEvent.click(screen.getByText('Save settings'));

        await waitFor(() => {
            expect(transact).toHaveBeenCalledWith('Update fallback settings', expect.any(Function));
            expect(replaceProps).toHaveBeenCalledWith(
                expect.objectContaining({
                    fallbackSettings: {
                        mode: 'dev',
                    },
                }),
            );
        });
    });
});
