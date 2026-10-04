(async()=>{
  const q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
  const check=(ok,label)=>{if(!ok)throw Error(label);results.push('PASS '+label);};
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text).click();
  const tab=name=>q(`[data-tab="${name}"]`).click();
  const change=(selector,value)=>{const el=q(selector);el.value=value;el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));if(el.type==='range')el.dispatchEvent(new Event('change',{bubbles:true}));};
  const key=(code,down=true)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code.replace('Key',''),bubbles:true}));
  const save=()=>{q('#saveButton').click();return JSON.parse(localStorage.getItem('sonora-daw-project-v1'));};
  q('#stopButton').click();if(q('#recordButton').classList.contains('active'))q('#recordButton').click();button('New');button('Add clip');tab('perform');change('#pianoSound','Studio Grand');change('#pianoChordMode','single');
  check(save().tracks[0].synth.engine==='piano','grand loads the dedicated piano engine');
  check(document.querySelectorAll('.performance-key').length===25,'performance renders 25 chromatic keys');
  change('#pianoRange','88');check(document.querySelectorAll('.performance-key').length===88&&q('.performance-key').dataset.pitch==='21','full keyboard spans A0 to C8');
  change('#pianoRange','49');check(document.querySelectorAll('.performance-key').length===49,'49 key layout renders');change('#pianoRange','25');
  change('input[aria-label="Brightness"]','.33');check(save().tracks[0].synth.pianoTone===.33,'piano tone customization persists');q('#undoButton').click();check(save().tracks[0].synth.pianoTone===.7,'piano customization supports undo');q('#redoButton').click();
  key('KeyZ');key('KeyX');await sleep(80);check(document.querySelectorAll('.performance-key.pressed').length===2,'computer keyboard supports polyphony');
  key('ShiftLeft');key('KeyZ',false);key('KeyX',false);check(q('#pianoSustain').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('.performance-key.sustained').length===2,'sustain holds released voices');key('ShiftLeft',false);check(!q('.performance-key.sustained'),'pedal release damps sustained voices');
  change('#pianoChordMode','minor');key('KeyZ');await sleep(60);check([...document.querySelectorAll('.performance-key.pressed')].map(k=>Number(k.dataset.pitch)).join(',')==='60,63,67','single key plays a minor chord');key('KeyZ',false);check(!q('.performance-key.pressed'),'chord note off releases every voice');
  q('#recordButton').click();q('#playButton').click();await sleep(120);const bed=q('.performance-bed');key('KeyZ');await sleep(350);key('KeyZ',false);q('#stopButton').click();
  const recorded=save().tracks[0].clips[0].notes;check(recorded.length===3&&recorded.every(n=>n.duration>0&&n.duration<=16),'chord performance records three bounded MIDI notes');check(bed===q('.performance-bed'),'recording preserves the keyboard DOM for held pointers');
  q('#undoButton').click();check(save().tracks[0].clips[0].notes.length===0,'recorded chord undoes as one performance');q('#redoButton').click();
  if(q('#recordButton').classList.contains('active'))q('#recordButton').click();tab('piano');q('#clearPatternButton').click();change('#pianoChordQuality','minor7');change('#pianoInversion','1');button('+ Insert chord');
  let notes=save().tracks[0].clips[0].notes;check(notes.length===4&&notes.map(n=>n.pitch).sort((a,b)=>a-b).join(',')==='63,67,70,72','chord builder inserts first inversion minor seventh');
  button('Arpeggiate');notes=save().tracks[0].clips[0].notes;check(new Set(notes.map(n=>n.start)).size===4,'arpeggiation staggers selected notes on the grid');q('#undoButton').click();check(new Set(save().tracks[0].clips[0].notes.map(n=>n.start)).size===1,'arpeggiation supports undo');q('#redoButton').click();
  button('Select all');change('#pianoNote-velocity','35');check(save().tracks[0].clips[0].notes.every(n=>n.velocity===.35),'note inspector edits selected velocities');
  tab('perform');change('#pianoSound','Felt Piano');check(save().tracks[0].synth.pianoTone===.2,'felt piano has a softer harmonic profile');tab('instrument');check(q('.piano-designer')&&document.querySelectorAll('.piano-parameters input').length===5,'piano designer exposes five meaningful sound controls');
  const model=save();
  const dt=new DataTransfer();dt.items.add(new File([JSON.stringify({format:'sonora-project',version:1,project:model,samples:[]})],'Piano roundtrip.sonora',{type:'application/json'}));q('#projectFileInput').files=dt.files;q('#projectFileInput').dispatchEvent(new Event('change',{bubbles:true}));await sleep(400);
  check(save().tracks[0].synth.engine==='piano'&&save().tracks[0].synth.pianoTone===.2,'portable project round trip preserves piano sound');
  const blobs=[],click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:'))blobs.push({name:this.download,url:this.href});else click.call(this);};
  try{q('#exportWavButton').click();for(let i=0;i<150&&!blobs.length;i++)await sleep(100);check(blobs.length>0,'piano arrangement renders offline to WAV');const bytes=await(await fetch(blobs[0].url)).arrayBuffer(),view=new DataView(bytes);let peak=0;for(let i=44;i+1<bytes.byteLength;i+=2)peak=Math.max(peak,Math.abs(view.getInt16(i,true)));check(peak>100,'piano WAV contains audible audio');}finally{HTMLAnchorElement.prototype.click=click;}
  check(model.tracks[0].synth.engine==='piano'&&model.tracks[0].synth.pianoDecay===4.5,'saved project preserves piano engine and string decay');
  tab('perform');key('ShiftLeft');key('KeyZ');await sleep(40);key('KeyZ',false);button('All notes off');check(!q('.performance-key.sustained')&&q('#pianoSustain').getAttribute('aria-pressed')==='false','panic clears sustained voices and pedal');
  const input={id:'test-piano',name:'Test Piano',type:'input',state:'connected',onmidimessage:null},access={inputs:new Map([['test-piano',input]]),onstatechange:null};const original=navigator.requestMIDIAccess;Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>access,configurable:true});
  try{button('Connect MIDI');await sleep(80);input.onmidimessage({data:[0xb0,64,127]});input.onmidimessage({data:[0x90,64,100]});await sleep(40);input.onmidimessage({data:[0x80,64,0]});check(q('.performance-key[data-pitch="64"]').classList.contains('sustained'),'MIDI CC64 pedal sustains a released note');input.state='disconnected';access.inputs.clear();access.onstatechange({port:input});check(!q('.performance-key.sustained')&&q('#pianoSustain').getAttribute('aria-pressed')==='false','MIDI disconnect releases sustain');}finally{Object.defineProperty(navigator,'requestMIDIAccess',{value:original,configurable:true});}
  return results;
})();
