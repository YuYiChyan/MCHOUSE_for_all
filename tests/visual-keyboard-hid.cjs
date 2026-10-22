/* Offline component verification only; no real device backend. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design','hid-keyboard-previews');fs.mkdirSync(out,{recursive:true});
const url=pathToFileURL(path.join(root,'library/examples/hid-keyboard.html')).href;
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const results=[];
  try{
    for(const theme of ['light','dark'])for(const width of [1280,960,720]){
      const page=await browser.newPage({viewport:{width,height:800}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
      await page.addInitScript(()=>{
        window.__reads=0;window.__fail=false;window.__appearance={name:'',imageDataUrl:''};window.__testActive=false;window.__via=false;
        window.one4allKeyboard={status:async()=>{
          window.__reads++;await new Promise(resolve=>setTimeout(resolve,30));if(window.__fail)throw Error('fixture unplugged');
          return {devices:[{id:'fixture',product:'Fixture Keyboard',appearance:{...window.__appearance},via:{available:window.__via},manufacturer:'Synthetic test',vendorId:0x1A2C,productId:0x9DFE,version:0x110,grouping:'container',candidateProfiles:['tk870-wired'],collections:[{usageName:'System Control',usagePage:1,usage:0x80,inputBytes:8,outputBytes:1,featureBytes:0},{usageName:'Vendor Defined',usagePage:0xFF01,usage:1,inputBytes:0,outputBytes:8,featureBytes:8}]}]};
        },saveAppearance:async({deviceId,...value})=>{if(deviceId!=='fixture')throw Error('Wrong device');window.__appearance={...value};return {...value};},
          startTest:async()=>{window.__testActive=true;return {active:true};},stopTest:async()=>{window.__testActive=false;},
          onTestKey:callback=>{window.__nativeKey=callback;return ()=>{if(window.__nativeKey===callback)window.__nativeKey=null;};},
          onTestStopped:callback=>{window.__nativeStop=callback;return ()=>{if(window.__nativeStop===callback)window.__nativeStop=null;};},
          openVia:async()=>({url:'http://127.0.0.1:9/'})};
      });
      await page.goto(url+'?dcTheme='+theme);await page.waitForLoadState('networkidle');
      await page.waitForFunction(()=>document.querySelector('select').options.length===2);
      await page.locator('select').selectOption('fixture');
      for(const tab of ['overview','test','mouse','remap','interfaces','appearance']){
        await page.locator(`[data-category="${tab==='mouse'?'test':tab}"]`).click();
        if(tab==='mouse')await page.locator('[data-test-mode="mouse"]').click();
        await page.locator('.dc-hid-notice').evaluate(n=>{n.textContent='视觉测试样本（非实机）';});
        const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,sidebar:document.querySelector('.dc-sidebar').getBoundingClientRect().width,nav:document.querySelector('.dc-nav-item').getBoundingClientRect().height,theme:document.documentElement.dataset.dcTheme}));
        assert.equal(layout.sidebar,width<=720?180:width<=1100?240:320);assert.equal(layout.nav,40);assert.equal(layout.theme,theme);assert.ok(layout.scrollWidth<=width+1,'no horizontal page overflow');
        if(tab==='interfaces'){assert.match(await page.locator('table').innerText(),/0xFF01/);assert.match(await page.locator('table').innerText(),/System Control/);}
        if(tab==='remap'){assert.equal(await page.getByRole('button',{name:'尝试 VIA 连接',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'导入 VIA 定义',exact:true}).count(),1);}
        if(width===1280||width===720&&tab==='interfaces')await page.screenshot({path:path.join(out,`${theme}-${width}-${tab}.png`)});
        results.push({theme,width,tab,layout});
      }
      await page.getByRole('button',{name:'命名',exact:true}).click();
      await page.locator('.dc-hid-name').fill('我的 TK870 <测试>');await page.getByRole('button',{name:'保存名称',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.dc-sidebar-name').textContent==='我的 TK870 <测试>');
      await page.getByLabel('设备类型',{exact:true}).selectOption('mouse');await page.waitForFunction(()=>window.__appearance.deviceType==='mouse');
      await page.locator('[data-category="test"]').click();assert.equal(await page.locator('[data-test-mode="mouse"]').count(),1);assert.equal(await page.locator('[data-test-mode="keyboard"]').count(),0);
      await page.locator('[data-category="appearance"]').click();await page.getByLabel('设备类型',{exact:true}).selectOption('auto');await page.waitForFunction(()=>window.__appearance.deviceType==='auto');
      assert.equal(await page.locator('.dc-sidebar-name').locator('*').count(),0);
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
      await page.locator('input[type=file]').setInputFiles({name:'商品.png',mimeType:'image/png',buffer:png});
      await page.waitForSelector('.dc-hid-preview img');
      await page.evaluate(()=>window.keyboardWidget.refresh());assert.equal(await page.locator('.dc-sidebar-name').innerText(),'我的 TK870 <测试>');assert.equal(await page.locator('.dc-hid-preview img').count(),1);
      await page.getByRole('button',{name:'移除商品图',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.dc-hid-preview img'));
      await page.locator('input[type=file]').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
      await page.waitForFunction(()=>document.querySelector('.dc-hid-notice').textContent.includes('请选择 PNG'));
      await page.locator('[data-category="test"]').click();
      await page.locator('[data-test-mode="keyboard"]').click();
      await page.getByRole('button',{name:'开始测试',exact:true}).click();await page.waitForSelector('.dc-hid-testpad.testing');await page.keyboard.down('a');
      assert.match(await page.locator('.dc-hid-key-output').innerText(),/KeyA/);assert.match(await page.locator('[data-code="KeyA"]').getAttribute('class'),/is-press/);await page.keyboard.up('a');
      assert.doesNotMatch(await page.locator('[data-code="KeyA"]').getAttribute('class'),/is-press/);assert.match(await page.locator('[data-code="KeyA"]').getAttribute('class'),/is-tested/);
      await page.getByLabel('选择 HID 设备',{exact:true}).focus();await page.keyboard.press('b');assert.doesNotMatch(await page.locator('.dc-hid-history').innerText(),/KeyB/);
      await page.getByRole('button',{name:'开始测试',exact:true}).click();await page.waitForSelector('.dc-hid-testpad.testing');await page.keyboard.press('Escape');assert.match(await page.locator('[data-code="Escape"]').getAttribute('class'),/is-tested/);assert.equal(await page.locator('.dc-hid-testpad.testing').count(),1);
      await page.evaluate(()=>window.__nativeKey({code:'MetaLeft',down:true}));assert.match(await page.locator('[data-code="MetaLeft"]').getAttribute('class'),/is-press/);await page.evaluate(()=>window.__nativeKey({code:'MetaLeft',down:false}));
      await page.getByRole('button',{name:'停止测试',exact:true}).click();assert.equal(await page.locator('.dc-hid-key-output').innerText(),'测试已停止');assert.equal(await page.evaluate(()=>window.__testActive),false);
      await page.getByLabel('键盘参考配列',{exact:true}).selectOption('tkl');assert.equal(await page.locator('[data-code="Numpad1"]').count(),0);assert.equal(await page.locator('[data-code="ArrowUp"]').count(),1);
      await page.locator('[data-test-mode="mouse"]').click();await page.getByRole('button',{name:'开始检测',exact:true}).click();
      const pad=page.getByLabel('鼠标检测区域',{exact:true}),box=await pad.boundingBox();await page.mouse.move(box.x+30,box.y+50);
      for(const [button,id]of [['left',0],['middle',1],['right',2]]){await page.mouse.down({button});assert.match(await page.locator(`[data-mouse-button="${id}"]`).getAttribute('class'),/is-press/);await page.mouse.up({button});assert.doesNotMatch(await page.locator(`[data-mouse-button="${id}"]`).getAttribute('class'),/is-press/);}
      for(const id of [3,4]){await pad.dispatchEvent('mousedown',{button:id});assert.match(await page.locator(`[data-mouse-button="${id}"]`).getAttribute('class'),/is-press/);await pad.dispatchEvent('mouseup',{button:id});}
      await page.mouse.wheel(0,-100);await page.waitForFunction(()=>document.querySelector('[data-mouse-button="up"]').classList.contains('is-tested'));await page.getByRole('button',{name:'停止检测',exact:true}).click();assert.equal(await page.locator('.dc-hid-mouse-output').innerText(),'检测已停止');
      await page.evaluate(async()=>{window.__via=true;await window.keyboardWidget.refresh();});await page.locator('[data-category="remap"]').click();assert.equal(await page.getByRole('button',{name:'连接 VIA',exact:true}).count(),1);
      const count=await page.evaluate(()=>window.__reads);await page.evaluate(()=>Promise.all([window.keyboardWidget.refresh(),window.keyboardWidget.refresh(),window.keyboardWidget.refresh()]));assert.equal(await page.evaluate(()=>window.__reads),count+1);
      assert.equal(await page.evaluate(()=>One4AllHidKeyboard.mount(document.body)===window.keyboardWidget),true);
      await page.evaluate(async()=>{window.__fail=true;await window.keyboardWidget.refresh();});assert.match(await page.locator('.dc-hid-notice').innerText(),/fixture unplugged/);assert.equal(await page.getByLabel('选择 HID 设备',{exact:true}).isDisabled(),true);
      await page.evaluate(()=>window.keyboardWidget.destroy());assert.equal(await page.locator('.dc-page').count(),0);assert.deepEqual(errors,[]);await page.close();
    }
    const offline=await browser.newPage();await offline.goto(url);assert.match(await offline.locator('.dc-config').innerText(),/尚未接入本机读取接口/);await offline.close();
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({kind:'offline-component-fixture',hardwareVerified:false,results},null,2));
    console.log(`PASS ${results.length} component layouts; rename, image upload/removal/validation, focused input, scan coalescing and disposal verified`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
