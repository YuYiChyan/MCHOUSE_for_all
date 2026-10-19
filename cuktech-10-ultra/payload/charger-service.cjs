'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { randomBytes } = require('crypto');
const {normalizeDevice,normalizeKey}=require('./charger-credentials.cjs');

module.exports = function createChargerService(base, app, dataDir) {
  let child = null;
  let startPromise = null;
  let endpoint = null;
  let secret = '';
  let closing = false;
  let restartTimer = null;
  let lastFailure = '';
  let failures = 0;
  let pendingQr = null;
  let cloudDevices = new Map();
  let qrSession = null;

  function ensure() {
    if (endpoint) return Promise.resolve();
    if (startPromise) return startPromise;
    if (closing) return Promise.reject(new Error('程序正在关闭'));
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    startPromise = new Promise((resolve, reject) => {
      const config = JSON.parse(fs.readFileSync(path.join(base, 'lab-config.json'), 'utf8'));
      secret = randomBytes(32).toString('hex');
      const owned = spawn(config.python, ['-u', path.join(base, 'cuktech', 'backend.py')], {
        cwd: path.join(base, 'cuktech'), windowsHide: true,
        env: {...process.env, PYTHONUTF8:'1', ONE4ALL_CHARGER_SECRET:secret, ONE4ALL_DATA_DIR:dataDir},
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child = owned;
      let buffer = '';
      const timeout = setTimeout(() => { reject(new Error('充电器连接服务启动超时')); owned.kill(); }, 18000);
      owned.stdout.setEncoding('utf8');
      owned.stdout.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          try {
            const message = JSON.parse(line);
            if (message.ready && Number.isInteger(message.port) && message.port > 0 && message.port < 65536) {
              endpoint = `http://127.0.0.1:${message.port}`;
              clearTimeout(timeout); failures = 0; lastFailure = ''; resolve();
            }
          } catch {}
        }
      });
      // Never forward cloud credentials, QR session URLs, or raw device responses into the app log.
      owned.stderr.on('data', chunk => { lastFailure = String(chunk).slice(-600); });
      owned.once('error', error => { clearTimeout(timeout); reject(new Error(`充电器服务无法启动：${error.message}`)); });
      owned.once('exit', () => {
        clearTimeout(timeout);
        if (child !== owned) return;
        child = null; endpoint = null; startPromise = null;
        reject(new Error('充电器连接服务已退出'));
        if (!closing) {
          failures += 1;
          restartTimer = setTimeout(() => { restartTimer = null; ensure().catch(()=>{}); }, Math.min(30000, 1000 * 2 ** Math.min(failures, 5)));
        }
      });
    });
    return startPromise;
  }

  async function api(route, body, timeout = 20000) {
    await ensure();
    const response = await fetch(endpoint + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {'X-One4All-Key':secret, 'Content-Type':'application/json'},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
      signal:AbortSignal.timeout(timeout),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || '充电器暂时未能响应');
    return data;
  }

  async function status() {
    const [state, summary] = await Promise.all([api('/api/status'), api('/api/local/summary')]);
    return {...state, configured:summary.configured, mac:summary.mac, quality:summary.quality};
  }

  async function startQr() {
    if (pendingQr) return pendingQr;
    pendingQr = (async () => {
      cloudDevices.clear();
      const result = await api('/api/xiaomi/login', {server:'cn'}, 45000);
      const image = String(result.qr_image || '').replace(/;charset=[^;,]+/i,'');
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(image) || image.length > 1500000) throw new Error('二维码未能加载，请重试');
      qrSession = result.session_id;
      return {image};
    })().finally(() => { pendingQr = null; });
    return pendingQr;
  }

  async function checkQr() {
    if (!qrSession) throw new Error('请先获取二维码');
    let result;
    try { result = await api('/api/xiaomi/qr/complete', {session_id:qrSession}, 45000); }
    catch (error) { if (/等待扫码/.test(error.message)) return {waiting:true}; throw error; }
    // Keep account-wide device credentials in the main process and only expose matching chargers.
    const devices = (result.cuktech || []).filter(device => /^njcuk\.fitting\.ad1204(?:_|$)/.test(device.model || ''));
    cloudDevices = new Map(devices.map(device => [device.did, device]));
    return {waiting:false, devices:devices.map(({did,name,model}) => ({did,name,model}))};
  }

  async function pair(did) {
    const device = cloudDevices.get(did);
    if (!device || !qrSession) throw new Error('请重新扫码后选择充电器');
    const normalized=normalizeDevice(device);
    const key = await api('/api/xiaomi/beaconkey', {session_id:qrSession, did}, 30000);
    const bleKey=normalizeKey(key.ble_key);
    await api('/api/config', {config:{ble:{mac:normalized.mac,token:normalized.token,ble_key:bleKey},mqtt:{enabled:false},bemfa:{enabled:false}}});
    cloudDevices.clear(); qrSession = null;
    return {ok:true};
  }

  async function reconnect() {
    const state = await status();
    if (!state.configured) throw new Error('请先使用米家扫码连接');
    await api('/api/enable', {enabled:true});
    return {ok:true};
  }

  app.on('before-quit', () => {
    closing = true;
    clearTimeout(restartTimer);
    if (child) {
      const owned = child;
      owned.stdin.end();
      setTimeout(() => { if (owned.exitCode === null) owned.kill(); }, 4000).unref();
    }
  });
  return {status, startQr, checkQr, pair, reconnect};
};
