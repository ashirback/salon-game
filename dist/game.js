'use strict';
const $=s=>document.querySelector(s);
const canvas=$('#portrait'),ctx=canvas.getContext('2d',{willReadFrequently:true});
canvas.width=543;canvas.height=724;
const initial={style:0,hair:'#4a3024',highlights:'none',skin:'#e9a982',eyes:'#4c829e',freckles:0,browShape:'Natural',brows:'#52392d',lips:'#c57472',lipShape:'Natural',shadow:'none',blush:'none',nailColor:'#d77f9f',nailFinish:'Gloss',nails:[null,null,null,null,null],care:{cleanse:0,mask:0,serum:0},brushed:0,makeupDone:false};
let state=structuredClone(initial),station='hair',tab='Style',tool=null,history=[],busy=false,ready=false,activePointer=null,lastPoint=null,lastStrokeAt=0;
let tiles=[],handPixels=null,renderPending=false,toastTimer,maskMarks=[];
const palettes={
  hair:[['Espresso','#211d1f'],['Chocolate','#4a3024'],['Chestnut','#82503a'],['Copper','#b86236'],['Honey','#bd945c'],['Platinum','#dfd0aa'],['Rose','#bf7693'],['Lilac','#9c86b5']],
  highlights:[['None','none'],['Caramel','#cb935e'],['Champagne','#efcd8c'],['Rose gold','#e7a1b2'],['Lilac','#b5a1dc'],['Teal','#79bbbd']],
  skin:[['Porcelain','#f4cfb7'],['Peach','#edb897'],['Warm beige','#e9a982'],['Golden','#c78c5d'],['Caramel','#a66d49'],['Bronze','#875337'],['Deep brown','#5c382b'],['Rich ebony','#402c25']],
  eyes:[['Ocean','#4c829e'],['Hazel','#89834d'],['Emerald','#507a55'],['Honey','#ab743b'],['Brown','#654331'],['Violet','#9675ad'],['Grey','#87999d']],
  brows:[['Soft black','#2d2428'],['Brown','#52392d'],['Auburn','#895539'],['Blonde','#b18a59'],['Rose','#a86c88']],
  lips:[['Rose','#c57472'],['Pink','#e276a0'],['Red','#bc344a'],['Coral','#e57660'],['Berry','#99446c'],['Nude','#b78876'],['Plum','#724063'],['Cocoa','#865744']],
  shadow:[['None','none'],['Champagne','#cdaa72'],['Rose','#cd7ca0'],['Lavender','#997ac7'],['Mint','#60a691'],['Bronze','#93633b']],
  blush:[['None','none'],['Peach','#e88773'],['Rose','#dc7693'],['Berry','#b9698b']],
  nailColor:[['Ballet pink','#d77f9f'],['Cherry','#bc334f'],['Lilac','#a48bd4'],['Mint','#72baaa'],['Sky','#75acd0'],['Cream','#e9d6b4'],['Berry','#783c69'],['Black','#302b39'],['Coral','#ee8b75'],['Pearl','#faf0ea']]
};
const styleNames=['Soft waves','Chic bob','Silky straight','Bouncy curls'];
// Feature anchors in each original tile. These follow the generated raster art.
const features=[
  {cx:296,ey:243,eyes:[240,351],by:202,lip:341,ears:[187,405]},
  {cx:263,ey:243,eyes:[208,319],by:201,lip:341,ears:[166,363]},
  {cx:296,ey:241,eyes:[240,351],by:201,lip:336,ears:[186,405]},
  {cx:266,ey:241,eyes:[211,322],by:201,lip:335,ears:[164,369]}
];
const nailAnchors=[{x:162,y:359,rx:30,ry:49,a:-.15},{x:335,y:190,rx:36,ry:57,a:-.03},{x:506,y:106,rx:38,ry:59,a:-.03},{x:683,y:195,rx:34,ry:52,a:.12},{x:932,y:658,rx:39,ry:63,a:.57}];
const careNames={cleanse:'Cleanse',mask:'Hydrating mask',serum:'Glow serum'};
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function remember(){history.push(structuredClone(state));if(history.length>35)history.shift();$('#undo').disabled=false;}
function setValue(key,value){if(state[key]===value)return;remember();state[key]=value;if(['lips','shadow','blush'].includes(key))state.makeupDone=true;render();renderPanel();updateProgress();}
function rgb(hex){return hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16));}
function clamp(n,min=0,max=255){return Math.max(min,Math.min(max,n));}
function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
function ellipse(x,y,cx,cy,rx,ry){return ((x-cx)/rx)**2+((y-cy)/ry)**2;}
function swatches(key){return `<div class="swatches" role="group" aria-label="${key.replace(/([A-Z])/g,' $1')}">${palettes[key].map(([name,color])=>`<button class="swatch ${color==='none'?'none ':''}${state[key]===color?'active':''}" data-key="${key}" data-value="${color}" style="--swatch:${color};--check:${['#f4cfb7','#dfd0aa','#faf0ea','#e9d6b4','#efcd8c'].includes(color)?'#745e61':'#fff'}" title="${name}" aria-label="${name}" aria-pressed="${state[key]===color}"></button>`).join('')}</div>`;}
function choices(key,values){return `<div class="choice-row" role="group" aria-label="${key}">${values.map(v=>`<button data-key="${key}" data-value="${v}" class="${state[key]===v?'active':''}" aria-pressed="${state[key]===v}">${v}</button>`).join('')}</div>`;}
function label(text,sub=''){return `<div class="field-label">${text}<small>${sub}</small></div>`;}
function colorName(key){return palettes[key].find(x=>x[1]===state[key])?.[0]||'';}
function renderPanel(){
  const names={hair:['01 / A FRESH START','Good hair, good mood.','A new style is just the beginning.'],skin:['02 / SLOW DOWN','A moment to glow.','Cleanse, hydrate, and add a little radiance.'],makeup:['03 / COLOR OUTSIDE THE LINES','Your kind of pretty.','A soft blush or a bold lip. You decide.'],nails:['04 / THE FINISHING TOUCH','Polished to perfection.','A tiny canvas for a little creativity.'],character:['YOUR BEAUTIFUL CANVAS','Uniquely you.','Every detail is part of your story.']};
  const options={hair:['Style','Color','Highlights'],skin:[],makeup:['Lips','Eyes','Cheeks'],nails:[],character:['Complexion','Eyes','Brows']}[station];
  const n=names[station];let html=`<div class="panel-head"><span class="panel-kicker">✧ ${n[0]}</span><h2>${n[1]}</h2><p>${n[2]}</p></div>`;
  if(options.length)html+=`<div class="panel-tabs" role="group" aria-label="${station} options">${options.map(t=>`<button data-tab="${t}" class="${tab===t?'active':''}" aria-pressed="${tab===t}">${t}</button>`).join('')}</div>`;
  html+='<div class="panel-body">';
  if(station==='hair'){
    if(tab==='Style'){html+=label('Choose your style','4 looks to love')+`<div class="style-grid">${styleNames.map((s,i)=>`<button class="style-card ${state.style===i?'active':''}" data-key="style" data-value="${i}" aria-pressed="${state.style===i}"><span class="hair-thumb"><img src="assets/characters.png" alt="" width="1086" height="1448" style="left:-${i%2*100}%;transform:translateY(-${Math.floor(i/2)*50}%)"></span><span>${s}</span></button>`).join('')}</div>`+label('Hair color',colorName('hair'))+swatches('hair');}
    if(tab==='Color')html+=label('Find your shade',colorName('hair'))+swatches('hair')+label('Eyebrow color',colorName('brows'))+swatches('brows');
    if(tab==='Highlights')html+=label('A little dimension',colorName('highlights'))+swatches('highlights')+`<div class="nail-note">Highlights follow your hair’s natural strands. Try caramel for a sun-kissed finish.</div>`;
    html+=`<button class="action-button" data-tool="brush">${tool==='brush'?'✓ Brush selected — drag through hair':'✧ Pick up the finishing brush'}</button>`+progressMarkup(state.brushed,'Finishing brush')+`<p class="keyboard-hint">Brush your hair in the mirror, or use the button below.</p><button class="text-button" data-action="brush">Brush through hair</button><div class="panel-note"><span>♡</span>There’s no wrong choice. Try a little of everything.</div>`;
  }
  if(station==='character'){
    if(tab==='Complexion')html+=label('Skin tone',colorName('skin'))+swatches('skin')+label('Freckles')+`<div class="range-row"><span>None</span><input id="freckles" type="range" min="0" max="3" step="1" value="${state.freckles}" aria-label="Freckle amount"><span>Lots</span></div>`+`<div class="nail-note">Your character stays with you at every station.</div>`;
    if(tab==='Eyes')html+=label('Eye color',colorName('eyes'))+swatches('eyes');
    if(tab==='Brows')html+=label('Eyebrow shape')+choices('browShape',['Natural','Arched','Straight'])+label('Eyebrow color',colorName('brows'))+swatches('brows');
    html+=`<div class="panel-note"><span>✧</span>Hair, lip colors, and lip shapes are waiting at the Hair and Makeup stations.</div>`;
  }
  if(station==='skin'){
    html+=label('Your three-step ritual');
    [['cleanse','♧','A fresh, foamy start'],['mask','◒','A cooling drink for your skin'],['serum','✧','Finish with a dewy glow']].forEach(([id,icon,desc])=>{html+=`<button class="treatment-card ${tool===id?'active':''}" data-tool="${id}"><span class="treatment-icon">${icon}</span><span><strong>${careNames[id]}</strong><small>${desc}</small></span><span class="treatment-check">${state.care[id]>=100?'✓':''}</span></button>`;});
    const p=tool&&state.care[tool]!==undefined?state.care[tool]:0;html+=progressMarkup(p,careNames[tool]||'Choose a treatment');
    html+=`<p class="keyboard-hint">Select a treatment, then gently move over the face. Or sit back and use auto-apply.</p><button class="action-button" data-action="care" ${!tool||!(tool in state.care)?'disabled':''}>${p>=100?'Apply again':'Auto-apply treatment'} <span>✧</span></button>`;
  }
  if(station==='makeup'){
    if(tab==='Lips')html+=label('Lip color',colorName('lips'))+swatches('lips')+label('Lip shape')+choices('lipShape',['Natural','Full','Petite']);
    if(tab==='Eyes')html+=label('Eyeshadow',colorName('shadow'))+swatches('shadow')+label('Eye color',colorName('eyes'))+swatches('eyes');
    if(tab==='Cheeks')html+=label('A wash of blush',colorName('blush'))+swatches('blush')+label('Freckles')+`<div class="range-row"><span>None</span><input id="freckles" type="range" min="0" max="3" value="${state.freckles}" aria-label="Freckle amount"><span>Lots</span></div>`;
    html+=`<div class="panel-note"><span>✧</span>Tap a shade to try it on instantly. The little undo button is always here for you.</div>`;
  }
  if(station==='nails'){
    html+=label('Pick your polish',colorName('nailColor'))+swatches('nailColor')+label('The finish')+choices('nailFinish',['Gloss','Matte','French','Glitter'])+`<div class="nail-note">Tap each nail in the mirror to paint it. Mix shades for a manicure that’s all yours.</div><button class="action-button" data-action="paint">Paint all five nails ✧</button><button class="text-button" data-action="remove-polish" style="margin-top:12px">Remove polish</button>`+progressMarkup(state.nails.filter(Boolean).length*20,'Nails painted');
  }
  html+='</div>';$('#panel').innerHTML=html;updateHint();
}
function progressMarkup(value,text){return `<div class="treatment-progress"><i style="width:${value}%"></i></div><div class="treatment-status"><span>${text}</span><span>${Math.round(value)}%</span></div>`;}
function updateHint(){let hint='Pick a style. Make it your own.';if(station==='hair'&&tool==='brush')hint='Gently brush through your hair.';if(station==='skin')hint=tool?`${careNames[tool]} · move gently over the face.`:'Choose a little care for your skin.';if(station==='makeup')hint='A touch of color. A whole new feeling.';if(station==='character')hint='Beautiful begins with being you.';if(station==='nails')hint='Pick a polish, then tap a nail.';$('#tool-hint').innerHTML=`<span>✧</span> ${hint}`;}
function completed(){return {hair:state.brushed>=100,skin:Object.values(state.care).every(x=>x>=100),makeup:state.makeupDone,nails:state.nails.every(Boolean)};}
function updateProgress(){const done=completed(),count=Object.values(done).filter(Boolean).length;Object.entries(done).forEach(([k,v])=>{const el=$(`[data-done="${k}"]`);el.textContent=v?'✓':'';el.classList.toggle('complete',v);});document.querySelectorAll('#progress-dots i').forEach((el,i)=>el.classList.toggle('done',i<count));$('#progress-dots').setAttribute('aria-label',`${count} of 4 stations completed`);$('#progress-copy').textContent=count===4?'All four stations visited. You look lovely!':count?`${count} of 4 finishing touches complete. Take your time.`:'Explore all four stations at your own pace.';}
function switchStation(next){if(busy)return toast('Let’s finish this little treatment first.');station=next;tab={hair:'Style',skin:'',makeup:'Lips',nails:'',character:'Complexion'}[next];tool=next==='skin'?'cleanse':null;maskMarks=[];document.querySelectorAll('[data-station]').forEach(b=>{const active=b.dataset.station===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});$('#character').classList.toggle('selected',next==='character');canvas.setAttribute('aria-label',next==='nails'?'Manicure. Tap individual nails to paint them, or choose Paint all five nails.':'Your character. Drag your selected treatment over the face or hair, or use the treatment button.');renderPanel();render();}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Could not load '+src));im.src=src;});}
async function loadArt(){try{const [atlas,hand]=await Promise.all([loadImage('assets/characters.png'),loadImage('assets/hand.png')]);for(let i=0;i<4;i++){const c=document.createElement('canvas');c.width=543;c.height=724;const cctx=c.getContext('2d',{willReadFrequently:true});cctx.drawImage(atlas,(i%2)*atlas.width/2,Math.floor(i/2)*atlas.height/2,atlas.width/2,atlas.height/2,0,0,543,724);tiles.push(cctx.getImageData(0,0,543,724));}const c=document.createElement('canvas');c.width=543;c.height=724;const cctx=c.getContext('2d',{willReadFrequently:true});cctx.drawImage(hand,30,0,483,724);handPixels=cctx.getImageData(0,0,543,724);ready=true;$('#loading-art').hidden=true;$('#loading-art').style.display='none';render();}catch(e){$('#loading-art').innerHTML='<span>♡</span>The artwork couldn’t load.<br><button class="text-button" id="retry-art">Try again</button>';$('#retry-art').onclick=()=>{tiles=[];loadArt();};toast('Please try loading the artwork again.');}}
function render(){if(!ready||renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;if(station==='nails')drawHand();else drawCharacter();});}
function drawCharacter(){
  const source=tiles[state.style],data=new Uint8ClampedArray(source.data),f=features[state.style];const hair=rgb(state.hair),skin=rgb(state.skin),eyes=rgb(state.eyes),brows=rgb(state.brows),lips=rgb(state.lips),hl=state.highlights==='none'?null:rgb(state.highlights),blush=state.blush==='none'?null:rgb(state.blush),shadow=state.shadow==='none'?null:rgb(state.shadow);
  const skinBase=[233,169,130];
  for(let y=0;y<724;y++)for(let x=0;x<543;x++){
    const i=(y*543+x)*4;if(data[i+3]<5)continue;
    let sx=x,sy=y;
    // Smoothly warp the source pixels, preserving the doll's rendered contours.
    if(y>f.lip-34&&y<f.lip+36&&Math.abs(x-f.cx)<62&&state.lipShape!=='Natural'){
      const d=ellipse(x,y,f.cx,f.lip,62,36),w=clamp(1-d,0,1);const scale=state.lipShape==='Full'?1.28:.78;
      sy=f.lip+(y-f.lip)/(1+(scale-1)*w);sx=f.cx+(x-f.cx)/(1+(scale-1)*w*.45);
    }
    for(const ex of f.eyes){if(Math.abs(x-ex)<47&&Math.abs(y-f.by)<26&&state.browShape!=='Natural'){const u=(x-ex)/47,w=clamp(1-Math.abs(y-f.by)/26,0,1);sy+=(state.browShape==='Arched'?7:-6)*Math.cos(u*Math.PI/2)*w;}}
    const si=(clamp(Math.round(sy),0,723)*543+clamp(Math.round(sx),0,542))*4;let r=source.data[si],g=source.data[si+1],b=source.data[si+2];
    const lum=r*.299+g*.587+b*.114;
    const brow=f.eyes.some(ex=>Math.abs(sx-ex)<44&&Math.abs(sy-f.by)<17)&&r<150&&g<110;
    const lipRegion=ellipse(sx,sy,f.cx,f.lip,40,18)<1&&r>g*1.37&&r>b*1.25;
    const eyeRegion=f.eyes.some(ex=>ellipse(sx,sy,ex,f.ey,14,15)<1)&&b>r*.93&&g>r*.92;
    const warm=r>g*1.12&&g>b*1.1;
    const faceDistance=ellipse(sx,sy,f.cx,257,118,158);
    const face=faceDistance<1;
    // Each generated hairstyle places the ears a little differently. These
    // fixed protected areas follow the actual artwork instead of asking color
    // values to decide where the hair stops and skin begins.
    const ear=Math.min(...f.ears.map(ex=>ellipse(sx,sy,ex,273,31,52)))<1;
    const protectedSkin=faceDistance<1.08||ear;
    const skinEvidence=smooth(35,52,r-g);
    const skinWeight=warm&&!brow&&!lipRegion?skinEvidence:0;
    const hairWeight=!protectedSkin&&!brow&&warm?(1-skinEvidence)*(1-smooth(170,215,lum)):0;
    if(hairWeight>0&&(state.hair!==initial.hair||hl)){
      const strand=Math.sin(x*.075+Math.sin(y*.028)*2.5);
      const hi=hl?smooth(.50,.95,strand)*.68:0;
      // Bounded shading retains strand detail without clipping pink/blonde
      // highlights to white or creating a bright outline at mask boundaries.
      const shade=.18+.82*Math.pow(clamp(lum/180,0,1),.8);
      const shine=smooth(90,190,lum)*.18;
      const original=[r,g,b];
      [r,g,b]=original.map((v,j)=>{
        const base=state.hair===initial.hair?v:hair[j]*shade*(1-shine)+255*shine;
        const tint=hl?hl[j]*shade*(1-shine)+255*shine:base;
        return v*(1-hairWeight)+(base*(1-hi)+tint*hi)*hairWeight;
      });
    }
    if(skinWeight>0){[r,g,b]=[r,g,b].map((v,j)=>v*(1-skinWeight)+clamp(v*(skin[j]/skinBase[j]))*skinWeight);}
    if(brow){const factor=lum/63;[r,g,b]=brows.map(v=>clamp(v*factor));}
    if(eyeRegion){const factor=lum/95;[r,g,b]=eyes.map(v=>clamp(v*factor));}
    if(lipRegion){const factor=lum/139;[r,g,b]=lips.map(v=>clamp(v*factor));}
    if(face&&skinWeight>.5&&!brow&&!lipRegion&&!eyeRegion){
      if(blush){const w=Math.max(...f.eyes.map(ex=>Math.exp(-ellipse(x,y,ex+(ex<f.cx?-8:8),f.ey+55,29,19)*2)))*.36;[r,g,b]=[r,g,b].map((v,j)=>v*(1-w)+blush[j]*w);}
      if(shadow){const w=Math.max(...f.eyes.map(ex=>Math.exp(-ellipse(x,y,ex,f.ey-18,31,12)*1.8)))*.57;[r,g,b]=[r,g,b].map((v,j)=>v*(1-w)+shadow[j]*w);}
      const glow=state.care.serum/100*.07;[r,g,b]=[r,g,b].map(v=>v+(255-v)*glow);
      if(station==='skin'&&tool==='mask'&&state.care.mask>0&&state.care.mask<100&&y>f.ey-80&&y<f.lip+25){const w=.40*(state.care.mask/100);[r,g,b]=[r,g,b].map((v,j)=>v*(1-w)+[126,188,160][j]*w);}
    }
    data[i]=r;data[i+1]=g;data[i+2]=b;
  }
  ctx.putImageData(new ImageData(data,543,724),0,0);
  if(state.freckles){ctx.fillStyle='#754731';for(let n=0;n<state.freckles*19;n++){const side=n%2?-1:1;const x=f.cx+side*(12+(Math.sin(n*71.13)*.5+.5)*61),y=f.ey+36+(Math.sin(n*19.1)*.5+.5)*30;ctx.globalAlpha=.23+(n%3)*.06;ctx.beginPath();ctx.arc(x,y,.8+(n%4)*.25,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
  if(station==='skin'&&tool==='cleanse'&&state.care.cleanse>0&&state.care.cleanse<100){ctx.fillStyle='#fff';maskMarks.forEach(p=>{ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(p.x-5,p.y-5,4,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}
}
function nailAt(x,y){const ox=(x-30)*1024/483,oy=y*1536/724;return nailAnchors.findIndex(n=>{const dx=ox-n.x,dy=oy-n.y,xx=dx*Math.cos(n.a)+dy*Math.sin(n.a),yy=-dx*Math.sin(n.a)+dy*Math.cos(n.a);return (xx/(n.rx+15))**2+(yy/(n.ry+18))**2<1;});}
function drawHand(){
  const data=new Uint8ClampedArray(handPixels.data),skin=rgb(state.skin),polishColors=state.nails.map(n=>n?rgb(n.color):null);
  for(let y=0;y<724;y++)for(let x=0;x<543;x++){
    const i=(y*543+x)*4;if(data[i+3]<4)continue;const r=data[i],g=data[i+1],b=data[i+2];
    const ox=(x-30)*1024/483,oy=y*1536/724;
    let nailIndex=-1,nx=0,ny=0,nailD=0;
    for(let k=0;k<5;k++){const n=nailAnchors[k],dx=ox-n.x,dy=oy-n.y;const xx=dx*Math.cos(n.a)+dy*Math.sin(n.a),yy=-dx*Math.sin(n.a)+dy*Math.cos(n.a);const d=(xx/n.rx)**4+(yy/n.ry)**4;if(d<1){nailIndex=k;nx=xx/n.rx;ny=yy/n.ry;nailD=d;break;}}
    if(nailIndex!==-1){const polish=state.nails[nailIndex];if(polish){let target=polishColors[nailIndex];let shade=(r*.3+g*.59+b*.11)/185;const finish=polish.finish;if(finish==='French'&&ny<-.62)target=[255,248,240];if(finish==='Matte')shade=.92+shade*.08;const glitter=finish==='Glitter'&&Math.sin(x*93.11+y*73.3)>.94;const w=1-smooth(.60,1,nailD);for(let j=0;j<3;j++){let value=clamp(target[j]*shade);if(finish!=='Matte'&&r>243&&g>220)value=value*.35+255*.65;if(glitter)value=250;data[i+j]=data[i+j]*(1-w)+value*w;}}}
    else if(r>g*1.1&&g>b*1.08){[r,g,b].forEach((v,j)=>{data[i+j]=clamp(v*skin[j]/[233,169,130][j]);});}
  }
  ctx.putImageData(new ImageData(data,543,724),0,0);
}
function pointFromEvent(e){const rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width/543,rect.height/724),drawWidth=543*scale,drawHeight=724*scale;return {x:(e.clientX-rect.left-(rect.width-drawWidth)/2)/scale,y:(e.clientY-rect.top-(rect.height-drawHeight))/scale};}
function bubble(point){const mirror=$('.mirror'),el=document.createElement('span');el.className='bubble';const rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width/543,rect.height/724);el.style.left=((rect.width-543*scale)/2+point.x*scale)+'px';el.style.top=((rect.height-724*scale)+point.y*scale)+'px';if(station==='hair'){el.textContent='✧';el.style.cssText+=';border:0;background:transparent;box-shadow:none;color:#fff2c7;font-size:26px;';}$('#bubbles').append(el);setTimeout(()=>el.remove(),1100);}
function applyStroke(p){
  const f=features[state.style];const now=performance.now();if(now-lastStrokeAt<40)return;lastStrokeAt=now;
  if(station==='hair'&&tool==='brush'&&p.y>35&&p.y<690&&ellipse(p.x,p.y,f.cx,250,112,148)>1){if(state.brushed<100){state.brushed=clamp(state.brushed+4,0,100);bubble(p);if(state.brushed===100)toast('Silky, shiny, and ready to go.');renderPanel();updateProgress();}}
  if(station==='skin'&&tool in state.care&&ellipse(p.x,p.y,f.cx,260,102,131)<1){if(state.care[tool]<100){state.care[tool]=clamp(state.care[tool]+4,0,100);maskMarks.push(p);if(maskMarks.length>32)maskMarks.shift();bubble(p);if(state.care[tool]===100){maskMarks=[];toast(`${careNames[tool]} complete. Hello, glow!`);}renderPanel();render();updateProgress();}}
}
canvas.addEventListener('pointerdown',e=>{if(!ready||busy)return;const p=pointFromEvent(e);if(station==='nails'){const k=nailAt(p.x,p.y);if(k>=0){remember();state.nails[k]={color:state.nailColor,finish:state.nailFinish};render();renderPanel();updateProgress();bubble(p);if(state.nails.every(Boolean))toast('Ten out of ten for these five nails.');}return;}if((station==='hair'&&tool==='brush')||station==='skin'){remember();activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);lastPoint=p;applyStroke(p);}});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==activePointer)return;const p=pointFromEvent(e);if(!lastPoint||Math.hypot(p.x-lastPoint.x,p.y-lastPoint.y)>4){applyStroke(p);lastPoint=p;}});
function endStroke(){activePointer=null;lastPoint=null;}
canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);canvas.addEventListener('lostpointercapture',endStroke);
async function autoTreatment(){
  if(busy)return;const chosen=tool;if(station!=='skin'||!(chosen in state.care))return;remember();busy=true;$('#undo').disabled=true;if(state.care[chosen]>=100)state.care[chosen]=0;
  const f=features[state.style];while(state.care[chosen]<100){await new Promise(r=>setTimeout(r,95));state.care[chosen]=Math.min(100,state.care[chosen]+5);const p={x:f.cx+Math.sin(state.care[chosen]) *62,y:260+Math.cos(state.care[chosen]*.4)*60};maskMarks.push(p);bubble(p);render();renderPanel();}maskMarks=[];busy=false;$('#undo').disabled=!history.length;render();updateProgress();toast(`${careNames[chosen]} complete. A little softer, a little brighter.`);
}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(busy)return toast('Your treatment is almost finished.');if(b.dataset.tab){tab=b.dataset.tab;renderPanel();return;}if(b.dataset.key){setValue(b.dataset.key,b.dataset.key==='style'?Number(b.dataset.value):b.dataset.value);return;}if(b.dataset.tool){tool=b.dataset.tool;renderPanel();render();return;}if(b.dataset.action==='brush'){remember();state.brushed=Math.min(100,state.brushed+25);tool='brush';bubble({x:130,y:350});renderPanel();updateProgress();toast(state.brushed===100?'Your hair is silky and ready.':'One lovely brushstroke.');}if(b.dataset.action==='care')autoTreatment();if(b.dataset.action==='paint'){remember();state.nails=Array.from({length:5},()=>({color:state.nailColor,finish:state.nailFinish}));render();renderPanel();updateProgress();toast('A fresh manicure. Beautifully done.');}if(b.dataset.action==='remove-polish'){remember();state.nails=[null,null,null,null,null];render();renderPanel();updateProgress();}});
$('#panel').addEventListener('input',e=>{if(e.target.id==='freckles'){if(!e.target.dataset.started){remember();e.target.dataset.started='true';}state.freckles=Number(e.target.value);render();}});
document.querySelectorAll('[data-station]').forEach(b=>b.addEventListener('click',()=>switchStation(b.dataset.station)));
$('#character').addEventListener('click',()=>switchStation('character'));
$('#undo').disabled=true;$('#undo').addEventListener('click',()=>{if(busy||!history.length)return;state=history.pop();maskMarks=[];render();renderPanel();updateProgress();$('#undo').disabled=!history.length;toast('One little step back.');});
$('#music').addEventListener('click',async()=>{try{const on=await window.salonJazz.toggle();$('#music').setAttribute('aria-pressed',on);$('#music-label').textContent=on?'Jazz is playing':'Play jazz';}catch{toast('Audio couldn’t start. Try the jazz button again.');}});
const modal=$('#modal');$('#close-modal').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
$('#help').onclick=()=>{$('#modal-content').innerHTML=`<div class="modal-flower">✧</div><h2>Welcome to your salon.</h2><p>There’s no timer and no wrong look. Just a little room to create.</p><ol><li>Start with <strong>My character</strong> to choose your complexion, eyes, freckles, and brows.</li><li>Visit <strong>Hair, Skin care, Makeup, and Nails</strong>. Tap shades to try them on.</li><li>Drag the brush through the hair, move treatments over the face, and tap nails to paint. Every treatment has a button alternative, too.</li><li>Turn on <strong>Play jazz</strong>, relax, and finish your look whenever you like.</li></ol><p>Use ↶ to undo a change. Your current look stays here until you reload the page.</p>`;modal.showModal();};
$('#finish').onclick=()=>{if(!ready)return toast('Your artwork is still getting ready.');if(busy)return toast('Your treatment is almost finished.');const prevStation=station;station='hair';drawCharacter();const portrait=canvas.toDataURL('image/png');station='nails';drawHand();const nails=canvas.toDataURL('image/png');station=prevStation;render();const count=Object.values(completed()).filter(Boolean).length;$('#modal-content').innerHTML=`<div class="modal-flower">✿</div><h2>Beautifully you.</h2><p style="text-align:center">A little care. A little color. A look all your own.</p><img src="${portrait}" alt="Your finished character"><div class="finish-stats">${styleNames[state.style]} · ${colorName('hair')}<br>${count} of 4 finishing touches complete</div><button id="download-look" class="primary-button">Save my look ↓</button><button id="keep-styling" class="action-button">Keep styling</button>`;modal.showModal();$('#keep-styling').onclick=()=>modal.close();$('#download-look').onclick=()=>downloadLook(portrait,nails);};
async function downloadLook(portrait,nails){const out=document.createElement('canvas');out.width=1100;out.height=1000;const c=out.getContext('2d');c.fillStyle='#fcf0f5';c.fillRect(0,0,1100,1000);c.fillStyle='#4b3946';c.font='50px Georgia';c.textAlign='center';c.fillText('velvet',550,78);c.font='18px sans-serif';c.fillStyle='#a47b8f';c.fillText('A LOOK THAT IS BEAUTIFULLY YOU',550,116);const [p,n]=await Promise.all([loadImage(portrait),loadImage(nails)]);c.fillStyle='#e0eee6';c.beginPath();c.roundRect(45,160,610,750,[220,220,22,22]);c.fill();c.drawImage(p,65,170,570,760);c.drawImage(n,635,260,420,560);c.fillStyle='#a47b8f';c.font='17px sans-serif';c.fillText(`${styleNames[state.style]} · ${colorName('hair')}`,550,962);out.toBlob(blob=>{if(!blob)return toast('Could not save the image. Please try again.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-velvet-salon-look.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Your look is ready to keep.');},'image/png');}
renderPanel();updateProgress();loadArt();
