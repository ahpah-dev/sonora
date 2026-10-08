(async()=>{
  const api=window.sonoraVerification,q=selector=>document.querySelector(selector),results=[];
  const check=(condition,label)=>{if(!condition)throw Error(label);results.push('PASS '+label);};
  const original=JSON.stringify(api.getProject());
  const input=(selector,value)=>{const field=q(selector);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));};
  const resultByName=name=>[...q('#workflowCommandResults').children].find(row=>row.querySelector('strong')?.textContent===name);
  const closeDialogs=()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  try{
    closeDialogs();q('#stopButton').click();api.sessionStarter('empty');
    check(api.getProject().tracks[0].clips.length===0&&!q('#workflowEmpty').hidden,'fresh session stays empty and exposes useful starting actions');
    q('#workflowEmptyAction').click();check(api.getProject().tracks[0].clips.length===1&&q('#workflowEmpty').hidden,'first clip action creates an editable clip and dismisses empty guidance');
    q('#undoButton').click();check(api.getProject().tracks[0].clips.length===0&&!q('#workflowEmpty').hidden,'first clip action has a complete undo');
    q('#workflowSearchButton').focus();q('#workflowSearchButton').click();check(q('#workflowCommandDialog').open&&document.activeElement===q('#workflowCommandSearch'),'command search opens with keyboard focus');
    input('#workflowCommandSearch','create empty clip');check(resultByName('Create an empty clip'),'command search matches words across a useful action name');
    q('#workflowCommandSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    check(!q('#workflowCommandDialog').open&&api.getProject().tracks[0].clips.length===1,'Enter executes the selected command without leaking transport keys');
    q('#undoButton').click();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));check(q('#workflowCommandDialog').open,'Ctrl+K discovers command search');
    input('#workflowCommandSearch','a completely unknown command 8399');check(q('#workflowCommandResults .workflow-no-results'),'unmatched search has a clear empty state');
    q('#workflowCommandSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));check(api.getProject().tracks[0].clips.length===0,'Enter on no results does not mutate the session');
    q('#workflowCommandDialog').dispatchEvent(new Event('cancel',{cancelable:true}));check(!q('#workflowCommandDialog').open,'Escape cancellation closes command search');
    q('#workflowAddTrackButton').click();check(q('#workflowTrackDialog').open,'Add track opens an explicit instrument picker');
    q('#workflowTrackFilters button[data-mode="drums"]').click();const firstKit=q('#workflowTrackChoices .workflow-track-choice');check(firstKit,'drum kit picker offers playable kits');firstKit.click();
    let project=api.getProject(),selected=api.getTrack();check(project.tracks.length===2&&selected.type==='drums'&&selected.clips.length===0,'chosen drum track starts empty without an unsolicited groove');
    q('#undoButton').click();check(api.getProject().tracks.length===1,'adding the chosen track is one undoable edit');
    q('#redoButton').click();check(api.getProject().tracks.length===2&&api.getTrack().type==='drums','redo restores the exact chosen track and selection');
    window.SonoraWorkflow.openCommands('tracks');const firstTrack=api.getProject().tracks[0];resultByName(firstTrack.name).click();check(api.getTrack().id===firstTrack.id,'track search navigates to the chosen existing track');
    const previousSound=api.getTrack().instrument;window.SonoraWorkflow.openCommands('sounds');input('#workflowCommandSearch','piano');check(resultByName('Studio Grand'),'instrument search recognizes piano type even when the patch name omits piano');input('#workflowCommandSearch','Studio Grand');resultByName('Studio Grand').click();
    check(api.getTrack().instrument==='Studio Grand'&&api.getProject().tracks.length===2,'loading a sound reuses a compatible selected track');
    q('#undoButton').click();check(api.getTrack().instrument===previousSound,'loading a sound preserves undo history');
    q('#workflowAddTrackButton').click();q('#workflowTrackFilters button[data-mode="audio"]').click();q('#workflowTrackChoices .workflow-track-choice').click();check(api.getTrack().type==='audio'&&api.getTrack().clips.length===0,'audio track choice creates a clean recording or import lane');
    check(q('#workflowContextNew').textContent==='Import audio'&&q('#workflowContextSound').hidden,'context actions adapt to the selected audio track');
    q('#undoButton').click();
    const row=[...document.querySelectorAll('.track-row')].find(item=>item.dataset.track===api.getProject().tracks[1].id);row.focus();row.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));check(api.getTrack().type==='drums'&&document.activeElement.classList.contains('track-row'),'track rows can be selected using the keyboard');
    const categories=new Set(api.SYNTH_PRESETS.map(preset=>preset.category));check([...categories].every(category=>[...q('#designCategory').options].some(option=>option.value===category)),'library category selector follows the actual instrument catalog');
  }finally{closeDialogs();q('#stopButton').click();api.replaceProject(JSON.parse(original));api.saveProject();}
  return results;
})()
