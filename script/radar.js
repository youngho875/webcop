window.radar = (function() {
    const viewer = window.CesiumViewer;
    let radarPrimitives = {}; // ID별 레이더 프리미티브 저장
    let radarConfigurations = {}; // ID별 레이더 설정 저장
    let nextId = 1; // 고유 ID 생성을 위한 카운터
    let areRadarsVisible = true;
    let isInitialized = false;

    // 🎯 레이더 리스트박스 실시간 갱신 함수 (체크박스 개별 가시성 연동)
    function updateRadarListbox() {
        const listbox = document.getElementById('radarRouteList');
        if (!listbox) return;

        listbox.innerHTML = '';

        const allIds = Object.keys(radarPrimitives).map(Number);
        allIds.sort((a, b) => a - b).forEach(id => {
            const option = document.createElement('div');
            option.style.cssText = `
                padding: 6px 10px;
                margin-bottom: 4px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                font-size: 11px;
                color: #ddd;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background 0.2s;
            `;

            // 개별 체크박스 생성
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.cssText = `
                margin: 0;
                cursor: pointer;
                accent-color: #ff9800;
            `;

            const primitive = radarPrimitives[id];
            checkbox.checked = primitive ? primitive.show : true;

            // 체크박스 핸들러: 개별 프리미티브 토글
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const visible = checkbox.checked;
                if (radarPrimitives[id]) {
                    radarPrimitives[id].show = visible;
                }
                showNotification(`레이더 #${id} 표출 ${visible ? '켜짐' : '꺼짐'}`, "success");
            });

            // 리스트 아이템 클릭 시 삭제/수정 폼에 ID 바인딩
            option.addEventListener('click', () => {
                document.getElementById('radarId').value = id;
                Array.from(listbox.children).forEach(child => child.style.background = 'rgba(255, 255, 255, 0.05)');
                option.style.background = 'rgba(255, 152, 0, 0.3)';
            });

            const textContainer = document.createElement('div');
            textContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                flex: 1;
                align-items: center;
            `;
            textContainer.innerHTML = `
                <span>📡 레이더 ID: <strong>${id}</strong></span>
                <span style="font-size: 10px; color: #aaa;">R: ${radarConfigurations[id]?.length || 0}m</span>
            `;

            option.appendChild(checkbox);
            option.appendChild(textContainer);
            listbox.appendChild(option);
        });

        if (allIds.length === 0) {
            listbox.innerHTML = `<div style="text-align:center; color:#777; font-size:11px; padding-top:20px;">등록된 레이더 빔이 없습니다.</div>`;
        }
    }

    // UI 생성 함수 (curve.js와 동일한 다크 UI 포맷)
    function createInfoBox() {
        const existBox = document.getElementById('radarInfoBox');
        if (existBox) {
            existBox.style.display = 'block';
            updateRadarListbox();
            return;
        }

        const radarInfoBox = document.createElement('div');
        radarInfoBox.id = 'radarInfoBox';
        radarInfoBox.style.cssText = `
            position: absolute; 
            top: 150px; 
            left: 10px; 
            background-color: rgba(30, 30, 30, 0.85);
            backdrop-filter: blur(4px);
            padding: 16px; 
            border-radius: 8px; 
            z-index: 1005; 
            box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            width: 310px;
            box-sizing: border-box;
        `;

        radarInfoBox.innerHTML = `
            <div>
                <div id="radarHeader" style="margin: 0 0 14px 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #fff; letter-spacing: 0.5px;">📡 레이더 설정</span>
                    <span id="radarCloseBtn" style="cursor: pointer; color: #aaa; font-size: 20px; font-weight: bold; line-height: 1;">&times;</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Radar ID (조회)</label>
                        <input type="number" id="radarId" step="1" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Longitude:</label>
                        <input type="number" id="longitude" step="0.0001" value="126.9211" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Latitude:</label>
                        <input type="number" id="latitude" step="0.0001" value="37.5252" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Height:</label>
                        <input type="number" id="height" step="1" value="0" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Base Radius:</label>
                        <input type="number" id="baseRadius" step="1" value="100" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Top Radius:</label>
                        <input type="number" id="topRadius" step="1" value="10000" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Length:</label>
                        <input type="number" id="length" step="1" value="80000" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Color:</label>
                        <input type="text" id="color" value="rgba(255, 255, 0, 0.5)" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Heading:</label>
                        <input type="number" id="heading" step="1" value="-90" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Pitch:</label>
                        <input type="number" id="pitch" step="1" value="-60" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Roll:</label>
                        <input type="number" id="roll" step="1" value="0" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Alpha:</label>
                        <input type="number" id="alpha" step="0.1" value="0.2" min="0" max="1" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; color: #ff9800; font-weight: bold; display: block; margin-bottom: 4px;">📊 등록된 레이더 빔 리스트</label>
                    <div id="radarRouteList" style="width: 100%; height: 90px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 6px; box-sizing: border-box; overflow-y: auto;"></div>
                </div>

                <input type="file" id="radarjsonFileInput" accept=".json" style="display: none;">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 6px;">
                    <button id="drawRadarButton" style="padding: 7px; background-color: #b0720b; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; grid-column: span 2; font-size: 12px;">📡 Draw Radar Beam</button>
                    <button id="loadJsonButton" style="padding: 5px; background-color: #1f7887; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">📂 Load JSON</button>
                    <button id="saveJsonButton" style="padding: 5px; background-color: #2d7d46; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">💾 Save JSON</button>
                </div>

                <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                    <button id="removeByIdButton" style="flex: 1; padding: 5px; background-color: #555; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">Remove By ID</button>
                    <button id="removeAllButton" style="flex: 1; padding: 5px; background-color: #333; border: 1px solid #555; color: #eee; font-size: 11px; border-radius: 4px; cursor: pointer;">Remove All</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button id="toggleradarButton" style="padding: 5px; background-color: #2d2d30; border: 1px solid #434346; color: #ccc; font-size: 11px; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 8px;">🟠 레이더 토글</button>
                </div>

                <div id="radarNotification" style="margin-top: 10px; display: none; text-align: center; font-size: 11px; padding: 5px; border-radius: 4px; font-weight: bold;"></div>
            </div>
        `;

        document.body.appendChild(radarInfoBox);
        
        const closeBtn = document.getElementById('radarCloseBtn');
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#ff6b6b');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#aaa');

        makeElementDraggable(radarInfoBox);
        setupEventListeners();
        updateRadarListbox();
    }

    function setupEventListeners() {
        if (isInitialized) return;

        document.getElementById('loadJsonButton').addEventListener('click', function() {
            document.getElementById('radarjsonFileInput').click();
        });
        document.getElementById('radarjsonFileInput').addEventListener('change', loadRadarsFromJson);
        document.getElementById('removeByIdButton').addEventListener('click', removeRadarById);
        document.getElementById('removeAllButton').addEventListener('click', removeAllRadars);
        document.getElementById('drawRadarButton').addEventListener('click', drawRadarFromInput);
        document.getElementById('saveJsonButton').addEventListener('click', saveAllRadarConfigsAsJson);
        document.getElementById('toggleradarButton').addEventListener('click', toggleRadarVisibility);
        document.getElementById('radarCloseBtn').addEventListener('click', function() {
            const box = document.getElementById('radarInfoBox');
            if (box) box.style.display = 'none';
        });

        isInitialized = true;
    }

    function toggleRadarVisibility() {
        areRadarsVisible = !areRadarsVisible;
        for (const radarId in radarPrimitives) {
            if (radarPrimitives[radarId]) {
                radarPrimitives[radarId].show = areRadarsVisible;
            }
        }

        const btn = document.getElementById('toggleradarButton');
        if (btn) btn.textContent = areRadarsVisible ? '🟠 레이더 숨기기' : '🟠 레이더 보이기';
        
        updateRadarListbox();
        showNotification(areRadarsVisible ? "전체 레이더 표시 켜짐" : "전체 레이더 표시 꺼짐", "success");
    }

    function drawRadarFromInput() {
        const radarConfig = gatherInputValues();
        const radarId = nextId++;
        radarConfigurations[radarId] = {...radarConfig, id: radarId};

        const color = Cesium.Color.fromCssColorString(radarConfig.color).withAlpha(radarConfig.alpha);
        drawRadarBeam(radarId, radarConfig, color);
        
        updateRadarListbox();
        showNotification(`레이더 빔 #${radarId} 생성 완료`, 'success');
    }

    function gatherInputValues() {
        return {
            longitude: parseFloat(document.getElementById('longitude').value),
            latitude: parseFloat(document.getElementById('latitude').value),
            height: parseFloat(document.getElementById('height').value),
            baseRadius: parseFloat(document.getElementById('baseRadius').value),
            topRadius: parseFloat(document.getElementById('topRadius').value),
            length: parseFloat(document.getElementById('length').value),
            color: document.getElementById('color').value,
            alpha: parseFloat(document.getElementById('alpha').value),
            heading: parseFloat(document.getElementById('heading').value),
            pitch: parseFloat(document.getElementById('pitch').value),
            roll: parseFloat(document.getElementById('roll').value)
        };
    }

    function drawRadarBeam(radarId, config, color) {
        const position = Cesium.Cartesian3.fromDegrees(config.longitude, config.latitude, config.height);
        const beamGeometry = new Cesium.CylinderGeometry({
            length: config.length,
            topRadius: config.topRadius,
            bottomRadius: config.baseRadius,
            slices: 64,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
        });
        
        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);
        const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(config.heading),
                Cesium.Math.toRadians(config.pitch),
                Cesium.Math.toRadians(config.roll)
            )
        );
        const rotationTranslationMatrix = Cesium.Matrix4.fromRotationTranslation(rotationMatrix);
        Cesium.Matrix4.multiply(modelMatrix, rotationTranslationMatrix, modelMatrix);
        Cesium.Matrix4.multiplyByTranslation(
            modelMatrix,
            new Cesium.Cartesian3(0.0, 0.0, config.length / 2),
            modelMatrix
        );

        const beamInstance = new Cesium.GeometryInstance({
            geometry: beamGeometry,
            modelMatrix: modelMatrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
            }
        });

        const radarPrimitive = new Cesium.Primitive({
            geometryInstances: beamInstance,
            appearance: new Cesium.PerInstanceColorAppearance({
                closed: true,
                translucent: true
            }),
            show: areRadarsVisible
        });

        viewer.scene.primitives.add(radarPrimitive);
        radarPrimitives[radarId] = radarPrimitive;
    }

    function loadRadarsFromJson(event) {
        const input = event.target;
        if (!input || input.files.length === 0) {
            console.warn("No file selected!");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const radars = JSON.parse(e.target.result);
                radars.forEach(radar => {
                    const radarId = radar.id || nextId++;
                    radarConfigurations[radarId] = radar;
                    const color = Cesium.Color.fromCssColorString(radar.color).withAlpha(radar.alpha);
                    drawRadarBeam(radarId, radar, color);
                });
                updateRadarListbox();
                showNotification('레이더 JSON 패키지 로드 완료', 'success');
            } catch (error) {
                console.error("Failed to parse JSON", error);
                showNotification('JSON 형식이 유효하지 않습니다.', 'error');
            }
        };
        reader.readAsText(input.files[0]);
    }

    function removeRadarById() {
        const radarId = parseInt(document.getElementById('radarId').value);
        if (isNaN(radarId)) return;

        if (radarPrimitives[radarId]) {
            viewer.scene.primitives.remove(radarPrimitives[radarId]);
            delete radarPrimitives[radarId];
            delete radarConfigurations[radarId];
            showNotification(`레이더 #${radarId} 삭제 완료`, 'success');
            updateRadarListbox();
        }
    }

    function removeAllRadars() {
        Object.values(radarPrimitives).forEach(primitive => viewer.scene.primitives.remove(primitive));
        radarPrimitives = {};
        radarConfigurations = {};
        showNotification('모든 레이더 데이터를 초기화했습니다.', 'success');
        updateRadarListbox();
    }

    function saveAllRadarConfigsAsJson() {
        if (Object.keys(radarConfigurations).length === 0) return;
        const blob = new Blob([JSON.stringify(Object.values(radarConfigurations), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'radar_configurations.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function showNotification(message, type) {
        const el = document.getElementById('radarNotification');
        if (!el) return;
        el.textContent = message;
        el.style.backgroundColor = type === 'success' ? 'rgba(46, 125, 50, 0.85)' : 'rgba(184, 43, 43, 0.85)';
        el.style.color = '#fff';
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    function makeElementDraggable(element) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0, initialX = 0, initialY = 0;
        const header = document.getElementById('radarHeader');

        header.addEventListener('mousedown', dragMouseDown);
        function dragMouseDown(e) {
            if (e.target.id === 'radarCloseBtn' || e.target.tagName.toLowerCase() === 'input') {
                return;
            }
            e.preventDefault();
            initialX = e.clientX;
            initialY = e.clientY;
            isDragging = true;
            document.addEventListener('mousemove', elementDrag);
            document.addEventListener('mouseup', closeDragElement);
        }

        function elementDrag(e) {
            if (!isDragging) return;

            e.preventDefault();
            offsetX = initialX - e.clientX;
            offsetY = initialY - e.clientY;
            initialX = e.clientX;
            initialY = e.clientY;
            element.style.top = (element.offsetTop - offsetY) + "px";
            element.style.left = (element.offsetLeft - offsetX) + "px";
        }

        function closeDragElement() {
            isDragging = false;
            document.removeEventListener('mousemove', elementDrag);
            document.removeEventListener('mouseup', closeDragElement);
        }
    }

    return { 
        createInfoBox: createInfoBox,
        toggleInfoBox: function() {
            const box = document.getElementById('radarinfoBox');
            if (box) {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? 'block' : 'none';
                if (isHidden) updateRadarListbox();
            } else {
                createInfoBox();
            }
        }
    };
})();