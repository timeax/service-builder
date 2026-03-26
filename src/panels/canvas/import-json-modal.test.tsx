import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportJsonModal } from './import-json-modal.tsx';

describe('ImportJsonModal', () => {
    const onClose = vi.fn();
    const onImportProps = vi.fn();
    const onImportCatalog = vi.fn();

    beforeEach(() => {
        onClose.mockReset();
        onImportProps.mockReset();
        onImportCatalog.mockReset();
    });

    it('parses pasted props JSON and applies it on confirm', async () => {
        render(
            <ImportJsonModal
                open
                target="props"
                onClose={onClose}
                onImportProps={onImportProps}
                onImportCatalog={onImportCatalog}
            />,
        );

        fireEvent.change(screen.getByLabelText('JSON payload'), {
            target: {
                value: JSON.stringify({
                    name: 'Imported service',
                    filters: [{ id: 'tag-1', label: 'Tag' }],
                    fields: [{ id: 'field-1', label: 'Field' }],
                    notices: [{ id: 'notice-1' }],
                    fallbacks: { global: { 10: [20] } },
                }),
            },
        });

        expect(await screen.findByText('Imported service')).toBeInTheDocument();
        expect(screen.getByText('Ready to import from pasted JSON.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Import props' }));

        await waitFor(() => {
            expect(onImportProps).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Imported service',
                    filters: expect.any(Array),
                    fields: expect.any(Array),
                }),
            );
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('loads props JSON from a file upload', async () => {
        render(
            <ImportJsonModal
                open
                target="props"
                onClose={onClose}
                onImportProps={onImportProps}
                onImportCatalog={onImportCatalog}
            />,
        );

        const file = new File(
            [
                JSON.stringify({
                    filters: [],
                    fields: [{ id: 'field-1' }],
                }),
            ],
            'props.json',
            { type: 'application/json' },
        );

        fireEvent.change(screen.getByLabelText('Load JSON file'), {
            target: { files: [file] },
        });

        expect(await screen.findByText('Source: File upload')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Import props' }));

        await waitFor(() => {
            expect(onImportProps).toHaveBeenCalledWith(
                expect.objectContaining({
                    fields: expect.any(Array),
                }),
            );
        });
    });

    it('shows a parse error for invalid JSON and stays disabled', async () => {
        render(
            <ImportJsonModal
                open
                target="props"
                onClose={onClose}
                onImportProps={onImportProps}
                onImportCatalog={onImportCatalog}
            />,
        );

        fireEvent.change(screen.getByLabelText('JSON payload'), {
            target: { value: '{"filters": [' },
        });

        expect(await screen.findByText('Validation error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Import props' })).toBeDisabled();
        expect(onImportProps).not.toHaveBeenCalled();
    });

    it('shows a shape validation error when props JSON is missing required arrays', async () => {
        render(
            <ImportJsonModal
                open
                target="props"
                onClose={onClose}
                onImportProps={onImportProps}
                onImportCatalog={onImportCatalog}
            />,
        );

        fireEvent.change(screen.getByLabelText('JSON payload'), {
            target: { value: JSON.stringify({ filters: [] }) },
        });

        expect(await screen.findByText('JSON must match ServiceProps and include both "filters" and "fields" arrays.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Import props' })).toBeDisabled();
    });

    it('parses catalog JSON and imports it through the catalog callback', async () => {
        render(
            <ImportJsonModal
                open
                target="catalog"
                onClose={onClose}
                onImportProps={onImportProps}
                onImportCatalog={onImportCatalog}
            />,
        );

        fireEvent.change(screen.getByLabelText('JSON payload'), {
            target: {
                value: JSON.stringify({
                    version: 1,
                    viewMode: 'grouped',
                    activeNodeId: 'grp-1',
                    nodes: [
                        { id: 'grp-1', kind: 'group', label: 'Core', serviceIds: [101] },
                        { id: 'smart-1', kind: 'smart-group', label: 'Dynamic', rules: [], match: 'all' },
                    ],
                }),
            },
        });

        expect(await screen.findByText('Source: Pasted JSON')).toBeInTheDocument();
        expect(screen.getByText('grp-1')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Import catalog' }));

        await waitFor(() => {
            expect(onImportCatalog).toHaveBeenCalledWith(
                expect.objectContaining({
                    version: 1,
                    nodes: expect.any(Array),
                }),
            );
        });
    });
});
