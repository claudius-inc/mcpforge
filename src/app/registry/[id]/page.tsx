'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Listing {
  id: string;
  title: string;
  description: string;
  readme: string | null;
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
  github_repo: string | null;
  api_source_url: string | null;
  spec_snapshot: string;
  author_username?: string;
  author_avatar_url?: string;
  user_starred?: boolean;
  published_at: string;
  updated_at: string;
}

const CATEGORY_MAP: Record<string, { name: string; emoji: string }> = {
  'ai-ml': { name: 'AI & ML', emoji: '🤖' },
  communication: { name: 'Communication', emoji: '💬' },
  data: { name: 'Data', emoji: '📊' },
  devtools: { name: 'Dev Tools', emoji: '🛠️' },
  ecommerce: { name: 'E-Commerce', emoji: '🛒' },
  finance: { name: 'Finance', emoji: '💰' },
  media: { name: 'Media', emoji: '🎬' },
  productivity: { name: 'Productivity', emoji: '📋' },
  social: { name: 'Social', emoji: '🌐' },
  utilities: { name: 'Utilities', emoji: '⚙️' },
  weather: { name: 'Weather', emoji: '🌤️' },
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function RegistryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [starring, setStarring] = useState(false);
  const [forking, setForking] = useState(false);
  const [forkMessage, setForkMessage] = useState('');
  const [showSpec, setShowSpec] = useState(false);
  const [showClaudeConfig, setShowClaudeConfig] = useState(false);

  useEffect(() => {
    fetch(`/api/registry/${params.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLoading(false); return; }
        setListing(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const toggleStar = async () => {
    if (!listing || starring) return;
    setStarring(true);
    const method = listing.user_starred ? 'DELETE' : 'POST';
    const res = await fetch(`/api/registry/${listing.id}/star`, { method });
    if (res.ok) {
      setListing(prev => prev ? {
        ...prev,
        user_starred: !prev.user_starred,
        stars_count: prev.user_starred ? prev.stars_count - 1 : prev.stars_count + 1,
      } : null);
    }
    setStarring(false);
  };

  const handleFork = async () => {
    if (!listing || forking) return;
    setForking(true);
    setForkMessage('');
    try {
      const res = await fetch(`/api/registry/${listing.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createServer: false }),
      });
      const data = await res.json();
      if (res.ok) {
        setListing(prev => prev ? { ...prev, forks_count: prev.forks_count + 1 } : null);
        setForkMessage(`Forked! Spec ready to customize.`);
      } else {
        setForkMessage(data.error || 'Fork failed');
      }
    } catch {
      setForkMessage('Fork failed');
    }
    setForking(false);
  };

  const handleDownload = async () => {
    if (!listing) return;
    // Use the generate API to create a downloadable ZIP from the spec
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spec: listing.spec_snapshot,
        language: listing.language,
        mode: 'download',
      }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${listing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-mcp-server.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-800 rounded w-3/4 mb-8"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-2xl font-bold mb-2">Listing Not Found</h1>
        <p className="text-gray-400 mb-6">This server may have been unpublished.</p>
        <Link href="/registry" className="text-forge-400 hover:text-forge-300">← Back to Registry</Link>
      </div>
    );
  }

  const claudeConfig = JSON.stringify({
    mcpServers: {
      [listing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')]: {
        command: listing.language === 'typescript' ? 'npx' : 'python',
        args: listing.language === 'typescript' ? ['ts-node', 'src/index.ts'] : ['server.py'],
        env: {},
      },
    },
  }, null, 2);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-6">
        <Link href="/registry" className="hover:text-gray-300">Registry</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-300">{listing.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{listing.title}</h1>
            {listing.verified && <span className="text-blue-400 text-lg" title="Verified">✓</span>}
            {listing.featured && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">FEATURED</span>
            )}
          </div>
          <p className="text-gray-400 text-lg mb-3">{listing.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {listing.author_username && (
              <span className="flex items-center gap-1.5">
                {listing.author_avatar_url && (
                  <img src={listing.author_avatar_url} alt="" className="w-5 h-5 rounded-full" />
                )}
                {listing.author_username}
              </span>
            )}
            <span>v{listing.version}</span>
            <span>Published {formatDate(listing.published_at)}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={toggleStar}
          disabled={starring}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
            listing.user_starred
              ? 'bg-yellow-900/30 border-yellow-700 text-yellow-400 hover:bg-yellow-900/50'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
          }`}
        >
          {listing.user_starred ? '⭐ Starred' : '☆ Star'} ({listing.stars_count})
        </button>
        <button
          onClick={handleFork}
          disabled={forking}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg text-sm font-medium transition-colors"
        >
          🍴 Fork ({listing.forks_count})
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-forge-600 hover:bg-forge-500 rounded-lg text-sm font-medium transition-colors"
        >
          ⬇ Download
        </button>
        {listing.github_repo && (
          <a
            href={listing.github_repo}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            GitHub ↗
          </a>
        )}
      </div>

      {forkMessage && (
        <div className="mb-6 p-3 bg-gray-900 border border-gray-800 rounded-lg text-sm">
          {forkMessage}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Tools */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-3">Tools ({listing.tool_count})</h2>
            <div className="flex flex-wrap gap-2">
              {listing.tool_names.map(tool => (
                <span
                  key={tool}
                  className="px-2.5 py-1 rounded-lg text-sm font-mono bg-gray-800 text-gray-300 border border-gray-700"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>

          {/* Claude Desktop Config */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <button
              onClick={() => setShowClaudeConfig(!showClaudeConfig)}
              className="flex items-center justify-between w-full text-left"
            >
              <h2 className="text-lg font-semibold">Claude Desktop Config</h2>
              <span className="text-gray-500">{showClaudeConfig ? '▾' : '▸'}</span>
            </button>
            {showClaudeConfig && (
              <div className="mt-3">
                <p className="text-gray-400 text-sm mb-2">Add this to your Claude Desktop config:</p>
                <pre className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300 overflow-x-auto">
                  {claudeConfig}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(claudeConfig)}
                  className="mt-2 text-xs text-forge-400 hover:text-forge-300"
                >
                  📋 Copy config
                </button>
              </div>
            )}
          </div>

          {/* README */}
          {listing.readme && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-3">README</h2>
              <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                <pre className="whitespace-pre-wrap text-sm">{listing.readme}</pre>
              </div>
            </div>
          )}

          {/* Spec (collapsible) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <button
              onClick={() => setShowSpec(!showSpec)}
              className="flex items-center justify-between w-full text-left"
            >
              <h2 className="text-lg font-semibold">OpenAPI Spec</h2>
              <span className="text-gray-500">{showSpec ? '▾' : '▸'}</span>
            </button>
            {showSpec && (
              <pre className="mt-3 bg-gray-800 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto max-h-96">
                {listing.spec_snapshot}
              </pre>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Stars</span>
                <span className="font-medium">⭐ {listing.stars_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Forks</span>
                <span className="font-medium">🍴 {listing.forks_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Views</span>
                <span className="font-medium">👁 {listing.installs_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tools</span>
                <span className="font-medium">{listing.tool_count}</span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {listing.categories.map(cat => {
                const info = CATEGORY_MAP[cat];
                return (
                  <Link
                    key={cat}
                    href={`/registry?category=${cat}`}
                    className="px-2.5 py-1 rounded-full text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    {info?.emoji} {info?.name || cat}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          {listing.tags.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {listing.tags.map(tag => (
                  <Link
                    key={tag}
                    href={`/registry?tag=${tag}`}
                    className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Language</span>
                <span className={`font-medium ${listing.language === 'typescript' ? 'text-blue-400' : 'text-yellow-400'}`}>
                  {listing.language === 'typescript' ? 'TypeScript' : 'Python'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Version</span>
                <span>{listing.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Published</span>
                <span>{formatDate(listing.published_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Updated</span>
                <span>{formatDate(listing.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* API Source */}
          {listing.api_source_url && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">API Source</h3>
              <a
                href={listing.api_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-forge-400 hover:text-forge-300 text-sm break-all"
              >
                {listing.api_source_url} ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
