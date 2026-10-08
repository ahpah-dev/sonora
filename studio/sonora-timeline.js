      // Timeline selection is transient UI state; project edits share normal Undo.
      const timelineSelected = new Set();
      const timelinePane = $('.arrangement-pane');
      let timelinePrimary, timelineGesture = null, timelineFrame = null, timelineIgnoreClick = false;
      function timelineEntries(){return project.tracks.flatMap(track=>(track.clips||[]).map(clip=>({track,clip})));}
      function timelineSelection(){return timelineEntries().filter(({clip})=>timelineSelected.has(clip.id));}
      function timelineSync(){
        if(timelinePrimary!==project.selectedClip){timelineSelected.clear();if(project.selectedClip)timelineSelected.add(project.selectedClip);timelinePrimary=project.selectedClip;}
        const ids=new Set(timelineEntries().map(({clip})=>clip.id));
        for(const id of timelineSelected)if(!ids.has(id))timelineSelected.delete(id);
        gridEl.querySelectorAll('.clip').forEach(el=>{const selected=timelineSelected.has(el.dataset.clipId);el.classList.toggle('selected',selected);el.setAttribute('aria-selected',String(selected));});
        $('#timelineSelectionStatus').textContent=timelineSelected.size>1?`${timelineSelected.size} clips selected`:'';
      }
      function timelineChoose(ids){
        const chosen=new Set(ids);timelineSelected.clear();chosen.forEach(id=>timelineSelected.add(id));
        const entries=timelineSelection(),primary=entries.find(({clip})=>clip.id===project.selectedClip)||entries[0];
        project.selectedClip=primary?.clip.id||null;timelinePrimary=project.selectedClip;
        if(primary){project.selectedTrack=primary.track.id;editorTab=primary.track.type==='audio'?'audio':primary.track.type==='drums'?'drums':'piano';}
        editFocus='clips';audio.selectedNote=null;timelineSync();renderTracks();renderEditor();updateDuplicateButton();
      }
      function timelineZoom(value,clientX){
        if(timelineGesture||arrangeDrag)return;
        const previous=clamp(finiteNumber(project.zoom,1),.125,4),rect=gridEl.getBoundingClientRect(),paneRect=timelinePane.getBoundingClientRect();
        const anchor=clientX??paneRect.left+timelinePane.clientWidth/2,position=(anchor-rect.left)/rect.width;
        project.zoom=clamp(value,.125,4);renderArrangement();
        timelinePane.scrollLeft+=position*gridEl.getBoundingClientRect().width-(anchor-gridEl.getBoundingClientRect().left);
        if(previous!==project.zoom)setDirty();
      }
      const timelineZoomLabel=document.createElement('span');timelineZoomLabel.id='timelineZoomLevel';timelineZoomLabel.className='timeline-zoom-level';timelineZoomLabel.setAttribute('aria-label','Timeline zoom');
      $('#zoomIn').after(timelineZoomLabel);
      const timelineSelectionStatus=document.createElement('span');timelineSelectionStatus.id='timelineSelectionStatus';timelineSelectionStatus.className='timeline-selection-status';timelineSelectionStatus.setAttribute('role','status');$('.arrange-title').append(timelineSelectionStatus);
      const timelineRenderBase=renderArrangement;renderArrangement=function(){
        project.zoom=clamp(finiteNumber(project.zoom,1),.125,4);timelineRenderBase();timelineSync();
        timelineZoomLabel.textContent=`${Math.round(project.zoom*100)}%`;$('#zoomOut').disabled=project.zoom<=.125;$('#zoomIn').disabled=project.zoom>=4;
        const barWidth=gridEl.getBoundingClientRect().width/arrangementBars(),step=Math.max(1,2**Math.ceil(Math.log2(52/Math.max(1,barWidth))));
        rulerEl.querySelectorAll('.bar-number').forEach((el,index)=>{el.style.visibility=index%step===0?'visible':'hidden';});
      };
      timelinePane.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();timelineZoom(project.zoom*(event.deltaY>0?.8:1.25),event.clientX);},{passive:false});
      function timelinePoint(event){const rect=gridEl.getBoundingClientRect();return {x:clamp(event.clientX-rect.left,0,rect.width),y:clamp(event.clientY-rect.top,0,rect.height)};}
      function timelineDrawBox(){
        const drag=timelineGesture;if(!drag||drag.kind!=='box'||!drag.moved)return;
        const point=timelinePoint(drag.last),left=Math.min(drag.origin.x,point.x),top=Math.min(drag.origin.y,point.y),right=Math.max(drag.origin.x,point.x),bottom=Math.max(drag.origin.y,point.y),rect=gridEl.getBoundingClientRect();
        Object.assign(drag.box.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});drag.box.hidden=false;
        const ids=new Set(drag.additive?drag.initial:[]);
        gridEl.querySelectorAll('.clip').forEach(el=>{const r=el.getBoundingClientRect();if(r.left-rect.left<right&&r.right-rect.left>left&&r.top-rect.top<bottom&&r.bottom-rect.top>top)ids.add(el.dataset.clipId);});
        timelineSelected.clear();ids.forEach(id=>timelineSelected.add(id));timelineSync();
      }
      function timelineAutoScroll(){
        const drag=timelineGesture;if(!drag)return;
        if(drag.kind==='box'&&drag.moved){const r=timelinePane.getBoundingClientRect(),edge=28;
          timelinePane.scrollLeft+=drag.last.clientX>r.right-edge?14:drag.last.clientX<r.left+edge?-14:0;
          timelinePane.scrollTop+=drag.last.clientY>r.bottom-edge?10:drag.last.clientY<r.top+75?-10:0;
          timelineDrawBox();
        }
        timelineFrame=requestAnimationFrame(timelineAutoScroll);
      }
      function timelineSuppressClick(){timelineIgnoreClick=true;setTimeout(()=>timelineIgnoreClick=false,0);}
      gridEl.addEventListener('click',event=>{if(timelineIgnoreClick){event.stopImmediatePropagation();event.preventDefault();timelineIgnoreClick=false;}},true);
      gridEl.addEventListener('pointerdown',event=>{
        if(event.button!==0||arrangeTool!=='select'||event.target.closest('#playhead,.clip-delete'))return;
        timelineSync();const el=event.target.closest('.clip');
        if(el&&event.shiftKey){event.stopImmediatePropagation();event.preventDefault();const ids=new Set(timelineSelected);ids.has(el.dataset.clipId)?ids.delete(el.dataset.clipId):ids.add(el.dataset.clipId);timelineChoose(ids);timelineIgnoreClick=true;return;}
        if(el&&!event.target.closest('.clip-resize-handle,.clip-trim-left')&&timelineSelected.has(el.dataset.clipId)&&timelineSelected.size>1&&!event.altKey){
          event.stopImmediatePropagation();event.preventDefault();editFocus='clips';
          timelineGesture={kind:'group',pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,width:gridEl.getBoundingClientRect().width,beats:arrangementBeats(),before:JSON.stringify(project),entries:timelineSelection().map(entry=>({...entry,start:entry.clip.start})),moved:false};
          gridEl.setPointerCapture(event.pointerId);return;
        }
        if(el)return;
        event.preventDefault();editFocus='clips';const box=document.createElement('div');box.className='timeline-selection-box';box.hidden=true;gridEl.append(box);
        timelineGesture={kind:'box',pointerId:event.pointerId,origin:timelinePoint(event),startX:event.clientX,startY:event.clientY,last:event,initial:new Set(timelineSelected),initialPrimary:project.selectedClip,additive:event.shiftKey,box,moved:false};
        gridEl.setPointerCapture(event.pointerId);timelineFrame=requestAnimationFrame(timelineAutoScroll);
      },true);
      gridEl.addEventListener('pointerdown',()=>timelineSync());
      document.addEventListener('pointermove',event=>{
        const drag=timelineGesture;if(!drag||event.pointerId!==drag.pointerId)return;
        drag.last=event;if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>3)drag.moved=true;if(!drag.moved)return;
        if(drag.kind==='box'){timelineDrawBox();return;}
        const snap=Number($('#snapSelect').value),anchor=drag.entries[0].start,raw=(event.clientX-drag.startX)/drag.width*drag.beats;
        const delta=clamp(snap?Math.round((anchor+raw)/snap)*snap-anchor:raw,-Math.min(...drag.entries.map(e=>e.start)),4096-Math.max(...drag.entries.map(e=>e.start+e.clip.length)));
        drag.entries.forEach(({clip,start})=>{clip.start=Math.round((start+delta)*1000)/1000;const el=[...gridEl.querySelectorAll('.clip')].find(el=>el.dataset.clipId===clip.id);el.style.setProperty('--clip-left',`${clip.start/drag.beats*100}%`);el.classList.add('dragging');});
      });
      function timelineFinish(cancel=false){
        const drag=timelineGesture;if(!drag)return;timelineGesture=null;cancelAnimationFrame(timelineFrame);if(gridEl.hasPointerCapture(drag.pointerId))gridEl.releasePointerCapture(drag.pointerId);
        if(drag.kind==='box'){drag.box.remove();timelineChoose(cancel?drag.initial:drag.moved?timelineSelected:drag.additive?drag.initial:[]);}
        else{if(cancel)drag.entries.forEach(({clip,start})=>clip.start=start);renderArrangement();if(drag.moved&&!cancel){pushUndoSnapshot(drag.before);setDirty();}}
        if(drag.moved||cancel)timelineSuppressClick();
      }
      document.addEventListener('pointerup',event=>{if(event.pointerId===timelineGesture?.pointerId)timelineFinish();});
      document.addEventListener('pointercancel',event=>{if(event.pointerId===timelineGesture?.pointerId)timelineFinish(true);});
      window.addEventListener('blur',()=>timelineFinish(true));
      window.addEventListener('keydown',event=>{
        if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||document.activeElement.isContentEditable||document.querySelector('dialog[open]'))return;
        if(event.key==='Escape'&&timelineGesture){event.preventDefault();event.stopImmediatePropagation();timelineFinish(true);return;}
        if(editFocus!=='clips')return;
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();event.stopImmediatePropagation();timelineChoose(new Set(timelineEntries().map(({clip})=>clip.id)));return;}
        if(event.key==='Escape'){timelineChoose(new Set());return;}
        if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(!timelineSelected.size)return;const before=JSON.stringify(project),count=timelineSelected.size;
          project.tracks.forEach(track=>track.clips=track.clips.filter(clip=>!timelineSelected.has(clip.id)));timelineChoose(new Set());renderArrangement();pushUndoSnapshot(before);setDirty();notify(`${count} clip${count===1?'':'s'} deleted`);
        }
      },true);
      const timelineDuplicateBase=duplicateSelectedClip;duplicateSelectedClip=function(){
        const entries=timelineSelection();if(entries.length<2){timelineDuplicateBase();return;}
        const before=JSON.stringify(project),first=Math.min(...entries.map(({clip})=>clip.start)),last=Math.max(...entries.map(({clip})=>clip.start+clip.length)),ids=new Set();
        entries.forEach(({track,clip})=>{const copy={...clone(clip),id:nextClipId(track),name:`${clip.name} copy`,start:clip.start+last-first};track.clips.push(copy);ids.add(copy.id);});
        timelineChoose(ids);renderArrangement();pushUndoSnapshot(before);setDirty();notify('Selected clips duplicated');
      };
      const timelineRestoreBase=restoreProjectSnapshot;restoreProjectSnapshot=function(...args){timelineSelected.clear();timelinePrimary=undefined;timelineRestoreBase(...args);};
      const timelineHelp=document.createElement('p');timelineHelp.textContent='Timeline: use − / + or Ctrl / Cmd + wheel to zoom from 13% to 400%. Drag an empty area with the Select tool to select clips across tracks. Shift extends the selection. Drag selected clips to move them together; Delete removes the selection and Ctrl / Cmd + D duplicates it. Escape cancels a selection drag.';$('#studioHelp').append(timelineHelp);
