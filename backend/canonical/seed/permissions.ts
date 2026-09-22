// SPDX-License-Identifier: GPL-3.0-only
import type { WorkspacePermissions } from "@elqora/dgp-workspace";

export const permissions: WorkspacePermissions = {
  "document.mutate": true,
  "draft.save": true,
  "commit.create": true,
  publish: true,
  "branch.create": true,
  "branch.set_main": true,
  "branch.merge": true,
  "branch.delete": true,
  "template.write": true,
  "comment.write": true,
};
