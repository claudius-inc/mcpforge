import * as vscode from 'vscode';

interface RegistryListing {
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
  version: string;
  author_username?: string;
  published_at: string;
}

interface SearchResult {
  listings: RegistryListing[];
  total: number;
  page: number;
  totalPages: number;
}

interface GeneratePreview {
  tools: Array<{ name: string; description: string; inputSchema: unknown }>;
  serverName: string;
  language: string;
}

interface DescribeResult {
  spec: string;
  title?: string;
}

export class MCPForgeAPI {
  constructor(private baseUrl: string) {}

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  async generate(spec: string, language: string, mode: 'preview'): Promise<GeneratePreview>;
  async generate(spec: string, language: string, mode: 'download'): Promise<Uint8Array>;
  async generate(spec: string, language: string, mode: 'preview' | 'download'): Promise<GeneratePreview | Uint8Array> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, language, mode }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    if (mode === 'download') {
      const buffer = await res.arrayBuffer();
      return new Uint8Array(buffer);
    }

    return res.json() as Promise<GeneratePreview>;
  }

  async describe(description: string): Promise<DescribeResult> {
    const res = await fetch(`${this.baseUrl}/api/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<DescribeResult>;
  }

  async searchRegistry(query?: string, category?: string, page = 1): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    params.set('page', page.toString());
    params.set('limit', '20');

    const res = await fetch(`${this.baseUrl}/api/registry?${params}`);
    if (!res.ok) {
      throw new Error(`Registry search failed: ${res.statusText}`);
    }

    return res.json() as Promise<SearchResult>;
  }

  async getRegistryListing(id: string): Promise<RegistryListing & { readme?: string; spec_snapshot?: string }> {
    const res = await fetch(`${this.baseUrl}/api/registry/${id}`);
    if (!res.ok) {
      throw new Error(`Listing not found`);
    }

    return res.json();
  }
}

export type { RegistryListing, SearchResult, GeneratePreview, DescribeResult };
