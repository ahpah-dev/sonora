(async()=>{
  const api=window.sonoraVerification,results=[];
  if(!api?.acousticWarmTrack)throw Error('Use the local Sonora verification renderer.');
  const check=(condition,label)=>{if(!condition)throw Error(label);results.push(`PASS ${label}`);};
  const context=seconds=>new OfflineAudioContext(2,Math.ceil(seconds*44100),44100);
  const factory=name=>{const preset=api.ACOUSTIC_PRESETS.find(p=>p.name===name);if(!preset)throw Error(`Missing ${name}`);return {id:`acoustic-test-${name}`,type:'synth',instrument:name,synth:{...preset.synth}};};
  const energy=(buffer,start,end,channel=0)=>{const data=buffer.getChannelData(channel),from=Math.max(0,Math.floor(start*buffer.sampleRate)),to=Math.min(data.length,Math.floor(end*buffer.sampleRate));let sum=0;for(let i=from;i<to;i++)sum+=data[i]**2;return Math.sqrt(sum/Math.max(1,to-from));};
  const peak=buffer=>{let value=0;for(let channel=0;channel<buffer.numberOfChannels;channel++)for(const sample of buffer.getChannelData(channel)){if(!Number.isFinite(sample))return Infinity;value=Math.max(value,Math.abs(sample));}return value;};
  async function render(track,note,seconds=2,duration=.65){const warming=context(1);await api.acousticWarmTrack(warming,track,[note]);const ctx=context(seconds);check(typeof api.proVoice(ctx,ctx.destination,track,note,0,duration,false)==='function',`${track.instrument} creates a recorded voice in a fresh offline context`);return ctx.startRendering();}
  check(api.ACOUSTIC_PRESETS.length===10&&new Set(api.ACOUSTIC_PRESETS.map(p=>p.sampleBank)).size===5,'ten acoustic patches use five distinct recorded instrument banks');
  for(const preset of api.ACOUSTIC_PRESETS){const synth=api.proSynth({synth:preset.synth});check(synth.engine==='acoustic'&&synth.sampleBank===preset.sampleBank&&synth.midiRange.join(',')===preset.midiRange.join(','),`${preset.name} preserves its acoustic engine, bank and pitch range`);}
  const notes={cello:{pitch:60,velocity:.82},bass:{pitch:40,velocity:.82},harp:{pitch:60,velocity:.82},marimba:{pitch:60,velocity:.82},flute:{pitch:72,velocity:.82}};
  for(const name of ['Cello Ensemble','Upright Bass','Concert Harp','Studio Marimba','Concert Flute']){
    const track=factory(name),note=notes[track.synth.sampleBank],buffer=await render(track,note);
    check(energy(buffer,.02,.6)>.0002&&peak(buffer)<.95,`${name} produces audible finite PCM with instrument headroom (peak=${peak(buffer).toFixed(4)})`);
    check(energy(buffer,1.4,1.95)<.000015,`${name} note-off releases to silence without a stuck recording`);
    const mapped=api.acousticSamplesFor(track,note);check(mapped.length>0&&mapped.every(sample=>api.acousticBuffers.has(sample.file)),`${name} first-load preflight includes every required layer and round robin`);
  }
  const marimba=factory('Studio Marimba'),quiet=await render(marimba,{pitch:60,velocity:.25}),loud=await render(marimba,{pitch:60,velocity:.95});
  const quietRms=energy(quiet,.02,.55),loudRms=energy(loud,.02,.55);
  check(loudRms>quietRms*2,`recorded instruments retain a meaningful velocity range (ratio=${(loudRms/quietRms).toFixed(2)})`);
  const bright=factory('Studio Marimba'),dark=factory('Soft Marimba'),brightBuffer=await render(bright,notes.marimba),darkBuffer=await render(dark,notes.marimba);
  function upper(buffer){const data=buffer.getChannelData(0),omega=2*Math.PI*2000/buffer.sampleRate,cos=Math.cos(omega),alpha=Math.sin(omega)/Math.SQRT2,a0=1+alpha,b0=(1+cos)/2/a0,b1=-(1+cos)/a0,b2=b0,a1=-2*cos/a0,a2=(1-alpha)/a0;let filtered=Float32Array.from(data);for(let pass=0;pass<2;pass++){let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<filtered.length;i++){const x=filtered[i],y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;filtered[i]=y;x2=x1;x1=x;y2=y1;y1=y;}}let harmonics=0,power=0;for(let i=1500;i<22000;i++){harmonics+=filtered[i]**2;power+=data[i]**2;}return Math.sqrt(harmonics/Math.max(power,1e-12));}
  check(upper(brightBuffer)>upper(darkBuffer)*1.15,`marimba voicing controls produce distinct attack spectra (ratio=${(upper(brightBuffer)/upper(darkBuffer)).toFixed(2)})`);
  for(const name of ['Cello Ensemble','Concert Flute']){
    const track=factory(name),note=notes[track.synth.sampleBank],ctx=context(7);await api.acousticWarmTrack(ctx,track,[note]);const release=api.proVoice(ctx,ctx.destination,track,note,0,null,false),pause=ctx.suspend(5.15),rendered=ctx.startRendering();await pause;release();await ctx.resume();const buffer=await rendered;
    check(energy(buffer,4.5,5.1)>.0001,`${name} sustains through its recorded loop beyond the original file length`);
    check(energy(buffer,6,6.8)<.000015,`${name} held-note release stops every loop and modulation source`);
  }
  const bass=factory('Upright Bass'),rr=context(1.8);await api.acousticWarmTrack(rr,bass,[notes.bass]);api.proVoice(rr,rr.destination,bass,notes.bass,0,.55,false);api.proVoice(rr,rr.destination,bass,notes.bass,.85,.55,false);const rrBuffer=await rr.startRendering(),data=rrBuffer.getChannelData(0);let difference=0,power=0;for(let i=2000;i<18000;i++){difference+=(data[i]-data[i+Math.round(.85*44100)])**2;power+=data[i]**2;}
  check(Math.sqrt(difference/Math.max(power,1e-12))>.1,'upright bass alternates real recorded round robins on repeated notes');
  for(const name of ['Cello Ensemble','Concert Harp','Studio Marimba','Concert Flute']){
    const track=factory(name),root=name==='Concert Flute'?72:60,notes=[0,3,7,10,12,15].map(offset=>({pitch:root+offset,velocity:.9})),ctx=context(2);await api.acousticWarmTrack(ctx,track,notes);notes.forEach(note=>api.proVoice(ctx,ctx.destination,track,note,0,.7,false));const buffer=await ctx.startRendering();check(peak(buffer)<.98,`${name} six-note chord retains output headroom (peak=${peak(buffer).toFixed(4)})`);
  }
  {
    const ctx=context(3),parts=[['Cello Ensemble',[48,55,60]],['Upright Bass',[36]],['Concert Harp',[60,64,67]],['Studio Marimba',[60,64,67]],['Concert Flute',[72]]];
    for(const [name,pitches] of parts){const track=factory(name),output=ctx.createGain(),partNotes=pitches.map(pitch=>({pitch,velocity:.8}));output.gain.value=.65;output.connect(ctx.destination);await api.acousticWarmTrack(ctx,track,partNotes);partNotes.forEach(note=>api.proVoice(ctx,output,track,note,.05,1.2,false));}
    const mix=await ctx.startRendering(),level=peak(mix),rms=energy(mix,.05,1.2);check(level<.98&&rms>.02,`five recorded instrument tracks retain useful default mix level and headroom (peak=${level.toFixed(4)}, RMS=${rms.toFixed(4)})`);
  }
  const snapshot=structuredClone(api.getProject());
  try{
    document.querySelector('#stopButton').click();if(document.querySelector('#recordButton').classList.contains('active'))document.querySelector('#recordButton').click();
    const track={...factory('Upright Bass'),color:'#b89de9',volume:.6,pan:0,mute:false,solo:false,effects:[],notes:[],clips:[{id:'cold-clip',name:'Empty',start:0,length:16,notes:[]}]};
    api.replaceProject({...snapshot,tracks:[track],selectedTrack:track.id,selectedClip:'cold-clip',countIn:false,loop:false});document.querySelector('[data-tab="piano"]').click();document.querySelector('#playButton').click();
    for(let i=0;i<100&&(!api.audio.context||api.audio.context.state!=='running');i++)await new Promise(resolve=>setTimeout(resolve,10));document.querySelector('#stopButton').click();
    const actual=api.getTrack(),note={pitch:40,velocity:.82},mapped=api.acousticSamplesFor(actual,note);mapped.forEach(sample=>api.acousticBuffers.delete(sample.file));
    const fetchOriginal=window.fetch,ctx=api.audio.context,createOriginal=ctx.createBufferSource;let starts=0,unblock;const gate=new Promise(resolve=>unblock=resolve);
    window.fetch=async(...args)=>{if(String(args[0]).includes('/assets/acoustic/'))await gate;return fetchOriginal(...args);};
    ctx.createBufferSource=function(){const source=createOriginal.call(ctx),start=source.start;source.start=function(...args){starts++;return start.apply(source,args);};return source;};
    try{api.liveNoteDown('acoustic-cancel-test',note.pitch,note.velocity,performance.now());api.liveNoteUp('acoustic-cancel-test',performance.now()+20);unblock();await api.acousticWarmTrack(ctx,actual,[note]);await new Promise(resolve=>setTimeout(resolve,20));check(starts===0,'releasing a cold live key cancels its pending recording and prevents a delayed ghost note');}
    finally{unblock();window.fetch=fetchOriginal;ctx.createBufferSource=createOriginal;api.liveNoteUp('acoustic-cancel-test');}
    check(api.proSynth(actual).engine==='acoustic','recorded instrument selection survives the shared project restore path');
  }finally{document.querySelector('#stopButton').click();api.replaceProject(snapshot);}
  return results;
})();
