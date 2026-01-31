// POST /api/github/push — push generated MCP server to GitHub repo

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pushToGitHub } from '@/lib/github';
import { getDb, initDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (!body.repoName || typeof body.repoName !== 'string') {
      return NextResponse.json({ error: 'repoName is required' }, { status: 400 });
    }

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json({ error: 'files array is required' }, { status: 400 });
    }

    // Validate repo name (GitHub rules)
    if (!/^[a-zA-Z0-9._-]+$/.test(body.repoName)) {
      return NextResponse.json({ error: 'Invalid repo name. Use letters, numbers, hyphens, dots, underscores.' }, { status: 400 });
    }

    // Get user's GitHub access token from accounts table
    const db = getDb();
    await initDb();
    const accountResult = await db.execute({
      sql: `SELECT access_token FROM accounts WHERE user_id = ? AND provider = 'github'`,
      args: [session.id],
    });

    if (accountResult.rows.length === 0 || !accountResult.rows[0].access_token) {
      return NextResponse.json({
        error: 'No GitHub access token found. Please re-login with GitHub to grant repo access.',
      }, { status: 403 });
    }

    const accessToken = accountResult.rows[0].access_token as string;

    const result = await pushToGitHub({
      accessToken,
      repoName: body.repoName,
      repoDescription: body.repoDescription,
      isPrivate: body.isPrivate !== false,
      files: body.files,
      commitMessage: body.commitMessage || 'Generate MCP server via MCPForge',
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Push failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
