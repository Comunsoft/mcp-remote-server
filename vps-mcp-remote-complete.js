#!/usr/bin/env node

/**
 * Servidor MCP Remoto ContPAQi COMPLETO - CommonJS Version
 * Usa todas las 85 herramientas del sistema local convertidas a CommonJS
 */

const express = require('express');
const cors = require('cors');

const app = express();

// Configuración CORS para MCP remoto
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false
}));

app.use(express.json({ limit: '50mb' }));

// Variables para los servicios (se cargarán dinámicamente)
let getToolsList = null;
let handleToolCall = null;
let connectToDatabase = null;
let closeConnection = null;

// Función para cargar módulos CommonJS
function loadCommonJSModules() {
  try {
    // Requerir los módulos CommonJS
    const toolsModule = require('./src/tools/index.js');
    const dbModule = require('./src/database/connection.js');
    
    // Asignar funciones
    getToolsList = toolsModule.getToolsList;
    handleToolCall = toolsModule.handleToolCall;
    connectToDatabase = dbModule.connectToDatabase;
    closeConnection = dbModule.closeConnection;
    
    console.log('✅ Módulos CommonJS cargados exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error cargando módulos:', error);
    return false;
  }
}

// ✅ ENDPOINT MCP REMOTO PRINCIPAL - /sse  
app.post('/sse', async (req, res) => {
  try {
    const { method, params, id } = req.body;
    console.log(`[${new Date().toISOString()}] MCP Remote: ${method}`);
    
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'contpaqi-mcp-remote-complete',
            version: '1.0.0'
          }
        };
        break;
        
      case 'notifications/initialized':
        // Respuesta vacía para notifications
        res.json({
          jsonrpc: '2.0',
          id: id
        });
        return;
        
      case 'tools/list':
        if (!getToolsList) {
          throw new Error('Servicios no inicializados');
        }
        const tools = getToolsList();
        result = { tools };
        break;
        
      case 'prompts/list':
        result = { prompts: [] };
        break;
        
      case 'resources/list':
        result = { resources: [] };
        break;
        
      case 'tools/call':
        if (!handleToolCall) {
          throw new Error('Servicios no inicializados');
        }
        const { name, arguments: args } = params;
        const toolResult = await handleToolCall(name, args || {});
        
        result = {
          content: [{
            type: 'text',
            text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
          }],
          isError: false
        };
        break;
        
      default:
        throw new Error(`Método no soportado: ${method}`);
    }
    
    res.json({
      jsonrpc: '2.0',
      id: id,
      result: result
    });
    
  } catch (error) {
    console.error('❌ Error procesando request MCP:', error);
    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
});

// Endpoint GET para /sse - info del servidor
app.get('/sse', async (req, res) => {
  try {
    const toolsCount = getToolsList ? getToolsList().length : 0;
    res.json({
      name: 'ContPAQi MCP Remote Server COMPLETO',
      version: '1.0.0',
      protocol: 'MCP Remote 2024-11-05',
      tools: toolsCount,
      database: 'ContPAQi Comercial (adESCUELA_KEMPER)',
      endpoints: {
        sse: 'POST /sse - MCP Remote endpoint',
        health: 'GET /health - Health check'
      },
      usage: 'Use with mcp-remote: npx mcp-remote http://212.224.93.149:3000/sse'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const toolsCount = getToolsList ? getToolsList().length : 0;
    const dbConnected = connectToDatabase ? 'initialized' : 'not_initialized';
    
    res.json({
      status: 'healthy',
      server: 'ContPAQi MCP Remote Server COMPLETO',
      database: dbConnected,
      tools: toolsCount,
      services_loaded: !!getToolsList,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', async (req, res) => {
  try {
    const toolsCount = getToolsList ? getToolsList().length : 0;
    
    res.json({
      name: 'ContPAQi MCP Remote Server COMPLETO',
      version: '1.0.0',
      description: 'Servidor MCP remoto para ContPAQi Comercial - TODAS las 85 herramientas',
      database: 'adESCUELA_KEMPER (64.20.48.25:1433)',
      tools: toolsCount,
      endpoints: {
        '/': 'Server info',
        '/sse': 'MCP Remote endpoint (GET/POST)', 
        '/health': 'Health check'
      },
      usage: {
        'claude_desktop_config.json': {
          mcpServers: {
            "contpaqi-remote": {
              command: "npx",
              args: ["mcp-remote", "http://212.224.93.149:3000/sse"]
            }
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicializar servidor
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('🔄 Cargando módulos CommonJS...');
    const modulesLoaded = loadCommonJSModules();
    
    if (!modulesLoaded) {
      throw new Error('No se pudieron cargar los módulos CommonJS');
    }
    
    console.log('🔄 Conectando a base de datos...');
    await connectToDatabase();
    
    // Iniciar servidor HTTP
    app.listen(PORT, '0.0.0.0', () => {
      const toolsCount = getToolsList ? getToolsList().length : 0;
      console.log(`
🚀 ContPAQi MCP Remote Server COMPLETO iniciado exitosamente!

📡 Server Details:
   IP: 212.224.93.149
   Port: ${PORT}
   Protocol: MCP Remote 2024-11-05

🔌 Endpoints:
   MCP Remote: http://212.224.93.149:${PORT}/sse
   Health: http://212.224.93.149:${PORT}/health
   Info: http://212.224.93.149:${PORT}/
   
💾 Base de datos: adESCUELA_KEMPER (64.20.48.25:1433)
🛠️ Herramientas: ${toolsCount} funciones ContPAQi

📋 Uso con Claude Desktop:
   command: "npx"
   args: ["mcp-remote", "http://212.224.93.149:${PORT}/sse"]

✅ Servidor MCP remoto COMPLETO listo!
      `);
    });
    
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejo de shutdown
process.on('SIGTERM', async () => {
  console.log('Cerrando conexiones...');
  if (closeConnection) {
    await closeConnection();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Cerrando conexiones...');  
  if (closeConnection) {
    await closeConnection();
  }
  process.exit(0);
});

startServer();