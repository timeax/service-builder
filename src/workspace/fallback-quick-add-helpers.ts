import { getEligibleFallbacks as coreGetEligibleFallbacks } from '@timeax/digital-service-engine/core';
import type { DgpServiceMap, FallbackSettings, ServiceFallback, ServiceIdRef, ServiceProps } from '@timeax/digital-service-engine/schema';

export type FallbackQuickAddLaunch =
    | {
          source: 'node';
          primaryServiceId: ServiceIdRef;
          nodeId: string;
          tagId?: string;
      }
    | {
          source: 'active-service';
          primaryServiceId: ServiceIdRef;
      };

export function getEligibleFallbacks(params: Parameters<typeof coreGetEligibleFallbacks>[0]) {
    return coreGetEligibleFallbacks(params);
}

export function getBoundFallbackIds(launch: FallbackQuickAddLaunch, fallbacks?: ServiceFallback) {
    if (launch.source === 'node') {
        return fallbacks?.nodes?.[launch.nodeId] ?? [];
    }

    return fallbacks?.global?.[String(launch.primaryServiceId)] ?? [];
}

export function buildEligibleFallbackCandidates(args: {
    launch: FallbackQuickAddLaunch;
    services: DgpServiceMap;
    fallbacks?: ServiceFallback;
    settings?: FallbackSettings;
    props: ServiceProps;
}) {
    const excludeIds = dedupeServiceIds([
        args.launch.primaryServiceId,
        ...getBoundFallbackIds(args.launch, args.fallbacks),
        ...collectActiveServiceIds(args.props),
    ]);

    const eligible = getEligibleFallbacks({
        primary: args.launch.primaryServiceId,
        nodeId: args.launch.source === 'node' ? args.launch.nodeId : undefined,
        tagId: args.launch.source === 'node' ? args.launch.tagId : undefined,
        services: args.services,
        fallbacks: args.fallbacks,
        settings: args.settings,
        props: args.props,
        exclude: excludeIds,
        unique: true,
    });

    return dedupeServiceIds(eligible).filter((id) => !excludeIds.some((excluded) => String(excluded) === String(id)));
}

export function mergeFallbackSelections(args: {
    launch: FallbackQuickAddLaunch;
    fallbacks?: ServiceFallback;
    selectedIds: ServiceIdRef[];
}) {
    const nextFallbacks = cloneFallbacks(args.fallbacks);
    const existing = getBoundFallbackIds(args.launch, nextFallbacks);
    const merged = mergeServiceIds(existing, args.selectedIds);

    if (args.launch.source === 'node') {
        nextFallbacks.nodes = { ...(nextFallbacks.nodes ?? {}), [args.launch.nodeId]: merged };
    } else {
        nextFallbacks.global = { ...(nextFallbacks.global ?? {}), [String(args.launch.primaryServiceId)]: merged };
    }

    return nextFallbacks;
}

export function collectActiveServiceIds(props?: ServiceProps | null) {
    const seen = new Set<string>();
    const activeIds: ServiceIdRef[] = [];

    const append = (value: ServiceIdRef | null | undefined) => {
        if (value === undefined || value === null) return;
        const key = String(value);
        if (seen.has(key)) return;
        seen.add(key);
        activeIds.push(value);
    };

    for (const tag of props?.filters ?? []) {
        append(tag.service_id);
    }

    for (const field of props?.fields ?? []) {
        append(field.service_id);
        for (const option of field.options ?? []) {
            append(option.service_id);
        }
    }

    return activeIds;
}

function cloneFallbacks(fallbacks?: ServiceFallback): ServiceFallback {
    return {
        global: fallbacks?.global ? { ...fallbacks.global } : undefined,
        nodes: fallbacks?.nodes ? { ...fallbacks.nodes } : undefined,
    };
}

function mergeServiceIds(existing: ServiceIdRef[], added: ServiceIdRef[]) {
    return dedupeServiceIds([...existing, ...added]);
}

function dedupeServiceIds(ids: ServiceIdRef[]) {
    const seen = new Set<string>();
    const merged: ServiceIdRef[] = [];

    for (const id of ids) {
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(id);
    }

    return merged;
}
