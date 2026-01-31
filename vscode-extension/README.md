# MCPForge VS Code Extension

Generate MCP (Model Context Protocol) servers directly from VS Code. Turn any OpenAPI spec into a working MCP server with one click.

## Features

### ⚡ Generate from OpenAPI Specs
- Open any `.yaml`, `.yml`, or `.json` OpenAPI spec
- Click the **⚡ Generate MCP Server** CodeLens that appears above the `openapi:` line
- Choose TypeScript or Python target
- Download a ready-to-run MCP server ZIP

### 🤖 Generate from Description
- Run **MCPForge: Generate from Description** from the command palette
- Describe the API in plain English: *"weather API with forecast and current conditions"*
- AI generates the OpenAPI spec, then builds the MCP server

### 🔍 Browse the Registry
- Sidebar panel with categorized community servers (AI/ML, Finance, DevTools, etc.)
- Search across all published servers
- One-click to view details and download

### 📋 Recent Generations
- Track your recent generations in the sidebar
- Quick access to generated server files

## Usage

1. **From a spec file:** Open an OpenAPI spec → click the CodeLens → pick language → save ZIP
2. **From description:** `Cmd+Shift+P` → "MCPForge: Generate from Description" → describe → generate
3. **From clipboard:** `Cmd+Shift+P` → "MCPForge: Generate from Clipboard Spec"
4. **Registry:** Click the ⚡ icon in the activity bar → browse or search

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `mcpforge.apiUrl` | `https://mcpforge.com` | MCPForge API URL |
| `mcpforge.defaultLanguage` | `typescript` | Default target language |
| `mcpforge.autoDetectSpecs` | `true` | Show CodeLens on OpenAPI files |
| `mcpforge.outputDirectory` | `./mcp-server` | Default output directory |

## Requirements

- VS Code 1.85+
- Internet connection (calls MCPForge API)

## Links

- [MCPForge](https://mcpforge.com) — Web app
- [Registry](https://mcpforge.com/registry) — Browse community servers
- [CLI](https://www.npmjs.com/package/mcpforge) — Command-line tool
