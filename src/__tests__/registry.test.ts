import { describe, it, expect } from 'vitest';
import { REGISTRY_CATEGORIES } from '../lib/registry/types';
import type { RegistrySearchParams, RegistryListing, RegistryCategoryId } from '../lib/registry/types';

// --- Category Tests ---
describe('Registry Categories', () => {
  it('has all required categories', () => {
    const ids = REGISTRY_CATEGORIES.map(c => c.id);
    expect(ids).toContain('ai-ml');
    expect(ids).toContain('devtools');
    expect(ids).toContain('finance');
    expect(ids).toContain('utilities');
    expect(ids).toContain('weather');
  });

  it('has unique category ids', () => {
    const ids = REGISTRY_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each category has name and emoji', () => {
    for (const cat of REGISTRY_CATEGORIES) {
      expect(cat.name).toBeTruthy();
      expect(cat.emoji).toBeTruthy();
      expect(cat.id).toMatch(/^[a-z-]+$/);
    }
  });

  it('has at least 10 categories', () => {
    expect(REGISTRY_CATEGORIES.length).toBeGreaterThanOrEqual(10);
  });
});

// --- Publish Validation Tests ---
describe('Publish Validation', () => {
  const validParams = {
    userId: 'user123',
    title: 'Weather API Server',
    description: 'MCP server for weather data including forecasts and current conditions',
    categories: ['weather'],
    tags: ['weather', 'forecast'],
    specSnapshot: '{"openapi":"3.0.0"}',
    language: 'typescript' as const,
    toolCount: 3,
    toolNames: ['get_weather', 'get_forecast', 'get_alerts'],
  };

  function validateParams(params: typeof validParams): string | null {
    if (!params.title || params.title.length < 3 || params.title.length > 100) return 'Title must be 3-100 characters';
    if (!params.description || params.description.length < 10 || params.description.length > 500) return 'Description must be 10-500 characters';
    if (!params.categories.length || params.categories.length > 3) return 'Select 1-3 categories';
    const validCats = new Set(REGISTRY_CATEGORIES.map(c => c.id));
    for (const cat of params.categories) {
      if (!validCats.has(cat as RegistryCategoryId)) return `Invalid category: ${cat}`;
    }
    if (params.tags && params.tags.length > 10) return 'Maximum 10 tags';
    if (params.tags) {
      for (const tag of params.tags) {
        if (tag.length > 30 || !/^[a-z0-9-]+$/.test(tag)) return `Invalid tag: "${tag}"`;
      }
    }
    if (!params.specSnapshot) return 'Spec snapshot is required';
    if (params.toolCount < 1) return 'Server must have at least one tool';
    return null;
  }

  it('accepts valid params', () => {
    expect(validateParams(validParams)).toBeNull();
  });

  it('rejects empty title', () => {
    expect(validateParams({ ...validParams, title: '' })).toContain('Title');
  });

  it('rejects short title', () => {
    expect(validateParams({ ...validParams, title: 'ab' })).toContain('Title');
  });

  it('rejects long title', () => {
    expect(validateParams({ ...validParams, title: 'x'.repeat(101) })).toContain('Title');
  });

  it('rejects short description', () => {
    expect(validateParams({ ...validParams, description: 'short' })).toContain('Description');
  });

  it('rejects long description', () => {
    expect(validateParams({ ...validParams, description: 'x'.repeat(501) })).toContain('Description');
  });

  it('rejects no categories', () => {
    expect(validateParams({ ...validParams, categories: [] })).toContain('categories');
  });

  it('rejects more than 3 categories', () => {
    expect(validateParams({ ...validParams, categories: ['ai-ml', 'devtools', 'finance', 'weather'] })).toContain('categories');
  });

  it('rejects invalid category', () => {
    expect(validateParams({ ...validParams, categories: ['invalid-cat'] })).toContain('Invalid category');
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
    expect(validateParams({ ...validParams, tags })).toContain('Maximum 10');
  });

  it('rejects invalid tag format', () => {
    expect(validateParams({ ...validParams, tags: ['Invalid Tag!'] })).toContain('Invalid tag');
  });

  it('accepts valid tag formats', () => {
    expect(validateParams({ ...validParams, tags: ['valid-tag', 'another123', 'ok'] })).toBeNull();
  });

  it('rejects zero tools', () => {
    expect(validateParams({ ...validParams, toolCount: 0 })).toContain('at least one tool');
  });

  it('rejects empty spec', () => {
    expect(validateParams({ ...validParams, specSnapshot: '' })).toContain('Spec snapshot');
  });
});

