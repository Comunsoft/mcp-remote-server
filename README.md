# MCP Remote Server

MCP (Model Context Protocol) Remote Server for Claude AI integration running on VPS.

## 🚀 Quick Access

**Server is running at**: `http://212.224.93.149:3000`

## 📡 Endpoints

- **SSE Endpoint**: `http://212.224.93.149:3000/sse`
- **Health Check**: `http://212.224.93.149:3000/health`
- **Server Info**: `http://212.224.93.149:3000/`
- **Test Tool**: `POST http://212.224.93.149:3000/test-tool`

## 🛠️ Available Tools

1. **add** - Add two numbers
2. **multiply** - Multiply two numbers
3. **get_weather** - Get weather for a location
4. **get_time** - Get current time
5. **system_info** - Get VPS system information

## 🔌 Connect with Claude Desktop

Add to your Claude Desktop configuration file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vps-server": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/mcp-remote-client",
        "sse",
        "http://212.224.93.149:3000/sse"
      ]
    }
  }
}
```

## 🧪 Test Tools

```bash
# Test add tool
curl -X POST http://212.224.93.149:3000/test-tool \
  -H "Content-Type: application/json" \
  -d '{"tool":"add","args":{"a":10,"b":20}}'

# Test weather tool
curl -X POST http://212.224.93.149:3000/test-tool \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_weather","args":{"location":"Madrid"}}'

# Test system info
curl -X POST http://212.224.93.149:3000/test-tool \
  -H "Content-Type: application/json" \
  -d '{"tool":"system_info","args":{}}'
```

## 📦 Installation (for development)

```bash
git clone https://github.com/Comunsoft/mcp-remote-server.git
cd mcp-remote-server
npm install
npm start
```

## 📝 License

MIT