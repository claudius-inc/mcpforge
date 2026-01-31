'use client';

import { useState, useCallback } from 'react';

interface APIEntry {
  id: string;
  name: string;
  spec: string;
  collapsed: boolean;
}

interface ComposeError {
  api: string;
  message: string;
}

interface ComposeProps {
  target: 'typescript' | 'python';
  onComposed: (data: {
    server: {
      name: string;
      version: string;
      description: string;
      toolCount: number;
      envVars: { name: string; description: string }[];
    };
    tools: Array<{
      name: string;
      description: string;
      inputSchema: { type: string; properties: Record<string, unknown>; required: string[] };
      source: { path: string; method: string };
      handler: { method: string; path: string; baseUrl: string };
      enabled: boolean;
    }>;
    errors: ComposeError[];
    warnings: string[];
    apis: APIEntry[];
    serverName: string;
  }) => void;
  onError: (error: string) => void;
}

let nextId = 1;

function makeEntry(): APIEntry {
  return { id: `api-${nextId++}`, name: '', spec: '', collapsed: false };
}

const EXAMPLE_SPECS = {
  weather: {
    name: 'weather',
    spec: JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Weather API', version: '1.0.0', description: 'Current weather and forecasts' },
      servers: [{ url: 'https://api.openweathermap.org/data/2.5' }],
      paths: {
        '/weather': {
          get: {
            operationId: 'getCurrentWeather',
            summary: 'Get current weather for a city',
            parameters: [
              { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'City name' },
              { name: 'units', in: 'query', schema: { type: 'string', enum: ['metric', 'imperial'] } },
            ],
            responses: { '200': { description: 'Weather data' } },
          },
        },
        '/forecast': {
          get: {
            operationId: 'getForecast',
            summary: 'Get 5-day weather forecast',
            parameters: [
              { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Forecast data' } },
          },
        },
      },
      components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'query', name: 'appid' } } },
      security: [{ apiKey: [] }],
    }, null, 2),
  },
  todo: {
    name: 'todos',
    spec: JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Todo API', version: '1.0.0' },
      servers: [{ url: 'https://jsonplaceholder.typicode.com' }],
      paths: {
        '/todos': {
          get: { operationId: 'listTodos', summary: 'List all todos', responses: { '200': { description: 'OK' } } },
          post: {
            operationId: 'createTodo',
            summary: 'Create a todo',
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, completed: { type: 'boolean' } }, required: ['title'] } } },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
        '/todos/{id}': {
          get: { operationId: 'getTodo', summary: 'Get a todo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } },
        },
      },
    }, null, 2),
  },
};

