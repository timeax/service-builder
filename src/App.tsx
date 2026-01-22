import { Panel } from '@/components/ui/panel.tsx';
import Left from '@/panels/left';
import RightPanel from '@/panels/right';

import { Workspace } from '@timeax/digital-service-engine/workspace';
import { workspaceActor, workspaceBackend, workspaceInitial } from '../backend';

function App() {
    return (
        <Workspace backend={workspaceBackend} actor={workspaceActor} initial={workspaceInitial}>
            {() => (
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
            )}
        </Workspace>
    );
}

export default App;
