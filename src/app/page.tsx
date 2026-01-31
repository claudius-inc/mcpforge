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
          Describe what you want in plain English or upload an OpenAPI spec.
          Get a production-ready MCP server in TypeScript or Python — in seconds.
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
            <h3 className="text-lg font-semibold mb-2">Describe or Upload</h3>
            <p className="text-gray-400 text-sm">
              Describe what your server should do in plain English, or paste your OpenAPI 3.x spec. AI handles the rest.
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
            { emoji: '⚡', title: 'Instant Generation', desc: 'From spec to runnable MCP server in under 3 seconds.' },
            { emoji: '🔐', title: 'Auth Handling', desc: 'Automatically maps API key, Bearer token, and OAuth2 to environment variables.' },
            { emoji: '📦', title: 'Complete Package', desc: 'package.json, tsconfig, Dockerfile, .env.example, README — everything you need.' },
            { emoji: '🐍', title: 'TypeScript + Python', desc: 'Choose your target. Both use official MCP SDKs and follow best practices.' },
            { emoji: '🎯', title: 'Smart Tool Naming', desc: 'Generates clear, descriptive tool names from operationIds or path patterns.' },
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

      {/* CTA */}
      <section className="py-20 text-center border-t border-gray-800">
        <h2 className="text-3xl font-bold mb-4">Ready to forge your MCP server?</h2>
        <p className="text-gray-400 mb-8">No sign-up required. Paste your spec, get your server.</p>
        <a
          href="/generate"
          className="bg-forge-600 hover:bg-forge-500 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors inline-block"
        >
          Start Generating →
        </a>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800 text-center text-sm text-gray-500">
        <p>Built by <a href="https://github.com/Claudius-Inc" className="text-gray-400 hover:text-white">Claudius Inc.</a></p>
      </footer>
    </div>
  );
}
