/* Offline UI and iframe policy test only; no compatible keyboard is simulated as real hardware. */
'use strict';
const {chromium}=require('playwright'),{startServer}=require('../library/host/local-server.cjs');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
  const root=path.resolve(__dirname,'..'),server=await startServer(path.join(root,'.handoff-work','via-source','dist'),{spaFallback:true});
  const browser=await chromium.launch({channel:'msedge',headless:true}),external=[],errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
    await page.route(/^https?:/,route=>{if(new URL(route.request().url()).origin!==server.origin){external.push(route.request().url());return route.abort();}return route.continue();});
    await page.addInitScript(({origin})=>{window.one4allKeyboard={status:async()=>({devices:[{id:'fixture',product:'VIA UI fixture',vendorId:1,productId:2,version:1,manufacturer:'Test only',standardKeyboard:true,collections:[],via:{available:false,catalogListed:false}}]}),openVia:async(id,mode)=>({url:origin+'/?dcTheme=dark&one4allEmbedded=1&one4allMode='+mode})};},{origin:server.origin});
    await page.goto(pathToFileURL(path.join(root,'library','examples','hid-keyboard.html')).href);await page.waitForFunction(()=>document.querySelector('select').options.length===2);await page.getByLabel('选择 HID 设备',{exact:true}).selectOption('fixture');await page.locator('[data-category="remap"]').click();await page.getByRole('button',{name:'尝试 VIA 连接',exact:true}).click();
    const frame=page.frameLocator('.dc-hid-via-frame');await frame.locator('#root').waitFor();await frame.getByRole('button').first().waitFor({timeout:20000});
    const policy=await page.locator('.dc-hid-via-frame').evaluate(async iframe=>({allow:iframe.allow}));assert.equal(policy.allow,'hid');
    const child=page.frames().find(f=>f.url().startsWith(server.origin));const state=await child.evaluate(async()=>({hidAvailable:!!navigator.hid,hidAllowed:(document.permissionsPolicy||document.featurePolicy).allowsFeature('hid'),authorized:(await navigator.hid.getDevices()).length,text:document.body.innerText.slice(0,300)}));
    assert.equal(state.hidAvailable,true);assert.equal(state.hidAllowed,true);assert.equal(state.authorized,0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    assert.match(state.text,/authorize|授权|选择键盘/i);
    await page.getByRole('button',{name:'导入 VIA 定义',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow!==null);
    const design=page.frameLocator('.dc-hid-via-frame');await design.locator('input[type=file]').waitFor({state:'attached',timeout:20000});
    const route=page.frames().find(f=>f.url().startsWith(server.origin));assert.equal(new URL(route.url()).pathname,'/design');
    const out=path.join(root,'design','hid-keyboard-previews');await page.screenshot({path:path.join(out,'via-embedded-offline.png')});fs.writeFileSync(path.join(out,'via-report.json'),JSON.stringify({kind:'offline-via-iframe-fixture',hardwareVerified:false,state,manualImportRoute:true,externalRequests:external.length},null,2));console.log(JSON.stringify({offlineViaLoaded:true,iframeHidPolicy:true,manualImportRoute:true,unlistedAttemptVisible:true,externalRequests:0,hardwareVerified:false,text:state.text}));
  }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
