import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeFallbackEditor } from './native-fallback-editor.tsx';

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
    const { createFallbackEditorReactMock } = await import('./test-react-mock.tsx');
    return createFallbackEditorReactMock();
});

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

const primaryServices = {
    101: { id: 101, name: 'Primary One', platform: 'API', rate: 10 },
    102: { id: 102, name: 'Primary Two', platform: 'API', rate: 12 },
};

const eligibleServices = {
    ...primaryServices,
    201: { id: 201, name: 'Fallback Alpha', platform: 'API', rate: 8 },
    202: { id: 202, name: 'Fallback Beta', platform: 'API', rate: 7 },
    203: { id: 203, name: 'Fallback Gamma', platform: 'API', rate: 9 },
    204: { id: 204, name: 'Fallback Omega', platform: 'API', rate: 6 },
};

const serviceProps = {
    filters: [{ id: 't:root', label: 'Root', service_id: 101 }],
    fields: [
        { id: 'f:amount', label: 'Amount', type: 'text', service_id: 101 },
        { id: 'f:other', label: 'Other', type: 'text', service_id: 102 },
    ],
    fallbacks: {
        global: { '101': [201], '102': [203] },
        nodes: { 'f:amount': [202] },
    },
};

function createDeferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
}

function renderEditor(overrides: Partial<ComponentProps<typeof NativeFallbackEditor>> = {}) {
    return render(
        <NativeFallbackEditor
            props={serviceProps as any}
            fallbacks={serviceProps.fallbacks as any}
            primaryServices={primaryServices as any}
            eligibleServices={eligibleServices as any}
            settings={{ mode: 'strict' }}
            initialServiceId={101}
            {...overrides}
        />,
    );
}

describe('NativeFallbackEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('switches services and updates the visible registrations', async () => {
        renderEditor();

        expect(screen.getByTestId('fallback-editor-layout')).toBeInTheDocument();
        expect(screen.getByTestId('fallback-editor-sidebar-panel')).toBeInTheDocument();
        expect(screen.getByTestId('fallback-editor-main-panel')).toBeInTheDocument();
        expect(screen.getByTestId('fallback-editor-registrations-scroll')).toBeInTheDocument();
        expect(screen.getByTestId('fallback-editor-details-scroll')).toBeInTheDocument();

        expect(screen.getAllByText('Primary One (#101)').length).toBeGreaterThan(0);
        expect(screen.getByText('#201 - Fallback Alpha')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Service #102 - Primary Two/i }));

        await waitFor(() => {
            expect(screen.getAllByText('Primary Two (#102)').length).toBeGreaterThan(0);
        });
        expect(screen.getByText('#203 - Fallback Gamma')).toBeInTheDocument();
    });

    it('opens the registration flow, requires a valid node selection, and adds candidates', async () => {
        renderEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Add registration' }));

        const continueButton = screen.getByRole('button', { name: 'Continue' });
        expect(continueButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Node id'), { target: { value: 't:root' } });
        expect(continueButton).not.toBeDisabled();

        fireEvent.click(continueButton);

        fireEvent.change(screen.getByLabelText('Search eligible services'), { target: { value: 'Omega' } });
        fireEvent.click(screen.getByRole('button', { name: /Service #204 - Fallback Omega/i }));
        expect(screen.getByText('1 selected')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));

        expect(await screen.findByText('Node-scoped fallback list for t:root')).toBeInTheDocument();
        expect(screen.getByText('#204 - Fallback Omega')).toBeInTheDocument();
    });

    it('removes and clears candidates from registrations', async () => {
        renderEditor();

        fireEvent.click(screen.getByLabelText('Remove candidate 202'));

        await waitFor(() => {
            expect(screen.queryByText('#202 - Fallback Beta')).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]);

        await waitFor(() => {
            expect(screen.getAllByText('No fallback services yet.').length).toBeGreaterThan(0);
        });
    });

    it('saves settings through the provider callback', async () => {
        const onSettingsChange = vi.fn(async (next) => next);
        renderEditor({ onSettingsChange, initialTab: 'settings' });

        expect(screen.getByTestId('fallback-editor-settings-tab')).toBeInTheDocument();
        expect(screen.getByTestId('fallback-editor-settings-scroll')).toBeInTheDocument();

        await screen.findByRole('button', { name: 'Save settings' });
        fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'dev' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

        await waitFor(() => {
            expect(onSettingsChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'dev',
                }),
            );
        });
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
        });
    });

    it('reflects header loading states for save, validate, and reset', async () => {
        const saveDeferred = createDeferred();
        const validateDeferred = createDeferred();
        const resetDeferred = createDeferred();

        renderEditor({
            onSave: () => saveDeferred.promise,
            onValidate: () => validateDeferred.promise,
            onReset: () => resetDeferred.promise,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
        saveDeferred.resolve();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
        expect(await screen.findByRole('button', { name: 'Validating...' })).toBeDisabled();
        validateDeferred.resolve();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Validate' })).toBeEnabled();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
        expect(await screen.findByRole('button', { name: 'Resetting...' })).toBeDisabled();
        resetDeferred.resolve();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
        });
    });
});
