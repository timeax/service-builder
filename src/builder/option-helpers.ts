import type { Field, FieldOption } from '@timeax/digital-service-engine/schema';

export type OptionLocation = {
    field: Field;
    option: FieldOption;
    parentOption?: FieldOption;
    siblings: FieldOption[];
    index: number;
    depth: number;
};

export type OptionVisit = {
    field: Field;
    fieldId: string;
    option: FieldOption;
    optionId: string;
    depth: number;
    parentId?: string;
};

type NestedFieldOption = FieldOption & { children?: FieldOption[] };

export function walkFieldOptions(field: Field): OptionVisit[] {
    const out: OptionVisit[] = [];

    const visit = (options: readonly FieldOption[] | undefined, depth: number, parentId?: string) => {
        for (const option of options ?? []) {
            out.push({
                field,
                fieldId: field.id,
                option,
                optionId: option.id,
                depth,
                parentId,
            });
            visit((option as NestedFieldOption).children, depth + 1, option.id);
        }
    };

    visit(field.options, 0);
    return out;
}

export function findOptionOwnerField(fields: Iterable<Field>, optionId: string): Field | undefined {
    for (const field of fields) {
        if (walkFieldOptions(field).some((visit) => visit.optionId === optionId)) return field;
    }

    return undefined;
}

export function filterFieldOptionsById(
    options: readonly FieldOption[] | undefined,
    allowed: ReadonlySet<string>,
): FieldOption[] | undefined {
    if (!Array.isArray(options)) return undefined;

    const out: FieldOption[] = [];
    for (const option of options) {
        const children = filterFieldOptionsById((option as NestedFieldOption).children, allowed);
        if (!allowed.has(option.id) && (!children || children.length === 0)) {
            continue;
        }

        out.push({
            ...option,
            ...(children ? { children } : {}),
        } as FieldOption);
    }

    return out;
}

export function countOptions(field: Pick<Field, 'options'> | undefined): number {
    if (!field) return 0;
    return walkFieldOptions(field as Field).length;
}

export function mapOptionsById(
    options: readonly FieldOption[] | undefined,
    optionId: string,
    mapper: (option: FieldOption) => FieldOption,
): FieldOption[] | undefined {
    if (!Array.isArray(options)) return undefined;

    let changed = false;
    const next = options.map((option) => {
        let mapped = option.id === optionId ? mapper(option) : option;
        const children = mapOptionsById((option as NestedFieldOption).children, optionId, mapper);

        if (children !== option.children) {
            mapped = { ...mapped, children };
        }

        if (mapped !== option) changed = true;
        return mapped;
    });

    return changed ? next : (options as FieldOption[]);
}

export function findOptionLocation(fields: readonly Field[] | undefined, optionId: string): OptionLocation | undefined {
    const visit = (
        field: Field,
        siblings: FieldOption[] | undefined,
        parentOption: FieldOption | undefined,
        depth: number,
    ): OptionLocation | undefined => {
        if (!Array.isArray(siblings)) return undefined;

        for (let index = 0; index < siblings.length; index += 1) {
            const option = siblings[index];
            if (option.id === optionId) {
                return { field, option, parentOption, siblings, index, depth };
            }

            const childHit = visit(field, (option as NestedFieldOption).children, option, depth + 1);
            if (childHit) return childHit;
        }

        return undefined;
    };

    for (const field of fields ?? []) {
        const hit = visit(field, field.options, undefined, 0);
        if (hit) return hit;
    }

    return undefined;
}

export function optionBreadcrumb(field: Field, optionId: string): string {
    const labelsById = new Map<string, string>();
    const parentById = new Map<string, string | undefined>();

    for (const visit of walkFieldOptions(field)) {
        labelsById.set(visit.optionId, visit.option.label);
        parentById.set(visit.optionId, visit.parentId);
    }

    const labels: string[] = [];
    let current: string | undefined = optionId;
    while (current) {
        const label = labelsById.get(current);
        if (label) labels.unshift(label);
        current = parentById.get(current);
    }

    return labels.length ? labels.join(' / ') : optionId;
}

export function moveOptionWithinSiblings(fields: Field[] | undefined, optionId: string, index: number): boolean {
    const location = findOptionLocation(fields, optionId);
    if (!location) return false;
    const nextIndex = Math.min(Math.max(index, 0), location.siblings.length - 1);
    if (nextIndex === location.index) return false;

    const [pulled] = location.siblings.splice(location.index, 1);
    location.siblings.splice(nextIndex, 0, pulled);
    return true;
}

export function addChildOption(fields: Field[] | undefined, parentOptionId: string, option: FieldOption): boolean {
    const location = findOptionLocation(fields, parentOptionId);
    if (!location) return false;
    const children = (((location.option as NestedFieldOption).children ??= []) as FieldOption[]);
    if (children.some((child) => child.id === option.id)) return false;
    children.push(option);
    return true;
}
