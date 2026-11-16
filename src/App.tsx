import { useState } from 'react';
import { workspaceBackend } from '../backend/canonical/create-backend';
import { workspaceActor } from '../backend/canonical/seed/meta';
import { CanonicalPlayPreview } from './react/canonical-play-preview';
import { CanonicalServiceBuilder } from './react/canonical-service-builder';
import type { ServiceBuilderPlayPayload } from './react/contracts';

function App() {
    const [playPayload, setPlayPayload] = useState<ServiceBuilderPlayPayload | null>(null);

    return (
        <>
            <CanonicalServiceBuilder
                backend={workspaceBackend}
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
