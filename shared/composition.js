(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SonoraComposition=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const round=n=>Number(n.toFixed(3));
  const audible=project=>{const solo=project.tracks.some(t=>t.solo);return project.tracks.filter(t=>!t.mute&&(!solo||t.solo));};
  // Count repeated events analytically, so long clips do not expand into millions of notes.
  function occurrences(at,period,from,to,firstOnly=false){if(firstOnly)return at>=from&&at<to?1:0;return Math.max(0,Math.ceil((to-at)/period-1e-9)-Math.max(0,Math.ceil((from-at)/period-1e-9)));}
  function review(project){
    const tracks=audible(project),clips=tracks.flatMap(t=>t.clips||[]),start=clips.length?Math.min(...clips.map(c=>c.start)):0,end=clips.reduce((n,c)=>Math.max(n,c.start+c.length),start),width=Math.max(16,Math.ceil((end-start)/128/16)*16);
    const sections=Array.from({length:Math.ceil((end-start)/width)},(_,i)=>({startBeat:start+i*width,endBeat:Math.min(end,start+(i+1)*width),notes:0,drumHits:0,activeTracks:[],pitchClasses:Array(12).fill(0)})),reports=[],observations=[];
    let notes=0,hits=0,duplicateNotes=0,samePitchOverlaps=0;
    for(const track of tracks){
      const patterns=new Set(),rhythms=new Set(),velocities=[],pitches=[],templateNotes=[],rhythmAnchors=new Set();let trackNotes=0,trackHits=0,duplicates=0,overlaps=0,largestLeap=0,maxPolyphony=0,monoTransitions=0,largeLeaps=0;
      const octave=(track.synth?.octave||0)*12;
      for(const clip of track.clips||[]){
        const period=track.type==='drums'?4:16,pattern=(track.type==='synth'?(clip.notes||track.notes||[]):[]).filter(n=>n.start<clip.length),steps=track.type==='drums'?clip.steps||track.steps||{}:{};
        const signature=track.type==='drums'?JSON.stringify(Object.keys(steps).sort().map(k=>[k,[...steps[k]].sort((a,b)=>a-b)])):JSON.stringify([...pattern].sort((a,b)=>a.start-b.start||a.pitch-b.pitch).map(n=>[round(n.start),n.pitch,round(n.duration)]));
        if(pattern.length||Object.values(steps).some(s=>s.length)){patterns.add(signature);rhythms.add(JSON.stringify([...new Set(pattern.map(n=>round(n.start)))].sort((a,b)=>a-b)));}
        const seen=new Set(),byPitch=new Map(),edges=[];
        for(const note of pattern){
          const pitch=note.pitch+octave,endNote=Math.min(note.start+note.duration,clip.length),count=occurrences(clip.start+note.start,16,clip.start,clip.start+clip.length,note.firstPassOnly),key=`${note.pitch}:${round(note.start)}`;
          if(seen.has(key))duplicates+=count;seen.add(key);pitches.push(pitch);velocities.push(note.velocity??.75);trackNotes+=count;
          const previous=byPitch.get(note.pitch)||[];for(const other of previous)if(note.start<other.end-1e-6&&endNote>other.start+1e-6)overlaps+=Math.min(count,other.count);previous.push({start:note.start,end:endNote,count});byPitch.set(note.pitch,previous);
          // Include the next repeat to catch a long same-pitch note crossing the pattern boundary.
          if(!note.firstPassOnly&&count>1&&note.duration>16)overlaps+=count-1;
          edges.push([note.start,1],[endNote,-1]);rhythmAnchors.add(round(note.start%4));templateNotes.push({start:clip.start+note.start,end:clip.start+endNote,pitch,clip,firstOnly:Boolean(note.firstPassOnly)});
        }
        edges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let polyphony=0;for(const edge of edges){polyphony+=edge[1];maxPolyphony=Math.max(maxPolyphony,polyphony);}
        const groups=new Map();for(const note of pattern){const at=round(note.start);if(!groups.has(at))groups.set(at,[]);groups.get(at).push(note);}
        let last=null;for(const group of [...groups.entries()].sort((a,b)=>a[0]-b[0])){if(group[1].length!==1){last=null;continue;}const n=group[1][0];if(last&&last.start+last.duration<=n.start+.02){const leap=Math.abs(n.pitch-last.pitch);largestLeap=Math.max(largestLeap,leap);monoTransitions++;if(leap>12)largeLeaps++;}last=n;}
        for(const values of Object.values(steps))for(const step of values)trackHits+=occurrences(clip.start+step/4,4,clip.start,clip.start+clip.length);
        for(const section of sections){const from=Math.max(section.startBeat,clip.start),to=Math.min(section.endBeat,clip.start+clip.length);if(to<=from)continue;let active=track.type==='audio';
          for(const note of pattern){const count=occurrences(clip.start+note.start,16,from,to,note.firstPassOnly);if(count){active=true;section.notes+=count;section.pitchClasses[((note.pitch+octave)%12+12)%12]+=count*Math.min(note.duration,4)*(note.velocity??.75);}else if(note.start+clip.start<from&&note.start+clip.start+note.duration>from)active=true;}
          for(const values of Object.values(steps))for(const step of values){const count=occurrences(clip.start+step/4,4,from,to);section.drumHits+=count;if(count)active=true;}
          if(active&&!section.activeTracks.includes(track.id))section.activeTracks.push(track.id);
        }
      }
      // Detect repeated duplicate attacks across overlapping clips on this track.
      const onsetGroups=new Map();for(const n of templateNotes){const key=`${n.pitch}:${round((n.start%16+16)%16)}`,group=onsetGroups.get(key)||[];for(const other of group){if(other.clip===n.clip)continue;const from=Math.max(n.start,other.start),to=Math.min(n.clip.start+n.clip.length,other.clip.start+other.clip.length);let count=0;if(n.firstOnly)count=occurrences(other.start,16,n.start,n.start+.00001,other.firstOnly)*(n.start<to?1:0);else if(other.firstOnly)count=occurrences(n.start,16,other.start,other.start+.00001)*(other.start<to?1:0);else count=occurrences(n.start,16,from,to);duplicates+=count;}group.push(n);onsetGroups.set(key,group);}
      // Other cross-clip overlaps inspect first phrases; separate tracks' unisons are intentional layering.
      templateNotes.sort((a,b)=>a.start-b.start);for(let i=0;i<templateNotes.length;i++)for(let j=i+1;j<templateNotes.length&&templateNotes[j].start<templateNotes[i].end-1e-6;j++)if(templateNotes[i].pitch===templateNotes[j].pitch&&templateNotes[i].clip!==templateNotes[j].clip)overlaps++;
      const report={id:track.id,name:track.name,instrument:track.instrument,type:track.type,scheduledNotes:trackNotes,scheduledDrumHits:trackHits,clips:(track.clips||[]).length,uniquePatterns:patterns.size,uniqueRhythms:track.type==='synth'?rhythms.size:null,soundingPitchRange:pitches.length?[Math.min(...pitches),Math.max(...pitches)]:null,presetOctave:octave/12,maxPatternPolyphony:maxPolyphony,velocityRange:velocities.length?[round(Math.min(...velocities)),round(Math.max(...velocities))]:null,duplicateNotes:duplicates,samePitchOverlaps:overlaps,largestMonophonicLeap:largestLeap,largeLeapPercent:monoTransitions?Math.round(largeLeaps/monoTransitions*100):0,onsetsWithinBar:[...rhythmAnchors].sort((a,b)=>a-b)};
      reports.push(report);notes+=trackNotes;hits+=trackHits;duplicateNotes+=duplicates;samePitchOverlaps+=overlaps;
      if(duplicates)observations.push({trackId:track.id,kind:'duplicate-notes',message:`${track.name}: ${duplicates} duplicated note events can double the attack and level.`});
      if(overlaps)observations.push({trackId:track.id,kind:'same-pitch-overlap',message:`${track.name}: ${overlaps} same-pitch overlaps. Review articulation and sustained repeats; sustain can be intentional.`});
      if(patterns.size===1&&(track.clips||[]).reduce((n,c)=>n+c.length,0)>=64)observations.push({trackId:track.id,kind:'repetition',message:`${track.name}: one pattern across at least 16 bars. Consider phrase endings, dropouts or a developed variation if the request calls for development.`});
      if(trackNotes>=12&&velocities.length&&Math.max(...velocities)-Math.min(...velocities)<.025)observations.push({trackId:track.id,kind:'flat-dynamics',message:`${track.name}: nearly identical note velocities. Consider phrasing and accents; constant dynamics may suit this style.`});
      if(monoTransitions>=5&&largeLeaps/monoTransitions>.5)observations.push({trackId:track.id,kind:'wide-leaps',message:`${track.name}: most isolated melodic transitions exceed an octave. Review register continuity and motif shape.`});
    }
    const densities=new Set(sections.map(s=>`${s.activeTracks.join(',')}:${s.notes}:${s.drumHits}`));
    if(sections.length>=4&&densities.size===1&&reports.every(t=>t.uniquePatterns<=1))observations.push({trackId:null,kind:'static-arrangement',message:'Every section has the same participating tracks, patterns and event counts. Consider contrast and a purposeful ending when appropriate to the request.'});
    return {coverage:{startBeat:start,endBeat:end,sectionBeats:width,allSections:true},scheduledNotes:notes,scheduledDrumHits:hits,duplicateNotes,samePitchOverlaps,tracks:reports,sections:sections.map(s=>({...s,pitchClasses:s.pitchClasses.map((weight,i)=>({pitch:names[i],weight:round(weight)})).filter(p=>p.weight>0)})),observations:observations.slice(0,32),interpretation:'Whole-arrangement event counts, section activity and pattern review, including repeats and sounding preset octave. Polyphony and overlaps inspect note templates, not effect tails. These are composition review cues, not a quality score or a key detector. Repetition, dissonance, wide leaps and constant dynamics may be intentional. Audio clips have no inferred transcription.'};
  }
  const hasMusic=plan=>plan.tracks.some(t=>t.action!=='remove'&&t.clips?.some(c=>c.notes.length||Object.values(c.steps).some(s=>s.length)));
  function measurements(result){return {composition:result.composition,structure:result.structure||null,audio:result.audio||null};}
  function rejection(first,next){
    if(next.composition.scheduledNotes+next.composition.scheduledDrumHits===0&&first.composition.scheduledNotes+first.composition.scheduledDrumHits>0)return 'The revision removed all audible MIDI.';
    if(next.composition.duplicateNotes>first.composition.duplicateNotes)return 'The revision introduced more duplicated notes.';
    if(first.audio&&next.audio&&first.audio.peakDbfs<=0&&next.audio.peakDbfs>0)return 'The revision introduced mix clipping.';
    return null;
  }
  async function compose({request,generate,evaluate,refine=true,signal,onProgress=()=>{}}){
    const check=()=>{if(signal?.aborted)throw Error('Request cancelled');};check();
    const proposal=await generate(request);check();const quality=await evaluate(proposal);check();
    if(!refine||request.context.previousDraft||!hasMusic(proposal))return {proposal,quality,refinement:{status:'skipped',message:request.context.previousDraft?'Reviewed your requested revision.':'Composition checked.'}};
    onProgress('Reviewing melody, harmony, groove and section development…');
    try{
      const revised=await generate({...request,context:{...request.context,previousDraft:{proposal,measurements:measurements(quality),instruction:'Polish this draft once. Retain its recognizable motif and style, fix measured problems where appropriate, and improve musical development. Return the complete final proposal against the original session.'}}});check();
      const revisedQuality=await evaluate(revised);check();const reason=!hasMusic(revised)?'The revision omitted the requested musical changes.':rejection(quality,revisedQuality);
      if(reason)return {proposal,quality,refinement:{status:'retained',message:`Kept the first draft. ${reason}`}};
      return {proposal:revised,quality:revisedQuality,refinement:{status:'refined',message:'One composition refinement completed.'}};
    }catch(error){check();return {proposal,quality,refinement:{status:'retained',message:`First draft is ready. Refinement could not finish: ${String(error.message||error).slice(0,240)}`}};}
  }
  return {review,compose,measurements,rejection};
});
