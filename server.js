const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const clients = new Set();

// ✅ ESQUEMAS CORREGIDOS - Con additionalProperties y tipos precisos
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
      required: ['a', 'b'],
      additionalProperties: false
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
      required: ['a', 'b'],
      additionalProperties: false
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
      required: ['location'],
      additionalProperties: false
    }
  },
  {
    name: 'get_time',
    description: 'Get current time',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'Timezone (e.g., UTC, EST)' }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: 'system_info',
    description: 'Get VPS system information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  }
];

function executeTool(name, args) {
  switch (name) {
    case 'add':
      // ✅ Validación de entrada
      if (typeof args.a !== 'number' || typeof args.b !== 'number') {
        throw new Error('Both a and b must be numbers');
      }
      return { result: args.a + args.b };
      
    case 'multiply':
      if (typeof args.a !== 'number' || typeof args.b !== 'number') {
        throw new Error('Both a and b must be numbers');
      }
      return { result: args.a * args.b };
      
    case 'get_weather':
      if (typeof args.location !== 'string') {
        throw new Error('Location must be a string');
      }
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

// ✅ ENDPOINT CORREGIDO - Mejor manejo de errores
app.post('/message', (req, res) => {
  const { method, params, id } = req.body;
  console.log('Received MCP message:', method);
  
  try {
    let response;
    
    switch (method) {
      case 'initialize':
        response = {
          protocolVersion: '2025-06-18',  // ✅ Versión actualizada
          capabilities: {
            tools: { listChanged: true }
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
        // ✅ Validación mejorada de parámetros
        if (!params || !params.name) {
          throw new Error('Missing tool name in params');
        }
        
        const { name, arguments: args } = params;
        const result = executeTool(name, args || {});
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
    
    // ✅ Respuesta JSON-RPC estándar
    res.json({
      jsonrpc: '2.0',
      id: id,
      result: response
    });
    
  } catch (error) {
    console.error('Error handling message:', error);
    // ✅ Respuesta de error JSON-RPC estándar
    res.json({
      jsonrpc: '2.0',
      id: id,
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
    protocol: 'MCP 2025-06-18',
    endpoints: {
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
  console.log(`   Message: http://212.224.93.149:${PORT}/message`);
  console.log(`   Health: http://212.224.93.149:${PORT}/health`);
  console.log(`   Info: http://212.224.93.149:${PORT}/`);
  console.log(`\n🛠️ Available tools: ${tools.map(t => t.name).join(', ')}`);
  console.log(`\n✅ Server is ready for MCP client connections!`);
});