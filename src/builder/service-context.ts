import type { BuilderServiceSummary } from '@/builder/bottom-panel.ts';
import { optionBreadcrumb, walkFieldOptions } from '@/builder/option-helpers.ts';
import { createBuilder } from '@timeax/digital-service-engine/core';
import type { DgpServiceCapability, Field, ServiceProps, Tag } from '@timeax/digital-service-engine/schema';

export type ServiceCheck = {
    id: number | string;
    ok: boolean;
    fitsConstraints: boolean;
    passesRate: boolean;
    passesPolicies: boolean;
    reasons: Array<'constraint_mismatch' | 'rate_policy' | 'policy_error' | 'missing_capability'>;
    policyErrors?: string[];
    policyWarnings?: string[];
};

export type ServiceContextState = {
    selectedTagId: string | null;
    selectedButtons: string[];
    strictSafety: boolean;
    enforcePolicies: boolean;
};

export type ServiceContextTagOption = {
    id: string;
    label: string;
    description?: string;
};

export type ServiceContextButtonOption = {
    id: string;
    label: string;
    description?: string;
    fieldId: string;
    fieldLabel: string;
};

export type ServiceContextButtonGroup = {
    id: string;
    label: string;
    options: ServiceContextButtonOption[];
};

export type ServiceContextSnapshot = {
    state: ServiceContextState;
    tags: ServiceContextTagOption[];
    selectedTag: Tag | null;
    buttonGroups: ServiceContextButtonGroup[];
    visibleFieldIds: string[];
    usedServiceIds: string[];
};

type OptionEffectForButton = {
    forceVisible?: boolean;
    include?: string[];
    exclude?: string[];
};

type ServicePropsWithOptionEffects = ServiceProps & {
    option_effects_for_buttons?: Record<string, Record<string, OptionEffectForButton>>;
};

export type ServiceListRowVM = {
    id: string;
    summary: BuilderServiceSummary;
    service: DgpServiceCapability | null;
    check?: ServiceCheck;
    matchesSearch: boolean;
    isCompatible: boolean;
    passesCurrentFilter: boolean;
    statusTone: 'success' | 'warning' | 'danger' | 'default';
    statusLabel: string;
    reasonLabels: string[];
    searchText: string;
};

export function createEmptyServiceContextSnapshot(state: ServiceContextState, props?: ServiceProps | null): ServiceContextSnapshot {
    const filters = props?.filters ?? [];
    const tags = filters.map((tag) => ({
        id: tag.id,
        label: tag.label,
        description: describeTag(tag),
    }));
    const selectedTag = filters.find((tag) => tag.id === state.selectedTagId) ?? null;

    return {
        state,
        tags,
        selectedTag,
        buttonGroups: [],
        visibleFieldIds: [],
        usedServiceIds: [],
    };
}

export function createDefaultServiceContext(props?: ServiceProps | null, preferredTagId?: string | null): ServiceContextState {
    const tagIds = (props?.filters ?? []).map((tag) => tag.id);
    return {
        selectedTagId: preferredTagId && tagIds.includes(preferredTagId) ? preferredTagId : (tagIds[0] ?? null),
        selectedButtons: [],
        strictSafety: true,
        enforcePolicies: true,
    };
}

export function sanitizeServiceContext(snapshot: ServiceContextSnapshot, state: ServiceContextState): ServiceContextState {
    const allowed = new Set(snapshot.buttonGroups.flatMap((group) => group.options.map((option) => option.id)));
    const selectedButtons = state.selectedButtons.filter((id) => allowed.has(id));
    if (selectedButtons.length === state.selectedButtons.length) return state;
    return { ...state, selectedButtons };
}

