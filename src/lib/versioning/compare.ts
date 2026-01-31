/**
 * High-level version comparison: takes two raw specs, parses, maps, diffs.
 */

import { parseOpenAPISpec } from '../parser';
import { mapSpecToMCPServer } from '../mapper';
import { diffConfigs } from './differ';
import type { VersionCompareInput, VersionUpdateResult } from './types';

/**
 * Compare two raw OpenAPI specs end-to-end:
 * parse both → map to MCP configs → diff → return result.
 */
export function compareVersions(input: VersionCompareInput): VersionUpdateResult {
  // Parse old spec
  const oldParse = parseOpenAPISpec(input.oldSpec);
  if (!oldParse.success || !oldParse.spec) {
    throw new VersionError(
      'Failed to parse old spec',
      oldParse.errors.map(e => `${e.path}: ${e.message}`),
    );
  }

  // Parse new spec
  const newParse = parseOpenAPISpec(input.newSpec);
  if (!newParse.success || !newParse.spec) {
    throw new VersionError(
      'Failed to parse new spec',
      newParse.errors.map(e => `${e.path}: ${e.message}`),
    );
  }

  // Map to MCP configs
  const oldConfig = mapSpecToMCPServer(oldParse.spec);
  const newConfig = mapSpecToMCPServer(newParse.spec);

  // Apply disabled tools
  if (input.disabledTools && input.disabledTools.length > 0) {
    for (const tool of newConfig.tools) {
      if (input.disabledTools.includes(tool.name)) {
        tool.enabled = false;
      }
    }
  }

  // Diff
  const diff = diffConfigs(oldConfig, newConfig);

  return { diff, newConfig, oldConfig };
}

export class VersionError extends Error {
  details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'VersionError';
    this.details = details;
  }
}
