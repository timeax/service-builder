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

export function buildQuantityRule(valueBy: QuantityRule['valueBy'], code?: string): QuantityRule {
    return valueBy === 'eval' ? { valueBy, code: code?.trim() || undefined } : { valueBy };
}
