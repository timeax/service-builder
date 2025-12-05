const Comments = () => {
    return (
        <div className={'flex flex-col h-full'}>
            <div className="grow space-y-6 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">All Comments</h3>
                    <button className="text-sm font-medium text-primary hover:underline">Mark all as read</button>
                </div>
            </div>
        </div>
    )
}

export default Comments
