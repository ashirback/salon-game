/* An original, generative swing trio. No recordings or external audio needed. */
class SalonJazz {
  constructor(){this.ctx=null;this.playing=false;this.next=0;this.beat=0;this.timer=null;this.volume=.32;}
  async toggle(){
    if(!this.ctx){
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);
      const length=this.ctx.sampleRate*.18;this.noise=this.ctx.createBuffer(1,length,this.ctx.sampleRate);
      const data=this.noise.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
    }
    if(this.playing){this.playing=false;clearInterval(this.timer);this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.07);return false;}
    await this.ctx.resume();this.playing=true;this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.07);this.next=this.ctx.currentTime+.06;
    this.schedule();this.timer=setInterval(()=>this.schedule(),80);return true;
  }
  note(midi,time,duration,volume,instrument='piano'){
    const c=this.ctx;const frequency=440*Math.pow(2,(midi-69)/12);const env=c.createGain();
    env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(volume,time+.008);env.gain.exponentialRampToValueAtTime(.0001,time+duration);env.connect(this.master);
    const partials=instrument==='bass'?[[1,1],[2,.2]]:[[1,1],[2,.3],[3,.12],[4,.045]];
    partials.forEach(([multiple,level])=>{const osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency*multiple,time);gain.gain.value=level;osc.connect(gain);gain.connect(env);osc.start(time);osc.stop(time+duration+.03);});
  }
  brush(time,accent){const src=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),env=this.ctx.createGain();src.buffer=this.noise;filter.type='highpass';filter.frequency.value=accent?1800:4400;env.gain.setValueAtTime(accent?.055:.026,time);env.gain.exponentialRampToValueAtTime(.0001,time+.14);src.connect(filter);filter.connect(env);env.connect(this.master);src.start(time);src.stop(time+.18);}
  schedule(){
    // Dm9 – G13 – Cmaj9 – A7, then a soft turn through Fmaj7 and Eø7.
    const bars=[{root:38,chord:[53,60,64,69],scale:[62,65,69,72,76]},{root:43,chord:[53,59,64,69],scale:[62,65,67,69,71]},{root:36,chord:[52,59,62,67],scale:[60,64,67,71,74]},{root:45,chord:[55,61,64,70],scale:[61,64,67,69,70]},{root:38,chord:[53,60,64,69],scale:[62,65,69,72,76]},{root:43,chord:[53,59,64,69],scale:[62,65,67,69,71]},{root:36,chord:[52,59,62,67],scale:[60,64,67,71,74]},{root:36,chord:[52,57,62,67],scale:[60,64,67,69,74]},{root:41,chord:[52,57,60,67],scale:[60,64,65,69,72]},{root:41,chord:[52,57,60,67],scale:[60,64,65,69,72]},{root:40,chord:[55,58,62,67],scale:[62,64,67,70,74]},{root:45,chord:[55,61,64,70],scale:[61,64,67,69,70]},{root:38,chord:[53,60,64,69],scale:[62,65,69,72,76]},{root:43,chord:[53,59,64,69],scale:[62,65,67,69,71]},{root:36,chord:[52,59,62,67],scale:[60,64,67,71,74]},{root:45,chord:[55,61,64,70],scale:[61,64,67,69,70]}];
    const beatLength=60/86;
    while(this.next<this.ctx.currentTime+.45){
      const bar=bars[Math.floor(this.beat/4)%bars.length],b=this.beat%4,t=this.next;
      const bass=[bar.root,bar.root+7,bar.root+12,bar.root+11][b];this.note(bass,t,.6,.27,'bass');
      if(b===0||b===2)bar.chord.forEach((n,i)=>this.note(n,t+i*.014,1.6,b===0?.06:.035));
      this.brush(t,b===1||b===3);this.brush(t+beatLength*2/3,false);
      const phrase=[0,2,3,1,4,3,2,1,0,2,4,3,1,2,0,1],index=phrase[this.beat%phrase.length];
      if(this.beat%8!==7)this.note(bar.scale[index],t+(b%2?beatLength*2/3:0),.6,.065);
      this.beat++;this.next+=beatLength;
    }
  }
}
window.salonJazz=new SalonJazz();
