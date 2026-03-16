import Left from '@/panels/left';
import RightPanel from '@/panels/right';
import BuilderCanvas from '@/workspace/builder-canvas.tsx';

import { Provider as InputsProvider, createInputRegistry, registerEntries } from '@timeax/digital-service-engine/react';
import { Workspace } from '@timeax/digital-service-engine/workspace';
import { workspaceActor, workspaceBackend, workspaceInitial } from '../backend';

const inputRegistry = createInputRegistry();
registerEntries(inputRegistry);

function App() {
    return (
        <InputsProvider initialRegistry={inputRegistry}>
            <Workspace backend={workspaceBackend} actor={workspaceActor} initial={workspaceInitial}>
                {() => (
                    <div className={'relative flex h-screen flex-col overflow-hidden *:font-display'}>
                        <div className={'flex grow overflow-hidden'}>
                            <Left />
                            <BuilderCanvas />
                            <RightPanel />
                        </div>
                    </div>
                )}
            </Workspace>
        </InputsProvider>
    );
}

export default App;
