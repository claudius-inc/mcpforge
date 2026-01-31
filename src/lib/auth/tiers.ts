// MCPForge tier definitions and feature gates

export type Tier = 'free' | 'pro' | 'team';

export interface TierConfig {
  name: string;
  price: number; // monthly USD
  limits: {
    generationsPerMonth: number;
    hostedServers: number;
    apiKeysPerUser: number;
    compositionsPerMonth: number;
    aiDescribesPerMonth: number;
  };
  features: {
    download: boolean;
    hostedDeploy: boolean;
    customDomains: boolean;
    analytics: boolean;
    prioritySupport: boolean;
    teamManagement: boolean;
    privateServers: boolean;
    versionHistory: boolean;
  };
}

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    name: 'Free',
    price: 0,
    limits: {
      generationsPerMonth: 10,
      hostedServers: 0,
      apiKeysPerUser: 1,
      compositionsPerMonth: 5,
      aiDescribesPerMonth: 5,
    },
    features: {
      download: true,
      hostedDeploy: false,
      customDomains: false,
      analytics: false,
      prioritySupport: false,
      teamManagement: false,
      privateServers: false,
      versionHistory: false,
    },
  },
  pro: {
    name: 'Pro',
    price: 29,
    limits: {
      generationsPerMonth: 100,
      hostedServers: 10,
      apiKeysPerUser: 5,
      compositionsPerMonth: 50,
      aiDescribesPerMonth: 50,
    },
    features: {
      download: true,
      hostedDeploy: true,
      customDomains: true,
      analytics: true,
      prioritySupport: true,
      teamManagement: false,
      privateServers: true,
      versionHistory: true,
    },
  },
  team: {
    name: 'Team',
    price: 99,
    limits: {
      generationsPerMonth: -1, // unlimited
      hostedServers: -1,
      apiKeysPerUser: 20,
      compositionsPerMonth: -1,
      aiDescribesPerMonth: -1,
    },
    features: {
      download: true,
      hostedDeploy: true,
      customDomains: true,
      analytics: true,
      prioritySupport: true,
      teamManagement: true,
      privateServers: true,
      versionHistory: true,
    },
  },
};

export function getTierConfig(tier: Tier): TierConfig {
  return TIERS[tier] || TIERS.free;
}

export function checkLimit(tier: Tier, limitKey: keyof TierConfig['limits'], currentCount: number): {
  allowed: boolean;
  limit: number;
  remaining: number;
} {
  const config = getTierConfig(tier);
  const limit = config.limits[limitKey];
  if (limit === -1) return { allowed: true, limit: -1, remaining: -1 };
  return {
    allowed: currentCount < limit,
    limit,
    remaining: Math.max(0, limit - currentCount),
  };
}

export function hasFeature(tier: Tier, featureKey: keyof TierConfig['features']): boolean {
  return getTierConfig(tier).features[featureKey];
}

export function getUpgradeTier(currentTier: Tier): Tier | null {
  if (currentTier === 'free') return 'pro';
  if (currentTier === 'pro') return 'team';
  return null;
}
