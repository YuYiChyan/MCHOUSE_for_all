'use strict';

// The catalogue defines the shared UI vocabulary, not claims about connected hardware.
const catalogue = Object.freeze({
  keymap: { label: '按键映射', group: '按键', type: 'keymap' },
  layers: { label: '键盘层', group: '按键', type: 'select' },
  macros: { label: '宏', group: '按键', type: 'macro' },
  winLock: { label: '锁定 Windows 键', group: '按键', type: 'boolean' },
  nkro: { label: '全键无冲', group: '按键', type: 'boolean' },
  lightingEffect: { label: '灯光效果', group: '灯效', type: 'select' },
  lightingColor: { label: '灯光颜色', group: '灯效', type: 'color' },
  lightingBrightness: { label: '灯光亮度', group: '灯效', type: 'number' },
  lightingSpeed: { label: '灯光速度', group: '灯效', type: 'number' },
  perKeyLighting: { label: '单键灯光', group: '灯效', type: 'fields', fields: [{ id: 'key', label: '按键', type: 'key' }, { id: 'color', label: '颜色', type: 'color' }] },
  pollingRate: { label: '回报率', group: '性能', type: 'select', unit: 'Hz' },
  debounce: { label: '去抖时间', group: '性能', type: 'number', unit: 'ms' },
  sleepTimeout: { label: '休眠时间', group: '性能', type: 'number', unit: '分钟' },
  actuation: { label: '触发点', group: '磁轴', type: 'number', unit: 'mm' },
  rapidTrigger: { label: '快速触发（RT）', group: '磁轴', type: 'fields', fields: [{ id: 'enabled', label: '启用', type: 'boolean' }, { id: 'press', label: '按下灵敏度', type: 'number', unit: 'mm' }, { id: 'release', label: '松开灵敏度', type: 'number', unit: 'mm' }] },
  deadzone: { label: '顶部 / 底部死区', group: '磁轴', type: 'fields', fields: [{ id: 'top', label: '顶部', type: 'number', unit: 'mm' }, { id: 'bottom', label: '底部', type: 'number', unit: 'mm' }] },
  dks: { label: '动态键程（DKS）', group: '磁轴', type: 'fields', fields: [{ id: 'key', label: '按键', type: 'key' }, { id: 'stage1', label: '第一触发点', type: 'number', unit: 'mm' }, { id: 'action1', label: '第一动作', type: 'key' }, { id: 'stage2', label: '第二触发点', type: 'number', unit: 'mm' }, { id: 'action2', label: '第二动作', type: 'key' }] },
  socd: { label: '相反方向按键处理（SOCD）', group: '磁轴', type: 'select' },
  calibration: { label: '磁轴校准', group: '磁轴', type: 'action', actionLabel: '开始校准' },
  activeProfile: { label: '板载配置', group: '配置', type: 'select' },
  saveProfile: { label: '保存到键盘', group: '配置', type: 'action', actionLabel: '保存当前配置' },
});

const commandPattern = /^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/;
const scalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
function validRange(range) {
  return range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.max >= range.min && Number.isFinite(range.step) && range.step > 0;
}
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.flatMap(item => {
    const option = scalar(item) ? { value: item, label: String(item) } : item;
    return option && scalar(option.value) && typeof option.label === 'string' ? [{ value: option.value, label: option.label }] : [];
  });
}

function normalizeCapabilities(report) {
  // A matching vendor/product ID is discovery evidence only. A provider must also
  // confirm an interface and report implemented commands for this device session.
  if (!report || report.connected !== true || report.interfaceConfirmed !== true || typeof report.provider !== 'string' || !report.provider || typeof report.version !== 'string' || !report.version || !Array.isArray(report.evidence) || !report.evidence.some(item => typeof item === 'string' && item.length) || !Array.isArray(report.capabilities)) return [];
  const seen = new Set();
  return report.capabilities.flatMap(cap => {
    if (!cap || seen.has(cap.id) || !Object.hasOwn(catalogue, cap.id) || cap.supported !== true) return [];
    const spec = catalogue[cap.id];
    const readable = cap.readable === true && typeof cap.readCommand === 'string' && commandPattern.test(cap.readCommand);
    const writable = cap.writable === true && typeof cap.writeCommand === 'string' && commandPattern.test(cap.writeCommand);
    // Settings require readback. Action results are acknowledged by their provider.
    if ((!readable && !writable) || (spec.type !== 'action' && !readable)) return [];
    const normalized = { ...spec, id: cap.id, supported: true, readable, writable, readCommand: readable ? cap.readCommand : null, writeCommand: writable ? cap.writeCommand : null, provider: report.provider, version: report.version, evidence: report.evidence.filter(item => typeof item === 'string') };
    if (spec.type === 'number') {
      if (!validRange(cap.range)) return [];
      normalized.range = { min: cap.range.min, max: cap.range.max, step: cap.range.step };
    }
    if (spec.type === 'select') {
      normalized.options = normalizeOptions(cap.options);
      if (!normalized.options.length) return [];
    }
    if (spec.type === 'keymap' || spec.type === 'fields') {
      normalized.keys = normalizeOptions(cap.keys);
      if ((spec.type === 'keymap' || spec.fields.some(field => field.type === 'key')) && !normalized.keys.length) return [];
    }
    if (spec.type === 'keymap') {
      normalized.actions = normalizeOptions(cap.actions);
      normalized.layers = normalizeOptions(cap.layers);
      if (!normalized.actions.length || !normalized.layers.length) return [];
    }
    if (spec.type === 'fields') {
      normalized.fields = spec.fields.map(field => ({ ...field, ...(field.type === 'number' && validRange(cap.ranges?.[field.id]) ? { range: { ...cap.ranges[field.id] } } : {}) }));
      if (normalized.fields.some(field => field.type === 'number' && !field.range)) return [];
    }
    if (spec.type === 'macro') {
      if (!Number.isInteger(cap.maxEvents) || cap.maxEvents < 1 || cap.maxEvents > 10000 || !Array.isArray(cap.keys)) return [];
      normalized.maxEvents = cap.maxEvents;
      normalized.keys = normalizeOptions(cap.keys);
      if (!normalized.keys.length) return [];
    }
    if (typeof cap.description === 'string') normalized.description = cap.description.slice(0,400);
    seen.add(cap.id);
    return [normalized];
  });
}

