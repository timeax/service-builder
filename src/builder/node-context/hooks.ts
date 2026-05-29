import { getNodePropertyCapabilities } from '@/panels/right/partials/properties/components/node-capabilities.ts';
import { resolveFieldOptionCapability } from '@/panels/right/partials/properties/components/descriptor-options.ts';
import { deriveWorkspaceAuthorization, getAuthorizationDecision } from '@/workspace/authorization.ts';
import { useFallbackQuickAdd } from '@/workspace/fallback-quick-add.tsx';
import { useInputs } from '@timeax/digital-service-engine/react';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useCallback, useMemo } from 'react';
import {
    type BuiltinAssetPayload,
    type DialAction,
    DRAG_MIME_ASSET_BUILTIN,
    DRAG_MIME_ASSET_TEMPLATE,
    DRAG_MIME_SERVICE,
    DRAG_MIME_TYPES,
    type DropIntent,
    type DropSource,
    type NodeKind,
    type ServicePropsNotice,
    type TemplateAssetPayload,
} from './types.ts';
import { buildFieldId, draftToNotice, inferNodeKindFromId, normalizeNotice, parseJson, toDraft } from './utils.ts';
import {
    isGroupTemplateDefinition,
    isSingleTemplateDefinition,
    toSingleFieldDefinition,
    withFreshOptionIds,
} from './template-utils.ts';

type MoveDirection = 'up' | 'down';
type TemplateFieldCandidate = {
    id: string;
    type?: unknown;
    meta?: Record<string, unknown>;
    options?: Array<unknown>;
} & Record<string, unknown>;

function moveIndex(index: number, direction: MoveDirection) {
    return direction === 'up' ? index - 1 : index + 1;
}

