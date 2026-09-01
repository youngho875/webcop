window.lineDrawing = (function () {
    'use strict';

    const viewer = window.CesiumViewer;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    let startPosition = null;
    let endPosition = null;
    let activeLines = [];
    let startPointMarker = null;
    let endPointMarker = null;
    let startShapeMarker = null;
    let endShapeMarker = null;
    let drawnLines = [];
    let lineSequence = 0;
    let isDrawing = false;
    let isEditing = false;
    let editingLine = null;
    let activeControlMarker = null;
    let configPanel = null;

    // PowerPoint의 선 서식 명칭과 최대한 동일한 값으로 보관한다.
    const currentConfig = {
        name: '신규 직선',
        color: '#ff0000',
        width: 4,
        transparency: 0,          // 0(불투명) ~ 100(투명)
        compoundType: 'single',   // single | double | thickThin | thinThick | triple
        dashType: 'solid',        // solid | roundDot | squareDot | dash | dashDot | longDash | longDashDot | longDashDotDot
        startStyle: 'none',
        endStyle: 'none'
    };

    const DASH_STYLES = {
        solid:          null,
        roundDot:       { dashLength: 8,  dashPattern: 0x8888 },
        squareDot:      { dashLength: 6,  dashPattern: 0xAAAA },
        dash:           { dashLength: 16, dashPattern: 0xF0F0 },
        dashDot:        { dashLength: 24, dashPattern: 0xF222 },
        longDash:       { dashLength: 24, dashPattern: 0xFF00 },
        longDashDot:    { dashLength: 32, dashPattern: 0xFF22 },
        longDashDotDot: { dashLength: 40, dashPattern: 0xFF2A }
    };

    // offset/width는 전체 선 두께에 대한 비율이다. 각 lane은 독립 polyline이다.
    const COMPOUND_STYLES = {
        single:    [{ offset: 0, width: 1 }],
        double:    [{ offset: -0.32, width: 0.30 }, { offset: 0.32, width: 0.30 }],
        thickThin: [{ offset: -0.20, width: 0.55 }, { offset: 0.35, width: 0.22 }],
        thinThick: [{ offset: -0.35, width: 0.22 }, { offset: 0.20, width: 0.55 }],
        triple:    [{ offset: -0.36, width: 0.20 }, { offset: 0, width: 0.20 }, { offset: 0.36, width: 0.20 }]
    };

    const END_STYLES = [
        ['none', '없음'], ['arrow', '화살표'], ['openArrow', '열린 화살표'],
        ['stealth', '스텔스 화살표'], ['triangle', '삼각형'], ['circle', '원형'],
        ['diamond', '다이아몬드'], ['oval', '타원형']
    ];

    function optionList(items, selected) {
        return items.map(([value, label]) =>
            `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`
        ).join('');
    }

    function createConfigPanel() {
        if (document.getElementById('line-config-panel')) return;
        const style = document.createElement('style');
        style.textContent = `
            #line-config-panel{position:absolute;bottom:15px;left:15px;background:rgba(25,25,26,.95);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:14px;width:265px;color:#e2e8f0;font-family:'Segoe UI',sans-serif;font-size:12px;z-index:1005;box-shadow:0 8px 32px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:9px;user-select:none}
            #line-config-header{position:relative;margin:-14px -14px 5px;padding:10px 14px;font-size:13px;font-weight:bold;color:#38bdf8;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.1);border-radius:8px 8px 0 0;cursor:move;text-align:center}
            #line-config-close{position:absolute;right:12px;top:8px;cursor:pointer;font-size:16px;color:#94a3b8;line-height:1}#line-config-close:hover{color:#ef4444}
            .config-row{display:flex;justify-content:space-between;align-items:center;gap:8px}.config-row label{flex:0 0 82px}.config-row input,.config-row select{min-width:0;flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:4px;padding:4px 6px;font-size:12px;box-sizing:border-box}.config-row input[type=color]{padding:0;height:24px;cursor:pointer}
            .cfg-range-wrap{display:flex;flex:1;align-items:center;gap:6px}.cfg-range-wrap input{padding:0}.cfg-range-value{width:34px;text-align:right;font-variant-numeric:tabular-nums}
            #cfg-apply-btn{background:#007acc;border:0;color:white;padding:8px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;margin-top:4px}#cfg-apply-btn:hover{background:#0098ff}
        `;
        document.head.appendChild(style);

        configPanel = document.createElement('div');
        configPanel.id = 'line-config-panel';
        configPanel.innerHTML = `
            <div id="line-config-header">🧭 직선 스타일 설정<span id="line-config-close" title="닫기">&times;</span></div>
            <div class="config-row"><label>선 이름</label><input id="cfg-name" type="text" value="${currentConfig.name}"></div>
            <div class="config-row"><label>선 색상</label><input id="cfg-color" type="color" value="${currentConfig.color}"></div>
            <div class="config-row"><label>선 두께</label><input id="cfg-width" type="number" min="1" max="40" step="1" value="${currentConfig.width}"></div>
            <div class="config-row"><label>투명도</label><div class="cfg-range-wrap"><input id="cfg-transparency" type="range" min="0" max="100" step="1" value="${currentConfig.transparency}"><span id="cfg-transparency-value" class="cfg-range-value">${currentConfig.transparency}%</span></div></div>
            <div class="config-row"><label>겹선 종류</label><select id="cfg-compound">${optionList([['single','단일선'],['double','이중선'],['thickThin','굵게-가늘게'],['thinThick','가늘게-굵게'],['triple','삼중선']], currentConfig.compoundType)}</select></div>
            <div class="config-row"><label>대시 종류</label><select id="cfg-dash">${optionList([['solid','실선'],['roundDot','둥근 점선'],['squareDot','사각 점선'],['dash','대시'],['dashDot','대시-점'],['longDash','긴 대시'],['longDashDot','긴 대시-점'],['longDashDotDot','긴 대시-점-점']], currentConfig.dashType)}</select></div>
            <div class="config-row"><label>시작점 종류</label><select id="cfg-start">${optionList(END_STYLES, currentConfig.startStyle)}</select></div>
            <div class="config-row"><label>끝점 종류</label><select id="cfg-end">${optionList(END_STYLES, currentConfig.endStyle)}</select></div>
            <button id="cfg-apply-btn">적용하기</button>`;
        document.body.appendChild(configPanel);

        ['mousedown', 'click', 'dblclick'].forEach(type => configPanel.addEventListener(type, e => e.stopPropagation()));
        configPanel.querySelectorAll('input,select').forEach(el => {
            el.addEventListener('change', applyConfigFromUI);
            el.addEventListener('input', applyConfigFromUI);
        });
        document.getElementById('cfg-apply-btn').addEventListener('click', function () {
            applyConfigFromUI();
            this.style.background = '#22c55e'; this.textContent = '적용 완료 ✔';
            setTimeout(() => { this.style.background = '#007acc'; this.textContent = '적용하기'; }, 900);
        });
        document.getElementById('line-config-close').addEventListener('click', close);
        makeElementDraggable(configPanel, document.getElementById('line-config-header'));
    }

    function makeElementDraggable(element, handle) {
        let moving = false, offsetX = 0, offsetY = 0;
        handle.addEventListener('mousedown', e => {
            if (e.target.id === 'line-config-close') return;
            moving = true; viewer.scene.screenSpaceCameraController.enableInputs = false;
            const rect = element.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        });
        document.addEventListener('mousemove', e => {
            if (!moving) return;
            const x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - element.offsetWidth));
            const y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - element.offsetHeight));
            Object.assign(element.style, { left: `${x}px`, top: `${y}px`, bottom: 'auto' });
        });
        document.addEventListener('mouseup', () => {
            if (moving) { moving = false; viewer.scene.screenSpaceCameraController.enableInputs = true; }
        });
    }

    function readNumber(id, min, max, fallback) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const value = Number(el.value);
        return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    }

    function applyConfigFromUI() {
        const byId = id => document.getElementById(id);
        if (byId('cfg-name')) currentConfig.name = byId('cfg-name').value.trim() || '신규 직선';
        if (byId('cfg-color')) currentConfig.color = byId('cfg-color').value;
        currentConfig.width = readNumber('cfg-width', 1, 40, 4);
        currentConfig.transparency = readNumber('cfg-transparency', 0, 100, 0);
        if (byId('cfg-transparency-value')) byId('cfg-transparency-value').textContent = `${currentConfig.transparency}%`;
        if (byId('cfg-compound')) currentConfig.compoundType = byId('cfg-compound').value;
        if (byId('cfg-dash')) currentConfig.dashType = byId('cfg-dash').value;
        if (byId('cfg-start')) currentConfig.startStyle = byId('cfg-start').value;
        if (byId('cfg-end')) currentConfig.endStyle = byId('cfg-end').value;
        if (isDrawing || isEditing) rebuildActiveStyle();
    }

    function normalizeConfig(config) {
        // 과거 저장 데이터(type: solid/dashed)도 그대로 편집할 수 있게 마이그레이션한다.
        return {
            ...currentConfig, ...config,
            compoundType: config.compoundType || 'single',
            dashType: config.dashType || (config.type === 'dashed' ? 'dash' : 'solid'),
            transparency: Number.isFinite(Number(config.transparency)) ? Number(config.transparency) : 0
        };
    }

    function formatCoordinateList(positions) {
        return positions.map(position => {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            return `${Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)} ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)}`;
        }).join(', ');
    }

    function parseCoordinateList(text, requiredCount) {
        const entries = String(text || '').split(',').map(item => item.trim()).filter(Boolean);
        if (entries.length !== requiredCount) return null;
        const coordinates = entries.map(entry => entry.split(/\s+/).map(Number));
        if (coordinates.some(pair => pair.length !== 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[0]) > 180 || Math.abs(pair[1]) > 90)) return null;
        return coordinates.map(([longitude, latitude]) => Cesium.Cartesian3.fromDegrees(longitude, latitude));
    }

    function setUIToConfig(config) {
        const c = normalizeConfig(config);
        const values = { 'cfg-name': c.name, 'cfg-color': c.color, 'cfg-width': c.width, 'cfg-transparency': c.transparency, 'cfg-compound': c.compoundType, 'cfg-dash': c.dashType, 'cfg-start': c.startStyle, 'cfg-end': c.endStyle };
        Object.entries(values).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
        const text = document.getElementById('cfg-transparency-value'); if (text) text.textContent = `${c.transparency}%`;
        Object.assign(currentConfig, c);
    }

    function getColor(config) {
        return Cesium.Color.fromCssColorString(config.color).withAlpha(1 - config.transparency / 100);
    }

    function getLineMaterial(config) {
        const color = getColor(config);
        const dash = DASH_STYLES[config.dashType] || null;
        if (!dash) return new Cesium.ColorMaterialProperty(color);
        return new Cesium.PolylineDashMaterialProperty({ color, gapColor: Cesium.Color.TRANSPARENT, dashLength: dash.dashLength, dashPattern: dash.dashPattern });
    }

    // 두 끝점 사이를 지형 표면을 따라 보간한다. Cesium의 GroundPolyline 경로를
    // 사용하므로 산이나 계곡을 통과할 때도 선이 지표 아래로 파묻히지 않는다.
    function getLineSegmentOptions() {
        return {
            clampToGround: true,
            arcType: Cesium.ArcType.GEODESIC,
            classificationType: Cesium.ClassificationType.TERRAIN
        };
    }

    // 픽셀 두께가 줌에 따라 유지되도록 화면 1픽셀에 해당하는 실제 거리로 평행 이동한다.
    function offsetSegment(start, end, pixelOffset) {
        if (!start || !end || !pixelOffset) return [start, end];
        const midpoint = Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3());
        const direction = Cesium.Cartesian3.subtract(end, start, new Cesium.Cartesian3());
        const normal = Cesium.Cartesian3.normalize(midpoint, new Cesium.Cartesian3());
        let lateral = Cesium.Cartesian3.cross(normal, direction, new Cesium.Cartesian3());
        if (Cesium.Cartesian3.magnitudeSquared(lateral) < Cesium.Math.EPSILON12) return [start, end];
        Cesium.Cartesian3.normalize(lateral, lateral);
        const sphere = new Cesium.BoundingSphere(midpoint, 1);
        const metersPerPixel = viewer.camera.getPixelSize(sphere, viewer.scene.drawingBufferWidth, viewer.scene.drawingBufferHeight);
        Cesium.Cartesian3.multiplyByScalar(lateral, pixelOffset * metersPerPixel, lateral);
        return [Cesium.Cartesian3.add(start, lateral, new Cesium.Cartesian3()), Cesium.Cartesian3.add(end, lateral, new Cesium.Cartesian3())];
    }

    function addLineLanes(start, end, config, dynamic) {
        const lanes = COMPOUND_STYLES[config.compoundType] || COMPOUND_STYLES.single;
        return lanes.map(lane => viewer.entities.add({
            polyline: {
                positions: dynamic ? new Cesium.CallbackProperty(() => offsetSegment(startPosition, endPosition, lane.offset * config.width), false) : offsetSegment(start, end, lane.offset * config.width),
                width: Math.max(1, config.width * lane.width),
                material: getLineMaterial(config), depthFailMaterial: getLineMaterial(config),
                ...getLineSegmentOptions()
            }
        }));
    }

    function createControlPoint(position) {
        return viewer.entities.add({
            position,
            point: {
                pixelSize: 12,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    }

    function endpointSvg(type, color, alpha) {
        const fill = type === 'openArrow' ? 'none' : color;
        const common = `stroke="${color}" stroke-width="3" stroke-linejoin="round" fill="${fill}" fill-opacity="${alpha}" stroke-opacity="${alpha}"`;
        const shapes = {
            arrow: '<path d="M3 16 L29 4 L22 16 L29 28 Z"/>',
            openArrow: '<path d="M29 4 L3 16 L29 28"/>',
            stealth: '<path d="M3 16 L29 5 L21 16 L29 27 L16 22 Z"/>',
            triangle: '<path d="M3 16 L29 4 L29 28 Z"/>',
            circle: '<circle cx="16" cy="16" r="11"/>',
            diamond: '<path d="M3 16 L16 5 L29 16 L16 27 Z"/>',
            oval: '<ellipse cx="16" cy="16" rx="13" ry="8"/>'
        };
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g ${common}>${shapes[type] || ''}</g></svg>`)}`;
    }

    function screenRotation(position, relativePosition) {
        if (!position || !relativePosition) return 0;
        const a = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
        const b = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, relativePosition);
        return a && b ? -Math.atan2(b.y - a.y, b.x - a.x) : 0;
    }

    function addEndpoint(type, position, relativePosition, config, dynamic, isStart) {
        if (type === 'none' || !position) return null;
        const alpha = 1 - config.transparency / 100;
        const size = Math.max(18, Math.min(48, config.width * 3.5));
        const getPosition = () => dynamic ? (isStart ? startPosition : endPosition) : position;
        const getRelativePosition = () => dynamic ? (isStart ? endPosition : startPosition) : relativePosition;
        return viewer.entities.add({
            position: dynamic ? new Cesium.CallbackProperty(getPosition, false) : position,
            billboard: {
                image: endpointSvg(type, config.color, alpha), width: size, height: size,
                rotation: new Cesium.CallbackProperty(() => screenRotation(getPosition(), getRelativePosition()), false),
                alignedAxis: Cesium.Cartesian3.ZERO,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    }

    function removeEntities(entities) { entities.forEach(entity => viewer.entities.remove(entity)); }

    function rebuildActiveStyle() {
        removeEntities(activeLines); activeLines = [];
        if (startShapeMarker) viewer.entities.remove(startShapeMarker);
        if (endShapeMarker) viewer.entities.remove(endShapeMarker);
        startShapeMarker = endShapeMarker = null;
        if (!startPosition || !endPosition) return;
        activeLines = addLineLanes(startPosition, endPosition, { ...currentConfig }, true);
        startShapeMarker = addEndpoint(currentConfig.startStyle, startPosition, endPosition, currentConfig, true, true);
        endShapeMarker = addEndpoint(currentConfig.endStyle, endPosition, startPosition, currentConfig, true, false);
    }

    function drawStaticLine(start, end, rawConfig) {
        const config = normalizeConfig(rawConfig);
        const lanes = addLineLanes(start, end, config, false);
        const lineEntity = lanes[0];
        lineEntity.name = config.name || `라인${++lineSequence}`;
        const startShape = addEndpoint(config.startStyle, start, end, config);
        const endShape = addEndpoint(config.endStyle, end, start, config);
        const subEntities = lanes.slice(1).concat([startShape, endShape].filter(Boolean));
        lineEntity.customData = { start, end, config: { ...config }, subEntities, drawingType: 'line', displayName: lineEntity.name };
        const style = {
            shapeName: lineEntity.name,
            lineType: 'solid',
            lineColor: config.color,
            lineOpacity: 100 - config.transparency,
            lineWidth: config.width,
            sketchStyle: config.compoundType === 'double' ? 'double' : 'normal',
            capType: 'round',
            dashType: config.dashType === 'solid' ? 'solid' : (config.dashType.includes('Dot') ? 'dashdot' : 'dash'),
            startStyle: config.startStyle,
            endStyle: config.endStyle,
            coordinateGeometry: true,
            coordinateText: formatCoordinateList([start, end])
        };
        window.ShapeDrawingCore?.attachEditor?.(viewer, lineEntity, '직선 설정/편집', style, nextStyle => {
            const editedPositions = parseCoordinateList(nextStyle.coordinateText, 2);
            if (!editedPositions) {
                window.alert('좌표를 "경도 위도, 경도 위도" 형식으로 입력하세요.');
                return;
            }
            start = editedPositions[0];
            end = editedPositions[1];
            lineEntity.name = String(nextStyle.shapeName || lineEntity.name).trim();
            lineEntity.customData.displayName = lineEntity.name;
            config.name = lineEntity.name;
            config.color = nextStyle.lineColor;
            config.width = nextStyle.lineWidth;
            config.transparency = 100 - nextStyle.lineOpacity;
            config.dashType = nextStyle.dashType === 'solid' ? 'solid' : (nextStyle.dashType === 'dot' ? 'roundDot' : (nextStyle.dashType === 'dashdot' ? 'dashDot' : 'dash'));
            config.startStyle = nextStyle.startStyle || 'none';
            config.endStyle = nextStyle.endStyle || 'none';
            lineEntity.customData.config = { ...config };
            lineEntity.customData.start = start;
            lineEntity.customData.end = end;
            const laneDefinitions = COMPOUND_STYLES[config.compoundType] || COMPOUND_STYLES.single;
            lanes.forEach((lane, index) => {
                lane.show = nextStyle.lineType !== 'none';
                lane.polyline.positions = offsetSegment(start, end, (laneDefinitions[index]?.offset || 0) * config.width);
                lane.polyline.width = Math.max(1, config.width);
                lane.polyline.material = getLineMaterial(config);
                lane.polyline.depthFailMaterial = getLineMaterial(config);
            });
            (lineEntity.customData.subEntities || []).filter(entity => entity.billboard).forEach(entity => viewer.entities.remove(entity));
            const nextEndpoints = [
                addEndpoint(config.startStyle, start, end, config),
                addEndpoint(config.endStyle, end, start, config)
            ].filter(Boolean);
            nextEndpoints.forEach(entity => { entity._lineOwner = lineEntity; });
            lineEntity.customData.subEntities = lanes.slice(1).concat(nextEndpoints);
            document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity: lineEntity } }));
        });
        lanes.forEach(entity => { entity._lineOwner = lineEntity; });
        subEntities.forEach(entity => { entity._lineOwner = lineEntity; });
        drawnLines.push(lineEntity);
        document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity: lineEntity } }));
        return lineEntity;
    }

    function resolvePickedLine(pickedObject) {
        if (!Cesium.defined(pickedObject) || !pickedObject.id) return null;
        const candidate = pickedObject.id._lineOwner || pickedObject.id;
        return drawnLines.includes(candidate) ? candidate : null;
    }

    function activate() {
        close(); createConfigPanel();
        if (viewer.selectionIndicator) viewer.selectionIndicator.viewModel.showSelection = false;
        bindEvents();
    }

    function activateWithStyle(style) {
        close();
        Object.assign(currentConfig, {
            name: String(style?.shapeName || '신규 직선').trim(),
            color: style?.lineColor || '#ff0000',
            width: Number(style?.lineWidth) || 4,
            transparency: style?.lineType === 'none' ? 100 : 100 - Number(style?.lineOpacity ?? 100),
            compoundType: style?.sketchStyle === 'double' ? 'double' : 'single',
            dashType: style?.dashType === 'solid' ? 'solid' : (style?.dashType === 'dot' ? 'roundDot' : (style?.dashType === 'dashdot' ? 'dashDot' : 'dash')),
            startStyle: style?.startStyle || 'none',
            endStyle: style?.endStyle || 'none'
        });
        bindEvents();
    }

    function finalizeLineDrawing() {
        if (!startPosition || !endPosition) return;
        const previousLine = editingLine;
        applyConfigFromUI();
        drawStaticLine(startPosition, endPosition, currentConfig);
        if (previousLine) {
            (previousLine.customData?.subEntities || []).forEach(entity => viewer.entities.remove(entity));
            viewer.entities.remove(previousLine);
        }
        editingLine = null;
    }

    function restoreEditingLine() {
        if (!editingLine) return;
        if (!viewer.entities.contains(editingLine)) viewer.entities.add(editingLine);
        (editingLine.customData && editingLine.customData.subEntities || []).forEach(entity => { if (!viewer.entities.contains(entity)) viewer.entities.add(entity); });
        if (!drawnLines.includes(editingLine)) drawnLines.push(editingLine);
    }

    function getEarthPosition(position) {
        const ray = viewer.camera.getPickRay(position);
        if (!Cesium.defined(ray)) return null;
        const globePosition = viewer.scene.globe.pick(ray, viewer.scene);
        return Cesium.defined(globePosition) ? globePosition : viewer.scene.pickPosition(position);
    }

    function bindEvents() {
        deactivate();
        handler.setInputAction(event => {
            if (!isEditing) return;
            const pickedObject = viewer.scene.pick(event.position);
            if (Cesium.defined(pickedObject) && pickedObject.id === startPointMarker) activeControlMarker = 'start';
            else if (Cesium.defined(pickedObject) && pickedObject.id === endPointMarker) activeControlMarker = 'end';
            else return;
            viewer.canvas.style.cursor = 'grabbing';
            viewer.scene.screenSpaceCameraController.enableInputs = false;
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        handler.setInputAction(event => {
            const pickedObject = viewer.scene.pick(event.position);
            if (isDrawing) {
                const earthPosition = getEarthPosition(event.position);
                if (Cesium.defined(earthPosition)) { endPosition = earthPosition; finalizeLineDrawing(); close(); }
                return;
            }
            if (isEditing) {
                if (Cesium.defined(pickedObject) && (pickedObject.id === startPointMarker || pickedObject.id === endPointMarker)) return;
                finalizeLineDrawing(); close(); return;
            }
            const pickedLine = resolvePickedLine(pickedObject);
            if (pickedLine) {
                editingLine = pickedLine; isEditing = true; drawnLines = drawnLines.filter(line => line !== editingLine);
                setUIToConfig(editingLine.customData.config); startPosition = editingLine.customData.start; endPosition = editingLine.customData.end;
                (editingLine.customData.subEntities || []).forEach(entity => viewer.entities.remove(entity)); viewer.entities.remove(editingLine);
                startPointMarker = createControlPoint(startPosition); endPointMarker = createControlPoint(endPosition); rebuildActiveStyle(); return;
            }
            const earthPosition = getEarthPosition(event.position);
            if (!Cesium.defined(earthPosition)) return;
            clearUIElements(); applyConfigFromUI(); startPosition = earthPosition; endPosition = earthPosition; isDrawing = true; rebuildActiveStyle();
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(event => {
            if (!isDrawing && !isEditing) return;
            if (isEditing && !activeControlMarker) {
                const hovered = viewer.scene.pick(event.endPosition);
                viewer.canvas.style.cursor = Cesium.defined(hovered) && (hovered.id === startPointMarker || hovered.id === endPointMarker) ? 'grab' : 'default';
                return;
            }
            const movePosition = getEarthPosition(event.endPosition); if (!Cesium.defined(movePosition)) return;
            if (isDrawing) { endPosition = movePosition; return; }
            if (activeControlMarker === 'start') { startPosition = movePosition; if (startPointMarker) startPointMarker.position.setValue(startPosition); }
            if (activeControlMarker === 'end') { endPosition = movePosition; if (endPointMarker) endPointMarker.position.setValue(endPosition); }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.setInputAction(() => {
            if (!activeControlMarker) return;
            activeControlMarker = null;
            viewer.canvas.style.cursor = 'default';
            viewer.scene.screenSpaceCameraController.enableInputs = true;
            window.__suppressDrawingSelectionUntil = performance.now() + 300;
            finalizeLineDrawing();
            close();
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    function editEntity(lineEntity) {
        if (!lineEntity?.customData || lineEntity.customData.drawingType !== 'line' || !viewer.entities.contains(lineEntity)) return;
        close();
        bindEvents();
        editingLine = lineEntity;
        isEditing = true;
        drawnLines = drawnLines.filter(line => line !== editingLine);
        setUIToConfig(editingLine.customData.config);
        startPosition = editingLine.customData.start;
        endPosition = editingLine.customData.end;
        startPointMarker = createControlPoint(startPosition);
        endPointMarker = createControlPoint(endPosition);
        rebuildActiveStyle();
        viewer.canvas.style.cursor = 'default';
        viewer.selectedEntity = lineEntity;
        viewer.scene.requestRender();
    }

    function clearUIElements() {
        [startPointMarker, endPointMarker, startShapeMarker, endShapeMarker].forEach(entity => { if (entity) viewer.entities.remove(entity); });
        removeEntities(activeLines); activeLines = [];
        startPointMarker = endPointMarker = startShapeMarker = endShapeMarker = null;
    }

    function deactivate() {
        [Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.ScreenSpaceEventType.LEFT_UP].forEach(type => handler.removeInputAction(type));
        viewer.canvas.style.cursor = 'default';
    }

    function close() {
        deactivate(); clearUIElements(); restoreEditingLine(); viewer.scene.screenSpaceCameraController.enableInputs = true;
        startPosition = endPosition = null; isDrawing = isEditing = false; editingLine = activeControlMarker = null;
        if (configPanel) { configPanel.remove(); configPanel = null; }
        viewer.selectedEntity = viewer.trackedEntity = undefined;
        if (viewer.selectionIndicator) viewer.selectionIndicator.viewModel.showSelection = true;
    }

    function reset() {
        deactivate(); clearUIElements(); restoreEditingLine(); viewer.scene.screenSpaceCameraController.enableInputs = true;
        drawnLines.forEach(line => { (line.customData && line.customData.subEntities || []).forEach(entity => viewer.entities.remove(entity)); viewer.entities.remove(line); });
        drawnLines = []; startPosition = endPosition = null; isDrawing = isEditing = false; editingLine = activeControlMarker = null;
        if (configPanel) { configPanel.remove(); configPanel = null; }
        viewer.selectedEntity = viewer.trackedEntity = undefined;
        if (viewer.selectionIndicator) viewer.selectionIndicator.viewModel.showSelection = true;
        bindEvents();
    }

    return { activate, activateWithStyle, editEntity, reset, close };
}());
