import { resolveInputDescriptor, type Registry } from '@timeax/digital-service-engine/react';

type FieldLike = {
    type?: unknown;
    meta?: Record<string, unknown> | null;
    options?: Array<unknown> | null;
};

export type ResolvedOptionCapability = {
    descriptorResolved: boolean;
    supportsOptions: boolean;
    supportsChildOptions: boolean;
    shouldAutoCreate: boolean;
    defaultLabel: string;
    defaultValue: string | number;
    childDefaultLabel: string;
    childDefaultValue: string | number;
};

export function resolveFieldDescriptorVariant(field: FieldLike): string | undefined {
    const variant = field?.meta?.variant;
    return typeof variant === 'string' && variant.trim() ? variant.trim() : undefined;
}

export function resolveFieldOptionCapability(registry: Registry, field: FieldLike): ResolvedOptionCapability {
    const kind = String(field?.type ?? 'text');
    const variant = resolveFieldDescriptorVariant(field);
    const descriptor = resolveInputDescriptor(registry, kind as any, variant as any);
    const descriptorResolved = !!descriptor;
    const supportsOptions = descriptor?.options?.supported === true;
    const childOptions = (descriptor?.options as any)?.children;
    const supportsChildOptions = childOptions?.supported === true;
    const shouldAutoCreate = supportsOptions && descriptor?.options?.autoCreate === true;

    return {
        descriptorResolved,
        supportsOptions,
        supportsChildOptions,
        shouldAutoCreate,
        defaultLabel: descriptor?.options?.defaultLabel ?? 'Option label',
        defaultValue: descriptor?.options?.defaultValue ?? 'option',
        childDefaultLabel: childOptions?.defaultLabel ?? descriptor?.options?.defaultLabel ?? 'Child option label',
        childDefaultValue: childOptions?.defaultValue ?? descriptor?.options?.defaultValue ?? 'child-option',
    };
}

export function shouldBlockOptionCreation(registry: Registry, field: FieldLike): boolean {
    const capability = resolveFieldOptionCapability(registry, field);
    return capability.descriptorResolved && !capability.supportsOptions;
}

export function fieldHasOptions(field: FieldLike): boolean {
    return Array.isArray(field?.options) && field.options.length > 0;
}
