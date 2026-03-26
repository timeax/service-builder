import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServicePickerDialog } from './service-picker-dialog.tsx';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, onChange, options, placeholder, disabled }: any) => {
        const ariaLabel = label ?? placeholder ?? 'input-field';
        if (variant === 'select') {
            return (
                <select
                    aria-label={ariaLabel}
                    value={value ?? ''}
                    disabled={disabled}
                    onChange={(event) => onChange?.({ value: event.target.value })}
                >
                    <option value="">{placeholder ?? 'Select'}</option>
                    {(options ?? []).map((option: any) => (
                        <option key={String(option.value)} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }
        return (
            <input
                aria-label={ariaLabel}
                value={value ?? ''}
                disabled={disabled}
                onChange={(event) => onChange?.({ value: event.target.value })}
            />
        );
    },
}));

describe('ServicePickerDialog meta popover', () => {
    it('renders row-level meta info popover and opens it', async () => {
        render(
            <ServicePickerDialog
                open
                services={[
                    {
                        id: 101,
                        name: 'Alpha Service',
                        category: 'Payments',
                        flags: [],
                        attachmentCount: 0,
                        attachedNodeIds: [],
                        attachedNodeLabels: [],
                        active: false,
                    },
                ]}
                serviceMap={{
                    101: {
                        id: 101,
                        name: 'Alpha Service',
                        meta: {
                            raw: {
                                key: 'alpha',
                            },
                        },
                    } as any,
                }}
                onOpenChange={() => {}}
                onConfirm={() => {}}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'More service info' }));
        expect(await screen.findByText('More info')).toBeInTheDocument();
        expect(screen.getAllByText('raw.key').length).toBeGreaterThan(0);
        expect(screen.getByText('alpha')).toBeInTheDocument();
    });
});
