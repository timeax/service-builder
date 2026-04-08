import React from 'react';

type TabKey = 'registrations' | 'settings';

function cloneFallbacks(source?: any) {
    return {
        global: Object.fromEntries(
            Object.entries(source?.global ?? {}).map(([key, value]) => [key, Array.isArray(value) ? [...value] : []]),
        ),
        nodes: Object.fromEntries(
            Object.entries(source?.nodes ?? {}).map(([key, value]) => [key, Array.isArray(value) ? [...value] : []]),
        ),
    };
}

function resolvePrimaryServiceId(props: any, snapshot: any, nodeId: string) {
    const tag = props?.filters?.find((entry: any) => entry.id === nodeId);
    if (tag?.service_id != null) return tag.service_id;

    const field = props?.fields?.find((entry: any) => entry.id === nodeId);
    if (field?.service_id != null) return field.service_id;

    for (const fieldItem of props?.fields ?? []) {
        const option = fieldItem.options?.find((entry: any) => entry.id === nodeId);
        if (option?.service_id != null) return option.service_id;
    }

    const snapshotPrimary = snapshot?.serviceMap?.[nodeId]?.[0];
    return snapshotPrimary;
}

export function createFallbackEditorReactMock() {
    const Context = React.createContext<any>(null);

    function useContextValue() {
        const context = React.useContext(Context);
        if (!context) {
            throw new Error('Fallback editor hooks must be used inside the mock provider');
        }
        return context;
    }

    function FallbackEditorProvider({
        children,
        fallbacks,
        props,
        snapshot,
        primaryServices,
        eligibleServices,
        settings: initialSettings,
        initialServiceId,
        initialTab = 'registrations',
        onSettingsChange,
        onSave,
        onValidate,
        onReset,
    }: any) {
        const originalFallbacks = React.useMemo(() => cloneFallbacks(fallbacks), [fallbacks]);
        const [currentFallbacks, setCurrentFallbacks] = React.useState(() => cloneFallbacks(fallbacks));
        const [settings, setSettings] = React.useState(initialSettings ?? {});
        const [activeServiceId, setActiveServiceId] = React.useState(initialServiceId);
        const [activeTab, setActiveTab] = React.useState<TabKey>(initialTab);
        const [settingsSaving, setSettingsSaving] = React.useState(false);
        const [headerSaving, setHeaderSaving] = React.useState(false);
        const [headerValidating, setHeaderValidating] = React.useState(false);
        const [headerResetting, setHeaderResetting] = React.useState(false);
        const [version, setVersion] = React.useState(0);

        React.useEffect(() => {
            setCurrentFallbacks(cloneFallbacks(fallbacks));
        }, [fallbacks]);

        React.useEffect(() => {
            setSettings(initialSettings ?? {});
        }, [initialSettings]);

        const primaryList = React.useMemo(() => Object.values(primaryServices ?? {}), [primaryServices]);
        const eligibleList = React.useMemo(() => Object.values(eligibleServices ?? {}), [eligibleServices]);

        const getRegistrations = React.useCallback(
            (serviceId: any) => {
                if (serviceId == null) return [];

                const registrations = [];
                const global = currentFallbacks.global?.[String(serviceId)];
                if (Array.isArray(global)) {
                    registrations.push({
                        scope: 'global',
                        primary: serviceId,
                        services: [...global],
                    });
                }

                for (const [nodeId, services] of Object.entries(currentFallbacks.nodes ?? {})) {
                    const primary = resolvePrimaryServiceId(props, snapshot, nodeId);
                    if (String(primary) !== String(serviceId)) continue;
                    registrations.push({
                        scope: 'node',
                        scopeId: nodeId,
                        primary,
                        services: Array.isArray(services) ? [...services] : [],
                    });
                }

                return registrations;
            },
            [currentFallbacks.global, currentFallbacks.nodes, props, snapshot],
        );

        const getScopedPrimary = React.useCallback(
            (context: any) => {
                return context.scope === 'global'
                    ? context.primary
                    : resolvePrimaryServiceId(props, snapshot, context.nodeId);
            },
            [props, snapshot],
        );

        const writeScope = React.useCallback((context: any, updater: (current: any[]) => any[]) => {
            setCurrentFallbacks((previous: any) => {
                const next = cloneFallbacks(previous);

                if (context.scope === 'global') {
                    next.global[String(context.primary)] = updater(next.global[String(context.primary)] ?? []);
                } else {
                    next.nodes[String(context.nodeId)] = updater(next.nodes[String(context.nodeId)] ?? []);
                }

                return next;
            });
            setVersion((current) => current + 1);
        }, []);

        const eligible = React.useCallback(
            (context: any) => {
                const primary = getScopedPrimary(context);
                return eligibleList.map((service: any) => service.id).filter((id: any) => String(id) !== String(primary));
            },
            [eligibleList, getScopedPrimary],
        );

        const check = React.useCallback(
            (context: any, candidates: any[]) => {
                const primary = getScopedPrimary(context);
                const allowedIds = new Set(eligible(context).map((id: any) => String(id)));
                const rejected = (candidates ?? [])
                    .filter((candidate) => String(candidate) === String(primary) || !allowedIds.has(String(candidate)))
                    .map((candidate) => ({
                        candidate,
                        ok: false,
                        reasons: String(candidate) === String(primary) ? ['self_reference'] : ['unknown_candidate'],
                    }));

                const allowed = (candidates ?? []).filter((candidate) => !rejected.some((entry) => String(entry.candidate) === String(candidate)));
                return {
                    context,
                    primary,
                    allowed,
                    rejected,
                    warnings: [],
                };
            },
            [eligible, getScopedPrimary],
        );

        const reset = React.useCallback(() => {
            setCurrentFallbacks(cloneFallbacks(originalFallbacks));
            setVersion((current) => current + 1);
        }, [originalFallbacks]);

        const addMany = React.useCallback(
            (context: any, candidates: any[]) => {
                writeScope(context, (current) => [...new Set([...current, ...candidates])]);
                return cloneFallbacks(currentFallbacks);
            },
            [currentFallbacks, writeScope],
        );

        const add = React.useCallback((context: any, candidate: any) => addMany(context, [candidate]), [addMany]);

        const remove = React.useCallback(
            (context: any, candidate: any) => {
                writeScope(context, (current) => current.filter((entry) => String(entry) !== String(candidate)));
                return cloneFallbacks(currentFallbacks);
            },
            [currentFallbacks, writeScope],
        );

        const clear = React.useCallback(
            (context: any) => {
                writeScope(context, () => []);
                return cloneFallbacks(currentFallbacks);
            },
            [currentFallbacks, writeScope],
        );

        const replace = React.useCallback(
            (context: any, candidates: any[]) => {
                writeScope(context, () => [...new Set(candidates)]);
                return cloneFallbacks(currentFallbacks);
            },
            [currentFallbacks, writeScope],
        );

        const saveSettings = React.useCallback(
            async (next: any) => {
                setSettingsSaving(true);
                try {
                    const resolved = onSettingsChange ? await onSettingsChange(next) : next;
                    const finalSettings = resolved ?? next;
                    setSettings(finalSettings);
                    return finalSettings;
                } finally {
                    setSettingsSaving(false);
                }
            },
            [onSettingsChange],
        );

        const saveFallbacks = React.useCallback(async () => {
            setHeaderSaving(true);
            try {
                let resolved;
                try {
                    resolved = onSave ? await onSave(currentFallbacks) : currentFallbacks;
                } catch {
                    return undefined;
                }
                if (resolved) {
                    setCurrentFallbacks(cloneFallbacks(resolved));
                    setVersion((current) => current + 1);
                }
                return resolved;
            } finally {
                setHeaderSaving(false);
            }
        }, [currentFallbacks, onSave]);

        const validateFallbacks = React.useCallback(async () => {
            setHeaderValidating(true);
            try {
                if (onValidate) await onValidate(currentFallbacks);
            } finally {
                setHeaderValidating(false);
            }
        }, [currentFallbacks, onValidate]);

        const resetEditor = React.useCallback(async () => {
            setHeaderResetting(true);
            try {
                reset();
                if (onReset) await onReset();
            } finally {
                setHeaderResetting(false);
            }
        }, [onReset, reset]);

        const contextValue = React.useMemo(
            () => ({
                editor: {},
                version,
                serviceProps: props,
                snapshot,
                primaryServices: primaryServices ?? {},
                eligibleServices: eligibleServices ?? {},
                activeServiceId,
                setActiveServiceId,
                activeTab,
                setActiveTab,
                state: {
                    original: originalFallbacks,
                    current: currentFallbacks,
                    changed: JSON.stringify(originalFallbacks) !== JSON.stringify(currentFallbacks),
                },
                value: currentFallbacks,
                settings,
                settingsSaving,
                headerSaving,
                headerValidating,
                headerResetting,
                saveSettings,
                saveFallbacks,
                validateFallbacks,
                resetEditor,
                reset,
                get: getRegistrations,
                getScope: () => undefined,
                check,
                eligible,
                add,
                addMany,
                remove,
                replace,
                clear,
            }),
            [
                activeServiceId,
                activeTab,
                add,
                addMany,
                check,
                clear,
                currentFallbacks,
                eligible,
                eligibleServices,
                getRegistrations,
                headerResetting,
                headerSaving,
                headerValidating,
                originalFallbacks,
                primaryServices,
                props,
                remove,
                replace,
                reset,
                resetEditor,
                saveFallbacks,
                saveSettings,
                settings,
                settingsSaving,
                snapshot,
                validateFallbacks,
                version,
            ],
        );

        return <Context.Provider value={contextValue}>{children}</Context.Provider>;
    }

    function useFallbackEditor() {
        return useContextValue();
    }

    function usePrimaryServiceList() {
        const context = useContextValue();
        return React.useMemo(() => Object.values(context.primaryServices ?? {}), [context.primaryServices, context.version]);
    }

    function useEligibleServiceList() {
        const context = useContextValue();
        return React.useMemo(() => Object.values(context.eligibleServices ?? {}), [context.eligibleServices, context.version]);
    }

    function useActiveFallbackRegistrations() {
        const context = useContextValue();
        return React.useMemo(() => context.get(context.activeServiceId), [context]);
    }

    return {
        FallbackEditorProvider,
        useFallbackEditor,
        usePrimaryServiceList,
        useEligibleServiceList,
        useActiveFallbackRegistrations,
    };
}
