'use strict';
const net = require('node:net');
const { Client } = require('ssh2');

// One encrypted transport; application authentication remains entirely in BFF.
// Broken requests are never replayed (in particular, submissions and uploads).
function createTunnel(config, { reconnectMs = 1500, log = () => {} } = {}) {
  let client, ready = false, stopped = false, reconnectTimer;
  const sockets = new Set();
  let firstReadyResolve, firstReadyReject;
  const firstReady = new Promise((resolve, reject) => { firstReadyResolve = resolve; firstReadyReject = reject; });
  const server = net.createServer(socket => {
    socket.on('error', () => {});
    if (!ready || stopped) { socket.destroy(); return; }
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    const connection = client;
    connection.forwardOut('127.0.0.1', socket.remotePort || 0, config.targetHost, config.targetPort, (error, channel) => {
      if (error || socket.destroyed || client !== connection || !ready) {
        if (channel) channel.destroy();
        socket.destroy(); return;
      }
      channel.on('error', () => socket.destroy());
      channel.once('close', () => socket.destroy());
      socket.once('close', () => channel.destroy());
      socket.pipe(channel).pipe(socket);
    });
  });
  function connect() {
    if (stopped) return;
    const connection = new Client(); client = connection;
    connection.on('ready', () => {
      if (stopped) { connection.end(); return; }
      ready = true; log('connected'); firstReadyResolve();
    });
    connection.on('error', () => log('connection_error'));
    connection.once('close', () => {
      if (client !== connection) return;
      ready = false;
      for (const socket of sockets) socket.destroy();
      if (!stopped) { log('reconnecting'); reconnectTimer = setTimeout(connect, reconnectMs); }
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
      connect();
      try { await firstReady; return server.address(); }
      finally { clearTimeout(timer); }
    },
    isReady: () => ready,
    close() {
      stopped = true; ready = false; clearTimeout(reconnectTimer);
      for (const socket of sockets) socket.destroy();
      if (client) client.destroy();
      server.close();
    },
  };
}
module.exports = { createTunnel };
