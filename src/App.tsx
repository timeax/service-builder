import type { HandlerService, ProductDefinition } from '@elqora/dgp-spec';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { useState } from 'react';
import { workspaceBackend } from '../backend/canonical/create-backend';
import { workspaceSeed } from '../backend/canonical/seed';
import { workspaceActor } from '../backend/canonical/seed/meta';
import { CanonicalPlayPreview } from './react/canonical-play-preview';
import { CanonicalServiceBuilder } from './react/canonical-service-builder';
import type { ServiceBuilderPlayPayload } from './react/contracts';
import lab from './react/fixtures/instagram-likes-lab.json';

const localBackend = new MemoryWorkspaceBackend({
    ...workspaceSeed,
    definition: lab.definition as unknown as ProductDefinition,
    services: lab.services as unknown as HandlerService[],
    persistence: undefined,
});

function App() {
    const [playPayload, setPlayPayload] = useState<ServiceBuilderPlayPayload | null>(null);

    return (
        <>
            <CanonicalServiceBuilder
                backend={import.meta.env.DEV ? localBackend : workspaceBackend}
                actor={workspaceActor}
                onPlay={setPlayPayload}
                onShare={(event) => console.log(event)}
            />
            <CanonicalPlayPreview
                payload={playPayload}
                onOpenChange={(open) => {
                    if (!open) setPlayPayload(null);
                }}
            />
        </>
    );
}

export default App;
