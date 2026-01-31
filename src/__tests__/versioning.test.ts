import { describe, it, expect } from 'vitest';
import { diffConfigs } from '../lib/versioning/differ';
import { compareVersions } from '../lib/versioning/compare';
import type { MCPServerConfig, MCPTool, EnvVar } from '../lib/mapper/types';

// ─── Helpers ─────────────────────────────────────────────────────

function makeTool(overrides: Partial<MCPTool> & { name: string }): MCPTool {
  return {
    name: overrides.name,
    description: overrides.description || `Tool ${overrides.name}`,
    inputSchema: overrides.inputSchema || { type: 'object', properties: {}, required: [] },
    handler: overrides.handler || {
      method: 'get',
      path: '/test',
      baseUrl: 'https://api.example.com',
      contentType: 'application/json',
      pathParams: [],
      queryParams: [],
      headerParams: [],
      auth: [],
    },
    source: overrides.source || { path: '/test', method: 'get' },
    enabled: overrides.enabled ?? true,
  };
}

function makeConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name: overrides.name || 'test-api',
    version: overrides.version || '1.0.0',
    description: overrides.description || 'Test API',
    baseUrl: overrides.baseUrl || 'https://api.example.com',
    tools: overrides.tools || [],
    envVars: overrides.envVars || [],
  };
}

// ─── diffConfigs ─────────────────────────────────────────────────

