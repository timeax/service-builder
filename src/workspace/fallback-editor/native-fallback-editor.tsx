import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { cn } from '@/lib/utils.ts';
import { FallbackEditorProvider, useActiveFallbackRegistrations, useFallbackEditor, usePrimaryServiceList } from '@timeax/digital-service-engine/react';
import type { DgpServiceMap, FallbackSettings, OrderSnapshot, ServiceIdRef, ServiceProps } from '@timeax/digital-service-engine/schema';
import { useMemo } from 'react';
import { FallbackDetailsPanel } from './fallback-details-panel.tsx';
import { FallbackEditorHeader } from './fallback-editor-header.tsx';
import { FallbackRegistrationsPanel } from './fallback-registrations-panel.tsx';
import { FallbackServiceSidebar } from './fallback-service-sidebar.tsx';
import { FallbackSettingsPanel } from './fallback-settings-panel.tsx';
import { SectionCard } from './shared.tsx';

export type NativeFallbackEditorProps = {
    className?: string;
    fallbacks?: ServiceProps['fallbacks'];
    props?: ServiceProps;
    snapshot?: OrderSnapshot;
    primaryServices?: DgpServiceMap;
    eligibleServices?: DgpServiceMap;
    settings?: FallbackSettings;
    initialServiceId?: ServiceIdRef;
    initialTab?: 'registrations' | 'settings';
    onSettingsChange?: (next: FallbackSettings) => Promise<FallbackSettings> | FallbackSettings;
    onSave?: (next: ServiceProps['fallbacks']) => Promise<ServiceProps['fallbacks'] | void> | ServiceProps['fallbacks'] | void;
    onValidate?: (next: ServiceProps['fallbacks']) => Promise<void> | void;
    onReset?: () => Promise<void> | void;
};

export function NativeFallbackEditor({
    className,
    fallbacks,
    props,
    snapshot,
    primaryServices,
    eligibleServices,
    settings,
    initialServiceId,
    initialTab,
    onSettingsChange,
    onSave,
    onValidate,
    onReset,
}: NativeFallbackEditorProps) {
    return (
        <FallbackEditorProvider
            fallbacks={fallbacks}
            props={props}
            snapshot={snapshot}
            primaryServices={primaryServices}
            eligibleServices={eligibleServices}
            settings={settings}
            initialServiceId={initialServiceId}
            initialTab={initialTab}
            onSettingsChange={onSettingsChange}
            onSave={onSave}
            onValidate={onValidate}
            onReset={onReset}
        >
            <NativeFallbackEditorInner className={className} />
        </FallbackEditorProvider>
    );
}

function NativeFallbackEditorInner({ className }: { className?: string }) {
    const {
        activeTab,
        setActiveTab,
        activeServiceId,
        saveFallbacks,
        validateFallbacks,
        resetEditor,
        state,
        headerSaving,
        headerValidating,
        headerResetting,
    } = useFallbackEditor();

    const registrations = useActiveFallbackRegistrations();
    const services = usePrimaryServiceList();

    const activeServiceLabel = useMemo(() => {
        const service = services.find((entry) => String(entry.id) === String(activeServiceId));
        if (!service) return undefined;
        return `${service.name ?? 'Unnamed'} (#${String(service.id)})`;
    }, [activeServiceId, services]);

    return (
        <div className={cn('flex h-full min-h-0 flex-col gap-4 text-slate-900 dark:text-slate-100', className)}>
            <FallbackEditorHeader
                activeServiceLabel={activeServiceLabel}
                registrationCount={registrations.length}
                changed={state.changed}
                onReset={resetEditor}
                onValidate={validateFallbacks}
                onSave={saveFallbacks as () => Promise<void>}
                resetting={headerResetting}
                validating={headerValidating}
                saving={headerSaving}
            />

            <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1 gap-0 overflow-hidden" data-testid="fallback-editor-layout">
                <ResizablePanel defaultSize={300} minSize={300} maxSize={350} className="">
                    <div className="flex h-full min-h-0 min-w-70" data-testid="fallback-editor-sidebar-panel">
                        <FallbackServiceSidebar />
                    </div>
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel defaultSize={78} minSize={66} className="pl-4">
                    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" data-testid="fallback-editor-main-panel">
                        <Tabs
                            value={activeTab}
                            onValueChange={(value) => setActiveTab(value as 'registrations' | 'settings')}
                            className="min-h-0 gap-4 overflow-hidden"
                        >
                            <SectionCard className="shrink-0 px-5 py-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                            {activeServiceId != null ? `Service #${String(activeServiceId)}` : 'No service selected'}
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Edit fallback registrations, review validation hints, and persist policy updates.
                                        </p>
                                    </div>

                                    <TabsList>
                                        <TabsTrigger value="registrations">Registrations</TabsTrigger>
                                        <TabsTrigger value="settings">Settings</TabsTrigger>
                                    </TabsList>
                                </div>
                            </SectionCard>

                            <TabsContent value="registrations" className="min-h-0 overflow-hidden" data-testid="fallback-editor-registrations-tab">
                                <FallbackRegistrationsPanel />
                            </TabsContent>

                            <TabsContent value="settings" className="min-h-0 flex flex-col overflow-hidden" data-testid="fallback-editor-settings-tab">
                                <FallbackSettingsPanel />
                            </TabsContent>
                        </Tabs>

                        <div className="min-h-0 overflow-hidden flex flex-col" data-testid="fallback-editor-details-panel">
                            <FallbackDetailsPanel />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
