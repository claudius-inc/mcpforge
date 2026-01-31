export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Hero */}
      <section className="py-24 text-center">
        <div className="inline-block px-3 py-1 rounded-full bg-forge-950 border border-forge-800 text-forge-300 text-sm mb-6">
          Open Source · Free to Use
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Turn any API into an{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-forge-400 to-blue-400">
            MCP Server
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Describe what you want in plain English, upload an OpenAPI spec, crawl any API docs page, or 
          compose multiple APIs into one. Get a production-ready MCP server in TypeScript or Python — in seconds.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/generate"
            className="bg-forge-600 hover:bg-forge-500 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors"
          >
            Generate Now →
          </a>
          <a
            href="https://github.com/Claudius-Inc/mcpforge"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-8 py-3 rounded-lg font-medium text-lg transition-colors"
          >
            View Source
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-forge-900 text-forge-400 flex items-center justify-center text-lg font-bold mb-4">1</div>
            <h3 className="text-lg font-semibold mb-2">Describe, Upload, or Crawl</h3>
            <p className="text-gray-400 text-sm">
              Describe what you want in English, paste an OpenAPI spec, or point at any API docs page. AI extracts the endpoints for you.
            </p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-forge-900 text-forge-400 flex items-center justify-center text-lg font-bold mb-4">2</div>
            <h3 className="text-lg font-semibold mb-2">Preview & Customize</h3>
            <p className="text-gray-400 text-sm">
              See every MCP tool that will be generated. Toggle endpoints on/off. Edit descriptions. Choose TypeScript or Python.
            </p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-forge-900 text-forge-400 flex items-center justify-center text-lg font-bold mb-4">3</div>
            <h3 className="text-lg font-semibold mb-2">Download & Run</h3>
            <p className="text-gray-400 text-sm">
              Download a complete, production-ready MCP server. Includes package.json, Dockerfile, README, and Claude Desktop config.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-12">Why MCPForge?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { emoji: '✨', title: 'Plain English Input', desc: 'Describe what you want and AI generates the spec. No OpenAPI knowledge needed.' },
            { emoji: '🔗', title: 'Docs Crawler', desc: 'Point at any API documentation page. AI extracts endpoints, parameters, and auth — no manual spec writing.' },
            { emoji: '🔀', title: 'Multi-API Composition', desc: 'Combine multiple APIs into one MCP server. Weather + Calendar + GitHub → one unified tool set.' },
            { emoji: '⚡', title: 'Instant Generation', desc: 'From spec to runnable MCP server in under 3 seconds.' },
            { emoji: '🔐', title: 'Auth Handling', desc: 'Automatically maps API key, Bearer token, and OAuth2 to environment variables.' },
            { emoji: '📦', title: 'Complete Package', desc: 'package.json, tsconfig, Dockerfile, .env.example, README — everything you need.' },
            { emoji: '🔄', title: 'Version Management', desc: 'API updated? Diff old vs. new spec, see what changed, and download an updated server with migration guide.' },
            { emoji: '🐍', title: 'TypeScript + Python', desc: 'Choose your target. Both use official MCP SDKs and follow best practices.' },
            { emoji: '🎯', title: 'Smart Tool Naming', desc: 'Generates clear, descriptive tool names from operationIds or path patterns.' },
            { emoji: '🌐', title: 'Community Registry', desc: 'Discover, star, and fork community MCP servers. Publish your own to help others.' },
            { emoji: '💻', title: 'CLI Tool', desc: 'Generate servers from your terminal. mcpforge generate, describe, or search — no browser needed.' },
            { emoji: '🔓', title: 'Open Source', desc: 'MIT licensed. Fork it, self-host it, extend it. No vendor lock-in.' },
          ].map(({ emoji, title, desc }) => (
            <div key={title} className="flex gap-4 p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
              <span className="text-2xl">{emoji}</span>
              <div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-gray-400 text-sm">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Community Registry */}
      <section className="py-16 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-4">Community Registry</h2>
        <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
          Browse community-built MCP servers. Star your favorites, fork and customize, or deploy with one click.
        </p>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[
            { emoji: '🌐', title: 'Discover', desc: 'Browse hundreds of community MCP servers across 12 categories. Find the perfect tool for your AI agent.' },
            { emoji: '🍴', title: 'Fork & Customize', desc: 'Found something close? Fork it, tweak the spec, and generate your own version in seconds.' },
            { emoji: '🚀', title: 'Publish & Share', desc: 'Built something useful? Publish to the registry. Earn stars and help the community grow.' },
          ].map(({ emoji, title, desc }) => (
            <div key={title} className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
              <div className="text-3xl mb-3">{emoji}</div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a
            href="/registry"
            className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors inline-block border border-gray-700"
          >
            Browse Registry →
          </a>
        </div>
      </section>

      {/* CLI */}
      <section className="py-16 border-t border-gray-800">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">CLI for Power Users</h2>
            <p className="text-gray-400 mb-6">
              Generate MCP servers directly from your terminal. Pipe in specs, describe what you want, or search the registry — all without leaving the command line.
            </p>
            <div className="space-y-2 text-sm text-gray-400">
              <p><code className="text-forge-400">mcpforge generate openapi.yaml</code></p>
              <p><code className="text-forge-400">mcpforge describe &quot;weather API with forecasts&quot;</code></p>
              <p><code className="text-forge-400">mcpforge search &quot;github&quot;</code></p>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 font-mono text-sm">
            <div className="text-gray-500 mb-2">$ npm install -g mcpforge</div>
            <div className="text-gray-500 mb-2">$ mcpforge generate stripe-api.yaml -l typescript</div>
            <div className="text-green-400 mb-1">⚡ Generating TypeScript MCP server...</div>
            <div className="text-green-400 mb-1">✅ Generated 6 files in ./mcp-server/</div>
            <div className="text-green-400">   24 MCP tools created</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center border-t border-gray-800">
        <h2 className="text-3xl font-bold mb-4">Ready to forge your MCP server?</h2>
        <p className="text-gray-400 mb-8">No sign-up required. Paste your spec, get your server.</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="/generate"
            className="bg-forge-600 hover:bg-forge-500 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors inline-block"
          >
            Start Generating →
          </a>
          <a
            href="/registry"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-8 py-3 rounded-lg font-medium text-lg transition-colors inline-block"
          >
            Browse Registry →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800 text-center text-sm text-gray-500">
        <p>Built by <a href="https://github.com/Claudius-Inc" className="text-gray-400 hover:text-white">Claudius Inc.</a></p>
      </footer>
    </div>
  );
}
