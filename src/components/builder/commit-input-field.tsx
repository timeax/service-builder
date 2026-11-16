// SPDX-License-Identifier: GPL-3.0-only
import { Button } from '@/components/ui/button.tsx';
import { Check } from 'lucide-react';
import { InputField, type VariantKey } from '@timeax/form-palette';
import { useEffect, useState, type ReactNode } from 'react';

interface CommitInputFieldProps {
    variant: VariantKey;
    value: unknown;
    onCommit(value: unknown): void;
    label?: ReactNode;
    commitLabel?: string;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    spellCheck?: boolean;
    min?: number;
    max?: number;
    step?: number;
    showButtons?: boolean;
    variantClassName?: string;
    'aria-label'?: string;
}

/** Keep text editing local; persist the draft only when the check control is pressed. */
export function CommitInputField({
    variant,
    value,
    onCommit,
    label,
    commitLabel,
    disabled,
    ...inputProps
}: CommitInputFieldProps) {
    const [draft, setDraft] = useState(value);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!dirty) setDraft(value);
    }, [dirty, value]);

    const labelText = commitLabel ?? (typeof label === 'string' ? label : 'value');

    return (
        <InputField
            {...inputProps}
            variant={variant}
            label={label}
            disabled={disabled}
            value={draft as never}
            onChange={({ value: nextValue }) => {
                setDraft(nextValue);
                setDirty(true);
            }}
            trailingControl={(
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={`Save ${labelText}`}
                    title={`Save ${labelText}`}
                    disabled={disabled || !dirty}
                    onClick={() => {
                        onCommit(draft);
                        setDirty(false);
                    }}
                >
                    <Check aria-hidden="true" className="h-4 w-4" />
                </Button>
            )}
        />
    );
}
