import React, { useState } from 'react';
import { BskyAgent } from '@atproto/api';

interface SearchProps {
  navigation: any;
}

const Search: React.FC<SearchProps> = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const _agent = new BskyAgent({ service: 'https://bsky.social' });

  const _handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError('');

      const _response = await agent.searchActors({ term: query });
      setResults(response.data.actors);
    } catch (err: any) {
      setError(err.message || 'Failed to search');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <label htmlFor="search" className="sr-only">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              id="search"
              className="block w-full pl-4 pr-12 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search users..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="absolute inset-y-0 right-0 px-4 flex items-center bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 focus:outline-none"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="space-y-4">
          {results.map(actor => (
            <div
              key={actor.did}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
            >
              <div className="flex items-center">
                {actor.avatar && (
                  <img
                    src={actor.avatar}
                    alt={actor.displayName || actor.handle}
                    className="h-12 w-12 rounded-full"
                  />
                )}
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {actor.displayName || actor.handle}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    @{actor.handle}
                  </p>
                </div>
              </div>
              {actor.description && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {actor.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Search;
