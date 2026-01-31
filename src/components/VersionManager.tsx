'use client';

import { useState, useCallback } from 'react';
import type { VersionDiff, Change, ChangeDetail } from '@/lib/versioning/types';

interface DiffResponse {
  success: boolean;
  diff: VersionDiff;
  oldServer: { name: string; version: string; toolCount: number };
  newServer: {
    name: string; version: string; toolCount: number;
    tools: Array<{ name: string; description: string; enabled: boolean; source: { path: string; method: string } }>;
    envVars: Array<{ name: string; description: string; required: boolean }>;
  };
}

export default function VersionManager() {
  const [oldSpec, setOldSpec] = useState('');
  const [newSpec, setNewSpec] = useState('');
  const [target, setTarget] = useState<'typescript' | 'python'>('typescript');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<DiffResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsText(file);
  }, []);

  const handleCompare = async () => {
    if (!oldSpec.trim() || !newSpec.trim()) {
      setError('Both old and new specs are required.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSpec, newSpec, target, mode: 'diff' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to compare specs');
        return;
      }
      setResult(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSpec, newSpec, target, mode: 'download' }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Download failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-server-updated.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Spec Input */}
      <div className="grid md:grid-cols-2 gap-4">
        <SpecInput
          label="Old Spec (Current Version)"
          value={oldSpec}
          onChange={setOldSpec}
          onFileUpload={handleFileUpload(setOldSpec)}
          placeholder="Paste your current OpenAPI spec here..."
        />
        <SpecInput
          label="New Spec (Updated Version)"
          value={newSpec}
          onChange={setNewSpec}
          onFileUpload={handleFileUpload(setNewSpec)}
          placeholder="Paste the updated OpenAPI spec here..."
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <select
          value={target}
          onChange={e => setTarget(e.target.value as 'typescript' | 'python')}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forge-500"
        >
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
        </select>
        <button
          onClick={handleCompare}
          disabled={loading || !oldSpec.trim() || !newSpec.trim()}
          className="bg-forge-600 hover:bg-forge-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Comparing...
            </span>
          ) : (
            '🔍 Compare Versions'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className={`rounded-xl border p-6 ${
            result.diff.isBackwardsCompatible
              ? 'bg-green-900/20 border-green-800'
              : 'bg-amber-900/20 border-amber-800'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{result.diff.isBackwardsCompatible ? '✅' : '⚠️'}</span>
              <div>
                <h3 className="font-semibold text-lg">
                  {result.oldServer.version} → {result.newServer.version}
                </h3>
                <p className="text-gray-400 text-sm">{result.diff.summary}</p>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex gap-4 text-sm mt-4">
              {result.diff.stats.toolsAdded > 0 && (
                <StatBadge label="Added" count={result.diff.stats.toolsAdded} color="green" />
              )}
              {result.diff.stats.toolsRemoved > 0 && (
                <StatBadge label="Removed" count={result.diff.stats.toolsRemoved} color="red" />
              )}
              {result.diff.stats.toolsModified > 0 && (
                <StatBadge label="Modified" count={result.diff.stats.toolsModified} color="amber" />
              )}
              {result.diff.stats.toolsUnchanged > 0 && (
                <StatBadge label="Unchanged" count={result.diff.stats.toolsUnchanged} color="gray" />
              )}
            </div>
          </div>

          {/* Migration Notes */}
          {result.diff.migrationNotes.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-5">
              <h3 className="font-semibold text-amber-200 mb-3">⚠️ Migration Notes</h3>
              <ul className="space-y-2 text-sm text-amber-100">
                {result.diff.migrationNotes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Change List */}
          {result.diff.changes.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <h3 className="font-semibold px-5 py-3 border-b border-gray-800">Changes</h3>
              <div className="divide-y divide-gray-800">
                {result.diff.changes.map((change, i) => (
                  <ChangeRow key={i} change={change} />
                ))}
              </div>
            </div>
          )}

          {/* Download button */}
          <div className="flex justify-center">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-gradient-to-r from-forge-600 to-blue-600 hover:from-forge-500 hover:to-blue-500 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-medium text-lg transition-all"
            >
              {downloading ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Generating...
                </span>
              ) : (
                `📦 Download Updated ${target === 'typescript' ? 'TypeScript' : 'Python'} Server`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function SpecInput({
  label, value, onChange, onFileUpload, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <label className="text-xs text-forge-400 hover:text-forge-300 cursor-pointer transition-colors">
          📁 Upload file
          <input
            type="file"
            accept=".yaml,.yml,.json"
            onChange={onFileUpload}
            className="hidden"
          />
        </label>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={12}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm font-mono
          focus:outline-none focus:border-forge-500 resize-y placeholder-gray-600"
      />
      <div className="text-xs text-gray-500 text-right">
        {value.length > 0 ? `${(value.length / 1024).toFixed(1)} KB` : 'YAML or JSON'}
      </div>
    </div>
  );
}

function ChangeRow({ change }: { change: Change }) {
  const [expanded, setExpanded] = useState(false);
  const icon = changeIcon(change.kind);
  const severityColor = change.severity === 'breaking'
    ? 'text-red-400'
    : change.severity === 'warning'
      ? 'text-amber-400'
      : 'text-gray-400';

  return (
    <div className="px-5 py-3">
      <button
        onClick={() => change.details && change.details.length > 0 && setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-3 group"
      >
        <span className="text-lg">{icon}</span>
        <span className="flex-1 text-sm">{change.description}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${severityBadge(change.severity)}`}>
          {change.severity}
        </span>
        {change.details && change.details.length > 0 && (
          <span className={`text-gray-500 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        )}
      </button>
      {expanded && change.details && (
        <div className="mt-2 ml-9 space-y-1">
          {change.details.map((d, i) => (
            <DetailRow key={i} detail={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ detail }: { detail: ChangeDetail }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
      <span className="text-gray-600 min-w-[120px]">{detail.field}</span>
      {detail.oldValue && (
        <span className="bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded line-through">
          {detail.oldValue}
        </span>
      )}
      {detail.oldValue && detail.newValue && <span className="text-gray-600">→</span>}
      {detail.newValue && (
        <span className="bg-green-900/30 text-green-300 px-1.5 py-0.5 rounded">
          {detail.newValue}
        </span>
      )}
    </div>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-900/40 text-green-300 border-green-800',
    red: 'bg-red-900/40 text-red-300 border-red-800',
    amber: 'bg-amber-900/40 text-amber-300 border-amber-800',
    gray: 'bg-gray-800 text-gray-400 border-gray-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full border text-xs font-medium ${colors[color]}`}>
      {count} {label}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function changeIcon(kind: string): string {
  switch (kind) {
    case 'tool_added': return '✅';
    case 'tool_removed': return '❌';
    case 'tool_modified': return '🔄';
    case 'env_added': return '🔑';
    case 'env_removed': return '🗑️';
    case 'server_meta_changed': return 'ℹ️';
    default: return '•';
  }
}

function severityBadge(severity: string): string {
  switch (severity) {
    case 'breaking': return 'border-red-800 text-red-400 bg-red-900/20';
    case 'warning': return 'border-amber-800 text-amber-400 bg-amber-900/20';
    default: return 'border-gray-700 text-gray-400 bg-gray-800';
  }
}
