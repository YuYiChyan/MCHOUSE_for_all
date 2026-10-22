/* MIT. Keyboard layout: shawon9324/keyboard-mouse-tester-webApp; see vendor/input-tester/LICENSE.
 * Local rendering/lifecycle adapted for One4All; no global keyboard hooks or device writes. */
(() => {
  'use strict';
  const UI=window.One4AllUI;
  function keyboard({signal,layout='full'}={}){
    const element=UI.node('div','dc-input-board-wrap'),board=UI.node('div','dc-input-board'),caps=new Map();
    element.append(board);board.setAttribute('aria-label','键盘键位检测图');
    function cap(def){
      const key=UI.node('div',def.spacer?'dc-input-spacer':'dc-input-cap');
      key.style.setProperty('--w',def.w||1);
      if(!def.spacer){key.dataset.code=def.code;key.title=def.code;key.setAttribute('aria-label',(def.label||'Space')+'，未触发');if(def.sub)key.append(UI.node('small','',def.sub));key.append(UI.node('span','',def.label||'Space'));caps.set(def.code,key);}
      return key;
    }
    const main=UI.node('div','dc-input-main');
    for(const defs of MAIN_ROWS){const row=UI.node('div','dc-input-row');for(const def of defs)row.append(cap(def));main.append(row);}board.append(main);
    if(layout!=='compact'){
      const nav=UI.node('div','dc-input-nav');for(const defs of NAV_ROWS){const row=UI.node('div','dc-input-row');for(const def of defs)row.append(cap(def));nav.append(row);}
      const arrows=UI.node('div','dc-input-arrows');for(const [name,def]of Object.entries(ARROW_KEYS)){const key=cap(def);key.classList.add('dc-input-arrow-'+name);arrows.append(key);}nav.append(arrows);board.append(nav);
    }
    if(layout==='full'){
      const num=UI.node('div','dc-input-numpad');for(const def of NUMPAD_KEYS){const key=cap(def);key.style.gridColumn=def.gc;key.style.gridRow=def.gr;num.append(key);}board.append(num);
    }
    let width=0;
    const observer=new ResizeObserver(()=>{const available=element.clientWidth;if(available===width)return;width=available;const scale=Math.min(1,available/board.offsetWidth);board.style.transform=`scale(${scale})`;element.style.height=Math.ceil(board.offsetHeight*scale)+'px';});
    observer.observe(element);signal?.addEventListener('abort',()=>observer.disconnect(),{once:true});
    return Object.freeze({element,
      press(code){const key=caps.get(code);if(key){key.classList.add('is-press','is-tested');key.setAttribute('aria-label',code+'，按下');}},
      release(code){const key=caps.get(code);if(key){key.classList.remove('is-press');key.setAttribute('aria-label',code+'，已触发');}},
      clearPressed(){for(const [code,key]of caps)if(key.classList.contains('is-press')){key.classList.remove('is-press');key.setAttribute('aria-label',code+'，已触发');}},
      clear(){for(const [code,key]of caps){key.classList.remove('is-press','is-tested');key.setAttribute('aria-label',code+'，未触发');}},
    });
  }
  function mouse(){
    const element=UI.node('div','dc-input-mouse'),regions=new Map();element.setAttribute('aria-label','鼠标按键检测图');
    for(const [id,label]of [[0,'左键'],[2,'右键'],[1,'中键'],[3,'后退'],[4,'前进'],['up','滚轮 ↑'],['down','滚轮 ↓']]){
      const key=UI.node('div','dc-mouse-region dc-mouse-'+id,label);key.dataset.mouseButton=id;key.setAttribute('aria-label',label+'，未触发');regions.set(String(id),key);element.append(key);
    }
    return Object.freeze({element,
      press(id){regions.get(String(id))?.classList.add('is-press','is-tested');},
      release(id){regions.get(String(id))?.classList.remove('is-press');},
      clearPressed(){for(const key of regions.values())key.classList.remove('is-press');},
      clear(){for(const key of regions.values())key.classList.remove('is-press','is-tested');},
    });
  }
  window.One4AllInputVisualizer=Object.freeze({keyboard,mouse});
})();
