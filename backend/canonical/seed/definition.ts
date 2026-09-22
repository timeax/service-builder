// SPDX-License-Identifier: GPL-3.0-only
import type { ProductDefinition } from "@elqora/dgp-spec";

export const definition: ProductDefinition = {
  id: "studio-demo",
  name: "Social engagement product",
  description: "Canonical v1 product used by the standalone Studio development backend.",
  schema_version: "1",
  filters: [
    { id: "filter:platform", label: "Platform", meta: { visible: true } },
    { id: "filter:instagram", label: "Instagram", bind_id: "filter:platform" },
  ],
  fields: [
    {
      id: "field:service",
      type: "select",
      label: "Service",
      bind_id: "filter:platform",
      options: [
        {
          id: "option:instagram-followers",
          label: "Instagram followers - fast",
          value: 10147,
          service_id: 10147,
          pricing_role: "base",
        },
      ],
    },
    {
      id: "field:url",
      type: "text",
      label: "Target URL",
      name: "link",
      bind_id: "filter:platform",
      required: true,
    },
    {
      id: "field:quantity",
      type: "number",
      label: "Quantity",
      name: "quantity",
      bind_id: "filter:platform",
      default_value: 100,
      quantity: { value_by: "value", clamp: { min: 1 } },
    },
  ],
  order_for_tags: {
    "filter:platform": ["field:service", "field:url", "field:quantity"],
  },
  includes_for_buttons: {},
  excludes_for_buttons: {},
  option_effects_for_buttons: {},
  value_effects_for_triggers: {},
  fallbacks: null,
  notices: [],
  meta: { seeded: true },
};
