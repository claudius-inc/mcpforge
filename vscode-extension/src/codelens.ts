import * as vscode from 'vscode';

/**
 * Provides CodeLens actions on OpenAPI spec files.
 * When a JSON/YAML file contains "openapi" or "swagger", shows a
 * "⚡ Generate MCP Server" CodeLens at the top.
 */
export class OpenAPICodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | undefined {
    const text = document.getText();
    const lower = text.toLowerCase();

    // Quick check: is this an OpenAPI/Swagger spec?
    const isOpenAPI =
      lower.includes('"openapi"') ||
      lower.includes("'openapi'") ||
      lower.includes('openapi:') ||
      lower.includes('"swagger"') ||
      lower.includes("'swagger'") ||
      lower.includes('swagger:');

    if (!isOpenAPI) return undefined;

    // Find the line with openapi/swagger declaration
    let targetLine = 0;
    for (let i = 0; i < Math.min(document.lineCount, 20); i++) {
      const line = document.lineAt(i).text.toLowerCase();
      if (line.includes('openapi') || line.includes('swagger')) {
        targetLine = i;
        break;
      }
    }

    const range = new vscode.Range(targetLine, 0, targetLine, 0);

    return [
      new vscode.CodeLens(range, {
        title: '⚡ Generate MCP Server',
        command: 'mcpforge.generateFromFile',
        arguments: [document.uri],
        tooltip: 'Generate an MCP server from this OpenAPI spec using MCPForge',
      }),
      new vscode.CodeLens(range, {
        title: '🔍 Preview Tools',
        command: 'mcpforge.previewTools',
        arguments: [document.uri],
        tooltip: 'Preview the MCP tools that would be generated',
      }),
    ];
  }
}
