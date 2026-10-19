'use strict';
function normalizeDevice(device) {
  const token=String(device?.token||'').trim();
  const rawMac=String(device?.mac||'').trim().replace(/[:-]/g,'');
  // AD1204 normally uses a 12-byte MiOT token. Other cloud versions may return 16 bytes.
  if(!/^(?:[0-9a-f]{24}|[0-9a-f]{32})$/i.test(token))throw new Error('设备认证 Token 无效，请重新扫码');
  if(!/^[0-9a-f]{12}$/i.test(rawMac))throw new Error('设备蓝牙地址缺失，请确认充电器已绑定米家');
  return {token,mac:rawMac.toUpperCase().match(/.{2}/g).join(':')};
}
function normalizeKey(value) {
  const key=String(value||'').trim();
  if(!/^[0-9a-f]{32}$/i.test(key))throw new Error('设备蓝牙密钥无效，请重新扫码');
  return key;
}
module.exports={normalizeDevice,normalizeKey};
