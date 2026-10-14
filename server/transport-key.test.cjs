const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('ssh2');
const {loadTransportKey}=require('./transport-key.cjs');
test('loads server-only Base64 SSH key',()=>{
  const key=utils.generateKeyPairSync('ed25519').private;
  assert.equal(loadTransportKey({CPM_BFF_SSH_PRIVATE_KEY_B64:Buffer.from(key).toString('base64')}).toString(),key);
});
test('rejects missing, malformed and non-key values without exposing them',()=>{
  for(const value of ['', 'invalid-secret-123', Buffer.from('private-invalid-payload').toString('base64')]){
    assert.throws(()=>loadTransportKey({CPM_BFF_SSH_PRIVATE_KEY_B64:value}),error=>{
      assert.match(error.message,/CPM_BFF_SSH_PRIVATE_KEY_B64/);
      assert.ok(!value || !error.message.includes(value));
      assert.ok(!error.message.includes('private-invalid-payload'));
      return true;
    });
  }
});
