'use strict';
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pipeline } = require('node:stream/promises');
const { Transform, Readable } = require('node:stream');
const defaults = require('../catalog/vendors.json');
const execFileAsync = promisify(execFile);

function checkedUrl(value, allowedHosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !allowedHosts.includes(url.host)) {
    throw new Error('下载地址不在该品牌的已登记来源中');
  }
  return url;
}

function sourceFor(entry) {
  if (entry.source?.type === 'official') return entry.source;
  const source = entry.source;
  if (source?.type !== 'github' || !source.version || !source.sha256 || !/^[a-f0-9]{64}$/i.test(source.sha256)) {
    throw new Error('拆分组件必须指定 GitHub 发布版本和 SHA256');
  }
  const url = new URL(source.url);
  if (url.hostname !== 'github.com' || !url.pathname.includes('/releases/download/' + source.version + '/') || source.version === 'latest') {
    throw new Error('拆分组件必须使用固定版本的 GitHub Release');
  }
  return source;
}

function requestFile(url, allowedHosts, signal, redirects = 0) {
  checkedUrl(url, allowedHosts);
  if (redirects > 6) return Promise.reject(new Error('下载重定向次数过多'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, { signal, family: 4, headers: { 'User-Agent': 'One4All-Desktop/0.1.0', Accept: 'application/octet-stream,*/*' } }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        response.resume();
        try { resolve(requestFile(new URL(response.headers.location, url).href, allowedHosts, signal, redirects + 1)); }
        catch (error) { reject(error); }
      } else if (response.statusCode !== 200) {
        response.resume(); reject(new Error('官网下载失败：HTTP ' + response.statusCode));
      } else resolve({ stream: response, total: Number(response.headers['content-length']) || null, url: String(url) });
    });
    request.setTimeout(60000, () => request.destroy(new Error('下载连接超过 60 秒没有响应')));
    request.once('error', reject);
  });
}

async function defaultTransport(url, allowedHosts, signal) {
  // The desktop runtime uses Chromium's network stack and the user's system proxy.
  if (!process.versions.electron) return requestFile(url, allowedHosts, signal);
  const { net } = require('electron');
  let current = url;
  for (let redirects = 0; redirects <= 6; redirects++) {
    checkedUrl(current, allowedHosts);
    const response = await net.fetch(current, { signal, redirect:'manual' });
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      current = new URL(response.headers.get('location'), current).href;
      continue;
    }
    if (!response.ok || response.status !== 200) { await response.body?.cancel(); throw new Error('官网下载失败：HTTP ' + response.status); }
    return { stream:Readable.fromWeb(response.body), total:Number(response.headers.get('content-length')) || null, url:current };
  }
  throw new Error('下载重定向次数过多');
}

