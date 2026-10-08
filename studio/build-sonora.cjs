const fs = require('fs');
const path = require('path');
const root = __dirname;
const base = path.join(root, 'sonora-before-studio.html');
if (!fs.existsSync(base)) fs.copyFileSync(path.join(root, 'sonora.html'), base);
let html = fs.readFileSync(base, 'utf8').replace(/\r\n/g, '\n');
function replace(find, value) {
  if (!html.includes(find)) throw new Error('Missing build anchor: ' + find.slice(0,100));
  html = html.replace(find, value);
}
replace('  </style>', ['sonora-studio.css','sonora-pro.css','sonora-piano.css','sonora-design.css','sonora-session.css','sonora-assistant.css'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n') + '\n  </style>');
replace('      setupWorkflow();', fs.readFileSync(path.join(root,'../shared/assistant.js'),'utf8')+'\n'+['sonora-studio.js','sonora-pro.js','sonora-piano.js','sonora-design.js','sonora-session.js','sonora-assistant.js'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n') + '\n      setupWorkflow();');
replace("type:source.type==='drums'?'drums':'synth'", "type:source.type==='audio'?'audio':source.type==='drums'?'drums':'synth'");
replace("if(track.type==='drums'){\n              const steps=entry.steps", "if(track.type==='audio'){\n              clip.notes=[];\n            }else if(track.type==='drums'){\n              const steps=entry.steps");
replace('new Set(snapshot.tracks.map(track=>track.sampleId).filter(Boolean))', 'studioSampleIds(snapshot)');
replace('const required=[...new Set(next.tracks.map(t=>t.sampleId).filter(Boolean))]', 'const required=studioSampleIds(next)');
replace('next.tracks.filter(t=>t.sampleId===sample.id).forEach(t=>t.sampleId=record.id);', 'next.tracks.forEach(t=>{if(t.sampleId===sample.id)t.sampleId=record.id;t.clips.forEach(c=>{if(c.sampleId===sample.id)c.sampleId=record.id;});});');
replace("`${clipLengthLabel(clip.length)}  ·  ${track.type==='audio'?'AUDIO':track.type==='drums'?'DRUMS':'MIDI'}`", "`${clipLengthLabel(Number(clip.length.toFixed(2)))}  ·  ${track.type==='audio'?'AUDIO':track.type==='drums'?'DRUMS':'MIDI'}`");
replace('const sampleRate = 44100, secondsPerBeat', 'const sampleRate = studioPrefs.sampleRate, secondsPerBeat');
replace("connectFxChain(context, output, track.effects, `offline-${track.id}`).connect(masterInput); outputs.set(track.id, output);", "const pan=context.createStereoPanner();pan.pan.value=clamp(finiteNumber(track.pan,0),-1,1);output.connect(pan);connectFxChain(context, pan, track.effects, `offline-${track.id}`).connect(masterInput);outputs.set(track.id, output);\n            if(!track.mute&&(!hasSolo||track.solo)&&(track.automation||[]).length){output.gain.setValueAtTime(track.volume*studioAutomationValue(track,0),0);for(const point of [...track.automation].sort((a,b)=>a.beat-b.beat))output.gain.linearRampToValueAtTime(track.volume*point.value,point.beat*secondsPerBeat);}");
replace('          const rendered = await context.startRendering();', "          project.tracks.filter(t=>t.type==='audio').forEach(track=>track.clips.forEach(clip=>studioAudioVoice(context,outputs.get(track.id),clip,clip.start*secondsPerBeat)));\n          const rendered = await context.startRendering();");
// Include audio-only files as empty MIDI channels, without fabricated note events.
replace('        for (const [trackIndex, track] of project.tracks.entries()) {\n          const events', "        for (const [trackIndex, track] of project.tracks.entries()) {\n          if(track.type==='audio')continue;\n          const events");
// Register every transport voice so stop/seek cannot leave scheduled notes ringing.
for (const name of ['playNote','playDrum']) {
  const start=html.indexOf('      function '+name+'(');
  const end=html.indexOf('\n      function ',start+10);
  let section=html.slice(start,end).replace(/ctx\.createOscillator\(\)/g,'studioTrackSource(ctx.createOscillator())').replace(/ctx\.createBufferSource\(\)/g,'studioTrackSource(ctx.createBufferSource())');
  html=html.slice(0,start)+section+html.slice(end);
}
// Avoid placing silent pattern regions on audio tracks.
replace('      function createClipAt(track, start)', '      function createClipAt(track, start)');
replace("      function addClip() {\n        const track = getTrack();", "      function addClip() {\n        const track = getTrack();\n        if(track.type==='audio'){$('#studioAudioInput').click();return;}");
replace("          if (!track) return;\n          const rect = gridEl.getBoundingClientRect(), snap", "          if (!track) return;\n          if(track.type==='audio'){project.selectedTrack=track.id;$('#studioAudioInput').click();return;}\n          const rect = gridEl.getBoundingClientRect(), snap");
replace("      function liveNoteDown(source,pitch,velocity=.82,timestamp){", "      function liveNoteDown(source,pitch,velocity=.82,timestamp){\n        if(getTrack().type==='audio')return;");
replace("      function clearPattern() {\n        const track = getTrack();", "      function clearPattern() {\n        const track = getTrack();\n        if(track.type==='audio'){notify('Use the audio editor to edit this clip');return;}");
replace("      function collectEvents() {\n        const events = [];\n        project.tracks.forEach(track => {", "      function collectEvents() {\n        const events = [];\n        project.tracks.forEach(track => {\n          if(track.type==='audio')return;");
// Live notes, held keys and offline export use exactly the same instrument voices.
// Instrument clips repeat a 16-beat pattern; recorded notes must use that same range.
replace('position=(relative%clip.length+clip.length)%clip.length', 'patternLength=Math.min(16,clip.length),position=(relative%patternLength+patternLength)%patternLength');
replace('Math.max(0,clip.length-.0625)', 'Math.max(0,patternLength-.0625)');
replace('Math.min(note.duration,clip.length-note.start)', 'Math.min(note.duration,patternLength-note.start)');
replace('(active.clip?.length||16)-active.note.start', 'Math.min(16,active.clip?.length||16)-active.note.start');
const offlineNoteStart=html.indexOf('          const renderNote = (track, note, time, duration) => {');
const offlineNoteEnd=html.indexOf('          collectEvents().forEach',offlineNoteStart);
if(offlineNoteStart<0||offlineNoteEnd<0)throw new Error('Missing offline voice anchor');
html=html.slice(0,offlineNoteStart)+'          const renderNote = (track,note,time,duration) => proVoice(context, outputs.get(track.id)||master, track, note, time, duration, false);\n'+html.slice(offlineNoteEnd);
const offlineDrumStart=html.indexOf('          const renderDrum = (kind, time, output, velocity, kit');
const offlineDrumEnd=html.indexOf('          const renderNote =',offlineDrumStart);
if(offlineDrumStart<0||offlineDrumEnd<0)throw new Error('Missing offline drum anchor');
html=html.slice(0,offlineDrumStart)+'          const renderDrum = (kind,time,output,velocity,track) => proDrumVoice(context,output,track,kind,time,velocity,false);\n'+html.slice(offlineDrumEnd);
replace("event.velocity, event.track.drumKit || event.track.instrument)","event.velocity, event.track)");
fs.writeFileSync(path.join(root,'sonora.html'),html);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new (require('vm').Script)(script);
console.log('Built self-contained Sonora Studio and verified JavaScript syntax.');
