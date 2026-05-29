//@ts-nocheck
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceBootStatusCard, WorkspaceBootStatusSurface } from './boot-status.tsx';

function makeBoot(overrides: Partial<any> = {}) {
    const retryAll = vi.fn(async () => ({ ok: true }));
    const retrySection = vi.fn(async () => ({ ok: true, value: undefined }));
    const sections = {
        authors: { status: 'success' },
        permissions: { status: 'success' },
        branches: { status: 'success' },
        services: { status: 'success' },
        participants: { status: 'success' },
        templates: { status: 'success' },
        snapshotPointers: { status: 'success' },
        snapshotBody: { status: 'success' },
        policies: { status: 'success' },
        comments: { status: 'success' },
        ...(overrides.sections ?? {}),
    };

    return {
        sections,
        isBooting: false,
        isReady: true,
        hasErrors: false,
        hasPartialFailure: false,
        isSeededView: false,
        isLiveConfirmed: true,
        completedSections: 10,
        succeededSections: 10,
        failedSections: 0,
        totalSections: 10,
        errorsBySection: {},
        retryAll,
        retrySection,
        ...overrides,
    };
}

describe('WorkspaceBootStatusCard', () => {
    it('renders booting state with seeded view messaging', () => {
        render(
            <WorkspaceBootStatusCard
                boot={makeBoot({
                    isBooting: true,
                    isReady: false,
                    isSeededView: true,
                    isLiveConfirmed: false,
                    completedSections: 3,
                    succeededSections: 1,
                    failedSections: 0,
                    sections: {
                        authors: { status: 'loading' },
                        permissions: { status: 'loading' },
                        snapshotBody: { status: 'loading' },
                        comments: { status: 'idle' },
                    },
                })}
            />,
        );

        expect(screen.getByText('Syncing live workspace data')).toBeInTheDocument();
        expect(screen.getByText(/Seeded data is visible while the provider confirms the live workspace/i)).toBeInTheDocument();
    });

    it('renders fully ready state', () => {
        render(<WorkspaceBootStatusCard boot={makeBoot()} />);

        expect(screen.getByText('Ready')).toBeInTheDocument();
        expect(screen.getByText(/All required workspace sections finished loading/i)).toBeInTheDocument();
    });

    it('renders partial failure while remaining ready for optional section errors', () => {
        render(
            <WorkspaceBootStatusCard
                boot={makeBoot({
                    hasErrors: true,
                    hasPartialFailure: true,
                    failedSections: 1,
                    succeededSections: 9,
                    errorsBySection: {
                        comments: { code: 'comment_failure', message: 'Comment refresh failed.' },
                    },
                    sections: {
                        comments: { status: 'error', error: { code: 'comment_failure', message: 'Comment refresh failed.' } },
                    },
                })}
            />,
        );

        expect(screen.getByText('Workspace loaded with issues')).toBeInTheDocument();
        expect(screen.getByText('Comment refresh failed.')).toBeInTheDocument();
    });

    it('renders blocking failure when required sections fail', () => {
        render(
            <WorkspaceBootStatusCard
                boot={makeBoot({
                    isReady: false,
                    hasErrors: true,
                    failedSections: 1,
                    succeededSections: 8,
                    errorsBySection: {
                        policies: { code: 'policy_failure', message: 'Policy refresh failed.' },
                    },
                    sections: {
                        policies: { status: 'error', error: { code: 'policy_failure', message: 'Policy refresh failed.' } },
                    },
                })}
            />,
        );

        expect(screen.getByText('Workspace load needs attention')).toBeInTheDocument();
        expect(screen.getByText('Policy refresh failed.')).toBeInTheDocument();
    });

    it('retries all sections and individual sections', async () => {
        const boot = makeBoot({
            hasErrors: true,
            hasPartialFailure: true,
            failedSections: 1,
            succeededSections: 9,
            errorsBySection: {
                comments: { code: 'comment_failure', message: 'Comment refresh failed.' },
            },
            sections: {
                comments: { status: 'error', error: { code: 'comment_failure', message: 'Comment refresh failed.' } },
            },
        });

        render(<WorkspaceBootStatusCard boot={boot as any} />);

        fireEvent.click(screen.getByRole('button', { name: /retry all/i }));
        fireEvent.click(screen.getByRole('button', { name: /retry comments/i }));

        await waitFor(() => {
            expect(boot.retryAll).toHaveBeenCalledTimes(1);
            expect(boot.retrySection).toHaveBeenCalledWith('comments');
        });
    });

    it('lets completed boot status be dismissed from the centralized surface', () => {
        render(<WorkspaceBootStatusSurface boot={makeBoot()} />);

        fireEvent.click(screen.getByRole('button', { name: /dismiss workspace boot status/i }));

        expect(screen.queryByText('Workspace ready')).not.toBeInTheDocument();
    });
});
