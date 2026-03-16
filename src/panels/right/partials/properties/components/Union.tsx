import { RenderIf } from '@/panels/right/components/renderif.tsx';
import { IncludesItem, IncludesItemMissing, IncludesList, Section } from '@/panels/right/components/sections.tsx';
import { type FieldNode, type OptionNode, type TagNode } from '@timeax/digital-service-engine/core';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { keyBy } from 'lodash';
import { useMemo, useState } from 'react';
import { AddIncludesPopover } from './AddIncludesPopover';
import type { TriggerMappingCapability } from './node-capabilities.ts';

interface ExcludesSectionProps {
    node: TagNode | FieldNode | OptionNode;
    mode: 'includes' | 'excludes';
    capability?: TriggerMappingCapability;
}

export function IncExcludeSection({ node, mode, capability }: ExcludesSectionProps) {
    const canvas = useCanvas();
    const [open, setOpen] = useState(false);
    const canEdit = capability?.canEdit ?? true;
    const helperMessage = capability?.message;

    const fields = useMemo(() => keyBy(canvas.props.fields, 'id'), [canvas.props]);

    const descendantOptions = useMemo(() => {
        const descendants = node.kind == 'tag' ? node.getDescendants() : node.getDescendants(canvas.api.selection.currentTag());

        if (mode == 'includes') {
            const fields = canvas.props.fields;
            const visible = keyBy(descendants, 'id');

            return fields
                .filter((field) => {
                    let node = visible[field.id] as FieldNode;
                    return node ? node?.isInherited : true;
                })
                .map((item) => ({
                    label: item.label,
                    value: item.id,
                    description: item.description,
                    tags: [item.id],
                }));
        }

        return descendants.map(({ raw: item }) => ({
            label: item.label,
            value: item.id,
            description: item.description,
            tags: [item.id],
        }));
    }, [canvas.props.fields, node]);

    const name = mode.slice(0, -1) as 'include' | 'exclude';
    return (
        <Section>
            <Section.Header>
                <Section.Title>{mode == 'includes' ? 'Includes' : 'Excludes'}</Section.Title>
                <Section.Actions>
                    {canEdit ? (
                        <AddIncludesPopover
                            onSelect={(e) => canvas.api.editor[name](node.id, e)}
                            open={open}
                            onOpenChange={setOpen}
                            options={descendantOptions}
                        />
                    ) : null}
                </Section.Actions>
            </Section.Header>
            <Section.Content>
                {helperMessage ? <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{helperMessage}</p> : null}
                <RenderIf data={(node[mode]?.size ?? 0) > 0} emptyMessage={'None'}>
                    <IncludesList>
                        {(Array.from(node[mode] ?? []) as string[]).map((id) => {
                            const field = fields[id] as any;
                            if (field) {
                                return (
                                    <IncludesItem
                                        title={field.label}
                                        actions={[
                                            {
                                                title: 'Go to field',
                                                kind: 'open',
                                                onClick: () => canvas.api.select([field.id]),
                                            },
                                            {
                                                title: 'Remove',
                                                kind: 'remove',
                                                onClick: () => canvas.api.editor.disconnect(name, node.id, id),
                                                disabled: !canEdit,
                                            },
                                        ]}
                                    />
                                );
                            }

                            return <IncludesItemMissing message={`Missing Target (ID: ${id})`} />;
                        })}
                    </IncludesList>
                </RenderIf>
            </Section.Content>
        </Section>
    );
}
