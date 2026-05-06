type RateContextInput =
    | { mode: 'context' }
    | {
          mode: 'custom_primary_rate';
          source: 'service' | 'manual';
          primaryRate?: number;
          primaryServiceId?: string;
      };

type CompatibilityArgs = {
    tagId: string;
    selectedButtons: string[];
    usedServiceIds: string[];
    effectiveConstraints?: unknown;
    policies: readonly unknown[];
    rateContext: RateContextInput;
};

type RunCompatibilityChecksInput<TCheck> = {
    editor: {
        filterServicesForVisibleGroup?: (candidateIds: Array<string | number>, args: CompatibilityArgs) => TCheck[] | undefined;
    };
    candidateIds: Array<string | number>;
    args: CompatibilityArgs;
    cache: Map<string, TCheck>;
    cacheKey: string;
    shouldAbort?: () => boolean;
    chunkSize?: number;
};

const DEFAULT_CHUNK_SIZE = 100;

function yieldToMainThread(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), 0);
    });
}

export async function runCompatibilityChecksIncremental<TCheck extends { id?: string | number }>(
    input: RunCompatibilityChecksInput<TCheck>,
): Promise<TCheck[]> {
    const { editor, args, cache, cacheKey } = input;
    const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const candidateKeys = input.candidateIds.map((id) => String(id));
    const checksById = new Map<string, TCheck>();
    const missingIds: Array<string | number> = [];

    for (let index = 0; index < input.candidateIds.length; index += 1) {
        const candidateId = input.candidateIds[index];
        const candidateKey = candidateKeys[index];
        const entryKey = `${cacheKey}|${candidateKey}`;
        const cached = cache.get(entryKey);
        if (cached) {
            checksById.set(candidateKey, cached);
            continue;
        }
        missingIds.push(candidateId);
    }

    if (!missingIds.length) {
        return candidateKeys.map((id) => checksById.get(id)).filter(Boolean) as TCheck[];
    }

    for (let start = 0; start < missingIds.length; start += chunkSize) {
        if (input.shouldAbort?.()) return [];
        await yieldToMainThread();
        if (input.shouldAbort?.()) return [];

        const chunk = missingIds.slice(start, start + chunkSize);
        const checks = editor.filterServicesForVisibleGroup?.(chunk, args) ?? [];
        for (const check of checks) {
            const id = check?.id != null ? String(check.id) : null;
            if (!id) continue;
            checksById.set(id, check);
            cache.set(`${cacheKey}|${id}`, check);
        }
    }

    return candidateKeys.map((id) => checksById.get(id)).filter(Boolean) as TCheck[];
}

export function createCompatibilityCacheKey(input: {
    tagId: string;
    selectedButtons: string[];
    usedServiceIds: string[];
    policiesKey: string;
    rateContextMode: 'context' | 'custom_primary_rate';
    rateContextSource: 'service' | 'manual';
    primaryRate?: number | null;
    primaryServiceId?: string | null;
}) {
    const selectedButtons = [...input.selectedButtons].sort().join(',');
    const usedServiceIds = [...input.usedServiceIds].sort().join(',');
    const primaryRate = input.primaryRate != null ? String(input.primaryRate) : '';
    const primaryServiceId = input.primaryServiceId ?? '';
    return [
        `tag:${input.tagId}`,
        `buttons:${selectedButtons}`,
        `used:${usedServiceIds}`,
        `policies:${input.policiesKey}`,
        `mode:${input.rateContextMode}`,
        `source:${input.rateContextSource}`,
        `rate:${primaryRate}`,
        `service:${primaryServiceId}`,
    ].join('|');
}

export function areServiceContextStatesEqual(
    left: { selectedTagId: string | null; selectedButtons: string[]; strictSafety: boolean; enforcePolicies: boolean },
    right: { selectedTagId: string | null; selectedButtons: string[]; strictSafety: boolean; enforcePolicies: boolean },
) {
    if (left.selectedTagId !== right.selectedTagId) return false;
    if (left.strictSafety !== right.strictSafety) return false;
    if (left.enforcePolicies !== right.enforcePolicies) return false;
    if (left.selectedButtons.length !== right.selectedButtons.length) return false;
    const leftSet = new Set(left.selectedButtons);
    for (const id of right.selectedButtons) {
        if (!leftSet.has(id)) return false;
    }
    return true;
}
