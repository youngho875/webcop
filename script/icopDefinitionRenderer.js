(function(global){
'use strict';
const entries=Object.values(global.ICOP_DEFINITION_DATA.entries);
const signature=code=>code?.startsWith('W')?code:String(code||'')[0]+String(code||'')[2]+String(code||'').slice(4,10);
const index=new Map(entries.map(e=>[signature(e.code),e]));
const definition=code=>index.get(signature(code));
const yes=v=>v===true||v==='true'||v==='1';
const num=(v,d)=>Number.isFinite(Number(v))&&v!==''?Number(v):d;
function valuesFor(e,values){return {...e.defaults,...Object.fromEntries(e.fields.map(f=>[f.key,f.default??''])),...values};}
function requirements(code,values={}){const e=definition(code);if(!e)return null;const count=e.type===34?Math.max(3,Math.min(4,Math.round(num(values.PTC,3)))):null;return {min:count||e.min,max:count||e.max};}
function sample(code,values={}){const e=definition(code),r=requirements(code,values);let pts=e.points.slice();if(pts.length>1&&JSON.stringify(pts[0])===JSON.stringify(pts.at(-1)))pts.pop();while(pts.length<r.min)pts.push([pts.length*50,pts.length%2*40]);return pts.slice(0,r.max).map(p=>({lon:127+p[0]/10000,lat:37-p[1]/10000}));}
function iconImage(code){
 if(!code)return null;const text=String(code).split('/')[0];const assets=global.ICOP_VECTOR_DATA?.assets||{};
 const key=Object.keys(assets).find(name=>signature(name.replace(/\.wssi$/,'').replace(/_C$/,''))===signature(text));
 if(!key)return null;
 try {return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(global.IcopSvgRenderer.render({icopSvgAsset:key},text,{size:40}));}catch{return null;}
}
function supportsField(code,key){
 const e=definition(code);if(!e)return false;
 if(/^DEF_|^(V|LB|DTL)/.test(key))return true;
 if(['SFD','INT','COL','T1','ICO','ICON','ICP','ICS','ICE','RPT','LNT','SAT','EAT','ATL','ATR','ATS','ATE','AT'].includes(key))return true;
 if(key==='PTC')return e.type===34;
 if(['AM','AM1','AM2'].includes(key))return [16,18,30].includes(e.type);
 if(['Q','Z'].includes(key))return e.type===40;
 return e.labels.some(l=>String(l.text).includes('%'+key)) || key==='A'&&[34,40].includes(e.type);
}
function render(code,coordinates,name,rawValues={}){
 const e=definition(code);if(!e)throw Error('원본 부호 정의를 찾을 수 없습니다.');const v=valuesFor(e,rawValues),req=requirements(code,v);
 if(!Array.isArray(coordinates)||coordinates.length<req.min||coordinates.length>req.max)throw Error(`${req.min}${req.max!==req.min?'~'+req.max:''}개 기준점이 필요합니다.`);
 if(coordinates.some(p=>!Number.isFinite(p.lon)||!Number.isFinite(p.lat)))throw Error('유효하지 않은 좌표입니다.');
 const origin=coordinates[0],cos=Math.max(.01,Math.cos(origin.lat*Math.PI/180));
 const local=coordinates.map(p=>[(p.lon-origin.lon)*111320*cos,(p.lat-origin.lat)*111320]);
 const geo=p=>[origin.lon+p[0]/(111320*cos),origin.lat+p[1]/111320];
 const features=[];const sourceColor=e.style.lc?.startsWith('#')?('#'+e.style.lc.slice(-6)):code[1]==='H'?'#ff3030':code[1]==='F'?'#30bfff':'#ffff00';
 const color=rawValues.DEF_LC||(/^#[0-9a-f]{6}$/i.test(String(v.COL))?v.COL:sourceColor);const width=Math.max(1,Math.min(20,num(v.DEF_LW,2)));
 const props={strokeColor:color,strokeWidth:width,lineOpacity:1};
 if(String(v.LNT).split(',')[0]==='2')props.strokeDasharray=[6,6];
 const feature=(type,coords,properties)=>features.push({type:'Feature',geometry:{type,coordinates:coords},properties});
 const line=pts=>{if(pts.length>1)feature('LineString',pts.map(geo),{...props});};
 const polygon=pts=>{const closed=[...pts,pts[0]];const p={...props,fillColor:v.DEF_FC||color,fillOpacity:yes(v.DEF_FILL)?.2:0};if(e.patterns.length)p.fillPattern='data:image/png;base64,'+e.patterns[0].base64;feature('Polygon',[closed.map(geo)],p);};
 const resolve=txt=>String(txt??'').replace(/%([A-Z]+\d*)/g,(_,k)=>String(v[k]??'')).replace(/\\/g,'\n');
 const text=(p,txt)=>{const label=resolve(txt);if(label)feature('Point',geo(p),{label,fontColor:color,fontSize:12});};
 const image=(p,code)=>{const image=iconImage(code);if(image)feature('Point',geo(p),{image});else if(code)text(p,String(code));};
 const xs=local.map(p=>p[0]),ys=local.map(p=>p[1]);let left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
 const center=[(left+right)/2,(bottom+top)/2];let span=Math.max(right-left,top-bottom,100),gap=span*.06;
 const cap=(end,prev,spec)=>{const parts=String(spec??'0').split(','),kind=num(parts[0],0);if(!kind)return;const dx=end[0]-prev[0],dy=end[1]-prev[1],len=Math.hypot(dx,dy);if(!len)return;const ux=dx/len,uy=dy/len,size=span*.07*Math.max(.2,num(parts[1],7)/7),w=size*.6*Math.max(.2,num(parts[2],5)/5);const back=[end[0]-ux*size,end[1]-uy*size];if(kind===18)line([[end[0]-uy*w,end[1]+ux*w],[end[0]+uy*w,end[1]-ux*w]]);else line([[back[0]-uy*w,back[1]+ux*w],end,[back[0]+uy*w,back[1]-ux*w]]);};
 let path=local;
 if([16,18].includes(e.type)){
   const radii=(e.type===18?[v.AM,v.AM1,v.AM2]:[v.AM]).map(x=>Math.max(1,num(x,100)));
   for(const radius of radii){const ring=Array.from({length:64},(_,i)=>[local[0][0]+radius*Math.cos(i*Math.PI/32),local[0][1]+radius*Math.sin(i*Math.PI/32)]);polygon(ring);}
   const radius=Math.max(...radii);left=-radius;right=radius;top=radius;bottom=-radius;span=radius*2;gap=span*.06;
 }else if(e.type===30){
   const a=local[0],b=local[1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,half=Math.max(1,num(v.AM,70))/2;polygon([[a[0]-dy/len*half,a[1]+dx/len*half],[b[0]-dy/len*half,b[1]+dx/len*half],[b[0]+dy/len*half,b[1]-dx/len*half],[a[0]+dy/len*half,a[1]-dx/len*half]]);
 }else if(e.type===34){path=[local[1],local[0],...local.slice(2)];line(path);cap(path[0],path[1],v.ATL);cap(path.at(-1),path.at(-2),v.ATR);
 }else if(e.type===42){const c=local[0],a=local[1],b=local[2],radius=Math.hypot(a[0]-c[0],a[1]-c[1]);let start=Math.atan2(a[1]-c[1],a[0]-c[0]),end=Math.atan2(b[1]-c[1],b[0]-c[0]);if(end<start)end+=Math.PI*2;path=Array.from({length:49},(_,i)=>[c[0]+radius*Math.cos(start+(end-start)*i/48),c[1]+radius*Math.sin(start+(end-start)*i/48)]);line([c,...path,c]);
 }else if(e.type===43){const a=local[0],b=local[2],dx=b[0]-a[0],dy=b[1]-a[1],angle=Math.atan2(dy,dx),len=Math.hypot(dx,dy)||1,radius=Math.max(1,Math.abs((local[1][0]-a[0])*dy-(local[1][1]-a[1])*dx)/len);const arc=(c,start)=>Array.from({length:25},(_,i)=>[c[0]+radius*Math.cos(start+i*Math.PI/24),c[1]+radius*Math.sin(start+i*Math.PI/24)]);polygon([...arc(b,angle-Math.PI/2),...arc(a,angle+Math.PI/2)]);
 }else if(e.type===40){const speed=Math.max(0,num(v.Z,0)),angle=(270-num(v.Q,0))*Math.PI/180,len=500,tip=[Math.cos(angle)*len,Math.sin(angle)*len];line([[0,0],tip]);let remaining=Math.round(speed/5)*5,k=0;while(remaining>=5&&k<30){const dist=len-k*35,base=[Math.cos(angle)*dist,Math.sin(angle)*dist],flag=remaining>=10?130:65;line([base,[base[0]+Math.cos(angle+Math.PI/3)*flag,base[1]+Math.sin(angle+Math.PI/3)*flag]]);remaining-=remaining>=10?10:5;k++;}image([0,0],v.A);
 }else if(e.type!==24){if([28,41,35].includes(e.type))polygon(local);else line(local);cap(local[0],local[1],v.SAT??v.ATL??v.ATS);cap(local.at(-1),local.at(-2),v.EAT??v.ATR??v.ATE??v.AT);}
 // Use original label definitions, including modifier substitutions, and edited placement fields.
 const labelMap=new Map(e.labels.map(l=>[l.name,l.text]));for(const f of e.fields)if(f.group==='geometry'&&f.type==='text'&&/^V|^LB|^DTL$/.test(f.key))labelMap.set(f.key,v[f.key]??'');
 const start=path[0],end=path.at(-1),anchor=key=>{
   if(['LBC','VCC','VMC','VC','LBM'].includes(key))return e.type===34?local[0]:center;
   if(key==='LBL')return [left-gap,center[1]];if(key==='LBR')return [right+gap,center[1]];
   if(/^VS|^LBS/.test(key))return start;if(/^VE|^LBE/.test(key))return end;
   return [/[LR]$/.test(key)?(key.endsWith('L')?left-gap:right+gap):/L/.test(key)?left-gap:/R/.test(key)?right+gap:center[0],/^VT|^V.T$/.test(key)?top+gap:/^VB|^V.B$/.test(key)?bottom-gap:center[1]];
 };
 for(const [key,original] of labelMap){if(!/^(V|LB|DTL)/.test(key))continue;const edited=Object.hasOwn(rawValues,key)?rawValues[key]:original;if(key==='LBC'&&String(edited).includes('%A'))image(anchor(key),v.A);else text(anchor(key),edited);}
 if(v.T1&&!e.labels.some(l=>String(l.text).includes('%T1')))text([center[0],bottom-gap],v.T1);
 if(v.SFD && v.SFD!=='none'){
   const y=v.SFD==='top'?top+gap*2:center[1];const start=features.length;
   line([[center[0]-span*.1,y],[center[0],y+span*.08],[center[0]+span*.1,y]]);
   if(features[start])features[start].properties.strokeDasharray=[5,5];
 }
 if(e.type===36 && num(v.INT,0)>0){
   const spacing=Math.max(span*.03,span*num(v.INT,10)/100);let carried=0;
   for(let i=1;i<local.length;i++){
     const a=local[i-1],b=local[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
     for(let d=spacing-carried;d<len;d+=spacing){const t=d/len;cap([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],a,v.AT||'1');}
     carried=(carried+len)%spacing;
   }
 }
 const ico=v.ICO||v.ICON;if(ico){if(yes(v.RPT))local.forEach(p=>image(p,ico));else{if(yes(v.ICS))image(start,ico);if(yes(v.ICE))image(end,ico);if(!yes(v.ICS)&&!yes(v.ICE))image(v.ICP==='top'?[center[0],top]:v.ICP==='bottom'?[center[0],bottom]:v.ICP==='left'?[left,center[1]]:v.ICP==='right'?[right,center[1]]:center,ico);}}
 if(!features.some(f=>f.properties.label||f.properties.image))text(center,name||v.T||e.name);
 return {type:'FeatureCollection',features};
}
global.IcopDefinitionRenderer={definition,requirements,sample,render,valuesFor,supportsField,version:1};
})(window);
