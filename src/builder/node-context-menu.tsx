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
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenu } from './node-context/components/ContextMenu.tsx';
import { Dial } from './node-context/components/Dial.tsx';
import { NoticeManager } from './node-context/components/NoticeManager.tsx';
import { RenameNodeField } from './node-context/components/RenameNodeField.tsx';
import { useDropHandling, useNoticeHandling } from './node-context/hooks.ts';
import { OVERLAY_STALE_TIMEOUT_MS } from './node-context/types';
import type {
    DropIntent,
    HandleNodeDropInput,
    NodeContextTarget,
    NodeKind,
    NoticeDraft,
    NoticeManagerMode,
    OpenNodeContextMenuInput,
    OpenNoticeManagerInput,
} from './node-context/types.ts';
import { inferNodeKindFromId, toDraft } from './node-context/utils.ts';
import { deriveWorkspaceAuthorization, getAuthorizationDecision } from '@/workspace/authorization.ts';

type NodeContextMenuValue = {
    openNodeContextMenu: (input: OpenNodeContextMenuInput) => void;
    closeNodeContextMenu: () => void;
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

    const menuRef = useRef<HTMLDivElement | null>(null);
    const dialRef = useRef<HTMLDivElement | null>(null);

    const closeNodeContextMenu = useCallback(() => setTarget(null), []);

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

    const anchorStyle = useMemo(() => {
        if (!target || typeof window === 'undefined') return null;
        const width = 220;
        const height = target.nodeKind === 'field' ? 260 : 220;
        const padding = 12;
        const left = Math.max(padding, Math.min(target.clientX, window.innerWidth - width - padding));
        const top = Math.max(padding, Math.min(target.clientY, window.innerHeight - height - padding));
        return { left, top };
    }, [target]);

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
            closeNoticeManager,
            handleNodeDrop,
            noticeManagerOpen,
            openNodeContextMenu,
            openNoticeManager,
            toggleNoticeManager,
        ],
    );
    const hasPortalContent = Boolean(target || dropIntent || renameOpen || deleteOpen || noticeManagerOpen);

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
                                      <RenameNodeField
                                          value={renameValue}
                                          onChange={setRenameValue}
                                          onEscape={() => setRenameOpen(false)}
                                      />
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
