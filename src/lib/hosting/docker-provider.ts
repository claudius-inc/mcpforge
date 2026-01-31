// Docker-based deployment provider for local development and self-hosted MCPForge
// Uses child_process to manage Node.js/Python MCP server processes

import { execSync, spawn, type ChildProcess } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  type DeploymentProvider,
  type ServerConfig,
  type DeployResult,
  type ServerInfo,
  type LogEntry,
  type HealthStatus,
  type ServerStatus,
} from './types';

const SERVERS_DIR = process.env.MCPFORGE_SERVERS_DIR || '/tmp/mcpforge-servers';

interface ManagedProcess {
  process: ChildProcess | null;
  config: ServerConfig;
  status: ServerStatus;
  startedAt: number | null;
  logs: LogEntry[];
  port: number;
  lastError?: string;
}

// In-memory process registry (for the docker/process provider)
const processes = new Map<string, ManagedProcess>();

let nextPort = 9100;

function allocatePort(): number {
  return nextPort++;
}

function getServerDir(providerId: string): string {
  return join(SERVERS_DIR, providerId);
}

function addLog(managed: ManagedProcess, level: LogEntry['level'], message: string, metadata?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };
  managed.logs.push(entry);
  // Keep last 1000 log entries in memory
  if (managed.logs.length > 1000) {
    managed.logs = managed.logs.slice(-1000);
  }
}

function scaffoldServer(config: ServerConfig, serverDir: string, port: number): void {
  mkdirSync(serverDir, { recursive: true });

  if (config.language === 'typescript') {
    // Write the generated MCP server code
    writeFileSync(join(serverDir, 'server.ts'), config.generatedCode);

    // Write package.json
    writeFileSync(join(serverDir, 'package.json'), JSON.stringify({
      name: `mcpforge-server-${config.slug}`,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        start: 'npx tsx server.ts',
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0',
        'tsx': '^4.0.0',
      },
    }, null, 2));

    // Write .env file
    const envContent = Object.entries(config.envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    writeFileSync(join(serverDir, '.env'), `PORT=${port}\nMCP_TRANSPORT=sse\n${envContent}`);

  } else {
    // Python server
    writeFileSync(join(serverDir, 'server.py'), config.generatedCode);

    writeFileSync(join(serverDir, 'requirements.txt'), [
      'mcp>=1.0.0',
      'httpx>=0.24.0',
      'uvicorn>=0.20.0',
    ].join('\n'));

    const envContent = Object.entries(config.envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    writeFileSync(join(serverDir, '.env'), `PORT=${port}\nMCP_TRANSPORT=sse\n${envContent}`);
  }

  // Store spec snapshot
  writeFileSync(join(serverDir, 'openapi-spec.json'), config.specSnapshot);
}

function startProcess(providerId: string, managed: ManagedProcess): void {
  const serverDir = getServerDir(providerId);
  const port = managed.port;

  let cmd: string;
  let args: string[];

  if (managed.config.language === 'typescript') {
    cmd = 'npx';
    args = ['tsx', 'server.ts'];
  } else {
    cmd = 'python3';
    args = ['server.py'];
  }

  addLog(managed, 'info', `Starting server on port ${port}`, { cmd, args });

  const child = spawn(cmd, args, {
    cwd: serverDir,
    env: {
      ...process.env,
      ...managed.config.envVars,
      PORT: String(port),
      MCP_TRANSPORT: 'sse',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) addLog(managed, 'info', msg);
  });

  child.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) addLog(managed, 'error', msg);
  });

  child.on('exit', (code, signal) => {
    addLog(managed, code === 0 ? 'info' : 'error', `Process exited`, { code, signal });
    managed.status = code === 0 ? 'stopped' : 'error';
    managed.process = null;
    if (code !== 0) {
      managed.lastError = `Exited with code ${code} (signal: ${signal})`;
    }

    // Auto-restart on crash if enabled
    if (managed.config.autoRestart && code !== 0 && managed.status === 'error') {
      addLog(managed, 'info', 'Auto-restarting in 5 seconds...');
      setTimeout(() => {
        if (processes.has(providerId) && managed.status === 'error') {
          managed.status = 'starting';
          startProcess(providerId, managed);
        }
      }, 5000);
    }
  });

  managed.process = child;
  managed.status = 'running';
  managed.startedAt = Date.now();
}

export class DockerProvider implements DeploymentProvider {
  readonly type = 'docker' as const;

