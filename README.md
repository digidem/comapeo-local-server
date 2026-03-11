# comapeo-headless Docker investigation

This branch keeps the Docker and Compose experiments for `comapeo-headless`.

It is not the supported v1 release path. The supported release branch is
`main`, which documents direct host-Node deployment.

## Scope

This branch preserves:

- `Dockerfile`
- `docker-compose.yml`
- Docker readiness marker support
- Docker discovery notes in `DOCKER_DISCOVERY_FINDINGS.md`

## Current status

The daemon starts in Docker, but the Docker runtime tested here did not provide
reliable LAN discovery for Android peers. The current findings point to the
runtime and network model, not the daemon bootstrap path itself.

## Verification

```bash
npm test
npm run typecheck
```

For the investigation context and next directions, see
`DOCKER_DISCOVERY_FINDINGS.md`.

---

## Docker Investigation (Preserved for Reference)

This branch preserves Docker and Compose experiments for `comapeo-local-server`. Note that this is not the supported v1 release path - the supported release branch is `main`, which documents direct host-Node deployment.

### Scope

The investigation preserves:

- `Dockerfile`
- Docker readiness marker support
- Docker discovery notes in `DOCKER_DISCOVERY_FINDINGS.md`

### Current Status

The daemon starts in Docker, but the Docker runtime tested here did not provide reliable LAN discovery for Android peers. The current findings point to the runtime and network model, not the daemon bootstrap path itself.

For the investigation context and next directions, see `DOCKER_DISCOVERY_FINDINGS.md`.
