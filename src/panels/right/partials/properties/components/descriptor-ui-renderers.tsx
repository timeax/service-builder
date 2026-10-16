import { Button } from '@/components/ui/button.tsx';
import { InputField, type VariantKey } from '@timeax/form-palette';
import { createContext, useContext, type ReactNode } from 'react';
import { parseFiniteNumber } from './meta.ts';
import type {
    DescriptorUiAnyOf,
    DescriptorUiBoolean,
    DescriptorUiNumber,
    DescriptorUiSchema,
    DescriptorUiString,
} from './descriptor-ui-schema.ts';

export type DescriptorUiRenderValue = unknown;

export type { DescriptorUiSchema } from './descriptor-ui-schema.ts';

const formatPropertyLabel = (name: string) =>
    name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (letter) => letter.toUpperCase());

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

export const renderStringUiProperty: DescriptorUiRenderer<DescriptorUiString, string> = ({
    name,
    schema,
    value,
    hasOverride,
    onChange,
    onClear,
    onBlur,
    disabled,
}) => {
    const options = schema.enum?.filter((item) => item !== '').map((item) => ({ label: item, value: item }));
    const variant = schema.variant ?? (options?.length ? 'select' : 'text');
    const label = schema.label ?? (formatPropertyLabel(name) || 'Value');
    const inputValue = variant === 'date' && typeof value === 'string'
        ? Number.isNaN(new Date(value).getTime()) ? undefined : new Date(value)
        : variant === 'select'
          ? typeof value === 'string' && value !== '' ? value : undefined
          : typeof value === 'string' ? value : '';

    return (
        <div className="space-y-2">
            <FieldDescription description={schema.description} canReset={hasOverride} onReset={onClear} />
            <InputField
                variant={variant as VariantKey}
                autoCap={['select', 'multi-select', 'treeselect'].includes(variant)}
                label={label}
                value={inputValue as never}
                options={variant === 'select' ? options : undefined}
                placeholder={variant === 'text' && !options?.length ? `Enter ${label.toLowerCase()}` : undefined}
                disabled={disabled}
                onBlur={onBlur}
                onChange={(event) => {
                    const nextValue = event.value;
                    if (nextValue instanceof Date) {
                        if (Number.isNaN(nextValue.getTime())) onClear();
                        else onChange(nextValue.toISOString());
                        return;
                    }
                    if (typeof nextValue === 'string' && nextValue.trim() === '' && !options?.length) {
                        onClear();
                        return;
                    }

                    if (typeof nextValue === 'string') onChange(nextValue);
                    else onClear();
                }}
            />
        </div>
    );
};

export const renderNumberUiProperty: DescriptorUiRenderer<DescriptorUiNumber & { label: string; description: string }, number> = ({
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
            variant={(schema.variant ?? 'number') as VariantKey}
            autoCap={['select', 'multi-select', 'treeselect'].includes(schema.variant ?? '')}
            label={schema.label}
            value={typeof value === 'number' ? value : undefined}
            min={schema.minimum}
            placeholder="Enter a number"
            disabled={disabled}
            onBlur={onBlur}
            onChange={(event) => {
                const nextValue = typeof event.value === 'number' ? event.value : parseFiniteNumber(event.value);
                if (nextValue === undefined || !Number.isFinite(nextValue)) {
                    onClear();
                    return;
                }

                onChange(nextValue);
            }}
        />
    </div>
);

export const renderBooleanUiProperty: DescriptorUiRenderer<DescriptorUiBoolean & { label: string; description: string }, boolean> = ({
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
            variant={(schema.variant ?? 'toggle') as VariantKey}
            autoCap={['select', 'multi-select', 'treeselect'].includes(schema.variant ?? '')}
            label={schema.label}
            value={typeof value === 'boolean' ? value : false}
            disabled={disabled}
            onBlur={onBlur}
            onChange={(event) => {
                if (typeof event.value === 'boolean') onChange(event.value);
                else onClear();
            }}
        />
    </div>
);

export const renderAnyOfUiProperty: DescriptorUiRenderer<DescriptorUiAnyOf & { label: string; description: string }> = ({
    schema,
    value,
    hasOverride,
    onChange,
    onClear,
    onBlur,
    disabled,
}) => {
    const isSelectPrimitive = (item: unknown): item is string | number => typeof item === 'string' || typeof item === 'number';
    const options = schema.items
        .filter((item): item is typeof item & { value: string | number } => isSelectPrimitive(item.value) && item.value !== '')
        .map((item) => ({
            label: item.title ?? String(item.value),
            value: item.value,
            description: item.description,
        }));
    const multipleValue = Array.isArray(value) ? value.filter((item) => isSelectPrimitive(item) && item !== '') : [];
    const singleValue = isSelectPrimitive(value) && value !== '' ? value : undefined;
    const handleChange = (event: { value: unknown }) => {
        const nextValue = event.value;

        if (schema.multiple && (!Array.isArray(nextValue) || !nextValue.length)) {
            onClear();
            return;
        }

        onChange(nextValue);
    };

    return (
        <div className="space-y-2">
            <FieldDescription description={schema.description} canReset={hasOverride} onReset={onClear} />
            {schema.multiple ? (
                <InputField
                    variant="multi-select" autoCap
                    label={schema.label}
                    value={multipleValue}
                    options={options}
                    disabled={disabled}
                    onBlur={onBlur}
                    onChange={handleChange}
                />
            ) : (
                <InputField
                    variant="select" autoCap
                    label={schema.label}
                    value={singleValue}
                    options={options}
                    disabled={disabled}
                    onBlur={onBlur}
                    onChange={handleChange}
                />
            )}
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
