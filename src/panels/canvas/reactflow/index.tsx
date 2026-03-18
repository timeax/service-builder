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
    onServiceDrop?: (args: { nodeId: string; serviceId: string; clientX: number; clientY: number }) => void;
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
    onDrop,
}: {
    label: string;
    icon: React.ReactNode;
    selected: boolean;
    hasError?: boolean;
    showErrorBadge?: boolean;
    canAssignService?: boolean;
    draggingService?: boolean;
    onDrop?: (event: React.DragEvent) => void;
}) {
    return (
        <div
            className={
                'group relative min-w-44 rounded-lg bg-white p-3 ring-1 ring-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-200 dark:bg-slate-900 dark:ring-slate-700 ' +
                (selected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 ' : 'hover:shadow-lg ') +
                (draggingService && canAssignService ? 'border border-dashed border-emerald-400 ' : '') +
                (!canAssignService && draggingService ? 'opacity-70 ' : '')
            }
            onDragOver={(event) => {
                if (!canAssignService) return;
                if (!event.dataTransfer.types.includes('application/x-service-builder-service')) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={onDrop}
        >
            <div className="flex items-center gap-2">
                <span className="text-slate-400 group-hover:text-blue-500">{icon}</span>
                <span className="max-w-52 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
            </div>

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
                onDrop={(event) => {
                    const serviceId = event.dataTransfer.getData('application/x-service-builder-service');
                    if (!serviceId) return;
                    event.preventDefault();
                    props.data.onServiceDrop?.({ nodeId: id, serviceId, clientX: event.clientX, clientY: event.clientY });
                }}
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
                onDrop={(event) => {
                    const serviceId = event.dataTransfer.getData('application/x-service-builder-service');
                    if (!serviceId) return;
                    event.preventDefault();
                    props.data.onServiceDrop?.({ nodeId: id, serviceId, clientX: event.clientX, clientY: event.clientY });
                }}
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
                className={
                    'rounded-full border px-4 py-1.5 text-sm bg-white text-slate-800 transition dark:bg-slate-900 dark:text-slate-200 ' +
                    (props.selected ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 ' : 'border-slate-300 dark:border-slate-700')
                }
                onDragOver={(event) => {
                    if (!props.data.canAssignService) return;
                    if (!event.dataTransfer.types.includes('application/x-service-builder-service')) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(event) => {
                    const serviceId = event.dataTransfer.getData('application/x-service-builder-service');
                    if (!serviceId) return;
                    event.preventDefault();
                    props.data.onServiceDrop?.({ nodeId: id, serviceId, clientX: event.clientX, clientY: event.clientY });
                }}
            >
                <div className="flex items-center gap-2">
                    <MdOutlineRadioButtonChecked className="text-slate-400" />
                    <span className="max-w-36 truncate">{props.data.node?.label ?? props.id}</span>
                </div>
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
