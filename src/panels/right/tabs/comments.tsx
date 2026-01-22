import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { CommentThreadView } from '@/panels/right/components/comments/comments.tsx';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { BsSearch } from 'react-icons/bs';
import { MdOutlineSend } from 'react-icons/md';

const Comments = () => {
    const ws = useWorkspace();
    const threads = ws.comments.threads;

    return (
        <div className={'flex h-full flex-col overflow-hidden'}>
            <div className="flex grow flex-col gap-3 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">All Comments</h3>
                    <button className="text-sm font-medium text-primary hover:underline">Mark all as read</button>
                </div>
                <div>
                    <InputField
                        variant={'text'}
                        icon={<BsSearch className={'text-accent-foreground'} />}
                        iconGap={8}
                        placeholder={'Search comments'}
                    />
                </div>

                <ScrollArea className={'max-h-[calc(100dvh-270px)] grow pt-2'}>
                    <div className="flex flex-col gap-3">
                        {threads.data?.map((thread) => {
                            return (
                                <CommentThreadView
                                    thread={thread}
                                    you={{ id: ws.actor.id, name: ws.actor.name!! }}
                                    onReply={(e) => {
                                        const { threadId, text } = e;
                                        ws.comments.addMessage({
                                            threadId,
                                            body: text,
                                            branchId: ws.branches.currentId,
                                        });
                                    }}
                                />
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>

            <div className="mt-auto px-4 py-2">
                <InputField
                    variant={'textarea'}
                    placeholder={'Add a comment...'}
                    px={-4}
                    onChange={(e) => console.log(e.value)}
                    extendBoxToControls
                    trailingControl={
                        <div className={'flex items-center justify-center gap-3'}>
                            {/*<MdOutlineAttachment className={'cursor-pointer'} />*/}
                            <span className={'cursor-pointer rounded-md bg-primary fill-white px-2 py-1 text-white'}>
                                <MdOutlineSend />
                            </span>
                        </div>
                    }
                />
            </div>
        </div>
    );
};

export default Comments;
