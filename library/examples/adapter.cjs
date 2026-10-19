'use strict';
const {createAdapter}=require('../bridge/adapter.cjs');
// Replace readState/writeRate with an existing open-source USB or BLE backend.
exports.fromBackend=function fromBackend(backend){
  return createAdapter({
    id:'example-device',
    status:async()=>{
      const state=await backend.readState();
      return {connected:!!state.connected,transport:backend.transport,sampledAt:state.connected?Date.now():null,values:{rate:state.connected?state.rate:null}};
    },
    commands:{setRate:async value=>{
      if(![125,500,1000].includes(value))throw new TypeError('Unsupported rate');
      await backend.writeRate(value);
      const confirmed=await backend.readState();
      if(!confirmed.connected||confirmed.rate!==value)throw new Error('Device did not confirm the requested rate');
      return confirmed;
    }},
    close:()=>backend.close()
  });
};
