/* A shared product-colour picker. Persistence belongs to its caller. */
(() => {
 'use strict';
 const mounts=new WeakMap();let nextId=0;
 function mount(container,{variants=[],selectedId,image,onSelect=()=>{}}={}){
  if(!container?.ownerDocument)throw new TypeError('配色选择器需要一个容器');
  mounts.get(container)?.dispose();
  const doc=container.ownerDocument,win=doc.defaultView||window,seen=new Set();
  const choices=variants.filter(v=>v&&v.id!=null).map(v=>({...v,id:String(v.id)})).filter(v=>!seen.has(v.id)&&seen.add(v.id));
  let selected=choices.find(v=>v.id===String(selectedId))||choices[0],disposed=false,opened=false,revision=0,pending=null,animation=null,paletteAnimation=null;
  let root,trigger,palette,status,buttons=[];
  const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const instance={get selectedId(){return selected?.id??null;},dispose};
  mounts.set(container,instance);
  if(choices.length<2)return instance;
  const el=(tag,cls)=>{const element=doc.createElement(tag);element.className=cls;return element;};
  root=el('div','o4-color-picker');trigger=el('button','o4-color-picker__trigger');palette=el('div','o4-color-picker__palette');status=el('span','o4-color-picker__status');
  trigger.type='button';trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
  palette.id='o4-color-palette-'+(++nextId);palette.setAttribute('role','menu');palette.setAttribute('aria-label','选择商品配色');palette.hidden=true;trigger.setAttribute('aria-controls',palette.id);
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  const orb=el('span','o4-color-picker__orb');orb.setAttribute('aria-hidden','true');trigger.append(orb);
  const color=value=>{
   if(typeof value!=='string')return '#8c929d';
   if(win.CSS?.supports('color',value)||/^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(value)&&win.CSS?.supports('background-image',value))return value;
   return '#8c929d';
  };
  buttons=choices.map(variant=>{
   const button=el('button','o4-color-picker__choice'),swatch=el('span','o4-color-picker__swatch');
   button.type='button';button.dataset.variantId=variant.id;button.title=variant.name||variant.id;button.setAttribute('aria-label',button.title);button.setAttribute('role','menuitemradio');button.tabIndex=-1;
   swatch.style.background=color(variant.color);swatch.setAttribute('aria-hidden','true');button.append(swatch);
   button.addEventListener('click',()=>select(variant));palette.append(button);return button;
  });
  function sync(){
   const label=selected?.name||selected?.id||'';trigger.title='选择配色 · '+label;trigger.setAttribute('aria-label','选择配色，当前'+label);
   const selectedColor=color(selected?.color),solid=win.CSS?.supports('color',selectedColor);
   // Keep the pearl monochrome underneath; only the chosen product colour tints it.
   const tint=solid?selectedColor:selectedColor.match(/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/i)?.[0]||'#8c929d';
   root.style.setProperty('--o4-picker-tint',tint);
   root.style.setProperty('--o4-picker-overlay',solid?'var(--o4-picker-tint)':selectedColor);
   for(const button of buttons){const active=button.dataset.variantId===selected?.id;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;}
  }
  function focusChoice(index){buttons.forEach((button,i)=>button.tabIndex=i===index?0:-1);buttons[index]?.focus({preventScroll:true});}
  function setOpen(value,focus=false){
   if(disposed||opened===value)return;
   const wasHidden=palette.hidden,current=win.getComputedStyle(palette);
   const from={opacity:wasHidden?0:current.opacity,transform:wasHidden?'translateX(-8px) scale(.84)':current.transform};
   if(paletteAnimation){paletteAnimation.cancel();paletteAnimation=null;}
   opened=value;palette.hidden=false;palette.inert=!value;root.classList.toggle('is-expanded',value);trigger.setAttribute('aria-expanded',String(value));
   const finish=()=>{palette.hidden=!opened;};
   if(motion?.matches||!palette.animate)finish();
   else{
    const to=value?{opacity:1,transform:'translateX(0) scale(1)'}:{opacity:0,transform:'translateX(-8px) scale(.84)'};
    const currentAnimation=palette.animate([from,to],{duration:value?230:190,easing:value?'cubic-bezier(.2,.8,.2,1)':'cubic-bezier(.4,0,.6,1)',fill:'both'});
    paletteAnimation=currentAnimation;
    currentAnimation.onfinish=()=>{if(paletteAnimation!==currentAnimation)return;paletteAnimation=null;finish();currentAnimation.cancel();};
   }
   if(value&&focus)focusChoice(Math.max(0,choices.findIndex(v=>v.id===selected?.id)));
  }
  function cancelAnimation(){if(animation){const current=animation;animation=null;current.cancel();}}
  function cancelPending(){pending?.();pending=null;root?.removeAttribute('aria-busy');buttons.forEach(button=>button.removeAttribute('data-loading'));}
  function animateImage(){
   cancelAnimation();if(!image?.animate||motion?.matches)return;
   const style=win.getComputedStyle(image),transform=style.transform==='none'?'':style.transform,opacity=style.opacity;
   try{const current=image.animate([{opacity:0,transform:'scale(.97) '+transform},{opacity,transform:transform||'none'}],{duration:260,easing:'cubic-bezier(.2,.75,.2,1)'});animation=current;current.onfinish=current.oncancel=()=>{if(animation===current)animation=null;};}catch{}
  }
  function select(variant){
   if(disposed)return;const ticket=++revision;cancelPending();
   if(variant.id===selected?.id){status.textContent='';return;}
   const commit=()=>{
    if(disposed||ticket!==revision)return;cancelPending();
    if(image&&variant.imageUrl){image.src=variant.imageUrl;animateImage();}
    selected=variant;sync();status.textContent='已切换为'+(variant.name||variant.id);
    onSelect(variant);
   };
   if(!image||!variant.imageUrl){commit();return;}
   root.setAttribute('aria-busy','true');buttons.find(button=>button.dataset.variantId===variant.id)?.setAttribute('data-loading','');status.textContent='正在加载'+(variant.name||variant.id)+'商品图';
   const loader=new win.Image();let settled=false,timer;
   const clean=()=>{clearTimeout(timer);loader.onload=null;loader.onerror=null;};
   const fail=()=>{if(settled)return;settled=true;clean();if(disposed||ticket!==revision)return;cancelPending();status.textContent='商品图暂时无法加载，已保留当前配色';};
   pending=()=>{settled=true;clean();loader.removeAttribute('src');};
   loader.onload=async()=>{
    if(settled)return;settled=true;clean();
    try{await loader.decode?.();}catch{}
    if(!disposed&&ticket===revision)commit();
   };
   loader.onerror=fail;timer=setTimeout(fail,12000);loader.src=variant.imageUrl;
  }
  function onKey(event){
   event.stopPropagation();
   if(event.key==='Escape'&&opened){event.preventDefault();setOpen(false);trigger.focus({preventScroll:true});return;}
   if(event.target===trigger){if(['ArrowDown','ArrowUp','ArrowRight'].includes(event.key)){event.preventDefault();setOpen(true,true);}return;}
   const index=buttons.indexOf(event.target);if(index<0)return;
   let next;
   if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%buttons.length;
   else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;
   else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;
   if(next!==undefined){event.preventDefault();focusChoice(next);}
  }
  const stop=event=>event.stopPropagation();
  const outside=event=>{if(opened&&!root.contains(event.target))setOpen(false);};
  const focusOut=event=>{if(opened&&!root.contains(event.relatedTarget))setOpen(false);};
  const motionChanged=()=>{if(motion.matches){cancelAnimation();paletteAnimation?.cancel();paletteAnimation=null;palette.hidden=!opened;}};
  trigger.addEventListener('click',()=>setOpen(!opened));
  root.addEventListener('click',stop);root.addEventListener('dblclick',stop);root.addEventListener('pointerdown',stop);root.addEventListener('keydown',onKey);root.addEventListener('keyup',stop);root.addEventListener('focusout',focusOut);
  doc.addEventListener('pointerdown',outside,true);doc.addEventListener('click',outside,true);motion?.addEventListener?.('change',motionChanged);
  root.append(trigger,palette,status);container.append(root);sync();
  function dispose(){
   if(disposed)return;disposed=true;revision++;cancelPending();cancelAnimation();paletteAnimation?.cancel();paletteAnimation=null;
   if(root){doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('click',outside,true);motion?.removeEventListener?.('change',motionChanged);root.remove();}
   if(mounts.get(container)===instance)mounts.delete(container);
  }
  return instance;
 }
 window.One4AllColorPicker=Object.freeze({mount});
})();
