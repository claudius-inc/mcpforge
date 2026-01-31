import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || 'Turn Any API into an MCP Server';
  const subtitle = searchParams.get('subtitle') || 'Generate production-ready MCP servers from OpenAPI specs, plain English, or API docs.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0a0a0f 100%)',
          fontFamily: 'system-ui, sans-serif',
          padding: '60px 80px',
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage: 'linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '40px',
          }}
        >
          <span style={{ fontSize: '48px' }}>⚡</span>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#e2e8f0',
              letterSpacing: '-1px',
            }}
          >
            MCPForge
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: '900px',
            marginBottom: '24px',
            display: 'flex',
          }}
        >
          <span
            style={{
              background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {title}
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: '#9ca3af',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            color: '#6b7280',
            fontSize: '18px',
          }}
        >
          <span>TypeScript + Python</span>
          <span style={{ color: '#4b5563' }}>·</span>
          <span>Open Source</span>
          <span style={{ color: '#4b5563' }}>·</span>
          <span>Free to Use</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
