'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const {createLogitechService, loadCatalog, getLogitechSupport} = require('../core/logitech-models.cjs');
const deviceId = 'logitech-046d-c547-' + 'a'.repeat(20);
const roots = {payloadRoot: path.resolve('payload-fixture'), stateRoot: path.resolve('state-fixture')};
test('catalog uses exact official model IDs and keeps hardware verification pending', () => {
  const {models} = loadCatalog();
  assert.equal(models.length, 27);
  assert.equal(new Set(models.map(m => m.id)).size, models.length);
  assert.equal(getLogitechSupport({id: 'logitech-g600'}), null);
  assert.equal(getLogitechSupport({id: 'logitech-g602'}), null);
  assert.equal(getLogitechSupport({id: 'logitech-g502-hero'}).provider, 'logitech-hidpp2');
  for (const model of models) {
    assert.equal(model.support.status, 'unverified');
    assert(model.identifiers.length);
    assert(model.identifiers.every(id => id.vendorId === 0x046d && id.productId !== 0xc547));
  }
});
test('serialized requests retain full instance ID and explicit host mode selection', async () => {
  let active = 0; const requests = [];
  const service = createLogitechService({...roots, run: async request => {
    assert.equal(active++, 0); requests.push(request);
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return {ok: true};
  }});
  await Promise.all([service.status(deviceId), service.execute({deviceId, command: 'hostMode.set', value: true})]);
  assert.equal(requests[0].deviceId, deviceId);
  assert.equal(requests[1].command, 'hostMode.set');
  await service.close();
});
test('PID-only selectors, unknown commands and calls after close are rejected', async () => {
  let calls = 0;
  const service = createLogitechService({...roots, run: async () => {calls++; return {ok: true};}});
  assert.throws(() => service.status('logitech-g309'));
  await assert.rejects(service.execute({deviceId, command: 'pair-receiver'}));
  assert.equal(calls, 0);
  await service.close();
  await assert.rejects(service.scan());
});
