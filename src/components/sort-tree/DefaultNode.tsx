import type {TreeNode} from "./types";

export interface DefaultNodeProps<T = unknown> {
    node: TreeNode<T>;
    matched: boolean;
}

export function DefaultNode<T = unknown>({node, matched}: DefaultNodeProps<T>) {
    return (
        <div className={"truncate " + (matched ? "bg-yellow-200/50 px-1 rounded" : "")}>
            {node.title}
        </div>
    );
}