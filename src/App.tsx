import { ServiceBuilderWorkspace } from './index.tsx';

function App() {
    return <ServiceBuilderWorkspace onPlay={(e) => console.log(e)} onShare={(e) => console.log(e)} />;
}

export default App;
