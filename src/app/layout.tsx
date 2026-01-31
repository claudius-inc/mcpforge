import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MCPForge — Turn Any API into an MCP Server',
  description: 'Upload an OpenAPI spec, get a production-ready MCP server. TypeScript or Python. Download or deploy in one click.',
  keywords: ['MCP', 'Model Context Protocol', 'API', 'OpenAPI', 'AI tools', 'code generator'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-forge-400">⚡</span>
              <span>MCPForge</span>
            </a>
            <div className="flex items-center gap-6 text-sm">
              <a href="/generate" className="text-gray-400 hover:text-white transition-colors">Generate</a>
              <a href="/docs" className="text-gray-400 hover:text-white transition-colors">Docs</a>
              <a href="/pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
              <a
                href="/generate"
                className="bg-forge-600 hover:bg-forge-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Get Started
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
