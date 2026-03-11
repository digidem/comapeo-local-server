# comapeo-headless

`comapeo-headless` is a Node-first CoMapeo daemon for headless devices.

v1 supports running directly on the host with Node 24. Docker and Compose are
not part of the supported `main` branch release.

## Requirements

- Node 24.x
- npm 10+
- Linux environment suitable for local peer discovery

## Install

```bash
npm install
```

## Configuration

Required:

- `COMAPEO_DEVICE_NAME`: device name shown to other CoMapeo peers

Optional:

- `COMAPEO_DATA_DIR`: storage root, defaults to `./data`
- `COMAPEO_ROOT_KEY`: hex-encoded root key override
- `COMAPEO_AUTO_ACCEPT_INVITES`: defaults to `true`
- `COMAPEO_DEVICE_TYPE`: defaults to `desktop`
- `ONLINE_STYLE_URL`: optional style URL override
- `LOG_LEVEL`: defaults to `info`

## Run

Development:

```bash
cp .env.example .env
bun start
```

Smoke test:

```bash
node --run start:smoke
```

Production build:

```bash
npm run build
COMAPEO_DEVICE_NAME=my-device node --run start:prod
```

When `.env` exists, the daemon loads it automatically on startup. Copying
`.env.example` to `.env` is enough for a local demo service.

## Deployment

For real devices, run the daemon directly on the host and manage it with a
service manager such as `systemd`. This preserves the host LAN environment used
for mDNS peer discovery.

## Verification

```bash
npm test
npm run typecheck
node --run start:smoke
```
