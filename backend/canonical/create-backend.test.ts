// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";

import {
  studioDemoWorkspaceBackend,
  workspaceBackend,
} from "./create-backend.js";
import { workspaceActor } from "./seed/meta.js";

describe("canonical Studio development backend", () => {
  it("hydrates the Instagram Likes ProductDefinition and mapped services", async () => {
    const result = await workspaceBackend.load(workspaceActor);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.workspace_id).toBe("ws:instagram-likes");
    expect(result.value.current.definition.id).toBe("instagram-likes-likes");
    expect(result.value.services).toHaveLength(226);
    expect(
      result.value.current.definition.filters.find((filter) => filter.id === "t:root"),
    ).toMatchObject({ service_id: 128 });
    expect(
      result.value.current.definition.filters.find((filter) => filter.id === "t:standard"),
    ).toMatchObject({ service_id: 212 });
    expect(result.value.current.definition.includes_for_buttons["f:drip_feed"]).toEqual([
      "f:runs",
      "f:interval",
    ]);
    expect(
      result.value.current.definition.fields.find((field) => field.id === "f:runs"),
    ).not.toHaveProperty("bind_id");
    expect(
      result.value.current.definition.fields.find((field) => field.id === "f:interval"),
    ).not.toHaveProperty("bind_id");
    expect(result.value.services[0]).toHaveProperty("capabilities");
    expect(result.value.services[0]).not.toHaveProperty("flags");
    const serviceIds = new Set(result.value.services.map((service) => service.id));
    const definition = result.value.current.definition;
    expect(definition.filters.every((filter) => filter.service_id !== undefined)).toBe(true);
    const boundIds = [
      ...definition.filters.flatMap((filter) => filter.service_id === undefined ? [] : [filter.service_id]),
      ...definition.fields.flatMap((field) => [
        ...(field.button && field.service_id !== undefined ? [field.service_id] : []),
        ...(field.options ?? []).flatMap((option) => option.service_id === undefined ? [] : [option.service_id]),
      ]),
      ...Object.values(definition.fallbacks?.nodes ?? {}).flat(),
      ...Object.values(definition.fallbacks?.global ?? {}).flat(),
    ];
    expect(boundIds.length).toBeGreaterThan(0);
    expect(boundIds.every((id) => serviceIds.has(id))).toBe(true);
  });

  it("keeps the general-purpose demo seed available", async () => {
    const result = await studioDemoWorkspaceBackend.load(workspaceActor);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.workspace_id).toBe("ws:local");
    expect(result.value.services).toHaveLength(304);
    expect(result.value.current.definition.id).toBe("studio-demo");
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
