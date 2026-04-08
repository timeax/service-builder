import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FallbackEditorModalProvider, useFallbackEditorModal } from './fallback-editor-modal.tsx';

vi.mock('@/components/ui/resizable.tsx', () => ({
    ResizablePanelGroup: ({ children, className, ...props }: any) => (
        <div className={className} {...props}>
            {children}
        </div>
    ),
    ResizablePanel: ({ children, className, defaultSize: _defaultSize, minSize: _minSize, maxSize: _maxSize, ...props }: any) => (
        <div className={className} {...props}>
            {children}
        </div>
    ),
    ResizableHandle: ({ className, withHandle: _withHandle, ...props }: any) => <div className={className} data-testid="fallback-editor-resize-handle" {...props} />,
}));

vi.mock('@timeax/digital-service-engine/react', async () => {
    const { createFallbackEditorReactMock } = await import('./fallback-editor/test-react-mock.tsx');
    return createFallbackEditorReactMock();
});

const baseProps = vi.hoisted(() => ({
    filters: [{ id: 't:root', label: 'Root', service_id: 101 }],
    fields: [{ id: 'f:amount', label: 'Amount', type: 'text', service_id: 101 }],
    fallbacks: { global: { '101': [201, 202] } },
    fallbackSettings: { mode: 'strict' },
}));

const canvasState = vi.hoisted(() => ({
    replaceProps: vi.fn(),
    transact: vi.fn((_: string, work: () => void) => work()),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, onChange, options = [], placeholder, onText = 'On', offText = 'Off' }: any) => {
        if (variant === 'select') {
            return (
                <label>
                    <span>{label}</span>
                    <select aria-label={label ?? placeholder ?? 'select'} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })}>
                        {placeholder ? <option value="">{placeholder}</option> : null}
                        {options.map((option: any) => (
                            <option key={String(option.value)} value={String(option.value)}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        if (variant === 'radio') {
            return (
                <fieldset>
                    <legend>{label}</legend>
                    {options.map((option: any) => (
                        <label key={String(option.value)}>
                            <input
                                type="radio"
                                name={label ?? 'radio'}
                                checked={String(value) === String(option.value)}
                                onChange={() => onChange?.({ value: option.value })}
                            />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
            );
        }

        if (variant === 'toggle') {
            return (
                <button type="button" aria-label={label ?? 'toggle'} aria-pressed={Boolean(value)} onClick={() => onChange?.({ value: !value })}>
                    {label}: {value ? onText : offText}
                </button>
            );
        }

        return (
            <label>
                <span>{label}</span>
                <input
                    aria-label={label ?? placeholder ?? 'input'}
                    value={value ?? ''}
                    placeholder={placeholder}
                    onChange={(event) =>
                        onChange?.({
                            value: variant === 'number' ? Number(event.target.value) : event.target.value,
                        })
                    }
                />
            </label>
        );
    },
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        props: baseProps,
        api: {
            builder: {
                getProps: () => baseProps,
            },
            editor: {
                transact: canvasState.transact,
                replaceProps: canvasState.replaceProps,
            },
        },
    }),
    useWorkspace: () => ({
        services: {
            data: {
                101: { id: 101, name: 'Primary service', rate: 10, platform: 'API' },
                201: { id: 201, name: 'Fallback alpha', rate: 8, platform: 'API' },
                202: { id: 202, name: 'Fallback beta', rate: 7, platform: 'API' },
            },
        },
    }),
}));

function Trigger() {
    const modal = useFallbackEditorModal();

    return (
        <button type="button" onClick={() => modal.openForService({ serviceId: 101, serviceName: 'Primary service' })}>
            Open service modal
        </button>
    );
}

function renderWithProvider(ui: ReactNode) {
    return render(<FallbackEditorModalProvider>{ui}</FallbackEditorModalProvider>);
}

describe('FallbackEditorModalProvider', () => {
    beforeEach(() => {
        canvasState.replaceProps.mockReset();
        canvasState.transact.mockReset();
        canvasState.transact.mockImplementation((_: string, work: () => void) => work());
    });

    it('opens for a service and persists fallback edits through the canvas editor', async () => {
        renderWithProvider(<Trigger />);

        fireEvent.click(screen.getByText('Open service modal'));

        expect(await screen.findByText('Fallback editor for Primary service')).toBeInTheDocument();
        expect(screen.getAllByText('Primary service (#101)').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByLabelText('Remove candidate 201'));
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => {
            expect(canvasState.transact).toHaveBeenCalledWith('Update fallbacks', expect.any(Function));
            expect(canvasState.replaceProps).toHaveBeenCalledWith(
                expect.objectContaining({
                    fallbacks: expect.objectContaining({
                        global: {
                            '101': [202],
                        },
                    }),
                }),
            );
        });

        await waitFor(() => {
            expect(screen.queryByText('Fallback editor for Primary service')).not.toBeInTheDocument();
        });
    });

    it('shows the surface error banner when persistence fails', async () => {
        canvasState.transact.mockImplementationOnce(() => {
            throw new Error('Persist failed');
        });

        renderWithProvider(<Trigger />);

        fireEvent.click(screen.getByText('Open service modal'));
        await screen.findByText('Fallback editor for Primary service');

        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByText('Persist failed')).toBeInTheDocument();
        expect(canvasState.replaceProps).not.toHaveBeenCalled();
    });
});
