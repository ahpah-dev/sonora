(async()=>{
  const q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
  const check=(ok,label)=>{if(!ok)throw Error(label);results.push('PASS '+label);};
  const click=(selector,text)=>{const b=[...document.querySelectorAll(selector)].find(b=>b.textContent.trim()===text);if(!b)throw Error('Missing '+text);b.click();};
  const save=()=>{q('#saveButton').click();return JSON.parse(localStorage.getItem('sonora-daw-project-v1'));};
  const change=(selector,value)=>{const input=q(selector);if(!input)throw Error('Missing '+selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
  const tab=name=>click('.editor-tabs button',name);
  const pointer=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{clientX:x,clientY:y,pointerId:77,button:0,bubbles:true}));
  q('#stopButton').click();click('.workspace-controls button','New');click('.editor-tools button','Generate');
  check(q('.pro-roll-ruler')&&q('#proVelocityLane'),'piano ruler and velocity lane render');
  const initial=save().tracks[0].clips[0].notes;
  check(q('#proVelocityLane').children.length===initial.length,'every note has a velocity control');
  const beforeWidth=q('#pianoRoll').getBoundingClientRect().width;q('#proRollZoom').click();
  check(q('#pianoRoll').getBoundingClientRect().width>beforeWidth*1.9,'piano zoom expands the actual editing grid');
  change('select[aria-label="Scale root"]',2);change('select[aria-label="Scale guide"]','major');q('input[aria-label="Snap to scale"]').checked=true;q('input[aria-label="Snap to scale"]').dispatchEvent(new Event('change',{bubbles:true}));
  let roll=q('#pianoRoll');roll.setPointerCapture=()=>{};let r=roll.getBoundingClientRect();
  const labels=[...document.querySelectorAll('.piano-label')],row=labels.findIndex(l=>l.textContent==='D♯4');
  check(row>=0,'editable pitch range includes D sharp');
  pointer(roll,'pointerdown',r.left+r.width*.23,r.top+row*20+10);
  pointer(roll,'pointerup',r.left+r.width*.23,r.top+row*20+10);
  let p=save(),newNote=p.tracks[0].clips[0].notes.at(-1);
  check(newNote.pitch===62,'scale lock snaps an out-of-scale D sharp to D');
  let note=q('.note[data-index="12"]');r=note.getBoundingClientRect();pointer(note,'pointerdown',r.left+4,r.top+5);pointer(roll,'pointermove',r.left+4+roll.getBoundingClientRect().width/16*.5,r.top-35);pointer(roll,'pointerup',r.left+4,r.top-35);
  p=save();newNote=p.tracks[0].clips[0].notes.at(-1);check(newNote.start===4&&newNote.pitch===64,'note dragging respects the time grid and scale');
  note=q('.note[data-index="12"]');r=note.getBoundingClientRect();const handle=note.querySelector('.note-handle'),h=handle.getBoundingClientRect();pointer(handle,'pointerdown',h.left+1,h.top+3);pointer(roll,'pointermove',h.left+1+roll.getBoundingClientRect().width/16*.25,h.top+3);pointer(roll,'pointerup',h.left+1,h.top+3);
  check(save().tracks[0].clips[0].notes.at(-1).duration>newNote.duration,'note handle resizes the selected note');
  const bar=q('.pro-velocity-bar[data-index="12"]');bar.setPointerCapture=()=>{};r=bar.getBoundingClientRect();pointer(bar,'pointerdown',r.left+3,r.top+5);pointer(bar,'pointermove',r.left+3,r.top+18);pointer(bar,'pointerup',r.left+3,r.top+18);p=save();const velocity=p.tracks[0].clips[0].notes.at(-1).velocity;check(velocity<.78,'dragging velocity changes note dynamics');
  q('#undoButton').click();check(Math.abs(save().tracks[0].clips[0].notes.at(-1).velocity-.78)<.001,'velocity editing supports undo');q('#redoButton').click();check(Math.abs(save().tracks[0].clips[0].notes.at(-1).velocity-velocity)<.001,'velocity editing supports redo');
  const count=save().tracks[0].clips[0].notes.length;q('#proHumanize').click();check(save().tracks[0].clips[0].notes.length===count,'humanize preserves notes');q('#quantizeNotesButton').click();check(save().tracks[0].clips[0].notes.every(n=>Math.abs(n.start*4-Math.round(n.start*4))<.001),'quantize returns notes to the snap grid');
  tab('Instrument');check(document.querySelectorAll('.instrument-module').length===6,'instrument designer exposes six modules');
  change('.instrument-editor input[aria-label="Layer mix"]',.37);change('.instrument-editor input[aria-label="FM amount"]',.65);change('.instrument-editor input[aria-label="Filter motion"]',.2);check(save().tracks[0].synth.mix2===.37&&save().tracks[0].synth.fmAmount===.65,'layer and modulation controls persist');
  q('#undoButton').click();check(save().tracks[0].synth.lfoFilter===0,'instrument edits support undo');q('#redoButton').click();
  click('.instrument-actions button','Save patch');q('#proPatchName').value='Integration test patch';q('#proPatchForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));check(JSON.parse(localStorage.getItem('sonora-user-patches-v1')).some(p=>p.name==='Integration test patch'&&p.synth.mix2===.37),'custom patches save complete sound settings');
  click('#proLibraryModes button','My sounds');check(q('#studioPresetList').textContent.includes('Integration test patch'),'saved patch is discoverable in My sounds');click('#proLibraryModes button','All');
  if(q('button[aria-label="Favorite Glass Keys"]').getAttribute('aria-pressed')!=='true')q('button[aria-label="Favorite Glass Keys"]').click();click('#proLibraryModes button','Favorites');check(q('#studioPresetList').textContent.includes('Glass Keys'),'favorites filter works');click('#proLibraryModes button','All');
  const blobs=[],originalURL=URL.createObjectURL,originalClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{blobs.push(b);return originalURL.call(URL,b);};HTMLAnchorElement.prototype.click=function(){};
  try{
    q('#downloadProjectButton').click();await sleep(300);const bundle=JSON.parse(await blobs.at(-1).text());check(bundle.project.tracks[0].synth.fmAmount===.65,'portable project includes new synth settings');
    const file=new File([JSON.stringify(bundle)],'Pro roundtrip.sonora',{type:'application/json'}),dt=new DataTransfer();dt.items.add(file);q('#projectFileInput').files=dt.files;q('#projectFileInput').dispatchEvent(new Event('change',{bubbles:true}));await sleep(400);check(save().tracks[0].synth.mix2===.37&&save().tracks[0].synth.lfoFilter===.2,'project round trip preserves layered synthesis and modulation');
    q('#exportWavButton').click();for(let i=0;i<40&&q('#exportWavButton').disabled;i++)await sleep(150);const wav=blobs.at(-1);check(wav.type==='audio/wav','custom instrument renders to WAV');const data=new DataView(await wav.arrayBuffer());let peak=0;for(let i=44;i<data.byteLength;i+=200)peak=Math.max(peak,Math.abs(data.getInt16(i,true)));check(peak>100,'custom instrument export contains audible samples');
  }finally{URL.createObjectURL=originalURL;HTMLAnchorElement.prototype.click=originalClick;}
  q('button[aria-label="Add drum track"]').click();tab('Instrument');change('input[aria-label="Kick tune"]',5);change('input[aria-label="Snare decay"]',1.5);p=save();const drum=p.tracks.find(t=>t.id===p.selectedTrack);check(drum.drumParams.kick.tune===5&&drum.drumParams.snare.decay===1.5,'drum tuning and envelopes persist per voice');
  q('#stopButton').click();return results;
})()
