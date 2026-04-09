// noinspection JSAnnotator
import { Separator } from '@/components/ui/separator.tsx';
import { type TagNode } from '@timeax/digital-service-engine/core';
import { TagConstraintsSection } from './tag/TagConstraintsSection';
import { TagExcludesSection, TagIncludesSection } from './tag/TagIncludesSection';
import AddService from '@/panels/right/partials/global/add-service.tsx';
import QuantitySection from './components/quantity-section.tsx';
import { getTagPropertyCapabilities } from './components/node-capabilities.ts';
import OrderKindSection from './components/order-kind-section.tsx';

export interface TagProps {
    className?: string;
    node: TagNode;
    kinds?: string[];
    defaultKind?: string;
}

export function TagProperties({ node, kinds, defaultKind }: TagProps) {
    const capabilities = getTagPropertyCapabilities();

    return (
        <>
            <TagConstraintsSection node={node} />
            <Separator />
            <OrderKindSection nodeId={node.id} nodeKind="tag" kinds={kinds} defaultKind={defaultKind} />
            <Separator />
            <QuantitySection node={node} />
            <Separator />
            <TagIncludesSection node={node} />
            <Separator />
            <TagExcludesSection node={node} />
            <Separator />
            <AddService data={node} readOnly={!capabilities.service.canEdit} readOnlyMessage={capabilities.service.message} />
        </>
    );
}

export default TagProperties;
