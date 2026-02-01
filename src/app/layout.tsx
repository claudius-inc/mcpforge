import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { SessionProvider } from '@/components/SessionProvider';
import { AuthButton } from '@/components/AuthButton';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mcpforge.dev';

export const metadata: Metadata = {
  title: {
    default: 'MCPForge — Turn Any API into an MCP Server',
    template: '%s | MCPForge',
  },
  description: 'Generate production-ready MCP servers from OpenAPI specs, plain English, or API docs. TypeScript or Python. Open source, free to use.',
  keywords: ['MCP', 'Model Context Protocol', 'API', 'OpenAPI', 'AI tools', 'code generator', 'Claude', 'AI agent', 'MCP server', 'API to MCP'],
  authors: [{ name: 'Claudius Inc.' }],
  creator: 'Claudius Inc.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'MCPForge',
    title: 'MCPForge — Turn Any API into an MCP Server',
    description: 'Generate production-ready MCP servers from OpenAPI specs, plain English, or API docs. Open source. TypeScript or Python.',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'MCPForge — Turn Any API into an MCP Server',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPForge — Turn Any API into an MCP Server',
    description: 'Generate production-ready MCP servers from OpenAPI specs, plain English, or API docs. Open source.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <SessionProvider>
          <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2 font-bold text-lg">
                <span className="text-forge-400">⚡</span>
                <span>MCPForge</span>
              </a>
              <div className="flex items-center gap-6 text-sm">
                <a href="/generate" className="text-gray-400 hover:text-white transition-colors">Generate</a>
                <a href="/registry" className="text-gray-400 hover:text-white transition-colors">Registry</a>
                <a href="/pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
                <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
                <AuthButton />
              </div>
            </div>
          </nav>
          <main>{children}</main>
          <Analytics />
          <SpeedInsights />
        </SessionProvider>
      </body>
    </html>
  );
}
