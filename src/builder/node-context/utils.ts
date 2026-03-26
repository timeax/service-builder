import type { NoticeDraft, NoticeTarget, ServicePropsNotice } from './types.ts';

export function inferNodeKindFromId(id: string) {
    if (id.startsWith('t:')) return 'tag';
    if (id.startsWith('f:')) return 'field';
    if (id.startsWith('o:')) return 'option';
    return null;
}

export function makeTemplateKey(label: string) {
    const slug = label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return `${slug || 'field'}-${Date.now()}`;
}

export function getNodeLabel(node: unknown, fallback: string) {
    if (!node || typeof node !== 'object') return fallback;
    const raw = (node as any).raw;
    if (!raw || typeof raw !== 'object') return fallback;
    return String((raw as any).label ?? fallback);
}

export function parseJson<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function buildFieldId() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `f:asset:${Date.now()}:${rand}`;
}

export function buildOptionId() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `o:asset:${Date.now()}:${rand}`;
}

export function buildNoticeId() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `notice:${Date.now()}:${rand}`;
}

export function normalizeNotice(input: any, index: number): ServicePropsNotice | null {
    if (!input || typeof input !== 'object') return null;
    const target = input.target;
    const targetScope = target?.scope === 'node' ? 'node' : 'global';
    const targetNodeKind = target?.node_kind === 'tag' || target?.node_kind === 'field' || target?.node_kind === 'option' ? target.node_kind : 'tag';
    const targetNodeId = typeof target?.node_id === 'string' ? target.node_id : 't:root';
    return {
        id: typeof input.id === 'string' && input.id.trim() ? input.id : `notice:${index}`,
        type: input.type === 'public' ? 'public' : 'private',
        kind: ['label', 'warning', 'deprecation', 'compat', 'migration', 'policy'].includes(input.kind) ? input.kind : 'label',
        severity: input.severity === 'error' || input.severity === 'warning' ? input.severity : 'info',
        target: targetScope === 'node' ? { scope: 'node', node_kind: targetNodeKind, node_id: targetNodeId } : { scope: 'global' },
        title: typeof input.title === 'string' && input.title.trim() ? input.title : 'Untitled notice',
        description: typeof input.description === 'string' ? input.description : undefined,
        reason: typeof input.reason === 'string' ? input.reason : undefined,
        marked_at: typeof input.marked_at === 'string' ? input.marked_at : undefined,
        icon: typeof input.icon === 'string' ? input.icon : undefined,
        color: typeof input.color === 'string' ? input.color : undefined,
        meta: input.meta && typeof input.meta === 'object' ? (input.meta as Record<string, unknown>) : undefined,
    };
}

export function toDraft(notice?: ServicePropsNotice, target?: NoticeTarget): NoticeDraft {
    const baseTarget = target ?? notice?.target ?? { scope: 'global' };
    const isNodeTarget = baseTarget.scope === 'node';
    return {
        id: notice?.id ?? buildNoticeId(),
        type: notice?.type ?? 'private',
        kind: notice?.kind ?? 'label',
        severity: notice?.severity ?? 'info',
        targetScope: isNodeTarget ? 'node' : 'global',
        targetNodeKind: isNodeTarget ? baseTarget.node_kind : 'tag',
        targetNodeId: isNodeTarget ? baseTarget.node_id : '',
        title: notice?.title ?? '',
        description: notice?.description ?? '',
        reason: notice?.reason ?? '',
        markedAt: notice?.marked_at ?? '',
        icon: notice?.icon ?? '',
        color: notice?.color ?? '',
        metaText: notice?.meta ? JSON.stringify(notice.meta, null, 2) : '',
    };
}

export function draftToNotice(draft: NoticeDraft): ServicePropsNotice {
    let meta: Record<string, unknown> | undefined;
    const metaRaw = draft.metaText.trim();
    if (metaRaw) {
        const parsed = JSON.parse(metaRaw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Meta must be a JSON object');
        meta = parsed as Record<string, unknown>;
    }

    const target: NoticeTarget =
        draft.targetScope === 'node'
            ? {
                  scope: 'node',
                  node_kind: draft.targetNodeKind,
                  node_id: draft.targetNodeId.trim(),
              }
            : { scope: 'global' };

    return {
        id: draft.id.trim(),
        type: draft.type,
        kind: draft.kind,
        severity: draft.severity,
        target,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        reason: draft.reason.trim() || undefined,
        marked_at: draft.markedAt.trim() || undefined,
        icon: draft.icon.trim() || undefined,
        color: draft.color.trim() || undefined,
        meta,
    };
}
