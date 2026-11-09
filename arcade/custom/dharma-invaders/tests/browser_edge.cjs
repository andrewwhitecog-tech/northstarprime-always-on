'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {chromium}=require(process.env.NSP_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'../../../..'),out=process.env.NSP_PLAYTEST_OUT;
if(!out)throw Error('output required');fs.mkdirSync(out,{recursive:true});
const result={passed:false,sourceHead:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Native edge movement, trusted Parry click, active/paused/completed dash lifecycle. Read-only observations; no game-state/clock writes.',cases:[],errors:[]};
const base='https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/'+result.sourceHead;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');let p=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!p.startsWith(root+path.sep))throw Error('containment');if(u.pathname.endsWith('/'))p=path.join(p,'index.html');let b;if(fs.existsSync(p)&&fs.statSync(p).isFile())b=fs.readFileSync(p);else if(u.pathname.startsWith('/static/')){const r=await fetch(base+u.pathname,{signal:AbortSignal.timeout(20000)});if(!r.ok){res.writeHead(r.status);return res.end();}b=Buffer.from(await r.arrayBuffer());}else{res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.ogg':'audio/ogg'})[path.extname(p)]||'application/octet-stream');res.end(b);}catch(e){res.writeHead(500);res.end(String(e));}});

async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded5000ms')),5000);})]);}finally{clearTimeout(timer);}}
(async()=>{let browser;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:!process.env.NSP_VIRTUAL_DISPLAY,args:['--disable-dev-shm-usage']});
  for(const phone of [false,true])for(const side of ['left','right']){
    const viewport=phone?{width:390,height:844}:{width:1280,height:1000};
    const entry={phone,side,viewport,passed:false,trace:[],errors:[]};result.cases.push(entry);
    const context=await browser.newContext({viewport,hasTouch:phone,isMobile:phone}),page=await context.newPage();let input;
    try{
      page.on('pageerror',e=>entry.errors.push(String(e)));
      page.on('response',r=>{if(r.status()>=400)entry.errors.push(r.status()+' '+r.url());});
      await page.goto('http://127.0.0.1:'+server.address().port+'/arcade/custom/dharma-invaders/');
      await page.bringToFront();await page.waitForFunction(()=>__COMMENTARY_DEBUG__.atlas().ready);
      input=await context.newCDPSession(page);
      // Precomputed direct CDP input avoids actionability/geometry roundtrips during .2s dash.
      const point=async selector=>{const r=await page.locator(selector).boundingBox();assert.ok(r);return {x:r.x+r.width/2,y:r.y+r.height/2};};
      const clickAt=async({x,y})=>{
        if(phone){await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
        else{await input.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});await input.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});}
      };
      const click=async selector=>clickAt(await point(selector));
      await click('#start');
      if(phone){const r=await page.locator('#c').boundingBox();await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*(side==='left'?.01:.99),y:r.y+r.height*.85}]});}
      else await page.keyboard.down(side==='left'?'ArrowLeft':'ArrowRight');
      await page.waitForFunction(side=>side==='left'?__COMMENTARY_DEBUG__.snapshot().sentinel.x<=43:__COMMENTARY_DEBUG__.snapshot().sentinel.x>=757,side,{timeout:5000});
      if(phone)await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      else await page.keyboard.up(side==='left'?'ArrowLeft':'ArrowRight');
      entry.before=await page.evaluate(()=>__COMMENTARY_DEBUG__.snapshot());
      const parryPoint=await point('#parry'),pausePoint=await point('#pause');entry.inputPoints={parryPoint,pausePoint};entry.pauseEvents=[];entry.nativeInputEvents=[];
      let activeResolve,doneResolve;
      const active=new Promise(r=>{activeResolve=r;}),done=new Promise(r=>{doneResolve=r;});
      await page.exposeBinding('edgeSample',(_,sample)=>{entry.trace.push(sample);if(sample.isDashing)activeResolve(sample);});
      await page.exposeBinding('edgeEvent',(_,event)=>{entry.parryEvent=event;});
      await page.exposeBinding('edgeDone',(_,value)=>doneResolve(value));
      await page.exposeBinding('edgePauseEvent',(_,event)=>entry.pauseEvents.push(event));
      await page.exposeBinding('edgeInputEvent',(_,event)=>entry.nativeInputEvents.push(event));
      await page.evaluate(()=>{for(const id of ['parry','pause'])for(const type of ['pointerdown','pointerup','touchstart','touchend','click'])document.getElementById(id).addEventListener(type,event=>window.edgeInputEvent({id,type,at:performance.now(),trusted:event.isTrusted,pointerType:event.pointerType||''}),{passive:true});});
      // Arm immediately and start the observer ONLY on the actual trusted native click.
      // The existing game listener runs first and owns every state change.
      await page.evaluate(()=>document.querySelector('#parry').addEventListener('click',event=>{
        window.edgeEvent({at:performance.now(),trusted:event.isTrusted,detail:event.detail,pointerType:event.pointerType||''});
        const start=performance.now();let seenActive=false;
        function sample(){const state=__COMMENTARY_DEBUG__.snapshot(),row={at:performance.now(),paused:state.paused,...state.sentinel};
          window.edgeSample(row);if(row.isDashing)seenActive=true;
          if(seenActive&&!row.isDashing){window.edgeDone({completed:true});return;}
          if(performance.now()-start>4000){window.edgeDone({completed:false,timeout:true});return;}
          requestAnimationFrame(sample);
        }sample();
      },{once:true}));
      await page.evaluate(()=>document.querySelector('#pause').addEventListener('click',event=>window.edgePauseEvent({at:performance.now(),trusted:event.isTrusted,paused:__COMMENTARY_DEBUG__.snapshot().paused,sentinel:__COMMENTARY_DEBUG__.snapshot().sentinel})));
      // Send genuine ordered Parry then Pause input without a new geometry lookup or binding wait.
      // The trusted click observer must still prove an actual active state; no state is injected.
      if(phone){
        // Same-session send calls enqueue in protocol order BEFORE awaiting acknowledgements.
        // Pinned Playwright1.55.1 RawTouchscreenImpl.tap likewise queues start/end together.
        const packets=[
          {target:'parry',type:'touchStart',touchPoints:[parryPoint]},
          {target:'parry',type:'touchEnd',touchPoints:[]},
          {target:'pause',type:'touchStart',touchPoints:[pausePoint]},
          {target:'pause',type:'touchEnd',touchPoints:[]}
        ];
        entry.touchPacketEnqueue=[];
        const acknowledgements=packets.map((packet,i)=>{entry.touchPacketEnqueue.push({seq:i+1,target:packet.target,type:packet.type,clientUtc:new Date().toISOString()});return input.send('Input.dispatchTouchEvent',{type:packet.type,touchPoints:packet.touchPoints});});
        await Promise.all(acknowledgements);
      }else{await clickAt(parryPoint);await clickAt(pausePoint);}
      entry.firstActive=await bounded(active,'actual active dash');entry.paused=await page.evaluate(()=>__COMMENTARY_DEBUG__.snapshot());
      assert.equal(entry.paused.paused,true);assert.equal(entry.paused.sentinel.isDashing,true,'native Pause occurred during an actual active dash');
      assert.ok(entry.paused.sentinel.dashTimer>0);
      assert.ok(entry.paused.sentinel.x>=42&&entry.paused.sentinel.x<=758);
      await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(()=>__COMMENTARY_DEBUG__.snapshot().sentinel),entry.paused.sentinel,'paused dash timer and legal position remain frozen');
      await page.screenshot({path:path.join(out,'dash-paused-'+(phone?'phone':'desktop')+'-'+side+'.png'),fullPage:true});
      await click('#pause');entry.observer=await bounded(done,'actual dash completion');
      entry.after=await page.evaluate(()=>__COMMENTARY_DEBUG__.snapshot());
      entry.activeSamples=entry.trace.filter(r=>r.isDashing&&!r.paused).length;
      entry.pausedSamples=entry.trace.filter(r=>r.isDashing&&r.paused).length;
      entry.activeMinX=Math.min(...entry.trace.filter(r=>r.isDashing).map(r=>r.x));
      entry.activeMaxX=Math.max(...entry.trace.filter(r=>r.isDashing).map(r=>r.x));
      entry.transientOutside=entry.trace.some(r=>r.x<42||r.x>758);
      await page.screenshot({path:path.join(out,'dash-complete-'+(phone?'phone':'desktop')+'-'+side+'.png'),fullPage:true});
      assert.deepEqual(entry.nativeInputEvents.filter(e=>e.type==='click').slice(0,2).map(e=>e.id),['parry','pause'],'actual trusted click target order');assert.ok(entry.nativeInputEvents.every(e=>e.trusted));
      assert.equal(entry.parryEvent.trusted,true);assert.ok(entry.pauseEvents[0]?.trusted);assert.ok(entry.pauseEvents[0].at>=entry.parryEvent.at);assert.ok(entry.activeSamples>0,'real active dash samples are required');assert.ok(entry.pausedSamples>0,'real paused-active dash samples are required');
      assert.equal(entry.observer.completed,true);assert.equal(entry.transientOutside,false,'all actual active/paused/completed samples stay in existing court');
      assert.equal(entry.after.sentinel.isDashing,false);assert.ok(entry.after.sentinel.dashTimer<=0);
      assert.ok(entry.after.sentinel.x>=42&&entry.after.sentinel.x<=758);assert.deepEqual(entry.errors,[]);entry.passed=true;
    }catch(e){entry.failure=e.stack;await page.screenshot({path:path.join(out,'dash-failure-'+(phone?'phone':'desktop')+'-'+side+'.png'),fullPage:true}).catch(()=>{});}
    finally{if(input)await input.detach().catch(()=>{});await context.close();}
  }
  result.passed=result.cases.length===4&&result.cases.every(c=>c.passed);if(!result.passed)process.exitCode=1;
}catch(e){result.errors.push(e.stack);process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'DASH_EDGE_ACTUAL.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
})();
