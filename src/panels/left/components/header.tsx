import { BuilderIconButton } from '@/components/builder';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import type { Menu } from '@/index';
import Drafts from '@/panels/left/components/drafts.tsx';
import { getWorkspaceBootHeadline } from '@/workspace/boot.ts';
import type { WorkspaceAPI } from '@timeax/digital-service-engine/workspace';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useState } from 'react';
import { BsChevronDown, BsChevronRight } from 'react-icons/bs';
import { MdMenuOpen, MdOutlineSpaceDashboard } from 'react-icons/md';
import { X } from 'lucide-react';

interface HeaderProps {
    menu?: Menu[];
}

const CATALOG_PROMPT = `You are helping organize a DGP service list into a Service Builder catalog.

Input:
- A JSON array of DGP services.
- Each service may include fields like id, service, name, rate, min, max, dripfeed, refill, cancel, speed, start time, provider/handler, description, metadata, or other fields.
- Some fields may be missing, inconsistent, or encoded inside the service name.

Goal:
Create a complete Service Builder catalog that helps admins browse, review, and manage the services.

Return a valid JSON object only.

Catalog shape:
{
  "version": 1,
  "nodes": [],
  "activeNodeId": undefined_or_string,
  "expandedIds": [],
  "pinnedNodeIds": [],
  "selectedServiceId": undefined_or_string_or_number,
  "viewMode": "grouped"
}

Normal group node shape:
{
  "id": "cg:...",
  "kind": "group",
  "label": "...",
  "parentId": "... optional",
  "description": "... optional",
  "serviceIds": [],
  "order": 0
}

Smart group node shape:
{
  "id": "csg:...",
  "kind": "smart-group",
  "label": "...",
  "parentId": "... optional",
  "description": "... optional",
  "rules": [],
  "match": "all",
  "order": 0
}

Catalog structure:
Create an admin-friendly folder/subfolder structure for browsing the services.

Grouping strategy:
- Group services by repeated patterns, markers, or similarities in the provided list.
- Use service names, metadata, limits, rates, refill behavior, speed, start time, quality markers, and delivery style to infer useful groups.
- Create folders only when they make the list easier to browse.
- Use subfolders when a group has clear internal sections.
- Avoid forced or generic grouping.
- Avoid creating one folder per service.
- Put unclear services into “Needs Review” only when they do not fit any useful group.
- Every service must appear in at least one normal group.
- Preserve service IDs exactly as provided.
- Do not duplicate the same service id inside the same group.

Useful grouping signals:
- Quality: real, premium, HQ, cheap, bot, mixed, organic, verified.
- Delivery: instant, fast, slow, stable, gradual, drip-feed.
- Refill: refill, no refill, lifetime, 7 days, 30 days.
- Speed/start: start time, hourly delivery, daily delivery.
- Limits: low minimum, high maximum, small test orders, bulk services.
- Targeting: country, gender, niche, local, worldwide.
- Format: post, profile, story, reel, shorts, live, comment, channel.
- Risk/review: no guarantee, unstable, may drop, unusual wording.
- Provider/family: similar provider naming or repeated service family markers.

Output:
Return only the catalog JSON object.
Do not include markdown.
Do not include explanations outside JSON.

Services JSON:
{{services_json}}`;

