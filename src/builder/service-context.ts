import type { BuilderServiceSummary } from '@/builder/bottom-panel.ts';
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

export type ServiceListRowVM = {
    id: string;
    summary: BuilderServiceSummary;
    service: DgpServiceCapability | null;
    check?: ServiceCheck;
    passesCurrentFilter: boolean;
    statusTone: 'success' | 'warning' | 'danger' | 'default';
    statusLabel: string;
    reasonLabels: string[];
    searchText: string;
};

export function createDefaultServiceContext(props?: ServiceProps | null, preferredTagId?: string | null): ServiceContextState {
    const tagIds = (props?.filters ?? []).map((tag) => tag.id);
    return {
        selectedTagId: preferredTagId && tagIds.includes(preferredTagId) ? preferredTagId : tagIds[0] ?? null,
        selectedButtons: [],
        strictSafety: true,
        enforcePolicies: true,
    };
}

export function sanitizeServiceContext(
    snapshot: ServiceContextSnapshot,
    state: ServiceContextState,
): ServiceContextState {
    const allowed = new Set(snapshot.buttonGroups.flatMap((group) => group.options.map((option) => option.id)));
    const selectedButtons = state.selectedButtons.filter((id) => allowed.has(id));
    if (selectedButtons.length === state.selectedButtons.length) return state;
    return { ...state, selectedButtons };
}

export function buildServiceContextSnapshot(args: {
    props?: ServiceProps | null;
    services?: Record<string, DgpServiceCapability> | null;
    state: ServiceContextState;
}): ServiceContextSnapshot {
    const props = args.props ?? undefined;
    const serviceMap = (args.services ?? {}) as Record<string, DgpServiceCapability>;
    const tags = (props?.filters ?? []).map((tag) => ({
        id: tag.id,
        label: tag.label,
        description: describeTag(tag),
    }));

    const selectedTag = (props?.filters ?? []).find((tag) => tag.id === args.state.selectedTagId) ?? null;
    if (!props || !selectedTag) {
        return {
            state: args.state,
            tags,
            selectedTag,
            buttonGroups: [],
            visibleFieldIds: [],
            usedServiceIds: [],
        };
    }

    const sandbox = createBuilder({ serviceMap });
    sandbox.load(props);

    const visibleFieldIds = sandbox.visibleFields(selectedTag.id, args.state.selectedButtons);
    const buttonGroups = buildButtonGroups(props.fields ?? [], visibleFieldIds);
    const usedServiceIds = collectUsedServiceIds({
        props,
        tagId: selectedTag.id,
        visibleFieldIds,
        selectedButtons: args.state.selectedButtons,
    });

    return {
        state: args.state,
        tags,
        selectedTag,
        buttonGroups,
        visibleFieldIds,
        usedServiceIds,
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
    const passesCurrentFilter = matchesSearch && (!check || servicePassesCurrentFilter(check, args.state));
    const status = describeCheck(check, args.state);

    return {
        id: String(args.summary.id),
        summary: args.summary,
        service,
        check,
        passesCurrentFilter,
        statusTone: status.tone,
        statusLabel: status.label,
        reasonLabels: status.reasons,
        searchText,
    };
}

function buildButtonGroups(fields: readonly Field[], visibleFieldIds: readonly string[]): ServiceContextButtonGroup[] {
    const visibleSet = new Set(visibleFieldIds);
    return fields
        .filter((field) => visibleSet.has(field.id))
        .map((field) => {
            const options = field.options?.length
                ? field.options
                      .filter((option) => option.id)
                      .map((option) => ({
                          id: String(option.id),
                          label: option.label,
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
    selectedButtons: readonly string[];
}): string[] {
    const visibleSet = new Set(args.visibleFieldIds);
    const used = new Set<string>();
    const tag = args.props.filters?.find((item) => item.id === args.tagId);
    if (tag?.service_id != null) used.add(String(tag.service_id));

    for (const field of args.props.fields ?? []) {
        if (!visibleSet.has(field.id)) continue;
        if ((field as { service_id?: number | string }).service_id != null) {
            used.add(String((field as { service_id?: number | string }).service_id));
        }
        for (const option of field.options ?? []) {
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

function servicePassesCurrentFilter(check: Pick<ServiceCheck, 'fitsConstraints' | 'passesRate' | 'passesPolicies'>, state?: Pick<ServiceContextState, 'strictSafety' | 'enforcePolicies'>) {
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
