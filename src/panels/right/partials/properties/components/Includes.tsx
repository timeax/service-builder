import { IncExcludeSection } from '@/panels/right/partials/properties/components/Union.tsx';
import { type FieldNode, type OptionNode, type TagNode } from '@timeax/digital-service-engine/core';

interface IncludesSectionProps {
    node: TagNode | FieldNode | OptionNode;
}

export function IncludesSection({ node }: IncludesSectionProps) {
    return <IncExcludeSection node={node} mode={'includes'} />;
}

export function ExcludesSection({ node }: IncludesSectionProps) {
    return <IncExcludeSection node={node} mode={'excludes'} />;
}
