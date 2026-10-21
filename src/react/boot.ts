// SPDX-License-Identifier: GPL-3.0-only
import {
    WORKSPACE_BOOT_SECTIONS as workspaceBootSections,
    type BackendError,
    type WorkspaceBootSection,
    type WorkspaceBootSectionStatus,
    type WorkspaceRuntime,
    type WorkspaceState,
} from '@elqora/dgp-workspace';

export { WORKSPACE_BOOT_SECTIONS } from '@elqora/dgp-workspace';
export type CanonicalBootSection = WorkspaceBootSection;

export const BOOT_SECTION_LABELS: Record<WorkspaceBootSection, string> = {
    authors: 'Authors',
    permissions: 'Permissions',
    branches: 'Branches',
    services: 'Services',
    policies: 'Policies',
    branch: 'Current branch',
    templates: 'Templates',
    participants: 'Participants',
    comments: 'Comments',
    snapshot: 'Current snapshot',
};

export const BLOCKING_BOOT_SECTIONS = new Set<WorkspaceBootSection>([
    'authors',
    'permissions',
    'branches',
    'services',
    'policies',
    'branch',
    'templates',
    'participants',
    'snapshot',
]);

export interface CanonicalBootSectionState {
    status: WorkspaceBootSectionStatus;
    error?: BackendError;
}

export interface CanonicalBootModel {
    status: WorkspaceState['status'];
    sections: Record<WorkspaceBootSection, CanonicalBootSectionState>;
    is_ready: boolean;
    is_booting: boolean;
    has_errors: boolean;
    has_partial_failure: boolean;
    completed_sections: number;
    succeeded_sections: number;
    failed_sections: number;
    total_sections: number;
    retry_all(): Promise<unknown>;
    retry_section(section: WorkspaceBootSection): Promise<unknown>;
}

export function createCanonicalBootModel(
    state: Pick<WorkspaceState, 'status' | 'boot_sections' | 'boot_errors' | 'boot_partial_failure'>,
    runtime: Pick<WorkspaceRuntime, 'refresh' | 'retry_boot_section'>,
): CanonicalBootModel {
    const sections = Object.fromEntries(
        workspaceBootSections.map((section) => [
            section,
            { status: state.boot_sections[section], error: state.boot_errors[section] },
        ]),
    ) as Record<WorkspaceBootSection, CanonicalBootSectionState>;
    const values = Object.values(sections);
    return {
        status: state.status,
        sections,
        is_ready: state.status === 'ready',
        is_booting: state.status === 'booting' || state.status === 'idle',
        has_errors: values.some((section) => section.status === 'error'),
        has_partial_failure: state.boot_partial_failure,
        completed_sections: values.filter((section) => section.status === 'success' || section.status === 'error').length,
        succeeded_sections: values.filter((section) => section.status === 'success').length,
        failed_sections: values.filter((section) => section.status === 'error').length,
        total_sections: values.length,
        retry_all: () => runtime.refresh(),
        retry_section: (section) => runtime.retry_boot_section(section),
    };
}

export function getCanonicalBootHeadline(boot: CanonicalBootModel): string {
    if (boot.is_ready && boot.has_partial_failure) return 'Workspace loaded with issues';
    if (boot.is_ready) return 'Ready';
    if (boot.has_errors && !boot.is_booting) return 'Workspace load needs attention';
    return 'Loading workspace';
}

export function getCanonicalBootDescription(boot: CanonicalBootModel): string {
    if (boot.is_ready && boot.has_partial_failure) {
        return 'Core workspace data is ready, but some non-blocking sections still need attention.';
    }
    if (boot.is_ready) return 'All required workspace sections finished loading and the editor is ready.';
    if (boot.has_errors && !boot.is_booting) {
        return 'Some required workspace sections failed to load. Review the failed sections and retry them.';
    }
    return 'The workspace provider is loading canonical data section by section.';
}

export function getCanonicalBootProgress(boot: CanonicalBootModel): number {
    return boot.total_sections === 0 ? 0 : Math.round((boot.completed_sections / boot.total_sections) * 100);
}

export function getCanonicalBootActionReason(boot: CanonicalBootModel): string | undefined {
    if (boot.is_ready) return undefined;
    if (boot.has_errors) return 'Resolve workspace boot errors before continuing.';
    return 'Workspace boot is still in progress.';
}
