      // Studio extension: integrated with the existing project, history and audio engine.
      const studioPreferencesKey = 'sonora-studio-preferences-v2';
      let studioPrefs = { theme:'carbon', accent:'#c1f280', density:76, browser:true, inspector:true, editor:true, sampleRate:44100 };
      try { studioPrefs = {...studioPrefs,...JSON.parse(localStorage.getItem(studioPreferencesKey)||'{}')}; } catch (_) {}
      const studioChannels = new Map(), studioSources = new Set();
      let studioMasterMeter = null, studioPresetCategory='All', microphoneTake=null, microphonePending=false, playbackPending=false;
      project.swing = clamp(finiteNumber(project.swing,0),0,.6);
      function studioSampleIds(snapshot=project) { return [...new Set(snapshot.tracks.flatMap(t=>[t.sampleId,...t.clips.map(c=>c.sampleId)]).filter(Boolean))]; }
      function studioEdit(action, rerender=true) {
        const before=JSON.stringify(project); action(); pushUndoSnapshot(before); setDirty();
        if(rerender){renderTracks();renderArrangement();renderEditor();} syncAudioMix();
      }
      function studioApplyPreferences() {
        document.body.dataset.theme=studioPrefs.theme;
        document.documentElement.style.setProperty('--mint',studioPrefs.accent);
        document.documentElement.style.setProperty('--mint-strong',studioPrefs.accent);
        document.documentElement.style.setProperty('--track-height',`${studioPrefs.density}px`);
        for(const panel of ['browser','inspector','editor']) $('.app').classList.toggle(`studio-hidden-${panel}`,!studioPrefs[panel]);
        try{localStorage.setItem(studioPreferencesKey,JSON.stringify(studioPrefs));}catch(_){}
      }
      function studioButton(label,action,cls='text-button') { const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',action);return b; }
      function studioField(parent,label,control,output) { const row=document.createElement('label');row.className='studio-field';const text=document.createElement('span');text.textContent=label;row.append(text,control);if(output)row.append(output);parent.append(row);return row; }
      function studioRange(parent,label,value,min,max,step,onChange,format=v=>String(v)) {
        const input=document.createElement('input'),out=document.createElement('output');input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;input.setAttribute('aria-label',label);out.textContent=format(Number(value));
        let before=null;input.addEventListener('pointerdown',()=>before=JSON.stringify(project));input.addEventListener('focus',()=>before=JSON.stringify(project));
        input.addEventListener('input',()=>{before??=JSON.stringify(project);onChange(Number(input.value));out.textContent=format(Number(input.value));syncAudioMix();setDirty();});
        input.addEventListener('change',()=>{if(before)pushUndoSnapshot(before);before=null;renderArrangement();});studioField(parent,label,input,out);return input;
      }
      function studioRenderBrowser() {
        const list=$('#studioPresetList');if(!list)return;list.replaceChildren();const query=$('#studioPresetSearch').value.toLowerCase();
        const presets=[...SYNTH_PRESETS.map(p=>({...p,kind:'synth'})),...DRUM_KITS.map(p=>({...p,category:'Drums',kind:'drums'}))];
        const matched=presets.filter(p=>(studioPresetCategory==='All'||p.category===studioPresetCategory)&&`${p.name} ${p.category} ${p.description}`.toLowerCase().includes(query));
        matched.forEach(p=>{const b=studioButton('',()=>{
          let track=getTrack();
          if(p.kind==='drums'&&track.type!=='drums'){addDrumTrack();track=getTrack();}
          if(p.kind==='synth'&&track.type!=='synth'){addTrack();track=getTrack();}
          studioEdit(()=>{track.instrument=p.name;if(p.kind==='synth'){track.synth=clone(p.synth);track.waveform=p.synth.waveform;delete track.sampleId;}else track.drumKit=p.name;});notify(`${p.name} loaded`);
        },'preset-card');const symbol=document.createElement('span');symbol.className='preset-symbol';symbol.textContent=p.kind==='drums'?'▦':'♫';const copy=document.createElement('span'),name=document.createElement('strong'),kind=document.createElement('small');name.textContent=p.name;kind.textContent=`${p.category} · ${p.kind==='drums'?'drum kit':'synth'}`;copy.append(name,kind);b.append(symbol,copy);list.append(b);});
        if(!matched.length){const empty=document.createElement('p');empty.className='studio-note';empty.textContent='No sounds match your search.';list.append(empty);}
      }
      function studioRenderInspector() {
        const panel=$('#studioInspector');if(!panel)return;panel.replaceChildren();const track=getTrack(),clip=selectedClipFor(track);
        const over=document.createElement('div');over.className='inspector-overline';over.textContent='CHANNEL INSPECTOR';const name=document.createElement('h3');name.className='inspector-name';name.textContent=track.name;name.style.color=track.color;
        const kind=document.createElement('div');kind.className='inspector-kind';kind.textContent=track.type==='audio'?'Audio track · stereo':`${track.instrument} · ${track.type==='drums'?'Drum machine':'Instrument'}`;panel.append(over,name,kind);
        studioRange(panel,'Volume',track.volume,0,1,.01,v=>{track.volume=v;const row=trackListEl.querySelector(`[data-track="${track.id}"] input`);if(row)row.value=v;},v=>v?`${(20*Math.log10(v)).toFixed(1)} dB`:'−∞');
        studioRange(panel,'Pan',track.pan||0,-1,1,.01,v=>track.pan=v,v=>Math.abs(v)<.01?'C':`${Math.round(Math.abs(v)*100)}${v<0?'L':'R'}`);
        const color=document.createElement('input');color.type='color';color.value=/^#[0-9a-f]{6}$/i.test(track.color)?track.color:'#82a9ff';color.setAttribute('aria-label','Track color');color.addEventListener('change',()=>studioEdit(()=>track.color=color.value));studioField(panel,'Track color',color);
        const actions=document.createElement('div');actions.className='inspector-actions';actions.append(studioButton('Rename',()=>openRename(track,'track')),studioButton('Duplicate',()=>duplicateTrack(track)),studioButton('↑',()=>moveTrack(track,-1)),studioButton('↓',()=>moveTrack(track,1)));panel.append(actions);
        const section=document.createElement('div');section.className='inspector-section';section.innerHTML='<h4>Selected clip</h4>';panel.append(section);
        if(clip){const clipName=document.createElement('div');clipName.className='fx-summary';clipName.textContent=clip.name;section.append(clipName);
          for(const [key,label] of [['start','Start · beats'],['length','Length · beats']]){const input=document.createElement('input');input.type='number';input.min=key==='start'?0:.25;input.max=4096;input.step=.25;input.value=Number(clip[key].toFixed(3));input.setAttribute('aria-label',label);input.addEventListener('change',()=>studioEdit(()=>clip[key]=clamp(finiteNumber(input.value,clip[key]),Number(input.min),4096)));studioField(section,label,input);}
          const ca=document.createElement('div');ca.className='inspector-actions';ca.append(studioButton('Duplicate',duplicateSelectedClip),studioButton('Rename',()=>openRename(clip,'clip')));if(track.type==='audio')ca.append(studioButton('Split at cursor',studioSplitAudio));section.append(ca);
        }else{const hint=document.createElement('p');hint.className='studio-note';hint.textContent='Select a clip in the timeline to edit it.';section.append(hint);}
        const fx=document.createElement('div');fx.className='inspector-section';fx.innerHTML='<h4>Effect chain</h4>';panel.append(fx);
        for(const effect of track.effects||[]){const item=document.createElement('div');item.className='fx-summary';item.textContent=`${effect.enabled?'●':'○'} ${FX_LIBRARY[effect.type]?.name||effect.type}`;fx.append(item);}
        if(!track.effects?.length){const hint=document.createElement('p');hint.className='studio-note';hint.textContent='Shape your sound with EQ, compression, reverb and more.';fx.append(hint);}
        fx.append(studioButton('Edit effects →',()=>{editorTab='fx';studioPrefs.editor=true;studioApplyPreferences();renderEditor();}));
        const groove=document.createElement('div');groove.className='inspector-section';groove.innerHTML='<h4>Project groove</h4>';studioRange(groove,'Swing',project.swing||0,0,.6,.01,v=>project.swing=v,v=>`${Math.round(v*100)}%`);panel.append(groove);
      }
      function studioNewProject(demo=false) {
        if(microphoneTake||microphonePending){notify('Finish the recording first');return;}
        stopPlayback(true);const before=JSON.stringify(project);const next=demo?demoProject():defaultProject();
        editorTab='piano';restoreProjectSnapshot(JSON.stringify(next));pushUndoSnapshot(before);notify(demo?'Demo session loaded · undo to restore':'New session · undo restores your previous project');
      }
      function studioAddAudioTrack() {
        if(project.tracks.length>=64){notify('Projects support up to 64 tracks');return null;}
        const track={id:`audio-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,name:`Audio ${project.tracks.filter(t=>t.type==='audio').length+1}`,type:'audio',instrument:'Audio clips',color:'#65d9cf',volume:.8,pan:0,mute:false,solo:false,effects:[],clips:[]};
        studioEdit(()=>{project.tracks.push(track);project.selectedTrack=track.id;project.selectedClip=null;editorTab='audio';});return track;
      }
      function studioWavePeaks(buffer, count=150) {
        const peaks=[],data=buffer.getChannelData(0),stride=Math.max(1,Math.floor(data.length/count));
        for(let i=0;i<count;i++){let peak=0;const end=Math.min(data.length,(i+1)*stride);for(let n=i*stride;n<end;n+=Math.max(1,Math.floor(stride/300)))peak=Math.max(peak,Math.abs(data[n]));peaks.push(Number(peak.toFixed(4)));}return peaks;
      }
      async function studioImportAudio(file, targetId=null, atBeat=audio.playheadBeat) {
        if(!file)return; if(file.size>120*1024*1024){notify('Choose an audio file smaller than 120 MB');return;}
        try{
          notify('Decoding audio…');await audioReady();if(!audio.context)throw new Error('Web Audio is unavailable');const bytes=await file.arrayBuffer(),buffer=await audio.context.decodeAudioData(bytes.slice(0));
          if(buffer.duration>1800)throw new Error('Choose an audio file shorter than 30 minutes');
          const record=await saveImportedInstrument(file,bytes);importedInstrumentBuffers.set(record.id,buffer);
          let track=project.tracks.find(t=>t.id===targetId&&t.type==='audio');const before=JSON.stringify(project);
          if(!track){if(project.tracks.length>=64)throw new Error('Projects support up to 64 tracks');track={id:`audio-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,name:record.name,type:'audio',instrument:'Audio clips',color:'#65d9cf',volume:.8,pan:0,mute:false,solo:false,effects:[],clips:[]};project.tracks.push(track);}
          const clip={id:`clip-${record.id}`,name:record.name,start:Math.max(0,atBeat),length:buffer.duration*project.tempo/60,sampleId:record.id,sourceDuration:buffer.duration,offset:0,gain:1,fadeIn:0,fadeOut:0,peaks:studioWavePeaks(buffer)};
          track.clips.push(clip);project.selectedTrack=track.id;project.selectedClip=clip.id;editorTab='audio';syncAudioMix();renderTracks();renderArrangement();renderEditor();pushUndoSnapshot(before);setDirty();
          notify(record.persisted?'Audio added and saved locally':'Audio added for this session · download the project to keep it');
        }catch(error){notify(error.message?.includes('Choose')||error.message?.includes('support')?error.message:'Could not decode this audio file');}
      }
      function studioStopSources(){for(const source of studioSources){try{source.stop();}catch(_){}}studioSources.clear();releaseAllLiveNotes();}
      function studioAudioVoice(ctx,output,clip,time,elapsed=0,live=false,tempo=project.tempo) {
        const buffer=importedInstrumentBuffers.get(clip.sampleId);if(!buffer)return;const spb=60/tempo,total=clip.length*spb,offset=(clip.offset||0)+elapsed;
        const duration=Math.min(total-elapsed,buffer.duration-offset);if(duration<=0)return;
        const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.connect(gain);gain.connect(output);
        const level=clamp(finiteNumber(clip.gain,1),0,2),fadeIn=Math.min(clip.fadeIn||0,total/2),fadeOut=Math.min(clip.fadeOut||0,total/2);
        gain.gain.setValueAtTime(level*(fadeIn&&elapsed<fadeIn?elapsed/fadeIn:1),time);
        if(fadeIn>elapsed)gain.gain.linearRampToValueAtTime(level,time+Math.min(duration,fadeIn-elapsed));
        if(fadeOut){const remaining=total-elapsed;if(remaining>fadeOut){gain.gain.setValueAtTime(level,time+Math.max(0,duration-fadeOut));gain.gain.linearRampToValueAtTime(0,time+duration);}else{gain.gain.setValueAtTime(level*remaining/fadeOut,time);gain.gain.linearRampToValueAtTime(0,time+duration);}}
        source.start(time,offset,duration);source.onended=()=>{studioSources.delete(source);source.disconnect();gain.disconnect();};if(live)studioSources.add(source);return source;
      }
      function studioAutomationValue(track,beat) {
        const points=track.automation||[];if(!points.length)return 1;const sorted=[...points].sort((a,b)=>a.beat-b.beat);if(beat<=sorted[0].beat)return sorted[0].value;
        for(let i=1;i<sorted.length;i++){const a=sorted[i-1],b=sorted[i];if(beat<=b.beat)return a.value+(b.value-a.value)*(beat-a.beat)/Math.max(.001,b.beat-a.beat);}return sorted.at(-1).value;
      }
      function studioRenderAutomation(track) {
        const panel=document.createElement('div');panel.className='automation-editor';const head=document.createElement('div');head.className='automation-head';head.innerHTML='<span>Volume automation <small>· relative to channel fader</small></span>';head.append(studioButton('Reset',()=>studioEdit(()=>track.automation=[])));panel.append(head);
        const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('automation-svg');svg.setAttribute('viewBox','0 0 1000 160');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-label','Volume automation curve');
        const points=track.automation||[],visible=arrangementBeats();
        const path=document.createElementNS(ns,'path'),samples=[{beat:0,value:studioAutomationValue(track,0)},...points,{beat:visible,value:studioAutomationValue(track,visible)}].sort((a,b)=>a.beat-b.beat);
        path.setAttribute('d',samples.map((p,i)=>`${i?'L':'M'}${p.beat/visible*1000} ${150-p.value*140}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke',track.color);path.setAttribute('stroke-width','2');svg.append(path);
        points.forEach((p,i)=>{const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',p.beat/visible*1000);circle.setAttribute('cy',150-p.value*140);circle.setAttribute('r','6');circle.setAttribute('fill',track.color);circle.dataset.index=i;svg.append(circle);});
        let drag=null,before=null;const locate=e=>{const r=svg.getBoundingClientRect(),snap=Number($('#snapSelect').value)||.01;return {beat:clamp(Math.round((e.clientX-r.left)/r.width*visible/snap)*snap,0,visible),value:clamp((150-(e.clientY-r.top)/r.height*160)/140,0,1)};};
        svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;before=JSON.stringify(project);track.automation||=[];const i=e.target.dataset.index;const p=locate(e);if(i!==undefined)drag=track.automation[Number(i)];else{drag=p;track.automation.push(drag);}svg.setPointerCapture(e.pointerId);draw();});
        function draw(){const sorted=[{beat:0,value:studioAutomationValue(track,0)},...track.automation,{beat:visible,value:studioAutomationValue(track,visible)}].sort((a,b)=>a.beat-b.beat);path.setAttribute('d',sorted.map((p,i)=>`${i?'L':'M'}${p.beat/visible*1000} ${150-p.value*140}`).join(' '));svg.querySelectorAll('circle').forEach(c=>c.remove());track.automation.forEach((p,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p.beat/visible*1000);c.setAttribute('cy',150-p.value*140);c.setAttribute('r',6);c.setAttribute('fill',track.color);c.dataset.index=i;svg.append(c);});}
        svg.addEventListener('pointermove',e=>{if(drag){Object.assign(drag,locate(e));draw();}});const finish=()=>{if(before){track.automation.sort((a,b)=>a.beat-b.beat);track.automation=track.automation.filter((p,i,a)=>i===a.length-1||p.beat!==a[i+1].beat);pushUndoSnapshot(before);setDirty();}drag=null;before=null;};svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',()=>{if(before){const old=JSON.parse(before).tracks.find(t=>t.id===track.id);track.automation=old.automation||[];draw();}drag=null;before=null;});
        svg.addEventListener('contextmenu',e=>{e.preventDefault();const i=e.target.dataset.index;if(i!==undefined)studioEdit(()=>track.automation.splice(Number(i),1));});panel.append(svg);const hint=document.createElement('p');hint.className='studio-note';hint.textContent='Click to add points. Drag to shape the curve. Right-click a point to delete it. Automation loops with the arrangement and is included in WAV export.';panel.append(hint);editorBodyEl.append(panel);
      }
      function studioSplitAudio() {
        const track=getTrack(),clip=selectedClipFor(track),cut=audio.playheadBeat;if(track.type!=='audio'||!clip||cut<=clip.start+.01||cut>=clip.start+clip.length-.01){notify('Place the cursor inside an audio clip to split it');return;}
        studioEdit(()=>{const left=cut-clip.start,right={...clone(clip),id:`split-${Date.now()}`,start:cut,length:clip.length-left,offset:(clip.offset||0)+left*60/project.tempo,fadeIn:0};clip.length=left;clip.fadeOut=0;track.clips.push(right);project.selectedClip=right.id;});notify('Audio clip split');
      }
      function studioRenderAudio(track,clip) {
        $('#noteToolbar').style.display='none';$('#noteLength').style.display='none';$('#clearPatternButton').style.display='none';
        if(track.type!=='audio'){const empty=document.createElement('div');empty.className='audio-empty';empty.innerHTML='<strong>Bring your audio into the session</strong><p>Import a vocal, loop or recording as an audio track.</p>';empty.append(studioButton('Import audio',()=>$('#studioAudioInput').click()),studioButton('Add audio track',studioAddAudioTrack));editorBodyEl.append(empty);return;}
        if(!clip){const empty=document.createElement('div');empty.className='audio-empty';empty.innerHTML='<strong>Your next take starts here</strong><p>Drop an audio file into this lane, or record your microphone.</p>';empty.append(studioButton('Import audio',()=>$('#studioAudioInput').click()),studioButton(microphoneTake?'Stop recording':'Record microphone',studioToggleMicrophone));editorBodyEl.append(empty);return;}
        const panel=document.createElement('div');panel.className='audio-editor';const head=document.createElement('div');head.className='audio-editor-head';const title=document.createElement('strong');title.textContent=clip.name;const info=document.createElement('span');info.className='studio-note';info.textContent=`${(clip.sourceDuration||0).toFixed(2)}s source · ${clipLengthLabel(Number(clip.length.toFixed(2)))}`;head.append(title,info,studioButton('Split at cursor',studioSplitAudio));panel.append(head);
        const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=150;canvas.setAttribute('aria-label','Audio clip waveform');panel.append(canvas);const ctx=canvas.getContext('2d');ctx.strokeStyle=track.color;ctx.lineWidth=2;const peaks=clip.peaks||[],sourceDuration=clip.sourceDuration||clip.length*60/project.tempo,begin=(clip.offset||0)/sourceDuration,portion=clip.length*60/project.tempo/sourceDuration;
        for(let x=0;x<1200;x+=4){const i=Math.floor((begin+x/1200*portion)*peaks.length),amp=(peaks[i]||0)*65;ctx.beginPath();ctx.moveTo(x,75-amp);ctx.lineTo(x,75+amp);ctx.stroke();}
        const controls=document.createElement('div');controls.className='audio-editor-controls';const trim=document.createElement('input');trim.type='number';trim.min=0;trim.max=Math.max(0,(clip.sourceDuration||0)-.01);trim.step=.01;trim.value=clip.offset||0;trim.setAttribute('aria-label','Source offset seconds');trim.addEventListener('change',()=>studioEdit(()=>{clip.offset=clamp(finiteNumber(trim.value,0),0,Number(trim.max));clip.length=Math.min(clip.length,((clip.sourceDuration||0)-clip.offset)*project.tempo/60);}));studioField(controls,'Source offset (s)',trim);
        studioRange(controls,'Clip gain',clip.gain??1,0,2,.01,v=>clip.gain=v,v=>`${Math.round(v*100)}%`);studioRange(controls,'Fade in',clip.fadeIn||0,0,3,.01,v=>clip.fadeIn=v,v=>`${v.toFixed(2)}s`);studioRange(controls,'Fade out',clip.fadeOut||0,0,3,.01,v=>clip.fadeOut=v,v=>`${v.toFixed(2)}s`);panel.append(controls);editorBodyEl.append(panel);
      }
      async function studioToggleMicrophone() {
        if(microphonePending){notify('Waiting for microphone access');return;}
        if(microphoneTake){microphoneTake.recorder.stop();return;}
        if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('Microphone recording requires Chrome or Edge on localhost or HTTPS');return;}
        microphonePending=true;$('#studioRecordMic').disabled=true;let stream=null;
        try{
          stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});await audioReady();
          const track=getTrack(),targetId=track.type==='audio'?track.id:null,startBeat=audio.playheadBeat,tempo=project.tempo,chunks=[];
          const recorder=new MediaRecorder(stream);microphoneTake={recorder,stream,startBeat,tempo,targetId,started:performance.now(),wasPlaying:audio.playing};
          recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{
            const take=microphoneTake;microphoneTake=null;stream.getTracks().forEach(t=>t.stop());$('#studioRecordMic').classList.remove('recording-live');$('#studioRecordMic').textContent='Record mic';stopPlayback(false);
            const blob=new Blob(chunks,{type:recorder.mimeType});await studioImportAudio(new File([blob],`Take ${new Date().toLocaleTimeString().replace(/:/g,'-')}.webm`,{type:recorder.mimeType}),take.targetId,take.startBeat);
          };recorder.onerror=()=>{stream.getTracks().forEach(t=>t.stop());microphoneTake=null;$('#studioRecordMic').classList.remove('recording-live');$('#studioRecordMic').textContent='Record mic';notify('Microphone recording failed');};
          recorder.start(100);$('#studioRecordMic').textContent='Stop take';$('#studioRecordMic').classList.add('recording-live');if(!audio.playing)await startPlayback();notify('Recording microphone · press Stop take to finish');
        }catch(error){stream?.getTracks().forEach(t=>t.stop());notify(error.name==='NotAllowedError'?'Microphone access was declined':'Could not start microphone recording');}
        finally{microphonePending=false;$('#studioRecordMic').disabled=false;}
      }
      function studioGeneratePattern() {
        const track=getTrack();if(track.type==='audio'){notify('Select an instrument or drum track to generate a pattern');return;}
        studioEdit(()=>{let clip=selectedClipFor(track);if(!clip){clip=makeEmptyClip(track,0);track.clips.push(clip);project.selectedClip=clip.id;}
          if(track.type==='drums'){clip.steps={kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],openHat:[6,14],clap:[],tom:[],rim:[]};editorTab='drums';}
          else{const root=Number($('#studioRoot').value),mode=$('#studioGenerator').value;clip.notes=[];const chords=[[0,3,7],[8,12,15],[3,7,10],[10,14,17]];chords.forEach((chord,bar)=>{if(mode==='chords')chord.forEach(n=>clip.notes.push({start:bar*4,pitch:root+n,duration:3.75,velocity:.7}));else for(let i=0;i<8;i++)clip.notes.push({start:bar*4+i*.5,pitch:root+chord[i%3],duration:.4,velocity:i%2?.65:.82});});editorTab='piano';}
        });notify('Pattern generated · undo to restore');
      }
      function studioBuildUI() {
        const browser=document.createElement('aside');browser.className='studio-browser';browser.setAttribute('aria-label','Sound library');browser.innerHTML='<div class="browser-title"><strong>SOUND LIBRARY</strong><small>LOCAL</small></div><input class="browser-search" id="studioPresetSearch" placeholder="Search sounds…" aria-label="Search sounds"><div class="browser-categories" id="studioCategories"></div><div class="browser-presets" id="studioPresetList"></div><div class="browser-bottom"><button class="text-button" id="studioBrowserImport">＋ Import audio</button><p>Make it yours. Add recordings, loops and samples to your session.</p></div>';
        $('.workarea').prepend(browser);const inspector=document.createElement('aside');inspector.className='studio-inspector';inspector.id='studioInspector';inspector.setAttribute('aria-label','Track inspector');$('.workarea').append(inspector);
        const categories=['All','Keys','Bass','Leads','Pads','Plucks','Organ','Textures','Drums'];categories.forEach(c=>{const b=studioButton(c,()=>{studioPresetCategory=c;$('#studioCategories').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.textContent===c));studioRenderBrowser();},c==='All'?'active':'');$('#studioCategories').append(b);});$('#studioPresetSearch').addEventListener('input',studioRenderBrowser);
        const input=document.createElement('input');input.type='file';input.accept='audio/*,.wav,.mp3,.flac,.ogg,.m4a';input.id='studioAudioInput';input.hidden=true;input.multiple=true;document.body.append(input);input.addEventListener('change',async()=>{const id=getTrack().type==='audio'?getTrack().id:null,beat=audio.playheadBeat;for(const file of input.files)await studioImportAudio(file,id,beat);input.value='';});
        $('#studioBrowserImport').addEventListener('click',()=>input.click());
        const tag=document.createElement('span');tag.className='studio-tag';tag.textContent='STUDIO 2';$('.brand-area').append(tag);
        const mic=studioButton('Record mic',studioToggleMicrophone);mic.id='studioRecordMic';mic.title='Record audio from your microphone';$('.workspace-controls').append(mic);
        const newButton=studioButton('New',()=>studioNewProject(false));$('.workspace-controls').insertBefore(newButton,$('#openProjectButton'));
        const prefs=studioButton('⚙',()=>$('#studioSettings').showModal(),'icon-button');prefs.setAttribute('aria-label','Studio settings');prefs.title='Customize studio';$('.top-actions').append(prefs);
        const help=studioButton('?',()=>$('#studioHelp').showModal(),'icon-button');help.setAttribute('aria-label','Keyboard shortcuts');$('.top-actions').append(help);
        const audioAdd=studioButton('♫',studioAddAudioTrack,'add-track');audioAdd.setAttribute('aria-label','Add audio track');audioAdd.title='Add audio track';$('.track-add-actions').append(audioAdd);
        for(const [id,label] of [['audio','Audio editor'],['automation','Automation']]){const b=studioButton(label,()=>{editorTab=id;renderEditor();},'editor-tab');b.dataset.tab=id;$('.editor-tabs').append(b);}
        const settings=document.createElement('dialog');settings.id='studioSettings';settings.className='studio-dialog';settings.innerHTML='<h2>Your studio, your way.</h2><p>Choose a palette, tune the workspace and set your export quality. Preferences are saved on this device.</p><div class="theme-swatches" id="studioThemes"></div>';
        settings.append(studioButton('×',()=>settings.close(),'icon-button dialog-close'));document.body.append(settings);
        for(const [theme,label,accent] of [['carbon','Carbon / Lime','#c1f280'],['midnight','Midnight / Blue','#8bafff'],['graphite','Graphite / Amber','#f7b976']]){const b=studioButton(label,()=>{studioPrefs.theme=theme;studioPrefs.accent=accent;studioApplyPreferences();$('#studioAccent').value=accent;$('#studioThemes').querySelectorAll('button').forEach(button=>button.classList.toggle('active',button===b));});b.classList.toggle('active',studioPrefs.theme===theme);$('#studioThemes').append(b);}
        const accent=document.createElement('input');accent.type='color';accent.id='studioAccent';accent.value=studioPrefs.accent;accent.setAttribute('aria-label','Accent color');accent.addEventListener('input',()=>{studioPrefs.accent=accent.value;studioApplyPreferences();});studioField(settings,'Accent color',accent);
        function prefSelect(label,key,items){const select=document.createElement('select');select.setAttribute('aria-label',label);items.forEach(([value,name])=>{const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o);});select.value=studioPrefs[key];select.addEventListener('change',()=>{studioPrefs[key]=Number(select.value);studioApplyPreferences();renderArrangement();});studioField(settings,label,select);}
        prefSelect('Track height','density',[[58,'Compact'],[76,'Comfortable'],[94,'Spacious']]);prefSelect('WAV sample rate','sampleRate',[[44100,'44.1 kHz · 16 bit'],[48000,'48 kHz · 16 bit']]);
        for(const [key,label] of [['browser','Show sound library'],['inspector','Show track inspector'],['editor','Show editor']]){const check=document.createElement('input');check.type='checkbox';check.checked=studioPrefs[key];check.setAttribute('aria-label',label);check.addEventListener('change',()=>{studioPrefs[key]=check.checked;studioApplyPreferences();});studioField(settings,label,check);}
        const hint=document.createElement('p');hint.textContent='The library hides below 1200px and the inspector below 1000px to leave room for the timeline.';settings.append(hint);
        const shortcuts=document.createElement('dialog');shortcuts.id='studioHelp';shortcuts.className='studio-dialog';shortcuts.innerHTML='<h2>A faster creative flow.</h2><p>Space — play / pause<br>Ctrl / Cmd + S — save locally<br>Ctrl / Cmd + Z — undo<br>Ctrl / Cmd + Shift + Z — redo<br>Ctrl / Cmd + C / V — copy / paste<br>Ctrl / Cmd + D — duplicate selection<br>Delete — delete selection<br>F2 — rename clip<br>Arrow keys — move selected notes<br>Shift + ↑ / ↓ — transpose an octave<br>Z–M and Q–I — play the instrument keyboard</p><p>Double-click a lane to add a pattern. Drop audio files onto a lane to import them. Right-click clips, tracks or notes for more actions.</p>';shortcuts.append(studioButton('×',()=>shortcuts.close(),'icon-button dialog-close'));document.body.append(shortcuts);
        const gen=document.createElement('div');gen.className='tool-group';gen.innerHTML='<select id="studioRoot" class="snap-select" aria-label="Pattern root"><option value="48">C minor</option><option value="50">D minor</option><option value="52">E minor</option><option value="55">G minor</option><option value="57">A minor</option></select><select id="studioGenerator" class="snap-select" aria-label="Pattern type"><option value="chords">Chords</option><option value="arp">Arpeggio</option></select>';gen.append(studioButton('Generate',studioGeneratePattern));$('.editor-tools').prepend(gen);
        $('.status-right').firstElementChild.textContent='4/4';$('.status-right').children[1].textContent='LOCAL STUDIO';$('#cpuStatus').textContent='Audio idle';$('.status-left').children[1].id='studioRateStatus';
        $('.status-left').children[0].innerHTML='<i class="status-dot"></i><span id="studioEngineStatus">Audio engine ready</span>';
        $('.arrangement-pane').addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
        $('.arrangement-pane').addEventListener('drop',async e=>{if(!e.dataTransfer.files.length)return;e.preventDefault();const lane=e.target.closest('.arrange-lane'),track=project.tracks.find(t=>t.id===lane?.dataset.track),rect=gridEl.getBoundingClientRect(),snap=Number($('#snapSelect').value)||.25,beat=Math.max(0,Math.round((e.clientX-rect.left)/rect.width*arrangementBeats()/snap)*snap);for(const file of e.dataTransfer.files)await studioImportAudio(file,track?.type==='audio'?track.id:null,beat);});
        studioApplyPreferences();studioRenderBrowser();
      }
      // Wrap renderers so all project changes keep the new workspace in sync.
      const studioBaseTracks=renderTracks;renderTracks=function(){studioBaseTracks();studioRenderInspector();};
      const studioBaseArrangement=renderArrangement;renderArrangement=function(){studioBaseArrangement();studioRenderInspector();};
      const studioBasePreview=clipPreviewMarkup;clipPreviewMarkup=function(track,clip){if(track.type!=='audio')return studioBasePreview(track,clip);const peaks=clip.peaks||[],count=100,total=clip.sourceDuration||1,begin=(clip.offset||0)/total,portion=clip.length*60/project.tempo/total;let lines='';for(let i=0;i<count;i++){const peak=peaks[Math.floor((begin+i/count*portion)*peaks.length)]||0;lines+=`M${i} ${10-peak*9}v${peak*18} `;}return `<svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="${lines}" fill="none" stroke="${/^#[0-9a-f]{6}$/i.test(track.color)?track.color:'#65d9cf'}" stroke-width=".65"/></svg>`;};
      const studioBaseEditor=renderEditor;renderEditor=function(){const track=getTrack();if(track.type==='audio'&&editorTab==='piano')editorTab='audio';if(editorTab!=='audio'&&editorTab!=='automation'){studioBaseEditor();}else{editorBodyEl.replaceChildren();$('#noteToolbar').style.display='none';$('#noteLength').style.display='none';$('#clearPatternButton').style.display='none';document.querySelectorAll('.editor-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===editorTab));$('#editorTrackName').textContent=track.name;if(editorTab==='audio')studioRenderAudio(track,selectedClipFor(track));else studioRenderAutomation(track);updateStatus();}studioRenderInspector();};
      const studioBaseMix=syncAudioMix;syncAudioMix=function(){studioBaseMix();if(!audio.context)return;for(const track of project.tracks){const channel=studioChannels.get(track.id);channel?.pan.pan.setTargetAtTime(clamp(finiteNumber(track.pan,0),-1,1),audio.context.currentTime,.02);}};
      rebuildEffectsRouting=function(){if(!audio.context||!audio.master)return;for(const c of studioChannels.values()){c.pan.disconnect();c.meter.disconnect();}studioChannels.clear();
        for(const track of project.tracks){const channel=audio.trackNodes.get(track.id);if(!channel)continue;
          // Pan and metering sit before the existing effect chain.
          const pan=audio.context.createStereoPanner(),meter=audio.context.createAnalyser();meter.fftSize=256;pan.pan.value=clamp(finiteNumber(track.pan,0),-1,1);
          studioChannels.set(track.id,{pan,meter,data:new Float32Array(256)});
        }
        // Rebuild the complete graph explicitly; no channel is connected twice.
        audio.trackNodes.forEach(n=>n.disconnect());disposeFxStages();const bus=audio.context.createGain();
        for(const track of project.tracks){const gain=audio.trackNodes.get(track.id),c=studioChannels.get(track.id);if(!gain||!c)continue;gain.connect(c.pan);c.pan.connect(c.meter);connectFxChain(audio.context,c.meter,track.effects,track.id,audio.effectStages).connect(bus);}
        connectFxChain(audio.context,bus,project.masterEffects,'master',audio.effectStages).connect(audio.master);
        if(!studioMasterMeter){studioMasterMeter=audio.context.createAnalyser();studioMasterMeter.fftSize=256;audio.master.disconnect();audio.master.connect(studioMasterMeter);studioMasterMeter.connect(audio.context.destination);}
      };
      const studioBaseLoad=loadProjectInstruments;loadProjectInstruments=async function(){await studioBaseLoad();await Promise.all(studioSampleIds().map(id=>ensureImportedInstrument({sampleId:id})));};
      const studioBaseCollect=collectEvents;collectEvents=function(snapshot=project){const events=studioBaseCollect(snapshot).filter(e=>e.track.type!=='audio');for(const e of events){if(Math.round(e.beat*4)%2===1)e.beat+=(snapshot.swing||0)*.25;}return events;};
      const studioBaseScheduler=scheduler;scheduler=function(){studioBaseScheduler();if(!audio.playing||!audio.context)return;const ctx=audio.context,spb=60/project.tempo,current=audio.startedAtBeat+(ctx.currentTime-audio.startTime)/spb,len=arrangementBeats(),cycle=project.loop?Math.max(0,Math.floor(current/len)):0;
        for(const track of project.tracks){const hasSolo=project.tracks.some(t=>t.solo),audible=!track.mute&&(!hasSolo||track.solo);audio.trackNodes.get(track.id)?.gain.setTargetAtTime(audible?track.volume*studioAutomationValue(track,((current%len)+len)%len):0,ctx.currentTime,.008);
          if(track.type!=='audio')continue;for(let loop=cycle;loop<=cycle+(project.loop?1:0);loop++)for(const clip of track.clips){const absolute=loop*len+clip.start,key=`audio:${loop}:${clip.id}`,time=audio.startTime+(absolute-audio.startedAtBeat)*spb;if(audio.scheduled.has(key)||time>ctx.currentTime+.12)continue;const elapsed=Math.max(0,ctx.currentTime-time);if(elapsed>=clip.length*spb)continue;audio.scheduled.add(key);studioAudioVoice(ctx,audio.trackNodes.get(track.id),clip,Math.max(time,ctx.currentTime),elapsed,true);}}
      };
      const studioBaseStart=startPlayback;startPlayback=async function(){if(audio.playing||playbackPending)return;playbackPending=true;try{await studioBaseStart();}finally{playbackPending=false;}};
      const studioBaseStop=stopPlayback;stopPlayback=function(reset=true){studioStopSources();studioBaseStop(reset);if(microphoneTake?.recorder.state==='recording')microphoneTake.recorder.stop();};
      const studioBaseSeek=seekToBeat;seekToBeat=function(beat){studioStopSources();return studioBaseSeek(beat);};
      const studioBaseSound=openSoundBrowser;openSoundBrowser=function(){if(getTrack().type==='audio'){editorTab='audio';renderEditor();return;}studioBaseSound();};
      const studioBaseEmpty=makeEmptyClip;makeEmptyClip=function(track,start,length=16,name){if(track.type==='audio'){notify('Import audio or record into this track');return {id:`empty-${Date.now()}`,name:name||'Empty audio region',start,length,peaks:[]};}return studioBaseEmpty(track,start,length,name);};
      const studioBaseNormalize=normalizeProjectFile;normalizeProjectFile=function(raw){const next=studioBaseNormalize(raw);next.swing=clamp(finiteNumber(raw.swing,0),0,.6);next.tracks.forEach((t,i)=>{const source=raw.tracks[i];t.pan=clamp(finiteNumber(source.pan,0),-1,1);t.automation=(Array.isArray(source.automation)?source.automation:[]).slice(0,2048).filter(p=>p&&Number.isFinite(Number(p.beat))&&Number.isFinite(Number(p.value))).map(p=>({beat:clamp(Number(p.beat),0,4096),value:clamp(Number(p.value),0,1)})).sort((a,b)=>a.beat-b.beat);if(t.type==='audio')t.clips.forEach((c,j)=>{const original=source.clips[j];c.sampleId=original.sampleId?String(original.sampleId):undefined;c.sourceDuration=clamp(finiteNumber(original.sourceDuration,0),0,1800);c.offset=clamp(finiteNumber(original.offset,0),0,c.sourceDuration);c.gain=clamp(finiteNumber(original.gain,1),0,2);c.fadeIn=clamp(finiteNumber(original.fadeIn,0),0,3);c.fadeOut=clamp(finiteNumber(original.fadeOut,0),0,3);c.peaks=(Array.isArray(original.peaks)?original.peaks:[]).slice(0,1000).map(v=>clamp(finiteNumber(v,0),0,1));});});return next;};
      function studioTrackSource(source){studioSources.add(source);source.addEventListener('ended',()=>studioSources.delete(source),{once:true});return source;}
      // Saving after import happens through the existing debounced project autosave.
      $('#tempoInput').addEventListener('change',event=>{if(microphoneTake){event.stopImmediatePropagation();event.target.value=microphoneTake.tempo;notify('Finish the take before changing tempo');}},{capture:true});
      $('.app').addEventListener('click',event=>{if((microphoneTake||microphonePending)&&event.target.closest('#openProjectButton')){event.stopImmediatePropagation();notify('Finish the recording before opening a project');}},{capture:true});
      renderMixerMeters=function(){const mixer=editorBodyEl.querySelector('.mixer');for(const [index,track] of project.tracks.entries()){const c=studioChannels.get(track.id);let peak=0;if(c){c.meter.getFloatTimeDomainData(c.data);for(const v of c.data)peak=Math.max(peak,Math.abs(v));}const fill=mixer?.children[index]?.querySelector('.meter-fill');if(fill)fill.style.setProperty('--meter-level',`${peak>.001?clamp((20*Math.log10(peak)+60)/60*100,0,100):0}%`);}
        if(studioMasterMeter){const data=new Float32Array(256);studioMasterMeter.getFloatTimeDomainData(data);const peak=data.reduce((max,v)=>Math.max(max,Math.abs(v)),0),level=peak>.001?clamp((20*Math.log10(peak)+60)/60*100,0,100):0;const fill=mixer?.lastElementChild.querySelector('.meter-fill');if(fill)fill.style.setProperty('--meter-level',`${level}%`);$('#cpuStatus').textContent=peak>=1?'Output clipping':peak>.001?`Peak ${(20*Math.log10(peak)).toFixed(1)} dB`:'Audio idle';}
        if($('#studioRateStatus'))$('#studioRateStatus').textContent=audio.context?`${(audio.context.sampleRate/1000).toFixed(1)} kHz`:'Web Audio';if($('#studioEngineStatus'))$('#studioEngineStatus').textContent=microphoneTake?`Recording · ${Math.floor((performance.now()-microphoneTake.started)/1000)}s`:audio.playing?'Audio engine running':'Audio engine ready';
      };
      const studioBaseMixer=renderMixer;renderMixer=function(){studioBaseMixer();const channels=editorBodyEl.querySelector('.mixer').children;project.tracks.forEach((track,i)=>{channels[i].style.setProperty('--channel-color',track.color);const input=document.createElement('input');input.type='range';input.min=-1;input.max=1;input.step=.01;input.value=track.pan||0;input.className='mixer-pan';input.setAttribute('aria-label',`${track.name} pan`);let before;input.addEventListener('focus',()=>before=JSON.stringify(project));input.addEventListener('input',()=>{before??=JSON.stringify(project);track.pan=Number(input.value);syncAudioMix();setDirty();});input.addEventListener('change',()=>{pushUndoSnapshot(before);before=null;studioRenderInspector();});channels[i].append(input);});renderMixerMeters();};
      studioBuildUI();
      window.setInterval(renderMixerMeters,80);
