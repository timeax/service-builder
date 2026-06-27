import { buildOptionId } from './utils.ts';

export type RelationMap = Record<string, string[]>;
export type RelationMaps = Record<string, RelationMap>;

export type TemplateFieldGroupDefinition = {
    templateType: 'field';
    mode: 'group';
    version: 1;
    label: string;
    rootOriginalId: string;
    fields: Array<{ originalId: string; field: Record<string, unknown> }>;
    relations: RelationMaps;
};

export type TemplateFieldSingleDefinition = {
    templateType: 'field';
    mode: 'single';
    version: 1;
    field: Record<string, unknown>;
};

export function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function sanitizeOption(option: Record<string, unknown>): Record<string, unknown> {
    const next = deepClone(option);
    delete (next as Record<string, unknown>).id;
    delete (next as Record<string, unknown>).service_id;
    if (Array.isArray(next.children)) {
        next.children = next.children.map((child) =>
            child && typeof child === 'object' ? sanitizeOption(child as Record<string, unknown>) : child,
        );
    }
    return next;
}

export function sanitizeField(field: Record<string, unknown>): Record<string, unknown> {
    const next = deepClone(field);
    delete next.id;
    delete next.bind_id;
    if (Array.isArray(next.options)) {
        next.options = next.options.map((option) =>
            option && typeof option === 'object' ? sanitizeOption(option as Record<string, unknown>) : option,
        );
    }
    return next;
}

export function pickCheckedProperties(source: Record<string, unknown>, checked: Record<string, boolean>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
        if (checked[key] !== false) out[key] = source[key];
    }
    return out;
}

export function detectRelationMaps(props: Record<string, unknown>): RelationMaps {
    const relations: RelationMaps = {};
    for (const [key, value] of Object.entries(props)) {
        if (!/(includes|excludes)_for_/i.test(key)) continue;
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const relation: RelationMap = {};
        for (const [source, targets] of Object.entries(value as Record<string, unknown>)) {
            if (!Array.isArray(targets)) continue;
            relation[String(source)] = targets.map(String);
        }
        relations[key] = relation;
    }
    return relations;
}

export function discoverGroupFieldIds(rootFieldId: string, relations: RelationMaps): string[] {
    const discovered = new Set<string>([rootFieldId]);
    const queue = [rootFieldId];
    while (queue.length) {
        const current = queue.shift() as string;
        for (const relation of Object.values(relations)) {
            const outbound = relation[current] ?? [];
            for (const id of outbound) {
                if (!discovered.has(id)) {
                    discovered.add(id);
                    queue.push(id);
                }
            }
            for (const [source, targets] of Object.entries(relation)) {
                if (targets.includes(current) && !discovered.has(source)) {
                    discovered.add(source);
                    queue.push(source);
                }
            }
        }
    }
    return Array.from(discovered);
}

export function filterRelationsForSelection(relations: RelationMaps, selected: Set<string>): RelationMaps {
    const next: RelationMaps = {};
    for (const [relationName, relation] of Object.entries(relations)) {
        const cleaned: RelationMap = {};
        for (const [source, targets] of Object.entries(relation)) {
            if (!selected.has(source)) continue;
            const keptTargets = targets.filter((target) => selected.has(target));
            if (keptTargets.length) cleaned[source] = Array.from(new Set(keptTargets));
        }
        next[relationName] = cleaned;
    }
    return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isGroupTemplateDefinition(definition: unknown): definition is TemplateFieldGroupDefinition {
    return (
        isRecord(definition) &&
        definition.templateType === 'field' &&
        definition.mode === 'group' &&
        Array.isArray(definition.fields) &&
        typeof definition.rootOriginalId === 'string' &&
        isRecord(definition.relations)
    );
}

export function isSingleTemplateDefinition(definition: unknown): definition is TemplateFieldSingleDefinition {
    return (
        isRecord(definition) &&
        definition.templateType === 'field' &&
        definition.mode === 'single' &&
        isRecord(definition.field)
    );
}

export function toSingleFieldDefinition(definition: unknown): Record<string, unknown> {
    if (isSingleTemplateDefinition(definition)) return deepClone(definition.field);
    if (isRecord(definition)) return deepClone(definition);
    return {};
}

export function withFreshOptionIds(field: Record<string, unknown>): Record<string, unknown> {
    const next = deepClone(field);
    if (Array.isArray(next.options)) {
        next.options = next.options.map(withFreshOptionId);
    }
    return next;
}

function withFreshOptionId(option: unknown): Record<string, unknown> {
    const raw = option && typeof option === 'object' ? ({ ...(option as Record<string, unknown>) } as Record<string, unknown>) : {};
    raw.id = buildOptionId();
    if (Array.isArray(raw.children)) {
        raw.children = raw.children.map(withFreshOptionId);
    }
    return raw;
}
