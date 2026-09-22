// SPDX-License-Identifier: GPL-3.0-only
import { definition } from '../../backend/canonical/seed';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalImportJsonModal } from './canonical-import-json-modal';

const catalog = { version: 1, nodes: [
    { id: 'group:main', kind: 'group', label: 'Main', meta: {}, service_ids: ['10147'] },
    { id: 'smart:recent', kind: 'smart', label: 'Recent', meta: {}, match: 'all', rules: [], resolved_service_ids: [] },
], expanded_ids: [], pinned_node_ids: [], view_mode: 'grouped', active_node_id: 'group:main' } as const;

function openModal(target: 'props' | 'catalog' = 'props', onImportProps = vi.fn(), onImportCatalog = vi.fn()) {
    const onClose = vi.fn();
    render(<CanonicalImportJsonModal open target={target} onClose={onClose} onImportProps={onImportProps} onImportCatalog={onImportCatalog} />);
    return { onClose, onImportProps, onImportCatalog };
}

describe('canonical import JSON modal', () => {
    it('previews pasted canonical product JSON and imports it', async () => {
        const callbacks = openModal();
        const imported = { ...structuredClone(definition), name: 'Imported product' };
        fireEvent.change(screen.getByLabelText('JSON payload'), { target: { value: JSON.stringify(imported) } });
        expect(screen.getByText('Imported product')).toBeInTheDocument();
        expect(screen.getByText('Ready to import from pasted JSON.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Import props' }));
        await waitFor(() => expect(callbacks.onImportProps).toHaveBeenCalledWith(imported));
        expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    });

    it('loads a JSON file and keeps the file source in its preview', async () => {
        const callbacks = openModal();
        const file = new File([JSON.stringify(definition)], 'product.json', { type: 'application/json' });
        fireEvent.change(screen.getByLabelText('Load JSON file'), { target: { files: [file] } });
        await waitFor(() => expect(screen.getByText('Source: File upload')).toBeInTheDocument());
        expect(screen.getByText('product.json')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Import props' }));
        await waitFor(() => expect(callbacks.onImportProps).toHaveBeenCalledTimes(1));
    });

    it('disables import for malformed JSON and noncanonical definitions', () => {
        openModal();
        const input = screen.getByLabelText('JSON payload');
        fireEvent.change(input, { target: { value: '{bad' } });
        expect(screen.getByText('Validation error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Import props' })).toBeDisabled();
        fireEvent.change(input, { target: { value: JSON.stringify({ filters: [], fields: [] }) } });
        expect(screen.getByRole('button', { name: 'Import props' })).toBeDisabled();
    });

    it('previews canonical catalog groups and imports them', async () => {
        const callbacks = openModal('catalog');
        fireEvent.change(screen.getByLabelText('JSON payload'), { target: { value: JSON.stringify(catalog) } });
        expect(screen.getByText('group:main')).toBeInTheDocument();
        expect(screen.getByText('grouped')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Import catalog' }));
        await waitFor(() => expect(callbacks.onImportCatalog).toHaveBeenCalledWith(catalog));
    });

    it('keeps input visible when applying fails so the user can recover', async () => {
        const onImportProps = vi.fn().mockRejectedValue(new Error('Import denied'));
        openModal('props', onImportProps);
        fireEvent.change(screen.getByLabelText('JSON payload'), { target: { value: JSON.stringify(definition) } });
        fireEvent.click(screen.getByRole('button', { name: 'Import props' }));
        await waitFor(() => expect(screen.getByText('Import denied')).toBeInTheDocument());
        expect(screen.getByLabelText('JSON payload')).toHaveValue(JSON.stringify(definition));
    });
});
