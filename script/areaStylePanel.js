(function (global) {
    'use strict';

    const PANEL_ID = 'area-style-panel';
    const STYLE_ID = 'area-style-panel-css';
    let panel = null;
    let pendingDraw = null;
    let panelMode = 'draw';
    let autoApplyTimer = null;

    const state = {
        fillType: 'solid', fillColor: '#22d3ee', fillOpacity: 32,
        lineType: 'solid', lineColor: '#ffffff', lineOpacity: 100,
        lineWidth: 2, sketchStyle: 'normal', capType: 'round', dashType: 'solid',
        shapeName: '', startStyle: 'none', endStyle: 'none',
        pointGeometry: false, pointShapeType: 'circle', pointLongitude: 0, pointLatitude: 0, pointWidth: 30, pointHeight: 30,
        circleGeometry: false, circleShapeType: 'circle', circleLongitude: 0, circleLatitude: 0,
        circleRadius: 1, circleMajorRadius: 1, circleMinorRadius: 1,
        arcGeometry: false, arcShapeType: 'sector', arcLongitude: 0, arcLatitude: 0, arcDirection: 0, arcAngle: 90, arcRadius: 1,
        triangleGeometry: false, triangleShapeType: 'equilateralTriangle', triangleLongitude: 0, triangleLatitude: 0,
        rotationEnabled: false, rotation: 0,
        lineShapeType: 'straight',
        coordinateGeometry: false, coordinateText: '',
        rectangleGeometry: false, rectangleLongitude: 0, rectangleLatitude: 0,
        rectangleWidth: 1, rectangleHeight: 1, rectangleShapeType: 'rectangle', rectangleRadius: 0,
        roundedRectangleGeometry: false, roundedRectangleLongitude: 0, roundedRectangleLatitude: 0,
        roundedRectangleWidth: 1, roundedRectangleHeight: 1, roundedRectangleRadius: 0.1
    };

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID}{position:fixed;right:28px;top:86px;z-index:2300;width:360px;color:#e8edf1;background:#17191c;border:1px solid rgba(255,255,255,.16);border-radius:8px;box-shadow:0 20px 55px rgba(0,0,0,.52);font:14px/1.35 "Malgun Gothic",Arial,sans-serif;overflow:hidden;user-select:none}
            #${PANEL_ID}[hidden], #${PANEL_ID} [hidden]{display:none!important} #${PANEL_ID} *{box-sizing:border-box}
            #${PANEL_ID} .asp-head{height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;background:linear-gradient(#62666a,#484b4f);border-bottom:2px solid #090a0b;cursor:move}
            #${PANEL_ID} .asp-icon{display:grid;place-items:center;width:27px;height:27px;color:#fff;background:#12638a;border:1px solid rgba(255,255,255,.2);font-size:18px;font-weight:800}
            #${PANEL_ID} .asp-title{flex:1;font-weight:700} #${PANEL_ID} .asp-close{width:28px;height:28px;border:0;border-radius:5px;color:#ddd;background:transparent;font-size:20px;cursor:pointer} #${PANEL_ID} .asp-close:hover{background:rgba(239,68,68,.35);color:#fff}
            #${PANEL_ID} details{border-bottom:1px solid #060708} #${PANEL_ID} summary{height:36px;padding:8px 13px;list-style:none;background:linear-gradient(#666,#565656);font-weight:700;cursor:pointer} #${PANEL_ID} summary::-webkit-details-marker{display:none} #${PANEL_ID} summary::before{content:'›';display:inline-block;margin-right:10px;transition:.18s} #${PANEL_ID} details[open] summary::before{transform:rotate(90deg)}
            #${PANEL_ID} .asp-section{padding:12px 16px 15px;background:#1b1d20} #${PANEL_ID} .asp-radio{display:flex;align-items:center;gap:10px;margin:7px 0;cursor:pointer} #${PANEL_ID} input[type=radio]{appearance:none;width:20px;height:20px;margin:0;border:0;border-radius:50%;background:#343638} #${PANEL_ID} input[type=radio]:checked{background:#d55b18;box-shadow:inset 0 0 0 6px #d55b18} #${PANEL_ID} input[type=radio]:checked::after{content:'';display:block;width:6px;height:6px;margin:7px;border-radius:50%;background:#fff}
            #${PANEL_ID} .asp-rule{border:0;border-top:1px solid #c3c7ca;margin:12px 0} #${PANEL_ID} .asp-row{display:grid;grid-template-columns:88px 1fr 76px;align-items:center;gap:9px;min-height:38px} #${PANEL_ID} .asp-row.two{grid-template-columns:88px 1fr} #${PANEL_ID} .asp-row label{color:#e3e6e9;font-weight:600}
            #${PANEL_ID} input[type=color]{width:64px;height:31px;justify-self:end;padding:3px;border:1px solid #111;border-radius:5px;background:#383b3e;cursor:pointer} #${PANEL_ID} input[type=range]{width:100%;accent-color:#d6dadd} #${PANEL_ID} input[type=number],#${PANEL_ID} select{width:100%;height:31px;padding:3px 8px;color:#f2f2f2;background:#303235;border:1px solid #111;border-radius:5px} #${PANEL_ID} .asp-percent{font-weight:700;text-align:right;color:#fff}
            #${PANEL_ID} .asp-footer{padding:12px 16px;background:#111315;border-top:1px solid #333} #${PANEL_ID} .asp-draw-button{width:100%;height:40px;border:1px solid rgba(56,189,248,.5);border-radius:7px;color:#fff;background:linear-gradient(135deg,#0ea5e9,#2563eb);font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(14,165,233,.2)} #${PANEL_ID} .asp-draw-button:hover{filter:brightness(1.12);transform:translateY(-1px)} #${PANEL_ID} .asp-help{margin-top:8px;color:#9da9b0;font-size:11px;text-align:center}
            /* 컴팩트 UI 크기 */
            #${PANEL_ID}{right:22px;top:76px;width:300px;border-radius:7px;font-size:12px;line-height:1.3}
            #${PANEL_ID} .asp-head{height:34px;gap:8px;padding:0 9px}
            #${PANEL_ID} .asp-icon{width:22px;height:22px;font-size:14px}
            #${PANEL_ID} .asp-title{font-size:12px}
            #${PANEL_ID} .asp-close{width:23px;height:23px;font-size:17px}
            #${PANEL_ID} summary{height:29px;padding:6px 10px}
            #${PANEL_ID} .asp-section{padding:8px 12px 10px}
            #${PANEL_ID} .asp-radio{gap:8px;margin:5px 0}
            #${PANEL_ID} input[type=radio]{width:16px;height:16px}
            #${PANEL_ID} input[type=radio]:checked{box-shadow:inset 0 0 0 5px #d55b18}
            #${PANEL_ID} input[type=radio]:checked::after{width:4px;height:4px;margin:6px}
            #${PANEL_ID} .asp-rule{margin:8px 0}
            #${PANEL_ID} .asp-row{grid-template-columns:70px 1fr 58px;gap:7px;min-height:30px}
            #${PANEL_ID} .asp-row.two{grid-template-columns:70px 1fr}
            #${PANEL_ID} input[type=color]{width:52px;height:25px;padding:2px}
            #${PANEL_ID} input[type=number],#${PANEL_ID} select{height:25px;padding:2px 6px;font-size:11px}
            #${PANEL_ID} input[type=text]{width:100%;height:25px;padding:2px 7px;color:#f2f2f2;background:#303235;border:1px solid #111;border-radius:4px;font-size:11px;outline:none}
            #${PANEL_ID} textarea{width:100%;min-height:58px;padding:6px 7px;resize:vertical;color:#f2f2f2;background:#303235;border:1px solid #111;border-radius:4px;font:11px/1.45 monospace;outline:none;box-sizing:border-box}
            #${PANEL_ID} input[type=text]:focus{border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,.14)}
            #${PANEL_ID} .asp-footer{padding:9px 12px}
            #${PANEL_ID} .asp-draw-button{height:32px;font-size:11px}
            #${PANEL_ID} .asp-draw-button:disabled{cursor:default;opacity:.72;filter:none;transform:none;box-shadow:none}
            #${PANEL_ID} .asp-help{margin-top:6px;font-size:9px}
            @media(max-width:520px){#${PANEL_ID}{right:10px;top:10px;width:calc(100vw - 20px);max-height:calc(100vh - 20px);overflow:auto}}
        `;
        document.head.appendChild(style);
    }

    function radio(name, value, label) {
        return `<label class="asp-radio"><input type="radio" name="${name}" value="${value}"><span>${label}</span></label>`;
    }

    function create() {
        if (panel) return panel;
        injectStyle();
        panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.hidden = true;
        panel.innerHTML = `
            <header class="asp-head"><span class="asp-icon">▰</span><span class="asp-title">면 스타일 설정</span><button class="asp-close" aria-label="닫기">×</button></header>
            <div class="asp-section">
                <div class="asp-row two"><label for="asp-shape-name">도형 이름</label><input id="asp-shape-name" type="text" placeholder="도형 이름 입력"></div>
                <div class="asp-row two asp-line-type-row" hidden><label>선 종류</label><select id="asp-line-shape-type"><option value="straight">직선</option><option value="polyline">폴리라인</option></select></div>
                <div class="asp-row two asp-shape-type-row" hidden><label>도형 종류</label><select id="asp-rectangle-shape-type">
                    <option value="rectangle">사각형</option><option value="roundedRectangle">라운드 사각형</option>
                    <option value="parallelogram">평행사변형</option><option value="trapezoid">사다리꼴</option>
                    <option value="diamond">다이아몬드</option><option value="pentagon">오각형</option><option value="hexagon">육각형</option><option value="star">별</option>
                </select></div>
                <div class="asp-row two asp-circle-type-row" hidden><label>도형 종류</label><select id="asp-circle-shape-type">
                    <option value="circle">원</option><option value="ellipse">타원형</option>
                </select></div>
                <div class="asp-row two asp-point-type-row" hidden><label>점 종류</label><select id="asp-point-shape-type">
                    <option value="circle">원형</option><option value="square">사각형</option>
                    <option value="diamond">다이아몬드형</option><option value="star">별형</option>
                </select></div>
                <div class="asp-row two asp-arc-type-row" hidden><label>도형 종류</label><select id="asp-arc-shape-type">
                    <option value="sector">부채꼴</option><option value="arc">원호</option>
                </select></div>
                <div class="asp-row two asp-triangle-type-row" hidden><label>도형 종류</label><select id="asp-triangle-shape-type">
                    <option value="equilateralTriangle">정삼각형</option><option value="isoscelesTriangle">이등변 삼각형</option><option value="rightTriangle">직각삼각형</option>
                </select></div>
            </div>
            <details class="asp-point-geometry" open hidden><summary>위치 및 크기</summary><div class="asp-section">
                <div class="asp-row two"><label>중심 경도</label><input id="asp-point-longitude" type="number" min="-180" max="180" step="0.000001"></div>
                <div class="asp-row two"><label>중심 위도</label><input id="asp-point-latitude" type="number" min="-90" max="90" step="0.000001"></div>
                <div class="asp-row two"><label>너비(m)</label><input id="asp-point-width" type="number" min="1" max="100000" step="1"></div>
                <div class="asp-row two"><label>높이(m)</label><input id="asp-point-height" type="number" min="1" max="100000" step="1"></div>
            </div></details>
            <details class="asp-coordinate-options" open hidden><summary>좌표</summary><div class="asp-section">
                <label for="asp-coordinate-text">경도 위도, 경도 위도</label>
                <textarea id="asp-coordinate-text" spellcheck="false" placeholder="127.000000 37.500000, 127.100000 37.600000"></textarea>
            </div></details>
            <details class="asp-circle-geometry" open hidden><summary>중심 및 반지름</summary><div class="asp-section">
                <div class="asp-row two"><label>중심 경도</label><input id="asp-circle-longitude" type="number" min="-180" max="180" step="0.000001"></div>
                <div class="asp-row two"><label>중심 위도</label><input id="asp-circle-latitude" type="number" min="-90" max="90" step="0.000001"></div>
                <div class="asp-row two asp-circle-radius-row"><label>반지름(m)</label><input id="asp-circle-radius" type="number" min="1" max="10000000" step="1"></div>
                <div class="asp-row two asp-ellipse-radius-row" hidden><label>장축 반지름(m)</label><input id="asp-circle-major-radius" type="number" min="1" max="10000000" step="1"></div>
                <div class="asp-row two asp-ellipse-radius-row" hidden><label>단축 반지름(m)</label><input id="asp-circle-minor-radius" type="number" min="1" max="10000000" step="1"></div>
            </div></details>
            <details class="asp-arc-geometry" open hidden><summary>중심 및 원호</summary><div class="asp-section">
                <div class="asp-row two"><label>중심 경도</label><input id="asp-arc-longitude" type="number" min="-180" max="180" step="0.000001"></div>
                <div class="asp-row two"><label>중심 위도</label><input id="asp-arc-latitude" type="number" min="-90" max="90" step="0.000001"></div>
                <div class="asp-row two"><label>방향(°)</label><input id="asp-arc-direction" type="number" min="0" max="360" step="1"></div>
                <div class="asp-row two"><label>중심 내각(°)</label><input id="asp-arc-angle" type="number" min="1" max="360" step="1"></div>
                <div class="asp-row two"><label>반지름(m)</label><input id="asp-arc-radius" type="number" min="1" max="10000000" step="1"></div>
            </div></details>
            <details class="asp-triangle-geometry" open hidden><summary>중심 좌표</summary><div class="asp-section">
                <div class="asp-row two"><label>중심 경도</label><input id="asp-triangle-longitude" type="number" min="-180" max="180" step="0.000001"></div>
                <div class="asp-row two"><label>중심 위도</label><input id="asp-triangle-latitude" type="number" min="-90" max="90" step="0.000001"></div>
            </div></details>
            <details class="asp-rotation-geometry" open hidden><summary>회전</summary><div class="asp-section">
                <div class="asp-row two"><label>회전(°)</label><input id="asp-rotation" type="number" min="-360" max="360" step="0.1"></div>
            </div></details>
            <details class="asp-rectangle-geometry" open hidden><summary>중심 및 크기</summary><div class="asp-section">
                <div class="asp-row two"><label>중심 경도</label><input id="asp-rectangle-longitude" type="number" min="-180" max="180" step="0.000001"></div>
                <div class="asp-row two"><label>중심 위도</label><input id="asp-rectangle-latitude" type="number" min="-90" max="90" step="0.000001"></div>
                <div class="asp-row two"><label>너비(m)</label><input id="asp-rectangle-width" type="number" min="1" max="10000000" step="1"></div>
                <div class="asp-row two"><label>높이(m)</label><input id="asp-rectangle-height" type="number" min="1" max="10000000" step="1"></div>
                <div class="asp-row two asp-rectangle-radius-row" hidden><label>선분 반경(m)</label><input id="asp-rectangle-radius" type="number" min="0" max="5000000" step="1"></div>
            </div></details>
            <details class="asp-rounded-rectangle-geometry" open hidden><summary>중심 및 크기</summary><div class="asp-section">
                <div class="asp-row two"><label>중심 경도</label><input id="asp-rounded-longitude" type="number" min="-180" max="180" step="0.000001"></div>
                <div class="asp-row two"><label>중심 위도</label><input id="asp-rounded-latitude" type="number" min="-90" max="90" step="0.000001"></div>
                <div class="asp-row two"><label>너비(m)</label><input id="asp-rounded-width" type="number" min="1" max="10000000" step="1"></div>
                <div class="asp-row two"><label>높이(m)</label><input id="asp-rounded-height" type="number" min="1" max="10000000" step="1"></div>
                <div class="asp-row two"><label>선분 반경(m)</label><input id="asp-rounded-radius" type="number" min="0" max="5000000" step="1"></div>
            </div></details>
            <details class="asp-fill-options" open><summary>면</summary><div class="asp-section">
                ${radio('asp-fill','none','채우기 없음')}${radio('asp-fill','solid','단색 채우기')}${radio('asp-fill','gradient','그라데이션 채우기')}${radio('asp-fill','pattern','패턴 채우기')}
                <hr class="asp-rule"><div class="asp-row two"><label>색</label><input id="asp-fill-color" type="color"></div>
                <div class="asp-row"><label>투명도</label><input id="asp-fill-opacity" type="range" min="0" max="100"><span id="asp-fill-opacity-text" class="asp-percent"></span></div>
            </div></details>
            <details class="asp-line-options" open><summary>선</summary><div class="asp-section">
                ${radio('asp-line','none','선 없음')}${radio('asp-line','solid','실선')}${radio('asp-line','gradient','그라데이션 선')}
                <hr class="asp-rule"><div class="asp-row two"><label>색</label><input id="asp-line-color" type="color"></div>
                <div class="asp-row"><label>투명도</label><input id="asp-line-opacity" type="range" min="0" max="100"><span id="asp-line-opacity-text" class="asp-percent"></span></div>
                <div class="asp-row two"><label>너비</label><input id="asp-line-width" type="number" min="0.5" max="20" step="0.5"></div>
                <div class="asp-row two"><label>스케치 스타일</label><select id="asp-sketch"><option value="normal">일반</option><option value="rough">스케치</option><option value="double">이중선</option></select></div>
                <div class="asp-row two"><label>결선 종류</label><select id="asp-cap"><option value="round">라운드</option><option value="butt">평면</option><option value="square">사각</option></select></div>
                <div class="asp-row two"><label>대시 종류</label><select id="asp-dash"><option value="solid">실선</option><option value="dash">긴 대시</option><option value="dot">점선</option><option value="dashdot">대시-점</option></select></div>
                <div class="asp-row two asp-endpoint-row"><label>시작점 모양</label><select id="asp-start-style"><option value="none">없음</option><option value="arrow">화살표</option><option value="openArrow">열린 화살표</option><option value="stealth">스텔스 화살표</option><option value="triangle">삼각형</option><option value="circle">원형</option><option value="diamond">다이아몬드</option><option value="oval">타원형</option></select></div>
                <div class="asp-row two asp-endpoint-row"><label>끝점 모양</label><select id="asp-end-style"><option value="none">없음</option><option value="arrow">화살표</option><option value="openArrow">열린 화살표</option><option value="stealth">스텔스 화살표</option><option value="triangle">삼각형</option><option value="circle">원형</option><option value="diamond">다이아몬드</option><option value="oval">타원형</option></select></div>
            </div></details>
            <footer class="asp-footer"><button class="asp-draw-button" type="button">설정 적용 후 그리기 시작</button><div class="asp-help">버튼을 누른 뒤 지도에서 마우스를 드래그하세요.</div></footer>`;
        document.body.appendChild(panel);
        panel.querySelector('.asp-close').addEventListener('click', close);
        panel.querySelector('.asp-draw-button').addEventListener('click', () => {
            if (typeof pendingDraw !== 'function') return;
            pendingDraw();
            if (panelMode === 'point') {
                panel.querySelector('.asp-draw-button').textContent = '점 그리기 활성화됨 · 다시 시작';
                panel.querySelector('.asp-help').textContent = '지도에서 원하는 위치를 한 번 클릭하세요. 연속 배치도 가능합니다.';
            } else if (panelMode === 'line') {
                panel.querySelector('.asp-draw-button').textContent = '선 그리기 활성화됨 · 다시 시작';
                panel.querySelector('.asp-help').textContent = '지도에서 점을 클릭하고 완료 동작으로 선을 확정하세요.';
            } else {
                panel.querySelector('.asp-draw-button').textContent = '그리기 활성화됨 · 다시 시작';
                panel.querySelector('.asp-help').textContent = '지도에서 누른 채 드래그하고 원하는 크기에서 놓으세요.';
            }
        });
        bind();
        drag(panel, panel.querySelector('.asp-head'));
        sync();
        return panel;
    }

    function scheduleAutoApply() {
        if (panelMode !== 'edit' || typeof pendingDraw !== 'function') return;
        window.clearTimeout(autoApplyTimer);
        autoApplyTimer = window.setTimeout(() => {
            if (panelMode !== 'edit' || typeof pendingDraw !== 'function') return;
            pendingDraw();
            panel.querySelector('.asp-help').textContent = '변경사항이 선택한 도형에 자동 적용되었습니다.';
        }, 250);
    }

    function bind() {
        panel.querySelectorAll('input[name=asp-fill]').forEach(el => el.addEventListener('change', () => { state.fillType = el.value; scheduleAutoApply(); }));
        panel.querySelectorAll('input[name=asp-line]').forEach(el => el.addEventListener('change', () => { state.lineType = el.value; scheduleAutoApply(); }));
        const pairs = [['asp-shape-name','shapeName'],['asp-fill-color','fillColor'],['asp-fill-opacity','fillOpacity'],['asp-line-color','lineColor'],['asp-line-opacity','lineOpacity'],['asp-line-width','lineWidth'],['asp-sketch','sketchStyle'],['asp-cap','capType'],['asp-dash','dashType'],['asp-start-style','startStyle'],['asp-end-style','endStyle'],['asp-point-shape-type','pointShapeType'],['asp-point-longitude','pointLongitude'],['asp-point-latitude','pointLatitude'],['asp-point-width','pointWidth'],['asp-point-height','pointHeight'],['asp-circle-shape-type','circleShapeType'],['asp-circle-longitude','circleLongitude'],['asp-circle-latitude','circleLatitude'],['asp-circle-radius','circleRadius'],['asp-circle-major-radius','circleMajorRadius'],['asp-circle-minor-radius','circleMinorRadius'],['asp-arc-shape-type','arcShapeType'],['asp-arc-longitude','arcLongitude'],['asp-arc-latitude','arcLatitude'],['asp-arc-direction','arcDirection'],['asp-arc-angle','arcAngle'],['asp-arc-radius','arcRadius'],['asp-triangle-shape-type','triangleShapeType'],['asp-triangle-longitude','triangleLongitude'],['asp-triangle-latitude','triangleLatitude'],['asp-rectangle-shape-type','rectangleShapeType'],['asp-rectangle-longitude','rectangleLongitude'],['asp-rectangle-latitude','rectangleLatitude'],['asp-rectangle-width','rectangleWidth'],['asp-rectangle-height','rectangleHeight'],['asp-rectangle-radius','rectangleRadius'],['asp-rounded-longitude','roundedRectangleLongitude'],['asp-rounded-latitude','roundedRectangleLatitude'],['asp-rounded-width','roundedRectangleWidth'],['asp-rounded-height','roundedRectangleHeight'],['asp-rounded-radius','roundedRectangleRadius']];
        pairs.forEach(([id,key]) => panel.querySelector(`#${id}`).addEventListener('input', event => { state[key] = event.target.type === 'number' || event.target.type === 'range' ? Number(event.target.value) : event.target.value; syncLabels(); scheduleAutoApply(); }));
        const rotationInput = panel.querySelector('#asp-rotation');
        rotationInput.addEventListener('input', event => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) state.rotation = next;
        });
        rotationInput.addEventListener('change', event => {
            const next = Number(event.target.value);
            state.rotation = Number.isFinite(next) ? Math.max(-360, Math.min(360, next)) : 0;
            event.target.value = String(state.rotation);
            window.clearTimeout(autoApplyTimer);
            if (panelMode === 'edit' && typeof pendingDraw === 'function') {
                pendingDraw();
                panel.querySelector('.asp-help').textContent = `회전 ${state.rotation}°가 선택한 도형에 적용되었습니다.`;
            }
        });
        rotationInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') event.target.blur();
        });
        panel.querySelector('#asp-line-shape-type').addEventListener('change', event => { state.lineShapeType = event.target.value; });
        panel.querySelector('#asp-rectangle-shape-type').addEventListener('change', event => {
            state.rectangleShapeType = event.target.value;
            panel.querySelector('.asp-rectangle-radius-row').hidden = event.target.value !== 'roundedRectangle';
            scheduleAutoApply();
        });
        panel.querySelector('#asp-circle-shape-type').addEventListener('change', event => {
            state.circleShapeType = event.target.value;
            syncCircleGeometryRows();
            scheduleAutoApply();
        });
        panel.querySelector('#asp-coordinate-text').addEventListener('input', event => { state.coordinateText = event.target.value; scheduleAutoApply(); });
    }

    function sync() {
        panel.querySelector('#asp-shape-name').value = state.shapeName || '';
        panel.querySelector(`input[name=asp-fill][value=${state.fillType}]`).checked = true;
        panel.querySelector(`input[name=asp-line][value=${state.lineType}]`).checked = true;
        [['asp-fill-color','fillColor'],['asp-fill-opacity','fillOpacity'],['asp-line-color','lineColor'],['asp-line-opacity','lineOpacity'],['asp-line-width','lineWidth'],['asp-sketch','sketchStyle'],['asp-cap','capType'],['asp-dash','dashType']].forEach(([id,key]) => panel.querySelector(`#${id}`).value = state[key]);
        panel.querySelector('#asp-start-style').value = state.startStyle || 'none';
        panel.querySelector('#asp-end-style').value = state.endStyle || 'none';
        panel.querySelector('#asp-point-longitude').value = Number(state.pointLongitude || 0).toFixed(6);
        panel.querySelector('#asp-point-latitude').value = Number(state.pointLatitude || 0).toFixed(6);
        panel.querySelector('#asp-point-width').value = state.pointWidth || 30;
        panel.querySelector('#asp-point-height').value = state.pointHeight || 30;
        panel.querySelector('#asp-point-shape-type').value = state.pointShapeType || 'circle';
        panel.querySelector('#asp-circle-longitude').value = Number(state.circleLongitude || 0).toFixed(6);
        panel.querySelector('#asp-circle-latitude').value = Number(state.circleLatitude || 0).toFixed(6);
        panel.querySelector('#asp-circle-radius').value = state.circleRadius || 1;
        panel.querySelector('#asp-circle-shape-type').value = state.circleShapeType || 'circle';
        panel.querySelector('#asp-circle-major-radius').value = state.circleMajorRadius || state.circleRadius || 1;
        panel.querySelector('#asp-circle-minor-radius').value = state.circleMinorRadius || state.circleRadius || 1;
        syncCircleGeometryRows();
        panel.querySelector('#asp-arc-longitude').value = Number(state.arcLongitude || 0).toFixed(6);
        panel.querySelector('#asp-arc-shape-type').value = state.arcShapeType || 'sector';
        panel.querySelector('#asp-triangle-shape-type').value = state.triangleShapeType || 'equilateralTriangle';
        panel.querySelector('#asp-line-shape-type').value = state.lineShapeType || 'straight';
        panel.querySelector('.asp-line-type-row').hidden = panelMode !== 'line';
        panel.querySelector('#asp-triangle-longitude').value = Number(state.triangleLongitude || 0).toFixed(6);
        panel.querySelector('#asp-triangle-latitude').value = Number(state.triangleLatitude || 0).toFixed(6);
        panel.querySelector('.asp-triangle-geometry').hidden = !(panelMode === 'edit' && state.triangleGeometry);
        panel.querySelector('#asp-rotation').value = Math.max(-360, Math.min(360, Number(state.rotation) || 0));
        panel.querySelector('.asp-rotation-geometry').hidden = !(panelMode === 'edit' && state.rotationEnabled);
        panel.querySelector('#asp-arc-latitude').value = Number(state.arcLatitude || 0).toFixed(6);
        panel.querySelector('#asp-arc-direction').value = Number(state.arcDirection || 0);
        panel.querySelector('#asp-arc-angle').value = Number(state.arcAngle || 90);
        panel.querySelector('#asp-arc-radius').value = Number(state.arcRadius || 1);
        panel.querySelector('#asp-rectangle-longitude').value = Number(state.rectangleLongitude || 0).toFixed(6);
        panel.querySelector('#asp-rectangle-latitude').value = Number(state.rectangleLatitude || 0).toFixed(6);
        panel.querySelector('#asp-rectangle-width').value = state.rectangleWidth || 1;
        panel.querySelector('#asp-rectangle-height').value = state.rectangleHeight || 1;
        panel.querySelector('#asp-rectangle-shape-type').value = state.rectangleShapeType || 'rectangle';
        panel.querySelector('#asp-rectangle-radius').value = Math.max(0, Number(state.rectangleRadius) || 0);
        panel.querySelector('.asp-rectangle-radius-row').hidden = state.rectangleShapeType !== 'roundedRectangle';
        panel.querySelector('#asp-rounded-longitude').value = Number(state.roundedRectangleLongitude || 0).toFixed(6);
        panel.querySelector('#asp-rounded-latitude').value = Number(state.roundedRectangleLatitude || 0).toFixed(6);
        panel.querySelector('#asp-rounded-width').value = state.roundedRectangleWidth || 1;
        panel.querySelector('#asp-rounded-height').value = state.roundedRectangleHeight || 1;
        panel.querySelector('#asp-rounded-radius').value = Math.max(0, Number(state.roundedRectangleRadius) || 0);
        panel.querySelector('#asp-coordinate-text').value = state.coordinateText || '';
        syncLabels();
    }
    function syncCircleGeometryRows(){const ellipse=state.circleShapeType==='ellipse';panel.querySelector('.asp-circle-radius-row').hidden=ellipse;panel.querySelectorAll('.asp-ellipse-radius-row').forEach(row=>row.hidden=!ellipse)}
    function syncLabels(){ panel.querySelector('#asp-fill-opacity-text').textContent=`${state.fillOpacity}%`; panel.querySelector('#asp-line-opacity-text').textContent=`${state.lineOpacity}%`; }
    function drag(el,handle){let on=false,x=0,y=0;handle.addEventListener('mousedown',e=>{if(e.target.closest('button'))return;on=true;const r=el.getBoundingClientRect();x=e.clientX-r.left;y=e.clientY-r.top;e.preventDefault()});document.addEventListener('mousemove',e=>{if(!on)return;el.style.left=`${Math.max(0,Math.min(e.clientX-x,innerWidth-el.offsetWidth))}px`;el.style.top=`${Math.max(0,Math.min(e.clientY-y,innerHeight-el.offsetHeight))}px`;el.style.right='auto'});document.addEventListener('mouseup',()=>on=false)}
    function setLineOnly(lineOnly){
        panel.querySelector('.asp-fill-options').hidden=lineOnly;
        panel.querySelector('.asp-line-options').open=true;
        ['none','gradient'].forEach(value=>{
            const radio=panel.querySelector('input[name=asp-line][value='+value+']');
            if(radio) radio.closest('.asp-radio').hidden=lineOnly;
        });
        if(lineOnly){
            state.lineType='solid';
            const solid=panel.querySelector('input[name=asp-line][value=solid]');
            if(solid) solid.checked=true;
        }
    }
    function setMinimalDrawMode(minimal){
        panel.querySelector('.asp-fill-options').hidden=minimal;
        panel.querySelector('.asp-line-options').hidden=minimal;
    }
    function open(title='면 설정/편집', drawCallback=null){create();window.clearTimeout(autoApplyTimer);setLineOnly(false);setMinimalDrawMode(true);panel.querySelector('.asp-point-geometry').hidden=true;panel.querySelector('.asp-coordinate-options').hidden=true;panel.querySelector('.asp-circle-geometry').hidden=true;panel.querySelector('.asp-arc-geometry').hidden=true;panel.querySelector('.asp-rectangle-geometry').hidden=true;panel.querySelector('.asp-rounded-rectangle-geometry').hidden=true;panel.querySelector('.asp-shape-type-row').hidden=true;panel.querySelector('.asp-circle-type-row').hidden=true;panel.querySelector('.asp-point-type-row').hidden=true;panel.querySelector('.asp-arc-type-row').hidden=true;panel.querySelector('.asp-triangle-type-row').hidden=true;state.pointGeometry=false;state.circleGeometry=false;state.arcGeometry=false;state.triangleGeometry=false;state.coordinateGeometry=false;state.rectangleGeometry=false;state.roundedRectangleGeometry=false;state.coordinateText='';panelMode='draw';pendingDraw=drawCallback;state.shapeName=title.replace(/\s*설정\/편집$/,'');sync();panel.querySelector('.asp-title').textContent=title.replace(/설정\/편집$/,'이름 입력');panel.querySelector('.asp-draw-button').hidden=false;panel.querySelector('.asp-draw-button').disabled=false;panel.querySelector('.asp-draw-button').textContent='도형 그리기 시작';panel.querySelector('.asp-help').textContent='도형 이름을 입력한 뒤 버튼을 눌러 지도에서 그리세요.';panel.hidden=false}
    function showEndpointOptions(show){panel.querySelectorAll('.asp-endpoint-row').forEach(row=>row.hidden=!show)}
    function openLine(title='선 설정/편집', drawCallback=null){state.lineShapeType='straight';open(title,drawCallback);setLineOnly(true);panelMode='line';showEndpointOptions(true);sync();panel.querySelector('.asp-help').textContent='선 종류를 선택한 뒤 버튼을 누르고 지도에서 선을 그리세요.'}
    function openPoint(title='점 설정/편집', drawCallback=null){state.pointShapeType='circle';open(title,drawCallback);panelMode='point';panel.querySelector('.asp-point-type-row').hidden=false;sync();panel.querySelector('.asp-help').textContent='점 이름과 종류를 선택한 뒤 버튼을 누르고 지도에서 한 번 클릭하세요.'}
    function openShape(title='사각형 설정/편집', drawCallback=null){state.rectangleShapeType='rectangle';open(title,drawCallback);panel.querySelector('.asp-shape-type-row').hidden=false;sync();panel.querySelector('.asp-help').textContent='도형 이름과 종류를 선택한 뒤 버튼을 누르고 지도에서 드래그하세요.'}
    function openCircle(title='원 설정/편집', drawCallback=null){state.circleShapeType='circle';open(title,drawCallback);panel.querySelector('.asp-circle-type-row').hidden=false;sync();panel.querySelector('.asp-help').textContent='도형 이름과 원/타원형을 선택한 뒤 버튼을 누르고 지도에서 드래그하세요.'}
    function openArcShape(title='부채꼴 설정/편집', drawCallback=null){state.arcShapeType='sector';open(title,drawCallback);panel.querySelector('.asp-arc-type-row').hidden=false;sync();panel.querySelector('.asp-help').textContent='도형 이름과 부채꼴/원호를 선택한 뒤 버튼을 누르고 지도에서 두 점을 클릭하세요.'}
    function openTriangle(title='삼각형 설정/편집', drawCallback=null){state.triangleShapeType='equilateralTriangle';open(title,drawCallback);panel.querySelector('.asp-triangle-type-row').hidden=false;sync();panel.querySelector('.asp-help').textContent='도형 이름과 삼각형 종류를 선택한 뒤 버튼을 누르고 지도에서 드래그하세요.'}
    function edit(title, savedStyle, applyCallback){create();window.clearTimeout(autoApplyTimer);panelMode='edit';const isPoint=savedStyle?.pointGeometry===true;const isCircle=savedStyle?.circleGeometry===true;const isArc=savedStyle?.arcGeometry===true;const isTriangle=savedStyle?.triangleGeometry===true;const hasCoordinates=savedStyle?.coordinateGeometry===true;const isRectangle=savedStyle?.rectangleGeometry===true;const isRoundedRectangle=savedStyle?.roundedRectangleGeometry===true;Object.assign(state,savedStyle||{});state.pointGeometry=isPoint;state.circleGeometry=isCircle;state.arcGeometry=isArc;state.triangleGeometry=isTriangle;state.coordinateGeometry=hasCoordinates;state.rectangleGeometry=isRectangle;state.roundedRectangleGeometry=isRoundedRectangle;if(!hasCoordinates)state.coordinateText='';setMinimalDrawMode(false);setLineOnly(/라인|폴리라인|직선|원호/.test(title));showEndpointOptions(/직선/.test(title));panel.querySelector('.asp-point-geometry').hidden=!isPoint;panel.querySelector('.asp-circle-geometry').hidden=!isCircle;panel.querySelector('.asp-arc-geometry').hidden=!isArc;panel.querySelector('.asp-coordinate-options').hidden=!hasCoordinates;panel.querySelector('.asp-rectangle-geometry').hidden=!isRectangle;panel.querySelector('.asp-rounded-rectangle-geometry').hidden=!isRoundedRectangle;panel.querySelector('.asp-shape-type-row').hidden=!isRectangle;panel.querySelector('.asp-circle-type-row').hidden=!isCircle;panel.querySelector('.asp-point-type-row').hidden=!isPoint;panel.querySelector('.asp-arc-type-row').hidden=!isArc;panel.querySelector('.asp-triangle-type-row').hidden=!isTriangle;sync();pendingDraw=applyCallback;panel.querySelector('.asp-title').textContent=title;panel.querySelector('.asp-draw-button').hidden=true;panel.querySelector('.asp-help').textContent='옵션을 변경하면 선택한 도형에 자동으로 반영됩니다.';panel.hidden=false}
    function close(){window.clearTimeout(autoApplyTimer);if(panel)panel.hidden=true}
    function setRotation(value){state.rotation=Math.max(-360,Math.min(360,Number(value)||0));if(panel&&!panel.hidden){panel.querySelector('#asp-rotation').value=state.rotation.toFixed(1)}}
    function toggle(title='면 설정/편집'){create();panel.hidden?open(title):close()}
    global.AreaStylePanel={open,openLine,openPoint,openShape,openCircle,openArcShape,openTriangle,edit,close,toggle,setRotation,getStyle:()=>({...state})};
})(typeof window !== 'undefined' ? window : globalThis);
