'use strict';
const fs=require('node:fs'),path=require('node:path');
const {connect}=require('./cdp.cjs');
(async()=>{let timer;const c=await connect();try{const shot=await Promise.race([c.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Screenshot timed out')),8000);})]);const file=path.resolve(process.argv[2]||'research/visual-current.png');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(shot.data,'base64'));console.log(file);}finally{clearTimeout(timer);c.close();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
