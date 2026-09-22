// SPDX-License-Identifier: GPL-3.0-only
import { ProductBuilder, type ProductBuilderOptions } from '@elqora/dgp-core';
import type { ProductDefinition } from '@elqora/dgp-spec';
import {
    CanvasAPI,
    WorkspaceRuntime,
    type CanvasState,
    type WorkspaceAction,
    type WorkspaceActor,
    type WorkspaceBackend,
    type WorkspaceRuntimeOptions,
    type WorkspaceState,
} from '@elqora/dgp-workspace';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const WorkspaceRuntimeContext = createContext<WorkspaceRuntime | null>(null);
const CanvasContext = createContext<CanvasAPI | null>(null);

export interface ServiceBuilderProviderProps {
    backend: WorkspaceBackend;
    actor: WorkspaceActor;
    options?: Omit<WorkspaceRuntimeOptions, 'actor'>;
    children: ReactNode;
}

export function ServiceBuilderProvider({ backend, actor, options, children }: ServiceBuilderProviderProps) {
    const optionsKey = JSON.stringify(options ?? {});
    /* eslint-disable react-hooks/exhaustive-deps -- serialized keys prevent runtime replacement for equivalent option objects. */
    const runtime = useMemo(() => new WorkspaceRuntime(backend, { ...options, actor }), [actor.id, backend, optionsKey]);
    /* eslint-enable react-hooks/exhaustive-deps */

    useEffect(() => {
        void runtime.boot();
        return () => runtime.dispose();
    }, [runtime]);

    return <WorkspaceRuntimeContext.Provider value={runtime}>{children}</WorkspaceRuntimeContext.Provider>;
}

export function useWorkspaceRuntime(): WorkspaceRuntime {
    const runtime = useContext(WorkspaceRuntimeContext);
    if (runtime === null) throw new Error('Service Builder hooks require ServiceBuilderProvider.');
    return runtime;
}

export function useWorkspaceSelector<Selected>(
    selector: (state: Readonly<WorkspaceState>) => Selected,
    isEqual: (left: Selected, right: Selected) => boolean = Object.is,
): Selected {
    const runtime = useWorkspaceRuntime();
    const selectorRef = useRef(selector);
    const equalityRef = useRef(isEqual);
    selectorRef.current = selector;
    equalityRef.current = isEqual;
    const [selected, setSelected] = useState(() => selector(runtime.state));

    useEffect(() => {
        setSelected(selectorRef.current(runtime.state));
        return runtime.subscribe((state) => {
            const next = selectorRef.current(state);
            setSelected((current) => (equalityRef.current(current, next) ? current : next));
        });
    }, [runtime]);

    return selected;
}

export function useCanvasAPI(): CanvasAPI | undefined {
    const supplied = useContext(CanvasContext);
    const runtime = useContext(WorkspaceRuntimeContext);
    const [, refresh] = useState(0);
    useEffect(() => runtime?.subscribe(() => refresh((value) => value + 1)), [runtime]);
    return supplied ?? runtime?.canvas;
}

export function useRequiredCanvasAPI(): CanvasAPI {
    const canvas = useCanvasAPI();
    if (canvas === undefined) throw new Error('The canvas is unavailable before branch hydration completes.');
    return canvas;
}

export function useCanvasSelector<Selected>(
    selector: (state: CanvasState) => Selected,
    fallback: Selected,
    isEqual: (left: Selected, right: Selected) => boolean = Object.is,
): Selected {
    const canvas = useCanvasAPI();
    const selectorRef = useRef(selector);
    const equalityRef = useRef(isEqual);
    const fallbackRef = useRef(fallback);
    selectorRef.current = selector;
    equalityRef.current = isEqual;
    fallbackRef.current = fallback;
    const [selected, setSelected] = useState<Selected>(() => (canvas === undefined ? fallback : selector(canvas.snapshot())));

    useEffect(() => {
        if (canvas === undefined) {
            setSelected(fallbackRef.current);
            return undefined;
        }
        setSelected(selectorRef.current(canvas.snapshot()));
        return canvas.on('state:change', (state) => {
            const next = selectorRef.current(state);
            setSelected((current) => (equalityRef.current(current, next) ? current : next));
        });
    }, [canvas]);

    return selected;
}

export interface CanvasProviderProps {
    api?: CanvasAPI;
    children: ReactNode;
}

export function CanvasProvider({ api, children }: CanvasProviderProps) {
    const workspace = useContext(WorkspaceRuntimeContext);
    const resolved = api ?? workspace?.canvas;
    if (resolved === undefined) throw new Error('CanvasProvider requires an api or a ready ServiceBuilderProvider.');
    return <CanvasContext.Provider value={resolved}>{children}</CanvasContext.Provider>;
}

export interface UseCanvasOwnedOptions {
    builder?: ProductBuilderOptions;
    canvas?: ConstructorParameters<typeof CanvasAPI>[1];
}

export function useCanvasOwned(initial: ProductDefinition, options: UseCanvasOwnedOptions = {}) {
    const builderOptionsKey = JSON.stringify(options.builder ?? {});
    const canvasOptionsKey = JSON.stringify(options.canvas ?? {});
    /* eslint-disable react-hooks/exhaustive-deps -- definitions are replaced below; serialized option keys preserve owned instances. */
    const builder = useMemo(() => new ProductBuilder(initial, options.builder), [builderOptionsKey]);
    const api = useMemo(() => new CanvasAPI(builder, options.canvas), [builder, canvasOptionsKey]);
    /* eslint-enable react-hooks/exhaustive-deps */
    useEffect(() => {
        builder.replace(initial);
        api.refresh_graph();
    }, [api, builder, initial]);
    useEffect(() => () => api.dispose(), [api]);
    return { api, builder };
}

export function useCanvas(): CanvasState {
    const api = useRequiredCanvasAPI();
    const [state, setState] = useState(() => api.snapshot());
    useEffect(() => {
        setState(api.snapshot());
        return api.on('state:change', setState);
    }, [api]);
    return state;
}

export function useWorkspacePermission(action: WorkspaceAction): boolean {
    return useWorkspaceSelector((state) => state.permissions[action] === true);
}
