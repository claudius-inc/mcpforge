import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateDescription, generateSpecFromDescription } from '../lib/ai/spec-generator';

// ─── validateDescription ───────────────────────────────────────────────

describe('validateDescription', () => {
  it('rejects empty string', () => {
    expect(validateDescription('')).toEqual({ valid: false, error: 'Description is required.' });
  });

  it('rejects whitespace-only', () => {
    expect(validateDescription('   ')).toEqual({ valid: false, error: 'Description is required.' });
  });

  it('rejects too-short descriptions', () => {
    expect(validateDescription('hi')).toEqual({
      valid: false,
      error: 'Description too short. Please describe what the API should do.',
    });
  });

  it('rejects descriptions over 5000 chars', () => {
    const long = 'a'.repeat(5001);
    expect(validateDescription(long)).toEqual({
      valid: false,
      error: 'Description too long (max 5000 characters).',
    });
  });

  it('accepts valid descriptions', () => {
    expect(validateDescription('A weather API that gets forecasts for cities')).toEqual({ valid: true });
  });

  it('accepts description at exactly 5000 chars', () => {
    const exact = 'a'.repeat(5000);
    expect(validateDescription(exact)).toEqual({ valid: true });
  });

  it('accepts description at exactly 10 chars', () => {
    expect(validateDescription('a'.repeat(10))).toEqual({ valid: true });
  });
});

// ─── generateSpecFromDescription ───────────────────────────────────────

describe('generateSpecFromDescription', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns error when no API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await generateSpecFromDescription({ description: 'A test API' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('API key');
  });

  it('returns error for empty description', async () => {
    const result = await generateSpecFromDescription({
      description: '',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('returns error for too-long description', async () => {
    const result = await generateSpecFromDescription({
      description: 'x'.repeat(5001),
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('handles API 401 gracefully', async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error('Incorrect API key'), { status: 401 })
    );
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    // Re-import to use mocked module
    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API',
      apiKey: 'bad-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid API key');
  });

  it('handles rate limit (429) gracefully', async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error('Rate limited'), { status: 429 })
    );
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limited');
  });

  it('handles connection errors gracefully', async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })
    );
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot reach AI provider');
  });

  it('rejects non-OpenAPI JSON response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"foo": "bar"}' } }],
      model: 'gpt-4o-mini',
    });
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not appear to be an OpenAPI spec');
  });

  it('rejects spec with no paths', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"openapi": "3.0.3", "info": {}, "paths": {}}' } }],
      model: 'gpt-4o-mini',
    });
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('no endpoints');
  });

  it('handles empty AI response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: null } }],
      model: 'gpt-4o-mini',
    });
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty response');
  });

  it('handles invalid JSON from AI', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'This is not JSON at all' } }],
      model: 'gpt-4o-mini',
    });
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('invalid JSON');
  });

  it('succeeds with valid OpenAPI response', async () => {
    const validSpec = {
      openapi: '3.0.3',
      info: { title: 'Weather API', version: '1.0.0' },
      paths: {
        '/weather': {
          get: {
            operationId: 'getWeather',
            summary: 'Get weather',
            parameters: [{ name: 'city', in: 'query', schema: { type: 'string' } }],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validSpec) } }],
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    });
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'A weather API that gets current weather for any city',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(true);
    expect(result.spec).toBeDefined();
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.usage).toEqual({ prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 });

    // Verify the spec is valid JSON
    const parsed = JSON.parse(result.spec!);
    expect(parsed.openapi).toBe('3.0.3');
    expect(parsed.paths['/weather']).toBeDefined();
  });

  it('also accepts swagger field as valid spec', async () => {
    const swaggerSpec = {
      swagger: '2.0',
      info: { title: 'Old API', version: '1.0.0' },
      paths: { '/test': { get: { responses: { '200': { description: 'OK' } } } } },
    };
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(swaggerSpec) } }],
      model: 'gpt-4o-mini',
    });
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    const result = await genFn({
      description: 'An old API with swagger format',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(true);
  });

  it('passes custom model and baseUrl', async () => {
    let capturedConfig: Record<string, unknown> | undefined;
    let capturedCreateArgs: unknown[] | undefined;
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            openapi: '3.0.3',
            info: { title: 'Test', version: '1.0.0' },
            paths: { '/test': { get: { responses: { '200': { description: 'OK' } } } } },
          }),
        },
      }],
      model: 'custom-model',
    });
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
        constructor(config: Record<string, unknown>) { capturedConfig = config; }
      },
    }));

    const { generateSpecFromDescription: genFn } = await import('../lib/ai/spec-generator');
    await genFn({
      description: 'A test API for custom config',
      apiKey: 'custom-key',
      baseUrl: 'https://my-llm.example.com/v1',
      model: 'my-model',
    });

    expect(capturedConfig?.apiKey).toBe('custom-key');
    expect(capturedConfig?.baseURL).toBe('https://my-llm.example.com/v1');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'my-model' })
    );
  });
});
