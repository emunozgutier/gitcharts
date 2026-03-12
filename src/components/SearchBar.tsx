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
  has_pages: boolean;
}

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearched, setLastSearched] = useState('');

  const searchRepos = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm === lastSearched) {
      if (!searchTerm) setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setLastSearched(searchTerm);

    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerm)}&sort=stars&order=desc&per_page=5`
      );

      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please wait a minute and try again.');
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching from GitHub.');
    } finally {
      setLoading(false);
    }
  }, [lastSearched]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchRepos(query);
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [query, searchRepos]);

  const getGithubPagesUrl = (repo: GitHubRepo) => {
    // Standard GitHub Pages URL format: owner.github.io/repo
    return `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}/`;
  };

  return (
    <div className="search-bar-container my-4">
      <div className="input-group mb-3">
        <span className="input-group-text" id="basic-addon1">🔍</span>
        <input
          type="text"
          className="form-control form-control-lg"
          placeholder="Search repo or creator (e.g. koaning/gitcharts)"
          aria-label="Search"
          aria-describedby="basic-addon1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <div className="text-center py-2 text-muted">Searching GitHub...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="list-group shadow-sm">
        {results.map((repo) => {
          const ghPagesUrl = getGithubPagesUrl(repo);
          return (
            <div key={repo.id} className="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-3">
              <div className="d-flex align-items-center">
                <img 
                  src={repo.owner.avatar_url} 
                  alt={repo.owner.login} 
                  className="rounded-circle me-3" 
                  style={{ width: '40px', height: '40px' }} 
                />
                <div>
                  <h6 className="mb-0 fw-bold">{repo.full_name}</h6>
                  <small className="text-muted">Repository: {repo.html_url}</small>
                </div>
              </div>
              <div className="text-end">
                <a 
                  href={ghPagesUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-sm btn-outline-primary rounded-pill px-3"
                >
                  GitHub Pages ↗
                </a>
              </div>
            </div>
          );
        })}
        {!loading && query && results.length === 0 && (
          <div className="list-group-item text-center text-muted">No repositories found.</div>
        )}
      </div>

      <style>{`
        .search-bar-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .list-group-item {
          transition: transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out;
        }
        .list-group-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 1;
        }
      `}</style>
    </div>
  );
};

export default SearchBar;
