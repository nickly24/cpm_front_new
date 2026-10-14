'use strict';
const { spawn } = require('node:child_process');
const { loadTransportKey } = require('./transport-key.cjs');
const { createTunnel } = require('./ssh-tunnel.cjs');
const config = require('./tunnel-config.json');
let child;
const privateKey = loadTransportKey(process.env);
// Next itself does not need the transport credential.
delete process.env.CPM_BFF_SSH_PRIVATE_KEY_B64;
const tunnel = createTunnel({ ...config, privateKey }, {
  log: state => console.log('[bff-transport]', state),
});
let stopping = false;
let shutdownTimer;
function finish() {
  clearTimeout(shutdownTimer);
  tunnel.close();
}
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  if (!child) { finish(); return; }
  // Keep transports alive while Next drains already accepted HTTP requests.
  child.kill(signal);
  shutdownTimer = setTimeout(() => { child.kill('SIGKILL'); finish(); }, 25000);
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop('SIGINT'));
tunnel.start().then(() => {
  if (stopping) return;
  child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  child.on('error', () => { stopping = true; finish(); process.exitCode = 1; });
  child.on('exit', (code, signal) => { finish(); process.exitCode = code ?? (stopping && signal === 'SIGTERM' ? 0 : 1); });
}).catch(() => { console.error('[bff-transport] startup failed'); stop(); process.exitCode = 1; });
