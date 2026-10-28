// SPDX-License-Identifier: GPL-3.0-only
import { definition } from '../../backend/canonical/seed';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import type { ServiceCatalogState } from '@elqora/dgp-workspace';
import { CanonicalImportJsonModal } from './canonical-import-json-modal';

beforeAll(() => {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () => new DOMRect();
});

const catalog: ServiceCatalogState = { version: 1, nodes: [
    { id: 'group:main', kind: 'group', label: 'Main', meta: {}, service_ids: ['10147'] },
    { id: 'smart:recent', kind: 'smart', label: 'Recent', meta: {}, match: 'all', rules: [], resolved_service_ids: [] },
], expanded_ids: [], pinned_node_ids: [], view_mode: 'grouped', active_node_id: 'group:main' };

function openModal(target: 'props' | 'catalog' = 'props', onImportProps = vi.fn(), onImportCatalog = vi.fn()) {
    const onClose = vi.fn();
    render(<CanonicalImportJsonModal open target={target} currentDefinition={definition} currentCatalog={catalog} onClose={onClose} onImportProps={onImportProps} onImportCatalog={onImportCatalog} />);
    return { onClose, onImportProps, onImportCatalog };
}

function editJson(value: string) {
    const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'JSON payload' }));
    if (!view) throw new Error('JSON editor did not mount');
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }));
}

describe('canonical import JSON modal', () => {
    it('opens with the current definition in the editor and preview', () => {
        openModal();
        expect(screen.getByRole('dialog', { name: 'Product definition JSON' })).toBeInTheDocument();
        expect(EditorView.findFromDOM(screen.getByRole('textbox', { name: 'JSON payload' }))?.state.doc.toString()).toBe(JSON.stringify(definition, null, 2));
        expect(screen.getByText('Source: Current data')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply definition' })).toBeEnabled();
    });

    it('opens with the current catalog in the editor and preview', () => {
        openModal('catalog');
        expect(EditorView.findFromDOM(screen.getByRole('textbox', { name: 'JSON payload' }))?.state.doc.toString()).toBe(JSON.stringify(catalog, null, 2));
        expect(screen.getByText('group:main')).toBeInTheDocument();
    });

    it('keeps the JSON editor keyboard focusable and closes with Escape', async () => {
        const callbacks = openModal();
        const editor = screen.getByRole('textbox', { name: 'JSON payload' });
        editor.focus();
        expect(editor).toHaveFocus();
        fireEvent.keyDown(editor, { key: 'Escape' });
        await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1));
    });

    it('previews pasted canonical product JSON and imports it', async () => {
        const callbacks = openModal();
        const imported = { ...structuredClone(definition), name: 'Imported product' };
        editJson(JSON.stringify(imported));
        expect(screen.getByText('Imported product')).toBeInTheDocument();
        expect(screen.getByText('Ready to apply from edited JSON.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Apply definition' }));
        await waitFor(() => expect(callbacks.onImportProps).toHaveBeenCalledWith(imported));
        expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    });

    it('loads a JSON file and keeps the file source in its preview', async () => {
        const callbacks = openModal();
        const file = new File([JSON.stringify(definition)], 'product.json', { type: 'application/json' });
        fireEvent.change(screen.getByLabelText('Load JSON file'), { target: { files: [file] } });
        await waitFor(() => expect(screen.getByText('Source: File upload')).toBeInTheDocument());
        expect(screen.getByText('product.json')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Apply definition' }));
        await waitFor(() => expect(callbacks.onImportProps).toHaveBeenCalledTimes(1));
    });

    it('disables import for malformed JSON and noncanonical definitions', () => {
        openModal();

        editJson('{bad');
        expect(screen.getByText('Validation error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply definition' })).toBeDisabled();
        editJson(JSON.stringify({ filters: [], fields: [] }));
        expect(screen.getByRole('button', { name: 'Apply definition' })).toBeDisabled();
    });

    it('previews canonical catalog groups and imports them', async () => {
        const callbacks = openModal('catalog');
        editJson(JSON.stringify(catalog));
        expect(screen.getByText('group:main')).toBeInTheDocument();
        expect(screen.getByText('grouped')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Apply catalog' }));
        await waitFor(() => expect(callbacks.onImportCatalog).toHaveBeenCalledWith(catalog));
    });

    it('keeps input visible when applying fails so the user can recover', async () => {
        const onImportProps = vi.fn().mockRejectedValue(new Error('Import denied'));
        openModal('props', onImportProps);
        editJson(JSON.stringify(definition));
        fireEvent.click(screen.getByRole('button', { name: 'Apply definition' }));
        await waitFor(() => expect(screen.getByText('Import denied')).toBeInTheDocument());
        expect(EditorView.findFromDOM(screen.getByRole('textbox', { name: 'JSON payload' }))?.state.doc.toString()).toBe(JSON.stringify(definition));
    });
});
