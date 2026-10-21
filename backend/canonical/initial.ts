// SPDX-License-Identifier: GPL-3.0-only
import type { WorkspaceActor } from "@elqora/dgp-workspace";

import { workspaceActor } from "./seed/meta.js";

/** @deprecated Compose Studio with workspaceActor and workspaceBackend. */
export const workspaceInitial: { actor: WorkspaceActor } = { actor: workspaceActor };
