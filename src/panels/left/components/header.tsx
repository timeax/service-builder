import { BuilderIconButton } from '@/components/builder';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Menu } from '@/index';
import Drafts from '@/panels/left/components/drafts.tsx';
import { getWorkspaceBootHeadline } from '@/workspace/boot.ts';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useState } from 'react';
import { BsChevronDown, BsChevronRight } from 'react-icons/bs';
import { MdMenuOpen, MdOutlineSpaceDashboard } from 'react-icons/md';

interface HeaderProps {
    menu?: Menu[];
}

const MenuRenderer = ({ items, depth = 0 }: { items: Menu[]; depth?: number }) => {
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
                                    item.command();
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
                                <MenuRenderer items={item.children!} depth={depth + 1} />
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

    const currentBranch = ws.branches.data?.find((branch) => branch.id === ws.branches.currentId);
    const workspaceStatus = getWorkspaceBootHeadline(ws.boot);

    const fullMenu: Menu[] = [
        {
            name: 'Status',
            render: () => <div className="px-2 py-1.5 text-xs font-medium tracking-wider text-slate-500 uppercase">{workspaceStatus}</div>,
        },
        ...menu,
    ];

    return (
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
                        <MenuRenderer items={fullMenu} />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};

export default Header;
