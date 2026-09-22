// SPDX-License-Identifier: GPL-3.0-only
import { walkOptions, type ProductGraphNode, type ProductGraphSnapshot } from '@elqora/dgp-core';
import type { FieldOption, ProductDefinition, ProductField, ProductFilter } from '@elqora/dgp-spec';
import type { CanvasAPI, CanvasState, Editor } from '@elqora/dgp-workspace';
import { useMemo } from 'react';
import { useCanvasAPI, useCanvasSelector, useWorkspaceSelector } from './workspace';

export interface PresentationTreeNode<T> {
    id: string;
    title: string;
    data: T;
    children: PresentationTreeNode<T>[];
}

export interface CanonicalSelection {
    ids: readonly string[];
    filter_ids: readonly string[];
    field_ids: readonly string[];
    option_ids: readonly string[];
    service_ids: readonly string[];
    primary_id?: string;
}

export interface CanonicalLayers {
    filters: PresentationTreeNode<ProductFilter>[];
    fields: PresentationTreeNode<ProductField | FieldOption>[];
}

export interface ServiceBuilderCanvasModel {
    api?: CanvasAPI;
    editor?: Editor;
    definition: ProductDefinition | null;
    graph: ProductGraphSnapshot;
    selection: CanonicalSelection;
    active_id?: string;
    context_filter_id?: string;
    layers: CanonicalLayers;
}

const EMPTY_GRAPH: ProductGraphSnapshot = { nodes: [], edges: [] };
const EMPTY_SELECTION: readonly string[] = [];

function groupByParent<T extends { id: string }>(values: readonly T[], parentOf: (value: T) => string | undefined): Map<string | undefined, T[]> {
    const grouped = new Map<string | undefined, T[]>();
    for (const value of values) {
        const parent = parentOf(value);
        const siblings = grouped.get(parent) ?? [];
        siblings.push(value);
        grouped.set(parent, siblings);
    }
    return grouped;
}

export function buildFilterLayers(definition: ProductDefinition): PresentationTreeNode<ProductFilter>[] {
    const byParent = groupByParent(definition.filters, (filter) => filter.bind_id);
    const filterIds = new Set(definition.filters.map((filter) => filter.id));
    const roots = definition.filters.filter((filter) => filter.bind_id === undefined || !filterIds.has(filter.bind_id));
    const visited = new Set<string>();

    const visit = (filter: ProductFilter): PresentationTreeNode<ProductFilter> => {
        if (visited.has(filter.id)) return { id: filter.id, title: filter.label, data: filter, children: [] };
        visited.add(filter.id);
        return {
            id: filter.id,
            title: filter.label,
            data: filter,
            children: (byParent.get(filter.id) ?? []).filter((child) => !visited.has(child.id)).map(visit),
        };
    };

    const tree = roots.map(visit);
    for (const filter of definition.filters) {
        if (!visited.has(filter.id)) tree.push(visit(filter));
    }
    return tree;
}

function optionLayer(option: FieldOption): PresentationTreeNode<FieldOption> {
    return {
        id: option.id,
        title: option.label,
        data: option,
        children: (option.children ?? []).map(optionLayer),
    };
}

export function buildFieldLayers(definition: ProductDefinition): PresentationTreeNode<ProductField | FieldOption>[] {
    return definition.fields.map((field) => ({
        id: field.id,
        title: field.label,
        data: field,
        children: (field.options ?? []).map(optionLayer),
    }));
}

function fieldsForCanvasContext(definition: ProductDefinition, api?: CanvasAPI): ProductField[] {
    const visible = api?.selection.visible_group();
    if (visible?.kind === 'single') return visible.group.fields;
    return definition.fields;
}

export function deriveCanonicalSelection(graph: ProductGraphSnapshot, ids: readonly string[], primaryId?: string): CanonicalSelection {
    const selected = new Set(ids);
    const selectedByKind = (kind: ProductGraphNode['kind']) =>
        graph.nodes.filter((node) => selected.has(node.id) && node.kind === kind).map((node) => node.id);
    return {
        ids,
        filter_ids: selectedByKind('filter'),
        field_ids: selectedByKind('field'),
        option_ids: selectedByKind('option'),
        service_ids: selectedByKind('service'),
        primary_id: primaryId !== undefined && selected.has(primaryId) ? primaryId : ids.at(-1),
    };
}

export function findCanonicalOption(definition: ProductDefinition, optionId: string): FieldOption | undefined {
    return walkOptions(definition).find((visit) => visit.optionId === optionId)?.option;
}

export function createServiceBuilderCanvasModel(
    definition: ProductDefinition | null,
    state: Pick<CanvasState, 'graph' | 'selection'> | null,
    api?: CanvasAPI,
): ServiceBuilderCanvasModel {
    const graph = state?.graph ?? EMPTY_GRAPH;
    const ids = state === null ? EMPTY_SELECTION : [...state.selection];
    const primaryId = api?.selection.primary();
    const contextFilterId = api?.selection.current_filter();
    const contextFields = definition === null ? [] : fieldsForCanvasContext(definition, api);
    return {
        api,
        editor: api?.editor,
        definition,
        graph,
        selection: deriveCanonicalSelection(graph, ids, primaryId),
        active_id: primaryId ?? ids.at(-1),
        context_filter_id: contextFilterId,
        layers:
            definition === null
                ? { filters: [], fields: [] }
                : {
                      filters: buildFilterLayers(definition),
                      fields: buildFieldLayers({ ...definition, fields: contextFields }),
                  },
    };
}

export function useServiceBuilderCanvasModel(): ServiceBuilderCanvasModel {
    const api = useCanvasAPI();
    const definition = useWorkspaceSelector((state) => state.definition);
    const graph = useCanvasSelector((state) => state.graph, EMPTY_GRAPH);
    const selection = useCanvasSelector((state) => [...state.selection], EMPTY_SELECTION);
    const version = useCanvasSelector((state) => state.version, 0);

    return useMemo(
        () => createServiceBuilderCanvasModel(definition, { graph, selection: new Set(selection) }, api),
        // version is the CanvasAPI event revision and intentionally invalidates stable graph references.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [api, definition, graph, selection, version],
    );
}
