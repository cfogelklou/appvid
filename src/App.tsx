import { ProjectProvider } from './context/ProjectContext';
import { AppShell } from './components/AppShell';

function App() {
  return (
    <ProjectProvider>
      <AppShell />
    </ProjectProvider>
  );
}

export default App;
