// Registry types for MCPForge community marketplace

export interface RegistryListing {
  id: string;
  server_id: string | null;
  user_id: string;
  title: string;
  description: string;
  readme: string | null;
  categories: string[];
  tags: string[];
  api_source_url: string | null;
  spec_snapshot: string;
  language: string;
  tool_count: number;
  tool_names: string[];
  stars_count: number;
  forks_count: number;
  installs_count: number;
  featured: boolean;
  verified: boolean;
  status: 'published' | 'unlisted' | 'suspended';
  version: string;
  github_repo: string | null;
  published_at: string;
  updated_at: string;
  // Joined fields
  author_username?: string;
  author_avatar_url?: string;
  user_starred?: boolean;
}

export interface RegistrySearchParams {
  query?: string;
  category?: string;
  tag?: string;
  language?: 'typescript' | 'python';
  sort?: 'popular' | 'newest' | 'stars' | 'name';
  featured?: boolean;
  page?: number;
  limit?: number;
}

export interface RegistrySearchResult {
  listings: RegistryListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const REGISTRY_CATEGORIES = [
  { id: 'ai-ml', name: 'AI & Machine Learning', emoji: '🤖' },
  { id: 'communication', name: 'Communication', emoji: '💬' },
  { id: 'data', name: 'Data & Analytics', emoji: '📊' },
  { id: 'devtools', name: 'Developer Tools', emoji: '🛠️' },
  { id: 'ecommerce', name: 'E-Commerce', emoji: '🛒' },
  { id: 'finance', name: 'Finance', emoji: '💰' },
  { id: 'media', name: 'Media & Content', emoji: '🎬' },
  { id: 'productivity', name: 'Productivity', emoji: '📋' },
  { id: 'social', name: 'Social', emoji: '🌐' },
  { id: 'utilities', name: 'Utilities', emoji: '⚙️' },
  { id: 'weather', name: 'Weather & Geo', emoji: '🌤️' },
  { id: 'other', name: 'Other', emoji: '📦' },
] as const;

export type RegistryCategoryId = typeof REGISTRY_CATEGORIES[number]['id'];
