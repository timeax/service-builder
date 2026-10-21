// SPDX-License-Identifier: GPL-3.0-only
import type { WorkspaceAuthor } from "@elqora/dgp-workspace";

export const authors: WorkspaceAuthor[] = [
  {
    id: "actor:davy",
    display_name: "Davy",
    avatar_url: null,
    meta: { kind: "human", handle: "timeax" },
  },
  {
    id: "actor:bot",
    display_name: "Builder Bot",
    avatar_url: null,
    meta: { kind: "system", handle: "builder-bot" },
  },
];
