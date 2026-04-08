import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { NativeFallbackEditor } from '@/workspace/fallback-editor/native-fallback-editor.tsx';
import type { DgpServiceMap, FallbackSettings, ServiceIdRef, ServiceProps } from '@timeax/digital-service-engine/schema';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import cloneDeep from 'lodash/cloneDeep';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

type FallbackEditorLaunchSource = 'node' | 'active-service';

type FallbackEditorNodeLaunch = {
    source: 'node';
    initialServiceId: ServiceIdRef;
    nodeId: string;
    nodeKind: 'tag' | 'field' | 'option';
    nodeLabel: string;
};

type FallbackEditorServiceLaunch = {
    source: 'active-service';
    initialServiceId: ServiceIdRef;
    serviceName?: string;
};

type FallbackEditorLaunch = FallbackEditorNodeLaunch | FallbackEditorServiceLaunch;

type FallbackEditorModalContextValue = {
    openForNode: (input: {
        nodeId: string;
        nodeKind: 'tag' | 'field' | 'option';
        nodeLabel?: string;
        serviceId: ServiceIdRef;
    }) => void;
    openForService: (input: { serviceId: ServiceIdRef; serviceName?: string }) => void;
    close: () => void;
    isOpen: boolean;
};

const noop = () => {};

const defaultContextValue: FallbackEditorModalContextValue = {
    openForNode: noop,
    openForService: noop,
    close: noop,
    isOpen: false,
};

const FallbackEditorModalContext = createContext<FallbackEditorModalContextValue>(defaultContextValue);

export function FallbackEditorModalProvider({ children }: { children: ReactNode }) {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const [launch, setLaunch] = useState<FallbackEditorLaunch | null>(null);
    const [sessionId, setSessionId] = useState(0);
    const [surfaceError, setSurfaceError] = useState<string | null>(null);

    const close = useCallback(() => {
        setLaunch(null);
        setSurfaceError(null);
    }, []);

    const openForNode = useCallback((input: { nodeId: string; nodeKind: 'tag' | 'field' | 'option'; nodeLabel?: string; serviceId: ServiceIdRef }) => {
        setSurfaceError(null);
        setSessionId((current) => current + 1);
        setLaunch({
            source: 'node',
            initialServiceId: input.serviceId,
            nodeId: input.nodeId,
            nodeKind: input.nodeKind,
            nodeLabel: input.nodeLabel ?? input.nodeId,
        });
    }, []);

    const openForService = useCallback((input: { serviceId: ServiceIdRef; serviceName?: string }) => {
        setSurfaceError(null);
        setSessionId((current) => current + 1);
        setLaunch({
            source: 'active-service',
            initialServiceId: input.serviceId,
            serviceName: input.serviceName,
        });
    }, []);

    const persistProps = useCallback(
        (label: string, mutate: (nextProps: ServiceProps) => void) => {
            const editorAny = canvas.api.editor as unknown as {
                transact?: (name: string, work: () => void) => void;
                replaceProps?: (next: ServiceProps) => void;
            };

            if (typeof editorAny.transact !== 'function' || typeof editorAny.replaceProps !== 'function') {
                throw new Error('Fallback editor persistence is unavailable on this editor instance');
            }

            editorAny.transact(label, () => {
                const nextProps = cloneDeep((canvas.api.builder.getProps() ?? canvas.props) as ServiceProps);
                mutate(nextProps);
                editorAny.replaceProps?.(nextProps);
            });
        },
        [canvas.api.builder, canvas.api.editor, canvas.props],
    );

    const handleSave = useCallback(
        async (nextFallbacks: ServiceProps['fallbacks']) => {
            setSurfaceError(null);
            try {
                persistProps('Update fallbacks', (nextProps) => {
                    nextProps.fallbacks = nextFallbacks;
                });
                close();
                return nextFallbacks;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to persist fallbacks';
                setSurfaceError(message);
                throw error;
            }
        },
        [close, persistProps],
    );

    const handleSettingsChange = useCallback(
        async (nextSettings: FallbackSettings) => {
            setSurfaceError(null);
            try {
                persistProps('Update fallback settings', (nextProps) => {
                    (nextProps as ServiceProps & { fallbackSettings?: FallbackSettings }).fallbackSettings = nextSettings;
                });
                return nextSettings;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to persist fallback settings';
                setSurfaceError(message);
                throw error;
            }
        },
        [persistProps],
    );

    const launchTitle = useMemo(() => {
        if (!launch) return 'Fallback editor';
        if (launch.source === 'node') {
            return launch.nodeLabel ? `Fallback editor for ${launch.nodeLabel}` : 'Fallback editor';
        }
        return launch.serviceName ? `Fallback editor for ${launch.serviceName}` : `Fallback editor for service #${String(launch.initialServiceId)}`;
    }, [launch]);

    const launchDescription = useMemo(() => {
        if (!launch) return '';
        if (launch.source === 'node') {
            return `Browse and edit fallback registrations for service #${String(launch.initialServiceId)}. Node-scoped and global registrations remain available inside the editor.`;
        }
        return `Browse and edit all fallback registrations for service #${String(launch.initialServiceId)} from Active Services.`;
    }, [launch]);

    const servicesMap = useMemo(() => (ws.services.data ?? {}) as DgpServiceMap, [ws.services.data]);
    const fallbackSettings = useMemo(
        () => ((canvas.props as ServiceProps & { fallbackSettings?: FallbackSettings })?.fallbackSettings ?? {}) as FallbackSettings,
        [canvas.props],
    );

    useEffect(() => {
        if (!launch) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [close, launch]);

    const value = useMemo<FallbackEditorModalContextValue>(
        () => ({
            openForNode,
            openForService,
            close,
            isOpen: launch != null,
        }),
        [close, launch, openForNode, openForService],
    );

    return (
        <FallbackEditorModalContext.Provider value={value}>
            {children}
            {typeof document !== "undefined" && launch
                ? createPortal(
                      <div
                          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                          onMouseDown={(event) => {
                              if (event.target === event.currentTarget) close();
                          }}
                      >
                          <div
                              className={cn(
                                  'flex h-[min(90vh,56rem)] w-[min(96vw,88rem)] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950',
                              )}
                          >
                              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                                  <div className="min-w-0">
                                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{launchTitle}</h2>
                                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{launchDescription}</p>
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={close} className="h-9 rounded-md px-2">
                                      <FiX />
                                  </Button>
                              </div>

                              {surfaceError ? (
                                  <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
                                      {surfaceError}
                                  </div>
                              ) : null}

                              <div className="min-h-0 flex-1 overflow-hidden">
                                  <NativeFallbackEditor
                                      key={`${launch.source}:${String(launch.initialServiceId)}:${sessionId}`}
                                      className="h-full p-5"
                                      fallbacks={(canvas.props as ServiceProps).fallbacks}
                                      props={canvas.props as ServiceProps}
                                      primaryServices={servicesMap}
                                      eligibleServices={servicesMap}
                                      settings={fallbackSettings}
                                      initialServiceId={launch.initialServiceId}
                                      onSettingsChange={handleSettingsChange}
                                      onSave={handleSave}
                                  />
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </FallbackEditorModalContext.Provider>
    );
}

export function useFallbackEditorModal() {
    return useContext(FallbackEditorModalContext);
}
