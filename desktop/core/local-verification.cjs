'use strict';
const fs = require('node:fs');
const path = require('node:path');

function identity(input = {}) {
  const modelId = input.modelId, providerVersion = input.providerVersion;
  for (const [name,value] of [['型号',modelId],['适配器版本',providerVersion]]) {
    if (typeof value !== 'string' || !value.trim() || value.length > 240 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('请提供有效的' + name);
  }
  return {modelId,providerVersion};
}
const keyOf = value => JSON.stringify([value.modelId,value.providerVersion]);

function createLocalVerification({dataRoot} = {}) {
  if (!dataRoot || !path.isAbsolute(dataRoot)) throw new TypeError('dataRoot must be an absolute path');
  fs.mkdirSync(dataRoot,{recursive:true});
  const file = path.join(dataRoot,'local-verifications.json');
  const records = new Map();
  try {
    const saved = JSON.parse(fs.readFileSync(file,'utf8'));
    if (saved.schema === 1 && Array.isArray(saved.records)) for (const record of saved.records) {
      try {
        const target = identity(record);
        if (record.confirmed === true && typeof record.confirmedAt === 'string') records.set(keyOf(target),{...target,confirmed:true,confirmedAt:record.confirmedAt,scope:'local'});
      } catch {}
    }
  } catch {}
  function status(input) {
    const target = identity(input), record = records.get(keyOf(target));
    return record ? {...record} : {...target,confirmed:false,confirmedAt:null,scope:'local'};
  }
  function set(input = {}) {
    const target = identity(input);
    if (typeof input.confirmed !== 'boolean') throw new Error('请选择确认或撤销');
    const key = keyOf(target), next = new Map(records);
    if (input.confirmed) next.set(key,{...target,confirmed:true,confirmedAt:records.get(key)?.confirmedAt || new Date().toISOString(),scope:'local'});
    else next.delete(key);
    const temp = file + '.tmp';
    fs.writeFileSync(temp,JSON.stringify({schema:1,records:[...next.values()]},null,2),{mode:0o600});
    fs.renameSync(temp,file);
    records.clear();for (const [key,record] of next) records.set(key,record);
    return status(target);
  }
  return {status,set,list:() => [...records.values()].map(record => ({...record}))};
}

module.exports = {createLocalVerification};
