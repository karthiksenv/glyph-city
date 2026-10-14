(() => {
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('city'),keys=new Set(),touch=new Set(),world=new CityWorld();
let renderer,started=false,modal=null,last=performance.now(),acc=0,frames=0,fps=60,fpsCount=0,fpsAt=last,hudAt=0,toastTimer=0,drag=null,lastDistrict=world.district.key,adaptAt=last;
const input={forward:0,strafe:0,lift:0,boost:false,turn:0,look:0},padPrevious=new Uint8Array(16);
const map=$('minimap'),mc=map.getContext('2d');
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3100);}
function failure(message){$('errorPanel').hidden=false;$('errorPanel').textContent=message;}
try{renderer=new CityRenderer(canvas);}catch(e){failure(e.message);console.error(e);return;}
function lock(){if(matchMedia('(pointer:coarse)').matches)return;try{const result=canvas.requestPointerLock?.();result?.catch(()=>toast('Drag the view to look around. WASD to move.'));}catch{toast('Drag the view to look around. WASD to move.');}}
function begin(){started=true;document.body.classList.add('playing');document.body.classList.remove('paused');canvas.focus({preventScroll:true});lock();toast(matchMedia('(pointer:coarse)').matches?'Arrows to move · Swipe to look · Tap WALK MODE to fly':'WASD to explore · F to fly · ? for controls');}
function flight(){world.toggleFlight();toast(world.fly?'FLIGHT MODE · Space to rise · C to descend':'WALK MODE · Back to street level');updateHUD();}
function weather(){world.cycleWeather();$('weatherCycleToggle').checked=world.weatherAuto;toast(world.weather.toUpperCase()+' · Automatic weather paused');updateHUD();}
function day(){world.cycleTime();toast('Time set to '+clockTime());updateHUD();}
function clockTime(){const h=Math.floor(world.hour),m=Math.floor((world.hour-h)*60);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
function closeModal(){if(!modal)return;modal.hidden=true;modal=null;canvas.focus({preventScroll:true});}
function openModal(id){closeModal();keys.clear();touch.clear();document.exitPointerLock?.();modal=$(id);modal.hidden=false;modal.querySelector('button')?.focus();}
$('enterButton').onclick=begin;$('resumeButton').onclick=begin;
$('flightButton').onclick=flight;$('weatherButton').onclick=weather;$('timeButton').onclick=day;
$('helpButton').onclick=()=>openModal('helpPanel');$('settingsButton').onclick=()=>openModal('settingsPanel');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
document.querySelectorAll('.modal-backdrop').forEach(p=>p.addEventListener('click',e=>{if(e.target===p)closeModal();}));
$('qualitySelect').onchange=e=>{renderer.quality=e.target.value;renderer.autoScale=1;renderer.resize();};
$('cycleToggle').onchange=e=>world.timeAuto=e.target.checked;
$('weatherCycleToggle').onchange=e=>{world.weatherAuto=e.target.checked;};
$('resetButton').onclick=()=>{world.reset();closeModal();toast('Back at the origin. A different street awaits.');updateHUD();};
const handled=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyF','KeyR','KeyT','KeyC','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
addEventListener('keydown',e=>{
 if(e.code==='Escape'){closeModal();keys.clear();touch.clear();document.exitPointerLock?.();document.body.classList.add('paused');return;}
 if(modal){if(e.code==='Tab'){const items=modal.querySelectorAll('button,input,select'),first=items[0],end=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}}return;}
 if(handled.has(e.code))e.preventDefault();
 keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyF')flight();if(e.code==='KeyR')weather();if(e.code==='KeyT')day();
 if(e.code==='KeyH'||e.code==='Slash')openModal('helpPanel');
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();touch.clear();drag=null;document.body.classList.add('paused');});
document.addEventListener('visibilitychange',()=>{keys.clear();touch.clear();last=performance.now();acc=0;});
document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('paused',started&&document.pointerLockElement!==canvas);keys.clear();});
function look(dx,dy){const scale=Number($('sensitivity').value)*.0023;world.player.yaw+=dx*scale;world.player.pitch=Math.max(-1.42,Math.min(1.42,world.player.pitch-dy*scale));}
document.addEventListener('mousemove',e=>{if(started&&!modal&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
canvas.addEventListener('pointerdown',e=>{if(modal)return;if(!started){begin();}else if(e.pointerType==='mouse')lock();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId&&document.pointerLockElement!==canvas){look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;}});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelectorAll('[data-touch]').forEach(b=>{
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(!started){started=true;document.body.classList.add('playing');}touch.add(b.dataset.touch);b.setPointerCapture(e.pointerId);});
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,()=>touch.delete(b.dataset.touch));
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();keys.clear();failure('Graphics context was interrupted. Refresh this file to return to the city.');});
function commands(){
 input.forward=(keys.has('KeyW')||touch.has('forward')?1:0)-(keys.has('KeyS')||touch.has('back')?1:0);
 input.strafe=(keys.has('KeyD')||touch.has('right')?1:0)-(keys.has('KeyA')||touch.has('left')?1:0);
 input.lift=(keys.has('Space')||touch.has('up')?1:0)-(keys.has('KeyC')||touch.has('down')?1:0);
 input.boost=keys.has('ShiftLeft')||keys.has('ShiftRight');
 input.turn=((keys.has('ArrowRight')||keys.has('KeyE')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyQ')?1:0))*1.6;
 input.look=((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*1.25;
 const pad=navigator.getGamepads?.()[0];
 if(pad&&!modal){const dead=v=>Math.abs(v)>.15?v:0;input.strafe+=dead(pad.axes[0]||0);input.forward-=dead(pad.axes[1]||0);input.turn+=dead(pad.axes[2]||0)*2;input.look-=dead(pad.axes[3]||0)*1.5;input.lift+=(pad.buttons[0]?.pressed?1:0)-(pad.buttons[6]?.pressed?1:0);input.boost||=pad.buttons[10]?.pressed;
  for(let i=0;i<Math.min(16,pad.buttons.length);i++){const on=pad.buttons[i].pressed;if(on&&!padPrevious[i]){if(i===1)flight();if(i===2)weather();if(i===3)day();if(i===9&&!started)begin();}padPrevious[i]=on;}
 }
 if(!started||modal){input.forward=input.strafe=input.lift=input.turn=input.look=0;input.boost=false;}
 return input;
}
function minimap(){
 const p=world.player,w=map.width,h=map.height,size=8,cols=30,rows=25,unit=6;
 mc.clearRect(0,0,w,h);mc.textAlign='center';mc.textBaseline='middle';mc.font='8px Consolas,monospace';
 const ox=Math.floor(p.x/unit)*unit,oz=Math.floor(p.z/unit)*unit;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const x=ox+(col-15)*unit,z=oz+(12-row)*unit,bx=Math.floor(x/48),bz=Math.floor(z/48),lx=x-bx*48,lz=z-bz*48;
  let char='·';mc.fillStyle='#315259';
  if(lx>=9&&lx<=39&&lz>=9&&lz<=39){char='#';mc.fillStyle=world.visitedBlocks.has(bx+','+bz)?'#71958a':'#42625f';}
  if(lx===0||lz===0){char='·';mc.fillStyle='#547677';}
  mc.fillText(char,col*size+4,row*size+4);
 }
 // The map uses the same traffic trajectory and seed as the 3D renderer.
 const bx=Math.floor(p.x/48),bz=Math.floor(p.z/48);mc.fillStyle='#e5ae76';mc.font='9px Consolas,monospace';
 for(let z=bz-2;z<=bz+2;z++)for(let x=bx-2;x<=bx+2;x++){const s=CityWorld.hash(x,z,60),run=((world.time*(4.8+s*4)+s*48)%48+48)%48;const sx=(x*48+3-ox)/unit*size+124,sy=(oz-(z*48+run))/unit*size+100;if(sx>3&&sx<w-3&&sy>3&&sy<h-3)mc.fillText('+',sx,sy);}
 const px=(p.x-ox)/unit*size+124,py=(oz-p.z)/unit*size+100;
 mc.fillStyle='#b7f9d3';mc.font='bold 14px Consolas,monospace';const heading=((Math.round(p.yaw/(Math.PI/2))%4)+4)%4;mc.fillText(['^','>','v','<'][heading],px,py);
}
function updateHUD(){
 const p=world.player,d=world.district,stats=world.stats;
 $('districtName').textContent=d.name.toUpperCase();$('districtInfo').textContent=d.code+' / '+d.x+'.'+d.z+' · '+(world.fly?'A different perspective.':'The city never ends.');
 const signed=v=>(v<0?'−':'+')+String(Math.abs(Math.round(v))).padStart(4,'0');
 $('coords').textContent='X '+signed(p.x)+'  Z '+signed(p.z)+'  ALT '+Math.round(stats.altitude)+'m';
 $('fps').textContent=Math.round(fps);$('explored').textContent=world.visited.size+' neighborhood'+(world.visited.size!==1?'s':'')+' discovered';
 $('flightButton').textContent=world.fly?'↗ FLIGHT MODE':'↟ WALK MODE';$('timeButton').textContent=clockTime();$('weatherButton').textContent=world.weather==='rain'?'/// RAIN':world.weather==='fog'?'≋ FOG':'☼ CLEAR';
 $('mapCoords').textContent='BLOCK '+Math.floor(p.x/48)+'.'+Math.floor(p.z/48);$('mapScale').textContent='180 m';
 if(d.key!==lastDistrict){lastDistrict=d.key;if(started)toast(d.name.toUpperCase()+' / '+world.visited.size+' neighborhoods discovered');}
 minimap();
}
function frame(now){
 requestAnimationFrame(frame);if(document.hidden){last=now;return;}
 const dt=Math.min((now-last)/1000,.1);last=now;acc+=dt;const cmd=commands();
 while(acc>=1/60){world.update(1/60,cmd);acc-=1/60;}
 renderer.render(world,dt);frames++;fpsCount++;
 if(now-fpsAt>800){fps=fpsCount*1000/(now-fpsAt);fpsAt=now;fpsCount=0;}
 if(now-hudAt>150){updateHUD();hudAt=now;}
 if(renderer.quality==='auto'&&now-adaptAt>4000&&frames>120){if(fps<43&&renderer.autoScale<1.9)renderer.autoScale=Math.min(1.9,renderer.autoScale*1.16);else if(fps>58&&renderer.autoScale>1)renderer.autoScale=Math.max(1,renderer.autoScale/1.08);adaptAt=now;}
}
window.CityDebug={world,renderer,snapshot:()=>({...world.inspect(),started,frames,fps,drawCalls:2,cols:renderer.cols,rows:renderer.rows,glError:renderer.gl.getError()})};
updateHUD();requestAnimationFrame(frame);
})();
