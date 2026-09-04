const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 890, height: 400 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n'))); p.on('console', m => { if (m.type() === 'error') errs.push('C: ' + m.text().slice(0, 300)); });
  await p.addInitScript(() => { try { const o = JSON.parse(localStorage.getItem('grimhold_opts') || '{}'); o.updates = false; localStorage.setItem('grimhold_opts', JSON.stringify(o)); } catch (e) { } });
  await p.goto('file://' + path.resolve(process.env.FILE || require('path').resolve(__dirname, '..', 'game/index.html'))); await p.waitForTimeout(2500);
  const steps = (process.argv[2] || 'new').split(',');
  for (const s of steps) {
    if (s === 'new') { await p.evaluate(() => { UI.newGame(); UI.closeAll(); }); await p.waitForTimeout(2500); }
    else if (s.startsWith('lvl:')) { const [id, x, z, yaw] = s.slice(4).split(':'); await p.evaluate(([id, x, z, yaw]) => { loadLevel(id, { x: +x, z: +z, yaw: +yaw }); UI.closeAll(); }, [id, x, z, yaw]); await p.waitForTimeout(2500); }
    else if (s.startsWith('time:')) { await p.evaluate(t => { G.time = +t; }, s.slice(5)); await p.waitForTimeout(800); }
    else if (s.startsWith('eval:')) { console.log(await p.evaluate(require('fs').readFileSync(s.slice(5),'utf8'))); await p.waitForTimeout(500); }
    else if (s.startsWith('shot:')) { await p.screenshot({ path: 'shots/' + s.slice(5) + '.png' }); }
  }
  console.log(await p.evaluate(() => ({ fps: Math.round(R.fps()), meshes: R.scene.meshes.length, active: R.scene.getActiveMeshes().length, draw: R.engine._drawCalls ? R.engine._drawCalls.current : '?' })));
  console.log('ERRORS:', errs.length ? errs.join('\n---\n') : 'none'); await b.close();
})();
