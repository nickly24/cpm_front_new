'use strict';
const { utils } = require('ssh2');
function loadTransportKey(env) {
  const encoded = (env.CPM_BFF_SSH_PRIVATE_KEY_B64 || '').trim();
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('CPM_BFF_SSH_PRIVATE_KEY_B64 is missing or invalid');
  }
  const key = Buffer.from(encoded, 'base64');
  if (utils.parseKey(key) instanceof Error) {
    throw new Error('CPM_BFF_SSH_PRIVATE_KEY_B64 does not contain a valid SSH key');
  }
  return key;
}
module.exports = { loadTransportKey };
