/* ====================== WORLD 3: THE ABYSSAL REALM ======================
   Loaded by index.html from w3/abyss.js. The Abyssal Tyrant model ships next to it as eight text chunks (w3/ty0.js … ty7.js),
   the untouched GLB split up so each file fits GitHub, Cloudflare and Claude's file limits; it is put back together in memory.
   The rest of the game talks to this file only through window.W3 (see the hooks list at the bottom). */
(function(){'use strict';
if(window.W3)return;
const W3=window.W3={on:false,ph:'',cine:false,ready:false,loadP:0,err:null,seq:0};
const V3=THREE.Vector3;
const clampN=(v,a,b)=>v<a?a:v>b?b:v,lerpN=(a,b,k)=>a+(b-a)*k,sstep=(a,b,x)=>{const t=clampN((x-a)/(b-a),0,1);return t*t*(3-2*t)},rand=(a,b)=>a+Math.random()*(b-a),angN=a=>Math.atan2(Math.sin(a),Math.cos(a));
const now=()=>clk.getElapsedTime();
const $=id=>document.getElementById(id);
const W3BASE=(()=>{const s=[...document.scripts].map(x=>x.src||'').find(x=>/w3\/abyss\.js/.test(x));return s?s.replace(/abyss\.js.*$/,''):((window.MS_ASSET_BASE||'')+'w3/')})();
const EXBASE=(()=>{const s=[...document.scripts].map(x=>x.src||'').find(x=>/examples\/js\//.test(x));return s?s.replace(/examples\/js\/.*$/,''):'https://cdn.jsdelivr.net/npm/three@0.128.0/'})();

// ---------------------------------------------------------------- overlays (letterbox, fades, title card, subtitles)
(function(){const st=document.createElement('style');st.textContent=`
#w3bars{position:fixed;inset:0;pointer-events:none;z-index:70}
#w3bars:before,#w3bars:after{content:'';position:absolute;left:0;right:0;height:0;background:#000;transition:height .8s ease}
#w3bars:before{top:0}#w3bars:after{bottom:0}
#w3bars.on:before,#w3bars.on:after{height:11vh}
#w3fade{position:fixed;inset:0;z-index:71;pointer-events:none;opacity:0;background:#fff}
#w3title{position:fixed;left:16px;right:16px;top:36%;z-index:72;text-align:center;pointer-events:none;opacity:0;transition:opacity 1.4s ease}
#w3title .t1{font-family:Bangers,Impact,'Arial Black',sans-serif;font-size:clamp(36px,8.5vw,104px);letter-spacing:.08em;color:#ffe2c6;text-shadow:0 0 16px #ff5a1a,0 0 44px #9a2aff,0 5px 0 #000}
#w3title .t2{margin-top:12px;font:700 clamp(13px,2.3vw,22px)/1.3 system-ui,sans-serif;letter-spacing:.32em;color:#e0c8ff;text-shadow:0 0 10px #6a1aff,0 2px 0 #000}
#w3sub{position:fixed;left:16px;right:16px;bottom:14vh;z-index:72;text-align:center;pointer-events:none;opacity:0;transition:opacity .35s;font-family:Bangers,Impact,'Arial Black',sans-serif;font-size:clamp(24px,4.6vw,46px);letter-spacing:.04em;color:#fff;text-shadow:0 0 10px #000,0 3px 0 #000}
#w3sub small{display:block;font:700 13px system-ui,sans-serif;letter-spacing:.2em;color:#ffcf8a;text-shadow:0 2px 0 #000;margin-bottom:4px}
#w3load{position:fixed;left:16px;right:16px;bottom:24vh;z-index:72;text-align:center;pointer-events:none;color:#e0c8ff;font:700 13px system-ui,sans-serif;letter-spacing:.25em;text-shadow:0 0 6px #000;opacity:0;transition:opacity .4s}
#endp.w3drop{animation:w3drop 1.05s cubic-bezier(.55,0,.9,.45) forwards;pointer-events:none}
@keyframes w3drop{0%{transform:translateY(0) rotate(0)}14%{transform:translateY(-18px) rotate(-1.5deg)}100%{transform:translateY(125vh) rotate(10deg)}}
body.w3cine>*:not(#c):not([id^="w3"]),body.w3cine>*:not(#c):not([id^="w3"]) *{visibility:hidden!important}
#w3warn{position:fixed;inset:0;z-index:69;pointer-events:none;box-shadow:inset 0 0 0 0 rgba(255,40,20,0);transition:box-shadow .25s}
`;document.head.appendChild(st);
 const add=(id,html)=>{const d=document.createElement('div');d.id=id;if(html)d.innerHTML=html;document.body.appendChild(d);return d};
 add('w3bars');add('w3fade');add('w3title','<div class="t1">THE ABYSSAL REALM</div><div class="t2">REALITY HAS BEEN TORN APART.</div>');add('w3sub');add('w3load');add('w3warn')})();
function fade(to,sec,col){const f=$('w3fade');if(col)f.style.background=col;f.style.transition='opacity '+(sec||.6)+'s ease';f.style.opacity=to}
function bars(on){$('w3bars').classList.toggle('on',!!on)}
function cineUI(on){document.body.classList.toggle('w3cine',!!on);bars(on)}
function sub(text,who){const e=$('w3sub');if(!text){e.style.opacity=0;return}e.innerHTML=(who?'<small>'+who+'</small>':'')+text;e.style.opacity=1}

// ---------------------------------------------------------------- the Abyssal Tyrant: eight chunks -> one GLB -> a rigged, textured boss
const TYM={bytes:84550452,n:8,ch:11534336};
let tyLoad=null;const TY={};W3.TY=TY;
function scriptLoad(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>res();s.onerror=()=>rej(new Error('could not load '+src));document.head.appendChild(s)})}
// each chunk is looked for in the w3 folder, then loose beside index.html (either upload works); a page that may not fetch loads the same file as a script
async function chunkText(i){const urls=[W3BASE+'ty'+i+'.js',(window.MS_ASSET_BASE||'')+'ty'+i+'.js'];let err=null;
 for(const url of urls){
  try{const r=await fetch(url);if(!r.ok)throw new Error('http '+r.status);const t=await r.text();const a=t.indexOf('"'),b=t.lastIndexOf('"');if(a<0||b<=a)throw new Error('bad chunk '+i);return t.slice(a+1,b)}
  catch(e){err=err||e;try{await scriptLoad(url);const T=self.TYC&&self.TYC[i];if(T){self.TYC[i]=null;return T}}catch(e2){}}}
 throw err||new Error('World 3 file '+i+' could not load')}
function b64into(str,out,off){return new Promise(res=>{let i=0;const N=str.length,STEP=1200000;   // a slice per frame, so decoding never stalls the game
 (function step(){const end=Math.min(N,i+STEP);const bin=atob(str.slice(i,end));for(let k=0,L=bin.length;k<L;k++)out[off+k]=bin.charCodeAt(k);off+=bin.length;i=end;if(i<N)setTimeout(step,0);else res()})()})}
// a phone (or any device short of memory): the boss's 4096 maps are drawn at 2048 so World 3 fits in its memory (an iPhone's web view crashed
// and reloaded the page at the realm's door); computers keep every map at full size. window.MS_LITE (true/false) overrides the guess.
function tyLite(){try{if(window.MS_LITE!==undefined)return !!window.MS_LITE;const u=navigator.userAgent||'';return /iPhone|iPad|iPod|Android|Mobile|Silk/i.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)||(navigator.deviceMemory>0&&navigator.deviceMemory<4)}catch(e){return false}}
W3.lite=tyLite;const TY_LITE_PX=2048;
async function decodeImage(bytes,mime){const im=await decodeImage0(bytes,mime);if(!tyLite())return im;const w=im.width,h=im.height,s=TY_LITE_PX/Math.max(w,h);if(!(s<1))return im;
 const c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,0,0,c.width,c.height);try{if(im.close)im.close()}catch(e){}return c}
async function decodeImage0(bytes,mime){const blob=new Blob([bytes],{type:mime});
 try{return await createImageBitmap(blob,{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'})}catch(e){}
 try{return await createImageBitmap(blob)}catch(e){}
 return await new Promise((res,rej)=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=rej;im.src=u})}
function detach(attr){if(!attr)return;if(attr.isInterleavedBufferAttribute){attr.data.array=attr.data.array.slice()}else attr.array=attr.array.slice()}
// stage one (from the moment the Lava Lord rises): download the eight chunks and decode them into one buffer, a slice per frame
let tyBytes=null;
W3.fetchChunks=function(){if(tyBytes)return tyBytes;tyBytes=(async()=>{const out=new Uint8Array(TYM.bytes);let got=0;
 for(let i=0;i<TYM.n;i+=2)await Promise.all([i,i+1].filter(k=>k<TYM.n).map(async k=>{const s=await chunkText(k);await b64into(s,out,k*TYM.ch);got++;W3.loadP=got/TYM.n*.8}));return out})();
 tyBytes.catch(()=>{tyBytes=null});return tyBytes};
// stage two (once World 2 is over, so the heavy parse never lands in a fight): build the model
W3.preload=function(){if(tyLoad)return tyLoad;tyLoad=(async()=>{
 const glp=THREE.GLTFLoader?Promise.resolve():scriptLoad(EXBASE+'examples/js/loaders/GLTFLoader.js');
 const out=await W3.fetchChunks();
 await glp;
 const dv=new DataView(out.buffer);if(dv.getUint32(0,true)!==0x46546C67)throw new Error('the Tyrant files are damaged');
 const jl=dv.getUint32(12,true);const J=JSON.parse(new TextDecoder().decode(out.subarray(20,20+jl)));const binOff=20+jl+8,bin=out.subarray(binOff,binOff+dv.getUint32(20+jl,true));
 // textures: decoded from the GLB's own bytes (no blob URLs, no extra requests), full 4096 resolution
 const imgs=[];for(const im of J.images){const bv=J.bufferViews[im.bufferView],o=bv.byteOffset||0;imgs.push(await decodeImage(bin.subarray(o,o+bv.byteLength),im.mimeType));W3.loadP=.8+.12*imgs.length/J.images.length}
 const texSrc=J.textures.map(t=>t.source);
 const refs=J.materials.map(m=>{const r={name:m.name},p=m.pbrMetallicRoughness||{};if(p.baseColorTexture){r.map=p.baseColorTexture.index;delete p.baseColorTexture}if(p.metallicRoughnessTexture){r.mr=p.metallicRoughnessTexture.index;delete p.metallicRoughnessTexture}
  if(m.normalTexture){r.normal=m.normalTexture.index;r.nuv=m.normalTexture.texCoord||0;delete m.normalTexture}if(m.emissiveTexture){r.emissive=m.emissiveTexture.index;delete m.emissiveTexture}if(m.occlusionTexture)delete m.occlusionTexture;return r});
 delete J.textures;delete J.images;delete J.samplers;
 const js=new TextEncoder().encode(JSON.stringify(J));if(js.length>jl)throw new Error('json grew');out.set(js,20);out.fill(0x20,20+js.length,20+jl);   // same length: the binary chunk stays where it is
 const gltf=await new Promise((res,rej)=>new THREE.GLTFLoader().parse(out.buffer,'',res,rej));
 const aniso=Math.min(8,R.capabilities.getMaxAnisotropy());
 const tex=(i,srgb)=>{const t=new THREE.Texture(imgs[texSrc[i]]);t.flipY=false;t.encoding=srgb?THREE.sRGBEncoding:THREE.LinearEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=aniso;t.needsUpdate=true;return t};
 const texCache={};const T=(i,s)=>texCache[i+'|'+s]||(texCache[i+'|'+s]=tex(i,s));
 gltf.scene.traverse(o=>{if(!o.isMesh)return;detach(o.geometry.attributes.position);for(const k in o.geometry.attributes)detach(o.geometry.attributes[k]);if(o.geometry.index)o.geometry.index.array=o.geometry.index.array.slice();
  // the converted file keeps every mesh's real texture coordinates in its SECOND set (the first is all zeros): use them, or the 4096 maps collapse to one texel
  {const G=o.geometry,A=G.attributes.uv,A2=G.attributes.uv2;if(A2){let zero=true;if(A){const st=Math.max(1,A.count>>9);for(let i=0;i<A.count;i+=st){if(A.getX(i)!==0||A.getY(i)!==0){zero=false;break}}}if(zero)G.setAttribute('uv',A2)}}
  const r=refs.find(q=>q.name===o.material.name);if(!r)return;const m=o.material;
  if(r.map!==undefined){m.map=T(r.map,true);m.color.setRGB(1,1,1)}
  if(r.emissive!==undefined){m.emissiveMap=T(r.emissive,true);m.emissive.setRGB(1,1,1)}
  if(r.normal!==undefined){m.normalMap=T(r.normal,false);if(r.nuv===1)uv2Normal(m)}
  if(r.mr!==undefined){const t=T(r.mr,false);m.roughnessMap=t;m.metalnessMap=t}
  m.needsUpdate=true});
 gltf.animations.forEach(c=>c.tracks.forEach(t=>{t.times=t.times.slice();t.values=t.values.slice()}));
 setupTyrant(gltf);W3.loadP=1;W3.ready=true;tyBytes=null;return TY})();   // (the 85 MB download is no longer needed once he is built: let it go)
 tyLoad.catch(e=>{W3.err=e;tyLoad=null;console.error('World 3: the Abyssal Tyrant could not load',e)});return tyLoad};
// the fortress's normal map uses its second UV set: three.js r128 only reads the first, so the shader is pointed at uv2
function uv2Normal(m){m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <uv_pars_vertex>','#include <uv_pars_vertex>\nattribute vec2 uv2;\nvarying vec2 vUvN;').replace('#include <uv_vertex>','#include <uv_vertex>\nvUvN=uv2;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <uv_pars_fragment>','#include <uv_pars_fragment>\nvarying vec2 vUvN;').replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace(/vUv\b/g,'vUvN')).replace('#include <normalmap_pars_fragment>',THREE.ShaderChunk.normalmap_pars_fragment.replace(/vUv\b/g,'vUvN'))};
 m.customProgramCacheKey=()=>'w3uv2normal'}

TY.SC=44;   // about ten of you, standing
TY.NK=3.2;TY.RIM=.55;   // how deep the relief from his colour map goes; how hot the rim of his silhouette burns
// a relief (normal) map worked out on the graphics card from a colour map's own shading, at the colour map's full size
function normalFromColor(src,k){const im=src.image,w=im.width,h=im.height;
 const rt=new THREE.WebGLRenderTarget(w,h,{wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true,depthBuffer:false,stencilBuffer:false});rt.texture.anisotropy=src.anisotropy;
 const mat=new THREE.ShaderMaterial({uniforms:{t:{value:src},px:{value:new THREE.Vector2(1.5/w,1.5/h)},k:{value:k}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:'uniform sampler2D t;uniform vec2 px;uniform float k;varying vec2 vUv;float L(vec2 o){return dot(texture2D(t,vUv+o*px).rgb,vec3(.299,.587,.114));}\n'+
  'void main(){float a=L(vec2(-1.,1.)),b=L(vec2(0.,1.)),c=L(vec2(1.,1.)),d=L(vec2(-1.,0.)),e=L(vec2(1.,0.)),f=L(vec2(-1.,-1.)),g=L(vec2(0.,-1.)),i=L(vec2(1.,-1.));\n'+
  'vec2 G=vec2((c+2.*e+i)-(a+2.*d+f),(a+2.*b+c)-(f+2.*g+i))*k;G=G/(1.+length(G)*.6);gl_FragColor=vec4(normalize(vec3(-G,1.))*.5+.5,1.);}'});
 const sc=new THREE.Scene(),q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);q.frustumCulled=false;sc.add(q);
 const prev=R.getRenderTarget();R.setRenderTarget(rt);R.render(sc,cam);R.setRenderTarget(prev);mat.dispose();q.geometry.dispose();return rt.texture}
// a burning rim round a silhouette: brightest where the surface turns away from you, so he reads against any sky
function rimGlow(m,col,pw,str){const u={value:new THREE.Color(col).multiplyScalar(str)};m.userData.rim=u;const prev=m.onBeforeCompile;
 m.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);sh.uniforms.uRim=u;sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uRim;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{float fr=1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0);totalEmissiveRadiance+=uRim*pow(fr,'+pw.toFixed(2)+');}')};
 const key=(m.customProgramCacheKey?m.customProgramCacheKey():'')+'|rim'+pw;m.customProgramCacheKey=()=>key;m.needsUpdate=true}
// make every triangle wind the way its vertex normals point (the purchased fortress winds about a tenth of its triangles backwards; with a
// two-sided material three.js flips those faces' normals, which drew dark bands across the towers and floors)
function fixWinding(geo){const P=geo.attributes.position,N=geo.attributes.normal,I=geo.index;if(!P||!N||!I)return 0;const idx=I.array;let flipped=0;
 let ax,ay,az,bx,by,bz,cx,cy,cz;for(let i=0;i<idx.length;i+=3){const i0=idx[i],i1=idx[i+1],i2=idx[i+2];ax=P.getX(i0);ay=P.getY(i0);az=P.getZ(i0);bx=P.getX(i1)-ax;by=P.getY(i1)-ay;bz=P.getZ(i1)-az;cx=P.getX(i2)-ax;cy=P.getY(i2)-ay;cz=P.getZ(i2)-az;
  const nx=by*cz-bz*cy,ny=bz*cx-bx*cz,nz=bx*cy-by*cx,vx=N.getX(i0)+N.getX(i1)+N.getX(i2),vy=N.getY(i0)+N.getY(i1)+N.getY(i2),vz=N.getZ(i0)+N.getZ(i1)+N.getZ(i2);
  if(nx*vx+ny*vy+nz*vz<0){idx[i+1]=i2;idx[i+2]=i1;flipped++}}
 if(flipped)I.needsUpdate=true;return flipped}
function setupTyrant(gltf){const root=gltf.scene;root.updateMatrixWorld(true);
 // the diorama base (a fortress on a crag) becomes the far-off fortress; the creature and his weapon become the boss
 const base=root.getObjectByName('Object_4');
 if(base){const m=base.matrixWorld.clone();base.parent.remove(base);base.matrix.copy(m);base.matrix.decompose(base.position,base.quaternion,base.scale);
  base.material.metalness=base.material.metalnessMap?.6:.06;base.material.roughness=base.material.roughnessMap?1:.86;base.material.side=THREE.DoubleSide;base.castShadow=false;base.receiveShadow=true;const f=new THREE.Group();f.add(base);TY.fort=f}
 const meshes=[];root.traverse(o=>{if(o.isMesh){meshes.push(o);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.layers.set(1)}});TY.meshes=meshes;
 const done=new Set();meshes.forEach(o=>{const m=o.material;if(o.isSkinnedMesh){if(done.has(m))return;done.add(m);
   // his hide: the 4096 colour map is the only map the model has, so its own shading becomes surface relief (wrinkles, scales, plates catch the light)
   m.metalness=.5;m.roughness=.45;m.envMapIntensity=1.2;m.color.setRGB(.95,.92,.95);m.emissive=new THREE.Color(0x060101);
   if(m.map&&!m.normalMap){try{m.normalMap=normalFromColor(m.map,TY.NK);m.normalScale.set(.6,.6)}catch(e){console.warn('World 3: relief map',e)}}
   rimGlow(m,0xff5a1e,3.2,TY.RIM);TY.bodyM=m}
  else{m.emissiveIntensity=2.4;m.metalness=.35;m.roughness=.5;TY.weapon=o;if(m.map&&!m.normalMap){try{m.normalMap=normalFromColor(m.map,TY.NK*.8);m.normalScale.set(1,1)}catch(e){}}rimGlow(m,0xff6a2a,3.4,TY.RIM*.6)}});   // the weapon's veins glow
 const inner=new THREE.Group();inner.add(root);inner.rotation.y=-Math.PI/2;root.position.set(-.236,-.19,0);   // he faces +X in the file; the game faces +Z
 const outer=new THREE.Group();outer.add(inner);outer.scale.setScalar(TY.SC);outer.traverse(o=>o.layers.set(1));
 Object.assign(TY,{root,inner,g:outer});
 const find=n=>{let r=null;root.traverse(o=>{if(!r&&o.name.replace(/_\d+$/,'')===n)r=o});return r};
 TY.hips=find('mixamorigHips');TY.head=find('mixamorigHead');TY.hand=find('mixamorigRightHand');TY.footL=find('mixamorigLeftFoot');TY.footR=find('mixamorigRightFoot');TY.chest=find('mixamorigSpine2');
 const clips={};gltf.animations.forEach(c=>clips[c.name]=c);TY.clips=clips;
 const hn=TY.hips.name;
 // the leap carries him forward in the file: take that travel out of the hips and move the whole boss instead (no sliding, he lands where he hits)
 const stripMove=c=>{const tr=c&&c.tracks.find(t=>t.name===hn+'.position');if(!tr)return null;const v=tr.values,n=tr.times.length,x0=v[0],z0=v[2],dx=new Float32Array(n),dz=new Float32Array(n);for(let i=0;i<n;i++){dx[i]=v[i*3]-x0;dz[i]=v[i*3+2]-z0;v[i*3]=x0;v[i*3+2]=z0}return {T:tr.times,dx,dz}};
 TY.rm={Attack_5:stripMove(clips.Attack_5)};
 // the turns rotate his hips a quarter turn: take that yaw out of the hips and turn the whole boss by the same curve, so he pivots on his feet
 const stripYaw=c=>{const tr=c&&c.tracks.find(t=>t.name===hn+'.quaternion');if(!tr)return null;const v=tr.values,n=tr.times.length,q=new THREE.Quaternion(),f=new V3(),ry=new THREE.Quaternion(),Y=new V3(0,1,0),d=new Float32Array(n);let h0=0,prev=0,acc=0;
  for(let i=0;i<n;i++){q.fromArray(v,i*4);f.set(0,0,1).applyQuaternion(q);const h=Math.atan2(f.x,f.z);if(i===0){h0=h;prev=h}acc+=angN(h-prev);prev=h;d[i]=acc;ry.setFromAxisAngle(Y,-acc);q.premultiply(ry);q.toArray(v,i*4)}return {T:tr.times,d}};
 TY.yaw={Turn_left:stripYaw(clips.Turn_left),Turn_right:stripYaw(clips.Turn_right)};
 const mixer=new THREE.AnimationMixer(root);const acts={};for(const k in clips){const a=mixer.clipAction(clips[k]);if(!/Idle|Walk|Static/.test(k)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true}acts[k]=a}
 Object.assign(TY,{mixer,acts,cur:null,curName:'',curT0:0,ts:1});
 tyPlay('Idle_1',0);mixer.update(0)}
function curveAt(C,arr,t){const T=C.T,n=T.length;if(t<=T[0])return arr[0];if(t>=T[n-1])return arr[n-1];let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m}const k=(t-T[lo])/(T[hi]-T[lo]);return arr[lo]+(arr[hi]-arr[lo])*k}
function tyPlay(name,fade=.28,ts=1,from=0){const a=TY.acts[name];if(!a)return;const cur=TY.cur;if(cur===a&&a.isRunning()&&!from){if(Math.abs(TY.ts-ts)>.001){a.setEffectiveTimeScale(ts);TY.ts=ts}return}a.reset();a.setEffectiveTimeScale(ts);a.setEffectiveWeight(1);a.time=from;a.play();
 if(cur&&cur!==a&&fade>0)cur.crossFadeTo(a,fade,false);else if(cur&&cur!==a)cur.stop();TY.cur=a;TY.curName=name;TY.ts=ts;TY.curT0=now()-from/ts;TY.rmPrev=0;TY.yawPrev=0}
function tyClipT(){return TY.cur?TY.cur.time:0}

// ---------------------------------------------------------------- THE REALM: a floating arena over an abyss, under an eclipse
const AB={R:170,built:false,ticks:[],lights:[],seed:1};
function srnd(){AB.seed=(AB.seed*16807)%2147483647;return AB.seed/2147483647}
const sr=(a,b)=>a+srnd()*(b-a);
function cvTex(w,h,draw,rep,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep,rep);t.anisotropy=8;if(srgb)t.encoding=THREE.sRGBEncoding;return t}
function noiseImg(g,w,h,base,amp,sc){const id=g.createImageData(w,h),d=id.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=(Math.sin(x*sc*1.7+Math.sin(y*sc*.9)*2)+Math.sin(y*sc*1.3+Math.sin(x*sc*.7)*2.3))*.25+.5;const r=srnd();const k=(y*w+x)*4,v=amp*(n*.6+r*.4);d[k]=base[0]+v*base[3];d[k+1]=base[1]+v*.7*base[3];d[k+2]=base[2]+v*1.1*base[3];d[k+3]=255}g.putImageData(id,0,0)}
let ABT=null;
function abyssTextures(){if(ABT)return ABT;AB.seed=4242;
 // obsidian flagstones at 1024: worn faces, bevelled edges, dark grout, chips and scratches (the relief map is worked out from this)
 const slab=cvTex(1024,1024,(g,w,h)=>{noiseImg(g,w,h,[40,33,50,1],30,.025);const N=8,s=w/N;
   for(let j=0;j<N;j++)for(let i=0;i<N;i++){const ox=(j%2)*s*.5;const x=i*s+ox,y=j*s;const v=50+srnd()*30;g.fillStyle=`rgba(${v+2},${v-6},${v+14},.85)`;g.fillRect(x+6,y+6,s-12,s-12);
    const gr=g.createLinearGradient(x,y,x+s,y+s);gr.addColorStop(0,'rgba(255,235,255,.08)');gr.addColorStop(1,'rgba(0,0,0,.18)');g.fillStyle=gr;g.fillRect(x+6,y+6,s-12,s-12);
    g.strokeStyle='rgba(120,96,156,.5)';g.lineWidth=4;g.strokeRect(x+6,y+6,s-12,s-12);g.strokeStyle='rgba(4,2,6,.95)';g.lineWidth=7;g.strokeRect(x+1,y+1,s-2,s-2);
    for(let q=0;q<3;q++){g.strokeStyle=`rgba(0,0,0,${.3+srnd()*.35})`;g.lineWidth=1+srnd()*1.5;g.beginPath();let cx=x+10+srnd()*(s-20),cy=y+10+srnd()*(s-20);g.moveTo(cx,cy);for(let z=0;z<4;z++){cx+=(srnd()-.5)*34;cy+=(srnd()-.5)*34;g.lineTo(cx,cy)}g.stroke()}}
   for(let k=0;k<420;k++){g.fillStyle=`rgba(170,140,210,${srnd()*.16})`;g.fillRect(srnd()*w,srnd()*h,2+srnd()*4,2+srnd()*4)}},7);
 const rock=cvTex(256,256,(g,w,h)=>{noiseImg(g,w,h,[22,16,18,1],40,.09);for(let k=0;k<60;k++){g.strokeStyle=`rgba(0,0,0,${.2+srnd()*.3})`;g.lineWidth=1+srnd()*2;g.beginPath();let x=srnd()*w,y=srnd()*h;g.moveTo(x,y);for(let q=0;q<4;q++){x+=(srnd()-.5)*40;y+=srnd()*30;g.lineTo(x,y)}g.stroke()}},3);
 // the realm's rock: the same cracked volcanic stone, lit for the open arena (the cave keeps the dark one above)
 const rockL=cvTex(512,512,(g,w,h)=>{noiseImg(g,w,h,[80,66,72,1],56,.045);for(let k=0;k<160;k++){g.strokeStyle=`rgba(10,4,8,${.25+srnd()*.35})`;g.lineWidth=1.5+srnd()*3;g.beginPath();let x=srnd()*w,y=srnd()*h;g.moveTo(x,y);for(let q=0;q<5;q++){x+=(srnd()-.5)*70;y+=srnd()*55;g.lineTo(x,y)}g.stroke()}
   for(let k=0;k<500;k++){g.fillStyle=`rgba(${150+srnd()*60},${120+srnd()*50},${130+srnd()*60},${srnd()*.18})`;g.fillRect(srnd()*w,srnd()*h,2+srnd()*5,2+srnd()*5)}},3);
 // the glow layer over the arena: rune rings, a central sigil, and molten cracks running out to the edge
 const glow=cvTex(1024,1024,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);const C=w/2,Rr=w/2;g.translate(C,C);
   const ring=(r,col,lw,blur)=>{g.save();g.shadowColor=col;g.shadowBlur=blur;g.strokeStyle=col;g.lineWidth=lw;g.beginPath();g.arc(0,0,r*Rr,0,Math.PI*2);g.stroke();g.restore()};
   const runes=(r,n,col,sz)=>{g.save();g.shadowColor=col;g.shadowBlur=10;g.strokeStyle=col;g.lineWidth=4;for(let i=0;i<n;i++){g.save();g.rotate(i/n*Math.PI*2);g.translate(0,-r*Rr);g.beginPath();const k=(i*7)%5;
     if(k===0){g.moveTo(-sz,sz);g.lineTo(0,-sz);g.lineTo(sz,sz);g.moveTo(-sz*.5,0);g.lineTo(sz*.5,0)}else if(k===1){g.moveTo(0,-sz);g.lineTo(0,sz);g.moveTo(-sz,-sz*.3);g.lineTo(sz,sz*.3)}else if(k===2){g.arc(0,0,sz*.7,0,Math.PI*1.5)}else if(k===3){g.moveTo(-sz,-sz);g.lineTo(sz,sz);g.moveTo(sz,-sz);g.lineTo(-sz,sz);g.moveTo(0,-sz);g.lineTo(0,sz)}else{g.moveTo(-sz,sz);g.lineTo(-sz,-sz);g.lineTo(sz,-sz*.2);g.lineTo(-sz*.2,sz*.3)}
     g.stroke();g.restore()}g.restore()};
   // molten cracks
   g.save();g.lineCap='round';for(let k=0;k<26;k++){let a=srnd()*Math.PI*2,r=.08+srnd()*.25;let x=Math.cos(a)*r*Rr,y=Math.sin(a)*r*Rr;g.beginPath();g.moveTo(x,y);const L=6+srnd()*10;
     for(let q=0;q<L;q++){a+=(srnd()-.5)*.6;const st=(14+srnd()*30);x+=Math.cos(a)*st;y+=Math.sin(a)*st;g.lineTo(x,y);if(Math.hypot(x,y)>Rr*.97)break}
     g.shadowColor='#ff5a10';g.shadowBlur=16;g.strokeStyle='#ff6a1a';g.lineWidth=3.5+srnd()*4;g.stroke();g.shadowBlur=0;g.strokeStyle='#ffd27a';g.lineWidth=1.5;g.stroke()}g.restore();
   ring(.2,'#a24aff',6,18);ring(.235,'#7a2aff',3,10);runes(.2175,24,'#c890ff',12);
   ring(.5,'#8a3aff',5,16);runes(.53,40,'#b070ff',13);ring(.56,'#6a2ae0',2.6,8);
   ring(.86,'#9a40ff',6,20);runes(.9,64,'#c890ff',13);ring(.94,'#6a1ae0',3.2,10);
   // the sigil he lands on
   g.save();g.shadowColor='#ff7a2a';g.shadowBlur=20;g.strokeStyle='#ff8a3a';g.lineWidth=6;g.beginPath();for(let i=0;i<=7;i++){const a=i*Math.PI*2*3/7-Math.PI/2;const x=Math.cos(a)*.17*Rr,y=Math.sin(a)*.17*Rr;i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.restore();
   ring(.06,'#ffb060',7,22)},null);
 glow.wrapS=glow.wrapT=THREE.ClampToEdgeWrapping;
 return ABT={slab,rock,rockL,glow}}
function rockMaterial(col){const T=abyssTextures();return new THREE.MeshStandardMaterial({color:col||0xb8aab0,map:T.rockL,roughness:.92,metalness:.04,flatShading:true})}
function jagLathe(pts,seg,jit,seed){AB.seed=seed||7;const g=new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);const P=g.attributes.position;const m=new Map();
 for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i),z=P.getZ(i);const k=Math.round(x*10)+','+Math.round(y*10)+','+Math.round(z*10);let o=m.get(k);if(!o){const r=Math.hypot(x,z);o=r<.01?[1,0]:[1+(srnd()-.5)*jit,(srnd()-.5)*jit*6];m.set(k,o)}P.setXYZ(i,x*o[0],y+o[1],z*o[0])}
 g.computeVertexNormals();return g}
// ---- the sky: storm clouds, an eclipsed sun with a burning corona, lightning flashes
function abyssSky(){const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,uniforms:{uT:{value:0},uFlash:{value:0},uDark:{value:0},uRage:{value:0},uWin:{value:0},uEcl:{value:new V3(-.12,.30,-.95).normalize()}},
 vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;gl_Position.z=gl_Position.w;}',
 // deep space over the Tyrant's realm: dusty nebulae in rust and rose, dark lanes of dust, a sea of stars, the galaxy's bright heart behind his fortress
 // and the eclipse sitting in front of it (it breaks when he falls)
 fragmentShader:'uniform float uT;uniform float uFlash;uniform float uDark;uniform float uRage;uniform float uWin;uniform vec3 uEcl;varying vec3 vW;\n'+
 'float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\n'+
 'float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1.,0.,0.)),f.x),mix(h3(i+vec3(0.,1.,0.)),h3(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(h3(i+vec3(0.,0.,1.)),h3(i+vec3(1.,0.,1.)),f.x),mix(h3(i+vec3(0.,1.,1.)),h3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}\n'+
 'float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<6;i++){s+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}\n'+
 'vec3 stars(vec3 d,float sc,float th,float sz,float sd){vec3 p=d*sc+sd;vec3 i=floor(p),f=fract(p)-.5;float r=h3(i);if(r<th)return vec3(0.);vec3 o=vec3(h3(i+3.1),h3(i+7.7),h3(i+1.3))-.5;float dd=length(f-o*.6);float b=pow((r-th)/(1.-th),2.2);float tw=.8+.2*sin(uT*(1.3+r*3.)+r*40.);return mix(vec3(1.,.82,.66),vec3(.72,.82,1.),h3(i+5.5))*smoothstep(sz,sz*.15,dd)*b*tw;}\n'+
 'void main(){vec3 d=normalize(vW-cameraPosition);\n'+
 ' float n=fbm(d*2.1+vec3(0.,uT*.0015,0.)),n2=fbm(d*5.2+vec3(4.,1.,7.)),ln=smoothstep(.42,.74,fbm(d*3.3+vec3(9.,2.,5.)));\n'+
 ' float e=dot(d,uEcl);float band=exp(-pow(dot(d,normalize(vec3(.25,1.,.15)))*2.6,2.));\n'+
 ' vec3 neb=mix(vec3(.05,.022,.017),vec3(.24,.12,.075),smoothstep(.46,.86,n))*smoothstep(.34,.84,n)*(.45+.8*band);\n'+
 ' neb+=vec3(.15,.05,.08)*smoothstep(.58,.94,n2)*.45*(.4+band);neb*=1.-ln*.8;\n'+
 ' float core=exp((e-1.)*3.5)*.05;\n'+
 ' vec3 c=vec3(.004,.003,.004)+neb+vec3(1.,.66,.38)*core*(.65+.45*n);\n'+
 ' c+=stars(d,260.,.80,.30,0.)*1.6+stars(d,120.,.93,.22,11.)*3.4+stars(d,48.,.985,.34,23.)*1.8*(.6+band);\n'+
 ' float an=acos(clamp(e,-1.,1.));float disc=1.-smoothstep(.052,.0545,an);float o=max(an-.053,0.);float ra=atan(dot(d,normalize(cross(uEcl,vec3(0.,1.,0.)))),d.y-uEcl.y*e);float rays=.55+.45*n3(vec3(ra*7.,uT*.08,1.))*n3(vec3(ra*19.,2.,uT*.05));\n'+
 ' float cor=exp(-o*160.)*3.2+exp(-o*34.)*.6*rays+exp(-o*9.)*.12*rays;c+=mix(vec3(1.,.70,.40),vec3(1.,.2,.05),uRage)*cor*(1.-disc)*(1.+uRage*.5);c=mix(c,vec3(0.),disc*(1.-uWin));c+=vec3(1.,.86,.62)*disc*uWin*2.2;\n'+
 ' c+=vec3(.62,.52,.95)*uFlash*(.12+n*.45);c*=1.-.6*uDark;c=mix(c,c*vec3(1.55,.48,.34)+vec3(.035,0.,0.),uRage*.72);c=mix(c,c*1.5+vec3(.07,.055,.04),uWin*.6);\n'+
 ' gl_FragColor=vec4(c,1.);\n#include <encodings_fragment>\n}'});
 const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);m.scale.setScalar(2000);m.frustumCulled=false;m.renderOrder=-1;return m}
// ---- glowing tears in the sky and along the islands
function riftMat(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,uniforms:{uT:{value:0},uSeed:{value:Math.random()*10}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;uniform float uSeed;varying vec2 vUv;float h(float x){return fract(sin(x*91.7+uSeed)*43758.5);}float n1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h(i),h(i+1.),f);}\nvoid main(){float y=vUv.y;float cx=.5+(n1(y*7.+uSeed)-.5)*.34+(n1(y*23.+uSeed*2.)-.5)*.1;float w=(.012+.05*sin(y*3.14159))*(.8+.4*n1(y*13.+uT*1.7));float d=abs(vUv.x-cx);\nfloat core=1.-smoothstep(w*.25,w,d);float glow=exp(-d/(w*3.5+.002))*.8;float a=(core+glow)*smoothstep(0.,.12,y)*(1.-smoothstep(.88,1.,y));vec3 c=mix(vec3(.55,.18,1.),vec3(1.,.85,1.),core);gl_FragColor=vec4(c*a*(1.3+.3*sin(uT*3.+y*20.)),a);}'})}
// ---- the molten falls pouring off the islands into the abyss
function fallMat(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,uniforms:{uT:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\nvoid main(){vec2 p=vec2(vUv.x*6.,vUv.y*14.+uT*2.2);float s=n(p)*.6+n(p*2.3)*.4;float edge=smoothstep(0.,.25,vUv.x)*(1.-smoothstep(.75,1.,vUv.x));float a=edge*smoothstep(0.,.5,vUv.y)*(.55+.45*s);vec3 c=mix(vec3(1.,.3,.04),vec3(1.,.8,.4),s*s);gl_FragColor=vec4(c*a*1.4,a);}'})}
function barrierMat(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,uniforms:{uT:{value:0},uNear:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;uniform float uNear;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\nvoid main(){float s=n(vec2(vUv.x*120.,vUv.y*6.-uT*.8))*.6+n(vec2(vUv.x*300.,vUv.y*14.-uT*1.6))*.4;float a=(1.-vUv.y)*(1.-vUv.y)*(.12+.5*uNear)*(.4+.8*s)+(1.-smoothstep(0.,.04,vUv.y))*.5;gl_FragColor=vec4(vec3(.55,.2,1.)*a,a);}'})}
function boneMaterial(){return new THREE.MeshStandardMaterial({color:0xcfc2a2,roughness:.7,metalness:0,flatShading:true})}
function chainLinks(paths){const geo=new THREE.TorusGeometry(1.7,.5,6,10);const mat=new THREE.MeshStandardMaterial({color:0x5a5260,metalness:.8,roughness:.4});
 const pts=[];paths.forEach(P=>{const N=Math.max(2,Math.floor(P.len/2.7));for(let i=0;i<N;i++){const t=i/(N-1);const p=P.at(t),p2=P.at(Math.min(1,t+1/N));pts.push([p,p2,i])}});
 const im=new THREE.InstancedMesh(geo,mat,pts.length);const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),Q2=new THREE.Quaternion(),S1=new V3(1,1,1),dir=new V3(),Z=new V3(0,0,1),X=new V3(1,0,0);
 pts.forEach(([p,p2,i],k)=>{dir.copy(p2).sub(p);if(dir.lengthSq()<1e-6)dir.set(0,-1,0);dir.normalize();Q.setFromUnitVectors(X,dir);Q2.setFromAxisAngle(X,(i%2)*Math.PI/2);Q.multiply(Q2);M.compose(p,Q,S1);im.setMatrixAt(k,M)});
 im.castShadow=true;im.receiveShadow=false;im.layers.set(1);return im}
function catenary(a,b,sag){const len=a.distanceTo(b)*1.08;return {len,at:t=>new V3().lerpVectors(a,b,t).add(new V3(0,-Math.sin(t*Math.PI)*sag,0))}}
function dangling(a,dirXZ,reach,drop){const b=new V3(a.x+dirXZ.x*reach,a.y-drop,a.z+dirXZ.z*reach);const len=reach+drop;return {len,at:t=>{const p=new V3().lerpVectors(a,b,t);p.y=a.y-drop*Math.pow(t,1.6)-Math.sin(t*Math.PI)*reach*.15;return p}}}
// ---- props
function addM(par,geo,mat,x,y,z,ry,rx,rz,sx,sy,sz){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,rz||0);if(sx)m.scale.set(sx,sy||sx,sz||sx);m.castShadow=true;m.receiveShadow=true;par.add(m);return m}
function tower(par,x,y,z,h,r,mats){const g=new THREE.Group();g.position.set(x,y,z);par.add(g);const broken=srnd()<.6;const H=broken?h*sr(.55,.85):h;
 addM(g,new THREE.CylinderGeometry(r*.92,r*1.12,H,10),mats.stone,0,H/2,0);
 if(!broken){addM(g,new THREE.CylinderGeometry(r*1.15,r*1.15,2.2,10),mats.stone,0,H+1.1,0);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;addM(g,new THREE.BoxGeometry(r*.5,2.6,r*.4),mats.stone,Math.cos(a)*r*1.05,H+3.3,Math.sin(a)*r*1.05,-a)}addM(g,new THREE.ConeGeometry(r*1.2,h*.45,10),mats.roof,0,H+3+h*.22,0)}
 else{for(let i=0;i<5;i++){const a=srnd()*Math.PI*2;addM(g,new THREE.BoxGeometry(r*.6,sr(2,7),r*.5),mats.stone,Math.cos(a)*r*.8,H+sr(0,2),Math.sin(a)*r*.8,a,sr(-.4,.4),sr(-.4,.4))}}
 for(let i=0;i<4;i++){const a=srnd()*Math.PI*2,yy=sr(.25,.85)*H;addM(g,new THREE.BoxGeometry(.9,2.4,.4),mats.glowO,Math.cos(a)*r*1.02,yy,Math.sin(a)*r*1.02,-a+Math.PI/2)}
 return g}
function statue(par,x,y,z,s,ry,mats){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;g.scale.setScalar(s);par.add(g);const M=mats.statue;
 addM(g,new THREE.BoxGeometry(9,3,9),mats.stone,0,1.5,0);addM(g,new THREE.CylinderGeometry(2.3,2.9,7,10),M,0,7,0,0,-.15);   // kneeling body
 addM(g,new THREE.BoxGeometry(5.6,1.6,3.6),M,0,10.2,0);addM(g,new THREE.SphereGeometry(1.5,12,10),M,0,12.3,.3);   // shoulders, head
 addM(g,new THREE.ConeGeometry(.45,2.6,8),M,-1.2,13.6,.2,0,0,.5);addM(g,new THREE.ConeGeometry(.45,2.6,8),M,1.2,13.6,.2,0,0,-.5);   // horns
 addM(g,new THREE.CylinderGeometry(.7,.6,5,8),M,-2.6,8.2,1.4,0,-.9,.25);addM(g,new THREE.CylinderGeometry(.7,.6,5,8),M,2.6,8.2,1.4,0,-.9,-.25);   // arms reaching to the sword
 addM(g,new THREE.BoxGeometry(1,16,.35),M,0,7.6,4.2,0,.08);addM(g,new THREE.BoxGeometry(4.2,.7,.7),M,0,12.4,3.8);   // great sword planted in front
 addM(g,new THREE.SphereGeometry(.42,8,6),mats.glowV,-.55,12.5,1.62);addM(g,new THREE.SphereGeometry(.42,8,6),mats.glowV,.55,12.5,1.62);   // eyes still burning
 return g}
function skeleton(par,x,y,z,s,ry,mats){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;g.scale.setScalar(s);par.add(g);const B=mats.bone;
 for(let i=0;i<14;i++){const t=i/13;addM(g,new THREE.CylinderGeometry(.55,.55,1.6,7),B,0,1+Math.sin(t*3)*.6,-t*22,0,Math.PI/2)}
 for(let i=0;i<8;i++){const zz=-3-i*1.9,r=4.6-i*.25;[-1,1].forEach(sd=>{const rib=addM(g,new THREE.TorusGeometry(r,.32,5,12,Math.PI*.62),B,0,1.3,zz,0,0,0);rib.rotation.set(0,sd>0?0:Math.PI,Math.PI/2+.2*sd)})}
 const sk=addM(g,new THREE.SphereGeometry(3.4,12,10),B,0,3,4.5,0,0,0,1,.85,1.25);addM(g,new THREE.BoxGeometry(4,1.4,3.2),B,0,1.1,7.4);
 addM(g,new THREE.SphereGeometry(.9,8,6),mats.dark,-1.2,3.6,7.6);addM(g,new THREE.SphereGeometry(.9,8,6),mats.dark,1.2,3.6,7.6);
 addM(g,new THREE.ConeGeometry(.7,5,8),B,-2.8,5.6,4.2,0,0,.7);addM(g,new THREE.ConeGeometry(.7,5,8),B,2.8,5.6,4.2,0,0,-.7);
 for(let i=0;i<2;i++)addM(g,new THREE.CylinderGeometry(.6,.4,11,7),B,(i?-1:1)*7,1,-6,0,0,(i?1:-1)*1.2);   // an arm bone flung out
 return g}
function obelisk(par,x,y,z,h,mats){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=srnd()*3;par.add(g);addM(g,new THREE.BoxGeometry(3.2,h,3.2),mats.obs,0,h/2,0);addM(g,new THREE.ConeGeometry(2.3,4,4),mats.obs,0,h+2,0,Math.PI/4);
 for(let i=0;i<5;i++)addM(g,new THREE.BoxGeometry(3.3,.35,3.3),mats.glowV,0,h*(.2+i*.15),0);return g}
function moltenRiver(par,pts,w,y){const shape=[];const geo=new THREE.BufferGeometry();const P=[],I=[];for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;const nx=-dz/L,nz=dx/L;const ww=w*(.7+.3*Math.sin(i*1.3));P.push(pts[i][0]+nx*ww,y,pts[i][1]+nz*ww,pts[i][0]-nx*ww,y,pts[i][1]-nz*ww);if(i){const k=i*2;I.push(k-2,k-1,k,k-1,k+1,k)}}
 geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setIndex(I);geo.computeVertexNormals();const m=new THREE.Mesh(geo,AB.lavaM);m.layers.set(1);par.add(m);return m}
function moltenFall(par,x,y,z,w,h,face){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h,1,1),AB.fallM);m.position.set(x,y-h/2,z);m.rotation.y=face;m.layers.set(1);par.add(m);return m}
function island(par,x,y,z,r,depth,seed,deco){const g=new THREE.Group();g.position.set(x,y,z);par.add(g);
 const prof=[[0.01,1.4],[r*.6,1.5],[r*.95,.9],[r,-1.5],[r*.92,-depth*.12],[r*.75,-depth*.3],[r*.5,-depth*.55],[r*.24,-depth*.82],[0.01,-depth]];
 const body=new THREE.Mesh(jagLathe(prof,22,.18,seed),AB.rockM);body.castShadow=false;body.receiveShadow=true;g.add(body);
 AB.seed=seed*13+5;if(deco)deco(g,r);return g}
function abyssMats(){const T=abyssTextures();return {
 stone:new THREE.MeshStandardMaterial({color:0xd6cad8,map:T.rockL,roughness:.88,flatShading:true}),roof:new THREE.MeshStandardMaterial({color:0x6a2a34,roughness:.7,metalness:.2,flatShading:true}),
 statue:new THREE.MeshStandardMaterial({color:0xe2d8e6,map:T.rockL,roughness:.8,metalness:.05,flatShading:true}),bone:boneMaterial(),dark:new THREE.MeshBasicMaterial({color:0x050206}),
 obs:new THREE.MeshStandardMaterial({color:0x2c2636,roughness:.2,metalness:.3,envMapIntensity:2.2,flatShading:true}),
 glowV:new THREE.MeshBasicMaterial({color:0xa050ff,toneMapped:false}),glowO:new THREE.MeshBasicMaterial({color:0xff7a2a,toneMapped:false})}}
// ---- the courtyard's paving where you fight: worn plates of blood-dark stone, cracks, grit and pebbles, rust-red seams (tiles seamlessly; a height map gives its relief)
function courtyardTex(){if(AB.cyT)return AB.cyT;AB.seed=8181;const N=1024,G=7,cells=[];
 for(let j=0;j<G;j++)for(let i=0;i<G;i++){const h=srnd();cells.push({x:(i+.15+srnd()*.7)/G,y:(j+.15+srnd()*.7)/G,c:h<.45?[54,27,21]:h<.8?[66,33,25]:[58,44,39],v:.78+srnd()*.4,seam:srnd()<.35})}
 // tileable value noise
 const P=64,lat=new Float32Array(P*P);for(let i=0;i<P*P;i++)lat[i]=srnd();const vn=(x,y,f)=>{x*=f;y*=f;const p=P%f===0?f:f;const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const g=(a,b)=>lat[(((b%f)+f)%f)*P+(((a%f)+f)%f)];return g(xi,yi)*(1-u)*(1-v)+g(xi+1,yi)*u*(1-v)+g(xi,yi+1)*(1-u)*v+g(xi+1,yi+1)*u*v};
 const fbm=(x,y)=>vn(x,y,4)*.5+vn(x,y,8)*.25+vn(x,y,16)*.15+vn(x,y,32)*.1;
 const col=new Uint8ClampedArray(N*N*4),hgt=new Uint8ClampedArray(N*N*4);
 for(let py=0;py<N;py++)for(let px=0;px<N;px++){const x=px/N,y=py/N;const wx=x+(vn(x,y,8)-.5)*.07+(vn(x,y,16)-.5)*.02,wy=y+(vn(x+.37,y+.11,8)-.5)*.07+(vn(x+.5,y+.2,16)-.5)*.02;
  let d1=9,d2=9,c1=null;const ci=Math.floor(wx*G),cj=Math.floor(wy*G);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ii=ci+di,jj=cj+dj,C=cells[((jj%G+G)%G)*G+((ii%G+G)%G)];const cx=C.x+Math.floor(ii/G),cy=C.y+Math.floor(jj/G);const d=Math.hypot(wx-cx,wy-cy);if(d<d1){d2=d1;d1=d;c1=C}else if(d<d2)d2=d}
  const edge=(d2-d1)*G,n=fbm(x,y),grit=vn(x,y,64)*.6+vn(x,y,128)*.4;const crack=1-Math.min(1,Math.max(0,(edge-.04)/.09));const rim=Math.max(0,1-Math.abs(edge-.16)/.07)*.25;
  const st=vn(x+.21,y+.63,4)*.6+vn(x,y,8)*.4;let k=c1.v*(.66+.6*n)*(.8+.4*grit)+rim;k*=1-crack*.82;k*=1-Math.max(0,st-.58)*1.1;let r=c1.c[0]*k,g=c1.c[1]*k,b=c1.c[2]*k;if(st>.62){r+=(st-.62)*60;g*=.9}
  if(c1.seam&&crack>.3){const s=(crack-.3)/.7;r+=s*70*(.6+.4*n);g+=s*8;b+=s*2}
  const o=(py*N+px)*4;col[o]=r;col[o+1]=g;col[o+2]=b;col[o+3]=255;const hv=Math.max(0,Math.min(255,(1-crack)*170+n*60+grit*25));hgt[o]=hgt[o+1]=hgt[o+2]=hv;hgt[o+3]=255}
 // pebbles and grit scattered over the plates
 const cv=document.createElement('canvas');cv.width=cv.height=N;const g=cv.getContext('2d');g.putImageData(new ImageData(col,N,N),0,0);
 const hv=document.createElement('canvas');hv.width=hv.height=N;const gh=hv.getContext('2d');gh.putImageData(new ImageData(hgt,N,N),0,0);
 for(let i=0;i<900;i++){const x=srnd()*N,y=srnd()*N,r=.8+srnd()*3.2,a=srnd()*3,l=srnd();for(const [ox,oy] of [[0,0],[N,0],[-N,0],[0,N],[0,-N]]){g.fillStyle=l<.5?'rgba(20,10,8,.55)':'rgba(150,110,96,.45)';g.beginPath();g.ellipse(x+ox,y+oy,r,r*.7,a,0,6.283);g.fill();gh.fillStyle='rgba(255,255,255,.6)';gh.beginPath();gh.ellipse(x+ox,y+oy,r,r*.7,a,0,6.283);gh.fill()}}
 const T=new THREE.CanvasTexture(cv);T.encoding=THREE.sRGBEncoding;T.wrapS=T.wrapT=THREE.RepeatWrapping;T.anisotropy=8;
 const H=new THREE.CanvasTexture(hv);H.wrapS=H.wrapT=THREE.RepeatWrapping;
 // an irregular edge: opaque inside, broken away toward the rim so the fortress's own ground shows through
 const ac=document.createElement('canvas');ac.width=ac.height=512;const ga=ac.getContext('2d');const id=ga.createImageData(512,512),dd=id.data;
 for(let py=0;py<512;py++)for(let px=0;px<512;px++){const dx=px/256-1,dy=py/256-1,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);const nn=vn((a/6.283+1)*1,r*.5,16)*.6+vn((a/6.283+1),r,32)*.4;const v=(r<.86+nn*.1)?255:0;const o=(py*512+px)*4;dd[o]=dd[o+1]=dd[o+2]=v;dd[o+3]=255}
 ga.putImageData(id,0,0);const A=new THREE.CanvasTexture(ac);
 AB.cyT={map:T,height:H,alpha:A};return AB.cyT}
// ---- the realm: the Tyrant's own fortress (the artist's diorama, raised to titan scale) floating in deep space; you fight in its courtyard
// Model units are the diorama's own (the Tyrant is about 1 tall in them). The courtyard point FORT.X0 becomes the arena's centre.
const FORT={S:64,X0:-.3,R1:AB.R+2,R2:AB.R+48,done:false};
// the courtyard's height along its length (model units, sampled from the diorama from straight above): it climbs gently toward the gate
const FORT_H=[[3.5,.10],[2,.15],[0,.21],[-1,.24],[-2,.32],[-2.5,.40],[-3,.51],[-3.5,.55],[-4,.89]];
function fortH(x){const T=FORT_H;if(x>=T[0][0])return T[0][1];for(let i=1;i<T.length;i++){if(x>=T[i][0]){const a=T[i-1],b=T[i],k=(x-b[0])/(a[0]-b[0]);return b[1]+(a[1]-b[1])*k}}return T[T.length-1][1]}
FORT.Y0=fortH(FORT.X0);
// the two great braziers inside the arena and the four beyond it (model x, model z, radius, top of the bowl in model units)
const FORT_BRAZ=[[-.03,2.38,.58,1.0],[-.07,-2.31,.58,1.0],[-1.02,3.40,.3,.95],[-1.02,-3.47,.3,.95],[-4.07,1.57,.5,1.35],[-4.03,-1.53,.5,1.35]];
const fortToGame=(x,y,z)=>new V3(-z*FORT.S,(y-FORT.Y0)*FORT.S,(x-FORT.X0)*FORT.S);
// warp the diorama so its courtyard is perfectly level inside the arena (the slope is taken out, small bumps pressed flat; the braziers and walls keep their shape)
function fortFlatten(base){if(FORT.done)return;FORT.done=true;const G=base.geometry,P=G.attributes.position,N=G.attributes.normal,M=new THREE.Matrix4().compose(base.position,base.quaternion,base.scale),Mi=M.clone().invert();
 const v=new V3(),up=new V3(0,1,0).applyQuaternion(base.quaternion.clone().invert()).normalize();let flat=0,moved=0;
 const braz=FORT_BRAZ.slice(0,2).map(b=>[b[0],b[1],b[2]*1.12]);
 for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(M);const gx=-v.z*FORT.S,gz=(v.x-FORT.X0)*FORT.S,r=Math.hypot(gx,gz);if(r>FORT.R2)continue;
  const w=1-sstep(FORT.R1,FORT.R2,r),d=(fortH(v.x)-FORT.Y0)*w;v.y-=d;if(Math.abs(d)>1e-5)moved++;
  if(r<FORT.R1-4&&Math.abs(v.y-FORT.Y0)*FORT.S<2.6&&!braz.some(b=>Math.hypot(v.x-b[0],v.z-b[1])<b[2])){v.y=FORT.Y0-.02/FORT.S;if(N)N.setXYZ(i,up.x,up.y,up.z);flat++}
  v.applyMatrix4(Mi);P.setXYZ(i,v.x,v.y,v.z)}
 P.needsUpdate=true;if(N)N.needsUpdate=true;G.computeBoundingSphere();G.computeBoundingBox();return {flat,moved}}
// a fine tiling grain added to a material up close (the 4096 maps are stretched over a titan-sized fortress): breaks up the blur under your feet
function detailTex(){if(AB.detT)return AB.detT;AB.seed=515;const t=cvTex(512,512,(g,w,h)=>{noiseImg(g,w,h,[128,128,128],60,3);const id=g.getImageData(0,0,w,h),d=id.data;
  for(let k=0;k<140;k++){let x=srnd()*w,y=srnd()*h,a=srnd()*6.28;g.strokeStyle='rgba(30,30,30,'+(.2+srnd()*.35)+')';g.lineWidth=.6+srnd()*1.6;g.beginPath();g.moveTo(x,y);for(let s=0;s<6;s++){a+=(srnd()-.5)*1.2;x+=Math.cos(a)*(6+srnd()*12);y+=Math.sin(a)*(6+srnd()*12);g.lineTo(x,y)}g.stroke()}},1,false);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;AB.detT=t;return t}
function addDetail(m,scale,amt){const det=detailTex();m.userData.det={value:det};const prev=m.onBeforeCompile;
 m.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);sh.uniforms.tDet=m.userData.det;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tDet;varying vec3 vWP;').replace('#include <map_fragment>','#include <map_fragment>\n{float dd=clamp(1.-length(vWP-cameraPosition)/260.,0.,1.);float dt=texture2D(tDet,vWP.xz/'+scale.toFixed(2)+').r*.6+texture2D(tDet,vWP.xz/'+(scale*.31).toFixed(2)+').r*.4;diffuseColor.rgb*=mix(1.,.55+dt*.9,'+amt.toFixed(2)+'*dd);}')};
 const key=(m.customProgramCacheKey?m.customProgramCacheKey():'')+'|det'+scale;m.customProgramCacheKey=()=>key;m.needsUpdate=true}
// ---- ROCK SKIN: close-up stone detail for the fortress, the island and every rock of the realm. The purchased diorama is a small model blown up
// to arena size, so its own texture smears; this lays real stone over it in world space (tri-planar, no stretching on walls): pitted, cracked,
// ridged rock in three sizes (great slabs far away, chisel-sized grain up close), with its own surface relief and soot in the cracks.
function rockTex(){if(AB.rockT)return AB.rockT;const N=1024;let sd=4242;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;
 const P=128,lat=new Float32Array(P*P);for(let i=0;i<P*P;i++)lat[i]=rr();
 const vn=(x,y,f)=>{x*=f;y*=f;const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=((xi%f)+f)%f,b=((yi%f)+f)%f,a1=(a+1)%f,b1=(b+1)%f;return lat[b*P+a]*(1-u)*(1-v)+lat[b*P+a1]*u*(1-v)+lat[b1*P+a]*(1-u)*v+lat[b1*P+a1]*u*v};
 const G=11,cells=[];for(let j=0;j<G;j++)for(let i=0;i<G;i++)cells.push([(i+.1+rr()*.8)/G,(j+.1+rr()*.8)/G]);
 const H=new Float32Array(N*N),A=new Float32Array(N*N);
 for(let py=0;py<N;py++)for(let px=0;px<N;px++){const x=px/N,y=py/N;
  const f=vn(x,y,4)*.42+vn(x,y,8)*.24+vn(x,y,16)*.14+vn(x,y,32)*.09+vn(x,y,64)*.06+vn(x,y,128)*.05;
  const rg=(1-Math.abs(vn(x,y,8)*2-1))*.55+(1-Math.abs(vn(x+.3,y+.7,16)*2-1))*.45;
  const wx=x+(vn(x,y,16)-.5)*.03,wy=y+(vn(x+.5,y+.2,16)-.5)*.03;let d1=9,d2=9;const ci=Math.floor(wx*G),cj=Math.floor(wy*G);
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ii=ci+di,jj=cj+dj,C=cells[((jj%G+G)%G)*G+((ii%G+G)%G)];const cx=C[0]+Math.floor(ii/G),cy=C[1]+Math.floor(jj/G),d=Math.hypot(wx-cx,wy-cy);if(d<d1){d2=d1;d1=d}else if(d<d2)d2=d}
  // only some of the cell edges are real cracks (gated by noise along them), of varying width; pits are rare
  const cw=.03+.05*vn(x+.13,y+.71,16),crack=Math.max(0,1-((d2-d1)*G)/cw)*Math.min(1,Math.max(0,(vn(x+.4,y+.9,8)-.42)*4)),pit=Math.max(0,vn(x,y,96)-.8)*2.4;
  const h=f*.62+rg*.3-crack*.42-pit*.25;H[py*N+px]=h;A[py*N+px]=.5+(f-.5)*.55+(rg-.5)*.18-crack*.22-pit*.12+(vn(x,y,256)-.5)*.08}
 let mn=9,mx=-9;for(let i=0;i<N*N;i++){mn=Math.min(mn,H[i]);mx=Math.max(mx,H[i])}const sp=1/(mx-mn);
 const da=new Uint8Array(N*N*4),dn=new Uint8Array(N*N*4),K=5.5;
 for(let py=0;py<N;py++)for(let px=0;px<N;px++){const i=py*N+px,o=i*4,h=(H[i]-mn)*sp;
  const hx=(H[py*N+((px+1)%N)]-H[py*N+((px+N-1)%N)])*sp,hy=(H[((py+1)%N)*N+px]-H[((py+N-1)%N)*N+px])*sp;let nx=-hx*K,ny=-hy*K,nz=1;const l=Math.hypot(nx,ny,nz);
  dn[o]=(nx/l*.5+.5)*255;dn[o+1]=(ny/l*.5+.5)*255;dn[o+2]=(nz/l*.5+.5)*255;dn[o+3]=255;
  const a=Math.max(0,Math.min(1,A[i]));da[o]=da[o+1]=da[o+2]=a*255;da[o+3]=h*255}
 const mk=d=>{const t=new THREE.DataTexture(d,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t};
 AB.rockT={a:mk(da),n:mk(dn)};return AB.rockT}
// lay the rock skin on a material (o: s0 giant / s1 / s2 grain sizes in world units, amt colour, nrm relief, cav soot in the cracks, fade grain
// distance; mapBias/mapK soften the model's colour map; grade {mean,k,lb,red,tint,blood} re-colours it as stone; nBias/nClean soften the model's
// normal map and fade its broken texels; ground {y0,y1,s1,s2,k,tint} for its floors; soot {y0,y1,k} blackens the heights; rough {base,cav,det,k};
// lava {s,k} burning veins)
function rockSkin(m,o){o=Object.assign({s0:70,s1:11,s2:2.6,amt:.85,nrm:.9,cav:.55,fade:150,mapBias:0,mapK:0,nBias:0},o||{});const T=rockTex();m.userData.rock=o;
 AB.rockTime=AB.rockTime||{value:0};const U={tRA:{value:T.a},tRN:{value:T.n},uRT:AB.rockTime};const prev=m.onBeforeCompile;
 m.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);Object.assign(sh.uniforms,U);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRP;varying vec3 vRN;').replace('#include <begin_vertex>','#include <begin_vertex>\n{vec4 rkp=vec4(transformed,1.0);vec3 rkn=objectNormal;\n#ifdef USE_INSTANCING\nrkp=instanceMatrix*rkp;rkn=mat3(instanceMatrix)*rkn;\n#endif\nvRP=(modelMatrix*rkp).xyz;vRN=normalize(mat3(modelMatrix)*rkn);}');   // (instanced rocks: their own place in the world)
  const F=v=>(+v).toFixed(3);let fs=sh.fragmentShader;
  // the model's own colour map is a mosaic of tiny patches (an AI-baked atlas): blown up to titan size it reads as noise, so most of it is taken
  // from a softer mip level (its broad colours stay: blood, soot, the paving disc) and the sharp detail comes from the stone below instead
  // (the includes are only expanded after this hook, so the colour-map stage is written out here in full when it needs changing)
  let mf='#include <map_fragment>';if(o.mapK>0||o.grade)mf=THREE.ShaderChunk.map_fragment;
  if(o.mapK>0)mf=mf.replace('vec4 texelColor = texture2D( map, vUv );','vec4 texelColor = mix( texture2D( map, vUv ), texture2D( map, vUv, '+F(o.mapBias)+' ), '+F(o.mapK)+' );');
  if(o.grade){const g=o.grade;mf=mf.replace('diffuseColor *= texelColor;','{vec3 tc=texelColor.rgb;'+(g.lb?'vec3 tl=mapTexelToLinear(texture2D(map,vUv,'+F(g.lb)+')).rgb;':'vec3 tl=tc;')+
   'float L=dot(tl,vec3(.299,.587,.114)),Ln=clamp(L/'+F(g.mean)+',0.,2.2);float red=clamp((tc.r-max(tc.g,tc.b))/max(dot(tc,vec3(.299,.587,.114)),.004)*1.2-.35,0.,1.)*smoothstep(.02,.06,dot(tc,vec3(.299,.587,.114)));\n'+
   ' vec3 st=vec3('+g.tint.map(F).join(',')+')*mix(1.,Ln,'+F(g.k)+');st=mix(st,vec3('+g.blood.map(F).join(',')+')*mix(1.,Ln,.5),red*'+F(g.red)+');diffuseColor.rgb*=st;}')}
  if(mf.indexOf('texture2D( map')>=0&&o.mapK>0&&mf.indexOf(', '+F(o.mapBias)+' )')<0)console.warn('rockSkin: map bias not applied');
  if(o.grade&&o.grade.vc){const g=o.grade;fs=fs.replace('#include <color_fragment>','#include <color_fragment>\n#ifdef USE_COLOR\n{vec3 tc=vColor;float L=dot(tc,vec3(.299,.587,.114)),Ln=clamp(L/'+F(g.mean)+',0.,2.2);float red=clamp((tc.r-max(tc.g,tc.b))/max(L,.004)*1.2-.35,0.,1.)*smoothstep(.02,.06,L);\n'+
   ' vec3 st=vec3('+g.tint.map(F).join(',')+')*mix(1.,Ln,'+F(g.k)+');st=mix(st,vec3('+g.blood.map(F).join(',')+')*mix(1.,Ln,.5),red*'+F(g.red)+');diffuseColor.rgb=diffuse*st;}\n#endif')}
  // the model's normal map (written out here unless an earlier hook already did): softened, and its broken texels (pointing into the rock,
  // or averaging to nothing in the distance, which turned the fortress into black-and-white blotches) fade to flat
  if(fs.indexOf('#include <normal_fragment_maps>')>=0)fs=fs.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps);
  fs=fs.replace(/vec3 mapN = texture2D\( normalMap, (vUvN|vUv) \)\.xyz \* 2\.0 - 1\.0;/,(mm,uv)=>'vec3 mapN = texture2D( normalMap, '+uv+(o.nBias?', '+F(o.nBias):'')+' ).xyz * 2.0 - 1.0;'+
   (o.nClean?'{float nl=length(mapN);vec3 nn=mapN/max(nl,1e-4);float nv=smoothstep('+F(o.nClean[0])+','+F(o.nClean[1])+',nn.z)*smoothstep('+F(o.nClean[2])+','+F(o.nClean[3])+',nl);mapN=mix(vec3(0.,0.,1.),nn,nv);}':''));
  if(o.ground)fs=fs.replace('mapN.xy *= normalScale;','mapN.xy *= normalScale*(1.-rkG*.8);');
  fs=fs.replace('void main() {','void main() {\nfloat rkDet=1.,rkCav=1.;\n'+(o.ground?'float rkG=smoothstep(.5,.82,normalize(vRN).y)*(1.-smoothstep('+F(o.ground.y0)+','+F(o.ground.y1)+',vRP.y));':'float rkG=0.;'));
  fs=fs.replace('#include <common>','#include <common>\nuniform sampler2D tRA;uniform sampler2D tRN;uniform float uRT;varying vec3 vRP;varying vec3 vRN;\nvec3 rkW(vec3 n){vec3 w=pow(abs(n),vec3(4.0));return w/(w.x+w.y+w.z);}\nvec4 rkA(float s,vec3 w){return texture2D(tRA,vRP.zy/s)*w.x+texture2D(tRA,vRP.xz/s)*w.y+texture2D(tRA,vRP.xy/s)*w.z;}\nvec3 rkN(float s,vec3 w,vec3 n){vec3 tx=texture2D(tRN,vRP.zy/s).xyz*2.-1.,ty=texture2D(tRN,vRP.xz/s).xyz*2.-1.,tz=texture2D(tRN,vRP.xy/s).xyz*2.-1.;\n tx=vec3(tx.xy+n.zy,abs(tx.z)*n.x);ty=vec3(ty.xy+n.xz,abs(ty.z)*n.y);tz=vec3(tz.xy+n.xy,abs(tz.z)*n.z);return normalize(tx.zyx*w.x+ty.xzy*w.y+tz.xyz*w.z);}')
   .replace('#include <map_fragment>',mf+(o.ground?'\n{vec4 g1=texture2D(tRA,vRP.xz/'+F(o.ground.s1)+'),g2=texture2D(tRA,vRP.xz/'+F(o.ground.s2)+'+.31);vec3 gc=vec3('+o.ground.tint.map(F).join(',')+')*(g1.r*1.3+.35)*(g2.r*.9+.55);diffuseColor.rgb=mix(diffuseColor.rgb,gc,rkG*'+F(o.ground.k)+');}':'')+
    '\n{vec3 rn=normalize(vRN),rw=rkW(rn);float rdist=length(vRP-cameraPosition),rfa=clamp(1.-rdist/'+F(o.fade)+',0.,1.);\n vec4 a0=rkA('+F(o.s0)+',rw),a1=rkA('+F(o.s1)+',rw),a2=rkA('+F(o.s2)+',rw);\n float det=a0.r*.8+.6;det*=mix(1.,a1.r*1.25+.38,.9);det*=mix(1.,a2.r*1.1+.45,rfa*.85);\n float cav=mix(1.,smoothstep(.0,.5,a1.a)*.7+.3,'+F(o.cav)+');cav*=mix(1.,smoothstep(.0,.45,a2.a)*.55+.45,rfa*'+F(o.cav)+');rkDet=det;rkCav=cav;\n'+
    (o.soot?' diffuseColor.rgb*=mix(1.,'+F(o.soot.k)+',smoothstep('+F(o.soot.y0)+','+F(o.soot.y1)+',vRP.y)*(.6+.4*a0.r));\n':'')+
    ' diffuseColor.rgb*=mix(vec3(1.),vec3(det*cav)*vec3(1.03,1.,.96),'+F(o.amt)+');}');
  if(o.rough)fs=fs.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor*mix(1.,'+F(o.rough.base)+'+'+F(o.rough.cav)+'*(1.-rkCav)-'+F(o.rough.det)+'*(rkDet-1.),'+F(o.rough.k)+'),.3,1.);');
  // the rock's own relief in world space (after the model's map, whether or not an earlier hook wrote that stage out)
  fs=fs.replace('#include <emissivemap_fragment>','{vec3 rn=normalize(vRN),rw=rkW(rn);float rdist=length(vRP-cameraPosition),rfa=clamp(1.-rdist/'+F(o.fade)+',0.,1.);\n vec3 wn=rkN('+F(o.s1)+',rw,rn);vec3 wn2=rkN('+F(o.s2)+',rw,rn);wn=normalize(mix(wn,normalize(wn+wn2-rn),rfa));\n'+
   (o.n0?' {vec3 w0=rkN('+F(o.s0)+',rw,rn);wn=normalize(wn+(w0-rn)*'+F(o.n0)+');}\n':'')+
   ' vec3 vg=normalize((viewMatrix*vec4(rn,0.)).xyz),vw=normalize((viewMatrix*vec4(wn,0.)).xyz);normal=normalize(normal+(vw-vg)*'+F(o.nrm)+');}\n#include <emissivemap_fragment>');
  // two sizes of burning vein: fine ones up close, great ones that still read from across the void
  if(o.lava)fs=fs.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec3 rn=normalize(vRN),rw=rkW(rn);vec4 l1=rkA('+F(o.lava.s)+',rw),l2=rkA('+F(o.lava.s*3.7)+',rw);float c1=1.-smoothstep(.02,.15,l1.a),c2=1.-smoothstep(.02,.13,l2.a);\n float g1=smoothstep(.42,.68,rkA('+F(o.lava.s*4.3)+',rw).r),g2=smoothstep(.4,.62,rkA('+F(o.lava.s*11.)+',rw).r);float pulse=.72+.28*sin(uRT*1.1+vRP.y*.021+vRP.x*.013);\n totalEmissiveRadiance+=vec3(1.,.3,.06)*max(c1*g1,c2*g2*1.35)*pulse*'+F(o.lava.k)+'*(1.-clamp(rn.y,0.,1.)*.6);}');
  sh.fragmentShader=fs};
 const key=(m.customProgramCacheKey?m.customProgramCacheKey():'')+'|rock2|'+JSON.stringify(o);m.customProgramCacheKey=()=>key;m.needsUpdate=true}
// a living flame: a camera-facing sheet with a shader. Warped noise rises through a flame envelope that is wide at the bowl and licks up into
// tongues; its temperature sets the colour (deep red at the ragged edges, orange, yellow, a white-hot heart low in the fire); every sheet has
// its own seed, so the layers of a brazier never move together
function flameMat(seed){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,uniforms:{uT:{value:0},uS:{value:seed||0},uI:{value:1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;uniform float uS;uniform float uI;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\n'+
 'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s/.97;}\n'+
 'void main(){vec2 p=vUv;float t=uT*1.15+uS*7.3;vec2 q=vec2(p.x*2.4+uS,p.y*1.7-t*1.7);float w=fbm(q+vec2(fbm(q*1.6+vec2(uS,t*.55))*1.3-.65,0.));\n'+
 ' float x=(p.x-.5)*2.,lick=(w-.5)*.6*p.y;float width=.8*(1.-p.y*.8)+.06;float shape=1.-smoothstep(width*.45,width,abs(x+lick));\n'+
 ' float f=shape*smoothstep(0.,.1,p.y)*clamp((1.-p.y)*1.5+(w-.5)*1.25-p.y*.25,0.,1.);f=clamp(f*1.7-(1.-w)*.6*p.y,0.,1.);\n'+
 ' float tp=f*(1.18-p.y*.75);vec3 c=mix(vec3(.5,.04,0.),vec3(1.,.33,.04),smoothstep(.08,.42,tp));c=mix(c,vec3(1.,.66,.2),smoothstep(.45,.8,tp));c=mix(c,vec3(1.,.93,.75),smoothstep(.86,1.12,tp));\n'+
 ' float a=f*uI;gl_FragColor=vec4(c*a*.8,a*.85);}'})}
// a soft curl of smoke for the top of a fire (canvas, made once)
function smokeTex(){if(AB.smokeT)return AB.smokeT;const N=128,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');let sd=31;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;
 for(let i=0;i<34;i++){const x=N/2+(rr()-.5)*N*.42,y=N/2+(rr()-.5)*N*.42,r=N*(.12+rr()*.2);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.22)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,6.283);g.fill()}
 const T=new THREE.CanvasTexture(c);AB.smokeT=T;return T}
// The purchased fortress's maps are a triangle-soup atlas (7450 islands, most a single triangle, ~15 texels each): blown up to arena size
// every triangle edge is a seam, and any blur (mip levels, distance) bleeds the patches into each other. On the towers and floors, whose
// triangles run in rows, that drew the horizontal stripes. So the atlas is read ONCE, at each triangle's centre, into vertex colours
// (smooth across the mesh, no seams, no mips), and the maps themselves are dropped: the stone's own detail comes from the rock skin.
function fortBakeColor(base){const G=base.geometry,U=G.attributes.uv,I=G.index,P=G.attributes.position,m=base.material,img=m.map&&m.map.image;if(!U||!I||!img||G.attributes.color)return 0;
 const N=2048,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');g.drawImage(img,0,0,N,N);const D=g.getImageData(0,0,N,N).data;
 const col=new Float32Array(P.count*3),cnt=new Float32Array(P.count),idx=I.array,lin=v=>Math.pow(v/255,2.2);let sum=0;
 for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],d=idx[t+2];const u=(U.getX(a)+U.getX(b)+U.getX(d))/3,v=(U.getY(a)+U.getY(b)+U.getY(d))/3;
  const px=Math.min(N-1,Math.max(0,Math.round(u*N))),py=Math.min(N-1,Math.max(0,Math.round(v*N))),o=(py*N+px)*4,r=lin(D[o]),gg=lin(D[o+1]),bb=lin(D[o+2]);sum+=r*.299+gg*.587+bb*.114;
  for(const i of [a,b,d]){col[i*3]+=r;col[i*3+1]+=gg;col[i*3+2]+=bb;cnt[i]++}}
 for(let i=0;i<P.count;i++){const k=cnt[i]||1;col[i*3]/=k;col[i*3+1]/=k;col[i*3+2]/=k}
 G.setAttribute('color',new THREE.BufferAttribute(col,3));AB.fortMean=sum/(idx.length/3);return idx.length/3}
// ---- his fortress: the courtyard is the arena; the gate and its spires tower behind him (attached as soon as the model has loaded)
function abyssAttachFort(){if(AB.fort||!TY.fort||!AB.G)return;const G=AB.G;
 if(TY.fort){const f=TY.fort,base=f.children[0];try{AB.flatInfo=fortFlatten(base)}catch(e){console.warn('World 3: courtyard',e)}
  f.scale.setScalar(FORT.S);f.rotation.set(0,-Math.PI/2,0);f.position.set(0,-FORT.Y0*FORT.S,-FORT.X0*FORT.S);
  const fm=base.material;fm.metalness=.02;fm.roughness=.92;fm.envMapIntensity=.42;fm.color.setRGB(1,1,1);
  let baked=0;try{baked=fortBakeColor(base)}catch(e){console.warn('World 3: fortress colour bake',e)}
  if(baked){const drop=[fm.map,fm.normalMap,fm.roughnessMap,fm.metalnessMap];fm.map=null;fm.normalMap=null;fm.roughnessMap=null;fm.metalnessMap=null;
   drop.forEach(t=>{if(!t)return;try{if(t.image&&t.image.close)t.image.close()}catch(e){}try{t.dispose()}catch(e){}});   // its three 4096 maps are never drawn now: free them (about 150 MB)
  fm.vertexColors=true;fm.onBeforeCompile=null;delete fm.customProgramCacheKey;fm.needsUpdate=true}else if(fm.normalMap)fm.normalScale.set(.34,.34);
  // (nClean: the file's normal map has broken texels, ~10% point into the rock; they made the black-and-white blotches all over the fortress)
  if(!fm.userData.rock)rockSkin(fm,baked?{s0:300,s1:52,s2:10,amt:.8,nrm:.9,n0:.35,cav:.38,fade:320,
   grade:{vc:1,mean:Math.max(.01,AB.fortMean||.05),k:.3,red:.5,tint:[.06,.036,.03],blood:[.16,.02,.012]},ground:{y0:12,y1:70,s1:9,s2:2.2,k:.88,tint:[.05,.037,.032]},rough:{base:.8,cav:.3,det:.3,k:1},soot:{y0:80,y1:400,k:.6}}:{s0:300,s1:52,s2:10,amt:.8,nrm:.75,cav:.38,fade:320,mapBias:1.6,mapK:.5,nBias:1.0,nClean:[.25,.6,.4,.75],
   grade:{mean:.05,k:.25,lb:4,red:.5,tint:[.06,.036,.03],blood:[.16,.02,.012]},ground:{y0:12,y1:70,s1:9,s2:2.2,k:.88,tint:[.05,.037,.032]},rough:{base:.8,cav:.3,det:.3,k:1},soot:{y0:80,y1:400,k:.6}});
  f.traverse(o=>{o.layers.set(1);if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.frustumCulled=false}});G.add(f);AB.fort=f;AB.fortM=fm;
  // the same rock, far out in the void: other crags of his realm drifting among the stars
  AB.farF=[];[[-1250,-240,-1050,.9,46],[1450,140,-620,2.4,58],[760,520,-1700,4.0,34],[-1900,320,600,5.6,40]].forEach(([x,y,z,ry,sc])=>{const g=new THREE.Group();const m=new THREE.Mesh(base.geometry,fm);m.position.copy(base.position);m.quaternion.copy(base.quaternion);m.scale.copy(base.scale);m.layers.set(1);m.frustumCulled=false;g.add(m);g.position.set(x,y,z);g.rotation.y=ry;g.scale.setScalar(sc);G.add(g);AB.farF.push({g,y0:y,ph:ry})})}
 abyssStatues(G);try{abyssCrag(TY.fort,TY.fort.children[0])}catch(e){console.warn('World 3: the crag under the island',e)}try{updateHUD()}catch(e){}}
function buildAbyss(){
 // World 2 goes away; you, your pets, your mech and your powers stay
 while(world.children.length)world.remove(world.children[0]);
 enemies=[];bombs=[];projectiles=[];floaters=[];boss=null;
 Object.assign(L2,{minis:[],chickens:[],bullets:[],jaws:[],parts:[],rockets:[],spawnPts:[],endPortal:null,portal:null,golem:null,golemPre:null,portalPre:null,miniPre:null,hordeN:0,volc:[],glowL:null,ash:null,embers:null});
 if(L2.dome&&L2.dome.parent)L2.dome.parent.remove(L2.dome);
 if(hero)world.add(hero);if(typeof dogG!=='undefined'&&dogG)world.add(dogG);if(typeof breadG!=='undefined'&&breadG)world.add(breadG);
 heightAt=()=>0;PLAYR=AB.R-30;MAPSIZE=440;cam.far=7000;cam.updateProjectionMatrix();   // the fortress and the far islands of rock are far away
 const T=abyssTextures(),M=abyssMats();AB.rockM=rockMaterial(0x8a6a62);AB.lavaM=lavaShaderMat();AB.fallM=fallMat();AB.mats=M;AB.falls=[];AB.rifts=[];AB.fires=[];AB.lights=[];AB.pillars=[];AB.braz=[];
 const G=new THREE.Group();G.name='abyss';world.add(G);AB.G=G;const AR=AB.R;
 // ---- light: a warm key from behind you (it throws his shadow), the galaxy's heart rims him from behind the fortress, a soft fill from the camera
 SUN_DIR.set(.34,.62,.71).normalize();sun.color.setHex(0xffe0c8);sun.intensity=2.25;hemi.color.setHex(0x9a8890);hemi.groundColor.setHex(0x2a1008);hemi.intensity=.42;
 L2.fogK=.00055;L2.expK=1.0;if(S.fog){S.fog.color.setHex(0x140906);S.fog.density=L2.fogK*((typeof SET!=='undefined'&&SET.fogD)||1)}R.toneMappingExposure=((typeof SET!=='undefined'&&SET.exposure)||1)*L2.expK;
 AB.sky=abyssSky();S.add(AB.sky);if(typeof sky!=='undefined'&&sky)sky.visible=false;if(typeof water!=='undefined'&&water)water.visible=false;if(typeof waterMesh!=='undefined'&&waterMesh)waterMesh.visible=false;
 try{if(pmrem){const sc=new THREE.Scene();sc.add(AB.sky.clone());if(envRT)envRT.dispose();envRT=pmrem.fromScene(sc);S.environment=envRT.texture}}catch(e){}
 {const L=new THREE.DirectionalLight(0xffd6b4,1.9);L.position.copy(AB.sky.material.uniforms.uEcl.value).multiplyScalar(500);G.add(L);G.add(L.target);AB.rim=L}
 {const F=new THREE.DirectionalLight(0xd8d8ff,.38);G.add(F);G.add(F.target);AB.fill=F}
 AB.fort=null;abyssAttachFort();
 // ---- the paving of the courtyard where you fight (baked flagstones with real depth: c3_terrain.js; the old canvas paving stays as the fallback)
 {let gm=null;try{gm=courtyardMat(AR)}catch(e){console.warn('World 3: courtyard stone',e);gm=null}
  if(!gm){const C=courtyardTex();gm=new THREE.MeshStandardMaterial({map:C.map,roughness:.9,metalness:.03,envMapIntensity:.3,color:0x806058});C.map.repeat.set(AR*2.5/40,AR*2.5/40);
   try{gm.normalMap=normalFromColor(C.height,2.4);gm.normalScale.set(1,1)}catch(e){}
   const RR=(AR*1.25).toFixed(1);gm.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vLP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLP=position.xy;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vLP;float eh(float x){return fract(sin(x*127.1)*43758.5453);}float en(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(eh(i),eh(i+1.),f);}').replace('void main() {','void main() {\n{float a=atan(vLP.y,vLP.x)*9.549;float rr=length(vLP)/'+RR+';float nn=en(a)*.55+en(a*2.7+13.)*.3+en(a*7.3+5.)*.15;if(rr>.80+nn*.13)discard;}')};
   gm.customProgramCacheKey=()=>'w3ground'}
  const gd=new THREE.Mesh(new THREE.CircleGeometry(AR*1.25,160),gm);gd.rotation.x=-Math.PI/2;gd.position.y=.05;gd.receiveShadow=true;gd.layers.set(1);G.add(gd);AB.ground=gd}
 // ---- the Tyrant's rune circle burned into the courtyard (it heats from orange to blood red with the phases) and the wall of force at its edge
 AB.glowM=new THREE.MeshBasicMaterial({map:T.glow,color:0xff7a3a,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});const gl=new THREE.Mesh(new THREE.CircleGeometry(AR*.996,128),AB.glowM);gl.rotation.x=-Math.PI/2;gl.position.y=.12;gl.layers.set(1);G.add(gl);
 AB.barM=barrierMat();const bar=new THREE.Mesh(new THREE.CylinderGeometry(AR-1.5,AR-1.5,34,128,1,true),AB.barM);bar.position.y=17;bar.layers.set(1);G.add(bar);
 // ---- the braziers: real fire in their bowls (the two in the arena are solid: you cannot walk through them, and they stop his beam)
 FORT_BRAZ.forEach((b,i)=>{const p=fortToGame(b[0],b[3],b[1]),r=b[2]*FORT.S;const fl=new THREE.Group();fl.position.set(p.x,p.y,p.z);G.add(fl);const big=i<2,sz=big?1:.75;
  // a full fire across the bowl: a tall heart of flame, tongues around it (front and back layers), a halo of light
  const nF=big?10:7,bw=r*.62;for(let k=0;k<nF;k++){const c=k===0,hh=(c?84:38+((k*37)%29))*sz,ww=(c?52:24+((k*13)%15))*sz;const m=new THREE.Mesh(new THREE.PlaneGeometry(ww,hh),flameMat(i*3.1+k*1.7));m.geometry.translate(0,hh*.5-4*sz,0);
   if(!c){const a=(k-1)/(nF-1)*Math.PI*2;m.position.set(Math.cos(a)*bw*.55,0,Math.sin(a)*bw*.3+(k%2?-3:3))}m.layers.set(1);m.renderOrder=2;fl.add(m)}
  {const h=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:0xff7a2a,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));h.scale.set(170*sz,150*sz,1);h.position.y=26*sz;h.layers.set(1);fl.add(h);fl.userData.halo=h}
  fl.userData.bw=bw;fl.userData.sz=sz;
  {const sm=[];for(let k=0;k<7;k++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex(),color:0x1a1210,transparent:true,opacity:0,depthWrite:false}));sp.layers.set(1);sp.renderOrder=1;G.add(sp);sm.push({sp,t:k/7,ph:Math.random()*6.28})}fl.userData.smoke=sm;fl.userData.top=p.y+70*sz}
  AB.fires.push(fl);const L=new THREE.PointLight(0xff8a3a,big?3.2:2.2,big?260:180,1.5);L.position.set(p.x,p.y+22,p.z);G.add(L);AB.lights.push(L);
  if(i<2)AB.braz.push({x:p.x,z:p.z,r:r*.86,top:p.y,fl,L})});
 AB.fEmb=instancedParticles(new THREE.OctahedronGeometry(.32,0),new THREE.MeshBasicMaterial({color:0xffa04a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),260);G.add(AB.fEmb);AB.fEmbS=[];for(let i=0;i<260;i++)AB.fEmbS.push({f:i%AB.fires.length,t:Math.random(),v:.25+Math.random()*.5,ox:0,oz:0,sw:Math.random()*6});
 // ---- deep red rifts torn in the sky
 for(let i=0;i<3;i++){const a=-Math.PI/2+sr(-1.1,1.1)+(i-1)*.6,d=1500,el=sr(.2,.5);const m=new THREE.Mesh(new THREE.PlaneGeometry(sr(70,120),sr(380,620)),riftMat());m.position.set(Math.cos(a)*d,d*Math.sin(el)+80,Math.sin(a)*d);m.lookAt(0,m.position.y*.6,0);m.rotation.z+=sr(-.6,.6);m.layers.set(1);G.add(m);AB.rifts.push(m)}
 // ---- embers rising off the courtyard, dust motes in the starlight, rocks drifting round the fortress
 AB.emb=instancedParticles(new THREE.OctahedronGeometry(.16,0),new THREE.MeshBasicMaterial({color:0xff8a3a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),180);G.add(AB.emb);AB.embS=[];for(let i=0;i<180;i++)AB.embS.push({t:Math.random(),x:0,z:0,v:.4+Math.random()*.8,ok:false});
 {const n=900,pos=new Float32Array(n*3),col=new Float32Array(n*3);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,r=120+Math.random()*700,y=-160+Math.random()*420;pos[i*3]=Math.cos(a)*r;pos[i*3+1]=y;pos[i*3+2]=Math.sin(a)*r;const v=Math.random()<.4;col[i*3]=v?.85:1;col[i*3+1]=v?.55:.62;col[i*3+2]=v?.55:.32}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));const pm=new THREE.Points(g,new THREE.PointsMaterial({size:1.5,vertexColors:true,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));pm.layers.set(1);G.add(pm);AB.motes=pm}
 {const n=90;let rg=null,dm=AB.rockM;try{rg=new THREE.SphereGeometry(1,28,18);const P=rg.attributes.position,v=new V3(),c=new Float32Array(P.count*3);for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i);const k=.62+.62*NZ3.fbm(v.x*1.6+3,v.y*1.6+5,v.z*1.6+7,4)+.12*NZ3.rdg(v.x*3,v.y*3,v.z*3,2);v.multiplyScalar(k);P.setXYZ(i,v.x,v.y,v.z);const b=.5+.5*Math.sin(v.y*5+v.x*2);c[i*3]=.05+.04*b;c[i*3+1]=.035+.02*b;c[i*3+2]=.03+.015*b}
   rg.setAttribute('color',new THREE.BufferAttribute(c,3));rg.computeVertexNormals();dm=cragMat()}catch(e){rg=null}   // drifting boulders of the same stone as the island
  if(!rg){rg=new THREE.IcosahedronGeometry(1,1);const P=rg.attributes.position,v=new V3(),seen=new Map();for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i);const key=v.x.toFixed(3)+','+v.y.toFixed(3)+','+v.z.toFixed(3);let s=seen.get(key);if(s===undefined){s=.72+Math.random()*.5;seen.set(key,s)}v.multiplyScalar(s);P.setXYZ(i,v.x,v.y,v.z)}rg.computeVertexNormals();dm=AB.rockM}const im=new THREE.InstancedMesh(rg,dm,n);im.castShadow=false;im.layers.set(1);AB.deb=[];for(let i=0;i<n;i++)AB.deb.push({r:AR+150+Math.random()*420,a:Math.random()*6.28,y:-120+Math.random()*240,s:2+Math.random()*12,w:(Math.random()<.5?-1:1)*(.006+Math.random()*.016),sp:Math.random()*6});G.add(im);AB.debM=im}
 AB.bolts=[];AB.boltT=4;AB.boomT=5;AB.booms=[];AB.flash=0;fxInit(G);trailInit(G);
 // ---- minimap: the courtyard, the braziers, the rune rings
 try{const c=document.createElement('canvas');c.width=c.height=140;const g=c.getContext('2d');g.fillStyle='#0a0506';g.fillRect(0,0,140,140);const sc=140/MAPSIZE,cx=70;
  g.fillStyle='#2a1612';g.beginPath();g.arc(cx,cx,AR*1.25*sc,0,6.28);g.fill();g.fillStyle='#3a201a';g.beginPath();g.arc(cx,cx,AR*sc,0,6.28);g.fill();
  [.2,.5,.86].forEach(k=>{g.strokeStyle='#c8501e';g.lineWidth=1;g.beginPath();g.arc(cx,cx,AR*k*sc,0,6.28);g.stroke()});g.strokeStyle='#ff6a1a';g.beginPath();g.arc(cx,cx,AR*sc,0,6.28);g.stroke();
  AB.braz.forEach(b=>{g.fillStyle='#ff8a3a';g.beginPath();g.arc(cx+b.x*sc,cx+b.z*sc,Math.max(3,b.r*sc),0,6.28);g.fill()});g.fillStyle='#5a2a1a';g.fillRect(cx-60*sc*3,cx-AR*sc*1.35,120*sc*3,10);mapBase=g.getImageData(0,0,140,140)}catch(e){}
 AB.built=true}
// ---- the realm moving: storm, lightning, rifts, embers, debris, distant explosions
function boltLine(a,b){const pts=[a.clone()];const seg=14;for(let i=1;i<seg;i++){const p=new V3().lerpVectors(a,b,i/seg);p.x+=(Math.random()-.5)*22;p.z+=(Math.random()-.5)*22;p.y+=(Math.random()-.5)*8;pts.push(p)}pts.push(b.clone());
 const g=new THREE.BufferGeometry().setFromPoints(pts);const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xe8d8ff,transparent:true,blending:THREE.AdditiveBlending,toneMapped:false}));l.layers.set(1);return l}
function abyssSfx(kind,vol,delay,len0){try{const ac=audioCtx();if(!ac)return;const t0=ac.currentTime+(delay||0),V=vol||.5,out=ac.destination;
 // every sound of the realm is made here: thunder, impacts, his roar and grunts, the swing of his blade, falling rock, splitting floor, the drone of gravity, the shimmer of rifts
 const src=(len,fn)=>{const b=ac.createBuffer(1,Math.ceil(ac.sampleRate*len),ac.sampleRate),d=b.getChannelData(0);let l=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;l=l*.985+w*.06;d[i]=fn(i/d.length,l,w)}const s=ac.createBufferSource();s.buffer=b;s.start(t0);s.stop(t0+len+.05);return s};
 const osc=(type,f0,f1,len,fn)=>{const o=ac.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t0);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t0+len);if(fn)fn(o);o.start(t0);o.stop(t0+len+.05);return o};
 const chain=(node,ft,f0,f1,len,g0,g1,q)=>{const f=ac.createBiquadFilter();f.type=ft;f.frequency.setValueAtTime(f0,t0);if(f1!==f0)f.frequency.exponentialRampToValueAtTime(Math.max(10,f1),t0+len);if(q)f.Q.value=q;const g=ac.createGain();g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(g0,t0+Math.min(.04,len*.2));g.gain.linearRampToValueAtTime(g1||0,t0+len);node.connect(f);f.connect(g);g.connect(out);return g};
 const dist=(node,k)=>{const ws=ac.createWaveShaper(),c=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*k)}ws.curve=c;node.connect(ws);return ws};
 if(kind==='thunder'||kind==='boom'){const len=kind==='thunder'?2.6:1.4;const s=src(len,(k,l)=>l*Math.pow(1-k,kind==='thunder'?1.6:2.4)*(kind==='thunder'?(1+Math.sin(k*len*ac.sampleRate/900)*.4):1));chain(s,'lowpass',kind==='thunder'?420:260,kind==='thunder'?420:260,len,V*3,0)}
 else if(kind==='whoosh'){const len=.55;const s=src(len,(k,l,w)=>w*Math.pow(Math.sin(k*Math.PI),1.5));chain(s,'bandpass',260,2200,len,V*1.6,0,1.1)}
 else if(kind==='roar'||kind==='grunt'){const g=kind==='grunt',len=g?.42:1.5;const o=osc('sawtooth',g?82:56,g?44:38,len,o=>{if(!g)o.frequency.linearRampToValueAtTime(74,t0+.3);const lfo=ac.createOscillator();lfo.frequency.value=g?31:21;const lg=ac.createGain();lg.gain.value=g?5:9;lfo.connect(lg);lg.connect(o.frequency);lfo.start(t0);lfo.stop(t0+len)});
  chain(dist(o,g?3:4.5),'lowpass',g?700:980,g?240:300,len,V*(g?1.1:1.5),0);const s=src(len,(k,l)=>l*Math.pow(Math.sin(k*Math.PI),g?1.2:.7));chain(s,'bandpass',g?240:170,g?140:110,len,V*(g?1.6:2.4),0,.8)}
 else if(kind==='whistle'){const len=1.25;const o=osc('sine',1900,380,len);chain(o,'lowpass',3200,900,len,V*.55,V*.15);const s=src(len,(k,l,w)=>w*(.25+.75*k));chain(s,'bandpass',1500,500,len,V*.7,0,2.2)}
 else if(kind==='crackle'){const len=1.1;const s=src(len,(k,l,w)=>(Math.random()<.035+.09*(1-k)?w:w*.08)*(1-k*.6));chain(s,'highpass',900,1800,len,V*1.5,0);const s2=src(len,(k,l)=>l*(1-k));chain(s2,'lowpass',200,120,len,V*1.4,0)}
 else if(kind==='drone'){const len=4.6;[38,38.7,76].forEach((f,i)=>{const o=osc('sine',f,f*.92,len);chain(o,'lowpass',200,160,len,V*(i<2?.9:.35),0)});const s=src(len,(k,l)=>l*Math.sin(k*Math.PI));chain(s,'lowpass',90,70,len,V*1.2,0)}
 else if(kind==='shimmer'){const len=1.7;[660,990,1320,1980].forEach((f,i)=>{const o=osc('sine',f*.96,f*1.02,len,o=>{const lfo=ac.createOscillator();lfo.frequency.value=4.5+i;const lg=ac.createGain();lg.gain.value=f*.012;lfo.connect(lg);lg.connect(o.frequency);lfo.start(t0);lfo.stop(t0+len)});chain(o,'highpass',500,500,len,V*.1,0)});const s=src(len,(k,l,w)=>w*Math.sin(k*Math.PI));chain(s,'bandpass',2400,4200,len,V*.5,0,1.5)}
 else if(kind==='charge'){const len=Math.max(.6,len0||2.4),v=V;const s=src(len,(k,l,w)=>w*(.2+.8*k));chain(s,'lowpass',180,5200,len,v*.9,v*.9);const o=osc('sawtooth',70,620,len);chain(dist(o,2.5),'lowpass',300,2400,len,v*.35,v*.35)}
 else if(kind==='step'){const len=.3;const s=src(len,(k,l)=>l*Math.pow(1-k,3));chain(s,'lowpass',150,90,len,V*2.6,0)}
 }catch(e){}}
function abyssTick(t,dt){if(!AB.built)return;
 AB.sky.material.uniforms.uT.value=t;AB.lavaM.uniforms.uT.value=t;if(AB.rockTime)AB.rockTime.value=t;AB.fallM.uniforms.uT.value=t;AB.rifts.forEach(m=>m.material.uniforms.uT.value=t);AB.barM.uniforms.uT.value=t;
 const er=Math.hypot(heroPos.x,heroPos.z);AB.barM.uniforms.uNear.value=sstep(AB.R-45,AB.R-12,er);
 if(AB.fill){const fd=AB._fd||(AB._fd=new V3());cam.getWorldDirection(fd);AB.fill.position.copy(cam.position).addScaledVector(fd,-40);AB.fill.position.y+=30;AB.fill.target.position.copy(cam.position).addScaledVector(fd,80);AB.fill.target.updateMatrixWorld()}
 {const tk=AB.teleT&&t-AB.teleT<.25?1:0;AB.runeDim=(AB.runeDim||0)+(tk-(AB.runeDim||0))*Math.min(1,dt*6);AB.glowM.opacity=(.62+.18*Math.sin(t*1.3))*(1-.65*AB.runeDim)}AB.fires.forEach((f,i)=>{const fk=f.userData.flare?Math.max(0,1-(t-f.userData.flare)/1.2):0;f.lookAt(cam.position.x,f.position.y,cam.position.z);
  if(f.userData.smoke){const sz=f.userData.sz;f.userData.smoke.forEach(q=>{q.t+=dt*.11;if(q.t>1)q.t-=1;const k=q.t,y=f.userData.top-30*sz+k*190*sz;q.sp.position.set(f.position.x+Math.sin(t*.4+q.ph)*10*k*sz+k*k*40*sz,y,f.position.z+Math.cos(t*.33+q.ph)*10*k*sz+k*k*18*sz);const sc=(30+k*110)*sz;q.sp.scale.set(sc,sc,1);q.sp.material.opacity=Math.sin(k*Math.PI)*.42;q.sp.material.rotation=q.ph+t*.05})}f.children.forEach((c,k)=>{if(c.isSprite){c.material.opacity=(.36+.08*Math.sin(t*9+i)+.05*Math.sin(t*23+i*2))*(1+fk*.8);return}c.material.uniforms.uT.value=t;c.material.uniforms.uI.value=1+fk*1.2;const s=1+fk*.9;c.scale.set(s,s*(1+fk*.5),s)})});
 if(AB.fEmb){const im=AB.fEmb;AB.fEmbS.forEach((e,j)=>{const f=AB.fires[e.f];if(!f){im.userData.put(j,0,-99,0,0,0);return}e.t+=dt*e.v*(f.userData.flare&&t-f.userData.flare<1.2?2.2:1);if(e.t>1){e.t=0;const a=Math.random()*6.28,rr=Math.random()*f.userData.bw*.7;e.ox=Math.cos(a)*rr;e.oz=Math.sin(a)*rr;e.v=.25+Math.random()*.5}
   const sz=f.userData.sz,y=f.position.y+e.t*120*sz,dr=e.t*e.t*18*sz;im.userData.put(j,f.position.x+e.ox+Math.sin(t*1.3+e.sw)*dr,y,f.position.z+e.oz+Math.cos(t*1.1+e.sw)*dr,(1.4-e.t)*1.2*sz,1-e.t)});im.userData.flush()}
 AB.lights.forEach((L,i)=>{const f=AB.fires[i],fk=f&&f.userData.flare?Math.max(0,1-(t-f.userData.flare)/1.2):0;L.intensity=(i<2?3.2:2.2)*(1+Math.sin(t*17+i)*.1+Math.sin(t*5.3+i*2)*.08+fk*1.4)});
 if(AB.farF)AB.farF.forEach(F=>{F.g.position.y=F.y0+Math.sin(t*.05+F.ph)*30;F.g.rotation.y=F.ph+t*.004});
 // embers off the cracks around you
 const im=AB.emb;AB.embS.forEach((e,i)=>{e.t+=dt*e.v*.45;if(e.t>1||!e.ok){e.t=0;const a=Math.random()*6.28,r=4+Math.random()*60;e.x=heroPos.x+Math.cos(a)*r;e.z=heroPos.z+Math.sin(a)*r;e.ok=Math.hypot(e.x,e.z)<AB.R-2}
  if(e.ok)im.userData.put(i,e.x+Math.sin(e.t*8+i)*.6,.3+e.t*16,e.z+Math.cos(e.t*7+i)*.6,.7+Math.sin(e.t*Math.PI)*.9,1-e.t);else im.userData.put(i,0,-99,0,0,0)});im.userData.flush();
 // debris circling
 const M4=AB._m||(AB._m=new THREE.Matrix4()),Q=AB._q||(AB._q=new THREE.Quaternion()),E=AB._e||(AB._e=new THREE.Euler()),P=AB._p||(AB._p=new V3()),SC=AB._s||(AB._s=new V3());
 AB.deb.forEach((d,i)=>{d.a+=d.w*dt*(AB.debK||1);E.set(t*.1+d.sp,t*.13+d.sp*2,0);Q.setFromEuler(E);P.set(Math.cos(d.a)*d.r,d.y+Math.sin(t*.3+d.sp)*4,Math.sin(d.a)*d.r);SC.setScalar(d.s);M4.compose(P,Q,SC);AB.debM.setMatrixAt(i,M4)});AB.debM.instanceMatrix.needsUpdate=true;
 AB.motes.rotation.y=t*.004;try{cragFallTick(t,dt)}catch(e){if(!AB._cfErr){AB._cfErr=1;console.warn('crag fall',e)}}
 // lightning: a bolt from the storm to an island or across the sky, the clouds light up, thunder follows
 AB.boltT-=dt;if(AB.boltT<=0){AB.boltT=2+Math.random()*5;const a=Math.random()*Math.PI*2,d=250+Math.random()*450;const top=new V3(Math.cos(a)*d,380+Math.random()*120,Math.sin(a)*d),bot=new V3(Math.cos(a)*d*.9+(Math.random()-.5)*60,-30+Math.random()*90,Math.sin(a)*d*.9+(Math.random()-.5)*60);
  const l=boltLine(top,bot);G3().add(l);AB.bolts.push({l,t});AB.flash=1;abyssSfx('thunder',.35+Math.random()*.25,d/340)}
 AB.bolts=AB.bolts.filter(b=>{const k=t-b.t;b.l.material.opacity=Math.max(0,1-k/.25)*(Math.random()<.7?1:.3);if(k>.3){b.l.parent&&b.l.parent.remove(b.l);b.l.geometry.dispose();return false}return true});
 AB.flash=Math.max(0,AB.flash-dt*4.5);AB.sky.material.uniforms.uFlash.value=AB.flash;hemi.intensity=.9+AB.flash*.9;
 // distant explosions on the islands
 AB.boomT-=dt;if(AB.boomT<=0){AB.boomT=4+Math.random()*6;const a=Math.random()*Math.PI*2,d=300+Math.random()*300;const p=new V3(Math.cos(a)*d,-20+Math.random()*120,Math.sin(a)*d);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:Math.random()<.5?0xff8a3a:0xb070ff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));sp.position.copy(p);sp.layers.set(1);G3().add(sp);AB.booms.push({sp,t});abyssSfx('boom',.25,d/340)}
 AB.booms=AB.booms.filter(b=>{const k=t-b.t;const s=20+k*140;b.sp.scale.set(s,s,1);b.sp.material.opacity=Math.max(0,1-k/1.1);if(k>1.1){b.sp.parent&&b.sp.parent.remove(b.sp);b.sp.material.dispose();return false}return true})}
function G3(){return AB.G||world}

// ---------------------------------------------------------------- THE REALM, DRESSED: colossal statues, broken ramparts, the ruined bridge, rubble at the rim
// Everything here stands outside the ring you can walk in (the camera can never end up inside it), and is merged or instanced to stay cheap.
const PZ={pd:null};
// a cylinder from point a to point b (for posing limbs, horns, posts)
function limb(par,a,b,r0,r1,mat,seg){const d=new V3().subVectors(b,a),L=d.length();const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,L,seg||8),mat);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());m.castShadow=false;m.receiveShadow=true;par.add(m);return m}
// a colossal armoured guardian resting both hands on a greatsword planted in front of him
function colossus(par,x,y,z,s,ry,M,eyeM,v){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;g.scale.setScalar(s);par.add(g);const S=M.statue,D=M.stone,C=M.cape;
 const P=(x,y,z)=>new V3(x,y,z);
 addM(g,new THREE.CylinderGeometry(6.4,7.4,3.2,8),D,0,-1.6,0);addM(g,new THREE.CylinderGeometry(5.6,6.2,1,8),D,0,.5,0);
 addM(g,new THREE.TorusGeometry(6,.16,4,32),eyeM,0,-.4,0,0,Math.PI/2);   // a burning rune band round the plinth
 // legs, greaves, feet
 limb(g,P(-1.25,1.4,0),P(-1.2,7.6,0),1.25,.95,S);limb(g,P(1.25,1.4,0),P(1.2,7.6,0),1.25,.95,S);
 addM(g,new THREE.BoxGeometry(1.6,1.1,2.4),S,-1.25,1.55,.35);addM(g,new THREE.BoxGeometry(1.6,1.1,2.4),S,1.25,1.55,.35);
 addM(g,new THREE.BoxGeometry(1.2,1.6,.5),S,-1.25,5,1);addM(g,new THREE.BoxGeometry(1.2,1.6,.5),S,1.25,5,1);   // knee guards
 addM(g,new THREE.CylinderGeometry(1.8,3.0,3.6,8),S,0,8.6,0);   // the armoured skirt
 addM(g,new THREE.BoxGeometry(4.4,4.4,2.6),S,0,12.1,0);   // chest
 addM(g,new THREE.SphereGeometry(1.9,10,8),S,0,12.6,.8,0,0,0,1.08,.95,.62);   // breastplate
 addM(g,new THREE.BoxGeometry(3.4,.5,2.8),S,0,10.2,.05);   // belt
 addM(g,new THREE.SphereGeometry(1.5,10,8),S,-2.75,13.9,0,0,0,0,1,.78,1);addM(g,new THREE.SphereGeometry(1.5,10,8),S,2.75,13.9,0,0,0,0,1,.78,1);   // pauldrons
 // arms: shoulder -> elbow -> hands on the pommel
 limb(g,P(-2.8,13.4,.1),P(-2.5,11.0,1.5),.78,.66,S);limb(g,P(2.8,13.4,.1),P(2.5,11.0,1.5),.78,.66,S);
 limb(g,P(-2.5,11.0,1.5),P(-.62,12.3,3.25),.66,.56,S);limb(g,P(2.5,11.0,1.5),P(.62,12.3,3.25),.66,.56,S);
 addM(g,new THREE.BoxGeometry(.85,1,1),S,-.55,12.35,3.35);addM(g,new THREE.BoxGeometry(.85,1,1),S,.55,12.35,3.35);
 // head: helm, face plate, burning eye slits, swept horns (one broken on some of them)
 addM(g,new THREE.SphereGeometry(1.32,12,10),S,0,15.5,.15);addM(g,new THREE.BoxGeometry(1.7,1.5,.6),S,0,15.2,1.1);addM(g,new THREE.ConeGeometry(.5,1.4,6),S,0,16.9,.1);
 addM(g,new THREE.BoxGeometry(.5,.14,.12),eyeM,-.42,15.55,1.42);addM(g,new THREE.BoxGeometry(.5,.14,.12),eyeM,.42,15.55,1.42);
 [-1,1].forEach(sd=>{if(v===2&&sd>0){limb(g,P(1.1,16,0),P(2.0,17.0,-.3),.42,.26,S);return}limb(g,P(1.1*sd,16,0),P(2.4*sd,17.5,-.4),.42,.3,S);limb(g,P(2.4*sd,17.5,-.4),P(2.9*sd,19.6,-1.3),.3,.05,S)});
 // the greatsword, point down into the plinth (snapped on some)
 const bl=v===1?7.5:13;addM(g,new THREE.BoxGeometry(1.25,bl,.36),S,0,11.2-bl/2-.1,3.35);
 if(v===1)addM(g,new THREE.BoxGeometry(1.2,4.4,.36),S,1.6,.9,4.6,.4,0,1.35);   // the broken-off piece lying on the plinth
 addM(g,new THREE.BoxGeometry(5.2,.7,.8),S,0,11.25,3.35);addM(g,new THREE.CylinderGeometry(.3,.3,2.1,8),S,0,12.4,3.35);addM(g,new THREE.SphereGeometry(.55,10,8),S,0,13.6,3.35);
 addM(g,new THREE.BoxGeometry(.24,bl*.7,.1),eyeM,0,11.2-bl*.4,3.56);   // the fuller glows
 // the cape hanging down his back
 const cp=new THREE.Mesh(new THREE.CylinderGeometry(3.0,4.6,12.4,14,1,true,Math.PI-1.15,2.3),C);cp.position.set(0,7.8,-.35);g.add(cp);
 // cracks of light across him
 addM(g,new THREE.BoxGeometry(.12,2.6,.1),eyeM,-1.2,12.2,1.33,0,0,.4);addM(g,new THREE.BoxGeometry(.1,1.8,.1),eyeM,1.5,8.6,1.6,0,0,-.3);
 g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.layers.set(1)}});try{mergeStaticG(g)}catch(e){}g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.layers.set(1)}});return g}
// a stretch of broken fortress wall with crenellations and a gap blown through it
function rampart(par,x,y,z,len,h,ry,M){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;par.add(g);const D=M.stone;const gapA=sr(.3,.6),gapW=sr(.12,.22);
 const n=Math.round(len/4);for(let i=0;i<n;i++){const f=i/n;if(f>gapA&&f<gapA+gapW)continue;const hh=h*(f>gapA-.12&&f<gapA+gapW+.12?sr(.45,.8):sr(.92,1.05));
  addM(g,new THREE.BoxGeometry(4.1,hh,3.6),D,-len/2+i*4+2,hh/2,0,0,0,sr(-.02,.02));if(hh>h*.9&&i%2===0)addM(g,new THREE.BoxGeometry(2.2,2.4,3.8),D,-len/2+i*4+2,hh+1.2,0)}
 for(let i=0;i<7;i++){addM(g,new THREE.DodecahedronGeometry(sr(1,2.4),0),D,-len/2+len*(gapA+gapW/2)+sr(-5,5),sr(.4,1.2),sr(-4,4),sr(0,3),sr(0,3))}   // rubble in the breach
 for(let i=0;i<3;i++){addM(g,new THREE.BoxGeometry(.9,2.4,.4),M.glowO,-len/2+sr(2,len-2),sr(3,h-3),1.85)}   // embers glowing in the arrow slits
 g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.layers.set(1)}});try{mergeStaticG(g)}catch(e){}g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.layers.set(1)}});return g}
// the ruined bridge the Tyrant once crossed: from the arena's rim toward his fortress, broken in two places
function ruinBridge(par,M){const AR=AB.R;const dx=-110,dz=-520+AR;const a=Math.atan2(dx,dz);const g=new THREE.Group();g.position.set(Math.sin(a)*(AR+3),-1.4,Math.cos(a)*(AR+3));g.rotation.y=a;par.add(g);const D=M.stone;
 const SEG=9,L=17,W=15;const posts=[];
 for(let i=0;i<SEG;i++){const z0=i*L+L/2;if(i===4||i===6)continue;const drop=i===5?{y:-7,rx:.22,rz:-.08}:i===7?{y:-16,rx:-.3,rz:.12}:i===8?{y:-30,rx:.5,rz:-.2}:{y:0,rx:0,rz:0};
  const s=new THREE.Group();s.position.set(0,drop.y,z0);s.rotation.set(drop.rx,0,drop.rz);g.add(s);
  addM(s,new THREE.BoxGeometry(W,2.2,L-.6),D,0,0,0);addM(s,new THREE.BoxGeometry(W*.9,.3,L-1),M.obs,0,1.2,0);   // deck and a dark worn path
  [-1,1].forEach(sd=>{addM(s,new THREE.BoxGeometry(1.4,1.4,L-.6),D,sd*(W/2-.5),1.8,0);for(let k=0;k<3;k++)posts.push([s,sd*(W/2-.5),3.6,-L/2+3+k*(L-6)/2])});
  if(i%2===0&&drop.y===0){addM(g,new THREE.BoxGeometry(W*.7,90,6),D,0,-46,z0+L/2-3);addM(g,new THREE.BoxGeometry(W*.9,3,8),D,0,-2.6,z0+L/2-3)}}   // piers down into the abyss
 const pg=new THREE.CylinderGeometry(.45,.6,3.2,6);posts.forEach(([s,x,y,z])=>{const m=new THREE.Mesh(pg,D);m.position.set(x,y,z);m.castShadow=false;s.add(m)});
 // a lantern post with a cold flame at the near end
 [-1,1].forEach(sd=>{addM(g,new THREE.CylinderGeometry(.6,.8,9,6),D,sd*(W/2-.5),5.5,2);addM(g,new THREE.SphereGeometry(.9,10,8),M.glowV,sd*(W/2-.5),10.6,2)});
 g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.layers.set(1)}});g.children.forEach(c=>{if(c.isGroup)try{mergeStaticG(c)}catch(e){}});try{mergeStaticG(g)}catch(e){}g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.layers.set(1)}});AB.bridge=g;return g}
function abyssPolish(G){const M=AB.mats,AR=AB.R;AB.seed=4242;
 M.cape=new THREE.MeshStandardMaterial({color:0x6a5a70,map:abyssTextures().rockL,roughness:.92,flatShading:true,side:THREE.DoubleSide});
 // the colossi's eyes and runes burn with the arena's runes (violet -> orange -> red, then out when he falls)
 AB.eyeM=new THREE.MeshBasicMaterial({color:0xb060ff,toneMapped:false});
 // four colossal guardians on rock pillars rising out of the abyss, on the diagonals, all facing the arena
 AB.colossi=[];[[.785,0],[2.356,1],[3.927,2],[5.498,0]].forEach(([a,v],i)=>{const d=AR+88,x=Math.cos(a)*d,z=Math.sin(a)*d;const I=island(G,x,-9,z,48,230,880+i,null);
  const c=colossus(I,0,1.4,0,6.2,Math.atan2(-x,-z)-0,M,AB.eyeM,v);AB.colossi.push(c)});
 // broken ramparts on floating crags between them
 [[.2,AR+118,-6,34],[1.55,AR+104,8,30],[3.1,AR+126,-14,40],[4.75,AR+110,4,32]].forEach(([a,d,y,len],i)=>{const x=Math.cos(a)*d,z=Math.sin(a)*d;const I=island(G,x,y,z,len*.75,len*1.8,920+i,(g,rr)=>{rampart(g,0,1.4,0,len,sr(13,18),Math.atan2(-x,-z)+Math.PI/2,M);tower(g,len*.45,1.4,sr(-4,4),sr(26,38),sr(4,5.5),M)})});
 // the ruined bridge toward his fortress
 ruinBridge(G,M);
 // rubble along the rim, outside the barrier (one instanced mesh)
 {const n=110;const im=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),AB.rockM,n);im.castShadow=false;im.receiveShadow=true;im.layers.set(1);const M4=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),P=new V3(),S=new V3();
  for(let i=0;i<n;i++){const a=srnd()*6.283,r=AR+sr(1,11);E.set(srnd()*3,srnd()*3,srnd()*3);Q.setFromEuler(E);const s=sr(.8,3.2);P.set(Math.cos(a)*r,s*.3-.4,Math.sin(a)*r);S.set(s,s*sr(.5,.9),s);M4.compose(P,Q,S);im.setMatrixAt(i,M4)}G.add(im);AB.rubble=im}
 PZ.pd={fx:[],hits:{}}}
// ---- the arena answers his blows: pillars near an impact shudder and shed stone, the statues' eyes flare
W3.pillarHit=function(x,z,r,pow){const t=now();(AB.pillars||[]).forEach(p=>{if(p.down)return;const d=Math.hypot(p.x-x,p.z-z);if(d>r)return;const a=pow*(1-d/r);if(!p.shk||a>p.shk.a*(1-(t-p.shk.t0)/.7)){p.shk={t0:t,a};p.rx0=p.rx0===undefined?p.g.rotation.x:p.rx0;p.rz0=p.rz0===undefined?p.g.rotation.z:p.rz0}
  if(a>.35&&PZ.pd){const n=Math.min(4,1+Math.round(a*3));for(let i=0;i<n;i++){const o=new THREE.Mesh(DEB.geo||(debris({fx:[],hits:{}},0,0,0,0),DEB.geo),DEB.mat);o.scale.setScalar(.5+Math.random()*1.1);o.position.set(p.x+(Math.random()-.5)*4,(p.h||30)*(.7+Math.random()*.3),p.z+(Math.random()-.5)*4);o.layers.set(1);world.add(o);
    (PZ.pd.deb=PZ.pd.deb||[]).push({o,vx:(Math.random()-.5)*6,vz:(Math.random()-.5)*6,vy:Math.random()*4,r:Math.random()*4,t0:t})}FXK.dust(p.x,(p.h||30)*.8,p.z,3,6)}});
 (AB.braz||[]).forEach(b=>{const d=Math.hypot(b.x-x,b.z-z);if(d<r+b.r)b.fl.userData.flare=t});AB.eyePulse=t};
function pillarsTick(t,dt){if(PZ.pd)debrisTick(PZ.pd,dt);(AB.pillars||[]).forEach(p=>{if(!p.shk||p.fall)return;const k=(t-p.shk.t0)/.7;if(k>=1){p.g.rotation.x=p.rx0;p.g.rotation.z=p.rz0;p.shk=null;return}const a=p.shk.a*(1-k)*.035;p.g.rotation.x=p.rx0+Math.sin(t*47)*a;p.g.rotation.z=p.rz0+Math.cos(t*41)*a});
 // the colossi's eyes follow the runes; they flare on big blows and go dark when he falls
 if(AB.eyeM&&AB.glowM){const c=AB.eyeM.color;c.copy(AB.glowM.color);const k=AB.eyePulse?Math.max(0,1-(t-AB.eyePulse)/.8):0;if(k>0)c.multiplyScalar(1+k*1.4);if(ENV.deathT>=0)c.multiplyScalar(Math.max(.05,1-(t-ENV.deathT-3.6)/3))}
 // nobody walks through a standing pillar
 // nor through a brazier; and he walks round them too
 if(W3.on&&!W3.cine)(AB.braz||[]).forEach(b=>{let dx=heroPos.x-b.x,dz=heroPos.z-b.z,d=Math.hypot(dx,dz),rr=b.r+1.6;if(d<rr&&d>.01){heroPos.x=b.x+dx/d*rr;heroPos.z=b.z+dz/d*rr}
  if(B.ty&&B.st!=='dead'){dx=B.px-b.x;dz=B.pz-b.z;d=Math.hypot(dx,dz);rr=b.r+9;if(d<rr&&d>.01&&B.y>-5){B.px=b.x+dx/d*rr;B.pz=b.z+dz/d*rr}}
  enemies.forEach(e=>{if(e.hp<=0)return;const ex=e.x-b.x,ez=e.z-b.z,ed=Math.hypot(ex,ez),er=b.r+1.2;if(ed<er&&ed>.01){e.x=b.x+ex/ed*er;e.z=b.z+ez/ed*er}})});
 if(W3.on&&!W3.cine)(AB.pillars||[]).forEach(p=>{if(p.down)return;const dx=heroPos.x-p.x,dz=heroPos.z-p.z,d=Math.hypot(dx,dz),rr=p.r+1.4;if(d<rr&&d>.01){heroPos.x=p.x+dx/d*rr;heroPos.z=p.z+dz/d*rr}})}
// big impacts kick the field of view out a touch (it eases back); the controls never change
W3.fovKick=0;W3.kick=function(v){W3.fovKick=Math.max(W3.fovKick,v)};
// ---------------------------------------------------------------- COLOSSAL STATUES: the Tyrant himself, carved in stone, kneeling on crags either side of his fortress
// His own sculpt is posed (on one knee, from his Hurt_3 animation), baked into a still mesh, simplified for distance and given a stone skin.
function tyBake(clip,time){const CL=TY.clips[clip];if(!CL)return null;const mx=TY.mixer;mx.stopAllAction();const a=mx.clipAction(CL);a.reset().play();a.time=time;mx.update(0);
 const g=TY.g,ps=g.position.clone(),qs=g.quaternion.clone(),ss=g.scale.clone();g.position.set(0,0,0);g.quaternion.identity();g.scale.setScalar(1);g.updateMatrixWorld(true);
 const P=[],U=[],I=[];let base=0;const v=new V3();
 TY.meshes.forEach(m=>{const G=m.geometry,pos=G.attributes.position,uv=G.attributes.uv,n=pos.count;
  if(m.isSkinnedMesh){m.skeleton.update();for(let i=0;i<n;i++){m.boneTransform(i,v);v.applyMatrix4(m.matrixWorld);P.push(v.x,v.y,v.z);U.push(uv?uv.getX(i):0,uv?uv.getY(i):0)}}
  else{for(let i=0;i<n;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);P.push(v.x,v.y,v.z);U.push(uv?uv.getX(i):0,uv?uv.getY(i):0)}}
  const ix=G.index;if(ix){for(let i=0;i<ix.count;i++)I.push(ix.getX(i)+base)}else{for(let i=0;i<n;i++)I.push(i+base)}base+=n});
 a.stop();g.position.copy(ps);g.quaternion.copy(qs);g.scale.copy(ss);g.updateMatrixWorld(true);return {P,U,I}}
// fewer triangles for a far-off statue: vertices that fall in the same small cell become one
function decimate(D,cell){const map=new Map(),rem=new Int32Array(D.P.length/3),P=[],U=[],C=[];
 for(let i=0;i<rem.length;i++){const x=D.P[i*3],y=D.P[i*3+1],z=D.P[i*3+2],k=Math.floor(x/cell)+','+Math.floor(y/cell)+','+Math.floor(z/cell);let j=map.get(k);
  if(j===undefined){j=C.length;map.set(k,j);C.push(0);P.push(0,0,0);U.push(D.U[i*2],D.U[i*2+1])}rem[i]=j;C[j]++;P[j*3]+=x;P[j*3+1]+=y;P[j*3+2]+=z}
 for(let j=0;j<C.length;j++){P[j*3]/=C[j];P[j*3+1]/=C[j];P[j*3+2]/=C[j]}
 const I=[];for(let t=0;t<D.I.length;t+=3){const a=rem[D.I[t]],b=rem[D.I[t+1]],c=rem[D.I[t+2]];if(a!==b&&b!==c&&a!==c)I.push(a,b,c)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();g.computeBoundingSphere();return g}
function stoneMat(){const m=new THREE.MeshStandardMaterial({color:0xa49488,map:TY.bodyM?TY.bodyM.map:null,roughness:.92,metalness:0,envMapIntensity:.45,normalMap:TY.bodyM?TY.bodyM.normalMap:null});m.normalScale.set(1.1,1.1);
 m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{float l=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(l)*vec3(1.05,.98,.92),.82);}')};m.customProgramCacheKey=()=>'w3stone';return m}
function abyssStatues(G){try{if(!TY.statueGeo){const D=tyBake('Hurt_3',1.25);if(!D)return;TY.statueGeo=decimate(D,.0065)}
  const geo=TY.statueGeo,mat=AB.stoneM||(AB.stoneM=stoneMat());AB.statues=[];
  [[-1,-372,-34,-238],[1,372,-34,-238]].forEach(([sd,x,y,z],i)=>{const I=island(G,x,y,z,74,260,960+i,null);const st=new THREE.Mesh(geo,mat);st.scale.set(sd*TY.SC*2.5,TY.SC*2.5,TY.SC*2.5);st.position.set(0,1.4,0);
   st.rotation.y=Math.atan2(-x,-z);st.castShadow=false;st.receiveShadow=false;st.frustumCulled=true;I.add(st);I.traverse(o=>o.layers.set(1));AB.statues.push(st)})}catch(e){console.warn('World 3: statues',e)}}
// ---------------------------------------------------------------- SOUND OF THE REALM: a low drone of the void, fire crackling in the braziers, and hooks for recorded sounds
// The game ships no recordings for World 3, so these are synthesised. Recorded files dropped into w3/audio/ (see W3SND) are used instead when present.
const W3SND={files:{roar:'roar.mp3',music:'music3.mp3',slam:'slam.mp3',beam:'beam.mp3',meteor:'meteor.mp3',chest:'chest.mp3'},buf:{},tried:false};
function sndLoad(){if(W3SND.tried)return;W3SND.tried=true;const ac=audioCtx();if(!ac)return;const base=(typeof W3BASE==='string'?W3BASE:'w3/')+'audio/';
 Object.keys(W3SND.files).forEach(k=>{fetch(base+W3SND.files[k]).then(r=>r.ok?r.arrayBuffer():null).then(b=>b?ac.decodeAudioData(b):null).then(d=>{if(d)W3SND.buf[k]=d}).catch(()=>{})})}
function sndPlay(k,vol){const b=W3SND.buf[k],ac=audioCtx();if(!b||!ac)return false;const s=ac.createBufferSource();s.buffer=b;const g=ac.createGain();g.gain.value=vol||1;s.connect(g);g.connect(ac.destination);s.start();return true}
const AMB={on:false,nodes:null};
function ambStart(){if(AMB.on)return;const ac=audioCtx();if(!ac)return;AMB.on=true;sndLoad();try{const T=ac.currentTime,out=ac.createGain();out.gain.setValueAtTime(0,T);out.gain.linearRampToValueAtTime(.055,T+4);out.connect(ac.destination);
  const o1=ac.createOscillator(),o2=ac.createOscillator();o1.type='sawtooth';o2.type='sawtooth';o1.frequency.value=41;o2.frequency.value=41.6;const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=170;lp.Q.value=4;
  const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=.07;lg.gain.value=60;lfo.connect(lg);lg.connect(lp.frequency);o1.connect(lp);o2.connect(lp);lp.connect(out);
  // a hiss of wind through the spires
  const nb=ac.createBuffer(1,ac.sampleRate*3,ac.sampleRate),d=nb.getChannelData(0);let l=0;for(let i=0;i<d.length;i++){l=l*.97+(Math.random()*2-1)*.03;d[i]=l}const ns=ac.createBufferSource();ns.buffer=nb;ns.loop=true;const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=420;bp.Q.value=.6;const ng=ac.createGain();ng.gain.value=.9;ns.connect(bp);bp.connect(ng);ng.connect(out);
  [o1,o2,lfo,ns].forEach(x=>x.start(T));AMB.nodes={out,stop:[o1,o2,lfo,ns],fire:null}}catch(e){AMB.on=false}}
function ambStop(){if(!AMB.on||!AMB.nodes)return;AMB.on=false;const ac=audioCtx();try{const T=ac.currentTime;AMB.nodes.out.gain.cancelScheduledValues(T);AMB.nodes.out.gain.setValueAtTime(AMB.nodes.out.gain.value,T);AMB.nodes.out.gain.linearRampToValueAtTime(0,T+1.5);AMB.nodes.stop.forEach(x=>x.stop(T+1.6))}catch(e){}AMB.nodes=null}
// fire crackle: little bursts of noise, louder the nearer you stand to a brazier
function ambTick(t,dt){if(!AMB.on)return;const ac=audioCtx();if(!ac||!AB.braz)return;let dmin=1e9;AB.braz.forEach(b=>{dmin=Math.min(dmin,Math.hypot(heroPos.x-b.x,heroPos.z-b.z)-b.r)});const v=clampN(1-dmin/90,0,1);
 if(v>.02&&Math.random()<dt*14){try{const T=ac.currentTime,len=.03+Math.random()*.06,b=ac.createBuffer(1,Math.ceil(ac.sampleRate*len),ac.sampleRate),dd=b.getChannelData(0);for(let i=0;i<dd.length;i++)dd[i]=(Math.random()*2-1)*Math.pow(1-i/dd.length,3);
   const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=900+Math.random()*1500;const g=ac.createGain();g.gain.value=.05*v*(.4+Math.random());s.connect(f);f.connect(g);g.connect(ac.destination);s.start(T)}catch(e){}}}
// ---- the island's underside. The courtyard and the fortress stand on a slab of rock; under it now hangs a mountain turned upside down:
// a rocky lip right under the slab's edge, then strata and ledges, ribs and gullies worn down its sides, veins of lava in its cracks,
// and spires of rock hanging from its belly, so from anywhere the island reads as a real piece of the world torn loose in the void.
// Its far sister islands get the same mountain under them.
const NZ3=(()=>{const P=new Uint8Array(512);let sd=1337;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;const p=[];for(let i=0;i<256;i++)p.push(i);
 for(let i=255;i>0;i--){const j=Math.floor(rr()*(i+1)),q=p[i];p[i]=p[j];p[j]=q}for(let i=0;i<512;i++)P[i]=p[i&255];
 const fd=t=>t*t*(3-2*t),h=(x,y,z)=>P[P[P[x&255]+(y&255)]+(z&255)]/255;
 const n=(x,y,z)=>{const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),u=fd(x-X),v=fd(y-Y),w=fd(z-Z);
  const a=h(X,Y,Z),b=h(X+1,Y,Z),c=h(X,Y+1,Z),d=h(X+1,Y+1,Z),e=h(X,Y,Z+1),f=h(X+1,Y,Z+1),g=h(X,Y+1,Z+1),k=h(X+1,Y+1,Z+1);
  return ((a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v)*(1-w)+((e*(1-u)+f*u)*(1-v)+(g*(1-u)+k*u)*v)*w};
 const fbm=(x,y,z,o)=>{let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=a*n(x*f+i*17.1,y*f+i*3.7,z*f+i*9.3);t+=a;f*=2.03;a*=.5}return s/t};
 const rdg=(x,y,z,o)=>{let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=a*(1-Math.abs(n(x*f+i*5.3,y*f+i*11.1,z*f+i*2.9)*2-1));t+=a;f*=2.1;a*=.5}return s/t};
 return {n,fbm,rdg}})();
function cragMat(){if(AB.cragM)return AB.cragM;const m=new THREE.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:.93,metalness:0,envMapIntensity:.25});
 rockSkin(m,{s0:420,s1:70,s2:15,amt:.85,nrm:.9,cav:.45,fade:700,lava:{s:70,k:2.4}});return AB.cragM=m}
function abyssCrag(f,base){if(AB.crag||!f||!base)return;const G=AB.G;f.updateMatrix();base.updateMatrix();const M=f.matrix.clone().multiply(base.matrix);const NZ=NZ3,o={NR:150,NM:480,detK:1,terr:.07,cavK:2.2,spN:22};
 // the slab's outline: its outermost rock and its lowest point, all the way round
 const P=base.geometry.attributes.position,v=new V3(),NA=180,rmax=new Float32Array(NA),ybot=new Float32Array(NA).fill(1e9),cnt=new Int32Array(NA);
 for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(M);if(v.y>30)continue;const a=Math.atan2(v.z,v.x),k=Math.min(NA-1,Math.floor((a+Math.PI)/(2*Math.PI)*NA)),r=Math.hypot(v.x,v.z);if(r>rmax[k])rmax[k]=r;if(v.y<ybot[k])ybot[k]=v.y;cnt[k]++}
 for(let k=0;k<NA;k++)if(!cnt[k]){let a=1;while(!cnt[(k-a+NA)%NA]&&a<NA)a++;let b=1;while(!cnt[(k+b)%NA]&&b<NA)b++;const ka=(k-a+NA)%NA,kb=(k+b)%NA,w=a/(a+b);rmax[k]=rmax[ka]*(1-w)+rmax[kb]*w;ybot[k]=ybot[ka]*(1-w)+ybot[kb]*w}
 const sm=(A,n)=>{for(let it=0;it<n;it++){const B=A.slice();for(let k=0;k<NA;k++)A[k]=(B[(k-1+NA)%NA]+B[k]*2+B[(k+1)%NA])/4}};sm(rmax,3);sm(ybot,4);
 let ravg=0;for(let k=0;k<NA;k++)ravg+=rmax[k]/NA;const Dh=ravg*1.55;AB.cragInfo={ravg,D:Dh};
 // the mountain: rings from the slab's edge down to the point of its belly (a fine mesh: terraces, lobes, ribs and gullies, fractures, grain)
 const NR=o.NR,NM=o.NM,cols=NM+1,pos=new Float32Array(cols*(NR+1)*3),col=new Float32Array(cols*(NR+1)*3),rad=new Float32Array(cols*(NR+1));
 const C1=[.03,.022,.02],C2=[.068,.03,.02],C3=[.085,.056,.034],C4=[.018,.015,.016],C5=[.05,.045,.043];
 const surf=(a,t,out)=>{const u=(a+Math.PI)/(2*Math.PI)*NA-.5,k=((Math.floor(u)%NA)+NA)%NA,k2=(k+1)%NA,w=u-Math.floor(u);
  const R=rmax[k]*(1-w)+rmax[k2]*w,yb=ybot[k]*(1-w)+ybot[k2]*w,ca=Math.cos(a),sa=Math.sin(a);
  let sh=t<.05?1+.02*Math.sin(t/.05*Math.PI*.5):1.02*Math.pow(1-(t-.05)/.95,.6);   // a lip that swells a little under the slab, then the long taper
  // terraces: the strata step in and out in uneven bands (sharper than a sine: a tilted sawtooth softened at its corners)
  const tb=t*9+NZ.n(ca*1.7+3,t*3,sa*1.7+3)*1.6,ph=tb-Math.floor(tb),stp=Math.pow(ph,3.5);sh*=1-o.terr*t*(stp-.35)*1.4;
  sh*=.8+.4*NZ.fbm(ca*1.4+7,t*2.4,sa*1.4+7,3);                        // great lobes and buttresses
  let r=Math.max(0,R*sh-3*(t<.02?1:0)),y=yb+8-Dh*t*(.86+.28*NZ.fbm(ca*1.1+2,0,sa*1.1+2,2));
  const x0=ca*r,z0=sa*r;const rib=NZ.rdg(x0*.028,y*.0045,z0*.028,4),gr=NZ.fbm(x0*.011,y*.011,z0*.011,4);
  const fn=NZ.fbm(x0*.034+9,y*.034,z0*.034+9,4),fr=Math.pow(NZ.rdg(x0*.07+3,y*.05,z0*.07+3,3),3),gn=NZ.fbm(x0*.14,y*.14,z0*.14,3);
  const env=Math.min(1,t*14)*(1-t*.5);r+=((rib-.55)*26+(gr-.5)*30+(fn-.5)*12+(fr-.2)*9*o.detK+(gn-.5)*4.5*o.detK)*env;r=Math.max(0,r);
  out[0]=ca*r;out[1]=y+(fn-.5)*6*Math.min(1,t*10);out[2]=sa*r;return {rib,gr,fr,r}};
 const o3=[0,0,0];
 for(let j=0;j<=NR;j++){const t=Math.pow(j/NR,1.12);for(let i=0;i<cols;i++){const a=((i%NM)+.5)/NM*2*Math.PI-Math.PI,q=surf(a,t,o3),idx=(j*cols+i)*3;pos[idx]=o3[0];pos[idx+1]=o3[1];pos[idx+2]=o3[2];rad[j*cols+i]=q.r;
  // strata colours: dark basalt, rust-red and ochre bands, wavering; darker and sootier toward the belly; fractures show paler rock
  const b=(o3[1]*.011+q.gr*1.6)%3,bb=b<0?b+3:b,band=bb<1?[C1,C2,bb]:bb<2?[C2,C3,bb-1]:[C3,C1,bb-2];const kk=band[2]*band[2]*(3-2*band[2]);
  const dk=(.62+.38*(1-t))*(.75+.5*q.rib);for(let c=0;c<3;c++){let cc=(band[0][c]*(1-kk)+band[1][c]*kk)*(1-t*.35)+C4[c]*t*.35;cc=cc*(1-q.fr*.35)+C5[c]*q.fr*.35;col[idx+c]=cc*dk}}}
 // cavity shade: a vertex sunk below its neighbours is darker, one standing proud of them catches light (worn edges)
 {const cv=new Float32Array(cols*(NR+1));for(let j=1;j<NR;j++)for(let i=0;i<cols;i++){const id=j*cols+i,il=j*cols+((i-1+NM)%NM),ir=j*cols+((i+1)%NM),iu=(j-1)*cols+i,id2=(j+1)*cols+i;cv[id]=rad[id]-(rad[il]+rad[ir]+rad[iu]+rad[id2])*.25}
  for(let j=0;j<=NR;j++)for(let i=0;i<cols;i++){const id=j*cols+i,s=Math.max(-1,Math.min(1,cv[id]*o.cavK/4)),m=s<0?1+s*.55:1+s*.35;for(let c=0;c<3;c++)col[id*3+c]*=m}}
 const ind=[];for(let j=0;j<NR;j++)for(let i=0;i<NM;i++){const a=j*cols+i,b=a+1,c=a+cols,d=c+1;ind.push(a,c,b,b,c,d)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setIndex(ind);geo.computeVertexNormals();
 // the seam column shares its normals so no line shows where the ring closes
 {const N=geo.attributes.normal;for(let j=0;j<=NR;j++){const a=j*cols,b=j*cols+NM;const nx=N.getX(a)+N.getX(b),ny=N.getY(a)+N.getY(b),nz=N.getZ(a)+N.getZ(b),l=Math.hypot(nx,ny,nz)||1;N.setXYZ(a,nx/l,ny/l,nz/l);N.setXYZ(b,nx/l,ny/l,nz/l)}}
 geo.computeBoundingSphere();
 const mat=cragMat(),mesh=new THREE.Mesh(geo,mat);mesh.layers.set(1);mesh.frustumCulled=false;mesh.receiveShadow=false;G.add(mesh);
 // spires of rock hanging from its belly: roots that flare up into the mountain (no caps to show), lumpy, bent, ringed with ledges; a few great
 // ones low down, many smaller ones all over
 const spireGeo=vv=>{const g=new THREE.CylinderGeometry(1,.015,1.4,18,40,true);g.translate(0,-.5+.2,0);const p=g.attributes.position,w=new V3();
  for(let i=0;i<p.count;i++){w.fromBufferAttribute(p,i);const k=-w.y,a=Math.atan2(w.z,w.x);const lump=NZ.fbm(Math.cos(a)*1.3+vv*7,k*4.5,Math.sin(a)*1.3+vv*3,4),ledge=.07*Math.sin(k*Math.PI*7+vv*2+lump*3),fr=Math.pow(NZ.rdg(Math.cos(a)*2.2+vv,k*6,Math.sin(a)*2.2,3),3);
   const kk=Math.max(-.2,k),s=(k<0?1+Math.pow(-k/.4,2)*.8:Math.pow(1-k,.85))*(.72+.6*lump)*(1+ledge*(1-Math.max(0,k)))*(1-fr*.12);const r=Math.hypot(w.x,w.z)||1e-6;w.x=w.x/r*s;w.z=w.z/r*s;
   w.x+=Math.sin(kk*2.6+vv)*.22*kk*kk;w.z+=Math.cos(kk*2.1+vv*2)*.14*kk*kk;p.setXYZ(i,w.x,w.y,w.z)}
  g.computeVertexNormals();const c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const k=Math.max(0,Math.min(1,-p.getY(i))),b=(.5+.5*Math.sin(k*19+vv));for(let q=0;q<3;q++)c[i*3+q]=((C1[q]*(1-b)+C2[q]*b)*(1-k*.5)+C4[q]*k*.5)*(.85+.3*NZ.n(i*.37,vv,k*9))}g.setAttribute('color',new THREE.BufferAttribute(c,3));return g};
 const SG=[spireGeo(0),spireGeo(1),spireGeo(2)];let sd=97;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;const sp=[];
 for(let i=0;i<4;i++){const a=i/4*6.28+rr()*.9,t=.76+rr()*.12;surf(a,t,o3);sp.push([o3[0]*.84,o3[1]+14,o3[2]*.84,Dh*(.36+rr()*.24),.15+rr()*.05])}   // the great ones under the belly
 {surf(0,.985,o3);sp.push([0,o3[1]+30,0,Dh*.5,.12])}   // and the root at its very point
 for(let i=0;i<o.spN;i++){const a=rr()*6.28,t=.38+rr()*.5;surf(a,t,o3);const h=40+rr()*120*(.3+t);sp.push([o3[0]*.9,o3[1]+h*.12,o3[2]*.9,h,.13+rr()*.09])}
 const Mx=new THREE.Matrix4(),Qx=new THREE.Quaternion(),Sx=new V3(),parts=[[],[],[]];sp.forEach((s2,i)=>{const h=s2[3],r=h*s2[4];Qx.setFromEuler(new THREE.Euler((rr()-.5)*.22,rr()*6.28,(rr()-.5)*.22));Sx.set(r,h,r);Mx.compose(new V3(s2[0],s2[1],s2[2]),Qx,Sx);parts[i%3].push(Mx.clone())});
 const sps=parts.map((L,vv)=>{const m=new THREE.InstancedMesh(SG[vv],mat,L.length);L.forEach((Mm,i)=>m.setMatrixAt(i,Mm));m.layers.set(1);m.frustumCulled=false;G.add(m);return m});
 AB.crag={mesh,sps};
 // the far islands: the same mountain under each (mapped from this island's space into theirs)
 const inv=f.matrix.clone().invert();(AB.farF||[]).forEach(F=>{const m=new THREE.Mesh(geo,mat);m.matrixAutoUpdate=false;m.matrix.copy(inv);m.layers.set(1);m.frustumCulled=false;F.g.add(m);
  sps.forEach((src,vv)=>{const s3=new THREE.InstancedMesh(SG[vv],mat,src.count);s3.instanceMatrix.copy(src.instanceMatrix);s3.matrixAutoUpdate=false;s3.matrix.copy(inv);s3.layers.set(1);s3.frustumCulled=false;F.g.add(s3)})})}
// ---- the courtyard where you fight: old flagstones of the Tyrant's keep, baked once on the graphics card into 2048 maps that tile every
// 48 paces: irregular slabs each at its own level and tilt, chipped and worn bevels, some split by cracks, grit and pebbles packed in the
// seams, mottled and stained stone. On the floor they get real depth (parallax: the seams sink in as you walk by), the stone's own grain up
// close, broad scorch and dust across the whole yard so the tiling never shows, and glowing fissures torn through it from the Tyrant's circle.
const CY={TILE:48,N:2048};
function cyBakePass(frag,uniforms,w,h,o){const rt=new THREE.WebGLRenderTarget(w,h,Object.assign({wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping,depthBuffer:false,stencilBuffer:false},o||{}));
 const mat=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:frag});
 const sc=new THREE.Scene(),q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);q.frustumCulled=false;sc.add(q);const prev=R.getRenderTarget(),ac=R.autoClear;R.autoClear=true;R.setRenderTarget(rt);R.render(sc,cam);R.setRenderTarget(prev);R.autoClear=ac;mat.dispose();q.geometry.dispose();return rt}
const CY_NOISE=`
vec2 hash2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
float hash1(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float vnoise(vec2 x,float P){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);float a=hash1(mod(i,P)),b=hash1(mod(i+vec2(1.,0.),P)),c=hash1(mod(i+vec2(0.,1.),P)),d=hash1(mod(i+vec2(1.,1.),P));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbmP(vec2 uv,float P0,int oct){float s=0.,a=.5,t=0.,P=P0;for(int i=0;i<6;i++){if(i>=oct)break;s+=a*vnoise(uv*P+float(i)*7.13,P);t+=a;P*=2.;a*=.5;}return s/t;}
`;
function courtyardBake(){if(AB.cyB)return AB.cyB;const N=tyLite()?1024:CY.N,px=new THREE.Vector2(1/N,1/N);
 // pass 1: the stones' height (16-bit, in red+green), the seams (blue), each stone's own number (alpha)
 const A=cyBakePass('precision highp float;varying vec2 vUv;uniform float uN;'+CY_NOISE+`
vec4 voro(vec2 uv,float N){vec2 x=uv*N,n=floor(x),f=fract(x),mg=vec2(0.),mr=vec2(0.);float md=8.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j)),o=.5+(hash2(mod(n+g,N))-.5)*.76,r=g+o-f;float d=dot(r,r);if(d<md){md=d;mr=r;mg=g;}}
 md=8.;for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){vec2 g=mg+vec2(float(i),float(j)),o=.5+(hash2(mod(n+g,N))-.5)*.76,r=g+o-f;if(dot(mr-r,mr-r)>.00001)md=min(md,dot(.5*(mr+r),normalize(r-mr)));}
 return vec4(md/N,hash1(mod(n+mg,N)+.17),mr/N);}
void main(){vec2 uv=vUv;vec4 v=voro(uv,uN);float e=v.x,id=v.y,cell=1./uN;vec2 toC=v.zw;
 vec2 td=hash2(vec2(id*91.7,id*13.3))-.5;float lvl=.78+.12*(hash1(vec2(id,3.1))-.5)*2.,tilt=dot(-toC/cell,td)*.07;
 float bw=cell*(.03+.06*fbmP(uv,32.,3));float bev=pow(smoothstep(0.,bw,e-cell*(.01+.012*fbmP(uv,48.,2))),.7);
 float chip=smoothstep(.56,.74,fbmP(uv,120.,3))*(1.-smoothstep(0.,bw*2.6,e));bev*=1.-chip*.3;   // chipped corners and edges
 float und=(fbmP(uv+id,8.,3)-.5)*.07,pit=smoothstep(.6,.8,fbmP(uv,96.,3))*.07,grain=(fbmP(uv,256.,2)-.5)*.03;
 float cr=0.;if(id>.6){vec2 cd=normalize(hash2(vec2(id*7.,id*3.))-.5),q=-toC;float w=dot(q,vec2(-cd.y,cd.x))+(fbmP(uv,64.,2)-.5)*cell*.3;cr=(1.-smoothstep(0.,cell*.014,abs(w)))*smoothstep(cell*.02,cell*.14,e);}
 float hs=(lvl+tilt+und-pit+grain)*bev-cr*.2;float seam=1.-smoothstep(cell*.004,cell*.03,e);float grit=.16+.14*fbmP(uv,128.,3)+.08*smoothstep(.7,.76,fbmP(uv,220.,2));
 float h=clamp(mix(hs,grit,seam*(1.-bev*.85)),0.,1.);float H=floor(h*65535.+.5),hi=floor(H/256.),lo=H-hi*256.;gl_FragColor=vec4(hi/255.,lo/255.,seam,id);}`,{uN:{value:8}},N,N,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false});
 const HD='uniform sampler2D tA;uniform vec2 px;float Hh(vec2 o){vec4 a=texture2D(tA,vUv+o*px);return (a.r*255.*256.+a.g*255.)/65535.;}';
 // pass 2: colour (stored as its square root, for clean darks) and roughness
 const C=cyBakePass('precision highp float;varying vec2 vUv;'+HD+CY_NOISE+`
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
void main(){vec4 a=texture2D(tA,vUv);float h=Hh(vec2(0.)),seam=a.b,id=a.a;
 float k=fract(id*13.7);vec3 base=k<.34?lin(vec3(.23,.18,.16)):k<.58?lin(vec3(.28,.17,.14)):k<.84?lin(vec3(.21,.2,.2)):lin(vec3(.29,.21,.16));base*=.78+.4*fract(id*91.3);
 float m1=fbmP(vUv,12.,3),m2=fbmP(vUv,64.,3),m3=fbmP(vUv,300.,2);base*=(.76+.48*m1)*(.88+.24*m2)*(.93+.14*m3);
 float st=smoothstep(.56,.8,fbmP(vUv+.3,4.,4));base=mix(base,base*vec3(.42,.2,.16),st*.6);
 float hl=(Hh(vec2(4.,0.))+Hh(vec2(-4.,0.))+Hh(vec2(0.,4.))+Hh(vec2(0.,-4.)))*.25;base*=1.+clamp((h-hl)*6.,-.25,.22);   // worn edges catch the light, hollows hold dirt
 vec3 grit=lin(vec3(.13,.11,.1))*(.55+.9*fbmP(vUv,180.,2));float peb=smoothstep(.68,.76,fbmP(vUv,220.,2));grit=mix(grit,lin(vec3(.42,.36,.31)),peb*.65);
 vec3 alb=mix(base,grit,seam);float rough=clamp(mix(.84-.14*m2+.1*st,.97,seam),.5,1.);gl_FragColor=vec4(sqrt(alb),rough);}`,{tA:{value:A.texture},px:{value:px}},N,N,{minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});
 // pass 3: the relief (normal xy), the height (for parallax) and the hollows' shade (ambient occlusion)
 const Nm=cyBakePass('precision highp float;varying vec2 vUv;uniform float uK;'+HD+`
void main(){float c=Hh(vec2(0.)),l=Hh(vec2(-1.,0.)),r=Hh(vec2(1.,0.)),d=Hh(vec2(0.,-1.)),u=Hh(vec2(0.,1.)),tl=Hh(vec2(-1.,1.)),tr=Hh(vec2(1.,1.)),bl=Hh(vec2(-1.,-1.)),br=Hh(vec2(1.,-1.));
 vec2 g=vec2((tr+2.*r+br)-(tl+2.*l+bl),(tl+2.*u+tr)-(bl+2.*d+br))*uK;vec3 n=normalize(vec3(-g,1.));
 float s=0.;for(int i=0;i<8;i++){float a=float(i)*.785;vec2 o=vec2(cos(a),sin(a));s+=Hh(o*3.)+Hh(o*9.);}s/=16.;float ao=clamp(1.-(s-c)*3.,.3,1.);
 gl_FragColor=vec4(n.xy*.5+.5,c,ao);}`,{tA:{value:A.texture},px:{value:px},uK:{value:.9/(8*CY.TILE/N)}},N,N,{minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});
 const an=Math.min(16,R.capabilities.getMaxAnisotropy());C.texture.anisotropy=an;Nm.texture.anisotropy=an;A.dispose();
 AB.cyB={alb:C.texture,nrm:Nm.texture,rts:[C,Nm]};return AB.cyB}
// glowing fissures torn through the paving from the Tyrant's circle (world space over the whole yard)
function cyFissures(RF){if(AB.cyF)return AB.cyF;const S=1024,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,S,S);
 let sd=4711;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;const W=x=>(x/(2*RF)+.5)*S;
 const crack=(x,z,a,len,w0,depth)=>{const pts=[[x,z]];let px=x,pz=z,ang=a;const n=Math.max(4,Math.floor(len/5));for(let i=0;i<n;i++){ang+=(rr()-.5)*.7;px+=Math.cos(ang)*len/n;pz+=Math.sin(ang)*len/n;pts.push([px,pz]);
   if(depth<2&&rr()<.12)crack(px,pz,ang+(rr()<.5?-1:1)*(.5+rr()*.6),len*(.25+rr()*.3),w0*.55,depth+1)}
  for(const [lw,col] of [[w0*9,'rgba(0,255,0,0.07)'],[w0*4,'rgba(0,255,0,0.14)'],[w0*1.6,'rgba(160,255,0,0.6)'],[w0*.8,'rgba(255,255,0,1)']]){g.strokeStyle=col;g.lineCap='round';g.lineJoin='round';
   for(let i=1;i<pts.length;i++){const k=i/pts.length;g.lineWidth=Math.max(.6,lw*(1-k*.85)*S/(2*RF)*.5);g.beginPath();g.moveTo(W(pts[i-1][0]),W(pts[i-1][1]));g.lineTo(W(pts[i][0]),W(pts[i][1]));g.stroke()}}};
 for(let i=0;i<9;i++){const a=i/9*Math.PI*2+rr()*.4,r0=10+rr()*16;crack(Math.cos(a)*r0,Math.sin(a)*r0,a+(rr()-.5)*.4,AB.R*(.55+rr()*.45),1.6+rr()*.8,0)}
 for(let i=0;i<7;i++){const a=rr()*6.28,r0=AB.R*(.35+rr()*.5);crack(Math.cos(a)*r0,Math.sin(a)*r0,rr()*6.28,20+rr()*40,1.1,1)}
 const T=new THREE.CanvasTexture(c);T.minFilter=THREE.LinearMipmapLinearFilter;T.anisotropy=8;AB.cyF=T;return T}
function courtyardMat(AR){const B=courtyardBake(),Fz=cyFissures(AR*1.25),RT=rockTex();AB.rockTime=AB.rockTime||{value:0};
 const pom=!!(R.capabilities.isWebGL2&&!(typeof GFX==='function'&&GFX().q==='low'));
 const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,envMapIntensity:.32});
 const U={tCA:{value:B.alb},tCN:{value:B.nrm},tCF:{value:Fz},tRA:{value:RT.a},tRN:{value:RT.n},uRT:AB.rockTime};const RR=(AR*1.25).toFixed(1),F=v=>(+v).toFixed(5);
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vLP;varying vec3 vCP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLP=position.xy;vCP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vLP;varying vec3 vCP;uniform sampler2D tCA;uniform sampler2D tCN;uniform sampler2D tCF;uniform sampler2D tRA;uniform sampler2D tRN;uniform float uRT;\nfloat eh(float x){return fract(sin(x*127.1)*43758.5453);}float en(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(eh(i),eh(i+1.),f);}')
   .replace('void main() {','void main() {\n{float a=atan(vLP.y,vLP.x)*9.549;float rr=length(vLP)/'+RR+';float nn=en(a)*.55+en(a*2.7+13.)*.3+en(a*7.3+5.)*.15;if(rr>.80+nn*.13)discard;}\n'+
    'vec2 cyUV=vCP.xz/'+CY.TILE.toFixed(1)+';\n'+(pom?'{vec2 dx=dFdx(cyUV),dy=dFdy(cyUV);vec3 V=normalize(cameraPosition-vCP);vec3 Vt=vec3(V.x,V.z,V.y);float fad=clamp(1.-length(cameraPosition-vCP)/140.,0.,1.);\n'+
    ' if(fad>0.){vec2 P=Vt.xy/max(Vt.z,.3)*'+F(.9/CY.TILE)+'*fad;float dl=1./18.;vec2 duv=P*dl,uv=cyUV,puv=uv;float cur=0.,hg=1.-texture2DGradEXT(tCN,uv,dx,dy).b,pd=0.,ph=hg;\n'+
    '  for(int i=0;i<18;i++){if(cur>=hg)break;puv=uv;pd=cur;ph=hg;uv-=duv;cur+=dl;hg=1.-texture2DGradEXT(tCN,uv,dx,dy).b;}\n'+
    '  float aa=hg-cur,bb=ph-pd;cyUV=mix(uv,puv,clamp(aa/(aa-bb+1e-5),0.,1.));}}\n':'')+
    'vec4 cyA=texture2D(tCA,cyUV),cyN=texture2D(tCN,cyUV);vec4 cyM=texture2D(tRA,vCP.xz/310.),cyM2=texture2D(tRA,vCP.xz/73.+.37);vec4 cyF=texture2D(tCF,vCP.xz/'+F(2*AR*1.25)+'+.5);\n'+
    'float cyNear=clamp(1.-length(cameraPosition-vCP)/45.,0.,1.);vec2 cyG=cyUV*'+F(CY.TILE/2.7)+';vec4 cyMa=texture2D(tRA,cyG),cyMn=texture2D(tRN,cyG);\n')
   .replace('#include <map_fragment>','{vec3 alb=cyA.rgb*cyA.rgb;alb*=mix(1.,cyMa.r*1.15+.42,cyNear*.8);alb*=(.72+.56*cyM.r)*(.86+.28*cyM2.r);alb=mix(alb,alb*vec3(.5,.3,.25),smoothstep(.55,.85,cyM.r)*.35);alb*=1.-cyF.r*.85;diffuseColor.rgb*=alb*mix(1.,cyN.a,.85);}')
   .replace('#include <roughnessmap_fragment>','float roughnessFactor=cyA.a;')
   .replace('#include <normal_fragment_maps>','{vec2 nx=cyN.xy*2.-1.+(cyMn.xy*2.-1.)*cyNear*.55;vec3 nt=vec3(nx,sqrt(max(0.,1.-dot(nx,nx))));vec3 nw=normalize(vec3(nt.x,nt.z,nt.y));normal=normalize((viewMatrix*vec4(nw,0.)).xyz);}')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{float pul=.7+.3*sin(uRT*1.7+vCP.x*.05+vCP.z*.04);totalEmissiveRadiance+=(vec3(1.,.26,.04)*cyF.r*1.1+vec3(.9,.18,.03)*cyF.g*.42)*pul;}')};
 m.customProgramCacheKey=()=>'w3court2'+(pom?'p':'');return m}
// ---- the island sheds: pebbles and grit fall from its belly and the tips of its spires, drops of lava fall burning from its veins, and every few
// seconds a chunk breaks off its rim and tumbles into the void (seen from the courtyard's edge and in every wide shot)
function cragFallInit(){if(AB.cragFall||!AB.crag||!AB.G)return;const G=AB.G;const pts=[];const P=AB.crag.mesh.geometry.attributes.position,N=AB.crag.mesh.geometry.attributes.normal;
 for(let i=0;i<P.count;i+=7)if(N.getY(i)<-.25)pts.push([P.getX(i),P.getY(i),P.getZ(i)]);if(!pts.length)return;
 const rk=instancedParticles(new THREE.DodecahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0x2a1d18,transparent:true,depthWrite:false}),70);G.add(rk);
 const lv=instancedParticles(new THREE.OctahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xff6a1a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),40);G.add(lv);
 const S=[];for(let i=0;i<110;i++)S.push({lava:i>=70,j:i>=70?i-70:i,t:Math.random()*6,life:4+Math.random()*4,x:0,y:0,z:0,vx:0,vy:0,vz:0,s:1,live:false});
 AB.cragFall={rk,lv,S,pts}}
function cragFallTick(t,dt){if(!AB.cragFall){cragFallInit();if(!AB.cragFall)return}const F=AB.cragFall;
 for(const p of F.S){p.t+=dt;const im=p.lava?F.lv:F.rk;
  if(!p.live||p.t>p.life){if(p.t<p.life+Math.random()*3&&p.live){im.userData.put(p.j,0,-9999,0,0,0);continue}const q=F.pts[(Math.random()*F.pts.length)|0];p.x=q[0];p.y=q[1];p.z=q[2];p.vx=(Math.random()-.5)*3;p.vz=(Math.random()-.5)*3;p.vy=-Math.random()*2;p.t=0;p.life=p.lava?3+Math.random()*3:5+Math.random()*5;p.s=p.lava?.5+Math.random()*.9:.4+Math.random()*(Math.random()<.08?6:1.6);p.live=true}
  p.vy-=9.8*dt*(p.lava?1.4:1);p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;const a=Math.min(1,p.t*3)*Math.max(0,1-p.t/p.life);im.userData.put(p.j,p.x,p.y,p.z,p.s*(p.lava?1+Math.sin(t*20+p.j)*.2:1),a*(p.lava?.95:.85))}
 F.rk.userData.flush();F.lv.userData.flush()}

// ---------------------------------------------------------------- FACES for the cinematics
// Stinksheet'O Brown: his chin (the skin below the mouth, the lower teeth and the tongue) swings on a hinge behind the mouth,
// the brows lift or knit, the lids blink or squint, the eyes look where they are told.
// Stinkza: his chin drops on a hinge, the mouth corners lift (a smirk) or sag, the brow band rises or drops, the eyes squint,
// and a dark mouth opens in front of the painted one while he talks.
const g4=v=>(+v).toFixed(4);
// a copy of a material without its userData (the game keeps object references there, which three.js would try to serialise)
function matCopy(m){const ud=m.userData;m.userData={};let c;try{c=new m.constructor();c.copy(m)}finally{m.userData=ud}return c}
function faceStink(api){const F=api&&api.face;if(!F||!F.body)return null;if(F.rig)return F.rig;
 const HY=4.17,hy=HY-.36,hz=-.12,U={value:0};
 const glsl='{float w=(1.-smoothstep('+g4(HY-.6)+','+g4(HY-.42)+',transformed.y))*smoothstep('+g4(HY-1.36)+','+g4(HY-1.12)+',transformed.y)*smoothstep(.05,.35,transformed.z)*(1.-smoothstep(.52,.74,abs(transformed.x)));'+
  'float a=uJaw*w,qy=transformed.y-('+g4(hy)+'),qz=transformed.z-('+g4(hz)+'),c=cos(a),s=sin(a);transformed.y=qy*c-qz*s+('+g4(hy)+');transformed.z=qy*s+qz*c+('+g4(hz)+');}';
 const patch=m=>{if(!m||m.userData.faceJaw)return m;const c=matCopy(m);c.userData.faceJaw=true;
  c.onBeforeCompile=sh=>{sh.uniforms.uJaw=U;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uJaw;').replace('#include <begin_vertex>','#include <begin_vertex>\n'+glsl)};
  c.customProgramCacheKey=()=>'faceStinkJaw|'+(c.type||'');return c};
 F.body.material=patch(F.body.material);F.body.children.forEach(o=>{if(o.isMesh)o.material=patch(o.material)});
 const lo=F.lo.concat(F.tongue?[F.tongue]:[]);lo.forEach(m=>{m.userData.p0=m.position.clone();m.userData.r0=m.rotation.x});
 F.brows.forEach(b=>{b.geometry.computeBoundingBox();b.userData.c=b.geometry.boundingBox.getCenter(new V3());b.userData.side=b.userData.c.x<0?-1:1});
 F.eyes.forEach(e=>{e.look0=e.look.slice();e.rx0=e.L.rotation.x;e.s0=e.E.scale.x});
 const st={jaw:0,brow:0,knit:0,lid:0,wide:0,look:[0,0]};
 const rig={st,apply(){const j=st.jaw;U.value=j;
   lo.forEach(m=>{const p=m.userData.p0,qy=p.y-hy,qz=p.z-hz,c=Math.cos(j),s=Math.sin(j);m.position.set(p.x,qy*c-qz*s+hy,qy*s+qz*c+hz);m.rotation.x=m.userData.r0+j});
   // brows: lift (surprise) / knit (fury: inner ends drop, outer ends rise)
   F.brows.forEach(b=>{const c=b.userData.c,th=-b.userData.side*st.knit*.32+b.userData.side*st.brow*.08,co=Math.cos(th),si=Math.sin(th);
    b.rotation.z=th;b.position.set(c.x-(co*c.x-si*c.y),c.y-(si*c.x+co*c.y)+st.brow*.12-st.knit*.03,0)});
   // lids close over the front of the eye; wide eyes swell a little; irises follow the look
   F.eyes.forEach(e=>{e.L.rotation.x=e.rx0+clampN(st.lid,0,1)*.95-st.wide*.25;const k=1+st.wide*.08;e.E.scale.setScalar(e.s0*k);e.look[0]=e.look0[0]+st.look[0];e.look[1]=e.look0[1]+st.look[1]})}};
 F.rig=rig;return rig}
function faceZ(C){if(!C||!C.mesh)return null;if(C.face)return C.face;const mesh=C.mesh;
 const U={uJaw:{value:0},uSmile:{value:0},uBrow:{value:0},uSquint:{value:0}};
 const MX=.0446,MY=.600,EY=.687,BY=.725,HYP=.618,HZP=.12;
 const glsl='{vec3 p=transformed;'+
  'float wj=(1.-smoothstep('+g4(MY-.010)+','+g4(MY+.003)+',p.y))*smoothstep('+g4(MY-.065)+','+g4(MY-.040)+',p.y)*smoothstep(.150,.185,p.z)*(1.-smoothstep(.045,.080,abs(p.x-'+g4(MX)+')));'+
  'float a=uJaw*wj,qy=p.y-'+g4(HYP)+',qz=p.z-'+g4(HZP)+',c=cos(a),s=sin(a);p.y=qy*c-qz*s+'+g4(HYP)+';p.z=qy*s+qz*c+'+g4(HZP)+';'+
  'float dl=length(vec2(p.x-'+g4(MX-.027)+',p.y-'+g4(MY-.004)+')),dr=length(vec2(p.x-'+g4(MX+.022)+',p.y-'+g4(MY-.004)+'));'+
  'p.y+=uSmile*.009*(1.-smoothstep(0.,.022,min(dl,dr)))*smoothstep(.17,.20,p.z);'+
  'float wb=smoothstep('+g4(BY-.028)+','+g4(BY-.008)+',p.y)*(1.-smoothstep('+g4(BY+.012)+','+g4(BY+.034)+',p.y))*smoothstep(.17,.21,p.z)*(1.-smoothstep(.10,.15,abs(p.x-'+g4(MX)+')));'+
  'p.y+=uBrow*.013*wb;'+
  'float we=(1.-smoothstep(.007,.03,abs(p.y-'+g4(EY)+')))*smoothstep(.15,.19,p.z)*(1.-smoothstep(.11,.15,abs(p.x-'+g4(MX)+')));'+
  'p.y=mix(p.y,'+g4(EY)+'+(p.y-'+g4(EY)+')*(1.-.5*uSquint),we);transformed=p;}';
 const m=matCopy(mesh.material);m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uJaw,uSmile,uBrow,uSquint;').replace('#include <begin_vertex>','#include <begin_vertex>\n'+glsl)};
 m.customProgramCacheKey=()=>'faceZ';mesh.material=m;
 // the open mouth: a dark oval on the face, on the head bone, as tall as the jaw is open
 let mouth=null;try{const head=mesh.skeleton.getBoneByName('head');const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d');const gr=g.createRadialGradient(32,26,2,32,32,32);gr.addColorStop(0,'#5a1414');gr.addColorStop(.55,'#260707');gr.addColorStop(1,'#0c0303');g.fillStyle=gr;g.beginPath();g.ellipse(32,32,31,31,0,0,6.283);g.fill();
  g.fillStyle='rgba(200,80,90,.55)';g.beginPath();g.ellipse(32,50,14,8,0,0,6.283);g.fill();
  const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
  mouth=new THREE.Mesh(new THREE.CircleGeometry(1,28),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  mouth.rotation.y=.17;mouth.visible=false;head.add(mouth);mouth.userData.base=new V3(MX-head.position.x,MY-.585,.2205-.06)}catch(e){mouth=null}
 const st={jaw:0,smile:0,brow:0,squint:0,look:0};
 const face={st,apply(){U.uJaw.value=st.jaw;U.uSmile.value=st.smile;U.uBrow.value=st.brow;U.uSquint.value=st.squint;
   if(mouth){const h=.0015+st.jaw*.055;mouth.visible=st.jaw>.02;mouth.scale.set(.017+st.jaw*.02,h,1);const b=mouth.userData.base;mouth.position.set(b.x,b.y-h*.85,b.z)}
   // the head turns toward whoever he is talking to (after the body animation has posed it)
   try{const hb=mesh.skeleton.getBoneByName('head');hb.rotation.y+=st.look}catch(e){}}};
 C.face=face;return face}
// ---------------------------------------------------------------- VOICES: a syllable at a time, one timbre per character, under the subtitles
const VOX={S:{f:118,q:5,form:[620,1180],type:'sawtooth',gain:.16},Z:{f:232,q:7,form:[900,2300],type:'square',gain:.09}};
function voxSyl(who,t0,len,acc){try{const ac=audioCtx();if(!ac)return;const V=VOX[who],T=ac.currentTime+Math.max(0,t0);const o=ac.createOscillator();o.type=V.type;
  const f=V.f*(1+(Math.random()-.5)*.18+acc*.12);o.frequency.setValueAtTime(f*1.08,T);o.frequency.exponentialRampToValueAtTime(f*.9,T+len);
  const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=V.form[(Math.random()*2)|0]*(1+(Math.random()-.5)*.2);bp.Q.value=V.q;
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;const g=ac.createGain();g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(V.gain*(.7+acc*.5),T+.025);g.gain.exponentialRampToValueAtTime(.0005,T+len);
  o.connect(bp);bp.connect(lp);lp.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+len+.05)}catch(e){}}
// a line of dialogue: its syllables (vowel groups) spread over its time; the jaw follows the same beats
function lineMake(who,text,t0,dur){const words=text.replace(/[^A-Za-z' ]/g,' ').split(/\s+/).filter(Boolean);const syl=[];let n=0;
 words.forEach(w=>{const k=Math.max(1,(w.toLowerCase().match(/[aeiouy]+/g)||[]).length);for(let i=0;i<k;i++)syl.push({acc:i===0?1:0,wEnd:i===k-1});n+=k});
 const step=dur*.88/Math.max(1,n);syl.forEach((s,i)=>{s.t=t0+i*step+(s.wEnd?0:0);s.len=step*(s.wEnd?.95:.8)});return {who,text,t0,dur,syl,said:false,voiced:0}}
// the jaw at time c for a line: open on each syllable, closed between words and at the end
function lineJaw(L,c){if(c<L.t0||c>L.t0+L.dur)return 0;let j=0;for(const s of L.syl){const k=(c-s.t)/s.len;if(k>=0&&k<=1){j=Math.max(j,Math.sin(k*Math.PI)*(s.acc?1:.75))}}return j}

// ---------------------------------------------------------------- TRANSITION: the end panel falls away, reality tears, a rainbow portal opens
W3.onL2End=function(){W3.preload();clearTimeout(W3._tearT);W3._tearT=setTimeout(tear,3500)};
function rainbowMat(){return new THREE.ShaderMaterial({uniforms:{uT:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'varying vec2 vUv;uniform float uT;vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);}\nvoid main(){vec2 p=vUv-.5;float r=length(p)*2.;if(r>1.)discard;float a=atan(p.y,p.x);float sw=a/6.2832+r*1.6-uT*.45;vec3 c=hue(fract(sw));float swirl=.5+.5*sin(a*6.+uT*3.-r*14.);\nvec3 core=mix(vec3(1.),c,smoothstep(.0,.55,r));vec3 col=mix(core,c*1.6,swirl*.35)*(1.4-r*.4);float al=1.-smoothstep(.9,1.,r);gl_FragColor=vec4(col*1.6,al);}'})}
function tear(){if(W3.on||W3.portal||!L2.ended)return;const p=$('endp');if(p){p.classList.add('w3drop');setTimeout(()=>{p.style.display='none';p.classList.remove('w3drop')},1050)}
 shake=Math.max(shake,2.8);fade(.75,.08,'#ead6ff');setTimeout(()=>fade(0,.9),140);abyssSfx('thunder',.6,0);abyssSfx('boom',.5,.15);
 setTimeout(()=>{if(paused)setPaused(false,true);shake=Math.max(shake,1.8);openRainbow();bossYell('REALITY HAS BEEN TORN APART.','A rainbow portal opens. Step through.')},700)}
function openRainbow(){if(W3.portal)return;if(L2.endPortal){world.remove(L2.endPortal);L2.endPortal=null}   // the purple exit closes as the rainbow opens
 const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw);const px=heroPos.x+fx*14,pz=heroPos.z+fz*14;
 const g=buildPortal(0xffffff,null);g.userData.disc.material=rainbowMat();g.scale.setScalar(1.35);g.position.set(px,heightAt(px,pz),pz);g.traverse(o=>o.layers.set(1));world.add(g);W3.portal=g;W3.portalT=now();
 for(let k=0;k<10;k++)dustPuff(px+(Math.random()-.5)*7,heightAt(px,pz),pz+(Math.random()-.5)*7,now())}
function rainbowTick(t,dt){const g=W3.portal;if(!g)return;g.rotation.y=Math.atan2(heroPos.x-g.position.x,heroPos.z-g.position.z);g.userData.disc.material.uniforms.uT.value=t;
 const k=Math.min(1,(t-W3.portalT)/.8);const s=1.35*(1-Math.pow(1-k,3));g.scale.setScalar(Math.max(.01,s));
 const c=new THREE.Color().setHSL((t*.15)%1,.9,.6);g.traverse(o=>{if(o.isMesh&&o!==g.userData.disc&&o.material&&o.material.color&&o.material.blending===THREE.AdditiveBlending)o.material.color.copy(c);if(o.isPointLight)o.color.copy(c)});
 if(g.userData.light)g.userData.light.intensity=2.4+Math.sin(t*9)*.6;
 // walking up to it no longer takes you: the page's portal prompt does, on the interact button (the owner)
}
// someone stepped through: everyone goes (the host keeps the order)
W3.enter=function(fromNet){if(W3.on)return;W3.on=true;W3.seq++;if(MP.on&&!fromNet)mpQueue({k:'w3go'});W3.preload();
 const p=$('endp');if(p)p.style.display='none';if(paused)setPaused(false,true);L2.ended=true;L2.phase='w3';
 const bb=$('bossbar');if(bb)bb.style.display='none';try{musicW2(null)}catch(e){}try{if(typeof gogo!=='undefined'&&gogo&&typeof setGogo==='function')setGogo(false)}catch(e){}
 fade(1,.35,'#ffffff');setTimeout(startCave,420)};

// ---------------------------------------------------------------- THE CAVE: a narrow, lit tunnel with light at the end
const CV={};
function buildCave(){if(CV.scene)return;const sc=new THREE.Scene();sc.fog=new THREE.FogExp2(0x1a0e08,.018);sc.background=new THREE.Color(0x060403);sc.environment=S.environment;
 const dl=new THREE.DirectionalLight(0xffd8b0,.55);dl.castShadow=true;dl.shadow.mapSize.set(1024,1024);Object.assign(dl.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:60});dl.position.set(4,18,6);sc.add(dl);sc.add(dl.target);CV.dl=dl;
 sc.add(new THREE.HemisphereLight(0x9a7a60,0x221008,.85));
 AB.seed=919;const T=abyssTextures();const rock=new THREE.MeshStandardMaterial({color:0x5a4434,map:T.rock,roughness:.95,flatShading:true,side:THREE.BackSide});
 const path=new THREE.CatmullRomCurve3([0,-25,-50,-75,-100,-128].map((z,i)=>new V3(Math.sin(i*1.3)*2.2,4.2,z)));
 const tube=new THREE.TubeGeometry(path,140,6.4,18,false);const P=tube.attributes.position;for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i),z=P.getZ(i);const n=Math.sin(x*1.7+z*.37)*.45+Math.sin(y*2.1-z*.53)*.35+(Math.random()-.5)*.5;const c=path.getPointAt(Math.min(1,Math.max(0,-z/128)));const dx=x-c.x,dy=y-c.y,L=Math.hypot(dx,dy)||1;P.setXYZ(i,x+dx/L*n,y+dy/L*n,z)}tube.computeVertexNormals();
 const tm=new THREE.Mesh(tube,rock);tm.receiveShadow=true;sc.add(tm);
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(10,140,4,70),new THREE.MeshStandardMaterial({color:0x4a3828,map:T.rock,roughness:.97}));fl.rotation.x=-Math.PI/2;fl.position.set(0,0,-64);fl.receiveShadow=true;sc.add(fl);
 const stone=new THREE.MeshStandardMaterial({color:0x4a3a30,map:T.rock,roughness:.92,flatShading:true});
 for(let i=0;i<46;i++){const z=-4-Math.random()*118,c=path.getPointAt(Math.min(1,-z/128));const side=Math.random()<.5?-1:1;
  if(i%3===0){const s=new THREE.Mesh(new THREE.ConeGeometry(sr(.25,.6),sr(1.2,3.5),6),stone);s.position.set(c.x+sr(-3,3),9.2+sr(-.6,.4),z);s.rotation.x=Math.PI;sc.add(s)}
  else{const b=new THREE.Mesh(new THREE.DodecahedronGeometry(sr(.5,1.4),0),stone);b.position.set(c.x+side*sr(3.6,4.8),sr(.2,.8),z);b.castShadow=true;sc.add(b)}}
 // violet crystals along the walls: the Abyss is close
 const cry=new THREE.MeshStandardMaterial({color:0x6a2ab0,emissive:0x7a2aff,emissiveIntensity:1.4,roughness:.25,metalness:.1,flatShading:true});
 for(let i=0;i<22;i++){const z=-20-Math.random()*100,c=path.getPointAt(Math.min(1,-z/128));const side=Math.random()<.5?-1:1;const cl=new THREE.Group();cl.position.set(c.x+side*sr(3.8,4.6),sr(.2,3),z);cl.rotation.z=-side*sr(.4,.9);sc.add(cl);
  for(let k=0;k<4;k++){const m=new THREE.Mesh(new THREE.OctahedronGeometry(sr(.25,.6),0),cry);m.scale.y=sr(2,3.4);m.position.set(sr(-.4,.4),sr(0,.6),sr(-.4,.4));m.rotation.set(sr(-.4,.4),sr(0,3),sr(-.4,.4));cl.add(m)}}
 // torches every few steps
 CV.flames=[];for(let i=0;i<6;i++){const z=-8-i*20,c=path.getPointAt(Math.min(1,-z/128)),side=i%2?1:-1;const x=c.x+side*4.6;
  const br=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,1.1),stone);br.position.set(x-side*.3,3.6,z);br.rotation.y=Math.PI/2;sc.add(br);
  const f=new THREE.Group();f.position.set(x-side*.5,4.1,z);sc.add(f);for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.ConeGeometry(.28-k*.07,.9-k*.18,8),new THREE.MeshBasicMaterial({color:[0xff5a10,0xffa02a,0xfff0a0][k],transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.position.y=.35+k*.06;f.add(m)}CV.flames.push(f);
  const L=new THREE.PointLight(0xffa050,2.4,24,1.6);L.position.set(x-side*1.2,4.2,z);sc.add(L)}
 // the light at the end
 const ex=new THREE.Mesh(new THREE.CircleGeometry(7.5,40),new THREE.MeshBasicMaterial({color:0xfff4ff,toneMapped:false}));ex.position.set(path.getPointAt(1).x,4,-127);sc.add(ex);CV.exit=ex;
 for(let k=0;k<6;k++){const sh=new THREE.Mesh(new THREE.ConeGeometry(sr(1.4,2.6),sr(26,40),12,1,true),new THREE.MeshBasicMaterial({color:0xf0dcff,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));sh.rotation.x=-Math.PI/2;sh.position.set(ex.position.x+sr(-3,3),4+sr(-2,2),-112+sr(-4,4));sc.add(sh)}
 const XL=new THREE.PointLight(0xe8d8ff,2.5,60,1.2);XL.position.set(ex.position.x,4,-118);sc.add(XL);CV.exitL=XL;
 {const n=400,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=sr(-4,4);pos[i*3+1]=sr(.3,8);pos[i*3+2]=-Math.random()*128}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));const pm=new THREE.Points(g,new THREE.PointsMaterial({size:.08,color:0xffe0b0,transparent:true,opacity:.6,depthWrite:false}));sc.add(pm)}
 CV.path=path;CV.scene=sc;CV.cam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,300)}
// people in the scene: you, and the other player if there is one. Player one is Stinksheet'O Brown (S), everyone else Stinkza (Z).
function cvActors(){const A=[];A.push({o:hero,cg:heroCG,isMe:true,api:charApi,redCap:!!MP.client,who:MP.client?'Z':'S'});
 if(MP.on)for(const id in MP.players){const P=MP.players[id];if(P.g&&P.cg&&P.st&&!P.st.dead){const z=!!(MP.hostPeer&&P.peer!==MP.hostPeer);A.push({o:P.g,cg:P.cg,isMe:false,api:P.api,P,redCap:z,who:z?'Z':'S'});break}}
 // their faces (Stinkza's only when his figure is loaded; Red Cap stands in silently otherwise)
 A.forEach(a=>{try{if(a.who==='S')a.face=faceStink(a.api);else{const M=a.o.userData.rc;if(M&&M.kind==='p2')a.face=faceZ(M.C)}}catch(e){a.face=null;console.error('cinematic face',e&&e.message,e&&e.stack)}a.fs={};a.blinkT=1+Math.random()*2});
 return A}
// ---- the script: what is said, by whom, with which face, from which camera (seconds from the start of the cave)
const CAVE2=[
 {t:1.0,who:'Z',text:'This cave reeks of something ancient.',dur:2.6,face:{squint:.65,smile:.8,brow:-.3},cam:'walk'},
 {t:4.0,who:'S',text:'Ancient? Smells like my gym bag.',dur:2.4,face:{knit:.5,wide:.3,lid:0},cam:'walk'},
 {t:6.9,ev:'rumble'},
 {t:8.3,who:'Z',text:'Did you feel that? Something huge is waiting out there.',dur:3.3,face:{brow:.9,smile:-.5,squint:0},cam:'cuZ',point:true},
 {t:11.9,who:'S',text:'Huge? Good. The bigger they are, the harder I hit.',dur:3.1,face:{knit:1,wide:.15},cam:'cuS'},
 {t:15.2,ev:'look',cam:'two'},
 {t:15.6,who:'Z',text:'Try not to die before I do.',dur:2.1,face:{smile:1,squint:.45,brow:-.25},cam:'cuZ'},
 {t:18.0,who:'S',text:"Oh, let's get it.",dur:1.6,face:{knit:.45,wide:.35},cam:'cuS'},
 {t:19.7,ev:'run',cam:'run'},{t:22.6,ev:'fade'},{t:24.0,ev:'end'}];
const CAVE1=[
 {t:1.0,who:'S',text:'Smells like something died down here. A long time ago.',dur:3.3,face:{lid:.4,knit:.3},cam:'walk'},
 {t:5.0,ev:'rumble'},
 {t:6.4,who:'S',text:"Whatever you are... I'm coming for you.",dur:2.8,face:{knit:1,wide:.2},cam:'cuS'},
 {t:9.7,who:'S',text:"Oh, let's get it.",dur:1.6,face:{knit:.5,wide:.35},cam:'cuS'},
 {t:11.5,ev:'run',cam:'run'},{t:14.4,ev:'fade'},{t:15.8,ev:'end'}];
const WHO_NAME={S:"STINKSHEET'O BROWN",Z:'STINKZA'};
function startCave(){buildCave();buildAbyss();   // the realm is built while the screen is white
 const A=cvActors();CV.A=A;CV.t0=now();CV.saved=A.map(a=>({o:a.o,par:a.o.parent,pos:a.o.position.clone(),rot:a.o.rotation.y}));
 A.forEach((a,i)=>{a.o.parent&&a.o.parent.remove(a.o);CV.scene.add(a.o);a.o.position.set(A.length>1?(i?1.25:-1.25):0,0,-6);a.o.rotation.set(0,Math.PI,0);a.o.visible=true;if(a.cg)a.cg.visible=true;
  if(a.isMe&&L2.mech){a.mech=L2.mech;L2.mech.visible=false}if(a.P&&a.P.mech){a.mech=a.P.mech;a.P.mech.visible=false}});
 // the script for who is here; two players need both of them in the scene
 const two=A.length>1&&A.some(a=>a.who==='S')&&A.some(a=>a.who==='Z');
 CV.script=(two?CAVE2:CAVE1).map(b=>Object.assign({},b,b.text?{L:lineMake(b.who,b.text,b.t,b.dur)}:{}));CV.end=CV.script.find(b=>b.ev==='end').t;
 CV.z=-6;CV.mode='walk';CV.shot='walk';CV.shotT=0;CV.rumbleT=-9;CV.dust=[];CV.said=0;CV.prevPose=null;CV.curPose=null;
 if(!CV.faceL){CV.faceL=new THREE.PointLight(0xffe4cc,0,9,2);CV.scene.add(CV.faceL)}
 W3.ph='cave';W3.cine=true;cineUI(true);sub('');try{const p0=AB.G.position.clone();warmUp(AB.G);AB.G.position.copy(p0);AB.G.updateMatrixWorld(true)}catch(e){}   // warmUp parks what it draws 600 below you: put the realm back
 setTimeout(()=>fade(0,1.3),60)}
function walkAnim(a,t,dt,moving,run,pt){try{if(a.api&&a.api.anim)a.api.anim(t,moving,false,0,run)}catch(e){}try{if(typeof MSC!=='undefined')MSC.tick(a.o,a.cg,a.redCap,moving?(run?2:1):0,t,dt,false,pt||null)}catch(e){}}
function cineRender(scene,camera){if(W3._noRender)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();lbPre(scene,camera,camera.position);
 try{if(composer){const rp=composer.passes[0];const s0=rp.scene,c0=rp.camera;rp.scene=scene;rp.camera=camera;try{composer.render()}finally{rp.scene=s0;rp.camera=c0}}else R.render(scene,camera)}finally{lbPost()}}
// where a face is (for the camera) and which way it looks
function faceAt(a){if(a.who==='Z'){const M=a.o.userData.rc;if(M&&M.C&&M.C.mesh)return M.C.mesh.localToWorld(new V3(.045,.66,.2))}return (a.cg||a.o).localToWorld(new V3(0,4.17-.1,.95))}
function fwdOf(a){const y=a.o.rotation.y;return new V3(Math.sin(y),0,Math.cos(y))}
const easeTo=(o,k,v,r)=>{o[k]=(o[k]||0)+(v-(o[k]||0))*r};
function caveTick(t,dt){const c=t-CV.t0,A=CV.A,two=A.length>1,S=CV.script;
 // the beats that have started
 let line=null,shot='walk';for(const b of S){if(c<b.t)break;if(b.cam)shot=b.cam;if(b.L&&c<b.t+b.dur+.25)line=b;
  if(b.ev&&!b.done){b.done=true;
   if(b.ev==='rumble'){CV.rumbleT=c;CV.mode='stop';abyssSfx('thunder',.75,0);abyssSfx('boom',.5,.1);
    for(let k=0;k<46;k++){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(.03+Math.random()*.07,0),new THREE.MeshLambertMaterial({color:0x6a5240}));const cx0=CV.path.getPointAt(Math.min(1,Math.max(0,-CV.z/128))).x;
     m.position.set(cx0+(Math.random()-.5)*7,8.6+Math.random()*.6,CV.z+(Math.random()-.5)*8);CV.scene.add(m);CV.dust.push({m,v:-Math.random()*1.5,t0:c})}}
   else if(b.ev==='run')CV.mode='run';
   else if(b.ev==='fade'){fade(1,1.1,'#ffffff')}
   else if(b.ev==='end'){endCave();return}}}
 // walking until the rumble stops them, standing through the talk, then running for the light (from the clock, so a slow frame never puts them behind the script)
 const W=2.4,RUN=7.5,tS=(S.find(b=>b.ev==='rumble')||{t:99}).t+.4,tR=(S.find(b=>b.ev==='run')||{t:99}).t;CV.z=-6-W*Math.min(c,tS)-RUN*Math.max(0,c-tR);
 const z=CV.z,cx=CV.path.getPointAt(Math.min(1,Math.max(0,-z/128))).x,mv=c<tS||c>=tR,run=c>=tR;
 const talking=!mv&&c-CV.rumbleT>1.2;
 A.forEach((a,i)=>{const side=two?(i?1.25:-1.25):0;a.o.position.set(cx+side,0,z);
  // facing: down the tunnel while walking; turned toward each other (alone: toward the camera) while they talk; a look back up at the ceiling when it shakes
  let yaw=Math.PI;if(talking&&!run)yaw=two?Math.PI+(i?1:-1)*1.05:Math.PI+.35;
  a.yaw=(a.yaw===undefined?yaw:a.yaw+angN(yaw-a.yaw)*Math.min(1,dt*4));a.o.rotation.y=a.yaw;
  const pt=(line&&line.point&&line.who===a.who&&a.who==='Z')?{point:true,aim:new V3(cx,4,z-60),kick:0}:null;
  walkAnim(a,t,dt,mv,run,pt)});
 // faces: the speaker's jaw follows his syllables, his expression eases in; the listener looks at him; everyone blinks
 const rumbling=c-CV.rumbleT<1.6;
 // the line being spoken: its subtitle and its voice, syllable by syllable (with or without a face to move)
 if(line){if(!line.subbed){line.subbed=true;CV.subLine=line;sub(line.text,WHO_NAME[line.who])}for(const sy of line.L.syl){if(!sy.v&&c>=sy.t){sy.v=1;voxSyl(line.who,0,sy.len,sy.acc)}}}
 A.forEach(a=>{if(!a.face)return;const f=a.face.st,sp=line&&line.who===a.who,L=sp?line.L:null,want=sp?line.face:{};
  const jaw=L?lineJaw(L,c):0;a.blinkT-=dt;let blink=0;if(a.blinkT<0){blink=1;if(a.blinkT<-.13)a.blinkT=2+Math.random()*2.6}
  if(a.who==='S'){easeTo(f,'jaw',jaw*.3+(rumbling?.12:0)+(want.jaw||0),.55);easeTo(f,'knit',rumbling?0:(want.knit!==undefined?want.knit:.25),dt*6);easeTo(f,'brow',rumbling?1:(want.brow||0),dt*6);easeTo(f,'wide',rumbling?1:(want.wide||0),dt*6);
   f.lid=Math.max(blink,(want.lid||0)*(1-blink));f.look=rumbling?[0,.35]:(two&&line&&!sp?[a.o.position.x<0?.18:-.18,.02]:[0,0])}
  else{easeTo(f,'jaw',jaw*.34+(rumbling?.1:0),.55);easeTo(f,'smile',rumbling?-.3:(want.smile!==undefined?want.smile:.15),dt*6);easeTo(f,'brow',rumbling?1:(want.brow||0),dt*6);
   f.squint=Math.max(blink,(want.squint||0)*(1-blink));easeTo(f,'look',two&&line&&!sp?(a.o.position.x<0?-.45:.45):0,dt*4)}
  a.face.apply()});
 if(CV.subLine&&c>CV.subLine.t+CV.subLine.dur+.15){CV.subLine=null;sub('')}
 // the falling dust from the rumble
 CV.dust=CV.dust.filter(d=>{d.v-=9.8*dt;d.m.position.y+=d.v*dt;d.m.rotation.x+=dt*5;if(d.m.position.y<.05||c-d.t0>3){CV.scene.remove(d.m);d.m.geometry.dispose();return false}return true});
 CV.flames.forEach((f,i)=>f.children.forEach((m,k)=>m.scale.set(1+Math.sin(t*14+k+i)*.15,1+Math.sin(t*11+k*2+i)*.25,1)));
 const runK=CV.mode==='run'?Math.min(1,(c-S.find(b=>b.ev==='run').t)/2.6):0;CV.exitL.intensity=2.5+runK*10;CV.exit.scale.setScalar(1+runK*.6);
 CV.dl.position.set(cx+4,18,z+6);CV.dl.target.position.set(cx,0,z);CV.dl.target.updateMatrixWorld();R.shadowMap.needsUpdate=!(frame&1);
 // camera: every shot keeps moving (a slow drift, a push in, an arc); a new shot glides out of the last one instead of cutting
 const cam2=CV.cam;if(shot!==CV.shot){CV.prevPose=CV.curPose?{p:CV.curPose.p.clone(),l:CV.curPose.l.clone(),fov:CV.curPose.fov}:null;CV.shot=shot;CV.shotT=c}const k=c-CV.shotT;let fov=50,faceLight=0;
 const actor=w=>A.find(a=>a.who===w)||A[0];const P=new V3(),Lk=new V3();
 if(shot==='walk'){const sw=Math.sin(c*.33);P.set(cx+1.9+sw*1.1,2.05+Math.sin(c*.21)*.18,z-7.2+Math.min(k,5)*.16);Lk.set(cx+sw*.25,2.25,z);fov=48}
 else if(shot==='cuS'||shot==='cuZ'){const a=actor(shot==='cuS'?'S':'Z'),fp=faceAt(a),fw=fwdOf(a),rt=new V3(fw.z,0,-fw.x);const d=(a.who==='S'?3.3:2.4)-sstep(0,4,k)*.55,arc=(a.who==='S'?.85:.65)-sstep(0,4,k)*.25;
  P.copy(fp).addScaledVector(fw,d).addScaledVector(rt,arc);P.y+=(a.who==='S'?.32:.22)-sstep(0,4,k)*.08;Lk.set(fp.x,fp.y+(a.who==='S'?.12:.06),fp.z);fov=34;faceLight=1.5}
 else if(shot==='two'){const a0=A[0],a1=A[1]||A[0],m=a0.o.position.clone().lerp(a1.o.position,.5);P.set(m.x+.4+Math.sin(k*.5)*.5,2.5,m.z-5.2+sstep(0,3,k)*.8);Lk.set(m.x,2.4,m.z);fov=42;faceLight=.8}
 else{const kk=sstep(0,1.6,k),sw=Math.sin(kk*Math.PI);P.set(cx+lerpN(.6,.4,kk)+sw*5.2,lerpN(2.5,1.8,kk)+sw*.8,lerpN(z-5.4,z+6.5,kk));Lk.set(cx,lerpN(2.5,3.4,kk),lerpN(z,z-20,kk));fov=lerpN(48,58,kk)}
 let pose={p:P,l:Lk,fov};if(CV.prevPose){const b=sstep(0,shot==='run'?.5:.95,k);if(b<1)pose=poseMix(CV.prevPose,pose,EZ.io(b))}
 CV.curPose={p:pose.p.clone(),l:pose.l.clone(),fov:pose.fov};cam2.position.copy(pose.p);cam2.lookAt(pose.l);fov=pose.fov;
 // the rumble shakes the camera
 const rk=c-CV.rumbleT;if(rk>=0&&rk<1.4){const a=(1-rk/1.4)*.12;cam2.position.x+=(Math.random()-.5)*a;cam2.position.y+=(Math.random()-.5)*a;cam2.position.z+=(Math.random()-.5)*a}
 if(Math.abs(cam2.fov-fov)>.01){cam2.fov=fov;cam2.updateProjectionMatrix()}
 CV.faceL.intensity+=(faceLight-CV.faceL.intensity)*Math.min(1,dt*6);CV.faceL.position.copy(cam2.position).add(new V3(0,.6,0));
 cineRender(CV.scene,cam2)}
function endCave(){if(W3.ph!=='cave')return;sub('');
 CV.A.forEach(a=>{if(!a.face)return;const f=a.face.st;for(const k in f)f[k]=Array.isArray(f[k])?[0,0]:0;try{a.face.apply()}catch(e){}});   // faces back to rest
 CV.dust.forEach(d=>CV.scene.remove(d.m));CV.dust=[];
 // everyone back into the world, on the south edge of the arena, facing the fortress
 CV.A.forEach((a,i)=>{CV.scene.remove(a.o);world.add(a.o);if(a.mech)a.mech.visible=true;});
 heroPos.set(CV.A.length>1?-3:0,0,AB.R-22);hero.position.set(heroPos.x,0,heroPos.z);heroYaw=Math.PI;hero.rotation.set(0,Math.PI,0);camYaw=0;camPitch=.3;
 CV.A.forEach(a=>{if(!a.isMe&&a.P){a.P.cur=null}});
 W3.ph='load';CV.loadT=now()}
// waiting on a white screen for the Tyrant to finish loading (normally he is long since ready)
function loadTick(t,dt){const L=$('w3load');if(W3.ready){L.style.opacity=0;try{abyssAttachFort()}catch(e){console.warn('World 3: fortress',e)}if(!CV.warmed){CV.warmed=true;try{placeTyrantHidden();const p0=TY.g.position.clone();warmUp(TY.g);TY.g.position.copy(p0);TY.g.updateMatrixWorld(true)}catch(e){console.warn(e)}}fade(0,1.6);filmArrival();return}
 if(W3.err){L.style.opacity=1;L.textContent='THE TYRANT COULD NOT BE SUMMONED · '+String(W3.err.message||W3.err).slice(0,80);if(t-CV.loadT>6){fade(0,1.6);filmArrival()}return}
 L.style.opacity=1;L.textContent='THE ABYSS IS FORMING… '+Math.round(W3.loadP*100)+'%';cineRender(CV.scene,CV.cam)}
// ---------------------------------------------------------------- THE REVEAL: a flight over the realm, the title, then you
function startReveal(){W3.ph='reveal';CV.r0=now();fade(0,1.6);
 const back=new V3(heroPos.x+Math.sin(camYaw)*Math.cos(camPitch)*camDist,Math.sin(camPitch)*camDist+2,heroPos.z+Math.cos(camYaw)*Math.cos(camPitch)*camDist);
 CV.fly=new THREE.CatmullRomCurve3([new V3(-430,190,560),new V3(-260,140,330),new V3(-40,95,120),new V3(150,60,60),new V3(90,30,190),back],false,'centripetal');
 CV.look=[new V3(0,190,-560),new V3(0,120,-420),new V3(0,40,-80),new V3(0,15,0),new V3(heroPos.x,6,heroPos.z-20),new V3(heroPos.x,2.2,heroPos.z)];
 setTimeout(()=>{$('w3title').style.opacity=1},1500);setTimeout(()=>{$('w3title').style.opacity=0},6400)}
function revealTick(t,dt){const c=t-CV.r0,D=9;const k=Math.min(1,c/D),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
 cam.position.copy(CV.fly.getPointAt(e));const L=CV.look,f=e*(L.length-1),i=Math.min(L.length-2,Math.floor(f));const tgt=new V3().lerpVectors(L[i],L[i+1],f-i);cam.lookAt(tgt);
 abyssTick(t,dt);if(TY.g&&TY.g.parent)TY.mixer.update(dt);
 CV.A.forEach(a=>walkAnim(a,t,dt,false,false));
 lbPre(S,cam,heroPos);try{if(composer)composer.render();else R.render(S,cam)}finally{lbPost()}
 if(c>D){W3.cine=false;cineUI(false);W3.ph='arrive';W3.arriveT=t;toast('THE ABYSSAL REALM');if(!MP.client)W3.hostPhase('entrance',2.2)}}
W3.cineTick=function(t,dt){if(cam.fov!==55){cam.fov=55;cam.updateProjectionMatrix()}if(W3.ph==='cave')caveTick(t,dt);else if(W3.ph==='load')loadTick(t,dt);else if(W3.ph==='reveal')revealTick(t,dt);else if(W3.ph==='film'||FILM.on)filmTick(t,dt);else{W3.cine=false;cineUI(false)}};

// ---------------------------------------------------------------- FILM: cinematic camera work in the realm (the arrival, his entrance, the phase changes, his fall)
// A film is a list of shots. Each shot is a camera move (eased, through a curve of points; points can follow moving things), shots can
// blend into each other instead of cutting, a shot can hold until something happens (he lands), and the end hands the camera back to you
// by easing into exactly where the game camera wants to be. The realm, the Tyrant and the effects keep living while it plays.
const FILM={on:false,shots:[],i:0,s0:0,t0:0,opt:null,last:null,from:null,hand:0};
const EZ={io:k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2,o:k=>1-Math.pow(1-k,3),i:k=>k*k*k,l:k=>k,s:k=>k*k*(3-2*k),o2:k=>1-(1-k)*(1-k)};
// where the game camera wants to be right now (the same rule as the game's own camera, without its shake)
function gameCamPose(){if(DUEL.on&&!fpCam&&!bossCam)return duelCamPose();const mech=L2.on&&L2.mechOn,dst=camDist*(mech?2.5:1)*(W3.on?W3.camMul():1),pit=camPitch,h=hero.position;
 const p=new V3(h.x+Math.sin(camYaw)*Math.cos(pit)*dst,h.y+Math.sin(pit)*dst+2,h.z+Math.cos(camYaw)*Math.cos(pit)*dst);p.y=Math.max(p.y,heightAt(p.x,p.z)+1.2);
 const ly=h.y+(mech?7.8*MECH_BIG*.75:(gogo?4.4:2.2)*sizeMul())+Math.max(0,-camPitch)*48+(W3.on?W3.lookUp():0);return {p,l:new V3(h.x,ly,h.z),fov:W3.fovT?W3.fovT():55}}
const fpt=(v,k)=>typeof v==='function'?v(k):Array.isArray(v)?new V3(v[0],v[1],v[2]):v.clone();
function curvePt(list,e,k){if(list.length===1)return fpt(list[0],k);if(list.length===2)return fpt(list[0],k).lerp(fpt(list[1],k),e);
 const P=list.map(v=>fpt(v,k));return new THREE.CatmullRomCurve3(P,false,'centripetal').getPoint(e)}
function shotPose(s,k){const e=(EZ[s.ease||'io'])(clampN(k,0,1));const p=curvePt(s.p,e,k),l=curvePt(s.l,s.lease?(EZ[s.lease])(clampN(k,0,1)):e,k);
 const f=Array.isArray(s.fov)?lerpN(s.fov[0],s.fov[1],e):(s.fov||55);return {p,l,fov:f}}
function poseMix(a,b,k){return {p:a.p.clone().lerp(b.p,k),l:a.l.clone().lerp(b.l,k),fov:lerpN(a.fov,b.fov,k)}}
// start a film: shots = [{d, p:[...], l:[...], fov, ease, blend, until, shake, at(c)}], opt = {fromGame, toGame (seconds), onEnd, ph}
function filmPlay(shots,opt){if(!shots||!shots.length)return;FILM.on=true;FILM.shots=shots;FILM.i=0;FILM.t0=now();FILM.s0=FILM.t0;FILM.opt=opt||{};FILM.hand=0;
 FILM.from=FILM.opt.fromGame?gameCamPose():null;FILM.last=null;shots.forEach(s=>{s.fired=false});W3.cine=true;FILM.prevPh=W3.ph;W3.ph='film';cineUI(true);sub('')}
function filmEnd(){if(!FILM.on)return;FILM.on=false;W3.cine=false;cineUI(false);W3.ph=FILM.opt.ph||FILM.prevPh||'fight';if(W3.ph==='film')W3.ph='fight';sub('');const f=FILM.opt.onEnd;FILM.opt={};if(f)try{f()}catch(e){console.error('film end',e)}}
function filmStop(){if(FILM.on){FILM.opt.onEnd=null;filmEnd()}}
// the people in the realm keep breathing while the camera does its work
function filmActors(t,dt){const A=(CV.A&&CV.A.length)?CV.A:[{o:hero,cg:heroCG,isMe:true,api:charApi,redCap:!!MP.client}];A.forEach(a=>{if(FIN.busy&&FIN.actor&&FIN.actor.o===a.o)return;walkAnim(a,t,dt,false,false)})}
function filmTick(t,dt){const S0=FILM.shots;let s=S0[FILM.i];const c=t-FILM.s0;
 // advance: a shot ends when its time is up (and its 'until' holds); its last pose is kept for the next shot's blend
 while(s&&c>=s.d&&(!s.until||s.until()||c>s.d+6)){   // a held shot never waits more than six seconds (nothing can leave you stuck in a film)
FILM.last=shotPose(s,1);FILM.i++;FILM.s0=t;s=S0[FILM.i];if(s)s.fired=false;break}
 if(s&&!s.fired&&s.at){s.fired=true;try{s.at()}catch(e){}}
 // the realm, the Tyrant (his brain keeps running on the host), the effects
 abyssTick(t,dt);pillarsTick(t,dt);fxTick(t,dt);riftTick(t);if(B.ty)tyFrame(t,dt);rewardTick(t,dt);if(AB.glowBoost){AB.glowBoost=Math.max(0,AB.glowBoost-dt*1.4);AB.glowM.opacity=Math.min(1,AB.glowM.opacity+AB.glowBoost*.2)}filmActors(t,dt);try{duelFilmTick(t,dt)}catch(e){if(!W3._duelErr2){W3._duelErr2=1;console.error('duel film',e)}}
 let pose;
 if(s){const k=Math.min(1,(t-FILM.s0)/s.d);pose=shotPose(s,k);const src=FILM.i===0?FILM.from:FILM.last;if(src&&s.blend){const b=sstep(0,s.blend,t-FILM.s0);if(b<1)pose=poseMix(src,pose,b)}
  if(s.shake){const a=typeof s.shake==='function'?s.shake(k):s.shake;pose.p.x+=(Math.random()-.5)*a;pose.p.y+=(Math.random()-.5)*a;pose.p.z+=(Math.random()-.5)*a}}
 else{// handing back to the game camera
  const H=FILM.opt.toGame||0;FILM.hand+=dt;const g=gameCamPose();pose=H>0&&FILM.last?poseMix(FILM.last,g,EZ.s(clampN(FILM.hand/H,0,1))):g;if(FILM.hand>=H){FILM.last=null;cam.position.copy(g.p);cam.lookAt(g.l);filmEnd();return}}
 // the game's shake still reads through a film (a little)
 const sk=Math.min(1.2,shake*shake)*.5;if(sk>.01){pose.p.x+=(Math.random()-.5)*sk;pose.p.y+=(Math.random()-.5)*sk*.7;pose.p.z+=(Math.random()-.5)*sk}shake=Math.max(0,shake-dt*2.2);
 cam.position.copy(pose.p);cam.lookAt(pose.l);if(Math.abs(cam.fov-pose.fov)>.01){cam.fov=pose.fov;cam.updateProjectionMatrix()}
 if(W3._noRender)return;lbPre(S,cam,heroPos);try{if(composer)composer.render();else R.render(S,cam)}finally{lbPost()}}
// ---- moving targets for shots
const tyHead=(dy)=>()=>{try{const p=TY.head.getWorldPosition(new V3());p.y+=dy||0;return p}catch(e){return new V3(B.px,40,B.pz)}};
const tyAt=(y)=>()=>new V3(B.px,(B.y||0)+(y||0),B.pz);
const heroAt=(dx,dy,dz)=>()=>new V3(hero.position.x+(dx||0),hero.position.y+(dy||0),hero.position.z+(dz||0));
// ---------------------------------------------------------------- THE ARRIVAL: out of deep space, past drifting rock, over his fortress and down into the courtyard behind you
function filmArrival(){const H=heroAt(0,0,0)();ambStart();
 filmPlay([
  {d:5.2,ease:'o2',fov:[46,50],p:[[1900,640,2250],[1250,420,1500],[760,270,920]],l:[[0,40,-120],[0,60,-160],[0,80,-200]],at:()=>{setTimeout(()=>{$('w3title').style.opacity=1},900);setTimeout(()=>{$('w3title').style.opacity=0},5600)}},
  {d:4.6,ease:'io',fov:[50,58],p:[[760,270,920],[420,170,470],[150,96,250],[H.x+60,48,H.z+70]],l:[[0,80,-200],[0,110,-260],[0,60,-120],[H.x*.5,20,H.z*.4]]},
  {d:2.4,ease:'io',fov:[58,55],blend:.3,p:[[H.x+60,48,H.z+70],()=>gameCamPose().p],l:[[H.x*.5,20,H.z*.4],()=>gameCamPose().l]}
 ],{toGame:.6,ph:'arrive',onEnd:()=>{W3.arriveT=now();toast('THE ABYSSAL REALM');if(!MP.client)W3.hostPhase('entrance',1.6)}})}
// ---------------------------------------------------------------- HIS ENTRANCE: the sky splits, he falls, the courtyard breaks under him, he rises and roars
function filmEntrance(){const H=hero.position.clone();
 filmPlay([
  // the sky above the arena tears open (you look up from where you stand)
  {d:2.7,ease:'s',fov:[60,64],p:[[H.x+8,6,H.z+18],[H.x+5,8,H.z+12]],l:[[0,120,-20],[0,280,-10]],blend:.7},
  // he drops through: the camera, low at the edge of the courtyard, follows him all the way down
  {d:1.2,ease:'io',fov:[58,52],p:[[70,14,120],[58,10,104]],l:[tyAt(30),tyAt(26)],until:()=>B.st!=='fall'},
  // the courtyard shatters under him; he rises out of the dust (a slow push in, circling)
  {d:2.6,ease:'o',fov:[48,42],p:[[44,6,70],[30,9,58],[18,12,54]],l:[tyAt(22),tyHead(-6)],shake:k=>Math.max(0,1-k*2)*2.2},
  // his face as he roars
  {d:2.3,ease:'io',fov:[34,30],p:[()=>{const h=tyHead(0)();return new V3(h.x+Math.sin(B.a)*34+10,h.y-3,h.z+Math.cos(B.a)*34+6)},()=>{const h=tyHead(0)();return new V3(h.x+Math.sin(B.a)*27+6,h.y-5,h.z+Math.cos(B.a)*27+4)}],l:[tyHead(-2),tyHead(-3)],blend:.5}
 ],{toGame:1.3,ph:'fight'})}
// ---------------------------------------------------------------- THE PHASE CHANGES: the camera finds him and the sky while he changes (he cannot be hurt; nothing can hurt you)
function filmPhase(to,age){if((age||0)>1||FILM.on)return;const H=hero.position.clone();
 if(to===2)filmPlay([
  {d:2.4,ease:'io',fov:[52,56],blend:.6,p:[[H.x*.6+30,10,H.z*.6+30],[H.x*.5+40,22,H.z*.5+40]],l:[tyAt(24),tyAt(40)]},
  {d:1.8,ease:'io',fov:[56,62],p:[[H.x*.5+40,22,H.z*.5+40],[H.x*.5+20,30,H.z*.5+60]],l:[tyAt(40),[0,260,-300]]}
 ],{toGame:1.0,ph:'fight'});
 else filmPlay([
  {d:1.8,ease:'o',fov:[44,40],blend:.6,p:[()=>new V3(B.px+40,14,B.pz+52),()=>new V3(B.px+34,18,B.pz+46)],l:[tyHead(-4),tyHead(4)]},
  {d:2.8,ease:'l',fov:[40,46],p:[()=>new V3(B.px+34,18,B.pz+46),()=>new V3(B.px+56,22,B.pz+8),()=>new V3(B.px+40,26,B.pz-40)],l:[tyHead(0),tyHead(0)]},
  {d:1.0,ease:'o',fov:[46,60],p:[()=>new V3(B.px+40,26,B.pz-40),()=>new V3(B.px+30,40,B.pz+110)],l:[tyAt(30),tyAt(26)],shake:k=>(1-k)*2}
 ],{toGame:.8,ph:'fight'})}
// ---------------------------------------------------------------- HIS FALL: light bursts out of him, the blast, the eclipse breaking over the fortress
function filmFall(){if(FILM.on)filmStop();
 filmPlay([
  {d:3.6,ease:'l',fov:[42,38],blend:.8,p:[()=>new V3(B.px+46,16,B.pz+40),()=>new V3(B.px+52,20,B.pz-6)],l:[tyHead(-6),tyHead(-10)]},
  {d:2.6,ease:'o',fov:[50,62],p:[()=>new V3(B.px+52,20,B.pz-6),()=>new V3(B.px+120,60,B.pz+150)],l:[tyAt(10),tyAt(4)],shake:k=>(1-k)*2.4},
  {d:3.2,ease:'io',fov:[60,56],p:[()=>new V3(B.px+120,60,B.pz+150),[60,70,240]],l:[tyAt(4),[0,180,-500]]}
 ],{toGame:1.6,ph:'fight'})}

// ---------------------------------------------------------------- EFFECTS: particles (fire, sparks, glows, smoke, dust), light flashes, shockwaves, scorch marks, telegraphs
// Two pooled particle clouds drawn in one call each (additive light, and soft smoke), camera-facing on the graphics card; sparks stretch along their motion.
const FX={add:null,smk:null,lights:[],rings:[],t:0};
function fxCloud(n,additive){const g=new THREE.InstancedBufferGeometry();const q=new THREE.PlaneGeometry(1,1);g.index=q.index;g.setAttribute('position',q.attributes.position);g.setAttribute('uv',q.attributes.uv);
 const A={pos:new Float32Array(n*3),col:new Float32Array(n*4),sz:new Float32Array(n*2),rot:new Float32Array(n),vel:new Float32Array(n*3),kind:new Float32Array(n)};
 const at=(k,d)=>{const a=new THREE.InstancedBufferAttribute(A[k],d);a.setUsage(THREE.DynamicDrawUsage);return a};
 g.setAttribute('iPos',at('pos',3));g.setAttribute('iCol',at('col',4));g.setAttribute('iSz',at('sz',2));g.setAttribute('iRot',at('rot',1));g.setAttribute('iVel',at('vel',3));g.setAttribute('iKind',at('kind',1));g.instanceCount=0;
 const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false,uniforms:{uT:{value:0}},
  vertexShader:'attribute vec3 iPos;attribute vec4 iCol;attribute vec2 iSz;attribute float iRot;attribute vec3 iVel;attribute float iKind;varying vec2 vUv;varying vec4 vCol;varying float vKind;varying float vSeed;\n'+
  'void main(){vUv=uv;vCol=iCol;vKind=iKind;vSeed=fract(iRot*7.13);vec4 mv=viewMatrix*vec4(iPos,1.);vec2 c=position.xy;\n'+
  ' if(iKind>1.5&&iKind<2.5){vec3 v=(viewMatrix*vec4(iVel,0.)).xyz;float sp=length(v.xy);vec2 dir=sp>1e-4?v.xy/sp:vec2(0.,1.);float len=iSz.x*(1.+iSz.y*sp*.08);mv.xy+=vec2(dir.y,-dir.x)*c.x*iSz.x*.22+dir*c.y*len;}\n'+
  ' else{float s=sin(iRot),co=cos(iRot);mv.xy+=mat2(co,-s,s,co)*c*iSz.x;}gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform float uT;varying vec2 vUv;varying vec4 vCol;varying float vKind;varying float vSeed;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\n'+
  'void main(){vec2 p=vUv-.5;float r=length(p)*2.;float a;vec3 c=vCol.rgb;\n'+
  ' if(vKind<.5){a=exp(-r*r*3.5)*(1.-smoothstep(.8,1.,r));}\n'+
  ' else if(vKind<1.5){float q=n(vUv*3.5+vSeed*17.)*.6+n(vUv*8.+vSeed*5.)*.4;a=(1.-smoothstep(.15,1.,r+(q-.5)*.6));c=mix(c,vec3(1.,.9,.6),pow(1.-smoothstep(0.,.55,r+q*.2),2.)*.8);}\n'+
  ' else if(vKind<2.5){a=(1.-smoothstep(.0,.5,abs(p.x)*2.))*(1.-smoothstep(.25,.5,abs(p.y)));c+=vec3(.4,.3,.2)*(1.-abs(p.y)*2.);}\n'+
  ' else{float q=n(vUv*3.+vSeed*13.)*.65+n(vUv*7.-vSeed*3.)*.35;a=(1.-smoothstep(.2,1.,r+(q-.5)*.7))*(.55+.45*q);}\n'+
  ' a*=vCol.a;if(a<.004)discard;gl_FragColor=vec4(c*'+(additive?'a':'1.')+','+(additive?'a':'a')+');}'});
 const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.layers.set(1);mesh.renderOrder=additive?5:4;
 return {mesh,A,g,n,P:[],m}}
// particle: kind 0 glow dot, 1 fire puff, 2 spark streak, 3 smoke/dust (smoke goes in the soft cloud)
function fxInit(par){if(FX.add&&FX.add.mesh.parent===par)return;FX.add=fxCloud(1600,true);FX.smk=fxCloud(700,false);par.add(FX.add.mesh);par.add(FX.smk.mesh);
 // a pool of lights that always exist (the shaders never rebuild because a light came or went); flashes borrow them
 FX.lights=[];for(let i=0;i<3;i++){const L=new THREE.PointLight(0xffa060,0,1,1.6);L.position.set(0,-500,0);par.add(L);FX.lights.push({L,t0:-9,life:1,i0:0})}
 FX.rings=[]}
// one particle: o = {x,y,z, vx,vy,vz, life, s0,s1 (size), c0:[r,g,b,a], c1:[r,g,b,a], kind, grav, drag, rot, spin, stretch}
function fxP(o){const C=o.kind===3?FX.smk:FX.add;if(!C||C.P.length>=C.n)return;C.P.push({x:o.x,y:o.y,z:o.z,vx:o.vx||0,vy:o.vy||0,vz:o.vz||0,age:0,life:o.life||1,s0:o.s0||1,s1:o.s1===undefined?o.s0||1:o.s1,c0:o.c0||[1,.6,.2,1],c1:o.c1||[.5,.1,0,0],kind:o.kind||0,grav:o.grav||0,drag:o.drag||0,rot:o.rot===undefined?Math.random()*6.28:o.rot,spin:o.spin||0,st:o.stretch||0})}
const rnd=(a,b)=>a+Math.random()*(b-a);
// ready-made bursts
const FXK={
 fire(x,y,z,n,pw,sz){for(let i=0;i<n;i++){const a=Math.random()*6.28,u=Math.random()*.9+.1,s=rnd(.4,1)*pw;fxP({x:x+rnd(-1,1)*sz*.2,y:y+rnd(0,1)*sz*.2,z:z+rnd(-1,1)*sz*.2,vx:Math.cos(a)*s*(1-u),vy:s*u*1.2,vz:Math.sin(a)*s*(1-u),life:rnd(.5,1.1),s0:sz*rnd(.5,.9),s1:sz*rnd(1.2,2),c0:[1,.62,.22,1],c1:[.8,.12,.02,0],kind:1,drag:2.2,grav:-6,spin:rnd(-1,1)})}},
 sparks(x,y,z,n,pw,col){for(let i=0;i<n;i++){const a=Math.random()*6.28,e=rnd(.15,1.2),s=rnd(.5,1)*pw;fxP({x,y,z,vx:Math.cos(a)*Math.cos(e)*s,vy:Math.sin(e)*s,vz:Math.sin(a)*Math.cos(e)*s,life:rnd(.4,.9),s0:rnd(.5,1)*(pw/40),s1:.1,c0:col||[1,.8,.45,1],c1:[1,.3,.05,0],kind:2,grav:38,drag:.6,stretch:1.4})}},
 smoke(x,y,z,n,sz,col,rise){for(let i=0;i<n;i++){const a=Math.random()*6.28,s=rnd(2,7);fxP({x:x+Math.cos(a)*rnd(0,sz*.4),y:y+rnd(0,sz*.3),z:z+Math.sin(a)*rnd(0,sz*.4),vx:Math.cos(a)*s,vy:rnd(2,6)*(rise||1),vz:Math.sin(a)*s,life:rnd(1.6,3.2),s0:sz*rnd(.4,.7),s1:sz*rnd(1.4,2.4),c0:col||[.16,.11,.09,.55],c1:[.1,.07,.06,0],kind:3,drag:.9,spin:rnd(-.4,.4)})}},
 dust(x,y,z,n,r,col){for(let i=0;i<n;i++){const a=i/n*6.28+rnd(-.2,.2),s=rnd(14,34)*(r/20);fxP({x:x+Math.cos(a)*r*.3,y:y+.5,z:z+Math.sin(a)*r*.3,vx:Math.cos(a)*s,vy:rnd(1,4),vz:Math.sin(a)*s,life:rnd(1.2,2.2),s0:r*.25,s1:r*rnd(.6,.9),c0:col||[.32,.22,.17,.5],c1:[.2,.14,.11,0],kind:3,drag:2.4,spin:rnd(-.3,.3)})}},
 glow(x,y,z,s,col,life){fxP({x,y,z,life:life||.4,s0:s*.6,s1:s,c0:col||[1,.7,.4,1],c1:[1,.3,.1,0],kind:0})},
 embers(x,y,z,n,r,col){for(let i=0;i<n;i++){const a=Math.random()*6.28,rr=Math.random()*r;fxP({x:x+Math.cos(a)*rr,y:y+rnd(0,2),z:z+Math.sin(a)*rr,vx:rnd(-2,2),vy:rnd(6,16),vz:rnd(-2,2),life:rnd(1,2.2),s0:rnd(.4,.9),s1:.1,c0:col||[1,.6,.25,1],c1:[1,.2,.05,0],kind:0,drag:.4})}}};
// a flash of real light at a point (borrowed from the pool)
function fxLight(x,y,z,col,i0,dist,life){if(!FX.lights.length)return;let best=FX.lights[0];FX.lights.forEach(l=>{if(l.t0<best.t0)best=l});best.t0=now();best.life=life||.5;best.i0=i0;best.L.color.setHex(col);best.L.distance=dist||160;best.L.position.set(x,y,z)}
// a shockwave ring racing out over the floor
function fxRing(x,z,r1,col,life,w){const m=new THREE.Mesh(new THREE.RingGeometry(.9,1,96,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,uniforms:{uK:{value:0},uC:{value:new THREE.Color(col||0xffa060)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform float uK;uniform vec3 uC;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float b=1.-smoothstep(0.,.1,abs(r-.95)/.05);float a=b*(1.-uK)*(1.-uK);gl_FragColor=vec4(uC*a*1.8,a);}'}));
 m.rotation.x=-Math.PI/2;m.position.set(x,.35,z);m.layers.set(1);m.renderOrder=6;(AB.G||world).add(m);FX.rings.push({m,t0:now(),life:life||.8,r1,w:w||1})}
// every frame
function fxTick(t,dt){if(!FX.add)return;FX.t=t;dt=Math.min(dt,.05);
 [FX.add,FX.smk].forEach(C=>{const P=C.P,A=C.A;let j=0;for(let i=0;i<P.length;i++){const p=P[i];p.age+=dt;if(p.age>=p.life)continue;const k=p.age/p.life;
   p.vy-=p.grav*dt;const dr=Math.max(0,1-p.drag*dt);p.vx*=dr;p.vy*=dr;p.vz*=dr;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.2&&p.kind===2){p.y=.2;p.vy*=-.3;p.vx*=.6;p.vz*=.6}p.rot+=p.spin*dt;
   P[j++]=p;const o3=(j-1)*3,o4=(j-1)*4,o2=(j-1)*2;A.pos[o3]=p.x;A.pos[o3+1]=p.y;A.pos[o3+2]=p.z;A.vel[o3]=p.vx;A.vel[o3+1]=p.vy;A.vel[o3+2]=p.vz;
   for(let q=0;q<4;q++)A.col[o4+q]=p.c0[q]+(p.c1[q]-p.c0[q])*k;A.sz[o2]=p.s0+(p.s1-p.s0)*k;A.sz[o2+1]=p.st;A.rot[j-1]=p.rot;A.kind[j-1]=p.kind}
  P.length=j;C.g.instanceCount=j;['iPos','iCol','iSz','iRot','iVel','iKind'].forEach(a=>{const at=C.g.attributes[a];at.needsUpdate=true;at.updateRange.offset=0;at.updateRange.count=j*at.itemSize});C.m.uniforms.uT.value=t});
 FX.lights.forEach(l=>{const k=(t-l.t0)/l.life;l.L.intensity=k>=0&&k<1?l.i0*(1-k)*(1-k):0;if(k>=1)l.L.position.y=-500});
 FX.rings=FX.rings.filter(R=>{const k=(t-R.t0)/R.life;if(k>=1){if(R.m.parent)R.m.parent.remove(R.m);R.m.geometry.dispose();R.m.material.dispose();return false}const r=2+R.r1*(1-Math.pow(1-k,2.2));R.m.scale.set(r,r,1);R.m.material.uniforms.uK.value=k;return true})}
// ---- an impact, in full: flash, light, shockwave, fire, sparks, dust, smoke (pw: 0.5 small .. 2 enormous)
function fxImpact(x,z,pw,col){const c=col||0xff8a3a;FXK.glow(x,4*pw,z,40*pw,[1,.75,.45,1],.35);fxLight(x,10*pw,z,c,6*pw,140*pw,.55);fxRing(x,z,40*pw,c,.75);
 FXK.fire(x,1,z,Math.round(14*pw),28*pw,9*pw);FXK.sparks(x,2,z,Math.round(22*pw),40*pw);FXK.dust(x,0,z,Math.round(12*pw),18*pw);FXK.smoke(x,2,z,Math.round(6*pw),14*pw)}
// ---------------------------------------------------------------- TELEGRAPHS, redrawn: a dark-red field, a bright rune-dashed border, and a fill that sweeps out until the blow lands
// shape 0: round (circle, ring, sector: radius in uv), 1: a strip (uv.y along its length)
function teleMat(shape,inner){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8,side:THREE.DoubleSide,
 uniforms:{uP:{value:0},uT:{value:0},uS:{value:shape||0},uIn:{value:inner||0},uC:{value:new THREE.Color(0xff0c06)},uA0:{value:0},uA1:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uP;uniform float uT;uniform float uS;uniform float uIn;uniform vec3 uC;uniform float uA0;uniform float uA1;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\n'+
 'void main(){float d,along,fillv;vec2 p=vUv-.5;\n'+
 ' if(uS<.5){float r=length(p)*2.;d=min(1.-r,uIn>0.?r-uIn:9.);float an=atan(p.y,p.x);along=an*6.;fillv=uIn>0.?(r-uIn)/(1.-uIn):r;if(uA1>uA0){float d0=mod(an-uA0+3.14159,6.28318)-3.14159,d1=mod(uA1-an+3.14159,6.28318)-3.14159;d=min(d,r*sin(clamp(min(d0,d1),0.,1.57)));}}\n'+
 ' else{d=min(min(vUv.x,1.-vUv.x)*4.,min(vUv.y,1.-vUv.y)*12.);along=vUv.y*30.;fillv=vUv.y;}\n'+
 ' if(d<0.)discard;float pulse=.6+.4*sin(uT*(8.+uP*14.));\n'+
 ' float border=1.-smoothstep(.0,.035,d);float dash=step(.45,fract(along*1.5-uT*1.2));float runes=(1.-smoothstep(.04,.06,d))*smoothstep(.035,.045,d)*dash;\n'+
 ' float filled=step(fillv,uP);float lead=(1.-smoothstep(0.,.05,abs(fillv-uP)))*step(.02,uP);float tex=n(vUv*22.+uT*.3)*.5+n(vUv*55.)*.5;\n'+
 ' float a=.16+.08*tex+filled*(.30+.12*tex)+border*(.9*pulse+.35)+runes*.7+lead*.9;vec3 c=mix(uC,vec3(1.,.82,.62),lead*.75+border*.45);if(uP>.85){float fl=.5+.5*sin(uT*40.);a*=1.+fl*.7;c=mix(c,vec3(1.,.95,.85),fl*.5);}\n'+
 ' gl_FragColor=vec4(c*a,a);}'})}
// ---------------------------------------------------------------- HIS WEAPON'S TRAIL: a ribbon of fire following the blade through every swing
const TRAIL={N:22,mesh:null,hist:[],on:0};
function trailInit(par){if(TRAIL.mesh&&TRAIL.mesh.parent===par)return;const N=TRAIL.N,g=new THREE.BufferGeometry(),P=new Float32Array(N*2*3),U=new Float32Array(N*2*2),I=[];
 for(let i=0;i<N;i++){U[i*4]=i/(N-1);U[i*4+1]=0;U[i*4+2]=i/(N-1);U[i*4+3]=1;if(i<N-1){const a=i*2,b=a+1,c=a+2,d=a+3;I.push(a,b,c,b,d,c)}}
 g.setAttribute('position',new THREE.BufferAttribute(P,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.setIndex(I);
 const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,uniforms:{uA:{value:0},uT:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform float uA;uniform float uT;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\n'+
  'void main(){float age=vUv.x;float edge=vUv.y;float q=n(vec2(age*9.-uT*4.,edge*3.));float a=pow(1.-age,1.6)*smoothstep(0.,.35,edge)*(.55+.45*q)*uA;vec3 c=mix(vec3(1.,.25,.05),vec3(1.,.85,.55),pow(edge,3.)*(1.-age));gl_FragColor=vec4(c*a*1.5,a);}'});
 const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.layers.set(1);mesh.renderOrder=6;par.add(mesh);TRAIL.mesh=mesh;TRAIL.hist=[]}
function trailTick(t,dt,swinging){if(!TRAIL.mesh||!TY.weapon||!TY.hand)return;const W=TY.weapon;
 if(!TY.wTip){const g=W.geometry,P=g.attributes.position;W.updateMatrixWorld(true);const inv=W.matrixWorld.clone().invert(),h=TY.hand.getWorldPosition(new V3()).applyMatrix4(inv);let best=0,bi=0;for(let i=0;i<P.count;i+=2){const dx=P.getX(i)-h.x,dy=P.getY(i)-h.y,dz=P.getZ(i)-h.z,d=dx*dx+dy*dy+dz*dz;if(d>best){best=d;bi=i}}TY.wTip=new V3().fromBufferAttribute(P,bi);TY.wMid=h.clone().lerp(TY.wTip,.4)}
 TRAIL.on+=((swinging?1:0)-TRAIL.on)*Math.min(1,dt*(swinging?14:5));const tip=TY.wTip.clone().applyMatrix4(W.matrixWorld),mid=TY.wMid.clone().applyMatrix4(W.matrixWorld);
 TRAIL.hist.unshift([mid,tip]);if(TRAIL.hist.length>TRAIL.N)TRAIL.hist.length=TRAIL.N;const P=TRAIL.mesh.geometry.attributes.position;
 for(let i=0;i<TRAIL.N;i++){const s=TRAIL.hist[Math.min(i,TRAIL.hist.length-1)];P.setXYZ(i*2,s[0].x,s[0].y,s[0].z);P.setXYZ(i*2+1,s[1].x,s[1].y,s[1].z)}P.needsUpdate=true;
 TRAIL.mesh.material.uniforms.uA.value=TRAIL.on;TRAIL.mesh.material.uniforms.uT.value=t;TRAIL.mesh.visible=TRAIL.on>.01}
// a sheet or column of light: brightest at its base, fading upward, streaks of energy climbing it (for walls of force, pillars, eruptions)
function sheetMat(col,a,speed){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.FrontSide,uniforms:{uT:{value:0},uA:{value:a===undefined?1:a},uC:{value:new THREE.Color(col)},uS:{value:speed||1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;uniform float uA;uniform vec3 uC;uniform float uS;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\n'+
 'void main(){float y=vUv.y;float fade=pow(1.-y,1.8);float s=n(vec2(vUv.x*26.,y*3.-uT*uS*1.6))*.6+n(vec2(vUv.x*61.,y*7.-uT*uS*2.7))*.4;float edge=1.-smoothstep(0.,.08,y);float a=(fade*(.45+.55*s)+edge*.8)*uA;gl_FragColor=vec4(uC*a,a);}'})}
// the beam laid along the floor: a white-hot core in a violet glow, energy rushing outward along it
function beamFloorMat(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,uniforms:{uT:{value:0},uL:{value:100},uA:{value:1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;uniform float uL;uniform float uA;varying vec2 vUv;void main(){float ac=abs(vUv.x-.5)*2.;float core=exp(-ac*ac*38.);float glow=exp(-ac*ac*3.5)*(1.-smoothstep(.85,1.,ac));float f=fract(vUv.y*uL/14.-uT*3.4);float st=smoothstep(0.,.08,f)*(1.-smoothstep(.08,.45,f));\n'+
 'float tip=1.-smoothstep(.93,1.,vUv.y);vec3 c=vec3(.62,.3,1.)*glow+vec3(1.,.92,1.)*core*1.7+vec3(.95,.7,1.)*st*glow*.7;float a=(glow*.75+core)*tip*uA;gl_FragColor=vec4(c*a,a);}'})}
// a black star's accretion disk: a swirl of violet fire around a white-hot rim
function diskMat(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,uniforms:{uT:{value:0},uA:{value:1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;uniform float uA;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}\n'+
 'void main(){vec2 p=vUv-.5;float r=length(p)*2.;if(r>1.)discard;float a=atan(p.y,p.x);float sw=n(vec2(a*3.+r*6.-uT*2.4,r*5.))*.65+n(vec2(a*7.-uT*3.1,r*11.))*.35;float rim=exp(-pow((r-.36)/.035,2.));float body=smoothstep(.32,.42,r)*(1.-smoothstep(.55,1.,r));\n'+
 'vec3 c=vec3(.55,.2,.95)*body*(.4+.9*sw)+vec3(1.,.9,1.)*rim*1.6;float al=(body*(.35+.6*sw)+rim)*uA;gl_FragColor=vec4(c*al,al);}'})}

// ---------------------------------------------------------------- THE TYRANT'S POWERS
// Big telegraphed attacks that play out the same on every screen. The host starts a power with its parameters (seeded and rounded);
// its snapshot carries every live power (id, kind, age, params) to the other players, who build the same effects on their own clock.
// Every player is hurt by what they see: each machine checks only its own hero against the same shapes the effects draw.
// Each power: wind-up with a telegraph -> active -> recovery; the brain adds a cooldown per power.
const MX={list:[],seen:new Set(),id:0,stats:{dodges:0,hits:0}};
const MXK=['stomp','riftslam','meteors','beam','summon','charge','gravity','wrath','vents'];
const MXD={};
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
function mxRand(seed){let s=(seed|0)%2147483647;if(s<=0)s+=2147483646;return ()=>{s=s*16807%2147483647;return (s-1)/2147483646}}
function mxStart(kind,P){const m={id:(MP.client?0:1e6)+(++MX.id),kind,t0:now(),P:P||{},fx:[],hits:{},done:false};MX.list.push(m);MX.seen.add(m.id);if(kind!=='vents')AB.runePulse=now();try{MXD[kind].build(m)}catch(e){console.error('power '+kind,e)}return m}
function mxTick(t,dt){MX.list=MX.list.filter(m=>{if(m.done)return false;const D=MXD[m.kind],k=t-m.t0;try{D.tick(m,k,t,dt)}catch(e){console.error('power '+m.kind,e)}if(k>D.dur){mxEnd(m);return false}return true});
 // his biggest moves: while the telegraph plays, the duel camera eases back and up so you see him whole and the arena he is about to fill
 {let want=0;MX.list.forEach(m=>{const k=t-m.t0;if(BIGMX[m.kind]&&k<BIGMX[m.kind])want=1});W3.bigK=(W3.bigK||0)+(want-(W3.bigK||0))*Math.min(1,dt*2.2)}}
const BIGMX={meteors:2.6,wrath:3.2,beam:2.4,gravity:2.6,summon:2.2,riftslam:1.4};
function mxEnd(m){if(m.done)return;m.done=true;try{const D=MXD[m.kind];if(D.end)D.end(m)}catch(e){}(m.deb||[]).forEach(d=>world.remove(d.o));m.deb=[];m.fx.forEach(o=>{if(o.parent)o.parent.remove(o);if(o.geometry)o.geometry.dispose()});m.fx=[]}
function mxClear(){MX.list.forEach(mxEnd);MX.list=[];TY.pose&&(TY.pose.legR=TY.pose.arms=TY.pose.lean=0)}
function mxSnap(){return MX.list.filter(m=>!m.done).map(m=>[m.id,MXK.indexOf(m.kind),r2(now()-m.t0),m.P])}
function mxApply(list){if(!Array.isArray(list))return;const t=now();list.forEach(q=>{if(!Array.isArray(q)||MX.seen.has(q[0]))return;MX.seen.add(q[0]);const kind=MXK[q[1]|0];if(!kind||!MXD[kind])return;
  const age=+q[2]||0;if(age>MXD[kind].dur)return;const m={id:q[0],kind,t0:t-age,P:q[3]||{},fx:[],hits:{},done:false};MX.list.push(m);if(kind!=='vents'&&age<.5)AB.runePulse=t-age;try{MXD[kind].build(m)}catch(e){console.error('power '+kind,e)}})}
function mxBusy(){return MX.list.some(m=>!m.done&&MXD[m.kind].blocking&&now()-m.t0<MXD[m.kind].dur)}
// ---- sounds for the powers, synthesised (no recordings exist for them): a tone that slides, a rushing noise
function sfxTone(type,f0,f1,len,vol,lp){try{const ac=audioCtx();if(!ac)return null;const T=ac.currentTime;const o=ac.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,T);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),T+len);
  const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=lp||1200;const g=ac.createGain();g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(vol,T+Math.min(.3,len*.3));g.gain.setValueAtTime(vol,T+len*.85);g.gain.linearRampToValueAtTime(0,T+len);
  o.connect(f);f.connect(g);g.connect(ac.destination);o.start(T);o.stop(T+len+.05);return {stop(){try{const t=ac.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+.08);o.stop(t+.1)}catch(e){}}}}catch(e){return null}}
const NOISE={b:null};
function sfxRush(len,vol,f0,f1){try{const ac=audioCtx();if(!ac)return;if(!NOISE.b){const b=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;NOISE.b=b}
  const T=ac.currentTime,s=ac.createBufferSource();s.buffer=NOISE.b;s.loop=true;const f=ac.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;f.frequency.setValueAtTime(f0,T);f.frequency.exponentialRampToValueAtTime(f1,T+len);
  const g=ac.createGain();g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(vol,T+len*.9);g.gain.linearRampToValueAtTime(0,T+len+.05);s.connect(f);f.connect(g);g.connect(ac.destination);s.start(T);s.stop(T+len+.1)}catch(e){}}
// ---- shared pieces
function fx(m,o,par){(par||world).add(o);m.fx.push(o);return o}
function onFloor(o,y){o.rotation.x=-Math.PI/2;o.position.y=y||.25;return o}
function heroAir(){return hero.position.y>heightAt(heroPos.x,heroPos.z)+1.3}
function meDead(){return deadT>0}
// hurt my hero once per key; and count the dodge if I was in the danger zone during the warning and got out in time
function mxHit(m,key,dmg,raw){if(m.hits[key]||meDead())return false;m.hits[key]=1;MX.stats.hits++;hurtPlayer(Math.round(raw?dmg:dmg*dmgMul()));return true}
function mxWarned(m,key,inside){if(inside&&!meDead())m['w_'+key]=1}
function mxDodge(m,key){if(m['w_'+key]&&!m.hits[key]&&!m['d_'+key]){m['d_'+key]=1;MX.stats.dodges++;if(Math.random()<.5)floatText(heroPos.x,hero.position.y+5,heroPos.z,'DODGED!','#7affc0',2.2)}}
// a flat telegraph that fills up as the blow comes (red), or a safe zone (gold)
function teleCircle(m,x,z,r){const o=new THREE.Mesh(new THREE.CircleGeometry(r,56),teleMat());onFloor(o,.22);o.position.x=x;o.position.z=z;o.layers.set(1);return fx(m,o)}
function teleRing(m,x,z,r0,r){const o=new THREE.Mesh(new THREE.RingGeometry(r0,r,64,1),teleMat(0,r0/r));onFloor(o,.22);o.position.x=x;o.position.z=z;o.layers.set(1);return fx(m,o)}
function teleRect(m,x,z,a,w,len){const g=new THREE.PlaneGeometry(w,len);g.translate(0,len/2,0);const o=new THREE.Mesh(g,teleMat(1));onFloor(o,.23);o.position.x=x;o.position.z=z;o.rotation.z=a;o.layers.set(1);return fx(m,o)}
function teleSet(o,p,t){if(!o)return;AB.teleT=t;o.material.uniforms.uP.value=clampN(p,0,1);o.material.uniforms.uT.value=t}
function glowMat(col,op){return new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op===undefined?1:op,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide})}
// a burst of light (sprite) that swells and fades
function flare(m,x,y,z,col,s0,s1,life){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:col,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));sp.position.set(x,y,z);sp.layers.set(1);fx(m,sp);sp.userData={s0,s1,life,t0:now()};(m.flares=m.flares||[]).push(sp);return sp}
function flaresTick(m){if(!m.flares)return;const t=now();m.flares=m.flares.filter(sp=>{const u=sp.userData,k=(t-u.t0)/u.life;if(k>=1){sp.visible=false;return false}const s=lerpN(u.s0,u.s1,1-Math.pow(1-k,2));sp.scale.set(s,s,1);sp.material.opacity=1-k;return true})}
// rocks thrown out of an impact (a handful, they fall and vanish)
const DEB={geo:null,mat:null};
function debris(m,x,z,n,pow){if(!DEB.geo){DEB.geo=new THREE.DodecahedronGeometry(1,0);DEB.mat=AB.rockM||new THREE.MeshStandardMaterial({color:0x5a4a52})}
 for(let i=0;i<n;i++){const o=new THREE.Mesh(DEB.geo,DEB.mat);const s=.6+Math.random()*1.6;o.scale.setScalar(s);o.position.set(x+(Math.random()-.5)*6,1,z+(Math.random()-.5)*6);o.layers.set(1);world.add(o);const a=Math.random()*6.28,v=(8+Math.random()*14)*(pow||1);
  (m.deb=m.deb||[]).push({o,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy:14+Math.random()*16*(pow||1),r:Math.random()*4,t0:now()})}}
function debrisTick(m,dt){if(!m.deb)return;const t=now();m.deb=m.deb.filter(d=>{d.vy-=38*dt;d.o.position.x+=d.vx*dt;d.o.position.y+=d.vy*dt;d.o.position.z+=d.vz*dt;d.o.rotation.x+=d.r*dt;d.o.rotation.y+=d.r*dt;
  if(d.o.position.y<.3&&d.vy<0){d.vy*=-.35;d.vx*=.6;d.vz*=.6;d.o.position.y=.3}if(t-d.t0>2.4){world.remove(d.o);return false}return true})}
function scorch(m,x,z,r){const cv=scorch.cv||(scorch.cv=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'rgba(10,4,2,.95)');gr.addColorStop(.55,'rgba(30,10,6,.7)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);return t})());
 const o=new THREE.Mesh(new THREE.CircleGeometry(r,32),new THREE.MeshBasicMaterial({map:cv,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));onFloor(o,.12);o.position.x=x;o.position.z=z;o.layers.set(1);return fx(m,o)}
// is a spot inside (or too close to) one of the braziers?
const inBraz=(x,z,pad)=>(AB.braz||[]).some(b=>Math.hypot(x-b.x,z-b.z)<b.r+(pad||0));
// my hero inside shapes
const meIn={circle:(x,z,r)=>Math.hypot(heroPos.x-x,heroPos.z-z)<r,
 rect:(x,z,a,w,len)=>{const dx=heroPos.x-x,dz=heroPos.z-z,fx_=Math.sin(a),fz=Math.cos(a),al=dx*fx_+dz*fz,sd=dx*fz-dz*fx_;return al>0&&al<len&&Math.abs(sd)<w/2}};
// ---- the boss's pose layer: a raised leg (stomp), arms up (summoning), a lean back (charging the beam). Applied on top of whatever clip plays.
TY.pose={legR:0,arms:0,lean:0,hit:0,hitA:0,side:0};
function tyPoseApply(){const P=TY.pose;if(!TY.root)return;if(!TY.pb){const f=n=>{let r=null;TY.root.traverse(o=>{if(!r&&o.name&&o.name.replace(/_\d+$/,'')===n)r=o});return r};
  TY.pb={upR:f('mixamorigRightUpLeg'),legR:f('mixamorigRightLeg'),armL:f('mixamorigLeftArm'),armR:f('mixamorigRightArm'),foreL:f('mixamorigLeftForeArm'),foreR:f('mixamorigRightForeArm'),sp:f('mixamorigSpine1'),sp2:f('mixamorigSpine2'),neck:f('mixamorigNeck'),head:f('mixamorigHead')}}
 const b=TY.pb,q=TY._pq||(TY._pq=new THREE.Quaternion()),e=TY._pe||(TY._pe=new THREE.Euler());
 const add=(bone,x,y,z)=>{if(!bone||(!x&&!y&&!z))return;e.set(x,y,z);q.setFromEuler(e);bone.quaternion.multiply(q)};
 if(P.legR>0){add(b.upR,-1.15*P.legR,0,.12*P.legR);add(b.legR,1.25*P.legR,0,0)}
 if(P.arms>0){add(b.armL,0,0,-1.1*P.arms);add(b.armR,0,0,1.1*P.arms);add(b.foreL,0,0,-.4*P.arms);add(b.foreR,0,0,.4*P.arms)}
 if(P.lean){add(b.sp,-.32*P.lean,0,0);add(b.sp2,-.22*P.lean,0,0)}
 // a big melon landing on him: his body snaps back and twists away from the side it hit, his head jerks, then he recovers (every screen)
 {const dt=TY._dt||0;P.hitA+=(P.hit-P.hitA)*Math.min(1,dt*28);P.hit=Math.max(0,P.hit-dt*2.6);const h=P.hitA;if(h>.003){add(b.sp,.13*h,.07*h*P.side,0);add(b.sp2,.1*h,.06*h*P.side,.03*h*P.side);add(b.neck,.12*h,.1*h*P.side,0);add(b.head,.16*h,.12*h*P.side,.05*h*P.side)}}
 try{if(typeof tyLegs==='function'){TY.g.updateMatrixWorld(true);tyLegs(TY._dt||0)}}catch(e){if(!TY._legErr){TY._legErr=1;console.warn('legs',e)}}}
function poseEase(key,v,dt,rate){TY.pose[key]+=(v-TY.pose[key])*Math.min(1,dt*(rate||6))}
// the sky and the runes answer the powers
function skyDark(v){if(AB.sky&&AB.sky.material.uniforms.uDark)AB.sky.material.uniforms.uDark.value=v}
function runeTint(col,k){if(!AB.glowM)return;const c=AB._runeBase||(AB._runeBase=AB.glowM.color.clone());AB.glowM.color.copy(c).lerp(new THREE.Color(col),clampN(k,0,1))}

// 1. ABYSSAL STOMP — he lifts a leg high, holds it (the circle fills), slams: the ground under him erupts and a shockwave rolls out (jump it)
MXD.stomp={dur:3.0,cd:9,blocking:true,
 start(){const fx_=Math.sin(B.a),fz=Math.cos(B.a);return {x:r1(B.px+fx_*8),z:r1(B.pz+fz*8)}},
 build(m){m.tl=teleCircle(m,m.P.x,m.P.z,30);m.rl=teleRing(m,m.P.x,m.P.z,30,34);abyssSfx('thunder',.35,0);abyssSfx('roar',.3,.05);if(!MP.client){B.st='mech';tyPlay('Idle_1',.3,1)}},
 tick(m,k,t,dt){flaresTick(m);debrisTick(m,dt);
  if(k<1.6){poseEase('legR',sstep(0,1.1,k),dt,8);teleSet(m.tl,k/1.6,t);teleSet(m.rl,k/1.6,t);mxWarned(m,'in',meIn.circle(m.P.x,m.P.z,30));if(frame%3===0)FXK.embers(m.P.x,0,m.P.z,2,28)}
  else if(!m.slam){m.slam=true;TY.pose.legR=0;shake=Math.max(shake,2.4);AB.flash=.5;abyssSfx('boom',.9,0);[m.tl,m.rl].forEach(o=>o&&(o.visible=false));
   fxImpact(m.P.x,m.P.z,1.7);FXK.dust(m.P.x,0,m.P.z,22,34);debris(m,m.P.x,m.P.z,10,1);flare(m,m.P.x,3,m.P.z,0xff7a3a,8,46,.6);
   const w=waveMake(m.P.x,m.P.z,t);B.waves.push(w);AB.glowBoost=2;W3.pillarHit(m.P.x,m.P.z,95,1);W3.kick(3);
   if(meIn.circle(m.P.x,m.P.z,30))mxHit(m,'in',30);else mxDodge(m,'in')}
  else poseEase('legR',0,dt,5)},
 end(m){TY.pose.legR=0;if(!MP.client&&B.st==='mech')B.st='idle'}};

// 2. RIFT SLAM — an overhead slam splits the floor: glowing cracks run out from the blow, pulse, then erupt (step off the lines)
MXD.riftslam={dur:4.4,cd:12,blocking:true,
 start(){const R=mxRand(Math.random()*1e9),fx_=Math.sin(B.a),fz=Math.cos(B.a),ox=r1(B.px+fx_*22),oz=r1(B.pz+fz*22),C=[];const n=5+((R()*3)|0);
  for(let i=0;i<n;i++){const a=B.a+(i-(n-1)/2)*(.55+R()*.25)+(R()-.5)*.3,len=55+R()*55;C.push([r2(a),r1(len)]);if(R()<.4){const a2=a+(R()<.5?-1:1)*(.6+R()*.5);C.push([r2(a2),r1(25+R()*30),r1(len*(.4+R()*.3))])}}
  return {x:ox,z:oz,c:C}},
 build(m){m.cr=[];if(!MP.client){B.st='mech';tyPlay('Attack_3',.18,tsMul())}},
 tick(m,k,t,dt){flaresTick(m);debrisTick(m,dt);const P=m.P,T0=1.3/tsMul();
  if(k>=T0&&!m.split){m.split=true;shake=Math.max(shake,1.8);abyssSfx('boom',.7,0);abyssSfx('crackle',.8,.05);flare(m,P.x,2,P.z,0xb070ff,6,30,.5);debris(m,P.x,P.z,8,.8);fxImpact(P.x,P.z,1.1,0xc070ff);
   P.c.forEach((q,i)=>{const a=q[0],len=q[1],off=q[2]||0,sx=P.x+Math.sin(a)*off,sz=P.z+Math.cos(a)*off;const tl=teleRect(m,sx,sz,a,7,len);
    const g=new THREE.PlaneGeometry(1.4,len);g.translate(0,len/2,0);const core=new THREE.Mesh(g,glowMat(0xd090ff,.0));onFloor(core,.3);core.position.x=sx;core.position.z=sz;core.rotation.z=a;core.layers.set(1);fx(m,core);
    m.cr.push({sx,sz,a,len,tl,core,wall:null})})}
  if(m.split){const kk=k-T0;
   m.cr.forEach(c=>{const grow=sstep(0,.45,kk);c.core.scale.y=Math.max(.01,grow);c.core.material.opacity=.4+.6*Math.abs(Math.sin(t*9))*sstep(.4,1.3,kk);teleSet(c.tl,kk/1.3,t);
    mxWarned(m,'c',meIn.rect(c.sx,c.sz,c.a,7,c.len));if(!m.erupt&&Math.random()<.35){const f=Math.random()*c.len*Math.min(1,kk/.45);FXK.embers(c.sx+Math.sin(c.a)*f,0,c.sz+Math.cos(c.a)*f,1,2,[.85,.5,1,1])}});
   if(kk>=1.3&&!m.erupt){m.erupt=true;shake=Math.max(shake,1.4);W3.pillarHit(P.x,P.z,110,.8);W3.kick(2);abyssSfx('boom',.6,0);abyssSfx('thunder',.35,.05);let hit=false;
    m.cr.forEach(c=>{c.tl.visible=false;const g=new THREE.PlaneGeometry(6,c.len);g.translate(0,c.len/2,0);const w=new THREE.Mesh(g,glowMat(0xb060ff,.6));w.position.set(c.sx,.2,c.sz);w.rotation.order='YXZ';w.rotation.y=c.a;w.rotation.x=-Math.PI/2;
     w.userData.k0=t;w.layers.set(1);fx(m,w);c.wall=w;
     const v=new THREE.Mesh(new THREE.PlaneGeometry(c.len,16),sheetMat(0xa050ff,.75,2.2));v.material.side=THREE.DoubleSide;v.geometry.translate(c.len/2,8,0);v.position.set(c.sx,0,c.sz);v.rotation.y=c.a-Math.PI/2;v.layers.set(1);fx(m,v);c.v=v;
     for(let i=0;i<4;i++){const f=(i+.5)/4*c.len,x=c.sx+Math.sin(c.a)*f,z=c.sz+Math.cos(c.a)*f;FXK.fire(x,0,z,3,22,7);FXK.sparks(x,1,z,4,30,[.9,.6,1,1]);FXK.dust(x,0,z,3,8)}fxLight(c.sx+Math.sin(c.a)*c.len*.5,8,c.sz+Math.cos(c.a)*c.len*.5,0xb060ff,4,120,.5);
     if(meIn.rect(c.sx,c.sz,c.a,7,c.len))hit=true});
    if(hit)mxHit(m,'c',26);else mxDodge(m,'c')}
   if(m.erupt){const ek=kk-1.3;m.cr.forEach(c=>{const f=Math.max(0,1-ek/1.2);if(c.v){c.v.scale.y=.2+Math.min(1,ek*5)*f;c.v.material.uniforms.uA.value=.75*f;c.v.material.uniforms.uT.value=t}if(c.wall)c.wall.material.opacity=.6*f;c.core.material.opacity*=f})}}},
 end(m){if(!MP.client&&B.st==='mech')B.st='idle'}};

// 3. METEOR APOCALYPSE — he calls the sky down: it darkens, burning rocks fall onto marked circles across the arena, a few at a time
MXD.meteors={dur:9.6,cd:26,blocking:false,
 start(){const R=mxRand(Math.random()*1e9),L=players(),T=[];const n=10+((R()*5)|0)+(B.phase>=3?4:0);
  for(let i=0;i<n;i++){let x,z;const p=L.length?L[i%L.length]:{x:0,z:0};if(i%3!==2){const a=R()*6.28,d=6+R()*26;x=p.x+Math.cos(a)*d;z=p.z+Math.sin(a)*d}else{const a=R()*6.28,d=R()*(AB.R-30);x=Math.cos(a)*d;z=Math.sin(a)*d}
   const rr=Math.hypot(x,z),mx=AB.R-14;if(rr>mx){x*=mx/rr;z*=mx/rr}T.push([r1(x),r1(z),r2(2.2+i*(5.4/n)+R()*.3)])}
  return {T}},
 build(m){m.rocks=[];bossYell('METEOR APOCALYPSE','The sky is falling. Get off the marked circles!');abyssSfx('thunder',.7,0);abyssSfx('roar',.45,.2);if(!MP.client){B.st='mech';B.mxArms=1}},
 tick(m,k,t,dt){flaresTick(m);debrisTick(m,dt);const P=m.P;
  skyDark(sstep(0,1.2,k)*(1-sstep(8.4,9.6,k)));if(k<1.8)poseEase('arms',sstep(0,1,k),dt,6);else poseEase('arms',0,dt,3);
  if(!MP.client&&k>1.9&&B.st==='mech'&&B.mxArms){B.mxArms=0;B.st='idle'}
  rocksTick(m,P.T,k,t,dt,24);
  // the scorch marks fade away near the end
  if(k>8)m.fx.forEach(o=>{if(o.material&&o.material.map===scorch.cv)o.material.opacity=Math.max(0,1-(k-8)/1.5)})},
 end(m){skyDark(0);TY.pose.arms=0;if(!MP.client&&B.st==='mech')B.st='idle'}};

// burning rocks: each lands on its marked circle (radius 11) at its time; the circle fills for 1.7 s before it lands
const ROCK={geo:null,mat:null,trail:null};
function rocksTick(m,T,k,t,dt,dmg){if(!ROCK.geo){ROCK.geo=new THREE.DodecahedronGeometry(3.2,1);ROCK.mat=new THREE.MeshStandardMaterial({color:0x2a1810,emissive:0xff4a10,emissiveIntensity:1.6,roughness:.8,flatShading:true});ROCK.trail=new THREE.ConeGeometry(2.6,26,10,1,true);ROCK.trail.translate(0,13,0)}
 m.rocks=m.rocks||[];T.forEach((q,i)=>{const x=q[0],z=q[1],ti=q[2],w0=ti-1.7;const r=m.rocks[i]||(m.rocks[i]={});
  if(k>=w0&&!r.tl){r.tl=teleCircle(m,x,z,11);if(Math.hypot(x-heroPos.x,z-heroPos.z)<90)sfxRush(1.7,.10,300,1800);const rock=new THREE.Mesh(ROCK.geo,ROCK.mat);rock.layers.set(1);rock.position.set(x+60,190,z-40);world.add(rock);r.rock=rock;m.fx.push({parent:{remove:()=>world.remove(rock)}});
   const trail=new THREE.Mesh(ROCK.trail,glowMat(0xff7a2a,.55));trail.layers.set(1);rock.add(trail);r.ax=x+60;r.az=z-40}
  if(r.tl&&!r.hit){const kk=(k-w0)/1.7;teleSet(r.tl,kk,t);mxWarned(m,'m'+i,meIn.circle(x,z,11));const e=kk*kk;r.rock.position.set(lerpN(r.ax,x,e),lerpN(190,1.5,e),lerpN(r.az,z,e));r.rock.lookAt(x,0,z);
   if(frame%2===0){const q=r.rock.position;fxP({x:q.x,y:q.y,z:q.z,vx:rnd(-2,2),vy:rnd(1,4),vz:rnd(-2,2),life:rnd(.35,.6),s0:5,s1:11,c0:[1,.6,.22,1],c1:[.7,.1,.02,0],kind:1,drag:1.5});if(frame%4===0)fxP({x:q.x,y:q.y,z:q.z,vx:rnd(-1,1),vy:rnd(0,2),vz:rnd(-1,1),life:rnd(1.2,2),s0:4,s1:12,c0:[.12,.08,.07,.45],c1:[.08,.06,.05,0],kind:3,drag:.8})}
   if(kk>=1){r.hit=true;r.tl.visible=false;r.rock.visible=false;shake=Math.max(shake,.9);abyssSfx('boom',.45,0);flare(m,x,4,z,0xff8a3a,6,34,.55);fxImpact(x,z,.85);debris(m,x,z,4,.6);scorch(m,x,z,10);
    if(meIn.circle(x,z,11))mxHit(m,'m'+i,dmg);else mxDodge(m,'m'+i)}}})}

// 4. VOID BEAM — he leans back and charges a beam in his chest, then sweeps it across part of the arena.
//    The warning shows the whole sweep; the pillars block it (hide behind one), or jump... no: get out of the sweep or behind cover.
MXD.beam={dur:6.6,cd:20,blocking:true,
 start(){const L=players(),p=L.length?L[(Math.random()*L.length)|0]:{x:0,z:0};const aim=Math.atan2(p.x-B.px,p.z-B.pz),dir=Math.random()<.5?-1:1,sw=1.5+Math.random()*.4;
  const a0=aim-dir*sw*.55,a1=aim+dir*sw*.45,cov=[];
  for(let i=0;i<3;i++){const a=lerpN(a0,a1,.2+i*.3)+(Math.random()-.5)*.12,d=52+Math.random()*44;let x=B.px+Math.sin(a)*d,z=B.pz+Math.cos(a)*d;const rr=Math.hypot(x,z),mx=AB.R-34;if(rr>mx){x*=mx/rr;z*=mx/rr}if(!inBraz(x,z,10))cov.push([r1(x),r1(z)])}
  return {x:r1(B.px),z:r1(B.pz),a0:r2(a0),a1:r2(a1),cov}},
 build(m){const P=m.P,len=165;const lo=Math.min(P.a0,P.a1),hi=Math.max(P.a0,P.a1);
  const wedge=new THREE.Mesh(new THREE.CircleGeometry(len,48,Math.PI/2-hi,hi-lo),teleMat());wedge.material.uniforms.uA0.value=Math.PI/2-hi;wedge.material.uniforms.uA1.value=Math.PI/2-lo;onFloor(wedge,.21);wedge.position.x=P.x;wedge.position.z=P.z;wedge.layers.set(1);fx(m,wedge);m.wedge=wedge;
  m.start=teleRect(m,P.x,P.z,P.a0,8,len);
  const orb=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),glowMat(0xd8a0ff,1));orb.layers.set(1);fx(m,orb);m.orb=orb;
  const bg=new THREE.CylinderGeometry(2.6,2.6,1,16,1,true);bg.rotateX(Math.PI/2);bg.translate(0,0,.5);const beam=new THREE.Mesh(bg,glowMat(0xc070ff,.8));beam.visible=false;beam.layers.set(1);fx(m,beam);m.beam=beam;
  const cg=new THREE.CylinderGeometry(.9,.9,1,12,1,true);cg.rotateX(Math.PI/2);cg.translate(0,0,.5);const core=new THREE.Mesh(cg,glowMat(0xffffff,1));beam.add(core);
  const fg=new THREE.PlaneGeometry(8.4,1);fg.rotateZ(Math.PI);fg.translate(0,-.5,0);const fl=new THREE.Mesh(fg,beamFloorMat());fl.rotation.order='YXZ';fl.rotation.x=-Math.PI/2;fl.visible=false;fl.layers.set(1);fl.renderOrder=6;fx(m,fl);m.floorB=fl;
  const wg=new THREE.PlaneGeometry(1,7);wg.translate(.5,3.5,0);const wl=new THREE.Mesh(wg,sheetMat(0xb070ff,.55,2));wl.material.side=THREE.DoubleSide;wl.visible=false;wl.layers.set(1);fx(m,wl);m.wallB=wl;
  m.cov=(P.cov||[]).map(q=>{const g=new THREE.Group();g.position.set(q[0],-16,q[1]);g.rotation.y=Math.atan2(P.x-q[0],P.z-q[1]);
   const slab=new THREE.Mesh(new THREE.BoxGeometry(14,13,3),AB.mats?AB.mats.stone:new THREE.MeshStandardMaterial({color:0x8a7a90}));slab.position.y=6.5;g.add(slab);
   const face=new THREE.Mesh(new THREE.PlaneGeometry(11,9),glowMat(0xffd27a,.55));face.position.set(0,6.5,1.56);g.add(face);const back=new THREE.Mesh(new THREE.PlaneGeometry(11,9),glowMat(0xffe0a0,.35));back.position.set(0,6.5,-1.56);back.rotation.y=Math.PI;g.add(back);
   const cap=new THREE.Mesh(new THREE.BoxGeometry(14.6,.8,3.6),glowMat(0xffe7a0,.9));cap.position.y=13.2;g.add(cap);
   g.traverse(o=>o.layers.set(1));fx(m,g);return {g,x:q[0],z:q[1]}});
  bossYell('VOID BEAM','Hide behind a golden barrier, or get out of the sweep!');abyssSfx('thunder',.4,0);abyssSfx('charge',.5,.1,2.2);if(!MP.client){B.st='mech';tyPlay('Idle_2',.3,1)}},
 tick(m,k,t,dt){flaresTick(m);const P=m.P;let src=new V3(P.x,24,P.z);try{src=TY.chest.getWorldPosition(new V3());src.y+=2}catch(e){}
  // the barriers rise out of the floor, stand through the sweep, then sink; you cannot walk through them
  if(m.cov)m.cov.forEach(c=>{c.g.position.y=-16+16*sstep(.2,1.3,k)*(1-sstep(5.9,6.5,k));if(c.g.position.y>-6){const dx=heroPos.x-c.x,dz=heroPos.z-c.z,d=Math.hypot(dx,dz);if(d<6.2&&d>.01){heroPos.x=c.x+dx/d*6.2;heroPos.z=c.z+dz/d*6.2}}});
  // wind-up: lean back, the orb swells, the warning fills
  if(k<2.4){poseEase('lean',1,dt,4);m.orb.position.copy(src);if(frame%2===0){const a=Math.random()*6.28,e=rnd(-.8,.8),d=rnd(14,26),px=src.x+Math.cos(a)*Math.cos(e)*d,py=src.y+Math.sin(e)*d,pz=src.z+Math.sin(a)*Math.cos(e)*d;fxP({x:px,y:py,z:pz,vx:(src.x-px)*1.6,vy:(src.y-py)*1.6,vz:(src.z-pz)*1.6,life:.6,s0:1.4,s1:.4,c0:[.8,.55,1,1],c1:[1,1,1,0],kind:0})}m.orb.scale.setScalar(.5+sstep(0,2.4,k)*4.5+Math.sin(t*30)*.3);teleSet(m.wedge,k/2.4*.6,t);teleSet(m.start,k/2.4,t);
   if(!MP.client)B.a+=angN(P.a0-B.a)*Math.min(1,dt*3);mxWarned(m,'b',beamCovers(P,P.a0,P.a1))}
  else if(k<5.6){if(!m.sndOn&&k<5.4){m.sndOn=1;m.snd=sfxTone('sawtooth',58,46,5.6-k,.09,700)}const kk=(k-2.4)/3.2,a=lerpN(P.a0,P.a1,sstep(0,1,kk));poseEase('lean',-.25,dt,6);m.start.visible=false;teleSet(m.wedge,.6+.4*kk,t);
   if(!MP.client)B.a=a;const len=beamLen(P.x,P.z,a,P.cov);const dir=new V3(Math.sin(a),0,Math.cos(a));const end=new V3(P.x,0,P.z).addScaledVector(dir,len);const g0=new V3(P.x,1.5,P.z).addScaledVector(dir,Math.min(14,len));
   m.beam.visible=true;m.beam.position.copy(src);m.beam.lookAt(g0);const pul=1+Math.sin(t*40)*.12;m.beam.scale.set(pul,pul,src.distanceTo(g0));m.orb.scale.setScalar(4+Math.sin(t*25)*.4);
   const fl=m.floorB,fk=Math.max(1,len-Math.min(14,len));fl.visible=true;fl.position.copy(g0);fl.position.y=1.2;fl.rotation.y=a;fl.scale.set(pul,fk,1);fl.material.uniforms.uT.value=t;fl.material.uniforms.uL.value=fk;
   const wl=m.wallB;wl.visible=true;wl.position.set(g0.x,0,g0.z);wl.rotation.y=a-Math.PI/2;wl.scale.set(fk,1+Math.sin(t*30)*.15,1);wl.material.uniforms.uT.value=t;
   if(frame%3===0){const f=Math.random()*fk,q=g0.clone().addScaledVector(dir,f);FXK.sparks(q.x,1,q.z,2,22,[.85,.6,1,1])}
   if(frame%2===0){FXK.sparks(end.x,1,end.z,3,34,[.9,.7,1,1]);FXK.fire(end.x,0,end.z,1,16,6);if(frame%6===0){FXK.smoke(end.x,1,end.z,1,10);fxLight(end.x,6,end.z,0xc070ff,3.2,90,.25)}if(frame%9===0){flare(m,end.x,2,end.z,0xc080ff,4,16,.35);if(len<160)scorch(m,end.x,end.z,5)}}shake=Math.max(shake,.35);
   // in the beam: a hit every quarter second (the beam stops at the first pillar in its way)
   const dx=heroPos.x-P.x,dz=heroPos.z-P.z,al=dx*dir.x+dz*dir.z,sd=Math.abs(dx*dir.z-dz*dir.x);
   if(al>0&&al<len&&sd<4.2&&!meDead()){const key='b'+Math.floor(k*4);if(!m.hits[key]){m.hits[key]=1;m.hitAny=1;MX.stats.hits++;hurtPlayer(Math.round(9*dmgMul()))}}}
  else{m.beam.visible=false;m.orb.visible=false;m.wedge.visible=false;m.floorB.visible=false;m.wallB.visible=false;poseEase('lean',0,dt,4);if(!m.dodgeDone){m.dodgeDone=1;if(!m.hitAny&&m.w_b)MX.stats.dodges++}}},
 end(m){TY.pose.lean=0;if(m.snd)m.snd.stop();if(!MP.client&&B.st==='mech')B.st='idle'}};
// how far the beam reaches along angle a before a pillar stops it
function beamLen(x,z,a,cov){let L=165;const fx_=Math.sin(a),fz=Math.cos(a);const blk=(px,pz,r)=>{const dx=px-x,dz=pz-z,al=dx*fx_+dz*fz;if(al<=0||al>L)return;const sd=Math.abs(dx*fz-dz*fx_);if(sd<r)L=Math.min(L,al-Math.sqrt(r*r-sd*sd))};
 (AB.pillars||[]).forEach(p=>{if(!p.down)blk(p.x,p.z,p.r)});(AB.braz||[]).forEach(b=>blk(b.x,b.z,b.r));(cov||[]).forEach(q=>blk(q[0],q[1],7));return L}
function beamCovers(P,a0,a1){const a=Math.atan2(heroPos.x-P.x,heroPos.z-P.z),lo=Math.min(a0,a1),hi=Math.max(a0,a1);const aa=lo+angN(a-lo);return aa>=lo&&aa<=hi&&Math.hypot(heroPos.x-P.x,heroPos.z-P.z)<165}

// 5. SUMMONED MINIONS — he raises his arms, rifts tear open on the floor and his creatures climb out (a few, never a flood)
MXD.summon={dur:5.4,cd:24,blocking:true,
 start(){const R=mxRand(Math.random()*1e9),L=players(),pts=[];const n=6;const kinds=['zombie','redcap','toast','tiki'];
  for(let i=0;i<n;i++){const base=L.length?L[i%L.length]:{x:0,z:0};const a=R()*6.28,d=26+R()*20;let x=base.x+Math.cos(a)*d,z=base.z+Math.sin(a)*d;const rr=Math.hypot(x,z),mx=AB.R-20;if(rr>mx){x*=mx/rr;z*=mx/rr}
   pts.push([r1(x),r1(z),(R()*4)|0])}return {pts,n:B.phase>=3?10:8}},
 build(m){m.rf=m.P.pts.map(q=>{const o=new THREE.Mesh(new THREE.CircleGeometry(5.5,40),riftDiscMat());onFloor(o,.3);o.position.x=q[0];o.position.z=q[1];o.scale.setScalar(.01);o.layers.set(1);fx(m,o);
   const L=new THREE.PointLight(0xa040ff,0,30,1.6);L.position.set(q[0],4,q[1]);fx(m,L);return {o,L,q,spawned:0}});
  bossYell('RISE, MY CHILDREN','Rifts are opening. His creatures are coming through.');abyssSfx('thunder',.5,0);abyssSfx('shimmer',.8,.3);abyssSfx('roar',.35,0);if(!MP.client){B.st='mech';B.mxArms=1}},
 tick(m,k,t,dt){if(k<1.4)poseEase('arms',sstep(0,1,k),dt,6);else poseEase('arms',0,dt,3);if(!MP.client&&k>1.5&&B.mxArms){B.mxArms=0;if(B.st==='mech')B.st='idle'}
  m.rf.forEach((r,i)=>{const open=sstep(.3,1.1,k)*(1-sstep(4.6,5.4,k));r.o.scale.setScalar(Math.max(.01,open));r.o.material.uniforms.uT.value=t;r.L.intensity=open*3;
   if(open>.2&&frame%3===i%3)FXK.embers(r.q[0],0,r.q[1],1,5,[.8,.45,1,1]);
   if(!MP.client&&k>1.2+i*.12&&r.spawned<m.P.n&&k<4.5&&k>1.2+i*.12+r.spawned*.28){r.spawned++;mxMinion(r.q[0]+(Math.random()-.5)*4,r.q[1]+(Math.random()-.5)*4,['zombie','redcap','toast','tiki'][(r.q[2]+r.spawned)%4]);FXK.glow(r.q[0],3,r.q[1],22,[.85,.5,1,1],.35);FXK.sparks(r.q[0],1,r.q[1],10,26,[.85,.6,1,1]);FXK.dust(r.q[0],0,r.q[1],6,8)}})},
 end(m){TY.pose.arms=0;if(!MP.client&&B.st==='mech')B.st='idle'}};
function riftDiscMat(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{uT:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'uniform float uT;varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p)*2.;if(r>1.)discard;float a=atan(p.y,p.x);float sw=sin(a*5.+r*12.-uT*6.)*.5+.5;float c=(1.-smoothstep(.2,1.,r));vec3 col=mix(vec3(.05,0.,.12),vec3(.75,.35,1.),sw*(1.-r)+smoothstep(.8,1.,r)*1.5);gl_FragColor=vec4(col*c*1.4,c);}'})}
// a minion through a rift: an existing horde creature (World 2's), reusing a fallen one when it can; the snapshot carries it to everyone
function mxMinion(x,z,kind){const alive=enemies.filter(e=>e.kind&&e.hp>0).length;if(alive>=(B.phase>=3?60:50))return;
 let e=enemies.find(q=>q.kind===kind&&q.hp<=0&&q.minion&&now()-q.dead>2);
 if(!e){try{e=l2AddHorde(kind)}catch(err){console.warn('minion',err);return}e.minion=true}
 e.hp=e.mhp;e.dead=-9;e.x=e.hx=x;e.z=e.hz=z;e.state='chase';if(e.g){e.g.rotation.x=0;e.g.position.set(x,0,z);e.g.visible=true}}

// 6. DIMENSIONAL CHARGE — he sinks into a rift under his feet and bursts out of the floor at a marked spot near one of you
MXD.charge={dur:3.6,cd:14,blocking:true,
 start(){const L=players(),p=L.length?L[(Math.random()*L.length)|0]:{x:0,z:0};let a=Math.random()*6.28,d=9+Math.random()*7,x=0,z=0;for(let j=0;j<12;j++){x=p.x+Math.cos(a)*d;z=p.z+Math.sin(a)*d;const rr=Math.hypot(x,z),mx=AB.R-28;if(rr>mx){x*=mx/rr;z*=mx/rr}if(!inBraz(x,z,14))break;a+=.52}
  return {x0:r1(B.px),z0:r1(B.pz),x:r1(x),z:r1(z)}},
 build(m){const P=m.P;m.r0=new THREE.Mesh(new THREE.CircleGeometry(16,40),riftDiscMat());onFloor(m.r0,.32);m.r0.position.x=P.x0;m.r0.position.z=P.z0;m.r0.layers.set(1);fx(m,m.r0);
  m.r1=new THREE.Mesh(new THREE.CircleGeometry(16,40),riftDiscMat());onFloor(m.r1,.32);m.r1.position.x=P.x;m.r1.position.z=P.z;m.r1.scale.setScalar(.01);m.r1.layers.set(1);fx(m,m.r1);
  m.tl=teleCircle(m,P.x,P.z,28);abyssSfx('thunder',.45,0);abyssSfx('charge',.4,.2,1.8);if(!MP.client){B.st='mech';tyPlay('Idle_2',.2,1)}},
 tick(m,k,t,dt){flaresTick(m);debrisTick(m,dt);const P=m.P;[m.r0,m.r1].forEach(o=>o.material.uniforms.uT.value=t);
  m.r0.scale.setScalar(Math.max(.01,sstep(0,.4,k)*(1-sstep(1.1,1.6,k))));m.r1.scale.setScalar(Math.max(.01,sstep(.4,.9,k)*(1-sstep(2.6,3.4,k))));
  teleSet(m.tl,(k-.3)/1.9,t);if(k>.3&&k<2.2)mxWarned(m,'c',meIn.circle(P.x,P.z,28));if(k<1.1&&frame%2===0){FXK.dust(P.x0,0,P.z0,2,12);FXK.embers(P.x0,0,P.z0,1,12,[.8,.45,1,1])}if(k>.4&&k<2.2&&frame%3===0)FXK.embers(P.x,0,P.z,2,16,[.85,.5,1,1]);
  if(!MP.client){if(k<1.0)B.y=-sstep(.15,1.0,k)*60;else if(k<2.2){B.y=-60;B.px=P.x;B.pz=P.z;const L=players(),p=L[0];if(p)B.a=Math.atan2(p.x-P.x,p.z-P.z)}else B.y=Math.min(0,-60+(k-2.2)*260)}
  if(k>=2.2&&!m.burst){m.burst=true;m.tl.visible=false;shake=Math.max(shake,2.6);AB.flash=.7;abyssSfx('boom',1,0);abyssSfx('whoosh',.9,0);abyssSfx('roar',.4,.1);abyssSfx('thunder',.5,.1);flare(m,P.x,6,P.z,0xc070ff,10,60,.7);debris(m,P.x,P.z,12,1.1);
   fxImpact(P.x,P.z,2,0xc070ff);FXK.fire(P.x,0,P.z,14,36,12);FXK.dust(P.x,0,P.z,20,30);B.waves.push(waveMake(P.x,P.z,t));W3.pillarHit(P.x,P.z,90,1.2);W3.kick(4);if(!MP.client)tyPlay('Attack_3',.05,1.2,1.25);
   if(meIn.circle(P.x,P.z,28))mxHit(m,'c',34);else mxDodge(m,'c')}},
 end(m){if(!MP.client){B.y=0;if(B.st==='mech')B.st='idle'}}};

// 7. GRAVITY COLLAPSE — a black star forms at a marked point and drags everyone toward it; run against the pull, then it bursts
MXD.gravity={dur:5.4,cd:22,blocking:false,
 start(){const L=players();let cx=0,cz=0;L.forEach(p=>{cx+=p.x;cz+=p.z});if(L.length){cx/=L.length;cz/=L.length}const a=Math.random()*6.28,d=8+Math.random()*10;return {x:r1(cx+Math.cos(a)*d),z:r1(cz+Math.sin(a)*d)}},
 build(m){const P=m.P;m.tl=teleCircle(m,P.x,P.z,32);const core=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0x050008}));core.position.set(P.x,6,P.z);core.layers.set(1);fx(m,core);m.core=core;
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(5.6,5.6),diskMat());halo.position.copy(core.position);halo.layers.set(1);fx(m,halo);m.halo=halo;
  m.rings=[0,1,2].map(i=>{const o=new THREE.Mesh(new THREE.RingGeometry(.96,1,64),glowMat(0x9a50ff,.6));onFloor(o,.3);o.position.x=P.x;o.position.z=P.z;o.layers.set(1);fx(m,o);return o});
  bossYell('GRAVITY COLLAPSE','It is pulling you in. Run against it!');abyssSfx('thunder',.45,0);abyssSfx('drone',.9,.2);if(!MP.client){B.mxArms=1}},
 tick(m,k,t,dt){flaresTick(m);debrisTick(m,dt);const P=m.P;if(k<1)poseEase('arms',sstep(0,1,k)*.6,dt,6);else poseEase('arms',0,dt,3);if(!MP.client&&k>1&&B.mxArms)B.mxArms=0;
  const on=k>.8&&k<4.2;m.core.scale.setScalar(Math.max(.01,sstep(.2,4.2,k)*6*(k<4.2?1:0)));m.halo.lookAt(cam.position);m.halo.scale.setScalar(m.core.scale.x*1.05+Math.sin(t*12)*.08);m.halo.material.uniforms.uT.value=t;m.halo.visible=k<4.2;
  m.rings.forEach((o,i)=>{const f=((t*.6+i/3)%1);o.scale.setScalar(Math.max(.5,90*(1-f)));o.material.opacity=on?.5*f:0});
  teleSet(m.tl,(k-.8)/3.4,t);if(on&&frame%2===0)for(let i=0;i<2;i++){const a=Math.random()*6.28,d=rnd(30,80),px=P.x+Math.cos(a)*d,pz=P.z+Math.sin(a)*d;fxP({x:px,y:rnd(1,10),z:pz,vx:(P.x-px)*.9-Math.sin(a)*22,vy:rnd(0,4),vz:(P.z-pz)*.9+Math.cos(a)*22,life:1.1,s0:.9,s1:.2,c0:[.8,.6,1,1],c1:[.5,.3,1,0],kind:2,stretch:1.2})}
  // the pull: my hero drifts toward the centre (slower than you can run)
  if(on&&!meDead()){const dx=P.x-heroPos.x,dz=P.z-heroPos.z,d=Math.hypot(dx,dz);if(d>1&&d<110){const s=6.2*(1-d/130)*dt;heroPos.x+=dx/d*s;heroPos.z+=dz/d*s}mxWarned(m,'g',d<32)}
  if(k>=4.2&&!m.burst){m.burst=true;m.tl.visible=false;shake=Math.max(shake,2.2);AB.flash=.6;fxImpact(P.x,P.z,1.5,0xd0b0ff);W3.pillarHit(P.x,P.z,75,.9);W3.kick(2.5);abyssSfx('boom',.9,0);flare(m,P.x,6,P.z,0xe0c0ff,8,70,.7);debris(m,P.x,P.z,10,1);B.waves.push(waveMake(P.x,P.z,t));
   const d=Math.hypot(heroPos.x-P.x,heroPos.z-P.z);if(d<32){if(mxHit(m,'g',32)){const s=14/Math.max(1,d);heroPos.x+=(heroPos.x-P.x)*s;heroPos.z+=(heroPos.z-P.z)*s}}else mxDodge(m,'g')}},
 end(m){TY.pose.arms=0}};

// 8. TYRANT'S WRATH — the whole arena turns against you; only the golden circles are safe when he unleashes it
MXD.wrath={dur:9.2,cd:40,blocking:true,
 start(o){const L=players(),Z=[];const ok=(x,z)=>Math.hypot(x,z)<AB.R-22&&Math.hypot(x-B.px,z-B.pz)>38&&!inBraz(x,z,16)&&Z.every(q=>Math.hypot(q[0]-x,q[1]-z)>46);
  L.forEach(p=>{for(let i=0;i<30;i++){const a=Math.random()*6.28,d=24+Math.random()*26,x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d;if(ok(x,z)){Z.push([r1(x),r1(z)]);break}}});
  for(let n=0;n<60&&Z.length<3;n++){const a=Math.random()*6.28,d=40+Math.random()*(AB.R-70),x=Math.cos(a)*d,z=Math.sin(a)*d;if(ok(x,z))Z.push([r1(x),r1(z)])}
  // never fewer than one safe circle per player (fall back to a spot beside each of them)
  L.forEach((p,i)=>{if(!Z.some(q=>Math.hypot(q[0]-p.x,q[1]-p.z)<60)){let a=Math.random()*6.28;for(let j=0;j<12&&inBraz(p.x+Math.cos(a)*30,p.z+Math.sin(a)*30,16);j++)a+=.52;const x=clampN(p.x+Math.cos(a)*30,-AB.R+30,AB.R-30),z=clampN(p.z+Math.sin(a)*30,-AB.R+30,AB.R-30);Z.push([r1(x),r1(z)])}});
  const P={Z};
  // the combined form: rocks rain on the open floor (never on a safe circle, never in the last second before the blast)
  if(o&&o.combo){const T=[];P.combo=1;for(let n=0;n<80&&T.length<14;n++){const p=L.length&&n%2===0?L[n%L.length]:{x:0,z:0},a=Math.random()*6.28,d=n%2===0?8+Math.random()*30:Math.random()*(AB.R-30);
    const x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d;if(Math.hypot(x,z)>AB.R-16)continue;if(Z.some(q=>Math.hypot(q[0]-x,q[1]-z)<13+11+3))continue;T.push([r1(x),r1(z),r2(2.6+T.length*.27)])}P.T=T}
  return P},
 build(m){m.zs=m.P.Z.map(q=>{const g=new THREE.Group();g.position.set(q[0],0,q[1]);const disc=new THREE.Mesh(new THREE.CircleGeometry(13,48),glowMat(0xffe7a0,.45));onFloor(disc,.35);g.add(disc);
   const ring=new THREE.Mesh(new THREE.RingGeometry(12.4,13.4,64),glowMat(0xfff4d0,.95));onFloor(ring,.36);g.add(ring);
   const pil=new THREE.Mesh(new THREE.CylinderGeometry(12.6,12.6,110,40,1,true),sheetMat(0xffd890,.42,1.4));pil.position.y=55;g.add(pil);g.userData.pil=pil;g.scale.setScalar(.01);g.traverse(o=>o.layers.set(1));fx(m,g);return g});
  MX.list.forEach(o=>{if(o.kind==='vents'&&!o.done)mxEnd(o)});   // the floor calms so the light reads clearly
  m.cd=document.createElement('div');m.cd.style.cssText='position:fixed;left:0;right:0;top:30%;text-align:center;z-index:71;pointer-events:none;font:900 clamp(60px,12vw,140px) Bangers,Impact,sans-serif;color:#ffd27a;text-shadow:0 0 30px #ff3a0a,0 6px 0 #000;opacity:0;transition:opacity .2s';document.body.appendChild(m.cd);m.fx.push({parent:{remove:()=>m.cd.remove()}});
  if(m.P.combo)bossYell('THE END OF EVERYTHING','Reach the light — and stay off the burning circles!');else bossYell("TYRANT'S WRATH",'REACH THE LIGHT!');abyssSfx('thunder',.8,0);abyssSfx('boom',.6,.2);if(!MP.client){B.st='mech';B.mxArms=1;tyPlay('Idle_2',.3,1)}},
 tick(m,k,t,dt){flaresTick(m);debrisTick(m,dt);const T=6.8;
  poseEase('arms',k<T?sstep(0,1,k):0,dt,k<T?5:2);runeTint(0xff2a10,sstep(0,1,k)*(1-sstep(T+.6,T+2,k)));skyDark(.5*sstep(0,1,k)*(1-sstep(T+.5,T+2.2,k)));
  m.zs.forEach((g,i)=>{g.scale.setScalar(Math.max(.01,sstep(.6,1.2,k)*(1-sstep(T+.4,T+1.2,k))));g.children[1].material.opacity=.7+.3*Math.sin(t*10+i);if(g.userData.pil)g.userData.pil.material.uniforms.uT.value=t});
  if(k>.8&&k<T&&frame%3===0)m.P.Z.forEach(q=>FXK.embers(q[0],0,q[1],1,12,[1,.85,.45,1]));
  const safe=m.P.Z.some(q=>Math.hypot(heroPos.x-q[0],heroPos.z-q[1])<13);
  if(!m.snd&&k>.6&&k<T-1){m.snd=sfxTone('sawtooth',70,420,T-k,.05,900);abyssSfx('charge',.55,0,T-k);abyssSfx('roar',.5,.2)}
  if(m.P.T)rocksTick(m,m.P.T,k,t,dt,20);
  if(k>.8&&k<T){const n=Math.ceil(T-k);if(m.cd.textContent!==String(n))m.cd.textContent=String(n);m.cd.style.opacity=1;mxWarned(m,'w',!safe)}else m.cd.style.opacity=0;
  if(k>=T&&!m.blast){m.blast=true;shake=Math.max(shake,3);AB.flash=1;W3.pillarHit(0,0,400,1.4);W3.kick(5);abyssSfx('boom',1,0);abyssSfx('thunder',.9,.1);fade(.55,.08,'#ffd0a0');setTimeout(()=>fade(0,.6),120);
   for(let i=0;i<14;i++){const a=Math.random()*6.28,d=20+Math.random()*130,x=Math.cos(a)*d,z=Math.sin(a)*d;if(m.P.Z.some(q=>Math.hypot(x-q[0],z-q[1])<16))continue;FXK.fire(x,0,z,6,30,12);FXK.sparks(x,1,z,5,36);if(i%3===0){flare(m,x,5,z,0xff5a1a,8,40,.8);debris(m,x,z,3,1)}}fxLight(0,30,0,0xff6a2a,8,420,.8);fxRing(B.px,B.pz,170,0xff8a3a,1.1);B.waves.push(waveMake(B.px,B.pz,t));
   if(!safe)mxHit(m,'w',Math.round(maxHP()*.6),true);else mxDodge(m,'w')}   // a fixed share of your health on every difficulty: caught twice without healing is death
  if(!MP.client&&k>T+.5&&B.mxArms){B.mxArms=0;if(B.st==='mech')B.st='idle'}},
 end(m){TY.pose.arms=0;runeTint(0xff2a10,0);skyDark(0);if(m.cd)m.cd.remove();if(m.snd)m.snd.stop();if(!MP.client&&B.st==='mech')B.st='idle'}};

// 9. MOLTEN VENTS (phases 2 and 3, the arena itself) — spots on the floor glow orange, then lava bursts up out of them
MXD.vents={dur:4.2,cd:0,blocking:false,
 start(){const L=players(),V=[];const n=B.phase>=3?4:3;for(let i=0;i<n;i++){const p=L.length?L[i%L.length]:{x:0,z:0};let x,z,ok=false;for(let j=0;j<20&&!ok;j++){const a=Math.random()*6.28,d=10+Math.random()*40;x=p.x+Math.cos(a)*d;z=p.z+Math.sin(a)*d;ok=Math.hypot(x,z)<AB.R-16&&!inBraz(x,z,10)&&V.every(q=>Math.hypot(q[0]-x,q[1]-z)>20)}if(ok)V.push([r1(x),r1(z)])}return {V}},
 build(m){m.vs=m.P.V.map(q=>{const tl=teleCircle(m,q[0],q[1],9);const col=new THREE.Mesh(new THREE.CylinderGeometry(4.5,7,1,20,1,true),glowMat(0xff6a1a,.85));col.geometry.translate(0,.5,0);col.position.set(q[0],0,q[1]);col.scale.y=.01;col.visible=false;col.layers.set(1);fx(m,col);return {q,tl,col}})},
 tick(m,k,t,dt){flaresTick(m);debrisTick(m,dt);m.vs.forEach((v,i)=>{const[x,z]=v.q;
   if(k<2.2){teleSet(v.tl,k/2.2,t);mxWarned(m,'v'+i,meIn.circle(x,z,9));if(frame%3===i%3)FXK.embers(x,0,z,1,7)}
   else if(!v.out){v.out=true;v.tl.visible=false;v.col.visible=true;abyssSfx('boom',.35,0);flare(m,x,3,z,0xff7a2a,4,22,.5);debris(m,x,z,3,.5);fxLight(x,8,z,0xff7a2a,4,100,.7);FXK.sparks(x,1,z,10,40);if(meIn.circle(x,z,9))mxHit(m,'v'+i,18);else mxDodge(m,'v'+i)}
   if(v.out){const kk=k-2.2;v.col.scale.y=Math.max(.01,Math.sin(Math.min(1,kk/1.4)*Math.PI)*34);v.col.material.opacity=.85*(1-Math.min(1,kk/1.8));if(kk<1.2){for(let j=0;j<2;j++)fxP({x:x+rnd(-3,3),y:1,z:z+rnd(-3,3),vx:rnd(-3,3),vy:rnd(30,52),vz:rnd(-3,3),life:rnd(.5,.9),s0:6,s1:13,c0:[1,.62,.22,1],c1:[.8,.1,.02,0],kind:1,drag:1.2,grav:10});if(frame%5===0)FXK.smoke(x,20,z,1,12)}}})}};

// ---------------------------------------------------------------- THE ABYSSAL TYRANT: the fight
// The host runs his mind; everyone else plays back what the host's snapshot says (position, clip, clip time, attack, powers, phase).
// Every player is hurt by what they see on their own screen: each machine checks its own hero against the shapes it draws.
const CLIPN=['Idle_1','Idle_2','Walk','Turn_left','Turn_right','Attack_1','Attack_2','Attack_3','Attack_4','Attack_5','Hurt_1','Hurt_2','Hurt_3','Die'];
const ATK={
 cleave:{clip:'Attack_1',hit:.91,shape:'sector',r:52,half:1.35,dmg:22,cd:0,min:0,max:46},
 spin:{clip:'Attack_2',hit:1.0,shape:'ring',r:50,inner:9,dmg:20,cd:7,min:0,max:40},
 exec:{clip:'Attack_3',hit:1.3,shape:'line',len:50,w:17,dmg:28,cd:5,min:0,max:44,wave:true,open:1.7},
 impale:{clip:'Attack_4',hit:1.07,shape:'line',len:64,w:10,dmg:30,cd:4,min:14,max:58},
 leap:{clip:'Attack_5',hit:2.09,shape:'circle',r:28,dmg:34,cd:10,min:44,max:150,wave:true,open:2}};
const ATKN=Object.keys(ATK);
const TAUNTS=['KNEEL BEFORE THE ABYSS.','YOUR WORLD IS ASH.','I HAVE DEVOURED STARS.','RUN, LITTLE SPARK.','THE VOID REMEMBERS YOUR NAME.','THIS REALM WAS BUILT ON BONES LIKE YOURS.','CRAWL.'];
// the three phases: health where each begins, what he may use, how hard he pushes
const PHASES={1:{name:'THE AWAKENING',melee:1,mech:['stomp','charge'],pMech:.3,ts:1.05,dmg:1,gap:[.9,1.6]},
 2:{name:'WORLD BREAKER',from:.65,mech:['stomp','charge','riftslam','meteors','gravity','summon'],pMech:.48,ts:1.197,dmg:1.15,gap:[.6,1.2]},
 3:{name:'THE END OF EVERYTHING',from:.30,mech:['stomp','charge','riftslam','meteors','gravity','summon','beam','wrath'],pMech:.58,ts:1.344,dmg:1.3,gap:[.35,.85]}};
const BREAK_AT=.06;   // at critical health he drops to a knee: everyone's damage counts triple for a few seconds
const B={};W3.B=B;
function placeTyrantHidden(){}
function tyHPmax(){const n=1+(MP.on?Object.keys(MP.players||{}).length:0);return Math.round(5400*(L2_DIFF[L2.diff]?L2_DIFF[L2.diff].hp:1)*n)}   // (the owner: two players, twice his health)
function tySpawn(){mxClear();if(W3.envReset)W3.envReset();Object.assign(B,{ty:true,lava:false,g:TY.g,px:0,pz:0,x:0,z:0,a:Math.PI,y:420,hp:tyHPmax(),maxHp:0,R:12,AY:22,HY:20,HH:22,CY:22,st:'fall',stT:now(),atk:null,phase:1,stag:0,stagT:-9,openT:-9,tgt:null,tgtT:0,threat:{},cds:{},nextAtk:now()+3,tauntT:now()+20,dead:-9,flash:-9,meteors:[],waves:[],barT:now()+10,vy:0,landed:false,yelled:false,
  trans:null,inv:false,breaks:0,brk:null,mxNext:now()+8,lastMx:'',won:false,sunk:false,an:0,wrathN:0,comboAt:0,fightSeen:false});
 B.maxHp=B.hp;const g=TY.g;g.position.set(0,B.y,0);g.rotation.y=B.a;g.scale.setScalar(TY.SC);if(g.parent!==world)world.add(g);g.visible=true;tyPlay('Idle_2',0,1);boss=B;
 const bar=$('bossbar');if(bar){bar.style.display='block';const n=$('bossn');if(n)n.textContent='THE ABYSSAL TYRANT';const f=$('bossf');if(f)f.style.width='100%';bossNotches()}}
// the health bar shows where the next phases begin
function bossNotches(){const bg=$('bossbg');if(!bg||bg.querySelector('.w3n'))return;bg.style.position='relative';[.65,.30,BREAK_AT].forEach((v,i)=>{const n=document.createElement('i');n.className='w3n';n.style.cssText='position:absolute;top:-3px;bottom:-3px;width:3px;left:'+(v*100)+'%;background:'+(i<2?'#ffe8a0':'#7affc0')+';box-shadow:0 0 6px #000;border-radius:2px;pointer-events:none';bg.appendChild(n)})}
// ---- telegraphs: glowing red shapes on the floor that fill up until the blow lands
function teleGeo(A,k){if(A.shape==='circle')return new THREE.CircleGeometry(A.r,48);if(A.shape==='ring')return new THREE.RingGeometry(A.inner,A.r,64,1);if(A.shape==='sector'){return new THREE.CircleGeometry(A.r,40,Math.PI/2-A.half,A.half*2)}
 const g=new THREE.PlaneGeometry(A.w,A.len,1,1);g.translate(0,A.len/2,0);return g}
function teleMake(A,x,z,a){const m=new THREE.Mesh(teleGeo(A),teleMat(A.shape==='line'?1:0,A.shape==='ring'?A.inner/A.r:0));if(A.shape==='sector'){m.material.uniforms.uA0.value=Math.PI/2-A.half;m.material.uniforms.uA1.value=Math.PI/2+A.half}m.rotation.x=-Math.PI/2;m.position.set(x,.2,z);m.rotation.z=a;   // shapes point along +Y before lying flat; rotation.z turns them to face a
 m.layers.set(1);world.add(m);return m}
// local frame of an attack: origin + facing
function inShape(A,ox,oz,a,px,pz){const dx=px-ox,dz=pz-oz,fx=Math.sin(a),fz=Math.cos(a);const along=dx*fx+dz*fz,side=dx*fz-dz*fx,d=Math.hypot(dx,dz);
 if(A.shape==='circle')return d<A.r;if(A.shape==='ring')return d<A.r&&d>A.inner;if(A.shape==='sector')return d<A.r&&Math.abs(Math.atan2(side,along))<A.half;return along>0&&along<A.len&&Math.abs(side)<A.w/2}
function players(){const L=[];if(!MP_LOCAL.dead)L.push(MP_LOCAL);if(MP.on&&MP.host)for(const id in MP.players){const p=MP.players[id];if(p.st&&!p.st.dead)L.push(p.st)}return L}
// my hero only: the same rule on every screen
function selfShape(A,ox,oz,a,dmg){if(deadT>0)return false;if(inShape(A,ox,oz,a,heroPos.x,heroPos.z)){MX.stats.hits++;hurtPlayer(Math.round(dmg));return true}return false}
function dmgMul(){return (L2.dmgIn||1)*(PHASES[B.phase]?PHASES[B.phase].dmg:1)}
function tsMul(){return PHASES[B.phase]?PHASES[B.phase].ts:1}
// ---- a shockwave ring rolling out from a slam: jump it
function waveMake(x,z,t){const m=new THREE.Mesh(new THREE.TorusGeometry(1,.55,6,64),new THREE.MeshBasicMaterial({color:0xff6a2a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(x,1.2,z);m.layers.set(1);world.add(m);return {m,x,z,t,hit:false}}
function wavesTick(t){B.waves=B.waves.filter(w=>{const k=t-w.t,r=6+k*40;w.m.scale.set(r,r,Math.max(1,3-k));w.m.material.opacity=Math.max(0,1-k/2.8);
 if(!w.hit&&deadT<=0){const d=Math.hypot(heroPos.x-w.x,heroPos.z-w.z);if(Math.abs(d-r)<3.2&&!heroAir()){w.hit=true;hurtPlayer(Math.round(12*dmgMul()))}}
 if(k>2.8){world.remove(w.m);w.m.geometry.dispose();return false}return true})}
// ---- the brain
function pickTarget(t){const L=players();if(!L.length)return null;if(B.tgt&&!B.tgt.dead&&t<B.tgtT)return B.tgt;let best=null;
 if(Math.random()<.6){let bt=-1;L.forEach(p=>{const th=B.threat[p.peer||'me']||0;if(th>bt){bt=th;best=p}})}
 if(!best){let bd=1e9;L.forEach(p=>{const d=Math.hypot(p.x-B.px,p.z-B.pz);if(d<bd){bd=d;best=p}})}
 if(best!==B.tgt&&B.tgt&&MP.on)bossYell(TAUNTS[(Math.random()*TAUNTS.length)|0],'— THE ABYSSAL TYRANT');
 B.tgt=best;B.tgtT=t+rand(10,14);return best}
function chooseAttack(d,t){const ok=ATKN.filter(n=>{const A=ATK[n];return d>=A.min&&d<=A.max&&t>=(B.cds[n]||0)});if(!ok.length)return null;
 const w=ok.map(n=>n==='leap'?(B.phase===3?3:1.6):n==='cleave'?1.2:1);let s=w.reduce((a,b)=>a+b,0),r=Math.random()*s;for(let i=0;i<ok.length;i++){r-=w[i];if(r<=0)return ok[i]}return ok[0]}
// which power next: off its cooldown, allowed in this phase, sensible for the distance, never the same twice in a row
function chooseMech(d,t){const P=PHASES[B.phase];if(t<B.mxNext)return null;
 const ok=P.mech.filter(k=>t>=(B.cds['mx_'+k]||0)&&k!==B.lastMx&&!(k==='stomp'&&d>42)&&!(k==='charge'&&d<20)&&!(k==='wrath'&&B.wrathN>0&&B.hp/B.maxHp>.22)&&!(k==='summon'&&enemies.filter(e=>e.kind&&e.hp>0).length>=4));
 if(!ok.length)return null;const w=ok.map(k=>k==='wrath'?3:k==='stomp'&&d<30?2:k==='charge'&&d>60?2:1);let s=w.reduce((a,b)=>a+b,0),r=Math.random()*s;for(let i=0;i<ok.length;i++){r-=w[i];if(r<=0)return ok[i]}return ok[0]}
function startMech(k,t,opt){const D=MXD[k];const P=D.start(opt);mxStart(k,P);B.lastMx=k;if(k==='wrath')B.wrathN++;B.cds['mx_'+k]=t+D.cd/(B.phase===3?1.25:1);B.mxNext=t+D.dur*(D.blocking?.6:.35)+rand(2,4)/tsMul();B.an=(B.an|0)+1;
 if(!D.blocking)B.nextAtk=Math.max(B.nextAtk,t+1.2)}
function startAttack(n,t,tp){const A=ATK[n];const ts=tsMul()*1.35;B.st='attack';B.atk={n,t0:t,ts,done:false,ox:B.px,oz:B.pz,a:B.a,k:1,tx:tp.x,tz:tp.z};
 if(n==='leap'){const d=Math.hypot(tp.x-B.px,tp.z-B.pz);const travel=clampN(d-36,0,108);const full=2.28*TY.SC;B.atk.k=travel/full;const lx=B.px+Math.sin(B.a)*(travel+36),lz=B.pz+Math.cos(B.a)*(travel+36);B.atk.sx=lx;B.atk.sz=lz}
 tyPlay(A.clip,.18,ts);B.cds[n]=t+A.cd*(B.phase===3?.6:B.phase===2?.8:1)+A.hit/ts;
 if(n==='leap'||n==='exec')abyssSfx('roar',n==='leap'?.5:.35,0);abyssSfx('whoosh',n==='spin'?.7:.5,Math.max(0,A.hit/ts-.32));
 B.atk.tl=n==='leap'?teleMake(A,B.atk.sx,B.atk.sz,0):teleMake(A,B.px,B.pz,B.a)}
function attackTick(t,dt){const at=B.atk,A=ATK[at.n],ct=tyClipT();const hitT=A.hit;
 if(at.tl){AB.teleT=t;at.tl.material.uniforms.uP.value=Math.min(1,ct/hitT);at.tl.material.uniforms.uT.value=t;if(at.n!=='leap'){at.tl.position.set(B.px,.2,B.pz)}}
 if(at.n==='leap'&&TY.rm.Attack_5){const C=TY.rm.Attack_5;const dx=curveAt(C,C.dx,ct)*TY.SC*at.k;const step=dx-(TY.rmPrev||0);TY.rmPrev=dx;if(ct<hitT+.05){B.px+=Math.sin(B.a)*step;B.pz+=Math.cos(B.a)*step;tyClampArena()}}
 if(!at.done&&ct>=hitT){at.done=true;if(TY.cur)TY.cur.timeScale=at.ts/1.35;if(at.tl){world.remove(at.tl);at.tl=null}
  let ox=B.px,oz=B.pz;if(at.n==='leap'){ox=at.sx;oz=at.sz}
  shake=Math.max(shake,at.n==='leap'?2.6:at.n==='exec'?1.8:1.1);abyssSfx('boom',at.n==='leap'?.8:.5,0);
  {const ix=at.n==='leap'?ox:B.px+Math.sin(B.a)*(A.shape==='line'?A.len*.55:A.shape==='sector'?A.r*.5:0),iz=at.n==='leap'?oz:B.pz+Math.cos(B.a)*(A.shape==='line'?A.len*.55:A.shape==='sector'?A.r*.5:0);fxImpact(ix,iz,at.n==='leap'?2:at.n==='exec'?1.5:1)}
  selfShape(A,ox,oz,at.n==='leap'?0:B.a,A.dmg*dmgMul());
  if(A.wave||(at.n==='cleave'&&B.phase>=2))B.waves.push(waveMake(at.n==='leap'?ox:B.px+Math.sin(B.a)*20,at.n==='leap'?oz:B.pz+Math.cos(B.a)*20,t));
  if(A.open)B.openT=t+A.open}
 const dur=TY.clips[A.clip].duration;if(ct>=dur-.05){B.atk=null;B.st='idle';const g=PHASES[B.phase].gap;B.nextAtk=t+rand(g[0],g[1])*.75/tsMul();tyPlay('Idle_1',.3,1);
  // phase 3: sometimes he chains straight into a power
  if(B.phase===3&&Math.random()<.35)B.mxNext=Math.min(B.mxNext,t+.3)}}
function tyClampArena(){const r=Math.hypot(B.px,B.pz),m=AB.R-26;if(r>m){B.px*=m/r;B.pz*=m/r}}
// ---- phases: crossing a threshold holds his health there, makes him untouchable and plays the change; the next phase starts after it
function phaseLine(n){return Math.ceil(B.maxHp*PHASES[n].from)}
function phaseCheck(t){const f=B.hp/B.maxHp;
 // weak points open as he crosses a phase line: that window plays out first (up to 2.5 s; your damage in it counts), then the change
 // (the owner: the World Breaker film cut off the joints it had just told you to shoot)
 const hold=()=>{if(!(B.holdT>0))B.holdT=t;let o=false;try{o=Object.keys(wpOpen()).length>0}catch(e){}return o&&t-B.holdT<2.5};
 if(B.phase===1&&B.hp<=phaseLine(2)){B.hp=Math.max(B.hp,phaseLine(3)+1);if(hold())return;B.holdT=0;startTrans(2,t)}
 else if(B.phase===2&&B.hp<=phaseLine(3)){B.hp=Math.max(B.hp,Math.ceil(B.maxHp*BREAK_AT)+1);if(hold())return;B.holdT=0;startTrans(3,t)}
 else if(B.phase===3&&B.breaks<2&&f<=(B.breaks?BREAK_AT*.45:BREAK_AT)&&B.hp>0&&!B.brk){B.hp=Math.max(1,Math.ceil(B.maxHp*(B.breaks?BREAK_AT*.45:BREAK_AT)));startBreak(t)}}
function startTrans(to,t){mxClear();B.stag=0;B.counter=false;if(B.atk&&B.atk.tl)world.remove(B.atk.tl);B.atk=null;B.st='trans';B.trans={to,t0:t};B.inv=true;B.an=(B.an|0)+1;tyPlay(to===2?'Idle_2':'Attack_3',.25,to===2?1:.7);W3.transFx(to,0)}
function transTick(t,dt){const T=B.trans,k=t-T.t0,dur=T.to===2?5.2:6.4;
 if(T.to===3&&k>1.0&&k<1.2&&TY.curName==='Attack_3'&&TY.cur)TY.cur.timeScale=0;   // he holds the weapon high while he changes
 if(T.to===3&&k>4.4&&TY.cur&&TY.cur.timeScale===0)TY.cur.timeScale=1;
 if(k>=dur){B.phase=T.to;B.trans=null;B.inv=false;B.st='idle';B.stag=0;B.stagT=t;B.nextAtk=t+.8;B.mxNext=t+2.5;tyPlay('Idle_1',.3,1);if(T.to===3){B.lastMx='';startMech('wrath',t)}}}
// the break: on one knee, wide open; triple damage until he gets up (or dies)
function startBreak(t){mxClear();if(B.atk&&B.atk.tl)world.remove(B.atk.tl);B.atk=null;B.st='break';B.brk={t0:t};B.breaks++;B.an=(B.an|0)+1;tyPlay('Hurt_3',.15,.8);W3.breakFx(true)}
function breakTick(t,dt){const k=t-B.brk.t0;if(k>.9&&TY.cur&&TY.curName==='Hurt_3'&&TY.cur.timeScale!==0&&tyClipT()>1.2)TY.cur.timeScale=0;
 if(k>=8){B.brk=null;B.st='idle';B.stag=0;B.stagT=t;B.counter=false;if(TY.cur)TY.cur.timeScale=1;tyPlay('Idle_1',.3,1);W3.breakFx(false);bossYell('NOT. YET.','— THE ABYSSAL TYRANT');B.lastMx='';B.nextAtk=t+2;B.mxNext=t+4;if(B.breaks===1)B.comboAt=t+1.5}}
function hostBrain(t,dt){if(B.st==='dead'||B.st==='fall'||B.st==='land')return;
 if(B.st==='trans'){transTick(t,dt);return}
 if(B.st==='break'){breakTick(t,dt);return}
 phaseCheck(t);if(B.st==='trans'||B.st==='break')return;
 if(B.comboAt&&t>=B.comboAt&&!mxBusy()&&B.st!=='attack'){B.comboAt=0;startMech('wrath',t,{combo:1});return}
 // a power that holds him in place (stomp, slam, beam...) runs his body; if one was lost, never stay stuck
 if(B.st==='mech'){if(!mxBusy())B.st='idle';else return}
 // the stagger: enough damage in a short time knocks him back on his heels, and he is open to extra damage
 B.stag=Math.max(0,B.stag-B.maxHp*.03*dt);
 if(B.st!=='hurt'&&B.stag>B.maxHp*.06&&t-B.stagT>9&&!(B.atk&&B.atk.n==='leap'&&tyClipT()>.5)){if(B.atk&&B.atk.tl)world.remove(B.atk.tl);B.atk=null;B.st='hurt';B.stagT=t;B.stag=0;const h=['Hurt_1','Hurt_2','Hurt_3'][(Math.random()*3)|0];tyPlay(h,.12,1);abyssSfx('grunt',.7,0);floatText(B.x,40,B.z,'STAGGERED!','#ffd23a',6);B.counter=true;return}
 if(B.st==='hurt'){const c=TY.clips[TY.curName];if(tyClipT()>=c.duration-.05){B.st='idle';B.coreT=t+2;if(B.counter){B.counter=false;bossYell('YOU DARE?!','— THE ABYSSAL TYRANT');const tp=pickTarget(t);if(tp){B.a=Math.atan2(tp.x-B.px,tp.z-B.pz);startAttack(Math.hypot(tp.x-B.px,tp.z-B.pz)<40?'spin':'impale',t,tp)}}else tyPlay('Idle_1',.3,1)}return}
 if(B.st==='attack'){attackTick(t,dt);return}
 if(B.st==='turn'){const C=TY.yaw[TY.curName];if(C){const y=curveAt(C,C.d,tyClipT());B.a+=y-(TY.yawPrev||0);TY.yawPrev=y}if(tyClipT()>=TY.clips[TY.curName].duration-.05){B.st='idle';tyPlay('Idle_1',.2,1)}return}
 const tp=pickTarget(t);if(!tp){if(TY.curName!=='Idle_1')tyPlay('Idle_1',.4,1);return}
 const dx=tp.x-B.px,dz=tp.z-B.pz,d=Math.hypot(dx,dz),want=Math.atan2(dx,dz),off=angN(want-B.a);
 if(t>B.tauntT){B.tauntT=t+rand(24,34);bossYell(TAUNTS[(Math.random()*TAUNTS.length)|0],'— THE ABYSSAL TYRANT');abyssSfx('roar',.4,.1)}
 // a power, when one is ready
 if(t>=B.nextAtk&&!mxBusy()&&Math.random()<PHASES[B.phase].pMech+(t-B.mxNext>6?.25:0)){const k=chooseMech(d,t);if(k){B.a+=off*.7;startMech(k,t);return}}
 // turn in place when you get behind him
 if(Math.abs(off)>1.7&&d<90){B.st='turn';tyPlay(off>0?'Turn_left':'Turn_right',.2,1.56*tsMul());return}
 if(t>=B.nextAtk&&Math.abs(off)<.5){const n=chooseAttack(d,t);if(n){B.a+=off*.8;startAttack(n,t,tp);return}}
 // walk to them: the feet set the speed, so he never slides
 const ts=.62*tsMul()*1.0476*1.3;const close=d<(t>=B.nextAtk?30:24);
 B.a+=clampN(off,-1,1)*Math.min(1,dt*(close?3.15:1.57));
 if(!close){if(TY.curName!=='Walk'||Math.abs(TY.ts-ts)>.01)tyPlay('Walk',TY.curName==='Walk'?.3:.5,ts);const sp=.52*TY.SC*ts;B.px+=Math.sin(B.a)*sp*dt;B.pz+=Math.cos(B.a)*sp*dt;tyClampArena()}
 else if(TY.curName==='Walk'||TY.curName==='')tyPlay('Idle_1',.5,1)}
// ---- arrival from the sky
W3.hostPhase=function(ph,delay){setTimeout(()=>{if(!W3.on)return;W3.hph=ph;W3.hphT=now();if(ph==='entrance')entranceStart()},(delay||0)*1000)};
function entranceStart(){if(B.ty&&B.st!=='dead'&&boss===B)return;if(!W3.ready){if(!tyLoad)W3.preload();setTimeout(entranceStart,1000);return}W3.ph='entrance';W3.entT=now();
 // a rift tears open above the arena
 const m=new THREE.Mesh(new THREE.PlaneGeometry(60,380),riftMat());m.position.set(0,300,-10);m.scale.set(.01,1,1);m.layers.set(1);world.add(m);W3.bigRift=m;W3.bigRiftT=now();AB.flash=1;abyssSfx('thunder',.7,0);filmEntrance();
 bossYell('THE SKY SPLITS OPEN','Something enormous is coming through.');setTimeout(()=>{if(W3.on)tySpawn()},2600)}
function landHurt(){if(deadT<=0&&Math.hypot(heroPos.x-B.px,heroPos.z-B.pz)<32)hurtPlayer(Math.round(10*dmgMul()))}
function fallTick(t,dt){if(B.st==='fall'){B.vy-=90*dt;B.y+=B.vy*dt;tyPlay('Idle_2',0,1);if(B.y<=0){B.y=0;B.st='land';B.stT=t;shake=3;AB.flash=.8;abyssSfx('boom',1,0);abyssSfx('thunder',.5,.2);
   fxImpact(B.px,B.pz,2.6);FXK.dust(B.px,0,B.pz,30,46);B.waves.push(waveMake(B.px,B.pz,t));landHurt();
   tyPlay('Attack_3',.05,1,1.35);AB.glowBoost=2.5;W3.landFx2&&W3.landFx2(t)}}
 else if(B.st==='land'){if(t-B.stT>1.6&&!B.yelled){B.yelled=true;tyPlay('Idle_2',.4,1);bossYell('KNEEL BEFORE THE ABYSS.','— THE ABYSSAL TYRANT');try{musicW2('boss')}catch(e){}W3.phaseBanner&&W3.phaseBanner(1)}if(t-B.stT>4.2){B.st='idle';B.nextAtk=t+1.5;if(FILM.on)FILM.opt.ph='fight';else W3.ph='fight'}}}   // (a film playing keeps the screen until it ends)
// ---- every frame
function tyFrame(t,dt){if(!B.ty||!TY.g)return;
 if(!MP.client){if(B.st==='fall'||B.st==='land')fallTick(t,dt);else if(B.st!=='dead')hostBrain(t,dt)}
 else if(B.st==='fall'||B.st==='land'){if(B.st==='land'&&!B.yelled&&t-B.stT>1.6){B.yelled=true;bossYell('KNEEL BEFORE THE ABYSS.','— THE ABYSSAL TYRANT');try{musicW2('boss')}catch(e){}W3.phaseBanner&&W3.phaseBanner(1)}}
 if(B.st==='dead'){deadTick(t,dt)}
 if(B.st==='land'&&!B.fightSeen){B.fightSeen=true;RW.fightT0=now()}
 mxTick(t,dt);if(W3.envTick)W3.envTick(t,dt);
 TY.mixer.update(dt);
 const g=TY.g;g.position.set(B.px,B.y,B.pz);g.rotation.y=B.a;const sc=TY.SC*(B.phase>=3&&!B.trans?1.12:B.trans&&B.trans.to===3?1+.12*sstep(1.6,4.6,t-B.trans.t0):1);g.scale.setScalar(sc);g.updateMatrixWorld(true);
 TY._dt=dt;tyPoseApply();   // (after he is placed, so his legs can plant their feet in the world)
 // his weapon's fiery trail through every swing (melee, the slams, the transformation)
 {const cn=TY.curName||'';trailTick(t,dt,B.st!=='dead'&&(/^Attack_/.test(cn)&&tyClipT()>.25&&tyClipT()<(TY.clips[cn]?TY.clips[cn].duration-.35:9)))}
 // hit tests follow his body, not his feet
 const hp=TY.hips.getWorldPosition(new V3());B.x=hp.x;B.z=hp.z;
 // footsteps: the ground shakes when a foot comes down near you
 [TY.footL,TY.footR].forEach((f,i)=>{const p=f.getWorldPosition(new V3());const k='fy'+i;const was=B[k]||0;B[k]=p.y;if(was>3&&p.y<=3&&B.st!=='fall'&&B.y>-1){const d=Math.hypot(p.x-heroPos.x,p.z-heroPos.z);shake=Math.max(shake,clampN(1.2-d/120,0,1.1));FXK.dust(p.x,0,p.z,7,9);if(d<90)abyssSfx('step',.5*clampN(1-d/90,0,1),0)}});
 // nobody walks through him (unless he is under the floor)
 const dx=heroPos.x-B.x,dz=heroPos.z-B.z,d=Math.hypot(dx,dz),rr=10;if(d<rr&&d>.01&&B.st!=='dead'&&hero.position.y<30&&B.y>-8){heroPos.x=B.x+dx/d*rr;heroPos.z=B.z+dz/d*rr}
 // hit flash and the bar
 const fl=t-B.flash<.12;if(fl!==B.wasFl){B.wasFl=fl;TY.meshes.forEach(m=>{if(m.isSkinnedMesh)m.material.emissive.setHex(fl?0x661010:0x120203)})}
 const f=$('bossf');if(f)f.style.width=Math.max(0,B.hp/B.maxHp*100)+'%';
 if(B.openT>t&&frame%20===0)floatText(B.x,46,B.z,'OPENING!','#7affc0',3);
 wavesTick(t);
}
function riftTick(t){if(W3.bigRift){const k=t-W3.bigRiftT;W3.bigRift.material.uniforms.uT.value=t;W3.bigRift.scale.set(Math.max(.01,Math.min(1,k/.9))*(k>9?Math.max(0,1-(k-9)/2):1),1,1);if(k>11){world.remove(W3.bigRift);W3.bigRift=null}}}
// damage taken (from index.html's damageBoss): threat for target choice, the stagger meter, openings hurt more; untouchable while changing phase
W3.onDamage=function(dmg){if(B.inv||B.st==='dead'){B.hp+=dmg;return}const who=MP.hitBy||'me';B.threat[who]=(B.threat[who]||0)+dmg;B.stag+=dmg;const t=now();
 if(B.st==='break'){const extra=dmg*2;B.hp-=extra;B.threat[who]+=extra;if(frame%2===0)floatText(B.x,38,B.z,'×3','#7affc0',3)}
 else if(B.st==='hurt'||B.openT+2>t||B.coreT>t){const extra=Math.round(dmg*.5);B.hp-=extra;B.threat[who]+=extra;if(extra>0&&frame%3===0)floatText(B.x,38,B.z,'+'+extra+' CRIT','#7affc0',3)}
 // a phase line holds until the change has played
 if(B.phase<3){const line=phaseLine(B.phase+1);if(B.hp<line)B.hp=line}
 if(B.hp<=0&&B.phase<3)B.hp=1};
// ---- death: everything stops, he falls, the abyss takes him back, the eclipse breaks
W3.bossDied=function(t){if(B.st==='dead')return;B.st='dead';B.dead=t;mxClear();
 // his creatures fall with him (the owner: after the fight the melon blaster could not touch the ones still standing)
 if(!MP.client)try{for(const e of enemies){if(e.kind&&e.hp>0){FXK.sparks(e.x,2,e.z,14,22,[.85,.6,1,1]);FXK.glow(e.x,3,e.z,14,[.85,.5,1,1],.3);damageEnemy(e,e.hp+1,t)}}}catch(err){console.warn('minions',err)}
B.trans=null;B.brk=null;B.inv=true;if(B.atk&&B.atk.tl)world.remove(B.atk.tl);B.atk=null;B.waves.forEach(w=>world.remove(w.m));B.waves=[];
 if(TY.cur)TY.cur.timeScale=1;tyPlay('Die',.2,1);try{musicW2(null)}catch(e){}
 const bar=$('bossbar');if(bar)bar.style.display='none';shake=Math.max(shake,2.5);W3.deathFx&&W3.deathFx(t)};
function deadTick(t,dt){const k=t-B.dead;if(k>3.6&&!B.sunk){B.sunk=true;AB.flash=1;abyssSfx('thunder',.8,0);for(let i=0;i<24;i++)hitSpark(B.x+(Math.random()-.5)*30,Math.random()*30,B.z+(Math.random()-.5)*30,t,true)}
 if(k>3.6){B.y=-Math.pow(k-3.6,2)*6}
 if(k>9.5&&!B.won){B.won=true;W3.victory?W3.victory():victory()}}
function victory(){const p=$('endp');if(!p)return;const h=p.querySelector('h2'),q=p.querySelector('p');if(h)h.textContent='THE ABYSSAL TYRANT HAS FALLEN';if(q)q.textContent='You conquered the Abyssal Realm. Thanks for playing.';
 const k=$('endk');if(k)k.textContent=L2.kills+' kills · level '+level;p.style.display='flex';setPaused(true,true)}

// ---------------------------------------------------------------- PHASES, THE ARENA'S MOODS, THE DEFEAT
// What every screen shows when the fight changes: the phase banners, the World Breaker sky, the transformation, the break, the fall.
// The host decides when (e_boss.js); these only draw, so they run the same on every machine.
const ENV={tint:0,rage:0,win:0,deathT:-1,rifts:[],plats:null,beams:[],ventT:0,trans:null,swirl:null,brkT:0};
const ENVC={orange:null,red:null,hotRim:null,brkRim:null,tmp:null};
// a banner across the middle of the screen
function bigBanner(top,sub,col,ms){let el=$('w3big');if(!el){el=document.createElement('div');el.id='w3big';el.style.cssText='position:fixed;left:0;right:0;top:22%;z-index:73;text-align:center;pointer-events:none;opacity:0;transition:opacity .45s, transform .45s;transform:scale(.92)';document.body.appendChild(el)}
 el.innerHTML='<div style="font:900 clamp(34px,6.4vw,78px) Bangers,Impact,sans-serif;letter-spacing:.06em;color:'+(col||'#ffd27a')+';text-shadow:0 0 26px rgba(255,60,20,.75),0 5px 0 #000">'+top+'</div>'+(sub?'<div style="font:700 clamp(13px,1.6vw,18px) system-ui,sans-serif;letter-spacing:.28em;color:#ffe8c8;text-shadow:0 2px 0 #000;margin-top:6px">'+sub+'</div>':'');
 el.style.opacity=1;el.style.transform='scale(1)';clearTimeout(el._t);el._t=setTimeout(()=>{el.style.opacity=0;el.style.transform='scale(.96)'},ms||3200)}
W3.bigBanner=bigBanner;
W3.phaseBanner=function(n){const P=PHASES[n];if(!P)return;bigBanner(P.name,n===1?'PHASE ONE':n===2?'PHASE TWO':'FINAL PHASE',n===3?'#ff6a3a':'#ffd27a',3400)};
// a deep, rolling growl (synthesised: the game has no recorded roar for him)
function roar(vol,len){if(sndPlay('roar',vol||1))return;try{const ac=audioCtx();if(!ac)return;const T=ac.currentTime,L=len||2.2;const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(70,T);o.frequency.linearRampToValueAtTime(52,T+L);
  const o2=ac.createOscillator();o2.type='square';o2.frequency.setValueAtTime(36,T);const lfo=ac.createOscillator();lfo.frequency.value=17;const lg=ac.createGain();lg.gain.value=9;lfo.connect(lg);lg.connect(o.frequency);
  const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(900,T);f.frequency.linearRampToValueAtTime(260,T+L);const g=ac.createGain();g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(.5*(vol||1),T+.18);g.gain.exponentialRampToValueAtTime(.001,T+L);
  o.connect(f);o2.connect(f);f.connect(g);g.connect(ac.destination);[o,o2,lfo].forEach(x=>{x.start(T);x.stop(T+L+.1)})}catch(e){}abyssSfx('boom',.4*(vol||1),.05)}
W3.roar=roar;
// the boss music climbs a little in the last phase (the same track, a touch faster and louder)
function musicPush(on){try{const c=M2&&M2.cur;if(!c||!AC)return;const T=AC.currentTime;c.s.playbackRate.cancelScheduledValues(T);c.s.playbackRate.setValueAtTime(c.s.playbackRate.value,T);c.s.playbackRate.linearRampToValueAtTime(on?1.07:1,T+3);
  c.g.gain.cancelScheduledValues(T);c.g.gain.setValueAtTime(c.g.gain.value,T);c.g.gain.linearRampToValueAtTime(musicVol()*(on?1.2:1),T+3)}catch(e){}}
// a bright closing chord when he falls
function victorySting(){try{const ac=audioCtx();if(!ac)return;const T=ac.currentTime+.1;[261.6,329.6,392,523.2,659.3].forEach((f,i)=>{const o=ac.createOscillator();o.type=i%2?'triangle':'sawtooth';o.frequency.value=f;const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2400;const g=ac.createGain();
  g.gain.setValueAtTime(0,T+i*.08);g.gain.linearRampToValueAtTime(.07,T+i*.08+.06);g.gain.exponentialRampToValueAtTime(.001,T+3.6);o.connect(lp);lp.connect(g);g.connect(ac.destination);o.start(T+i*.08);o.stop(T+3.7)})}catch(e){}}
W3.victorySting=victorySting;
// ---- the change into a new phase (every screen; 'age' lets a late snapshot join part-way through)
W3.transFx=function(to,age){ENV.trans={to,t0:now()-(age||0)};if((age||0)<.5){roar(1.2,2.6);shake=Math.max(shake,1.6);AB.flash=Math.max(AB.flash,.7);
  if(to===2){W3.phaseBanner(2);bossYell('THE ABYSS ANSWERS ME.','— THE ABYSSAL TYRANT')}else{W3.phaseBanner(3);bossYell('ENOUGH. NOW YOU BURN.','— THE ABYSSAL TYRANT')}}
 if(to===3)musicPush(true);filmPhase(to,age)};
// floating platforms: slabs of rock that rise out of the abyss around the arena in phase two and keep drifting
function platsBuild(){if(ENV.plats)return;const g=new THREE.Group();g.name='w3plats';(AB.G||world).add(g);const L=[];const M=AB.mats;
 for(let i=0;i<7;i++){const a=i/7*6.283+.35,d=AB.R+58+(i%3)*26,r=13+(i*7%9);const I=island(g,Math.cos(a)*d,-320,Math.sin(a)*d,r,r*2.4,700+i,(gg,rr)=>{
   if(i%2===0&&M)obelisk(gg,0,1.4,0,10+(i%3)*4,M);
   const rune=new THREE.Mesh(new THREE.RingGeometry(rr*.35,rr*.42,24),ENV.platRune||(ENV.platRune=new THREE.MeshBasicMaterial({color:0xa050ff,toneMapped:false,side:THREE.DoubleSide})));rune.rotation.x=-Math.PI/2;rune.position.y=1.6;gg.add(rune)});
  I.traverse(o=>o.layers.set(1));L.push({g:I,a,d,y:-6+(i%4)*7,ph:i*1.7,t0:now()+i*.35})}
 ENV.plats={g,L}}
function platsTick(t,dt){const P=ENV.plats;if(!P)return;const ph=B.phase||1,sp=ph>=3?.05:.028;if(ENV.platRune&&AB.glowM)ENV.platRune.color.copy(AB.glowM.color);
 P.L.forEach(p=>{const k=sstep(0,4.5,t-p.t0);p.a+=sp*dt*(p.ph%2?1:-1);const y=lerpN(-320,p.y+Math.sin(t*.45+p.ph)*(ph>=3?7:4),k);p.g.position.set(Math.cos(p.a)*p.d,y,Math.sin(p.a)*p.d);p.g.rotation.y+=dt*.05})}
function transTickFx(t,dt){const T=ENV.trans;if(!T)return;const k=t-T.t0;
 if(T.to===2){
  // the sky tears open: four great rifts, the platforms rise, more lightning
  if(k>.6&&ENV.rifts.length<4&&k<4){const i=ENV.rifts.length,a=i/4*6.28+.7,d=520;const m=new THREE.Mesh(new THREE.PlaneGeometry(120,640),riftMat());m.position.set(Math.cos(a)*d,300,Math.sin(a)*d);m.lookAt(0,300,0);m.rotation.z+=(Math.random()-.5)*.5;m.scale.set(.01,1,1);m.layers.set(1);G3().add(m);ENV.rifts.push({m,t0:t});AB.rifts.push(m);abyssSfx('thunder',.5,0);AB.flash=.8}
  if(k>1.2&&!ENV.plats)platsBuild();
  if(k>5.4)ENV.trans=null}
 else{
  // the transformation: rings of energy climb around him, the eclipse bleeds red, he grows, then a blast as he finishes
  if(!ENV.swirl&&k<6){const g=new THREE.Group();for(let i=0;i<3;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(18+i*6,.8,6,48),new THREE.MeshBasicMaterial({color:i%2?0xff5a1a:0xb040ff,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));r.rotation.x=Math.PI/2;g.add(r)}g.traverse(o=>o.layers.set(1));world.add(g);ENV.swirl=g}
  const sw=ENV.swirl;if(sw){sw.position.set(B.px,0,B.pz);sw.children.forEach((r,i)=>{r.position.y=((k*14+i*12)%46);r.rotation.z=t*(i%2?-1.5:2);r.material.opacity=.7*sstep(0,.6,k)*(1-sstep(4.6,5.4,k))})}
  if(k>1.6&&k<4.6){shake=Math.max(shake,.6+(k-1.6)*.25);if(frame%2===0){const a=Math.random()*6.28,d=rnd(20,40);fxP({x:B.px+Math.cos(a)*d,y:rnd(0,6),z:B.pz+Math.sin(a)*d,vx:-Math.cos(a)*8,vy:rnd(20,40),vz:-Math.sin(a)*8,life:1.2,s0:1.2,s1:.2,c0:[1,.4,.2,1],c1:[.7,.2,1,0],kind:2,stretch:1.4})}}
  if(k>4.6&&!T.blast){T.blast=true;shake=3;AB.flash=1;W3.pillarHit(B.px,B.pz,400,1.3);W3.kick(4);fxImpact(B.px,B.pz,2.6,0xff3a1a);FXK.fire(B.px,10,B.pz,30,60,16);abyssSfx('boom',1,0);roar(1.4,2);B.waves.push(Object.assign(waveMake(B.px,B.pz,t),{hit:true}))}   // part of the show: this ring does not hurt
  if(k>6.4){if(sw)world.remove(sw);ENV.swirl=null;ENV.trans=null}}}
// ---- the break: he is down on one knee
W3.breakFx=function(on){if(on){bigBanner('BREAK HIM!','HE IS ON ONE KNEE · ALL DAMAGE ×3','#7affc0',3600);roar(.7,1.6);ENV.brkT=now()}
 else{ENV.brkT=0;bigBanner('HE RISES','','#ff6a3a',1800)}};
// ---- every frame: the arena follows the phase
W3.envTick=function(t,dt){if(!AB.built)return;const ph=B.phase||1;transTickFx(t,dt);platsTick(t,dt);
 if(!ENVC.orange){ENVC.orange=new THREE.Color(0xff7a2a);ENVC.red=new THREE.Color(0xff2a10);ENVC.hotRim=new THREE.Color(0xff4410).multiplyScalar(1.1);ENVC.brkRim=new THREE.Color(0x40ffa0).multiplyScalar(.9);ENVC.tmp=new THREE.Color()}
 const wrathOn=MX.list.some(m=>m.kind==='wrath'&&!m.done);
 // rune colour: violet -> molten orange (phase two) -> blood red (phase three); a brief flare when a power begins
 const tgt=ph===1?0:ph===2?.55:1;ENV.tint+=(tgt-ENV.tint)*Math.min(1,dt*.8);
 if(AB.glowM&&!wrathOn&&ENV.deathT<0){const base=AB._runeBase||(AB._runeBase=AB.glowM.color.clone());const c=AB.glowM.color;
  if(ENV.tint<=.55)c.copy(base).lerp(ENVC.orange,ENV.tint/.55);else c.copy(ENVC.orange).lerp(ENVC.red,(ENV.tint-.55)/.45);
  const pk=AB.runePulse?Math.max(0,1-(t-AB.runePulse)/1.1):0;if(pk>0){c.lerp(ENVC.tmp.setRGB(1,.92,.8),pk*.6);AB.glowM.opacity=Math.min(1,AB.glowM.opacity+pk*.3)}}
 // the eclipse bleeds red in the last phase; lightning comes faster as the fight goes on
 const rage=ph>=3?1:(ENV.trans&&ENV.trans.to===3?sstep(1,4.6,t-ENV.trans.t0):0);ENV.rage+=(rage-ENV.rage)*Math.min(1,dt*1.5);
 const U=AB.sky&&AB.sky.material.uniforms;if(U&&U.uRage)U.uRage.value=ENV.rage*(1-ENV.win);
 if(AB.boltT>0&&ph>1)AB.boltT-=dt*(ph-1)*.9;
 AB.debK=ph===1?1:ph===2?2.2:3.4;
 // his burning rim heats up through the fight (green-white while he is broken)
 if(TY.bodyM&&TY.bodyM.userData.rim){const base=ENV.rimBase||(ENV.rimBase=TY.bodyM.userData.rim.value.clone());const v=TY.bodyM.userData.rim.value;
  if(ENV.brkT)v.copy(base).lerp(ENVC.brkRim,.85);else v.copy(base).lerp(ENVC.hotRim,clampN(ENV.rage,0,1))}
 if(TY.weapon&&TY.weapon.material&&TY.weapon.material.emissiveIntensity!==undefined){if(ENV.wEI===undefined)ENV.wEI=TY.weapon.material.emissiveIntensity;TY.weapon.material.emissiveIntensity=ENV.wEI*(1+ENV.rage*.9)}
 // the rifts of phase two keep burning
 ENV.rifts.forEach(R=>{R.m.scale.x=Math.min(1,(t-R.t0)/.8)});
 // molten vents (host): the arena itself erupts every so often in phases two and three
 if(!MP.client&&ph>=2&&!ENV.trans&&B.st!=='trans'&&B.st!=='dead'&&B.st!=='break'&&B.st!=='fall'&&B.st!=='land'&&!wrathOn){if(!ENV.ventT)ENV.ventT=t+6;if(t>ENV.ventT){ENV.ventT=t+(ph>=3?rand(7,10):rand(10,14));mxStart('vents',MXD.vents.start())}}
 deathTickFx(t,dt)};
W3.landFx2=function(t){W3.pillarHit(B.px,B.pz,160,1.5);W3.kick(5);try{const m={fx:[],hits:{}};debris(m,B.px,B.pz,14,1.2);ENV.landDeb=m}catch(e){}};
// ---- the fall: light breaks out of him, he goes down, the abyss swallows him, the eclipse breaks and gold light comes back
W3.deathFx=function(t){filmFall();ENV.deathT=t;ENV.dm={fx:[],hits:{}};bigBanner('THE TYRANT HAS FALLEN.','',"#ffe8a0",7000);roar(1.4,3.2);shake=Math.max(shake,2.4);musicPush(false);setTimeout(victorySting,4200)};
function deathTickFx(t,dt){if(ENV.landDeb){debrisTick(ENV.landDeb,dt);if(!ENV.landDeb.deb||!ENV.landDeb.deb.length)ENV.landDeb=null}
 if(ENV.deathT<0)return;const k=t-ENV.deathT,m=ENV.dm;flaresTick(m);debrisTick(m,dt);
 // bursts of light out of his body, faster and faster
 if(k<3.6){m.next=m.next||0;if(k>m.next){m.next=k+Math.max(.12,.32-k*.06);let p=new V3(B.x||B.px,20+Math.random()*24,B.z||B.pz);try{const bs=[TY.head,TY.chest,TY.hips,TY.hand,TY.footL,TY.footR].filter(Boolean);const b=bs[(Math.random()*bs.length)|0];p=b.getWorldPosition(new V3())}catch(e){}
   flare(m,p.x,p.y,p.z,Math.random()<.5?0xd8a0ff:0xffc070,3,18,.5);FXK.sparks(p.x,p.y,p.z,6,30,[1,.85,.6,1]);if(m.flares&&m.flares.length>18){const o=m.flares.shift();o.visible=false}abyssSfx('boom',.25,0);
   if(ENV.beams.length<8){const b=new THREE.Mesh(new THREE.CylinderGeometry(.6,1.6,140,8,1,true),glowMat(0xd0a0ff,.5));b.geometry.translate(0,70,0);b.position.copy(p);b.rotation.set((Math.random()-.5)*1.6,0,(Math.random()-.5)*1.6);b.layers.set(1);world.add(b);ENV.beams.push({b,t0:t})}}}
 ENV.beams=ENV.beams.filter(o=>{const a=t-o.t0;o.b.material.opacity=.5*Math.max(0,1-a/2.2);if(a>2.2){world.remove(o.b);o.b.geometry.dispose();return false}return true});
 // the blast
 if(k>3.6&&!m.blast){m.blast=true;shake=3.2;AB.flash=1;W3.kick(6);abyssSfx('boom',1,0);abyssSfx('thunder',1,.15);fade(.85,.06,'#fff2ff');setTimeout(()=>fade(0,1.4),160);
  const x=B.x||B.px,z=B.z||B.pz;fxImpact(x,z,3.2,0xffd0a0);FXK.fire(x,14,z,40,70,18);FXK.smoke(x,10,z,14,40);flare(m,x,20,z,0xffffff,20,180,1.4);flare(m,x,6,z,0xc070ff,10,120,1.1);debris(m,x,z,26,1.6);for(let i=0;i<3;i++)setTimeout(()=>{if(W3.on)B.waves.push(Object.assign(waveMake(x,z,now()),{hit:true}))},i*260);
  FXK.dust(x,0,z,36,60);
  // the arena answers: the runes flare white and die, some pillars give way
  ENV.runeFlash=t;(AB.pillars||[]).forEach((p,i)=>{if(i%2===0&&!p.fall){p.fall={t0:t+Math.random()*1.4,dir:Math.random()*6.28,r0:p.g.rotation.clone()}}})}
 if(ENV.runeFlash&&AB.glowM){const a=t-ENV.runeFlash;AB.glowM.color.setRGB(1,1,1).multiplyScalar(Math.max(.15,1.6-a*.5));AB.glowM.opacity=Math.max(.15,1-a/4)}
 (AB.pillars||[]).forEach(p=>{if(!p.fall)return;const a=clampN((t-p.fall.t0)/1.6,0,1);if(a<=0)return;const e=a*a;p.g.rotation.x=p.fall.r0.x+Math.cos(p.fall.dir)*1.45*e;p.g.rotation.z=p.fall.r0.z+Math.sin(p.fall.dir)*1.45*e;if(a>=1&&!p.fall.dust){p.fall.dust=true;FXK.dust(p.x,0,p.z,10,14);abyssSfx('boom',.35,0);p.down=true}});
 // the eclipse breaks: gold light floods the realm
 if(k>4){ENV.win=sstep(4,9,k);const U=AB.sky&&AB.sky.material.uniforms;if(U&&U.uWin)U.uWin.value=ENV.win;hemi.intensity+=ENV.win*.6;skyDark(0)}}
// ---- a fresh fight in the same realm (retry, or a new run): the arena goes back to how it began
W3.envReset=function(){ENV.tint=0;ENV.rage=0;ENV.win=0;ENV.deathT=-1;ENV.trans=null;ENV.brkT=0;ENV.ventT=0;ENV.runeFlash=0;
 if(ENV.swirl){world.remove(ENV.swirl);ENV.swirl=null}
 ENV.beams.forEach(o=>world.remove(o.b));ENV.beams=[];
 ENV.rifts.forEach(R=>{if(R.m.parent)R.m.parent.remove(R.m);const i=AB.rifts.indexOf(R.m);if(i>=0)AB.rifts.splice(i,1)});ENV.rifts=[];
 if(ENV.plats){if(ENV.plats.g.parent)ENV.plats.g.parent.remove(ENV.plats.g);ENV.plats=null}
 if(ENV.dm){(ENV.dm.fx||[]).forEach(o=>o.parent&&o.parent.remove(o));(ENV.dm.deb||[]).forEach(d=>world.remove(d.o));ENV.dm=null}
 (AB.pillars||[]).forEach(p=>{if(p.fall){p.g.rotation.copy(p.fall.r0);p.fall=null;p.down=false}});
 const U=AB.sky&&AB.sky.material.uniforms;if(U){if(U.uWin)U.uWin.value=0;if(U.uRage)U.uRage.value=0;if(U.uDark)U.uDark.value=0}
 if(AB.glowM&&AB._runeBase){AB.glowM.color.copy(AB._runeBase);AB.glowM.opacity=1}
 if(TY.bodyM&&TY.bodyM.userData.rim&&ENV.rimBase)TY.bodyM.userData.rim.value.copy(ENV.rimBase);
 if(TY.weapon&&TY.weapon.material&&ENV.wEI!==undefined)TY.weapon.material.emissiveIntensity=ENV.wEI;
 AB.debK=1;musicPush(false)};

// ---------------------------------------------------------------- THE REWARD: the Abyssal Treasure Chest, the Crown and the title, your numbers, fight again or go home
// Rewards go into the game's own inventory; what you have won is remembered in this browser (the game already keeps your settings and name the same way).
const RW={chest:null,lid:null,opened:false,openT:0,panel:null,fightT0:0,deaths:0,shown:false,rays:[]};
const PROG_KEY='mistySwampProgress';
function progLoad(){try{const p=JSON.parse(localStorage.getItem(PROG_KEY)||'{}');return p&&typeof p==='object'?p:{}}catch(e){return {}}}
function progSave(p){try{localStorage.setItem(PROG_KEY,JSON.stringify(p))}catch(e){}}
// ---- the crown: black iron and gold, horns swept back like his, a burning garnet
function crownModel(){const g=new THREE.Group();const gold=new THREE.MeshStandardMaterial({color:0xe0a640,metalness:1,roughness:.28,envMapIntensity:1.4}),iron=new THREE.MeshStandardMaterial({color:0x2a2228,metalness:.8,roughness:.45});
 const band=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.12,.55,28,1,true),gold);band.material.side=THREE.DoubleSide;g.add(band);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(1.1,.07,8,32),iron);rim.rotation.x=Math.PI/2;rim.position.y=-.26;g.add(rim);const rim2=rim.clone();rim2.position.y=.27;rim2.scale.setScalar(.97);g.add(rim2);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2,big=i%2===0;const sp=new THREE.Mesh(new THREE.ConeGeometry(big?.2:.13,big?1.05:.6,6),big?iron:gold);sp.position.set(Math.cos(a)*1.06,.27+(big?.5:.28),Math.sin(a)*1.06);sp.rotation.z=-Math.cos(a)*.18;sp.rotation.x=Math.sin(a)*.18;g.add(sp)}
 [-1,1].forEach(s=>{const h=new THREE.Mesh(new THREE.ConeGeometry(.16,1.6,8),iron);h.position.set(s*1.1,.5,-.15);h.rotation.set(-.5,0,-s*.95);g.add(h)});
 const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.22,0),new THREE.MeshStandardMaterial({color:0xff2a10,emissive:0xff2a10,emissiveIntensity:1.6,metalness:.2,roughness:.2}));gem.position.set(0,.05,1.12);gem.scale.set(1,1.3,.6);g.add(gem);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.layers.set(1)}});return g}
// put the crown on (or take it off) your hero: on Stinksheet it sits on the afro, on Stinkza on his head bone
function wearCrown(on){try{const p=progLoad();p.w3=p.w3||{};p.w3.wear=!!on;progSave(p)}catch(e){}
 if(RW.crown&&RW.crown.parent)RW.crown.parent.remove(RW.crown);if(!on||!hero)return;const C=RW.crown||(RW.crown=crownModel());
 let par=null;try{const M=hero.userData&&hero.userData.rc;if(M&&M.kind==='p2'&&M.C&&M.C.mesh){const hb=M.C.mesh.skeleton.getBoneByName('head');if(hb){par=hb;C.position.set(0,.2,0);C.scale.setScalar(.07);C.rotation.set(0,0,0)}}}catch(e){}
 if(!par&&typeof heroCG!=='undefined'&&heroCG){par=heroCG;C.position.set(.15,4.17+2.75,-.25);C.scale.setScalar(.9);C.rotation.set(-.08,0,.06)}
 if(par)par.add(C)}
// the Void Ember: a spark of the abyss that orbits you (a second victory)
function wearEmber(on){try{const p=progLoad();p.w3=p.w3||{};p.w3.ember=p.w3.ember||on;p.w3.wearE=!!on;progSave(p)}catch(e){}
 if(RW.ember&&RW.ember.parent)RW.ember.parent.remove(RW.ember);if(!on||!hero)return;if(!RW.ember){const g=new THREE.Group();for(let i=0;i<3;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:i?0xff5a1a:0xb070ff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));s.scale.setScalar(i?.9:1.5);g.add(s)}g.userData.emb=true;RW.ember=g}
 hero.add(RW.ember)}
function emberTick(t){const g=RW.ember;if(!g||!g.parent)return;g.children.forEach((s,i)=>{const a=t*(1.6+i*.4)+i*2.1;s.position.set(Math.cos(a)*2.2,3+Math.sin(t*2+i)*.6+i*.4,Math.sin(a)*2.2)})}
// the title under your name
function showTitle(){let el=$('ptitle');const p=progLoad(),on=p.w3&&p.w3.wins>0;if(!on){if(el)el.remove();return}
 if(!el){const n=$('pname');if(!n)return;el=document.createElement('span');el.id='ptitle';el.style.cssText="display:block;font:800 10px/1.1 system-ui,sans-serif;letter-spacing:.22em;color:#ffcf6a;text-shadow:0 1px 0 #000,0 0 8px rgba(255,90,20,.6);margin:-2px 0 3px";n.insertAdjacentElement('afterend',el)}el.textContent='☠ TYRANT SLAYER'}
// the inventory knows the crown and the ember, and can put them on or take them off
(function(){try{ITEMS.crown={n:'Abyssal Crown',i:'👑',d:'Torn from the brow of the Abyssal Tyrant. Only Tyrant Slayers wear it.'};ITEMS.ember={n:'Void Ember',i:'🔥',d:'A spark of the abyss that orbits you. Proof that you felled the Tyrant twice.'};
  const p=progLoad();if(p.w3&&p.w3.crown)inv.items.crown=1;if(p.w3&&p.w3.ember)inv.items.ember=1;
  const r0=renderInv;renderInv=function(){r0();const g=$('invlist');if(!g)return;g.querySelectorAll('.ir').forEach(row=>{const nm=row.querySelector('.nm');if(!nm)return;const id=nm.textContent===ITEMS.crown.n?'crown':nm.textContent===ITEMS.ember.n?'ember':null;if(!id)return;
    const P=progLoad().w3||{},on=id==='crown'?!!P.wear:!!P.wearE;const b=document.createElement('button');b.type='button';b.className='sm'+(on?' on':'');b.textContent=on?'Worn':'Wear';b.onclick=()=>{if(id==='crown')wearCrown(!on);else wearEmber(!on);toast((on?'Took off':'Wearing')+' the '+ITEMS[id].n);renderInv()};row.appendChild(b)})};
  setTimeout(()=>{try{const P=progLoad().w3||{};if(P.wear)wearCrown(true);if(P.wearE)wearEmber(true);showTitle()}catch(e){}},2500)}catch(e){console.warn('World 3: rewards',e)}})();
// ---- the chest: dark bone-wood from his fortress, gold bands, iron spikes, a skull lock, light pouring out when it opens
function abyssChest(){const g=new THREE.Group(),W=13,D=8.5,H=5.6;const wood=AB.chestWood||(AB.chestWood=(()=>{const m=new THREE.MeshStandardMaterial({color:0x5a3226,roughness:.8,metalness:0});try{addDetail(m,5,.55)}catch(e){}return m})()),gold=new THREE.MeshStandardMaterial({color:0xd99a3a,metalness:1,roughness:.3,envMapIntensity:1.3}),iron=new THREE.MeshStandardMaterial({color:0x221c22,metalness:.85,roughness:.42}),bone=new THREE.MeshStandardMaterial({color:0xd8ccb4,roughness:.6});
 const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wood);body.position.y=H/2;g.add(body);
 [-1,0,1].forEach(k=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.8,H+.12,D+.16),gold);b.position.set(k*W*.36,H/2,0);g.add(b)});
 const trim=new THREE.Mesh(new THREE.BoxGeometry(W+.3,.5,D+.3),iron);trim.position.y=.25;g.add(trim);const trim2=trim.clone();trim2.position.y=H-.2;g.add(trim2);
 [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{const c=new THREE.Mesh(new THREE.ConeGeometry(.45,1.6,6),iron);c.position.set(sx*W/2,H+.4,sz*D/2);g.add(c);const f=new THREE.Mesh(new THREE.BoxGeometry(1.1,H+.3,1.1),iron);f.position.set(sx*(W/2-.1),H/2,sz*(D/2-.1));g.add(f)});
 const sk=new THREE.Group();sk.position.set(0,H*.62,D/2+.25);g.add(sk);const sh=new THREE.Mesh(new THREE.SphereGeometry(.95,16,12),bone);sh.scale.set(1,1.08,.75);sk.add(sh);[-1,1].forEach(s=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),new THREE.MeshBasicMaterial({color:0xff3a10,toneMapped:false}));e.position.set(s*.34,.12,.62);sk.add(e)});const jaw=new THREE.Mesh(new THREE.BoxGeometry(.9,.36,.5),bone);jaw.position.set(0,-.78,.24);sk.add(jaw);
 // the lid hinges at the back
 const lid=new THREE.Group();lid.position.set(0,H,-D/2);g.add(lid);const lg=new THREE.CylinderGeometry(D/2,D/2,W,24,1,false,0,Math.PI);lg.rotateZ(Math.PI/2);lg.rotateX(Math.PI/2);lg.translate(0,0,D/2);
 const lm=new THREE.Mesh(lg,wood);lid.add(lm);[-1,0,1].forEach(k=>{const b=new THREE.Mesh(new THREE.TorusGeometry(D/2+.06,.34,6,20,Math.PI),gold);b.rotation.y=Math.PI/2;b.position.set(k*W*.36,0,D/2);lid.add(b)});
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(W-1,D-1),new THREE.MeshBasicMaterial({color:0xffb050,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));glow.rotation.x=-Math.PI/2;glow.position.y=H-.3;g.add(glow);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.layers.set(1)}});glow.castShadow=false;g.userData={lid,glow,H};return g}
// ---- he has fallen: the numbers are kept, the chest rises out of the courtyard
W3.victory=function(){if(RW.shown)return;RW.shown=true;const t=now();
 const P=progLoad();P.w3=P.w3||{};const first=!(P.w3.wins>0);P.w3.wins=(P.w3.wins|0)+1;const dur=Math.max(0,(B.dead||t)-(RW.fightT0||t));if(dur>5&&(!P.w3.best||dur<P.w3.best))P.w3.best=Math.round(dur);progSave(P);RW.first=first;RW.dur=dur;
 const c=abyssChest();c.position.set(0,-9,6);c.rotation.y=0;world.add(c);RW.chest=c;RW.lid=c.userData.lid;RW.riseT=t;RW.opened=false;
 FXK.dust(0,0,6,24,26);FXK.embers(0,0,6,30,10,[1,.75,.35,1]);fxLight(0,10,6,0xffb050,5,120,1.4);toast('THE ABYSSAL TREASURE RISES · WALK TO IT');bossYell('THE TYRANT HAS FALLEN','His treasure rises from the courtyard. Claim it.')};
// ---- every frame in the realm: the chest rising, opening when you reach it, the light pouring out
function rewardTick(t,dt){emberTick(t);const c=RW.chest;if(!c)return;const k=clampN((t-RW.riseT)/2.2,0,1);c.position.y=-9+9*(1-Math.pow(1-k,3));if(k<1&&frame%3===0)FXK.dust(c.position.x,0,c.position.z,2,14);
 if(!RW.opened&&k>=1&&deadT<=0&&Math.hypot(heroPos.x-c.position.x,heroPos.z-c.position.z)<14)rewardOpen(t);
 if(RW.opened){const o=clampN((t-RW.openT)/1.1,0,1);RW.lid.rotation.x=-1.9*(1-Math.pow(1-o,3));c.userData.glow.material.opacity=.9*o;if(frame%2===0)FXK.embers(c.position.x,c.userData.H,c.position.z,2,4,[1,.8,.4,1]);
  RW.rays.forEach((r,i)=>{r.material.opacity=.16*o*(.8+.2*Math.sin(t*2+i));r.rotation.y+=dt*.2})}}
function rewardOpen(t){RW.opened=true;RW.openT=t;const c=RW.chest;abyssSfx('boom',.4,0);fxLight(c.position.x,12,c.position.z,0xffc060,6,140,2.2);FXK.sparks(c.position.x,6,c.position.z,30,40,[1,.85,.5,1]);FXK.glow(c.position.x,8,c.position.z,40,[1,.8,.5,1],.8);
 for(let i=0;i<5;i++){const r=new THREE.Mesh(new THREE.CylinderGeometry(.5,3.5,90,10,1,true),new THREE.MeshBasicMaterial({color:0xffc070,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));r.geometry.translate(0,45,0);r.position.set(c.position.x+(i-2)*1.8,c.userData.H,c.position.z);r.rotation.z=(i-2)*.12;r.layers.set(1);world.add(r);RW.rays.push(r)}
 // the reward: the Crown the first time, the Void Ember the second, after that the chest holds only glory
 const P=progLoad();P.w3=P.w3||{};let got=null;if(!P.w3.crown){P.w3.crown=true;P.w3.wear=true;got='crown'}else if(!P.w3.ember){P.w3.ember=true;P.w3.wearE=true;got='ember'}progSave(P);
 if(got==='crown'){invAdd('crown');setTimeout(()=>wearCrown(true),900)}else if(got==='ember'){invAdd('ember');setTimeout(()=>wearEmber(true),900)}showTitle();
 setTimeout(()=>rewardPanel(got),1600)}
// ---- your numbers, the reward, and what next
function rewardPanel(got){let el=$('w3rw');if(!el){el=document.createElement('div');el.id='w3rw';el.style.cssText='position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(20,6,4,.55),rgba(0,0,0,.82));opacity:0;transition:opacity .6s';document.body.appendChild(el)}
 const name=k=>{if(k==='me'){if(MP.client){const h=MP.players&&MP.hostPeer&&MP.players[MP.hostPeer];return (h&&h.name?h.name:'Host')+' (host)'}return (MP.name||'You')+(MP.on?' (host)':'')}const p=MP.players&&MP.players[k];return p?(p.name||'Player'):(k===MP.me?(MP.name||'You'):'Player')};
 const th=B.threat||{},tot=Object.values(th).reduce((a,b)=>a+(+b||0),0)||1;const rows=Object.keys(th).sort((a,b)=>th[b]-th[a]).map(k=>'<tr><td>'+name(k)+'</td><td style="text-align:right">'+Math.round(th[k]).toLocaleString()+'</td><td style="text-align:right;color:#ffcf6a">'+Math.round(th[k]/tot*100)+'%</td></tr>').join('');
 const mm=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');const P=progLoad().w3||{};
 const rw=got==='crown'?'<div style="font-size:54px">👑</div><div class="rwn">THE ABYSSAL CROWN</div><div class="rwd">It is on your head now. Find it in your inventory to take it off.</div><div class="rwt">TITLE UNLOCKED · ☠ TYRANT SLAYER</div>':got==='ember'?'<div style="font-size:54px">🔥</div><div class="rwn">THE VOID EMBER</div><div class="rwd">A spark of the abyss now orbits you. Wear it or not from your inventory.</div>':'<div style="font-size:40px">✨</div><div class="rwn">THE CHEST HOLDS ONLY GLORY</div><div class="rwd">You have already taken everything he had.</div>';
 const host=!MP.on||!MP.client;
 el.innerHTML='<div class="qbox" style="width:min(560px,94vw);text-align:center;border:2px solid #b5481e;background:linear-gradient(#1c0d0a,#0c0605);box-shadow:0 0 60px rgba(255,80,20,.35)"><style>#w3rw .rwn{font:900 26px Bangers,Impact,sans-serif;letter-spacing:.06em;color:#ffd27a;margin:4px 0}#w3rw .rwd{color:#e8d2c0;font-size:13px}#w3rw .rwt{margin-top:8px;font:800 12px system-ui;letter-spacing:.24em;color:#ff9a4a}#w3rw table{width:100%;margin:10px 0;color:#f2e2d0;font-size:13px;border-collapse:collapse}#w3rw td{padding:3px 6px;border-bottom:1px solid rgba(255,120,60,.18)}#w3rw .st{display:flex;justify-content:space-around;margin:8px 0;color:#f2e2d0;font-size:12px}#w3rw .st b{display:block;font:900 22px Bangers,Impact,sans-serif;color:#ffcf6a}#w3rw button{margin:6px}</style>'+
  '<h2 style="margin:0 0 6px;color:#ff7a3a">THE TYRANT HAS FALLEN</h2>'+rw+
  '<div class="st"><div><b>'+mm(RW.dur||0)+'</b>fight time</div><div><b>'+(DUEL.perfects|0)+'</b>perfect dodges</div><div><b>'+(DUEL.wpHits|0)+'</b>weak-point hits</div><div><b>'+(DUEL.shots?Math.round(DUEL.hits/DUEL.shots*100):0)+'%</b>accuracy</div><div><b>'+(MX.stats.hits|0)+'</b>hits taken</div><div><b>'+(RW.deaths|0)+'</b>falls</div></div>'+
  '<table><tr><td style="color:#ff9a4a">DAMAGE</td><td></td><td></td></tr>'+rows+'</table>'+
  '<div class="rwd">Victories: '+(P.wins|0)+(P.best?' · best time '+mm(P.best):'')+'</div>'+
  '<div>'+(host?'<button type="button" id="w3again">⚔ Fight him again</button>':'<p class="note">The host can start another fight.</p>')+'<button type="button" id="w3home">Back to the swamp</button><button type="button" id="w3stay">Stay a while</button></div></div>';
 requestAnimationFrame(()=>{el.style.opacity=1});el.style.pointerEvents='auto';
 const a=$('w3again');if(a)a.onclick=()=>{rewardHide();W3.replay(false)};$('w3home').onclick=()=>location.reload();$('w3stay').onclick=()=>rewardHide()}
function rewardHide(){const el=$('w3rw');if(el){el.style.opacity=0;el.style.pointerEvents='none';setTimeout(()=>{if(el.style.opacity==='0')el.remove()},700)}}
// ---- fight him again (the host decides for everyone)
W3.replay=function(fromNet){if(MP.on&&!fromNet&&MP.client)return;if(MP.on&&!fromNet)mpQueue({k:'w3again'});rewardHide();
 if(RW.chest){world.remove(RW.chest);RW.chest=null}RW.rays.forEach(r=>world.remove(r));RW.rays=[];RW.shown=false;RW.deaths=0;MX.stats.dodges=0;MX.stats.hits=0;
 Object.assign(DUEL,{meter:0,perfects:0,wpHits:0,shots:0,hits:0,dmg:0,barrage:null,lock:false,shownBreak:-1});FIN.busy=false;FIN.actor=null;if(FIN.melon){world.remove(FIN.melon);FIN.melon=null}
 if(FILM.on)filmStop();if(TY.g&&TY.g.parent)TY.g.parent.remove(TY.g);B.ty=false;B.st='';boss=null;W3.hph='';W3.entSeen=false;W3.ph='arrive';
 heroPos.set(MP.client?3:-3,0,AB.R-22);if(typeof W3.respawnFull==='function')W3.respawnFull();playerHP=maxHP();deadT=0;updateHUD();camYaw=0;camPitch=.3;
 if(W3.envReset)W3.envReset();try{musicW2(null)}catch(e){}toast('HE RISES AGAIN');if(!MP.client)W3.hostPhase('entrance',2.5)};
// ---------------------------------------------------------------- THE DUEL: how you fight the Tyrant
// One weapon: the Watermelon Shooter, rebuilt. A tap fires a fast melon the moment you press; keep holding to charge a melon bomb that bursts
// on release. A dodge roll you are untouchable in (roll just as a blow lands for a PERFECT dodge). Weak points glow on him after his big moves
// (hands and knees after a slam, the chest while he charges his beam, everything while he is on his knee): hits there count two and a half
// times. Weak-point hits and perfect dodges fill the BUSHIDO meter for the Melon Barrage. When he drops to his knee: the finishing strike.
// Keyboard & mouse: click the game to aim with the mouse (Esc frees it) · left shoot / hold to charge · right aim · Q (or Ctrl) dodge ·
// E Melon Barrage / finishing strike · T or middle mouse lock on. Controller: RT shoot / hold · LT aim · B dodge · Y barrage / finisher · LB lock on.
const DUEL={on:false,charge:0,chargeOn:false,c0:0,fireT:-9,proj:[],dodgeT:-9,de:1,dodgeDir:new V3(),iframe:-9,perfectWin:-9,perfectT:-9,meter:0,lock:false,lockBreak:0,
 prev:{},ui:null,body:null,wp:{},wpFx:{},open:{},barrage:null,lmb:false,rmb:false,mmb:false,touchFire:false,noLock:false,hitT:-9,hitWp:false,recoil:0,pitch:0,
 ads:false,adsK:0,keysT:-9,quiet:false,mouseT:-9,fbDown:null,splats:[],shards:[],perfects:0,wpHits:0,shots:0,hits:0,dmg:0,shownBreak:-1};
const DPW=()=>1+(PWR()-1)*.4;
const isTouchDev=()=>{try{return matchMedia('(hover:none) and (pointer:coarse)').matches}catch(e){return false}};
const pLocked=()=>document.pointerLockElement===cv;
// ---------------------------------------------------------------- the look of melons: rind, cut face, the fissures of a charged melon, the weak-point mark, a juice splat
const DT={};
function dTex(){if(DT.ok)return DT;DT.ok=true;let sd=11;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;
 {const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');g.fillStyle='#86c95e';g.fillRect(0,0,512,256);
  const N=10;for(let i=0;i<N;i++){const x0=i*512/N,w=24+(i*37)%10;g.fillStyle='#1f5a26';g.beginPath();
   for(let y=0;y<=256;y+=8){const x=x0+Math.sin(y*.05+i*1.7)*6+Math.sin(y*.13+i)*3;y===0?g.moveTo(x,y):g.lineTo(x,y)}
   for(let y=256;y>=0;y-=8){const x=x0+w+Math.sin(y*.045+i*2.3)*7+Math.sin(y*.11+i*.5)*3;g.lineTo(x,y)}g.closePath();g.fill();
   g.strokeStyle='#2c6e30';g.lineWidth=2;for(let y=0;y<256;y+=4){const xa=x0+Math.sin(y*.05+i*1.7)*6+Math.sin(y*.13+i)*3,xb=x0+w+Math.sin(y*.045+i*2.3)*7+Math.sin(y*.11+i*.5)*3;
    g.beginPath();g.moveTo(xa,y);g.lineTo(xa-3-rr()*7,y+2);g.stroke();g.beginPath();g.moveTo(xb,y);g.lineTo(xb+3+rr()*7,y+2);g.stroke()}}
  for(let i=0;i<3200;i++){g.fillStyle=rr()<.5?'rgba(255,255,220,'+(rr()*.09)+')':'rgba(0,28,0,'+(rr()*.12)+')';g.fillRect(rr()*512,rr()*256,1+rr()*2,1)}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;DT.rind=t}
 {const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),C=128;
  g.fillStyle='#1d5524';g.beginPath();g.arc(C,C,128,0,6.283);g.fill();g.fillStyle='#e6efc4';g.beginPath();g.arc(C,C,117,0,6.283);g.fill();
  const gr=g.createRadialGradient(C,C,8,C,C,106);gr.addColorStop(0,'#ff5266');gr.addColorStop(.7,'#ee2440');gr.addColorStop(1,'#ff9a9a');g.fillStyle=gr;g.beginPath();g.arc(C,C,106,0,6.283);g.fill();
  for(let i=0;i<700;i++){const a=rr()*6.283,r=rr()*100;g.fillStyle='rgba(255,'+(170+rr()*80|0)+','+(180+rr()*60|0)+','+(rr()*.16)+')';g.fillRect(C+Math.cos(a)*r,C+Math.sin(a)*r,2,1)}
  for(let k=0;k<2;k++)for(let i=0;i<14;i++){const a=i/14*6.283+k*.22,r=46+k*24;g.save();g.translate(C+Math.cos(a)*r,C+Math.sin(a)*r);g.rotate(a+Math.PI/2);g.fillStyle='#140a06';g.beginPath();g.ellipse(0,0,4.2,7.5,0,0,6.283);g.fill();g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(-1.2,-2.4,1.2,2,0,0,6.283);g.fill();g.restore()}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;DT.face=t}
 {const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,512,256);g.lineCap='round';g.lineJoin='round';
  const crack=(x,y,n,w)=>{g.lineWidth=w;g.beginPath();g.moveTo(x,y);for(let s=0;s<n;s++){x+=(rr()-.5)*40;y+=(rr()-.5)*30;g.lineTo(x,y);if(rr()<.18&&w>1.2){g.stroke();crack(x,y,(n-s)>>1,w*.6);g.lineWidth=w;g.beginPath();g.moveTo(x,y)}}g.stroke()};
  g.shadowColor='#ff5a7a';g.shadowBlur=10;g.strokeStyle='#ffe0e8';for(let i=0;i<14;i++)crack(rr()*512,rr()*256,12,3);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;DT.crack=t}
 {const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),C=64;
  const rg=g.createRadialGradient(C,C,0,C,C,64);rg.addColorStop(0,'rgba(255,255,255,1)');rg.addColorStop(.1,'rgba(190,255,225,.95)');rg.addColorStop(.28,'rgba(60,255,170,.22)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,128,128);
  g.strokeStyle='rgba(180,255,225,1)';g.lineWidth=5;g.beginPath();g.arc(C,C,38,0,6.283);g.stroke();g.lineWidth=4;
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;g.beginPath();g.moveTo(C+Math.cos(a)*45,C+Math.sin(a)*45);g.lineTo(C+Math.cos(a)*58,C+Math.sin(a)*58);g.stroke()}
  DT.ret=new THREE.CanvasTexture(c)}
 {const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle='rgba(190,10,30,.9)';
  for(let i=0;i<26;i++){const a=rr()*6.283,r=rr()*42,s=4+rr()*16;g.beginPath();g.arc(64+Math.cos(a)*r,64+Math.sin(a)*r,s*(1-r/60),0,6.283);g.fill()}
  g.beginPath();g.arc(64,64,24,0,6.283);g.fill();g.fillStyle='rgba(20,8,6,.9)';for(let i=0;i<10;i++){const a=rr()*6.283,r=10+rr()*34;g.beginPath();g.ellipse(64+Math.cos(a)*r,64+Math.sin(a)*r,2,3.5,a,0,6.283);g.fill()}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;DT.splat=t}
 DT.rindM=new THREE.MeshPhysicalMaterial({map:DT.rind,roughness:.36,metalness:0,clearcoat:.55,clearcoatRoughness:.3,envMapIntensity:.9});
 DT.faceM=new THREE.MeshStandardMaterial({map:DT.face,roughness:.5,emissive:0x3a0408,envMapIntensity:.6});
 DT.brassM=new THREE.MeshStandardMaterial({color:0xd6a548,metalness:.85,roughness:.3,emissive:0x1c1004,envMapIntensity:1.4});
 DT.darkM=new THREE.MeshStandardMaterial({color:0x2a2420,metalness:.35,roughness:.55,envMapIntensity:.8});
 DT.leatherM=new THREE.MeshStandardMaterial({color:0x4a2a18,roughness:.75,envMapIntensity:.5});
 DT.olM=new THREE.MeshBasicMaterial({color:0x120a08,side:THREE.BackSide});
 DT.glassM=new THREE.MeshStandardMaterial({color:0xffd0dc,roughness:.08,metalness:0,transparent:true,opacity:.28,depthWrite:false,envMapIntensity:1.6});
 DT.coreM=new THREE.MeshBasicMaterial({color:0xff3a64,toneMapped:false});
 DT.shotGeo=new THREE.SphereGeometry(1,20,14);DT.splatGeo=new THREE.PlaneGeometry(1,1);DT.shardGeo=new THREE.BoxGeometry(.5,.12,.3);
 return DT}
// ---------------------------------------------------------------- the new Watermelon Shooter: a two-handed melon blaster (Bushido holds it where he held the AK,
// one hand on the grip, one round the barrel); player two carries a compact one in the right hand
function shooterModel(kind){const T=dTex(),g=new THREE.Group();g.name='melonShooter2';const hand=kind==='hand';
 // the hand version is a stubby hand cannon: everything ahead of the grip is drawn in to 56% of the rifle's length (zz), the grip is long enough for
 // player two's big closed fist to wrap round it with its brass butt showing below
 const Lz=hand?.56:1,zz=z=>z<=-.3?z:-.3+(z+.3)*Lz;
 const add=(geo,mat,x,y,z,rx,ry,rz,ol)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,rz||0);m.castShadow=true;g.add(m);
  if(ol){const o=new THREE.Mesh(geo,T.olM);o.position.copy(m.position);o.rotation.copy(m.rotation);o.scale.copy(m.scale).multiplyScalar(ol);g.add(o);m.userData.ol=o}return m};
 // the barrel: a long melon, fattest just ahead of the drum, tapering to the muzzle (its stripes run its length)
 const prof=[[.17,-.5],[.26,-.42],[.30,-.2],[.31,.25],[.30,.8],[.28,1.3],[.26,1.62]].map(p=>new THREE.Vector2(p[0],zz(p[1])));
 add(new THREE.LatheGeometry(prof,40),T.rindM,0,0,0,Math.PI/2,0,0,1.05);
 // the muzzle: a flared bell with a brass lip, pink flesh inside, seeds around the bore
 {const geo=new THREE.CylinderGeometry(.385,.255,.36,40,1,true),bell=new THREE.Mesh(geo,T.rindM.clone());bell.material.side=THREE.DoubleSide;bell.rotation.x=Math.PI/2;bell.position.z=zz(1.62)+.17;bell.castShadow=true;g.add(bell);
  const o=new THREE.Mesh(geo,T.olM);o.rotation.copy(bell.rotation);o.position.copy(bell.position);o.scale.setScalar(1.05);g.add(o)}
 const mz=zz(1.62)+.35;   // the mouth of the bell
 {const inner=new THREE.Mesh(new THREE.CylinderGeometry(.34,.2,.35,40,1,true),new THREE.MeshStandardMaterial({color:0xf03a52,roughness:.55,emissive:0x400810,side:THREE.BackSide}));inner.rotation.x=Math.PI/2;inner.position.z=mz-.17;g.add(inner)}
 add(new THREE.TorusGeometry(.38,.038,10,40),T.brassM,0,0,mz);
 for(let i=0;i<12;i++){const a=i/12*6.283;add(new THREE.SphereGeometry(.026,6,4),T.darkM,Math.cos(a)*.29,Math.sin(a)*.29,mz-.01).scale.set(1,1.6,1)}
 // brass bands, the fore-grip collar where the front hand holds it, a sight ring
 [[-.3,.305],[.42,.318],[.85,.305],[1.5,.268]].forEach(([z,r])=>add(new THREE.TorusGeometry(r,.032,10,40),T.brassM,0,0,zz(z)));
 add(new THREE.CylinderGeometry(.322,.322,.2*Lz+.02*(1-Lz),40,1,true),T.leatherM,0,0,zz(.85),Math.PI/2,0,0);
 add(new THREE.TorusGeometry(.055,.014,6,16),T.brassM,0,.33,zz(1.32),0,0,0);add(new THREE.BoxGeometry(.03,.07,.03),T.brassM,0,.29,zz(1.32));
 // the drum at the back: half a melon, its red cut face toward you (seeds and all), ringed in brass
 add(new THREE.SphereGeometry(.4,36,18,0,Math.PI*2,0,Math.PI/2),T.rindM,0,.0,-.5,-Math.PI/2,0,0,1.04).scale.set(1,.7,1);
 add(new THREE.CircleGeometry(.4,40),T.faceM,0,0,-.505,0,Math.PI,0);
 add(new THREE.TorusGeometry(.4,.035,10,40),T.brassM,0,0,-.505);
 if(!hand){// the stock: a brass tube back to a leather butt pad
  add(new THREE.CylinderGeometry(.055,.055,.62,12),T.brassM,0,-.08,-.84,Math.PI/2+.12,0,0);add(new THREE.BoxGeometry(.14,.36,.1),T.leatherM,0,-.14,-1.15,.12,0,0,1.08)}
 // the charge cell on top: a glass tube, a glowing core that fills as you hold the trigger, brass caps and posts
 const cellY=.43,cellL=.74*(hand?.8:1),cellZ=hand?zz(.12)-.04:.12;add(new THREE.CylinderGeometry(.095,.095,cellL,18,1,true),T.glassM,0,cellY,cellZ,Math.PI/2,0,0);
 [-1,1].forEach(sd=>add(new THREE.CylinderGeometry(.115,.115,.07,18),T.brassM,0,cellY,cellZ+sd*(cellL/2+.01),Math.PI/2,0,0));
 [-.3,.32].forEach(f=>add(new THREE.BoxGeometry(.05,.14,.05),T.darkM,0,cellY-.12,cellZ+f*cellL));
 const core=new THREE.Mesh(new THREE.CylinderGeometry(.062,.062,1,14),T.coreM.clone());core.rotation.x=Math.PI/2;core.position.set(0,cellY,cellZ-cellL/2);core.scale.set(1,.02,1);g.add(core);
 // the pistol grip and trigger guard
 if(hand){add(new THREE.BoxGeometry(.17,.95,.21),T.leatherM,0,-.634,-.354,.42,0,0,1.06);add(new THREE.BoxGeometry(.19,.07,.23),T.brassM,0,-1.086,-.556,.42,0,0)}   // a long handle: his fist closes round it, the brass butt shows below
 else add(new THREE.BoxGeometry(.13,.34,.17),T.leatherM,0,-.36,-.3,.42,0,0,1.07);add(new THREE.TorusGeometry(.08,.016,6,16,Math.PI),T.darkM,0,-.29,-.13,0,Math.PI/2,Math.PI);
 // the charge glow at the muzzle
 const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:0xff5a7a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));glow.position.set(0,0,mz+.08);glow.scale.setScalar(.01);g.add(glow);
 g.traverse(o=>{if(o.isMesh){o.userData.noFade=true;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.userData.noFade=true})}});   // a held gun never fades with its holder (its materials are shared by every blaster in the game)
 g.userData={core,glow,muzzle:new V3(0,0,mz+.11),cellZ,coreLen:cellL};return g}
// Bushido: the blaster rides the AK's place in his hands (the game already poses both arms for it and kicks it back on each shot); the AK's own parts stay hidden
// where his fists close on it, in the AK's own space (the rifle sits a little left of the AK's line so the left arm reaches the barrel): the right
// fist round the pistol grip, the left under the barrel ahead of the drum; the game's arm solver follows the rifle as it kicks and tilts
const DUELGUN={pos:[-.25,.1,.05],sc:[1.22,1.22,1.12]};const DUELHOLD={R:[-.25,-.339,-.286],L:[-.372,-.534,.554],pitch:0,pR:[.5,-.3,-1],pL:[-.4,-.2,-1]};
function duelRifleOn(AK){if(!AK.userData.duelS){AK.userData.akParts=AK.children.slice();const g=shooterModel('rifle');g.position.set(...DUELGUN.pos);g.scale.set(...DUELGUN.sc);AK.add(g);AK.userData.duelS=g}return AK.userData.duelS}
function armDuelGun(){const AK=charApi&&charApi.AK;if(!AK)return null;duelRifleOn(AK);try{if(charApi.akHold)charApi.akHold(DUELHOLD)}catch(e){}
 if(charApi.weapon()!=='ak')try{charApi.equip('ak')}catch(e){}const S=AK.userData.duelS;S.visible=true;AK.userData.akParts.forEach(c=>{if(c.visible)c.visible=false});return S}
function disarmDuelGun(){const AK=charApi&&charApi.AK;try{if(charApi&&charApi.akHold)charApi.akHold(null)}catch(e){}if(!AK||!AK.userData.duelS)return;DUELHOLD.pitch=0;AK.userData.duelS.visible=false;AK.userData.akParts.forEach(c=>c.visible=true)}
// player two (online, Stinkza) holds the hand version in his right fist, gunslinger style. His fists are closed (the figure has no finger bones),
// so the handle runs THROUGH the fist: the fist's hole goes from the little finger to the index knuckle, the handle sits in it, the barrel rides
// on top of the fist along the line of the forearm (when he points, the melons leave exactly along his arm) and the wrist cocks to the handle's
// rake. The gun is a child of his hand bone, so it follows every swing and walk cycle and grows and shrinks with him at every size, on every screen.
const P2GRIP={FIST:new V3(-.19,.232,.078),HAND:new V3(-.21,.305,.05),KNU:new V3(-.178,.236,.108),FC:[.005,.011,.045],RAKE:.42,SC:.16,GRIP:new V3(0,-.629,-.352),q:null,p:null,cock:null};
function p2GripFrame(){if(P2GRIP.q)return;const G=P2GRIP,f=G.FIST.clone().sub(G.HAND).normalize(),u0=G.KNU.clone().sub(G.FIST),u=u0.addScaledVector(f,-u0.dot(f)).normalize(),r=new V3().crossVectors(u,f).normalize();
 const c=Math.cos(G.RAKE),s=Math.sin(G.RAKE),X=r,Y=u.clone().multiplyScalar(c).addScaledVector(f,-s),Z=u.clone().multiplyScalar(s).addScaledVector(f,c);
 G.q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X,Y,Z));
 const fc=r.clone().multiplyScalar(G.FC[0]).addScaledVector(u,G.FC[1]).addScaledVector(f,G.FC[2]);   // the middle of the closed fist, from the wrist
 G.p=fc.sub(G.GRIP.clone().multiplyScalar(G.SC).applyQuaternion(G.q));
 G.cock=new THREE.Quaternion().setFromAxisAngle(r,G.RAKE)}
// the socket in a player-two figure's right hand (made once per figure), with the gun in it
function p2GunSock(C){const hand=C&&(C.handR||(C.bones&&C.bones.handR));if(!hand)return null;let S=hand.userData.gunSock;
 if(!S){p2GripFrame();S=new THREE.Group();S.name='p2GunSock';S.position.copy(P2GRIP.p);S.quaternion.copy(P2GRIP.q);S.scale.setScalar(P2GRIP.SC);
  hand.userData.finger=hand.children.find(o=>o.isMesh)||null;hand.add(S);hand.userData.gunSock=S;hand.userData.gunOn=false;S.visible=false}
 return S}
function p2GunFor(C){const S=p2GunSock(C);if(!S)return null;if(!S.userData.gun){const g=shooterModel('hand');g.traverse(o=>{if(o.isMesh||o.isSprite)o.layers.set(0)});g.userData.hand=S.parent;g.visible=false;S.add(g);S.userData.gun=g}S.visible=true;return S.userData.gun}
// showing or hiding a held gun also opens or closes the hand round it
function gunVis(g,on){if(!g)return;g.visible=!!on;const h=g.userData.hand;if(h)h.userData.gunOn=!!on}
function p2GunShow(C,on){gunVis(p2GunFor(C),on)}
// after the figure's own pose each frame: a hand holding the gun cocks to the handle and keeps the pointing finger closed on it
const _gq=[new THREE.Quaternion(),new THREE.Quaternion(),new THREE.Quaternion()],_gv=[new V3(),new V3(),new V3(),new V3()];
function p2GripPose(holder){const M=holder&&holder.userData&&holder.userData.rc;if(!M||M.kind!=='p2'||!M.C)return;const C=M.C,hand=C.handR||(C.bones&&C.bones.handR);
 if(!hand||!hand.userData.gunOn)return;p2GripFrame();hand.quaternion.multiply(P2GRIP.cock);const fg=hand.userData.finger;if(fg)fg.visible=false;
 // while he points, the straight arm rolls about its own line so the gun rides upright on top of the fist (a real one-handed aim), whatever
 // the direction; the roll comes from the shoulder, so the wrist and elbow never twist
 const pw=C.state?C.state.pw:0,arm=C.bones&&C.bones.armR,S=hand.userData.gunSock;if(pw<.01||!arm||!arm.parent||!S)return;
 S.updateWorldMatrix(true,false);const e=S.matrixWorld.elements,up=_gv[0].set(e[4],e[5],e[6]).normalize(),fw=_gv[1].set(e[8],e[9],e[10]).normalize();
 const want=_gv[2].set(0,1,0).addScaledVector(fw,-fw.y);if(want.lengthSq()<1e-4)return;want.normalize();
 const ang=Math.atan2(_gv[3].crossVectors(up,want).dot(fw),up.dot(want))*Math.min(1,pw*pw*(3-2*pw)*1.15);
 const pq=arm.parent.getWorldQuaternion(_gq[0]),qw=_gq[1].setFromAxisAngle(fw,ang),X=_gq[2].copy(pq).invert().multiply(qw).multiply(pq);arm.quaternion.premultiply(X)}
if(typeof MSC!=='undefined'&&MSC.tick&&!MSC.tick.__grip){const t0=MSC.tick;MSC.tick=function(holder){const r=t0.apply(this,arguments);try{p2GripPose(holder)}catch(e){}return r};MSC.tick.__grip=true}
const P2S={g:null,tip:new V3(),dir:new V3()};const P2S_ready=()=>{const rc=hero.userData.rc;return !!(rc&&rc.kind==='p2'&&rc.C)};
function p2Shooter(){if(!MP.client)return null;const rc=hero.userData.rc;if(!rc||rc.kind!=='p2'||!rc.C)return null;P2S.g=p2GunFor(rc.C);return P2S.g}
function p2ShooterPlace(aim){const S=p2Shooter();if(!S)return;const rc=hero.userData.rc,ok=!W3.cine&&!FIN.busy&&hero.visible&&rc.wrap.visible;p2GunShow(rc.C,ok)}
// ---------------------------------------------------------------- on and off
// World 2's power-ups stay in World 2: the Nago Wizard (robes, flight, fireballs) and Naggomaxxxing (rampage, the hat) end at the realm's door
function w2ModesOff(){try{if(L2.wizard)setWizard(false)}catch(e){}L2.flyT=0;if(L2.rage){L2.rage=false;try{if(charApi&&charApi.rage)charApi.rage(false)}catch(e){}}}
function duelOn(){if(DUEL.on)return;DUEL.on=true;w2ModesOff();DUEL.meter=0;DUEL.charge=0;DUEL.chargeOn=false;DUEL.lock=false;DUEL.ads=false;DUEL.adsK=0;DUEL.perfects=DUEL.wpHits=DUEL.shots=DUEL.hits=DUEL.dmg=0;
 try{if(gogo)setGogo(false)}catch(e){}try{if(fpCam)setFP(false);if(bossCam)setBossCam(false)}catch(e){}
 if(L2.mechOn){try{if(L2.mech&&L2.mech.parent)L2.mech.parent.remove(L2.mech)}catch(e){}L2.mechOn=false;L2.mech=null;if(heroCG)heroCG.visible=true}
 try{armDuelGun()}catch(e){console.warn('duel gun',e)}
 duelUI(true);DUEL.keysT=-99;DUEL.keysShown=false;const h=document.getElementById('hint');if(h){if(DUEL.hint0===undefined)DUEL.hint0=h.innerHTML;h.innerHTML=isTouchDev()?'Hold FIRE to charge a melon bomb · DODGE rolls you through a blow · AIM to zoom · BARRAGE when the Bushido meter is full':'<b>Click</b> to take the mouse · <b>Left</b> shoot, hold to charge · <b>Right</b> aim · <b>Q</b> dodge roll · <b>E</b> barrage · <b>T</b> lock on · <b>Space</b> jump · 🎮 RT shoot · LT aim · B dodge · Y barrage · LB lock · <b>Esc</b> settings'}}
function duelOff(){if(!DUEL.on)return;DUEL.on=false;if(W3.gl){W3.gl=false;try{setGogoLook(false)}catch(e){}}heroFade(0);gunVis(P2S.g,false);duelUI(false);try{disarmDuelGun()}catch(e){}{const h=document.getElementById('hint');if(h&&DUEL.hint0!==undefined){h.innerHTML=DUEL.hint0;h.style.opacity='';h.style.pointerEvents=''}}DUEL.proj.forEach(p=>world.remove(p.m));DUEL.proj=[];DUEL.splats.forEach(s=>world.remove(s.m));DUEL.splats=[];DUEL.shards.forEach(s=>world.remove(s.m));DUEL.shards=[];
 for(const k in DUEL.wpFx)DUEL.wpFx[k].visible=false;if(pLocked())try{document.exitPointerLock()}catch(e){}chargeSnd(false)}
// ---------------------------------------------------------------- the duel's screen: crosshair, charge ring, hit marker, lock-on ring, the Bushido meter, hints, the finishing-strike call, touch buttons
function duelUI(on){let u=DUEL.ui;if(!u&&on){u=document.createElement('div');u.id='w3duel';const touch=isTouchDev();u.innerHTML=
 '<style>#w3duel{position:fixed;inset:0;pointer-events:none;z-index:40;font-family:system-ui,sans-serif}body.w3cine #w3duel{visibility:hidden}#w3duel .x{position:absolute;left:50%;top:46%;width:34px;height:34px;margin:-17px 0 0 -17px;transition:transform .08s}'+
 '#w3duel .x i{position:absolute;background:#fff;box-shadow:0 0 2px #000,0 0 4px rgba(0,0,0,.6);border-radius:1px}#w3duel .x .a{left:16px;top:0;width:2px;height:10px}#w3duel .x .b{left:16px;bottom:0;width:2px;height:10px}#w3duel .x .c{top:16px;left:0;width:10px;height:2px}#w3duel .x .d{top:16px;right:0;width:10px;height:2px}#w3duel .x .o{left:15px;top:15px;width:4px;height:4px;border-radius:50%}'+
 '#w3duel .x.on i{background:#ffd7de}#w3duel .x.wp i{background:#8affc8;box-shadow:0 0 6px #00ff90}#w3duel .hm{position:absolute;left:50%;top:46%;width:30px;height:30px;margin:-15px 0 0 -15px;opacity:0}#w3duel .hm i{position:absolute;left:14px;top:-3px;width:2px;height:12px;background:#fff;box-shadow:0 0 3px #000;transform-origin:1px 18px}'+
 '#w3duel .hm.wp i{background:#7affc0;box-shadow:0 0 6px #00ff90}#w3duel svg.cr{position:absolute;left:50%;top:46%;width:70px;height:70px;margin:-35px 0 0 -35px;opacity:.95}'+
 '#w3duel .bm{position:absolute;left:22px;bottom:30px;width:min(300px,40vw);height:12px;border:2px solid #c0582a;border-radius:8px;background:rgba(12,4,2,.66);overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.5)}#w3duel .bm b{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff6a1a,#ffd27a);box-shadow:0 0 10px #ff9a3a;transition:width .15s}'+
 '#w3duel .bl{position:absolute;left:24px;bottom:46px;font-weight:900;font-size:11px;letter-spacing:.32em;color:#ffcf6a;text-shadow:0 1px 0 #000,0 0 6px rgba(0,0,0,.8);white-space:nowrap}#w3duel .bl.full{animation:w3dp .45s infinite alternate}@keyframes w3dp{to{color:#fff;text-shadow:0 0 14px #ff9a3a,0 1px 0 #000}}'+
 '#w3duel .hint{position:absolute;left:50%;top:60%;transform:translateX(-50%);font-weight:800;font-size:14px;color:#fff;background:rgba(10,4,4,.55);padding:7px 14px;border-radius:9px;opacity:0;transition:opacity .35s;text-align:center;white-space:nowrap;text-shadow:0 1px 0 #000}'+
 '#w3duel .lk{position:absolute;width:62px;height:62px;margin:-31px 0 0 -31px;border:2px solid #ff6a3a;border-radius:50%;box-shadow:0 0 12px #ff5a2a,inset 0 0 8px rgba(255,90,40,.6);display:none}#w3duel .lk:after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#ff8a5a}'+
 '#w3duel .fin{position:absolute;left:50%;top:30%;transform:translateX(-50%);font:900 clamp(28px,4.4vw,52px) Bangers,Impact,sans-serif;letter-spacing:.06em;color:#8affc8;text-shadow:0 0 22px #00ff90,0 4px 0 #000;display:none;animation:w3dp2 .32s infinite alternate;text-align:center;line-height:1.05;white-space:nowrap;cursor:pointer}'+
 '#w3duel .fin small{display:block;font:800 clamp(13px,1.6vw,18px) system-ui;letter-spacing:.2em;color:#fff;text-shadow:0 2px 0 #000}@keyframes w3dp2{to{transform:translateX(-50%) scale(1.06);color:#fff}}'+
 '#w3duel .tb{position:absolute;right:18px;width:68px;height:68px;border-radius:50%;border:2px solid rgba(255,220,180,.6);background:rgba(20,8,6,.55);color:#fff;font-weight:900;font-size:11px;letter-spacing:.06em;pointer-events:auto;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none}'+
 '#w3duel .tb.dg{bottom:200px}#w3duel .tb.br{bottom:280px}#w3duel .tb.ad{bottom:360px}#w3duel.touch .bm{bottom:auto;top:118px}#w3duel.touch .bl{bottom:auto;top:100px}</style>'+
 '<div class="x"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="o"></i></div><div class="hm"><i style="transform:rotate(45deg)"></i><i style="transform:rotate(135deg)"></i><i style="transform:rotate(225deg)"></i><i style="transform:rotate(315deg)"></i></div>'+
 '<svg class="cr" viewBox="0 0 70 70"><circle cx="35" cy="35" r="29" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/><circle class="cf" cx="35" cy="35" r="29" fill="none" stroke="#ff5a7a" stroke-width="4" stroke-linecap="round" stroke-dasharray="182.2" stroke-dashoffset="182.2" transform="rotate(-90 35 35)"/></svg>'+
 '<div class="bl">BUSHIDO</div><div class="bm"><b></b></div><div class="hint"></div><div class="lk"></div><div class="fin">FINISH HIM!<small>'+(touch?'TAP HERE':'PRESS E · Ⓨ')+'</small></div>'+
 (touch?'<div class="tb dg">DODGE</div><div class="tb br">BARRAGE</div><div class="tb ad">AIM</div>':'');if(touch)u.classList.add('touch');document.body.appendChild(u);DUEL.ui=u;
 const q=s=>u.querySelector(s);DUEL.el={x:q('.x'),hm:q('.hm'),cf:q('.cf'),bm:q('.bm b'),bl:q('.bl'),hint:q('.hint'),lk:q('.lk'),fin:q('.fin'),cr:q('svg.cr')};
 DUEL.el.fin.addEventListener('pointerdown',e=>{e.stopPropagation();if(B.st==='break')finisherStart(false)});DUEL.el.fin.style.pointerEvents='auto';
 if(touch){q('.tb.dg').addEventListener('pointerdown',e=>{e.stopPropagation();duelDodge(now())});q('.tb.br').addEventListener('pointerdown',e=>{e.stopPropagation();if(B.st==='break')finisherStart(false);else duelBarrage(now())});
  const ad=q('.tb.ad');ad.addEventListener('pointerdown',e=>{e.stopPropagation();DUEL.touchAds=!DUEL.touchAds;ad.style.background=DUEL.touchAds?'rgba(255,120,60,.6)':'rgba(20,8,6,.55)'})}}
 if(u)u.style.display=on?'block':'none'}
function duelHint(txt,ms){const h=DUEL.el&&DUEL.el.hint;if(!h)return;h.textContent=txt;h.style.opacity=txt?1:0;clearTimeout(h._t);h._t=setTimeout(()=>{h.style.opacity=0},ms||3000)}
// ---------------------------------------------------------------- mouse: click the game to take the mouse; where it cannot be taken (some embedded pages), a click shoots and dragging looks
cv.addEventListener('mousedown',e=>{if(!DUEL.on||W3.cine)return;if(e.button===0)DUEL.lmb=true;else if(e.button===2)DUEL.rmb=true;else if(e.button===1){DUEL.mmb=true;e.preventDefault()}
 if(!pLocked()&&!DUEL.noLock&&!isTouchDev()&&cv.requestPointerLock&&!uiBlock()){try{const r=cv.requestPointerLock();if(r&&r.catch)r.catch(()=>{DUEL.noLock=true})}catch(err){DUEL.noLock=true}DUEL.fbDown=null;return}
 if(!pLocked()&&e.button===0)DUEL.fbDown={x:e.clientX,y:e.clientY,t:now(),drag:false}});
document.addEventListener('mouseup',e=>{if(e.button===0){DUEL.lmb=false;if(DUEL.fbDown&&!DUEL.fbDown.drag&&!pLocked()&&DUEL.on&&now()-DUEL.fbDown.t<.22)DUEL.fbUp=true;DUEL.fbDown=null}else if(e.button===2)DUEL.rmb=false;else if(e.button===1)DUEL.mmb=false});
document.addEventListener('mousemove',e=>{if(!DUEL.on)return;if(DUEL.fbDown&&Math.hypot(e.clientX-DUEL.fbDown.x,e.clientY-DUEL.fbDown.y)>8)DUEL.fbDown.drag=true;
 if(!pLocked()||W3.cine)return;const s=(SET.mouseSens||1)*(DUEL.adsK>.5?.62:1);camYaw-=e.movementX*s*.0032;camPitch=clampN(camPitch+e.movementY*s*.0024*(SET.invertY?-1:1),-1.35,1.45);DUEL.mouseT=now();
 if(DUEL.lock)DUEL.lockBreak+=Math.abs(e.movementX)+Math.abs(e.movementY)});
document.addEventListener('pointerlockchange',()=>{if(DUEL.on&&!pLocked()&&!W3.cine&&!uiBlock()&&B.st!=='dead')duelHint('Click the game to aim with the mouse again',2600)});
document.addEventListener('pointerlockerror',()=>{DUEL.noLock=true});
{const atk=document.getElementById('atk');if(atk){atk.addEventListener('pointerdown',()=>{if(DUEL.on)DUEL.touchFire=true});document.addEventListener('pointerup',()=>{DUEL.touchFire=false});document.addEventListener('pointercancel',()=>{DUEL.touchFire=false})}}
// ---------------------------------------------------------------- his body: capsules between his bones (in his own units, so they grow with him), and his weak points
const BODY=[['Hips','Spine2',.13],['Spine2','Neck',.125],['Neck','Head',.07],['Head','HeadTop_End',.085],
 ['LeftArm','LeftForeArm',.06],['RightArm','RightForeArm',.06],['LeftForeArm','LeftHand',.055],['RightForeArm','RightHand',.055],['LeftHand','LeftHandMiddle1',.06],['RightHand','RightHandMiddle1',.06],
 ['LeftUpLeg','LeftLeg',.075],['RightUpLeg','RightLeg',.075],['LeftLeg','LeftFoot',.058],['RightLeg','RightFoot',.058],['LeftFoot','LeftToeBase',.05],['RightFoot','RightToeBase',.05],['LeftShoulder','LeftArm',.07],['RightShoulder','RightArm',.07]];
// a weak point: [bone, forward offset, up offset, radius] (offsets and radius in his own units)
const WPN={core:['Spine2',.1,.02,.055],head:['Head',.07,.06,.05],handR:['RightHand',0,0,.062],handL:['LeftHand',0,0,.062],kneeR:['RightLeg',.05,0,.05],kneeL:['LeftLeg',.05,0,.05]};
function boneFind(n){let r=null;if(!TY.root)return null;TY.root.traverse(o=>{if(!r&&o.name&&o.name.replace(/_\d+$/,'').replace(/^mixamorig:?/,'')===n)r=o});return r}
function bodyInit(){if(DUEL.body||!TY.root)return;const L=[];
 BODY.forEach(([a,b,r])=>{const A=boneFind(a),Bn=b?boneFind(b):null;if(!A)return;L.push({A,B:Bn,r,n:a,a:new V3(),b:new V3(),R:1})});DUEL.body=L;
 DUEL.wp={};for(const k in WPN){const w=WPN[k],bn=boneFind(w[0]);if(bn)DUEL.wp[k]={bn,f:w[1],u:w[2],r:w[3],p:new V3(),R:1,k}}
 const T=dTex();DUEL.wpFx={};for(const k in DUEL.wp){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:T.ret,color:0x9affd0,transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,toneMapped:false}));sp.renderOrder=20;sp.visible=false;world.add(sp);DUEL.wpFx[k]=sp}}
const _f=new V3(),_u=new V3(0,1,0),HD={up:new V3(0,1,0),face:new V3(0,0,1)};
function bodyTick(){if(!DUEL.body||!B.ty||!TY.g)return;const sc=TY.g.scale.x;TY.g.updateMatrixWorld(true);
 DUEL.body.forEach(q=>{q.A.getWorldPosition(q.a);if(q.B)q.B.getWorldPosition(q.b);else q.b.copy(q.a);q.R=q.r*sc});
 _f.set(Math.sin(B.a),0,Math.cos(B.a));
 // the head: its up runs from the head bone to the top of his skull; his face looks along his facing, bent by that tilt
 {const hc=DUEL.body.find(q=>q.n==='Head');if(hc&&hc.B){HD.up.copy(hc.b).sub(hc.a).normalize();HD.face.copy(_f).addScaledVector(HD.up,-_f.dot(HD.up)).normalize()}else{HD.up.set(0,1,0);HD.face.copy(_f)}}
 for(const k in DUEL.wp){const w=DUEL.wp[k];w.bn.getWorldPosition(w.p);if(k==='head')w.p.addScaledVector(HD.face,w.f*sc).addScaledVector(HD.up,w.u*sc);else w.p.addScaledVector(_f,w.f*sc).addScaledVector(_u,w.u*sc);w.R=w.r*sc}}
// which weak points are open (from what every screen knows: his openings, his powers, the stagger and the break)
function wpOpen(){const t=now(),o={};if(!B.ty||B.st==='dead'||B.st==='fall'||B.st==='land'||B.st==='trans')return o;
 if(B.st==='break'){for(const k in WPN)o[k]=1;return o}
 if(B.openT>t){o.handR=1;o.kneeL=1;o.kneeR=1}if(B.st==='hurt'){o.core=1;o.head=1}
 MX.list.forEach(m=>{const k=t-m.t0;if(m.kind==='beam'&&k<2.8)o.core=1;if(m.kind==='stomp'&&k<1.8){o.kneeR=1;o.kneeL=1}if(m.kind==='summon'&&k<1.8){o.handL=1;o.handR=1}
  if(m.kind==='wrath'&&k<1.6)o.core=1;if(m.kind==='riftslam'&&k>1&&k<2.6){o.handR=1;o.handL=1}if(m.kind==='meteors'&&k<1.5)o.head=1;if(m.kind==='gravity'&&k<1.5)o.core=1});
 // every weak point stays open two seconds after its window closes (the owner)
 const L=B.wpL||(B.wpL={});for(const k in o)L[k]=t+2;for(const k in L)if(L[k]>t)o[k]=1;return o}
function wpTick(t){if(!DUEL.wpFx)return;const o=wpOpen();const was=DUEL.open;DUEL.open=o;let any=false;
 for(const k in DUEL.wpFx){const sp=DUEL.wpFx[k],w=DUEL.wp[k];if(sp.parent!==world)world.add(sp);const on=!!o[k]&&DUEL.on&&!W3.cine;if(on)any=true;
  const a=on?.78+.22*Math.sin(t*11+k.length):0;sp.material.opacity+=(a-sp.material.opacity)*.25;if(w){sp.position.copy(w.p);const s=w.R*(2.6+.35*Math.sin(t*8));sp.scale.set(s,s,1);sp.material.rotation=t*.8}sp.visible=sp.material.opacity>.02}
 if(any&&!Object.keys(was||{}).length&&B.st!=='break'){duelHint(o.core&&!o.handR?'His chest is open — shoot the glow!':o.kneeR&&o.handR?'Weak points open — hands and knees!':o.kneeR?'His knees are open!':o.handR?'His hands are open!':'A weak point is open!',1700);try{sfxTone('sine',990,1480,.18,.05,7000)}catch(e){}}}
// ---------------------------------------------------------------- aim: straight through the crosshair; an open weak point near the crosshair pulls the shot onto it
// the shortest gap between segment p1-q1 and segment p2-q2 (Ericson): squared distance and where on the first segment
function segSeg(p1,q1,p2,q2){const d1x=q1.x-p1.x,d1y=q1.y-p1.y,d1z=q1.z-p1.z,d2x=q2.x-p2.x,d2y=q2.y-p2.y,d2z=q2.z-p2.z,rx=p1.x-p2.x,ry=p1.y-p2.y,rz=p1.z-p2.z;
 const a=d1x*d1x+d1y*d1y+d1z*d1z,e=d2x*d2x+d2y*d2y+d2z*d2z,f=d2x*rx+d2y*ry+d2z*rz;let s=0,u=0;
 if(a<=1e-9&&e<=1e-9){s=u=0}else if(a<=1e-9){s=0;u=clampN(f/e,0,1)}else{const c=d1x*rx+d1y*ry+d1z*rz;if(e<=1e-9){u=0;s=clampN(-c/a,0,1)}
  else{const b=d1x*d2x+d1y*d2y+d1z*d2z,den=a*e-b*b;s=den>1e-12?clampN((b*f-c*e)/den,0,1):0;u=(b*s+f)/e;if(u<0){u=0;s=clampN(-c/a,0,1)}else if(u>1){u=1;s=clampN((b-c)/a,0,1)}}}
 const cx=p1.x+d1x*s-(p2.x+d2x*u),cy=p1.y+d1y*s-(p2.y+d2y*u),cz=p1.z+d1z*s-(p2.z+d2z*u);return {d2:cx*cx+cy*cy+cz*cz,s}}
const RC=new THREE.Raycaster(),NDC=new THREE.Vector2(0,.08);
function aimPoint(){cam.updateMatrixWorld();RC.setFromCamera(NDC,cam);const o=RC.ray.origin.clone(),d=RC.ray.direction.clone(),L=800,e=o.clone().addScaledVector(d,L);
 if(B.ty&&DUEL.body&&B.st!=='dead'){
  // an open weak point: under the crosshair, or within a few degrees of it
  let wb=null,wa=.05;for(const k in DUEL.open){const w=DUEL.wp[k];if(!w)continue;const v=w.p.clone().sub(o),dist=v.length(),al=v.dot(d);if(al<=0)continue;
   const perp=Math.sqrt(Math.max(0,dist*dist-al*al)),ang=Math.atan2(Math.max(0,perp-w.R),al);if(ang<wa){wa=ang;wb=k}}
  if(wb)return {p:DUEL.wp[wb].p.clone(),wp:wb,body:true,o,d};
  let best=1e9,hq=null;for(const c of DUEL.body){const r=segSeg(o,e,c.a,c.b);if(r.d2<c.R*c.R){const al=r.s*L-Math.sqrt(c.R*c.R-r.d2);if(al<best){best=al;hq=c}}}
  if(hq)return {p:o.clone().addScaledVector(d,Math.max(2,best)),q:hq,body:true,o,d}}
 for(const en of enemies){if(!en.kind||en.hp<=0||!en.g)continue;const c=new V3(en.x,2.2,en.z),v=c.clone().sub(o),al=v.dot(d);if(al<=0||al>L)continue;if(v.addScaledVector(d,-al).length()<2.6)return {p:c,en,o,d}}
 if(d.y<-.005){const k=-o.y/d.y;if(k<L)return {p:o.clone().addScaledVector(d,k),floor:true,o,d}}
 return {p:o.clone().addScaledVector(d,420),o,d}}
// ---------------------------------------------------------------- shooting
function muzzlePos(out){const S=MP.client?(P2S.g&&P2S.g.visible?P2S.g:null):(charApi&&charApi.AK&&charApi.AK.userData.duelS);if(S&&S.parent&&S.userData.muzzle){S.updateWorldMatrix(true,false);return out.copy(S.userData.muzzle).applyMatrix4(S.matrixWorld)}
 return out.set(heroPos.x,hero.position.y+2.6,heroPos.z)}
function shotMesh(big,charge){const T=dTex(),g=new THREE.Group();const m=new THREE.Mesh(T.shotGeo,big?new THREE.MeshPhysicalMaterial({map:T.rind,roughness:.35,clearcoat:.5,emissiveMap:T.crack,emissive:new THREE.Color(0xff3a6a),emissiveIntensity:1.2+charge*2.2,envMapIntensity:.9}):T.rindM);
 const r=big?.75+charge*.75:.5;m.scale.set(r,r*1.12,r);m.castShadow=true;g.add(m);
 const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glare,color:big?0xff4a74:0xff7a8a,transparent:true,opacity:big?.85:.55,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));gl.scale.setScalar(big?r*6:2.8);g.add(gl);g.userData.r=r;return g}
function duelFire(t,charge,o){const A=o&&o.to?null:aimPoint();const from=muzzlePos(new V3());const tgt=o&&o.to?o.to:A.p;
 // he turns to the shot (Bushido's blaster tips up toward it; player two points at it)
 if(!o||!o.barrage){const yaw=Math.atan2(tgt.x-heroPos.x,tgt.z-heroPos.z);aimYaw=yaw;aimT=t;heroYaw=yaw;hero.rotation.y=yaw}try{charApi.fire(t)}catch(e){}
 if(MP.client){P2L.pt=t+.7;P2L.aim.copy(tgt);P2L.hasAim=true;P2L.tgt=null}
 const big=charge>=.25;spawnShot(t,from,tgt,charge,o||{},false);netShot(from,tgt,charge,!!(o&&o.barrage));
 DUEL.shots++;DUEL.recoil=big?1:.45;shake=Math.max(shake,big?.5:.06);W3.kick(big?2.2:.35);if(!o||!o.barrage){fireSnd(big,charge,1);rumble(big?.55:.12,big?.6:.18,big?140:40)}}
// a melon in flight (yours, or a friend's shown on your screen: theirs only splash, their own game deals the damage)
function spawnShot(t,from,tgt,charge,o,remote){const big=charge>=.25;
 const sp=big?120:200,gr=big?24:10;const d=tgt.clone().sub(from),dist=d.length(),T=Math.max(.04,dist/sp);const v=d.multiplyScalar(1/T);v.y+=.5*gr*T;   // aimed so the drop lands it on the crosshair
 const m=shotMesh(big,charge);m.position.copy(from);world.add(m);
 const P={m,v,gr,big,charge,t0:t,life:big?3.4:2.4,prev:from.clone(),r:m.userData.r,spin:new V3(rnd(-9,9),rnd(-9,9),rnd(-9,9)),home:o.home||null,barrage:!!o.barrage,remote:!!remote};DUEL.proj.push(P);
 FXK.glow(from.x,from.y,from.z,big?8:3.2,big?[1,.4,.55,1]:[1,.6,.6,1],.16);
 for(let i=0;i<(big?16:5);i++)fxP({x:from.x,y:from.y,z:from.z,vx:v.x*.06+rnd(-5,5),vy:v.y*.06+rnd(-1,6),vz:v.z*.06+rnd(-5,5),life:rnd(.25,.55),s0:big?.5:.3,s1:.08,c0:[1,.22,.32,1],c1:[.7,.08,.12,0],kind:i%2?0:2,grav:30,stretch:1});
 if(big){fxLight(from.x,from.y,from.z,0xff5a7a,2.5,40,.25);for(let i=0;i<5;i++)fxP({x:from.x,y:from.y,z:from.z,vx:rnd(-3,3),vy:rnd(1,4),vz:rnd(-3,3),life:rnd(.6,1.1),s0:1.2,s1:2.6,c0:[.75,.68,.66,.35],c1:[.4,.36,.35,0],kind:3})}
 return P}
// a charged shot sounds deeper; every shot a juicy thump
function fireSnd(big,c,vol){const k=vol===undefined?1:vol;if(k<.05)return;try{if(big){sfxTone('sine',150,38,.42,.17*k,900);sfxRush(.28,.08*k,2400,260);sfxTone('square',90,45,.25,.03*k,500)}else{sfxTone('sine',280,95,.11,.09*k,2200);sfxRush(.06,.035*k,3600,900)}}catch(e){}}
function splatSnd(big,wp){try{sfxRush(big?.26:.1,big?.1:.045,big?1600:2400,big?200:500);sfxTone('triangle',big?120:210,big?50:90,big?.22:.08,big?.08:.04,1200);if(wp)sfxTone('sine',1240,1660,.16,.05,9000)}catch(e){}}
// the whine of a charging melon
let CS=null;function chargeSnd(on,k){try{const ac=audioCtx();if(!ac)return;if(on){if(!CS){const o=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type='sawtooth';o2.type='sine';f.type='lowpass';f.frequency.value=1400;g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g);g.connect(ac.destination);o.start();o2.start();CS={o,o2,g,f}}
  const T=ac.currentTime;CS.o.frequency.setTargetAtTime(110+k*330,T,.05);CS.o2.frequency.setTargetAtTime(220+k*660,T,.05);CS.f.frequency.setTargetAtTime(600+k*2600,T,.05);CS.g.gain.setTargetAtTime(.012+k*.03,T,.04)}
 else if(CS){const T=ac.currentTime;CS.g.gain.setTargetAtTime(0,T,.03);const c=CS;CS=null;setTimeout(()=>{try{c.o.stop();c.o2.stop()}catch(e){}},250)}}catch(e){}}
// the controller shakes in your hands
function rumble(strong,weak,ms){try{if(gpIdx<0)return;const gp=navigator.getGamepads&&navigator.getGamepads()[gpIdx];const va=gp&&gp.vibrationActuator;if(va&&va.playEffect)va.playEffect('dual-rumble',{duration:ms||80,strongMagnitude:clampN(strong,0,1),weakMagnitude:clampN(weak,0,1)})}catch(e){}}
function projTick(t,dt){DUEL.proj=DUEL.proj.filter(p=>{
  // the barrage seeks the open weak points (or his chest)
  if(p.home&&B.ty&&B.st!=='dead'){const w=DUEL.wp[p.home]||DUEL.wp.core;if(w){const want=w.p.clone().sub(p.m.position),L=want.length();if(L>1){want.multiplyScalar(Math.min(160,Math.max(90,p.v.length()))/L);p.v.lerp(want,Math.min(1,dt*3.2))}}}
  p.v.y-=p.gr*dt;const np=p.m.position.clone().addScaledVector(p.v,dt);p.m.children[0].rotation.x+=p.spin.x*dt;p.m.children[0].rotation.y+=p.spin.y*dt;
  // trail
  if(p.big){if(frame%2===0)fxP({x:np.x,y:np.y,z:np.z,vx:rnd(-1,1),vy:rnd(0,2),vz:rnd(-1,1),life:.45,s0:p.r*2,s1:.3,c0:[1,.32,.48,.8],c1:[.6,.1,.2,0],kind:0});if(frame%3===0)fxP({x:np.x,y:np.y,z:np.z,vx:p.v.x*-.04+rnd(-2,2),vy:rnd(-1,2),vz:p.v.z*-.04+rnd(-2,2),life:rnd(.3,.6),s0:.25,s1:.05,c0:[1,.8,.85,1],c1:[1,.3,.4,0],kind:2,stretch:1})}
  else{fxP({x:np.x,y:np.y,z:np.z,vx:p.v.x*.02,vy:p.v.y*.02,vz:p.v.z*.02,life:.22,s0:.9,s1:.15,c0:[1,.5,.6,.8],c1:[1,.2,.3,0],kind:0});if(frame%2===0)fxP({x:np.x,y:np.y,z:np.z,vx:-p.v.x*.03,vy:-p.v.y*.03,vz:-p.v.z*.03,life:.14,s0:.35,s1:.05,c0:[1,.85,.9,1],c1:[1,.4,.5,0],kind:2,stretch:1.2})}
  let hit=null,hq=null,hwp=null,hen=null;const seg=np.clone().sub(p.prev);
  if(B.ty&&B.st!=='dead'&&DUEL.body){let bs=2;
   for(const k in DUEL.open){const w=DUEL.wp[k];if(!w)continue;const r=segSeg(p.prev,np,w.p,w.p),rr=w.R+p.r*.8;if(r.d2<rr*rr&&r.s<bs){bs=r.s;hwp=k;hit=p.prev.clone().addScaledVector(seg,r.s)}}
   if(!hwp)for(const c of DUEL.body){const r=segSeg(p.prev,np,c.a,c.b),rr=c.R+p.r*.6;if(r.d2<rr*rr&&r.s<bs){bs=r.s;hq=c;hit=p.prev.clone().addScaledVector(seg,r.s)}}}
  if(!hit)for(const en of enemies){if(!en.kind||en.hp<=0)continue;if(Math.hypot(np.x-en.x,np.z-en.z)<2.4+p.r&&np.y<6+p.r){hit=np.clone();hen=en;break}}
  if(!hit&&AB.braz)for(const b of AB.braz){if(Math.hypot(np.x-b.x,np.z-b.z)<b.r+p.r&&np.y<(b.top||12)){hit=np.clone();break}}
  if(!hit&&np.y<=p.r*.6){hit=np.clone();hit.y=.2}
  if(!hit&&(Math.hypot(np.x,np.z)>AB.R+60||t-p.t0>p.life)){world.remove(p.m);return false}
  if(hit){melonImpact(hit,p,hq,hwp,hen,t);world.remove(p.m);return false}
  p.prev.copy(np);p.m.position.copy(np);return true})}
function melonImpact(at,p,q,wp,en,t){const big=p.big,onBody=!!(q||wp);
 // far from the camera a burst grows, so it still reads on screen (a hit at seventy paces is as clear as one at twenty)
 const vk=clampN(cam.position.distanceTo(at)/32,1,2.6),pw=(big?.7+p.charge*.9:.3)*vk;
 // juice, rind and seeds
 FXK.glow(at.x,at.y,at.z,big?16*pw:6.5*vk,[1,.35,.45,1],big?.32:.22);FXK.glow(at.x,at.y,at.z,big?6*pw:2.6*vk,[1,.95,.95,1],.14);
 for(let i=0;i<(big?60:18);i++){const a=Math.random()*6.283,e=rnd(-.2,1.2),s=rnd(10,34)*(big?pw:.65*vk);const c=i%6===0?[.3,.78,.32,1]:i%7===0?[.08,.05,.04,1]:[1,.16,.24,1];
  fxP({x:at.x,y:at.y,z:at.z,vx:Math.cos(a)*Math.cos(e)*s,vy:Math.sin(e)*s,vz:Math.sin(a)*Math.cos(e)*s,life:rnd(.4,.95),s0:rnd(.45,1)*(big?1.6:1)*vk,s1:.14*vk,c0:c,c1:[.55,.04,.08,0],kind:i%3===0?2:0,grav:42,drag:.6,stretch:1})}
 for(let i=0;i<(big?6:2);i++)fxP({x:at.x+rnd(-1,1),y:at.y+rnd(-1,1),z:at.z+rnd(-1,1),vx:rnd(-3,3),vy:rnd(0,4),vz:rnd(-3,3),life:rnd(.6,1.2),s0:big?2.5*pw:1.2,s1:big?6*pw:2.6,c0:[.85,.22,.3,.35],c1:[.5,.1,.15,0],kind:3,drag:1.5})
 if(big){fxRing(at.x,at.z,10+pw*10,0xff5a7a,.5);fxLight(at.x,at.y+3,at.z,0xff5a7a,3*pw,70,.4);FXK.smoke(at.x,Math.max(1,at.y),at.z,4,5*pw,[.45,.14,.16,.3]);shardBurst(at,8,pw);shake=Math.max(shake,.9*pw)}
 if(at.y<2.5)floorSplat(at.x,at.z,big?3+pw*4:1.6+Math.random());
 splatSnd(big,!!wp);
 if(onBody&&B.ty&&TY.pose){const kk=big?.5+.6*(p.charge||0):.1;TY.pose.hit=Math.min(1.25,TY.pose.hit+kk*(wp?1.3:1));const rx=Math.cos(B.a),rz=-Math.sin(B.a);TY.pose.side=((at.x-B.px)*rx+(at.z-B.pz)*rz)>0?-1:1}   // he flinches, on every screen
 if(p.remote)return;
 if(en){damageEnemy(en,(big?62.5*(.5+p.charge):14)*DPW()*(p.barrage?.83:1),t);return}
 if(!onBody){if(big)splashBoss(at,pw,t,p.barrage?.83:1);return}
 // the damage: weak points count two and a half times; charged melons more again
 let dmg=(p.barrage?19.92:big?50*(.45+p.charge*1.05):12)*DPW();if(wp)dmg*=2.5;
 if(wp){DUEL.meter=Math.min(1,DUEL.meter+(p.barrage?0:big?.14:.06));DUEL.wpHits++}else DUEL.meter=Math.min(1,DUEL.meter+(p.barrage?0:big?.03:.009));
 hitMark(!!wp,big);DUEL.hits++;dealBoss(dmg,t,at,!!wp,big);if(wp&&!MP.client)B.stag+=dmg*1.2;rumble(wp?.35:.15,wp?.5:.25,wp?90:50)}
// a charged melon that bursts beside him still splashes him
function splashBoss(at,pw,t,dk){if(!DUEL.body||!B.ty||B.st==='dead')return;const R=6+pw*6;let near=1e9;for(const c of DUEL.body){const r=segSeg(at,at,c.a,c.b);near=Math.min(near,Math.sqrt(r.d2)-c.R)}
 if(near<R){const k=1-Math.max(0,near)/R;dealBoss(22.5*pw*k*DPW()*(dk||1),t,at,false,true);hitMark(false,true)}}
// damage with its number where the melon burst (the game's own number is kept quiet while the duel deals it)
function dealBoss(dmg,t,at,wp,big){dmg=Math.max(1,Math.round(dmg));DUEL.dmg+=dmg;DUEL.quiet=true;try{damageBoss(dmg,t)}finally{DUEL.quiet=false}
 floatText(at.x,at.y+(wp?4:2.5),at.z,(wp?'✦ ':'')+dmg,wp?'#7affc0':big?'#ffb0c0':'#ffe24a',wp?3.4:big?3:2.2)}
function hitMark(wp,big){DUEL.hitT=now();DUEL.hitWp=wp;DUEL.hitBig=big}
// juice on the courtyard floor (fades), rind shards that bounce
function floorSplat(x,z,s){const T=dTex();const m=new THREE.Mesh(T.splatGeo,new THREE.MeshBasicMaterial({map:T.splat,transparent:true,opacity:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));m.rotation.x=-Math.PI/2;m.rotation.z=Math.random()*6.28;m.position.set(x,.12,z);m.scale.setScalar(s);world.add(m);
 DUEL.splats.push({m,t0:now()});if(DUEL.splats.length>40){const o=DUEL.splats.shift();world.remove(o.m)}}
function shardBurst(at,n,pw){const T=dTex();for(let i=0;i<n;i++){const m=new THREE.Mesh(T.shardGeo,T.rindM);m.position.copy(at);m.scale.setScalar(.6+pw*.6);m.castShadow=true;world.add(m);
  const a=Math.random()*6.28,s=rnd(8,22);DUEL.shards.push({m,v:new V3(Math.cos(a)*s,rnd(6,18),Math.sin(a)*s),w:new V3(rnd(-12,12),rnd(-12,12),rnd(-12,12)),t0:now()})}
 while(DUEL.shards.length>48){const o=DUEL.shards.shift();world.remove(o.m)}}
function debrisTick(t,dt){DUEL.splats=DUEL.splats.filter(s=>{const k=(t-s.t0)/7;if(k>1){world.remove(s.m);return false}s.m.material.opacity=.85*Math.min(1,(1-k)*2.2);return true});
 DUEL.shards=DUEL.shards.filter(s=>{const k=t-s.t0;if(k>2.2){world.remove(s.m);return false}s.v.y-=40*dt;s.m.position.addScaledVector(s.v,dt);if(s.m.position.y<.15){s.m.position.y=.15;s.v.y*=-.35;s.v.x*=.6;s.v.z*=.6;s.w.multiplyScalar(.6)}
  s.m.rotation.x+=s.w.x*dt;s.m.rotation.y+=s.w.y*dt;s.m.rotation.z+=s.w.z*dt;if(k>1.6)s.m.scale.multiplyScalar(.9);return true})}
// ---------------------------------------------------------------- the dodge roll: about sixteen paces the way you are moving (straight back without a direction); untouchable while you roll
function duelDodge(t){if(!DUEL.on||t-DUEL.dodgeT<.5||deadT>0||W3.cine||paused||FIN.busy)return;
 let mx=(held('right')?1:0)-(held('left')?1:0)+gpMx,mz=(held('back')?1:0)-(held('forward')?1:0)+gpMz;if(Math.hypot(mx,mz)<.25){mx=0;mz=1}const l=Math.hypot(mx,mz);mx/=l;mz/=l;
 const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw),rx=Math.cos(camYaw),rz=-Math.sin(camYaw);DUEL.dodgeDir.set(rx*mx-fx*mz,0,rz*mx-fz*mz).normalize();
 DUEL.dodgeT=t;DUEL.de=0;DUEL.iframe=t+.38;DUEL.perfectWin=t+.22;DNET.rolls++;DUEL.rollYaw=Math.atan2(DUEL.dodgeDir.x,DUEL.dodgeDir.z);
 FXK.dust(heroPos.x,0,heroPos.z,8,5);try{sfxRush(.28,.07,2200,420);sfxTone('sine',160,90,.12,.04,800)}catch(e){}rumble(.2,.3,70)}
function dodgeTick(t,dt){const k=(t-DUEL.dodgeT)/.32;
 const RG=rollTarget(hero,heroCG);
 // sixteen paces over the roll, fast out of the blocks: progress along the eased curve, so a slow frame never shortens it
 if(k>=0&&DUEL.de<1){const kk=Math.min(1,k),ee=1-(1-kk)*(1-kk),st=16*(ee-DUEL.de);DUEL.de=ee;heroPos.x+=DUEL.dodgeDir.x*st;heroPos.z+=DUEL.dodgeDir.z*st;{const rr=Math.hypot(heroPos.x,heroPos.z),M=PLAYR+25;if(rr>M){heroPos.x*=M/rr;heroPos.z*=M/rr}}}
 if(k<0||k>1){if(DUEL.rolled&&RG){RG.rotation.x=0;RG.position.set(0,0,0);DUEL.rolled=false}return}
 const e=1-(1-k)*(1-k);
 hero.position.x=heroPos.x;hero.position.z=heroPos.z;aimYaw=DUEL.rollYaw;aimT=t;heroYaw=DUEL.rollYaw;hero.rotation.y=DUEL.rollYaw;
 if(RG){const hc=2.0*(RG===heroCG?heroCG.scale.x:.62),a=Math.PI*2*e;RG.rotation.x=a;RG.position.set(0,hc-hc*Math.cos(a),-hc*Math.sin(a));DUEL.rolled=true}
 if(frame%2===0){fxP({x:heroPos.x,y:hero.position.y+1.6,z:heroPos.z,life:.4,s0:2.6,s1:1.6,c0:[.55,.75,1,.28],c1:[.4,.6,1,0],kind:0});FXK.dust(heroPos.x,0,heroPos.z,2,2)}}
// your hits taken: none while you roll; a roll just as the blow lands is PERFECT (the meter jumps, a blue flash)
function duelHurtGate(d){if(!DUEL.on)return true;const t=now();if(FIN.busy&&FIN.me)return false;if(t>=DUEL.iframe)return true;
 if(t<DUEL.perfectWin+.03&&t-DUEL.perfectT>.6){DUEL.perfectT=t;DUEL.perfects++;DUEL.meter=Math.min(1,DUEL.meter+.25);floatText(heroPos.x,hero.position.y+6,heroPos.z,'PERFECT!','#9fe4ff',3.6);
  FXK.glow(heroPos.x,hero.position.y+3,heroPos.z,16,[.55,.85,1,1],.3);fxRing(heroPos.x,heroPos.z,16,0x8fd8ff,.45);W3.kick(3);rumble(.6,.9,160);
  try{sfxTone('sine',880,1760,.32,.08,7000);sfxTone('triangle',440,880,.25,.05,4000)}catch(e){}MX.stats.dodges++;DNET.perf++}
 return false}
// ---------------------------------------------------------------- the Melon Barrage: fourteen glowing melons that seek his open weak points
function duelBarrage(t){if(!DUEL.on||DUEL.meter<1||!B.ty||B.st==='dead'||W3.cine||DUEL.barrage)return;DUEL.meter=0;DUEL.barrage={t0:t,n:0};duelHint('MELON BARRAGE!',1400);W3.kick(4);rumble(.7,.8,400);
 try{sfxTone('sawtooth',180,900,.7,.08,3000);sfxRush(.6,.06,800,4000)}catch(e){}}
function barrageTick(t){const b=DUEL.barrage;if(!b)return;if(!B.ty||B.st==='dead'){DUEL.barrage=null;return}const k=t-b.t0;const open=Object.keys(DUEL.open||{});
 while(b.n<14&&k>b.n*.075){b.n++;const home=open.length?open[b.n%open.length]:(['core','head','handR','handL'])[b.n%4];const w=DUEL.wp[home]||DUEL.wp.core;if(!w){DUEL.barrage=null;return}
  const to=w.p.clone().add(new V3(rnd(-8,8),rnd(-4,10),rnd(-8,8)));duelFire(t,.85,{to,home,barrage:true});const p=DUEL.proj[DUEL.proj.length-1];if(p){p.v.x+=rnd(-30,30);p.v.y+=rnd(10,40);p.v.z+=rnd(-30,30);p.life=4}
  if(b.n%2)try{sfxTone('sine',300+b.n*40,120,.12,.05,2400)}catch(e){}}
 if(b.n>=14)DUEL.barrage=null}
// ---------------------------------------------------------------- lock-on: the camera keeps his chest (or the open weak point nearest your aim) under the crosshair
function lockTick(t,dt){const L=DUEL.el&&DUEL.el.lk;if(!DUEL.lock||!B.ty||B.st==='dead'||!DUEL.body||W3.cine){if(L)L.style.display='none';if(DUEL.lock&&(!B.ty||B.st==='dead'))DUEL.lock=false;return}
 let tgt=DUEL.wp.core,bd=1e9;cam.updateMatrixWorld();for(const k in DUEL.open){const w=DUEL.wp[k];if(!w)continue;const s=w.p.clone().project(cam);const dd=Math.hypot(s.x,s.y-.08);if(s.z<1&&dd<bd){bd=dd;tgt=w}}
 if(!tgt)return;const s=tgt.p.clone().project(cam);if(s.z>=1)camYaw+=angN(Math.atan2(-(tgt.p.x-cam.position.x),-(tgt.p.z-cam.position.z))-camYaw)*Math.min(1,dt*5);
 else{camYaw-=clampN(s.x,-1.5,1.5)*dt*4.2;camPitch=clampN(camPitch-clampN(s.y-.08,-1.5,1.5)*dt*2.6,-1.35,1.45)}
 if(L){L.style.display=s.z<1?'block':'none';L.style.left=((s.x+1)/2*innerWidth)+'px';L.style.top=((1-s.y)/2*innerHeight)+'px'}
 if(DUEL.lockBreak>420){DUEL.lock=false;DUEL.lockBreak=0;duelHint('Lock-on released',1000)}DUEL.lockBreak=Math.max(0,DUEL.lockBreak-dt*300)}
// ---------------------------------------------------------------- the duel in multiplayer: your friend sees what you do and you see what they do,
// at full quality. Every shot and melon bomb flies from the shooter's own blaster and bursts where it lands; the blaster glows while they charge;
// they turn and point where they aim; their rolls and PERFECT dodges show. (Damage stays with the shooter's own game; the host keeps his health.)
const DNET={seq:0,ring:[],rolls:0,perf:0};const rd1=v=>Math.round(v*10)/10;
function netShot(from,to,charge,barrage){if(!MP.on)return;DNET.seq++;DNET.ring.push([DNET.seq,rd1(from.x),rd1(from.y),rd1(from.z),rd1(to.x),rd1(to.y),rd1(to.z),+charge.toFixed(2),barrage?1:0]);if(DNET.ring.length>12)DNET.ring.shift()}
W3.duelPres=function(){if(!DUEL.on)return null;let a=null;try{if(!W3.cine&&!FIN.busy){const A=aimPoint();a=[rd1(A.p.x),rd1(A.p.y),rd1(A.p.z)]}}catch(e){}return {c:+DUEL.charge.toFixed(2),a,s:DNET.ring.slice(),r:DNET.rolls,p:DNET.perf}};
// the figure a roll turns: player two's figure when that is what shows, else Bushido
function rollTarget(o,cg){const rc=o&&o.userData.rc;if(rc&&rc.kind==='p2'&&rc.wrap&&rc.wrap.visible)return rc.wrap;return cg||null}
function duelPeers(t,dt){if(!MP.on||!MP.players)return;
 for(const id in MP.players){const P=MP.players[id];if(!P||!P.g||!P.st)continue;const d=P.w3d,N=P.dn||(P.dn={seq:-1,rolls:-1,perf:-1,gun:null,rollT:-9,rolled:false});
  const p2=!!(MP.hostPeer&&P.peer!==MP.hostPeer);
  if(!d||!DUEL.on){if(N.gun)gunVis(N.gun,false);if(N.held&&P.api&&P.api.akHold){P.api.akHold(null);N.held=false}continue}
  // the blaster in their hands: Bushido holds it where he held the AK; player two points it from the fist
  let S=null;
  if(!p2&&P.api&&P.api.AK){try{if(P.api.weapon()!=='ak')P.api.equip('ak')}catch(e){}const AK=P.api.AK;duelRifleOn(AK);if(!N.held&&P.api.akHold){P.api.akHold(N.hold||(N.hold=Object.assign({},DUELHOLD,{pitch:0})));N.held=true}
   AK.userData.akParts.forEach(c=>{if(c.visible)c.visible=false});AK.userData.duelS.visible=true;S=AK.userData.duelS}
  else if(p2){if(d.a){P.p2pt=t+1.2;(P.p2aim||(P.p2aim=new V3())).set(d.a[0],d.a[1],d.a[2])}
   const rc=P.g.userData.rc;if(rc&&rc.kind==='p2'&&rc.C){N.gun=p2GunFor(rc.C);const ok=!P.st.dead&&P.g.visible&&rc.wrap.visible&&!W3.cine;p2GunShow(rc.C,ok);S=N.gun}}
  // their charge glows in their blaster
  if(S&&S.userData.core){const c=+d.c||0,U=S.userData,k=.02+c*.98;U.core.scale.y=k*U.coreLen;U.core.position.z=U.cellZ-U.coreLen/2+k*U.coreLen/2;U.core.material.color.setRGB(1,.22+c*.5,.38+c*.4);U.glow.material.opacity=c*.85;U.glow.scale.setScalar(.01+c*2.2)}
  // their shots, new since the last word from them
  if(Array.isArray(d.s)){if(N.seq<0)N.seq=d.s.length?d.s[d.s.length-1][0]:0;else for(const q of d.s){if(!Array.isArray(q)||q[0]<=N.seq)continue;N.seq=q[0];remoteShot(P,S,q,t)}}
  // their rolls and their PERFECT dodges
  if(N.rolls<0)N.rolls=d.r|0;else if((d.r|0)>N.rolls){N.rolls=d.r|0;N.rollT=t;FXK.dust(P.g.position.x,0,P.g.position.z,8,5)}
  if(N.perf<0)N.perf=d.p|0;else if((d.p|0)>N.perf){N.perf=d.p|0;const g=P.g.position;FXK.glow(g.x,g.y+3,g.z,16,[.55,.85,1,1],.3);fxRing(g.x,g.z,16,0x8fd8ff,.45);floatText(g.x,g.y+6,g.z,'PERFECT!','#9fe4ff',3)}
  const RG=rollTarget(P.g,P.cg),rk=(t-N.rollT)/.32;
  if(RG){if(rk>=0&&rk<=1){const e=1-(1-rk)*(1-rk),a=Math.PI*2*e,hc=2.0*(RG===P.cg?P.cg.scale.x:.62);RG.rotation.x=a;RG.position.set(0,hc-hc*Math.cos(a),-hc*Math.sin(a));N.rolled=true}else if(N.rolled){RG.rotation.x=0;RG.position.set(0,0,0);N.rolled=false}}}}
function remoteShot(P,S,q,t){const from=new V3(q[1],q[2],q[3]),to=new V3(q[4],q[5],q[6]),c=+q[7]||0;
 // from their blaster as it shows here (their position on this screen trails theirs a little), else from where they said
 if(S&&S.visible!==false&&S.userData.muzzle){S.updateWorldMatrix(true,false);const m=S.userData.muzzle.clone().applyMatrix4(S.matrixWorld);if(m.distanceTo(from)<14)from.copy(m)}
 try{if(P.api&&P.api.fire)P.api.fire(t)}catch(e){}
 spawnShot(t,from,to,c,{barrage:!!q[8]},true);const dd=from.distanceTo(cam.position);if(!q[8]||Math.random()<.4)fireSnd(c>=.25,c,clampN(1-dd/160,.15,.8))}
// ---------------------------------------------------------------- every frame in the realm
const edge=(k,v)=>{const was=DUEL.prev[k];DUEL.prev[k]=v;return v&&!was};
function duelTick(t,dt){if(!DUEL.on)return;
 // from his second stage on, player one wears Go-Go mode's look (no powers) (the owner)
 {const want=!MP.client&&!!B.ty&&B.phase>=2;if(want!==!!W3.gl){W3.gl=want;try{setGogoLook(want,want)}catch(e){}}}
camPitch=clampN(camPitch,PITCH_LO,PITCH_HI);try{duelPeers(t,dt)}catch(e){if(!W3._peerErr){W3._peerErr=1;console.error('duel peers',e)}}if(FIN.busy&&!W3.cine&&now()-FIN.t0>1)finRelease();if(!DUEL.body)bodyInit();bodyTick();wpTick(t);projTick(t,dt);debrisTick(t,dt);dodgeTick(t,dt);barrageTick(t);lockTick(t,dt);
 const GS=MP.client?null:armDuelGun();
 const P2G=MP.client?p2Shooter():null;
 const dead=B.st==='dead',noGun=dead&&!enemies.some(e=>e.kind&&e.hp>0),busy=W3.cine||deadT>0||paused||uiBlock()||FIN.busy;   // after he falls the blaster still works on anything left standing
 if((uiBlock()||(dead&&$('w3rw')))&&pLocked())try{document.exitPointerLock()}catch(e){}
 // aim: right mouse / LT / the touch AIM button; the camera closes in and slows down
 DUEL.ads=!busy&&!noGun&&(DUEL.rmb||isDown('p:6')||!!DUEL.touchAds);DUEL.adsK+=((DUEL.ads?1:0)-DUEL.adsK)*Math.min(1,dt*9);
 // fire: a press shoots at once; keep holding and a melon bomb charges (the cell and the ring fill); letting go throws it
 const lockFire=pLocked()&&DUEL.lmb,fb=!pLocked()&&DUEL.noLock&&DUEL.fbDown&&!DUEL.fbDown.drag&&now()-DUEL.fbDown.t>.22;
 const fireDown=!busy&&!noGun&&(lockFire||fb||held('attack')||DUEL.touchFire);
 if(fireDown){if(!DUEL.chargeOn){DUEL.chargeOn=true;DUEL.c0=t;DUEL.charge=0;if(!fb&&t-DUEL.fireT>.13){DUEL.fireT=t;duelFire(t,0)}}
  DUEL.charge=clampN((t-DUEL.c0-.24)/1.05,0,1);if(DUEL.charge>0){chargeSnd(true,DUEL.charge);aimT=t}}
 else if(DUEL.chargeOn){DUEL.chargeOn=false;chargeSnd(false);if(DUEL.charge>=.25&&!busy){DUEL.fireT=t;duelFire(t,DUEL.charge)}DUEL.charge=0}
 if(DUEL.fbUp){DUEL.fbUp=false;if(!busy&&!noGun&&t-DUEL.fireT>.13){DUEL.fireT=t;duelFire(t,0)}}
 // he faces the aim while you aim or charge (and briefly after each shot)
 let A=null;if((DUEL.adsK>.4||DUEL.charge>0)&&!busy){A=aimPoint();aimYaw=Math.atan2(A.p.x-heroPos.x,A.p.z-heroPos.z);aimT=t;heroYaw=aimYaw;hero.rotation.y=aimYaw}
 // the shooter: tips up to the aim, kicks back on each shot, the cell glows with the charge
 DUEL.recoil=Math.max(0,DUEL.recoil-dt*5);const c=DUEL.charge;
 if(GS){let want=0;if(t-aimT<.5||c>0||DUEL.adsK>.3){if(!A)A=aimPoint();const m=muzzlePos(new V3());want=clampN(Math.atan2(A.p.y-m.y,Math.hypot(A.p.x-m.x,A.p.z-m.z)),-.5,.9)}
  DUEL.pitch+=(want-DUEL.pitch)*Math.min(1,dt*10);if(charApi.akHold)DUELHOLD.pitch=DUEL.pitch*.32;else charApi.AK.rotation.x-=DUEL.pitch*.32}
 [GS,P2G].forEach(S=>{if(!S)return;const U=S.userData,k=.02+c*.98;U.core.scale.y=k*U.coreLen;U.core.position.z=U.cellZ-U.coreLen/2+k*U.coreLen/2;U.core.material.color.setRGB(1,.22+c*.5,.38+c*.4);U.glow.material.opacity=c*.85+(c>=1?.15*Math.sin(t*28):0);U.glow.scale.setScalar(.01+c*2.2)});
 if(c>0&&frame%3===0){const m=muzzlePos(new V3());fxP({x:m.x+rnd(-1.4,1.4)*c,y:m.y+rnd(-1.4,1.4)*c,z:m.z+rnd(-1.4,1.4)*c,vx:0,vy:0,vz:0,life:.3,s0:.2,s1:.05,c0:[1,.5,.65,1],c1:[1,.3,.5,0],kind:0})}
 if(MP.client&&P2S_ready()){if(!A)A=aimPoint();P2L.pt=t+1.2;P2L.aim.copy(A.p);P2L.hasAim=true;P2L.tgt=null;p2ShooterPlace(A.p)}
 // dodge · barrage or the finishing strike · lock-on
 if(edge('dodge',!!(isDown('k:q')||isDown('k:control')||isDown('p:1')||isDown('p:5')))&&!busy)duelDodge(t);
 if(edge('sup',!!(isDown('k:e')||isDown('p:3')))&&!busy){if(B.st==='break')finisherStart(false);else duelBarrage(t)}
 if(edge('lock',!!(DUEL.mmb||isDown('k:t')||isDown('p:4')))&&!busy){DUEL.lock=!DUEL.lock&&!!B.ty&&!dead;DUEL.lockBreak=0;duelHint(DUEL.lock?'Locked on · flick the mouse to let go':'Lock-on off',1100)}
 duelHud(t)}
function duelHud(t){const E=DUEL.el;if(!E)return;const dead=B.st==='dead',show=!W3.cine&&(!dead||enemies.some(e=>e.kind&&e.hp>0));
 {const h=document.getElementById('hint');if(h){if(!DUEL.keysShown&&show&&B.ty&&B.st!=='fall'&&B.st!=='land'){DUEL.keysShown=true;DUEL.keysT=now()}const k=now()-DUEL.keysT,v=DUEL.keysShown&&k<14?(k>12?(14-k)/2:1):0;h.style.opacity=v.toFixed(2);h.style.pointerEvents=v>0?'':'none'}}
 E.x.style.display=E.cr.style.display=show?'block':'none';E.bm.parentNode.style.display=E.bl.style.display=show?'block':'none';
 const spread=1+DUEL.recoil*.35-DUEL.adsK*.18;E.x.style.transform='scale('+spread.toFixed(3)+')';E.x.classList.toggle('wp',!!Object.keys(DUEL.open||{}).length);E.x.classList.toggle('on',DUEL.charge>0);
 E.cf.style.strokeDashoffset=(182.2*(1-DUEL.charge)).toFixed(1);E.cf.style.stroke=DUEL.charge>=1?'#ffffff':'#ff5a7a';
 const hk=(t-DUEL.hitT)/.22;E.hm.style.opacity=hk>=0&&hk<1?(1-hk):0;E.hm.classList.toggle('wp',!!DUEL.hitWp);E.hm.style.transform='scale('+((DUEL.hitBig?1.4:1)*(1+Math.max(0,hk)*.3)).toFixed(3)+')';
 E.bm.style.width=(DUEL.meter*100).toFixed(1)+'%';E.bl.classList.toggle('full',DUEL.meter>=1);E.bl.textContent=DUEL.meter>=1?(isTouchDev()?'BUSHIDO · TAP BARRAGE':'BUSHIDO · PRESS E · Ⓨ'):'BUSHIDO';
 E.fin.style.display=(B.st==='break'&&!FIN.busy&&!W3.cine)?'block':'none';
 if(B.st==='break'&&DUEL.shownBreak!==B.breaks){DUEL.shownBreak=B.breaks;rumble(.5,.5,300);try{sfxTone('sine',220,440,.5,.06,3000)}catch(e){}}}
// ---------------------------------------------------------------- the duel's camera: over his left shoulder (the blaster side), looking where you aim
// It orbits a point at his shoulders, so he stays in the frame however high you look (nearer as you look up, so you never lose him);
// the crosshair sits just above and beside him. The mouse, the right stick and a touch drag all turn it.
const PITCH_LO=-1.13,PITCH_HI=1.11;
const dirE=(y,e)=>new V3(-Math.sin(y)*Math.cos(e),Math.sin(e),-Math.cos(y)*Math.cos(e));
const CAMK={b0:.26,bk:.25,e0:.35,dmin:7,fk:8,sk:.9};
function duelFrameK(){return Math.max(DUEL.adsK||0,.9)}
function duelCamPose(){const K=CAMK,e=clampN(-camPitch*.9+.1,-.9,1.12),y=camYaw,f=dirE(y,e),r=new V3(Math.cos(y),0,-Math.sin(y)),up=Math.max(0,e-K.e0);
 // his shoulders sit a set angle below the middle of the screen (lower as you look up); looking up, the camera comes in low behind him and widens a little
 const fr=bossFrame(),near=fr?fr.near:0,beta=K.b0+up*K.bk,eg=e-beta,g=dirE(y,eg),piv=hero.position.clone();piv.y+=3.3*sizeMul();
 const bg=W3.bigK||0;piv.y+=2.4*sizeMul()*bg;let d=camDist*(1.05+.45*near)*(1-.4*duelFrameK())*(1+.38*bg);if(eg>0)d=Math.min(d,Math.max(K.dmin,(piv.y-1.2)/Math.sin(eg)));
 const side=-(1.6+d*.09)*(1+.25*duelFrameK())*(1+up*K.sk);const p=piv.addScaledVector(g,-d).addScaledVector(r,side);p.y=Math.max(p.y,1.2);
 return {p,l:p.clone().addScaledVector(f,60),fov:(W3.fovT?W3.fovT():55)+up*K.fk+7*bg,d}}
// when the camera comes in close behind him (looking up at the Tyrant), Bushido turns see-through, so his afro never hides the fight
function heroFade(k){const W=hero.userData.rc&&hero.userData.rc.wrap,sig=hero.children.length+'|'+(W?W.uuid:'');
 if(DUEL.fadeM&&DUEL.fadeSig!==sig){const kk=DUEL.fadeK;DUEL.fadeK=-1;fadeApply(0);DUEL.fadeM=null;DUEL.fadeK=kk}
 if(!DUEL.fadeM){DUEL.fadeSig=sig;DUEL.fadeM=[];hero.traverse(o=>{if(!o.isMesh||!o.material||o.userData.noFade)return;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.userData.noFade)return;if(!m.userData.fd){m.userData.fd={t:m.transparent,o:m.opacity,dw:m.depthWrite}}if(!DUEL.fadeM.includes(m))DUEL.fadeM.push(m)})});DUEL.fadeK=-1}
 if(Math.abs((DUEL.fadeK||0)-k)<.01)return;DUEL.fadeK=k;fadeApply(k)}
function fadeApply(k){const op=1-k;(DUEL.fadeM||[]).forEach(m=>{const f=m.userData.fd;if(!f)return;if(k<.01){if(m.transparent!==f.t){m.transparent=f.t;m.needsUpdate=true}m.opacity=f.o;m.depthWrite=f.dw}else{if(!m.transparent){m.transparent=true;m.needsUpdate=true}m.opacity=f.o*op;m.depthWrite=op>.97}})}
W3.camPost=function(){if(!DUEL.on||W3.cine||fpCam||bossCam){if(DUEL.fadeK)heroFade(0);return}const P=duelCamPose(),sk=SET.shake?shake*shake:0;heroFade(clampN((9.5-P.d)/3.5,0,1)*.65);
 cam.position.set(P.p.x+(Math.random()-.5)*sk*1.2,P.p.y+(Math.random()-.5)*sk*.9,P.p.z+(Math.random()-.5)*sk*1.2);cam.lookAt(P.l);DUEL.camFov=P.fov};
// ---------------------------------------------------------------- THE FINISHING STRIKE: he is on his knee; you leap to his face and break a giant melon over it
// The striker's screen plays it with the striker's own hero; everyone else sees the same film with the striker's figure flying in.
const FIN={busy:false,t0:0,actor:null,me:false,done:false,melon:null,face:null,front:null,land:null,kill:false};
function actorFor(peer){if(!peer||peer===MP.me)return {o:hero,cg:heroCG,api:charApi,redCap:!!MP.client,me:true};const P=MP.players&&MP.players[peer];if(P&&P.g)return {o:P.g,cg:P.cg,api:P.api,redCap:!!(MP.hostPeer&&P.peer!==MP.hostPeer),me:false};return null}
function finisherStart(fromNet,peer){if(FIN.busy||B.st!=='break'||!B.ty||!DUEL.on)return;const A=fromNet?actorFor(peer):actorFor(null);FIN.busy=true;FIN.kill=false;
 if(MP.on&&!fromNet)mpQueue({k:'w3fin',p:MP.me});
 // the host keeps him down until the blow lands
 if(!MP.client&&B.brk)B.brk.t0=Math.max(B.brk.t0,now()-8+5.5);
 const t=now();FIN.t0=t;FIN.actor=A;FIN.me=!!(A&&A.me);FIN.done=false;FIN.landed=false;FIN.jumped=false;FIN.killed=false;FIN.killAt=1e9;DUEL.lock=false;DUEL.charge=0;DUEL.chargeOn=false;chargeSnd(false);if(pLocked())try{document.exitPointerLock()}catch(e){}
 bodyTick();const face=(DUEL.wp.head?DUEL.wp.head.p.clone():tyHead(0)());const front=new V3(Math.sin(B.a),0,Math.cos(B.a));FIN.face=face;FIN.front=front;FIN.fdir=HD.face.clone();FIN.fup=HD.up.clone();
 ENV.brkT=0;if(A&&A.me&&charApi)try{charApi.equip('fists')}catch(e){}
 const from=A?A.o.position.clone():new V3(B.px,0,B.pz).addScaledVector(front,40);from.y=Math.max(0,from.y);FIN.from=from;
 // the strike point in front of his face, a high waypoint (round his shoulder if you were behind him), and where you land
 const hit=face.clone().addScaledVector(FIN.fup,6.5).addScaledVector(FIN.fdir,3);
 const side=new V3(front.z,0,-front.x);const toS=from.clone().sub(face);toS.y=0;const behind=toS.dot(front)<0;const sgn=toS.dot(side)>=0?1:-1;
 const mid=from.clone().lerp(hit,.5);mid.y=Math.max(from.y,hit.y)+14;if(behind)mid.addScaledVector(side,sgn*34).addScaledVector(front,18);
 FIN.path=new THREE.CatmullRomCurve3([from.clone(),mid,hit.clone()],false,'centripetal');FIN.hit=hit;FIN.side=side.multiplyScalar(sgn);
 FIN.land=new V3(B.px,0,B.pz).addScaledVector(front,30).addScaledVector(FIN.side,6);
 const SP=()=>FIN.actor?FIN.actor.o.position.clone():FIN.hit.clone();
 const toFace=()=>{const v=FIN.face.clone().sub(SP());v.y=0;return v.lengthSq()>1e-6?v.normalize():FIN.front.clone().negate()};
 const midP=()=>SP().lerp(FIN.face,.5);
 filmPlay([
  // the wind-up: low behind the striker, looking up past him at the kneeling Tyrant; a giant melon forms over his head
  {d:FT.wind,ease:'o',fov:[52,46],blend:.35,p:[()=>SP().addScaledVector(toFace(),-12).addScaledVector(FIN.side,3.2).add(new V3(0,1.6,0)),()=>SP().addScaledVector(toFace(),-9.5).addScaledVector(FIN.side,2.6).add(new V3(0,1.2,0))],
   l:[()=>FIN.face.clone().lerp(SP(),.35),()=>FIN.face.clone().lerp(SP(),.25)]},
  // the leap: tracking alongside as he flies up at the Tyrant's face (both in the frame)
  {d:FT.leap,ease:'s',fov:[50,44],p:[()=>SP().addScaledVector(FIN.side,15).addScaledVector(toFace(),-7).add(new V3(0,-1,0)),()=>SP().addScaledVector(FIN.side,12).addScaledVector(toFace(),-5).add(new V3(0,1.5,0))],
   l:[()=>SP().lerp(FIN.face,.4),()=>SP().lerp(FIN.face,.5)]},
  // the apex, slowed: alongside him at the top of his leap, his whole body in profile, the giant melon raised high, the Tyrant's bowed face below
  {d:FT.apex,ease:'l',fov:[40,35],p:[()=>SP().addScaledVector(FIN.side,15).addScaledVector(FIN.fdir,1.5).add(new V3(0,1.2,0)),()=>SP().addScaledVector(FIN.side,13).addScaledVector(FIN.fdir,1).add(new V3(0,2.2,0))],l:[()=>SP().lerp(FIN.face,.32).add(new V3(0,2.2,0)),()=>SP().lerp(FIN.face,.36).add(new V3(0,1.6,0))]},
  // the blow: from in front of his face as it lands, pulling back while his head snaps (the fall film follows)
  {d:1.5,ease:'o',fov:[42,56],until:()=>B.st==='dead',p:[()=>FIN.face.clone().addScaledVector(FIN.fdir,14).addScaledVector(FIN.side,4.5).addScaledVector(FIN.fup,-1.5),()=>FIN.face.clone().addScaledVector(FIN.fdir,38).addScaledVector(FIN.side,13).add(new V3(0,-4,0))],
   l:[()=>FIN.face.clone(),()=>FIN.face.clone().add(new V3(0,-5,0))],shake:k=>k<.3?2.6*(1-k/.3):0}
 ],{toGame:1.2,ph:'fight',onEnd:()=>{finRelease()}});
 duelHint('',10);try{sfxTone('sine',180,360,.6,.06,2000)}catch(e){}}
function finRelease(){if(!FIN.busy)return;FIN.busy=false;if(FIN.melon){world.remove(FIN.melon);FIN.melon=null}const A=FIN.actor;if(A&&A.me){heroPos.set(FIN.land.x,0,FIN.land.z);hero.position.set(FIN.land.x,0,FIN.land.z);flyY=0}if(A&&A.cg){A.cg.rotation.x=0;A.cg.position.set(0,0,0)}FIN.actor=null}
// the striker's flight, the melon, the blow (runs inside the films)
const FT={wind:.7,leap:1.15,apex:.62};
function finTick(t,dt){if(!FIN.busy||!FIN.t0)return;const k=t-FIN.t0,A=FIN.actor,o=A&&A.o;const T1=FT.wind,T2=T1+FT.leap,T3=T2+FT.apex;
 if(!FIN.melon&&!FIN.done){const m=shotMesh(true,1);m.scale.setScalar(.01);world.add(m);FIN.melon=m}
 let pos=null,air=0,flip=0,melonAt=null,ms=0;
 if(k<T1){pos=FIN.from.clone();const c=clampN((k-.35)/.35,0,1);if(A&&A.cg)A.cg.scale.y=A.cg.scale.x*(1-.18*Math.sin(c*Math.PI*.5));ms=EZ.o(clampN(k/.5,0,1))*1.15;melonAt=pos.clone().add(new V3(0,5.6+ms,0));
  if(frame%2===0)fxP({x:melonAt.x+rnd(-3,3),y:melonAt.y+rnd(-3,3),z:melonAt.z+rnd(-3,3),vx:0,vy:0,vz:0,life:.35,s0:.35,s1:.05,c0:[1,.7,.8,1],c1:[1,.3,.5,0],kind:0})}
 else if(k<T2){const e=EZ.io(clampN((k-T1)/FT.leap,0,1))*.96;pos=FIN.path.getPoint(e);air=1;flip=clampN((k-T1-.1)/.55,0,1);ms=1.15;melonAt=pos.clone().add(new V3(0,6.6,0));
  if(!FIN.jumped){FIN.jumped=true;FXK.dust(FIN.from.x,0,FIN.from.z,18,10);fxRing(FIN.from.x,FIN.from.z,9,0xffe0c0,.4);try{sfxRush(.5,.08,600,2600)}catch(e){}if(A&&A.me)rumble(.4,.6,180)}
  if(frame%2===0)fxP({x:pos.x,y:pos.y+2,z:pos.z,life:.5,s0:3,s1:1,c0:[1,.6,.7,.35],c1:[1,.3,.4,0],kind:0})}
 else if(k<T3){const e=.96+.04*clampN((k-T2)/FT.apex,0,1);pos=FIN.path.getPoint(e);air=1;const sw=clampN((k-T3+.16)/.16,0,1);ms=1.15+sw*.25;
  melonAt=pos.clone().add(new V3(0,6.6-sw*1.5,0)).lerp(FIN.face,sw*.85)}
 else{if(!FIN.done){FIN.done=true;finBlow(t)}if(t>=FIN.killAt)finKill(t);const e=clampN((k-T3)/1.2,0,1);pos=FIN.hit.clone().lerp(FIN.land,EZ.s(e));pos.y=FIN.hit.y*(1-e)+Math.sin(e*Math.PI)*8;air=e<1?1:0;flip=-clampN(e/.7,0,1);
  if(e>=1&&!FIN.landed){FIN.landed=true;FXK.dust(FIN.land.x,0,FIN.land.z,14,8);abyssSfx('boom',.25,0)}}
 if((FIN.landed&&FIN.killed)||k>8){if(!FIN.killed)finKill(t);if(o&&pos){o.position.copy(pos)}finRelease();return}
 if(o&&pos){o.position.copy(pos);if(A.me){heroPos.set(pos.x,0,pos.z);flyY=pos.y}const f=FIN.face.clone().sub(pos);o.rotation.y=Math.atan2(f.x,f.z);if(A.me)heroYaw=o.rotation.y;
  try{if(A.api&&A.api.anim)A.api.anim(t,false,false,air,false)}catch(e){}try{if(typeof MSC!=='undefined')MSC.tick(o,A.cg,A.redCap,air?4:0,t,dt,false,null)}catch(e){}
  if(A.cg){const hc=2.6*A.cg.scale.x;if(flip!==0){const a=Math.PI*2*EZ.io(Math.abs(flip))*Math.sign(flip);A.cg.rotation.x=a;A.cg.position.set(0,hc-hc*Math.cos(a),-hc*Math.sin(a))}else{A.cg.rotation.x=0;A.cg.position.set(0,0,0)}if(k>=T1)A.cg.scale.y=A.cg.scale.x}}
 if(FIN.melon&&melonAt&&air&&A&&A.cg&&!A.redCap&&k<T3-.16){A.cg.updateMatrixWorld(true);const hnd=A.cg.localToWorld(new V3(1.7,4.4,.6));melonAt.copy(hnd).add(new V3(0,1.75*ms/1.15*.85,0))}
 if(FIN.melon){if(melonAt&&!FIN.done){FIN.melon.visible=true;FIN.melon.position.copy(melonAt);FIN.melon.scale.setScalar(Math.max(.01,ms));FIN.melon.children[0].rotation.y+=dt*4;FIN.melon.children[0].material.emissiveIntensity=2+Math.sin(t*20)*.8}else FIN.melon.visible=false}}
function finBlow(t){const f=FIN.face;FIN.blowK=t-FIN.t0;FIN.killAt=t+.75;if(FIN.melon){world.remove(FIN.melon);FIN.melon=null}
 fxImpact(f.x,f.z,2,0xff5a7a);FXK.glow(f.x,f.y,f.z,18,[1,.45,.55,1],.35);fxLight(f.x,f.y+2,f.z,0xff6a8a,3,120,.5);
 for(let i=0;i<90;i++){const a=Math.random()*6.283,e=rnd(-.6,1),s=rnd(20,70);fxP({x:f.x,y:f.y,z:f.z,vx:Math.cos(a)*Math.cos(e)*s+FIN.front.x*20,vy:Math.sin(e)*s,vz:Math.sin(a)*Math.cos(e)*s+FIN.front.z*20,life:rnd(.6,1.4),s0:rnd(.8,1.8),s1:.2,c0:i%5===0?[.3,.8,.32,1]:i%9===0?[.06,.04,.03,1]:[1,.16,.24,1],c1:[.55,.04,.08,0],kind:i%3?0:2,grav:46,drag:.4,stretch:1})}
 shardBurst(f,16,1.6);FXK.smoke(f.x,f.y,f.z,6,12,[.5,.18,.2,.35]);fxRing(f.x,f.z,40,0xff7a9a,.7);
 fade(.75,.04,'#ffd6de');setTimeout(()=>fade(0,.7),90);abyssSfx('boom',1,0);abyssSfx('thunder',.6,.15);try{sfxRush(.6,.12,3000,200);sfxTone('sine',90,30,.8,.18,500)}catch(e){}roar(1.2,2.4);shake=3.4;
 if(FIN.me)rumble(1,1,600);
 floatText(f.x,f.y+8,f.z,'FINISHED!','#8affc8',7)}
// the kill: the striker's blow (and the host, who keeps the Tyrant's health) ends him, a breath after it lands
function finKill(t){if(FIN.killed)return;FIN.killed=true;if(FIN.me||!MP.client){FIN.kill=true;DUEL.quiet=true;try{if(!MP.client)B.hp=Math.min(B.hp,1);damageBoss(999999,t)}finally{DUEL.quiet=false;FIN.kill=false}}}
// inside every film: shots in the air keep flying, the striker flies, his weak points fade
function duelFilmTick(t,dt){if(!DUEL.on)return;if(DUEL.fadeK)heroFade(0);gunVis(P2S.g,false);for(const id in (MP.players||{})){const N=MP.players[id]&&MP.players[id].dn;if(N&&N.gun)gunVis(N.gun,false)}bodyTick();projTick(t,dt);debrisTick(t,dt);finTick(t,dt);if(DUEL.wpFx)for(const k in DUEL.wpFx){const sp=DUEL.wpFx[k];sp.material.opacity*=.85;sp.visible=sp.material.opacity>.02}}
// ---------------------------------------------------------------- hooks: the duel owns the attack button, the roll owns your hits, the other weapons and modes rest in the realm
(function(){const inDuel=()=>window.W3&&W3.on&&DUEL.on;
 const pa=playerAttack;playerAttack=function(t){if(inDuel())return;return pa(t)};
 const da=doAction;doAction=function(a){if(inDuel()&&['wheel','gogo','firstPerson','flyUp','flyDown','bossCam','faceBoss','cast'].includes(a))return;return da(a)};
 const hp=hurtPlayer;hurtPlayer=function(d){if(window.W3&&W3.on&&!duelHurtGate(d))return;return hp(d)};
 const at=actionsTick;actionsTick=function(dt){if(inDuel()){if(uiBlock())return;const z=(held('zoomIn')?-1:0)+(held('zoomOut')?1:0);if(z)camDist=clampN(camDist+z*22*dt,6,60);return}return at(dt)};
 const ak=akTick;akTick=function(t,dt){if(inDuel())return;return ak(t,dt)};
 const pg=petGunsTick;petGunsTick=function(t,dt){if(inDuel())return;return pg(t,dt)};
 const me=mechEnter;mechEnter=function(t){if(window.W3&&W3.on)return;return me(t)};
 const sr=startRage;startRage=function(t){if(window.W3&&W3.on)return;return sr(t)};
 const sw=setWizard;setWizard=function(on){if(on&&window.W3&&W3.on)return;return sw(on)};
 const su=l2ShowUpgrades;l2ShowUpgrades=function(){if(window.W3&&W3.on){L2.pendingUps=0;return}return su()};
 // while he is on his knee only the finishing strike ends him (the host keeps his health)
 // and the damage table counts only the health he really lost (not what a phase line or his knee soaked up, nor the overkill)
 const od=W3.onDamage;W3.onDamage=function(dmg){const who=MP.hitBy||'me',th0=(B.threat&&B.threat[who])||0,hp0=B.hp+dmg;od(dmg);if(DUEL.on&&B.st==='break'&&!FIN.kill&&B.hp<1)B.hp=1;
  if(B.threat)B.threat[who]=th0+Math.max(0,hp0-Math.max(0,B.hp));B._hpLast=B.hp;B._lastWho=who};
 // dropping to his knee lifts his health back to the knee line: that part of the last blow never landed
 const sb=startBreak;startBreak=function(t){const r=B._hpLast===undefined?0:B.hp-B._hpLast;if(r>0&&B.threat&&B._lastWho&&B.threat[B._lastWho])B.threat[B._lastWho]=Math.max(0,B.threat[B._lastWho]-r);return sb(t)};
 // his knee in the duel: no banner over the call to finish him
 const bf=W3.breakFx;W3.breakFx=function(on){if(on&&DUEL.on){roar(.7,1.6);ENV.brkT=now();duelHint('He is on his knee — the finishing strike is yours',2600);return}return bf(on)};
 const ft=floatText;floatText=function(x,y,z,txt,col,size){if(DUEL.quiet&&typeof txt==='string'&&/^-\d/.test(txt))return;return ft(x,y,z,txt,col,size)};
 // aim friction on a controller: the right stick slows over his open weak points and while you aim
 const pt=padTick;padTick=function(dt){const y0=camYaw,p0=camPitch;const r=pt(dt);if(inDuel()&&!W3.cine&&gpIdx>=0&&now()-DUEL.mouseT>.3){const k=(Object.keys(DUEL.open||{}).length?.65:1)*(DUEL.adsK>.5?.6:1);if(k<1){camYaw=y0+(camYaw-y0)*k;camPitch=p0+(camPitch-p0)*k}}return r}})();
// ---------------------------------------------------------------- HIS LEGS: real knees, planted feet
// The rig's walk barely folds its knees and lets a planted foot slide a little. On top of the clip, every frame while he walks: a foot on the
// floor stays exactly where it landed (a two-bone pull of hip, knee and ankle, the foot keeping the clip's own angle so it lies flat), and a
// swinging leg folds at the knee and lifts its thigh, so every step reads as a heavy creature striding on real joints. It runs on every screen.
const LEG={on:true,L:null,R:null,k:0};
const _lv=[];for(let i=0;i<12;i++)_lv.push(new V3());const _lq=[new THREE.Quaternion(),new THREE.Quaternion(),new THREE.Quaternion(),new THREE.Quaternion()];
function legInit(){if(LEG.L||!TY.root)return;const f=n=>{let r=null;TY.root.traverse(o=>{if(!r&&o.isBone&&o.name.replace(/_\d+$/,'').replace(/^mixamorig:?/,'')===n)r=o});return r};
 const mk=sd=>{const up=f(sd+'UpLeg'),leg=f(sd+'Leg'),foot=f(sd+'Foot');if(!up||!leg||!foot||!up.parent)return null;return {up,leg,foot,lock:new V3(),locked:false,w:0,hMin:null,fq:new THREE.Quaternion()}};
 LEG.L=mk('Left');LEG.R=mk('Right')}
// turn a bone (in world space) so the direction `from` swings toward `to`, by weight w
function boneSwing(bone,from,to,w){const q=_lq[0].setFromUnitVectors(from,to);if(w<1)q.copy(_lq[3].identity().slerp(q,Math.max(0,w)));
 const pw=bone.parent.getWorldQuaternion(_lq[1]),bw=bone.getWorldQuaternion(_lq[2]);bw.premultiply(q);bone.quaternion.copy(pw.invert().multiply(bw));bone.updateMatrixWorld(true)}
function boneTurn(bone,axis,ang){const q=_lq[0].setFromAxisAngle(axis,ang),pw=bone.parent.getWorldQuaternion(_lq[1]),bw=bone.getWorldQuaternion(_lq[2]);bw.premultiply(q);bone.quaternion.copy(pw.invert().multiply(bw));bone.updateMatrixWorld(true)}
function legPos(L){L.up.updateWorldMatrix(true,true);return [_lv[0].setFromMatrixPosition(L.up.matrixWorld),_lv[1].setFromMatrixPosition(L.leg.matrixWorld),_lv[2].setFromMatrixPosition(L.foot.matrixWorld)]}
function tyLegs(dt){if(!LEG.on||!TY.root||!TY.g||!dt)return;const st=B.st;if(st==='dead'||st==='fall'||st==='land'||st==='break'){LEG.k=0;return}legInit();if(!LEG.L||!LEG.R)return;
 const walking=TY.curName==='Walk';LEG.k+=((walking?1:0)-LEG.k)*Math.min(1,dt*6);if(LEG.k<.01){LEG.L.locked=LEG.R.locked=false;LEG.L.w=LEG.R.w=0;return}
 const fw=_lv[9].set(Math.sin(B.a),0,Math.cos(B.a));
 for(const L of [LEG.L,LEG.R]){let [H,K,A]=legPos(L);const a=K.distanceTo(H),b=A.distanceTo(K),len=a+b;const h=A.y;
  if(L.hMin===null)L.hMin=h;L.hMin=Math.min(h,L.hMin+dt*len*.06);   // the lowest the ankle has been lately: the floor, as this clip sees it
  const lift=(h-L.hMin)/len,stance=lift<.045;
  // the swing: fold the knee and lift the thigh with the foot's rise
  const sw=sstep(.05,.22,lift)*LEG.k;
  if(sw>.002){const u=_lv[3].copy(K).sub(H).normalize(),v=_lv[4].copy(A).sub(K).normalize(),n=_lv[5].crossVectors(u,v);
   if(n.lengthSq()<1e-4)n.crossVectors(u,_lv[6].copy(fw).negate());n.normalize();boneTurn(L.leg,n,.42*sw);boneTurn(L.up,n,-.16*sw);[H,K,A]=legPos(L)}
  // the stance: the foot stays where it landed
  if(stance&&!L.locked){L.locked=true;L.lock.copy(A)}else if(!stance&&L.locked&&lift>.08)L.locked=false;
  if(L.locked&&L.lock.distanceTo(A)>len*.22)L.locked=false;   // never stretch the leg: let a long stride go
  L.w+=((L.locked?1:0)-L.w)*Math.min(1,dt*(L.locked?14:9));
  if(L.w>.01){L.fq.copy(L.foot.getWorldQuaternion(_lq[3]));const T=_lv[7].copy(A).lerp(L.lock,L.w*LEG.k);
   const d=Math.min(a+b-1e-3,Math.max(Math.abs(a-b)+1e-3,T.distanceTo(H))),dir=_lv[8].copy(T).sub(H).normalize();
   const pole=_lv[3].copy(K).sub(H);pole.addScaledVector(dir,-pole.dot(dir));if(pole.lengthSq()<1e-6)pole.copy(fw);pole.normalize();
   const ca=Math.max(-1,Math.min(1,(a*a+d*d-b*b)/(2*a*d))),sa=Math.sqrt(1-ca*ca),Kn=_lv[10].copy(H).addScaledVector(dir,a*ca).addScaledVector(pole,a*sa);
   boneSwing(L.up,_lv[4].copy(K).sub(H).normalize(),_lv[5].copy(Kn).sub(H).normalize(),1);[H,K,A]=legPos(L);
   boneSwing(L.leg,_lv[4].copy(A).sub(K).normalize(),_lv[5].copy(T).sub(K).normalize(),1);
   // the foot keeps the angle the clip gave it, so it lies flat on the floor
   const pw=L.foot.parent.getWorldQuaternion(_lq[1]);L.foot.quaternion.copy(pw.invert().multiply(L.fq));L.foot.updateMatrixWorld(true)}}}

// ---------------------------------------------------------------- every frame of play in the realm (the cinematics run instead of the normal frame)
W3.tick=function(t,dt){
 emberTick(t);
 if(!W3.on){if(DUEL.on)duelOff();if(W3.portal)rainbowTick(t,dt);if(cam.fov!==55){cam.fov=55;cam.updateProjectionMatrix()}return}
 if(W3.cine)return;
 {const tf=(DUEL.on&&DUEL.camFov?DUEL.camFov:W3.fovT())+W3.fovKick;if(Math.abs(cam.fov-tf)>.02){cam.fov+=(tf-cam.fov)*Math.min(1,dt*2.5);cam.updateProjectionMatrix()}}
 if(W3.portal){if(W3.portal.parent)W3.portal.parent.remove(W3.portal);W3.portal=null}
 if(!AB.fort&&TY.fort)try{abyssAttachFort()}catch(e){}abyssTick(t,dt);fxTick(t,dt);
 // the duel: the new Watermelon Shooter, the roll, weak points, the Bushido meter (before the pillars, so a roll still collides)
 if(!DUEL.on)duelOn();try{duelTick(t,dt)}catch(e){if(!W3._duelErr){W3._duelErr=1;console.error('duel',e)}}
 pillarsTick(t,dt);W3.fovKick=Math.max(0,W3.fovKick-dt*7);
 riftTick(t);if(B.ty)tyFrame(t,dt);rewardTick(t,dt);ambTick(t,dt);
 if(AB.glowBoost){AB.glowBoost=Math.max(0,AB.glowBoost-dt*1.4);AB.glowM.opacity=Math.min(1,AB.glowM.opacity+AB.glowBoost*.2)}
 // the rift and the arrival on clients follow the host's presence
 if(MP.client&&W3.hostHph==='entrance'&&!W3.entSeen&&W3.ph!=='fight'){W3.entSeen=true;entranceVisual()}};
// World 2's loop while the realm is on: the gun keeps firing, power-ups and pickups keep working, the World 2 clock and lava stay off
W3.l2Tick=function(t,dt){const hud=$('l2hud');if(hud&&hud.style.display!=='none')hud.style.display='none';{const cd=$('cdown');if(cd&&cd.style.display!=='none')cd.style.display='none'}if(W3.cine)return;akTick(t,dt);bulletsTick(t,dt);chickenTick(t,dt);powerTick(t,dt)};
// the camera pulls back while the Tyrant is near, so you can see all of him and still see yourself
// framing him: how near he is (0 far .. 1 at his feet) and how much he is in front of the camera (0 behind you .. 1 dead ahead)
function bossFrame(){if(!W3.on||W3.cine||!B.ty||B.st==='dead'||!TY.g)return null;const dx=B.x-heroPos.x,dz=B.z-heroPos.z,d=Math.hypot(dx,dz)||1;
 const near=clampN(1-(d-14)/110,0,1),front=sstep(.15,.8,(-Math.sin(camYaw)*dx-Math.cos(camYaw)*dz)/d);return {d,near,front}}
// the camera pulls back, tilts up and widens while he is near and ahead, so all of him fits above you
W3.camMul=function(){if(!W3.on||W3.cine)return 1;const f=bossFrame();return (f?1.3+1.1*f.near:1.25)*(1-.42*(DUEL.adsK||0))};
W3.lookUp=function(){const f=bossFrame();return f?10*f.near*f.front:0};
W3.fovT=function(){const f=bossFrame();return (f?55+11*f.near*f.front:55)-14*(DUEL.on?Math.max(DUEL.adsK||0,.9):0)};
W3.respawn=function(){heroPos.set((Math.random()-.5)*16,0,AB.R-24);RW.deaths=(RW.deaths|0)+1;toast('The abyss spits you back out.')};
// ---------------------------------------------------------------- multiplayer
// presence: which phase I am in (late joiners follow the host in)
W3.pres=function(){return {s:W3.seq,ph:W3.ph,h:W3.hph||'',d:W3.duelPres?W3.duelPres():null}};
W3.peers=function(host){const w=host&&host.presence&&host.presence.w3;if(!w||!MP.client)return;W3.hostHph=w.h||'';
 if(!W3.on&&L2.on&&!W3.cine){W3.enter(true)}};
// the host's snapshot of the Tyrant
const STN=['fall','land','idle','attack','turn','hurt','dead','mech','trans','break'];
W3.snap=function(){if(!B.ty||!TY.g)return null;const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
 const s={p:[r1(B.px),r1(B.pz),r2(B.a),r1(B.y)],hp:B.hp|0,mh:B.maxHp|0,c:CLIPN.indexOf(TY.curName),ct:r2(tyClipT()),ts:r2(TY.ts||1),st:STN.indexOf(B.st),ph:B.phase,an:B.an|0};
 if(B.atk){const a=B.atk;s.at=[ATKN.indexOf(a.n),r1(a.ox),r1(a.oz),r2(a.a),r1(a.sx||0),r1(a.sz||0),r2(a.k||1),r2(a.ts||1)]}
 if(B.openT>now())s.op=r1(B.openT-now());
 const mx=mxSnap();if(mx.length)s.mx=mx;if(B.trans)s.tr=[B.trans.to,r2(now()-B.trans.t0)];if(B.brk)s.bk=r2(now()-B.brk.t0);if(B.st==='dead')s.dm=B.threat;
 return s};
W3.applySnap=function(s){if(!s||!Array.isArray(s.p)||!W3.on)return;const t=now();
 if(!B.ty){if(!W3.ready||!TY.g)return;tySpawn();B.st='fall';B.mtSeen=new Set()}
 B.px=+s.p[0]||0;B.pz=+s.p[1]||0;B.a=+s.p[2]||0;B.y=+s.p[3]||0;if(s.mh)B.maxHp=s.mh;
 const st=STN[s.st|0]||'idle';
 if(st!=='dead')B.hp=Math.max(1,s.hp|0);
 if(st==='land'&&B.st==='fall')landFx(t);
 if(st==='dead'&&B.st!=='dead'){B.hp=0;W3.bossDied(t)}
 else if(st!=='dead'){if(B.st==='hurt'&&st!=='hurt')B.coreT=t+2;B.st=st}
 if(Array.isArray(s.tr)&&(!B.trans||B.trans.to!==s.tr[0])){B.trans={to:s.tr[0]|0,t0:t-(+s.tr[1]||0)};mxClear();W3.transFx(B.trans.to,+s.tr[1]||0)}else if(!s.tr&&B.trans)B.trans=null;
 if(s.ph&&s.ph!==B.phase)B.phase=s.ph;
 if(s.bk!==undefined&&!B.brk){B.brk={t0:t-(+s.bk||0)};mxClear();W3.breakFx(true)}else if(s.bk===undefined&&B.brk){B.brk=null;W3.breakFx(false)}
 if(s.dm)B.threat=s.dm;
 mxApply(s.mx);
 // the clip he is playing, at the host's time
 if(B.st!=='dead'){const cn=CLIPN[s.c|0];if(cn&&TY.acts[cn]){const ct=+s.ct||0;if(TY.curName!==cn)tyPlay(cn,.15,+s.ts||1,ct);else if(Math.abs(tyClipT()-ct)>.3&&TY.cur){TY.cur.time=ct}}}
 // a new attack: the same telegraph on my floor, and the blow lands on my screen when it lands on his
 if((s.an|0)>(B.an|0)&&Array.isArray(s.at)){B.an=s.an|0;const a=s.at,n=ATKN[a[0]|0];if(n){const A=ATK[n];if(B.atk&&B.atk.tl)world.remove(B.atk.tl);
   B.atk={n,t0:t,ts:+a[7]||1,done:false,ox:+a[1],oz:+a[2],a:+a[3],sx:+a[4],sz:+a[5],k:+a[6]||1};B.atk.tl=n==='leap'?teleMake(A,B.atk.sx,B.atk.sz,0):teleMake(A,B.px,B.pz,B.atk.a)}}
 else if(s.an!==undefined)B.an=Math.max(B.an|0,s.an|0);
 if(s.op)B.openT=t+(+s.op);
};
// clients play the attack effects (telegraph fill, the blow, the shockwave) without dealing damage: the host does that
function clientAttackTick(t){const at=B.atk;if(!at)return;const A=ATK[at.n],ct=tyClipT();
 if(at.tl){at.tl.material.uniforms.uP.value=Math.min(1,ct/A.hit);at.tl.material.uniforms.uT.value=t;if(at.n!=='leap')at.tl.position.set(B.px,.2,B.pz)}
 if(!at.done&&(ct>=A.hit||TY.curName!==A.clip)){at.done=true;if(at.tl){world.remove(at.tl);at.tl=null}if(TY.curName!==A.clip){B.atk=null;return}
  const ox=at.n==='leap'?at.sx:B.px,oz=at.n==='leap'?at.sz:B.pz;shake=Math.max(shake,at.n==='leap'?2.6:at.n==='exec'?1.8:1.1);abyssSfx('boom',at.n==='leap'?.8:.5,0);
  {const ix=at.n==='leap'?ox:B.px+Math.sin(at.a)*(A.shape==='line'?A.len*.55:A.shape==='sector'?A.r*.5:0),iz=at.n==='leap'?oz:B.pz+Math.cos(at.a)*(A.shape==='line'?A.len*.55:A.shape==='sector'?A.r*.5:0);fxImpact(ix,iz,at.n==='leap'?2:at.n==='exec'?1.5:1)}
  selfShape(A,ox,oz,at.n==='leap'?0:at.a,A.dmg*dmgMul());
  if(A.wave||(at.n==='cleave'&&B.phase>=2))B.waves.push(waveMake(at.n==='leap'?ox:B.px+Math.sin(B.a)*20,at.n==='leap'?oz:B.pz+Math.cos(B.a)*20,t))}
 if(at.done&&TY.curName!==A.clip)B.atk=null}
function landFx(t){B.st='land';B.stT=t;landHurt();if(W3.landFx2)W3.landFx2(t);shake=3;AB.flash=.8;abyssSfx('boom',1,0);abyssSfx('thunder',.5,.2);fxImpact(B.px,B.pz,2.6);FXK.dust(B.px,0,B.pz,30,46);B.waves.push(waveMake(B.px,B.pz,t));AB.glowBoost=2.5}
// the rift tearing open, on a client (the host's entranceStart does the same and then spawns him)
function entranceVisual(){if(W3.bigRift)return;filmEntrance();const m=new THREE.Mesh(new THREE.PlaneGeometry(60,380),riftMat());m.position.set(0,300,-10);m.scale.set(.01,1,1);m.layers.set(1);world.add(m);W3.bigRift=m;W3.bigRiftT=now();AB.flash=1;abyssSfx('thunder',.7,0);bossYell('THE SKY SPLITS OPEN','Something enormous is coming through.')}
// testing shortcut: straight to the realm (through World 2's start, which sets up the HUD, the pets and the gear the realm builds on)
W3.skipTo=function(){if(W3.on){toast('You are already in the realm');return}if(MP.on&&MP.client){toast('The host takes everyone to the realm');return}
 const go=()=>{if(W3.on)return;if(!L2.on||L2.phase!=='run'){if(L2.on&&L2.phase==='countdown')L2.cd=Math.min(L2.cd,0);setTimeout(go,250);return}W3.preload();L2.ended=true;L2.phase='end';W3.enter(false)};
 if(!L2.on){try{toggleSettings(false)}catch(e){}L2.phase='choose';startL2('hard')}toast('To the Abyssal Realm…');go()};
{const b=$('skip3btn');if(b){b.onpointerdown=e=>e.stopPropagation();b.onclick=()=>W3.skipTo()}}
// queue events
W3.ev=function(ev){if(ev.k==='w3go'){if(!W3.on&&L2.on)W3.enter(true)}else if(ev.k==='w3end'){if(L2.on&&!L2.ended&&!W3.on&&typeof l2End==='function')l2End(true)}else if(ev.k==='w3again'){if(W3.on)W3.replay(true)}else if(ev.k==='w3fin'){if(W3.on)finisherStart(true,ev.p)}};
// attack counters are logged on the host so clients can follow
const _startAttack=startAttack;
startAttack=function(n,t,tp){B.an=(B.an|0)+1;return _startAttack(n,t,tp)};
// clients run their attack effects every frame
const _tyFrame=tyFrame;
tyFrame=function(t,dt){if(MP.client&&B.ty&&B.st!=='dead')clientAttackTick(t);return _tyFrame(t,dt)};
// the rift on the host also marks the phase for clients
const _entranceStart=entranceStart;
entranceStart=function(){W3.hph='entrance';return _entranceStart()};
W3.version='3';W3._dbg={ATK,startAttack,tyClipT,inShape,RW,FILM,filmStop,abyssSky,tyPlay,AB,TY,B,CV,faceStink,faceZ,MX,MXD,ENV,PHASES,startMech,startTrans,startBreak,mxStart,mxClear,tySpawn,players,DUEL,FIN,FT,CAMK,duelCamPose,P2S,DNET,duelFire,duelDodge,duelBarrage,finisherStart,aimPoint,wpOpen,bodyTick,bodyInit,duelOn,duelOff,shooterModel,muzzlePos,P2GRIP,p2GunFor,p2GunShow,p2GripFrame,gunVis,rockTex,rockSkin,DUELHOLD,DUELGUN,duelRifleOn,armDuelGun,disarmDuelGun,LEG,legInit};   // for tests
})();
