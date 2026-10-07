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
        up:'m6 14 6-6 6 6',down:'m6 10 6 6 6-6',
        library:'M3 4h18v16H3zM9 4v16m4-11h5m-5 5h5',inspector:'M3 4h18v16H3zM15 4v16M6 9h5m-5 5h5',close:'m6 6 12 12M18 6 6 18'
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
        const inspector=$('#studioInspector');if(inspector){const name=inspector.querySelector('.inspector-name');if(name)name.style.setProperty('--channel-color',getTrack().color);const shortcut=inspector.querySelector('.pro-instrument-shortcut');if(shortcut){shortcut.querySelector('small').textContent=getTrack().type==='drums'?'Drum instrument':proSynth(getTrack()).engine==='piano'?'Piano instrument':'Synth instrument';const button=shortcut.querySelector('button');button.textContent='Edit instrument';designButton(button,'knobs');}const overline=inspector.querySelector('.inspector-overline');if(overline){overline.textContent='Track inspector';const close=studioButton('',()=>designTogglePanel('inspector',false),'icon-button design-panel-close');close.setAttribute('aria-label','Hide track inspector');close.title='Hide track inspector';designButton(close,'close');overline.append(close);}}
        const category=$('#designCategory');if(category)category.value=studioPresetCategory;
        $('.performance-top p')?.replaceChildren(document.createTextNode('Play with your computer keyboard, on-screen keys, or MIDI input.'));
        const state=$('#performanceNow');if(state?.textContent==='Ready when you are')state.textContent='No active notes';
        const audioEmpty=$('.audio-empty strong');if(audioEmpty)audioEmpty.textContent=getTrack().type==='audio'?'No audio clip selected':'Select or add an audio track';
        document.querySelectorAll('.instrument-top p').forEach(p=>{if(getTrack().type==='synth'&&!getTrack().sampleId&&proSynth(getTrack()).engine!=='piano')p.textContent='Configure oscillators, filters, envelopes, and modulation.';});
      }
      function designPanelVisible(key){const panel=key==='browser'?$('.studio-browser'):$('#studioInspector');return studioPrefs[key]&&(window.innerWidth>(key==='browser'?1200:1000)||panel?.classList.contains('design-panel-open'));}
      function designSyncPanels(){for(const key of ['browser','inspector']){const button=$(`#design${key==='browser'?'Library':'Inspector'}Toggle`);if(button)button.setAttribute('aria-pressed',String(Boolean(designPanelVisible(key))));}}
      function designTogglePanel(key,value){const panel=key==='browser'?$('.studio-browser'):$('#studioInspector'),visible=value??!designPanelVisible(key);studioPrefs[key]=visible;panel?.classList.toggle('design-panel-open',visible&&window.innerWidth<=(key==='browser'?1200:1000));const check=document.querySelector(`input[aria-label="Show ${key==='browser'?'sound library':'track inspector'}"]`);if(check)check.checked=visible;studioApplyPreferences();designSyncPanels();}
      function designInit(){
        if(studioPrefs.theme==='carbon'&&['#c1f280','#c4f580'].includes(studioPrefs.accent.toLowerCase())){studioPrefs.accent='#74dec7';studioApplyPreferences();$('#studioAccent').value=studioPrefs.accent;}
        const carbon=$('#studioThemes').firstElementChild;carbon.textContent='Carbon / Teal';carbon.addEventListener('click',()=>{studioPrefs.accent='#74dec7';studioApplyPreferences();$('#studioAccent').value=studioPrefs.accent;});
        const brand=$('.brand');brand.lastChild.textContent='sonora';brand.title='Sonora — free and open source DAW';$('.studio-tag').textContent='DAW';
        $('.browser-title strong').textContent='Sound library';$('.browser-title small').textContent='Presets';
        const trackTitle=$('.track-sidebar-head .section-title');for(const node of trackTitle.childNodes)if(node.nodeType===3&&node.textContent.trim())node.textContent='Tracks ';
        $('#proPatchDialog h2').textContent='Save instrument preset';$('#proPatchDialog p').textContent='Enter a preset name. Saved presets are available in My sounds on this device.';
        const category=document.createElement('select');category.id='designCategory';category.setAttribute('aria-label','Sound category');['All','Keys','Bass','Leads','Pads','Plucks','Organ','Textures','Drums'].forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name==='All'?'All instruments':name;category.append(option);});category.addEventListener('change',()=>{const button=[...$('#studioCategories').children].find(b=>b.textContent===category.value);button?.click();});$('#studioCategories').after(category);
        $('#studioBrowserImport').textContent='Import audio';designButton($('#studioBrowserImport'),'plus');$('.browser-bottom p').textContent='Import samples, loops, or recordings.';
        for(const [id,icon] of [['saveButton','save'],['exportButton','download'],['exportWavButton','download'],['openProjectButton','folder'],['downloadProjectButton','download'],['studioRecordMic','mic'],['addClipButton','plus']])designButton($(`#${id}`),icon);
        for(const [label,icon] of [['Studio settings','settings'],['Keyboard shortcuts','help'],['Expand editor','expand'],['Add audio track','wave']]){const button=document.querySelector(`button[aria-label="${label}"]`);if(button){button.replaceChildren(designIcon(icon));button.dataset.designIcon=icon;}}
        $('#countInButton').textContent='1 BAR';$('#countInButton').title='One-bar count-in before playback or recording';
        $('#recordButton').setAttribute('aria-label','Arm MIDI recording');$('#recordButton').title='Arm MIDI recording, then play the instrument';
        $('#studioSettings h2').textContent='Studio preferences';$('#studioSettings p').textContent='Set the appearance, workspace density, and audio export quality. Preferences are saved on this device.';$('#studioHelp h2').textContent='Keyboard shortcuts';
        const settingsHint=[...$('#studioSettings').querySelectorAll('p')].at(-1);settingsHint.textContent='Use Library and Inspector in the workspace toolbar to show or hide panels. On smaller screens, panels open over the timeline.';
        const workspace=$('.workspace-controls'),newProject=[...workspace.children].find(el=>el.tagName==='BUTTON'&&el.textContent==='New');if(newProject)newProject.textContent='New project';
        const projectMenu=designMenu('Project',[newProject,$('#openProjectButton'),$('#saveButton'),$('#downloadProjectButton')]);projectMenu.classList.add('design-project-menu');projectMenu.id='designProjectMenu';$('.top-actions').insertBefore(projectMenu,document.querySelector('button[aria-label="Studio settings"]'));
        const exportMenu=designMenu('Export',[$('#exportWavButton'),$('#exportButton')]);exportMenu.classList.add('design-export-menu');exportMenu.id='designExportMenu';projectMenu.after(exportMenu);
        for(const menu of [projectMenu,exportMenu])menu.querySelector('.design-menu-body').addEventListener('click',event=>{if(event.target.closest('button'))menu.open=false;});
        const soundButton=$('#soundsViewButton');soundButton.textContent='Browse all sounds';soundButton.className='text-button design-browse-sounds';designButton(soundButton,'library');$('.browser-bottom').append(soundButton);workspace.querySelector('.view-switch').remove();
        const label=document.createElement('span');label.className='design-workspace-label';label.textContent='Workspace';workspace.prepend(label);
        for(const [key,text,icon] of [['browser','Library','library'],['inspector','Inspector','inspector']]){const button=studioButton(text,()=>designTogglePanel(key),'text-button design-panel-toggle');button.id=`design${text}Toggle`;button.setAttribute('aria-controls',key==='browser'?'studioSoundLibrary':'studioInspector');button.title=`Show or hide ${text==='Library'?'the sound library':'the track inspector'}`;designButton(button,icon);workspace.insertBefore(button,$('#studioRecordMic'));}
        $('.studio-browser').id='studioSoundLibrary';const closeLibrary=studioButton('',()=>designTogglePanel('browser',false),'icon-button design-panel-close');closeLibrary.setAttribute('aria-label','Hide sound library');closeLibrary.title='Hide sound library';designButton(closeLibrary,'close');$('.browser-title').append(closeLibrary);
        window.addEventListener('resize',designSyncPanels);
        const toolbar=$('#noteToolbar'),actions=[...toolbar.children].filter(el=>['selectAllNotesButton','duplicateNotesButton','quantizeNotesButton','proHumanize'].includes(el.id)||el.tagName==='BUTTON'&&el.textContent==='Legato');const menu=designMenu('Note actions',actions);toolbar.querySelector('.note-tool-switch').after(menu);
        menu.querySelector('.design-menu-body').append(toolbar.querySelector('.octave-controls'));
        const chords=designMenu('Chord builder',[$('#pianoComposeTools')]),properties=designMenu('Note properties',[$('#pianoNoteDetails')]);toolbar.append(chords,properties);
        document.addEventListener('pointerdown',event=>{document.querySelectorAll('.design-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});if(!event.target.closest('.design-panel-toggle'))document.querySelectorAll('.design-panel-open').forEach(panel=>{if(!panel.contains(event.target)){panel.classList.remove('design-panel-open');designSyncPanels();}});});
        document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.design-menu[open]').forEach(menu=>menu.open=false);});
        document.addEventListener('input',event=>{if(event.target.matches('input[type=range]'))designRange(event.target);});
        designDecorate();
        designSyncPanels();
      }
      const designBaseEditor=renderEditor;renderEditor=function(){designBaseEditor();designDecorate();};
      const designBaseTracks=renderTracks;renderTracks=function(){designBaseTracks();designDecorate();};
      const designBaseArrangement=renderArrangement;renderArrangement=function(){designBaseArrangement();gridEl.style.backgroundImage=gridEl.style.backgroundImage.replaceAll('rgb(44, 46, 51)','rgba(255,255,255,.055)').replaceAll('rgb(32, 34, 39)','rgba(255,255,255,.025)').replaceAll('rgb(27, 29, 33)','rgba(255,255,255,.012)');};
      const designBaseBrowser=studioRenderBrowser;studioRenderBrowser=function(){designBaseBrowser();designDecorate();};
      const designBaseInspector=studioRenderInspector;studioRenderInspector=function(){designBaseInspector();designDecorate();};
      const designBasePreferences=studioApplyPreferences;studioApplyPreferences=function(){designBasePreferences();for(const key of ['browser','inspector'])if(!studioPrefs[key])(key==='browser'?$('.studio-browser'):$('#studioInspector'))?.classList.remove('design-panel-open');designSyncPanels();};
      designInit();
