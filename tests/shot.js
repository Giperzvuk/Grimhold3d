const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const p=await (await b.newContext({viewport:{width:890,height:400},deviceScaleFactor:2})).newPage();
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CERR',m.text())});
await p.goto('file://'+path.resolve(process.argv[2]));await p.waitForTimeout(parseInt(process.argv[4]||'3000'));
console.log(await p.evaluate(()=>window.__ok?window.__ok():'no'));await p.screenshot({path:process.argv[3]});await b.close();})();
