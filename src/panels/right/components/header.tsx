import Users, { mockUsers } from '@/panels/right/components/users.tsx';
import { MdOutlinePlayArrow } from 'react-icons/md';
import { PiShareFatThin } from 'react-icons/pi';

const Header = () => {
    return (
        <div className={'flex items-center justify-between border-b border-gray-200 p-2.5 dark:border-gray-700'}>
            <div className="flex items-center gap-4">
                <Users users={mockUsers} />
                <button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                    <MdOutlinePlayArrow className={'text-2xl'} />
                </button>
            </div>
            <button className="flex h-7 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#0095FF] text-white hover:bg-[#007edc]">
                <PiShareFatThin />
            </button>
        </div>
    );
};

export default Header;
