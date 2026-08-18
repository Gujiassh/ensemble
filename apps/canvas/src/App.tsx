import { OrgCanvas } from "./canvas/OrgCanvas";
import { DossierDrawer } from "./dossier/DossierDrawer";
import { TopBar } from "./app/TopBar";
import { TodoTray } from "./app/TodoTray";

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="main-row">
        <TodoTray />
        <div className="canvas-wrap">
          <OrgCanvas />
        </div>
        <DossierDrawer />
      </div>
    </div>
  );
}
