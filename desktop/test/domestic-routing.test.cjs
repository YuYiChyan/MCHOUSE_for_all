'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hidTarget,matchesHidTarget}=require('../core/domestic-models.cjs');
test('HID grant accepts the actual vendor child collection, rejects a different interface',()=>{
 const target=hidTarget({id:'fixture',support:{filters:[{vendorId:9741,productId:1,usagePage:65282,usage:2}]}});
 const device={vendorId:9741,productId:1,collections:[{usagePage:1,usage:2,children:[{usagePage:65282,usage:2}]}]};
 assert.equal(matchesHidTarget(device,target),true);
 assert.equal(matchesHidTarget({...device,productId:2},target),false);
 assert.equal(matchesHidTarget({...device,collections:[{usagePage:1,usage:2}]},target),false);
});
test('MelGeek grants retain the exact model name alongside vendor filtering',()=>{
 const target=hidTarget({id:'made68',support:{vendorIds:[1046,14420],usagePages:[65376],productNames:['MADE68','MelGeek MADE68']}});
 assert.equal(matchesHidTarget({vendorId:1046,productId:0x110,name:'MelGeek MADE68',collections:[{usagePage:65376}]},target),true);
 assert.equal(matchesHidTarget({vendorId:1046,productId:0x110,name:'MADE68 Pro',collections:[{usagePage:65376}]},target),false);
});