export function useNodeActions(
    target: { nodeId: string; nodeKind: NodeKind; surface: string } | null,
    setTarget: (target: { nodeId: string; nodeKind: NodeKind; surface: string } | null) => void,
    setDialogTarget: (target: { nodeId: string; nodeKind: NodeKind; surface: string } | null) => void,
    setRenameOpen: (open: boolean) => void,
    setDeleteOpen: (open: boolean) => void,
    openNoticeManager: (input?: any) => void,
) {
    const canvas = useCanvas();
    const { registry } = useInputs();
    const ws = useWorkspace();
    const fallbackQuickAdd = useFallbackQuickAdd();
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
    const ensureBranchEdit = useCallback(
        (action: string) => {
            if (auth.canEditBranchContent) return true;
            emitNodeError(editDecision.reason ?? 'Editing is disabled for this actor.', { action });
            return false;
        },
        [auth.canEditBranchContent, editDecision.reason, emitNodeError],
    );
    const ensureTemplateWrite = useCallback(
        (action: string) => {
            if (auth.canWriteTemplates) return true;
            emitNodeError(templateDecision.reason ?? 'Template editing is disabled for this actor.', { action });
            return false;
        },
        [auth.canWriteTemplates, emitNodeError, templateDecision.reason],
    );
    const resolveCurrentTagId = useCallback(() => {
        return canvas.api.selection.currentTag?.() ?? 't:root';
    }, [canvas.api.selection]);
    const resolveFieldContextOrder = useCallback(
        (tagId: string) => {
            const props = canvas.api.builder.getProps() as { fields?: Array<{ id: string }>; order_for_tags?: Record<string, string[]> };
            const fieldIds = new Set((props.fields ?? []).map((field) => field.id));
            const visibleGroup = canvas.api.selection.visibleGroup?.();
            const visibleFromSelection =
                visibleGroup?.kind === 'single' && visibleGroup.group.tagId === tagId
                    ? (visibleGroup.group.fieldIds ?? []).map(String)
                    : canvas.api.builder.visibleFields(tagId, (canvas.selectionInfo.optionIds ?? []) as string[]).map(String);

            const pinned = (props.order_for_tags?.[tagId] ?? []).filter((fieldId) => fieldIds.has(fieldId));
            const pinnedSet = new Set(pinned);
            const merged = [...pinned, ...visibleFromSelection.filter((fieldId) => fieldIds.has(fieldId) && !pinnedSet.has(fieldId))];
            return merged;
        },
        [canvas.api.builder, canvas.api.selection, canvas.selectionInfo.optionIds],
    );
    const moveFieldInGlobalOrder = useCallback(
        (fieldId: string, direction: MoveDirection) => {
            const editorAny = canvas.api.editor as any;
            if (typeof editorAny.transact !== 'function' || typeof editorAny.patchProps !== 'function') {
                emitNodeError('Field order mutation APIs are unavailable on this editor instance', {
                    action: 'move-field-global',
                    fieldId,
                    direction,
                });
                return false;
            }

            let moved = false;
            editorAny.transact(direction === 'up' ? 'Move field up' : 'Move field down', () => {
                editorAny.patchProps((props: { fields?: Array<{ id: string }> }) => {
                    const fields = props.fields ?? [];
                    const current = fields.findIndex((field) => field.id === fieldId);
                    const next = moveIndex(current, direction);
                    if (current < 0 || next < 0 || next >= fields.length) return;
                    const [pulled] = fields.splice(current, 1);
                    fields.splice(next, 0, pulled);
                    moved = true;
                });
            });

            return moved;
        },
        [canvas.api.editor, emitNodeError],
    );
    const moveState = useMemo(() => {
        if (!target) {
            return {
                canMoveUp: false,
                canMoveDown: false,
                canMoveContextUp: false,
                canMoveContextDown: false,
            };
        }

        const props = canvas.api.builder.getProps() as {
            filters?: Array<{ id: string; bind_id?: string }>;
            fields?: Array<{ id: string; options?: Array<{ id: string }> }>;
        };
        if (target.nodeKind === 'tag') {
            const tags = props.filters ?? [];
            const tag = tags.find((item) => item.id === target.nodeId);
            const groupKey = tag?.bind_id ?? '__root__';
            const siblings = tags.filter((item) => (item.bind_id ?? '__root__') === groupKey);
            const index = siblings.findIndex((item) => item.id === target.nodeId);
            return {
                canMoveUp: index > 0,
                canMoveDown: index >= 0 && index < siblings.length - 1,
                canMoveContextUp: false,
                canMoveContextDown: false,
            };
        }

        if (target.nodeKind === 'option') {
            const ownerField = (props.fields ?? []).find((field) => (field.options ?? []).some((option) => option.id === target.nodeId));
            const options = ownerField?.options ?? [];
            const index = options.findIndex((option) => option.id === target.nodeId);
            return {
                canMoveUp: index > 0,
                canMoveDown: index >= 0 && index < options.length - 1,
                canMoveContextUp: false,
                canMoveContextDown: false,
            };
        }

        const fields = props.fields ?? [];
        const fieldIndex = fields.findIndex((field) => field.id === target.nodeId);
        const tagId = resolveCurrentTagId();
        const contextOrder = resolveFieldContextOrder(tagId);
        const contextIndex = contextOrder.indexOf(target.nodeId);
        return {
            canMoveUp: fieldIndex > 0,
            canMoveDown: fieldIndex >= 0 && fieldIndex < fields.length - 1,
            canMoveContextUp: contextIndex > 0,
            canMoveContextDown: contextIndex >= 0 && contextIndex < contextOrder.length - 1,
        };
    }, [
        canvas.api.builder,
        target,
        canvas.props,
        canvas.selectionInfo,
        resolveCurrentTagId,
        resolveFieldContextOrder,
    ]);

    const batchSelectionIds = useMemo(() => {
        if (!target) return [] as string[];
        if (Array.isArray((target as any).effectiveTargetIds) && (target as any).effectiveTargetIds.length) {
            const ids = Array.from(new Set(((target as any).effectiveTargetIds as string[]).map(String).filter(Boolean)));
            if (ids.length > 1 && ids.includes(target.nodeId)) return ids;
            return [];
        }
        const combinedSelection = Array.from(
            new Set(
                [
                    canvas.activeId,
                    ...((canvas.selectionInfo.ids ?? []) as string[]),
                    ...((canvas.selectionInfo.tagIds ?? []) as string[]),
                    ...((canvas.selectionInfo.fieldIds ?? []) as string[]),
                    ...((canvas.selectionInfo.optionIds ?? []) as string[]),
                ]
                    .filter(Boolean)
                    .map(String),
            ),
        );
        if (combinedSelection.length < 2) return [];
        if (!combinedSelection.includes(target.nodeId)) return [];
        return combinedSelection;
    }, [canvas.activeId, canvas.selectionInfo.fieldIds, canvas.selectionInfo.ids, canvas.selectionInfo.optionIds, canvas.selectionInfo.tagIds, target]);
    const handleDuplicate = useCallback(() => {
        if (!target) return;
        if (!ensureBranchEdit('duplicate-node')) return;
        try {
            if (batchSelectionIds.length > 1 && typeof (canvas.api.editor as any).duplicateMany === 'function') {
                const duplicatedIds = (canvas.api.editor as any).duplicateMany(batchSelectionIds);
                if (Array.isArray(duplicatedIds) && duplicatedIds.length) {
                    canvas.setActive(duplicatedIds[0]);
                    canvas.api.select(duplicatedIds);
                }
                setTarget(null);
                return;
            }
            const node = canvas.selector.getNode(target.nodeId);
            let ref: { kind: 'tag'; id: string } | { kind: 'field'; id: string } | { kind: 'option'; id: string; fieldId: string };
            if (node.kind === 'option') ref = { kind: 'option', id: node.id, fieldId: node.field().id };
            else if (node.kind === 'field') ref = { kind: 'field', id: node.id };
            else ref = { kind: 'tag', id: node.id };
            const duplicatedId = canvas.api.editor.duplicate(ref as any);
            focusNode(duplicatedId);
        } catch (error) {
            emitNodeError((error as Error)?.message ?? 'Failed to duplicate node', {
                action: 'duplicate-node',
                nodeId: target.nodeId,
                surface: target.surface,
            });
        }
        setTarget(null);
    }, [batchSelectionIds, canvas.api, canvas.selector, emitNodeError, ensureBranchEdit, focusNode, target, setTarget]);

    const handleCopyId = useCallback(async () => {
        if (!target) return;
        try {
            await navigator.clipboard.writeText(target.nodeId);
        } catch {
            emitNodeError('Failed to copy node id', {
                action: 'copy-node-id',
                nodeId: target.nodeId,
            });
        }
        setTarget(null);
    }, [emitNodeError, target, setTarget]);

    const handleSaveAsTemplate = useCallback(async () => {
        if (!target || target.nodeKind !== 'field') return;
        if (!ensureTemplateWrite('save-field-template')) return;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('service-builder:open-template-save-dialog', {
                    detail: { nodeId: target.nodeId, surface: target.surface },
                }),
            );
        }
        setTarget(null);
    }, [ensureTemplateWrite, setTarget, target]);

    const isFieldOptionsShown = useMemo(() => {
        if (!target || target.nodeKind !== 'field') return false;
        const api = canvas.api as any;
        if (typeof api.isFieldOptionsShown === 'function') {
            return !!api.isFieldOptionsShown(target.nodeId);
        }
        return false;
    }, [canvas.api, canvas.props, target]);

    const handleToggleFieldOptions = useCallback(() => {
        if (!target || target.nodeKind !== 'field') return;
        if (!ensureBranchEdit('toggle-field-option-nodes')) return;
        const api = canvas.api as any;
        try {
            if (typeof api.isFieldOptionsShown === 'function' && typeof api.setFieldOptionsShown === 'function') {
                const next = !api.isFieldOptionsShown(target.nodeId);
                api.setFieldOptionsShown(target.nodeId, next);
                setTarget(null);
                return;
            }
            if (typeof api.toggleFieldOptions === 'function') {
                api.toggleFieldOptions(target.nodeId);
                setTarget(null);
                return;
            }
            emitNodeError('Option visibility controls are unavailable on this canvas API', {
                action: 'toggle-field-option-nodes',
                nodeId: target.nodeId,
                surface: target.surface,
            });
        } catch (error) {
            emitNodeError((error as Error)?.message ?? 'Failed to toggle option-node visibility', {
                action: 'toggle-field-option-nodes',
                nodeId: target.nodeId,
                surface: target.surface,
            });
        }
        setTarget(null);
    }, [canvas.api, emitNodeError, ensureBranchEdit, setTarget, target]);

    const fallbackTarget = useMemo(() => {
        if (!target) return null;

        try {
            const node = canvas.selector.getNode(target.nodeId) as {
                id: string;
                kind: NodeKind;
                raw?: { label?: string; service_id?: number | string; bind_id?: string };
                field?: () => { raw?: { bind_id?: string } };
            };
            const serviceId = node?.raw?.service_id;
            if (serviceId === undefined || serviceId === null) return null;
            const tagId =
                target.nodeKind === 'tag'
                    ? target.nodeId
                    : target.nodeKind === 'field'
                      ? node.raw?.bind_id ?? resolveCurrentTagId()
                      : node.field?.()?.raw?.bind_id ?? resolveCurrentTagId();

            return {
                nodeId: target.nodeId,
                nodeKind: target.nodeKind,
                nodeLabel: String(node?.raw?.label ?? target.nodeId),
                serviceId,
                tagId,
            };
        } catch {
            return null;
        }
    }, [canvas.selector, resolveCurrentTagId, target]);

    const handleOpenFallbackQuickAdd = useCallback(() => {
        if (!fallbackTarget) return;
        fallbackQuickAdd.openForNode({
            nodeId: fallbackTarget.nodeId,
            nodeKind: fallbackTarget.nodeKind,
            nodeLabel: fallbackTarget.nodeLabel,
            serviceId: fallbackTarget.serviceId,
            tagId: fallbackTarget.tagId,
        });
        setTarget(null);
    }, [fallbackQuickAdd, fallbackTarget, setTarget]);

    const handleMove = useCallback(
        (direction: MoveDirection) => {
            if (!target) return;
            if (!ensureBranchEdit('move-node-global')) return;
            try {
                if (target.nodeKind === 'tag') {
                    if (direction === 'up' && !moveState.canMoveUp) return;
                    if (direction === 'down' && !moveState.canMoveDown) return;
                    const props = canvas.api.builder.getProps() as { filters?: Array<{ id: string; bind_id?: string }> };
                    const tags = props.filters ?? [];
                    const tag = tags.find((item) => item.id === target.nodeId);
                    const groupKey = tag?.bind_id ?? '__root__';
                    const siblings = tags.filter((item) => (item.bind_id ?? '__root__') === groupKey);
                    const index = siblings.findIndex((item) => item.id === target.nodeId);
                    const next = moveIndex(index, direction);
                    if (index < 0 || next < 0 || next >= siblings.length) return;
                    canvas.api.editor.placeNode(target.nodeId, { index: next });
                    setTarget(null);
                    return;
                }

                if (target.nodeKind === 'option') {
                    if (direction === 'up' && !moveState.canMoveUp) return;
                    if (direction === 'down' && !moveState.canMoveDown) return;
                    const props = canvas.api.builder.getProps() as { fields?: Array<{ id: string; options?: Array<{ id: string }> }> };
                    const ownerField = (props.fields ?? []).find((field) => (field.options ?? []).some((option) => option.id === target.nodeId));
                    const options = ownerField?.options ?? [];
                    const index = options.findIndex((option) => option.id === target.nodeId);
                    const next = moveIndex(index, direction);
                    if (index < 0 || next < 0 || next >= options.length) return;
                    canvas.api.editor.placeOption(target.nodeId, { index: next });
                    setTarget(null);
                    return;
                }

                if (direction === 'up' && !moveState.canMoveUp) return;
                if (direction === 'down' && !moveState.canMoveDown) return;
                const moved = moveFieldInGlobalOrder(target.nodeId, direction);
                if (moved) setTarget(null);
            } catch (error) {
                emitNodeError((error as Error)?.message ?? 'Failed to move node', {
                    action: 'move-node-global',
                    nodeId: target.nodeId,
                    nodeKind: target.nodeKind,
                    surface: target.surface,
                    direction,
                });
            }
        },
        [canvas.api.builder, canvas.api.editor, emitNodeError, ensureBranchEdit, moveFieldInGlobalOrder, moveState.canMoveDown, moveState.canMoveUp, setTarget, target],
    );

    const handleMoveInContext = useCallback(
        (direction: MoveDirection) => {
            if (!target || target.nodeKind !== 'field') return;
            if (!ensureBranchEdit('move-field-context')) return;
            if (direction === 'up' && !moveState.canMoveContextUp) return;
            if (direction === 'down' && !moveState.canMoveContextDown) return;
            const currentTagId = resolveCurrentTagId();
            const contextOrder = resolveFieldContextOrder(currentTagId);
            const index = contextOrder.indexOf(target.nodeId);
            const next = moveIndex(index, direction);
            if (index < 0 || next < 0 || next >= contextOrder.length) return;

            try {
                const editorAny = canvas.api.editor as any;
                if (typeof editorAny.transact === 'function' && typeof editorAny.patchProps === 'function') {
                    canvas.api.editor.transact(direction === 'up' ? 'Move field up in context' : 'Move field down in context', () => {
                        editorAny.patchProps((props: { order_for_tags?: Record<string, string[]> }) => {
                            const map = (props.order_for_tags ??= {});
                            map[currentTagId] = [...contextOrder];
                        });
                        canvas.api.editor.placeNode(target.nodeId, {
                            scopeTagId: currentTagId,
                            index: next,
                        });
                    });
                } else {
                    canvas.api.editor.placeNode(target.nodeId, {
                        scopeTagId: currentTagId,
                        index: next,
                    });
                }
                setTarget(null);
            } catch (error) {
                emitNodeError((error as Error)?.message ?? 'Failed to move field in context', {
                    action: 'move-field-context',
                    nodeId: target.nodeId,
                    currentTagId,
                    direction,
                });
            }
        },
        [
            canvas.api.editor,
            emitNodeError,
            moveState.canMoveContextDown,
            moveState.canMoveContextUp,
            resolveCurrentTagId,
            resolveFieldContextOrder,
            setTarget,
            target,
            ensureBranchEdit,
        ],
    );

    const hasServiceSelection = useMemo(() => {
        try {
            return batchSelectionIds.some((id) => {
                const node = canvas.selector.getNode(id) as any;
                return node?.raw?.service_id !== undefined && node?.raw?.service_id !== null;
            });
        } catch {
            return false;
        }
    }, [batchSelectionIds, canvas.selector]);

    const handleDeleteMany = useCallback(() => {
        if (!ensureBranchEdit('delete-many')) return;
        if (batchSelectionIds.length < 2) return;
        const editorAny = canvas.api.editor as any;
        if (typeof editorAny.removeMany !== 'function') {
            emitNodeError('Batch delete is unavailable on this editor instance', { action: 'delete-many' });
            return;
        }
        editorAny.removeMany(batchSelectionIds);
        setTarget(null);
    }, [batchSelectionIds, canvas.api.editor, emitNodeError, ensureBranchEdit, setTarget]);

    const handleClearServiceMany = useCallback(() => {
        if (!ensureBranchEdit('clear-service-many')) return;
        if (!batchSelectionIds.length) return;
        const editorAny = canvas.api.editor as any;
        if (typeof editorAny.clearServiceMany !== 'function') {
            emitNodeError('Batch unlink service is unavailable on this editor instance', { action: 'clear-service-many' });
            return;
        }
        editorAny.clearServiceMany(batchSelectionIds);
        setTarget(null);
    }, [batchSelectionIds, canvas.api.editor, emitNodeError, ensureBranchEdit, setTarget]);

    const handleAutoCreateMissingOptions = useCallback(() => {
        if (!ensureBranchEdit('auto-create-options-many')) return;
        if (!batchSelectionIds.length) return;
        const fields = batchSelectionIds
            .map((id) => {
                try {
                    const node = canvas.selector.getNode(id) as any;
                    if (node?.kind !== 'field') return null;
                    return { id, raw: node.raw };
                } catch {
                    return null;
                }
            })
            .filter(Boolean) as Array<{ id: string; raw: Record<string, unknown> }>;
        if (!fields.length) return;
        const allowed = fields
            .map((field) => ({ field, capability: resolveFieldOptionCapability(registry, field.raw as any) }))
            .filter((entry) => entry.capability.supportsOptions)
            .map((entry) => entry.field.id);
        if (!allowed.length) return;
        (canvas.api.editor as any).autoCreateOptionsMany(allowed);
        setTarget(null);
    }, [batchSelectionIds, canvas.api.editor, canvas.selector, ensureBranchEdit, registry, setTarget]);

    const callBatch = useCallback(
        (method: string, action: string, ...args: unknown[]) => {
            if (!ensureBranchEdit(action)) return false;
            const editorAny = canvas.api.editor as any;
            const fn = editorAny?.[method];
            if (typeof fn !== 'function') {
                emitNodeError(`Batch action "${method}" is unavailable on this editor instance`, { action });
                return false;
            }
            fn(...args);
            setTarget(null);
            return true;
        },
        [canvas.api.editor, emitNodeError, ensureBranchEdit, setTarget],
    );

    const callBatchForSelection = useCallback(
        (method: string, action: string, selectionIds: string[], mode: 'selection-first' | 'selection-last', ...args: unknown[]) => {
            if (!ensureBranchEdit(action)) return false;
            const normalized = Array.from(new Set((selectionIds ?? []).map(String).filter(Boolean)));
            if (!normalized.length) {
                emitNodeError('No selected nodes available for this batch action.', { action });
                return false;
            }
            const editorAny = canvas.api.editor as any;
            const fn = editorAny?.[method];
            if (typeof fn !== 'function') {
                emitNodeError(`Batch action "${method}" is unavailable on this editor instance`, { action });
                return false;
            }
            if (mode === 'selection-first') fn(normalized, ...args);
            else fn(...args, normalized);
            setTarget(null);
            return true;
        },
        [canvas.api.editor, emitNodeError, ensureBranchEdit, setTarget],
    );

    return {
        batchSelectionIds,
        handleDuplicate,
        handleDeleteMany,
        hasServiceSelection,
        handleClearServiceMany,
        handleAutoCreateMissingOptions,
        submitRebindMany: (tagId: string, selectionIds: string[]) =>
            callBatchForSelection('rebindMany', 'rebind-many', selectionIds, 'selection-first', tagId),
        submitIncludeMany: (receiverId: string, selectionIds: string[]) =>
            callBatchForSelection('includeMany', 'include-many', selectionIds, 'selection-last', receiverId),
        submitExcludeMany: (receiverId: string, selectionIds: string[]) =>
            callBatchForSelection('excludeMany', 'exclude-many', selectionIds, 'selection-last', receiverId),
        handleRebindMany: (tagId: string) => callBatchForSelection('rebindMany', 'rebind-many', batchSelectionIds, 'selection-first', tagId),
        handleIncludeMany: (receiverId: string) =>
            callBatchForSelection('includeMany', 'include-many', batchSelectionIds, 'selection-last', receiverId),
        handleExcludeMany: (receiverId: string) =>
            callBatchForSelection('excludeMany', 'exclude-many', batchSelectionIds, 'selection-last', receiverId),
        handleClearRelationsMany: () => callBatch('clearRelationsMany', 'clear-relations-many', batchSelectionIds, 'both'),
        handleRenameLabelsMany: (prefix: string, suffix: string) => callBatch('renameLabelsMany', 'rename-labels-many', batchSelectionIds, { prefix, suffix }),
        handleSetPricingRoleMany: (role: 'base' | 'utility') => callBatch('setPricingRoleMany', 'set-pricing-role-many', batchSelectionIds, role),
        handleClearFieldValidationMany: () => callBatch('clearFieldValidationMany', 'clear-validation-many', batchSelectionIds),
        handleClearFieldDefaultsMany: () => callBatch('clearFieldDefaultsMany', 'clear-defaults-many', batchSelectionIds),
        handleClearAllOptionsMany: () => callBatch('clearAllOptionsMany', 'clear-options-many', batchSelectionIds),
        handleRemoveNoticesForNodes: () => callBatch('removeNoticesForNodes', 'remove-notices-for-nodes', batchSelectionIds),
        handleSetNoticesVisibilityForNodes: (type: 'public' | 'private') =>
            callBatch('setNoticesVisibilityForNodes', 'set-notices-visibility-for-nodes', batchSelectionIds, type),
        handleCopyId,
        handleSaveAsTemplate,
        canQuickAddFallbacks: fallbackTarget != null,
        handleOpenFallbackQuickAdd,
        isFieldOptionsShown,
        handleToggleFieldOptions,
        canMoveUp: moveState.canMoveUp,
        canMoveDown: moveState.canMoveDown,
        canMoveContextUp: moveState.canMoveContextUp,
        canMoveContextDown: moveState.canMoveContextDown,
        handleMoveUp: () => handleMove('up'),
        handleMoveDown: () => handleMove('down'),
        handleMoveUpInContext: () => handleMoveInContext('up'),
        handleMoveDownInContext: () => handleMoveInContext('down'),
    };
}

