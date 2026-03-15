import { useEffect } from 'react'
import './App.css'
import SearchBar from './components/TopMenuBar/SearchBar'
import TopMenuBar from './components/TopMenuBar'
import GitArchaeologyDisplay from './components/GitArchaeologyDisplay'
import { useRepoStore } from './store/useRepoStore'

function App() {
  const { 
    selectedRepo, 
    setSelectedRepo, 
    resetAnalysis 
  } = useRepoStore();

  // Sync selectedRepo with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash !== selectedRepo) {
        setSelectedRepo(hash || null);
        resetAnalysis();
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [selectedRepo, setSelectedRepo, resetAnalysis]);

  // Update URL hash when selectedRepo changes
  useEffect(() => {
    const currentHash = window.location.hash.substring(1);
    const newHash = selectedRepo || '';
    if (currentHash !== newHash) {
      window.location.hash = newHash;
    }
  }, [selectedRepo]);

  const handleRepoSelect = (repo: string | null) => {
    if (repo !== selectedRepo) {
      setSelectedRepo(repo);
      resetAnalysis();
    }
  };

  return (
    <div className={`app-container ${selectedRepo ? 'repo-selected' : ''}`}>
      {!selectedRepo ? (
        <header className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center p-4">
          <h1 className="display-3 fw-bold mb-3">GitCharts Archaeology</h1>
          <p className="lead text-muted mb-4" style={{ maxWidth: '600px' }}>
            Dig into repository history and visualize the "sediment" of your code over time.
          </p>
          <div className="w-100" style={{ maxWidth: '800px' }}>
            <SearchBar onSelect={handleRepoSelect} />
          </div>
          <footer className="mt-auto pt-5 text-muted small">
            Built with Vite + React + Vega-Lite
          </footer>
        </header>
      ) : (
        <>
          <TopMenuBar 
            selectedRepo={selectedRepo} 
            onRepoSelect={handleRepoSelect} 
          />
          
          <main className="main-content p-3 container-wide">
            <GitArchaeologyDisplay 
              repoFullName={selectedRepo} 
            />
          </main>
        </>
      )}

      <style>{`
        .repo-selected { background-color: #f8f9fa; }
      `}</style>
    </div>
  )
}

export default App
