const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Store active SSE connections
const clients = new Set();

// MCP Tools definition
const tools = [
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' }
      },
      required: ['location']
    }
  },
  {
    name: 'get_time',
    description: 'Get current time',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'Timezone (e.g., UTC, EST)' }
      }
    }
  },
  {
    name: 'system_info',
    description: 'Get VPS system information',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle tool execution
function executeTool(name, args) {
  switch (name) {
    case 'add':
      return { result: args.a + args.b };
      
    case 'multiply':
      return { result: args.a * args.b };
      
    case 'get_weather':
      // Simulated weather data
      return {
        location: args.location,
        temperature: Math.floor(Math.random() * 30) + 10,
        condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(Math.random() * 50) + 30
      };
      
    case 'get_time':
      const now = new Date();
      return {
        time: now.toLocaleTimeString(),
        date: now.toLocaleDateString(),
        timezone: args.timezone || 'UTC',
        timestamp: now.toISOString()
      };
      
    case 'system_info':
      return {
        platform: process.platform,
        nodeVersion: process.version,
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`,
        uptime: `${Math.round(process.uptime() / 60)} minutes`
      };
      
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// SSE endpoint for MCP protocol
app.get('/sse', (req, res) => {
  console.log('New SSE client connected from:', req.ip);
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Send initial connection message
  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '1.0.0',
      capabilities: {
        tools: {
          listChanged: true
        }
      },
      serverInfo: {
        name: 'vps-mcp-server',
        version: '1.0.0'
      }
    }
  };
  
  res.write(`data: ${JSON.stringify(initMessage)}\n\n`);
  
  // Add client to active connections
  clients.add(res);
  
  // Send keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    res.write(':ping\n\n');
  }, 30000);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE client disconnected');
    clearInterval(keepAlive);
    clients.delete(res);
    res.end();
  });
});

// Handle MCP messages
app.post('/message', (req, res) => {
  const { method, params, id } = req.body;
  console.log('Received MCP message:', method);
  
  try {
    let response;
    
    switch (method) {
      case 'initialize':
        response = {
          protocolVersion: '1.0.0',
          capabilities: {
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: 'vps-mcp-server',
            version: '1.0.0'
          }
        };
        break;
        
      case 'tools/list':
        response = { tools };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        const result = executeTool(name, args);
        response = {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
        break;
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    
    // Send response
    const mcpResponse = {
      jsonrpc: '2.0',
      id: id || null,
      result: response
    };
    
    res.json(mcpResponse);
    
    // Broadcast to SSE clients if needed
    if (clients.size > 0) {
      const sseMessage = `data: ${JSON.stringify(mcpResponse)}\n\n`;
      clients.forEach(client => {
        client.write(sseMessage);
      });
    }
    
  } catch (error) {
    console.error('Error handling message:', error);
    res.json({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    server: 'VPS MCP Server',
    activeConnections: clients.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Root endpoint - server info
app.get('/', (req, res) => {
  res.json({
    name: 'VPS MCP Remote Server',
    version: '1.0.0',
    protocol: 'MCP 1.0.0',
    endpoints: {
      sse: '/sse',
      message: '/message',
      health: '/health',
      test: '/test-tool'
    },
    tools: tools.map(t => ({ name: t.name, description: t.description })),
    server_ip: '212.224.93.149'
  });
});

// Test endpoint to manually call tools
app.post('/test-tool', (req, res) => {
  const { tool, args } = req.body;
  try {
    const result = executeTool(tool, args || {});
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 VPS MCP Remote Server started successfully!`);
  console.log(`\n📡 Server Details:`);
  console.log(`   IP: 212.224.93.149`);
  console.log(`   Port: ${PORT}`);
  console.log(`\n🔌 Endpoints:`);
  console.log(`   SSE: http://212.224.93.149:${PORT}/sse`);
  console.log(`   Health: http://212.224.93.149:${PORT}/health`);
  console.log(`   Info: http://212.224.93.149:${PORT}/`);
  console.log(`\n🛠️ Available tools: ${tools.map(t => t.name).join(', ')}`);
  console.log(`\n✅ Server is ready for MCP client connections!`);
});