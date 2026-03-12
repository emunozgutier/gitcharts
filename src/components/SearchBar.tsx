import React, { useState, useEffect, useCallback } from 'react';
import GitArchaeologyDisplay from './GitArchaeologyDisplay';

interface GitHubRepo {
  id: number;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  name: string;
  html_url: string;
}

interface SearchBarProps {
  onSelect: (repoFullName: string | null) => void;
  initialValue?: string | null;
  isMinimal?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSelect, initialValue = '', isMinimal = false }) => {
  const [query, setQuery] = useState(initialValue || '');
  const [results, setResults] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearched, setLastSearched] = useState('');
  const [hadNoResults, setHadNoResults] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(initialValue);

  // Sync internal selectedRepo with prop
  useEffect(() => {
    if (initialValue) {
      setSelectedRepo(initialValue);
      setQuery(initialValue);
    }
  }, [initialValue]);

  const searchRepos = useCallback(async (searchTerm: string) => {
    // Skip if selection just happened
    if (!searchTerm || searchTerm === lastSearched || searchTerm === selectedRepo) {
      if (!searchTerm) {
        setResults([]);
        setHadNoResults(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    setHadNoResults(false);
    setLastSearched(searchTerm);
    // Note: We don't clear selectedRepo here to avoid flickering logic in App.tsx
    // unless the query significantly changes from the selection.

    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerm)}&sort=stars&order=desc&per_page=5`
      );

      if (response.status === 403) {
        throw new Error('Rate limit exceeded.');
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data.items || [];
      setResults(items);
      setHadNoResults(items.length === 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [lastSearched, selectedRepo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchRepos(query);
    }, 600);
    return () => clearTimeout(timer);
  }, [query, searchRepos]);

  const getGithubPagesUrl = (repo: GitHubRepo) => {
    return `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}/`;
  };

  const handleSelect = (repo: GitHubRepo) => {
    const name = repo.full_name;
    setQuery(name);
    setResults([]);
    setLastSearched(name);
    setHadNoResults(false);
    setSelectedRepo(name);
    onSelect(name);
  };

  return (
    <div className={`search-bar-wrapper ${isMinimal ? 'minimal' : ''}`}>
      <div className={`input-group ${isMinimal ? 'input-group-sm' : 'input-group-lg'}`}>
        <span className="input-group-text bg-white border-end-0">🔍</span>
        <input
          type="text"
          className="form-control border-start-0"
          placeholder="Search repository..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && (
          <span className="input-group-text bg-white border-start-0">
            <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
          </span>
        )}
      </div>

      {error && <div className="alert alert-danger mt-2 py-2 small">{error}</div>}

      {results.length > 0 && (
        <div className="search-results-overlay list-group shadow position-absolute w-100 mt-1" style={{ zIndex: 1050 }}>
          {results.map((repo) => (
            <div 
              key={repo.id} 
              className="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-2"
              onClick={() => handleSelect(repo)}
              style={{ cursor: 'pointer' }}
            >
              <div className="d-flex align-items-center overflow-hidden">
                <img src={repo.owner.avatar_url} alt="" className="rounded-circle me-2" style={{ width: '24px', height: '24px' }} />
                <span className="text-truncate small fw-bold">{repo.full_name}</span>
              </div>
              <a href={getGithubPagesUrl(repo)} target="_blank" rel="noopener noreferrer" 
                 className="btn btn-link btn-sm text-decoration-none p-0 ms-2" onClick={e => e.stopPropagation()}>
                ↗
              </a>
            </div>
          ))}
        </div>
      )}

      {selectedRepo && !query.includes('/') && query !== '' && !loading && (
        <button className="btn btn-sm btn-link text-muted mt-1 p-0" onClick={() => { setQuery(''); onSelect(null); setSelectedRepo(null); }}>
          Clear Selection
        </button>
      )}

      {/* Display is shown below the search bar if selected */}
      {selectedRepo && !isMinimal && (
         <div className="mt-4">
           <GitArchaeologyDisplay repoFullName={selectedRepo} />
         </div>
      )}
      
      {/* If minimal (in navbar), we probably want the display in the main App area 
          but for simplicity right now let's use a portal or just render it in App.tsx 
          Actually, let's keep the display logic in App.tsx if it's selected */}

      <style>{`
        .search-bar-wrapper { position: relative; }
        .minimal { max-width: 100% !important; }
        .search-results-overlay { max-height: 300px; overflow-y: auto; }
      `}</style>
    </div>
  );
};

export default SearchBar;
