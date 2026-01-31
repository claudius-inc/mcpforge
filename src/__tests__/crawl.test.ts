import { describe, it, expect } from 'vitest';
import { validateUrl, isBlockedUrl, extractTextFromHtml, extractApiContent } from '../lib/crawler';

describe('URL Validation', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(validateUrl('https://docs.stripe.com/api')).toEqual({ valid: true });
    expect(validateUrl('https://api.github.com')).toEqual({ valid: true });
    expect(validateUrl('https://developer.twitter.com/en/docs')).toEqual({ valid: true });
  });

  it('accepts valid HTTP URLs', () => {
    expect(validateUrl('http://example.com/api/docs')).toEqual({ valid: true });
  });

  it('rejects empty/missing URLs', () => {
    expect(validateUrl('')).toMatchObject({ valid: false });
    expect(validateUrl('  ')).toMatchObject({ valid: false });
  });

  it('rejects non-HTTP protocols', () => {
    expect(validateUrl('ftp://example.com')).toMatchObject({ valid: false });
    expect(validateUrl('file:///etc/passwd')).toMatchObject({ valid: false });
    expect(validateUrl('javascript:alert(1)')).toMatchObject({ valid: false });
  });

  it('rejects URLs without protocol', () => {
    expect(validateUrl('docs.stripe.com/api')).toMatchObject({ valid: false, error: expect.stringContaining('http') });
  });

  it('rejects malformed URLs', () => {
    expect(validateUrl('https://')).toMatchObject({ valid: false });
    expect(validateUrl('https://   ')).toMatchObject({ valid: false });
  });
});

describe('SSRF Protection', () => {
  it('blocks localhost', () => {
    expect(isBlockedUrl('http://localhost')).toBe(true);
    expect(isBlockedUrl('http://localhost:3000')).toBe(true);
    expect(isBlockedUrl('https://LOCALHOST/api')).toBe(true);
  });

  it('blocks loopback', () => {
    expect(isBlockedUrl('http://127.0.0.1')).toBe(true);
    expect(isBlockedUrl('http://127.0.0.1:8080')).toBe(true);
  });

  it('blocks private networks (10.x)', () => {
    expect(isBlockedUrl('http://10.0.0.1')).toBe(true);
    expect(isBlockedUrl('http://10.255.255.255')).toBe(true);
  });

  it('blocks private networks (172.16-31.x)', () => {
    expect(isBlockedUrl('http://172.16.0.1')).toBe(true);
    expect(isBlockedUrl('http://172.31.255.255')).toBe(true);
  });

  it('blocks private networks (192.168.x)', () => {
    expect(isBlockedUrl('http://192.168.0.1')).toBe(true);
    expect(isBlockedUrl('http://192.168.1.100')).toBe(true);
  });

  it('blocks IPv6 loopback', () => {
    expect(isBlockedUrl('http://[::1]')).toBe(true);
  });

  it('blocks link-local', () => {
    expect(isBlockedUrl('http://169.254.169.254')).toBe(true); // AWS metadata
  });

  it('blocks non-HTTP protocols', () => {
    expect(isBlockedUrl('ftp://example.com')).toBe(true);
    expect(isBlockedUrl('file:///etc/passwd')).toBe(true);
  });

  it('allows public URLs', () => {
    expect(isBlockedUrl('https://docs.stripe.com')).toBe(false);
    expect(isBlockedUrl('https://api.github.com')).toBe(false);
    expect(isBlockedUrl('http://httpbin.org')).toBe(false);
  });
});

describe('HTML Text Extraction', () => {
  it('strips HTML tags and preserves text', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const text = extractTextFromHtml(html);
    expect(text).toContain('Hello');
    expect(text).toContain('world');
    expect(text).not.toContain('<p>');
    expect(text).not.toContain('<strong>');
  });

  it('removes script and style tags entirely', () => {
    const html = '<div>Content</div><script>alert("xss")</script><style>.x{color:red}</style><div>More</div>';
    const text = extractTextFromHtml(html);
    expect(text).toContain('Content');
    expect(text).toContain('More');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
  });

  it('preserves code blocks', () => {
    const html = '<pre><code>curl -X GET /api/users</code></pre>';
    const text = extractTextFromHtml(html);
    expect(text).toContain('```');
    expect(text).toContain('curl -X GET /api/users');
  });

  it('converts inline code', () => {
    const html = 'Use <code>GET /users</code> to list users';
    const text = extractTextFromHtml(html);
    expect(text).toContain('`GET /users`');
  });

  it('converts headings', () => {
    const html = '<h1>API Reference</h1><h2>Users</h2><h3>List Users</h3>';
    const text = extractTextFromHtml(html);
    expect(text).toContain('# API Reference');
    expect(text).toContain('## Users');
    expect(text).toContain('### List Users');
  });

  it('converts list items', () => {
    const html = '<ul><li>name (string)</li><li>email (string)</li></ul>';
    const text = extractTextFromHtml(html);
    expect(text).toContain('- name (string)');
    expect(text).toContain('- email (string)');
  });

  it('decodes HTML entities', () => {
    const html = '&amp; &lt;tag&gt; &quot;quoted&quot; &#39;apos&#39;';
    const text = extractTextFromHtml(html);
    expect(text).toContain('& <tag> "quoted" \'apos\'');
  });

  it('removes nav and footer', () => {
    const html = '<nav>Menu items</nav><main>API Content</main><footer>Copyright</footer>';
    const text = extractTextFromHtml(html);
    expect(text).not.toContain('Menu items');
    expect(text).toContain('API Content');
    expect(text).not.toContain('Copyright');
  });

  it('collapses excessive whitespace', () => {
    const html = '<p>Hello</p>\n\n\n\n\n\n<p>World</p>';
    const text = extractTextFromHtml(html);
    expect(text).not.toMatch(/\n{3,}/);
  });
});

