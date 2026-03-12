import { useState } from 'react'
import './App.css'
import SearchBar from './components/SearchBar'

function App() {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  console.log('App: Rendering component...', { selectedRepo });

  return (
    <div className={`app-container ${selectedRepo ? 'repo-selected' : ''}`}>
      {!selectedRepo ? (
        <header className="container text-center py-5 mb-4">
          <h1 className="display-4 fw-bold">GitCharts Archaeology</h1>
          <p className="lead text-muted">
            Search for a GitHub repository to explore its history and code age distribution.
          </p>
          <div className="mx-auto" style={{ maxWidth: '800px' }}>
            <SearchBar onSelect={setSelectedRepo} />
          </div>
        </header>
      ) : (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top shadow-sm py-2 mb-4">
          <div className="container-fluid px-4 d-flex align-items-center justify-content-between">
            <a className="navbar-brand fw-bold mb-0 h1" href="#" onClick={() => setSelectedRepo(null)}>
              GitCharts <span className="text-primary">Archaeology</span>
            </a>
            <div className="flex-grow-1 mx-4" style={{ maxWidth: '600px' }}>
              <SearchBar onSelect={setSelectedRepo} initialValue={selectedRepo} isMinimal />
            </div>
            <div className="text-light d-none d-md-block">
              <span className="badge bg-primary rounded-pill px-3 py-2">
                Repo: {selectedRepo}
              </span>
            </div>
          </div>
        </nav>
      )}

      <main className="container">
        {selectedRepo && (
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <SearchBar onSelect={setSelectedRepo} initialValue={selectedRepo} isMinimal={false} />
            </div>
          </div>
        )}
      </main>

      {!selectedRepo && (
        <footer className="text-center mt-5 pt-4 border-top text-muted container pb-5">
          <p>Built with Vite + React + GitHub API</p>
        </footer>
      )}

      <style>{`
        .app-container { min-height: 100vh; transition: all 0.3s ease; }
        .repo-selected { background-color: #f8f9fa; }
        .navbar-brand { font-size: 1.25rem; }
      `}</style>
    </div>
  )
}

export default App
