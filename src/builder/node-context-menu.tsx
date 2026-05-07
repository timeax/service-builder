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
import { deriveWorkspaceAuthorization, getAuthorizationDecision } from '@/workspace/authorization.ts';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenu } from './node-context/components/ContextMenu.tsx';
import { Dial } from './node-context/components/Dial.tsx';
import { NoticeManager } from './node-context/components/NoticeManager.tsx';
import { RenameNodeField } from './node-context/components/RenameNodeField.tsx';
import { useDropHandling, useNoticeHandling } from './node-context/hooks.ts';
import {
    detectRelationMaps,
    discoverGroupFieldIds,
    filterRelationsForSelection,
    pickCheckedProperties,
    sanitizeField,
} from './node-context/template-utils.ts';
import { OVERLAY_STALE_TIMEOUT_MS } from './node-context/types';
import type {
    DropIntent,
    EdgeContextTarget,
    EdgeRelationKind,
    HandleNodeDropInput,
    NodeContextTarget,
    NodeKind,
    NoticeDraft,
    NoticeManagerMode,
    OpenEdgeContextMenuInput,
    OpenNodeContextMenuInput,
    OpenNoticeManagerInput,
} from './node-context/types.ts';
import { inferNodeKindFromId, makeTemplateKey, toDraft } from './node-context/utils.ts';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';

type NodeContextMenuValue = {
    openNodeContextMenu: (input: OpenNodeContextMenuInput) => void;
    closeNodeContextMenu: () => void;
    openEdgeContextMenu: (input: OpenEdgeContextMenuInput) => void;
    closeEdgeContextMenu: () => void;
    canAcceptDropPayload: (dataTransfer: DataTransfer) => boolean;
    handleNodeDrop: (input: HandleNodeDropInput) => boolean;
    openNoticeManager: (input?: OpenNoticeManagerInput) => void;
    closeNoticeManager: () => void;
    toggleNoticeManager: () => void;
    isNoticeManagerOpen: boolean;
};

const NodeContextMenuContext = createContext<NodeContextMenuValue | null>(null);

