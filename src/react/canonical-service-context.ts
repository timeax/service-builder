// SPDX-License-Identifier: GPL-3.0-only
import { createProductInterpreter, walkFieldOptions } from '@elqora/dgp-core';
import type { HandlerService, ProductDefinition, ServiceId } from '@elqora/dgp-spec';

export interface CanonicalCanvasServiceContext {
    selectedTagLabel: string;
    selectedButtonsCount: number;
    services: Array<{ id: string; name: string; rateLabel: string; statusLabel: string; reasonLabels: string[] }>;
}

export function buildCanonicalCanvasServiceContext(
    definition: ProductDefinition | null,
    services: readonly HandlerService[],
    filterId: string | undefined,
    selectedTriggerIds: readonly string[],
): CanonicalCanvasServiceContext {
    const empty: CanonicalCanvasServiceContext = { selectedTagLabel: 'No tag selected', selectedButtonsCount: selectedTriggerIds.length, services: [] };
    if (!definition || !filterId) return empty;
    const interpreter = createProductInterpreter(definition);
    const context = interpreter.resolveContext(filterId, selectedTriggerIds);
    if (!context) return empty;
    const usedIds = new Set<string>();
    const add = (id: ServiceId | undefined) => {
        if (id !== undefined) usedIds.add(String(id));
    };
    add(context.filter.filter.service_id);
    const visibleFields = new Set(context.visibility.fieldIds);
    for (const field of definition.fields) {
        if (!visibleFields.has(field.id)) continue;
        if (field.button === true) add(field.service_id);
        const allowedOptions = context.visibility.optionsByFieldId[field.id];
        const allowed = allowedOptions === undefined ? null : new Set(allowedOptions);
        for (const { option } of walkFieldOptions(field)) {
            if (allowed === null || allowed.has(option.id)) add(option.service_id);
        }
    }
    const matching = new Set(interpreter.matchingServicesForFilter(filterId, services).map((service) => String(service.id)));
    const byId = new Map(services.map((service) => [String(service.id), service]));
    return {
        selectedTagLabel: context.filter.filter.label,
        selectedButtonsCount: selectedTriggerIds.length,
        services: [...usedIds].flatMap((id) => {
            const service = byId.get(id);
            if (!service) return [];
            const available = service.state === 'enabled';
            return [{
                id,
                name: service.name,
                rateLabel: service.rate === null ? 'Rate n/a' : `Rate ${service.rate}`,
                statusLabel: !available ? 'Unavailable' : matching.has(id) ? 'Meets filter capabilities' : 'Capability mismatch',
                reasonLabels: !available && service.state_reason ? [service.state_reason] : [],
            }];
        }),
    };
}
