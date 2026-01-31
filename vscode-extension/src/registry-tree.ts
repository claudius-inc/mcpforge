import * as vscode from 'vscode';
import { MCPForgeAPI, RegistryListing } from './api';

type TreeItem = CategoryItem | ListingItem | LoadMoreItem;

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly categoryId: string,
    public readonly categoryName: string,
    public readonly emoji: string,
  ) {
    super(`${emoji} ${categoryName}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'category';
    this.tooltip = `Browse ${categoryName} servers`;
  }
}

class ListingItem extends vscode.TreeItem {
  constructor(public readonly listing: RegistryListing) {
    super(listing.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'listing';

    const langIcon = listing.language === 'typescript' ? '🔷' : '🔶';
    this.description = `${langIcon} v${listing.version} · ⭐${listing.stars_count} · ${listing.tool_count} tools`;
    this.tooltip = new vscode.MarkdownString(
      `**${listing.title}** v${listing.version}\n\n${listing.description}\n\n` +
      `**Tools:** ${listing.tool_names.slice(0, 8).join(', ')}${listing.tool_names.length > 8 ? '...' : ''}\n\n` +
      `⭐ ${listing.stars_count} · 🍴 ${listing.forks_count} · ${listing.language}` +
      (listing.author_username ? `\n\nBy **${listing.author_username}**` : ''),
    );

    this.command = {
      command: 'vscode.open',
      title: 'View on MCPForge',
      arguments: [vscode.Uri.parse(`${getApiUrl()}/registry/${listing.id}`)],
    };

    this.iconPath = new vscode.ThemeIcon(listing.language === 'typescript' ? 'symbol-class' : 'symbol-method');
  }
}

class LoadMoreItem extends vscode.TreeItem {
  constructor(
    public readonly categoryId: string,
    public readonly nextPage: number,
  ) {
    super('Load more...', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'loadMore';
    this.iconPath = new vscode.ThemeIcon('ellipsis');
  }
}

const CATEGORIES = [
  { id: 'ai-ml', name: 'AI & ML', emoji: '🤖' },
  { id: 'communication', name: 'Communication', emoji: '💬' },
  { id: 'data', name: 'Data', emoji: '📊' },
  { id: 'devtools', name: 'Dev Tools', emoji: '🛠️' },
  { id: 'ecommerce', name: 'E-Commerce', emoji: '🛒' },
  { id: 'finance', name: 'Finance', emoji: '💰' },
  { id: 'media', name: 'Media', emoji: '🎬' },
  { id: 'productivity', name: 'Productivity', emoji: '📋' },
  { id: 'social', name: 'Social', emoji: '🌐' },
  { id: 'utilities', name: 'Utilities', emoji: '⚙️' },
  { id: 'weather', name: 'Weather', emoji: '🌤️' },
];

function getApiUrl(): string {
  return vscode.workspace.getConfiguration('mcpforge').get('apiUrl', 'https://mcpforge.com');
}

export class RegistryTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private searchQuery: string | undefined;
  private searchResults: RegistryListing[] = [];

  constructor(private api: MCPForgeAPI) {}

  refresh() {
    this.searchQuery = undefined;
    this.searchResults = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  search(query: string) {
    this.searchQuery = query;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    // If searching, show flat results
    if (this.searchQuery && !element) {
      try {
        const result = await this.api.searchRegistry(this.searchQuery);
        this.searchResults = result.listings;
        if (result.listings.length === 0) {
          return [new vscode.TreeItem(`No results for "${this.searchQuery}"`) as TreeItem];
        }
        return result.listings.map(l => new ListingItem(l));
      } catch {
        return [new vscode.TreeItem('Search failed — check connection') as TreeItem];
      }
    }

    // Top level: categories
    if (!element) {
      return CATEGORIES.map(c => new CategoryItem(c.id, c.name, c.emoji));
    }

    // Category children: fetch listings
    if (element instanceof CategoryItem) {
      try {
        const result = await this.api.searchRegistry(undefined, element.categoryId);
        const items: TreeItem[] = result.listings.map(l => new ListingItem(l));
        if (result.totalPages > 1) {
          items.push(new LoadMoreItem(element.categoryId, 2));
        }
        return items;
      } catch {
        return [new vscode.TreeItem('Failed to load') as TreeItem];
      }
    }

    return [];
  }
}
