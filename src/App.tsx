import { workspaceBackend } from '../backend/canonical/create-backend';
import { workspaceActor } from '../backend/canonical/seed/meta';
import { CanonicalServiceBuilder } from './react/canonical-service-builder';

function App() {
    return <CanonicalServiceBuilder backend={workspaceBackend} actor={workspaceActor} onPlay={(event) => console.log(event)} onShare={(event) => console.log(event)} />;
}

export default App;
