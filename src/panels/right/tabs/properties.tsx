import { describeBinding, getNodeSummary } from '@/builder/view-models.tsx';
import { EmptyState, PropertyList, SelectionBadge } from '@/components/builder/index.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Section } from '@/panels/right/components/sections.tsx';
import { FieldLabel } from '@/panels/right/components/text.tsx';
import FieldProperties from '@/panels/right/partials/properties/field-properties.tsx';
import OptionProperties from '@/panels/right/partials/properties/option-properties.tsx';
import { TagProperties } from '@/panels/right/partials/properties/tag.tsx';
import { WorkspaceBootInlineNotice } from '@/workspace/boot-status.tsx';
import type { NodeKind } from '@timeax/digital-service-engine';
import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { MdOutlineContentCopy } from 'react-icons/md';

const propertyComponents: Record<Exclude<NodeKind, 'comment'>, any> = {
    tag: TagProperties,
    option: OptionProperties,
    field: FieldProperties,
};

export type PropertiesProps = {
    kinds?: string[];
    defaultKind?: string;
};

export const Properties = ({ kinds = [], defaultKind = '' }: PropertiesProps) => {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const node: TagNode | FieldNode | OptionNode = useMemo(() => {
        if (!canvas.activeId) return { kind: 'none' };
        return canvas.selector.getNode(canvas.activeId) as any;
    }, [canvas.activeId, canvas.props, canvas.selection]);

    const [copying, setCopying] = useState(false);
    const selectedNodeId = 'id' in node ? node.id : '';
    const selectedRawLabel = 'raw' in node ? String(node.raw?.label ?? '') : '';
    const lastLoadedLabelByNodeId = useRef<Record<string, string>>({});
    const labelDraftNodeId = useRef('');
    const isEditingLabel = useRef(false);
    const [labelDraft, setLabelDraft] = useState(() => (selectedRawLabel.trim() ? selectedRawLabel : selectedNodeId));

    const Kind = propertyComponents[node.kind];

    useEffect(() => {
        if (!selectedNodeId || !selectedRawLabel.trim()) return;
        lastLoadedLabelByNodeId.current[selectedNodeId] = selectedRawLabel;
    }, [selectedNodeId, selectedRawLabel]);

    useEffect(() => {
        if (!selectedNodeId) {
            setLabelDraft('');
            labelDraftNodeId.current = '';
            return;
        }

        const loadedLabel = selectedRawLabel.trim()
            ? selectedRawLabel
            : lastLoadedLabelByNodeId.current[selectedNodeId] ?? selectedNodeId;
        const nodeChanged = labelDraftNodeId.current !== selectedNodeId;

        if (nodeChanged || !isEditingLabel.current) {
            setLabelDraft(loadedLabel);
        }

        labelDraftNodeId.current = selectedNodeId;
    }, [selectedNodeId, selectedRawLabel]);

    const resetEmptyLabelDraft = () => {
        if (!selectedNodeId || labelDraft.trim()) return;

        const loadedLabel = selectedRawLabel.trim()
            ? selectedRawLabel
            : lastLoadedLabelByNodeId.current[selectedNodeId] ?? selectedNodeId;
        setLabelDraft(loadedLabel);
    };

    if (!Kind) {
        return (
            <div className="p-4">
                <EmptyState
                    title="No active node selected"
                    description="Pick a tag, field, or option from the layers panel or canvas to inspect its core settings."
                />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-4 px-4 py-4">
                    <WorkspaceBootInlineNotice boot={ws.boot} sections={['snapshotBody', 'policies']} />
                    <Section>
                        <Section.Header>
                            <Section.Title>Selection overview</Section.Title>
                        </Section.Header>
                        <Section.Content>
                            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                The inspector stays synced with the active canvas and layers selection.
                            </p>

                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 capitalize dark:text-slate-100">{node.kind}</div>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getNodeSummary(node)}</p>
                                </div>
                                <SelectionBadge active selected />
                            </div>

                            <div className="mt-3 space-y-3">
                                <InputField
                                    variant="text"
                                    label={<FieldLabel>Label</FieldLabel>}
                                    value={labelDraft}
                                    onFocus={() => {
                                        isEditingLabel.current = true;
                                    }}
                                    onChange={(e) => {
                                        const next = String(e.value ?? '');
                                        setLabelDraft(next);
                                        if (next.trim()) {
                                            canvas.api.editor.editLabel(node.id, next);
                                        }
                                    }}
                                    onBlur={() => {
                                        isEditingLabel.current = false;
                                        resetEmptyLabelDraft();
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter') return;
                                        event.preventDefault();
                                        isEditingLabel.current = false;
                                        resetEmptyLabelDraft();
                                        event.currentTarget.blur();
                                    }}
                                    placeholder={`Enter ${node.kind} display label`}
                                />

                                <InputField
                                    variant="text"
                                    label={<FieldLabel>ID</FieldLabel>}
                                    disabled
                                    value={node.id}
                                    variantClassName="bg-muted"
                                    extendBoxToControls
                                    joinControls
                                    trailingControl={
                                        <span
                                            className="cursor-pointer px-2"
                                            onClick={() => {
                                                setCopying(true);
                                                navigator.clipboard.writeText(node.id).finally(() => setCopying(false));
                                            }}
                                        >
                                            {copying ? (
                                                <AiOutlineLoading3Quarters className="animate-spin text-lg" />
                                            ) : (
                                                <MdOutlineContentCopy className="text-sm text-muted-foreground" />
                                            )}
                                        </span>
                                    }
                                    placeholder={`${node.kind} id`}
                                />
                            </div>

                            <PropertyList
                                className="mt-3"
                                items={[
                                    { label: 'Binding', value: describeBinding(node) },
                                    { label: 'Selection size', value: String(canvas.selectionInfo.ids.length) },
                                ]}
                            />
                        </Section.Content>
                    </Section>

                    <Separator />
                    <Kind node={node} kinds={kinds} defaultKind={defaultKind} />
                </div>
            </ScrollArea>
        </div>
    );
};
