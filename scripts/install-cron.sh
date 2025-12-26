#!/bin/bash
# LunchMonitor Cron Installation Script
# Usage: ./install-cron.sh [config_path] [bin_path] [log_path]

set -e

CONFIG_PATH="${1:-$HOME/.config/lunchmonitor/config.json}"
BIN_PATH="${2:-/usr/local/bin/lunchmonitor}"
LOG_PATH="${3:-$HOME/.local/log/lunchmonitor.log}"
INTERVAL="${4:-6}"  # Hours between checks

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}LunchMonitor Cron Installer${NC}"
echo "=============================="
echo ""

# Check if binary exists
if [ ! -f "$BIN_PATH" ]; then
    echo -e "${RED}Error: LunchMonitor binary not found at $BIN_PATH${NC}"
    echo "Please build the project first: bun run build:cli"
    echo "Then copy the binary: sudo cp packages/cli/dist/lunchmonitor $BIN_PATH"
    exit 1
fi

# Create directories
echo "Creating directories..."
mkdir -p "$(dirname "$CONFIG_PATH")"
mkdir -p "$(dirname "$LOG_PATH")"

# Check if config exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${YELLOW}Warning: Config file not found at $CONFIG_PATH${NC}"
    echo "Run 'lunchmonitor init' to create a default config"
fi

# Generate cron expression
CRON_EXPR="0 */${INTERVAL} * * *"
CRON_CMD="$BIN_PATH check --config $CONFIG_PATH >> $LOG_PATH 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "lunchmonitor"; then
    echo -e "${YELLOW}Existing LunchMonitor cron job found. Replacing...${NC}"
    # Remove existing entry
    crontab -l 2>/dev/null | grep -v "lunchmonitor" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_EXPR $CRON_CMD") | crontab -

echo ""
echo -e "${GREEN}Cron job installed successfully!${NC}"
echo ""
echo "Configuration:"
echo "  Binary:    $BIN_PATH"
echo "  Config:    $CONFIG_PATH"
echo "  Log file:  $LOG_PATH"
echo "  Schedule:  Every $INTERVAL hours"
echo ""
echo "Cron entry:"
echo "  $CRON_EXPR $CRON_CMD"
echo ""
echo "To view logs:"
echo "  tail -f $LOG_PATH"
echo ""
echo "To remove the cron job:"
echo "  crontab -l | grep -v lunchmonitor | crontab -"