export function useDropHandling(
    setDropIntent: (intent: DropIntent | null) => void,
    emitNodeError: (message: string, meta?: Record<string, unknown>) => void,
    focusNode: (nodeId: string) => void,
) {
    const canvas = useCanvas();
    const { registry } = useInputs();
    const ws = useWorkspace();
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

    const parseDropSource = useCallback((dataTransfer: DataTransfer): DropSource | null => {
        const serviceId = dataTransfer.getData(DRAG_MIME_SERVICE);
        if (serviceId) return { kind: 'service', serviceId };

        const builtin = parseJson<BuiltinAssetPayload>(dataTransfer.getData(DRAG_MIME_ASSET_BUILTIN));
        if (builtin?.kind) return { kind: 'asset_builtin', asset: builtin };

        const template = parseJson<TemplateAssetPayload>(dataTransfer.getData(DRAG_MIME_ASSET_TEMPLATE));
        if (template?.id) return { kind: 'asset_template', asset: template };

        return null;
    }, []);

    const hasKnownDropType = useCallback((dataTransfer: DataTransfer) => {
        const types = Array.from(dataTransfer.types ?? []);
        return DRAG_MIME_TYPES.some((mime) => types.includes(mime));
    }, []);

    const canAcceptDropPayload = useCallback(
        (dataTransfer: DataTransfer) => {
            return hasKnownDropType(dataTransfer) || !!parseDropSource(dataTransfer);
        },
        [hasKnownDropType, parseDropSource],
    );

    const createFieldFromAsset = useCallback(
        async (source: DropSource) => {
            if (!auth.canEditBranchContent) {
                emitNodeError(editDecision.reason ?? 'Editing is disabled for this actor.', { action: 'create-field-from-asset' });
                return null;
            }
            const currentTag = canvas.api.selection.currentTag() ?? 't:root';
            const id = buildFieldId();

            if (source.kind === 'asset_builtin') {
                (canvas.api.editor as any).addFieldFromDescriptor(registry, {
                    id,
                    label: source.asset.label || source.asset.kind,
                    type: source.asset.kind as any,
                    bind_id: currentTag,
                    meta: source.asset.variant ? { variant: source.asset.variant } : undefined,
                });
                return id;
            }

            if (source.kind === 'asset_template') {
                const template = (ws.templates.data ?? []).find((item) => item.id === source.asset.id);
                const definition = (template?.definition ?? {}) as Record<string, unknown>;
                if (isGroupTemplateDefinition(definition)) {
                    const fieldIdMap = new Map<string, string>();
                    const normalizedRelations: Record<string, Record<string, string[]>> = {};
                    const nextFields: TemplateFieldCandidate[] = definition.fields.map((entry) => {
                        const nextId = buildFieldId();
                        fieldIdMap.set(entry.originalId, nextId);
                        const rawField = withFreshOptionIds((entry.field ?? {}) as Record<string, unknown>);
                        delete (rawField as Record<string, unknown>).bind_id;
                        return {
                            ...rawField,
                            id: nextId,
                        };
                    });

                    for (const [relationName, relationMap] of Object.entries(definition.relations ?? {})) {
                        const nextRelation: Record<string, string[]> = {};
                        for (const [sourceId, targets] of Object.entries(relationMap ?? {})) {
                            const mappedSource = fieldIdMap.get(sourceId);
                            if (!mappedSource) continue;
                            const mappedTargets = (targets ?? [])
                                .map((targetId) => fieldIdMap.get(String(targetId)))
                                .filter((value): value is string => !!value);
                            if (mappedTargets.length) nextRelation[mappedSource] = Array.from(new Set(mappedTargets));
                        }
                        normalizedRelations[relationName] = nextRelation;
                    }

                    const rootNewId = fieldIdMap.get(definition.rootOriginalId) ?? nextFields[0]?.id;
                    const rootField = nextFields.find((field) => field.id === rootNewId);
                    if (!rootField || !rootNewId) return null;
                    (canvas.api.editor as any).addFieldFromDescriptor(registry, {
                        ...(rootField as any),
                        bind_id: currentTag,
                        defaults: template?.defaults as any,
                    });
                    for (const field of nextFields) {
                        if (field.id === rootNewId) continue;
                        (canvas.api.editor as any).addFieldFromDescriptor(registry, {
                            ...(field as any),
                            defaults: template?.defaults as any,
                        });
                    }

                    const editorAny = canvas.api.editor as any;
                    if (typeof editorAny.patchProps === 'function') {
                        editorAny.patchProps((props: Record<string, unknown>) => {
                            for (const [relationName, relationMap] of Object.entries(normalizedRelations)) {
                                const current = (props[relationName] ?? {}) as Record<string, string[]>;
                                const merged: Record<string, string[]> = { ...current };
                                for (const [sourceId, targets] of Object.entries(relationMap)) {
                                    const prev = Array.isArray(merged[sourceId]) ? merged[sourceId] : [];
                                    merged[sourceId] = Array.from(new Set([...prev, ...targets]));
                                }
                                props[relationName] = merged;
                            }
                        });
                    }
                    return rootNewId;
                }

                const singleDefinition = isSingleTemplateDefinition(definition) ? definition.field : toSingleFieldDefinition(definition);
                const nextField = withFreshOptionIds(singleDefinition);
                (canvas.api.editor as any).addFieldFromDescriptor(registry, {
                    ...(nextField as any),
                    id,
                    bind_id: currentTag,
                    label: String(nextField.label ?? source.asset.name ?? 'Template Field'),
                    type: String(nextField.type ?? source.asset.kind ?? 'text') as any,
                    defaults: template?.defaults as any,
                });
                return id;
            }

            return null;
        },
        [auth.canEditBranchContent, canvas.api.editor, canvas.api.selection, editDecision.reason, emitNodeError, registry, ws.templates.data],
    );

    const actionsForIntent = useCallback(
        (intent: DropIntent): DialAction[] => {
            const receiver = canvas.selector.getNode(intent.receiver.nodeId);
            const capabilities = getNodePropertyCapabilities(receiver as any);
            const actions: DialAction[] = [];

            if (intent.source.kind === 'service' && capabilities.service.canEdit) {
                const serviceId = intent.source.serviceId;
                actions.push({
                    id: 'set_service',
                    label: 'Set Service',
                    execute: () => {
                        if (!auth.canEditBranchContent) {
                            throw new Error(editDecision.reason ?? 'Editing is disabled for this actor.');
                        }
                        const num = Number(serviceId);
                        if (Number.isNaN(num)) throw new Error('Invalid service id');
                        canvas.api.editor.setService(intent.receiver.nodeId, { service_id: num });
                    },
                });
            }

            if (intent.source.kind === 'asset_builtin' || intent.source.kind === 'asset_template') {
                if (intent.receiver.nodeKind === 'tag') {
                    actions.push({
                        id: 'bind',
                        label: 'Bind',
                        execute: async () => {
                            const createdFieldId = await createFieldFromAsset(intent.source);
                            if (!createdFieldId) return;
                            canvas.api.editor.connect('bind', createdFieldId, intent.receiver.nodeId);
                            focusNode(createdFieldId);
                        },
                    });
                }

                if (capabilities.triggerMappings.canEdit) {
                    actions.push({
                        id: 'include',
                        label: 'Include',
                        execute: async () => {
                            const createdFieldId = await createFieldFromAsset(intent.source);
                            if (!createdFieldId) return;
                            canvas.api.editor.connect('include', intent.receiver.nodeId, createdFieldId);
                            focusNode(createdFieldId);
                        },
                    });
                    actions.push({
                        id: 'exclude',
                        label: 'Exclude',
                        execute: async () => {
                            const createdFieldId = await createFieldFromAsset(intent.source);
                            if (!createdFieldId) return;
                            canvas.api.editor.connect('exclude', intent.receiver.nodeId, createdFieldId);
                            focusNode(createdFieldId);
                        },
                    });
                }
            }

            return actions;
        },
        [auth.canEditBranchContent, canvas.api.editor, canvas.selector, createFieldFromAsset, editDecision.reason, focusNode],
    );

    const handleNodeDrop = useCallback(
        (input: any) => {
            const source = parseDropSource(input.dataTransfer);
            if (!source) return false;

            const node = canvas.selector.getNode(input.receiverId);
            const kind = input.receiverKind ?? (node?.kind as NodeKind | undefined) ?? inferNodeKindFromId(input.receiverId) ?? undefined;
            if (!kind || (kind !== 'tag' && kind !== 'field' && kind !== 'option')) return false;

            const intent: DropIntent = {
                source,
                receiver: {
                    nodeId: input.receiverId,
                    nodeKind: kind,
                    surface: input.surface,
                    clientX: input.clientX,
                    clientY: input.clientY,
                },
                pointer: {
                    x: input.clientX > 0 ? input.clientX : typeof window !== 'undefined' ? window.innerWidth / 2 : 280,
                    y: input.clientY > 0 ? input.clientY : typeof window !== 'undefined' ? window.innerHeight / 2 : 220,
                },
                surface: input.surface,
            };

            const actions = actionsForIntent(intent);
            if (!actions.length) {
                emitNodeError('No valid drop actions for this target', {
                    receiverId: input.receiverId,
                    source: source.kind,
                });
                return true;
            }

            focusNode(input.receiverId);
            setDropIntent(intent);
            return true;
        },
        [actionsForIntent, canvas.selector, emitNodeError, focusNode, parseDropSource, setDropIntent],
    );

    return { canAcceptDropPayload, handleNodeDrop, actionsForIntent };
}

