# Docker Discovery Findings

## Scope

This note captures the investigation into why `comapeo-headless` is discoverable
from Android when run directly with Node on the host, but is not discoverable
when run through `docker compose`.

## Short Answer

On this machine, the Docker runtime is the blocker, not the CoMapeo daemon
logic.

The direct host-node run is needed here because the Docker container does not
appear to share the real Wi-Fi LAN namespace that Android can reach. In this
environment, `network_mode: host` is not exposing the same effective network
view as the host process.

## Findings

### 1. The daemon startup path is healthy

- The headless daemon reaches:
  - config load
  - root-key load
  - `MapeoManager` init
  - device-info write
  - local peer discovery server startup
  - mDNS advertisement call
  - invite handler startup
- This means the failure is not a simple startup crash or missed invite
  subscription.

### 2. Bare Node on the host is visible to Android

- Running the daemon directly with Node on the host made the device show up on
  the phone.
- `avahi-browse -rt _comapeo._tcp` showed the host-node CoMapeo service on the
  host LAN address.

## 3. The container claims to advertise mDNS, but the LAN does not see it

- With Docker Compose, the daemon logs report:
  - local peer discovery server started
  - mDNS service advertised
  - daemon ready
- However, the expected `_comapeo._tcp` service from the container was not
  visible as a usable LAN advertisement in the host browse results.
- That means `service.advertise()` succeeding inside the container is not
  enough to conclude Android can discover the service.

### 4. The container does not see the real Wi-Fi interface

- From inside the running container, `os.networkInterfaces()` showed interfaces
  such as:
  - `tap0` with `10.0.2.100`
  - `docker0` with `172.17.0.1`
- It did not show the host Wi-Fi interface/address that the phone is actually
  using on the LAN.
- The working host-node path, by contrast, resolved to the real host-side LAN
  address (`10.208.159.116` during this test session).

### 5. This Docker environment is rootless

- `docker info` reported rootless security options.
- `docker context ls` showed the daemon accessed through
  `unix:///run/user/1000/docker.sock`.
- In this rootless setup, `network_mode: host` is not behaving like "true host
  Wi-Fi networking" for mDNS discovery purposes.

### 6. `@homebridge/ciao` is not the core bug, but it is affected by the runtime

- `@homebridge/ciao` advertises on the interfaces it detects.
- If the container sees the wrong interfaces, it will advertise against the
  wrong network view.
- So the app code can be correct and still fail to be discoverable when the
  container runtime presents an unusable interface set.

### 7. Attempted Docker-side workaround: publish through host Avahi

- An Avahi-based workaround was attempted from inside the container so the host
  would publish `_comapeo._tcp` instead of `ciao`.
- Result: failed.
- Observed error:

```text
Failed to create client object: An unexpected D-Bus error occurred
```

- This failed even after testing the usual container D-Bus prerequisites such as
  mounting the system bus socket and mounting the host machine-id.

### 8. Current conclusion

- On this machine, the Docker discovery path is not reliably fixable by a small
  daemon code change alone.
- The primary issue is the Docker runtime/network model, not invite handling or
  peer discovery server startup inside CoMapeo.

## Why Running Directly On The Host Was Needed

That step was needed because it isolates the variable that matters most:
whether the daemon logic is broken, or whether Docker is breaking LAN
visibility.

Once the same daemon became visible on Android outside Docker, the problem
stopped being "CoMapeo headless discovery is broken" and became
"this Docker networking setup cannot expose the service correctly to the LAN."

## Evidence Collected

- Compose logs show successful startup and claimed mDNS advertisement.
- Host-node run was visible to Android.
- Host browse saw Android and host-node `_comapeo._tcp` services.
- Container interface view did not match the host Wi-Fi LAN interface.
- Docker runtime reported rootless mode.
- Avahi-from-container workaround failed with D-Bus client creation errors.

## Recommended Next Directions

### Direction A: Use host-node runtime on the target device

This is the most direct path to a working deployment.

- Run `comapeo-headless` directly with Node on the Pi.
- Manage it with `systemd` instead of Docker.
- This preserves the real LAN/mDNS environment and already proved workable in
  testing.

### Direction B: Re-test Docker only on a native rootful engine

If Docker remains a hard requirement:

- test on the actual Raspberry Pi target
- use native/rootful Docker Engine
- verify from inside the container that `os.networkInterfaces()` exposes the
  real LAN interface and address

If that check fails, discovery should be treated as unsupported in that Docker
runtime.

### Direction C: Add runtime diagnostics for unsupported Docker discovery

A pragmatic improvement would be to add startup diagnostics that log:

- detected interfaces from `os.networkInterfaces()`
- whether the process appears to be in Docker
- whether Docker appears rootless
- a warning when the process cannot see a plausible LAN interface

This would not fix discovery, but it would make the failure mode obvious.

### Direction D: Host-side publication only if the runtime allows it

If containerization is still required later:

- prefer a host-side publisher or native host mDNS integration
- do not assume in-container `ciao` or in-container Avahi publication will work
  on rootless/VM-backed setups

This direction needs a runtime that can actually talk to the host publisher
cleanly, which was not true here.

## Practical Recommendation

For the current environment, stop trying to make Android discovery work through
this rootless Docker setup.

The best next move is:

1. run the daemon directly on the target host or Pi
2. use `systemd` for service management
3. only revisit Docker on a native/rootful engine where the container can prove
   it sees the real LAN interface
