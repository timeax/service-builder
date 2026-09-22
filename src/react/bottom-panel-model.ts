// SPDX-License-Identifier: GPL-3.0-only
import { createProductIndex, matchingServicesForFilter, walkFieldOptions } from '@elqora/dgp-core';
import type { HandlerService, ProductDefinition, ServiceId } from '@elqora/dgp-spec';

export interface CanonicalServiceSummary {
    id: ServiceId;
    name: string;
    category?: string;
    rate?: number;
    min: number;
    max: number;
    platformId?: string;
    enabledCapabilityIds: string[];
    attachmentCount: number;
    attachedNodeIds: string[];
    attachedNodeLabels: string[];
    active: boolean;
    matchesSelectedFilter: boolean | null;
}

export function buildCanonicalServiceSummaries(
    definition: ProductDefinition | null,
    services: readonly HandlerService[],
    selectedIds: readonly string[],
    contextFilterId?: string | null,
) {
    const usage = new Map<string, { ids: string[]; labels: string[]; active: boolean }>();
    const selected = new Set(selectedIds);
    const selectedFilterId =
        contextFilterId === undefined ? definition?.filters.find((filter) => selected.has(filter.id))?.id : (contextFilterId ?? undefined);
    const matchingIds =
        definition && selectedFilterId
            ? new Set(matchingServicesForFilter(createProductIndex(definition), selectedFilterId, services).map((service) => String(service.id)))
            : null;
    const attach = (serviceId: ServiceId | undefined, id: string, label: string) => {
        if (serviceId === undefined) return;
        const key = String(serviceId);
        const current = usage.get(key) ?? { ids: [], labels: [], active: false };
        current.ids.push(id);
        current.labels.push(label);
        current.active ||= selected.has(id);
        usage.set(key, current);
    };
    if (definition) {
        for (const filter of definition.filters) attach(filter.service_id, filter.id, filter.label);
        for (const field of definition.fields) {
            if (field.button === true) attach(field.service_id, field.id, field.label);
            for (const visit of walkFieldOptions(field)) attach(visit.option.service_id, visit.option.id, `${field.label} / ${visit.option.label}`);
        }
    }
    const allServices: CanonicalServiceSummary[] = services
        .map((service) => {
            const attached = usage.get(String(service.id));
            return {
                id: service.id,
                name: service.name,
                category: service.category ?? undefined,
                rate: service.rate ?? undefined,
                min: service.min,
                max: service.max,
                platformId: typeof service.meta.platform_id === 'string' ? service.meta.platform_id : undefined,
                enabledCapabilityIds: Object.values(service.capabilities)
                    .filter((capability) => capability.enabled)
                    .map((capability) => capability.id),
                attachmentCount: attached?.ids.length ?? 0,
                attachedNodeIds: attached?.ids ?? [],
                attachedNodeLabels: attached?.labels ?? [],
                active: attached?.active ?? false,
                matchesSelectedFilter: matchingIds ? matchingIds.has(String(service.id)) : null,
            };
        })
        .sort(
            (left, right) =>
                Number(right.active) - Number(left.active) || right.attachmentCount - left.attachmentCount || left.name.localeCompare(right.name),
        );
    return {
        activeServices: allServices.filter((service) => service.attachmentCount > 0),
        compatibleServices: matchingIds ? allServices.filter((service) => service.matchesSelectedFilter) : allServices,
        allServices,
    };
}
