export type ServicePickerSummary = {
    id: string | number;
    name: string;
    category?: string;
    rate?: number;
    platformId?: string;
    flags: string[];
    attachmentCount?: number;
    attachedNodeIds?: string[];
    attachedNodeLabels?: string[];
    active?: boolean;
    min?: number;
    max?: number;
    estimate?: string | null;
};

export type ServicePickerCatalogService = { meta?: unknown };

export type ServicePickerFilters = {
    source: 'parent' | 'all';
    query: string;
    category: string;
    flag: string;
    activity: 'all' | 'hide-active' | 'active-only';
    rateMin: string;
    rateMax: string;
    keywordMode: 'include' | 'exclude';
    keyword: string;
    metaPath: string;
    metaValue: string;
};

export type ServiceMetaPath = {
    path: string;
    values: string[];
};

const DEFAULT_FILTERS: ServicePickerFilters = {
    source: 'all',
    query: '',
    category: '',
    flag: '',
    activity: 'all',
    rateMin: '',
    rateMax: '',
    keywordMode: 'include',
    keyword: '',
    metaPath: '',
    metaValue: '',
};

type ServicePickerDefaultSourceArgs = {
    selectedGroupId?: string | null;
    parentGroupId?: string | null;
    parentServiceIds?: Set<string>;
};

export function resolveServicePickerSourceDefault(args: ServicePickerDefaultSourceArgs = {}): ServicePickerFilters['source'] {
    if (!args.selectedGroupId || !args.parentGroupId) return 'all';
    return (args.parentServiceIds?.size ?? 0) > 0 ? 'parent' : 'all';
}

export function createDefaultServicePickerFilters(args: ServicePickerDefaultSourceArgs = {}): ServicePickerFilters {
    return { ...DEFAULT_FILTERS, source: resolveServicePickerSourceDefault(args) };
}

export function discoverServiceMetaPaths(services: ServicePickerCatalogService[]): ServiceMetaPath[] {
    const valueMap = new Map<string, Set<string>>();

    for (const service of services) {
        collectMetaValues(service.meta, '', valueMap);
    }

    return Array.from(valueMap.entries())
        .map(([path, values]) => ({
            path,
            values: Array.from(values).sort((a, b) => a.localeCompare(b)),
        }))
        .sort((a, b) => a.path.localeCompare(b.path));
}

export function filterServicePickerServices(args: {
    services: ServicePickerSummary[];
    serviceMap: Record<string, ServicePickerCatalogService>;
    filters: ServicePickerFilters;
    activeIds?: Set<string>;
    parentServiceIds?: Set<string>;
}) {
    const query = args.filters.query.trim().toLowerCase();
    const keyword = args.filters.keyword.trim().toLowerCase();
    const rateMin = parseNullableNumber(args.filters.rateMin);
    const rateMax = parseNullableNumber(args.filters.rateMax);

    const sourceServices =
        args.filters.source === 'parent'
            ? args.services.filter((summary) => args.parentServiceIds?.has(String(summary.id)) ?? false)
            : args.services;

    const filtered = sourceServices.filter((summary) => {
        const id = String(summary.id);
        const service = args.serviceMap[id];
        const searchText = [summary.name, summary.category, summary.platformId, id].filter(Boolean).join(' ').toLowerCase();

        if (query && !searchText.includes(query)) return false;
        if (args.filters.category && summary.category !== args.filters.category) return false;
        if (args.filters.flag && !summary.flags.includes(args.filters.flag)) return false;

        if (args.filters.activity === 'hide-active' && args.activeIds?.has(id)) return false;
        if (args.filters.activity === 'active-only' && !args.activeIds?.has(id)) return false;

        if (rateMin != null && (summary.rate == null || summary.rate < rateMin)) return false;
        if (rateMax != null && (summary.rate == null || summary.rate > rateMax)) return false;

        if (keyword) {
            const hasKeyword = summary.name.toLowerCase().includes(keyword);
            if (args.filters.keywordMode === 'include' && !hasKeyword) return false;
            if (args.filters.keywordMode === 'exclude' && hasKeyword) return false;
        }

        if (args.filters.metaPath) {
            const values = getMetaValues(service?.meta, args.filters.metaPath);
            if (!values.length) return false;
            if (args.filters.metaValue && !values.some((value) => value === args.filters.metaValue)) return false;
        }

        return true;
    });

    return filtered.sort((a, b) => compareServices(a, b, query));
}

export function getMetaValues(meta: unknown, path: string): string[] {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta) || !path) return [];
    const segments = path.split('.');
    let current: unknown = meta;

    for (const segment of segments) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) return [];
        current = (current as Record<string, unknown>)[segment];
    }

    return normalizeMetaValue(current);
}

function collectMetaValues(value: unknown, prefix: string, valueMap: Map<string, Set<string>>) {
    if (value == null) return;

    if (Array.isArray(value)) {
        const scalars = value.flatMap((entry) => normalizeMetaValue(entry));
        if (prefix && scalars.length) {
            const bucket = valueMap.get(prefix) ?? new Set<string>();
            for (const scalar of scalars) bucket.add(scalar);
            valueMap.set(prefix, bucket);
        }
        return;
    }

    if (typeof value === 'object') {
        for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (isScalar(next) || Array.isArray(next)) {
                const values = normalizeMetaValue(next);
                if (!values.length) continue;
                const bucket = valueMap.get(path) ?? new Set<string>();
                for (const scalar of values) bucket.add(scalar);
                valueMap.set(path, bucket);
            }
            if (next && typeof next === 'object' && !Array.isArray(next)) {
                collectMetaValues(next, path, valueMap);
            }
        }
    }
}

function normalizeMetaValue(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap((entry) => normalizeMetaValue(entry));
    if (typeof value === 'string') return value.trim() ? [value] : [];
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    return [];
}

function parseNullableNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function compareServices(a: ServicePickerSummary, b: ServicePickerSummary, query: string) {
    const aMatch = query ? Number(a.name.toLowerCase().includes(query)) : 0;
    const bMatch = query ? Number(b.name.toLowerCase().includes(query)) : 0;
    return bMatch - aMatch || (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name);
}

function isScalar(value: unknown) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