const SERVICE_PROPS_PROMPT = `You are helping normalize raw DGP services into Service Builder service props.

Input:
- A JSON array of raw DGP services.
- Optional copied Service Builder policy context.
- Services may include fields like id, service, name, rate, min, max, dripfeed, refill, cancel, speed, start time, provider/handler, description, metadata, or other provider-specific fields.
- Some details may be missing, inconsistent, or encoded inside the service name.

Goal:
Normalize as many raw services as reasonably fit into a valid Service Builder service-mapping scaffold.

Do not force every raw service into the output.
Some services may be ignored if they do not fit the chosen normalized structure, conflict with the copied policies, appear too unclear, or would make the output messy.

The output should favor a clean, useful, policy-aware service mapping over complete raw-service coverage.

This is not final customer form design.
Focus on mapping raw services into:
- tags
- service-bearing fields
- service-bearing options
- service-bearing buttons
- fallback-ready structures
- notices/review notes

Service Builder purpose:
ServiceProps defines how raw services become a structured order-flow scaffold. It is used to describe service contexts, selectable service variants, visibility relationships, service bindings, fallback-ready mappings, and admin review notes.

Expected output:
Return valid JSON only.

Use this output shape:

{
  "props": {
    "schema_version": "1.0",
    "name": "...",
    "filters": [],
    "fields": [],
    "includes_for_buttons": {},
    "excludes_for_buttons": {},
    "orderKinds": {},
    "fallbacks": {
      "global": {},
      "nodes": {}
    },
    "notices": []
  },
  "reviewNotes": []
}

Service representation guide:
- Use a tag when a service or group of services represents a meaningful service context.
- Use a service-bearing option when several raw services are variants within the same context.
- Use a service-bearing field when the field itself represents a selectable service choice.
- Use a service-bearing button when selecting that choice changes the available service context.
- Use fallbacks when a service is better treated as a backup fulfilment service rather than a normal visible choice.
- Use notices/reviewNotes when the mapping is uncertain but still useful to preserve.

Tags / filters:
Each tag must have:
- id
- label

Tags may have:
- bind_id
- service_id
- includes
- excludes
- constraints
- meta

Use tags to represent service contexts and service group structure.

Always include a root tag:

{
  "id": "t:root",
  "label": "Root"
}

Use stable readable tag ids, for example:
- t:root
- t:premium
- t:fast-start
- t:refill
- t:large-max

A tag may carry service_id only when that tag directly represents one fulfilment service.

Fields:
Each field must have:
- id
- type
- label

Fields may have:
- bind_id
- name
- options
- service_id
- button
- pricing_role
- meta
- validation
- defaults
- description

Use fields when they help represent service choice or service mapping.

A field is appropriate when:
- it groups multiple raw services as selectable options;
- its options carry service_id values;
- it represents a service-bearing button/toggle;
- it controls visibility for other service-bearing choices;
- it is explicitly required by the supplied instruction or source data.

Prefer service-bearing options when several raw services are variants of the same service context.

Options:
Use options for service variants inside one field.

Each service-bearing option should include:

{
  "id": "o:...",
  "label": "...",
  "value": "...",
  "service_id": "...",
  "pricing_role": "base"
}

Use pricing_role="base" for real fulfilment services.
Use pricing_role="utility" only for add-ons, extra charges, or optional paid modifiers.

Do not mark a normal fulfilment service as utility.

Visibility:
Use bind_id for normal placement under a tag.

Use includes_for_buttons when selecting a button or option should reveal another service-bearing structure.

Use excludes_for_buttons when selecting a button or option should hide another service-bearing structure.

Only create visibility maps when they are useful for service mapping.

Copied Policy Context:
The user may provide copied Service Builder policies with this prompt.

Use those policies as guardrails while normalizing the raw DGP services into Service Builder structure.

Policies describe what must remain true when services are visible, selectable, or usable together. They may define rules around service type, platform, provider/handler, capability flags, uniqueness, rate compatibility, or other service properties.

When mapping services:
- Do not place services together in the same visible/selectable context if the copied policies would clearly reject them.
- If multiple raw services become options under one field, they should be compatible under the copied policies.
- If services need to be separated to satisfy the policies, separate them into different tags, fields, or review notes.
- If a policy affects fallback compatibility, respect it when marking services as fallback-ready.
- If the raw service data is missing fields needed to evaluate a policy, do not guess. Add a review note.
- Do not rewrite, regenerate, or invent policies unless explicitly asked.
- Do not add a policies key to ServiceProps unless the expected output shape explicitly supports it.

Rate-policy awareness:
Use rate compatibility when deciding whether services can be mapped together as options, related service choices, or fallbacks.

Do not assume any cheaper service is automatically compatible.

Supported rate policies:
- eq_primary: candidate rate must equal the primary rate.
- lte_primary with pct: candidate rate must be less than or equal to the primary rate, but still within the allowed lower percentage range.
- within_pct with pct: candidate rate may be above or below the primary rate within the allowed percentage range.
- at_least_pct_lower with pct: candidate must be at least the given percentage lower than the primary.

If a copied policy or provided context defines a preferred rate policy, use it.
If no rate policy is provided, avoid strict rate assumptions and use reviewNotes for uncertain compatibility.

Fallbacks:
Fallbacks are backup fulfilment services, not catalog groups and not normal customer choices.

Only map a service as a fallback when it appears compatible with the primary:
- same or very similar service purpose;
- compatible context;
- compatible refill/cancel/dripfeed or other capability flags;
- similar min/max limits;
- compatible rate policy where available;
- not the same service as the primary;
- not clearly lower quality unless the context allows it.

Use node-scoped fallbacks when compatibility depends on a tag, field, or option.
Use global fallbacks only when the fallback is broadly compatible with the primary service.

Fallback shape:

{
  "fallbacks": {
    "global": {
      "primary_service_id": ["fallback_service_id"]
    },
    "nodes": {
      "tag_or_field_or_option_id": ["fallback_service_id"]
    }
  }
}

Constraints:
Use constraints when a whole tag/context requires or represents a capability.

Example:

{
  "constraints": {
    "refill": true,
    "cancel": true,
    "dripfeed": false
  }
}

Do not invent constraints if the raw service data does not support them.

Notices and review notes:
Use notices or reviewNotes for uncertainty.

Use them when:
- service wording is unclear;
- provider data is missing;
- min/max limits are suspicious;
- rate compatibility is uncertain;
- fallback compatibility needs admin review;
- a service was mapped using a reasonable assumption;
- a service may violate a copied policy but the data is incomplete.

Private notice example:

{
  "id": "n:...",
  "type": "private",
  "kind": "warning",
  "severity": "warning",
  "target": { "scope": "global" },
  "title": "Needs review",
  "message": "..."
}

Mapping quality:
- Preserve raw service IDs exactly as provided.
- Do not duplicate ids.
- Do not duplicate the same service mapping in the same context.
- Keep labels admin-friendly and concise.
- Prefer stable ids using lowercase kebab-case.
- Avoid one field or tag per service when services clearly fit together.
- Avoid forcing services together when policies or compatibility suggest separation.
- Use reviewNotes instead of pretending uncertain decisions are guaranteed.
- Map as many services as reasonably fit, but do not force full raw-service coverage.

Raw services JSON:
{{services_json}}

Copied policies/context:
{{copied_policies}}`;

