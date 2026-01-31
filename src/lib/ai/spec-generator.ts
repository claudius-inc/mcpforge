import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert API architect. Given a plain English description of what an MCP (Model Context Protocol) server should do, you generate a complete, valid OpenAPI 3.0.3 specification in JSON format.

RULES:
1. Output ONLY valid JSON — no markdown fences, no explanation, no commentary.
2. The spec MUST be a valid OpenAPI 3.0.3 document.
3. Include realistic endpoints with proper HTTP methods (GET for reads, POST for creates, PUT/PATCH for updates, DELETE for deletes).
4. Include appropriate request/response schemas with realistic field names and types.
5. Include proper parameter definitions (path, query, header) where appropriate.
6. Use operationId for every endpoint (camelCase, descriptive).
7. Add meaningful descriptions to endpoints and parameters.
8. If the user mentions authentication (API keys, OAuth, tokens), include appropriate securitySchemes.
9. If auth is implied (e.g., "GitHub API"), add a reasonable auth scheme (Bearer token for most APIs).
10. Use a reasonable base URL. For well-known APIs, use the real base URL. For custom APIs, use https://api.example.com.
11. Include common patterns: pagination (limit/offset or page/per_page), filtering, sorting where appropriate.
12. Keep the spec focused — generate the endpoints the user asked for, don't add unrelated ones.
13. Use $ref for repeated schemas when it reduces duplication.
14. Include realistic example values in schema descriptions where helpful.

RESPONSE FORMAT: Raw JSON only. The entire response must be parseable as JSON.`;

export interface DescribeResult {
  success: boolean;
  spec?: string;
  error?: string;
  model?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface DescribeOptions {
  description: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Generate an OpenAPI spec from a plain English description using AI.
 */
export async function generateSpecFromDescription(options: DescribeOptions): Promise<DescribeResult> {
  const {
    description,
    apiKey = process.env.OPENAI_API_KEY,
    baseUrl = process.env.OPENAI_BASE_URL || undefined,
    model = process.env.MCPFORGE_AI_MODEL || 'gpt-4o-mini',
  } = options;

  if (!apiKey) {
    return { success: false, error: 'No API key configured. Set OPENAI_API_KEY environment variable.' };
  }

  if (!description.trim()) {
    return { success: false, error: 'Description cannot be empty.' };
  }

  if (description.length > 5000) {
    return { success: false, error: 'Description too long (max 5000 characters).' };
  }

  const client = new OpenAI({ apiKey, baseURL: baseUrl });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: description },
      ],
      temperature: 0.3,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'AI returned empty response.' };
    }

    // Validate it's parseable JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, error: 'AI returned invalid JSON. Please try again.' };
    }

    // Basic sanity check: must look like an OpenAPI spec
    if (!parsed.openapi && !parsed.swagger) {
      return { success: false, error: 'AI response does not appear to be an OpenAPI spec. Please try rephrasing.' };
    }

    if (!parsed.paths || typeof parsed.paths !== 'object' || Object.keys(parsed.paths as object).length === 0) {
      return { success: false, error: 'Generated spec has no endpoints. Please provide more detail about what the API should do.' };
    }

    return {
      success: true,
      spec: JSON.stringify(parsed, null, 2),
      model: completion.model,
      usage: completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  } catch (err) {
    const error = err as Error & { status?: number; code?: string };

    if (error.status === 401) {
      return { success: false, error: 'Invalid API key. Check your OPENAI_API_KEY.' };
    }
    if (error.status === 429) {
      return { success: false, error: 'Rate limited. Please try again in a moment.' };
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { success: false, error: 'Cannot reach AI provider. Check your network or OPENAI_BASE_URL.' };
    }

    return { success: false, error: `AI error: ${error.message}` };
  }
}

/**
 * Validate that a description is reasonable before sending to AI.
 */
export function validateDescription(description: string): { valid: boolean; error?: string } {
  const trimmed = description.trim();
  if (!trimmed) return { valid: false, error: 'Description is required.' };
  if (trimmed.length < 10) return { valid: false, error: 'Description too short. Please describe what the API should do.' };
  if (trimmed.length > 5000) return { valid: false, error: 'Description too long (max 5000 characters).' };

  // Basic check: does it seem like it's describing an API/server?
  // We're lenient here — the AI will figure out intent
  return { valid: true };
}
