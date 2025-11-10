import {Panel} from "@/components/ui/panel.tsx";
import Left from "@/panels/left";

function App() {
    return (
        <div className={'flex flex-col h-screen p-4'}>
            <div className={'flex grow'}>
                <Left/>
                <div className={'border m-auto grow'}>
                    fill
                </div>
            </div>
            <Panel className={'border'}>Bottom</Panel>
        </div>
    )
}

export default App