function expandEnv(value) {
  return value.replace(/%([^%]+)%/g, (_, key) => process.env[key] || (key === 'ProgramFiles' ? 'C:/Program Files' : key === 'ProgramFiles(x86)' ? 'C:/Program Files (x86)' : ''));
}
function fileHash(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', data => hash.update(data)); stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}
function checkMagic(file, format) {
  const descriptor = fs.openSync(file, 'r');
  const bytes = Buffer.alloc(4);
  try { fs.readSync(descriptor, bytes, 0, 4, 0); } finally { fs.closeSync(descriptor); }
  if (format === 'exe' && bytes.subarray(0, 2).toString() !== 'MZ') throw new Error('下载结果不是 Windows 安装程序');
  if (format === 'zip' && bytes.readUInt32LE() !== 0x04034b50) throw new Error('下载结果不是 ZIP 安装包');
}

function createPackageManager({ dataRoot, onProgress = () => {}, openPath, openExternal, entries = defaults, transport = defaultTransport } = {}) {
  if (!dataRoot || !path.isAbsolute(dataRoot)) throw new TypeError('dataRoot must be an absolute path');
  const root = path.resolve(dataRoot), downloads = path.join(root, 'downloads');
  fs.mkdirSync(downloads, { recursive: true });
  const items = new Map(entries.map(entry => [entry.id, entry]));
  const operations = new Map(), progress = new Map(), errors = new Map();
  const get = id => { const value = items.get(id); if (!value) throw new Error('未登记的品牌模块'); return value; };
  function destination(entry) {
    const source = sourceFor(entry);
    if (path.basename(source.filename) !== source.filename || /[\\/]/.test(source.filename)) throw new Error('下载文件名无效');
    return path.join(downloads, source.filename);
  }
  function readReceipt(entry) {
    const target = destination(entry);
    try {
      const receipt = JSON.parse(fs.readFileSync(target + '.json', 'utf8'));
      return receipt.id === entry.id && receipt.sourceUrl === sourceFor(entry).url && receipt.bytes === fs.statSync(target).size && receipt.sha256 ? receipt : null;
    } catch { return null; }
  }
  function installedPath(entry) { return (entry.installedExecutables || []).map(expandEnv).map(value => path.resolve(value)).find(value => fs.existsSync(value)) || null; }
  function status(id) {
    if (id === undefined) return Object.fromEntries([...items.keys()].map(key => [key, status(key)]));
    const entry = get(id), receipt = readReceipt(entry), installed = installedPath(entry), activity = progress.get(id);
    return { id, downloaded: !!receipt, installed: !!installed, adapterReady: false,
      state: activity?.state || (installed ? 'installed' : receipt ? 'downloaded' : 'available'),
      downloadPath: receipt ? destination(entry) : null, installedPath: installed,
      source: sourceFor(entry).type, progress: activity || null, error: errors.get(id) || null,
      bytes: receipt?.bytes || 0, sha256: receipt?.sha256 || null, downloadedAt: receipt?.downloadedAt || null };
  }
  function notify(id, value) { progress.set(id, value); try { onProgress(status(id)); } catch {} }
  function catalog() { return [...items.values()].map(entry => ({ ...entry, status: status(entry.id) })); }
  async function performDownload(id) {
    const entry = get(id), source = sourceFor(entry), target = destination(entry), partial = target + '.partial';
    const previous = readReceipt(entry);
    if (previous && await fileHash(target) === previous.sha256) { progress.delete(id); errors.delete(id); return status(id); }
    errors.delete(id); notify(id, { state: 'downloading', received: 0, total: null, percent: null });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('下载超时，请重试')), 10 * 60 * 1000);
    try {
      const response = await transport(source.url, source.allowedHosts, controller.signal);
      const hash = crypto.createHash('sha256'); let received = 0, lastNotify = 0;
      const meter = new Transform({ transform(chunk, encoding, callback) {
        received += chunk.length; hash.update(chunk);
        if (received > 2 * 1024 ** 3) return callback(new Error('下载文件超出模块大小上限'));
        if (Date.now() - lastNotify > 300) {
          lastNotify = Date.now(); notify(id, { state: 'downloading', received, total: response.total, percent: response.total ? Math.min(100, Math.round(received / response.total * 100)) : null });
        }
        callback(null, chunk);
      }});
      await pipeline(response.stream, meter, fs.createWriteStream(partial), { signal: controller.signal });
      if (response.total && received !== response.total) throw new Error('文件没有完整下载');
      checkMagic(partial, source.format);
      const sha256 = hash.digest('hex');
      if (source.sha256 && source.sha256.toLowerCase() !== sha256) throw new Error('组件版本与下载文件不一致');
      fs.renameSync(partial, target);
      const receipt = { id, sourceUrl: source.url, resolvedUrl: response.url, bytes: received, sha256, downloadedAt: new Date().toISOString() };
      fs.writeFileSync(target + '.json', JSON.stringify(receipt, null, 2));
      notify(id, { state: 'downloaded', received, total: received, percent: 100 });
      progress.delete(id); return status(id);
    } catch (error) {
      errors.set(id, error.message); notify(id, { state: 'error', message: error.message }); throw error;
    } finally { clearTimeout(timeout); }
  }
  function download(id) {
    get(id);
    if (operations.has(id)) return operations.get(id);
    const promise = performDownload(id).finally(() => operations.delete(id));
    operations.set(id, promise); return promise;
  }
  async function openFile(file) {
    const result = await (openPath || require('electron').shell.openPath)(file);
    if (result) throw new Error(result);
  }
  async function install(id) {
    const entry = get(id), receipt = readReceipt(entry), target = destination(entry);
    if (!receipt) throw new Error('请先下载官方组件');
    if (await fileHash(target) !== receipt.sha256) throw new Error('下载文件已改变，请重新下载');
    checkMagic(target, sourceFor(entry).format);
    let executable = target;
    if (sourceFor(entry).format === 'zip') {
      const expanded = path.join(root, 'installers', id, receipt.sha256.slice(0, 16));
      fs.mkdirSync(expanded, { recursive: true });
      const quote = value => "'" + value.replace(/'/g, "''") + "'";
      const script = '$ErrorActionPreference = \'Stop\'; Expand-Archive -LiteralPath ' + quote(target) + ' -DestinationPath ' + quote(expanded) + ' -Force';
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 120000 });
      const candidates = [];
      const walk = (folder, depth) => { for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, item.name);
        if (item.isDirectory() && depth < 3) walk(file, depth + 1);
        else if (item.isFile() && new RegExp(entry.installerNamePattern, 'i').test(item.name)) candidates.push(file);
      }};
      walk(expanded, 0);
      if (candidates.length !== 1) throw new Error('安装包中的程序入口发生变化，请从官方页面确认');
      executable = candidates[0]; checkMagic(executable, 'exe');
    }
    await openFile(executable);
    // Starting the vendor installer is not proof that installation completed.
    return { ...status(id), installerStarted: true };
  }
  async function openOfficial(id) {
    const entry = get(id), executable = installedPath(entry);
    if (executable) { await openFile(executable); return { launched: true, installedPath: executable }; }
    await (openExternal || require('electron').shell.openExternal)(entry.homepage);
    return { launched: false, openedWebsite: true, url: entry.homepage };
  }
  return Object.freeze({ catalog, status, download, install, openOfficial });
}

module.exports = { createPackageManager, checkedUrl, sourceFor };
