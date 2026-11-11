const test=require('node:test'),assert=require('node:assert/strict');
const {MouseSession,matching,createApi}=require('../app/inphic-provider.js');
const catalog=require('../catalog/inphic-protocols.json');
function fixture(family=3){
 const protocol=catalog.models.find(m=>m.family===family),connection=protocol.connections[0],dpi=new Uint8Array(56),light=new Uint8Array(37),rate=Uint8Array.from([6,9,2,0x74,0x8b,0,0,0,0]);
 dpi.set([4,56,2,0x21,0x11,0b101,0,0b1011]);dpi[24]=3;dpi[49]=1;light.set([5,37,2,1,0x93,0x58,9,31,55,17,6]);light[34]=family===3?4:0;
 for(const [index,value]of [[0,800],[2,1600]]){const encoded=family===3?value/50-1:value;dpi[8+index]=encoded&255;dpi[16+index]=encoded>>>8;}light[13]=23; // ZHEN Y at slot 3 is 1200.
 dpi[31]=0x90;light[27]=1;light[28]=0xF8;light[29]=2;
 const reports=new Map([[4,dpi],[5,light],[6,rate],[12,Uint8Array.from([12,9,0,2,0,0,0,0,0])]]),writes=[];
 const device={...connection,opened:false,collections:[{usagePage:connection.usagePage,usage:connection.usage,featureReports:[160,4,5,6,12].map(reportId=>({reportId,items:[{reportSize:8,reportCount:reportId===160?7:63}]}))}],async open(){this.opened=true;},async close(){this.opened=false;},async sendFeatureReport(id,data){if(id===160){assert.equal(data[3],id===12?1:data[3]);return;}const packet=Uint8Array.from([id,...data]).slice(0,reports.get(id).length);writes.push(packet);reports.set(id,packet);},async receiveFeatureReport(id){const b=reports.get(id);return new DataView(b.slice().buffer);}};
 const session=new MouseSession(device,protocol,{delay:async()=>{}});return {session,device,protocol,reports,writes};
}
test('ZHEN keeps sparse DPI slots, independent Y, unrelated settings and checksum',async()=>{
 const f=fixture();const before=await f.session.status();assert.deepEqual(before.values.dpi,[1600,1200]);assert.equal(before.values.dpiStages.active,2);
 const untouched=f.reports.get(4).slice(),light=f.reports.get(5).slice();const after=await f.session.execute('dpi.set',[2400,1800]);assert.deepEqual(after.values.dpi,[2400,1800]);
 const packet=f.writes[0];assert.equal(packet[10],47);assert.equal(packet[18],0);assert.equal(packet[5],5);assert.equal(packet[7],untouched[7]);assert.equal(packet[31],untouched[31]);assert.equal(packet[50]*256+packet[51],packet.slice(3,50).reduce((a,b)=>a+b,0));
 const second=f.writes[1];assert.equal(second[13],35);for(const index of [3,4,5,6,7,8,27,28,29,34])assert.equal(second[index],light[index]);await f.session.close();assert.equal(f.device.opened,false);
});
test('IN10 raw DPI encoding and USB polling preserve receiver polling nibble',async()=>{
 const f=fixture(4);assert.deepEqual((await f.session.status()).values.dpi,[1600,1600]);const after=await f.session.execute('dpi.set',[3200,3200]);assert.deepEqual(after.values.dpi,[3200,3200]);assert.equal(f.writes[0][10],0x80);assert.equal(f.writes[0][18],0x0c);
 await f.session.execute('pollRate.set',500);const rate=f.writes.at(-1);assert.equal(rate[3],0x73);assert.equal(rate[4],0x8c);await f.session.execute('dpiStage.set',1);assert.equal(f.writes.at(-1)[24],1);await f.session.close();
});
test('unknown values and shared wireless receivers cannot write settings',async()=>{
 const f=fixture();assert.equal(matching({...f.device,productId:0xfa65},f.protocol),false);assert.equal(matching({...f.device,productId:0xfa60},f.protocol),false);
 await assert.rejects(f.session.execute('pollRate.set',8000),/不支持/);await assert.rejects(f.session.execute('dpi.set',[1234,1200]),/步进/);assert.equal(f.writes.length,0);await f.session.close();await assert.rejects(f.session.status(),/关闭/);
});
test('DPI readback mismatch reports failure, and discovery never writes',async()=>{
 const f=fixture(4),original=f.device.sendFeatureReport.bind(f.device);f.device.sendFeatureReport=async(id,data)=>{if(id!==4)return original(id,data);};await assert.rejects(f.session.execute('dpi.set',[2400,2400]),/重新读取/);await f.session.close();
 const f2=fixture();const api=createApi({model:{id:f2.protocol.id,name:f2.protocol.name,support:f2.protocol},hid:{getDevices:async()=>[f2.device]},prepare:async()=>{}});assert.equal((await api.scan()).devices.length,1);assert.equal(f2.device.opened,false);await api.close();assert.equal(f2.writes.length,0);
});

test('closing or timing out during open releases a late HID handle without writes',async()=>{
 for(const timeout of [false,true]){const f=fixture();let finish,started;const opening=new Promise(resolve=>{started=resolve;});f.device.open=()=>{started();return new Promise(resolve=>{finish=()=>{f.device.opened=true;resolve();};});};if(timeout)f.session.timeoutMs=5;const pending=f.session.status();const rejected=assert.rejects(pending,/关闭|超时/);await opening;if(timeout)await rejected;else await f.session.close();finish();await rejected;await new Promise(resolve=>setTimeout(resolve,0));assert.equal(f.device.opened,false);assert.equal(f.writes.length,0);}
});
