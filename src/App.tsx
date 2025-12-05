import { Panel } from '@/components/ui/panel.tsx';
import Left from '@/panels/left';
import RightPanel from '@/panels/right';

function App() {
    return (
        <div className={'relative flex h-screen flex-col overflow-hidden *:font-display'}>
            <div className={'flex grow overflow-hidden'}>
                <Left />
                <div className={'m-auto grow border'}>fill</div>
                <RightPanel />
            </div>
            <div className={'relative hidden'}>
                <Panel className={'absolute bottom-0 w-full border'} maintainPosition>
                    Bottom
                </Panel>
            </div>
        </div>
    );
}

export default App;
