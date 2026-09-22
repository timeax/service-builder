// SPDX-License-Identifier: GPL-3.0-only
import type {
  CommentThread,
  FieldTemplate,
  MemoryWorkspacePersistence,
  MemoryWorkspaceSeed,
  MemoryWorkspaceSnapshot,
  WorkspaceBranchData,
  WorkspaceEditorialState,
} from "@elqora/dgp-workspace";

import { authors } from "./authors.js";
import { definition } from "./definition.js";
import {
  EXPERIMENT_BRANCH_ID,
  MAIN_BRANCH_ID,
  SEED_TIME,
  WORKSPACE_ID,
} from "./meta.js";
import { permissions } from "./permissions.js";
import { policies } from "./policies.js";
import { services } from "./services.js";

const editorialState: WorkspaceEditorialState = {
  positions: {
    "filter:platform": { x: 120, y: 140 },
    "field:service": { x: 420, y: 80 },
    "field:url": { x: 420, y: 170 },
    "field:quantity": { x: 420, y: 260 },
    "option:instagram-followers": { x: 720, y: 80 },
  },
  viewport: { x: 0, y: 0, zoom: 1 },
  selection_ids: ["field:service"],
  highlighted_ids: ["option:instagram-followers"],
  edge_mode: "bind",
  shown_option_fields: ["field:service"],
};

const templates: FieldTemplate[] = [
  {
    id: "template:url",
    key: "url",
    name: "Target URL",
    field: {
      id: "template-field:url",
      type: "text",
      variant: "url",
      label: "Target URL",
      required: true,
      meta: { placeholder: "https://example.com/post" },
    },
    branch_id: null,
    published: true,
    updated_at: SEED_TIME,
    meta: { tags: ["core", "input"] },
  },
  {
    id: "template:quantity",
    key: "quantity",
    name: "Quantity",
    field: {
      id: "template-field:quantity",
      type: "number",
      label: "Quantity",
      default_value: 100,
      quantity: { value_by: "value", clamp: { min: 1 } },
    },
    branch_id: null,
    published: true,
    updated_at: SEED_TIME,
    meta: { tags: ["core", "ordering"] },
  },
];

const mainComments: CommentThread[] = [
  {
    id: "thread:welcome",
    branch_id: MAIN_BRANCH_ID,
    target_path: "canvas@420,180",
    resolved: false,
    created_at: SEED_TIME,
    messages: [
      {
        id: "message:welcome",
        author_id: "actor:bot",
        body: "The canonical development backend includes branches, templates, services, comments, and publication policies.",
        created_at: SEED_TIME,
        edited_at: null,
        meta: {},
      },
    ],
    meta: { priority: "low" },
  },
  {
    id: "thread:canvas-notes",
    branch_id: MAIN_BRANCH_ID,
    target_path: "field:service",
    resolved: false,
    created_at: SEED_TIME,
    messages: [
      {
        id: "message:canvas-note",
        author_id: "actor:davy",
        body: "Keep temporary connection handles visible while adding relationships.",
        created_at: SEED_TIME,
        edited_at: null,
        meta: {},
      },
    ],
    meta: { priority: "medium", tags: ["canvas", "ux"] },
  },
];

function createBranch(
  id: string,
  name: string,
  main: boolean,
  comments: CommentThread[],
): WorkspaceBranchData {
  const commit = {
    id: `commit:${name}:1`,
    branch_id: id,
    message: `Initial ${name} seed`,
    author_id: "actor:davy",
    created_at: SEED_TIME,
    definition: structuredClone(definition),
    editorial_state: structuredClone(editorialState),
    revision: 1,
    meta: { seeded: true },
  };

  return {
    branch: {
      id,
      name,
      main,
      created_at: SEED_TIME,
      created_by: "actor:davy",
      meta: { seeded: true },
    },
    definition: structuredClone(definition),
    editorial_state: structuredClone(editorialState),
    head: commit,
    draft: null,
    templates: structuredClone(templates),
    participants: [
      {
        actor_id: "actor:davy",
        role: main ? "owner" : "editor",
        joined_at: SEED_TIME,
        meta: { presence: "online" },
      },
    ],
    comments: structuredClone(comments),
    commits: [commit],
    revision: 1,
  };
}

const seededSnapshot: MemoryWorkspaceSnapshot = {
  workspace_id: WORKSPACE_ID,
  authors,
  permissions,
  services: [...services],
  policy_rules: policies,
  branches: [
    createBranch(MAIN_BRANCH_ID, "main", true, mainComments),
    createBranch(EXPERIMENT_BRANCH_ID, "experiment", false, [
      {
        id: "thread:experiment",
        branch_id: EXPERIMENT_BRANCH_ID,
        target_path: "field:quantity",
        resolved: false,
        created_at: SEED_TIME,
        messages: [
          {
            id: "message:experiment",
            author_id: "actor:davy",
            body: "Use this branch to test branch-scoped editorial changes.",
            created_at: SEED_TIME,
            edited_at: null,
            meta: {},
          },
        ],
        meta: { priority: "medium" },
      },
    ]),
  ],
  sequence: 100,
};

/** Persistence port that restores a fresh deterministic snapshot per backend. */
export function createSeedPersistence(): MemoryWorkspacePersistence {
  let snapshot = structuredClone(seededSnapshot);
  return {
    async load(workspaceId) {
      return workspaceId === WORKSPACE_ID ? structuredClone(snapshot) : undefined;
    },
    async save(next) {
      snapshot = structuredClone(next);
    },
  };
}

export const workspaceSeed: MemoryWorkspaceSeed = {
  workspace_id: WORKSPACE_ID,
  definition,
  authors,
  permissions,
  services: [...services],
  policy_rules: policies,
  now: () => SEED_TIME,
  persistence: createSeedPersistence(),
};

export { definition, services };
