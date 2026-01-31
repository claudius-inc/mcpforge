'use client';

import { useState, useCallback } from 'react';

interface ParsedTool {
  name: string;
  description: string;
  inputSchema: { properties: Record<string, unknown>; required: string[] };
  source: { path: string; method: string };
  enabled: boolean;
}

interface ServerInfo {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  toolCount: number;
  envVars: { name: string; description: string }[];
}

type Target = 'typescript' | 'python';
type Step = 'input' | 'preview' | 'generating';

export default function GeneratePage() {
  const [step, setStep] = useState<Step>('input');
  const [specInput, setSpecInput] = useState('');
  const [target, setTarget] = useState<Target>('typescript');
  const [tools, setTools] = useState<ParsedTool[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const handleParse = useCallback(async () => {
    if (!specInput.trim()) {
      setError('Please paste or upload an OpenAPI spec.');
      return;
    }

    setParsing(true);
    setError(null);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: specInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to parse spec');
        setParsing(false);
        return;
      }

      setServerInfo(data.server);
      setTools(data.tools);
      setWarnings(data.warnings || []);
      setStep('preview');
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
  }, [specInput]);

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setError(null);

    try {
      const disabledTools = tools.filter(t => !t.enabled).map(t => t.name);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: specInput, target, disabledTools }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Generation failed');
        setStep('preview');
        return;
      }

      // Download the ZIP
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-${serverInfo?.name || 'server'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep('preview');
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
      setStep('preview');
    }
  }, [specInput, target, tools, serverInfo]);

  const toggleTool = (index: number) => {
    setTools(prev => prev.map((t, i) => i === index ? { ...t, enabled: !t.enabled } : t));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSpecInput(reader.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Generate MCP Server</h1>
      <p className="text-gray-400 mb-8">Paste your OpenAPI 3.x spec below or upload a file.</p>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Input */}
      {step === 'input' && (
        <div>
          <div className="flex gap-4 mb-4">
            <label className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">OpenAPI Spec</span>
                <label className="text-sm text-forge-400 hover:text-forge-300 cursor-pointer">
                  Upload file
                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <textarea
                value={specInput}
                onChange={(e) => setSpecInput(e.target.value)}
                placeholder={`{
  "openapi": "3.0.3",
  "info": { "title": "My API", "version": "1.0.0" },
  "paths": { ... }
}`}
                className="w-full h-80 bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-forge-500 resize-none"
              />
            </label>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <span className="text-sm text-gray-400">Target:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="target"
                value="typescript"
                checked={target === 'typescript'}
                onChange={() => setTarget('typescript')}
                className="accent-forge-500"
              />
              <span className="text-sm">TypeScript</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="target"
                value="python"
                checked={target === 'python'}
                onChange={() => setTarget('python')}
                className="accent-forge-500"
              />
              <span className="text-sm">Python</span>
            </label>
          </div>

          <button
            onClick={handleParse}
            disabled={parsing || !specInput.trim()}
            className="bg-forge-600 hover:bg-forge-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            {parsing ? 'Parsing...' : 'Parse Spec →'}
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && serverInfo && (
        <div>
          {/* Server info card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">{serverInfo.name}</h2>
                <p className="text-gray-400 text-sm mt-1">{serverInfo.description}</p>
              </div>
              <div className="text-right text-sm text-gray-400">
                <div>v{serverInfo.version}</div>
                <div>{serverInfo.baseUrl}</div>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="px-2 py-1 bg-forge-950 text-forge-300 rounded">
                {tools.filter(t => t.enabled).length} tools enabled
              </span>
              <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded">
                {serverInfo.envVars.length} env vars
              </span>
              <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded">
                {target === 'typescript' ? 'TypeScript' : 'Python'}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-4 mb-6">
              {warnings.map((w, i) => (
                <p key={i} className="text-yellow-300 text-sm">⚠️ {w}</p>
              ))}
            </div>
          )}

          {/* Tool list */}
          <h3 className="text-lg font-semibold mb-3">MCP Tools</h3>
          <div className="space-y-2 mb-8">
            {tools.map((tool, idx) => (
              <div
                key={tool.name}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  tool.enabled
                    ? 'bg-gray-900 border-gray-800'
                    : 'bg-gray-950 border-gray-900 opacity-50'
                }`}
              >
                <button
                  onClick={() => toggleTool(idx)}
                  className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                    tool.enabled ? 'bg-forge-600 text-white' : 'bg-gray-800 text-gray-600'
                  }`}
                >
                  {tool.enabled ? '✓' : ''}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-forge-300">{tool.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase">
                      {tool.source.method}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">{tool.description}</p>
                  <p className="text-xs text-gray-600 font-mono mt-1">{tool.source.path}</p>
                </div>
                <div className="text-xs text-gray-500">
                  {Object.keys(tool.inputSchema.properties).length} params
                </div>
              </div>
            ))}
          </div>

          {/* Env vars */}
          {serverInfo.envVars.length > 0 && (
            <>
              <h3 className="text-lg font-semibold mb-3">Environment Variables</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-8">
                {serverInfo.envVars.map(v => (
                  <div key={v.name} className="flex items-center gap-3 py-1.5 text-sm">
                    <code className="text-forge-300 font-mono">{v.name}</code>
                    <span className="text-gray-500">—</span>
                    <span className="text-gray-400">{v.description}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleGenerate}
              className="bg-forge-600 hover:bg-forge-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              ⚡ Download {target === 'typescript' ? 'TypeScript' : 'Python'} Server
            </button>
            <button
              onClick={() => { setStep('input'); setTools([]); setServerInfo(null); }}
              className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-2.5 rounded-lg transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 'generating' && (
        <div className="text-center py-20">
          <div className="text-4xl mb-4 animate-pulse">⚡</div>
          <p className="text-lg text-gray-300">Generating your MCP server...</p>
          <p className="text-sm text-gray-500 mt-2">This takes about 1-2 seconds</p>
        </div>
      )}
    </div>
  );
}
