'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRazerService,loadCatalog}=require('../core/razer-models.cjs');
const deviceId='razer-1532-009f-'+'a'.repeat(20);
const roots={payloadRoot:path.resolve('payload-fixture'),stateRoot:path.resolve('state-fixture')};
test('model catalogue preserves upstream USB identities and declared capabilities without claiming verification',()=>{
 const {models,source}=loadCatalog();assert.equal(source.provider,'openrazer-win');assert.equal(source.upstreamVersion,'3.12.1');assert(models.length>100);assert.equal(new Set(models.map(m=>m.id)).size,models.length);
 for(const m of models){assert.equal(m.kind,'mouse');assert.equal(m.identifiers[0].vendorId,0x1532);assert.equal(m.support.status,'unverified');assert(m.imageUrl.startsWith('https://'));assert(m.support.capabilities.dpi);}
});
test('device calls retain a particular control path identity and serialize shared transport',async()=>{
 const requests=[];let inFlight=0;const service=createRazerService({...roots,run:async request=>{assert.equal(inFlight++,0);requests.push(request);await new Promise(r=>setTimeout(r,5));inFlight--;return {ok:true};}});
 await Promise.all([service.status(deviceId),service.execute({deviceId,command:'dpi.set',value:[1600,1600]})]);assert.equal(requests.length,2);assert.equal(requests[0].deviceId,deviceId);assert.equal(requests[1].deviceId,deviceId);assert.equal(requests[1].command,'dpi.set');await service.close();
});
test('unknown operations and PID-only selectors cannot reach a device',async()=>{
 let calls=0;const service=createRazerService({...roots,run:async()=>{calls++;return {ok:true};}});
 assert.throws(()=>service.status('009f'));await assert.rejects(service.execute({deviceId,command:'raw-report',value:[]}));assert.equal(calls,0);await service.close();await assert.rejects(service.scan());
});