export async function buildServiceContextSnapshot(args: {
    props?: ServiceProps | null;
    services?: Record<string, DgpServiceCapability> | null;
    state: ServiceContextState;
}): Promise<ServiceContextSnapshot> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const props = args.props ?? undefined;
            const serviceMap = (args.services ?? {}) as Record<string, DgpServiceCapability>;
            const emptySnapshot = createEmptyServiceContextSnapshot(args.state, props);
            const { tags, selectedTag } = emptySnapshot;

            if (!props || !selectedTag) {
                resolve(emptySnapshot);
                return;
            }

            const sandbox = createBuilder({ serviceMap });
            sandbox.load(props);

            const visibility =
                typeof (sandbox as any).resolveVisibility === 'function'
                    ? (sandbox as any).resolveVisibility(selectedTag.id, args.state.selectedButtons)
                    : buildFallbackVisibility(props, sandbox.visibleFields(selectedTag.id, args.state.selectedButtons), args.state.selectedButtons);
            const visibleFieldIds = visibility.fieldIds;
            const buttonGroups = buildButtonGroups(props.fields ?? [], visibleFieldIds, visibility.optionsByFieldId);
            const usedServiceIds = collectUsedServiceIds({
                props,
                tagId: selectedTag.id,
                visibleFieldIds,
                visibleOptionsByFieldId: visibility.optionsByFieldId,
                selectedButtons: args.state.selectedButtons,
            });

            resolve({
                state: args.state,
                tags,
                selectedTag,
                buttonGroups,
                visibleFieldIds,
                usedServiceIds,
            });
        }, 0);
    });
}

function buildFallbackVisibility(props: ServiceProps, visibleFieldIds: readonly string[], selectedButtons: readonly string[]) {
    const fieldIds = new Set(visibleFieldIds.map(String));
    const includesByFieldId = new Map<string, Set<string>>();
    const excludesByFieldId = new Map<string, Set<string>>();
    const effectMap = (props as ServicePropsWithOptionEffects).option_effects_for_buttons ?? {};

    for (const triggerId of selectedButtons) {
        const targets = effectMap[String(triggerId)];
        if (!targets) continue;

        for (const [targetFieldId, effect] of Object.entries(targets)) {
            if (effect.forceVisible === true) fieldIds.add(targetFieldId);
            if (effect.include?.length) {
                const includes = includesByFieldId.get(targetFieldId) ?? new Set<string>();
                effect.include.forEach((id) => includes.add(String(id)));
                includesByFieldId.set(targetFieldId, includes);
            }
            if (effect.exclude?.length) {
                const excludes = excludesByFieldId.get(targetFieldId) ?? new Set<string>();
                effect.exclude.forEach((id) => excludes.add(String(id)));
                excludesByFieldId.set(targetFieldId, excludes);
            }
        }
    }

    const optionsByFieldId: Record<string, string[]> = {};
    for (const field of props.fields ?? []) {
        const include = includesByFieldId.get(field.id);
        const exclude = excludesByFieldId.get(field.id);
        if (!include && !exclude) continue;

        const allowed = include ? new Set(include) : new Set(walkFieldOptions(field).map((visit) => visit.option.id));
        for (const optionId of exclude ?? []) allowed.delete(optionId);
        optionsByFieldId[field.id] = Array.from(allowed);
    }

    return {
        fieldIds: Array.from(fieldIds),
        optionsByFieldId,
    };
}

