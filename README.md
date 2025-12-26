# LunchMonitor

Budget monitoring service for [LunchMoney](https://lunchmoney.app/) that alerts you when spending approaches or exceeds budget thresholds.

## Features

- **Budget Monitoring**: Checks your LunchMoney budgets at configurable intervals
- **Flexible Alerts**: Set percentage or absolute thresholds (e.g., alert at 80% and 100%)
- **Multiple Channels**: Email and SMS notifications (via carrier email gateways)
- **Smart Cooldowns**: Prevent alert spam with configurable cooldown policies
- **Quiet Hours**: Suppress notifications during specified hours
- **Web UI**: Easy configuration editor (runs locally)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0 or later)
- LunchMoney account with API access

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd LunchMonitor

# Install dependencies
bun install

# Build the CLI
bun run build:cli
```

### Configuration

1. **Get your LunchMoney API token** from [Developer Settings](https://my.lunchmoney.app/developers)

2. **Create a config file**:
   ```bash
   # Create default config
   bun run cli init

   # Or use the web UI
   bun run dev:web
   ```

3. **Set environment variables**:
   ```bash
   export LUNCHMONEY_TOKEN="your_api_token"
   export SMTP_USER="your_email@gmail.com"
   export SMTP_PASS="your_app_password"
   ```

4. **Test your configuration**:
   ```bash
   # Validate config
   bun run cli validate

   # Check budget status
   bun run cli status

   # Send test notification
   bun run cli test-notify --channel email
   ```

### Setting Up Cron

```bash
# Build compiled binary
bun run build:cli

# Copy to system path
sudo cp packages/cli/dist/lunchmonitor /usr/local/bin/

# Install cron job (runs every 6 hours)
./scripts/install-cron.sh
```

Or manually add to crontab:
```bash
0 */6 * * * /usr/local/bin/lunchmonitor check --config ~/.config/lunchmonitor/config.json >> ~/.local/log/lunchmonitor.log 2>&1
```

## CLI Commands

```bash
lunchmonitor <command> [options]

Commands:
  check        Check budgets and send notifications if thresholds exceeded
  status       Show current budget status (no notifications)
  validate     Validate configuration file
  test-notify  Send a test notification
  init         Create a default configuration file

Options:
  --config, -c <path>    Path to config file
  --dry-run              Check without sending notifications
  --verbose, -v          Show detailed output
  --channel <email|sms>  Channel for test-notify
  --help, -h             Show help
```

## Configuration

Configuration is stored in JSON format at `~/.config/lunchmonitor/config.json`.

### Example Config

```json
{
  "version": "1.0",
  "lunchmoney": {
    "apiToken": "${LUNCHMONEY_TOKEN}"
  },
  "notifications": {
    "email": {
      "enabled": true,
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "${SMTP_USER}",
          "pass": "${SMTP_PASS}"
        }
      },
      "from": "LunchMonitor <alerts@example.com>",
      "to": ["your-email@example.com"]
    }
  },
  "policies": [
    {
      "id": "uuid-here",
      "name": "Default Alert",
      "enabled": true,
      "scope": { "type": "global" },
      "thresholds": [
        { "type": "percentage", "operator": "gte", "value": 80 },
        { "type": "percentage", "operator": "gte", "value": 100 }
      ],
      "channels": ["email"],
      "cooldown": { "type": "once_per_threshold" }
    }
  ],
  "settings": {
    "timezone": "America/New_York",
    "quietHours": { "start": "22:00", "end": "08:00" }
  }
}
```

### Environment Variable Substitution

Use `${VAR_NAME}` syntax in config values to reference environment variables. This keeps sensitive data like API tokens out of the config file.

### Alert Policies

- **Scope**: `global` (all categories), `category` (specific IDs), or `category_group`
- **Thresholds**: Percentage (e.g., 80%) or absolute amounts
- **Channels**: `email`, `sms`, or both
- **Cooldown**: `once_per_threshold`, `once_per_day`, or `every_check`

### SMS via Email Gateway

SMS notifications work by sending emails to carrier gateway addresses:

| Carrier   | Domain                    |
|-----------|---------------------------|
| Verizon   | @vtext.com                |
| AT&T      | @txt.att.net              |
| T-Mobile  | @tmomail.net              |
| Sprint    | @messaging.sprintpcs.com  |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type checking
bun run typecheck

# Development - Web UI
bun run dev:web

# Development - CLI
bun run cli <command>

# Build all packages
bun run build
```

## Project Structure

```
LunchMonitor/
├── packages/
│   ├── core/          # Shared logic (API client, alerts, notifications)
│   ├── cli/           # Command-line interface
│   └── web/           # Configuration web UI
├── config/            # Example configuration
└── scripts/           # Deployment helpers
```

## License

MIT
