/**
 * Version management types for spec diffing and MCP server updates.
 */

import type { MCPTool, MCPServerConfig, EnvVar } from '../mapper/types';

/** The result of comparing two specs */
export interface VersionDiff {
  /** Human-readable summary of changes */
  summary: string;
  /** Detailed list of changes */
  changes: Change[];
  /** Whether the update is backwards-compatible (no removed tools, no breaking param changes) */
  isBackwardsCompatible: boolean;
  /** Migration notes for non-trivial changes */
  migrationNotes: string[];
  /** Stats */
  stats: DiffStats;
}

export interface DiffStats {
  toolsAdded: number;
  toolsRemoved: number;
  toolsModified: number;
  toolsUnchanged: number;
  envVarsAdded: number;
  envVarsRemoved: number;
}

export type ChangeKind =
  | 'tool_added'
  | 'tool_removed'
  | 'tool_modified'
  | 'env_added'
  | 'env_removed'
  | 'server_meta_changed';

export type ChangeSeverity = 'info' | 'warning' | 'breaking';

export interface Change {
  kind: ChangeKind;
  severity: ChangeSeverity;
  toolName?: string;
  description: string;
  details?: ChangeDetail[];
}

export interface ChangeDetail {
  field: string;
  oldValue?: string;
  newValue?: string;
}

/** Input to the version compare function */
export interface VersionCompareInput {
  oldSpec: string;   // raw OpenAPI spec (YAML or JSON)
  newSpec: string;   // raw OpenAPI spec (YAML or JSON)
  /** Tool names to exclude from the new version */
  disabledTools?: string[];
}

/** Result of a version update */
export interface VersionUpdateResult {
  diff: VersionDiff;
  /** The new MCPServerConfig (with changes applied) */
  newConfig: MCPServerConfig;
  /** Optional: the old config for reference */
  oldConfig: MCPServerConfig;
}