function assertValue(cap, value) {
  if (!cap || !cap.writable) throw new Error('此设备没有开放该设置');
  function number(range, candidate) {
    if (!validRange(range) || typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < range.min || candidate > range.max || Math.abs((candidate-range.min)/range.step - Math.round((candidate-range.min)/range.step)) > 1e-6) throw new Error('数值不在设备支持范围内');
  }
  function option(options, candidate) { if (!options.some(item => item.value === candidate)) throw new Error('设备不支持此选项'); }
  if (cap.type === 'number') number(cap.range, value);
  else if (cap.type === 'select') option(cap.options, value);
  else if (cap.type === 'boolean') { if (typeof value !== 'boolean') throw new Error('需要开关值'); }
  else if (cap.type === 'color') { if (typeof value !== 'string' || !/^#[a-f0-9]{6}$/i.test(value)) throw new Error('颜色格式错误'); }
  else if (cap.type === 'keymap') {
    if (!value || typeof value !== 'object') throw new Error('缺少按键映射');
    option(cap.keys,value.key);option(cap.layers,value.layer);option(cap.actions,value.action);
  } else if (cap.type === 'fields') {
    if (!value || typeof value !== 'object') throw new Error('缺少设置');
    for (const field of cap.fields) {
      const part = value[field.id];
      if (field.type === 'number') number(field.range, part);
      else if (field.type === 'key') option(cap.keys,part);
      else if (field.type === 'boolean' && typeof part !== 'boolean') throw new Error('需要开关值');
      else if (field.type === 'color' && (typeof part !== 'string' || !/^#[a-f0-9]{6}$/i.test(part))) throw new Error('颜色格式错误');
    }
  } else if (cap.type === 'macro') {
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80 || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > cap.maxEvents) throw new Error('宏名称或事件数量不符合设备要求');
    for (const event of value.events) {
      if (!['down','up'].includes(event.type) || !cap.keys.some(item => item.value === event.code) || !Number.isInteger(event.delayMs) || event.delayMs < 0 || event.delayMs > 60000) throw new Error('宏事件不符合设备要求');
    }
  }
  return value;
}

function createController({ report, execute }) {
  if (typeof execute !== 'function') throw new TypeError('execute is required');
  const capabilities = normalizeCapabilities(report);
  let queue = Promise.resolve();
  const confirmed = response => {
    if (response?.ok === false) throw new Error(response.error || '设备读取失败');
    if (response === undefined) throw new Error('设备未返回当前设置');
    return response;
  };
  const enqueue = operation => { const pending=queue.catch(()=>{}).then(operation);queue=pending;return pending; };
  return Object.freeze({
    capabilities,
    read(id) { const cap=capabilities.find(item=>item.id===id);if(!cap?.readable)return Promise.reject(new Error('此设备没有开放该读取接口'));return enqueue(async()=>confirmed(await execute(cap.readCommand,{capability:id}))); },
    write(id,value) {
      const cap=capabilities.find(item=>item.id===id);
      try { assertValue(cap,value); } catch(error) { return Promise.reject(error); }
      return enqueue(async()=>{
        const result=await execute(cap.writeCommand,{capability:id,value});
        if(result?.ok===false)throw new Error(result.error||'设备拒绝了设置');
        if(cap.readable)return confirmed(await execute(cap.readCommand,{capability:id}));
        if(result?.ok!==true)throw new Error('设备尚未确认操作完成');
        return result;
      });
    },
  });
}

module.exports = { catalogue, normalizeCapabilities, assertValue, createController };
