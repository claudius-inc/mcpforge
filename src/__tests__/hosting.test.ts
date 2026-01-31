import { describe, it, expect, beforeEach } from 'vitest';
import { generateSlug, validateServerName } from '../lib/hosting';

describe('generateSlug', () => {
  it('converts name to URL-safe slug with user suffix', () => {
    const slug = generateSlug('My Weather API', 'abc123def456');
    expect(slug).toBe('my-weather-api-abc123');
  });

  it('strips special characters', () => {
    const slug = generateSlug('GitHub API (v3)', 'user00');
    expect(slug).toBe('github-api-v3-user00');
  });

  it('handles consecutive special chars', () => {
    const slug = generateSlug('API---Test...Server', 'xyz789');
    expect(slug).toBe('api-test-server-xyz789');
  });

  it('truncates long names to 40 chars', () => {
    const longName = 'A'.repeat(60);
    const slug = generateSlug(longName, 'user00');
    // Base (truncated to 40) + '-' + suffix (6)
    expect(slug.length).toBeLessThanOrEqual(47);
    expect(slug).toContain('user00');
  });

  it('handles leading/trailing special chars', () => {
    const slug = generateSlug('---api-name---', 'abc123');
    expect(slug).toBe('api-name-abc123');
  });

  it('handles single word', () => {
    const slug = generateSlug('weather', 'usr111');
    expect(slug).toBe('weather-usr111');
  });

  it('handles numbers in name', () => {
    const slug = generateSlug('v2 api 3000', 'u12345');
    expect(slug).toBe('v2-api-3000-u12345');
  });
});

describe('validateServerName', () => {
  it('accepts valid names', () => {
    expect(validateServerName('My Server').valid).toBe(true);
    expect(validateServerName('api-proxy').valid).toBe(true);
    expect(validateServerName('test_server_01').valid).toBe(true);
    expect(validateServerName('A1').valid).toBe(true);
  });

  it('rejects empty names', () => {
    const result = validateServerName('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects too short names', () => {
    const result = validateServerName('A');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2 characters');
  });

  it('rejects too long names', () => {
    const result = validateServerName('A'.repeat(65));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('64');
  });

  it('rejects names starting with special chars', () => {
    expect(validateServerName('-api').valid).toBe(false);
    expect(validateServerName('_api').valid).toBe(false);
    expect(validateServerName(' api').valid).toBe(false);
  });

  it('rejects names with invalid characters', () => {
    expect(validateServerName('api@server').valid).toBe(false);
    expect(validateServerName('api!server').valid).toBe(false);
    expect(validateServerName('api/server').valid).toBe(false);
  });
});

describe('ServerStatus types', () => {
  it('all status values are expected strings', () => {
    const validStatuses = ['stopped', 'starting', 'running', 'stopping', 'error', 'deploying'];
    for (const status of validStatuses) {
      expect(typeof status).toBe('string');
    }
  });
});

describe('DockerProvider structure', () => {
  it('exports DockerProvider class', async () => {
    const { DockerProvider } = await import('../lib/hosting/docker-provider');
    const provider = new DockerProvider();
    expect(provider.type).toBe('docker');
  });

  it('has all required methods', async () => {
    const { DockerProvider } = await import('../lib/hosting/docker-provider');
    const provider = new DockerProvider();
    expect(typeof provider.deploy).toBe('function');
    expect(typeof provider.start).toBe('function');
    expect(typeof provider.stop).toBe('function');
    expect(typeof provider.info).toBe('function');
    expect(typeof provider.logs).toBe('function');
    expect(typeof provider.destroy).toBe('function');
    expect(typeof provider.updateEnv).toBe('function');
    expect(typeof provider.redeploy).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
  });

  it('info throws for unknown server', async () => {
    const { DockerProvider } = await import('../lib/hosting/docker-provider');
    const provider = new DockerProvider();
    await expect(provider.info('nonexistent')).rejects.toThrow('Server not found');
  });

  it('stop throws for unknown server', async () => {
    const { DockerProvider } = await import('../lib/hosting/docker-provider');
    const provider = new DockerProvider();
    await expect(provider.stop('nonexistent')).rejects.toThrow('Server not found');
  });

  it('logs throws for unknown server', async () => {
    const { DockerProvider } = await import('../lib/hosting/docker-provider');
    const provider = new DockerProvider();
    await expect(provider.logs('nonexistent')).rejects.toThrow('Server not found');
  });

  it('healthCheck returns unknown for non-existent server', async () => {
    const { DockerProvider } = await import('../lib/hosting/docker-provider');
    const provider = new DockerProvider();
    const result = await provider.healthCheck('nonexistent');
    expect(result).toBe('unknown');
  });
});

describe('getProvider', () => {
  it('returns DockerProvider by default', async () => {
    const { getProvider } = await import('../lib/hosting');
    // May throw if called with flyio/railway, but docker should work
    // Note: getProvider uses a singleton, so we test the type
    const provider = getProvider();
    expect(provider.type).toBe('docker');
  });
});

describe('Schema extensions', () => {
  it('schema SQL contains server tables', async () => {
    const { SCHEMA_SQL } = await import('../lib/db/schema');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS servers');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS server_env_vars');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS server_logs');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS server_analytics');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS server_versions');
  });

  it('schema has proper indexes', async () => {
    const { SCHEMA_SQL } = await import('../lib/db/schema');
    expect(SCHEMA_SQL).toContain('idx_servers_user');
    expect(SCHEMA_SQL).toContain('idx_servers_slug');
    expect(SCHEMA_SQL).toContain('idx_server_logs_server');
    expect(SCHEMA_SQL).toContain('idx_server_analytics_server');
    expect(SCHEMA_SQL).toContain('idx_server_versions_server');
  });

  it('servers table has required columns', async () => {
    const { SCHEMA_SQL } = await import('../lib/db/schema');
    const serverSection = SCHEMA_SQL.split('CREATE TABLE IF NOT EXISTS servers')[1].split(');')[0];
    expect(serverSection).toContain('user_id');
    expect(serverSection).toContain('name');
    expect(serverSection).toContain('slug');
    expect(serverSection).toContain('status');
    expect(serverSection).toContain('language');
    expect(serverSection).toContain('provider_id');
    expect(serverSection).toContain('endpoint_url');
    expect(serverSection).toContain('health_status');
    expect(serverSection).toContain('auto_restart');
    expect(serverSection).toContain('visibility');
  });
});
