# Agent guidance: DGP Studio

## Role

This repository is the current Studio implementation and the migration source for the future `dgp-studio` application. It is the visual authoring and testing environment for Digital Goods Protocol product definitions. It may remain runnable and embeddable, but it must not become the canonical owner of protocol, interpretation, validation, ordering, or backend contracts.

## Owned behavior

- Studio layout, visual canvas, React Flow presentation, layer tree, drag and drop, panels, toolbars, and context menus.
- Property editors for product-definition fields and host-supported extensions.
- Fallback-editor UI, comments UI, diagnostic presentation, boot-status presentation, and publication-readiness UX.
- Preview and play surfaces, expression authoring, browser JavaScript expression execution tests, test inputs, expected outputs, and author feedback.
- Host-facing authorization UX, permission labels, disabled states, and application-specific action mapping.
- Studio-specific styling, component registries, and input/editor presentation.

## Package boundaries

- Consume `dgp-workspace` for backend ports, boot and hydration, editorial session state, document mutations, branches, drafts, snapshots, comments, templates, autosave, collaboration, and publication coordination.
- Consume `dgp-core` for deterministic product-definition interpretation.
- Consume `dgp-validation` for definition diagnostics; do not duplicate canonical validation algorithms in Studio components.
- Consume `dgp-ordering` for customer input orchestration, ordering preview behavior, quantity resolution, and browser-side customer-field expression execution.
- Consume `dgp-spec` for canonical wire contracts and sibling `dgp-sdk` as the backend service, capability, rate, charge, and fulfillment authority.
- Keep host persistence, transport, authentication, and authorization enforcement behind adapters. Studio presentation checks are not a security boundary.

## Browser JavaScript expressions

- Quantity and customer-field `eval` expressions are intentional JavaScript supplied by trusted hosts or administrators for browser execution.
- Studio must support authoring, previewing, and testing those expressions before publication.
- Hosts and administrators are responsible for the correctness of expressions they publish and the runtime policy under which they execute.
- Do not remove, redesign, sandbox, or silently change expression behavior merely because the definition contains executable JavaScript. Such changes require an explicit product and compatibility decision.
- Backend and non-browser SDKs are not required to execute these expressions.

## Migration guidance

- Preserve this repository's visual and application behavior when it becomes `dgp-studio`; do not copy it into `dgp-workspace`.
- Replace legacy `@timeax/digital-service-engine` imports package-by-package as the DGP repositories become implementable.
- Treat `D:\Projects\GitHub\digital-service-ui-builder` as the legacy engine and behavioral reference, not as the future package boundary.
- Do not rename this repository or migrate source code as part of documentation-only work unless explicitly requested.
- Preserve unrelated working-tree changes and stage only files within the requested task.

## References

- DGP polyrepo workspace and shared agent contract: `D:\Projects\GitHub\elqora\digital-goods-protocol\AGENTS.md`.
- Backend authority: `D:\Projects\GitHub\elqora\digital-goods-protocol\dgp-sdk`.
- Sibling DGP repositories: `dgp-spec`, `dgp-core`, `dgp-validation`, `dgp-ordering`, and `dgp-workspace` under `D:\Projects\GitHub\elqora\digital-goods-protocol`.
- Legacy engine: `D:\Projects\GitHub\digital-service-ui-builder`.
