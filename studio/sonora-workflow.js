      // Discoverable commands and empty-session guidance. Uses the studio's existing history and audio paths.
      let workflowCommands=[],workflowActiveCommand=0,workflowCommandMode='all',workflowPickerMode='synth',workflowReturnFocus=null;
      const workflowText=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const workflowSoundWords=preset=>`${preset.name} ${preset.category||''} ${preset.description||''} ${preset.kind==='drums'?'drums percussion kit':preset.synth?.engine==='piano'?'piano keys':preset.synth?.engine==='acoustic'?'recorded sampled acoustic':'synth synthesizer'} ${preset.synth?.sampleBank||''}`;
      function workflowSelectTrack(id){
        const track=project.tracks.find(t=>t.id===id);if(!track)return;
        releaseAllLiveNotes();project.selectedTrack=id;project.selectedClip=track.clips[0]?.id||null;editFocus='clips';
        if(track.type==='audio')editorTab='audio';else if(track.type==='drums')editorTab='drums';else if(['audio','drums'].includes(editorTab))editorTab='piano';
        renderTracks();renderArrangement();renderEditor();updateStatus();
        [...trackListEl.querySelectorAll('.track-row')].find(row=>row.dataset.track===id)?.scrollIntoView({block:'nearest'});
      }
      function workflowAddTrack(preset,type=preset?.kind||'synth'){
        if(project.tracks.length>=64){notify('Projects support up to 64 tracks');return null;}
        if(type==='audio')return studioAddAudioTrack();
        preset||=type==='drums'?proPresetList().find(p=>p.kind==='drums'):proPresetList().find(p=>p.name==='Studio Grand')||proPresetList().find(p=>p.kind==='synth');
        if(!preset)return null;
        const baseName=preset.name;let name=baseName,n=2;while(project.tracks.some(t=>t.name===name))name=`${baseName} ${n++}`;
        const track={id:`workflow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,name,type,instrument:preset.name,color:type==='drums'?COLORS.drums:(COLORS[String(preset.category||'Keys').toLowerCase()]||COLORS.keys),volume:type==='drums'?.72:.65,pan:0,mute:false,solo:false,effects:[],clips:[]};
        if(type==='drums'){track.drumKit=preset.drumKit||preset.name;track.drumParams=clone(preset.drumParams||{});track.steps=Object.fromEntries(DRUM_LANES.map(lane=>[lane,[]]));}
        else{track.synth=proSynth({synth:preset.synth});track.waveform=track.synth.waveform;}
        studioEdit(()=>{releaseAllLiveNotes();project.tracks.push(track);project.selectedTrack=track.id;project.selectedClip=null;editFocus='clips';editorTab=type==='drums'?'drums':'piano';});
        notify(`${name} added · create a clip or start recording`);return track;
      }
      function workflowLoadSound(preset){
        const track=getTrack();if(!track||track.type!==preset.kind){workflowAddTrack(preset);return;}
        studioEdit(()=>{releaseAllLiveNotes();track.instrument=preset.name;delete track.sampleId;delete track.sampleRootPitch;
          if(preset.kind==='drums'){track.drumKit=preset.drumKit||preset.name;track.drumParams=clone(preset.drumParams||{});}
          else{track.synth=proSynth({synth:preset.synth});track.waveform=track.synth.waveform;}
        });notify(`${preset.name} loaded on ${track.name}`);
      }
      function workflowShowEditor(tab){studioPrefs.editor=true;studioApplyPreferences();editorTab=tab;renderEditor();}
      function workflowCloseDialog(dialog){dialog.close();const previous=workflowReturnFocus;if(previous?.isConnected)previous.focus({preventScroll:true});}
      function workflowCommandCatalog(){
        const clip=selectedClipFor(),track=getTrack(),commands=[];
        const action=(id,title,description,run,shortcut='',enabled=true,icon='settings')=>commands.push({id,title,description,run,shortcut,enabled,icon,group:'commands'});
        action('add-track','Add a track','Choose an instrument, drum kit, or audio track',()=>workflowOpenTrackPicker(),'',true,'plus');
        action('add-clip','Create an empty clip',track?.type==='audio'?'Import an audio file on the selected track':'Create a clip on the selected track',addClip,'',Boolean(track),'plus');
        action('ai','Create music with AI','Open the music assistant',()=>$('#assistantButton')?.click(),'',Boolean($('#assistantButton')),'spark');
        action('import','Import audio','Choose recordings, loops, or samples',()=>$('#studioAudioInput').click(),'',true,'wave');
        action('transport',audio.playing?'Pause playback':'Play from the playhead','Start or pause the transport',()=>$('#playButton').click(),'Space',true,'play');
        action('stop','Stop and return to start','Stop audio and reset the playhead',()=>$('#stopButton').click(),'',true,'play');
        action('record',audio.record?'Disarm MIDI recording':'Arm MIDI recording','Arm recording, then start playback and play your instrument',()=>$('#recordButton').click(),'',true,'mic');
        action('mic','Record microphone','Start or finish an audio recording',()=>$('#studioRecordMic').click(),'',true,'mic');
        action('save','Save project','Save on this device',()=>$('#saveButton').click(),'Ctrl / ⌘ S',true,'save');
        action('download','Download portable project','Keep a backup with your imported audio',()=>$('#downloadProjectButton').click(),'',true,'download');
        action('open','Open project','Open a .sonora project',()=>$('#openProjectButton').click(),'',true,'folder');
        action('export','Export WAV audio','Choose mix, range, and render quality',()=>$('#exportWavButton').click(),'',true,'download');
        action('midi','Export MIDI','Download the arrangement as MIDI',()=>$('#exportButton').click(),'',true,'download');
        action('undo','Undo last edit','Restore the previous edit',()=>$('#undoButton').click(),'Ctrl / ⌘ Z',!$('#undoButton').disabled,'copy');
        action('redo','Redo edit','Reapply the undone edit',()=>$('#redoButton').click(),'Ctrl / ⌘ Shift Z',!$('#redoButton').disabled,'copy');
        action('split','Split selected clip','Split at the playhead',splitSelectedClip,'Ctrl / ⌘ E',Boolean(clip),'copy');
        action('duplicate','Duplicate selected clip','Copy the selected clip later in the arrangement',duplicateSelectedClip,'Ctrl / ⌘ D',Boolean(clip),'copy');
        action('rename','Rename selected clip',clip?.name||'Select a clip first',()=>clip&&openRename(clip,'clip'),'F2',Boolean(clip),'settings');
        action('loop','Loop selected clip','Set the loop range to this clip',()=>sessionLoopClip(),'',Boolean(clip),'play');
        for(const [tab,title,icon] of [['piano','Piano roll','piano'],['perform','Play instrument','piano'],['instrument','Instrument controls','knobs'],['drums','Drum sequencer','drums'],['audio','Audio editor','wave'],['automation','Track automation','wave'],['mixer','Mixer','knobs'],['fx','Effects','spark']]){
          const valid=!(['piano','perform','instrument'].includes(tab)&&track?.type==='audio')&&!(tab==='audio'&&track?.type!=='audio')&&!(tab==='drums'&&track?.type!=='drums');
          action(`editor-${tab}`,`Open ${title}`,`Show ${title.toLowerCase()} in the editor`,()=>workflowShowEditor(tab),'',valid,icon);
        }
        action('library','Toggle sound library','Show or hide the instrument library',()=>designTogglePanel('browser'),'',true,'library');
        action('inspector','Toggle track inspector','Show or hide track and clip properties',()=>designTogglePanel('inspector'),'',true,'inspector');
        action('sessions','Sessions and recovery','Starting points and saved recovery snapshots',sessionOpen,'',true,'folder');
        action('settings','Studio preferences','Workspace, color, and audio settings',()=>document.querySelector('button[aria-label="Studio settings"]').click(),'',true,'settings');
        action('help','Keyboard shortcuts','Learn editing and transport shortcuts',()=>$('#studioHelp').showModal(),'',true,'help');
        for(const item of project.tracks)commands.push({id:`track-${item.id}`,title:item.name,description:`Go to track · ${item.instrument} · ${item.clips.length} clip${item.clips.length===1?'':'s'}`,group:'tracks',enabled:true,icon:item.type==='drums'?'drums':item.type==='audio'?'wave':'piano',run:()=>workflowSelectTrack(item.id)});
        for(const preset of proPresetList())commands.push({id:`sound-${preset.key||preset.name}`,title:preset.name,description:`Load sound · ${preset.category} · ${preset.description||'Instrument preset'}`,keywords:workflowSoundWords(preset),group:'sounds',enabled:true,icon:preset.kind==='drums'?'drums':preset.category==='Keys'?'piano':'wave',run:()=>workflowLoadSound(preset)});
        return commands;
      }
      function workflowFilterCommands(query='',mode=workflowCommandMode){const terms=workflowText(query).trim().split(/\s+/).filter(Boolean);return workflowCommandCatalog().filter(item=>(mode==='all'||item.group===mode)&&terms.every(term=>workflowText(`${item.title} ${item.description} ${item.keywords||''}`).includes(term))).sort((a,b)=>Number(workflowText(b.title).startsWith(workflowText(query))) - Number(workflowText(a.title).startsWith(workflowText(query)))).slice(0,60);}
      function workflowSetActive(index){
        workflowActiveCommand=clamp(index,0,Math.max(0,workflowCommands.length-1));
        $('#workflowCommandResults').querySelectorAll('[role=option]').forEach((button,i)=>{const selected=i===workflowActiveCommand;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));});
        const current=$(`#workflow-command-${workflowActiveCommand}`);if(current){$('#workflowCommandSearch').setAttribute('aria-activedescendant',current.id);current.scrollIntoView({block:'nearest'});}else $('#workflowCommandSearch').removeAttribute('aria-activedescendant');
      }
      function workflowExecuteCommand(index){const item=workflowCommands[index];if(!item||!item.enabled)return;workflowCloseDialog($('#workflowCommandDialog'));item.run();}
      function workflowRenderCommands(){
        workflowCommands=workflowFilterCommands($('#workflowCommandSearch').value);const list=$('#workflowCommandResults');list.replaceChildren();
        workflowCommands.forEach((item,index)=>{const button=studioButton('',()=>workflowExecuteCommand(index),'workflow-command');button.id=`workflow-command-${index}`;button.role='option';button.tabIndex=-1;button.disabled=!item.enabled;button.append(designIcon(item.icon));const copy=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small');title.textContent=item.title;description.textContent=item.description;copy.append(title,description);button.append(copy);const shortcut=document.createElement('kbd');shortcut.textContent=item.shortcut||({commands:'Command',tracks:'Track',sounds:'Sound'})[item.group];button.append(shortcut);list.append(button);});
        if(!workflowCommands.length){const empty=document.createElement('p');empty.className='workflow-no-results';empty.textContent='No matches. Try a track name, sound, or action such as “split”.';list.append(empty);}
        $('#workflowCommandCount').textContent=`${workflowCommands.length} result${workflowCommands.length===1?'':'s'}`;workflowSetActive(0);
        $('#workflowCommandFilters').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===workflowCommandMode)));
      }
      function workflowOpenCommands(mode='all',query=''){
        if(document.querySelector('dialog[open]'))return;
        workflowReturnFocus=document.activeElement;workflowCommandMode=mode;$('#workflowCommandSearch').value=query;workflowRenderCommands();$('#workflowCommandDialog').showModal();$('#workflowCommandSearch').focus();
      }
      function workflowRenderPicker(){
        const list=$('#workflowTrackChoices');list.replaceChildren();const terms=workflowText($('#workflowTrackSearch').value).trim().split(/\s+/).filter(Boolean),presets=proPresetList().filter(p=>p.kind===workflowPickerMode&&terms.every(term=>workflowText(workflowSoundWords(p)).includes(term)));
        if(workflowPickerMode==='audio'){
          const button=studioButton('',()=>{workflowCloseDialog($('#workflowTrackDialog'));workflowAddTrack(null,'audio');},'workflow-track-choice');button.append(designIcon('wave'));const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent='Audio track';small.textContent='Import audio clips or record your microphone';text.append(strong,small);button.append(text);list.append(button);
        }else for(const preset of presets){const button=studioButton('',()=>{workflowCloseDialog($('#workflowTrackDialog'));workflowAddTrack(preset);},'workflow-track-choice');button.append(designIcon(preset.kind==='drums'?'drums':preset.category==='Keys'?'piano':'wave'));const text=document.createElement('span'),name=document.createElement('strong'),description=document.createElement('small');name.textContent=preset.name;description.textContent=`${preset.category} · ${preset.description||'Customizable instrument'}`;text.append(name,description);button.append(text,designIcon('plus'));list.append(button);}
        if(!list.children.length){const empty=document.createElement('p');empty.className='workflow-no-results';empty.textContent='No instruments match your search.';list.append(empty);}
        $('#workflowTrackFilters').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===workflowPickerMode)));$('#workflowTrackSearch').hidden=workflowPickerMode==='audio';
      }
      function workflowOpenTrackPicker(){
        if(document.querySelector('dialog[open]'))return;
        workflowReturnFocus=document.activeElement;workflowPickerMode='synth';$('#workflowTrackSearch').value='';workflowRenderPicker();$('#workflowTrackDialog').showModal();$('#workflowTrackSearch').focus();
      }
      function workflowUpdateTransport(){
        const state=$('#workflowTransportState');if(!state)return;const counting=audio.playing&&audio.countInStart!==null&&audio.context?.currentTime<audio.startTime;
        const text=microphoneTake?'Recording audio':counting?'Count-in':audio.playing?(audio.record?'Recording MIDI':'Playing'):audio.record?'MIDI armed':'Stopped';
        if(state.textContent!==text)state.textContent=text;state.dataset.state=(microphoneTake||audio.record)?'record':audio.playing?'play':'stop';
      }
      function workflowRenderState(){
        const track=getTrack(),clip=selectedClipFor();if(!track||!$('#workflowContext'))return;
        $('#workflowContextTrack').textContent=track.name;$('#workflowContextTrack').style.setProperty('--workflow-track-color',track.color);
        $('#workflowContextClip').textContent=clip?`${clip.name} · ${formatBarBeat(clip.start).slice(0,5)} · ${Number((clip.length/4).toFixed(2))} bars`:'No clip selected';
        $('#workflowContextLoop').hidden=!clip;$('#workflowContextSound').hidden=track.type==='audio';$('#workflowContextNew').textContent=track.type==='audio'?'Import audio':'Create clip';
        const empty=!project.tracks.some(t=>t.clips.length);$('#workflowEmpty').hidden=!empty;$('#workflowEmptyAction').textContent=track.type==='audio'?'Import audio':'Create first clip';
        $('#workflowEmptyDescription').textContent=track.type==='audio'?'Import a recording or sample, or record your microphone.':`${track.instrument} is selected. Create a clip to draw notes, or arm recording and play.`;
        workflowUpdateTransport();
      }
      const workflowDialog=document.createElement('dialog');workflowDialog.id='workflowCommandDialog';workflowDialog.className='studio-dialog workflow-command-dialog';workflowDialog.setAttribute('aria-labelledby','workflowCommandTitle');
      workflowDialog.innerHTML='<header class="workflow-dialog-head"><div><span class="workflow-eyebrow">FIND IT. DO IT.</span><h2 id="workflowCommandTitle">Commands, tracks & sounds</h2></div><button type="button" class="icon-button workflow-close" aria-label="Close command search">×</button></header><input id="workflowCommandSearch" class="workflow-search" type="search" placeholder="Search actions, track names, or instruments…" aria-label="Search commands, tracks, and sounds" role="combobox" aria-autocomplete="list" aria-controls="workflowCommandResults" aria-expanded="true" autocomplete="off"><div id="workflowCommandFilters" class="workflow-filters" role="group" aria-label="Search category"></div><div id="workflowCommandResults" class="workflow-command-results" role="listbox" aria-label="Search results"></div><footer class="workflow-dialog-footer"><span id="workflowCommandCount" role="status" aria-live="polite"></span><span><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Enter</kbd> run · <kbd>Esc</kbd> close</span></footer>';
      document.body.append(workflowDialog);
      for(const [mode,label] of [['all','All'],['commands','Commands'],['tracks','Tracks'],['sounds','Sounds']]){const button=studioButton(label,()=>{workflowCommandMode=mode;workflowRenderCommands();$('#workflowCommandSearch').focus();},'workflow-filter');button.dataset.mode=mode;$('#workflowCommandFilters').append(button);}
      const picker=document.createElement('dialog');picker.id='workflowTrackDialog';picker.className='studio-dialog workflow-track-dialog';picker.setAttribute('aria-labelledby','workflowTrackTitle');picker.innerHTML='<header class="workflow-dialog-head"><div><span class="workflow-eyebrow">BUILD YOUR SESSION</span><h2 id="workflowTrackTitle">Add a track</h2><p>Choose the sound you want. Start with an empty track.</p></div><button type="button" class="icon-button workflow-close" aria-label="Close add track">×</button></header><div id="workflowTrackFilters" class="workflow-filters" role="group" aria-label="Track type"></div><input id="workflowTrackSearch" class="workflow-search" type="search" placeholder="Search instruments or categories…" aria-label="Search track instruments" autocomplete="off"><div id="workflowTrackChoices" class="workflow-track-choices"></div><p class="workflow-picker-note">Create clips when you need them. Every new track can be removed with Undo.</p>';
      document.body.append(picker);
      for(const [mode,label] of [['synth','Instruments'],['drums','Drum kits'],['audio','Audio']]){const button=studioButton(label,()=>{workflowPickerMode=mode;workflowRenderPicker();},'workflow-filter');button.dataset.mode=mode;$('#workflowTrackFilters').append(button);}
      for(const dialog of [workflowDialog,picker]){dialog.querySelector('.workflow-close').addEventListener('click',()=>workflowCloseDialog(dialog));dialog.addEventListener('cancel',event=>{event.preventDefault();workflowCloseDialog(dialog);});dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)workflowCloseDialog(dialog);}});}
      $('#workflowCommandSearch').addEventListener('input',workflowRenderCommands);$('#workflowTrackSearch').addEventListener('input',workflowRenderPicker);
      $('#workflowTrackSearch').addEventListener('keydown',event=>{if(!['ArrowDown','Enter'].includes(event.key))return;const first=$('#workflowTrackChoices .workflow-track-choice');if(!first)return;event.preventDefault();event.stopPropagation();event.key==='Enter'?first.click():first.focus();});
      $('#workflowTrackChoices').addEventListener('keydown',event=>{const choice=event.target.closest('.workflow-track-choice');if(!choice||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const choices=[...$('#workflowTrackChoices').querySelectorAll('.workflow-track-choice')],index=choices.indexOf(choice),columns=getComputedStyle($('#workflowTrackChoices')).gridTemplateColumns.split(' ').length,step=event.key==='ArrowDown'?columns:event.key==='ArrowUp'?-columns:event.key==='ArrowLeft'?-1:1,next=event.key==='Home'?0:event.key==='End'?choices.length-1:clamp(index+step,0,choices.length-1);choices[next]?.focus();});
      $('#workflowCommandSearch').addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Enter'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='Enter')workflowExecuteCommand(workflowActiveCommand);else workflowSetActive(workflowActiveCommand+(event.key==='ArrowDown'?1:-1));}});
      document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='k'){if(document.querySelector('dialog[open]')&&!workflowDialog.open)return;event.preventDefault();event.stopImmediatePropagation();if(event.repeat)return;workflowDialog.open?workflowCloseDialog(workflowDialog):workflowOpenCommands();}},{capture:true});
      const launch=studioButton('Search',()=>workflowOpenCommands(),'text-button workflow-search-launch');launch.id='workflowSearchButton';launch.title='Search commands, tracks, and sounds (Ctrl / Cmd + K)';launch.setAttribute('aria-keyshortcuts','Control+K Meta+K');const shortcut=document.createElement('kbd');shortcut.textContent='⌘ / Ctrl K';launch.append(shortcut);$('.workspace-controls').prepend(launch);
      const add=studioButton('Add track',workflowOpenTrackPicker,'text-button workflow-add-track');add.id='workflowAddTrackButton';designButton(add,'plus');$('.track-add-actions').append(add);
      const empty=document.createElement('div');empty.id='workflowEmpty';empty.className='workflow-empty';empty.innerHTML='<div class="workflow-empty-card"><span class="workflow-eyebrow">YOUR SESSION IS READY</span><h2>Start your arrangement.</h2><p id="workflowEmptyDescription"></p><div class="workflow-empty-actions"></div><p class="workflow-empty-hint"><kbd>Space</kbd> play / pause <span>·</span> <kbd>Ctrl / ⌘ K</kbd> find any command</p></div>';
      const first=studioButton('Create first clip',addClip,'text-button pro-primary');first.id='workflowEmptyAction';empty.querySelector('.workflow-empty-actions').append(first,studioButton('Choose a sound',()=>workflowOpenCommands('sounds')),studioButton('Import audio',()=>$('#studioAudioInput').click()),studioButton('Create with AI',()=>$('#assistantButton')?.click()));$('.arrangement-pane').append(empty);
      const context=document.createElement('div');context.id='workflowContext';context.className='workflow-context';context.innerHTML='<div class="workflow-context-selection"><strong id="workflowContextTrack"></strong><span aria-hidden="true">›</span><span id="workflowContextClip"></span></div><div class="workflow-context-actions"></div>';
      const sound=studioButton('Change sound',()=>workflowOpenCommands('sounds'),'text-button');sound.id='workflowContextSound';const loop=studioButton('Loop clip',()=>sessionLoopClip(),'text-button');loop.id='workflowContextLoop';const newClip=studioButton('Create clip',addClip,'text-button');newClip.id='workflowContextNew';context.querySelector('.workflow-context-actions').append(sound,loop,newClip);$('#editorResizeGrip').after(context);
      const transportState=document.createElement('span');transportState.id='workflowTransportState';transportState.className='workflow-transport-state';transportState.setAttribute('aria-label','Transport state');$('.transport').append(transportState);
      document.addEventListener('click',event=>{if(event.target.closest('#recordButton,#studioRecordMic,#countInButton'))workflowUpdateTransport();});
      const help=document.createElement('p');help.textContent='Ctrl / Cmd + K: find commands, tracks, and sounds. Use Add track to choose an instrument or drum kit. New tracks start empty; Create clip adds an editable pattern. Tab reaches track rows; Enter selects the focused track.';$('#studioHelp').append(help);
      const workflowTracksBase=renderTracks;renderTracks=function(...args){workflowTracksBase(...args);for(const row of trackListEl.querySelectorAll('.track-row')){row.tabIndex=0;row.setAttribute('role','group');const track=project.tracks.find(t=>t.id===row.dataset.track);row.setAttribute('aria-label',`${track?.name}, ${track?.instrument}${row.classList.contains('selected')?', selected':''}`);row.addEventListener('keydown',event=>{if(event.target!==row||!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();const id=row.dataset.track;workflowSelectTrack(id);[...trackListEl.children].find(item=>item.dataset.track===id)?.focus({preventScroll:true});});}workflowRenderState();};
      const workflowArrangementBase=renderArrangement;renderArrangement=function(...args){workflowArrangementBase(...args);workflowRenderState();};
      const workflowEditorBase=renderEditor;renderEditor=function(...args){workflowEditorBase(...args);workflowRenderState();};
      const workflowMeterBase=renderMixerMeters;renderMixerMeters=function(...args){workflowMeterBase(...args);workflowUpdateTransport();};
      const workflowStatusBase=updateStatus;updateStatus=function(...args){workflowStatusBase(...args);workflowRenderState();};
      const workflowStopBase=stopPlayback;stopPlayback=function(...args){const result=workflowStopBase(...args);workflowUpdateTransport();return result;};
      const workflowStartBase=startPlayback;startPlayback=async function(...args){const result=await workflowStartBase(...args);workflowUpdateTransport();return result;};
      window.SonoraWorkflow=Object.freeze({openCommands:workflowOpenCommands,openTrackPicker:workflowOpenTrackPicker});
      workflowRenderState();
