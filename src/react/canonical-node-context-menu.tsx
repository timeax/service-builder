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
import { InputField } from '@timeax/form-palette';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOptionalCanonicalFallbacks } from './canonical-fallbacks';
import { CanonicalNoticeManager, type NoticeManagerRequest } from './canonical-notice-manager';
import { DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE, DRAG_MIME_SERVICE } from './drag-contracts';
import { useCanvasAPI, useWorkspacePermission, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

export type CanonicalContextNodeKind = 'filter' | 'field' | 'option';
export interface OpenCanonicalNodeContextMenuInput {
    node_id: string;
    node_kind: CanonicalContextNodeKind;
    client_x: number;
    client_y: number;
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
    const templates = useWorkspaceSelector((state) => state.templates);
    const [target, setTarget] = useState<OpenCanonicalNodeContextMenuInput | null>(null);
    const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);
    const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [noticeRequest, setNoticeRequest] = useState<NoticeManagerRequest | null>(null);
    const noticeToken = useRef(0);
    const openNoticeManager = useCallback((input?: { mode?: 'manage' | 'create'; target?: NoticeManagerRequest['target'] }) => {
        setNoticeRequest({ mode: input?.mode ?? 'manage', target: input?.target, token: ++noticeToken.current });
    }, []);
    const toggleNoticeManager = useCallback(() => setNoticeRequest((current) => current ? null : { mode: 'manage', token: ++noticeToken.current }), []);
    const dialRef = useRef<HTMLDivElement>(null);
    const node = target && canvas ? canvas.editor.get_node(target.node_id) : undefined;
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
    const duplicate = () => {
        if (!target || !canvas || !canEdit) return;
        const indexed = canvas.editor.get_node(target.node_id);
        const reference =
            indexed.kind === 'option'
                ? { kind: 'option' as const, field_id: indexed.field.id, id: indexed.id }
                : indexed.kind === 'field'
                  ? { kind: 'field' as const, id: indexed.id }
                  : indexed.kind === 'filter'
                    ? { kind: 'filter' as const, id: indexed.id }
                    : undefined;
        if (!reference) return;
        const id = canvas.editor.duplicate(reference);
        canvas.select([id], id);
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
        if (!target || target.node_kind !== 'field' || !canvas || !canTemplate) return;
        const field = canvas.builder.index.getField(target.node_id);
        if (!field) return;
        await runtime.create_template({
            key: slug(`${field.label}-${field.id}`),
            name: `${field.label} Template`,
            field: structuredClone(field),
            branch_id: branchId,
            published: false,
            meta: {},
        });
        setTarget(null);
    };
    const rename = () => {
        if (!target || !canvas || !canEdit || !renameValue.trim()) return;
        canvas.editor.relabel(target.node_id, renameValue.trim());
        setDialog(null);
        setTarget(null);
    };
    const remove = () => {
        if (!target || !canvas || !canEdit) return;
        canvas.editor.remove(target.node_id);
        setDialog(null);
        setTarget(null);
    };

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
                id = canvas.editor.add_field({
                    type: source.asset.kind,
                    label: source.asset.label,
                    bind_id: bindId,
                    meta: source.asset.variant ? { variant: source.asset.variant } : {},
                });
            } else {
                const template = templates.find((item) => item.id === source.asset.id);
                if (!template) return null;
                const templateBindId = Array.isArray(template.field.bind_id) ? template.field.bind_id[0] : template.field.bind_id;
                id = canvas.editor.add_field({ ...structuredClone(template.field), id: undefined, bind_id: bindId ?? templateBindId });
            }
            canvas.select([id], id);
            return id;
        },
        [canEdit, canvas, templates],
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
            {typeof document !== 'undefined' && (target || dialog || dropIntent)
                ? createPortal(
                      <>
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
                                              Duplicate
                                          </DropdownMenuItem>
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
                                                  onSelect={() => void saveTemplate()}
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
                                              Delete
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
                                  emitNodeError={(message) => console.error(message)}
                                  setDropIntent={setDropIntent}
                              />
                          ) : null}
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
