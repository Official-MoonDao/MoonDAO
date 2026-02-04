#!/bin/bash
# Setup script for self-hosted GitHub Actions runner
# Run this on a fresh Ubuntu 22.04 instance

set -e

echo "=== MoonDAO Bug Agent - Runner Setup ==="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "Please run this script as a regular user, not root"
  exit 1
fi

# Get configuration
read -p "Enter your GitHub repository (e.g., Official-MoonDao/MoonDAO): " REPO
read -p "Enter your runner registration token: " TOKEN

RUNNER_VERSION="2.311.0"
RUNNER_DIR="$HOME/actions-runner"

# Update system
echo "=== Updating system packages ==="
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
echo "=== Installing Docker ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  echo "Docker installed. You may need to log out and back in for group changes."
fi

# Install Docker Compose
echo "=== Installing Docker Compose ==="
if ! command -v docker-compose &> /dev/null; then
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

# Install Node.js
echo "=== Installing Node.js 20 ==="
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install Python 3.11
echo "=== Installing Python 3.11 ==="
sudo apt-get install -y python3.11 python3.11-venv python3-pip

# Install Playwright dependencies
echo "=== Installing Playwright system dependencies ==="
sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2

# Download and configure GitHub Actions runner
echo "=== Setting up GitHub Actions runner ==="
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -f "./config.sh" ]; then
  curl -o actions-runner-linux-x64.tar.gz -L \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf ./actions-runner-linux-x64.tar.gz
  rm actions-runner-linux-x64.tar.gz
fi

# Configure runner
./config.sh --url "https://github.com/${REPO}" \
  --token "$TOKEN" \
  --name "moondao-bug-agent-$(hostname)" \
  --labels "self-hosted,linux,docker,bug-agent" \
  --work "_work" \
  --runasservice

# Install and start service
echo "=== Installing runner as service ==="
sudo ./svc.sh install
sudo ./svc.sh start

echo ""
echo "=== Setup Complete ==="
echo "Runner is now running as a service."
echo ""
echo "Useful commands:"
echo "  Check status: sudo ./svc.sh status"
echo "  View logs: sudo journalctl -u actions.runner.${REPO//\//-}.moondao-bug-agent-$(hostname).service -f"
echo "  Stop runner: sudo ./svc.sh stop"
echo "  Start runner: sudo ./svc.sh start"
echo ""
echo "NOTE: If Docker permissions aren't working, log out and back in."
