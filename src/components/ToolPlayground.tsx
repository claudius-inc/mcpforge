'use client';

import { useState, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────

interface MCPProperty {
  type: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: MCPProperty;
  properties?: Record<string, MCPProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  format?: string;
}

interface ToolAuthInfo {
  scheme: {
    type: string;
    scheme?: string;
    paramName?: string;
    in?: string;
    name: string;
  };
  envVar: string;
}

interface ToolHandlerInfo {
  method: string;
  path: string;
  baseUrl: string;
  contentType: string;
  pathParams: string[];
  queryParams: string[];
  headerParams: string[];
  bodyParam?: string;
  auth: ToolAuthInfo[];
}

export interface PlaygroundTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, MCPProperty>;
    required: string[];
  };
  handler: ToolHandlerInfo;
  source: { path: string; method: string };
}

interface PlaygroundResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing: number;
  url: string;
}

// ─── Main Component ──────────────────────────────────────────────

export function ToolPlayground({
  tool,
  onClose,
}: {
  tool: PlaygroundTool;
  onClose: () => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const [name, prop] of Object.entries(tool.inputSchema.properties)) {
      if (prop.default !== undefined) {
        defaults[name] = String(prop.default);
      }
    }
    return defaults;
  });

  const [authValues, setAuthValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [executing, setExecuting] = useState(false);
  const [showCurl, setShowCurl] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);

  // Group params by type
  const paramGroups = useMemo(() => {
    const pathSet = new Set(tool.handler.pathParams);
    const querySet = new Set(tool.handler.queryParams);
    const headerSet = new Set(tool.handler.headerParams);

    const groups = {
      path: [] as string[],
      query: [] as string[],
      header: [] as string[],
      body: [] as string[],
    };

    for (const name of Object.keys(tool.inputSchema.properties)) {
      if (pathSet.has(name)) groups.path.push(name);
      else if (querySet.has(name)) groups.query.push(name);
      else if (headerSet.has(name)) groups.header.push(name);
      else groups.body.push(name);
    }

    return groups;
  }, [tool]);

  // Build curl command for preview
  const curlCommand = useMemo(() => {
    let url = tool.handler.baseUrl + tool.handler.path;
    for (const p of tool.handler.pathParams) {
      url = url.replace(`{${p}}`, inputs[p] || `{${p}}`);
    }

    const queryParts = tool.handler.queryParams
      .filter(p => inputs[p])
      .map(p => `${p}=${encodeURIComponent(inputs[p])}`);
    if (queryParts.length > 0) url += '?' + queryParts.join('&');

    let cmd = `curl -X ${tool.handler.method}`;
    cmd += ` \\\n  '${url}'`;

    for (const auth of tool.handler.auth) {
      const val = authValues[auth.envVar] || `$${auth.envVar}`;
      if (auth.scheme.type === 'http' && auth.scheme.scheme === 'bearer') {
        cmd += ` \\\n  -H 'Authorization: Bearer ${val}'`;
      } else if (auth.scheme.type === 'http' && auth.scheme.scheme === 'basic') {
        cmd += ` \\\n  -H 'Authorization: Basic ${val}'`;
      } else if (auth.scheme.type === 'apiKey') {
        if (auth.scheme.in === 'header') {
          cmd += ` \\\n  -H '${auth.scheme.paramName}: ${val}'`;
        }
      }
    }

    if (tool.handler.bodyParam && !['GET', 'HEAD', 'DELETE'].includes(tool.handler.method)) {
      cmd += ` \\\n  -H 'Content-Type: ${tool.handler.contentType}'`;
      const nonBody = new Set([
        ...tool.handler.pathParams,
        ...tool.handler.queryParams,
        ...tool.handler.headerParams,
      ]);
      const bodyObj: Record<string, unknown> = {};
      for (const p of paramGroups.body) {
        if (inputs[p]) bodyObj[p] = tryParseJSON(inputs[p]);
      }
      if (Object.keys(bodyObj).length > 0) {
        cmd += ` \\\n  -d '${JSON.stringify(bodyObj, null, 2)}'`;
      }
    }

    return cmd;
  }, [inputs, authValues, tool, paramGroups]);

  const handleExecute = async () => {
    setExecuting(true);
    setResponse(null);

    const parsedInputs: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(inputs)) {
      if (val !== '') parsedInputs[key] = tryParseJSON(val);
    }

    const authConfig = tool.handler.auth.map(a => ({
      type: a.scheme.type === 'http'
        ? (a.scheme.scheme as 'bearer' | 'basic')
        : 'apiKey' as const,
      value: authValues[a.envVar] || '',
      headerName: a.scheme.paramName,
      in: a.scheme.in as 'header' | 'query' | undefined,
    }));

    try {
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: tool.handler.method,
          baseUrl: tool.handler.baseUrl,
          path: tool.handler.path,
          inputs: parsedInputs,
          pathParams: tool.handler.pathParams,
          queryParams: tool.handler.queryParams,
          headerParams: tool.handler.headerParams,
          bodyParam: tool.handler.bodyParam || null,
          contentType: tool.handler.contentType,
          auth: authConfig,
        }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (e) {
      setResponse({
        status: 0,
        statusText: 'Request Failed',
        headers: {},
        body: (e as Error).message,
        timing: 0,
        url: '',
      });
    } finally {
      setExecuting(false);
    }
  };

  const statusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-400 bg-green-950 border-green-800';
    if (status >= 400 && status < 500) return 'text-yellow-400 bg-yellow-950 border-yellow-800';
    return 'text-red-400 bg-red-950 border-red-800';
  };

  const hasParams = Object.keys(tool.inputSchema.properties).length > 0;
  const hasAuth = tool.handler.auth.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl mx-4 my-[5vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded font-bold tracking-wider bg-forge-950 text-forge-300 border border-forge-800 uppercase">
                {tool.handler.method}
              </span>
              <h2 className="text-lg font-bold font-mono text-forge-300 truncate">{tool.name}</h2>
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">{tool.description}</p>
            <p className="text-xs text-gray-600 font-mono mt-1.5">
              {tool.handler.baseUrl}{tool.handler.path}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg p-1 ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* No params message */}
          {!hasParams && !hasAuth && (
            <p className="text-sm text-gray-500 italic">
              This tool has no parameters — just hit Execute.
            </p>
          )}

          {/* Path Parameters */}
          {paramGroups.path.length > 0 && (
            <ParamGroup
              label="Path Parameters"
              icon="📍"
              params={paramGroups.path}
              schema={tool.inputSchema}
              inputs={inputs}
              setInputs={setInputs}
            />
          )}

          {/* Query Parameters */}
          {paramGroups.query.length > 0 && (
            <ParamGroup
              label="Query Parameters"
              icon="🔍"
              params={paramGroups.query}
              schema={tool.inputSchema}
              inputs={inputs}
              setInputs={setInputs}
            />
          )}

          {/* Header Parameters */}
          {paramGroups.header.length > 0 && (
            <ParamGroup
              label="Header Parameters"
              icon="📋"
              params={paramGroups.header}
              schema={tool.inputSchema}
              inputs={inputs}
              setInputs={setInputs}
            />
          )}

          {/* Body Parameters */}
          {paramGroups.body.length > 0 && (
            <ParamGroup
              label="Request Body"
              icon="📦"
              params={paramGroups.body}
              schema={tool.inputSchema}
              inputs={inputs}
              setInputs={setInputs}
            />
          )}

          {/* Authentication */}
          {hasAuth && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                🔑 Authentication
                <span className="text-xs font-normal text-gray-600">
                  (used only for this test call — never stored)
                </span>
              </h3>
              <div className="space-y-3">
                {tool.handler.auth.map(auth => (
                  <div key={auth.envVar}>
                    <label className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                      <span className="font-mono">{auth.envVar}</span>
                      <span className="text-gray-600">
                        {auth.scheme.type === 'http' ? auth.scheme.scheme : auth.scheme.type}
                      </span>
                    </label>
                    <input
                      type="password"
                      value={authValues[auth.envVar] || ''}
                      onChange={e => setAuthValues(prev => ({ ...prev, [auth.envVar]: e.target.value }))}
                      placeholder={getAuthPlaceholder(auth)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-forge-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleExecute}
              disabled={executing}
              className="bg-forge-600 hover:bg-forge-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {executing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Executing...
                </>
              ) : (
                <>▶ Execute</>
              )}
            </button>
            <button
              onClick={() => setShowCurl(!showCurl)}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showCurl ? '▾ Hide' : '▸ Show'} cURL
            </button>
            {Object.keys(inputs).length > 0 && (
              <button
                onClick={() => setInputs({})}
                className="text-sm text-gray-600 hover:text-gray-400 transition-colors ml-auto"
              >
                Clear all
              </button>
            )}
          </div>

          {/* cURL Preview */}
          {showCurl && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
                <span className="text-xs text-gray-500 font-medium">cURL</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(curlCommand)}
                  className="text-xs text-forge-400 hover:text-forge-300 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap break-all overflow-x-auto">
                {curlCommand}
              </pre>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="border-t border-gray-800 pt-6 space-y-4">
              {/* Status line */}
              <div className="flex items-center gap-4 flex-wrap">
                <span className={`px-3 py-1 rounded-lg border text-sm font-mono font-bold ${statusColor(response.status)}`}>
                  {response.status || '—'} {response.statusText}
                </span>
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  ⏱ {response.timing}ms
                </span>
                {response.url && (
                  <span className="text-xs text-gray-600 font-mono truncate max-w-md">
                    {response.url}
                  </span>
                )}
              </div>

              {/* Response Body */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
                  <span className="text-xs text-gray-500 font-medium">Response Body</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">
                      {response.body.length.toLocaleString()} chars
                    </span>
                    <button
                      onClick={() => navigator.clipboard?.writeText(response.body)}
                      className="text-xs text-forge-400 hover:text-forge-300 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                  {response.body || '(empty)'}
                </pre>
              </div>

              {/* Response Headers */}
              {Object.keys(response.headers).length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHeaders(!showHeaders)}
                    className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    {showHeaders ? '▾' : '▸'} Response Headers ({Object.keys(response.headers).length})
                  </button>
                  {showHeaders && (
                    <div className="mt-2 bg-gray-900 border border-gray-800 rounded-lg p-3">
                      {Object.entries(response.headers).map(([k, v]) => (
                        <div key={k} className="flex gap-2 py-0.5 text-xs font-mono">
                          <span className="text-forge-400 flex-shrink-0">{k}:</span>
                          <span className="text-gray-400 break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Param Group ─────────────────────────────────────────────────

function ParamGroup({
  label,
  icon,
  params,
  schema,
  inputs,
  setInputs,
}: {
  label: string;
  icon: string;
  params: string[];
  schema: { properties: Record<string, MCPProperty>; required: string[] };
  inputs: Record<string, string>;
  setInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        {icon} {label}
      </h3>
      <div className="space-y-3">
        {params.map(name => {
          const prop = schema.properties[name];
          const isRequired = schema.required.includes(name);

          return (
            <div key={name}>
              <label className="flex items-center gap-2 text-xs mb-1">
                <span className="font-mono text-gray-300">{name}</span>
                {isRequired && <span className="text-red-400 text-[10px]">required</span>}
                <span className="text-gray-600">
                  {prop.type}
                  {prop.format ? ` · ${prop.format}` : ''}
                </span>
              </label>
              {prop.description && (
                <p className="text-xs text-gray-600 mb-1.5">{prop.description}</p>
              )}
              {renderInput(
                name,
                prop,
                inputs[name] || '',
                (v) => setInputs(prev => ({ ...prev, [name]: v })),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Input Renderers ─────────────────────────────────────────────

function renderInput(
  name: string,
  prop: MCPProperty,
  value: string,
  onChange: (v: string) => void,
) {
  const baseClass =
    'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono ' +
    'text-gray-200 placeholder-gray-600 focus:outline-none focus:border-forge-500 transition-colors';

  // Enum → select
  if (prop.enum && prop.enum.length > 0) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass}>
        <option value="">Select…</option>
        {prop.enum.map(e => (
          <option key={String(e)} value={String(e)}>{String(e)}</option>
        ))}
      </select>
    );
  }

  // Boolean → toggle select
  if (prop.type === 'boolean') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass}>
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // Object or Array → textarea
  if (prop.type === 'object' || prop.type === 'array') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={prop.type === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}
        rows={3}
        className={`${baseClass} resize-y`}
      />
    );
  }

  // Number → number input
  if (prop.type === 'number' || prop.type === 'integer') {
    return (
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={prop.minimum}
        max={prop.maximum}
        placeholder={prop.default !== undefined ? String(prop.default) : name}
        className={baseClass}
      />
    );
  }

  // Default → text input
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={prop.default !== undefined ? String(prop.default) : name}
      className={baseClass}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function tryParseJSON(value: string): unknown {
  if (!value) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getAuthPlaceholder(auth: ToolAuthInfo): string {
  if (auth.scheme.type === 'http') {
    if (auth.scheme.scheme === 'bearer') return 'Bearer token…';
    if (auth.scheme.scheme === 'basic') return 'username:password';
  }
  if (auth.scheme.type === 'apiKey') return 'API key…';
  return 'Credentials…';
}
