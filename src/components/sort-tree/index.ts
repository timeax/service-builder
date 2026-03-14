// Types
export type { ChangeDetail, ChangeType, NodeKey, NodePath, PositionInfo, SortTreeProps, TreeNode } from './types';

// Main component
export { SortTree } from './sort-tree.tsx';

// Public helpers for programmatic edits
export { addNode, changeNodeAtPath, moveNode, removeNode } from './helpers';

// Optional UI building blocks (in case you want to swap/compose)
export { Node } from './node.tsx';
export { DraggableRow } from './draggable-row.tsx';
export { DropZone } from './drop-zone.tsx';
export { NodeRow } from './node-row.tsx';

// Low-level utils if needed
export { defaultGetKey, locateByPath, pathToString, stringToPath } from './utils';
