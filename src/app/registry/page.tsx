'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Listing {
  id: string;
  title: string;
  description: string;
  categories: string[];
  tags: string[];
  language: string;
  tool_count: number;
  tool_names: string[];
  stars_count: number;
  forks_count: number;
  installs_count: number;
  featured: boolean;
  verified: boolean;
  version: string;
  author_username?: string;
  author_avatar_url?: string;
  user_starred?: boolean;
  published_at: string;
}

interface SearchResult {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const CATEGORIES = [
  { id: 'ai-ml', name: 'AI & ML', emoji: '🤖' },
  { id: 'communication', name: 'Communication', emoji: '💬' },
  { id: 'data', name: 'Data', emoji: '📊' },
  { id: 'devtools', name: 'Dev Tools', emoji: '🛠️' },
  { id: 'ecommerce', name: 'E-Commerce', emoji: '🛒' },
  { id: 'finance', name: 'Finance', emoji: '💰' },
  { id: 'media', name: 'Media', emoji: '🎬' },
  { id: 'productivity', name: 'Productivity', emoji: '📋' },
  { id: 'social', name: 'Social', emoji: '🌐' },
  { id: 'utilities', name: 'Utilities', emoji: '⚙️' },
  { id: 'weather', name: 'Weather', emoji: '🌤️' },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'stars', label: 'Most Stars' },
  { value: 'name', label: 'A-Z' },
];

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function TimeAgo({ date }: { date: string }) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return <span>today</span>;
  if (days === 1) return <span>yesterday</span>;
  if (days < 30) return <span>{days}d ago</span>;
  if (days < 365) return <span>{Math.floor(days / 30)}mo ago</span>;
  return <span>{Math.floor(days / 365)}y ago</span>;
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/registry/${listing.id}`}
      className="block bg-gray-900 border border-gray-800 hover:border-forge-700 rounded-xl p-5 transition-all hover:shadow-lg hover:shadow-forge-950/20"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold truncate">{listing.title}</h3>
            {listing.verified && (
              <span className="text-blue-400 text-sm" title="Verified">✓</span>
            )}
            {listing.featured && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">FEATURED</span>
            )}
          </div>
          <p className="text-gray-400 text-sm line-clamp-2">{listing.description}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {listing.categories.slice(0, 2).map(cat => {
          const info = CATEGORIES.find(c => c.id === cat);
          return (
            <span key={cat} className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300">
              {info?.emoji} {info?.name || cat}
            </span>
          );
        })}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          listing.language === 'typescript' ? 'bg-blue-900/30 text-blue-400' : 'bg-yellow-900/30 text-yellow-400'
        }`}>
          {listing.language === 'typescript' ? 'TypeScript' : 'Python'}
        </span>
      </div>

      {/* Tools preview */}
      {listing.tool_names.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {listing.tool_names.slice(0, 4).map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-gray-800/80 text-gray-400">
              {t}
            </span>
          ))}
          {listing.tool_names.length > 4 && (
            <span className="px-1.5 py-0.5 text-[11px] text-gray-500">+{listing.tool_names.length - 4} more</span>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800/50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">⭐ {formatNumber(listing.stars_count)}</span>
          <span className="flex items-center gap-1">🍴 {formatNumber(listing.forks_count)}</span>
          <span>{listing.tool_count} tool{listing.tool_count !== 1 ? 's' : ''}</span>
          <span>v{listing.version}</span>
        </div>
        <div className="flex items-center gap-2">
          {listing.author_username && (
            <span className="flex items-center gap-1">
              {listing.author_avatar_url && (
                <img src={listing.author_avatar_url} alt="" className="w-4 h-4 rounded-full" />
              )}
              {listing.author_username}
            </span>
          )}
          <TimeAgo date={listing.published_at} />
        </div>
      </div>
    </Link>
  );
}

export default function RegistryPage() {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('popular');
  const [language, setLanguage] = useState('');
  const [page, setPage] = useState(1);

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    if (language) params.set('language', language);
    if (sort) params.set('sort', sort);
    params.set('page', page.toString());
    params.set('limit', '20');

    try {
      const res = await fetch(`/api/registry?${params}`);
      const data = await res.json();
      setResults(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [query, category, sort, language, page]);

  useEffect(() => { search(); }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    search();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">
          MCP Server{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-forge-400 to-blue-400">
            Registry
          </span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Discover community-built MCP servers. Star your favorites, fork and customize, or deploy with one click.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8">
        <form onSubmit={handleSearch} className="flex gap-3 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search servers, tools, APIs..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-forge-600"
            />
            <svg className="absolute left-3 top-3 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-forge-600 hover:bg-forge-500 rounded-lg text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Category filter */}
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-forge-600"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>

          {/* Language filter */}
          <select
            value={language}
            onChange={e => { setLanguage(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-forge-600"
          >
            <option value="">All Languages</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => { setSort(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-forge-600"
          >
            {SORT_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {results && (
            <span className="text-xs text-gray-500 ml-auto">
              {results.total} server{results.total !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-2/3 mb-3"></div>
              <div className="h-4 bg-gray-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : results && results.listings.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {results.listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {/* Pagination */}
          {results.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-30 hover:border-gray-600"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-400 px-3">
                Page {results.page} of {results.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(results.totalPages, p + 1))}
                disabled={page >= results.totalPages}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-30 hover:border-gray-600"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-2">No servers found</h3>
          <p className="text-gray-400 text-sm mb-6">
            {query ? `No results for "${query}". Try a different search.` : 'The registry is empty. Be the first to publish!'}
          </p>
          <Link
            href="/generate"
            className="inline-block px-4 py-2 bg-forge-600 hover:bg-forge-500 rounded-lg text-sm font-medium transition-colors"
          >
            Generate & Publish →
          </Link>
        </div>
      )}

      {/* CTA */}
      <div className="mt-16 bg-gradient-to-r from-forge-950 to-gray-900 border border-forge-800/50 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-3">Share Your MCP Server</h2>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto">
          Built something useful? Publish it to the registry and let the community use, star, and fork your creation.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/generate"
            className="px-5 py-2.5 bg-forge-600 hover:bg-forge-500 rounded-lg text-sm font-medium transition-colors"
          >
            Generate a Server
          </Link>
          <Link
            href="/dashboard/servers"
            className="px-5 py-2.5 border border-gray-700 hover:border-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            Publish Existing
          </Link>
        </div>
      </div>
    </div>
  );
}
