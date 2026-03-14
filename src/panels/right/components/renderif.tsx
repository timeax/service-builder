import * as React from 'react';

export type RenderIfProps<T = unknown> = {
    /**
     * Anything you want to check:
     * object | string | number | boolean | array | null | undefined | ...
     */
    data: T;

    /**
     * Rendered when the condition fails.
     * Default: render nothing.
     */
    emptyMessage?: React.ReactNode;

    /**
     * What to render when the condition passes.
     * - If you pass a function, it receives the data (typed).
     */
    children: React.ReactNode | ((data: NonNullable<T>) => React.ReactNode);

    /**
     * Optional: override the default truthiness rules.
     */
    when?: (data: T) => boolean;
};

/**
 * Default pass rules:
 * - null/undefined => fail
 * - boolean => must be true
 * - string => must be non-empty after trim
 * - number => must NOT be NaN (0 is allowed)
 * - array => must have length > 0
 * - object => must have at least 1 key
 * - everything else => JS truthy
 */
function defaultWhen(data: unknown): boolean {
    if (data == null) return false;

    if (typeof data === 'boolean') return data;

    if (typeof data === 'string') return data.trim().length > 0;

    if (typeof data === 'number') return !Number.isNaN(data);

    if (Array.isArray(data)) return data.length > 0;

    if (typeof data === 'object') return Object.keys(data as object).length > 0;

    return Boolean(data);
}

export function RenderIf<T = unknown>({ data, emptyMessage = null, children, when }: RenderIfProps<T>) {
    const ok = (when ?? defaultWhen)(data);

    if (!ok) {
        if(typeof emptyMessage == 'string') {
            return <span className={'text-xs'}>{emptyMessage}</span>
        }

        return emptyMessage
    };

    const node = typeof children === 'function' ? (children as (d: NonNullable<T>) => React.ReactNode)(data as NonNullable<T>) : children;

    return <>{node}</>;
}