describe('API Content Extraction', () => {
  it('extracts lines with HTTP methods', () => {
    const text = [
      'Welcome to our API',
      'GET /api/users - List all users',
      'Some filler content',
      'POST /api/users - Create a user',
      'Random paragraph about the company',
    ].join('\n');
    const extracted = extractApiContent(text);
    expect(extracted).toContain('GET /api/users');
    expect(extracted).toContain('POST /api/users');
  });

  it('extracts parameter descriptions', () => {
    const text = [
      'About us page content',
      '## Parameters',
      'name - string, required - The user name',
      'email - string, required - The email address',
      'A long unrelated paragraph...',
    ].join('\n');
    const extracted = extractApiContent(text);
    expect(extracted).toContain('Parameters');
    expect(extracted).toContain('name - string');
  });

  it('extracts lines with API paths', () => {
    const text = [
      'Intro text',
      'Base URL: https://api.example.com/v1/',
      'More filler',
      'Endpoint: /v1/projects/{id}',
    ].join('\n');
    const extracted = extractApiContent(text);
    expect(extracted).toContain('/v1/');
    expect(extracted).toContain('/v1/projects/{id}');
  });

  it('extracts authorization-related lines', () => {
    const text = [
      'Getting started',
      'Authorization: Bearer YOUR_API_KEY',
      'Unrelated paragraph',
      'Add the api_key header to all requests',
    ].join('\n');
    const extracted = extractApiContent(text);
    expect(extracted).toContain('Authorization: Bearer');
    expect(extracted).toContain('api_key');
  });

  it('preserves code blocks near API content', () => {
    const text = [
      'Some intro',
      '```',
      'curl -X GET https://api.example.com/users',
      '```',
      'Response:',
      '```',
      '{"users": []}',
      '```',
    ].join('\n');
    const extracted = extractApiContent(text);
    expect(extracted).toContain('curl -X GET');
    expect(extracted).toContain('{"users": []}');
  });

  it('returns original text if no API content detected', () => {
    const text = 'This is a blog post about cats. Cats are great. Meow.';
    const extracted = extractApiContent(text);
    // When extracted content is < 200 chars, returns original
    expect(extracted).toBe(text);
  });

  it('keeps context lines near API sections', () => {
    const text = [
      'POST /api/users',
      'Creates a new user account.',
      'Required fields:',
      'name: The display name',
      'email: A valid email',
    ].join('\n');
    const extracted = extractApiContent(text);
    expect(extracted).toContain('Creates a new user account');
    expect(extracted).toContain('name: The display name');
  });
});

describe('Edge Cases', () => {
  it('handles empty HTML gracefully', () => {
    const text = extractTextFromHtml('');
    expect(text).toBe('');
  });

  it('handles HTML with only scripts', () => {
    const html = '<html><head><script>var x = 1;</script></head><body><script>app.init()</script></body></html>';
    const text = extractTextFromHtml(html);
    expect(text).not.toContain('var x');
    expect(text).not.toContain('app.init');
  });

  it('handles deeply nested HTML', () => {
    const html = '<div><div><div><div><p>Deep content</p></div></div></div></div>';
    const text = extractTextFromHtml(html);
    expect(text).toContain('Deep content');
  });

  it('handles malformed HTML', () => {
    const html = '<p>Unclosed <b>bold <i>and italic</p>';
    const text = extractTextFromHtml(html);
    expect(text).toContain('Unclosed');
    expect(text).toContain('bold');
  });

  it('extractApiContent handles empty input', () => {
    const result = extractApiContent('');
    expect(result).toBe('');
  });

  it('URL validation rejects null-ish values', () => {
    // @ts-expect-error testing runtime behavior
    expect(validateUrl(null)).toMatchObject({ valid: false });
    // @ts-expect-error testing runtime behavior
    expect(validateUrl(undefined)).toMatchObject({ valid: false });
  });
});
