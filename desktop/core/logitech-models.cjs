'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFile} = require('node:child_process');

const PROVIDER = 'logitech-hidpp2';
function loadCatalog(file = path.join(__dirname, '../catalog/logitech-hidpp.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function getLogitechSupport(model) {
  const match = loadCatalog().models.find(row => row.id === model.id);
  return match ? {...match.support, capabilities: [...match.support.capabilities]} : null;
}
function createLogitechService({payloadRoot, stateRoot, resourceRoot, run, timeout = 30000} = {}) {
  if (!path.isAbsolute(payloadRoot || '') || !path.isAbsolute(stateRoot || '')) throw TypeError('payloadRoot and stateRoot are required');
  const python = path.join(payloadRoot, 'python', 'python.exe');
  const script = path.join(__dirname, 'logitech-multi_backend.py');
  let queue = Promise.resolve(), closed = false, child = null;
  const transport = run || (request => new Promise((resolve, reject) => {
    const args = ['-I', '-B', script, '--payload', payloadRoot, '--state', stateRoot];
    if (resourceRoot) args.push('--resources', resourceRoot);
    child = execFile(python, args, {windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8'}, (error, stdout) => {
      child = null;
      if (error) return reject(Error('罗技设备读取失败：' + error.message));
      try {
        const reply = JSON.parse(stdout);
        if (reply.ok === false) throw Error(reply.error);
        resolve(reply);
      } catch (failure) { reject(failure); }
    });
    child.stdin.end(JSON.stringify(request));
  }));
  function enqueue(request) {
    if (closed) return Promise.reject(Error('罗技设备模块已关闭'));
    const job = queue.catch(() => {}).then(() => {
      if (closed) throw Error('罗技设备模块已关闭');
      return transport(request);
    });
    queue = job;
    return job;
  }
  function identity(id) {
    if (typeof id !== 'string' || !/^logitech-046d-[a-f0-9]{4}-[a-f0-9]{20}$/.test(id)) throw Error('请选择实际连接的罗技设备');
    return id;
  }
  return Object.freeze({
    listModels: () => loadCatalog().models,
    scan: () => enqueue({action: 'scan'}),
    status: id => enqueue({action: 'status', deviceId: identity(id)}),
    execute: ({deviceId, command, value}) => {
      if (!['dpi.set', 'pollRate.set', 'brightness.set', 'hostMode.set'].includes(command)) return Promise.reject(Error('未开放的罗技设备操作'));
      return enqueue({action: 'execute', deviceId: identity(deviceId), command, value});
    },
    close() { closed = true; child?.kill(); return queue.catch(() => {}); },
  });
}
module.exports = {PROVIDER, loadCatalog, getLogitechSupport, createLogitechService};
