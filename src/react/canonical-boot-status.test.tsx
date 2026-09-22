// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen } from '@testing-library/react';
import {
    MemoryWorkspaceBackend,
    type WorkspaceActor,
} from '@elqora/dgp-workspace';
import { describe, expect, it } from 'vitest';
import { createSeedPersistence, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalWorkspaceBootStatusSurface } from './canonical-boot-status';
import { ServiceBuilderProvider } from './workspace';

class RecoveringCommentsBackend extends MemoryWorkspaceBackend {
    private loadCount = 0;

    override async load(actor: WorkspaceActor, preferredBranchId?: string) {
        const loaded = await super.load(actor, preferredBranchId);
        this.loadCount += 1;
        if (!loaded.ok || this.loadCount !== 1) return loaded;
        return {
            ok: true as const,
            value: {
                ...loaded.value,
                section_errors: {
                    comments: {
                        code: 'comments_temporarily_unavailable',
                        message: 'Comments could not be synchronized.',
                        retryable: true,
                        meta: {},
                    },
                },
            },
        };
    }
}

class RecoveringWorkspaceBackend extends MemoryWorkspaceBackend {
    private loadCount = 0;

    override async load(actor: WorkspaceActor, preferredBranchId?: string) {
        this.loadCount += 1;
        if (this.loadCount === 1) {
            return {
                ok: false as const,
                error: {
                    code: 'workspace_temporarily_unavailable',
                    message: 'Workspace data could not be loaded.',
                    retryable: true,
                    meta: {},
                },
            };
        }
        return super.load(actor, preferredBranchId);
    }
}

describe('canonical workspace boot status', () => {
    it('presents a partial comments failure and recovers through the focused retry control', async () => {
        render(
            <ServiceBuilderProvider backend={new RecoveringCommentsBackend({ ...workspaceSeed, persistence: createSeedPersistence() })} actor={workspaceActor}>
                <CanonicalWorkspaceBootStatusSurface />
            </ServiceBuilderProvider>,
        );

        expect(await screen.findByText('Workspace loaded with issues')).toBeInTheDocument();
        expect(screen.getByText('Comments could not be synchronized.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry Comments' }));
        expect(await screen.findByText('Ready')).toBeInTheDocument();
    });

    it('blocks on a full workspace load failure and recovers through Retry all', async () => {
        render(
            <ServiceBuilderProvider backend={new RecoveringWorkspaceBackend({ ...workspaceSeed, persistence: createSeedPersistence() })} actor={workspaceActor}>
                <CanonicalWorkspaceBootStatusSurface />
            </ServiceBuilderProvider>,
        );

        expect(await screen.findByText('Workspace load needs attention')).toBeInTheDocument();
        expect(screen.getByText('10 failed')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry all' }));
        expect(await screen.findByText('Ready')).toBeInTheDocument();
    });
});
