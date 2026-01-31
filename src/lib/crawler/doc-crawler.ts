import OpenAI from 'openai';

/**
 * API Documentation Crawler
 * Fetches docs from a URL, extracts API-relevant content, and uses AI
 * to generate a valid OpenAPI spec from the extracted text.
 */

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

export function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    return BLOCKED_HOSTS.some(pattern => pattern.test(parsed.hostname));
  } catch {
    return true;
  }
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || !url.trim()) return { valid: false, error: 'URL is required.' };

  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }

  try {
    new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  if (isBlockedUrl(trimmed)) {
    return { valid: false, error: 'Cannot crawl private or internal network addresses.' };
  }

  return { valid: true };
}

/**
 * Strip HTML tags and extract meaningful text content.
 * Preserves code blocks, headings, and list structure.
 */
export function extractTextFromHtml(html: string): string {
  let text = html;

  // Remove script, style, nav, footer, svg tags entirely
  text = text.replace(/<(script|style|nav|footer|svg|head|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Convert code blocks to preserved sections
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n#### $1\n');

  // Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

  // Convert table cells
  text = text.replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '| $1 ');
  text = text.replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '| $1 ');
  text = text.replace(/<tr[^>]*>/gi, '\n');

  // Convert paragraphs and divs to newlines
  text = text.replace(/<\/(p|div|section|article|tr)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Extract API-relevant sections from text.
 * Prioritizes endpoint definitions, parameters, request/response examples.
 */
export function extractApiContent(text: string): string {
  const lines = text.split('\n');
  const apiLines: string[] = [];
  let inRelevantSection = false;
  let sectionBuffer: string[] = [];
  let consecutiveIrrelevant = 0;

  // API-relevant patterns
  const endpointPattern = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/?[\w\/\{\}\-\.]+/i;
  const urlPattern = /\/(v\d+|api)\//i;
  const paramPattern = /\b(parameter|query|header|body|path|request|response|payload|schema|field|attribute|property)\b/i;
  const codeBlockPattern = /^```/;
  const httpPattern = /\b(HTTP\/\d|status\s*code|content-type|authorization|bearer|api[_-]?key|oauth|endpoint|curl|header)\b/i;
  const headingPattern = /^#+\s/;

  for (const line of lines) {
    const isApiRelevant =
      endpointPattern.test(line) ||
      urlPattern.test(line) ||
      paramPattern.test(line) ||
      codeBlockPattern.test(line) ||
      httpPattern.test(line);

    if (isApiRelevant || (headingPattern.test(line) && (paramPattern.test(line) || httpPattern.test(line)))) {
      if (sectionBuffer.length > 0 && consecutiveIrrelevant < 5) {
        apiLines.push(...sectionBuffer);
        sectionBuffer = [];
      }
      apiLines.push(line);
      inRelevantSection = true;
      consecutiveIrrelevant = 0;
    } else if (inRelevantSection) {
      consecutiveIrrelevant++;
      if (consecutiveIrrelevant < 8) {
        // Keep context lines near API sections
        sectionBuffer.push(line);
      } else {
        inRelevantSection = false;
        sectionBuffer = [];
        consecutiveIrrelevant = 0;
      }
    }
  }

  // If we found API content, use it; otherwise return original (AI will handle it)
  const extracted = apiLines.join('\n').trim();
  return extracted.length > 200 ? extracted : text;
}

const CRAWL_SYSTEM_PROMPT = `You are an expert API architect. Given extracted text from API documentation, you generate a complete, valid OpenAPI 3.0.3 specification in JSON format.

RULES:
1. Output ONLY valid JSON — no markdown fences, no explanation, no commentary.
2. The spec MUST be a valid OpenAPI 3.0.3 document.
3. Extract every API endpoint mentioned in the documentation.
4. Preserve exact endpoint paths, HTTP methods, parameters, and descriptions from the docs.
5. Include appropriate request/response schemas based on the documented fields.
6. If the docs mention authentication (API keys, OAuth, Bearer tokens), include proper securitySchemes.
7. Use operationId for every endpoint (camelCase, descriptive).
8. Preserve parameter names, types, and required/optional status from the docs.
9. Use the base URL from the documentation if mentioned. Otherwise use https://api.example.com.
10. Include pagination parameters if documented.
11. Map documented status codes to response definitions.
12. Use $ref for repeated schemas when it reduces duplication.
13. If the documentation is unclear about a field type, make a reasonable inference.
14. Include the API title and description from the documentation.

RESPONSE FORMAT: Raw JSON only. The entire response must be parseable as JSON.`;

export interface CrawlResult {
  success: boolean;
  spec?: string;
  error?: string;
  model?: string;
  pageTitle?: string;
  extractedLength?: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface CrawlOptions {
  url: string;
  additionalContext?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Fetch a docs page, extract API content, and generate an OpenAPI spec via AI.
 */
export async function crawlDocsToSpec(options: CrawlOptions): Promise<CrawlResult> {
  const {
    url,
    additionalContext,
    apiKey = process.env.OPENAI_API_KEY,
    baseUrl = process.env.OPENAI_BASE_URL || undefined,
    model = process.env.MCPFORGE_AI_MODEL || 'gpt-4o-mini',
  } = options;

  if (!apiKey) {
    return { success: false, error: 'No API key configured. Set OPENAI_API_KEY environment variable.' };
  }

  // Validate URL
  const urlCheck = validateUrl(url);
  if (!urlCheck.valid) {
    return { success: false, error: urlCheck.error };
  }

  // Fetch the page
  let html: string;
  let pageTitle = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MCPForge-Crawler/1.0 (API documentation parser)',
        'Accept': 'text/html, application/json, text/plain',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Failed to fetch URL: HTTP ${res.status} ${res.statusText}` };
    }

    const contentType = res.headers.get('content-type') || '';

    // If it's already an OpenAPI spec (JSON or YAML), return it directly
    if (contentType.includes('json') || url.endsWith('.json')) {
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed.openapi || parsed.swagger) {
          return {
            success: true,
            spec: JSON.stringify(parsed, null, 2),
            pageTitle: parsed.info?.title || 'Imported Spec',
            extractedLength: text.length,
          };
        }
      } catch {
        // Not valid JSON, treat as text
      }
      html = text;
    } else if (contentType.includes('yaml') || url.endsWith('.yaml') || url.endsWith('.yml')) {
      const text = await res.text();
      // Check if it looks like an OpenAPI spec
      if (text.includes('openapi:') || text.includes('swagger:')) {
        return {
          success: true,
          spec: text,
          pageTitle: 'Imported YAML Spec',
          extractedLength: text.length,
        };
      }
      html = text;
    } else {
      html = await res.text();
    }

    // Limit size (2MB max)
    if (html.length > 2_000_000) {
      html = html.slice(0, 2_000_000);
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1].replace(/\s+/g, ' ').trim();

  } catch (err) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 30 seconds.' };
    }
    return { success: false, error: `Failed to fetch URL: ${error.message}` };
  }

  // Extract text from HTML
  const text = extractTextFromHtml(html);
  if (text.length < 50) {
    return { success: false, error: 'Page has too little content. The URL may require JavaScript rendering or authentication.' };
  }

  // Focus on API-relevant content
  const apiContent = extractApiContent(text);

  // Truncate to fit context window (keep under ~12k chars for the AI)
  const maxContentLen = 12000;
  const truncatedContent = apiContent.length > maxContentLen
    ? apiContent.slice(0, maxContentLen) + '\n\n[... content truncated ...]'
    : apiContent;

  // Build AI prompt
  let userPrompt = `Extract all API endpoints from the following documentation and generate a complete OpenAPI 3.0.3 spec.\n\n`;
  userPrompt += `Source: ${url}\n`;
  if (pageTitle) userPrompt += `Page title: ${pageTitle}\n`;
  userPrompt += `\n--- DOCUMENTATION CONTENT ---\n${truncatedContent}\n--- END ---`;

  if (additionalContext) {
    userPrompt += `\n\nAdditional context from user:\n${additionalContext}`;
  }

  // Call AI
  const client = new OpenAI({ apiKey, baseURL: baseUrl });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: CRAWL_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'AI returned empty response.' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, error: 'AI returned invalid JSON. The documentation may be too complex — try a more specific page.' };
    }

    if (!parsed.openapi && !parsed.swagger) {
      return { success: false, error: 'AI could not extract an API structure from this page. Try a page with endpoint documentation.' };
    }

    if (!parsed.paths || typeof parsed.paths !== 'object' || Object.keys(parsed.paths as object).length === 0) {
      return { success: false, error: 'No API endpoints found in the documentation. Try a page that lists specific endpoints.' };
    }

    return {
      success: true,
      spec: JSON.stringify(parsed, null, 2),
      model: completion.model,
      pageTitle,
      extractedLength: truncatedContent.length,
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

    if (error.status === 401) return { success: false, error: 'Invalid API key. Check your OPENAI_API_KEY.' };
    if (error.status === 429) return { success: false, error: 'Rate limited. Please try again in a moment.' };
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { success: false, error: 'Cannot reach AI provider. Check your network or OPENAI_BASE_URL.' };
    }

    return { success: false, error: `AI error: ${error.message}` };
  }
}