export function ComposeMultiple({ target, onComposed, onError }: ComposeProps) {
  const [apis, setApis] = useState<APIEntry[]>([makeEntry(), makeEntry()]);
  const [serverName, setServerName] = useState('');
  const [composing, setComposing] = useState(false);

  const addAPI = () => {
    if (apis.length >= 20) return;
    setApis(prev => [...prev, makeEntry()]);
  };

  const removeAPI = (id: string) => {
    if (apis.length <= 2) return;
    setApis(prev => prev.filter(a => a.id !== id));
  };

  const updateAPI = (id: string, field: keyof APIEntry, value: string | boolean) => {
    setApis(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateAPI(id, 'spec', reader.result as string);
    reader.readAsText(file);
  };

  const loadExample = () => {
    setApis([
      { id: `api-${nextId++}`, name: EXAMPLE_SPECS.weather.name, spec: EXAMPLE_SPECS.weather.spec, collapsed: false },
      { id: `api-${nextId++}`, name: EXAMPLE_SPECS.todo.name, spec: EXAMPLE_SPECS.todo.spec, collapsed: false },
    ]);
    setServerName('weather-todos');
  };

  const handleCompose = useCallback(async () => {
    // Validate
    const incomplete = apis.filter(a => !a.name.trim() || !a.spec.trim());
    if (incomplete.length > 0) {
      onError('Each API needs a name and spec. Fill in all entries or remove empty ones.');
      return;
    }

    setComposing(true);

    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apis: apis.map(a => ({ name: a.name, spec: a.spec })),
          serverName: serverName || undefined,
          target,
          mode: 'preview',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        onError(data.error || 'Composition failed');
        setComposing(false);
        return;
      }

      onComposed({
        ...data,
        apis,
        serverName: serverName || data.server.name,
      });
    } catch (e) {
      onError(`Network error: ${(e as Error).message}`);
    } finally {
      setComposing(false);
    }
  }, [apis, serverName, target, onComposed, onError]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">Server Name <span className="text-gray-600">(optional)</span></span>
          <button
            onClick={loadExample}
            className="text-xs text-forge-400 hover:text-forge-300 transition-colors"
          >
            Load example (Weather + Todos)
          </button>
        </div>
        <input
          type="text"
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
          placeholder="my-super-server"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-forge-500"
        />
      </div>

      <div className="space-y-4 mb-6">
        {apis.map((api, idx) => (
          <div key={api.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50">
              <span className="text-xs font-bold text-gray-500 w-6">#{idx + 1}</span>
              <input
                type="text"
                value={api.name}
                onChange={(e) => updateAPI(api.id, 'name', e.target.value)}
                placeholder="API name (e.g. weather, github, stripe)"
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
              />
              <button
                onClick={() => updateAPI(api.id, 'collapsed', !api.collapsed)}
                className="text-xs text-gray-500 hover:text-gray-300 px-2"
              >
                {api.collapsed ? '▼ expand' : '▲ collapse'}
              </button>
              {apis.length > 2 && (
                <button
                  onClick={() => removeAPI(api.id)}
                  className="text-xs text-red-500 hover:text-red-400 px-2"
                >
                  ✕ remove
                </button>
              )}
            </div>

            {/* Spec textarea */}
            {!api.collapsed && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">OpenAPI Spec (JSON or YAML)</span>
                  <label className="text-xs text-forge-400 hover:text-forge-300 cursor-pointer">
                    Upload file
                    <input
                      type="file"
                      accept=".json,.yaml,.yml"
                      className="hidden"
                      onChange={(e) => handleFileUpload(api.id, e)}
                    />
                  </label>
                </div>
                <textarea
                  value={api.spec}
                  onChange={(e) => updateAPI(api.id, 'spec', e.target.value)}
                  placeholder='{"openapi": "3.0.3", "info": {...}, "paths": {...}}'
                  className="w-full h-40 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 placeholder-gray-700 focus:outline-none focus:border-forge-500 resize-none"
                />
                {api.spec.trim() && (
                  <div className="mt-2 text-xs text-gray-600">
                    {api.spec.length.toLocaleString()} chars
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add API button */}
      {apis.length < 20 && (
        <button
          onClick={addAPI}
          className="w-full border border-dashed border-gray-700 hover:border-forge-600 text-gray-500 hover:text-forge-400 rounded-xl py-3 text-sm transition-colors mb-6"
        >
          + Add another API
        </button>
      )}

      {/* Compose button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleCompose}
          disabled={composing || apis.length < 2}
          className="bg-gradient-to-r from-forge-600 to-purple-600 hover:from-forge-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all"
        >
          {composing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">🔀</span>
              Composing {apis.length} APIs...
            </span>
          ) : (
            `🔀 Compose ${apis.length} APIs → One MCP Server`
          )}
        </button>
        {composing && (
          <span className="text-xs text-gray-500">Parsing specs and merging tools...</span>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 bg-gray-900/50 border border-gray-800/50 rounded-lg p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Multi-API Composition:</strong> Combine multiple APIs 
          into a single MCP server. Each API&apos;s tools are prefixed with its name to avoid conflicts.
          Environment variables and auth credentials are also scoped per-API. For example, combining 
          a Weather API and a Calendar API gives you tools like <code className="text-gray-400">weather_getForecast</code> and{' '}
          <code className="text-gray-400">calendar_createEvent</code> in one server.
        </p>
      </div>
    </div>
  );
}
