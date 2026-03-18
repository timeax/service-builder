import { FiGrid, FiMap, FiMinus, FiPlus } from 'react-icons/fi';
import { LuAlignCenterVertical, LuBetweenHorizontalStart, LuGitCompareArrows, LuMoveUpRight } from 'react-icons/lu';
import { MdOutlineFitScreen, MdOutlineKeyboardArrowDown } from 'react-icons/md';

export const Icons = {
    bind: (active = false) => <LuGitCompareArrows className={active ? 'text-blue-600' : ''} />,
    include: (active = false) => <LuMoveUpRight className={active ? 'text-blue-600' : ''} />,
    exclude: (active = false) => <LuBetweenHorizontalStart className={active ? 'text-blue-600' : ''} />,
    grid: (active = false) => <FiGrid className={active ? 'text-blue-600' : ''} />,
    minimap: (active = false) => <FiMap className={active ? 'text-blue-600' : ''} />,
    zoomIn: () => <FiPlus />,
    zoomOut: () => <FiMinus />,
    fit: () => <MdOutlineFitScreen />,
    viewport: () => <LuAlignCenterVertical />,
    chevronDown: () => <MdOutlineKeyboardArrowDown />,
};

