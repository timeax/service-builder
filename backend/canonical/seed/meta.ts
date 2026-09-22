// SPDX-License-Identifier: GPL-3.0-only
import type { WorkspaceActor } from "@elqora/dgp-workspace";

export const WORKSPACE_ID = "ws:local";
export const MAIN_BRANCH_ID = "branch:main";
export const EXPERIMENT_BRANCH_ID = "branch:experiment";
export const SEED_TIME = "2026-01-15T12:00:00.000Z";

export const workspaceActor: WorkspaceActor = {
  id: "actor:davy",
  display_name: "Davy",
  meta: { environment: "studio-development", author_id: "actor:davy" },
};
