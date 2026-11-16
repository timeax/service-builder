// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from "@elqora/dgp-workspace";

import {
  instagramLikesWorkspaceSeed,
  workspaceSeed,
} from "./seed/index.js";

/** Existing general-purpose demo backend, retained for focused UI fixtures. */
export const studioDemoWorkspaceBackend = new MemoryWorkspaceBackend(workspaceSeed);

/** Active backend used by the standalone app, seeded with Instagram Likes. */
export const workspaceBackend = new MemoryWorkspaceBackend(
  instagramLikesWorkspaceSeed,
);

/** Explicit alias for callers that need the product-specific seed. */
export const instagramLikesWorkspaceBackend = workspaceBackend;
