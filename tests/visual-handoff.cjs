/* Run with Node + Playwright and a local Edge/Chromium installation. No device access. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {catalog}=require('../library/ui/product-art.js');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'design','previews');fs.mkdirSync(output,{recursive:true});
const results=[];
(async()=>{
  const browser=await chromium.launch({channel:process.env.ONE4ALL_BROWSER_CHANNEL||'msedge',headless:true});
  try{
    for(const [folder,id] of [['logitech-g309','g309'],['blackshark-v2','blackshark']]){
      for(const theme of ['light','dark']){
        for(const width of [1280,960,720]){
          const page=await browser.newPage({viewport:{width,height:800},deviceScaleFactor:1});
          const errors=[];page.on('pageerror',error=>errors.push(error.message));
          await page.route(/^https?:/,route=>route.abort());
          await page.goto(pathToFileURL(path.join(root,folder,'payload',id+'.html')).href+'?dcTheme='+theme);
          const expectedNav=id==='g309'?3:5;
          assert.equal(await page.locator('.dc-nav-item').count(),expectedNav);
          for(let index=0;index<expectedNav;index++){
            await page.locator('.dc-nav-item').nth(index).click();
            const geometry=await page.evaluate(()=>{
              const bounds=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
              return {sidebar:bounds('.dc-sidebar'),nav:bounds('.dc-nav-item.active'),panel:bounds('.dc-panel'),content:bounds('.dc-config'),
                scrollWidth:document.documentElement.scrollWidth,innerWidth,background:getComputedStyle(document.body).backgroundColor,
                theme:document.documentElement.dataset.dcTheme,
                actionable:[...document.querySelectorAll('input[type=range],select')].filter(n=>!n.disabled).length};
            });
            assert.equal(geometry.sidebar.width,width<=720?180:width<=1100?240:320);
            assert.equal(geometry.nav.height,40);
            assert.ok(geometry.panel.x>=geometry.sidebar.right-1);
            assert.ok(geometry.nav.bottom<=800,'navigation remains visible');
            assert.ok(geometry.scrollWidth<=width+1,'no global horizontal overflow');
            assert.equal(geometry.theme,theme);
            assert.equal(geometry.background,theme==='dark'?'rgb(12, 12, 12)':'rgb(255, 255, 255)');
            const tab=await page.locator('.dc-nav-item.active').getAttribute('data-category');
            if(tab==='eq')assert.equal(await page.locator('.handoff-eq-slider').count(),10);
            if(width===1280||tab==='eq'&&width===720){
              await page.screenshot({path:path.join(output,`${id}-${theme}-${width}-${tab}.png`)});
            }
            results.push({id,theme,width,tab,geometry});
          }
          assert.deepEqual(errors,[]);await page.close();
        }
      }
    }
    for(const theme of ['light','dark'])for(const list of [false,true]){
      const page=await browser.newPage({viewport:{width:1280,height:800}});
      await page.goto(pathToFileURL(path.join(root,'tests/fixtures/native-home.html')).href);
      await page.evaluate(({theme,list})=>{
        document.body.classList.toggle('dark',theme==='dark');
        const original=document.querySelector('.device-card');original.classList.toggle('is-dark',theme==='dark');original.classList.toggle('is-list',list);
        window.__one4allEnabled=['g309','blackshark'];
      },{theme,list});
      await page.addScriptTag({path:path.join(root,'library/host/native-cards.js')});
      for(const [id,folder] of [['g309','logitech-g309'],['blackshark','blackshark-v2']]){
        for(const artwork of catalog[id]){
          const base64=fs.readFileSync(path.join(root,folder,'payload/product-assets',artwork.file)).toString('base64');
          await page.evaluate(({kind,base64})=>window.postMessage({source:'drivecenter',type:'product-art',kind,mimeType:'image/png',base64},'*'),{kind:artwork.id,base64});
        }
      }
      await page.waitForSelector('[data-dc-local="blackshark"]');
      for(const id of ['g309','blackshark']){
        const card=page.locator(`[data-dc-local="${id}"]`);
        assert.equal(await card.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0),true);
        assert.equal(await card.locator('.dc-card-color').isDisabled(),false);
        for(const artwork of catalog[id]){
          const metadata=JSON.parse(fs.readFileSync(path.join(root,id==='g309'?'logitech-g309':'blackshark-v2','ARTWORK.json'),'utf8')).find(record=>record.id===artwork.id);
          await page.waitForFunction(({id,width})=>{const img=document.querySelector(`[data-dc-local="${id}"] img`);return img.complete&&img.naturalWidth===width;},{id,width:metadata.width});
          const selected=await card.locator('.dc-card-color').getAttribute('title');assert.ok(selected.startsWith('切换颜色：'+artwork.label+' /'));
          await card.locator('.dc-card-color').click({force:true});
        }
        const picked=catalog[id].at(-1);
        await page.evaluate(({kind,color})=>window.postMessage({source:'drivecenter',type:'device-color',kind,color},'*'),{kind:id,color:picked.id});
        await page.waitForFunction(({id,color})=>localStorage.getItem('dc-color-'+id)===color,{id,color:picked.id});
        assert.ok((await card.locator('.dc-card-color').getAttribute('title')).startsWith('切换颜色：'+picked.label+' /'));
        await page.evaluate(({kind,color})=>window.postMessage({source:'drivecenter',type:'device-color',kind,color},'*'),{kind:id,color:catalog[id][0].id});
        await page.waitForFunction(({id,color})=>localStorage.getItem('dc-color-'+id)===color,{id,color:catalog[id][0].id});
        const layout=await card.evaluate(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,list:node.classList.contains('is-list'),dark:node.classList.contains('is-dark')}));
        assert.equal(layout.list,list);assert.equal(layout.dark,theme==='dark');
        assert.equal(layout.height,list?110:360);
        results.push({id,theme,tab:list?'home-list-fixture':'home-grid-fixture',geometry:layout});
      }
      await page.screenshot({path:path.join(output,`home-${theme}-${list?'list':'grid'}-fixture.png`)});
      await page.close();
    }
    // Synthetic API interaction tests are labelled visibly and never call a native backend.
    for(const [folder,id] of [['logitech-g309','g309'],['blackshark-v2','blackshark']]){
      const page=await browser.newPage({viewport:{width:1280,height:800}});
      await page.addInitScript(({id})=>{
        window.__one4allVisualFixture=true;window.__calls=[];window.__colorEvents=[];window.__fail=false;
        const state={connected:true,transport:id==='g309'?'lightspeed':'usb-audio',sampledAt:1,
          values:{dpi:800,reportRate:1000,onboardMode:'host',battery:75,outputVolume:50,outputMuted:false,inputVolume:40,inputMuted:false},
          capabilities:{dpiValues:[400,800,1600],reportRates:[125,250,500,1000],setDpi:true,setReportRate:true,setHostMode:true,output:true,input:true},eq:{configured:false,gains:Array(10).fill(0)}};
        const commands=id==='g309'?['setDpi','setReportRate','setHostMode']:['setOutputVolume','setInputVolume','setOutputMute','setInputMute','setEq'];
        window.one4allDevice={status:async()=>structuredClone(state),back:()=>{},setColor:async color=>{window.__colorEvents.push({kind:id,color});return {kind:id,color};},...Object.fromEntries(commands.map(command=>[command,async value=>{
          window.__calls.push({command,value});if(window.__fail)throw Error('fixture unplugged');
          if(command==='setDpi')state.values.dpi=value;
          if(command==='setReportRate')state.values.reportRate=value;
          if(command==='setOutputVolume')state.values.outputVolume=value;
          if(command==='setOutputMute')state.values.outputMuted=value;
          if(command==='setEq')state.eq={...state.eq,gains:value.gains,configuration:'# Synthetic EQ configuration',saved:false};
          return structuredClone(state);
        }]))};
      },{id});
      await page.goto(pathToFileURL(path.join(root,folder,'payload',id+'.html')).href+'?dcTheme=light');
      await page.waitForFunction(()=>document.querySelector('.dc-sidebar-meta').textContent.includes('已连接'));
      await page.getByRole('button',{name:'白色贴图',exact:true}).click();
      await page.waitForFunction(()=>window.__colorEvents.length===1);
      assert.deepEqual(await page.evaluate(()=>window.__colorEvents[0]),{kind:id,color:id==='g309'?'g309-white':'blackshark-white'});
      if(id==='g309'){
        await page.locator('select').selectOption('1600');await page.getByRole('button',{name:'应用 DPI',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.dc-row').textContent.includes('1600'));
        await page.getByRole('button',{name:'500 Hz',exact:true}).click();
        await page.waitForFunction(()=>window.__calls.some(c=>c.command==='setReportRate'&&c.value===500));
        await page.evaluate(()=>{window.__fail=true;});
        await page.getByRole('button',{name:'应用 DPI',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.handoff-error').textContent.includes('fixture unplugged'));
        assert.equal(await page.locator('select').isDisabled(),true);
      }else{
        await page.locator('.handoff-slider').fill('33');await page.locator('.handoff-slider').dispatchEvent('change');
        await page.waitForFunction(()=>window.__calls.some(c=>c.command==='setOutputVolume'&&c.value===33));
        await page.locator('[data-category="eq"]').click();
        await page.locator('.handoff-eq-slider').first().fill('6');await page.locator('.handoff-eq-enable input').check();
        await page.getByRole('button',{name:'生成 APO 配置',exact:true}).click();
        await page.waitForFunction(()=>!!document.querySelector('.handoff-eq-export'));
        const eqCall=await page.evaluate(()=>window.__calls.find(c=>c.command==='setEq'));
        assert.equal(eqCall.value.gains.length,10);assert.equal(eqCall.value.gains[0],6);assert.equal(eqCall.value.enabled,true);
        assert.match(await page.locator('.dc-config').innerText(),/已生成 · 未启用引擎/);
      }
      results.push({id,tab:'synthetic-api-interaction',passed:true,hardwareVerified:false});await page.close();
    }
    for(const [folder,id] of [['logitech-g309','g309'],['blackshark-v2','blackshark']]){
      for(const theme of ['light','dark']){
        const page=await browser.newPage({viewport:{width:1280,height:800}});
        await page.goto(pathToFileURL(path.join(root,folder,'payload',id+'.html')).href+'?dcTheme='+theme);
        assert.equal(await page.locator('.handoff-swatch').count(),catalog[id].length);
        for(const art of catalog[id]){
          await page.getByRole('button',{name:art.label+'贴图',exact:true}).click();
          await page.waitForFunction(file=>{const img=document.querySelector('[data-product-image]');return img.complete&&img.naturalWidth>0&&img.src.endsWith(file);},art.file);
          assert.equal(await page.getByRole('button',{name:art.label+'贴图',exact:true}).getAttribute('aria-pressed'),'true');
          await page.reload();
          assert.ok((await page.locator('[data-product-image]').getAttribute('src')).endsWith(art.file));
          await page.screenshot({path:path.join(output,`${id}-${theme}-1280-art-${art.id}.png`)});
          results.push({id,theme,tab:'artwork-'+art.id,passed:true,hardwareVerified:false});
        }
        await page.close();
      }
    }
    fs.writeFileSync(path.join(root,'design','layout-report.json'),JSON.stringify({kind:'offline-layout-verification',hardwareVerified:false,results},null,2)+'\n');
    console.log(`PASS ${results.length} offline layouts, both themes, 1280/960/720px; screenshots saved`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
