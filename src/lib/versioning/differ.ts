/**
 * Spec diffing engine: compares two MCPServerConfigs and produces a structured diff.
 */

import type { MCPServerConfig, MCPTool, MCPInputSchema, MCPProperty, EnvVar } from '../mapper/types';
import type { VersionDiff, Change, ChangeDetail, DiffStats, ChangeSeverity } from './types';

/**
 * Compare two MCP server configs and produce a detailed diff.
 */
export function diffConfigs(oldConfig: MCPServerConfig, newConfig: MCPServerConfig): VersionDiff {
  const changes: Change[] = [];
  const migrationNotes: string[] = [];

  // Index tools by name
  const oldTools = new Map(oldConfig.tools.map(t => [t.name, t]));
  const newTools = new Map(newConfig.tools.map(t => [t.name, t]));

  // Index env vars by name
  const oldEnvs = new Map(oldConfig.envVars.map(e => [e.name, e]));
  const newEnvs = new Map(newConfig.envVars.map(e => [e.name, e]));

  // Detect server metadata changes
  if (oldConfig.name !== newConfig.name || oldConfig.description !== newConfig.description || oldConfig.version !== newConfig.version) {
    const details: ChangeDetail[] = [];
    if (oldConfig.name !== newConfig.name) {
      details.push({ field: 'name', oldValue: oldConfig.name, newValue: newConfig.name });
    }
    if (oldConfig.version !== newConfig.version) {
      details.push({ field: 'version', oldValue: oldConfig.version, newValue: newConfig.version });
    }
    if (oldConfig.description !== newConfig.description) {
      details.push({ field: 'description', oldValue: truncate(oldConfig.description, 60), newValue: truncate(newConfig.description, 60) });
    }
    changes.push({
      kind: 'server_meta_changed',
      severity: 'info',
      description: 'Server metadata updated',
      details,
    });
  }

  // Find added tools
  for (const [name, tool] of newTools) {
    if (!oldTools.has(name)) {
      changes.push({
        kind: 'tool_added',
        severity: 'info',
        toolName: name,
        description: `New tool: ${name} — ${truncate(tool.description, 80)}`,
      });
    }
  }

  // Find removed tools
  for (const [name, tool] of oldTools) {
    if (!newTools.has(name)) {
      changes.push({
        kind: 'tool_removed',
        severity: 'breaking',
        toolName: name,
        description: `Removed tool: ${name} — ${truncate(tool.description, 80)}`,
      });
      migrationNotes.push(`Tool "${name}" was removed. Any automation referencing this tool will break.`);
    }
  }

  // Find modified tools
  for (const [name, newTool] of newTools) {
    const oldTool = oldTools.get(name);
    if (!oldTool) continue;

    const toolChanges = diffTool(oldTool, newTool);
    if (toolChanges.length > 0) {
      const hasBreaking = toolChanges.some(d => isBreakingToolChange(d));
      changes.push({
        kind: 'tool_modified',
        severity: hasBreaking ? 'warning' : 'info',
        toolName: name,
        description: `Modified tool: ${name} (${toolChanges.length} change${toolChanges.length === 1 ? '' : 's'})`,
        details: toolChanges,
      });
      if (hasBreaking) {
        migrationNotes.push(`Tool "${name}" has breaking parameter changes — verify automation compatibility.`);
      }
    }
  }

  // Find added/removed env vars
  for (const [name, envVar] of newEnvs) {
    if (!oldEnvs.has(name)) {
      changes.push({
        kind: 'env_added',
        severity: 'info',
        description: `New env var: ${name} — ${envVar.description}`,
      });
      if (envVar.required) {
        migrationNotes.push(`New required env var "${name}" must be set before running the updated server.`);
      }
    }
  }

  for (const [name] of oldEnvs) {
    if (!newEnvs.has(name)) {
      changes.push({
        kind: 'env_removed',
        severity: 'info',
        description: `Removed env var: ${name}`,
      });
    }
  }

  // Compute stats
  const stats: DiffStats = {
    toolsAdded: changes.filter(c => c.kind === 'tool_added').length,
    toolsRemoved: changes.filter(c => c.kind === 'tool_removed').length,
    toolsModified: changes.filter(c => c.kind === 'tool_modified').length,
    toolsUnchanged: [...newTools.keys()].filter(n => oldTools.has(n) && !changes.some(c => c.kind === 'tool_modified' && c.toolName === n)).length,
    envVarsAdded: changes.filter(c => c.kind === 'env_added').length,
    envVarsRemoved: changes.filter(c => c.kind === 'env_removed').length,
  };

  const isBackwardsCompatible = !changes.some(c => c.severity === 'breaking');

  // Build summary
  const parts: string[] = [];
  if (stats.toolsAdded > 0) parts.push(`${stats.toolsAdded} added`);
  if (stats.toolsRemoved > 0) parts.push(`${stats.toolsRemoved} removed`);
  if (stats.toolsModified > 0) parts.push(`${stats.toolsModified} modified`);
  if (stats.toolsUnchanged > 0) parts.push(`${stats.toolsUnchanged} unchanged`);
  const toolSummary = parts.length > 0 ? `Tools: ${parts.join(', ')}.` : 'No tool changes.';
  const compatNote = isBackwardsCompatible ? 'This update is backwards-compatible.' : '⚠️ This update contains breaking changes.';
  const summary = `${toolSummary} ${compatNote}`;

  return { summary, changes, isBackwardsCompatible, migrationNotes, stats };
}

