// SPDX-License-Identifier: GPL-3.0-only
import { WORKSPACE_BOOT_SECTIONS, type WorkspaceBootSection, type WorkspaceState } from '@elqora/dgp-workspace';
import { describe, expect, it, vi } from 'vitest';
import { createCanonicalBootModel, getCanonicalBootActionReason, getCanonicalBootHeadline } from './boot';

function sectionMap(status: WorkspaceState['boot_sections'][WorkspaceBootSection]) {
    return Object.fromEntries(WORKSPACE_BOOT_SECTIONS.map((section) => [section, status])) as WorkspaceState['boot_sections'];
}

describe('canonical boot presentation', () => {
    it('derives readiness and progress from canonical workspace sections', () => {
        const refresh = vi.fn();
        const retry = vi.fn();
        const boot = createCanonicalBootModel(
            { status: 'ready', boot_sections: sectionMap('success'), boot_errors: {}, boot_partial_failure: false },
            { refresh, retry_boot_section: retry },
        );
        expect(boot.completed_sections).toBe(WORKSPACE_BOOT_SECTIONS.length);
        expect(boot.succeeded_sections).toBe(WORKSPACE_BOOT_SECTIONS.length);
        expect(getCanonicalBootHeadline(boot)).toBe('Ready');
        expect(getCanonicalBootActionReason(boot)).toBeUndefined();
    });

    it('preserves canonical section errors and delegates focused retry', async () => {
        const sections = sectionMap('success');
        sections.services = 'error';
        const error = { code: 'services.failed', message: 'Services unavailable', retryable: true, meta: {} };
        const retry = vi.fn().mockResolvedValue({ ok: true, value: undefined });
        const boot = createCanonicalBootModel(
            { status: 'error', boot_sections: sections, boot_errors: { services: error }, boot_partial_failure: false },
            { refresh: vi.fn(), retry_boot_section: retry },
        );
        expect(boot.sections.services.error).toBe(error);
        expect(boot.failed_sections).toBe(1);
        await boot.retry_section('services');
        expect(retry).toHaveBeenCalledWith('services');
    });
});
