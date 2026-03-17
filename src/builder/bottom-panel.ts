import { formatEstimate } from '@/builder/view-models.tsx';
import type { DgpServiceCapability, Field, ServiceProps, Tag } from '@timeax/digital-service-engine/schema';
import type { UseCanvasReturn, WorkspaceAPI } from '@timeax/digital-service-engine/workspace';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';

export type BottomPanelTab = 'console' | 'activeServices' | 'allServices';

export type BuilderServiceSummary = {
    id: number | string;
    name: string;
    category?: string;
    rate?: number;
    min?: number;
    max?: number;
    platformId?: string;
    estimate?: string | null;
    flags: string[];
    attachmentCount: number;
    attachedNodeIds: string[];
    attachedNodeLabels: string[];
    active: boolean;
};

export type BottomConsolePanelState = {
    isOpen: boolean;
    activeTab: BottomPanelTab;
    height: number;
    toggle: () => void;
    open: (tab?: BottomPanelTab) => void;
    close: () => void;
    setActiveTab: (tab: BottomPanelTab) => void;
    setHeight: (height: number) => void;
    shortcutLabel: string;
};

const PANEL_HEIGHT_KEY = 'service-builder.bottom-panel.height';
const DEFAULT_HEIGHT = 300;
const MIN_HEIGHT = 220;
const MAX_HEIGHT = 460;

export function buildServiceSummaries(canvas: UseCanvasReturn, ws: WorkspaceAPI): {
    activeServices: BuilderServiceSummary[];
    allServices: BuilderServiceSummary[];
} {
    const services = (ws.services.data ?? {}) as Record<string, DgpServiceCapability>;
    const serviceProps = canvas.api.getServiceProps();
    const nodeMap = buildServiceNodeMap(serviceProps);
    const usage = new Map<string, { labels: string[]; ids: string[]; active: boolean }>();
    const selected = new Set(canvas.selectionInfo.ids as string[]);
    if (canvas.activeId) selected.add(canvas.activeId);

    for (const node of nodeMap.values()) {
        if (node.serviceId == null) continue;
        const key = String(node.serviceId);
        const current = usage.get(key) ?? { labels: [], ids: [], active: false };
        current.labels.push(node.label);
        current.ids.push(node.id);
        current.active = current.active || selected.has(node.id);
        usage.set(key, current);
    }

    const allServices = Object.values(services)
        .map((service) => toServiceSummary(service, usage.get(String(service.id))))
        .sort(compareServices);

    return {
        activeServices: allServices.filter((service) => service.attachmentCount > 0),
        allServices,
    };
}

export function useBottomConsolePanel(): BottomConsolePanelState {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<BottomPanelTab>('console');
    const [height, setHeightState] = useState(() => readStoredHeight());

    const close = useEffectEvent(() => setIsOpen(false));
    const toggle = useEffectEvent(() => setIsOpen((current) => !current));
    const open = useEffectEvent((tab?: BottomPanelTab) => {
        if (tab) setActiveTab(tab);
        setIsOpen(true);
    });
    const setHeight = useEffectEvent((nextHeight: number) => {
        const clamped = clampHeight(nextHeight);
        setHeightState(clamped);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(PANEL_HEIGHT_KEY, String(clamped));
        }
    });

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isEditable =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                Boolean(target?.isContentEditable);

            const shortcutPressed = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'j';

            if (shortcutPressed && !isEditable) {
                event.preventDefault();
                toggle();
                return;
            }

            if (event.key === 'Escape' && isOpen) {
                event.preventDefault();
                close();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [close, isOpen, toggle]);

    return useMemo(
        () => ({
            isOpen,
            activeTab,
            height,
            toggle,
            open,
            close,
            setActiveTab,
            setHeight,
            shortcutLabel: 'Ctrl/Cmd + J',
        }),
        [activeTab, close, height, isOpen, open, setHeight, toggle],
    );
}

type ServiceNodeDescriptor = {
    id: string;
    kind: 'tag' | 'field' | 'option';
    label: string;
    serviceId?: number | string;
    parentFieldLabel?: string;
};

function toServiceSummary(service: DgpServiceCapability, usage?: { labels: string[]; ids: string[]; active: boolean }): BuilderServiceSummary {
    return {
        id: service.id,
        name: service.name,
        category: service.category,
        rate: service.rate,
        min: service.min,
        max: service.max,
        platformId: typeof service.platform_id === 'string' ? service.platform_id : undefined,
        estimate: formatEstimate(service),
        flags: Object.entries(service.flags ?? {})
            .filter(([, value]) => value?.enabled)
            .map(([key]) => key),
        attachmentCount: usage?.ids.length ?? 0,
        attachedNodeIds: usage?.ids ?? [],
        attachedNodeLabels: usage?.labels ?? [],
        active: usage?.active ?? false,
    };
}

function compareServices(a: BuilderServiceSummary, b: BuilderServiceSummary) {
    return Number(b.active) - Number(a.active) || b.attachmentCount - a.attachmentCount || a.name.localeCompare(b.name);
}

function buildServiceNodeMap(props?: ServiceProps | null) {
    const nodes = new Map<string, ServiceNodeDescriptor>();
    if (!props) return nodes;

    for (const tag of props.filters ?? []) {
        nodes.set(tag.id, toTagDescriptor(tag));
    }

    for (const field of props.fields ?? []) {
        nodes.set(field.id, toFieldDescriptor(field));
        for (const option of field.options ?? []) {
            nodes.set(option.id, {
                id: option.id,
                kind: 'option',
                label: option.label,
                serviceId: option.service_id,
                parentFieldLabel: field.label,
            });
        }
    }

    return nodes;
}

function toTagDescriptor(tag: Tag): ServiceNodeDescriptor {
    return {
        id: tag.id,
        kind: 'tag',
        label: tag.label,
        serviceId: tag.service_id,
    };
}

function toFieldDescriptor(field: Field): ServiceNodeDescriptor {
    return {
        id: field.id,
        kind: 'field',
        label: field.label,
        serviceId: field.button ? field.service_id : undefined,
    };
}

function clampHeight(height: number) {
    return Math.min(Math.max(Math.round(height), MIN_HEIGHT), MAX_HEIGHT);
}

function readStoredHeight() {
    if (typeof window === 'undefined') return DEFAULT_HEIGHT;
    const value = Number(window.localStorage.getItem(PANEL_HEIGHT_KEY));
    return Number.isFinite(value) ? clampHeight(value) : DEFAULT_HEIGHT;
}
