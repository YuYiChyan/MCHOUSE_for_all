'use strict';
// A reusable contract for new backend integrations. It does not register a card in the demo host.
exports.createAdapter = function createAdapter({id,status,commands={},close=async()=>{}}){
  if(typeof id!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(id))throw new TypeError('Use a stable lowercase device id');
  if(typeof status!=='function')throw new TypeError('A status reader is required');
  const operations=Object.freeze({...commands});
  const names=Object.keys(operations);
  for(const name of names)if(typeof operations[name]!=='function')throw new TypeError('Command must be a function: '+name);
  let closed=false;
  let queue=Promise.resolve();
  let closePromise=null;
  function serialize(operation){
    if(closed)return Promise.reject(new Error('Device adapter is closed'));
    const next=queue.then(operation);
    queue=next.catch(()=>{});
    return next;
  }
  return Object.freeze({
    id,capabilities:Object.freeze(names),
    status:()=>serialize(status),
    invoke:(name,value)=>{
      if(!Object.prototype.hasOwnProperty.call(operations,name))return Promise.reject(new Error('Unsupported device command'));
      return serialize(()=>operations[name](value));
    },
    close:()=>{if(closePromise)return closePromise;closed=true;closePromise=queue.then(close);return closePromise;}
  });
};
