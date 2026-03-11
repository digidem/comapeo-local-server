# comapeo-local-server

> Local-Server CoMapeo daemon for local servers

[![Node Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

`comapeo-local-server` is a Node-first CoMapeo daemon designed for local-server devices. It enables continuous synchronization and peer discovery on Linux-based devices without a graphical interface.

## Features

- **Local-Server Operation**: Runs as a background daemon without GUI requirements
- **Automatic Sync**: Continuous synchronization with CoMapeo peers over mDNS
- **Invite Management**: Auto-accepts project invitations (configurable)
- **HTTP API**: Fastify-based API for integration with other services
- **Zero Configuration**: Works out of the box with sensible defaults

## Quick Start

Get up and running in under a minute:

```bash
# Install dependencies
npm install

# Create configuration
cp .env.example .env

# Start the daemon
node --run start
```

That's it! The daemon will automatically discover and sync with other CoMapeo peers on your local network.

## Requirements

- **Node.js**: >= 24.0.0
- **npm**: >= 10.0.0
- **OS**: Linux (for mDNS peer discovery)
- **Network**: LAN environment for local peer discovery

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd comapeo-local-server

# Install dependencies
npm install
```

## Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `COMAPEO_DEVICE_NAME` | Device name shown to peers | `my-field-device` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COMAPEO_DATA_DIR` | Storage root directory | `./data` |
| `COMAPEO_ROOT_KEY` | Hex-encoded root key override | - |
| `COMAPEO_AUTO_ACCEPT_INVITES` | Auto-accept project invitations | `true` |
| `COMAPEO_DEVICE_TYPE` | Device type identifier | `desktop` |
| `ONLINE_STYLE_URL` | Custom style URL override | - |
| `LOG_LEVEL` | Logging verbosity | `info` |

### Example Configuration

```bash
# .env
COMAPEO_DEVICE_NAME=field-device-01
COMAPEO_AUTO_ACCEPT_INVITES=true
LOG_LEVEL=debug
```

## Usage

### Development Mode

```bash
# Run with TypeScript
node --run start
```

### Production Mode

```bash
# Build for production
npm run build

# Run production build
COMAPEO_DEVICE_NAME=my-device node --run start:prod
```

### Smoke Test

Verify the daemon works correctly:

```bash
node --run start:smoke
```

## Deployment

For production deployments, run the daemon directly on the host and manage it with a service manager like `systemd`. This preserves the host LAN environment required for mDNS peer discovery.

### Example systemd Service

```ini
[Unit]
Description=CoMapeo Local-Server Daemon
After=network.target

[Service]
Type=simple
User=mapeo
WorkingDirectory=/opt/comapeo-local-server
Environment="COMAPEO_DEVICE_NAME=field-device-01"
ExecStart=/usr/bin/node --run start:prod
Restart=always

[Install]
WantedBy=multi-user.target
```

## Verification

Run the test suite to verify your installation:

```bash
# Run unit tests
npm test

# Run type checking
npm run typecheck

# Run smoke test
node --run start:smoke
```

## Project Structure

```
comapeo-local-server/
├── src/
│   ├── config/          # Environment parsing and validation
│   ├── core/            # MapeoManager bootstrap and lifecycle
│   └── daemon/          # Daemon entry and invite handling
├── test/                # Unit and integration tests
└── scripts/
    └── apply-comapeo-core-sync-patch.mjs  # Postinstall patches
```

## Contributing

Contributions are welcome! Please ensure all tests pass and type checking completes before submitting a pull request.

```bash
npm test
npm run typecheck
```

## License

AGPL-3.0 - see LICENSE file for details.
