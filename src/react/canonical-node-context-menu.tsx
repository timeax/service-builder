// SPDX-License-Identifier: GPL-3.0-only
import { Dial } from '@/builder/node-context/components/Dial.tsx';
import type { DialAction, DropIntent, DropSource } from '@/builder/node-context/types.ts';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { InputField } from '@timeax/form-palette';
import { walkOptions } from '@elqora/dgp-core';
import type { NodeReference } from '@elqora/dgp-workspace';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOptionalCanonicalFallbacks } from './canonical-fallbacks';
import { canonicalAuthoringDescriptor } from './canonical-input-registry';
import { CanonicalNoticeManager, type NoticeManagerRequest } from './canonical-notice-manager';
import { DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE, DRAG_MIME_SERVICE } from './drag-contracts';
import { useCanvasAPI, useWorkspacePermission, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';
import { reorderCanonicalFieldForFilter } from './layer-commands';

export type CanonicalContextNodeKind = 'filter' | 'field' | 'option';
export interface OpenCanonicalNodeContextMenuInput {
    node_id: string;
    node_kind: CanonicalContextNodeKind;
    client_x: number;
    client_y: number;
    surface?: 'canvas' | 'wireframe';
}
export interface OpenCanonicalNodeDropInput extends OpenCanonicalNodeContextMenuInput {
    data_transfer: DataTransfer;
}
interface ContextValue {
    open_node_menu(input: OpenCanonicalNodeContextMenuInput): void;
    close_node_menu(): void;
    open_drop_dial(input: OpenCanonicalNodeDropInput): boolean;
    open_notice_manager(input?: { mode?: 'manage' | 'create'; target?: NoticeManagerRequest['target'] }): void;
    toggle_notice_manager(): void;
    is_notice_manager_open: boolean;
}
const Context = createContext<ContextValue | null>(null);
const slug = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'field-template';

export function useCanonicalNodeContextMenu(): ContextValue {
    const value = useContext(Context);
    if (!value) throw new Error('useCanonicalNodeContextMenu requires CanonicalNodeContextMenuProvider.');
    return value;
}

export function useOptionalCanonicalNodeContextMenu(): ContextValue | null {
    return useContext(Context);
}

export function CanonicalNodeContextMenuProvider({ children }: { children: ReactNode }) {
    const canvas = useCanvasAPI();
    const runtime = useWorkspaceRuntime();
    const fallbacks = useOptionalCanonicalFallbacks();
    const branchId = useWorkspaceSelector((state) => state.current_branch_id);
    const canEdit = useWorkspacePermission('document.mutate');
    const canTemplate = useWorkspacePermission('template.write');
    const editDeniedReason = canEdit ? undefined : 'You do not have permission to edit this definition.';
    const templateDeniedReason = canTemplate ? undefined : 'You do not have permission to manage templates.';
    const [target, setTarget] = useState<OpenCanonicalNodeContextMenuInput | null>(null);
    const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);
    const [dropError, setDropError] = useState<string | null>(null);
    const [dialog, setDialog] = useState<'rename' | 'delete' | 'template' | 'batch-target' | 'batch-labels' | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [templateInBranch, setTemplateInBranch] = useState(true);
    const [templateIncludeConnected, setTemplateIncludeConnected] = useState(false);
    const [templateGroupLabel, setTemplateGroupLabel] = useState('');
    const [templateFields, setTemplateFields] = useState<Record<string, boolean>>({});
    const [templateProperties, setTemplateProperties] = useState<Record<string, Record<string, boolean>>>({});
    const [templateError, setTemplateError] = useState<string | null>(null);
    const [templatePending, setTemplatePending] = useState(false);
    const [batchMode, setBatchMode] = useState<'rebind' | 'include' | 'exclude'>('rebind');
    const [batchTargetId, setBatchTargetId] = useState('');
    const [batchPrefix, setBatchPrefix] = useState('');
    const [batchSuffix, setBatchSuffix] = useState('');
    const [batchError, setBatchError] = useState<string | null>(null);
    const [noticeRequest, setNoticeRequest] = useState<NoticeManagerRequest | null>(null);
    const noticeToken = useRef(0);
    const openNoticeManager = useCallback((input?: { mode?: 'manage' | 'create'; target?: NoticeManagerRequest['target'] }) => {
        setNoticeRequest({ mode: input?.mode ?? 'manage', target: input?.target, token: ++noticeToken.current });
    }, []);
    const toggleNoticeManager = useCallback(() => setNoticeRequest((current) => current ? null : { mode: 'manage', token: ++noticeToken.current }), []);
    const dialRef = useRef<HTMLDivElement>(null);
    const node = target && canvas ? canvas.editor.get_node(target.node_id) : undefined;
    const templatePreview = useMemo(() => {
        if (dialog !== 'template' || target?.node_kind !== 'field' || !canTemplate) return null;
        const result = runtime.capture_field_template(target.node_id, true);
        return result.ok ? result.value : null;
    }, [canTemplate, dialog, runtime, target]);
    const label =
        node?.kind === 'filter'
            ? node.filter.label
            : node?.kind === 'field'
              ? node.field.label
              : node?.kind === 'option'
                ? node.option.label
                : (target?.node_id ?? '');
    const serviceId =
        node?.kind === 'filter'
            ? node.filter.service_id
            : node?.kind === 'field'
              ? node.field.button === true
                  ? node.field.service_id
                  : undefined
              : node?.kind === 'option'
                ? node.option.service_id
                : undefined;
    const anchor =
        target && typeof window !== 'undefined'
            ? {
                  left: Math.max(12, Math.min(target.client_x, window.innerWidth - 268)),
                  top: Math.max(12, Math.min(target.client_y, window.innerHeight - 360)),
              }
            : undefined;
    const selectedIds = canvas?.get_selection() ?? [];
    const actionIds = target && selectedIds.includes(target.node_id) && selectedIds.length > 1 ? selectedIds : target ? [target.node_id] : [];
    const isBatch = actionIds.length > 1;
    const selectedFields = actionIds.filter((id) => canvas?.editor.get_node(id).kind === 'field');
    const hasServiceSelection = actionIds.some((id) => {
        const indexed = canvas?.editor.get_node(id);
        return indexed?.kind === 'filter' ? indexed.filter.service_id !== undefined : indexed?.kind === 'field' ? indexed.field.button === true && indexed.field.service_id !== undefined : indexed?.kind === 'option' ? indexed.option.service_id !== undefined : false;
    });
    const references = (): NodeReference[] => {
        const refs: NodeReference[] = [];
        for (const id of actionIds) {
            const indexed = canvas?.editor.get_node(id);
            if (indexed?.kind === 'filter') refs.push({ kind: 'filter', id });
            if (indexed?.kind === 'field') refs.push({ kind: 'field', id });
            if (indexed?.kind === 'option') refs.push({ kind: 'option', field_id: indexed.field.id, id });
        }
        return refs;
    };
    const duplicate = () => {
        if (!target || !canvas || !canEdit) return;
        const refs = references();
        if (!refs.length) return;
        const ids = refs.length > 1 ? canvas.editor.duplicate_many(refs) : [canvas.editor.duplicate(refs[0]!)];
        canvas.select(ids, ids.at(-1));
        setTarget(null);
    };
    const addNotice = () => {
        if (!target || !canvas || !canEdit) return;
        openNoticeManager({
            mode: 'create',
            target: { scope: 'node', node_kind: target.node_kind === 'filter' ? 'tag' : target.node_kind, node_id: target.node_id },
        });
        setTarget(null);
    };
    const saveTemplate = async () => {
        if (!target || target.node_kind !== 'field' || !canvas || !canTemplate || !templateName.trim() || templatePending) return;
        setTemplatePending(true);
        setTemplateError(null);
        try {
            const available = templatePreview ? [templatePreview.field, ...(templatePreview.connected_fields ?? [])] : [];
            const selected = available.filter((field) => field.id === target.node_id || (templateIncludeConnected && templateFields[field.id] !== false));
            const captured = runtime.capture_field_template(target.node_id, {
                include_connected: templateIncludeConnected,
                field_ids: selected.map((field) => field.id),
                property_keys: Object.fromEntries(selected.map((field) => [field.id, Object.keys(field).filter((key) => ['id', 'type', 'label'].includes(key) || templateProperties[field.id]?.[key] !== false)])),
            });
            if (captured.ok === false) {
                setTemplateError(captured.error.message);
                return;
            }
            const result = await runtime.create_template({
                key: slug(`${templateName.trim()}-${target.node_id}`),
                name: templateName.trim(),
                ...(templateIncludeConnected ? { group_label: templateGroupLabel.trim() || `${label} group` } : {}),
                ...captured.value,
                branch_id: templateInBranch ? branchId : null,
                published: false,
                meta: {},
            });
            if (result.ok === false) {
                setTemplateError(result.error.message);
                return;
            }
            setDialog(null);
            setTarget(null);
        } catch (error) {
            setTemplateError(error instanceof Error ? error.message : 'Could not save the template.');
        } finally {
            setTemplatePending(false);
        }
    };
    const rename = () => {
        if (!target || !canvas || !canEdit || !renameValue.trim()) return;
        canvas.editor.relabel(target.node_id, renameValue.trim());
        setDialog(null);
        setTarget(null);
    };
    const remove = () => {
        if (!target || !canvas || !canEdit) return;
        if (isBatch) canvas.editor.remove_many(actionIds);
        else canvas.editor.remove(target.node_id);
        setDialog(null);
        setTarget(null);
    };
    const applyBatchTarget = () => {
        if (!canvas || !canEdit || !batchTargetId || !actionIds.length) return;
        try {
            if (batchMode === 'rebind') canvas.editor.bind_many(actionIds, batchTargetId);
            else if (batchMode === 'include') canvas.editor.include(batchTargetId, actionIds);
            else canvas.editor.exclude(batchTargetId, actionIds);
            setDialog(null);
            setTarget(null);
            setBatchError(null);
        } catch (error) {
            setBatchError(error instanceof Error ? error.message : 'The batch action failed.');
        }
    };
    const moveWireframeField = useCallback((delta: number, scope: 'base' | 'context') => {
        if (!target || !canvas || !canEdit || target.node_kind !== 'field') return;
        const definition = canvas.editor.definition;
        if (scope === 'base') {
            const from = definition.fields.findIndex((field) => field.id === target.node_id);
            const to = from + delta;
            if (from < 0 || to < 0 || to >= definition.fields.length) return;
            const fields = [...definition.fields];
            [fields[from], fields[to]] = [fields[to]!, fields[from]!];
            canvas.editor.replace({ ...definition, fields }, 'Reorder field');
            setTarget(null);
            return;
        }
        const filterId = canvas.selection.current_filter() ?? definition.filters[0]?.id;
        if (!filterId) return;
        const visible = canvas.selection.visible_group();
        const ordered = definition.order_for_tags[filterId] ?? (visible.kind === 'single' ? visible.group.field_ids : definition.fields.map((field) => field.id));
        const from = ordered.indexOf(target.node_id);
        if (from < 0 || from + delta < 0 || from + delta >= ordered.length) return;
        canvas.editor.replace(reorderCanonicalFieldForFilter(definition, filterId, target.node_id, ordered, from + delta), 'Reorder field in context');
        setTarget(null);
    }, [target, canvas, canEdit]);
    useEffect(() => {
        if (target?.surface !== 'wireframe' || target.node_kind !== 'field' || !canEdit) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            const element = event.target as HTMLElement | null;
            if (element?.closest?.('input, textarea, [contenteditable="true"], [role="combobox"]')) return;
            event.preventDefault();
            moveWireframeField(event.key === 'ArrowUp' ? -1 : 1, event.shiftKey ? 'context' : 'base');
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [target, canvas, canEdit, moveWireframeField]);
    const batchTargetChoices = canvas ? batchMode === 'rebind'
        ? canvas.editor.definition.filters.map((filter) => ({ id: filter.id, label: filter.label }))
        : [
            ...canvas.editor.definition.fields.filter((field) => field.button).map((field) => ({ id: field.id, label: field.label })),
            ...walkOptions(canvas.editor.definition).map((visit) => ({ id: visit.optionId, label: visit.option.label })),
        ] : [];

    const parseDropSource = useCallback((dataTransfer: DataTransfer): DropSource | null => {
        const serviceId = dataTransfer.getData(DRAG_MIME_SERVICE);
        if (serviceId) return { kind: 'service', serviceId };
        try {
            const builtin = JSON.parse(dataTransfer.getData(DRAG_MIME_ASSET_BUILTIN) || 'null');
            if (builtin?.kind)
                return {
                    kind: 'asset_builtin',
                    asset: {
                        kind: String(builtin.kind),
                        label: String(builtin.label ?? builtin.kind),
                        variant: builtin.variant === undefined ? undefined : String(builtin.variant),
                    },
                };
            const template = JSON.parse(dataTransfer.getData(DRAG_MIME_ASSET_TEMPLATE) || 'null');
            if (template?.id)
                return {
                    kind: 'asset_template',
                    asset: { id: String(template.id), name: String(template.name ?? 'Template Field'), kind: String(template.kind ?? 'text') },
                };
        } catch {
            return null;
        }
        return null;
    }, []);
    const openDropDial = useCallback(
        (input: OpenCanonicalNodeDropInput) => {
            if (!canvas || !canEdit) return false;
            const source = parseDropSource(input.data_transfer);
            if (!source) return false;
            const indexed = canvas.editor.get_node(input.node_id);
            if (source.kind === 'service') {
                const canSetService =
                    indexed.kind === 'filter' || indexed.kind === 'option' || (indexed.kind === 'field' && indexed.field.button === true);
                if (!canSetService) return false;
            } else {
                if (indexed.kind === 'field' && indexed.field.button !== true) return true;
                if (indexed.kind !== 'filter' && indexed.kind !== 'field' && indexed.kind !== 'option') return false;
            }
            setTarget(null);
            setDropIntent({
                source,
                receiver: {
                    nodeId: input.node_id,
                    nodeKind: input.node_kind === 'filter' ? 'tag' : input.node_kind,
                    surface: 'canvas',
                    clientX: input.client_x,
                    clientY: input.client_y,
                },
                pointer: {
                    x: input.client_x > 0 ? input.client_x : window.innerWidth / 2,
                    y: input.client_y > 0 ? input.client_y : window.innerHeight / 2,
                },
                surface: 'canvas',
            });
            return true;
        },
        [canEdit, canvas, parseDropSource],
    );
    const createDropField = useCallback(
        (source: DropSource, bindId?: string) => {
            if (!canvas || !canEdit || source.kind === 'service') return null;
            let id: string;
            if (source.kind === 'asset_builtin') {
                id = canvas.editor.add_field_from_descriptor(canonicalAuthoringDescriptor(source.asset.kind, source.asset.variant), { label: source.asset.label, bind_id: bindId });
            } else {
                const result = runtime.instantiate_template(source.asset.id, bindId === undefined ? undefined : { bind_id: bindId });
                if (result.ok === false) {
                    setDropError(result.error.message);
                    return null;
                }
                id = result.value.root_id;
            }
            canvas.select([id], id);
            return id;
        },
        [canEdit, canvas, runtime],
    );
    const dialActions = useMemo<DialAction[]>(() => {
        if (!dropIntent || !canvas) return [];
        const indexed = canvas.editor.get_node(dropIntent.receiver.nodeId);
        if (dropIntent.source.kind === 'service')
            return [
                {
                    id: 'set_service',
                    label: 'Set Service',
                    execute: () =>
                        canvas.editor.set_service(
                            dropIntent.receiver.nodeId,
                            dropIntent.source.kind === 'service' ? dropIntent.source.serviceId : undefined,
                        ),
                },
            ];
        const rawBindId =
            indexed.kind === 'filter'
                ? indexed.id
                : indexed.kind === 'field'
                  ? indexed.field.bind_id
                  : indexed.kind === 'option'
                    ? indexed.field.bind_id
                    : undefined;
        const bindId = Array.isArray(rawBindId) ? rawBindId[0] : rawBindId;
        if (indexed.kind === 'filter')
            return [
                {
                    id: 'bind',
                    label: 'Bind',
                    execute: () => {
                        createDropField(dropIntent.source, bindId);
                    },
                },
            ];
        if (indexed.kind === 'option' || (indexed.kind === 'field' && indexed.field.button === true))
            return (['include', 'exclude'] as const).map((kind) => ({
                id: kind,
                label: kind === 'include' ? 'Include' : 'Exclude',
                execute: () => {
                    const id = createDropField(dropIntent.source, bindId);
                    if (id) canvas.editor.connect(kind, indexed.id, id);
                },
            }));
        return [];
    }, [canvas, createDropField, dropIntent]);
    const dialAnchorStyle = useMemo(() => {
        if (!dropIntent || typeof window === 'undefined') return null;
        const size = 220;
        const padding = 14;
        return {
            left: Math.max(padding, Math.min(dropIntent.pointer.x - size / 2, window.innerWidth - size - padding)),
            top: Math.max(padding, Math.min(dropIntent.pointer.y - size / 2, window.innerHeight - size - padding)),
            size,
        };
    }, [dropIntent]);
    useEffect(() => {
        if (!dropIntent) return;
        const dismissOutside = (event: PointerEvent) => {
            if (!dialRef.current?.contains(event.target as Node)) setDropIntent(null);
        };
        const dismissEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setDropIntent(null);
        };
        window.addEventListener('pointerdown', dismissOutside);
        window.addEventListener('keydown', dismissEscape);
        return () => {
            window.removeEventListener('pointerdown', dismissOutside);
            window.removeEventListener('keydown', dismissEscape);
        };
    }, [dropIntent]);
    const value = useMemo<ContextValue>(
        () => ({ open_node_menu: setTarget, close_node_menu: () => setTarget(null), open_drop_dial: openDropDial, open_notice_manager: openNoticeManager, toggle_notice_manager: toggleNoticeManager, is_notice_manager_open: noticeRequest !== null }),
        [openDropDial, openNoticeManager, toggleNoticeManager, noticeRequest],
    );

    return (
        <Context.Provider value={value}>
            {children}
            <CanonicalNoticeManager request={noticeRequest} onClose={() => setNoticeRequest(null)} />
            {typeof document !== 'undefined' && (target || dialog || dropIntent || dropError)
                ? createPortal(
                      <>
                          {dropError ? <div role="alert" className="fixed top-4 right-4 z-50 max-w-sm rounded-xl border border-amber-200 bg-white p-3 text-sm text-amber-900 shadow-xl dark:border-amber-500/30 dark:bg-slate-950 dark:text-amber-200"><div className="flex gap-3"><p>{dropError}</p><button type="button" className="self-start text-xs underline" onClick={() => setDropError(null)}>Dismiss</button></div></div> : null}
                          {target && anchor ? (
                              <div className="fixed z-40" style={anchor}>
                                  <DropdownMenu
                                      open
                                      onOpenChange={(open) => {
                                          if (!open && !dialog) setTarget(null);
                                      }}
                                  >
                                      <DropdownMenuTrigger asChild>
                                          <button type="button" className="sr-only">
                                              Context menu
                                          </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                          align="start"
                                          side="right"
                                          sideOffset={0}
                                          className="max-h-[calc(100vh-24px)] w-64 overflow-y-auto rounded-xl border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                                      >
                                          <DropdownMenuItem
                                              disabled={!canEdit}
                                              title={editDeniedReason}
                                              onSelect={() => {
                                                  setRenameValue(label);
                                                  setDialog('rename');
                                              }}
                                          >
                                              Rename
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={duplicate}>
                                              {isBatch ? 'Duplicate selected' : 'Duplicate'}
                                          </DropdownMenuItem>
                                          {isBatch ? (
                                              <>
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => { canvas?.editor.clear_services(actionIds); setTarget(null); }} hidden={!hasServiceSelection}>Unlink service IDs</DropdownMenuItem>
                                                  {(['rebind', 'include', 'exclude'] as const).map((mode) => (
                                                      <DropdownMenuItem key={mode} disabled={!canEdit} title={editDeniedReason} onSelect={() => { setBatchMode(mode); setBatchTargetId(''); setBatchError(null); setDialog('batch-target'); }}>
                                                          {mode === 'rebind' ? 'Move / Rebind to tag' : mode === 'include' ? 'Include in...' : 'Exclude from...'}
                                                      </DropdownMenuItem>
                                                  ))}
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => { canvas?.editor.clear_relationships(actionIds); setTarget(null); }}>Clear includes/excludes</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => { setBatchPrefix(''); setBatchSuffix(''); setDialog('batch-labels'); }}>Rename labels...</DropdownMenuItem>
                                                  {(['base', 'utility'] as const).map((role) => <DropdownMenuItem key={role} disabled={!canEdit || !selectedFields.length} title={editDeniedReason} onSelect={() => { canvas?.editor.set_pricing_role(selectedFields, role); setTarget(null); }}>Set pricing role: {role === 'base' ? 'Base' : 'Utility'}</DropdownMenuItem>)}
                                                  <DropdownMenuItem disabled={!canEdit || !selectedFields.length} title={editDeniedReason} onSelect={() => { canvas?.editor.clear_field_validations(selectedFields); setTarget(null); }}>Clear validation</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit || !selectedFields.length} title={editDeniedReason} onSelect={() => { canvas?.editor.clear_field_defaults(selectedFields); setTarget(null); }}>Clear defaults</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit || !selectedFields.length} title={editDeniedReason} onSelect={() => { canvas?.editor.auto_create_options(selectedFields); setTarget(null); }}>Auto-create missing options</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit || !selectedFields.length} title={editDeniedReason} onSelect={() => { canvas?.editor.clear_options(selectedFields); setTarget(null); }}>Clear all options</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => { canvas?.editor.remove_notices_for_nodes(actionIds); setTarget(null); }}>Remove notices for selected</DropdownMenuItem>
                                                  {(['public', 'private'] as const).map((type) => <DropdownMenuItem key={type} disabled={!canEdit} title={editDeniedReason} onSelect={() => { canvas?.editor.set_notices_type_for_nodes(actionIds, type); setTarget(null); }}>Set notices {type}</DropdownMenuItem>)}
                                              </>
                                          ) : null}
                                          {target.surface === 'wireframe' && target.node_kind === 'field' ? (
                                              <>
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => moveWireframeField(-1, 'base')}>Move up</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => moveWireframeField(1, 'base')}>Move down</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => moveWireframeField(-1, 'context')}>Move up (in context)</DropdownMenuItem>
                                                  <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={() => moveWireframeField(1, 'context')}>Move down (in context)</DropdownMenuItem>
                                              </>
                                          ) : null}
                                          <DropdownMenuItem onSelect={() => void navigator.clipboard.writeText(target.node_id)}>
                                              Copy ID
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled={!canEdit} title={editDeniedReason} onSelect={addNotice}>
                                              Add notice
                                          </DropdownMenuItem>
                                          {serviceId !== undefined && fallbacks ? (
                                              <DropdownMenuItem
                                                  disabled={!canEdit}
                                                  title={editDeniedReason}
                                                  onSelect={() => {
                                                      fallbacks.open_quick_add_for_node({
                                                          node_id: target.node_id,
                                                          node_kind: target.node_kind,
                                                          node_label: label,
                                                          service_id: serviceId,
                                                      });
                                                      setTarget(null);
                                                  }}
                                              >
                                                  Add fallbacks
                                              </DropdownMenuItem>
                                          ) : null}
                                          {serviceId !== undefined && fallbacks ? (
                                              <DropdownMenuItem
                                                  onSelect={() => {
                                                      fallbacks.open_editor_for_node({
                                                          node_id: target.node_id,
                                                          node_kind: target.node_kind,
                                                          node_label: label,
                                                          service_id: serviceId,
                                                      });
                                                      setTarget(null);
                                                  }}
                                              >
                                                  Open fallback editor
                                              </DropdownMenuItem>
                                          ) : null}
                                          {target.node_kind === 'field' ? (
                                              <DropdownMenuItem
                                                  disabled={!canEdit}
                                                  title={editDeniedReason}
                                                  onSelect={() => {
                                                      canvas?.toggle_options(target.node_id);
                                                      setTarget(null);
                                                  }}
                                              >
                                                  {canvas?.options_shown(target.node_id) ? 'Hide option nodes' : 'Show option nodes'}
                                              </DropdownMenuItem>
                                          ) : null}
                                          {target.node_kind === 'field' ? (
                                              <DropdownMenuItem
                                                  disabled={!canTemplate}
                                                  title={templateDeniedReason}
                                                  onSelect={() => {
                                                      setTemplateName(`${label} Template`);
                                                      setTemplateInBranch(true);
                                                      setTemplateIncludeConnected(false);
                                                      setTemplateGroupLabel(`${label} group`);
                                                      setTemplateFields({});
                                                      setTemplateProperties({});
                                                      setTemplateError(null);
                                                      setDialog('template');
                                                  }}
                                              >
                                                  Save as template
                                              </DropdownMenuItem>
                                          ) : null}
                                          <DropdownMenuItem
                                              variant="destructive"
                                              disabled={!canEdit}
                                              title={editDeniedReason}
                                              onSelect={() => setDialog('delete')}
                                          >
                                              {isBatch ? 'Delete selected' : 'Delete'}
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                          ) : null}
                          {dropIntent && dialAnchorStyle ? (
                              <Dial
                                  dialActions={dialActions}
                                  dropIntent={dropIntent}
                                  dialAnchorStyle={dialAnchorStyle}
                                  dialRef={dialRef}
                                  emitNodeError={setDropError}
                                  setDropIntent={setDropIntent}
                              />
                          ) : null}
                          <AlertDialog
                              open={dialog === 'batch-target'}
                              onOpenChange={(open) => { if (!open) setDialog(null); }}
                          >
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>{batchMode === 'rebind' ? 'Move / Rebind to tag' : batchMode === 'include' ? 'Include in...' : 'Exclude from...'}</AlertDialogTitle>
                                      <AlertDialogDescription>Choose a target for the selected nodes.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <label className="space-y-2 text-sm">Target
                                      <select aria-label="Batch target" value={batchTargetId} onChange={(event) => setBatchTargetId(event.target.value)} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                                          <option value="">Select target</option>
                                          {batchTargetChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
                                      </select>
                                  </label>
                                  {batchError ? <p role="alert" className="text-sm text-rose-600">{batchError}</p> : null}
                                  <AlertDialogFooter>
                                      <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                      <Button type="button" disabled={!batchTargetId} onClick={applyBatchTarget}>Apply</Button>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog
                              open={dialog === 'batch-labels'}
                              onOpenChange={(open) => { if (!open) setDialog(null); }}
                          >
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Rename labels</AlertDialogTitle>
                                      <AlertDialogDescription>Add a prefix or suffix to selected labels.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <InputField variant="text" label="Prefix" value={batchPrefix} onChange={(event) => setBatchPrefix(String(event.value ?? ''))} />
                                  <InputField variant="text" label="Suffix" value={batchSuffix} onChange={(event) => setBatchSuffix(String(event.value ?? ''))} />
                                  <AlertDialogFooter>
                                      <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                      <Button type="button" disabled={!batchPrefix && !batchSuffix} onClick={() => { canvas?.editor.rename_labels(actionIds, batchPrefix, batchSuffix); setDialog(null); setTarget(null); }}>Apply</Button>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog
                              open={dialog === 'template'}
                              onOpenChange={(open) => {
                                  if (!open && !templatePending) setDialog(null);
                              }}
                          >
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Save as template</AlertDialogTitle>
                                      <AlertDialogDescription>Name this field template and choose its scope.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <form onSubmit={(event) => { event.preventDefault(); void saveTemplate(); }} className="space-y-4">
                                      <InputField variant="text" label="Template name" value={templateName} onChange={(event) => setTemplateName(String(event.value ?? ''))} />
                                      <label className="flex items-center gap-2 text-sm">
                                          <input type="checkbox" checked={templateInBranch} onChange={(event) => setTemplateInBranch(event.target.checked)} />
                                          <span>Save to current branch</span>
                                      </label>
                                      <label className="flex items-center gap-2 text-sm">
                                          <input type="checkbox" checked={templateIncludeConnected} onChange={(event) => setTemplateIncludeConnected(event.target.checked)} />
                                          <span>Include connected fields</span>
                                      </label>
                                      <p className="text-xs text-slate-500">The template preserves its fields, nested options, and supported relationships.</p>
                                      {templatePreview ? (
                                          <ScrollArea className="max-h-72 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                                              {templateIncludeConnected ? (
                                                  <div className="space-y-2">
                                                      <InputField variant="text" label="Template label" value={templateGroupLabel} onChange={(event) => setTemplateGroupLabel(String(event.value ?? ''))} />
                                                      <p className="text-sm font-medium">Fields in group</p>
                                                      {[templatePreview.field, ...(templatePreview.connected_fields ?? [])].map((field) => (
                                                          <label key={field.id} className="flex items-center gap-2 text-sm">
                                                              <input type="checkbox" checked={field.id === templatePreview.field.id || templateFields[field.id] !== false} disabled={field.id === templatePreview.field.id} onChange={(event) => setTemplateFields((current) => ({ ...current, [field.id]: event.target.checked }))} />
                                                              <span>{field.label}</span>
                                                          </label>
                                                      ))}
                                                  </div>
                                              ) : null}
                                              <div className="mt-3 space-y-2">
                                                  <p className="text-sm font-medium">Copied properties</p>
                                                  {[templatePreview.field, ...(templateIncludeConnected ? templatePreview.connected_fields ?? [] : [])]
                                                      .filter((field) => field.id === templatePreview.field.id || templateFields[field.id] !== false)
                                                      .map((field) => (
                                                          <details key={field.id} open className="rounded border border-slate-200 p-2 dark:border-slate-700">
                                                              <summary className="cursor-pointer text-sm font-medium">{field.label} ({field.id})</summary>
                                                              <div className="mt-2 grid grid-cols-1 gap-1">
                                                                  {Object.keys(field).map((key) => {
                                                                      const required = ['id', 'type', 'label'].includes(key);
                                                                      return <label key={key} className="flex items-center gap-2 text-xs">
                                                                          <input type="checkbox" aria-label={`Copy ${key} from ${field.label}`} checked={required || templateProperties[field.id]?.[key] !== false} disabled={required} onChange={(event) => setTemplateProperties((current) => ({ ...current, [field.id]: { ...(current[field.id] ?? {}), [key]: event.target.checked } }))} />
                                                                          <span className="font-mono">{key}</span>
                                                                      </label>;
                                                                  })}
                                                              </div>
                                                          </details>
                                                      ))}
                                              </div>
                                          </ScrollArea>
                                      ) : null}
                                      {templateError ? <p role="alert" className="text-sm text-rose-600">{templateError}</p> : null}
                                      <AlertDialogFooter>
                                          <AlertDialogCancel type="button" disabled={templatePending}>Cancel</AlertDialogCancel>
                                          <Button type="submit" disabled={!templateName.trim() || templatePending}>{templatePending ? 'Saving…' : 'Save template'}</Button>
                                      </AlertDialogFooter>
                                  </form>
                              </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog
                              open={dialog === 'rename'}
                              onOpenChange={(open) => {
                                  if (!open) setDialog(null);
                              }}
                          >
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Rename node</AlertDialogTitle>
                                      <AlertDialogDescription>Update the node label across canvas, layers, and wireframe.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <form
                                      onSubmit={(event) => {
                                          event.preventDefault();
                                          rename();
                                      }}
                                      className="space-y-4"
                                  >
                                      <InputField
                                          variant="text"
                                          label="Label"
                                          value={renameValue}
                                          onChange={(event) => setRenameValue(String(event.value ?? ''))}
                                      />
                                      <AlertDialogFooter>
                                          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                          <AlertDialogAction type="submit">Save</AlertDialogAction>
                                      </AlertDialogFooter>
                                  </form>
                              </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog
                              open={dialog === 'delete'}
                              onOpenChange={(open) => {
                                  if (!open) setDialog(null);
                              }}
                          >
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Delete node</AlertDialogTitle>
                                      <AlertDialogDescription>This action removes the selected node from the builder graph.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                      <AlertDialogAction type="button" className="bg-rose-600 hover:bg-rose-700" onClick={remove}>
                                          Delete
                                      </AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                      </>,
                      document.body,
                  )
                : null}
        </Context.Provider>
    );
}
