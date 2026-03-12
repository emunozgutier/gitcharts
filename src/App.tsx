import './App.css'
import SearchBar from './components/SearchBar'

function App() {
  console.log('App: Rendering component...');
  return (
    <div className="container py-5">
      <header className="text-center mb-5">
        <h1 className="display-4 fw-bold">GitCharts Archaeology</h1>
        <p className="lead text-muted">
          Search for a GitHub repository to explore its history and code age distribution.
        </p>
      </header>

      <main>
        <SearchBar />
      </main>

      <footer className="text-center mt-5 pt-4 border-top text-muted">
        <p>Built with Vite + React + GitHub API</p>
      </footer>
    </div>
  )
}

export default App
