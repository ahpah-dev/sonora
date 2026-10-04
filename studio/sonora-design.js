      // Presentation layer only. Existing controls keep their handlers and project data.
      const designPaths={
        piano:'M3 4h18v16H3zM7 4v9h3V4m4 0v9h3V4M9 13v7m6-7v7',
        wave:'M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4',
        drums:'M4 5h6v6H4zm10 0h6v6h-6zM4 15h6v6H4zm10 0h6v6h-6z',
        knobs:'M5 4v16m7-16v16m7-16v16M2 8h6m1 8h6m1-10h6',
        folder:'M3 7h7l2-3h9v16H3z',plus:'M12 4v16M4 12h16',
        save:'M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-8h8v8',
        download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
        mic:'M8 5a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0zM5 10v1a7 7 0 0 0 14 0v-1M12 18v4m-4 0h8',
        settings:'M4 7h16M4 17h16M8 4v6m8 4v6',
        expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
        help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
        chevron:'m8 10 4 4 4-4',spark:'m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
        copy:'M8 8h13v13H8zM16 8V3H3v13h5',play:'m8 5 11 7-11 7z',
        up:'m6 14 6-6 6 6',down:'m6 10 6 6 6-6'
      };
      function designIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('design-icon');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',designPaths[name]||designPaths.wave);svg.append(p);return svg;}
      function designButton(button,icon){if(!button||button.dataset.designIcon)return;button.dataset.designIcon=icon;button.querySelector('svg')?.remove();button.prepend(designIcon(icon));}
      function designRange(input){const min=Number(input.min)||0,max=Number(input.max)||100;input.style.setProperty('--range-fill',`${clamp((Number(input.value)-min)/(max-min)*100,0,100)}%`);}
      function designMenu(label,children){const details=document.createElement('details');details.className='design-menu';const summary=document.createElement('summary');summary.append(document.createTextNode(label),designIcon('chevron'));details.append(summary);const body=document.createElement('div');body.className='design-menu-body';children.forEach(child=>{if(child)body.append(child);});details.append(body);details.addEventListener('toggle',()=>{if(details.open)document.querySelectorAll('.design-menu[open]').forEach(other=>{if(other!==details)other.open=false;});});return details;}
      function designDecorate(){
        document.querySelectorAll('input[type=range]').forEach(designRange);
        document.querySelectorAll('.preset-symbol').forEach(symbol=>{if(symbol.querySelector('svg'))return;const category=symbol.closest('.preset-card').querySelector('small')?.textContent||'';symbol.replaceChildren(designIcon(category==='Drums'?'drums':category==='Keys'||category==='Organ'?'piano':'wave'));});
        document.querySelectorAll('.pro-preset-action[aria-label^="Preview"]').forEach(button=>{if(!button.dataset.designIcon){button.replaceChildren(designIcon('play'));button.dataset.designIcon='play';}});
        document.querySelectorAll('.editor-tab').forEach(button=>designButton(button,{piano:'piano',drums:'drums',perform:'play',instrument:'knobs',mixer:'knobs',fx:'spark',automation:'wave',audio:'wave'}[button.dataset.tab]));
        const inspector=$('#studioInspector');if(inspector){const name=inspector.querySelector('.inspector-name');if(name)name.style.setProperty('--channel-color',getTrack().color);const shortcut=inspector.querySelector('.pro-instrument-shortcut');if(shortcut){shortcut.querySelector('small').textContent=getTrack().type==='drums'?'Drum instrument':proSynth(getTrack()).engine==='piano'?'Piano instrument':'Synth instrument';const button=shortcut.querySelector('button');button.textContent='Edit instrument';designButton(button,'knobs');}const overline=inspector.querySelector('.inspector-overline');if(overline)overline.textContent='Track inspector';}
        const category=$('#designCategory');if(category)category.value=studioPresetCategory;
        $('.performance-top p')?.replaceChildren(document.createTextNode('Play with your computer keyboard, on-screen keys, or MIDI input.'));
        const state=$('#performanceNow');if(state?.textContent==='Ready when you are')state.textContent='No active notes';
        const audioEmpty=$('.audio-empty strong');if(audioEmpty)audioEmpty.textContent=getTrack().type==='audio'?'No audio clip selected':'Select or add an audio track';
        document.querySelectorAll('.instrument-top p').forEach(p=>{if(getTrack().type==='synth'&&!getTrack().sampleId)p.textContent='Configure oscillators, filters, envelopes, and modulation.';});
      }
      function designInit(){
        const brand=$('.brand');brand.lastChild.textContent='sonora';brand.title='Sonora — free and open source DAW';$('.studio-tag').textContent='DAW';
        $('.browser-title strong').textContent='Sound library';$('.browser-title small').textContent='Presets';
        const trackTitle=$('.track-sidebar-head .section-title');for(const node of trackTitle.childNodes)if(node.nodeType===3&&node.textContent.trim())node.textContent='Tracks ';
        $('#proPatchDialog h2').textContent='Save instrument preset';$('#proPatchDialog p').textContent='Enter a preset name. Saved presets are available in My sounds on this device.';
        const category=document.createElement('select');category.id='designCategory';category.setAttribute('aria-label','Sound category');['All','Keys','Bass','Leads','Pads','Plucks','Organ','Textures','Drums'].forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name==='All'?'All instruments':name;category.append(option);});category.addEventListener('change',()=>{const button=[...$('#studioCategories').children].find(b=>b.textContent===category.value);button?.click();});$('#studioCategories').after(category);
        $('#studioBrowserImport').textContent='Import audio';designButton($('#studioBrowserImport'),'plus');$('.browser-bottom p').textContent='Import samples, loops, or recordings.';
        for(const [id,icon] of [['saveButton','save'],['exportButton','download'],['exportWavButton','download'],['openProjectButton','folder'],['downloadProjectButton','download'],['studioRecordMic','mic'],['addClipButton','plus']])designButton($(`#${id}`),icon);
        for(const [label,icon] of [['Studio settings','settings'],['Keyboard shortcuts','help'],['Expand editor','expand'],['Add audio track','wave']]){const button=document.querySelector(`button[aria-label="${label}"]`);if(button){button.replaceChildren(designIcon(icon));button.dataset.designIcon=icon;}}
        const toolbar=$('#noteToolbar'),actions=[...toolbar.children].filter(el=>['selectAllNotesButton','duplicateNotesButton','quantizeNotesButton','proHumanize'].includes(el.id)||el.tagName==='BUTTON'&&el.textContent==='Legato');const menu=designMenu('Note actions',actions);toolbar.querySelector('.note-tool-switch').after(menu);
        menu.querySelector('.design-menu-body').append(toolbar.querySelector('.octave-controls'));
        const chords=designMenu('Chord builder',[$('#pianoComposeTools')]),properties=designMenu('Note properties',[$('#pianoNoteDetails')]);toolbar.append(chords,properties);
        document.addEventListener('pointerdown',event=>{document.querySelectorAll('.design-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});});
        document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.design-menu[open]').forEach(menu=>menu.open=false);});
        document.addEventListener('input',event=>{if(event.target.matches('input[type=range]'))designRange(event.target);});
        designDecorate();
      }
      const designBaseEditor=renderEditor;renderEditor=function(){designBaseEditor();designDecorate();};
      const designBaseTracks=renderTracks;renderTracks=function(){designBaseTracks();designDecorate();};
      const designBaseArrangement=renderArrangement;renderArrangement=function(){designBaseArrangement();gridEl.style.backgroundImage=gridEl.style.backgroundImage.replaceAll('rgb(44, 46, 51)','rgba(255,255,255,.055)').replaceAll('rgb(32, 34, 39)','rgba(255,255,255,.025)').replaceAll('rgb(27, 29, 33)','rgba(255,255,255,.012)');};
      const designBaseBrowser=studioRenderBrowser;studioRenderBrowser=function(){designBaseBrowser();designDecorate();};
      const designBaseInspector=studioRenderInspector;studioRenderInspector=function(){designBaseInspector();designDecorate();};
      designInit();
