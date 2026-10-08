      // Session tools share the existing project/history and instrument engines.
      const sessionBackupKey='sonora-session-backups-v1';
      let sessionEventCache=null,sessionExporting=false,sessionLastBackup=0,sessionStartPending=false,sessionRangeSignature='';
      const sessionModulo=(n,d)=>((n%d)+d)%d;
      function sessionRange(){
        const end=arrangementBeats(),start=clamp(finiteNumber(project.loopStart,0),0,end-.25);
        return {start,end:clamp(finiteNumber(project.loopEnd,end),start+.25,end)};
      }
      function sessionPosition(absolute){const r=sessionRange();return project.loop?r.start+sessionModulo(absolute-r.start,r.end-r.start):absolute;}
      function sessionLoopClip(clip=selectedClipFor()){
        if(!clip){notify('Select a clip to set a loop range');return;}
        const before=JSON.stringify(project);project.loopStart=clip.start;project.loopEnd=clip.start+clip.length;project.loop=true;
        pushUndoSnapshot(before);setDirty();sessionUpdateLoop();seekToBeat(clip.start);notify('Loop range set to selected clip');
      }
      function sessionUpdateLoop(){
        const r=sessionRange(),full=project.loopStart==null&&project.loopEnd==null;
        $('#sessionLoopLabel').textContent=full?'Full arrangement':`${formatBarBeat(r.start).slice(0,5)} – ${formatBarBeat(r.end).slice(0,5)}`;
        $('#loopButton').classList.toggle('active',project.loop!==false);
        let strip=$('#sessionLoopStrip');if(!strip){strip=document.createElement('div');strip.id='sessionLoopStrip';strip.setAttribute('aria-hidden','true');rulerEl.append(strip);}
        strip.style.left=`${r.start/arrangementBeats()*100}%`;strip.style.width=`${(r.end-r.start)/arrangementBeats()*100}%`;strip.hidden=!project.loop;
        $('#countInButton').classList.toggle('active',Boolean(project.countIn));$('#countInButton').setAttribute('aria-pressed',String(Boolean(project.countIn)));
      }
      function sessionRangeChanged(){const r=sessionRange(),signature=`${project.loop}:${r.start}:${r.end}`;if(signature===sessionRangeSignature)return;sessionRangeSignature=signature;
        if(audio.playing)seekToBeat(project.loop?clamp(audio.playheadBeat,r.start,r.end-.001):audio.playheadBeat);
      }
      const sessionDirtyBase=setDirty;setDirty=function(...args){sessionEventCache=null;sessionDirtyBase(...args);if($('#sessionLoopLabel')){sessionRangeChanged();sessionUpdateLoop();}};
      function sessionBackup(snapshot,force=false){
        if(!snapshot||(!force&&Date.now()-sessionLastBackup<120000))return;
        try{const list=JSON.parse(localStorage.getItem(sessionBackupKey)||'[]');if(list[0]?.snapshot===snapshot)return;
          const title=JSON.parse(snapshot).title||'Untitled session';list.unshift({title,time:Date.now(),snapshot});localStorage.setItem(sessionBackupKey,JSON.stringify(list.slice(0,5)));sessionLastBackup=Date.now();
        }catch(_){}
      }
      saveProject=function(){
        try{const snapshot=JSON.stringify(project),previous=localStorage.getItem(STORAGE_KEY);if(previous&&previous!==snapshot)sessionBackup(previous);
          localStorage.setItem(STORAGE_KEY,snapshot);$('#saveStatus').textContent='Saved locally';$('#saveStatus').title=`Autosaved ${new Date().toLocaleTimeString()}. Download a project to keep a portable copy.`;
        }catch(_){$('#saveStatus').textContent='Storage full · download project';notify('Autosave unavailable. Download the project to keep your work.');}
      };
      const sessionRestoreBase=restoreProjectSnapshot;restoreProjectSnapshot=function(snapshot){const playing=audio.playing,beat=audio.playheadBeat;if(playing)studioStopSources();sessionRestoreBase(snapshot);sessionEventCache=null;if(playing){const r=sessionRange();seekToBeat(project.loop?clamp(beat,r.start,r.end-.001):beat);}sessionUpdateLoop();};
      const sessionNormalizeBase=normalizeProjectFile;normalizeProjectFile=function(raw){const next=sessionNormalizeBase(raw);
        if(Number.isFinite(raw.loopStart)&&Number.isFinite(raw.loopEnd)&&raw.loopEnd>raw.loopStart){next.loopStart=Math.max(0,raw.loopStart);next.loopEnd=raw.loopEnd;}else{delete next.loopStart;delete next.loopEnd;}return next;
      };
      const sessionArrangementBase=renderArrangement;renderArrangement=function(){sessionArrangementBase();sessionUpdateLoop();};
      const sessionLoadBase=loadProjectInstruments;loadProjectInstruments=async function(){await sessionLoadBase();
        const missing=studioSampleIds().filter(id=>!importedInstrumentBuffers.has(id));if(missing.length)throw Error('Project audio is missing. Reopen the portable project or import the missing audio.');
      };
      const sessionTimingBase=liveInputTiming;liveInputTiming=function(timestamp){const timing=sessionTimingBase(timestamp);timing.beat=sessionPosition(timing.absolute);return timing;};
      markLiveRecordedEvent=function(track,clip,suffix,timing,period=16){const r=sessionRange(),cycle=project.loop?Math.max(0,Math.floor((timing.absolute-r.start)/(r.end-r.start))):0;
        const offset=Math.max(0,Math.floor((timing.beat-clip.start)/period))*period;audio.scheduled.add(`${cycle}:${track.id}:${clip.id}:${offset}:${suffix}`);
      };
      const sessionSeekBase=seekToBeat;seekToBeat=function(beat){const result=sessionSeekBase(beat);audio.countInStart=null;audio.metronomeBeat=-1;sessionEventCache=null;return result;};
      const sessionStartBase=startPlayback;startPlayback=async function(){
        if(audio.playing||playbackPending||sessionStartPending)return;
        if(sessionExporting){notify('Finish rendering before starting playback');return;}
        const r=sessionRange();if(project.loop&&(audio.playheadBeat<r.start||audio.playheadBeat>=r.end))seekToBeat(r.start);
        const request=audio.startRequest=(audio.startRequest||0)+1;sessionStartPending=true;$('#playButton').setAttribute('aria-busy','true');
        sessionEventCache=null;try{await audioReady();await loadProjectInstruments();if(request!==audio.startRequest)return;return await sessionStartBase();}catch(error){if(request===audio.startRequest){stopPlayback(false);notify(error.message||'Could not start the audio engine');}}
        finally{if(request===audio.startRequest){sessionStartPending=false;$('#playButton').removeAttribute('aria-busy');}}
      };
      const sessionStopBase=stopPlayback;stopPlayback=function(...args){audio.startRequest=(audio.startRequest||0)+1;sessionStartPending=false;$('#playButton').removeAttribute('aria-busy');return sessionStopBase(...args);};
      function sessionClick(time,accent){
        const ctx=audio.context,osc=studioTrackSource(ctx.createOscillator()),gain=ctx.createGain();osc.type='sine';osc.frequency.value=accent?1200:850;
        gain.gain.setValueAtTime(.065,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.035);osc.connect(gain);gain.connect(audio.master);
        osc.addEventListener('ended',()=>{osc.disconnect();gain.disconnect();},{once:true});osc.start(time);osc.stop(time+.04);
      }
      scheduler=function(){
        if(!audio.playing||!audio.context)return;
        const ctx=audio.context,now=ctx.currentTime,spb=60/project.tempo,current=audio.startedAtBeat+(now-audio.startTime)/spb,counting=audio.countInStart!==null&&now<audio.startTime;
        const range=project.loop?sessionRange():{start:0,end:arrangementBeats()},len=range.end-range.start,cycle=project.loop?Math.max(0,Math.floor((current-range.start)/len)):0;
        const events=sessionEventCache||(sessionEventCache=collectEvents()),hasSolo=project.tracks.some(t=>t.solo);
        for(let pass=cycle;pass<=cycle+(project.loop?1:0);pass++){
          const shift=project.loop?pass*len:0;
          for(const event of events){
            if(event.track.mute||(hasSolo&&!event.track.solo))continue;
            const end=event.kind?event.beat+.001:event.beat+event.duration/spb;
            if(event.beat>=range.end||end<=range.start)continue;
            const seed=pass===0?Math.max(range.start,audio.startedAtBeat):range.start,beat=Math.max(event.beat,seed);
            if(end<=beat)continue;
            const time=audio.startTime+(beat+shift-audio.startedAtBeat)*spb,key=`${pass}:${event.id}`;
            if(audio.scheduled.has(key)||time<now-.035||time>now+.12)continue;audio.scheduled.add(key);
            if(event.kind)playDrum(event.kind,Math.max(time,now),event.velocity,event.track);
            else playNote(event.track,event.note,Math.max(time,now),Math.max(.005,(Math.min(end,range.end)-beat)*spb));
          }
          for(const track of project.tracks){if(track.type!=='audio'||track.mute||(hasSolo&&!track.solo))continue;
            for(const clip of track.clips){const seed=pass===0?Math.max(range.start,audio.startedAtBeat):range.start,start=Math.max(clip.start,seed),end=Math.min(clip.start+clip.length,range.end);
              if(end<=start)continue;const time=audio.startTime+(start+shift-audio.startedAtBeat)*spb,key=`audio:${pass}:${track.id}:${clip.id}`;
              if(audio.scheduled.has(key)||time>now+.12)continue;const elapsed=Math.max(0,now-time);if(elapsed>=(end-start)*spb)continue;audio.scheduled.add(key);
              studioAudioVoice(ctx,audio.trackNodes.get(track.id),{...clip,length:end-clip.start},Math.max(time,now),(start-clip.start)*spb+elapsed,true);
            }
          }
        }
        const shown=counting?audio.startedAtBeat:sessionPosition(current);
        for(const track of project.tracks)audio.trackNodes.get(track.id)?.gain.setTargetAtTime(!track.mute&&(!hasSolo||track.solo)?track.volume*studioAutomationValue(track,shown):0,now,.008);
        // Schedule clicks on the audio clock; display refresh does not set their timing.
        if(counting){for(let i=0;i<4;i++){const time=audio.countInStart+i*spb,key=`count:${i}`;if(!audio.scheduled.has(key)&&time>=now-.03&&time<=now+.12){audio.scheduled.add(key);sessionClick(Math.max(time,now),i===0);} }audio.countInBeat=clamp(Math.floor((now-audio.countInStart)/spb),0,3);}
        else if(project.metronome){for(let pass=cycle;pass<=cycle+(project.loop?1:0);pass++){const shift=project.loop?pass*len:0,first=Math.max(Math.ceil(range.start),Math.floor(current-shift)),last=Math.min(range.end-.00001,current+.12/spb-shift);for(let beat=first;beat<=last;beat++){const time=audio.startTime+(beat+shift-audio.startedAtBeat)*spb,key=`click:${pass}:${beat}`;if(time>=now-.03&&time<=now+.12&&!audio.scheduled.has(key)){audio.scheduled.add(key);sessionClick(Math.max(time,now),beat%4===0);}}}}
        if(!project.loop&&current>=range.end){stopPlayback(false);audio.playheadBeat=range.end;$('#positionDisplay').textContent=formatBarBeat(range.end);return;}
        audio.playheadBeat=clamp(shown,0,arrangementBeats());$('#playhead').style.left=`${audio.playheadBeat/arrangementBeats()*100}%`;
        const position=counting?`IN ${audio.countInBeat+1}/4`:formatBarBeat(audio.playheadBeat);$('#playheadGrip').setAttribute('aria-valuenow',String(audio.playheadBeat));$('#playheadGrip').setAttribute('aria-valuetext',position);
        if(position!==audio.lastDisplay){$('#positionDisplay').textContent=position;audio.lastDisplay=position;}
        if(cycle>1&&audio.scheduled.size>2000){for(const key of audio.scheduled){const match=key.match(/^(?:audio:)?(\d+):/);if(match&&Number(match[1])<cycle-1)audio.scheduled.delete(key);}}
      };
      function sessionStarter(kind){
        if(microphoneTake||microphonePending){notify('Finish recording first');return;}
        sessionBackup(JSON.stringify(project),true);const before=JSON.stringify(project);stopPlayback(true);const next=kind==='demo'?demoProject():defaultProject();next.title=kind==='demo'?'Midnight in Motion':kind==='beat'?'Beat session':kind==='piano'?'Piano session':'Untitled session';
        if(kind!=='demo'){next.tracks=[];const preset=SYNTH_PRESETS.find(p=>p.name===(kind==='piano'?'Studio Grand':'Glass Keys'))||SYNTH_PRESETS[0];
          const track={id:'session-instrument',name:kind==='piano'?'Piano':'Instrument 1',type:'synth',instrument:preset.name,synth:clone(preset.synth),color:'#74dec7',volume:.65,pan:0,mute:false,solo:false,effects:[],clips:[]};
          if(kind!=='empty')track.clips=[{id:'session-clip',name:'Pattern 1',start:0,length:16,notes:[]}];next.tracks.push(track);
          if(kind==='beat'){const kit=DRUM_KITS[0];next.tempo=120;next.tracks.push({id:'session-drums',name:'Drums',type:'drums',instrument:kit.name,drumKit:kit.name,color:'#f29891',volume:.7,pan:0,mute:false,solo:false,effects:[],clips:[{id:'session-groove',name:'Groove',start:0,length:16,steps:{kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],openHat:[],clap:[],tom:[],rim:[]}}]});}
          next.selectedTrack=track.id;next.selectedClip=track.clips[0]?.id||null;
        }
        editorTab='piano';restoreProjectSnapshot(JSON.stringify(next));pushUndoSnapshot(before);saveProject();$('#sessionDialog').close();notify('Session created · undo restores your previous session');
      }
      function sessionOpen(){
        const list=$('#sessionRecoveryList');list.replaceChildren();let backups=[];try{backups=JSON.parse(localStorage.getItem(sessionBackupKey)||'[]');}catch(_){}
        for(const entry of backups){const button=studioButton('',()=>{if(microphoneTake)return;const before=JSON.stringify(project);sessionBackup(before,true);stopPlayback(true);try{const next=normalizeProjectFile(JSON.parse(entry.snapshot));restoreProjectSnapshot(JSON.stringify(next));pushUndoSnapshot(before);saveProject();$('#sessionDialog').close();notify('Backup restored · undo returns to your previous session');}catch(error){notify(error.message);}});button.textContent=`${entry.title} · ${new Date(entry.time).toLocaleString()}`;list.append(button);}
        if(!backups.length){const p=document.createElement('p');p.textContent='Recovery snapshots appear here as you work. Portable projects include your imported audio.';list.append(p);}$('#sessionDialog').showModal();
      }
      function sessionWav(buffer,bits=24,normalize=false){
        const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),frames=buffer.length,count=channels.length,bps=bits/8,size=frames*count*bps;
        let peak=0;for(const channel of channels)for(const v of channel)peak=Math.max(peak,Math.abs(v));const scale=normalize&&peak>0?Math.pow(10,-1/20)/peak:1;
        const bytes=new ArrayBuffer(44+size),view=new DataView(bytes);const word=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
        word(0,'RIFF');view.setUint32(4,36+size,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,count,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*count*bps,true);view.setUint16(32,count*bps,true);view.setUint16(34,bits,true);word(36,'data');view.setUint32(40,size,true);
        let offset=44;for(let frame=0;frame<frames;frame++)for(let ch=0;ch<count;ch++){const sample=clamp(channels[ch][frame]*scale,-1,1);
          if(bits===16)view.setInt16(offset,Math.round(sample*(sample<0?32768:32767)),true);
          else{const value=Math.round(sample*(sample<0?8388608:8388607));view.setUint8(offset,value&255);view.setUint8(offset+1,(value>>8)&255);view.setUint8(offset+2,(value>>16)&255);}offset+=bps;
        }return {blob:new Blob([bytes],{type:'audio/wav'}),peak,scale};
      }
      async function sessionRenderWav(){
        if(sessionExporting)return;const button=$('#sessionRenderButton');sessionExporting=true;button.disabled=true;button.textContent='Preparing instruments…';$('#sessionExportStatus').textContent='';
        try{await audioReady();await loadProjectInstruments();
          const spb=60/project.tempo,sampleRate=Number($('#sessionExportRate').value),bits=Number($('#sessionExportBits').value),range=$('#sessionExportRange').value==='loop'?sessionRange():{start:0,end:arrangementBeats()},scope=$('#sessionExportScope').value,tracks=scope==='track'?[getTrack()]:project.tracks,hasSolo=scope==='mix'&&tracks.some(t=>t.solo),audible=tracks.filter(t=>scope==='track'||!t.mute&&(!hasSolo||t.solo));
          const tail=Math.min(30,Math.max(2,...audible.map(t=>finiteNumber(t.synth?.release,1)+fxTailSeconds(t.effects)))+fxTailSeconds(project.masterEffects)),duration=(range.end-range.start)*spb+tail;
          if(duration>1200)throw Error('Export ranges support up to 20 minutes. Choose a shorter loop range.');
          const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw Error('Offline WAV export is unavailable in this browser.');
          const context=new Offline(2,Math.ceil(duration*sampleRate),sampleRate),master=context.createGain(),bus=context.createGain(),outputs=new Map();master.gain.value=project.masterVolume;master.connect(context.destination);connectFxChain(context,bus,project.masterEffects,'session-offline-master').connect(master);
          for(const track of audible){const output=context.createGain(),pan=context.createStereoPanner();outputs.set(track.id,output);output.gain.setValueAtTime(track.volume*studioAutomationValue(track,range.start),0);
            for(const point of [...(track.automation||[])].sort((a,b)=>a.beat-b.beat))if(point.beat>range.start&&point.beat<range.end)output.gain.linearRampToValueAtTime(track.volume*point.value,(point.beat-range.start)*spb);
            if(track.automation?.length)output.gain.linearRampToValueAtTime(track.volume*studioAutomationValue(track,range.end),(range.end-range.start)*spb);
            pan.pan.value=track.pan||0;output.connect(pan);connectFxChain(context,pan,track.effects,`session-offline-${track.id}`).connect(bus);
          }
          for(const event of collectEvents()){const output=outputs.get(event.track.id);if(!output)continue;const end=event.kind?event.beat+.001:event.beat+event.duration/spb;if(event.beat>=range.end||end<=range.start)continue;
            const time=Math.max(0,event.beat-range.start)*spb;if(event.kind)proDrumVoice(context,output,event.track,event.kind,time,event.velocity,false);
            else proVoice(context,output,event.track,event.note,time,(Math.min(end,range.end)-Math.max(event.beat,range.start))*spb,false);
          }
          for(const track of audible.filter(t=>t.type==='audio'))for(const clip of track.clips){const start=Math.max(clip.start,range.start),end=Math.min(clip.start+clip.length,range.end);if(end>start)studioAudioVoice(context,outputs.get(track.id),{...clip,length:end-clip.start},(start-range.start)*spb,(start-clip.start)*spb);}
          button.textContent='Rendering audio…';const rendered=await context.startRendering(),result=sessionWav(rendered,bits,$('#sessionNormalize').checked),url=URL.createObjectURL(result.blob),link=document.createElement('a');
          const title=(project.title||'Sonora').replace(/[^a-z0-9-_ ]/gi,'').trim().replace(/\s+/g,'-');link.href=url;link.download=`${title}${scope==='track'?'-'+getTrack().name.replace(/[^a-z0-9-_]/gi,'-'):''}-${bits}bit.wav`;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
          $('#sessionExportStatus').textContent=`Exported ${bits}-bit stereo WAV · ${sampleRate/1000} kHz · ${duration.toFixed(1)}s · peak ${result.peak?(20*Math.log10(result.peak*result.scale)).toFixed(1):'−∞'} dBFS${result.peak>1&&!$('#sessionNormalize').checked?' · source exceeded 0 dBFS; lower your mix or enable normalization':''}`;notify('WAV exported');
        }catch(error){$('#sessionExportStatus').textContent=error.message||'Export could not be rendered';notify(error.message||'Export could not be rendered');}
        finally{sessionExporting=false;button.disabled=false;button.textContent='Render WAV';}
      }
      exportWav=function(){$('#sessionExportRate').value=String(studioPrefs.sampleRate);$('#sessionExportStatus').textContent='';$('#sessionExportDialog').showModal();};
      const sessionToolbar=document.createElement('div');sessionToolbar.className='session-toolbar';
      const sessionButton=studioButton('Sessions',sessionOpen);sessionButton.id='sessionButton';sessionToolbar.append(sessionButton);$('.workspace-controls').append(sessionToolbar);
      const loopMenu=designMenu('Loop range',[]);loopMenu.id='sessionLoopMenu';const loopBody=loopMenu.querySelector('.design-menu-body'),loopLabel=document.createElement('span');loopLabel.id='sessionLoopLabel';loopBody.append(loopLabel,studioButton('Use selected clip',()=>{sessionLoopClip();loopMenu.open=false;}),studioButton('Full arrangement',()=>{studioEdit(()=>{delete project.loopStart;delete project.loopEnd;});sessionUpdateLoop();loopMenu.open=false;}));
      for(const [key,label] of [['loopStart','Start · beat'],['loopEnd','End · beat']]){const input=document.createElement('input');input.type='number';input.min=0;input.step=.25;input.value=key==='loopStart'?sessionRange().start:sessionRange().end;input.setAttribute('aria-label',`Loop ${label}`);input.addEventListener('change',()=>{const r=sessionRange(),value=finiteNumber(input.value,r[key==='loopStart'?'start':'end']);studioEdit(()=>{if(key==='loopStart')project.loopStart=clamp(value,0,r.end-.25);else project.loopEnd=clamp(value,r.start+.25,arrangementBeats());});sessionUpdateLoop();});studioField(loopBody,label,input);}
      loopMenu.addEventListener('toggle',()=>{if(loopMenu.open){const r=sessionRange(),inputs=loopBody.querySelectorAll('input');inputs[0].value=r.start;inputs[1].value=r.end;}});
      $('.workspace-controls').append(loopMenu);
      const sessionDialog=document.createElement('dialog');sessionDialog.id='sessionDialog';sessionDialog.className='studio-dialog session-dialog';sessionDialog.innerHTML='<h2>Start a session</h2><p>Choose a starting point. Your current project can be restored with Undo.</p><div class="session-templates"></div><h3>Session recovery</h3><div id="sessionRecoveryList"></div><div class="session-guide"><h3>Essential controls</h3><p>Space: play / pause · Ctrl+S: save · Ctrl+Z: undo · Ctrl+E: split clip</p><p>Use Record to arm MIDI recording, then start playback. Drag clips to arrange. Pull either edge to trim. Alt-drag to copy. Right-click for clip actions. In the piano roll, draw and drag notes, scroll through pitches, and adjust velocity below.</p><p>Projects autosave on this device. Download a .sonora project to keep a portable copy, including imported audio.</p></div>';
      for(const [kind,title,description] of [['piano','Piano session','A ready-to-record Studio Grand and an empty four-bar clip.'],['beat','Beat session','Instrument and drum tracks with a starter groove.'],['empty','Empty session','A clean instrument track for a new project.'],['demo','Demo arrangement','Explore an editable four-track arrangement.']]){const b=studioButton('',()=>sessionStarter(kind));const strong=document.createElement('strong'),p=document.createElement('span');strong.textContent=title;p.textContent=description;b.append(strong,p);sessionDialog.querySelector('.session-templates').append(b);}
      sessionDialog.append(studioButton('Close',()=>sessionDialog.close(),'text-button dialog-close'));document.body.append(sessionDialog);
      const exportDialog=document.createElement('dialog');exportDialog.id='sessionExportDialog';exportDialog.className='studio-dialog session-dialog';exportDialog.innerHTML='<h2>Export audio</h2><p>Render instruments, audio clips, automation and effects to a stereo WAV file.</p><div class="session-export-fields"><label>Source<select id="sessionExportScope" aria-label="Export source"><option value="mix">Full mix · follows mute and solo</option><option value="track">Selected track · includes master effects</option></select></label><label>Range<select id="sessionExportRange" aria-label="Export range"><option value="all">Full arrangement</option><option value="loop">Loop range</option></select></label><label>Sample rate<select id="sessionExportRate" aria-label="Export sample rate"><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option><option value="96000">96 kHz</option></select></label><label>Bit depth<select id="sessionExportBits" aria-label="Export bit depth"><option value="24">24-bit PCM</option><option value="16">16-bit PCM</option></select></label></div><label class="session-normalize"><input id="sessionNormalize" type="checkbox"> Normalize peak to −1 dBFS</label><p class="studio-note">Effect tails are included. Normalization changes overall level while preserving dynamics.</p><button id="sessionRenderButton" class="text-button pro-primary">Render WAV</button><p id="sessionExportStatus" role="status"></p>';
      exportDialog.append(studioButton('Close',()=>{if(!sessionExporting)exportDialog.close();},'text-button dialog-close'));exportDialog.addEventListener('cancel',event=>{if(sessionExporting)event.preventDefault();});document.body.append(exportDialog);$('#sessionRenderButton').addEventListener('click',sessionRenderWav);
      document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='e'&&!document.querySelector('dialog[open]')&&!/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)){event.preventDefault();splitSelectedClip();}},{capture:true});
      document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProject();});window.addEventListener('pagehide',saveProject);
      $('#tempoInput').addEventListener('change',()=>{if(audio.playing&&!microphoneTake){studioStopSources();audio.startedAtBeat=audio.playheadBeat;audio.startTime=audio.context.currentTime;audio.countInStart=null;audio.scheduled.clear();}},{capture:true});
      const sessionFaderSnapshots=new WeakMap();document.addEventListener('focusin',event=>{if(event.target.matches('.track-volume input'))sessionFaderSnapshots.set(event.target,JSON.stringify(project));});
      document.addEventListener('pointerdown',event=>{if(event.target.matches('.track-volume input'))sessionFaderSnapshots.set(event.target,JSON.stringify(project));},{capture:true});
      document.addEventListener('change',event=>{if(event.target.matches('.track-volume input')){const before=sessionFaderSnapshots.get(event.target);if(before)pushUndoSnapshot(before);sessionFaderSnapshots.delete(event.target);}});
      sessionUpdateLoop();
      const sessionInitialRange=sessionRange();sessionRangeSignature=`${project.loop}:${sessionInitialRange.start}:${sessionInitialRange.end}`;
