import type {TreeNode} from "./types";

export interface DefaultNodeProps<T = unknown> {
    node: TreeNode<T>;
    matched: boolean;
}

export function DefaultNode<T = unknown>({node, matched}: DefaultNodeProps<T>) {
    return (
        <div className={"truncate flex items-center gap-2 " + (matched ? "bg-yellow-200/50 px-1 rounded" : "")}>
            {node.icon ? <span className="inline-flex items-center">{node.icon}</span> : null}
            <span className="truncate">{node.title}</span>
        </div>
    );
}
