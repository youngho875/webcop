window.domeDrawing = (function() {
    const viewer = window.CesiumViewer;
    let domes = {}; // Store domes by ID
    let pathConfigurations = []; // curve 모듈과 변수 대응을 위한 설정 배열 (JSON 저장용)
    let areDomesVisible = true;

    // 🎯 방공망(Dome) 리스트박스 실시간 갱신 함수 (개별 체크박스 및 선택 바인딩)
    function updateDomeListbox() {
        const listbox = document.getElementById('domeRouteList');
        if (!listbox) return;

        listbox.innerHTML = '';

        // domes 객체에 있는 데이터를 리스트에 반영
        Object.keys(domes).forEach((domeId) => {
            const domeItem = domes[domeId];
            const config = domeItem.config;
            
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
            checkbox.className = 'dome-item-checkbox';
            checkbox.dataset.domeId = domeId;
            checkbox.style.cssText = `
                margin: 0;
                cursor: pointer;
                accent-color: #1f7887;
            `;
            
            // 현재 첫 번째 엔티티 혹은 Primitive의 가시성 상태 확인하여 동기화
            let isVisible = true;
            if (Array.isArray(domeItem.entities) && domeItem.entities.length > 0) {
                isVisible = domeItem.entities[0].show !== false;
            } else if (domeItem.entities) {
                isVisible = domeItem.entities.show !== false;
            }
            checkbox.checked = isVisible;

            // 체크박스 변경 이벤트: 해당 돔 전체 구성 엔티티들 개별 토글
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const visible = checkbox.checked;
                setDomeVisibility(domeId, visible);
                
                syncMasterCheckbox();
                showNotification(`방공망 [ID: ${domeId}] 표출 ${visible ? '켬' : '끎'}`, "success");
            });

            // 리스트 아이템 클릭 시 데이터 입력 폼에 정보 자동 세팅
            option.addEventListener('click', () => {
                document.getElementById('domeId').value = domeId;
                document.getElementById('longitude').value = config.longitude;
                document.getElementById('latitude').value = config.latitude;
                document.getElementById('radius').value = config.radius;
                document.getElementById('color').value = config.color;
                document.getElementById('renderMode').value = config.renderMode;
                
                Array.from(listbox.children).forEach(child => child.style.background = 'rgba(255, 255, 255, 0.05)');
                option.style.background = 'rgba(31, 120, 135, 0.3)'; // 방공망 테마 색상 Accent
            });

            const textContainer = document.createElement('div');
            textContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                flex: 1;
                align-items: center;
            `;
            textContainer.innerHTML = `
                <span>🛡️ ID: <strong>${domeId}</strong></span>
                <span style="font-size: 10px; color: #aaa;">R: ${(config.radius / 1000).toFixed(1)}km [${config.renderMode}]</span>
            `;

            option.appendChild(checkbox);
            option.appendChild(textContainer);
            listbox.appendChild(option);
        });

        if (Object.keys(domes).length === 0) {
            listbox.innerHTML = `<div style="text-align:center; color:#777; font-size:11px; padding-top:20px;">등록된 방공망 진지가 없습니다.</div>`;
        }
        
        syncMasterCheckbox();
    }

    // 🎯 단일 방공망(Primitive/Entities) 가시성 변경 제어 함수
    function setDomeVisibility(domeId, visible) {
        if (domes[domeId]) {
            const domeData = domes[domeId].entities;
            if (Array.isArray(domeData)) {
                domeData.forEach(entity => { entity.show = visible; });
            } else {
                domeData.show = visible;
            }
        }
    }

    // 🎯 개별 항목 변경 시 상단 마스터 전체선택 체크박스 상태 동기화
    function syncMasterCheckbox() {
        const masterCheckbox = document.getElementById('masterDomeCheckbox');
        if (!masterCheckbox) return;

        const itemCheckboxes = document.querySelectorAll('.dome-item-checkbox');
        if (itemCheckboxes.length === 0) {
            masterCheckbox.checked = false;
            return;
        }

        const allChecked = Array.from(itemCheckboxes).every(cb => cb.checked);
        masterCheckbox.checked = allChecked;
    }

    // 🎯 마스터 체크박스 핸들러: 리스트 전체 선택 / 해제
    function toggleAllCheckboxes(event) {
        const isChecked = event.target.checked;
        const itemCheckboxes = document.querySelectorAll('.dome-item-checkbox');
        
        itemCheckboxes.forEach(cb => {
            cb.checked = isChecked;
            const domeId = cb.dataset.domeId;
            setDomeVisibility(domeId, isChecked);
        });

        showNotification(isChecked ? "전체 방공망 표시 켬" : "전체 방공망 표시 끎", "success");
    }

    // UI 생성 함수 (curve 모듈과 쌍둥이 다크 테마 디자인 스타일)
    function createControlPanel() {
        const existBox = document.getElementById('controlPanel');
        if (existBox) {
            existBox.style.display = 'block';
            updateDomeListbox();
            return;
        }

        const controlPanel = document.createElement('div');
        controlPanel.id = 'controlPanel';
        controlPanel.style.cssText = `
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

        controlPanel.innerHTML = `
            <div>
                <div id="domeHeader" style="margin: 0 0 14px 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #fff; letter-spacing: 0.5px;">🛡️ 방공망 설정 및 제어</span>
                    <span id="domeCloseBtn" style="cursor: pointer; color: #aaa; font-size: 20px; font-weight: bold; line-height: 1;">&times;</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Dome ID:</label>
                        <input type="text" id="domeId" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
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
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Radius (m):</label>
                        <input type="number" id="radius" step="1" value="50000" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Color (RGBA):</label>
                        <input type="text" id="color" value="rgba(0, 0, 255, 0.5)" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Render Mode:</label>
                        <select id="renderMode" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px; height:24px;">
                            <option value="wireframe">Wireframe</option>
                            <option value="transparent">Transparent</option>
                            <option value="mesh">Mesh</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label style="font-size: 11px; color: #1f7887; font-weight: bold;">📊 방공망 돔(Dome) 기지 리스트</label>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <input type="checkbox" id="masterDomeCheckbox" style="cursor: pointer; margin: 0; accent-color: #1f7887;">
                            <label for="masterDomeCheckbox" style="font-size: 10px; color: #aaa; cursor: pointer; user-select: none;">전체 선택</label>
                        </div>
                    </div>
                    <div id="domeRouteList" style="width: 100%; height: 90px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 6px; box-sizing: border-box; overflow-y: auto;"></div>
                </div>

                <input type="file" id="domejsonFileInput" accept=".json" style="display: none;">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 6px;">
                    <button id="createDomeButton" style="padding: 7px; background-color: #1f7887; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; grid-column: span 2; font-size: 12px;">🛡️ Create Dome</button>
                    <button id="loadDomesButton" style="padding: 5px; background-color: #3a75c4; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">📂 Load JSON</button>
                    <button id="saveDomesButton" style="padding: 5px; background-color: #2d7d46; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">💾 Save JSON</button>
                </div>

                <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                    <button id="removeDomeButton" style="flex: 1; padding: 5px; background-color: #555; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">Remove By ID</button>
                    <button id="removeAllDomesButton" style="flex: 1; padding: 5px; background-color: #333; border: 1px solid #555; color: #eee; font-size: 11px; border-radius: 4px; cursor: pointer;">Remove All</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button id="toggleButton" style="padding: 5px; background-color: #2d2d30; border: 1px solid #434346; color: #ccc; font-size: 11px; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 8px;">🌐 방공망 숨기기</button>
                </div>

                <div id="domeNotification" style="margin-top: 10px; display: none; text-align: center; font-size: 11px; padding: 5px; border-radius: 4px; font-weight: bold;"></div>
            </div>
        `;

        document.body.appendChild(controlPanel);
        
        const closeBtn = document.getElementById('domeCloseBtn');
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#ff6b6b');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#aaa');

        makeElementDraggable(controlPanel);
        setupEventListeners();
        updateDomeListbox();
    }

    function setupEventListeners() {
        document.getElementById('createDomeButton').addEventListener('click', function() {
            const domeId = document.getElementById('domeId').value.trim();
            if (!domeId) {
                showNotification("유효한 Dome ID를 입력해주세요.", "error");
                return;
            }
            if (domeId in domes) {
                showNotification(`ID '${domeId}'는 이미 존재합니다.`, "error");
                return;
            }

            const longitude = parseFloat(document.getElementById('longitude').value);
            const latitude = parseFloat(document.getElementById('latitude').value);
            const radius = parseFloat(document.getElementById('radius').value);
            const color = document.getElementById('color').value;
            const renderMode = document.getElementById('renderMode').value;

            createDome(domeId, longitude, latitude, radius, color, renderMode);
            updateDomeListbox();
            showNotification(`방공망 진지 [ID: ${domeId}] 구축 완료`, "success");
        });

        document.getElementById('removeDomeButton').addEventListener('click', function() {
            const domeId = document.getElementById('domeId').value.trim();
            if (!domeId) {
                showNotification("삭제 혹은 조회할 Dome ID를 입력해주세요.", "error");
                return;
            }
            removeDome(domeId);
        });

        document.getElementById('removeAllDomesButton').addEventListener('click', removeAllDomes);
        
        document.getElementById('loadDomesButton').addEventListener('click', function() {
            document.getElementById('domejsonFileInput').click();
        });
        document.getElementById('domejsonFileInput').addEventListener('change', loadDomesFromJson);
        document.getElementById('saveDomesButton').addEventListener('click', saveDomesToJson);
        document.getElementById('toggleButton').addEventListener('click', toggleDomesVisibility);
        
        // 🎯 전체선택 마스터 체크박스 이벤트 바인딩
        document.getElementById('masterDomeCheckbox').addEventListener('change', toggleAllCheckboxes);
        
        document.getElementById('domeCloseBtn').addEventListener('click', function() {
            const panel = document.getElementById('controlPanel');
            if (panel) panel.style.display = 'none'; // DOM 완전 파괴가 아닌 display 제어로 변경값 보존
        });
    }

    function toggleDomesVisibility() {
        areDomesVisible = !areDomesVisible;
        for (const domeId in domes) {
            setDomeVisibility(domeId, areDomesVisible);
        }

        const btn = document.getElementById('toggleButton');
        if (btn) btn.textContent = areDomesVisible ? '🌐 방공망 숨기기' : '🌐 방공망 보이기';
        
        // 마스터 및 하위 리스트 박스 체크박스 싱크 처리
        const itemCheckboxes = document.querySelectorAll('.dome-item-checkbox');
        itemCheckboxes.forEach(cb => { cb.checked = areDomesVisible; });
        const masterCheckbox = document.getElementById('masterDomeCheckbox');
        if (masterCheckbox) masterCheckbox.checked = areDomesVisible;

        showNotification(areDomesVisible ? "전체 방공망 시각화 켬" : "전체 방공망 시각화 끎", "success");
    }

    function createDome(domeId, longitude, latitude, radius, color, renderMode) {
        let dome;
        switch (renderMode) {
            case 'mesh':
                dome = createMeshDome(longitude, latitude, radius, color);
                break;
            case 'transparent':
                dome = createTransparentDome(longitude, latitude, radius, color);
                break;
            default:
                dome = createWireframeDome(longitude, latitude, radius, color);
                break;
        }
        if (dome) {
            domes[domeId] = {
                entities: dome,
                config: { domeId, longitude, latitude, radius, color, renderMode }
            };
        }
    }

    function createWireframeDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        const verticalSegments = 64;
        const horizontalSegments = 32;
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition);
        const entities = [];
        
        for (let j = 0; j <= horizontalSegments; j++) {
            const phi = (Math.PI / 2) * (j / horizontalSegments);
            const circlePositions = [];
            for (let i = 0; i <= verticalSegments; i++) {
                const theta = (Math.PI * 2) * (i / verticalSegments);
                const x = radius * Math.cos(theta) * Math.sin(phi);
                const y = radius * Math.sin(theta) * Math.sin(phi);
                const z = radius * Math.cos(phi);
    
                const position = new Cesium.Cartesian3(x, y, z);
                const globalPosition = Cesium.Matrix4.multiplyByPoint(transform, position, new Cesium.Cartesian3());
                circlePositions.push(globalPosition);
            }
    
            const entity = viewer.entities.add({
                polyline: {
                    positions: circlePositions,
                    width: 1.5,
                    material: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
                },
                show: areDomesVisible
            });
            entities.push(entity);
        }
        
        for (let i = 0; i <= verticalSegments; i++) {
            const theta = (Math.PI * 2) * (i / verticalSegments);
            const verticalPositions = [];
            for (let j = 0; j <= horizontalSegments; j++) {
                const phi = (Math.PI / 2) * (j / horizontalSegments);
                const x = radius * Math.cos(theta) * Math.sin(phi);
                const y = radius * Math.sin(theta) * Math.sin(phi);
                const z = radius * Math.cos(phi);
    
                const position = new Cesium.Cartesian3(x, y, z);
                const globalPosition = Cesium.Matrix4.multiplyByPoint(transform, position, new Cesium.Cartesian3());
                verticalPositions.push(globalPosition);
            }
    
            const entity = viewer.entities.add({
                polyline: {
                    positions: verticalPositions,
                    width: 1.5,
                    material: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
                },
                show: areDomesVisible
            });
            entities.push(entity);
        }
        
        return entities;
    }

    function createMeshDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        const sphereGeometry = new Cesium.SphereGeometry({
            vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
            radius: radius
        });

        const geometryInstance = new Cesium.GeometryInstance({
            geometry: sphereGeometry,
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color))
            }
        });

        const appearance = new Cesium.PerInstanceColorAppearance({
            flat: true,
            translucent: true
        });

        const dome = viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: geometryInstance,
            appearance: appearance,
            asynchronous: false,
            show: areDomesVisible
        }));

        return dome;
    }

    function createTransparentDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        const sphereGeometry = new Cesium.SphereGeometry({
            vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
            radius: radius,
            slicePartitions: 16,
            stackPartitions: 16
        });

        const geometryInstance = new Cesium.GeometryInstance({
            geometry: sphereGeometry,
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color))
            }
        });

        const meshAppearance = new Cesium.MaterialAppearance({
            material: Cesium.Material.fromType('Color', {
                color: Cesium.Color.fromCssColorString(color).withAlpha(0.2)
            }),
            translucent: true,
            faceForward: true
        });

        const dome = viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: geometryInstance,
            appearance: meshAppearance,
            asynchronous: false,
            show: areDomesVisible
        }));

        return dome;
    }

    function removeDome(domeId) {
        if (domes[domeId]) {
            const { entities } = domes[domeId];
            if (Array.isArray(entities)) {
                entities.forEach(entity => { viewer.entities.remove(entity); });
            } else {
                viewer.scene.primitives.remove(entities);
            }
            delete domes[domeId];
            updateDomeListbox();
            showNotification(`진지 [ID: ${domeId}] 완전 철거 완료.`, "success");
        } else {
            console.warn(`No dome found with ID '${domeId}'.`);
            showNotification("해당 ID의 진지를 찾을 수 없습니다.", "error");
        }
    }
    
    function removeAllDomes() {
        for (const domeId in domes) {
            const { entities } = domes[domeId];
            if (Array.isArray(entities)) {
                entities.forEach(entity => { viewer.entities.remove(entity); });
            } else {
                viewer.scene.primitives.remove(entities);
            }
        }
        domes = {};
        updateDomeListbox();
        showNotification("모든 방공 진지를 초기화했습니다.", "success");
    }

    function loadDomesFromJson(event) {
        const input = event.target;
        if (!input || input.files.length === 0) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const domeData = JSON.parse(e.target.result);
                removeAllDomes(); // 깔끔한 처리를 위한 기지 오버라이트 초기화

                domeData.forEach(data => {
                    const { domeId, longitude, latitude, radius, color, renderMode } = data;
                    if (!(domeId in domes)) {
                        createDome(domeId, longitude, latitude, radius, color, renderMode || 'wireframe');
                    }
                });
                updateDomeListbox();
                showNotification("JSON 방공망 기지 데이터 로드 완료", "success");
            } catch (error) {
                console.error("Failed to parse JSON", error);
                showNotification("JSON 파일 로딩 실패", "error");
            }
        };
        reader.readAsText(input.files[0]);
    }

    function saveDomesToJson() {
        const domeArray = Object.values(domes).map(d => d.config);
        if (domeArray.length === 0) {
            showNotification("저장할 방공망 기지가 없습니다.", "error");
            return;
        }
        const jsonString = JSON.stringify(domeArray, null, 2);
        
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'domes.json';
        a.click();
        URL.revokeObjectURL(url);
        showNotification("방공 데이터 추출 성공", "success");
    }

    function showNotification(message, type) {
        const el = document.getElementById('domeNotification');
        if (!el) return;
        el.textContent = message;
        el.style.backgroundColor = type === 'success' ? 'rgba(46, 125, 50, 0.85)' : 'rgba(184, 43, 43, 0.85)';
        el.style.color = '#fff';
        el.style.display = 'block';
        el.style.padding = '5px';
        el.style.borderRadius = '4px';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    function makeElementDraggable(element) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0, initialX = 0, initialY = 0;
        const header = document.getElementById('domeHeader');

        header.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            if (e.target.id === 'domeCloseBtn' || e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'select') {
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
        createControlPanel: createControlPanel,
        toggleInfoBox: function() {
            const box = document.getElementById('controlPanel');
            if (box) {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? 'block' : 'none';
                if (isHidden) updateDomeListbox();
            } else {
                createControlPanel();
            }
        }
    };
})();