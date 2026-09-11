import { Button } from '@/components/ui/button.tsx';
import type { Ui, UiAnyOf, UiBoolean, UiNumber, UiString } from '@timeax/digital-service-engine/schema';
import { InputField } from '@timeax/form-palette';
import { createContext, useContext, type ReactNode } from 'react';
import { parseFiniteNumber } from './meta.ts';

export type DescriptorUiRenderValue = unknown;

export type DescriptorUiSchema = Ui | { type: string; label?: string; description?: string };

export type DescriptorUiRendererProps<TSchema extends DescriptorUiSchema = DescriptorUiSchema, TValue = unknown> = {
    name: string;
    path: Array<string | number>;
    schema: TSchema;
    value: TValue | undefined;
    hasOverride: boolean;
    onChange: (value: TValue) => void;
    onClear: () => void;
    onBlur: () => void;
    disabled?: boolean;
};

export type DescriptorUiRenderer<TSchema extends DescriptorUiSchema = DescriptorUiSchema, TValue = unknown> = (
    props: DescriptorUiRendererProps<TSchema, TValue>,
) => ReactNode;

export interface DescriptorUiRendererRegistry {
    register(type: string, renderer: DescriptorUiRenderer): void;
    unregister(type: string): void;
    resolve(type: string): DescriptorUiRenderer | undefined;
    has(type: string): boolean;
}

const normalizeTypeName = (type: string) => {
    const normalized = type.trim();
    if (!normalized) throw new Error('Descriptor UI renderer type must be a non-empty string.');
    return normalized;
};

export function createDescriptorUiRendererRegistry(): DescriptorUiRendererRegistry {
    const renderers = new Map<string, DescriptorUiRenderer>();

    return {
        register(type, renderer) {
            const normalized = normalizeTypeName(type);
            if (typeof renderer !== 'function') {
                throw new Error(`Descriptor UI renderer for "${normalized}" must be a function.`);
            }

            renderers.set(normalized, renderer);
        },
        unregister(type) {
            renderers.delete(normalizeTypeName(type));
        },
        resolve(type) {
            return renderers.get(normalizeTypeName(type));
        },
        has(type) {
            return renderers.has(normalizeTypeName(type));
        },
    };
}

const toInputText = (value: unknown) => (value === undefined || value === null ? '' : String(value));

export function FieldDescription({ description, canReset, onReset }: { description?: string; canReset?: boolean; onReset?: () => void }) {
    if (!description && !canReset) return null;

    return (
        <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            {canReset ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onReset}>
                    Reset
                </Button>
            ) : null}
        </div>
    );
}

export const renderStringUiProperty: DescriptorUiRenderer<UiString & { label: string; description: string }, string> = ({
    schema,
    value,
    hasOverride,
    onChange,
    onClear,
    onBlur,
    disabled,
}) => {
    const options = schema.enum?.map((item) => ({ label: item, value: item }));

    return (
        <div className="space-y-2">
            <FieldDescription description={schema.description} canReset={hasOverride} onReset={onClear} />
            <InputField
                variant={options?.length ? 'select' : 'text'}
                label={schema.label}
                value={typeof value === 'string' ? value : ''}
                options={options as any}
                placeholder={options?.length ? undefined : `Enter ${schema.label.toLowerCase()}`}
                disabled={disabled}
                onBlur={onBlur}
                onChange={(event) => {
                    const nextValue = event.value;
                    if (typeof nextValue === 'string' && nextValue.trim() === '' && !options?.length) {
                        onClear();
                        return;
                    }

                    onChange(nextValue as string);
                }}
            />
        </div>
    );
};

export const renderNumberUiProperty: DescriptorUiRenderer<UiNumber & { label: string; description: string }, number> = ({
    schema,
    value,
    hasOverride,
    onChange,
    onClear,
    onBlur,
    disabled,
}) => (
    <div className="space-y-2">
        <FieldDescription description={schema.description} canReset={hasOverride} onReset={onClear} />
        <InputField
            variant="text"
            label={schema.label}
            value={toInputText(value)}
            placeholder="Enter a number"
            disabled={disabled}
            onBlur={onBlur}
            onChange={(event) => {
                const nextValue = parseFiniteNumber(event.value);
                if (nextValue === undefined) {
                    onClear();
                    return;
                }

                onChange(nextValue);
            }}
        />
    </div>
);

export const renderBooleanUiProperty: DescriptorUiRenderer<UiBoolean & { label: string; description: string }, boolean> = ({
    schema,
    value,
    hasOverride,
    onChange,
    onClear,
    onBlur,
    disabled,
}) => (
    <div className="space-y-2">
        <FieldDescription description={schema.description} canReset={hasOverride} onReset={onClear} />
        <InputField
            variant="toggle"
            label={schema.label}
            value={typeof value === 'boolean' ? value : false}
            disabled={disabled}
            onBlur={onBlur}
            onChange={(event) => onChange(Boolean(event.value))}
        />
    </div>
);

export const renderAnyOfUiProperty: DescriptorUiRenderer<UiAnyOf & { label: string; description: string }> = ({
    schema,
    value,
    hasOverride,
    onChange,
    onClear,
    onBlur,
    disabled,
}) => {
    const options = schema.items.map((item) => ({
        label: item.title ?? String(item.value),
        value: item.value,
        description: item.description,
    }));

    return (
        <div className="space-y-2">
            <FieldDescription description={schema.description} canReset={hasOverride} onReset={onClear} />
            <InputField
                variant={schema.multiple ? 'multi-select' : 'select'}
                label={schema.label}
                value={(schema.multiple ? (Array.isArray(value) ? value : []) : value) as any}
                options={options as any}
                disabled={disabled}
                onBlur={onBlur}
                onChange={(event) => {
                    const nextValue = event.value;

                    if (schema.multiple) {
                        if (!Array.isArray(nextValue) || !nextValue.length) {
                            onClear();
                            return;
                        }
                    }

                    onChange(nextValue);
                }}
            />
        </div>
    );
};

export function createDefaultDescriptorUiRendererRegistry() {
    const registry = createDescriptorUiRendererRegistry();

    registry.register('string', renderStringUiProperty as DescriptorUiRenderer);
    registry.register('number', renderNumberUiProperty as DescriptorUiRenderer);
    registry.register('boolean', renderBooleanUiProperty as DescriptorUiRenderer);
    registry.register('anyOf', renderAnyOfUiProperty as DescriptorUiRenderer);

    return registry;
}

const defaultDescriptorUiRendererRegistry = createDefaultDescriptorUiRendererRegistry();
const DescriptorUiRendererRegistryContext = createContext<DescriptorUiRendererRegistry | undefined>(undefined);

export function DescriptorUiRendererProvider({
    registry = defaultDescriptorUiRendererRegistry,
    children,
}: {
    registry?: DescriptorUiRendererRegistry;
    children: ReactNode;
}) {
    return <DescriptorUiRendererRegistryContext.Provider value={registry}>{children}</DescriptorUiRendererRegistryContext.Provider>;
}

export function useDescriptorUiRendererRegistry() {
    return useContext(DescriptorUiRendererRegistryContext) ?? defaultDescriptorUiRendererRegistry;
}
