(async()=>{
  const api=window.sonoraVerification,results=[];
  if(!api)throw new Error('Open the local /__verify/ studio to run audio regression checks.');
  const check=(ok,label)=>{if(!ok)throw new Error(label);results.push(`PASS ${label}`);};
  const sampleRate=44100;
  const context=seconds=>new OfflineAudioContext(2,Math.ceil(sampleRate*seconds),sampleRate);
  const factory=name=>{const preset=api.SYNTH_PRESETS.find(p=>p.name===name);if(!preset)throw new Error(`Missing preset: ${name}`);return {id:`test-${name}`,type:'synth',instrument:name,synth:{...preset.synth}};};
  const energy=(buffer,from=0,to=buffer.duration)=>{const data=buffer.getChannelData(0),start=Math.floor(from*buffer.sampleRate),end=Math.min(data.length,Math.floor(to*buffer.sampleRate));let sum=0;for(let i=start;i<end;i++)sum+=data[i]*data[i];return Math.sqrt(sum/Math.max(1,end-start));};
  // Isolate upper piano harmonics with a fourth-order 2 kHz high-pass. A first
  // difference mostly measures the C4 fundamental and under-reports attack tone.
  const brightness=buffer=>{const data=buffer.getChannelData(0),omega=2*Math.PI*2000/sampleRate,cos=Math.cos(omega),alpha=Math.sin(omega)/Math.SQRT2,a0=1+alpha,b0=(1+cos)/2/a0,b1=-(1+cos)/a0,b2=b0,a1=-2*cos/a0,a2=(1-alpha)/a0;let filtered=Float32Array.from(data);for(let pass=0;pass<2;pass++){let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<filtered.length;i++){const x=filtered[i],y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;filtered[i]=y;x2=x1;x1=x;y2=y1;y1=y;}}let upper=0,total=0;for(let i=Math.floor(.03*sampleRate);i<Math.floor(.45*sampleRate);i++){upper+=filtered[i]**2;total+=data[i]**2;}return Math.sqrt(upper/Math.max(total,1e-12));};
  const finite=buffer=>[0,1].every(channel=>buffer.getChannelData(channel).every(Number.isFinite));
  const render=async(track,velocity=.82,duration=.7)=>{const ctx=context(2);check(typeof api.proVoice(ctx,ctx.destination,track,{pitch:60,velocity},0,duration,false)==='function',`${track.instrument} creates an offline voice`);return ctx.startRendering();};
  const grand=factory('Studio Grand'),felt=factory('Felt Piano'),warming=context(1);
  await api.pianoWarmNotes(warming,[api.pianoTouch(grand,{pitch:60,velocity:.82}),api.pianoTouch(felt,{pitch:60,velocity:.82}),api.pianoTouch(grand,{pitch:60,velocity:.3}),api.pianoTouch(grand,{pitch:60,velocity:.95})]);
  const fresh=context(1),prepared=api.pianoTouch(grand,{pitch:60,velocity:.82}),mapped=api.pianoSamplesFor(fresh,prepared.pitch,prepared.velocity);
  check(mapped.length===2&&mapped.every(sample=>api.pianoBank(fresh).buffers.has(sample.file)),'a fresh offline context sees both decoded piano velocity layers');
  const middle=api.pianoVelocityMix(.66);
  check(middle.length===2&&Math.abs(middle.reduce((sum,layer)=>sum+layer.weight**2,0)-1)<1e-8,'velocity layers overlap with constant-power interpolation');
  const adjacent=api.pianoVelocityMix(.661);
  check(Math.abs(adjacent[0].weight-middle[0].weight)<.02,'velocity response changes continuously across the old layer switch');
  const grandBuffer=await render(grand),feltBuffer=await render(felt),softBuffer=await render(grand,.3),hardBuffer=await render(grand,.95);
  check(finite(grandBuffer)&&finite(feltBuffer)&&energy(grandBuffer,0,.7)>.0001&&energy(feltBuffer,0,.7)>.0001,'recorded grand and felt voices both render audible finite PCM');
  const grandBrightness=brightness(grandBuffer),feltBrightness=brightness(feltBuffer);
  check(grandBrightness>feltBrightness*1.25,`Studio Grand has substantially brighter recorded tone than Felt Piano (grand=${grandBrightness.toFixed(5)}, felt=${feltBrightness.toFixed(5)}, ratio=${(grandBrightness/feltBrightness).toFixed(3)})`);
  const hardEnergy=energy(hardBuffer,.02,.5),softEnergy=energy(softBuffer,.02,.5);
  check(hardEnergy>softEnergy*1.5,`piano velocity produces a meaningful dynamic range (hard=${hardEnergy.toFixed(5)}, soft=${softEnergy.toFixed(5)}, ratio=${(hardEnergy/softEnergy).toFixed(3)})`);
  check(energy(grandBuffer,1.2,1.8)<.00002,'note-off damps the sampled voice to silence without a hanging tail');
  for(const name of ['Electric Tines','Velvet Rhodes','Analog Strings','Analog Pluck','Reese Bass','Copper Lead']){
    const buffer=await render(factory(name));check(finite(buffer)&&energy(buffer,0,1)>.0001,`${name} renders finite audible audio with its production patch`);
  }
  const drumTrack={id:'drum-regression',type:'drums',instrument:'Pocket Kit',drumKit:'Pocket Kit',drumParams:{}},drums=context(2.6);
  const lanes=['kick','snare','hat','openHat','clap','tom','rim'];
  lanes.forEach((kind,index)=>api.proDrumVoice(drums,drums.destination,drumTrack,kind,.05+index*.32,.8,false));
  const drumBuffer=await drums.startRendering();
  check(finite(drumBuffer)&&lanes.every((_,index)=>energy(drumBuffer,.05+index*.32,.1+index*.32)>.00001),'all seven layered drum voices produce finite audible PCM');
  async function hat(choke){const ctx=context(.8),track={...drumTrack,drumParams:{openHat:{decay:2.5}}};api.proDrumVoice(ctx,ctx.destination,track,'openHat',0,.9,false);if(choke)api.proDrumVoice(ctx,ctx.destination,track,'hat',.1,.9,false);return ctx.startRendering();}
  const open=await hat(false),choked=await hat(true);
  check(energy(choked,.2,.4)<energy(open,.2,.4)*.05,'closed hat chokes an already scheduled open-hat tail');
  async function pan(value){const ctx=context(.5),track={...drumTrack,drumParams:{snare:{pan:value,tone:.3}}};api.proDrumVoice(ctx,ctx.destination,track,'snare',0,.8,false);return ctx.startRendering();}
  const left=await pan(-1);let rightPeak=0;for(const sample of left.getChannelData(1))rightPeak=Math.max(rightPeak,Math.abs(sample));
  check(energy(left,0,.3)>.0001&&rightPeak<.000001,'per-drum pan controls stereo placement in offline rendering');
  return results;
})();
