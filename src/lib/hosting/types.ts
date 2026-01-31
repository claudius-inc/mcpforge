// Hosting provider types for MCPForge server deployment

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'deploying';
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown' | 'degraded';
export type ProviderType = 'docker' | 'flyio' | 'railway';

export interface ServerConfig {
  id: string;
  name: string;
  slug: string;
  language: 'typescript' | 'python';
  envVars: Record<string, string>;
  autoRestart: boolean;
  generatedCode: string; // The generated MCP server source
  specSnapshot: string;  // Original OpenAPI spec
}

export interface DeployResult {
  providerId: string;       // Provider-specific deployment ID
  endpointUrl: string;      // MCP server endpoint URL
  status: ServerStatus;
  logs?: string[];
}

export interface ServerInfo {
  providerId: string;
  status: ServerStatus;
  health: HealthStatus;
  uptime?: number;          // Seconds since last start
  memory?: number;          // MB used
  cpu?: number;             // Percentage
  lastError?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsSnapshot {
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  topTools: { name: string; calls: number }[];
  errorRate: number;
}

/**
 * Abstract deployment provider interface.
 * Implementations: DockerProvider (local dev), FlyioProvider, RailwayProvider
 */
export interface DeploymentProvider {
  readonly type: ProviderType;

  /** Deploy a new MCP server instance */
  deploy(config: ServerConfig): Promise<DeployResult>;

  /** Start a stopped server */
  start(providerId: string): Promise<void>;

  /** Stop a running server */
  stop(providerId: string): Promise<void>;

  /** Get current server info */
  info(providerId: string): Promise<ServerInfo>;

  /** Stream recent logs */
  logs(providerId: string, lines?: number): Promise<LogEntry[]>;

  /** Destroy the deployment entirely */
  destroy(providerId: string): Promise<void>;

  /** Update environment variables (hot reload if possible) */
  updateEnv(providerId: string, envVars: Record<string, string>): Promise<void>;

  /** Redeploy with new code (new version) */
  redeploy(providerId: string, config: ServerConfig): Promise<DeployResult>;

  /** Health check */
  healthCheck(providerId: string): Promise<HealthStatus>;
}
