// Hosting module — provider registry + server management helpers

export type { 
  ServerStatus, HealthStatus, ProviderType, ServerConfig,
  DeployResult, ServerInfo, LogEntry, AnalyticsSnapshot,
  DeploymentProvider 
} from './types';

export { DockerProvider } from './docker-provider';

import type { DeploymentProvider, ProviderType } from './types';
import { DockerProvider } from './docker-provider';

let _provider: DeploymentProvider | null = null;

/**
 * Get the active deployment provider.
 * Defaults to Docker for local dev. Configure via MCPFORGE_PROVIDER env var.
 */
export function getProvider(): DeploymentProvider {
  if (!_provider) {
    const providerType = (process.env.MCPFORGE_PROVIDER || 'docker') as ProviderType;
    switch (providerType) {
      case 'docker':
        _provider = new DockerProvider();
        break;
      case 'flyio':
        // TODO: FlyioProvider when accounts are set up
        throw new Error('Fly.io provider not yet implemented — set MCPFORGE_PROVIDER=docker');
      case 'railway':
        // TODO: RailwayProvider
        throw new Error('Railway provider not yet implemented — set MCPFORGE_PROVIDER=docker');
      default:
        _provider = new DockerProvider();
    }
  }
  return _provider;
}

/**
 * Generate a URL-safe slug from a server name.
 */
export function generateSlug(name: string, userId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const suffix = userId.slice(0, 6);
  return `${base}-${suffix}`;
}

/**
 * Validate a server name.
 */
export function validateServerName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Server name is required' };
  }
  if (name.length < 2) {
    return { valid: false, error: 'Server name must be at least 2 characters' };
  }
  if (name.length > 64) {
    return { valid: false, error: 'Server name must be under 64 characters' };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(name)) {
    return { valid: false, error: 'Server name must start with alphanumeric and contain only letters, numbers, spaces, hyphens, underscores' };
  }
  return { valid: true };
}
