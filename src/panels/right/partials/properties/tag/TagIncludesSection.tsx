import { ExcludesSection, IncludesSection } from '@/panels/right/partials/properties/components/Includes.tsx';
import { type TagNode } from '@timeax/digital-service-engine/core';

interface TagIncludesSectionProps {
    node: TagNode;
}

export function TagIncludesSection({ node }: TagIncludesSectionProps) {
    return <IncludesSection node={node} />;
}

export function TagExcludesSection({ node }: TagIncludesSectionProps) {
    return <ExcludesSection node={node} />;
}
