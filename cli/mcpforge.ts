#!/usr/bin/env node
// MCPForge CLI — Generate MCP servers from the command line

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, basename, extname } from 'path';

const VERSION = '1.0.0';
const API_BASE = process.env.MCPFORGE_API_URL || 'https://mcpforge.com';

function usage() {
  console.log(`
⚡ MCPForge CLI v${VERSION} — Turn any API into an MCP Server

Usage:
  mcpforge generate <spec-file> [options]    Generate MCP server from OpenAPI spec
  mcpforge describe "<text>" [options]       Generate from plain English description
  mcpforge search <query>                    Search the public registry
  mcpforge info <listing-id>                 Get registry listing details
  mcpforge version                           Show version

Generate Options:
  --language, -l <ts|py>    Target language (default: typescript)
  --output, -o <dir>        Output directory (default: ./mcp-server)
  --name, -n <name>         Server name

Examples:
  mcpforge generate openapi.yaml
  mcpforge generate swagger.json -l python -o ./my-server
  mcpforge describe "weather API with forecast and current conditions"
  mcpforge search "github"
  `);
}

async function generateFromFile(specFile: string, options: { language: string; output: string; name?: string }) {
  const absPath = resolve(specFile);
  if (!existsSync(absPath)) {
    console.error(`❌ File not found: ${specFile}`);
    process.exit(1);
  }

  const spec = readFileSync(absPath, 'utf-8');
  const name = options.name || basename(specFile, extname(specFile));

  console.log(`⚡ Generating ${options.language} MCP server from ${specFile}...`);

  // Try local generation first (if libs available), fall back to API
  try {
    const { parseOpenAPISpec } = await import('../src/lib/parser/openapi-parser');
    const { mapSpecToMCPServer } = await import('../src/lib/mapper/tool-mapper');
    const { generateTypeScriptServer } = await import('../src/lib/generator/typescript');
    const { generatePythonServer } = await import('../src/lib/generator/python');

    const parseResult = parseOpenAPISpec(spec);
    if (!parseResult.success || !parseResult.spec) {
      console.error(`❌ Failed to parse spec: ${parseResult.errors.map(e => e.message).join(', ')}`);
      process.exit(1);
    }
    const mcpConfig = mapSpecToMCPServer(parseResult.spec);

    const fileMap = options.language === 'python'
      ? generatePythonServer(mcpConfig)
      : generateTypeScriptServer(mcpConfig);

    // Write files to output directory
    const outDir = resolve(options.output);
    mkdirSync(outDir, { recursive: true });

    const fileEntries = Object.entries(fileMap);
    for (const [filename, content] of fileEntries) {
      const filePath = resolve(outDir, filename);
      const dir = resolve(filePath, '..');
      mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
    }

    console.log(`✅ Generated ${fileEntries.length} files in ${options.output}/`);
    console.log(`   ${mcpConfig.tools.length} MCP tools created`);
    console.log(`\nTo run:`);
    if (options.language === 'python') {
      console.log(`   cd ${options.output} && pip install -r requirements.txt && python server.py`);
    } else {
      console.log(`   cd ${options.output} && npm install && npx ts-node src/index.ts`);
    }
  } catch {
    // Fall back to API
    console.log('  Using MCPForge API...');
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spec,
        language: options.language,
        mode: 'preview',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.error(`❌ Generation failed: ${err.error}`);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`✅ Parsed ${data.tools?.length || 0} MCP tools`);
    console.log(`   Use the web UI at ${API_BASE}/generate for full download.`);
  }
}

