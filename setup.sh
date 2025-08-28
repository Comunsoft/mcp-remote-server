#!/bin/bash

# MCP Server VPS Setup Script

echo "🚀 Starting MCP Server setup..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
echo "📦 Installing PM2..."
npm install -g pm2

# Clone repository
echo "📥 Cloning repository..."
cd /root
git clone https://github.com/Comunsoft/mcp-remote-server.git
cd mcp-remote-server

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start with PM2
echo "🎯 Starting server with PM2..."
pm2 start server.js --name mcp-server
pm2 save
pm2 startup systemd -u root --hp /root

# Open firewall port
echo "🔓 Opening port 3000..."
ufw allow 3000

echo "✅ Setup complete!"
echo "🌐 Server running at: http://212.224.93.149:3000"
echo "📡 SSE Endpoint: http://212.224.93.149:3000/sse"