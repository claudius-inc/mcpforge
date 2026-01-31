import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/playground
 * Server-side proxy that executes API calls on behalf of the tool playground.
 * This is needed because browser CORS restrictions prevent direct API calls.
 */

interface PlaygroundRequest {
  method: string;
  baseUrl: string;
  path: string;
  inputs: Record<string, unknown>;
  pathParams: string[];
  queryParams: string[];
  headerParams: string[];
  bodyParam: string | null;
  contentType: string;
  auth: Array<{
    type: 'bearer' | 'apiKey' | 'basic';
    value: string;
    headerName?: string;
    in?: 'header' | 'query';
  }>;
}

// Block requests to private/internal networks
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^\[::1\]/,
  /^169\.254\./,
];

function isBlockedHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return BLOCKED_HOSTS.some(pattern => pattern.test(parsed.hostname));
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: PlaygroundRequest = await req.json();

    if (!body.method || !body.baseUrl || !body.path) {
      return NextResponse.json(
        { error: 'Missing required fields: method, baseUrl, path' },
        { status: 400 }
      );
    }

    // Build URL with path params substituted
    let url = body.baseUrl.replace(/\/+$/, '') + body.path;
    for (const param of body.pathParams) {
      const value = body.inputs[param];
      if (value !== undefined && value !== '') {
        url = url.replace(`{${param}}`, encodeURIComponent(String(value)));
      }
    }

    // Append query params
    const queryEntries: [string, string][] = body.queryParams
      .filter(p => body.inputs[p] !== undefined && body.inputs[p] !== '')
      .map(p => [p, String(body.inputs[p])]);
    if (queryEntries.length > 0) {
      url += '?' + new URLSearchParams(queryEntries).toString();
    }

    // SSRF protection
    if (isBlockedHost(url)) {
      return NextResponse.json(
        { error: 'Requests to private/internal networks are not allowed.' },
        { status: 403 }
      );
    }

    // Build headers
    const headers: Record<string, string> = {
      'User-Agent': 'MCPForge-Playground/1.0',
      'Accept': 'application/json, text/plain, */*',
    };

    if (body.contentType && !['GET', 'HEAD', 'DELETE'].includes(body.method)) {
      headers['Content-Type'] = body.contentType;
    }

    for (const hp of body.headerParams) {
      if (body.inputs[hp] !== undefined && body.inputs[hp] !== '') {
        // Strip 'header_' prefix added by the mapper, restore original header name
        const headerName = hp.startsWith('header_')
          ? hp.slice(7).replace(/_/g, '-')
          : hp;
        headers[headerName] = String(body.inputs[hp]);
      }
    }

    // Apply auth
    for (const auth of (body.auth || [])) {
      if (!auth.value) continue;
      switch (auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${auth.value}`;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${btoa(auth.value)}`;
          break;
        case 'apiKey':
          if (auth.in === 'query') {
            const sep = url.includes('?') ? '&' : '?';
            url += `${sep}${encodeURIComponent(auth.headerName || 'api_key')}=${encodeURIComponent(auth.value)}`;
          } else {
            headers[auth.headerName || 'X-API-Key'] = auth.value;
          }
          break;
      }
    }

    // Build request body
    let requestBody: string | undefined;
    if (body.bodyParam && !['GET', 'HEAD', 'DELETE'].includes(body.method)) {
      if (body.bodyParam === '__body_object__') {
        // Reconstruct body from flat params, excluding path/query/header params
        const nonBodyParams = new Set([
          ...body.pathParams,
          ...body.queryParams,
          ...body.headerParams,
        ]);
        const bodyObj: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(body.inputs)) {
          if (!nonBodyParams.has(key) && val !== undefined && val !== '') {
            bodyObj[key] = val;
          }
        }
        requestBody = JSON.stringify(bodyObj);
      } else if (body.bodyParam === 'body') {
        const val = body.inputs['body'];
        requestBody = typeof val === 'string' ? val : JSON.stringify(val);
      }
    }

    // Execute with timeout
    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: body.method,
        headers,
        body: requestBody,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);
      const elapsed = Math.round(performance.now() - start);

      // Collect response headers
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { responseHeaders[k] = v; });

      // Read response body (limit to 500KB)
      let responseBody: string;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        try {
          const json = await res.json();
          responseBody = JSON.stringify(json, null, 2);
        } catch {
          responseBody = await res.text();
        }
      } else {
        responseBody = (await res.text()).slice(0, 500_000);
      }

      return NextResponse.json({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        timing: elapsed,
        url: url.replace(/([?&])(api[_-]?key|token|secret|password|auth)=[^&]*/gi, '$1$2=***'),
      });
    } catch (error) {
      clearTimeout(timeout);
      const elapsed = Math.round(performance.now() - start);
      const message = (error as Error).name === 'AbortError'
        ? 'Request timed out after 15 seconds'
        : (error as Error).message;

      return NextResponse.json({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: message,
        timing: elapsed,
        url,
      }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request', message: (error as Error).message },
      { status: 400 }
    );
  }
}
