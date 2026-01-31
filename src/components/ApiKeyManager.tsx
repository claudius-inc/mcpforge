'use client';

import { useState } from 'react';

interface ApiKey {
  id: string;
  name: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function ApiKeyManager({ keys, maxKeys, currentCount }: { keys: ApiKey[]; maxKeys: number; currentCount: number }) {
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState('generate');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [keyList, setKeyList] = useState(keys);
  const [error, setError] = useState<string | null>(null);

  const canCreate = currentCount < maxKeys;

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create key');
      }
      const data = await res.json();
      setCreatedKey(data.key); // shown once
      setKeyList(prev => [data.apiKey, ...prev]);
      setNewKeyName('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setKeyList(prev => prev.filter(k => k.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      {/* Create Key */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Create API Key</h2>

        {createdKey && (
          <div className="bg-green-950/50 border border-green-800 rounded-lg p-4 mb-4">
            <p className="text-green-300 text-sm font-medium mb-2">Key created! Copy it now — it won&apos;t be shown again.</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-gray-950 text-green-400 px-3 py-2 rounded text-sm font-mono break-all">
                {createdKey}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(createdKey); }}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., CI/CD)"
            className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-forge-500 focus:outline-none"
            disabled={!canCreate}
          />
          <select
            value={newKeyScopes}
            onChange={e => setNewKeyScopes(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-forge-500 focus:outline-none"
            disabled={!canCreate}
          >
            <option value="generate">Generate only</option>
            <option value="generate,compose">Generate + Compose</option>
            <option value="generate,compose,describe">All</option>
          </select>
          <button
            onClick={createKey}
            disabled={!canCreate || creating || !newKeyName.trim()}
            className="bg-forge-600 hover:bg-forge-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {!canCreate && (
          <p className="text-yellow-400 text-xs mt-2">
            You&apos;ve reached your API key limit ({maxKeys}). <a href="/dashboard/billing" className="underline">Upgrade</a> for more.
          </p>
        )}
      </div>

      {/* Key List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold">Your API Keys</h2>
        </div>
        {keyList.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <div className="text-3xl mb-2">🔑</div>
            <p>No API keys yet. Create one above for programmatic access.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {keyList.map(key => (
              <div key={key.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{key.scopes}</span>
                    <span className="text-xs text-gray-500">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                    </span>
                    {key.lastUsedAt && (
                      <span className="text-xs text-gray-500">
                        Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                    {key.expiresAt && (
                      <span className={`text-xs ${new Date(key.expiresAt) < new Date() ? 'text-red-400' : 'text-gray-500'}`}>
                        {new Date(key.expiresAt) < new Date() ? 'Expired' : `Expires ${new Date(key.expiresAt).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteKey(key.id)}
                  disabled={deleting === key.id}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  {deleting === key.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
