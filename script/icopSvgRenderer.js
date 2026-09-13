(function(global) {
  'use strict';
  const data=global.ICOP_VECTOR_DATA;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const number=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
  const fmt=n=>String(Math.round(n*10000)/10000);
  const palette=['none','#000000','#ffffff','#ff8080','#80e0ff','#aaffaa','#ffff80','#ff00ff','#808080'];
  function color(value) {
    if(value==null)return 'none';
    if(/^#[0-9a-f]{8}$/i.test(value))return '#'+value.slice(3)+value.slice(1,3);
    if(/^#[0-9a-f]{6}$/i.test(value))return value;
    return palette[number(value)]||'#000000';
  }
  function resolve(metadata) { return data?.assets[metadata?.icopSvgAsset]; }
  function build(metadata,sidc,options={},values={}) {
    const asset=resolve(metadata);if(!asset)throw new Error('ICOP 원본 벡터가 없습니다.');
    const defaults=Object.assign({},...asset.children.filter(n=>n.tag==='exmod').map(n=>n.a));
    values={...defaults,...values};
    const bounds=[];let body='';const drawnModifiers=new Set();
    function point(x,y){bounds.push([x,y]);}
    function style(a){return `stroke="${color(a.lc??'1')}" fill="${color(a.fc??'0')}" stroke-width="${fmt(a.lw==='Normal'?.04:Math.max(.008,number(a.lw,.04)))}" stroke-linejoin="round" stroke-linecap="round"${a.dash==='1'?' stroke-dasharray=".09 .06"':''}`;}
    function transform(a,pts) {
      const cx=0,cy=0,angle=number(a.rot)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
      const sx=a.rfh==='1'?-1:1,sy=a.rfv==='1'?-1:1;
      // Source symbol coordinates rotate/reflect about the symbol origin.
      for(const [x,y] of pts)point(cx+(x*sx)*cos-(y*sy)*sin,cy+(x*sx)*sin+(y*sy)*cos);
      return `transform="rotate(${fmt(number(a.rot))}) scale(${sx} ${sy})"`;
    }
    function pathPoints(a) {
      if(a.st==='1') {const raw=(a.pt||'').split(',').map(v=>number(v));const pts=[];for(let i=0;i+1<raw.length;i+=2)pts.push([raw[i],raw[i+1]]);return pts;}
      const l=number(a.l),t=number(a.t),r=number(a.r),b=number(a.b),cx=(l+r)/2,cy=(t+b)/2,rx=Math.abs(r-l)/2,ry=Math.abs(b-t)/2;
      const start=number(a.sa),sweep=number(a.wa,360),steps=Math.max(2,Math.ceil(Math.abs(sweep)/3));
      const pts=[];for(let i=0;i<=steps;i++){const angle=(start+sweep*i/steps)*Math.PI/180;pts.push([cx+rx*Math.cos(angle),cy+ry*Math.sin(angle)]);}return pts;
    }
    function arcD(a) {
      const l=number(a.l),r=number(a.r),t=number(a.t),b=number(a.b),rx=Math.abs(r-l)/2,ry=Math.abs(b-t)/2,cx=(l+r)/2,cy=(t+b)/2;
      const start=number(a.sa),sweep=number(a.wa,360),segments=Math.max(1,Math.ceil(Math.abs(sweep)/180));
      const coord=deg=>[cx+rx*Math.cos(deg*Math.PI/180),cy+ry*Math.sin(deg*Math.PI/180)];
      let result='M'+coord(start).map(fmt).join(' ');
      for(let i=1;i<=segments;i++)result+=` A${fmt(rx)} ${fmt(ry)} 0 0 ${sweep>=0?1:0} ${coord(start+sweep*i/segments).map(fmt).join(' ')}`;
      return result;
    }
    function pathD(pts){return pts.map(([x,y],i)=>(i?'L':'M')+fmt(x)+' '+fmt(y)).join(' ');}
    function draw(n) {
      const a=n.a||{};if(n.tag==='frlink'||n.tag==='exmod'||n.tag==='modname')return '';
      if(n.tag==='path') {
        const pts=n.children.flatMap(child=>pathPoints(child.a));if(!pts.length)return '';
        const tr=transform(a,pts);return `<path d="${pathD(pts)}${a.mg==='1'?' Z':''}" ${style(a)} ${tr}/>`;
      }
      if(n.tag!=='sh')return n.children.map(draw).join('');
      const type=a.st,l=number(a.l),t=number(a.t),r=number(a.r),b=number(a.b);let markup='',pts=[];
      if(type==='1'||type==='4') {
        pts=pathPoints(a);if(!pts.length)return '';
        const closed=type==='1'&&color(a.fc)!=='none'&&pts.length>2;
        markup=`<path d="${type==='4'?arcD(a):pathD(pts)}${closed?' Z':''}" ${style(a)}/>`;
      } else if(type==='2'||type==='3') {
        pts=[[l,t],[r,t],[r,b],[l,b]];
        markup=type==='2'?`<rect x="${fmt(Math.min(l,r))}" y="${fmt(Math.min(t,b))}" width="${fmt(Math.abs(r-l))}" height="${fmt(Math.abs(b-t))}" ${style(a)}/>`:`<ellipse cx="${fmt((l+r)/2)}" cy="${fmt((t+b)/2)}" rx="${fmt(Math.abs(r-l)/2)}" ry="${fmt(Math.abs(b-t)/2)}" ${style(a)}/>`;
      } else if(type==='5'||type==='6') {
        const text=type==='6'?(values[a.md]??''):a.tx;if(type==='6')drawnModifiers.add(a.md);
        if(text==null||text==='')return '';
        const height=Math.max(.12,Math.abs(b-t)),x=a.ha==='0'?l:a.ha==='2'?r:(l+r)/2;
        const anchor=a.ha==='0'?'start':a.ha==='2'?'end':'middle';
        const width=Math.max(Math.abs(r-l),Array.from(String(text)).length*height*.65);
        pts=[[x-(anchor==='middle'?width/2:anchor==='end'?width:0),t],[x+(anchor==='middle'?width/2:anchor==='start'?width:0),b]];
        markup=`<text x="${fmt(x)}" y="${fmt((t+b)/2)}" fill="${color(a.lc??'1')}" stroke="none" font-size="${fmt(height)}" text-anchor="${anchor}" dominant-baseline="central">${escape(text)}</text>`;
      } else throw new Error('해석되지 않은 원본 도형 종류: '+type);
      return `<g ${transform(a,pts)}>${markup}</g>`;
    }
    const aff='PUAFNSHGDWLMJK'.includes(sidc?.[1])?sidc[1]:'U';
    if(asset.tag==='wssi_basic') {
      const frame=data.frames[aff+asset.a.bd]||data.frames['U'+asset.a.bd];if(!frame)throw new Error('피아식별 프레임 정의가 없습니다.');
      if(options.frame!==false)body+=draw(frame);
      const baseAff=({A:'F',P:'U',S:'H',G:'U',W:'U',D:'F',M:'F',L:'N',J:'H',K:'H'})[aff]||aff;
      const variant=asset.children.find(n=>n.tag==='aff'&&n.a.af===baseAff)||asset.children.find(n=>n.tag==='aff'&&n.a.af==='*')||(asset.children.filter(n=>n.tag==='aff').length===1?asset.children.find(n=>n.tag==='aff'):null);
      if(!variant)throw new Error('피아식별별 도형 정의가 없습니다.');body+=draw(variant);
    } else body+=asset.children.map(draw).join('');
    if(!body||!bounds.length)throw new Error('표시 가능한 원본 도형이 없습니다.');
    let left=Math.min(...bounds.map(p=>p[0])),right=Math.max(...bounds.map(p=>p[0])),top=Math.min(...bounds.map(p=>p[1])),bottom=Math.max(...bounds.map(p=>p[1]));
    const baseBounds={left,right,top,bottom};
    const echelon=values.B||sidc?.[11];
    if(asset.tag==='wssi_basic'&&data.glyphs.B?.[echelon]) {
      const before=bounds.length,offset=top-.25;const glyph=draw(data.glyphs.B[echelon]);
      for(let i=before;i<bounds.length;i++)bounds[i][1]+=offset;
      body+=`<g transform="translate(0 ${fmt(offset)})">${glyph}</g>`;
    }
    if(asset.tag==='wssi_basic') {
      const modifier=sidc?.[10]||'-';
      if(values.S===true||'ABCD'.includes(modifier)) {
        body+=`<path d="M${fmt(baseBounds.left)} ${fmt(baseBounds.bottom)} v.7" stroke="#000" stroke-width=".04" fill="none"/>`;
        point(baseBounds.left,baseBounds.bottom+.7);
      }
      if(values.D===true||'BDEG'.includes(modifier)) {
        const y=baseBounds.top-.18;
        body+=`<path d="M-.24 ${fmt(baseBounds.top)} V${fmt(y)} H.24 V${fmt(baseBounds.top)}" stroke="#000" stroke-width=".04" fill="none"/>`;point(-.24,y);point(.24,y);
      }
      if(values.AB===true||'CDFG'.includes(modifier)) {
        const y=baseBounds.top-.4;
        body+=`<path d="M${fmt(baseBounds.left)} ${fmt(baseBounds.top)} L0 ${fmt(y)} L${fmt(baseBounds.right)} ${fmt(baseBounds.top)}" stroke="#000" stroke-width=".04" stroke-dasharray=".08 .05" fill="none"/>`;point(0,y);
      }
    }
    const direction=options.direction??values.Q;
    if(direction!==''&&direction!=null&&Number.isFinite(Number(direction))) {
      const angle=Number(direction)*Math.PI/180,x=Math.sin(angle)*.8,y=baseBounds.bottom+.1-Math.cos(angle)*.8,sy=baseBounds.bottom+.1;
      const hx=-Math.sin(angle)*.15,hy=Math.cos(angle)*.15;
      body+=`<path d="M0 ${fmt(sy)} L${fmt(x)} ${fmt(y)} M${fmt(x+hx-Math.cos(angle)*.08)} ${fmt(y+hy-Math.sin(angle)*.08)} L${fmt(x)} ${fmt(y)} L${fmt(x+hx+Math.cos(angle)*.08)} ${fmt(y+hy+Math.sin(angle)*.08)}" stroke="#000" stroke-width=".04" fill="none"/>`;
      point(x-.15,y-.15);point(x+.15,y+.15);point(0,sy);
    }
    const labels={T:options.uniqueDesignation,M:options.higherFormation,C:options.quantity,H:options.additionalInformation,G:options.staffComments,W:options.dtg,V:options.type,F:options.reinforcedReduced,J:options.evaluationRating,K:options.combatEffectiveness,L:options.signatureEquipment,N:options.hostile,P:options.iffSif,X:options.altitudeDepth,Y:options.location,Z:options.speed,AA:options.specialHeadquarters,AD:options.platformType,AE:options.equipmentTeardownTime,AF:options.commonIdentifier};
    let row=0;for(const [key,text] of Object.entries(labels)) {
      const value=text??values[key];if(value==null||value===''||drawnModifiers.has(key))continue;
      if(defaults[key]!=null && String(value)===String(defaults[key]))continue;
      // Only explicit edits become additional labels; raw exmod defaults are drawn at their source positions.
      if(text==null && !(metadata.icopEditor?.values?.[key]))continue;
      const y=bottom+.26+row++*.24,width=Array.from(String(value)).length*.14;
      body+=`<text x="0" y="${fmt(y)}" fill="#000" font-size=".22" text-anchor="middle">${escape(value)}</text>`;point(-width/2,y-.22);point(width/2,y+.04);
    }
    left=Math.min(...bounds.map(p=>p[0]))-.08;right=Math.max(...bounds.map(p=>p[0]))+.08;top=Math.min(...bounds.map(p=>p[1]))-.08;bottom=Math.max(...bounds.map(p=>p[1]))+.08;
    const scale=Math.max(7,Math.min(200,number(options.size,60)))/Math.max(baseBounds.right-baseBounds.left,baseBounds.bottom-baseBounds.top,.2);
    const width=Math.max(1,(right-left)*scale),height=Math.max(1,(bottom-top)*scale);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="${fmt(left)} ${fmt(top)} ${fmt(right-left)} ${fmt(bottom-top)}" font-family="Arial, sans-serif"><title>${escape(metadata.text||metadata.symbolName||'ICOP 군대부호')}</title>${body}</svg>`;
    return {svg,width,height};
  }
  function render(metadata,sidc,options={},values={}){return build(metadata,sidc,options,values).svg;}
  global.IcopSvgRenderer={render,build,has:metadata=>!!resolve(metadata)};
})(window);
