import * as vscode from 'vscode';
import { MCPForgeAPI } from './api';
import { RegistryTreeProvider } from './registry-tree';
import { RecentTreeProvider } from './recent-tree';
import { OpenAPICodeLensProvider } from './codelens';

let api: MCPForgeAPI;
let registryTree: RegistryTreeProvider;
let recentTree: RecentTreeProvider;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('mcpforge');
  api = new MCPForgeAPI(config.get('apiUrl', 'https://mcpforge.com'));

  // Sidebar tree views
  registryTree = new RegistryTreeProvider(api);
  recentTree = new RecentTreeProvider(context);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('mcpforge.registry', registryTree),
    vscode.window.registerTreeDataProvider('mcpforge.recent', recentTree),
  );

  // CodeLens for OpenAPI files
  if (config.get('autoDetectSpecs', true)) {
    const codeLens = new OpenAPICodeLensProvider();
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        [
          { language: 'json', scheme: 'file' },
          { language: 'yaml', scheme: 'file' },
          { language: 'yml', scheme: 'file' },
        ],
        codeLens,
      ),
    );
  }

  // --- Commands ---

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpforge.generateFromFile', async (uri?: vscode.Uri) => {
      await generateFromFile(context, uri);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpforge.generateFromClipboard', async () => {
      await generateFromClipboard(context);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpforge.describe', async () => {
      await generateFromDescription(context);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpforge.searchRegistry', async () => {
      await searchRegistry();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpforge.setApiUrl', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'MCPForge API URL',
        value: config.get('apiUrl', 'https://mcpforge.com'),
        placeHolder: 'https://mcpforge.com',
      });
      if (url) {
        await config.update('apiUrl', url, vscode.ConfigurationTarget.Global);
        api = new MCPForgeAPI(url);
        vscode.window.showInformationMessage(`MCPForge API URL set to ${url}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpforge.registryRefresh', () => {
      registryTree.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpforge.previewTools', async (uri?: vscode.Uri) => {
      await previewTools(uri);
    }),
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(zap) MCPForge';
  statusBar.tooltip = 'MCPForge — Generate MCP Servers';
  statusBar.command = 'mcpforge.describe';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Watch config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('mcpforge.apiUrl')) {
        const newUrl = vscode.workspace.getConfiguration('mcpforge').get('apiUrl', 'https://mcpforge.com');
        api = new MCPForgeAPI(newUrl);
        registryTree.refresh();
      }
    }),
  );
}

export function deactivate() {}

// --- Command Implementations ---

async function generateFromFile(context: vscode.ExtensionContext, uri?: vscode.Uri) {
  // Get spec file
  let specContent: string;
  let fileName: string;

  if (uri) {
    const doc = await vscode.workspace.openTextDocument(uri);
    specContent = doc.getText();
    fileName = uri.fsPath.split('/').pop() || 'spec';
  } else {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open an OpenAPI spec file first');
      return;
    }
    specContent = editor.document.getText();
    fileName = editor.document.fileName.split('/').pop() || 'spec';
  }

  // Detect if it's actually an OpenAPI spec
  if (!isOpenAPISpec(specContent)) {
    const proceed = await vscode.window.showWarningMessage(
      'This file may not be an OpenAPI spec. Generate anyway?',
      'Yes',
      'No',
    );
    if (proceed !== 'Yes') return;
  }

  await doGenerate(context, specContent, fileName);
}

async function generateFromClipboard(context: vscode.ExtensionContext) {
  const clip = await vscode.env.clipboard.readText();
  if (!clip.trim()) {
    vscode.window.showErrorMessage('Clipboard is empty');
    return;
  }
  await doGenerate(context, clip, 'clipboard-spec');
}

async function doGenerate(context: vscode.ExtensionContext, spec: string, sourceName: string) {
  const config = vscode.workspace.getConfiguration('mcpforge');
  const defaultLang = config.get('defaultLanguage', 'typescript');

  const language = await vscode.window.showQuickPick(
    [
      { label: 'TypeScript', description: 'Node.js MCP server', value: 'typescript' },
      { label: 'Python', description: 'Python MCP server', value: 'python' },
    ],
    { placeHolder: 'Select target language', title: 'MCPForge: Generate MCP Server' },
  );

  if (!language) return;
  const lang = language.value || defaultLang;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'MCPForge: Generating MCP server...',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Parsing spec...' });

        // First try preview to show tools
        const preview = await api.generate(spec, lang, 'preview');

        if (!preview.tools || preview.tools.length === 0) {
          vscode.window.showWarningMessage('No API endpoints found in spec');
          return;
        }

        progress.report({ message: `Found ${preview.tools.length} tools. Generating...` });

        // Download ZIP
        const zipBuffer = await api.generate(spec, lang, 'download');

        // Ask where to save
        const defaultOutput = config.get('outputDirectory', './mcp-server');
        const folders = vscode.workspace.workspaceFolders;
        const defaultUri = folders?.[0]
          ? vscode.Uri.joinPath(folders[0].uri, defaultOutput)
          : undefined;

        const saveUri = await vscode.window.showSaveDialog({
          defaultUri,
          title: 'Save MCP Server ZIP',
          filters: { 'ZIP files': ['zip'] },
        });

        if (!saveUri) return;

        await vscode.workspace.fs.writeFile(saveUri, zipBuffer);

        // Track in recents
        recentTree.addGeneration({
          name: sourceName,
          language: lang,
          toolCount: preview.tools.length,
          timestamp: Date.now(),
          outputPath: saveUri.fsPath,
        });

        const action = await vscode.window.showInformationMessage(
          `✅ Generated ${preview.tools.length}-tool ${lang} MCP server`,
          'Open Folder',
          'Show Tools',
        );

        if (action === 'Open Folder') {
          const dir = vscode.Uri.file(saveUri.fsPath.replace(/\.zip$/, ''));
          vscode.commands.executeCommand('vscode.openFolder', dir, { forceNewWindow: false });
        } else if (action === 'Show Tools') {
          const toolList = preview.tools.map((t: { name: string; description: string }) => `• ${t.name}: ${t.description}`).join('\n');
          const doc = await vscode.workspace.openTextDocument({ content: toolList, language: 'markdown' });
          vscode.window.showTextDocument(doc);
        }
      } catch (err) {
        vscode.window.showErrorMessage(`MCPForge error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

async function generateFromDescription(context: vscode.ExtensionContext) {
  const description = await vscode.window.showInputBox({
    prompt: 'Describe the API you want to turn into an MCP server',
    placeHolder: 'e.g., weather API with forecast and current conditions for any city',
    title: 'MCPForge: Generate from Description',
  });

  if (!description?.trim()) return;

  const config = vscode.workspace.getConfiguration('mcpforge');
  const lang = config.get('defaultLanguage', 'typescript');

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'MCPForge: AI generating spec...',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'AI is generating OpenAPI spec...' });
        const result = await api.describe(description);

        if (!result.spec) {
          vscode.window.showWarningMessage('AI could not generate a spec from that description');
          return;
        }

        progress.report({ message: 'Spec generated! Creating MCP server...' });

        // Show the generated spec for review
        const doc = await vscode.workspace.openTextDocument({ content: result.spec, language: 'yaml' });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        const action = await vscode.window.showInformationMessage(
          '✅ AI generated OpenAPI spec. Generate MCP server from it?',
          'Generate',
          'Edit First',
        );

        if (action === 'Generate') {
          await doGenerate(context, result.spec, `ai-${description.slice(0, 30)}`);
        }
        // 'Edit First' — user edits the doc, then uses generateFromFile
      } catch (err) {
        vscode.window.showErrorMessage(`MCPForge error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

async function searchRegistry() {
  const query = await vscode.window.showInputBox({
    prompt: 'Search the MCP server registry',
    placeHolder: 'e.g., weather, github, stripe...',
    title: 'MCPForge: Search Registry',
  });

  if (!query?.trim()) return;

  registryTree.search(query);
}

async function previewTools(uri?: vscode.Uri) {
  let specContent: string;

  if (uri) {
    const doc = await vscode.workspace.openTextDocument(uri);
    specContent = doc.getText();
  } else {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open an OpenAPI spec file first');
      return;
    }
    specContent = editor.document.getText();
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'MCPForge: Parsing spec...' },
    async () => {
      try {
        const config = vscode.workspace.getConfiguration('mcpforge');
        const lang = config.get('defaultLanguage', 'typescript');
        const preview = await api.generate(specContent, lang, 'preview');

        if (!preview.tools?.length) {
          vscode.window.showWarningMessage('No API endpoints found');
          return;
        }

        const lines = [
          `# ${preview.serverName} — ${preview.tools.length} MCP Tools\n`,
          ...preview.tools.map((t: { name: string; description: string }, i: number) =>
            `## ${i + 1}. \`${t.name}\`\n${t.description}\n`,
          ),
        ];

        const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'markdown' });
        vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (err) {
        vscode.window.showErrorMessage(`MCPForge error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// --- Helpers ---

function isOpenAPISpec(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('"openapi"') ||
    lower.includes("'openapi'") ||
    lower.includes('openapi:') ||
    lower.includes('"swagger"') ||
    lower.includes("'swagger'") ||
    lower.includes('swagger:')
  );
}