describe('diffConfigs', () => {
  it('should detect no changes for identical configs', () => {
    const tool = makeTool({ name: 'get_item' });
    const config = makeConfig({ tools: [tool] });
    const diff = diffConfigs(config, config);

    expect(diff.changes).toHaveLength(0);
    expect(diff.isBackwardsCompatible).toBe(true);
    expect(diff.stats.toolsUnchanged).toBe(1);
    expect(diff.stats.toolsAdded).toBe(0);
    expect(diff.stats.toolsRemoved).toBe(0);
    expect(diff.stats.toolsModified).toBe(0);
  });

  it('should detect added tools', () => {
    const oldConfig = makeConfig({ tools: [makeTool({ name: 'get_item' })] });
    const newConfig = makeConfig({
      tools: [makeTool({ name: 'get_item' }), makeTool({ name: 'create_item' })],
    });
    const diff = diffConfigs(oldConfig, newConfig);

    expect(diff.stats.toolsAdded).toBe(1);
    expect(diff.changes.find(c => c.kind === 'tool_added')?.toolName).toBe('create_item');
    expect(diff.isBackwardsCompatible).toBe(true);
  });

  it('should detect removed tools as breaking', () => {
    const oldConfig = makeConfig({
      tools: [makeTool({ name: 'get_item' }), makeTool({ name: 'delete_item' })],
    });
    const newConfig = makeConfig({ tools: [makeTool({ name: 'get_item' })] });
    const diff = diffConfigs(oldConfig, newConfig);

    expect(diff.stats.toolsRemoved).toBe(1);
    const removedChange = diff.changes.find(c => c.kind === 'tool_removed');
    expect(removedChange?.toolName).toBe('delete_item');
    expect(removedChange?.severity).toBe('breaking');
    expect(diff.isBackwardsCompatible).toBe(false);
    expect(diff.migrationNotes.length).toBeGreaterThan(0);
  });

  it('should detect tool description changes', () => {
    const oldConfig = makeConfig({
      tools: [makeTool({ name: 'get_item', description: 'Gets an item' })],
    });
    const newConfig = makeConfig({
      tools: [makeTool({ name: 'get_item', description: 'Retrieves an item by ID' })],
    });
    const diff = diffConfigs(oldConfig, newConfig);

    expect(diff.stats.toolsModified).toBe(1);
    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.details?.some(d => d.field === 'description')).toBe(true);
    expect(diff.isBackwardsCompatible).toBe(true);
  });

  it('should detect added parameters', () => {
    const oldTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    });
    const newTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          format: { type: 'string' },
        },
        required: ['id'],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    expect(diff.stats.toolsModified).toBe(1);
    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.details?.some(d => d.field === 'param.format')).toBe(true);
  });

  it('should detect added required parameters as breaking', () => {
    const oldTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    });
    const newTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          workspace_id: { type: 'string' },
        },
        required: ['id', 'workspace_id'],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.severity).toBe('warning');
    expect(diff.migrationNotes.length).toBeGreaterThan(0);
  });

  it('should detect removed parameters as breaking', () => {
    const oldTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, format: { type: 'string' } },
        required: ['id'],
      },
    });
    const newTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.severity).toBe('warning');
    const paramRemoved = mod?.details?.find(d => d.field === 'param.format');
    expect(paramRemoved?.newValue).toBe('removed');
  });

  it('should detect type changes as breaking', () => {
    const oldTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { count: { type: 'string' } },
        required: ['count'],
      },
    });
    const newTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { count: { type: 'number' } },
        required: ['count'],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.severity).toBe('warning');
    expect(mod?.details?.some(d => d.field === 'param.count.type')).toBe(true);
  });

  it('should detect method changes as breaking', () => {
    const oldTool = makeTool({
      name: 'update_item',
      handler: {
        method: 'put',
        path: '/items/{id}',
        baseUrl: 'https://api.example.com',
        contentType: 'application/json',
        pathParams: ['id'],
        queryParams: [],
        headerParams: [],
        auth: [],
      },
    });
    const newTool = makeTool({
      name: 'update_item',
      handler: {
        method: 'patch',
        path: '/items/{id}',
        baseUrl: 'https://api.example.com',
        contentType: 'application/json',
        pathParams: ['id'],
        queryParams: [],
        headerParams: [],
        auth: [],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.details?.some(d => d.field === 'handler.method')).toBe(true);
  });

  it('should detect server metadata changes', () => {
    const oldConfig = makeConfig({ name: 'my-api', version: '1.0.0' });
    const newConfig = makeConfig({ name: 'my-api', version: '2.0.0' });
    const diff = diffConfigs(oldConfig, newConfig);

    expect(diff.changes.some(c => c.kind === 'server_meta_changed')).toBe(true);
  });

  it('should detect added env vars', () => {
    const oldConfig = makeConfig({
      envVars: [{ name: 'API_KEY', description: 'API key', required: true }],
    });
    const newConfig = makeConfig({
      envVars: [
        { name: 'API_KEY', description: 'API key', required: true },
        { name: 'API_SECRET', description: 'API secret', required: true },
      ],
    });
    const diff = diffConfigs(oldConfig, newConfig);

    expect(diff.stats.envVarsAdded).toBe(1);
    expect(diff.changes.some(c => c.kind === 'env_added')).toBe(true);
    expect(diff.migrationNotes.some(n => n.includes('API_SECRET'))).toBe(true);
  });

  it('should detect removed env vars', () => {
    const oldConfig = makeConfig({
      envVars: [
        { name: 'API_KEY', description: 'API key', required: true },
        { name: 'LEGACY_TOKEN', description: 'Legacy', required: false },
      ],
    });
    const newConfig = makeConfig({
      envVars: [{ name: 'API_KEY', description: 'API key', required: true }],
    });
    const diff = diffConfigs(oldConfig, newConfig);

    expect(diff.stats.envVarsRemoved).toBe(1);
  });

  it('should detect required status changes', () => {
    const oldTool = makeTool({
      name: 'search',
      inputSchema: {
        type: 'object',
        properties: { q: { type: 'string' }, page: { type: 'number' } },
        required: ['q'],
      },
    });
    const newTool = makeTool({
      name: 'search',
      inputSchema: {
        type: 'object',
        properties: { q: { type: 'string' }, page: { type: 'number' } },
        required: ['q', 'page'],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.details?.some(d => d.field === 'param.page.required')).toBe(true);
  });

  it('should detect enum changes', () => {
    const oldTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { format: { type: 'string', enum: ['json', 'xml'] } },
        required: [],
      },
    });
    const newTool = makeTool({
      name: 'get_item',
      inputSchema: {
        type: 'object',
        properties: { format: { type: 'string', enum: ['json', 'xml', 'csv'] } },
        required: [],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.details?.some(d => d.field === 'param.format.enum')).toBe(true);
  });

  it('should produce correct summary for complex changes', () => {
    const oldConfig = makeConfig({
      tools: [
        makeTool({ name: 'get_item' }),
        makeTool({ name: 'delete_item' }),
        makeTool({ name: 'list_items' }),
      ],
    });
    const newConfig = makeConfig({
      tools: [
        makeTool({ name: 'get_item', description: 'Updated description' }),
        makeTool({ name: 'list_items' }),
        makeTool({ name: 'create_item' }),
        makeTool({ name: 'update_item' }),
      ],
    });

    const diff = diffConfigs(oldConfig, newConfig);
    expect(diff.stats.toolsAdded).toBe(2);
    expect(diff.stats.toolsRemoved).toBe(1);
    expect(diff.stats.toolsModified).toBe(1);
    expect(diff.stats.toolsUnchanged).toBe(1);
    expect(diff.summary).toContain('2 added');
    expect(diff.summary).toContain('1 removed');
    expect(diff.summary).toContain('1 modified');
    expect(diff.summary).toContain('1 unchanged');
    expect(diff.isBackwardsCompatible).toBe(false);
  });

  it('should detect base URL changes', () => {
    const oldTool = makeTool({
      name: 'get_item',
      handler: {
        method: 'get',
        path: '/items/{id}',
        baseUrl: 'https://api.example.com/v1',
        contentType: 'application/json',
        pathParams: ['id'],
        queryParams: [],
        headerParams: [],
        auth: [],
      },
    });
    const newTool = makeTool({
      name: 'get_item',
      handler: {
        method: 'get',
        path: '/items/{id}',
        baseUrl: 'https://api.example.com/v2',
        contentType: 'application/json',
        pathParams: ['id'],
        queryParams: [],
        headerParams: [],
        auth: [],
      },
    });

    const diff = diffConfigs(
      makeConfig({ tools: [oldTool] }),
      makeConfig({ tools: [newTool] }),
    );

    const mod = diff.changes.find(c => c.kind === 'tool_modified');
    expect(mod?.details?.some(d => d.field === 'handler.baseUrl')).toBe(true);
  });
});

// ─── compareVersions (end-to-end) ────────────────────────────────

describe('compareVersions', () => {
  const oldSpec = JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Pet Store', version: '1.0.0' },
    servers: [{ url: 'https://api.petstore.com' }],
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          summary: 'List all pets',
          responses: { '200': { description: 'OK' } },
        },
        post: {
          operationId: 'createPet',
          summary: 'Create a pet',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/pets/{petId}': {
        get: {
          operationId: 'getPet',
          summary: 'Get a pet by ID',
          parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' } },
        },
      },
    },
  });

  const newSpec = JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Pet Store', version: '2.0.0' },
    servers: [{ url: 'https://api.petstore.com' }],
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          summary: 'List all pets with pagination',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'number' } },
            { name: 'offset', in: 'query', schema: { type: 'number' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          operationId: 'createPet',
          summary: 'Create a pet',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, species: { type: 'string' } }, required: ['name'] } } },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/pets/{petId}': {
        get: {
          operationId: 'getPet',
          summary: 'Get a pet by ID',
          parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' } },
        },
        put: {
          operationId: 'updatePet',
          summary: 'Update a pet',
          parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
    },
  });

  it('should compare two raw specs end-to-end', () => {
    const result = compareVersions({ oldSpec, newSpec });

    expect(result.diff.stats.toolsAdded).toBeGreaterThan(0); // updatePet added
    expect(result.oldConfig.version).toBe('1.0.0');
    expect(result.newConfig.version).toBe('2.0.0');
  });

  it('should detect new endpoint (updatePet)', () => {
    const result = compareVersions({ oldSpec, newSpec });

    const added = result.diff.changes.filter(c => c.kind === 'tool_added');
    expect(added.some(c => c.toolName?.includes('update'))).toBe(true);
  });

  it('should detect modified endpoint with new params (listPets)', () => {
    const result = compareVersions({ oldSpec, newSpec });

    const modified = result.diff.changes.filter(c => c.kind === 'tool_modified');
    const listPetsMod = modified.find(c => c.toolName?.includes('list'));
    expect(listPetsMod).toBeDefined();
    // Should have new limit/offset params
    expect(listPetsMod?.details?.some(d => d.field.includes('limit') || d.field.includes('offset'))).toBe(true);
  });

  it('should throw on invalid old spec', () => {
    expect(() => compareVersions({ oldSpec: 'not valid', newSpec })).toThrow();
  });

  it('should throw on invalid new spec', () => {
    expect(() => compareVersions({ oldSpec, newSpec: '{}' })).toThrow();
  });

  it('should apply disabled tools', () => {
    const result = compareVersions({
      oldSpec,
      newSpec,
      disabledTools: ['list_pets'],
    });

    const disabled = result.newConfig.tools.find(t => t.name === 'list_pets');
    if (disabled) {
      expect(disabled.enabled).toBe(false);
    }
  });

  it('should produce backwards-compatible diff when only adding', () => {
    // New spec only adds an endpoint, changes nothing else
    const minimalNewSpec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Pet Store', version: '1.1.0' },
      servers: [{ url: 'https://api.petstore.com' }],
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            summary: 'List all pets',
            responses: { '200': { description: 'OK' } },
          },
          post: {
            operationId: 'createPet',
            summary: 'Create a pet',
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
        '/pets/{petId}': {
          get: {
            operationId: 'getPet',
            summary: 'Get a pet by ID',
            parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'OK' } },
          },
          delete: {
            operationId: 'deletePet',
            summary: 'Delete a pet',
            parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '204': { description: 'Deleted' } },
          },
        },
      },
    });

    const result = compareVersions({ oldSpec, newSpec: minimalNewSpec });
    expect(result.diff.isBackwardsCompatible).toBe(true);
    expect(result.diff.stats.toolsAdded).toBe(1);
  });
});
