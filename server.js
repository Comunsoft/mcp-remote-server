const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const clients = new Set();

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

app.get('/sse', (req, res) => {
  console.log('SSE connection from:', req.ip);
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.write('data: {"type":"connection","status":"connected"}\n\n');
  clients.add(res);
  
  req.on('close', () => {
    clients.delete(res);
  });
});

app.post('/sse', (req, res) => {
  handleMCPMessage(req, res);
});

function handleMCPMessage(req, res) {
  const { method, params, id, jsonrpc } = req.body;
  console.log('Received MCP message:', method, 'id:', id, 'jsonrpc:', jsonrpc);
  
  // ✅ VALIDACIÓN JSON-RPC ESTRICTA
  if (!jsonrpc || jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32600,
        message: 'Invalid Request - missing or invalid jsonrpc field'
      }
    });
  }
  
  if (!method || typeof method !== 'string') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32600,
        message: 'Invalid Request - missing or invalid method field'
      }
    });
  }
  
  // ✅ NORMALIZAR ID COMO NÚMERO
  let validId = null;
  if (id !== undefined && id !== null) {
    if (typeof id === 'number') {
      validId = id;
    } else if (typeof id === 'string' && !isNaN(Number(id))) {
      validId = Number(id);
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid Request - id must be number or numeric string'
        }
      });
    }
  }
  
  try {
    let response;
    
    switch (method) {
      case 'initialize':
        response = {
          protocolVersion: '2025-06-18',
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
        return res.json({
          jsonrpc: '2.0',
          id: validId,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        });
    }
    
    // ✅ RESPUESTA JSON-RPC PERFECTA
    const jsonRpcResponse = {
      jsonrpc: '2.0',
      id: validId,
      result: response
    };
    
    console.log('Sending response:', JSON.stringify(jsonRpcResponse, null, 2));
    res.json(jsonRpcResponse);
    
  } catch (error) {
    console.error('Error handling message:', error);
    
    // ✅ ERROR JSON-RPC PERFECTA
    const jsonRpcError = {
      jsonrpc: '2.0',
      id: validId,
      error: {
        code: -32603,
        message: error.message,
        data: { stack: error.stack }
      }
    };
    
    console.log('Sending error:', JSON.stringify(jsonRpcError, null, 2));
    res.json(jsonRpcError);
  }
}

app.post('/message', handleMCPMessage);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    server: 'VPS MCP Server',
    activeConnections: clients.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'VPS MCP Remote Server',
    version: '1.0.0',
    protocol: 'MCP 2025-06-18',
    endpoints: {
      sse: '/sse (GET/POST)',
      message: '/message',  
      health: '/health'
    },
    tools: tools.map(t => ({ name: t.name, description: t.description }))
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VPS MCP Server running on ${PORT}`);
  console.log(`📡 Endpoints: /sse, /message, /health`);
  console.log(`🛠️ Tools: ${tools.map(t => t.name).join(', ')}`);
});