/**
 * Compare two individual tools and return field-level changes.
 */
function diffTool(oldTool: MCPTool, newTool: MCPTool): ChangeDetail[] {
  const details: ChangeDetail[] = [];

  // Description change
  if (oldTool.description !== newTool.description) {
    details.push({
      field: 'description',
      oldValue: truncate(oldTool.description, 60),
      newValue: truncate(newTool.description, 60),
    });
  }

  // Method change
  if (oldTool.handler.method !== newTool.handler.method) {
    details.push({
      field: 'handler.method',
      oldValue: oldTool.handler.method.toUpperCase(),
      newValue: newTool.handler.method.toUpperCase(),
    });
  }

  // Path change
  if (oldTool.handler.path !== newTool.handler.path) {
    details.push({
      field: 'handler.path',
      oldValue: oldTool.handler.path,
      newValue: newTool.handler.path,
    });
  }

  // Base URL change
  if (oldTool.handler.baseUrl !== newTool.handler.baseUrl) {
    details.push({
      field: 'handler.baseUrl',
      oldValue: oldTool.handler.baseUrl,
      newValue: newTool.handler.baseUrl,
    });
  }

  // Input schema changes
  const paramChanges = diffInputSchema(oldTool.inputSchema, newTool.inputSchema);
  details.push(...paramChanges);

  return details;
}

/**
 * Compare two input schemas and return parameter-level changes.
 */
function diffInputSchema(oldSchema: MCPInputSchema, newSchema: MCPInputSchema): ChangeDetail[] {
  const details: ChangeDetail[] = [];
  const oldProps = new Set(Object.keys(oldSchema.properties));
  const newProps = new Set(Object.keys(newSchema.properties));
  const oldRequired = new Set(oldSchema.required);
  const newRequired = new Set(newSchema.required);

  // Added params
  for (const name of newProps) {
    if (!oldProps.has(name)) {
      const isRequired = newRequired.has(name);
      details.push({
        field: `param.${name}`,
        oldValue: undefined,
        newValue: `added (${isRequired ? 'required' : 'optional'}, type: ${(newSchema.properties[name] as MCPProperty).type})`,
      });
    }
  }

  // Removed params
  for (const name of oldProps) {
    if (!newProps.has(name)) {
      details.push({
        field: `param.${name}`,
        oldValue: `existed (type: ${(oldSchema.properties[name] as MCPProperty).type})`,
        newValue: 'removed',
      });
    }
  }

  // Modified params
  for (const name of newProps) {
    if (!oldProps.has(name)) continue;
    const oldProp = oldSchema.properties[name] as MCPProperty;
    const newProp = newSchema.properties[name] as MCPProperty;

    // Type change
    if (oldProp.type !== newProp.type) {
      details.push({
        field: `param.${name}.type`,
        oldValue: oldProp.type,
        newValue: newProp.type,
      });
    }

    // Required status change
    const wasRequired = oldRequired.has(name);
    const isRequired = newRequired.has(name);
    if (wasRequired !== isRequired) {
      details.push({
        field: `param.${name}.required`,
        oldValue: String(wasRequired),
        newValue: String(isRequired),
      });
    }

    // Enum change
    const oldEnum = JSON.stringify(oldProp.enum || []);
    const newEnum = JSON.stringify(newProp.enum || []);
    if (oldEnum !== newEnum && (oldProp.enum || newProp.enum)) {
      details.push({
        field: `param.${name}.enum`,
        oldValue: oldEnum,
        newValue: newEnum,
      });
    }
  }

  return details;
}

/**
 * Determine if a tool change detail is breaking.
 * Breaking: required params added, params removed, type changes.
 */
function isBreakingToolChange(detail: ChangeDetail): boolean {
  // Removed param
  if (detail.field.startsWith('param.') && detail.newValue === 'removed') return true;
  // Added required param
  if (detail.field.startsWith('param.') && detail.newValue?.includes('required')) return true;
  // Type change
  if (detail.field.endsWith('.type')) return true;
  // Method change
  if (detail.field === 'handler.method') return true;
  return false;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}