  async deploy(config: ServerConfig): Promise<DeployResult> {
    const providerId = `docker-${config.slug}-${Date.now()}`;
    const port = allocatePort();
    const serverDir = getServerDir(providerId);

    // Scaffold the server files
    scaffoldServer(config, serverDir, port);

    // Install dependencies for TS servers
    if (config.language === 'typescript') {
      try {
        execSync('npm install --production 2>&1', { cwd: serverDir, timeout: 60000 });
      } catch (e) {
        // Log but don't fail — tsx can handle most things
      }
    }

    const managed: ManagedProcess = {
      process: null,
      config,
      status: 'starting',
      startedAt: null,
      logs: [],
      port,
    };

    processes.set(providerId, managed);

    // Start the process
    startProcess(providerId, managed);

    const endpointUrl = `http://localhost:${port}/sse`;

    return {
      providerId,
      endpointUrl,
      status: 'running',
    };
  }

  async start(providerId: string): Promise<void> {
    const managed = processes.get(providerId);
    if (!managed) throw new Error(`Server not found: ${providerId}`);
    if (managed.status === 'running') return;

    managed.status = 'starting';
    startProcess(providerId, managed);
  }

  async stop(providerId: string): Promise<void> {
    const managed = processes.get(providerId);
    if (!managed) throw new Error(`Server not found: ${providerId}`);
    if (managed.status === 'stopped') return;

    managed.status = 'stopping';
    addLog(managed, 'info', 'Stopping server...');

    if (managed.process) {
      managed.process.kill('SIGTERM');
      // Force kill after 10s
      setTimeout(() => {
        if (managed.process) {
          managed.process.kill('SIGKILL');
        }
      }, 10000);
    }

    managed.status = 'stopped';
    managed.process = null;
  }

  async info(providerId: string): Promise<ServerInfo> {
    const managed = processes.get(providerId);
    if (!managed) throw new Error(`Server not found: ${providerId}`);

    return {
      providerId,
      status: managed.status,
      health: managed.status === 'running' ? 'healthy' : 'unknown',
      uptime: managed.startedAt ? Math.floor((Date.now() - managed.startedAt) / 1000) : undefined,
      lastError: managed.lastError,
    };
  }

  async logs(providerId: string, lines = 100): Promise<LogEntry[]> {
    const managed = processes.get(providerId);
    if (!managed) throw new Error(`Server not found: ${providerId}`);
    return managed.logs.slice(-lines);
  }

  async destroy(providerId: string): Promise<void> {
    await this.stop(providerId);
    processes.delete(providerId);

    const serverDir = getServerDir(providerId);
    if (existsSync(serverDir)) {
      rmSync(serverDir, { recursive: true, force: true });
    }
  }

  async updateEnv(providerId: string, envVars: Record<string, string>): Promise<void> {
    const managed = processes.get(providerId);
    if (!managed) throw new Error(`Server not found: ${providerId}`);

    managed.config.envVars = { ...managed.config.envVars, ...envVars };

    // Update .env file
    const serverDir = getServerDir(providerId);
    const envContent = Object.entries(managed.config.envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    writeFileSync(join(serverDir, '.env'), `PORT=${managed.port}\nMCP_TRANSPORT=sse\n${envContent}`);

    addLog(managed, 'info', 'Environment variables updated', { keys: Object.keys(envVars) });

    // Restart to pick up new env
    if (managed.status === 'running') {
      await this.stop(providerId);
      await this.start(providerId);
    }
  }

  async redeploy(providerId: string, config: ServerConfig): Promise<DeployResult> {
    const managed = processes.get(providerId);
    if (!managed) throw new Error(`Server not found: ${providerId}`);

    const wasRunning = managed.status === 'running';
    if (wasRunning) await this.stop(providerId);

    // Re-scaffold with new code
    const serverDir = getServerDir(providerId);
    scaffoldServer(config, serverDir, managed.port);
    managed.config = config;

    addLog(managed, 'info', 'Redeployed with new version');

    if (wasRunning) {
      startProcess(providerId, managed);
    }

    return {
      providerId,
      endpointUrl: `http://localhost:${managed.port}/sse`,
      status: managed.status,
    };
  }

  async healthCheck(providerId: string): Promise<HealthStatus> {
    const managed = processes.get(providerId);
    if (!managed) return 'unknown';
    if (managed.status !== 'running') return 'unknown';
    if (!managed.process || managed.process.exitCode !== null) return 'unhealthy';
    return 'healthy';
  }
}
