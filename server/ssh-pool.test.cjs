const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const { Server, utils } = require('ssh2');
const { createTunnel } = require('./ssh-tunnel.cjs');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const waitFor = async predicate => { for (let i = 0; i < 250; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Condition timeout'); };

test('four tunnels balance streams, preserve sessions and isolate one connection failure without replay', async () => {
  const host = utils.generateKeyPairSync('ed25519');
  const key = utils.generateKeyPairSync('ed25519');
  const fingerprint = createHash('sha256').update(utils.parseKey(host.private).getPublicSSH()).digest('hex');
  const owners = new Map(), connections = new Map(), held = new Map();
  let connectionId = 0, writes = 0;
  const backend = http.createServer((req, res) => {
    const owner = owners.get(req.socket.remotePort);
    const actor = req.headers['x-test-actor'];
    assert.equal(req.headers.cookie, `cpm_bff=session-${actor}`);
    assert.equal(req.headers['x-cpm-context'], `context-${actor}`);
    assert.equal(req.headers.origin, 'https://cpm-lms.ru');
    req.resume();
    req.on('end', () => {
      if (req.method === 'POST') writes++;
      const reply = () => { if (!res.destroyed) { res.setHeader('X-Test-Tunnel', String(owner)); res.end(`session-${actor}`); } };
      if (req.url === '/hold') held.set(owner, { reply, actor }); else reply();
    });
  });
  const target = await listen(backend);
  const ssh = new Server({ hostKeys: [host.private] }, connection => {
    const id = ++connectionId; connections.set(id, connection);
    connection.on('error', () => {});
    connection.on('close', () => connections.delete(id));
    connection.on('authentication', auth => auth.method === 'publickey' ? auth.accept() : auth.reject());
    connection.on('ready', () => connection.on('tcpip', (accept, reject, info) => {
      if (info.destIP !== '127.0.0.1' || info.destPort !== target) return reject();
      const channel = accept();
      const socket = net.connect(target, '127.0.0.1');
      owners.set(socket.localPort, id);
      socket.on('connect', () => { owners.set(socket.localPort, id); channel.pipe(socket).pipe(channel); });
      socket.on('error', () => channel.destroy());
      channel.on('error', () => socket.destroy());
      channel.on('close', () => socket.destroy());
      socket.on('close', () => owners.delete(socket.localPort));
    }));
  });
  const port = await listen(ssh);
  const pool = createTunnel({ host: '127.0.0.1', port, username: 'test', privateKey: key.private, hostSHA256: fingerprint, targetHost: '127.0.0.1', targetPort: target, localPort: 0, tunnelCount: 4 }, { reconnectMs: 600 });
  let address;
  const send = (actor, url = '/me', method = 'GET') => new Promise(resolve => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path: url, method, agent: false, headers: {
      'X-Test-Actor': String(actor), Cookie: `cpm_bff=session-${actor}`, 'X-CPM-Context': `context-${actor}`, Origin: 'https://cpm-lms.ru',
    } }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ ok: true, tunnel: Number(res.headers['x-test-tunnel']), body, actor }));
      res.on('error', () => resolve({ ok: false, actor }));
    });
    req.on('error', () => resolve({ ok: false, actor })); req.end();
  });
  try {
    address = await pool.start(2500);
    assert.equal(pool.getStats().filter(slot => slot.ready).length, 4);
    const pending = Array.from({ length: 4 }, (_, i) => send(i, '/hold', 'POST'));
    await waitFor(() => held.size === 4);
    assert.deepEqual(pool.getStats().map(slot => slot.active), [1, 1, 1, 1]);
    const failedId = held.keys().next().value;
    connections.get(failedId).end();
    await waitFor(() => pool.getStats().filter(slot => slot.ready).length === 3);
    for (const [id, hold] of held) if (id !== failedId) hold.reply();
    const replies = await Promise.all(pending);
    assert.equal(replies.filter(reply => reply.ok).length, 3);
    for (const reply of replies.filter(reply => reply.ok)) assert.equal(reply.body, `session-${reply.actor}`);
    const surviving = await Promise.all(Array.from({ length: 6 }, (_, i) => send(10 + i)));
    assert.ok(surviving.every(reply => reply.ok && reply.tunnel !== failedId));
    await waitFor(() => pool.getStats().every(slot => slot.ready));
    const restored = await Promise.all(Array.from({ length: 8 }, (_, i) => send(20 + i)));
    assert.ok(restored.every(reply => reply.ok && reply.body === `session-${reply.actor}`));
    assert.equal(new Set(restored.map(reply => reply.tunnel)).size, 4);
    assert.equal(writes, 4, 'a lost response must not replay the POST');
  } finally {
    pool.close(); for (const connection of connections.values()) connection.end(); ssh.close(); backend.close();
  }
});
