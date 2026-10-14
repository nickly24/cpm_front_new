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
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  tunnel.close();
  if (child) child.kill(signal);
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop('SIGINT'));
tunnel.start().then(() => {
  if (stopping) return;
  child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  child.on('error', () => { stop(); process.exitCode = 1; });
  child.on('exit', code => { stop(); process.exitCode = code ?? 1; });
}).catch(() => { console.error('[bff-transport] startup failed'); stop(); process.exitCode = 1; });
