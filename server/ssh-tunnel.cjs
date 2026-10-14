'use strict';
const net = require('node:net');
const { Client } = require('ssh2');

// Distribute TCP streams; application cookies/context pass through byte-for-byte.
// A failed stream is closed, never replayed on a different SSH connection.
function createTunnel(config, { reconnectMs = 1500, log = () => {} } = {}) {
  const count = config.tunnelCount ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 16) throw new Error('Invalid SSH tunnel count');
  const slots = Array.from({ length: count }, (_, id) => ({ id, client: null, ready: false, sockets: new Set(), opened: 0, timer: null }));
  let stopped = false, cursor = 0;
  let firstReadyResolve, firstReadyReject;
  const firstReady = new Promise((resolve, reject) => { firstReadyResolve = resolve; firstReadyReject = reject; });
  const readyCount = () => slots.filter(slot => slot.ready).length;
  function selectSlot() {
    let selected;
    for (let offset = 0; offset < slots.length; offset++) {
      const slot = slots[(cursor + offset) % slots.length];
      if (slot.ready && (!selected || slot.sockets.size < selected.sockets.size)) selected = slot;
    }
    if (selected) cursor = (selected.id + 1) % slots.length;
    return selected;
  }
  const server = net.createServer(socket => {
    socket.on('error', () => {});
    const slot = stopped ? null : selectSlot();
    if (!slot) { socket.destroy(); return; }
    slot.sockets.add(socket);
    socket.once('close', () => slot.sockets.delete(socket));
    const connection = slot.client;
    connection.forwardOut('127.0.0.1', socket.remotePort || 0, config.targetHost, config.targetPort, (error, channel) => {
      if (error || socket.destroyed || slot.client !== connection || !slot.ready) {
        if (channel) channel.destroy();
        socket.destroy(); return;
      }
      slot.opened++;
      channel.on('error', () => socket.destroy());
      channel.once('close', () => socket.destroy());
      socket.once('close', () => channel.destroy());
      socket.pipe(channel).pipe(socket);
    });
  });
  function connect(slot) {
    if (stopped) return;
    const connection = new Client(); slot.client = connection;
    connection.on('ready', () => {
      if (stopped) { connection.end(); return; }
      slot.ready = true;
      log(`connected tunnel=${slot.id + 1} ready=${readyCount()}/${count}`);
      // The initial release starts only after all configured tunnels are verified.
      if (readyCount() === count) firstReadyResolve();
    });
    connection.on('error', () => log(`connection_error tunnel=${slot.id + 1}`));
    connection.once('close', () => {
      if (slot.client !== connection) return;
      slot.ready = false;
      for (const socket of slot.sockets) socket.destroy();
      if (!stopped) {
        log(`reconnecting tunnel=${slot.id + 1} ready=${readyCount()}/${count}`);
        slot.timer = setTimeout(() => connect(slot), reconnectMs);
      }
    });
    connection.connect({
      host: config.host, port: config.port, username: config.username,
      privateKey: config.privateKey, hostHash: 'sha256',
      hostVerifier: hash => hash === config.hostSHA256,
      algorithms: { serverHostKey: ['ssh-ed25519'] },
      keepaliveInterval: 5000, keepaliveCountMax: 3, readyTimeout: 12000,
    });
  }
  return {
    async start(timeoutMs = 20000) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.localPort, '127.0.0.1', resolve);
      });
      const timer = setTimeout(() => firstReadyReject(new Error('SSH tunnel readiness timeout')), timeoutMs);
      for (const slot of slots) connect(slot);
      try { await firstReady; return server.address(); }
      finally { clearTimeout(timer); }
    },
    isReady: () => readyCount() > 0,
    getStats: () => slots.map(slot => ({ id: slot.id + 1, ready: slot.ready, active: slot.sockets.size, opened: slot.opened })),
    close() {
      stopped = true;
      for (const slot of slots) {
        slot.ready = false; clearTimeout(slot.timer);
        for (const socket of slot.sockets) socket.destroy();
        if (slot.client) slot.client.destroy();
      }
      server.close();
    },
  };
}
module.exports = { createTunnel };
