import NextAuth, { type AuthOptions, type Session } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { getDb, generateId, initDb } from '@/lib/db';
import type { Tier } from '@/lib/auth/tiers';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username: string;
      tier: Tier;
    };
  }
}

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider !== 'github') return false;
      
      const db = getDb();
      await initDb();
      
      const githubId = Number(account.providerAccountId);
      const ghProfile = profile as { login?: string; avatar_url?: string };
      const username = ghProfile?.login || user.name || 'user';
      
      // Upsert user
      const existing = await db.execute({
        sql: 'SELECT id FROM users WHERE github_id = ?',
        args: [githubId],
      });
      
      let userId: string;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id as string;
        await db.execute({
          sql: `UPDATE users SET username = ?, email = ?, name = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [username, user.email || null, user.name || null, ghProfile?.avatar_url || user.image || null, userId],
        });
      } else {
        userId = generateId();
        await db.execute({
          sql: `INSERT INTO users (id, github_id, username, email, name, avatar_url) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [userId, githubId, username, user.email || null, user.name || null, ghProfile?.avatar_url || user.image || null],
        });
      }
      
      // Upsert account link
      const existingAccount = await db.execute({
        sql: 'SELECT id FROM accounts WHERE provider = ? AND provider_account_id = ?',
        args: ['github', String(githubId)],
      });
      
      if (existingAccount.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO accounts (id, user_id, type, provider, provider_account_id, access_token, token_type, scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [generateId(), userId, 'oauth', 'github', String(githubId), account.access_token || null, account.token_type || null, account.scope || null],
        });
      } else {
        await db.execute({
          sql: `UPDATE accounts SET access_token = ?, token_type = ?, scope = ? WHERE provider = ? AND provider_account_id = ?`,
          args: [account.access_token || null, account.token_type || null, account.scope || null, 'github', String(githubId)],
        });
      }
      
      return true;
    },
    
    async session({ session, token }): Promise<Session> {
      if (token?.githubId) {
        const db = getDb();
        const result = await db.execute({
          sql: 'SELECT id, username, tier FROM users WHERE github_id = ?',
          args: [Number(token.githubId)],
        });
        if (result.rows.length > 0) {
          const row = result.rows[0];
          session.user.id = row.id as string;
          session.user.username = row.username as string;
          session.user.tier = (row.tier as Tier) || 'free';
        }
      }
      return session;
    },
    
    async jwt({ token, account, profile }) {
      if (account) {
        token.githubId = Number(account.providerAccountId);
        const ghProfile = profile as { login?: string };
        token.username = ghProfile?.login;
      }
      return token;
    },
  },
  
  pages: {
    signIn: '/login',
  },
  
  session: {
    strategy: 'jwt',
  },
  
  secret: process.env.NEXTAUTH_SECRET || 'mcpforge-dev-secret-change-in-production',
};

