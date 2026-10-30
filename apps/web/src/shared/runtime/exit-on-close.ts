import process from 'node:process';
import { definePlugin } from 'nitro';

// On SIGTERM, srvx stops the server and waits for the requests in flight, then
// leaves the exit to an empty event loop. The module-level Effect runtimes keep
// their Postgres pools open, and a pool's idle timer never ends, so after the
// first database request the process would wait for Podman's SIGKILL instead
// (exit 137, which fails the slot's systemd unit). Nitro calls `close` once the
// server has closed, so nothing is left to finish.
//
// The dev server and the prerenderer call `close` too, inside processes that
// must keep running, so only the production server exits.
export default definePlugin((nitroApp) => {
  if (import.meta.preset !== 'bun') {
    return;
  }
  nitroApp.hooks.hook('close', () => {
    process.exit(0);
  });
});