export function buildServiceRowVM(args: {
    summary: BuilderServiceSummary;
    services?: Record<string, DgpServiceCapability> | null;
    check?: ServiceCheck;
    state?: ServiceContextState;
    search?: string;
}): ServiceListRowVM {
    const service = (args.services?.[args.summary.id as keyof typeof args.services] ?? null) as DgpServiceCapability | null;
    const check = args.check;
    const searchText = [args.summary.name, args.summary.category, args.summary.platformId, String(args.summary.id)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    const search = args.search?.trim().toLowerCase() ?? '';
    const matchesSearch = !search || searchText.includes(search);
    const isCompatible = !check || servicePassesCurrentFilter(check, args.state);
    const status = describeCheck(check, args.state);

    return {
        id: String(args.summary.id),
        summary: args.summary,
        service,
        check,
        matchesSearch,
        isCompatible,
        passesCurrentFilter: matchesSearch,
        statusTone: status.tone,
        statusLabel: status.label,
        reasonLabels: status.reasons,
        searchText,
    };
}

function buildButtonGroups(
    fields: readonly Field[],
    visibleFieldIds: readonly string[],
    visibleOptionsByFieldId: Record<string, string[]> = {},
): ServiceContextButtonGroup[] {
    const visibleSet = new Set(visibleFieldIds);
    return fields
        .filter((field) => visibleSet.has(field.id))
        .map((field) => {
            const optionAllowList = visibleOptionsByFieldId[field.id] ? new Set(visibleOptionsByFieldId[field.id]) : null;
            const optionVisits = walkFieldOptions(field).filter(
                (visit) => visit.option.id && (!optionAllowList || optionAllowList.has(visit.option.id)),
            );
            const options = optionVisits.length
                ? optionVisits.map(({ option }) => ({
                      id: String(option.id),
                      label: optionBreadcrumb(field, option.id),
                      description: `Option in ${field.label}`,
                      fieldId: field.id,
                      fieldLabel: field.label,
                  }))
                : field.button
                  ? [
                        {
                            id: field.id,
                            label: field.label,
                            description: 'Button field',
                            fieldId: field.id,
                            fieldLabel: field.label,
                        },
                    ]
                  : [];

            return {
                id: field.id,
                label: field.label,
                options,
            };
        })
        .filter((group) => group.options.length > 0);
}

function collectUsedServiceIds(args: {
    props: ServiceProps;
    tagId: string;
    visibleFieldIds: readonly string[];
    visibleOptionsByFieldId?: Record<string, string[]>;
    selectedButtons: readonly string[];
}): string[] {
    const visibleSet = new Set(args.visibleFieldIds);
    const used = new Set<string>();
    const tag = args.props.filters?.find((item) => item.id === args.tagId);
    if (tag?.service_id != null) used.add(String(tag.service_id));

    for (const field of args.props.fields ?? []) {
        if (!visibleSet.has(field.id)) continue;
        const optionAllowList = args.visibleOptionsByFieldId?.[field.id] ? new Set(args.visibleOptionsByFieldId[field.id]) : null;
        if ((field as { service_id?: number | string }).service_id != null) {
            used.add(String((field as { service_id?: number | string }).service_id));
        }
        for (const { option } of walkFieldOptions(field)) {
            if (optionAllowList && !optionAllowList.has(option.id)) continue;
            if ((option as { service_id?: number | string }).service_id != null) {
                used.add(String((option as { service_id?: number | string }).service_id));
            }
        }
    }

    return Array.from(used);
}

function describeTag(tag: Tag) {
    const constraints = Object.entries(tag.constraints ?? {})
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
    return constraints.length ? constraints.join(', ') : 'All visible services';
}

function servicePassesCurrentFilter(
    check: Pick<ServiceCheck, 'fitsConstraints' | 'passesRate' | 'passesPolicies'>,
    state?: Pick<ServiceContextState, 'strictSafety' | 'enforcePolicies'>,
) {
    const passesPolicies = state?.enforcePolicies === false ? true : check.passesPolicies;
    const safetyPass = check.fitsConstraints && check.passesRate && passesPolicies;
    return state?.strictSafety === false ? true : safetyPass;
}

function describeCheck(check?: ServiceCheck, state?: Pick<ServiceContextState, 'strictSafety' | 'enforcePolicies'>) {
    if (!check) {
        return {
            tone: 'default' as const,
            label: 'No context',
            reasons: [] as string[],
        };
    }

    const reasons = [
        !check.fitsConstraints ? 'Constraint mismatch' : null,
        !check.passesRate ? 'Rate policy mismatch' : null,
        state?.enforcePolicies !== false && !check.passesPolicies ? 'Policy blocked' : null,
        check.reasons.includes('missing_capability') ? 'Missing capability' : null,
    ].filter(Boolean) as string[];

    if (servicePassesCurrentFilter(check, state) && check.ok) {
        return { tone: 'success' as const, label: 'Safe fit', reasons };
    }
    if (servicePassesCurrentFilter(check, state)) {
        return { tone: 'warning' as const, label: state?.enforcePolicies === false ? 'Policy checks relaxed' : 'Usable', reasons };
    }
    if (reasons.length) {
        return { tone: 'danger' as const, label: 'Hidden by context', reasons };
    }
    return { tone: 'default' as const, label: 'Available', reasons };
}