async function generateFromDescription(description: string, options: { language: string; output: string }) {
  console.log(`🤖 Generating MCP server from description...`);
  console.log(`   "${description}"\n`);

  const res = await fetch(`${API_BASE}/api/describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    console.error(`❌ Failed: ${err.error}`);
    process.exit(1);
  }

  const data = await res.json();
  if (data.spec) {
    console.log(`✅ AI generated OpenAPI spec`);
    // Save spec and generate
    const specPath = resolve(options.output, 'openapi.yaml');
    mkdirSync(resolve(options.output), { recursive: true });
    writeFileSync(specPath, data.spec, 'utf-8');
    console.log(`   Spec saved to ${specPath}`);
    console.log(`   Run: mcpforge generate ${specPath} -l ${options.language}`);
  }
}

async function searchRegistry(query: string) {
  console.log(`🔍 Searching registry for "${query}"...\n`);

  const res = await fetch(`${API_BASE}/api/registry?q=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) {
    console.error('❌ Search failed');
    process.exit(1);
  }

  const data = await res.json();
  if (data.listings.length === 0) {
    console.log('No results found.');
    return;
  }

  console.log(`Found ${data.total} result${data.total !== 1 ? 's' : ''}:\n`);
  for (const l of data.listings) {
    console.log(`  ${l.title} (v${l.version})`);
    console.log(`    ${l.description}`);
    console.log(`    ⭐ ${l.stars_count}  🍴 ${l.forks_count}  🔧 ${l.tool_count} tools  📦 ${l.language}`);
    console.log(`    ID: ${l.id}\n`);
  }
}

async function getInfo(id: string) {
  const res = await fetch(`${API_BASE}/api/registry/${id}`);
  if (!res.ok) {
    console.error('❌ Listing not found');
    process.exit(1);
  }

  const l = await res.json();
  console.log(`\n⚡ ${l.title} v${l.version}`);
  console.log(`   ${l.description}`);
  console.log(`\n   Author: ${l.author_username || 'Unknown'}`);
  console.log(`   Language: ${l.language}`);
  console.log(`   Tools: ${l.tool_names.join(', ')}`);
  console.log(`   Stars: ${l.stars_count}  Forks: ${l.forks_count}`);
  if (l.github_repo) console.log(`   GitHub: ${l.github_repo}`);
  if (l.api_source_url) console.log(`   API Docs: ${l.api_source_url}`);
  console.log(`\n   Download: ${API_BASE}/registry/${l.id}`);
}

// --- Parse args ---
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  usage();
  process.exit(0);
}

const command = args[0];

function getFlag(flag: string, short?: string): string | undefined {
  for (let i = 1; i < args.length; i++) {
    if (args[i] === flag || (short && args[i] === short)) {
      return args[i + 1];
    }
  }
  return undefined;
}

switch (command) {
  case 'version':
  case '--version':
  case '-v':
    console.log(`mcpforge v${VERSION}`);
    break;

  case 'generate': {
    const specFile = args[1];
    if (!specFile) { console.error('❌ Specify a spec file. Usage: mcpforge generate <file>'); process.exit(1); }
    const lang = getFlag('--language', '-l') || 'typescript';
    const output = getFlag('--output', '-o') || './mcp-server';
    const name = getFlag('--name', '-n');
    generateFromFile(specFile, { language: lang, output, name });
    break;
  }

  case 'describe': {
    const desc = args[1];
    if (!desc) { console.error('❌ Provide a description. Usage: mcpforge describe "..."'); process.exit(1); }
    const lang = getFlag('--language', '-l') || 'typescript';
    const output = getFlag('--output', '-o') || './mcp-server';
    generateFromDescription(desc, { language: lang, output });
    break;
  }

  case 'search': {
    const query = args.slice(1).join(' ');
    if (!query) { console.error('❌ Provide a search query. Usage: mcpforge search <query>'); process.exit(1); }
    searchRegistry(query);
    break;
  }

  case 'info': {
    const id = args[1];
    if (!id) { console.error('❌ Provide a listing ID. Usage: mcpforge info <id>'); process.exit(1); }
    getInfo(id);
    break;
  }

  default:
    console.error(`❌ Unknown command: ${command}`);
    usage();
    process.exit(1);
}