const MenuRenderer = ({ items, workspace, depth = 0 }: { items: Menu[]; workspace: WorkspaceAPI; depth?: number }) => {
    const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

    const toggleSubmenu = (name: string) => {
        setOpenSubmenus((prev) => ({ ...prev, [name]: !prev[name] }));
    };

    return (
        <ul className="flex flex-col gap-1">
            {items.map((item, index) => {
                const hasChildren = item.children && item.children.length > 0;
                const isOpen = openSubmenus[item.name];

                if (item.render) {
                    return <li key={index}>{item.render()}</li>;
                }

                return (
                    <li key={index} className="flex flex-col">
                        <button
                            type="button"
                            onClick={() => {
                                if (hasChildren) {
                                    toggleSubmenu(item.name);
                                } else if (item.command) {
                                    item.command(workspace);
                                }
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {item.icon && <span className="flex h-4 w-4 items-center justify-center text-slate-500">{item.icon}</span>}
                            <span className="flex-1 text-left">{item.name}</span>
                            {hasChildren && (
                                <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                                    <BsChevronRight className="h-3 w-3" />
                                </span>
                            )}
                        </button>
                        {hasChildren && isOpen && (
                            <div className="mt-1 ml-4 border-l border-slate-200 pl-2 dark:border-slate-800">
                                <MenuRenderer items={item.children!} workspace={workspace} depth={depth + 1} />
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

const Header = ({ menu = [] }: HeaderProps) => {
    const ws = useWorkspace();
    const canvas = useCanvas();
    const [isPromptsDialogOpen, setIsPromptsDialogOpen] = useState(false);
    const [activePromptTab, setActivePromptTab] = useState<'catalog' | 'service-props'>('catalog');
    const [copyError, setCopyError] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<'services' | 'policies' | 'rate-policy' | 'fallback-settings' | null>(null);

    const currentBranch = ws.branches.data?.find((branch) => branch.id === ws.branches.currentId);
    const workspaceStatus = getWorkspaceBootHeadline(ws.boot);

    const copyServicesProps = async () => {
        try {
            const value = JSON.stringify(ws.services?.data ?? {}, null, 2);
            await navigator.clipboard.writeText(value);
            setCopyError(null);
            setCopiedKey('services');
            setTimeout(() => setCopiedKey((prev) => (prev === 'services' ? null : prev)), 1500);
        } catch {
            setCopyError('Unable to copy services props. Please copy manually from the workspace services map.');
        }
    };
    const copyPolicies = async () => {
        try {
            const value = JSON.stringify(ws.policies?.policies?.data ?? [], null, 2);
            await navigator.clipboard.writeText(value);
            setCopyError(null);
            setCopiedKey('policies');
            setTimeout(() => setCopiedKey((prev) => (prev === 'policies' ? null : prev)), 1500);
        } catch {
            setCopyError('Unable to copy policies. Please copy manually from the workspace policies list.');
        }
    };
    const copyRatePolicy = async () => {
        try {
            const serviceProps = (canvas.api.builder.getProps?.() ?? canvas.props ?? {}) as any;
            const ratePolicy = serviceProps?.fallbackSettings?.ratePolicy ?? canvas.api.builder.getOptions?.()?.fallbackSettings?.ratePolicy ?? null;
            await navigator.clipboard.writeText(JSON.stringify(ratePolicy, null, 2));
            setCopyError(null);
            setCopiedKey('rate-policy');
            setTimeout(() => setCopiedKey((prev) => (prev === 'rate-policy' ? null : prev)), 1500);
        } catch {
            setCopyError('Unable to copy rate policy. Please copy manually from fallback settings.');
        }
    };
    const copyFallbackSettings = async () => {
        try {
            const serviceProps = (canvas.api.builder.getProps?.() ?? canvas.props ?? {}) as any;
            const fallbackSettings = serviceProps?.fallbackSettings ?? canvas.api.builder.getOptions?.()?.fallbackSettings ?? {};
            await navigator.clipboard.writeText(JSON.stringify(fallbackSettings, null, 2));
            setCopyError(null);
            setCopiedKey('fallback-settings');
            setTimeout(() => setCopiedKey((prev) => (prev === 'fallback-settings' ? null : prev)), 1500);
        } catch {
            setCopyError('Unable to copy fallback settings. Please copy manually from workspace settings.');
        }
    };

    const fullMenu: Menu[] = [
        {
            name: 'Status',
            render: () => <div className="px-2 py-1.5 text-xs font-medium tracking-wider text-slate-500 uppercase">{workspaceStatus}</div>,
        },
        {
            name: 'Prompts',
            command: () => setIsPromptsDialogOpen(true),
        },
        ...menu,
    ];

    return (
        <>
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                            <MdOutlineSpaceDashboard className="text-base" />
                        </span>
                        <div className={'flex flex-col justify-center gap-0'}>
                            <h1 className="text-base leading-tight font-semibold text-slate-900 dark:text-slate-100">Service Builder</h1>
                            <Drafts
                                trigger={
                                    <button
                                        type="button"
                                        className="inline-flex cursor-pointer items-center gap-1 rounded-md text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                    >
                                        <span>
                                            Active branch - <b>{currentBranch?.name ?? 'Main branch'}</b>
                                        </span>
                                        <BsChevronDown />
                                    </button>
                                }
                            />
                        </div>
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <span>
                                <BuilderIconButton title="Menu">
                                    <MdMenuOpen />
                                </BuilderIconButton>
                            </span>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                            <MenuRenderer items={fullMenu} workspace={ws} />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {isPromptsDialogOpen ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
                    onClick={() => setIsPromptsDialogOpen(false)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setIsPromptsDialogOpen(false);
                    }}
                    tabIndex={-1}
                >
                    <div
                        className="flex h-[min(92vh,900px)] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-3 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Prompts</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Catalog and service-props normalization prompts.</p>
                                </div>
                                <Button type="button" variant="outline" size="icon" onClick={() => setIsPromptsDialogOpen(false)} aria-label="Close prompts dialog">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" onClick={copyServicesProps}>
                                    {copiedKey === 'services' ? 'Copied services props' : 'Copy services props'}
                                </Button>
                                <Button type="button" variant="outline" onClick={copyPolicies}>
                                    {copiedKey === 'policies' ? 'Copied policies' : 'Copy policies'}
                                </Button>
                                <Button type="button" variant="outline" onClick={copyRatePolicy}>
                                    {copiedKey === 'rate-policy' ? 'Copied rate policy' : 'Copy rate policy'}
                                </Button>
                                <Button type="button" variant="outline" onClick={copyFallbackSettings}>
                                    {copiedKey === 'fallback-settings' ? 'Copied fallback settings' : 'Copy fallback settings'}
                                </Button>
                            </div>
                        </div>

                        {copyError ? <p className="mb-2 text-xs text-rose-600 dark:text-rose-300">{copyError}</p> : null}

                        <Tabs className="min-h-0 flex-1" value={activePromptTab} onValueChange={(value) => setActivePromptTab(value as 'catalog' | 'service-props')}>
                            <TabsList className="mb-3 grid w-full grid-cols-2">
                                <TabsTrigger value="catalog">Catalog prompt</TabsTrigger>
                                <TabsTrigger value="service-props">Service props generator prompt</TabsTrigger>
                            </TabsList>
                            <ScrollArea className="min-h-0 flex-1 w-full rounded-md border border-slate-200 p-2 dark:border-slate-800">
                                <TabsContent value="catalog">
                                    <pre className="min-h-[520px] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                                        {CATALOG_PROMPT}
                                    </pre>
                                </TabsContent>

                                <TabsContent value="service-props" className="space-y-2">
                                    <pre className="min-h-[530px] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                                        {SERVICE_PROPS_PROMPT}
                                    </pre>
                                </TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default Header;
