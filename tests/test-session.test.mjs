import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createRequire} from 'node:module';
const {createTestSession}=createRequire(import.meta.url)('../library/hid/test-session.cjs');
function fixture(){
  const child=new EventEmitter();child.stdout=new PassThrough();child.kills=0;child.kill=()=>{child.kills++;queueMicrotask(()=>child.emit('exit',0));};
  let starts=0;const spawnChild=(python,args,options)=>{starts++;assert.equal(args.at(-1),'123');assert.equal(options.windowsHide,true);return child;};
  const session=createTestSession({python:'bundled-python',ownerPid:123,spawnChild});
  return {session,child,event:value=>child.stdout.write(JSON.stringify(value)+'\n'),starts:()=>starts};
}
test('test arming coalesces and only the scoped Windows key events are forwarded',async()=>{
  const f=fixture(),keys=[];const first=f.session.start({onKey:value=>keys.push(value)}),second=f.session.start();assert.equal(first,second);assert.equal(f.starts(),1);
  f.event({type:'ready'});await first;assert.equal(f.session.active,true);
  f.event({type:'key',code:'KeyA',down:true});f.event({type:'key',code:'MetaLeft',down:true});assert.deepEqual(keys,[{code:'MetaLeft',down:true}]);
  f.session.stop();assert.equal(f.session.active,false);assert.equal(f.child.kills,1);
  f.event({type:'key',code:'MetaLeft',down:false});assert.equal(keys.length,1);
});
test('focus loss reports a stop and does not leave a test armed',async()=>{
  const f=fixture(),stops=[];const started=f.session.start({onStopped:value=>stops.push(value)});f.event({type:'ready'});await started;
  f.event({type:'stopped',reason:'focus-lost'});f.child.emit('exit',0);assert.equal(f.session.active,false);assert.deepEqual(stops,[{reason:'focus-lost'}]);
});
test('cancel while arming rejects cleanly without leaving a child running',async()=>{
  const f=fixture(),started=f.session.start();f.session.stop();await assert.rejects(started,/停止/);assert.equal(f.session.active,false);assert.equal(f.child.kills,1);
});