// --- Search Params Tests ---
describe('Search Params', () => {
  it('constructs valid search params', () => {
    const params: RegistrySearchParams = {
      query: 'weather',
      category: 'weather',
      sort: 'popular',
      page: 1,
      limit: 20,
    };
    expect(params.query).toBe('weather');
    expect(params.sort).toBe('popular');
    expect(params.page).toBe(1);
  });

  it('supports all sort options', () => {
    const sorts: RegistrySearchParams['sort'][] = ['popular', 'newest', 'stars', 'name'];
    for (const sort of sorts) {
      const p: RegistrySearchParams = { sort };
      expect(p.sort).toBe(sort);
    }
  });

  it('supports language filter', () => {
    const p: RegistrySearchParams = { language: 'typescript' };
    expect(p.language).toBe('typescript');
  });

  it('supports featured filter', () => {
    const p: RegistrySearchParams = { featured: true };
    expect(p.featured).toBe(true);
  });

  it('supports tag filter', () => {
    const p: RegistrySearchParams = { tag: 'api' };
    expect(p.tag).toBe('api');
  });
});

// --- Listing Shape Tests ---
describe('Listing Shape', () => {
  const mockListing: RegistryListing = {
    id: 'abc123',
    server_id: null,
    user_id: 'user1',
    title: 'Test Server',
    description: 'A test MCP server for weather data',
    readme: '# Test Server\nThis is a test.',
    categories: ['weather', 'utilities'],
    tags: ['weather', 'test'],
    api_source_url: 'https://api.weather.com/docs',
    spec_snapshot: '{"openapi":"3.0.0"}',
    language: 'typescript',
    tool_count: 5,
    tool_names: ['get_weather', 'get_forecast', 'get_alerts', 'search_cities', 'get_hourly'],
    stars_count: 42,
    forks_count: 7,
    installs_count: 150,
    featured: true,
    verified: false,
    status: 'published',
    version: '1.2.0',
    github_repo: 'https://github.com/user/test-server',
    published_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-30T15:00:00Z',
  };

  it('has all required fields', () => {
    expect(mockListing.id).toBeTruthy();
    expect(mockListing.title).toBeTruthy();
    expect(mockListing.description).toBeTruthy();
    expect(mockListing.spec_snapshot).toBeTruthy();
    expect(mockListing.language).toBeTruthy();
    expect(mockListing.published_at).toBeTruthy();
  });

  it('categories is array of strings', () => {
    expect(Array.isArray(mockListing.categories)).toBe(true);
    for (const cat of mockListing.categories) {
      expect(typeof cat).toBe('string');
    }
  });

  it('tool_names is array of strings', () => {
    expect(Array.isArray(mockListing.tool_names)).toBe(true);
    expect(mockListing.tool_names.length).toBe(mockListing.tool_count);
  });

  it('status is valid enum', () => {
    expect(['published', 'unlisted', 'suspended']).toContain(mockListing.status);
  });

  it('version is semver-like', () => {
    expect(mockListing.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('github_repo is valid URL or null', () => {
    if (mockListing.github_repo) {
      expect(mockListing.github_repo).toMatch(/^https:\/\/github\.com\//);
    }
  });

  it('counts are non-negative', () => {
    expect(mockListing.stars_count).toBeGreaterThanOrEqual(0);
    expect(mockListing.forks_count).toBeGreaterThanOrEqual(0);
    expect(mockListing.installs_count).toBeGreaterThanOrEqual(0);
    expect(mockListing.tool_count).toBeGreaterThan(0);
  });
});

// --- GitHub URL Validation ---
describe('GitHub URL Validation', () => {
  const isValidGitHubUrl = (url: string) => /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(url);

  it('accepts valid GitHub URLs', () => {
    expect(isValidGitHubUrl('https://github.com/user/repo')).toBe(true);
    expect(isValidGitHubUrl('https://github.com/org-name/my-repo.js')).toBe(true);
    expect(isValidGitHubUrl('https://github.com/user123/repo_name')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidGitHubUrl('https://gitlab.com/user/repo')).toBe(false);
    expect(isValidGitHubUrl('github.com/user/repo')).toBe(false);
    expect(isValidGitHubUrl('https://github.com/user')).toBe(false);
    expect(isValidGitHubUrl('https://github.com/user/repo/tree/main')).toBe(false);
    expect(isValidGitHubUrl('')).toBe(false);
  });
});

// --- Tag Validation ---
describe('Tag Validation', () => {
  const isValidTag = (tag: string) => tag.length <= 30 && /^[a-z0-9-]+$/.test(tag);

  it('accepts valid tags', () => {
    expect(isValidTag('api')).toBe(true);
    expect(isValidTag('weather-data')).toBe(true);
    expect(isValidTag('web3')).toBe(true);
    expect(isValidTag('ai-ml')).toBe(true);
  });

  it('rejects uppercase', () => {
    expect(isValidTag('API')).toBe(false);
    expect(isValidTag('Weather')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidTag('tag!')).toBe(false);
    expect(isValidTag('tag space')).toBe(false);
    expect(isValidTag('tag@1')).toBe(false);
  });

  it('rejects too long tags', () => {
    expect(isValidTag('a'.repeat(31))).toBe(false);
  });

  it('accepts boundary length', () => {
    expect(isValidTag('a'.repeat(30))).toBe(true);
  });
});

// --- Fork Logic ---
describe('Fork Logic', () => {
  it('generates unique fork IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(crypto.randomUUID().replace(/-/g, '').slice(0, 24));
    }
    expect(ids.size).toBe(100);
  });

  it('generates valid slug from title', () => {
    const slugify = (title: string, userId: string) =>
      `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${userId.slice(0, 6)}`;

    expect(slugify('Weather API Server', 'user123456')).toBe('weather-api-server-user12');
    expect(slugify('My Cool MCP Server!!!', 'abc')).toBe('my-cool-mcp-server-abc');
    expect(slugify('---Test---', 'xyz')).toBe('test-xyz');
  });
});

// --- CLI Arg Parsing ---
describe('CLI Arg Parsing', () => {
  function getFlag(args: string[], flag: string, short?: string): string | undefined {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === flag || (short && args[i] === short)) return args[i + 1];
    }
    return undefined;
  }

  it('parses long flags', () => {
    const args = ['generate', 'spec.yaml', '--language', 'python', '--output', './out'];
    expect(getFlag(args, '--language', '-l')).toBe('python');
    expect(getFlag(args, '--output', '-o')).toBe('./out');
  });

  it('parses short flags', () => {
    const args = ['generate', 'spec.yaml', '-l', 'typescript', '-o', './my-dir'];
    expect(getFlag(args, '--language', '-l')).toBe('typescript');
    expect(getFlag(args, '--output', '-o')).toBe('./my-dir');
  });

  it('returns undefined for missing flags', () => {
    const args = ['generate', 'spec.yaml'];
    expect(getFlag(args, '--language', '-l')).toBeUndefined();
    expect(getFlag(args, '--name', '-n')).toBeUndefined();
  });
});
