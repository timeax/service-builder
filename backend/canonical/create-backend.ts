// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from "@elqora/dgp-workspace";

import { workspaceSeed } from "./seed/index.js";

/**
 * Development backend used by the standalone Studio application.
 *
 * All document, branch, revision, template, comment, and publication behavior
 * is owned by dgp-workspace. Studio only supplies deterministic demonstration
 * data through the canonical memory persistence port.
 */
export const workspaceBackend = new MemoryWorkspaceBackend(workspaceSeed);
