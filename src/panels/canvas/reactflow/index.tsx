import type React from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { BsChatSquareQuote } from 'react-icons/bs';
import { LuTags } from 'react-icons/lu';
import { MdOutlineRadioButtonChecked } from 'react-icons/md';
import { RxInput } from 'react-icons/rx';

type BaseData = {
    node?: { id: string; label: string; kind: 'tag' | 'field' | 'option' };
    thread?: {
        id: string;
        resolved?: boolean;
        messages?: Array<{ body?: string; authorName?: string; isMain?: boolean }>;
    };
    hasError?: boolean;
    showErrorBadge?: boolean;
    canAssignService?: boolean;
    draggingService?: boolean;
    canAcceptDropPayload?: (dataTransfer: DataTransfer) => boolean;
    onNodeDrop?: (args: { nodeId: string; clientX: number; clientY: number; dataTransfer: DataTransfer }) => void;
    isActiveNode?: boolean;
    isCurrentTag?: boolean;
    isVisibleGroupField?: boolean;
    isRelatedTag?: boolean;
    isManualHighlighted?: boolean;
    showCurrentTagDot?: boolean;
    focusDimLevel?: 'none' | 'soft' | 'medium' | 'strong';
};
type CanvasNode = Node<BaseData, 'tag' | 'field' | 'option' | 'comment'>;

