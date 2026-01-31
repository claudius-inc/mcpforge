import * as vscode from 'vscode';

interface RecentGeneration {
  name: string;
  language: string;
  toolCount: number;
  timestamp: number;
  outputPath: string;
}

const STORAGE_KEY = 'mcpforge.recentGenerations';
const MAX_RECENTS = 20;

class RecentItem extends vscode.TreeItem {
  constructor(public readonly gen: RecentGeneration) {
    super(gen.name, vscode.TreeItemCollapsibleState.None);

    const langIcon = gen.language === 'typescript' ? '🔷' : '🔶';
    const date = new Date(gen.timestamp);
    const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    this.description = `${langIcon} ${gen.toolCount} tools · ${timeStr}`;
    this.tooltip = `Generated ${gen.language} MCP server\n${gen.toolCount} tools\n${timeStr}\n${gen.outputPath}`;

    this.iconPath = new vscode.ThemeIcon('file-zip');

    if (gen.outputPath) {
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(gen.outputPath)],
      };
    }
  }
}

export class RecentTreeProvider implements vscode.TreeDataProvider<RecentItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<RecentItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  addGeneration(gen: RecentGeneration) {
    const recents = this.getRecents();
    recents.unshift(gen);
    if (recents.length > MAX_RECENTS) recents.length = MAX_RECENTS;
    this.context.globalState.update(STORAGE_KEY, recents);
    this._onDidChangeTreeData.fire(undefined);
  }

  private getRecents(): RecentGeneration[] {
    return this.context.globalState.get<RecentGeneration[]>(STORAGE_KEY, []);
  }

  getTreeItem(element: RecentItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<RecentItem[]> {
    const recents = this.getRecents();
    if (recents.length === 0) {
      const empty = new vscode.TreeItem('No recent generations');
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty as unknown as RecentItem];
    }
    return recents.map(g => new RecentItem(g));
  }
}
