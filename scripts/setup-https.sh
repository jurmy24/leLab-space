#!/bin/bash

# HTTPS Setup Script for Local Development
# This script sets up HTTPS for the Vite development server using mkcert

set -e

echo "🔒 Setting up HTTPS for local development..."

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert is not installed"
    echo "📦 Installing mkcert..."
    
    # Check if Homebrew is available (macOS)
    if command -v brew &> /dev/null; then
        brew install mkcert
    else
        echo "❌ Please install mkcert manually:"
        echo "   - macOS: brew install mkcert"
        echo "   - Linux: Follow instructions at https://github.com/FiloSottile/mkcert#installation"
        echo "   - Windows: choco install mkcert or download from GitHub"
        exit 1
    fi
fi

echo "✅ mkcert is installed"

# Install local CA
echo "🏗️  Installing local Certificate Authority..."
mkcert -install

# Get local IP address
LOCAL_IP=""
if command -v ipconfig &> /dev/null; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
fi

if [ -z "$LOCAL_IP" ]; then
    # Linux/Unix fallback
    LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "")
fi

if [ -z "$LOCAL_IP" ]; then
    # Final fallback
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | head -1 | awk '{print $2}' | sed 's/addr://')
fi

if [ -z "$LOCAL_IP" ]; then
    echo "⚠️  Could not detect local IP address. Using localhost only."
    LOCAL_IP="localhost"
fi

echo "📍 Detected local IP: $LOCAL_IP"

# Create certs directory
mkdir -p certs

# Generate certificates
echo "🔧 Generating SSL certificates..."
cd certs

if [ "$LOCAL_IP" = "localhost" ]; then
    mkcert localhost 127.0.0.1 ::1
else
    mkcert localhost 127.0.0.1 "$LOCAL_IP" ::1
fi

cd ..

echo "✅ HTTPS setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start the development server: npm run dev"
echo "   2. Access your app at:"
echo "      - https://localhost:8080"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "      - https://$LOCAL_IP:8080 (for phone access)"
fi
echo ""
echo "📱 For phone access:"
echo "   1. Make sure your phone is on the same WiFi network"
echo "   2. Open Safari/Chrome on your phone"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "   3. Navigate to: https://$LOCAL_IP:8080"
fi
echo "   4. Accept the security warning (certificate is trusted locally)"
echo "   5. Camera access should now work properly"
echo ""
echo "🔒 The certificates are valid for 3 months and will work across devices on your local network." 
