'use client';

import { useState, useCallback } from 'react';
import { ToolPlayground, type PlaygroundTool } from '@/components/ToolPlayground';
import { ComposeMultiple } from '@/components/ComposeMultiple';

interface ToolHandlerInfo {
  method: string;
  path: string;
  baseUrl: string;
  contentType: string;
  pathParams: string[];
  queryParams: string[];
  headerParams: string[];
  bodyParam?: string;
  auth: Array<{
    scheme: {
      type: string;
      scheme?: string;
      paramName?: string;
      in?: string;
      name: string;
    };
    envVar: string;
  }>;
}

interface ParsedTool {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, unknown>; required: string[] };
  source: { path: string; method: string };
  handler: ToolHandlerInfo;
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
type InputMode = 'spec' | 'describe' | 'crawl' | 'compose';

const EXAMPLE_PROMPTS = [
  'A weather API that can get current weather and 5-day forecast for any city, with temperature in Celsius or Fahrenheit',
  'GitHub-like API for managing repositories, issues, and pull requests with Bearer token auth',
  'A Stripe-like payment API with customers, charges, subscriptions, and webhook management',
  'A simple CRUD API for a todo list app with categories, due dates, and priority levels',
  'Slack-like messaging API with channels, messages, reactions, and file uploads',
];

