// sampleTrees.ts
import type {TreeNode} from "@/components/sort-tree"; // adjust path if needed

/* =============================
 * 1) File explorer sample
 * ============================= */
export type FileMeta = { kind: "folder" | "file"; size?: number; ext?: string };

export const fileTree: Array<TreeNode<FileMeta>> = [
    {
        id: "src",
        title: "src",
        expanded: true,
        data: {kind: "folder"},
        children: [
            {
                id: "src/components",
                title: "components",
                expanded: true,
                data: {kind: "folder"},
                children: [
                    {
                        id: "src/components/Button.tsx",
                        title: "Button.tsx",
                        data: {kind: "file", size: 2143, ext: "tsx"}
                    },
                    {
                        id: "src/components/Dialog.tsx",
                        title: "Dialog.tsx",
                        data: {kind: "file", size: 4091, ext: "tsx"}
                    },
                    {
                        id: "src/components/forms",
                        title: "forms",
                        data: {kind: "folder"},
                        children: [
                            {
                                id: "src/components/forms/Input.tsx",
                                title: "Input.tsx",
                                data: {kind: "file", size: 1380, ext: "tsx"}
                            },
                            {
                                id: "src/components/forms/Select.tsx",
                                title: "Select.tsx",
                                data: {kind: "file", size: 2208, ext: "tsx"}
                            },
                        ],
                    },
                ],
            },
            {
                id: "src/pages",
                title: "pages",
                data: {kind: "folder"},
                children: [
                    {id: "src/pages/index.tsx", title: "index.tsx", data: {kind: "file", size: 1729, ext: "tsx"}},
                    {id: "src/pages/settings.tsx", title: "settings.tsx", data: {kind: "file", size: 2612, ext: "tsx"}},
                ],
            },
            {id: "src/main.tsx", title: "main.tsx", data: {kind: "file", size: 996, ext: "tsx"}},
        ],
    },
    {
        id: "public",
        title: "public",
        data: {kind: "folder"},
        children: [
            {id: "public/favicon.ico", title: "favicon.ico", data: {kind: "file", size: 5430, ext: "ico"}},
            {id: "public/robots.txt", title: "robots.txt", data: {kind: "file", size: 120, ext: "txt"}},
        ],
    },
    {id: "package.json", title: "package.json", data: {kind: "file", size: 1854, ext: "json"}},
];

/* =============================
 * 2) Services / categories sample
 * ============================= */
export type ServiceMeta = {
    type: "group" | "service";
    key?: string;
    rate?: number;
    min?: number;
    max?: number;
    active?: boolean;
};

export const servicesTree: Array<TreeNode<ServiceMeta>> = [
    {
        id: "social",
        title: "Social",
        expanded: true,
        data: {type: "group"},
        children: [
            {
                id: "social/instagram",
                title: "Instagram",
                expanded: true,
                data: {type: "group"},
                children: [
                    {
                        id: "svc:ig-followers",
                        title: "Followers (Real, HQ)",
                        data: {type: "service", key: "ig_followers_hq", rate: 1.25, min: 100, max: 50000, active: true},
                    },
                    {
                        id: "svc:ig-likes",
                        title: "Likes (Auto, 30 days)",
                        data: {type: "service", key: "ig_likes_auto", rate: 0.45, min: 50, max: 200000, active: true},
                    },
                ],
            },
            {
                id: "social/twitter",
                title: "Twitter/X",
                data: {type: "group"},
                children: [
                    {
                        id: "svc:x-retweets",
                        title: "Retweets (Dripfeed)",
                        data: {type: "service", key: "x_retweets", rate: 0.75, min: 25, max: 100000, active: false},
                    },
                ],
            },
        ],
    },
    {
        id: "seo",
        title: "SEO",
        data: {type: "group"},
        children: [
            {
                id: "svc:seo-backlinks",
                title: "Backlinks Premium",
                data: {type: "service", key: "seo_backlinks", rate: 9.99, min: 1, max: 1000, active: true}
            },
        ],
    },
];

/* =============================
 * 3) Form builder sample
 * ============================= */
export type FieldMeta =
    | { kind: "page" }
    | { kind: "section" }
    | { kind: "field"; fieldType: "text" | "number" | "select"; required?: boolean; defaultValue?: string | number };

export const formTree: Array<TreeNode<FieldMeta>> = [
    {
        id: "page:account",
        title: "Account",
        expanded: true,
        data: {kind: "page"},
        children: [
            {
                id: "section:profile",
                title: "Profile",
                expanded: true,
                data: {kind: "section"},
                children: [
                    {
                        id: "field:first_name",
                        title: "First name",
                        data: {kind: "field", fieldType: "text", required: true}
                    },
                    {
                        id: "field:last_name",
                        title: "Last name",
                        data: {kind: "field", fieldType: "text", required: true}
                    },
                    {id: "field:age", title: "Age", data: {kind: "field", fieldType: "number"}},
                ],
            },
            {
                id: "section:preferences",
                title: "Preferences",
                data: {kind: "section"},
                children: [
                    {
                        id: "field:language",
                        title: "Language",
                        data: {kind: "field", fieldType: "select", defaultValue: "en"}
                    },
                ],
            },
        ],
    },
    {
        id: "page:security",
        title: "Security",
        data: {kind: "page"},
        children: [
            {
                id: "section:auth", title: "Authentication", data: {kind: "section"}, children: [
                    {
                        id: "field:2fa",
                        title: "Enable 2FA",
                        data: {kind: "field", fieldType: "select", defaultValue: "off"}
                    },
                ]
            },
        ],
    },
];

/* =============================
 * 4) Synthetic generator (for stress tests)
 * ============================= */
export type SynthMeta = { tag?: string; index: number };

export function makeSyntheticTree(
    levels = 3,
    childrenPerNode = 4,
    prefix = "node"
): Array<TreeNode<SynthMeta>> {
    let idCounter = 0;

    function makeLevel(level: number, parentId: string): Array<TreeNode<SynthMeta>> {
        if (level >= levels) return [];
        return Array.from({length: childrenPerNode}, (_, i) => {
            const id = `${parentId}/${i}`;
            const node: TreeNode<SynthMeta> = {
                id: `${prefix}-${idCounter++}`,
                title: `${prefix.toUpperCase()} ${level}.${i}`,
                expanded: level < 2, // expand top levels for visibility
                data: {tag: level === 0 ? "root" : level === levels - 1 ? "leaf" : "branch", index: i},
            };
            const kids = makeLevel(level + 1, id);
            if (kids.length) node.children = kids;
            return node;
        });
    }

    return makeLevel(0, "r");
}
