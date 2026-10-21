// SPDX-License-Identifier: GPL-3.0-only
import { createProductIndex } from '@elqora/dgp-core';
import type { FieldOption, ProductDefinition, ProductField, ProductFilter } from '@elqora/dgp-spec';

export type CanonicalInspectorNode =
    | { kind: 'none' }
    | { kind: 'filter'; id: string; raw: ProductFilter; summary: string; binding: string }
    | { kind: 'field'; id: string; raw: ProductField; summary: string; binding: string }
    | { kind: 'option'; id: string; raw: FieldOption; field: ProductField; summary: string; binding: string };

function countOptions(options: readonly FieldOption[] = []): number {
    return options.reduce((total, option) => total + 1 + countOptions(option.children), 0);
}

export function createCanonicalInspectorNode(
    definition: ProductDefinition | null,
    activeId?: string,
): CanonicalInspectorNode {
    if (definition === null || activeId === undefined) return { kind: 'none' };
    const index = createProductIndex(definition);
    const node = index.getNode(activeId);

    if (node.kind === 'filter') {
        const descendants = index.filterDescendants(node.id).length;
        const includes = node.filter.includes?.length ?? 0;
        const excludes = node.filter.excludes?.length ?? 0;
        const parent = node.filter.bind_id ? index.getFilter(node.filter.bind_id) : undefined;
        return {
            kind: 'filter',
            id: node.id,
            raw: node.filter,
            summary: `${descendants} descendant filter${descendants === 1 ? '' : 's'}, ${includes} include${includes === 1 ? '' : 's'}, ${excludes} exclude${excludes === 1 ? '' : 's'}`,
            binding: parent?.label ?? 'Root filter',
        };
    }

    if (node.kind === 'field') {
        const optionCount = countOptions(node.field.options);
        const owners = index.nodeFilterIds(node.id).map((id) => index.getFilter(id)?.label ?? id);
        return {
            kind: 'field',
            id: node.id,
            raw: node.field,
            summary: `${node.field.type} field${optionCount ? `, ${optionCount} option${optionCount === 1 ? '' : 's'}` : ''}${owners.length ? `, ${owners.length} owner filter${owners.length === 1 ? '' : 's'}` : ''}`,
            binding: owners.length ? owners.join(', ') : 'Unbound field',
        };
    }

    if (node.kind === 'option') {
        return {
            kind: 'option',
            id: node.id,
            raw: node.option,
            field: node.field,
            summary: `Option for ${node.field.label}`,
            binding: node.field.label,
        };
    }

    return { kind: 'none' };
}
