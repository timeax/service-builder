import {
    getAssignedServiceIds as coreGetAssignedServiceIds,
    getEligibleFallbacks as coreGetEligibleFallbacks,
} from '@timeax/digital-service-engine/core';
import type {
    DgpServiceMap,
    FallbackSettings,
    ServiceFallback,
    ServiceIdRef,
    ServiceProps,
} from '@timeax/digital-service-engine/schema';
import type { OrderSnapshot } from '@timeax/digital-service-engine/schema';

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

export function getAssignedServiceIds(params: Parameters<typeof coreGetAssignedServiceIds>[0]) {
    return coreGetAssignedServiceIds(params);
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
    snapshot?: OrderSnapshot;
}) {
    const excludeIds = dedupeServiceIds([
        ...getBoundFallbackIds(args.launch, args.fallbacks),
        ...getAssignedServiceIds({
            props: args.props,
            snapshot: args.snapshot,
        }),
    ]);

    const eligible = getEligibleFallbacks({
        primary: args.launch.primaryServiceId,
        nodeId: args.launch.source === 'node' ? args.launch.nodeId : undefined,
        tagId: args.launch.source === 'node' ? args.launch.tagId : undefined,
        services: args.services,
        fallbacks: args.fallbacks,
        settings: args.settings,
        props: args.props,
        source: 'all_services',
        exclude: excludeIds,
        unique: true,
    });

    return dedupeServiceIds(eligible);
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
    return getAssignedServiceIds({ props: props ?? undefined });
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
