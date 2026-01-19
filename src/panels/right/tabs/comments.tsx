import { InputField } from '@timeax/form-palette';
import { BsSearch } from 'react-icons/bs';

const Comments = () => {
    return (
        <div className={'flex h-full flex-col'}>
            <div className="grow space-y-3 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">All Comments</h3>
                    <button className="text-sm font-medium text-primary hover:underline">Mark all as read</button>
                </div>
                <div>
                    <InputField variant={'text'} icon={<BsSearch className={'text-accent-foreground'} />} iconGap={8} placeholder={'Search comments'} />
                </div>
            </div>
        </div>
    );
};

export default Comments;