export default function GeneratePage() {
  const [step, setStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<InputMode>('spec');
  const [specInput, setSpecInput] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState<Target>('typescript');
  const [tools, setTools] = useState<ParsedTool[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [docsUrl, setDocsUrl] = useState('');
  const [crawlContext, setCrawlContext] = useState('');
  const [crawlPageTitle, setCrawlPageTitle] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [playgroundTool, setPlaygroundTool] = useState<PlaygroundTool | null>(null);
  const [composeApis, setComposeApis] = useState<Array<{ name: string; spec: string }>>([]);
  const [composeServerName, setComposeServerName] = useState('');

  const handleParse = useCallback(async (specToParse?: string) => {
    const spec = specToParse || specInput;
    if (!spec.trim()) {
      setError('Please paste or upload an OpenAPI spec.');
      return;
    }

    setParsing(true);
    setError(null);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
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

  const handleDescribe = useCallback(async () => {
    if (!description.trim()) {
      setError('Please describe what your MCP server should do.');
      return;
    }

    setDescribing(true);
    setError(null);

    try {
      const res = await fetch('/api/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate spec');
        setDescribing(false);
        return;
      }

      // Store the generated spec and auto-parse it
      setSpecInput(data.spec);
      setAiModel(data.model || null);

      // Now parse the generated spec
      await handleParse(data.spec);
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
    } finally {
      setDescribing(false);
    }
  }, [description, handleParse]);

  const handleCrawl = useCallback(async () => {
    if (!docsUrl.trim()) {
      setError('Please enter a documentation URL.');
      return;
    }

    setCrawling(true);
    setError(null);
    setCrawlPageTitle(null);

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: docsUrl, additionalContext: crawlContext || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to crawl documentation');
        setCrawling(false);
        return;
      }

      // Store the generated spec and auto-parse it
      setSpecInput(data.spec);
      setAiModel(data.model || null);
      setCrawlPageTitle(data.pageTitle || null);

      // Now parse the generated spec
      await handleParse(data.spec);
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
    } finally {
      setCrawling(false);
    }
  }, [docsUrl, crawlContext, handleParse]);

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

  const handleComposeDownload = useCallback(async () => {
    setStep('generating');
    setError(null);

    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apis: composeApis.map(a => ({ name: a.name, spec: a.spec })),
          serverName: composeServerName || undefined,
          target,
          mode: 'download',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Generation failed');
        setStep('preview');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-${serverInfo?.name || 'composed-server'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep('preview');
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
      setStep('preview');
    }
  }, [composeApis, composeServerName, target, serverInfo]);

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

  const openPlayground = (tool: ParsedTool) => {
    setPlaygroundTool(tool as unknown as PlaygroundTool);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Generate MCP Server</h1>
      <p className="text-gray-400 mb-8">
        Upload an OpenAPI spec or describe what you want in plain English.
      </p>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Input */}
      {step === 'input' && (
        <div>
          {/* Tab switcher */}
          <div className="flex border-b border-gray-800 mb-6">
            <button
              onClick={() => { setInputMode('spec'); setError(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                inputMode === 'spec'
                  ? 'border-forge-500 text-forge-300'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              📄 Upload Spec
            </button>
            <button
              onClick={() => { setInputMode('describe'); setError(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                inputMode === 'describe'
                  ? 'border-forge-500 text-forge-300'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              ✨ Describe in English
            </button>
            <button
              onClick={() => { setInputMode('crawl'); setError(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                inputMode === 'crawl'
                  ? 'border-forge-500 text-forge-300'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              🔗 Import from Docs
            </button>
            <button
              onClick={() => { setInputMode('compose'); setError(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                inputMode === 'compose'
                  ? 'border-forge-500 text-forge-300'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              🔀 Compose Multiple
            </button>
          </div>

          {/* Spec upload mode */}
          {inputMode === 'spec' && (
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
                onClick={() => handleParse()}
                disabled={parsing || !specInput.trim()}
                className="bg-forge-600 hover:bg-forge-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {parsing ? 'Parsing...' : 'Parse Spec →'}
              </button>
            </div>
          )}

          {/* Describe mode */}
          {inputMode === 'describe' && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Describe your MCP server</span>
                  <span className="text-xs text-gray-500">{description.length}/5000</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what your MCP server should do in plain English. For example:

I want an MCP server that connects to a project management API. It should be able to:
- List, create, and update projects
- Manage tasks within projects (create, assign, set priority, mark complete)
- Add comments to tasks
- Search across all tasks with filters for status, assignee, and due date
- Use API key authentication"
                  className="w-full h-52 bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-forge-500 resize-none"
                />
              </div>

              {/* Example prompts */}
              <div className="mb-6">
                <span className="text-xs text-gray-500 block mb-2">Try an example:</span>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setDescription(prompt)}
                      className="text-xs px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:border-forge-700 hover:text-forge-300 transition-colors truncate max-w-[280px]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6 mb-6">
                <span className="text-sm text-gray-400">Target:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="target-describe"
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
                    name="target-describe"
                    value="python"
                    checked={target === 'python'}
                    onChange={() => setTarget('python')}
                    className="accent-forge-500"
                  />
                  <span className="text-sm">Python</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleDescribe}
                  disabled={describing || !description.trim()}
                  className="bg-gradient-to-r from-forge-600 to-blue-600 hover:from-forge-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all"
                >
                  {describing ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">✦</span>
                      Generating spec...
                    </span>
                  ) : (
                    '✨ Generate MCP Server →'
                  )}
                </button>
                {describing && (
                  <span className="text-xs text-gray-500">AI is writing your OpenAPI spec...</span>
                )}
              </div>

              {/* Info box */}
              <div className="mt-6 bg-gray-900/50 border border-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-400">How it works:</strong> Describe what your MCP server should do 
                  and AI will generate a complete OpenAPI spec, which is then converted into a production-ready 
                  MCP server. You can review and customize the generated tools before downloading.
                  {' '}Requires <code className="text-gray-400">OPENAI_API_KEY</code> on the server.
                </p>
              </div>
            </div>
          )}

          {/* Crawl docs mode */}
          {inputMode === 'crawl' && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">API Documentation URL</span>
                </div>
                <input
                  type="url"
                  value={docsUrl}
                  onChange={(e) => setDocsUrl(e.target.value)}
                  placeholder="https://docs.stripe.com/api/charges"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-forge-500"
                />
              </div>

              {/* Example URLs */}
              <div className="mb-4">
                <span className="text-xs text-gray-500 block mb-2">Try an example:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'HTTPBin', url: 'https://httpbin.org' },
                    { label: 'JSONPlaceholder', url: 'https://jsonplaceholder.typicode.com' },
                    { label: 'OpenWeather API', url: 'https://openweathermap.org/current' },
                    { label: 'PokéAPI', url: 'https://pokeapi.co/docs/v2' },
                  ].map((example) => (
                    <button
                      key={example.url}
                      onClick={() => setDocsUrl(example.url)}
                      className="text-xs px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:border-forge-700 hover:text-forge-300 transition-colors"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional context */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Additional Context <span className="text-gray-600">(optional)</span></span>
                  <span className="text-xs text-gray-500">{crawlContext.length}/2000</span>
                </div>
                <textarea
                  value={crawlContext}
                  onChange={(e) => setCrawlContext(e.target.value)}
                  placeholder="Focus on the authentication and user management endpoints only..."
                  className="w-full h-20 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-forge-500 resize-none"
                  maxLength={2000}
                />
              </div>

              <div className="flex items-center gap-6 mb-6">
                <span className="text-sm text-gray-400">Target:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="target-crawl"
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
                    name="target-crawl"
                    value="python"
                    checked={target === 'python'}
                    onChange={() => setTarget('python')}
                    className="accent-forge-500"
                  />
                  <span className="text-sm">Python</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleCrawl}
                  disabled={crawling || !docsUrl.trim()}
                  className="bg-gradient-to-r from-forge-600 to-emerald-600 hover:from-forge-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all"
                >
                  {crawling ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">🔗</span>
                      Crawling docs...
                    </span>
                  ) : (
                    '🔗 Extract API & Generate →'
                  )}
                </button>
                {crawling && (
                  <span className="text-xs text-gray-500">Fetching page, extracting endpoints, generating spec...</span>
                )}
              </div>

              {/* Info box */}
              <div className="mt-6 bg-gray-900/50 border border-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-400">How it works:</strong> Point at any API documentation page — 
                  MCPForge crawls it, extracts endpoint definitions, parameters, and authentication details, then 
                  uses AI to generate a complete OpenAPI spec. Works best with pages that list specific endpoints.
                  {' '}If the URL points directly to an OpenAPI/Swagger spec file, it&apos;s imported automatically.
                  {' '}Requires <code className="text-gray-400">OPENAI_API_KEY</code> on the server.
                </p>
              </div>
            </div>
          )}

          {/* Compose multiple mode */}
          {inputMode === 'compose' && (
            <ComposeMultiple
              target={target}
              onComposed={(data) => {
                setServerInfo(data.server as ServerInfo);
                setTools(data.tools.map(t => ({
                  ...t,
                  handler: {
                    ...t.handler,
                    contentType: 'application/json',
                    pathParams: [],
                    queryParams: [],
                    headerParams: [],
                    auth: [],
                  },
                })));
                setWarnings(data.warnings || []);
                setComposeApis(data.apis.map((a: { name: string; spec?: string }) => ({
                  name: a.name,
                  spec: (a as { spec?: string }).spec || '',
                })));
                setComposeServerName(data.serverName);
                setAiModel(null);
                setCrawlPageTitle(null);
                setStep('preview');
              }}
              onError={setError}
            />
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && serverInfo && (
        <div>
          {/* Composed server notice */}
          {composeApis.length > 0 && (
            <div className="bg-purple-950/50 border border-purple-800/50 rounded-lg p-3 mb-4 flex items-center gap-3">
              <span className="text-purple-400">🔀</span>
              <span className="text-sm text-purple-300">
                Composed from {composeApis.length} APIs: {composeApis.map(a => a.name).join(', ')}. Review the combined tools below.
              </span>
            </div>
          )}

          {/* AI generation notice */}
          {aiModel && (
            <div className="bg-forge-950/50 border border-forge-800/50 rounded-lg p-3 mb-4 flex items-center gap-3">
              <span className="text-forge-400">{crawlPageTitle ? '🔗' : '✨'}</span>
              <span className="text-sm text-forge-300">
                {crawlPageTitle
                  ? <>Spec extracted from <strong>{crawlPageTitle}</strong> by AI ({aiModel}). Review the tools below.</>
                  : <>Spec generated by AI ({aiModel}) from your description. Review the tools below.</>
                }
              </span>
              <button
                onClick={() => { setStep('input'); setInputMode('spec'); }}
                className="ml-auto text-xs text-forge-400 hover:text-forge-300 underline"
              >
                Edit raw spec
              </button>
            </div>
          )}

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">MCP Tools</h3>
            <span className="text-xs text-gray-500">Click ▶ to test any tool live</span>
          </div>
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
                  className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0 ${
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
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-500">
                    {Object.keys(tool.inputSchema.properties).length} params
                  </span>
                  {tool.enabled && (
                    <button
                      onClick={() => openPlayground(tool)}
                      className="text-xs px-2.5 py-1 rounded-md bg-forge-950 text-forge-400 hover:bg-forge-900 hover:text-forge-300 border border-forge-800/50 transition-colors"
                      title="Test this tool"
                    >
                      ▶ Test
                    </button>
                  )}
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
              onClick={composeApis.length > 0 ? handleComposeDownload : handleGenerate}
              className="bg-forge-600 hover:bg-forge-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              ⚡ Download {target === 'typescript' ? 'TypeScript' : 'Python'} Server
            </button>
            <button
              onClick={() => { setStep('input'); setTools([]); setServerInfo(null); setAiModel(null); setCrawlPageTitle(null); setComposeApis([]); }}
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

      {/* Playground Modal */}
      {playgroundTool && (
        <ToolPlayground
          tool={playgroundTool}
          onClose={() => setPlaygroundTool(null)}
        />
      )}
    </div>
  );
}
