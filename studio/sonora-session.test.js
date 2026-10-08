(async()=>{
  const api=window.sonoraVerification,results=[],q=s=>document.querySelector(s),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(ok,label)=>{if(!ok)throw Error(label);results.push('PASS '+label);};
  const original=JSON.stringify(api.getProject());
  try{
    q('#stopButton').click();api.sessionStarter('beat');let project=api.getProject();
    check(project.tracks.length===2&&project.tracks[1].clips[0].steps.kick.length===4,'beat template creates editable instrument and drum tracks');
    check(q('#saveStatus').textContent==='Saved locally','new session is persisted immediately');
    q('#playButton').click();q('#stopButton').click();await sleep(180);check(!api.audio.playing,'Stop cancels a pending asynchronous playback start');
    const clip=project.tracks[0].clips[0];clip.start=4;clip.length=8;api.sessionLoopClip(clip);
    check(api.sessionRange().start===4&&api.sessionRange().end===12,'selected clip sets an exact loop range');
    check(api.sessionPosition(12)===4&&api.sessionPosition(15)===7,'loop timing wraps to the selected start');
    check(!q('#sessionLoopStrip').hidden,'loop region is displayed in the timeline');
    q('#playButton').click();await sleep(150);check(api.audio.playing&&api.audio.playheadBeat>=4&&api.audio.playheadBeat<12,'transport starts inside the configured loop');q('#stopButton').click();
    project=api.getProject();project.countIn=true;project.tracks[0].clips[0].notes=[];api.audio.record=true;q('#playButton').click();await sleep(100);api.liveNoteDown('verification',60,.8);api.liveNoteUp('verification');
    check(project.tracks[0].clips[0].notes.length===0,'count-in plays keys without recording premature notes');q('#stopButton').click();api.audio.record=false;project.countIn=false;
    const buffer={length:3,numberOfChannels:2,sampleRate:48000,getChannelData:i=>new Float32Array(i?[.25,-.25,0]:[1,-1,0])};
    for(const bits of [16,24]){const encoded=api.sessionWav(buffer,bits,false),view=new DataView(await encoded.blob.arrayBuffer());check(view.getUint16(34,true)===bits&&view.getUint32(24,true)===48000&&view.byteLength===44+3*2*bits/8,`${bits}-bit WAV has valid rate, depth and interleaved byte count`);}
    const normalized=api.sessionWav(buffer,24,true);check(Math.abs(normalized.scale-Math.pow(10,-1/20))<.00001,'normalization preserves dynamics at −1 dBFS');
    api.sessionStarter('piano');project=api.getProject();project.tracks[0].clips[0].notes=[{pitch:60,start:0,duration:1,velocity:.8}];project.loopStart=0;project.loopEnd=2;
    project.tracks.push({id:'unrelated-missing-audio',name:'Unrelated audio',type:'audio',volume:.8,pan:0,mute:false,solo:false,effects:[],clips:[{id:'missing-audio-clip',name:'Unavailable recording',start:0,length:4,sampleId:'not-in-the-imported-audio-store'}]});
    q('#exportWavButton').click();check(q('#sessionExportDialog').open,'WAV action opens export quality controls');q('#sessionExportRange').value='loop';q('#sessionExportBits').value='24';q('#sessionExportRate').value='48000';q('#sessionExportScope').value='track';
    const blobs=[],downloads=[],urlBase=URL.createObjectURL,clickBase=HTMLAnchorElement.prototype.click;URL.createObjectURL=blob=>{blobs.push(blob);return urlBase(blob);};HTMLAnchorElement.prototype.click=function(){downloads.push({url:this.href,name:this.download});};
    try{
      project.title='Snapshot render';project.tempo=120;const pending=api.sessionRenderWav();
      q('#sessionExportDialog .dialog-close').click();check(!q('#sessionExportDialog').open&&q('#sessionRenderButton').disabled,'export can be hidden while rendering so the session remains editable');
      project.title='Edited later';project.tempo=240;project.tracks[0].clips[0].notes=[];project.loopEnd=20;
      await pending;
      q('#exportWavButton').click();check(q('#sessionExportDialog').open&&!q('#sessionDownloadButton').disabled,'returning to Export retains the completed preview');
      check(q('#sessionExportStatus').textContent.includes('Ready: 24-bit'),'range render finishes and reports the selected quality');
      check(q('#sessionExportStatus').textContent.startsWith('Ready:'),'selected-track export ignores unavailable audio outside its rendering scope');
      check(!q('#sessionExportReview').hidden&&q('#sessionExportPreview').src.startsWith('blob:')&&!q('#sessionDownloadButton').disabled,'export exposes the actual WAV preview before downloading');
      for(let i=0;i<100&&q('#sessionExportPreview').readyState<1;i++)await sleep(20);
      check(q('#sessionExportPreview').readyState>=1&&Math.abs(q('#sessionExportPreview').duration-3)<.01,'the preview player decodes the exported 24-bit WAV and exposes its captured duration');
      check(downloads.length===0,'rendering waits for an explicit download action');
      const view=new DataView(await blobs.at(-1).arrayBuffer());let peak=0;
      for(let i=44;i<view.byteLength-2;i+=6){let sample=view.getUint8(i)|(view.getUint8(i+1)<<8)|(view.getUint8(i+2)<<16);if(sample&0x800000)sample-=0x1000000;peak=Math.max(peak,Math.abs(sample));}
      check(peak>100,'sampled piano export contains audible PCM data in a fresh offline context');
      check(view.getUint32(40,true)/(48000*6)===3,'export keeps its captured tempo, loop range and notes while the session changes');
      q('#sessionDownloadButton').click();check(downloads.length===1&&downloads[0].url===q('#sessionExportPreview').src&&downloads[0].name==='Snapshot-render-Piano-24bit.wav','Download delivers the reviewed WAV with its captured project name');
      q('#sessionNormalize').checked=true;q('#sessionNormalize').dispatchEvent(new Event('change',{bubbles:true}));
      check(q('#sessionExportReview').hidden&&q('#sessionDownloadButton').disabled,'changing export settings requires a new render');
    }
    finally{URL.createObjectURL=urlBase;HTMLAnchorElement.prototype.click=clickBase;q('#sessionExportDialog').close();}
    check(JSON.parse(localStorage.getItem('sonora-session-backups-v1')).length>0,'session replacement creates recoverable snapshots');
  }finally{q('#stopButton').click();api.replaceProject(JSON.parse(original));api.saveProject();}
  return results;
})()
