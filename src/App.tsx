import { useState } from 'react'
import './App.css'
import SearchBar from './components/SearchBar'
import GitArchaeologyDisplay from './components/GitArchaeologyDisplay'

function App() {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoCache, setRepoCache] = useState<Record<string, { stats: any; data: any[] }>>({});

  const updateCache = (repo: string, stats: any, data: any[]) => {
    setRepoCache(prev => ({ ...prev, [repo]: { stats, data } }));
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
            <SearchBar onSelect={setSelectedRepo} />
          </div>
          <footer className="mt-auto pt-5 text-muted small">
            Built with Vite + React + Vega-Lite
          </footer>
        </header>
      ) : (
        <>
          <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm py-2">
            <div className="container-fluid px-4 d-flex align-items-center justify-content-between">
              <a className="navbar-brand fw-bold mb-0 d-flex align-items-center" href="#" onClick={() => setSelectedRepo(null)} style={{ cursor: 'pointer', textDecoration: 'none' }}>
                <span className="me-2">🏛️</span>
                <span>GitCharts <span className="text-primary">Archaeology</span></span>
              </a>
              <div className="flex-grow-1 mx-4" style={{ maxWidth: '800px' }}>
                <SearchBar onSelect={setSelectedRepo} initialValue={selectedRepo} isMinimal />
              </div>
              <div className="text-light d-none d-md-block">
                <span className="badge bg-secondary rounded-pill px-3 py-2 border border-secondary">
                  {selectedRepo}
                </span>
              </div>
            </div>
          </nav>
          
          <main className="main-content p-3 container-wide">
            <GitArchaeologyDisplay 
              repoFullName={selectedRepo} 
              cachedResult={repoCache[selectedRepo]}
              onAnalysisComplete={(stats: any, data: any[]) => updateCache(selectedRepo, stats, data)}
            />
          </main>
        </>
      )}

      <style>{`
        .repo-selected { background-color: #f8f9fa; }
        .navbar-brand { font-size: 1.1rem; color: #fff !important; }
        .navbar-brand:hover { opacity: 0.8; }
      `}</style>
    </div>
  )
}

export default App
