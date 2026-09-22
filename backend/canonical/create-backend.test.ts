// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";

import { workspaceBackend } from "./create-backend.js";
import { workspaceActor } from "./seed/meta.js";

describe("canonical Studio development backend", () => {
  it("hydrates the rich canonical seed", async () => {
    const result = await workspaceBackend.load(workspaceActor);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.workspace_id).toBe("ws:local");
    expect(result.value.branches).toHaveLength(2);
    expect(result.value.current.comments).toHaveLength(2);
    expect(result.value.current.templates).toHaveLength(2);
    expect(result.value.services).toHaveLength(304);
    expect(result.value.services[0]).toHaveProperty("capabilities");
    expect(result.value.services[0]).not.toHaveProperty("flags");
  });

  it("uses Workspace revision semantics for draft conflicts", async () => {
    const boot = await workspaceBackend.load(workspaceActor);
    expect(boot.ok).toBe(true);
    if (!boot.ok) return;

    const input = {
      branch_id: boot.value.current_branch_id,
      actor_id: workspaceActor.id,
      definition: boot.value.current.definition,
      editorial_state: boot.value.current.editorial_state,
      base_commit_id: boot.value.current.head?.id ?? null,
      base_revision: boot.value.current.revision,
    };
    const saved = await workspaceBackend.save_draft(input);
    expect(saved.ok).toBe(true);

    const conflict = await workspaceBackend.save_draft(input);
    expect(conflict).toMatchObject({
      ok: false,
      error: { code: "revision_conflict" },
    });
  });
});
