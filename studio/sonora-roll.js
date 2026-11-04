      // Piano roll studio layer: a real keyboard, a calmer toolbar, chord awareness,
      // live playback feedback, a slice tool, velocity painting and clearer pattern bounds.
      // It wraps the existing roll (same DOM contract, same data model) instead of replacing it.
      const ROLL_NOTE_NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
      const ROLL_INTERVALS=['Unison','Minor 2nd','Major 2nd','Minor 3rd','Major 3rd','Perfect 4th','Tritone','Perfect 5th','Minor 6th','Major 6th','Minor 7th','Major 7th'];
      const ROLL_CHORDS=[
        ['',[0,4,7]],['m',[0,3,7]],['dim',[0,3,6]],['aug',[0,4,8]],['sus2',[0,2,7]],['sus4',[0,5,7]],
        ['7',[0,4,7,10]],['maj7',[0,4,7,11]],['m7',[0,3,7,10]],['m7♭5',[0,3,6,10]],['dim7',[0,3,6,9]],['m(maj7)',[0,3,7,11]],
        ['6',[0,4,7,9]],['m6',[0,3,7,9]],['add9',[0,2,4,7]],['m(add9)',[0,2,3,7]],['7sus4',[0,5,7,10]],
        ['9',[0,2,4,7,10]],['maj9',[0,2,4,7,11]],['m9',[0,2,3,7,10]]
      ];
      const ROLL_ICONS={
        draw:'<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>',
        select:'<path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/><path d="M11 11l6 2.2-2.4 1.1-1.1 2.4z"/>',
        erase:'<path d="M8 20 3.6 15.6a2 2 0 0 1 0-2.8L13 3.4a2 2 0 0 1 2.8 0l4.8 4.8a2 2 0 0 1 0 2.8L12 19.6"/><path d="M8 20h12M8.5 9.5l6 6"/>',
        slice:'<circle cx="6" cy="7" r="2.4"/><circle cx="6" cy="17" r="2.4"/><path d="M20 5 8 15.5M20 19 8 8.5"/>',
        minus:'<path d="M6 12h12"/>',plus:'<path d="M12 6v12M6 12h12"/>',
        fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
        follow:'<path d="M5 12h12"/><path d="m13 7 5 5-5 5"/><path d="M20 5v14"/>',
        keys:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14"/>'
      };
      const rollStudio={follow:true,lastInteraction:0,paintKey:'',chordKey:'',frame:0};
      try{rollStudio.follow=localStorage.getItem('sonora-roll-follow')!=='off';}catch(_){}

      function rollIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','14');svg.setAttribute('height','14');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.innerHTML=ROLL_ICONS[name]||'';return svg;}
      function rollNoteName(pc){return ROLL_NOTE_NAMES[((pc%12)+12)%12];}
      // Exact pitch-class matching keeps the answer honest: no guess when the notes are not a known chord.
      function rollChordName(pitches){
        const classes=[...new Set(pitches.map(p=>((p%12)+12)%12))];
        if(classes.length<2)return '';
        const low=Math.min(...pitches),bass=((low%12)+12)%12;
        if(classes.length===2){const [a,b]=classes,gap=(b-a+12)%12,span=Math.max(...pitches)-low;if(gap===7||gap===5){const root=gap===7?a:b;return `${rollNoteName(root)}5`;}return span>=12&&span%12===0?'Octave':ROLL_INTERVALS[(Math.max(...classes.map(c=>(c-bass+12)%12)))]||'';}
        let best=null;
        for(const root of classes){
          const set=new Set(classes.map(c=>(c-root+12)%12));
          for(const [suffix,shape] of ROLL_CHORDS){
            if(set.size!==shape.length||!shape.every(i=>set.has(i)))continue;
            const rank=(root===bass?0:10)+ROLL_CHORDS.findIndex(c=>c[0]===suffix)/100;
            if(!best||rank<best.rank)best={rank,name:`${rollNoteName(root)}${suffix}${root===bass?'':`/${rollNoteName(bass)}`}`};
          }
        }
        return best?best.name:'';
      }

      // Everything that is sounding right now: notes under the playhead, plus live keys.
      function rollSounding(){
        const pitches=new Set(),notes=new Set();
        const track=getTrack(),clip=track&&track.type==='synth'?selectedClipFor(track):null;
        if(audio.playing&&clip){
          const inside=audio.playheadBeat>=clip.start&&audio.playheadBeat<clip.start+clip.length,phase=(((audio.playheadBeat-clip.start)%16)+16)%16;
          if(inside)notesForClip(track,clip).forEach(note=>{if(note.start<=phase&&phase<note.start+note.duration){notes.add(note);pitches.add(note.pitch);}});
        }
        for(const live of activeLiveNotes.values())if(Number.isFinite(live.pitch))pitches.add(live.pitch);
        return {pitches,notes};
      }
      function rollPaintKeys(sounding=rollSounding()){
        const labels=$('.piano-labels');if(!labels)return;
        const track=getTrack(),clip=track.type==='synth'?selectedClipFor(track):null,notes=clip?notesForClip(track,clip):[],chosen=new Set(selectedNoteList().map(note=>note.pitch));
        const soundNotes=notes.map((note,index)=>sounding.notes.has(note)?index:-1).filter(index=>index>=0),elements=$('#noteLayer')?._noteElements;
        const key=`${[...sounding.pitches].sort().join()}|${[...chosen].sort().join()}|${soundNotes.join()}`;
        if(key===rollStudio.paintKey&&labels===rollStudio.paintLabels&&elements===rollStudio.paintElements)return;
        rollStudio.paintKey=key;rollStudio.paintLabels=labels;rollStudio.paintElements=elements;
        for(const label of labels.children){const pitch=Number(label.dataset.pitch);label.classList.toggle('is-sounding',sounding.pitches.has(pitch));label.classList.toggle('is-chosen',chosen.has(pitch));}
        if(elements)elements.forEach((element,index)=>element.classList.toggle('is-sounding',soundNotes.includes(index)));
        const chip=$('#rollChordChip');
        if(chip){
          const listening=chosen.size>1?[...chosen]:[...sounding.pitches],name=listening.length>1?rollChordName(listening):'';
          chip.querySelector('strong').textContent=name||'—';
          chip.querySelector('small').textContent=chosen.size>1?'SELECTION':sounding.pitches.size>1?'PLAYING':'CHORD';
          chip.classList.toggle('is-active',Boolean(name));
        }
      }
      // While the transport runs, keep the playhead in view when the roll is zoomed in.
      function rollFollow(){
        if(!rollStudio.follow||!audio.playing||audio.drag||performance.now()-rollStudio.lastInteraction<1800)return;
        const workspace=$('.piano-workspace'),roll=$('#pianoRoll'),clip=selectedClipFor();
        if(!workspace||!roll||!clip||workspace.scrollWidth<=workspace.clientWidth+2)return;
        const phase=(((audio.playheadBeat-clip.start)%16)+16)%16,x=58+phase/16*roll.clientWidth,visibleWidth=workspace.clientWidth-58;
        if(x<workspace.scrollLeft+58+8||x>workspace.scrollLeft+workspace.clientWidth-48)workspace.scrollLeft=Math.max(0,x-58-visibleWidth*.14);
      }
      function rollTick(){
        rollStudio.frame=0;
        if($('.piano-editor')){rollPaintKeys();rollFollow();}
        if(audio.playing||activeLiveNotes.size)rollStudio.frame=requestAnimationFrame(rollTick);
      }
      function rollWake(){if(!rollStudio.frame)rollStudio.frame=requestAnimationFrame(rollTick);}
      const rollBaseLiveDown=liveNoteDown;liveNoteDown=function(...args){const result=rollBaseLiveDown.apply(this,args);rollWake();return result;};
      const rollBaseLiveUp=liveNoteUp;liveNoteUp=function(...args){const result=rollBaseLiveUp.apply(this,args);rollWake();return result;};
      const rollBaseMeters=renderMixerMeters;renderMixerMeters=function(...args){rollBaseMeters.apply(this,args);if(audio.playing)rollWake();};
      const rollBaseStart=startPlayback;startPlayback=async function(...args){const result=await rollBaseStart.apply(this,args);rollWake();return result;};
      const rollBaseStop=stopPlayback;stopPlayback=function(...args){const result=rollBaseStop.apply(this,args);rollWake();return result;};
      const rollBaseReadout=proRollReadout;proRollReadout=function(track,notes,hover=''){rollBaseReadout(track,notes,hover);rollPaintKeys();};
      const rollBaseRenderNotes=renderNotes;renderNotes=function(track,notes,base,layer,skipVelocity=false){rollBaseRenderNotes(track,notes,base,layer,skipVelocity);const empty=$('.roll-empty');if(empty)empty.hidden=notes.length>0;};

      // Velocity lane: lollipop stems, a taller target and click-drag painting across several notes.
      function rollVelocityRange(lane){return Math.max(24,(lane.clientHeight||74)-16);}
      proStyleVelocityBar=function(bar,track,note,index){
        const lane=bar.parentElement,velocity=note.velocity??.78,percent=Math.round(velocity*100);
        bar.className=`pro-velocity-bar${selectedNotes.has(note)?' selected':''}`;bar.dataset.index=index;
        bar.style.left=`max(0px,calc(${note.start/16*100}% - 7px))`;bar.style.height=`${Math.round(6+velocity*(lane?rollVelocityRange(lane):58))}px`;bar.style.setProperty('--note-color',track.color);bar.dataset.value=`${percent}`;
        bar.title=`${pitchName(note.pitch)} · velocity ${percent}%`;bar.setAttribute('aria-label',`${pitchName(note.pitch)} velocity`);bar.setAttribute('aria-valuenow',String(percent));
      };
      proVelocityBars=function(track,notes){
        const lane=$('#proVelocityLane');if(!lane)return;
        const restyle=()=>{for(const bar of lane.children){const note=notes[Number(bar.dataset.index)];if(note)proStyleVelocityBar(bar,track,note,Number(bar.dataset.index));}};
        if(!lane._rollPaint){
          lane._rollPaint=true;let paint=null;
          const paintAt=event=>{
            const rect=lane.getBoundingClientRect(),x=event.clientX-rect.left,value=clamp(1-(event.clientY-rect.top-8)/rollVelocityRange(lane),.01,1),reach=Math.max(7,rect.width/16*.0625);
            let touched=false;for(const note of notesForClip(getTrack())){if(Math.abs(note.start/16*rect.width-x)<=reach){note.velocity=Number(value.toFixed(2));touched=true;}}
            if(touched){paint.changed=true;restyle();renderNotes(getTrack(),notesForClip(getTrack()),pianoBase(getTrack()),$('#noteLayer'),true);updateNoteControls();}
          };
          lane.addEventListener('pointerdown',event=>{if(event.button!==0||event.target!==lane)return;event.preventDefault();editFocus='notes';const notes=notesForClip(getTrack());paint={before:JSON.stringify(project),changed:false,original:notes.map(note=>[note,note.velocity])};lane.setPointerCapture(event.pointerId);paintAt(event);});
          lane.addEventListener('pointermove',event=>{if(paint&&lane.hasPointerCapture(event.pointerId))paintAt(event);});
          const done=cancelled=>{if(!paint)return;const state=paint;paint=null;if(cancelled){state.original.forEach(([note,value])=>{if(value===undefined)delete note.velocity;else note.velocity=value;});restyle();redrawNotes();return;}if(state.changed)commitNoteEdit(state.before);};
          lane.addEventListener('pointerup',()=>done(false));lane.addEventListener('pointercancel',()=>done(true));
        }
        if(lane.dataset.trackId===track.id&&lane.children.length===notes.length&&notes.every((note,index)=>lane.children[index]._note===note)){restyle();return;}
        lane.dataset.trackId=track.id;lane.replaceChildren();
        notes.forEach((note,index)=>{
          const bar=document.createElement('button');bar.type='button';bar._note=note;bar.setAttribute('role','slider');bar.setAttribute('aria-valuemin','1');bar.setAttribute('aria-valuemax','100');lane.append(bar);proStyleVelocityBar(bar,track,note,index);
          let drag=null;
          bar.addEventListener('pointerdown',event=>{
            event.preventDefault();event.stopPropagation();editFocus='notes';
            if(!selectedNotes.has(note)){if(!event.shiftKey)selectedNotes.clear();selectedNotes.add(note);audio.selectedNote=note;}
            drag={before:JSON.stringify(project),items:selectedNoteList().map(item=>({note:item,value:item.velocity??.78})),y:event.clientY};
            bar.setPointerCapture(event.pointerId);bar.classList.add('is-dragging');
            renderNotes(track,notes,pianoBase(track),$('#noteLayer'),true);for(const other of lane.children)other.classList.toggle('selected',selectedNotes.has(notes[Number(other.dataset.index)]));updateNoteControls();
          });
          bar.addEventListener('pointermove',event=>{
            if(!drag)return;const delta=(drag.y-event.clientY)/rollVelocityRange(lane);
            drag.items.forEach(item=>item.note.velocity=clamp(item.value+delta,.01,1));restyle();
            renderNotes(track,notes,pianoBase(track),$('#noteLayer'),true);updateNoteControls();
          });
          const finish=cancelled=>{if(!drag)return;const state=drag;drag=null;bar.classList.remove('is-dragging');if(cancelled)state.items.forEach(item=>item.note.velocity=item.value);commitNoteEdit(state.before);};
          bar.addEventListener('pointerup',()=>finish(false));bar.addEventListener('pointercancel',()=>finish(true));
          bar.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const before=JSON.stringify(project);note.velocity=clamp((note.velocity??.78)+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?.1:.01),.01,1);commitNoteEdit(before);});
        });
      };

      function rollSetZoom(value){
        proRoll.zoom=clamp(value,1,8);const label=$('#proRollZoom');if(label)label.textContent=`${Math.round(proRoll.zoom*100)}%`;renderEditor();
      }
      function rollToggleFollow(button){
        rollStudio.follow=!rollStudio.follow;button.classList.toggle('active',rollStudio.follow);button.setAttribute('aria-pressed',String(rollStudio.follow));
        try{localStorage.setItem('sonora-roll-follow',rollStudio.follow?'on':'off');}catch(_){}
        notify(rollStudio.follow?'Roll follows the playhead':'Roll stays where you scroll it');
      }
      function rollBuildToolbar(){
        const bar=$('#noteToolbar'),controls=$('#proRollControls'),tools=bar?.querySelector('.note-tool-switch');
        if(!bar||!controls||!tools||bar.dataset.rollBuilt)return;bar.dataset.rollBuilt='1';bar.classList.add('roll-toolbar');
        const group=(name,label,...children)=>{const element=document.createElement('div');element.className=`roll-group roll-${name}`;if(label)element.dataset.label=label;children.filter(Boolean).forEach(child=>element.append(child));return element;};
        const slice=document.createElement('button');slice.dataset.noteTool='slice';slice.textContent='Slice';tools.append(slice);
        const shortcuts={draw:'1',select:'2',erase:'3',slice:'4'},blurbs={draw:'Draw notes',select:'Select with a box',erase:'Erase notes',slice:'Slice a note in two at the grid'};
        tools.querySelectorAll('[data-note-tool]').forEach(button=>{const kind=button.dataset.noteTool,name=button.textContent.trim();button.title=`${blurbs[kind]} (${shortcuts[kind]})`;button.setAttribute('aria-label',blurbs[kind]);button.replaceChildren(rollIcon(kind),Object.assign(document.createElement('span'),{textContent:name}));});
        const length=$('#noteLength');let lengthLabel=null;if(length){lengthLabel=document.createElement('label');lengthLabel.className='roll-length';lengthLabel.append(Object.assign(document.createElement('span'),{textContent:'Length'}),length);}
        const menus=[...bar.querySelectorAll(':scope > details.design-menu')],[actionsMenu,chordsMenu,propertiesMenu]=menus;
        for(const [menu,name] of [[actionsMenu,'Actions'],[chordsMenu,'Chords'],[propertiesMenu,'Properties']]){const summary=menu?.querySelector('summary');if(summary?.firstChild?.nodeType===Node.TEXT_NODE)summary.firstChild.textContent=name;}
        if(chordsMenu&&propertiesMenu){
          actionsMenu?.querySelector('.design-menu-body')?.append(chordsMenu,propertiesMenu);
        }
        const status=$('#noteSelectionStatus');
        const find=(selector,text)=>[...controls.querySelectorAll(selector)].find(el=>!text||el.textContent.trim()===text);
        const root=controls.querySelector('select[aria-label="Scale root"]'),scale=controls.querySelector('select[aria-label="Scale guide"]'),toggles=[...controls.querySelectorAll('label')];
        toggles.forEach(label=>label.classList.add('roll-chip'));
        const zoom=$('#proRollZoom'),pitch=$('#proPitchZoom'),fit=find('button','Fit notes'),keyboard=find('button','Keyboard');
        const iconButton=(name,text,title,action,extra='')=>{const button=studioButton('',action,`text-button roll-tool-button ${extra}`.trim());button.append(rollIcon(name));if(text)button.append(Object.assign(document.createElement('span'),{textContent:text}));button.title=title;button.setAttribute('aria-label',title);return button;};
        const zoomOut=iconButton('minus','','Zoom out',()=>rollSetZoom(proRoll.zoom/2),'roll-icon-only'),zoomIn=iconButton('plus','','Zoom in · Ctrl + wheel for smooth zoom',()=>rollSetZoom(proRoll.zoom*2),'roll-icon-only');
        zoom.title='Time zoom · click to cycle';zoom.classList.add('roll-zoom-value');
        pitch.title='Row height';pitch.setAttribute('aria-label','Piano roll pitch size');
        if(fit){fit.replaceChildren(rollIcon('fit'),Object.assign(document.createElement('span'),{textContent:'Fit'}));fit.title='Fit the view to your notes';fit.classList.add('roll-tool-button');}
        const follow=iconButton('follow','Follow','Keep the playhead in view during playback',()=>rollToggleFollow(follow),rollStudio.follow?'active':'');follow.setAttribute('aria-pressed',String(rollStudio.follow));
        if(keyboard){keyboard.replaceChildren(rollIcon('keys'),Object.assign(document.createElement('span'),{textContent:'Keys'}));keyboard.title='Show a playable keyboard under the roll';keyboard.classList.add('roll-tool-button');}
        const chip=document.createElement('div');chip.className='roll-chord';chip.id='rollChordChip';chip.setAttribute('role','status');chip.setAttribute('aria-live','polite');chip.title='Chord of the selected notes, or of what is playing';chip.innerHTML='<small>CHORD</small><strong>—</strong>';
        const velocity=bar.querySelector('.velocity-control');
        controls.replaceChildren(group('scale','Scale',root,scale,...toggles),group('view','View',zoomOut,zoom,zoomIn,pitch,fit,follow,keyboard));
        bar.replaceChildren(...[group('tools','',tools,lengthLabel),group('edit','',actionsMenu,status),controls,chip,velocity].filter(Boolean));
      }

      // Per-render decoration of the roll that the base renderer builds.
      function rollEnhance(piano,track,clip){
        const roll=$('#pianoRoll'),workspace=$('.piano-workspace'),labels=piano.querySelector('.piano-labels'),notes=clip?notesForClip(track,clip):[];
        if(!roll||!workspace||!labels)return;
        piano.dataset.tool=noteTool;rollStudio.paintKey='';
        const zoomLabel=$('#proRollZoom');if(zoomLabel)zoomLabel.textContent=`${Math.round(proRoll.zoom*100)}%`;
        const rows=roll.querySelectorAll('.pro-pitch-row');
        labels.querySelectorAll('.piano-label').forEach((label,row)=>label.classList.toggle('in-scale',Boolean(rows[row]?.classList.contains('in-scale'))));

        // Keys: press and glide to audition several pitches.
        let glide=null;
        labels.addEventListener('pointerdown',event=>{const label=event.target.closest('.piano-label');if(!label||event.button!==0)return;glide={pitch:Number(label.dataset.pitch)};try{labels.setPointerCapture(event.pointerId);}catch(_){}});
        labels.addEventListener('pointermove',event=>{if(!glide)return;const rect=labels.getBoundingClientRect(),row=clamp(Math.floor((event.clientY-rect.top)/proRoll.rowHeight),0,127),pitch=127-row;if(pitch!==glide.pitch){glide.pitch=pitch;previewMovedNote(track,{pitch,velocity:.8,duration:.3});}});
        for(const type of ['pointerup','pointercancel','lostpointercapture'])labels.addEventListener(type,()=>{glide=null;});

        // Ghost note that previews where the next drawn note will land.
        const cursor=document.createElement('div');cursor.className='roll-cursor';cursor.hidden=true;
        const guide=document.createElement('div');guide.className='roll-slice-guide';guide.hidden=true;
        const end=document.createElement('div');end.className='roll-end';end.hidden=!clip||clip.length>=16;if(clip&&clip.length<16){end.style.left=`${clip.length/16*100}%`;end.title=`Notes after beat ${Number(clip.length.toFixed(2))} sit past the end of this clip and do not play`;}
        roll.append(end,cursor,guide);
        const snapValue=()=>Number($('#snapSelect').value)||.0625;
        roll.addEventListener('pointermove',event=>{
          const rect=roll.getBoundingClientRect(),overNote=event.target.closest('.note');
          cursor.hidden=true;guide.hidden=true;
          if(!clip||audio.drag||event.buttons)return;
          if(noteTool==='slice'&&overNote){
            const note=notes[Number(overNote.dataset.index)];if(!note)return;
            const snap=snapValue(),cut=Math.round((event.clientX-rect.left)/rect.width*16/snap)*snap,inside=cut>note.start+.0624&&cut<note.start+note.duration-.0624;
            if(inside){guide.style.left=`${cut/16*100}%`;guide.style.top=overNote.style.top;guide.hidden=false;}
            return;
          }
          if(noteTool!=='draw'||overNote)return;
          const snap=snapValue(),x=clamp((event.clientX-rect.left)/rect.width,0,.9999),y=clamp((event.clientY-rect.top)/rect.height,0,.9999),start=clamp(Math.floor(x*16/snap)*snap,0,16-snap),pitch=proSnapPitch(127-Math.floor(y*128)),span=Math.min(Number($('#noteLength').value)||1,16-start);
          cursor.style.left=`${start/16*100}%`;cursor.style.width=`${span/16*100}%`;cursor.style.top=`${(127-pitch)/128*100}%`;cursor.dataset.pitch=pitchName(pitch);cursor.hidden=false;
        });
        roll.addEventListener('pointerleave',()=>{cursor.hidden=true;guide.hidden=true;});
        roll.addEventListener('pointerdown',()=>{cursor.hidden=true;},true);

        // Slice tool: click a note to cut it at the nearest grid line. Registered in capture so the draw handler never sees it.
        roll.addEventListener('pointerdown',event=>{
          if(noteTool!=='slice'||event.button!==0)return;
          event.preventDefault();event.stopImmediatePropagation();editFocus='notes';roll.focus({preventScroll:true});
          const element=event.target.closest('.note');if(!element||!clip)return;
          const note=notes[Number(element.dataset.index)];if(!note)return;
          const rect=roll.getBoundingClientRect(),snap=snapValue(),cut=Number((Math.round((event.clientX-rect.left)/rect.width*16/snap)*snap).toFixed(3));
          if(cut<=note.start+.0624||cut>=note.start+note.duration-.0624){notify('Click inside the note, away from its edges, to slice it');return;}
          const before=JSON.stringify(project),tail={...clone(note),start:cut,duration:Number((note.start+note.duration-cut).toFixed(3))};
          note.duration=Number((cut-note.start).toFixed(3));notes.push(tail);selectedNotes.clear();selectedNotes.add(note);selectedNotes.add(tail);audio.selectedNote=note;
          guide.hidden=true;commitNoteEdit(before);
        },true);

        // Middle mouse drag pans in both directions; any manual scroll pauses playhead-follow for a moment.
        workspace.addEventListener('mousedown',event=>{if(event.button===1)event.preventDefault();});
        workspace.addEventListener('pointerdown',event=>{
          rollStudio.lastInteraction=performance.now();if(event.button!==1)return;
          event.preventDefault();const origin={x:event.clientX,y:event.clientY,left:workspace.scrollLeft,top:workspace.scrollTop};
          try{workspace.setPointerCapture(event.pointerId);}catch(_){}workspace.classList.add('is-panning');
          const move=moved=>{workspace.scrollLeft=origin.left-(moved.clientX-origin.x);workspace.scrollTop=origin.top-(moved.clientY-origin.y);};
          const stop=()=>{workspace.classList.remove('is-panning');workspace.removeEventListener('pointermove',move);workspace.removeEventListener('pointerup',stop);workspace.removeEventListener('pointercancel',stop);};
          workspace.addEventListener('pointermove',move);workspace.addEventListener('pointerup',stop);workspace.addEventListener('pointercancel',stop);
        });
        workspace.addEventListener('wheel',()=>{rollStudio.lastInteraction=performance.now();},{passive:true});

        // Guidance when the pattern is empty or there is no clip yet.
        const empty=document.createElement('div');empty.className='roll-empty';empty.hidden=notes.length>0;
        const card=document.createElement('div');card.className='roll-empty-card';
        const title=document.createElement('strong');title.textContent=clip?'Draw your first notes':'Create a clip to start writing';
        const hint=document.createElement('span');hint.textContent=clip?'Click and drag to draw · double-click for a single note · Shift-drag to select':'A clip holds the notes you write here.';
        card.append(title,hint);if(!clip)card.append(studioButton('Create clip',addClip,'text-button roll-empty-action'));empty.append(card);piano.append(empty);
        rollPaintKeys();rollWake();
      }
      const rollBaseRenderPiano=renderPiano;
      renderPiano=function(track,clip=selectedClipFor(track)){
        rollBaseRenderPiano(track,clip);
        const piano=editorBodyEl.querySelector('.piano-editor');
        if(piano)rollEnhance(piano,track,clip);
      };
      window.addEventListener('keydown',event=>{
        if(event.key!=='4'||event.ctrlKey||event.metaKey||event.altKey||editorTab!=='piano'||editFocus!=='notes')return;
        if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;
        event.preventDefault();noteTool='slice';renderEditor();
      });
      rollBuildToolbar();
      {const help=$('#studioHelp'),note=document.createElement('p');note.textContent='Piano roll extras: press 4 or choose Slice to cut a note at the grid. Click and glide along the keys to audition pitches. Drag on the velocity lane to paint dynamics across notes. Middle-drag pans, Follow keeps the playhead in view, and the chord badge names the selected notes or what is playing.';if(help)help.append(note);}
