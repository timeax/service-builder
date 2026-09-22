// SPDX-License-Identifier: GPL-3.0-only
import type { HandlerService, ProductDefinition } from '@elqora/dgp-spec';
import type { WorkspaceRuntime } from '@elqora/dgp-workspace';
import type { ReactNode } from 'react';

export interface ServiceBuilderPlayPayload {
    definition: ProductDefinition;
    services: readonly HandlerService[];
    workspace_id: string;
    branch_id?: string;
}

export interface ServiceBuilderCallbacks {
    onShare?: (definition: ProductDefinition) => void | Promise<void>;
    onPlay?: (payload: ServiceBuilderPlayPayload) => void | Promise<void>;
}

export interface ServiceBuilderMenuItem {
    name: string;
    icon?: ReactNode;
    children?: ServiceBuilderMenuItem[];
    command?: (workspace: WorkspaceRuntime) => void | Promise<void>;
    render?: () => ReactNode;
}
