// SPDX-License-Identifier: GPL-3.0-only
import type { WorkspaceActor, WorkspaceBackend, WorkspaceRuntimeOptions } from '@elqora/dgp-workspace';
import { CanonicalWorkspaceBootStatusSurface } from './canonical-boot-status';
import { CanonicalBottomConsolePanel, useCanonicalBottomPanel } from './canonical-bottom-panel';
import { CanonicalCanvasSurface } from './canonical-canvas-surface';
import { CanonicalLeftPanel } from './canonical-left-panel';
import { CanonicalRightPanel } from './canonical-right-panel';
import { CanonicalNodeContextMenuProvider, useCanonicalNodeContextMenu } from './canonical-node-context-menu';
import { CanonicalFallbackProvider, type CanonicalFallbackPolicy } from './canonical-fallbacks';
import type { ServiceBuilderCallbacks, ServiceBuilderMenuItem } from './contracts';
import { ServiceBuilderProvider } from './workspace';

const TREE_STYLES = `
:root { --tree-line-color: #d1d5db; --tree-line-width: 1px; --tree-line-style: solid; --elbow-v-h: 100%; }
.tree-row { display: flex; align-items: center; gap: 0.5rem; }
.tree-rail { display: flex; position: relative; }
.tree-col { position: relative; }
.tree-col[data-show="1"]::before { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; transform: translateX(-50%); border-left: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color); }
.tree-elbow { position: relative; display: flex; justify-content: center; align-items: center; }
.tree-elbow::before { content: ""; position: absolute; left: 50%; transform: translateX(-50%); top: 0; height: var(--elbow-v-h, 100%); border-left: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color); }
.tree-elbow::after { content: ""; position: absolute; top: 50%; left: 50%; transform: translateY(-50%); width: 50%; border-top: var(--tree-line-width) var(--tree-line-style) var(--tree-line-color); }
.tree-row-clip { background-clip: content-box; }
`;

export interface CanonicalServiceBuilderProps extends ServiceBuilderCallbacks {
    backend: WorkspaceBackend;
    actor: WorkspaceActor;
    options?: Omit<WorkspaceRuntimeOptions, 'actor'>;
    menu?: ServiceBuilderMenuItem[];
    fallbackPolicy?: CanonicalFallbackPolicy;
    onFallbackPolicyChange?: (policy: CanonicalFallbackPolicy) => void | Promise<void>;
}

function CanonicalWorkspaceLayout({ menu, onShare, onPlay, fallbackPolicy, onFallbackPolicyChange }: Pick<CanonicalServiceBuilderProps, 'menu' | 'onShare' | 'onPlay' | 'fallbackPolicy' | 'onFallbackPolicyChange'>) {
    const bottomPanel = useCanonicalBottomPanel();
    return <CanonicalFallbackProvider policy={fallbackPolicy} onPolicyChange={onFallbackPolicyChange}><CanonicalNodeContextMenuProvider><CanonicalWorkspaceLayoutReady menu={menu} onShare={onShare} onPlay={onPlay} bottomPanel={bottomPanel} /></CanonicalNodeContextMenuProvider></CanonicalFallbackProvider>;
}

function CanonicalWorkspaceLayoutReady({ menu, onShare, onPlay, bottomPanel }: Pick<CanonicalServiceBuilderProps, 'menu' | 'onShare' | 'onPlay'> & { bottomPanel: ReturnType<typeof useCanonicalBottomPanel> }) {
    const contextMenu = useCanonicalNodeContextMenu();
    return <div className="relative flex h-screen flex-col overflow-hidden *:font-display"><div className="pointer-events-none absolute top-4 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4"><div className="pointer-events-auto"><CanonicalWorkspaceBootStatusSurface /></div></div><div className="flex grow overflow-hidden"><CanonicalLeftPanel menu={menu} /><div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.08),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(19,91,236,0.12),transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]"><CanonicalCanvasSurface bottom_panel={bottomPanel} on_node_drop={contextMenu.open_drop_dial} on_node_context_menu={({ node_id, node_kind, client_x, client_y, event }) => { event.preventDefault(); if (node_kind !== 'comment') contextMenu.open_node_menu({ node_id, node_kind, client_x, client_y }); }} /></div><CanonicalRightPanel onShare={onShare} onPlay={onPlay} /></div><div className="pointer-events-none absolute inset-0 z-5"><CanonicalBottomConsolePanel controller={bottomPanel} /></div></div>;
}

export function CanonicalServiceBuilder({ backend, actor, options, menu, onShare, onPlay, fallbackPolicy, onFallbackPolicyChange }: CanonicalServiceBuilderProps) {
    return <><style>{TREE_STYLES}</style><ServiceBuilderProvider backend={backend} actor={actor} options={options}><CanonicalWorkspaceLayout menu={menu} onShare={onShare} onPlay={onPlay} fallbackPolicy={fallbackPolicy} onFallbackPolicyChange={onFallbackPolicyChange} /></ServiceBuilderProvider></>;
}
