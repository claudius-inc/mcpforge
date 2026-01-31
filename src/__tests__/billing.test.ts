import { describe, it, expect } from 'vitest';
import {
  getTierConfig,
  checkLimit,
  hasFeature,
  getUpgradeTier,
  TIERS,
  type Tier,
} from '../lib/auth/tiers';
import {
  getIncludedMinutes,
  getOverageRate,
} from '../lib/billing/compute';

describe('Tier Configuration', () => {
  it('has three tiers defined', () => {
    expect(Object.keys(TIERS)).toEqual(['free', 'pro', 'team']);
  });

  it('free tier has correct pricing', () => {
    const config = getTierConfig('free');
    expect(config.price).toBe(0);
    expect(config.name).toBe('Free');
  });

  it('pro tier is $29/month', () => {
    const config = getTierConfig('pro');
    expect(config.price).toBe(29);
  });

  it('team tier is $99/month', () => {
    const config = getTierConfig('team');
    expect(config.price).toBe(99);
  });

  it('returns free config for unknown tier', () => {
    const config = getTierConfig('unknown' as Tier);
    expect(config.name).toBe('Free');
  });
});

describe('Limit Checks', () => {
  it('allows generation within free tier limits', () => {
    const result = checkLimit('free', 'generationsPerMonth', 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it('blocks generation at free tier limit', () => {
    const result = checkLimit('free', 'generationsPerMonth', 10);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('blocks generation over free tier limit', () => {
    const result = checkLimit('free', 'generationsPerMonth', 15);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('allows more generations for pro tier', () => {
    const result = checkLimit('pro', 'generationsPerMonth', 50);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50);
  });

  it('team tier has unlimited generations', () => {
    const result = checkLimit('team', 'generationsPerMonth', 999999);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
    expect(result.remaining).toBe(-1);
  });

  it('free tier gets 0 hosted servers', () => {
    const result = checkLimit('free', 'hostedServers', 0);
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
  });

  it('pro tier gets 10 hosted servers', () => {
    const result = checkLimit('pro', 'hostedServers', 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it('pro tier blocks at 10 hosted servers', () => {
    const result = checkLimit('pro', 'hostedServers', 10);
    expect(result.allowed).toBe(false);
  });

  it('team tier has unlimited hosted servers', () => {
    const result = checkLimit('team', 'hostedServers', 100);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });

  it('api key limits per tier', () => {
    expect(checkLimit('free', 'apiKeysPerUser', 0).allowed).toBe(true);
    expect(checkLimit('free', 'apiKeysPerUser', 1).allowed).toBe(false);
    expect(checkLimit('pro', 'apiKeysPerUser', 4).allowed).toBe(true);
    expect(checkLimit('pro', 'apiKeysPerUser', 5).allowed).toBe(false);
    expect(checkLimit('team', 'apiKeysPerUser', 19).allowed).toBe(true);
    expect(checkLimit('team', 'apiKeysPerUser', 20).allowed).toBe(false);
  });

  it('composition limits per tier', () => {
    expect(checkLimit('free', 'compositionsPerMonth', 4).allowed).toBe(true);
    expect(checkLimit('free', 'compositionsPerMonth', 5).allowed).toBe(false);
    expect(checkLimit('pro', 'compositionsPerMonth', 49).allowed).toBe(true);
    expect(checkLimit('team', 'compositionsPerMonth', 99999).allowed).toBe(true);
  });

  it('AI describe limits per tier', () => {
    expect(checkLimit('free', 'aiDescribesPerMonth', 4).allowed).toBe(true);
    expect(checkLimit('free', 'aiDescribesPerMonth', 5).allowed).toBe(false);
    expect(checkLimit('pro', 'aiDescribesPerMonth', 49).allowed).toBe(true);
    expect(checkLimit('team', 'aiDescribesPerMonth', 99999).allowed).toBe(true);
  });
});

describe('Feature Gates', () => {
  it('free tier has download only', () => {
    expect(hasFeature('free', 'download')).toBe(true);
    expect(hasFeature('free', 'hostedDeploy')).toBe(false);
    expect(hasFeature('free', 'customDomains')).toBe(false);
    expect(hasFeature('free', 'analytics')).toBe(false);
    expect(hasFeature('free', 'prioritySupport')).toBe(false);
    expect(hasFeature('free', 'teamManagement')).toBe(false);
    expect(hasFeature('free', 'privateServers')).toBe(false);
    expect(hasFeature('free', 'versionHistory')).toBe(false);
  });

  it('pro tier unlocks deployment + analytics', () => {
    expect(hasFeature('pro', 'download')).toBe(true);
    expect(hasFeature('pro', 'hostedDeploy')).toBe(true);
    expect(hasFeature('pro', 'customDomains')).toBe(true);
    expect(hasFeature('pro', 'analytics')).toBe(true);
    expect(hasFeature('pro', 'prioritySupport')).toBe(true);
    expect(hasFeature('pro', 'teamManagement')).toBe(false);
    expect(hasFeature('pro', 'privateServers')).toBe(true);
    expect(hasFeature('pro', 'versionHistory')).toBe(true);
  });

  it('team tier unlocks everything', () => {
    expect(hasFeature('team', 'download')).toBe(true);
    expect(hasFeature('team', 'hostedDeploy')).toBe(true);
    expect(hasFeature('team', 'customDomains')).toBe(true);
    expect(hasFeature('team', 'analytics')).toBe(true);
    expect(hasFeature('team', 'prioritySupport')).toBe(true);
    expect(hasFeature('team', 'teamManagement')).toBe(true);
    expect(hasFeature('team', 'privateServers')).toBe(true);
    expect(hasFeature('team', 'versionHistory')).toBe(true);
  });
});

describe('Tier Upgrade Path', () => {
  it('free upgrades to pro', () => {
    expect(getUpgradeTier('free')).toBe('pro');
  });

  it('pro upgrades to team', () => {
    expect(getUpgradeTier('pro')).toBe('team');
  });

  it('team has no upgrade', () => {
    expect(getUpgradeTier('team')).toBeNull();
  });
});

describe('Compute Billing', () => {
  it('free tier gets 0 included compute minutes', () => {
    expect(getIncludedMinutes('free')).toBe(0);
  });

  it('pro tier gets 10,000 included minutes (~167 hours)', () => {
    expect(getIncludedMinutes('pro')).toBe(10_000);
  });

  it('team tier gets 100,000 included minutes (~1667 hours)', () => {
    expect(getIncludedMinutes('team')).toBe(100_000);
  });

  it('overage rate is $0.005/min ($0.30/hr)', () => {
    const rate = getOverageRate();
    expect(rate).toBe(0.005);
    expect(rate * 60).toBe(0.30);
  });

  it('pro tier compute value matches pricing expectations', () => {
    const included = getIncludedMinutes('pro');
    const rate = getOverageRate();
    // $29/mo includes 10,000 minutes → effective rate of $0.0029/min
    // Overage at $0.005/min is a ~72% markup over included rate
    const includedValue = included * rate; // $50 worth at overage rate
    expect(includedValue).toBe(50); // good value prop: $29 for $50 of compute
  });

  it('team tier compute value matches pricing expectations', () => {
    const included = getIncludedMinutes('team');
    const rate = getOverageRate();
    const includedValue = included * rate; // $500 worth at overage rate
    expect(includedValue).toBe(500); // excellent value: $99 for $500 of compute
  });
});

describe('Schema Tables', () => {
  // Verify the schema SQL contains required billing tables
  it('schema includes compute_usage table', async () => {
    const { SCHEMA_SQL } = await import('../lib/db/schema');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS compute_usage');
    expect(SCHEMA_SQL).toContain('server_id TEXT NOT NULL');
    expect(SCHEMA_SQL).toContain('user_id TEXT NOT NULL');
    expect(SCHEMA_SQL).toContain('start_time TEXT NOT NULL');
    expect(SCHEMA_SQL).toContain('end_time TEXT NOT NULL');
    expect(SCHEMA_SQL).toContain('minutes INTEGER');
  });

  it('schema includes compute_usage indexes', async () => {
    const { SCHEMA_SQL } = await import('../lib/db/schema');
    expect(SCHEMA_SQL).toContain('idx_compute_usage_user');
    expect(SCHEMA_SQL).toContain('idx_compute_usage_server');
    expect(SCHEMA_SQL).toContain('idx_compute_usage_period');
  });

  it('users table has stripe fields', async () => {
    const { SCHEMA_SQL } = await import('../lib/db/schema');
    expect(SCHEMA_SQL).toContain('stripe_customer_id TEXT');
    expect(SCHEMA_SQL).toContain('stripe_subscription_id TEXT');
    expect(SCHEMA_SQL).toContain("tier TEXT NOT NULL DEFAULT 'free'");
  });

  it('schema includes api_keys table', async () => {
    const { SCHEMA_SQL } = await import('../lib/db/schema');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS api_keys');
    expect(SCHEMA_SQL).toContain('key_hash TEXT UNIQUE NOT NULL');
    expect(SCHEMA_SQL).toContain('scopes TEXT NOT NULL');
  });
});
