import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { batchStatic } from './optimize.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#303c47');
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.045, 120);
camera.rotation.order = 'YXZ';
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('progress').textContent = 'Não foi possível iniciar o 3D. Ative a aceleração gráfica do navegador e tente novamente.';
  $('retry').hidden = false;
  document.querySelector('.loader').hidden = true;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
$('viewer').appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
scene.environment = pmrem.fromScene(roomEnv, .06).texture;
scene.environmentIntensity = .28;
roomEnv.dispose(); pmrem.dispose();
const ambient = new THREE.HemisphereLight(0xdce9ff, 0x615b51, .85);
scene.add(ambient);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false; orbit.enableDamping = true; orbit.minDistance = 1; orbit.maxDistance = 38;
orbit.maxPolarAngle = Math.PI * .49;
const roofs = new THREE.Group(), additions = new THREE.Group(), lightGroup = new THREE.Group();
scene.add(roofs, additions, lightGroup);
const fixtures = [], annotations = [], keys = new Set(), obstacles = [];
let mode = 'walk', ready = false, yaw = -Math.PI / 2, pitch = 0;
let doorPivot, doorTarget = 0, doorAngle = 0, doorOpen = false, activeView = 'real';

function grainTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  let seed = 47;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = 90 + (seed % 115);
    data[i] = data[i+1] = data[i+2] = v; data[i+3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
const noise = grainTexture();
const mat = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const foam = mat('#252b32', 1), blueFoam = mat('#283a75', 1), rubber = mat('#24282c', .97);
for (const m of [foam, blueFoam, rubber]) { m.bumpMap = noise; m.bumpScale = .014; }
const steel = mat('#727d88', .34, .82), concrete = mat('#b6b8b6', .98), darkMetal = mat('#29343d', .45, .65);
const cream = mat('#e1e4e5', .62), floorMaterial = mat('#777c7c', .86);
floorMaterial.bumpMap = noise; floorMaterial.bumpScale = .008;
const sand = mat('#8b7860', 1); sand.bumpMap = noise; sand.bumpScale = .035;
function box(w, h, d, x, y, z, material, parent = additions) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  o.position.set(x,y,z); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
}
function cylinder(r, len, x, y, z, material, axis = 'y', parent = additions) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), material);
  if (axis === 'x') o.rotation.z = Math.PI/2;
  if (axis === 'z') o.rotation.x = Math.PI/2;
  o.position.set(x,y,z); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
}
function tag(text, x, y, z) {
  const el = document.createElement('span'); el.className = 'annotation'; el.textContent = text; el.hidden = true;
  $('labels-layer').appendChild(el); annotations.push({el, point:new THREE.Vector3(x,y,z)});
}
function textTexture(text, bg, color, width = 1024, height = 128) {
  const c = document.createElement('canvas'); c.width=width; c.height=height;
  const ctx=c.getContext('2d'); ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
  ctx.fillStyle=color; ctx.font=`600 ${Math.round(height*.48)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height/2);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()); return t;
}
function floorText(text, x,z,w,d,bg='#b28c3e',color='#20282c') {
  const m=new THREE.MeshStandardMaterial({map:textTexture(text,bg,color),roughness:.9,polygonOffset:true,polygonOffsetFactor:-1});
  const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);o.rotation.x=-Math.PI/2;o.rotation.z=Math.PI/2;o.position.set(x,.016,z);additions.add(o);return o;
}
function panelText(text,x,y,z,w,h,ry=0) {
  const m=new THREE.MeshStandardMaterial({map:textTexture(text,'#17232d','#ebd9ad'),roughness:.8});
  const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);o.rotation.y=ry;o.position.set(x,y,z);additions.add(o);
}
// Repeated physical relief complements the fine surface grain of the acoustic panels.
const pyramidGeo = new THREE.ConeGeometry(.142, .065, 4, 1);
pyramidGeo.rotateY(Math.PI/4);
function acoustic(points, normal, parent = additions) {
  if(!points.length) return;
  const mesh=new THREE.InstancedMesh(pyramidGeo,foam,points.length);
  const o=new THREE.Object3D(); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
  points.forEach((p,i)=>{o.position.set(...p);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
  mesh.receiveShadow=true;parent.add(mesh);
}
function wallFoam(z, normal, from=2.85,to=14.8, skipLogo=false) {
  const points=[];
  for(let x=from;x<to;x+=.205) for(let y=.34;y<3.29;y+=.205) {
    if(skipLogo && x>4.2 && x<8.4 && y<3.3) continue;
    points.push([x,y,z]);
  }
  acoustic(points,new THREE.Vector3(0,0,normal));
}
function luminaire(x,z, length=1.4, room='real', shadow=false) {
  box(length,.085,.21,x,3.21,z,darkMetal,roofs);
  const m = new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xe0edff,emissiveIntensity:4,roughness:.3});
  box(length-.06,.012,.16,x,3.16,z,m,roofs); fixtures.push(m);
  for(const a of [-.48,.48]) cylinder(.008,.22,x+a,3.36,z,steel,'y',roofs);
}
function grille(x,y,z, w,d, parent=additions) {
  box(w,.055,d,x,y,z,darkMetal,parent);
  for(let a=-w/2+.025;a<w/2;a+=.055) box(.012,.009,d-.03,x+a,y-.032,z,steel,parent);
}
function addArchitecture() {
  box(15.3,.18,4.8,7.5,3.59,-2.25,concrete,roofs);
  box(11.95,.18,4.0,5.825,3.59,2.15,concrete,roofs);
  box(15,.04,4.5,7.5,3.48,-2.25,foam,roofs);
  box(11.65,.045,3.82,5.825,3.48,2.08,mat('#3a444e',1),roofs);
  const ceiling=[];
  for(let x=.2;x<14.9;x+=.23)for(let z=-4.3;z<-.1;z+=.23)ceiling.push([x,3.44,z]);
  acoustic(ceiling,new THREE.Vector3(0,-1,0),roofs);
  wallFoam(-4.42,1,2.85,14.8,true);
  wallFoam(-.085,-1,4.1,14.8,false);
  const back=[];
  for(let z=-4.25;z<-.1;z+=.205)for(let y=.25;y<3.3;y+=.205)back.push([14.91,y,z]);
  acoustic(back,new THREE.Vector3(-1,0,0));
  // Conceptual surface layers, deliberately without construction specifications.
  for(const z of [-4.455,-.04]) {
    const n=z<-2?1:-1;
    const length=z<-2?6.4:10.8,center=z<-2?11.65:9.45;
    box(length,1.0,.02,center,.51,z,steel);
    box(length,.97,.03,center,.51,z+n*.023,rubber);
  }
  // Preserve the repositioned emblem, graffiti and simulator images in model 02A.
  for(const x of [4.322,8.05]) for(const z of [.25,3.9]) {
    box(.23,1.25,.23,x,.63,z,steel);
    box(.26,1.2,.26,x,.63,z,rubber);
  }
  for(const z of [-3.9,-2.8,-1.7,-.6]) {
    floorText(String(Math.round((z+3.9)/1.1)+1).padStart(2,'0'),4.12,z,.56,.42,'#2c353d','#eee2c4');
  }
  floorText('LINHA DE DISPARO',2.94,-2.25,3.9,.075,'#c9a354','#151d23');
  floorText('ÁREA DE DISPAROS',7.3,-2.25,2.5,.23,'#6b7070','#d4d8d7');
  panelText('ESTANDE DIGITAL',8.08,2.82,2.2,2.35,.27,-Math.PI/2);
  panelText('TIRO REAL  ·  4 BAIAS',.025,2.59,-2.2,2.6,.25,Math.PI/2);
  for(const x of [1.1,4.2,7.4,10.6,13.3]) for(const z of [-3.35,-1.15])luminaire(x,z,1.3,'real',x===4.2&&z===-1.15);
  for(const x of [1.6,4.7,7.1,10])luminaire(x,2.1,1.5,'digital',x===7.1);
  for (const [x,z] of [[4.4,-2.25],[10.2,-2.25],[5.5,2.1]]) {
    const light=new THREE.SpotLight(0xe8efff,58,11,1.12,.55,2);
    light.position.set(x,3.25,z);light.target.position.set(x,0,z);
    light.castShadow=true;light.shadow.mapSize.set(1024,1024);
    light.shadow.normalBias=.025;light.shadow.bias=-.0005;
    light.userData.powerOn=light.intensity;lightGroup.add(light,light.target);
  }
  // Visible air distribution and collection equipment are illustrative.
  for(const z of [-4.05,-.45]) {
    cylinder(.12,10.7,7.75,3.02,z,steel,'x');
    for(const x of [3,5.3,7.6,9.9,12.2]) {
      cylinder(.132,.035,x,3.02,z,darkMetal,'x');
      grille(x,2.88,z,.42,.24);
      box(.025,.3,.025,x,3.27,z,steel);
    }
  }
  box(.48,.36,4.05,13.12,3.03,-2.25,steel);
  grille(1.1,3.05,-2.25,.37,3.8);
  box(1.1,.4,.6,.7,3.2,-2.25,cream);
  for(const x of [.35,.55,.75,.95])box(.018,.19,.61,x,3.17,-2.25,darkMetal);
  for(const x of [3,7,10.5]) {
    box(.8,.08,.6,x,3.35,2.2,cream,roofs);grille(x,3.3,2.2,.65,.45,roofs);
  }
  tag('Laje e tratamento acústico',6.7,3.23,-2.25);
  tag('Espuma azul · acabamento conceitual',3.42,1.77,-2.25);
  tag('Linha de disparo · 4 baias',2.94,.22,-2.25);
  tag('Exaustão distribuída',8.8,2.98,-.48);
  tag('Climatização e insuflação',1.1,3.07,-2.25);
  tag('Anteparo secundário · pneus',14.1,1.9,-2.25);
  tag('Aço + borracha · representação',8.6,1.05,-4.37);
  tag('Porta de ligação entre salas',.6,2.22,.08);
  tag('Ambiente digital',9.8,2.7,2.15);
}

function setMode(next) {
  mode=next;keys.clear();orbit.enabled=next==='orbit';
  $('walk').classList.toggle('active',next==='walk');$('orbit').classList.toggle('active',next==='orbit');
  $('touch-move').style.visibility=next==='walk'?'visible':'hidden';
  $('help').textContent=next==='walk'?'Arraste para olhar · WASD ou setas para andar · E abre a porta':'Arraste para girar · Roda do mouse para aproximar';
}
function setView(view) {
  if(!ready)return;
  activeView=view;renderer.shadowMap.needsUpdate=true;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='overview') {
    setMode('orbit');roofs.visible=false;$('roof').checked=false;
    camera.position.set(-5.5,14,16);orbit.target.set(6.6,.7,-.4);orbit.update();
  } else {
    setMode('walk');roofs.visible=true;$('roof').checked=true;
    if(view==='real'){camera.position.set(.8,1.65,-2.8);yaw=-Math.PI/2;pitch=-.035;}
    else {camera.position.set(7.45,1.65,2.55);yaw=-Math.PI/2;pitch=0;}
    camera.rotation.set(pitch,yaw,0,'YXZ');
  }
}
function toggleDoor() {
  if(!ready)return;
  // Keep the closing leaf from passing through a visitor standing in the doorway.
  if(doorOpen && mode==='walk' && camera.position.x<1.18 && camera.position.z>-.95 && camera.position.z<.4) {
    $('door-state').textContent='Afaste-se da passagem para fechar a porta.';return;
  }
  doorOpen=!doorOpen;doorTarget=doorOpen?Math.PI*.5:0;
  $('door').innerHTML=`${doorOpen?'Fechar':'Abrir'} porta entre salas <span>${doorOpen?'↙':'↗'}</span>`;
  $('door-state').textContent=doorOpen?'Porta aberta · passagem junto à entrada':'Porta fechada · ligação junto à entrada';
}

new GLTFLoader().load('./assets/estande-v2a.glb',async (gltf)=>{
 try {
  const model=gltf.scene;scene.add(model);model.updateMatrixWorld(true);
  const materialCache=new Map();
  model.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=true;o.receiveShadow=true;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    const updated=materials.map(original=>{
      if(original.name==='I05_Twilight_Wave')return blueFoam;
      if(original.name==='Asphalt_06_1K')return floorMaterial;
      if(materialCache.has(original.uuid))return materialCache.get(original.uuid);
      const m=original.clone();materialCache.set(original.uuid,m);
      if(m.isMeshStandardMaterial){m.roughness=Math.max(.45,m.roughness??.8);m.metalness=Math.min(.6,m.metalness??0);m.envMapIntensity=.45;}
      if(m.map){m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
      if(/BORRACHA|Color M08|M09_Shadow_Night/.test(m.name)){m.roughness=.98;m.bumpMap=noise;m.bumpScale=.012;}
      return m;
    });o.material=Array.isArray(o.material)?updated:updated[0];
    if(updated.some(m=>m.bumpMap) && !o.geometry.attributes.uv) {
      const g=o.geometry.clone();g.computeBoundingBox();
      const size=g.boundingBox.getSize(new THREE.Vector3()).toArray();
      const axes=[0,1,2].sort((a,b)=>size[b]-size[a]);
      const pos=g.attributes.position,uv=new Float32Array(pos.count*2),lo=g.boundingBox.min.toArray();
      for(let i=0;i<pos.count;i++) {
        const v=[pos.getX(i),pos.getY(i),pos.getZ(i)];
        uv[i*2]=(v[axes[0]]-lo[axes[0]])/Math.max(size[axes[0]],.001);
        uv[i*2+1]=(v[axes[1]]-lo[axes[1]])/Math.max(size[axes[1]],.001);
      }
      g.setAttribute('uv',new THREE.BufferAttribute(uv,2));o.geometry=g;
    }
  });
  for(const index of [611,736]) {
    const wall=await gltf.parser.getDependency('node',index);
    wall.traverse(o=>{if(o.isMesh)o.material=mat('#c5c8c8',.94,0);});
  }
  // The frame remains fixed; only the leaf, panels and handles rotate about the hinge.
  doorPivot=new THREE.Group();doorPivot.position.set(.18375,0,.088);scene.add(doorPivot);
  for(const index of [4,12,14,20]) {
    const n=await gltf.parser.getDependency('node',index);doorPivot.attach(n);
  }
  for(const index of [1011,1013,1015,1017,104,210,266,305,359,415,743,631,639,647,655]) {
    const n=await gltf.parser.getDependency('node',index);
    const b=new THREE.Box3().setFromObject(n);obstacles.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});
  }
  // Very thin, translucent contact shading grounds the preserved furniture.
  const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d');const grad=cx.createRadialGradient(64,64,6,64,64,64);grad.addColorStop(0,'rgba(0,0,0,.35)');grad.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=grad;cx.fillRect(0,0,128,128);
  const sm=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false});
  for(const ob of obstacles){const o=new THREE.Mesh(new THREE.PlaneGeometry(ob.maxX-ob.minX+.45,ob.maxZ-ob.minZ+.45),sm);o.rotation.x=-Math.PI/2;o.position.set((ob.minX+ob.maxX)/2,.012,(ob.minZ+ob.maxZ)/2);additions.add(o);}
  addArchitecture();
  const batches=[batchStatic(model),batchStatic(additions),batchStatic(roofs)];
  console.info('Static draw batches',batches);
  renderer.shadowMap.needsUpdate=true;
  ready=true;setView('real');$('loading').hidden=true;
 }catch(e){console.error(e);$('progress').textContent='O modelo carregou, mas houve um problema ao preparar a visita. Tente novamente.';$('retry').hidden=false;document.querySelector('.loader').hidden=true;}
},(e)=>{
  $('progress').textContent=e.total?`Carregando modelo e materiais · ${Math.min(100,Math.round(e.loaded/e.total*100))}%`:`Carregando modelo · ${(e.loaded/1048576).toFixed(1)} MB`;
},(e)=>{console.error(e);$('progress').textContent='Não foi possível carregar o modelo. Verifique sua conexão e tente novamente.';$('retry').hidden=false;document.querySelector('.loader').hidden=true;});

function free(x,z) {
  const r=.14;
  if(x<r||z<-4.5+r||z>4-r)return false;
  if(z<0&&x>13.22-r)return false;
  if(z>=0&&x>11.6-r)return false;
  if(z>-r&&z<.15+r) {
    if(x<.22+r||x>1.0-r||doorAngle<1.25)return false;
  }
  if(doorAngle>1.25&&x<.22+r&&z>-.75-r&&z<.12+r)return false;
  for(const o of obstacles)if(x>o.minX-r&&x<o.maxX+r&&z>o.minZ-r&&z<o.maxZ+r)return false;
  return true;
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('door').onclick=toggleDoor;
$('roof').onchange=e=>{roofs.visible=e.target.checked;renderer.shadowMap.needsUpdate=true;};
$('lights').onchange=e=>{
  lightGroup.children.forEach(l=>{if(l.isLight)l.intensity=e.target.checked?l.userData.powerOn:0;});
  renderer.shadowMap.needsUpdate=true;
  fixtures.forEach(m=>m.emissiveIntensity=e.target.checked?4:0);
  ambient.intensity=e.target.checked?.85:.23;scene.environmentIntensity=e.target.checked?.28:.1;
};
$('walk').onclick=()=>{
  if(mode==='orbit')setView(activeView==='digital'?'digital':'real');else setMode('walk');
};
$('orbit').onclick=()=>{
  if(!ready)return;setMode('orbit');
  orbit.target.copy(camera.position).add(new THREE.Vector3(-Math.sin(yaw)*4,0,-Math.cos(yaw)*4));
  orbit.update();
};
$('collapse').onclick=()=>{const content=$('panel-content');content.hidden=!content.hidden;$('collapse').textContent=content.hidden?'+':'−';$('collapse').setAttribute('aria-expanded',String(!content.hidden));};
$('info').onclick=()=>{keys.clear();$('about').showModal();};$('close-info').onclick=()=>$('about').close();
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('help').textContent='Use o comando de tela cheia do navegador.';}};
addEventListener('keydown',e=>{
  if($('about').open||/INPUT|TEXTAREA/.test(e.target.tagName))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  keys.add(e.key.toLowerCase());
  if(e.key.toLowerCase()==='e'&&!e.repeat)toggleDoor();
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear();});
let drag=null;
renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='walk')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId||mode!=='walk')return;
  yaw-=(e.clientX-drag.x)*.0035;pitch-=(e.clientY-drag.y)*.0035;pitch=THREE.MathUtils.clamp(pitch,-1.25,1.25);
  drag.x=e.clientX;drag.y=e.clientY;
});
const releaseDrag=()=>{drag=null;};renderer.domElement.addEventListener('pointerup',releaseDrag);renderer.domElement.addEventListener('pointercancel',releaseDrag);
document.querySelectorAll('[data-key]').forEach(b=>{
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key.toLowerCase());};
  b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key.toLowerCase());
});
const map=$('map-canvas'),mc=map.getContext('2d');
function drawMap() {
  mc.clearRect(0,0,330,190);
  const p=(x,z)=>[25+x*18,99+z*18];
  mc.lineWidth=2;mc.strokeStyle='#81909d';mc.fillStyle='#263440';
  for(const [x,z,w,h] of [[0,-4.5,15,4.5],[0,.15,11.65,3.85]]){const [a,b]=p(x,z);mc.fillRect(a,b,w*18,h*18);mc.strokeRect(a,b,w*18,h*18);}
  mc.strokeStyle='#b99550';mc.lineWidth=1;
  for(const z of [-4.45,-3.35,-2.25,-1.15,-.05]){mc.beginPath();mc.moveTo(...p(3.92,z));mc.lineTo(...p(12,z));mc.stroke();}
  mc.fillStyle='#5362a0';for(const z of [-3.35,-2.25,-1.15]){const [a,b]=p(2.91,z);mc.fillRect(a,b,18,3);}
  mc.fillStyle='#c7ced4';mc.font='12px Arial';mc.textAlign='center';mc.fillText('TIRO REAL',160,62);mc.fillText('DIGITAL',184,144);
  mc.strokeStyle=doorOpen?'#d7b36c':'#8997a3';mc.lineWidth=4;mc.beginPath();mc.moveTo(...p(.18,.08));mc.lineTo(...p(doorOpen?.18:1.02,doorOpen?-.75:.08));mc.stroke();
  if(mode==='walk'){const [x,y]=p(camera.position.x,camera.position.z);mc.save();mc.translate(x,y);mc.rotate(-yaw);mc.fillStyle='#ebc477';mc.beginPath();mc.moveTo(0,-9);mc.lineTo(-5,5);mc.lineTo(5,5);mc.closePath();mc.fill();mc.restore();}
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let last=performance.now(),lastOverlay=0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.04);last=now;
  if(ready){
    if(doorPivot){const previous=doorAngle;doorAngle=THREE.MathUtils.damp(doorAngle,doorTarget,5,dt);doorPivot.rotation.y=doorAngle;if(Math.abs(previous-doorAngle)>.0005)renderer.shadowMap.needsUpdate=true;}
    if(mode==='walk') {
      let f=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
      let side=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      const len=Math.hypot(f,side);if(len){f/=len;side/=len;}
      const step=dt*(keys.has('shift')?2.4:1.5),dx=(-Math.sin(yaw)*f+Math.cos(yaw)*side)*step,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*side)*step;
      if(free(camera.position.x+dx,camera.position.z))camera.position.x+=dx;
      if(free(camera.position.x,camera.position.z+dz))camera.position.z+=dz;
      camera.rotation.set(pitch,yaw,0,'YXZ');
      $('location').textContent=camera.position.z<.08?'01 / Estande de tiro real':'02 / Estande digital e apoio';
    } else {orbit.update();$('location').textContent='03 / Vista livre do conjunto';}
    if(now-lastOverlay>100){lastOverlay=now;
    for(const a of annotations){
      if(!$('labels').checked){a.el.hidden=true;continue;}
      const projected=a.point.clone().project(camera);
      const sameRoom=mode==='orbit'||(camera.position.z<.08)===(a.point.z<.08)||Math.abs(a.point.z-.08)<.01;
      a.el.hidden=!sameRoom||projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
      a.el.style.left=`${(projected.x*.5+.5)*innerWidth}px`;a.el.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;
    }
    drawMap();
    }
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