function NodeShell({
    label,
    icon,
    selected,
    hasError,
    showErrorBadge,
    canAssignService,
    draggingService,
    canAcceptDropPayload,
    onDrop,
    isActiveNode,
    isCurrentTag,
    isVisibleGroupField,
    isRelatedTag,
    isManualHighlighted,
    showCurrentTagDot,
    focusDimLevel,
}: {
    label: string;
    icon: React.ReactNode;
    selected: boolean;
    hasError?: boolean;
    showErrorBadge?: boolean;
    canAssignService?: boolean;
    draggingService?: boolean;
    canAcceptDropPayload?: (dataTransfer: DataTransfer) => boolean;
    onDrop?: (event: React.DragEvent) => void;
    isActiveNode?: boolean;
    isCurrentTag?: boolean;
    isVisibleGroupField?: boolean;
    isRelatedTag?: boolean;
    isManualHighlighted?: boolean;
    showCurrentTagDot?: boolean;
    focusDimLevel?: 'none' | 'soft' | 'medium' | 'strong';
}) {
    const dimClass =
        focusDimLevel === 'soft'
            ? 'opacity-80 '
            : focusDimLevel === 'medium'
              ? 'opacity-[0.55] '
              : focusDimLevel === 'strong'
                ? 'opacity-35 '
                : '';

    return (
        <div
            data-node-state={[
                isActiveNode ? 'active' : '',
                isCurrentTag ? 'current-tag' : '',
                isVisibleGroupField ? 'visible-group' : '',
                isRelatedTag ? 'related-tag' : '',
                isManualHighlighted ? 'manual-highlighted' : '',
                focusDimLevel && focusDimLevel !== 'none' ? `dim-${focusDimLevel}` : '',
            ]
                .filter(Boolean)
                .join(' ')}
            className={
                'group relative min-w-44 rounded-lg bg-white p-3 ring-1 ring-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-200 dark:bg-slate-900 dark:ring-slate-700 ' +
                (selected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 ' : 'hover:shadow-lg ') +
                (isActiveNode ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/25 ' : '') +
                (isCurrentTag ? 'ring-2 ring-emerald-500 bg-emerald-50/70 shadow-lg shadow-emerald-500/25 dark:bg-emerald-500/10 ' : '') +
                (isVisibleGroupField ? 'ring-2 ring-emerald-300 bg-emerald-50/35 dark:bg-emerald-500/5 ' : '') +
                (isRelatedTag ? 'ring-1 ring-teal-300 bg-teal-50/25 dark:bg-teal-500/8 ' : '') +
                (isManualHighlighted ? 'outline-2 outline-amber-400 outline-solid ' : '') +
                (draggingService && canAssignService ? 'border border-dashed border-emerald-400 ' : '') +
                (!canAssignService && draggingService ? 'opacity-70 ' : '') +
                dimClass
            }
            onDragOver={(event) => {
                if (!canAcceptDropPayload?.(event.dataTransfer)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={onDrop}
        >
            <div className="flex items-center gap-2">
                <span className="text-slate-400 group-hover:text-blue-500">{icon}</span>
                <span className="max-w-52 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
            </div>

            {showCurrentTagDot ? <span className="absolute top-2 left-2 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_2px_rgba(15,23,42,0.8)]" /> : null}
            {showErrorBadge && hasError ? <span className="absolute -top-1.5 -right-1.5 inline-flex h-3 w-3 rounded-full bg-rose-500" /> : null}
        </div>
    );
}

function TagNode(props: NodeProps<CanvasNode>) {
    const id = props.data.node?.id ?? props.id;
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
            <NodeShell
                label={props.data.node?.label ?? props.id}
                icon={<LuTags />}
                selected={props.selected}
                hasError={props.data.hasError}
                showErrorBadge={props.data.showErrorBadge}
                canAssignService={props.data.canAssignService}
                draggingService={props.data.draggingService}
                canAcceptDropPayload={props.data.canAcceptDropPayload}
                onDrop={(event) => {
                    if (!props.data.canAcceptDropPayload?.(event.dataTransfer)) return;
                    event.preventDefault();
                    props.data.onNodeDrop?.({ nodeId: id, clientX: event.clientX, clientY: event.clientY, dataTransfer: event.dataTransfer });
                }}
                isActiveNode={props.data.isActiveNode}
                isCurrentTag={props.data.isCurrentTag}
                isVisibleGroupField={props.data.isVisibleGroupField}
                isRelatedTag={props.data.isRelatedTag}
                isManualHighlighted={props.data.isManualHighlighted}
                showCurrentTagDot={props.data.showCurrentTagDot}
                focusDimLevel={props.data.focusDimLevel}
            />
            <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
        </>
    );
}

function FieldNode(props: NodeProps<CanvasNode>) {
    const id = props.data.node?.id ?? props.id;
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
            <NodeShell
                label={props.data.node?.label ?? props.id}
                icon={<RxInput />}
                selected={props.selected}
                hasError={props.data.hasError}
                showErrorBadge={props.data.showErrorBadge}
                canAssignService={props.data.canAssignService}
                draggingService={props.data.draggingService}
                canAcceptDropPayload={props.data.canAcceptDropPayload}
                onDrop={(event) => {
                    if (!props.data.canAcceptDropPayload?.(event.dataTransfer)) return;
                    event.preventDefault();
                    props.data.onNodeDrop?.({ nodeId: id, clientX: event.clientX, clientY: event.clientY, dataTransfer: event.dataTransfer });
                }}
                isActiveNode={props.data.isActiveNode}
                isCurrentTag={props.data.isCurrentTag}
                isVisibleGroupField={props.data.isVisibleGroupField}
                isRelatedTag={props.data.isRelatedTag}
                isManualHighlighted={props.data.isManualHighlighted}
                showCurrentTagDot={props.data.showCurrentTagDot}
                focusDimLevel={props.data.focusDimLevel}
            />
            <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
        </>
    );
}

function OptionNode(props: NodeProps<CanvasNode>) {
    const id = props.data.node?.id ?? props.id;
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
            <div
                data-node-state={[
                    props.data.isActiveNode ? 'active' : '',
                    props.data.isCurrentTag ? 'current-tag' : '',
                    props.data.isVisibleGroupField ? 'visible-group' : '',
                    props.data.isRelatedTag ? 'related-tag' : '',
                    props.data.isManualHighlighted ? 'manual-highlighted' : '',
                    props.data.focusDimLevel && props.data.focusDimLevel !== 'none' ? `dim-${props.data.focusDimLevel}` : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
                className={
                    'relative rounded-full border px-4 py-1.5 text-sm bg-white text-slate-800 transition dark:bg-slate-900 dark:text-slate-200 ' +
                    (props.selected ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 ' : 'border-slate-300 dark:border-slate-700 ') +
                    (props.data.isActiveNode ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/25 ' : '') +
                    (props.data.isCurrentTag ? 'ring-2 ring-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/10 ' : '') +
                    (props.data.isVisibleGroupField ? 'ring-2 ring-emerald-300 bg-emerald-50/35 dark:bg-emerald-500/5 ' : '') +
                    (props.data.isRelatedTag ? 'ring-1 ring-teal-300 bg-teal-50/25 dark:bg-teal-500/8 ' : '') +
                    (props.data.isManualHighlighted ? 'outline-2 outline-solid outline-amber-400 ' : '') +
                    (props.data.focusDimLevel === 'soft'
                        ? 'opacity-80 '
                        : props.data.focusDimLevel === 'medium'
                          ? 'opacity-[0.55] '
                          : props.data.focusDimLevel === 'strong'
                            ? 'opacity-35 '
                            : '')
                }
                onDragOver={(event) => {
                    if (!props.data.canAcceptDropPayload?.(event.dataTransfer)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(event) => {
                    if (!props.data.canAcceptDropPayload?.(event.dataTransfer)) return;
                    event.preventDefault();
                    props.data.onNodeDrop?.({ nodeId: id, clientX: event.clientX, clientY: event.clientY, dataTransfer: event.dataTransfer });
                }}
            >
                <div className="flex items-center gap-2">
                    <MdOutlineRadioButtonChecked className="text-slate-400" />
                    <span className="max-w-36 truncate">{props.data.node?.label ?? props.id}</span>
                </div>
                {props.data.showCurrentTagDot ? <span className="absolute top-1 left-1 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_2px_rgba(15,23,42,0.8)]" /> : null}
                {props.data.showErrorBadge && props.data.hasError ? <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-rose-500" /> : null}
            </div>
            <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
        </>
    );
}

function CommentNode(props: NodeProps<CanvasNode>) {
    const thread = props.data.thread;
    const main = thread?.messages?.find((message) => message.isMain) ?? thread?.messages?.[0];
    return (
        <div className="h-48 w-64 rounded-lg border border-[#E0E0E0] bg-[#FEFBEA] shadow-md transition-all hover:shadow-lg dark:border-[#555] dark:bg-[#4a4a38]">
            <div className="flex items-center gap-2 border-b border-[#E0E0E0]/70 px-3 py-2 text-xs font-medium text-slate-600 dark:border-[#555] dark:text-slate-300">
                <BsChatSquareQuote />
                <span>{main?.authorName ?? 'Comment'}</span>
            </div>
            <div className="px-3 py-2 text-sm leading-5 text-slate-700 dark:text-slate-200">{main?.body ?? ''}</div>
            <div className="absolute bottom-2 right-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">{thread?.resolved ? 'Resolved' : 'Open'}</div>
        </div>
    );
}

export const nodeTypes = {
    tag: TagNode,
    field: FieldNode,
    option: OptionNode,
    comment: CommentNode,
};

export const edgeTypes = {};
