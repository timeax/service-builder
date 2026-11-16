// SPDX-License-Identifier: GPL-3.0-only
import type { MemoryWorkspaceSeed } from "@elqora/dgp-workspace";

import { authors } from "./authors.js";
import { instagramLikesDefinition } from "./definition-instagram-likes.js";
import { SEED_TIME } from "./meta.js";
import { permissions } from "./permissions.js";
import { instagramLikesServices } from "./services-instagram-likes.js";

/** Isolated workspace seed for the Instagram Likes registry and ProductDefinition. */
export const instagramLikesWorkspaceSeed: MemoryWorkspaceSeed = {
  workspace_id: "ws:instagram-likes",
  branch_name: "main",
  definition: instagramLikesDefinition,
  authors,
  permissions,
  services: [...instagramLikesServices],
  policy_rules: [],
  now: () => SEED_TIME,
};

export { instagramLikesDefinition, instagramLikesServices };