export function NodeContextMenuProvider({ children }: { children: ReactNode }) {
    const canvas = useCanvas();
    const ws = useWorkspace();

    const [target, setTarget] = useState<NodeContextTarget | null>(null);
    const [edgeTarget, setEdgeTarget] = useState<EdgeContextTarget | null>(null);
    const [dialogTarget, setDialogTarget] = useState<NodeContextTarget | null>(null);
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);
    const [noticeManagerOpen, setNoticeManagerOpen] = useState(false);
    const [noticeMode, setNoticeMode] = useState<NoticeManagerMode>('manage');
    const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
    const [noticeDraft, setNoticeDraft] = useState<NoticeDraft>(() => toDraft());
    const [noticeSearch, setNoticeSearch] = useState('');
    const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
    const [templateSaveFieldId, setTemplateSaveFieldId] = useState<string | null>(null);
    const [templateSaveMode, setTemplateSaveMode] = useState<'single' | 'group'>('single');
    const [templateLabel, setTemplateLabel] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [templateSaveToCurrentBranch, setTemplateSaveToCurrentBranch] = useState(true);
    const [templateGroupSelection, setTemplateGroupSelection] = useState<Record<string, boolean>>({});
    const [templateFieldChecks, setTemplateFieldChecks] = useState<Record<string, Record<string, boolean>>>({});
    const [edgeTypeSubmenuOpen, setEdgeTypeSubmenuOpen] = useState(false);

    const menuRef = useRef<HTMLDivElement | null>(null);
    const dialRef = useRef<HTMLDivElement | null>(null);

    const closeNodeContextMenu = useCallback(() => setTarget(null), []);
    const closeEdgeContextMenu = useCallback(() => {
        setEdgeTarget(null);
        setEdgeTypeSubmenuOpen(false);
    }, []);

    const emitNodeError = useCallback(
        (message: string, meta?: Record<string, unknown>) => {
            canvas.api.emit('error', {
                message,
                meta,
            });
        },
        [canvas.api],
    );

    const focusNode = useCallback(
        (nodeId: string) => {
            canvas.setActive(nodeId);
            canvas.api.select([nodeId]);
        },
        [canvas.api, canvas.setActive],
    );
    const auth = useMemo(
        () =>
            deriveWorkspaceAuthorization({
                actor: ws.actor,
                permissions: ws.permissions?.data,
                participants: ws.participants?.data,
                authors: ws.authors?.data,
            }),
        [ws.actor, ws.authors?.data, ws.participants?.data, ws.permissions?.data],
    );
    const editDecision = getAuthorizationDecision(auth, 'branch-content-edit');
    const templateDecision = getAuthorizationDecision(auth, 'template-write');

    const openNodeContextMenu = useCallback(
        (input: OpenNodeContextMenuInput) => {
            const node = canvas.selector.getNode(input.nodeId);
            const inferred = input.nodeKind ?? (node?.kind as NodeKind | undefined) ?? inferNodeKindFromId(input.nodeId) ?? undefined;
            if (!inferred || (inferred !== 'tag' && inferred !== 'field' && inferred !== 'option')) return;

            setTarget({
                nodeId: input.nodeId,
                nodeKind: inferred,
                surface: input.surface,
                clientX: input.clientX,
                clientY: input.clientY,
            });
        },
        [canvas.selector],
    );
    const openEdgeContextMenu = useCallback((input: OpenEdgeContextMenuInput) => {
        setEdgeTarget(input);
        setEdgeTypeSubmenuOpen(false);
    }, []);

    const { canAcceptDropPayload, handleNodeDrop, actionsForIntent } = useDropHandling(setDropIntent, emitNodeError, focusNode);

    const activeNode = useMemo(() => {
        if (!target) return null;
        try {
            return canvas.selector.getNode(target.nodeId);
        } catch {
            return null;
        }
    }, [canvas.selector, target]);

    const dialActions = useMemo(() => {
        if (!dropIntent) return [];
        try {
            return actionsForIntent(dropIntent);
        } catch {
            return [];
        }
    }, [actionsForIntent, dropIntent]);

    const { notices, nodeOptions, handleNoticeSave, handleNoticeDelete, handleUseCurrentSelection } = useNoticeHandling(
        emitNodeError,
        setNoticeMode,
        setEditingNoticeId,
        setNoticeDraft,
        noticeDraft,
        editingNoticeId,
    );

    const nodeOptionsForKind = useMemo(() => {
        return nodeOptions.filter((item) => item.kind === noticeDraft.targetNodeKind).map((item) => ({ label: item.label, value: item.value }));
    }, [nodeOptions, noticeDraft.targetNodeKind]);

    const filteredNotices = useMemo(() => {
        const query = noticeSearch.trim().toLowerCase();
        if (!query) return notices;
        return notices.filter((notice) => {
            const target = notice.target.scope === 'node' ? notice.target.node_id : 'global';
            return `${notice.title} ${notice.kind} ${notice.severity} ${notice.id} ${target}`.toLowerCase().includes(query);
        });
    }, [noticeSearch, notices]);

    const openNoticeManager = useCallback(
        (input?: OpenNoticeManagerInput) => {
            const mode = input?.mode ?? 'manage';
            setNoticeSearch('');
            setNoticeMode(mode);
            if (input?.noticeId) {
                const notice = notices.find((item) => item.id === input.noticeId);
                if (notice) {
                    setEditingNoticeId(notice.id);
                    setNoticeDraft(toDraft(notice));
                }
            } else if (mode === 'create') {
                setEditingNoticeId(null);
                setNoticeDraft(toDraft(undefined, input?.target));
            } else if (mode === 'manage' && notices.length) {
                setEditingNoticeId(notices[0].id);
                setNoticeDraft(toDraft(notices[0]));
            } else {
                setEditingNoticeId(null);
                setNoticeDraft(toDraft(undefined, input?.target));
            }
            setNoticeManagerOpen(true);
        },
        [notices],
    );

    const closeNoticeManager = useCallback(() => {
        setNoticeManagerOpen(false);
        setNoticeMode('manage');
    }, []);

    const toggleNoticeManager = useCallback(() => {
        setNoticeManagerOpen((current) => {
            const next = !current;
            if (next && notices.length) {
                setNoticeSearch('');
                setNoticeMode('manage');
                setEditingNoticeId(notices[0].id);
                setNoticeDraft(toDraft(notices[0]));
            }
            if (next && !notices.length) {
                setNoticeSearch('');
                setNoticeMode('manage');
                setEditingNoticeId(null);
                setNoticeDraft(toDraft());
            }
            return next;
        });
    }, [notices]);

    useEffect(() => {
        if (!target) return;
        const onPointerDown = (event: PointerEvent) => {
            const el = menuRef.current;
            if (!el || el.contains(event.target as Node)) return;
            setTarget(null);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setTarget(null);
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [target]);

    useEffect(() => {
        if (!edgeTarget) return;
        const onPointerDown = (event: PointerEvent) => {
            const el = menuRef.current;
            if (!el || el.contains(event.target as Node)) return;
            closeEdgeContextMenu();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeEdgeContextMenu();
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [closeEdgeContextMenu, edgeTarget]);

    useEffect(() => {
        if (!dropIntent) return;
        const onPointerDown = (event: PointerEvent) => {
            const el = dialRef.current;
            if (!el || el.contains(event.target as Node)) return;
            setDropIntent(null);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setDropIntent(null);
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [dropIntent]);

    useEffect(() => {
        if (!target) return;
        const timeout = window.setTimeout(() => {
            if (import.meta.env.DEV) console.warn('[node-context] Auto-closing stale context menu', { nodeId: target.nodeId });
            setTarget(null);
        }, OVERLAY_STALE_TIMEOUT_MS);
        return () => window.clearTimeout(timeout);
    }, [target]);

    useEffect(() => {
        if (!edgeTarget) return;
        const timeout = window.setTimeout(() => {
            if (import.meta.env.DEV) console.warn('[node-context] Auto-closing stale edge context menu', { edgeId: edgeTarget.edgeId });
            closeEdgeContextMenu();
        }, OVERLAY_STALE_TIMEOUT_MS);
        return () => window.clearTimeout(timeout);
    }, [closeEdgeContextMenu, edgeTarget]);

    useEffect(() => {
        if (!dropIntent) return;
        const timeout = window.setTimeout(() => {
            if (import.meta.env.DEV) console.warn('[node-context] Auto-closing stale drop dial', { nodeId: dropIntent.receiver.nodeId });
            setDropIntent(null);
        }, OVERLAY_STALE_TIMEOUT_MS);
        return () => window.clearTimeout(timeout);
    }, [dropIntent]);

    useEffect(() => {
        if (!noticeManagerOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeNoticeManager();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [closeNoticeManager, noticeManagerOpen]);

    const handleRenameCommit = useCallback(() => {
        if (!dialogTarget) return;
        if (!auth.canEditBranchContent) {
            emitNodeError(editDecision.reason ?? 'Editing is disabled for this actor.', { action: 'rename-node' });
            return;
        }
        const next = renameValue.trim();
        if (!next) return;
        try {
            canvas.api.editor.editLabel(dialogTarget.nodeId, next);
        } catch (error) {
            emitNodeError((error as Error)?.message ?? 'Failed to rename node', {
                action: 'rename-node',
                nodeId: dialogTarget.nodeId,
                surface: dialogTarget.surface,
            });
        }
        setRenameOpen(false);
        setDialogTarget(null);
    }, [auth.canEditBranchContent, canvas.api.editor, dialogTarget, editDecision.reason, emitNodeError, renameValue]);

    const handleDelete = useCallback(() => {
        if (!dialogTarget) return;
        if (!auth.canEditBranchContent) {
            emitNodeError(editDecision.reason ?? 'Editing is disabled for this actor.', { action: 'delete-node' });
            return;
        }
        try {
            canvas.api.editor.remove(dialogTarget.nodeId);
        } catch (error) {
            emitNodeError((error as Error)?.message ?? 'Failed to delete node', {
                action: 'delete-node',
                nodeId: dialogTarget.nodeId,
                surface: dialogTarget.surface,
            });
        }
        setDeleteOpen(false);
        setDialogTarget(null);
    }, [auth.canEditBranchContent, canvas.api.editor, dialogTarget, editDecision.reason, emitNodeError]);

    const templateSaveDraft = useMemo(() => {
        if (!templateSaveFieldId) return null;
        try {
            const node = canvas.selector.getNode(templateSaveFieldId);
            if (!node || node.kind !== 'field') return null;
            const props = canvas.api.builder.getProps() as Record<string, unknown>;
            const fields = ((props.fields ?? []) as Array<Record<string, unknown>>).filter((field) => typeof field?.id === 'string');
            const fieldsById = new Map(fields.map((field) => [String(field.id), field]));
            const root = fieldsById.get(templateSaveFieldId);
            if (!root) return null;
            const relations = detectRelationMaps(props);
            const discoveredIds = discoverGroupFieldIds(templateSaveFieldId, relations).filter((id) => fieldsById.has(id));
            const discoveredFields = discoveredIds.map((id) => ({
                originalId: id,
                field: sanitizeField((fieldsById.get(id) ?? {}) as Record<string, unknown>),
            }));
            return {
                rootLabel: String(node.raw?.label ?? 'Field'),
                rootType: String(node.raw?.type ?? 'text'),
                relations,
                discoveredFields,
            };
        } catch {
            return null;
        }
    }, [canvas.api.builder, canvas.selector, templateSaveFieldId]);

    useEffect(() => {
        const onOpen = (event: Event) => {
            const payload = (event as CustomEvent<{ nodeId?: string }>).detail;
            const fieldId = String(payload?.nodeId ?? '');
            if (!fieldId) return;
            setTemplateSaveFieldId(fieldId);
            setTemplateSaveMode('single');
            setTemplateLabel('');
            setTemplateName('');
            setTemplateSaveToCurrentBranch(true);
            setTemplateGroupSelection({});
            setTemplateFieldChecks({});
            setTemplateSaveOpen(true);
        };
        window.addEventListener('service-builder:open-template-save-dialog', onOpen as EventListener);
        return () => window.removeEventListener('service-builder:open-template-save-dialog', onOpen as EventListener);
    }, []);

    useEffect(() => {
        if (!templateSaveDraft || !templateSaveFieldId) return;
        const initialGroupSelection: Record<string, boolean> = {};
        for (const entry of templateSaveDraft.discoveredFields) initialGroupSelection[entry.originalId] = true;
        const initialChecks: Record<string, Record<string, boolean>> = {};
        for (const entry of templateSaveDraft.discoveredFields) {
            const checks: Record<string, boolean> = {};
            for (const key of Object.keys(entry.field)) checks[key] = true;
            initialChecks[entry.originalId] = checks;
        }
        setTemplateGroupSelection((current) => (Object.keys(current).length ? current : initialGroupSelection));
        setTemplateFieldChecks((current) => (Object.keys(current).length ? current : initialChecks));
        setTemplateLabel((current) => current || `${templateSaveDraft.rootLabel} group`);
        setTemplateName((current) => current || `${templateSaveDraft.rootLabel} Template`);
    }, [templateSaveDraft, templateSaveFieldId]);

    const handleTemplateSave = useCallback(async () => {
        if (!templateSaveDraft || !templateSaveFieldId) return;
        if (!auth.canWriteTemplates) {
            emitNodeError(templateDecision.reason ?? 'Template editing is disabled for this actor.', { action: 'save-field-template' });
            return;
        }
        try {
            const rootEntry = templateSaveDraft.discoveredFields.find((entry) => entry.originalId === templateSaveFieldId);
            if (!rootEntry) throw new Error('Selected field no longer exists.');
            if (templateSaveMode === 'single') {
                const field = pickCheckedProperties(rootEntry.field, templateFieldChecks[templateSaveFieldId] ?? {});
                const resolvedName = templateName.trim() || `${templateSaveDraft.rootLabel} Template`;
                const definition = {
                    templateType: 'field',
                    mode: 'single',
                    version: 1,
                    field,
                };
                const result = await ws.createTemplate({
                    name: resolvedName,
                    key: makeTemplateKey(resolvedName || templateSaveDraft.rootLabel || 'field'),
                    kind: templateSaveDraft.rootType,
                    branchId: templateSaveToCurrentBranch ? (ws.branches.currentId ?? undefined) : (null as string | null),
                    definition,
                    defaults: (canvas.selector.getNode(templateSaveFieldId) as any)?.raw?.defaults,
                    published: false,
                });
                if (!result.ok)
                    throw new Error(('error' in result ? result.error.message : 'Failed to create template') ?? 'Failed to create template');
            } else {
                const selected = new Set(
                    Object.entries(templateGroupSelection)
                        .filter(([, included]) => included)
                        .map(([fieldId]) => fieldId),
                );
                if (!selected.size) throw new Error('Cannot save an empty group.');
                if (!selected.has(templateSaveFieldId)) selected.add(templateSaveFieldId);
                const filteredRelations = filterRelationsForSelection(templateSaveDraft.relations, selected);
                const fields = templateSaveDraft.discoveredFields
                    .filter((entry) => selected.has(entry.originalId))
                    .map((entry) => ({
                        originalId: entry.originalId,
                        field: pickCheckedProperties(entry.field, templateFieldChecks[entry.originalId] ?? {}),
                    }));
                const definition = {
                    templateType: 'field',
                    mode: 'group',
                    version: 1,
                    label: templateLabel.trim() || `${templateSaveDraft.rootLabel} group`,
                    rootOriginalId: templateSaveFieldId,
                    fields,
                    relations: filteredRelations,
                };
                const resolvedName = templateName.trim() || definition.label;

                const result = await ws.createTemplate({
                    name: resolvedName,
                    key: makeTemplateKey(resolvedName || 'field-group'),
                    kind: templateSaveDraft.rootType,
                    branchId: templateSaveToCurrentBranch ? (ws.branches.currentId ?? undefined) : (null as string | null),
                    definition,
                    defaults: (canvas.selector.getNode(templateSaveFieldId) as any)?.raw?.defaults,
                    published: false,
                });
                if (!result.ok)
                    throw new Error(('error' in result ? result.error.message : 'Failed to create template') ?? 'Failed to create template');
            }
            await ws.refresh.templates({ branchId: ws.branches.currentId ?? undefined });
            setTemplateSaveOpen(false);
        } catch (error) {
            emitNodeError((error as Error)?.message ?? 'Failed to save field as template', {
                action: 'save-field-template',
                nodeId: templateSaveFieldId,
            });
        }
    }, [
        auth.canWriteTemplates,
        canvas.selector,
        emitNodeError,
        templateDecision.reason,
        templateFieldChecks,
        templateGroupSelection,
        templateLabel,
        templateName,
        templateSaveToCurrentBranch,
        templateSaveDraft,
        templateSaveFieldId,
        templateSaveMode,
        ws,
    ]);

    const anchorStyle = useMemo(() => {
        if (!target || typeof window === 'undefined') return null;
        const width = 220;
        const height = target.nodeKind === 'field' ? 260 : 220;
        const padding = 12;
        const left = Math.max(padding, Math.min(target.clientX, window.innerWidth - width - padding));
        const top = Math.max(padding, Math.min(target.clientY, window.innerHeight - height - padding));
        return { left, top };
    }, [target]);

    const edgeAnchorStyle = useMemo(() => {
        if (!edgeTarget || typeof window === 'undefined') return null;
        const width = 220;
        const height = 210;
        const padding = 12;
        const left = Math.max(padding, Math.min(edgeTarget.clientX, window.innerWidth - width - padding));
        const top = Math.max(padding, Math.min(edgeTarget.clientY, window.innerHeight - height - padding));
        return { left, top };
    }, [edgeTarget]);

    const handleEdgeDisconnect = useCallback(() => {
        if (!edgeTarget) return;
        canvas.api.editor.disconnect(edgeTarget.kind, edgeTarget.from, edgeTarget.to);
        closeEdgeContextMenu();
    }, [canvas.api.editor, closeEdgeContextMenu, edgeTarget]);

    const handleEdgeTypeChange = useCallback(
        (nextKind: EdgeRelationKind) => {
            if (!edgeTarget) return;
            if (edgeTarget.kind === nextKind) return;
            canvas.api.editor.disconnect(edgeTarget.kind, edgeTarget.from, edgeTarget.to);
            canvas.api.editor.connect(nextKind, edgeTarget.from, edgeTarget.to);
            closeEdgeContextMenu();
        },
        [canvas.api.editor, closeEdgeContextMenu, edgeTarget],
    );

    const dialAnchorStyle = useMemo(() => {
        if (!dropIntent || typeof window === 'undefined') return null;
        const size = 220;
        const padding = 14;
        const left = Math.max(padding, Math.min(dropIntent.pointer.x - size / 2, window.innerWidth - size - padding));
        const top = Math.max(padding, Math.min(dropIntent.pointer.y - size / 2, window.innerHeight - size - padding));
        return { left, top, size };
    }, [dropIntent]);

    const value = useMemo<NodeContextMenuValue>(
        () => ({
            openNodeContextMenu,
            closeNodeContextMenu,
            openEdgeContextMenu,
            closeEdgeContextMenu,
            canAcceptDropPayload,
            handleNodeDrop,
            openNoticeManager,
            closeNoticeManager,
            toggleNoticeManager,
            isNoticeManagerOpen: noticeManagerOpen,
        }),
        [
            canAcceptDropPayload,
            closeNodeContextMenu,
            closeEdgeContextMenu,
            closeNoticeManager,
            handleNodeDrop,
            noticeManagerOpen,
            openNodeContextMenu,
            openEdgeContextMenu,
            openNoticeManager,
            toggleNoticeManager,
        ],
    );
    const hasPortalContent = Boolean(target || edgeTarget || dropIntent || renameOpen || deleteOpen || noticeManagerOpen || templateSaveOpen);

    return (
        <NodeContextMenuContext.Provider value={value}>
            {children}
            {typeof document !== 'undefined' && hasPortalContent
                ? createPortal(
                      <>
                          {target && anchorStyle ? (
                              <ContextMenu
                                  target={target}
                                  setTarget={setTarget}
                                  setDialogTarget={setDialogTarget}
                                  setRenameOpen={setRenameOpen}
                                  setDeleteOpen={setDeleteOpen}
                                  openNoticeManager={openNoticeManager}
                                  activeNode={activeNode}
                                  anchorStyle={anchorStyle}
                                  menuRef={menuRef}
                                  setRenameValue={setRenameValue}
                              />
                          ) : null}
                          {edgeTarget && edgeAnchorStyle ? (
                              <div
                                  ref={menuRef}
                                  className="fixed z-40 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                                  style={{ left: edgeAnchorStyle.left, top: edgeAnchorStyle.top }}
                                  role="menu"
                              >
                                  <button
                                      type="button"
                                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                      onClick={handleEdgeDisconnect}
                                  >
                                      Disconnect
                                  </button>
                                  <div className="relative" onMouseLeave={() => setEdgeTypeSubmenuOpen(false)}>
                                      <button
                                          type="button"
                                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                          onMouseEnter={() => setEdgeTypeSubmenuOpen(true)}
                                          onFocus={() => setEdgeTypeSubmenuOpen(true)}
                                          onClick={() => setEdgeTypeSubmenuOpen((current) => !current)}
                                          aria-haspopup="menu"
                                          aria-expanded={edgeTypeSubmenuOpen}
                                      >
                                          <span>Change type</span>
                                          <span className="text-slate-400">▸</span>
                                      </button>
                                      {edgeTypeSubmenuOpen ? (
                                          <div
                                              className="absolute top-0 left-full z-50 ml-1 min-w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                                              role="menu"
                                          >
                                              {(['bind', 'include', 'exclude'] as EdgeRelationKind[]).map((kind) => (
                                                  <button
                                                      key={kind}
                                                      type="button"
                                                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
                                                      onClick={() => handleEdgeTypeChange(kind)}
                                                      disabled={edgeTarget.kind === kind}
                                                  >
                                                      {kind}
                                                  </button>
                                              ))}
                                          </div>
                                      ) : null}
                                  </div>
                              </div>
                          ) : null}

                          {dropIntent && dialAnchorStyle ? (
                              <Dial
                                  dialActions={dialActions}
                                  dropIntent={dropIntent}
                                  dialAnchorStyle={dialAnchorStyle}
                                  dialRef={dialRef}
                                  emitNodeError={emitNodeError}
                                  setDropIntent={setDropIntent}
                              />
                          ) : null}
                          {noticeManagerOpen ? (
                              <NoticeManager
                                  noticeManagerOpen={noticeManagerOpen}
                                  closeNoticeManager={closeNoticeManager}
                                  noticeSearch={noticeSearch}
                                  setNoticeSearch={setNoticeSearch}
                                  filteredNotices={filteredNotices}
                                  editingNoticeId={editingNoticeId}
                                  setNoticeMode={setNoticeMode}
                                  setEditingNoticeId={setEditingNoticeId}
                                  setNoticeDraft={setNoticeDraft}
                                  noticeMode={noticeMode}
                                  handleNoticeDelete={handleNoticeDelete}
                                  noticeDraft={noticeDraft}
                                  handleUseCurrentSelection={handleUseCurrentSelection}
                                  nodeOptions={nodeOptions}
                                  nodeOptionsForKind={nodeOptionsForKind}
                                  handleNoticeSave={handleNoticeSave}
                              />
                          ) : null}
                          <AlertDialog
                              open={renameOpen}
                              onOpenChange={(open) => {
                                  setRenameOpen(open);
                                  if (!open) setDialogTarget(null);
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
                                          handleRenameCommit();
                                      }}
                                      className="space-y-4"
                                  >
                                      <RenameNodeField value={renameValue} onChange={setRenameValue} onEscape={() => setRenameOpen(false)} />
                                      <AlertDialogFooter>
                                          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                          <AlertDialogAction type="submit">Save</AlertDialogAction>
                                      </AlertDialogFooter>
                                  </form>
                              </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog
                              open={deleteOpen}
                              onOpenChange={(open) => {
                                  setDeleteOpen(open);
                                  if (!open) setDialogTarget(null);
                              }}
                          >
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Delete node</AlertDialogTitle>
                                      <AlertDialogDescription>This action removes the selected node from the builder graph.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                      <AlertDialogAction type="button" className="bg-rose-600 hover:bg-rose-700" onClick={handleDelete}>
                                          Delete
                                      </AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog
                              open={templateSaveOpen}
                              onOpenChange={(open) => {
                                  setTemplateSaveOpen(open);
                                  if (!open) setTemplateSaveFieldId(null);
                              }}
                          >
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Save Field Template</AlertDialogTitle>
                                      <AlertDialogDescription>Choose how to save this field and review copied properties.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  {templateSaveDraft ? (
                                      <div className="space-y-4">
                                          <div className="flex gap-2">
                                              <InputField
                                                  variant={'toggle-group'}
                                                  options={[
                                                      { label: 'Single Field', value: 'single' },
                                                      { label: 'Field Group/Tree', value: 'group' },
                                                  ]}
                                                  value={templateSaveMode}
                                                  onChange={(e) => setTemplateSaveMode(e.value)}
                                              />
                                          </div>

                                          {templateSaveMode === 'group' ? (
                                              <div className="space-y-2">
                                                  <label className="block text-sm font-medium">Template label</label>
                                                  <InputField
                                                      variant={'text'}
                                                      value={templateLabel}
                                                      onChange={(event) => setTemplateLabel(event.value)}
                                                  />
                                                  <div className="space-y-1">
                                                      <p className="text-sm font-medium">Fields in group</p>
                                                      {templateSaveDraft.discoveredFields.map((entry) => (
                                                          <label key={entry.originalId} className="flex items-center gap-2 text-sm">
                                                              <input
                                                                  type="checkbox"
                                                                  checked={templateGroupSelection[entry.originalId] !== false}
                                                                  onChange={(event) =>
                                                                      setTemplateGroupSelection((current) => ({
                                                                          ...current,
                                                                          [entry.originalId]: event.target.checked,
                                                                      }))
                                                                  }
                                                              />
                                                              <span>{String((entry.field.label as string) ?? entry.originalId)}</span>
                                                          </label>
                                                      ))}
                                                  </div>
                                              </div>
                                          ) : null}
                                          <div className="space-y-2">
                                              <label className="block text-sm font-medium">Template name</label>
                                              <InputField
                                                  variant={'text'}
                                                  value={templateName}
                                                  onChange={(event) => setTemplateName(String(event.value ?? ''))}
                                              />
                                              <label className="flex items-center gap-2 text-sm">
                                                  <input
                                                      type="checkbox"
                                                      checked={templateSaveToCurrentBranch}
                                                      onChange={(event) => setTemplateSaveToCurrentBranch(event.target.checked)}
                                                  />
                                                  <span>Save to current branch</span>
                                              </label>
                                          </div>

                                          <ScrollArea className="max-h-72 space-y-2 h-full">
                                              {(templateSaveMode === 'single'
                                                  ? templateSaveDraft.discoveredFields.filter((entry) => entry.originalId === templateSaveFieldId)
                                                  : templateSaveDraft.discoveredFields.filter(
                                                        (entry) => templateGroupSelection[entry.originalId] !== false,
                                                    )
                                              ).map((entry) => (
                                                  <details key={entry.originalId} open className="rounded border border-slate-200 dark:border-slate-700 p-2">
                                                      <summary className="cursor-pointer text-sm font-medium">
                                                          {String((entry.field.label as string) ?? entry.originalId)} ({entry.originalId})
                                                      </summary>
                                                      <div className="mt-2 grid grid-cols-1 gap-1">
                                                          {Object.keys(entry.field).map((key) => (
                                                              <label key={key} className="flex items-center gap-2 text-xs">
                                                                  <input
                                                                      type="checkbox"
                                                                      checked={templateFieldChecks[entry.originalId]?.[key] !== false}
                                                                      onChange={(event) =>
                                                                          setTemplateFieldChecks((current) => ({
                                                                              ...current,
                                                                              [entry.originalId]: {
                                                                                  ...(current[entry.originalId] ?? {}),
                                                                                  [key]: event.target.checked,
                                                                              },
                                                                          }))
                                                                      }
                                                                  />
                                                                  <span className="font-mono">{key}</span>
                                                              </label>
                                                          ))}
                                                      </div>
                                                  </details>
                                              ))}
                                          </ScrollArea>

                                          <AlertDialogFooter>
                                              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                              <AlertDialogAction type="button" disabled={!templateName.trim()} onClick={() => void handleTemplateSave()}>
                                                  Save template
                                              </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </div>
                                  ) : null}
                              </AlertDialogContent>
                          </AlertDialog>
                      </>,
                      document.body,
                  )
                : null}
        </NodeContextMenuContext.Provider>
    );
}

export function useNodeContextMenu() {
    const ctx = useContext(NodeContextMenuContext);
    if (!ctx) throw new Error('useNodeContextMenu must be used within NodeContextMenuProvider');
    return ctx;
}
