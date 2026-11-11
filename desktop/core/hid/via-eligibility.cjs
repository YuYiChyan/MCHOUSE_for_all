/* Metadata hints only; never gate connection on the official catalog. MIT. */
'use strict';
function viaEligibility(device,devices,catalog){
  const key=device.vendorId*65536+device.productId;
  const listed=Object.hasOwn(catalog,key),raw=device.collections?.some(c=>c.usagePage===0xFF60&&c.usage===0x61);
  const multiple=devices.filter(d=>d.vendorId===device.vendorId&&d.productId===device.productId).length>1;
  return {available:!!raw,canAttempt:true,catalogListed:listed,multiple,protocolVerified:false,
    reason:raw?'发现 VIA 常用接口，可连接核验协议；未收录型号可导入厂商 JSON。':'未发现常规 VIA 接口，仍可主动尝试连接或导入厂商 JSON。'};
}
module.exports={viaEligibility};