export function useNoticeHandling(
    emitNodeError: (message: string, meta?: Record<string, unknown>) => void,
    setNoticeMode: (mode: any) => void,
    setEditingNoticeId: (id: string | null) => void,
    setNoticeDraft: (draft: any) => void,
    noticeDraft: any,
    editingNoticeId: string | null,
) {
    const canvas = useCanvas();
    const ws = useWorkspace();
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
    const notices = useMemo<ServicePropsNotice[]>(() => {
        const raw = (canvas.api.builder.getProps() as { notices?: unknown[] } | undefined)?.notices ?? [];
        return raw.map((row, index) => normalizeNotice(row, index)).filter(Boolean) as ServicePropsNotice[];
    }, [canvas.props]);

    const nodeOptions = useMemo(() => {
        const graph = canvas.api.snapshot().graph.nodes ?? [];
        return graph
            .filter((node) => node.kind === 'tag' || node.kind === 'field' || node.kind === 'option')
            .map((node) => ({
                value: node.id,
                kind: node.kind as NodeKind,
                label: `${node.kind}: ${node.label}`,
            }));
    }, [canvas.api, canvas.props, canvas.selectionInfo]);

    const runNoticeMutation = useCallback(
        (label: string, work: () => void) => {
            if (!auth.canEditBranchContent) {
                emitNodeError(editDecision.reason ?? 'Editing is disabled for this actor.', { action: 'notice-mutation' });
                return false;
            }
            const editorAny = canvas.api.editor as any;
            if (
                typeof editorAny.addNotice !== 'function' ||
                typeof editorAny.updateNotice !== 'function' ||
                typeof editorAny.removeNotice !== 'function'
            ) {
                emitNodeError('Notice APIs are unavailable on this editor instance', { action: 'notice-api-missing' });
                return false;
            }
            try {
                canvas.api.editor.transact(label, work);
                return true;
            } catch (error) {
                emitNodeError((error as Error)?.message ?? 'Failed to persist notice changes', { action: 'notice-mutation' });
                return false;
            }
        },
        [auth.canEditBranchContent, canvas.api.editor, editDecision.reason, emitNodeError],
    );

    const handleNoticeSave = useCallback(() => {
        try {
            const nextNotice = draftToNotice(noticeDraft);
            if (!nextNotice.id) throw new Error('Notice id is required');
            if (!nextNotice.title) throw new Error('Notice title is required');
            const nodeTarget = nextNotice.target.scope === 'node' ? nextNotice.target : null;
            if (nodeTarget) {
                if (!nodeTarget.node_id.trim()) throw new Error('Node target is required');
                const matched = nodeOptions.find((item) => item.value === nodeTarget.node_id);
                if (!matched) throw new Error('Selected node target no longer exists');
                if (matched.kind !== nodeTarget.node_kind) throw new Error('Selected node does not match target kind');
            }

            const existingIndex = notices.findIndex((item) => item.id === nextNotice.id);
            const saved = runNoticeMutation(existingIndex >= 0 ? 'Update notice' : 'Save notice', () => {
                const editorAny = canvas.api.editor as any;
                if (editingNoticeId && editingNoticeId !== nextNotice.id) {
                    editorAny.removeNotice(editingNoticeId);
                    editorAny.addNotice(nextNotice as any);
                    return;
                }
                if (existingIndex >= 0) {
                    editorAny.updateNotice(nextNotice.id, nextNotice as any);
                    return;
                }
                editorAny.addNotice(nextNotice as any);
            });
            if (!saved) return;

            setEditingNoticeId(nextNotice.id);
            setNoticeMode('edit');
            setNoticeDraft(toDraft(nextNotice));
        } catch (error) {
            emitNodeError((error as Error)?.message ?? 'Failed to save notice', { action: 'notice-save' });
        }
    }, [
        canvas.api.editor,
        editingNoticeId,
        emitNodeError,
        nodeOptions,
        noticeDraft,
        notices,
        runNoticeMutation,
        setEditingNoticeId,
        setNoticeMode,
        setNoticeDraft,
    ]);

    const handleNoticeDelete = useCallback(
        (noticeId: string) => {
            const next = notices.filter((item) => item.id !== noticeId);
            const removed = runNoticeMutation('Delete notice', () => {
                const editorAny = canvas.api.editor as any;
                editorAny.removeNotice(noticeId);
            });
            if (!removed) return;
            if (next.length) {
                setEditingNoticeId(next[0].id);
                setNoticeDraft(toDraft(next[0]));
                setNoticeMode('edit');
            } else {
                setEditingNoticeId(null);
                setNoticeDraft(toDraft());
                setNoticeMode('manage');
            }
        },
        [canvas.api.editor, notices, runNoticeMutation, setEditingNoticeId, setNoticeMode, setNoticeDraft],
    );

    const handleUseCurrentSelection = useCallback(() => {
        const candidateIds = [canvas.activeId, ...canvas.selectionInfo.ids].filter(Boolean) as string[];
        const candidate = candidateIds.map((id) => nodeOptions.find((option) => option.value === id)).find(Boolean);
        if (!candidate) {
            emitNodeError('No eligible selected node for notice target', { action: 'notice-use-selection' });
            return;
        }
        setNoticeDraft((current: any) => ({
            ...current,
            targetScope: 'node',
            targetNodeKind: candidate.kind,
            targetNodeId: candidate.value,
        }));
    }, [canvas.activeId, canvas.selectionInfo.ids, emitNodeError, nodeOptions, setNoticeDraft]);

    return { notices, nodeOptions, handleNoticeSave, handleNoticeDelete, handleUseCurrentSelection };
}
