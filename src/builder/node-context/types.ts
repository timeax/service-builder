export type NodeContextSurface = 'canvas' | 'layers' | 'wireframe';
export type DropTargetSurface = NodeContextSurface;
export type EdgeContextSurface = 'canvas';
export type DragPayloadKind = 'service' | 'asset_builtin' | 'asset_template';

export const DRAG_MIME_SERVICE = 'application/x-service-builder-service';
export const DRAG_MIME_ASSET_BUILTIN = 'application/x-service-builder-asset-builtin';
export const DRAG_MIME_ASSET_TEMPLATE = 'application/x-service-builder-asset-template';

export const DIAL_ACTION_TIMEOUT_MS = 10_000;
export const OVERLAY_STALE_TIMEOUT_MS = 30_000;
export const DRAG_MIME_TYPES = [DRAG_MIME_SERVICE, DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE] as const;

export type NodeKind = 'tag' | 'field' | 'option';
export type NoticeType = 'public' | 'private';
export type NoticeKind = 'label' | 'warning' | 'deprecation' | 'compat' | 'migration' | 'policy';
export type NoticeSeverity = 'info' | 'warning' | 'error';

export type NoticeTarget =
    | { scope: 'global' }
    | {
          scope: 'node';
          node_kind: NodeKind;
          node_id: string;
      };

export type ServicePropsNotice = {
    id: string;
    type: NoticeType;
    kind: NoticeKind;
    severity: NoticeSeverity;
    target: NoticeTarget;
    title: string;
    description?: string;
    reason?: string;
    marked_at?: string;
    icon?: string;
    color?: string;
    meta?: Record<string, unknown>;
};

export type NoticeManagerMode = 'create' | 'edit' | 'manage';

export type NoticeDraft = {
    id: string;
    type: NoticeType;
    kind: NoticeKind;
    severity: NoticeSeverity;
    targetScope: 'global' | 'node';
    targetNodeKind: NodeKind;
    targetNodeId: string;
    title: string;
    description: string;
    reason: string;
    markedAt: string;
    icon: string;
    color: string;
    metaText: string;
};

export type BuiltinAssetPayload = {
    kind: string;
    variant?: string;
    label: string;
};

export type TemplateAssetPayload = {
    id: string;
    name: string;
    kind: string;
};

export type DropSource =
    | { kind: 'service'; serviceId: string }
    | { kind: 'asset_builtin'; asset: BuiltinAssetPayload }
    | { kind: 'asset_template'; asset: TemplateAssetPayload };

export type NodeContextTarget = {
    nodeId: string;
    nodeKind: NodeKind;
    surface: NodeContextSurface;
    clientX: number;
    clientY: number;
};

export type EdgeRelationKind = 'bind' | 'include' | 'exclude';

export type EdgeContextTarget = {
    edgeId: string;
    kind: EdgeRelationKind;
    from: string;
    to: string;
    surface: EdgeContextSurface;
    clientX: number;
    clientY: number;
};

export type DropIntent = {
    source: DropSource;
    receiver: NodeContextTarget;
    pointer: { x: number; y: number };
    surface: DropTargetSurface;
};

export type OpenNodeContextMenuInput = {
    nodeId: string;
    nodeKind?: NodeKind;
    surface: NodeContextSurface;
    clientX: number;
    clientY: number;
};

export type OpenEdgeContextMenuInput = EdgeContextTarget;

export type HandleNodeDropInput = {
    receiverId: string;
    receiverKind?: NodeKind;
    surface: DropTargetSurface;
    clientX: number;
    clientY: number;
    dataTransfer: DataTransfer;
};

export type OpenNoticeManagerInput = {
    mode?: NoticeManagerMode;
    target?: NoticeTarget;
    noticeId?: string;
};

export type DialAction = {
    id: 'bind' | 'include' | 'exclude' | 'set_service';
    label: string;
    execute: (intent: DropIntent) => Promise<void> | void;
};
