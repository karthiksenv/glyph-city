/* GLYPH CITY — analytical 3D raycasting into a text-only display. */
(() => {
'use strict';
const VERT = `#version 300 es
in vec2 aPosition; out vec2 vUV;
void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const SCENE = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV; out vec4 frag;
uniform vec2 uGrid; uniform float uAspect;
uniform vec3 uCamera; uniform vec2 uAngles;
uniform float uTime,uHour,uRain,uFog;
const float CELL=48.;
float hs(ivec2 p,int salt){uint h=uint(p.x)*374761393u ^ uint(p.y)*668265263u ^ uint(salt)*1442695041u; h=(h^(h>>13))*1274126177u;return float(h^(h>>16))/4294967295.;}
float rnd(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float box(vec3 ro,vec3 inv,vec3 lo,vec3 hi,out vec3 n){
 vec3 a=(lo-ro)*inv,b=(hi-ro)*inv,mn=min(a,b),mx=max(a,b);
 float near=max(max(mn.x,mn.y),mn.z),far=min(min(mx.x,mx.y),mx.z);
 n=vec3(0); if(far<max(near,.015))return 10000.;
 if(near<.015)return 10000.;
 if(mn.x>=mn.y&&mn.x>=mn.z)n.x=-sign(inv.x);else if(mn.y>=mn.z)n.y=-sign(inv.y);else n.z=-sign(inv.z);
 return near;
}
int word(int i,int s){
 const int a[10]=int[10](66,89,84,69,32,67,65,70,69,32);
 const int b[10]=int[10](78,79,79,68,76,69,32,50,52,72);
 const int c[10]=int[10](79,80,69,78,32,65,76,76,32,78);
 const int d[10]=int[10](78,69,79,78,32,72,79,84,69,76);
 i=clamp(i,0,9); if(s==0)return a[i];if(s==1)return b[i];if(s==2)return c[i];return d[i];
}
void main(){
 vec2 uv=vUV*2.-1.;float sy=sin(uAngles.x),cy=cos(uAngles.x),sp=sin(uAngles.y),cp=cos(uAngles.y);
 vec3 fw=vec3(sy*cp,sp,cy*cp),rt=vec3(cy,0.,-sy),up=cross(fw,rt);
 vec3 rd=normalize(fw+rt*uv.x*uAspect*.60+up*uv.y*.60);
 vec3 inv=1./(sign(rd)*max(abs(rd),vec3(.00001))+vec3(equal(rd,vec3(0.)))*.00001);
 vec3 ro=uCamera;
 float daylight=smoothstep(-.16,.42,sin((uHour-6.)*.261799));
 vec3 sky=mix(vec3(.044,.070,.090),vec3(.17,.23,.25),daylight);
 sky*=1.-max(rd.y,0.)*.57;
 vec3 col=sky;int glyph=32;
 float dist=360.; vec3 normal=vec3(0.,1.,0.); int mat=0;float seed=0.;vec3 blo=vec3(0),bhi=vec3(0);
 // The ground is an analytic plane; every other visible surface is analytic too.
 if(rd.y<-.00001){float t=-ro.y/rd.y;if(t>0.&&t<dist){dist=t;mat=1;}}
 ivec2 cell=ivec2(floor(ro.xz/CELL));
 ivec2 stepCell=ivec2(sign(rd.xz));
 vec2 border=(vec2(cell)+step(vec2(0),rd.xz))*CELL;
 vec2 next=(border-ro.xz)*inv.xz;
 vec2 delta=abs(vec2(CELL)*inv.xz);
 vec3 nn;
 for(int k=0;k<20;k++){
  vec2 base=vec2(cell)*CELL;
  for(int j=0;j<4;j++){
   vec2 corner=base+vec2(9.+float(j%2)*16.,9.+float(j/2)*16.);
   float h=hs(cell,j+5);float height=12.+h*h*68.;
   vec3 lo=vec3(corner.x,0.,corner.y),hi=lo+vec3(14.,height,14.);
   float d=box(ro,inv,lo,hi,nn);if(d<dist){dist=d;normal=nn;mat=2;seed=hs(cell,j+17);blo=lo;bhi=hi;}
   // Rooftop equipment and slender aerials give each skyline a distinct silhouette.
   if(height>40.){lo+=vec3(4.,height,4.);hi=lo+vec3(6.,3.,6.);d=box(ro,inv,lo,hi,nn);if(d<dist){dist=d;normal=nn;mat=2;seed=h;blo=lo;bhi=hi;}}
  }
  // Four two-way traffic lanes, analytically animated within each streamed cell.
  for(int j=0;j<4;j++){
   float s=hs(cell,j+60);float speed=4.8+s*4.;float direction=(j%2==0)?1.:-1.;
   float run=mod(uTime*speed*direction+s*48.,48.);
   vec2 center=(j<2)?base+vec2(j==0?3.:45.,run):base+vec2(run,j==2?3.:45.);
   vec3 halfSize=(j<2)?vec3(.94,.65,2.1):vec3(2.1,.65,.94);
   vec3 lo=vec3(center.x,.9,center.y)-halfSize,hi=lo+halfSize*2.;
   float d=box(ro,inv,lo,hi,nn);if(d<dist){dist=d;normal=nn;mat=3;seed=s;blo=lo;bhi=hi;}
   lo.y=1.55;hi.y=2.05;if(j<2){lo.z+=.75;hi.z-=.75;}else{lo.x+=.75;hi.x-=.75;}
   d=box(ro,inv,lo,hi,nn);if(d<dist){dist=d;normal=nn;mat=4;seed=s;blo=lo;bhi=hi;}
  }
  for(int j=0;j<4;j++){
   float s=hs(cell,j+90);float run=mod(uTime*(.9+s*.6)*(j%2==0?1.:-1.)+s*48.,48.);
   vec2 center=(j<2)?base+vec2(j==0?7.3:40.7,run):base+vec2(run,j==2?7.3:40.7);
   vec3 lo=vec3(center.x-.23,0.,center.y-.23),hi=lo+vec3(.46,1.9,.46);
   float d=box(ro,inv,lo,hi,nn);if(d<dist){dist=d;normal=nn;mat=5;seed=s;blo=lo;bhi=hi;}
  }
  // Street lights: a stem and a luminous text cap, all glyph shaded.
  vec3 lo=vec3(base.x+7.1,0.,base.y+24.),hi=lo+vec3(.22,7.6,.22);
  float d=box(ro,inv,lo,hi,nn);if(d<dist){dist=d;normal=nn;mat=6;blo=lo;bhi=hi;}
  lo=vec3(base.x+6.3,7.4,base.y+23.6);hi=lo+vec3(1.8,.3,1.);
  d=box(ro,inv,lo,hi,nn);if(d<dist){dist=d;normal=nn;mat=7;blo=lo;bhi=hi;}
  float boundary=min(next.x,next.y);if(boundary>dist||boundary>360.)break;
  if(next.x<next.y){cell.x+=stepCell.x;next.x+=delta.x;}else{cell.y+=stepCell.y;next.y+=delta.y;}
 }
 vec3 p=ro+rd*dist;
 float v=0.;
 if(mat==1){
  vec2 local=mod(p.xz,48.);float edge=min(min(local.x,48.-local.x),min(local.y,48.-local.y));
  col=mix(vec3(.085,.13,.15),vec3(.25,.29,.27),daylight);glyph=46;
  if(edge>6.2){col*=1.65;glyph=58;}
  if(edge>8.){col*=.7;glyph=43;}
  if((min(local.x,48.-local.x)<.18&&mod(p.z,7.)<3.4)||(min(local.y,48.-local.y)<.18&&mod(p.x,7.)<3.4)){col=vec3(.71,.64,.36);glyph=61;}
  // Crosswalks live at intersections rather than painted over entire roads.
  if((local.x<6.||local.x>42.)&&(abs(local.y-9.)<1.6||abs(local.y-39.)<1.6)&&mod(local.x,1.7)<.8){col=vec3(.52,.61,.55);glyph=61;}
  if((local.y<6.||local.y>42.)&&(abs(local.x-9.)<1.6||abs(local.x-39.)<1.6)&&mod(local.y,1.7)<.8){col=vec3(.52,.61,.55);glyph=61;}
  if(uRain>.01){float reflection=pow(max(0.,sin(p.x*.37+p.z*.13)),12.)*exp(-dist*.016);col+=uRain*reflection*vec3(.14,.35,.31);if(reflection>.2)glyph=126;}
  if(rnd(floor(p.xz*2.))>.86)glyph=44;
 }else if(mat==2){
  float side=abs(normal.x)>.5?p.z:p.x;
  float winX=mod(side,2.8),winY=mod(p.y,3.7);
  float lit=step(.25,hs(ivec2(floor(side/2.8),floor(p.y/3.7)),int(seed*1234.)));
  bool window=winX>.48&&winX<1.90&&winY>1.&&winY<2.75&&p.y>3.5&&normal.y<.5;
  col=mix(vec3(.14,.21,.23),vec3(.38,.43,.40),daylight);
  col*=normal.x!=0.?.74:1.;
  glyph=mod(side,2.8)<.38?124:(winY<.25?61:58);
  if(window){
   vec3 lamp=seed>.55?vec3(.94,.72,.42):vec3(.38,.79,.77);
   col=mix(vec3(.07,.11,.14),lamp*(1.-daylight*.36),lit);
   glyph=lit>.5?(mod(floor(side/2.8)+floor(p.y/3.7),3.)<1.?72:35):58;
  }
  if(normal.y>.5){col*=.7;glyph=43;}
  if(p.y>bhi.y-.35&&normal.y<.5){col=seed>.55?vec3(.65,.59,.37):vec3(.29,.67,.64);glyph=61;}
  // Street-level shopfront windows and signage.
  if(p.y<3.&&normal.y<.5){col=vec3(.20,.37,.36);glyph=124;if(mod(side,4.)<2.5){col=vec3(.52,.68,.56);glyph=72;}}
  float along=abs(normal.x)>.5?p.z-blo.z:p.x-blo.x;
  if(p.y>3.2&&p.y<5.2&&along>1.4&&along<12.6&&normal.y<.5){
   col=seed>.5?vec3(.98,.43,.26):vec3(.40,.95,.78);
   glyph=word(int((along-1.4)/1.12),int(seed*4.));
  }
  // Occasional large, luminous vertical hotel signs.
  if(seed>.66&&along>11.2&&along<13.&&p.y>7.&&p.y<20.&&normal.y<.5){col=vec3(.90,.37,.28);glyph=word(int((20.-p.y)/1.3),3);}
 }else if(mat==3){
  col=mix(vec3(.12,.45,.45),vec3(.78,.30,.20),step(.54,seed));glyph=35;
  float across=(bhi.x-blo.x)>2.?p.z-blo.z:p.x-blo.x;
  if(p.y<.65){col=vec3(.16,.21,.23);glyph=64;}
  if(p.y>.8&&p.y<1.25&&(across<.45||across>1.4)){col=vec3(1.,.86,.53);glyph=64;}
 }else if(mat==4){col=vec3(.23,.57,.65);glyph=61;
 }else if(mat==5){col=seed>.5?vec3(.81,.65,.41):vec3(.43,.69,.63);glyph=77;if(p.y>1.5){col=vec3(.85,.76,.61);glyph=111;}else if(p.y<.65){col*=.58;glyph=abs(sin(uTime*5.+seed*10.))>.5?47:92;}
 }else if(mat==6){col=vec3(.33,.50,.46);glyph=124;
 }else if(mat==7){col=vec3(1.,.84,.56);glyph=42;
 }else{
  float stars=rnd(floor(vUV*uGrid));if(stars>.996&&rd.y>.12&&daylight<.4){glyph=46;col=vec3(.42,.62,.61);}else if(rd.y<.12||daylight>.25){glyph=46;col=sky*(.6+daylight*.7);}
  vec3 sun=normalize(vec3(-.5,sin((uHour-6.)*.261799),.75));
  if(daylight>.3&&dot(rd,sun)>.997){glyph=64;col=vec3(.95,.81,.54);}
 }
 if(mat>0){float fog=1.-exp(-dist*(.0045+uFog*.008));col=mix(col,sky*.8,fog);}
 // Rain is a moving field of literal / and | characters at screen-space depth.
 vec2 cellUV=floor(vUV*uGrid);float streak=rnd(vec2(cellUV.x,floor(cellUV.y*.14+uTime*(2.+rnd(vec2(cellUV.x,2.))*3.))));
 if(uRain>.1&&streak>1.-uRain*.038&&mod(cellUV.y+uTime*35.,7.)<2.8){glyph=47;col=mix(col,vec3(.35,.59,.64),.62);}
 col*=1.13;
 frag=vec4(clamp(col,0.,1.),float(glyph)/255.);
}`;
const DISPLAY = `#version 300 es
precision highp float;
in vec2 vUV;out vec4 frag;
uniform sampler2D uScene,uAtlas;uniform vec2 uGrid,uResolution;
void main(){
 vec2 cell=floor(vUV*uGrid);vec4 sampleColor=texelFetch(uScene,ivec2(cell),0);
 float code=floor(sampleColor.a*255.+.5);vec2 local=fract(vUV*uGrid);
 vec2 tile=vec2(mod(code,16.),floor(code/16.));
 vec2 atlasUV=(tile+vec2(local.x,1.-local.y))/vec2(16.,8.);
 float ink=texture(uAtlas,atlasUV).r;
 float vignette=1.-.25*pow(length((vUV-.5)*1.2),2.);
 vec3 bg=vec3(.020,.034,.043);
 frag=vec4((bg+sampleColor.rgb*ink)*vignette,1.);
}`;
class CityRenderer {
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if(!this.gl)throw new Error('This city needs WebGL 2. Please open it in a current Chrome, Edge, Firefox, or Safari browser with graphics acceleration enabled.');
  const gl=this.gl;this.scene=this.program(VERT,SCENE);this.display=this.program(VERT,DISPLAY);
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  for(const prog of [this.scene,this.display]){const loc=gl.getAttribLocation(prog,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);}
  this.atlas=gl.createTexture();this.makeAtlas();
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.fbo=gl.createFramebuffer();this.quality='auto';this.autoScale=1;this.locations=new Map();this.width=0;this.height=0;this.rain=.7;this.fog=.15;
 }
 program(v,f){const gl=this.gl;const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,v));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 uniform(program,name){let list=this.locations.get(program);if(!list){list={};this.locations.set(program,list);}return list[name]??(list[name]=this.gl.getUniformLocation(program,name));}
 makeAtlas(){const gl=this.gl;const c=document.createElement('canvas');c.width=256;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);ctx.font='bold 20px "Courier New", monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';for(let i=32;i<127;i++)ctx.fillText(String.fromCharCode(i),(i%16)*16+8,Math.floor(i/16)*24+12);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 resize(){
  const rect=this.canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
  const density=({auto:7*this.autoScale,high:5.4,balanced:7,performance:10})[this.quality]||7;
  const cols=Math.max(60,Math.min(360,Math.floor(w/density))),rows=Math.max(35,Math.floor(h/(density*1.7)));
  if(this.width===w&&this.height===h&&this.cols===cols&&this.rows===rows)return;
  this.width=w;this.height=h;this.cols=cols;this.rows=rows;
  const dpr=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.floor(w*dpr);this.canvas.height=Math.floor(h*dpr);
  const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,cols,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Unable to allocate the glyph framebuffer.');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 render(world,dt){
  this.resize();const gl=this.gl,p=world.player;this.rain+=(Number(world.weather==='rain')-this.rain)*Math.min(1,dt*.8);this.fog+=((world.weather==='fog'?1:.08)-this.fog)*Math.min(1,dt*.5);
  gl.bindVertexArray(this.vao);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,this.cols,this.rows);gl.useProgram(this.scene);
  const u=n=>this.uniform(this.scene,n);
  gl.uniform2f(u('uGrid'),this.cols,this.rows);gl.uniform1f(u('uAspect'),this.width/this.height);gl.uniform3f(u('uCamera'),p.x,p.y,p.z);gl.uniform2f(u('uAngles'),p.yaw,p.pitch);gl.uniform1f(u('uTime'),world.time);gl.uniform1f(u('uHour'),world.hour);gl.uniform1f(u('uRain'),this.rain);gl.uniform1f(u('uFog'),this.fog);gl.drawArrays(gl.TRIANGLES,0,6);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.display);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this.uniform(this.display,'uScene'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.uniform1i(this.uniform(this.display,'uAtlas'),1);gl.uniform2f(this.uniform(this.display,'uGrid'),this.cols,this.rows);gl.uniform2f(this.uniform(this.display,'uResolution'),this.canvas.width,this.canvas.height);gl.drawArrays(gl.TRIANGLES,0,6);
 }
}
window.CityRenderer=CityRenderer;
})();
