// SPDX-License-Identifier: GPL-3.0-only
import { createProductInterpreter, walkFieldOptions } from '@elqora/dgp-core';
import type { ProductDefinition, ServiceId } from '@elqora/dgp-spec';

export interface CatalogContextState {
    filterId: string | null;
    triggerIds: string[];
}

export interface CatalogContextSnapshot {
    filters: Array<{ id: string; label: string }>;
    filterLabel: string | null;
    buttonGroups: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>;
    usedServiceIds: string[];
}

export function buildCatalogContext(definition: ProductDefinition | null, state: CatalogContextState): CatalogContextSnapshot {
    const filters = definition?.filters.map(({ id, label }) => ({ id, label })) ?? [];
    const empty: CatalogContextSnapshot = { filters, filterLabel: null, buttonGroups: [], usedServiceIds: [] };
    if (!definition || !state.filterId) return empty;
    const context = createProductInterpreter(definition).resolveContext(state.filterId, state.triggerIds);
    if (!context) return empty;
    const visibleFields = new Set(context.visibility.fieldIds);
    const usedServices = new Set<string>();
    const addService = (id: ServiceId | undefined) => {
        if (id !== undefined) usedServices.add(String(id));
    };
    addService(context.filter.filter.service_id);
    const buttonGroups = definition.fields.flatMap((field) => {
        if (!visibleFields.has(field.id)) return [];
        if (field.button === true) addService(field.service_id);
        const allowedIds = context.visibility.optionsByFieldId[field.id];
        const allowed = allowedIds === undefined ? null : new Set(allowedIds);
        const options = walkFieldOptions(field)
            .filter(({ option }) => allowed === null || allowed.has(option.id))
            .map(({ option }) => {
                addService(option.service_id);
                return { id: option.id, label: option.label };
            });
        if (!options.length && field.button === true) options.push({ id: field.id, label: field.label });
        return options.length ? [{ id: field.id, label: field.label, options }] : [];
    });
    return { filters, filterLabel: context.filter.filter.label, buttonGroups, usedServiceIds: [...usedServices] };
}
