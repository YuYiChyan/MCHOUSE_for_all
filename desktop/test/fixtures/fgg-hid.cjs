'use strict';
// In-memory peripheral only. Also loadable by the isolated browser UI smoke.
(function(root){
 class FggFakeDevice{
  constructor({productId=0x1064,configIndex=2}={}){this.vendorId=0x373b;this.productId=productId;this.productName='NANO68';this.collections=[{usagePage:1,usage:0,outputReports:[{reportId:0}]}];this.opened=false;this.closes=0;this.requests=[];this.listeners=new Map();this.configIndex=configIndex;this.fast=false;
   this.func=Uint8Array.from({length:56},(_,i)=>i+16);this.func[0]=0x50;this.func[2]=0xaa;this.func[3]=0xbb;this.func[4]=0x91;this.func[6]=0xaa;this.func[8]=3;this.func[9]=80;this.func[10]=1;this.func[12]=1;this.func.set([0x12,0x34,0x56],14);
   this.matrix=new Uint8Array(384);this.matrix.set([0x10,4,0,0x10,26,0,0x10,41,0,0x10,0,2,0xf0,1,0]);this.travel=new Uint8Array(1024);const v=new DataView(this.travel.buffer);for(let k=0;k<128;k++){this.travel[k*8]=0xa4;this.travel[k*8+1]=0xb1;v.setUint16(k*8+2,0xc000|99,true);v.setUint16(k*8+4,(20<<9)|19,true);v.setUint16(k*8+6,(40<<9)|29,true);}
  }
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(data,reportId=0){const event={device:this,reportId,data:new DataView(data.buffer,data.byteOffset,data.byteLength)};for(const fn of this.listeners.get('inputreport')||[])fn(event);}
  async open(){if(this.openGate)await this.openGate;this.opened=true;}
  async close(){this.opened=false;this.closes++;}
  async sendReport(reportId,data){const b=new Uint8Array(data),v=new DataView(b.buffer);if(reportId!==0||b.length!==64||b[0]!==0x55||b[3]!==b.slice(4).reduce((sum,n)=>sum+n,0)%256)throw Error('Bad native frame');this.requests.push([...b]);if(this.silent)return;const cmd=b[1],address=v.getUint16(5,true),len=b[4],out=b.slice();out[0]=0xaa;out.fill(0,8);
   if(cmd===3)out.set([0x10,1],8);else if(cmd===4)out.set([this.configIndex,3],8);else if(cmd===5||cmd===6){if(address!==this.configIndex*64||len!==56)throw Error('Wrong function profile');if(cmd===6&&!this.ignoreWrite)this.func=b.slice(8);out.set(this.func,8);}
   else if(cmd===7){const offset=address-this.configIndex*0x800;if(offset<0||offset+len>384)throw Error('Wrong key matrix offset');out.set(this.matrix.slice(offset,offset+len),8);}
   else if(cmd===0xa0||cmd===0xa1){const offset=address-this.configIndex*0x400;if(offset<0||offset+len>1024)throw Error('Wrong trigger profile');if(cmd===0xa1){if(!this.fast)throw Error('Fast communication not started');if(!this.ignoreWrite)this.travel.set(b.slice(8,8+len),offset);}out.set(this.travel.slice(offset,offset+len),8);}
   else if(cmd===1)this.fast=true;else if(cmd===2)this.fast=false;else throw Error('Unexpected native command '+cmd);
   if(this.corruptReplyLength)out[4]^=1;if(this.wrongAddress)out[5]^=1;queueMicrotask(()=>this.emit(out));
  }
 }
 function fakeHid(device){return {getDevices:async()=>[device],requestDevice:async()=>[device],addEventListener(){},removeEventListener(){}};}
 root.FggFakeDevice=FggFakeDevice;root.fggFakeHid=fakeHid;if(typeof module==='object'&&module.exports)module.exports={FggFakeDevice,fakeHid};
})(globalThis);
