import React, { useState, useEffect, useCallback } from 'react';

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
  const [selectedRepo, setSelectedRepo] = useState<string | null>(initialValue);

  // Sync internal selectedRepo with prop
  useEffect(() => {
    if (initialValue !== undefined) {
      setSelectedRepo(initialValue);
      setQuery(initialValue || '');
    }
  }, [initialValue]);

  const searchRepos = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm === lastSearched || searchTerm === selectedRepo) {
      if (!searchTerm) {
        setResults([]);
      }
      return;
    }

    setLoading(true);
    setError(null);
    setLastSearched(searchTerm);

    try {
      const fetchResults = async (q: string) => {
        const response = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`
        );
        if (response.status === 403) throw new Error('Rate limit exceeded.');
        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        const data = await response.json();
        return data.items || [];
      };

      let items = await fetchResults(searchTerm);
      
      // Fallback: if no results and query doesn't look like a "user/repo" yet, try as a user filter
      if (items.length === 0 && !searchTerm.includes('/')) {
        items = await fetchResults(`user:${searchTerm}`);
      }

      setResults(items);
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
    setSelectedRepo(name);
    onSelect(name);
  };

  return (
    <div className={`search-bar-wrapper ${isMinimal ? 'minimal' : ''}`}>
      <div className={`input-group ${isMinimal ? 'input-group-sm dark-search-group' : 'input-group-lg'}`}>
        <span className="input-group-text border-end-0">🔍</span>
        <input
          type="text"
          className="form-control border-start-0"
          placeholder="Search repository..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && (
          <span className="input-group-text border-start-0">
            <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
          </span>
        )}
      </div>

      {error && <div className="alert alert-danger mt-2 py-2 small">{error}</div>}
      
      {!loading && results.length === 0 && query && query.includes('/') && !selectedRepo && (
          <div className="list-group position-absolute w-100 mt-1 shadow" style={{ zIndex: 1050 }}>
            <div className="list-group-item text-center text-muted py-2 small">No repositories found.</div>
          </div>
      )}

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

      <style>{`
        .search-bar-wrapper { position: relative; }
        .minimal { max-width: 100% !important; }
        .search-results-overlay { 
          max-height: 300px; 
          overflow-y: auto; 
          background: #2b3035; 
          border: 1px solid #495057;
        }
        .search-results-overlay .list-group-item {
          background: #2b3035;
          color: #dee2e6;
          border-color: #495057;
        }
        .search-results-overlay .list-group-item:hover {
          background: #343a40;
          color: #fff;
        }
        .dark-search-group .input-group-text, 
        .dark-search-group .form-control {
          background-color: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: white;
        }
        .dark-search-group .form-control::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        .dark-search-group .form-control:focus {
          background-color: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          color: white;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
};

export default SearchBar;
