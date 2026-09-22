// SPDX-License-Identifier: GPL-3.0-only
import type { FieldOption, ProductDefinition } from '@elqora/dgp-spec';

function clampIndex(index: number, length: number): number {
    return Math.max(0, Math.min(Math.trunc(index), Math.max(0, length - 1)));
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
    if (from < 0 || from >= items.length || items.length < 2) return [...items];
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item === undefined) return next;
    next.splice(clampIndex(to, next.length + 1), 0, item);
    return next;
}

export function reorderCanonicalFilter(
    definition: ProductDefinition,
    filterId: string,
    toIndex: number,
): ProductDefinition {
    const source = definition.filters.find((filter) => filter.id === filterId);
    if (source === undefined) return definition;
    const siblingIds = definition.filters
        .filter((filter) => filter.bind_id === source.bind_id)
        .map((filter) => filter.id);
    const reordered = moveItem(siblingIds, siblingIds.indexOf(filterId), toIndex);
    if (reordered.every((id, index) => id === siblingIds[index])) return definition;
    const rank = new Map(reordered.map((id, index) => [id, index]));
    const slots = definition.filters
        .map((filter, index) => ({ filter, index }))
        .filter(({ filter }) => filter.bind_id === source.bind_id)
        .map(({ index }) => index);
    const siblings = definition.filters
        .filter((filter) => filter.bind_id === source.bind_id)
        .sort((left, right) => (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0));
    const filters = [...definition.filters];
    slots.forEach((slot, index) => {
        const sibling = siblings[index];
        if (sibling !== undefined) filters[slot] = sibling;
    });
    return { ...definition, filters };
}

function reorderNestedOption(
    options: readonly FieldOption[] | undefined,
    optionId: string,
    toIndex: number,
): { options: FieldOption[] | undefined; changed: boolean } {
    if (options === undefined) return { options: undefined, changed: false };
    const directIndex = options.findIndex((option) => option.id === optionId);
    if (directIndex >= 0) {
        const next = moveItem(options, directIndex, toIndex);
        const changed = next.some((option, index) => option !== options[index]);
        return { options: changed ? next : [...options], changed };
    }

    for (let index = 0; index < options.length; index += 1) {
        const option = options[index];
        if (option === undefined) continue;
        const nested = reorderNestedOption(option.children, optionId, toIndex);
        if (!nested.changed) continue;
        const next = [...options];
        next[index] = { ...option, children: nested.options };
        return { options: next, changed: true };
    }
    return { options: [...options], changed: false };
}

export function reorderCanonicalOption(
    definition: ProductDefinition,
    optionId: string,
    toIndex: number,
): ProductDefinition {
    for (let index = 0; index < definition.fields.length; index += 1) {
        const field = definition.fields[index];
        if (field === undefined) continue;
        const reordered = reorderNestedOption(field.options, optionId, toIndex);
        if (!reordered.changed) continue;
        const fields = [...definition.fields];
        fields[index] = { ...field, options: reordered.options };
        return { ...definition, fields };
    }
    return definition;
}

export function reorderCanonicalFieldForFilter(
    definition: ProductDefinition,
    filterId: string,
    fieldId: string,
    visibleFieldIds: readonly string[],
    toIndex: number,
): ProductDefinition {
    if (!definition.fields.some((field) => field.id === fieldId)) return definition;
    const ordered = visibleFieldIds.filter((id, index) => visibleFieldIds.indexOf(id) === index);
    if (!ordered.includes(fieldId)) ordered.push(fieldId);
    const nextOrder = moveItem(ordered, ordered.indexOf(fieldId), toIndex);
    const current = definition.order_for_tags[filterId] ?? [];
    if (nextOrder.length === current.length && nextOrder.every((id, index) => current[index] === id)) return definition;
    return {
        ...definition,
        order_for_tags: {
            ...definition.order_for_tags,
            [filterId]: nextOrder,
        },
    };
}
