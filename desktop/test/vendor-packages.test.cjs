'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createPackageManager, checkedUrl, sourceFor } = require('../core/vendor-packages.cjs');

const entry = { id:'sample', name:'Sample', homepage:'https://vendor.example/', source:{type:'official', url:'https://vendor.example/setup.exe', filename:'setup.exe', format:'exe', allowedHosts:['vendor.example']}, installedExecutables:[] };
function fixture(t, overrides = {}) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(),'one4all-packages-'));
  t.after(() => fs.rmSync(dataRoot, { recursive:true, force:true }));
  return { dataRoot, manager:createPackageManager({ dataRoot, entries:[entry], ...overrides }) };
}
test('official sources take precedence; redirects cannot escape the known vendor hosts', () => {
  assert.equal(sourceFor({...entry,adapter:{type:'github'}}).type,'official');
  assert.equal(checkedUrl(entry.source.url,['vendor.example']).hostname,'vendor.example');
  for (const url of ['https://vendor.example.attacker.net/setup.exe','http://vendor.example/setup.exe','https://user:pw@vendor.example/setup.exe','https://vendor.example:8443/setup.exe']) {
    assert.throws(()=>checkedUrl(url,['vendor.example']));
  }
  assert.throws(()=>sourceFor({source:{type:'github',version:'latest',url:'https://github.com/o/r/releases/latest/a.zip'}}));
});
test('download is deduplicated, records exact bytes, and does not install or declare an adapter', async t => {
  let calls = 0, launches = 0;
  const data = Buffer.from('MZ-fixture-installer');
  const { manager } = fixture(t, { transport:async url => { calls++; return {stream:Readable.from([data]),total:data.length,url}; }, openPath:async()=>{launches++;return '';} });
  const a = manager.download('sample'), b = manager.download('sample');
  assert.equal(a,b); await Promise.all([a,b]);
  const result = manager.status('sample');
  assert.equal(calls,1); assert.equal(result.downloaded,true); assert.equal(result.installed,false);
  assert.equal(result.adapterReady,false); assert.equal(result.bytes,data.length); assert.equal(launches,0);
  const installation = await manager.install('sample');
  assert.equal(launches,1); assert.equal(installation.installerStarted,true); assert.equal(installation.installed,false);
  await manager.download('sample'); assert.equal(calls,1);
});
test('HTML error responses and truncated packages remain unavailable for installation', async t => {
  let launches = 0;
  const { manager } = fixture(t, { transport:async url=>({stream:Readable.from(['<html>error</html>']),total:null,url}),openPath:async()=>{launches++;return '';} });
  await assert.rejects(manager.download('sample'),/Windows/);
  assert.equal(manager.status('sample').downloaded,false);
  await assert.rejects(manager.install('sample'),/请先下载/); assert.equal(launches,0);
});
test('a changed downloaded file cannot be launched; an unknown id is rejected', async t => {
  const data = Buffer.from('MZ-one');
  const { manager } = fixture(t, { transport:async url=>({stream:Readable.from([data]),total:data.length,url}) });
  await manager.download('sample');
  fs.writeFileSync(manager.status('sample').downloadPath,Buffer.from('MZ-two'));
  await assert.rejects(manager.install('sample'),/已改变/);
  assert.throws(()=>manager.status('../evil'),/未登记/);
});
