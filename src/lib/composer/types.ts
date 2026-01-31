/** Types for multi-API composition */

export interface APISource {
  /** Short identifier for this API (e.g., "weather", "github") */
  name: string;
  /** OpenAPI spec as JSON or YAML string */
  spec: string;
  /** Optional prefix for tool names (defaults to name) */
  prefix?: string;
  /** Tools to disable by original name */
  disabledTools?: string[];
}

export interface ComposedServer {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Server description */
  description: string;
  /** Individual API configs (for reference) */
  apis: ComposedAPI[];
  /** Total number of tools */
  toolCount: number;
}

export interface ComposedAPI {
  /** API identifier */
  name: string;
  /** Prefix used for tools */
  prefix: string;
  /** Original spec title */
  title: string;
  /** Base URL */
  baseUrl: string;
  /** Number of tools from this API */
  toolCount: number;
}

export interface ComposeResult {
  success: boolean;
  errors: ComposeError[];
  warnings: string[];
}

export interface ComposeError {
  api: string;
  message: string;
  details?: unknown;
}
