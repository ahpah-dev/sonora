(async()=>{
  const q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
  const check=(ok,label)=>{if(!ok)throw Error(label);results.push('PASS '+label);};
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text).click();
  const save=()=>{q('#saveButton').click();return JSON.parse(localStorage.getItem('sonora-daw-project-v1'));};
  q('#stopButton').click();if(q('#recordButton').classList.contains('active'))q('#recordButton').click();button('New');button('Add clip');
  q('[data-tab="perform"]').click();q('#pianoSound').value='Studio Grand';q('#pianoSound').dispatchEvent(new Event('change',{bubbles:true}));q('[data-tab="piano"]').click();
  q('#snapSelect').value='0';q('#snapSelect').dispatchEvent(new Event('change',{bubbles:true}));
  const input={id:'latency-test',name:'Latency test',type:'input',state:'connected'},access={inputs:new Map([['latency-test',input]]),onstatechange:null};
  const original=navigator.requestMIDIAccess,start=OscillatorNode.prototype.start,report={durations:[],synchronousVoices:0};
  Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>access,configurable:true});
  let starts=0;OscillatorNode.prototype.start=function(...args){starts++;return start.apply(this,args);};
  const library=q('#studioPresetList'),roll=q('#pianoRoll'),observer=new MutationObserver(()=>{});observer.observe(library,{childList:true});
  try{
    button('Connect MIDI');await sleep(80);q('#recordButton').click();q('#playButton').click();await sleep(120);
    const before=starts,onset=performance.now();
    for(const pitch of [60,64,67]){const t=performance.now();input.onmidimessage({data:[0x90,pitch,100],timeStamp:onset});report.durations.push(performance.now()-t);}
    report.synchronousVoices=starts-before;report.libraryRebuilds=observer.takeRecords().length;report.rollPreserved=roll===q('#pianoRoll');
    await sleep(350);report.echoVoices=starts-before-report.synchronousVoices;
    // Simulate queued delivery: note times must reflect MIDI receipt, not handler delivery.
    for(const pitch of [60,64,67])input.onmidimessage({data:[0x80,pitch,0],timeStamp:onset+300});
    q('#stopButton').click();await sleep(50);const recorded=save().tracks[0].clips[0].notes;
    report.recorded=recorded.map(n=>({start:n.start,duration:n.duration}));
    window.sonoraMidiReport=report;
    check(report.synchronousVoices===24,'three piano voices start synchronously in MIDI handlers');
    check(report.libraryRebuilds===0&&report.rollPreserved,'MIDI recording preserves the sound library and piano grid');
    check(report.echoVoices===0,'transport does not echo newly recorded live notes');
    check(recorded.length===3&&recorded.every(n=>Math.abs(n.duration-.3*112/60)<.001),'MIDI timestamps preserve held duration despite delayed delivery');
    check(Math.max(...recorded.map(n=>n.start))-Math.min(...recorded.map(n=>n.start))<.001,'simultaneous MIDI notes retain the same onset');
    q('#undoButton').click();check(save().tracks[0].clips[0].notes.length===0,'polyphonic MIDI recording undoes as one gesture');
    q('#redoButton').click();check(save().tracks[0].clips[0].notes.length===3,'polyphonic MIDI recording supports redo');
    q('#clearPatternButton').click();const burstRoll=q('#pianoRoll');q('#playButton').click();await sleep(100);
    const burst=[];for(let i=0;i<24;i++){const pitch=48+i%24,t=performance.now();input.onmidimessage({data:[0x90,pitch,90],timeStamp:t-100});input.onmidimessage({data:[0x80,pitch,0],timeStamp:t-20});burst.push(performance.now()-t);}
    q('#stopButton').click();await sleep(50);check(save().tracks[0].clips[0].notes.length===24,'rapid MIDI events record without losing notes');
    check(burstRoll===q('#pianoRoll'),'rapid recording retains the piano grid DOM');
    report.burstMaxMs=Math.max(...burst);report.burstAverageMs=burst.reduce((a,b)=>a+b,0)/burst.length;
    q('#clearPatternButton').click();q('#playButton').click();await sleep(100);
    const heldAt=performance.now();input.onmidimessage({data:[0x90,72,100],timeStamp:heldAt});await sleep(150);q('#stopButton').click();
    check(save().tracks[0].clips[0].notes[0].duration>.15,'stopping transport finalizes a held MIDI note');
    const replayBefore=starts;q('#playButton').click();await sleep(350);q('#stopButton').click();check(starts-replayBefore===8,'recorded notes play normally on the next transport pass');
    q('#clearPatternButton').click();q('#tempoInput').value='240';q('#tempoInput').dispatchEvent(new Event('change',{bubbles:true}));
    q('#playButton').click();await sleep(100);const loopBefore=starts;input.onmidimessage({data:[0x90,60,100],timeStamp:performance.now()});await sleep(100);input.onmidimessage({data:[0x90,60,0],timeStamp:performance.now()});
    await sleep(8150);q('#stopButton').click();check(starts-loopBefore===16,'loop playback repeats the recording without doubling its first pass');
    button('New');button('Add clip');[...document.querySelectorAll('.preset-card strong')].find(n=>n.textContent==='Pocket Kit').closest('button').click();q('[data-tab="drums"]').click();q('#clearPatternButton').click();
    const drumRow=q('.drum-row');q('#playButton').click();await sleep(100);const drumBefore=starts;input.onmidimessage({data:[0x99,36,110],timeStamp:performance.now()});
    check(starts-drumBefore===1,'recorded MIDI drums start synchronously');await sleep(60);q('#stopButton').click();
    check(drumRow===q('.drum-row')&&q('.drum-row .step.active'),'MIDI drum recording updates steps without rebuilding the editor');
    check(save().tracks.find(t=>t.type==='drums').clips[0].steps.kick.length===1,'MIDI drum hits persist in the pattern');q('#undoButton').click();check(save().tracks.find(t=>t.type==='drums').clips[0].steps.kick.length===0,'MIDI drum recording supports undo');
    return {results,report};
  }finally{q('#stopButton').click();observer.disconnect();OscillatorNode.prototype.start=start;Object.defineProperty(navigator,'requestMIDIAccess',{value:original,configurable:true});}
})();
