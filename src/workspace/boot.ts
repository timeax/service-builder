import type { WorkspaceBootSection, WorkspaceBootSectionState, WorkspaceBootState } from '@timeax/digital-service-engine/workspace';

export const WORKSPACE_BOOT_SECTIONS: WorkspaceBootSection[] = [
    'authors',
    'permissions',
    'branches',
    'services',
    'participants',
    'templates',
    'snapshotPointers',
    'snapshotBody',
    'policies',
    'comments',
];

export const BLOCKING_BOOT_SECTIONS = new Set<WorkspaceBootSection>([
    'authors',
    'permissions',
    'branches',
    'services',
    'participants',
    'templates',
    'snapshotPointers',
    'snapshotBody',
    'policies',
]);

export const BOOT_SECTION_LABELS: Record<WorkspaceBootSection, string> = {
    authors: 'Authors',
    permissions: 'Permissions',
    branches: 'Branches',
    services: 'Services',
    participants: 'Participants',
    templates: 'Templates',
    snapshotPointers: 'Snapshot pointers',
    snapshotBody: 'Current snapshot',
    policies: 'Policies',
    comments: 'Comments',
};

export function isBlockingBootSection(section: WorkspaceBootSection) {
    return BLOCKING_BOOT_SECTIONS.has(section);
}

export function getBootSectionTone(sectionState: WorkspaceBootSectionState) {
    switch (sectionState.status) {
        case 'success':
            return 'success';
        case 'error':
            return 'danger';
        case 'loading':
            return 'warning';
        default:
            return 'default';
    }
}

export function getWorkspaceBootHeadline(boot: WorkspaceBootState) {
    if (boot.isReady && boot.hasPartialFailure) return 'Workspace loaded with issues';
    if (boot.isReady) return 'Ready';
    if (boot.hasErrors && !boot.isBooting) return 'Workspace load needs attention';
    if (boot.isSeededView) return 'Syncing live workspace data';
    return 'Loading workspace';
}

export function getWorkspaceBootDescription(boot: WorkspaceBootState) {
    if (boot.isReady && boot.hasPartialFailure) {
        return 'Core workspace data is ready, but some non-blocking sections still need attention.';
    }
    if (boot.isReady) {
        return 'All required workspace sections finished loading and the editor is live-confirmed.';
    }
    if (boot.hasErrors && !boot.isBooting) {
        return 'Some required workspace sections failed to load. Review the failed sections and retry them.';
    }
    if (boot.isSeededView) {
        return 'Seeded data is visible while the provider confirms the live workspace in the background.';
    }
    return 'The workspace provider is booting live data section by section.';
}

export function getBootActionReason(boot: WorkspaceBootState) {
    if (boot.isReady) return undefined;
    if (boot.isSeededView) return 'Live workspace data is still syncing.';
    if (boot.hasErrors) return 'Resolve workspace boot errors before continuing.';
    return 'Workspace boot is still in progress.';
}

export function getBootProgressValue(boot: WorkspaceBootState) {
    if (!boot.totalSections) return 0;
    return Math.round((boot.completedSections / boot.totalSections) * 100);
}

export function getFailedBlockingSections(boot: WorkspaceBootState) {
    return WORKSPACE_BOOT_SECTIONS.filter((section) => isBlockingBootSection(section) && boot.sections[section].status === 'error');
}

export function getActiveBootSections(boot: WorkspaceBootState) {
    return WORKSPACE_BOOT_SECTIONS.filter((section) => boot.sections[section].status === 'loading');
}
