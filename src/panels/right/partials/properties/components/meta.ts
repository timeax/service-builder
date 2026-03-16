import type { QuantityRule } from '@timeax/digital-service-engine/schema';

export type NodeMeta = Record<string, unknown> | undefined;

export function mergeNodeMeta(meta: NodeMeta, patch: Record<string, unknown | undefined>) {
    const next: Record<string, unknown> = { ...(meta ?? {}) };

    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete next[key];
        else next[key] = value;
    }

    return Object.keys(next).length ? next : undefined;
}

export function parseFiniteNumber(value: unknown) {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function asInputValue(value: unknown) {
    return value === null || value === undefined ? '' : String(value);
}

export function buildQuantityRule(valueBy: QuantityRule['valueBy'], base: Partial<QuantityRule> = {}): QuantityRule {
    const next: QuantityRule = {
        valueBy,
    };

    if (valueBy === 'eval') {
        const code = typeof base.code === 'string' ? base.code.trim() : '';
        if (code) next.code = code;
    }

    if (typeof base.multiply === 'number' && Number.isFinite(base.multiply)) {
        next.multiply = base.multiply;
    }

    if (typeof base.fallback === 'number' && Number.isFinite(base.fallback)) {
        next.fallback = base.fallback;
    }

    const clampMin = typeof base.clamp?.min === 'number' && Number.isFinite(base.clamp.min) ? base.clamp.min : undefined;
    const clampMax = typeof base.clamp?.max === 'number' && Number.isFinite(base.clamp.max) ? base.clamp.max : undefined;

    if (clampMin !== undefined || clampMax !== undefined) {
        next.clamp = {
            ...(clampMin !== undefined ? { min: clampMin } : {}),
            ...(clampMax !== undefined ? { max: clampMax } : {}),
        };
    }

    return next;
}
