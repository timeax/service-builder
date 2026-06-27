import { Section } from '@/panels/right/components/sections.tsx';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useMemo } from 'react';
import { MdOutlineRemoveCircleOutline } from 'react-icons/md';

type OrderKindNodeKind = 'tag' | 'field' | 'option';

export type OrderKindSectionProps = {
    nodeId: string;
    nodeKind: OrderKindNodeKind;
    kinds?: string[];
    defaultKind?: string;
    disabled?: boolean;
    disabledMessage?: string;
};

function normalizeKinds(input: string[] | undefined): string[] {
    return Array.from(
        new Set(
            (input ?? [])
                .map((kind) => String(kind).trim())
                .filter(Boolean),
        ),
    );
}

export function OrderKindSection({
    nodeId,
    nodeKind,
    kinds,
    defaultKind,
    disabled = false,
    disabledMessage,
}: OrderKindSectionProps) {
    const canvas = useCanvas();
    const normalizedKinds = useMemo(() => normalizeKinds(kinds), [kinds]);
    const mappedKind = canvas.api.builder.getProps().orderKinds?.[nodeId];
    const fallbackKind = defaultKind?.trim() || normalizedKinds[0] || '';
    const selectedKind = mappedKind ?? fallbackKind;
    const hasAssignedKind = typeof mappedKind === 'string' && mappedKind.trim().length > 0;

    const selectOptions = useMemo(() => {
        const list = [...normalizedKinds];
        if (mappedKind && !list.includes(mappedKind)) {
            list.unshift(mappedKind);
        }
        return list.map((value) => ({ label: value, value }));
    }, [normalizedKinds, mappedKind]);

    const canEditSelect = !disabled && selectOptions.length > 0;

    return (
        <Section>
            <Section.Header>
                <Section.Title>Order kind</Section.Title>
            </Section.Header>
            <Section.Content>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    Assign an order kind to this {nodeKind}. The selected kind contributes to snapshot resolution.
                </p>

                <div className="space-y-3">
                    <InputField
                        variant="select"
                        label="Kind"
                        disabled={!canEditSelect}
                        value={selectedKind}
                        options={selectOptions as any}
                        onChange={(event) => {
                            const nextKind = String(event.value ?? '').trim();
                            if (!nextKind || disabled) return;
                            canvas.api.editor.setOrderKind(nodeId, nextKind);
                        }}
                    />

                    {hasAssignedKind ? (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-500 dark:text-rose-300 dark:hover:text-rose-200"
                            onClick={() => canvas.api.editor.deleteOrderKind(nodeId)}
                        >
                            <MdOutlineRemoveCircleOutline className="text-base" />
                            Remove assigned kind
                        </button>
                    ) : null}

                    {!selectOptions.length ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No order kinds configured yet.</p>
                    ) : null}

                    {disabledMessage ? <p className="text-xs text-slate-500 dark:text-slate-400">{disabledMessage}</p> : null}
                </div>
            </Section.Content>
        </Section>
    );
}

export default OrderKindSection;
