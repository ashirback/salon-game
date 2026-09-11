import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
// Numerical checks of the real raster renderer and game state, without a browser.
function png(path){
 const b=fs.readFileSync(path),w=b.readUInt32BE(16),h=b.readUInt32BE(20);assert.equal(b[24],8);assert.equal(b[25],6);
 let blocks=[];for(let p=8;p<b.length;){const size=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);if(type==='IDAT')blocks.push(b.subarray(p+8,p+8+size));p+=12+size;}
 const packed=zlib.inflateSync(Buffer.concat(blocks)),stride=w*4,raw=new Uint8ClampedArray(w*h*4);let p=0;
 const paeth=(a,b,c)=>{const q=a+b-c,da=Math.abs(q-a),db=Math.abs(q-b),dc=Math.abs(q-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<h;y++){const filter=packed[p++];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?raw[i-4]:0,up=y?raw[i-stride]:0,c=y&&x>=4?raw[i-stride-4]:0;raw[i]=(packed[p++]+[0,a,up,Math.floor((a+up)/2),paeth(a,up,c)][filter])&255;}}
 return {width:w,height:h,data:raw};
}
const atlas=png('dist/assets/characters.png'),hand=png('dist/assets/hand.png');assert.equal(atlas.width,1086);assert.equal(atlas.height,1448);
const node=()=>({style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:543,height:724};},getContext(){return context;}});
let lastImage=null,drawnFreckles=0;
const context={putImageData(d){lastImage=d;},beginPath(){},arc(){drawnFreckles++;},fill(){},globalAlpha:1};
const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);};
const sandbox={console,structuredClone,Uint8ClampedArray,ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},Image:class{},document:{querySelector:get,querySelectorAll(){return [];},createElement:node},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},performance:{now:()=>1000},window:{}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/game.js','utf8'),sandbox);
const evalJS=s=>vm.runInContext(s,sandbox);
const cut=[];for(let n=0;n<4;n++){const data=new Uint8ClampedArray(543*724*4);for(let y=0;y<724;y++){const offset=((Math.floor(n/2)*724+y)*1086+(n%2)*543)*4;data.set(atlas.data.subarray(offset,offset+543*4),y*543*4);}cut.push({data});}sandbox.testTiles=cut;
evalJS('tiles=testTiles; drawCharacter();');const baseline=new Uint8ClampedArray(lastImage.data);
function changed(a,b){let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;}
for(const [key,value] of Object.entries({hair:'#dfd0aa',highlights:'#efcd8c',skin:'#5c382b',eyes:'#507a55',brows:'#a86c88',browShape:'Arched',lips:'#bc344a',lipShape:'Full',shadow:'#997ac7',blush:'#dc7693'})){
 evalJS(`state=structuredClone(initial);state[${JSON.stringify(key)}]=${JSON.stringify(value)};drawCharacter();`);
 const count=changed(baseline,lastImage.data);assert(count>100,`${key} should change visible raster pixels (${count})`);
 for(let i=3;i<baseline.length;i+=4)assert.equal(lastImage.data[i],baseline[i],'Preserve character alpha');
 console.log(`${key}: ${count} pixels changed`);
}
evalJS('state=structuredClone(initial);state.freckles=3;drawCharacter();');assert(drawnFreckles>=57);
for(let i=0;i<4;i++){evalJS(`state.style=${i};drawCharacter();`);assert.equal(lastImage.data.length,543*724*4);}
// Sample original hand pixels at the game's displayed size.
const hp=new Uint8ClampedArray(543*724*4);for(let y=0;y<724;y++)for(let x=30;x<513;x++){const si=(Math.min(1535,Math.floor(y*1536/724))*1024+Math.floor((x-30)*1024/483))*4;hp.set(hand.data.subarray(si,si+4),(y*543+x)*4);}sandbox.testHand={data:hp};
evalJS('handPixels=testHand;state=structuredClone(initial);drawHand();');const plain=new Uint8ClampedArray(lastImage.data);
for(let i=0;i<5;i++){
 assert.equal(evalJS(`nailAt(30+nailAnchors[${i}].x*483/1024,nailAnchors[${i}].y*724/1536)`),i);
 evalJS(`state.nails=[null,null,null,null,null];state.nails[${i}]={color:'#bc334f',finish:'Gloss'};drawHand();`);assert(changed(plain,lastImage.data)>300,`Nail ${i} painted`);
}
for(const finish of ['Gloss','Matte','French','Glitter']){evalJS(`state.nails=Array.from({length:5},()=>({color:'#bc334f',finish:'${finish}'}));drawHand();`);assert(changed(plain,lastImage.data)>1500);}
evalJS('state=structuredClone(initial);');assert.equal(Object.values(evalJS('completed()')).filter(Boolean).length,0);
evalJS("state.brushed=100;state.care={cleanse:100,mask:100,serum:100};state.makeupDone=true;state.nails=Array(5).fill({color:'#bc334f',finish:'Gloss'});");assert.equal(Object.values(evalJS('completed()')).filter(Boolean).length,4);
for(const s of ['hair','skin','makeup','nails','character'])evalJS(`switchStation('${s}')`);
const html=fs.readFileSync('dist/index.html','utf8');for(const name of ['styles.css','game.js','jazz.js']){assert(html.includes(name));assert(fs.existsSync('dist/'+name));}
console.log('PASS: all character traits, 4 hairstyles, 5 nail hit targets, 4 nail finishes, station progress, and local assets.');
