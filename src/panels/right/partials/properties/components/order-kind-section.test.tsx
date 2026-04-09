import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrderKindSection } from './order-kind-section.tsx';
import type { ReactNode } from 'react';

const setOrderKind = vi.fn();
const deleteOrderKind = vi.fn();
const getProps = vi.fn();

vi.mock('@/panels/right/components/sections.tsx', () => {
    const Section = ({ children }: { children: ReactNode }) => <section>{children}</section>;
    Section.Header = ({ children }: { children: ReactNode }) => <div>{children}</div>;
    Section.Title = ({ children }: { children: ReactNode }) => <h3>{children}</h3>;
    Section.Content = ({ children }: { children: ReactNode }) => <div>{children}</div>;
    return { Section };
});

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        props: {},
        api: {
            builder: {
                getProps,
            },
            editor: {
                setOrderKind,
                deleteOrderKind,
            },
        },
    }),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ label, value, options, disabled, onChange }: any) => (
        <select
            aria-label={label}
            value={value ?? ''}
            disabled={disabled}
            onChange={(event) => onChange?.({ value: event.target.value })}
        >
            {(options ?? []).map((option: any) => (
                <option key={String(option.value)} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    ),
}));

describe('OrderKindSection', () => {
    beforeEach(() => {
        setOrderKind.mockReset();
        deleteOrderKind.mockReset();
        getProps.mockReset();
        getProps.mockReturnValue({ orderKinds: {} });
    });

    it('sets order kind for tag nodes from configured kinds', () => {
        render(<OrderKindSection nodeId="t:root" nodeKind="tag" kinds={['contract', 'subscription']} defaultKind="contract" />);

        fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'subscription' } });

        expect(setOrderKind).toHaveBeenCalledWith('t:root', 'subscription');
    });

    it('sets order kind for option nodes', () => {
        render(<OrderKindSection nodeId="o:plan" nodeKind="option" kinds={['contract', 'quote']} defaultKind="contract" />);

        fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'quote' } });

        expect(setOrderKind).toHaveBeenCalledWith('o:plan', 'quote');
    });

    it('shows remove action when an order kind is already mapped', () => {
        getProps.mockReturnValue({ orderKinds: { 't:root': 'contract' } });
        render(<OrderKindSection nodeId="t:root" nodeKind="tag" kinds={['contract']} defaultKind="contract" />);

        fireEvent.click(screen.getByRole('button', { name: 'Remove assigned kind' }));

        expect(deleteOrderKind).toHaveBeenCalledWith('t:root');
    });

    it('disables selection and shows helper text when disabled', () => {
        render(
            <OrderKindSection
                nodeId="f:invalid"
                nodeKind="field"
                kinds={['contract']}
                defaultKind="contract"
                disabled
                disabledMessage="Order kind is supported only on button fields without options."
            />,
        );

        expect(screen.getByLabelText('Kind')).toBeDisabled();
        expect(screen.getByText('Order kind is supported only on button fields without options.')).toBeInTheDocument();
    });
});
