(function(global) {
  'use strict';
  let resources, panel, form, preview, message, active, sequence=0;
  let previewPatternId=0;
  const storageKey='webcop.icopEditorDrafts.v1';
  const clone=value=>JSON.parse(JSON.stringify(value));
  async function load() {
    if (!resources) resources=Promise.all(['icop-editor-schema.json','alldata-icop-ko.json'].map(async file=> {
      const response=await fetch(new URL('icops/'+file,document.baseURI),{cache:'no-store'});
      if(!response.ok) throw new Error('편집 정의를 불러오지 못했습니다.');
      return response.json();
    })).catch(error=>{resources=null;throw error;});
    return resources;
  }
  function readDraft(id) { try{return JSON.parse(localStorage.getItem(storageKey)||'{}')[id]||null;}catch{return null;} }
  function saveDraft(id,state) {const drafts=JSON.parse(localStorage.getItem(storageKey)||'{}');drafts[id]=state;localStorage.setItem(storageKey,JSON.stringify(drafts));}
  function buildState(schema, saved={}, sidc) {
    const values={};for(const field of schema.fields) values[field.key]=field.default ?? (field.type==='checkbox'?false:'');
    return {name:schema.name,size:60,sidc:sidc||schema.code,values,...saved,values:{...values,...saved.values}};
  }
  function renderOptions(schema,state,base={}) {
    const options={...base,size:Number(state.size)||60};
    for(const f of schema.fields) if(f.option) options[f.option]=state.values[f.key] ?? '';
    return options;
  }
  function renderCode(schema,state) {
    const code=state.sidc.split('');if(code.length!==15)return state.sidc;
    if(code[0]!=='W' && !'-PUAFNSHGDWLMJK'.includes(code[1]))code[1]='U';
    if(code[0]!=='W' && schema.fields.some(f=>f.key==='B'))code[11]=/^[A-N]$/.test(state.values.B||'') ? state.values.B : '-';
    if(schema.category==='u') {
      const v=state.values;const command=(v.S?1:0)+(v.D?2:0)+(v.AB?4:0);
      code[10]=['-','A','E','B','F','C','G','D'][command];
    }
    return code.join('');
  }
  function inputRow(label,key,type,value,properties={}) {
    const row=document.createElement('label');row.style.cssText='display:grid;grid-template-columns:145px minmax(0,1fr);gap:8px;align-items:center;margin:8px 0;';
    const title=document.createElement('span');title.textContent=label;row.append(title);
    const input=document.createElement(type==='select'?'select':'input'); input.name=key;input.setAttribute('aria-label',label);
    if(type==='select') {
      const blank=document.createElement('option');blank.value='';blank.textContent='미지정';if(key!=='affiliation')input.append(blank);
      for(const item of properties.options||[]) {const opt=document.createElement('option');opt.value=item.value;opt.textContent=item.label;input.append(opt);}
      if(value!=='' && value!=null && !Array.from(input.options).some(o=>o.value===String(value))) {
        const opt=document.createElement('option');opt.value=value;opt.textContent=String(value);input.append(opt);
      }
    } else input.type=['checkbox','number','color'].includes(type)?type:'text';
    if(type==='checkbox')input.checked=value===true||value==='true'||value==='1';else input.value=value??'';
    for(const key of ['min','max','maxLength'])if(properties[key]!=null)input[key]=properties[key];
    if(type==='number')input.step=properties.step||'any';
    input.style.cssText='box-sizing:border-box;min-width:0;width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:4px;';
    if(type==='checkbox')input.style.width='auto';
    if(properties.stored) {const note=document.createElement('small');note.textContent='속성 저장 · 지도 표현 미연결';note.style.cssText='display:block;color:#64748b;';title.append(note);}
    if(properties.validationNote){const note=document.createElement('small');note.textContent=properties.validationNote;title.append(note);}
    row.append(input);form.append(row);return input;
  }
  function installPanelDragging(heading) {
    let drag=null;
    heading.style.cursor='move';heading.style.userSelect='none';
    heading.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button,input,select,textarea'))return;
      const rect=panel.getBoundingClientRect();
      panel.style.position='fixed';panel.style.margin='0';panel.style.left=rect.left+'px';panel.style.top=rect.top+'px';panel.style.right='auto';panel.style.bottom='auto';
      drag={pointerId:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
      heading.setPointerCapture?.(event.pointerId);event.preventDefault();
    });
    heading.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      const maxLeft=Math.max(0,window.innerWidth-panel.offsetWidth),maxTop=Math.max(0,window.innerHeight-panel.offsetHeight);
      panel.style.left=Math.max(0,Math.min(event.clientX-drag.dx,maxLeft))+'px';
      panel.style.top=Math.max(0,Math.min(event.clientY-drag.dy,maxTop))+'px';event.preventDefault();
    });
    const stop=event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      if(heading.hasPointerCapture?.(event.pointerId))heading.releasePointerCapture(event.pointerId);drag=null;
    };
    heading.addEventListener('pointerup',stop);heading.addEventListener('pointercancel',stop);
  }
  function ensurePanel() {
    if(panel)return;
    panel=document.createElement('dialog');panel.id='icop-symbol-editor';panel.setAttribute('aria-label','부호별 속성 편집');
    panel.style.cssText='width:470px;max-width:90vw;max-height:85vh;padding:0;border:1px solid #64748b;border-radius:10px;color:#1e293b;background:#f8fafc;box-shadow:0 12px 50px #0006;';
    const heading=document.createElement('h3');heading.textContent='부호별 속성 편집';heading.style.cssText='position:sticky;top:0;margin:0;padding:14px;background:#334155;color:white;z-index:1;';panel.append(heading);installPanelDragging(heading);
    form=document.createElement('form');form.style.padding='14px';form.noValidate=false;
    preview=document.createElement('div');preview.style.cssText='min-height:90px;display:flex;align-items:center;justify-content:center;';
    panel.append(form);message=document.createElement('p');message.setAttribute('role','status');message.style.cssText='padding:0 14px;color:#b45309;';panel.append(message);
    const footer=document.createElement('div');footer.style.cssText='position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:8px;padding:12px;background:#e2e8f0;';
    for(const [label,handler] of [['취소',()=>close()],['적용',()=>form.requestSubmit()]]) {const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:8px 18px;cursor:pointer;';b.addEventListener('click',handler);footer.append(b);}
    panel.append(footer);document.body.append(panel);
    panel.addEventListener('cancel',()=>{sequence++;active=null;});form.addEventListener('submit',apply);form.addEventListener('input',updatePreview);
  }
  function close(){sequence++;active=null;panel.close();}
  function readForm() {
    const state=clone(active.state);state.name=form.elements.displayName.value.trim()||active.schema.name;if(form.elements.symbolSize)state.size=Number(form.elements.symbolSize.value);
    if(form.elements.affiliation) state.sidc=state.sidc[0]+form.elements.affiliation.value+state.sidc.slice(2);
    for(const field of active.schema.fields) {const input=form.elements['field:'+field.key];state.values[field.key]=input.type==='checkbox'?input.checked:input.value;}
    return state;
  }
  function buildTacticalPreview(geo) {
        const points=[];
        const collect=v=>{if(Array.isArray(v)&&typeof v[0]==='number')points.push(v);else if(Array.isArray(v))v.forEach(collect);};
        geo.features.forEach(f=>collect(f.geometry?.coordinates));
        if(!points.length)throw new Error('표시할 도형이 없습니다.');
        const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
        const minX=Math.min(...xs),maxY=Math.max(...ys),dx=Math.max(...xs)-minX,dy=maxY-Math.min(...ys);
        const longitudeScale=Math.max(0.01,Math.cos((maxY-dy/2)*Math.PI/180));
        const scale=Math.min(260/(dx*longitudeScale||1),80/(dy||1));
        const xy=p=>[30+(260-dx*longitudeScale*scale)/2+(p[0]-minX)*longitudeScale*scale,20+(80-dy*scale)/2+(maxY-p[1])*scale];
        const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
        svg.setAttribute('viewBox','0 0 320 120');svg.setAttribute('role','img');svg.setAttribute('aria-label','면·선 부호 미리보기');svg.style.cssText='width:100%;height:120px;margin-top:4px;background:#334155;border-radius:4px;';
        for(const f of geo.features){
          const g=f.geometry,p=f.properties||{};if(!g)continue;
          if(g.type==='Point'&&p.image){const img=document.createElementNS(ns,'image'),a=xy(g.coordinates);img.setAttribute('href',p.image);img.setAttribute('x',a[0]-20);img.setAttribute('y',a[1]-12);img.setAttribute('width','40');img.setAttribute('height','24');svg.append(img);continue;}
          if(g.type==='Point'&&p.label){const t=document.createElementNS(ns,'text'),a=xy(g.coordinates);t.setAttribute('x',a[0]);t.setAttribute('y',a[1]);t.setAttribute('font-size','10');t.setAttribute('text-anchor','middle');t.setAttribute('fill',p.fontColor||'#fff');t.textContent=p.label;svg.append(t);continue;}
          const lines=g.type==='Polygon'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
          const path=document.createElementNS(ns,'path');path.setAttribute('d',lines.map(line=>line.map((v,i)=>(i?'L':'M')+xy(v).join(',')).join(' ')+(g.type.includes('Polygon')?' Z':'')).join(' '));
          path.setAttribute('stroke',p.strokeColor||p.lineColor||'#fff');path.setAttribute('stroke-width','1.5');path.setAttribute('fill',g.type.includes('Polygon')?(p.fillColor||'#dbeafe'):'none');path.setAttribute('fill-opacity',String(p.fillOpacity ?? 0.25));path.setAttribute('stroke-opacity',String(p.lineOpacity ?? 1));path.setAttribute('fill-rule','evenodd');
          if(Array.isArray(p.strokeDasharray))path.setAttribute('stroke-dasharray',p.strokeDasharray.join(' '));
          if(p.fillPattern){const defs=document.createElementNS(ns,'defs'),pattern=document.createElementNS(ns,'pattern'),img=document.createElementNS(ns,'image');const id='tactical-pattern-'+(++previewPatternId);pattern.id=id;pattern.setAttribute('patternUnits','userSpaceOnUse');pattern.setAttribute('width','13');pattern.setAttribute('height','13');img.setAttribute('href',p.fillPattern);img.setAttribute('width','13');img.setAttribute('height','13');pattern.append(img);defs.append(pattern);svg.append(defs);path.setAttribute('fill','url(#'+id+')');path.setAttribute('fill-opacity','1');}svg.append(path);
        }

return svg;
  }
  function updatePreview() {
    if(!active)return;preview.replaceChildren();
    if(!active.point){
      preview.style.flexDirection='column';
      const guide=document.createElement('div');guide.textContent=active.metadata.selectable===false?'미지원 부호 · 속성 편집 및 저장 가능':'전술 부호 · 적용하면 지도에 반영됩니다.';preview.append(guide);
      if(active.metadata.selectable===false)return;
      try {
        const state=readForm();
        const geo=global.unifiedControlPanel.previewTactical(active.metadata,active.entity,state,renderCode(active.schema,state));
        if(!geo)throw new Error('이 부호의 미리보기를 생성할 수 없습니다.');
        const svg=buildTacticalPreview(geo);
        preview.append(svg);
        const note=document.createElement('small');note.textContent=active.entity?'배치된 도형 기준':'배치 전 미리보기';preview.append(note);
      }catch(error){const note=document.createElement('small');note.textContent=error.message;preview.append(note);}
      return;
    }
    try {
      const state=readForm();const sidc=renderCode(active.schema,state),options=renderOptions(active.schema,state,active.baseOptions);
      let svg;
      if(active.metadata.renderer==='icop-svg')svg=global.IcopSvgRenderer.render(active.metadata,sidc,options,state.values);
      else {const symbol=new global.ms.Symbol(sidc,options);if(!symbol.isValid())throw new Error('현재 값으로 부호를 표시할 수 없습니다.');svg=symbol.asSVG();}
      const img=document.createElement('img');img.alt='편집 부호 미리보기';img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);img.style.cssText='max-height:120px;max-width:100%;';preview.append(img);
    } catch(error){preview.textContent=error.message;}
  }
  async function open(metadata={}, entity=null, onApply=null) {
    const ticket=++sequence;ensurePanel();active=null;form.replaceChildren();message.textContent="편집 정의를 불러오는 중입니다.";
    try {
      const [definitions,catalog]=await load();if(ticket!==sequence)return;
      let node=metadata;
      const code=entity?.customData?.icopCode||metadata.icopCode;
      let schema=definitions.entries[metadata.id] || definitions.entries['ICOP.'+metadata.icopHierarchy];
      if(!schema) {
        const sidc=entity?.customData?.sidc||metadata.data||'';
        node=catalog.find(n=>code && n.icopCode===code)||catalog.find(n=>n.data && n.data.slice(0,1)===sidc.slice(0,1)&&n.data.slice(2,3)===sidc.slice(2,3)&&n.data.slice(4,10)===sidc.slice(4,10))||metadata;
        schema=definitions.entries[node.id];
      }
      if(!schema)throw new Error('이 부호에 대응하는 ICOP 편집 정의가 없습니다.');
      const id=metadata.id||node.id;const saved=entity?entity.customData?.icopEditor:readDraft(id);
      const activeSidc=typeof metadata.activeSidc==='string' && metadata.activeSidc.length===15 ? metadata.activeSidc : null;
      const sidc=entity?.customData?.sidc||activeSidc||metadata.data||node.data||schema.code;
      const state=buildState(schema,saved||{},sidc);
      // 신규 부호 편집에서는 군대부호 창에서 고른 현재 피아식별 SIDC를 최우선으로 유지한다.
      state.sidc=entity ? sidc : (activeSidc || saved?.sidc || sidc);
      if(entity)state.name=entity.name || state.name;
      const baseOptions=entity?.customData?.symbolOptions||metadata.symbolOptions||{};
      if(!saved) {
        if(entity)state.name=entity.name||state.name;
        state.size=baseOptions.size||60;
        for(const f of schema.fields)if(f.option && baseOptions[f.option]!=null)state.values[f.key]=baseOptions[f.option];
        if(sidc.length===15) {
          if(schema.fields.some(f=>f.key==='B') && /^[A-N]$/.test(sidc[11]))state.values.B=sidc[11];
          if(schema.category==='u') {state.values.S='ABCD'.includes(sidc[10]);state.values.D='BDEG'.includes(sidc[10]);state.values.AB='CDFG'.includes(sidc[10]);}
        }
      }
      active={schema,metadata:node,id,entity,onApply,state,baseOptions,point:!!entity?.billboard || ['milsymbol','icop-svg'].includes(node.renderer)&&node.selectable!==false};
      form.replaceChildren(preview);const title=document.createElement('p');title.textContent=schema.name+' · '+schema.code;form.append(title);
      inputRow('표시 이름','displayName','text',state.name,{maxLength:80});if(active.point)inputRow('점 부호 크기','symbolSize','number',state.size,{min:7,max:200,step:1});
      if(!schema.code.startsWith('W'))inputRow('피아식별','affiliation','select',state.sidc[1],{options:[{"value": "-", "label": "미지정"}, {"value": "P", "label": "식별보류"}, {"value": "U", "label": "미식별"}, {"value": "F", "label": "아군"}, {"value": "N", "label": "중립"}, {"value": "H", "label": "적군"}, {"value": "A", "label": "아군간주"}, {"value": "S", "label": "적군간주"}, {"value": "G", "label": "(훈)식별보류"}, {"value": "W", "label": "(훈)미식별"}, {"value": "D", "label": "(훈)아군"}, {"value": "L", "label": "(훈)중립"}, {"value": "M", "label": "(훈)아군간주"}, {"value": "J", "label": "의심적"}, {"value": "K", "label": "가상적"}]});
      for(const f of schema.fields)inputRow(f.label,'field:'+f.key,f.type,state.values[f.key],{...f,options:f.key==='B' && active.point && node.renderer!=='icop-svg' ? f.options.map(o=>({...o,label:o.label+(/^[A-N]$/.test(o.value)?'':' · 속성 저장')})) : f.options,stored:node.renderer==='icop-definition' ? !global.IcopDefinitionRenderer.supportsField(node.icopCode,f.key) : node.selectable===false || (active.point ? (!f.option && f.key!=='B' && !(schema.category==='u'&&['D','S','AB'].includes(f.key))) : !(f.group==='modifier' && Object.keys(global.C5Ren?.Modifiers || {}).some(k=>k.startsWith(f.key+'_'))))});
      message.textContent=entity?'적용하면 선택한 객체의 속성이 갱신됩니다.':'적용하면 이 부호의 기본 편집값이 이 브라우저에 저장됩니다.';
      if(!schema.fields.length)message.textContent+=' 원본에 개별 편집 항목이 정의되어 있지 않습니다.';
      if(!panel.open)panel.showModal();updatePreview();form.elements.displayName.focus();
    } catch(error){if(ticket!==sequence)return;message.textContent=error.message;if(!panel.open)panel.showModal();}
  }
  async function apply(event) {
    event.preventDefault();if(!active)return;
    try {
      if(!form.reportValidity())return;
      const state=readForm();const sidc=renderCode(active.schema,state);const options=renderOptions(active.schema,state,active.baseOptions);state.symbolOptions=options;state.renderSidc=sidc;
      if(active.point && active.metadata.renderer!=='icop-svg' && !(new global.ms.Symbol(sidc,options)).isValid())throw new Error('선택한 속성으로 부호를 렌더링할 수 없습니다.');
      if(active.metadata.renderer==='icop-definition') {
        const points=active.entity?.customData?.positions || global.IcopDefinitionRenderer.sample(sidc,state.values);
        global.IcopDefinitionRenderer.render(sidc,points,state.name,state.values);
      }
      if(active.metadata.renderer==='icop-svg')global.IcopSvgRenderer.render(active.metadata,sidc,options,state.values);
      if(active.entity) {
        const entity=active.entity;const viewer=global.CesiumViewer;
        if(!viewer.entities.contains(entity))throw new Error('편집할 객체가 삭제되었습니다.');
        if(entity.customData?.multipointTacticalGraphic) {
          const ok=global.unifiedControlPanel.updateTacticalEntity(entity,state,sidc);
          if(!ok)throw new Error('이 전술 부호의 지도 갱신에 실패했습니다. 기존 객체는 유지됩니다.');
        }
        entity.name=state.name;entity.customData={...entity.customData,displayName:state.name,sidc,symbolOptions:options,icopCode:active.schema.code,symbolMetadata:active.metadata,icopEditor:state};
        document.dispatchEvent(new CustomEvent('military-symbol-updated',{detail:{entity}}));viewer.scene.requestRender();
      } else {saveDraft(active.id,state);if(active.onApply)active.onApply({state,sidc,symbolOptions:options});}
      close();
    }catch(error){message.textContent=error.message;}
  }
  global.IcopSymbolEditor={buildTacticalPreview,open,openEntity:entity=>open(entity.customData?.symbolMetadata||{},entity),readDraft,buildState,renderCode,renderOptions};
})(window);
