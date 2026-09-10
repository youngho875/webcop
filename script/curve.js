window.curve = (function() {
    const viewer = window.CesiumViewer;
    let pathEntities = {}; // ID별 Polyline 엔티티 저장
    let modelEntities = {}; // ID별 glb/gltf 미사일 모델 엔티티 저장
    let labelEntities = {}; // ID별 라벨 엔티티 배열 저장
    let pathConfigurations = [];
    let nextId = 1; // 고유 ID 생성을 위한 카운터
    let pathsVisible = true;
    let labelsVisible = true;

    // 🎯 미사일 경로 리스트박스 실시간 갱신 함수 (전체 선택 상태 동기화 포함)
    function updateCurveListbox() {
        const listbox = document.getElementById('missileRouteList');
        if (!listbox) return;

        listbox.innerHTML = '';

        pathConfigurations.forEach((config) => {
            const pathId = config.id;
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
            checkbox.className = 'missile-item-checkbox';
            checkbox.dataset.pathId = pathId;
            checkbox.style.cssText = `
                margin: 0;
                cursor: pointer;
                accent-color: #a83232;
            `;
            
            // 현재 가시성 상태 확인 (엔티티가 있으면 그 상태를 따름)
            const pe = pathEntities[pathId];
            checkbox.checked = pe ? pe.show : true;

            // 체크박스 변경 이벤트: 해당 경로 세트(라인, 모델, 라벨) 일괄 개별 토글
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const visible = checkbox.checked;
                setPathVisibility(pathId, visible);
                
                // 개별 변경 시 마스터 '전체 선택' 체크박스 상태 동기화
                syncMasterCheckbox();
                showNotification(`경로 [ID: ${pathId}] 표출 ${visible ? '켬' : '끎'}`, "success");
            });

            // 리스트 아이템 클릭 시 데이터 입력 폼에 정보 자동 세팅
            option.addEventListener('click', () => {
                document.getElementById('pathId').value = pathId;
                document.getElementById('startLongitude').value = config.coordinates.startLongitude;
                document.getElementById('startLatitude').value = config.coordinates.startLatitude;
                document.getElementById('endLongitude').value = config.coordinates.endLongitude;
                document.getElementById('endLatitude').value = config.coordinates.endLatitude;
                document.getElementById('lowAltitude').value = config.altitudes.lowAltitude;
                document.getElementById('highAltitude').value = config.altitudes.highAltitude;
                
                Array.from(listbox.children).forEach(child => child.style.background = 'rgba(255, 255, 255, 0.05)');
                option.style.background = 'rgba(168, 50, 50, 0.3)';
            });

            const textContainer = document.createElement('div');
            textContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                flex: 1;
                align-items: center;
            `;
            textContainer.innerHTML = `
                <span>☄️ ID: <strong>${pathId}</strong></span>
                <span style="font-size: 10px; color: #aaa;">Max Alt: ${(config.altitudes.highAltitude / 1000).toFixed(0)}km</span>
            `;

            option.appendChild(checkbox);
            option.appendChild(textContainer);
            listbox.appendChild(option);
        });

        if (pathConfigurations.length === 0) {
            listbox.innerHTML = `<div style="text-align:center; color:#777; font-size:11px; padding-top:20px;">등록된 미사일 경로가 없습니다.</div>`;
        }
        
        // 리스트박스가 갱신될 때 마스터 마크 동기화
        syncMasterCheckbox();
    }

    // 🎯 특정 단일 경로 내 엔티티 가시성 설정 헬퍼 함수
    function setPathVisibility(pathId, visible) {
        if (pathEntities[pathId]) pathEntities[pathId].show = visible;
        if (modelEntities[pathId]) modelEntities[pathId].show = visible;
        if (labelEntities[pathId]) {
            labelEntities[pathId].forEach(lbl => { lbl.show = visible; });
        }
    }

    // 🎯 개별 항목 변경 시 상단 마스터 전체선택 체크박스 체크 상태를 동기화
    function syncMasterCheckbox() {
        const masterCheckbox = document.getElementById('masterPathCheckbox');
        if (!masterCheckbox) return;

        const itemCheckboxes = document.querySelectorAll('.missile-item-checkbox');
        if (itemCheckboxes.length === 0) {
            masterCheckbox.checked = false;
            return;
        }

        // 모든 개별 항목이 체크되어 있는지 확인
        const allChecked = Array.from(itemCheckboxes).every(cb => cb.checked);
        masterCheckbox.checked = allChecked;
    }

    // 🎯 마스터 체크박스 핸들러: 리스트 전체 선택 / 해제
    function toggleAllCheckboxes(event) {
        const isChecked = event.target.checked;
        const itemCheckboxes = document.querySelectorAll('.missile-item-checkbox');
        
        itemCheckboxes.forEach(cb => {
            cb.checked = isChecked;
            const pathId = parseInt(cb.dataset.pathId);
            setPathVisibility(pathId, isChecked);
        });

        showNotification(isChecked ? "전체 경로 표출 켬" : "전체 경로 표출 끎", "success");
    }

    // UI 생성 함수
    function createInfoBox() {
        const existBox = document.getElementById('missileinfoBox');
        if (existBox) {
            existBox.style.display = 'block';
            updateCurveListbox();
            return;
        }

        const missileinfoBox = document.createElement('div');
        missileinfoBox.id = 'missileinfoBox';
        missileinfoBox.style.cssText = `
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

        missileinfoBox.innerHTML = `
            <div>
                <div id="missileHeader" style="margin: 0 0 14px 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #fff; letter-spacing: 0.5px;">🚀 미사일 경로 설정</span>
                    <span id="curveCloseBtn" style="cursor: pointer; color: #aaa; font-size: 20px; font-weight: bold; line-height: 1;">&times;</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Target Path ID:</label>
                        <input type="number" id="pathId" step="1" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Start Longitude:</label>
                        <input type="number" id="startLongitude" step="0.0001" value="125.9935" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Start Latitude:</label>
                        <input type="number" id="startLatitude" step="0.0001" value="40.8379" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">End Longitude:</label>
                        <input type="number" id="endLongitude" step="0.0001" value="127.1036" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">End Latitude:</label>
                        <input type="number" id="endLatitude" step="0.0001" value="36.6362" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Low Altitude (m):</label>
                        <input type="number" id="lowAltitude" step="1" value="100" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">High Altitude (m):</label>
                        <input type="number" id="highAltitude" step="1" value="120000" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label style="font-size: 11px; color: #a83232; font-weight: bold;">📊 미사일 탄도 경로 리스트</label>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <input type="checkbox" id="masterPathCheckbox" style="cursor: pointer; margin: 0; accent-color: #a83232;">
                            <label for="masterPathCheckbox" style="font-size: 10px; color: #aaa; cursor: pointer; user-select: none;">전체 선택</label>
                        </div>
                    </div>
                    <div id="missileRouteList" style="width: 100%; height: 90px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 6px; box-sizing: border-box; overflow-y: auto;"></div>
                </div>

                <input type="file" id="curvejsonFileInput" accept=".json" style="display: none;">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 6px;">
                    <button id="drawPathButton" style="padding: 7px; background-color: #a83232; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; grid-column: span 2; font-size: 12px;">☄️ Draw Path</button>
                    <button id="curveloadJsonButton" style="padding: 5px; background-color: #1f7887; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">📂 Load JSON</button>
                    <button id="saveJsonButton" style="padding: 5px; background-color: #2d7d46; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">💾 Save JSON</button>
                </div>

                <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                    <button id="removeByIdButton" style="flex: 1; padding: 5px; background-color: #555; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">Remove By ID</button>
                    <button id="removeAllButton" style="flex: 1; padding: 5px; background-color: #333; border: 1px solid #555; color: #eee; font-size: 11px; border-radius: 4px; cursor: pointer;">Remove All</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button id="togglepathButton" style="padding: 5px; background-color: #2d2d30; border: 1px solid #434346; color: #ccc; font-size: 11px; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 8px;">🔴 라인 숨기기</button>
                    <button id="labeltogglepathButton" style="padding: 5px; background-color: #2d2d30; border: 1px solid #434346; color: #ccc; font-size: 11px; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 8px;">🏷️ 라인정보 숨기기</button>
                </div>

                <div id="curveNotification" style="margin-top: 10px; display: none; text-align: center; font-size: 11px; padding: 5px; border-radius: 4px; font-weight: bold;"></div>
            </div>
        `;

        document.body.appendChild(missileinfoBox);
        
        const closeBtn = document.getElementById('curveCloseBtn');
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#ff6b6b');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#aaa');

        makeElementDraggable(missileinfoBox);
        setupEventListeners();
        updateCurveListbox();
    }

    function setupEventListeners() {
        document.getElementById('drawPathButton').addEventListener('click', drawPathFromInput);
        document.getElementById('removeByIdButton').addEventListener('click', removePathById);
        document.getElementById('curveloadJsonButton').addEventListener('click', function() {
            document.getElementById('curvejsonFileInput').click();
        });
        document.getElementById('curvejsonFileInput').addEventListener('change', loadJsonFromFile);
        document.getElementById('removeAllButton').addEventListener('click', removeAllPaths);
        document.getElementById('saveJsonButton').addEventListener('click', savePathsAsJson);
        document.getElementById('togglepathButton').addEventListener('click', toggleVisibility);
        document.getElementById('labeltogglepathButton').addEventListener('click', labeltoggleVisibility);
        
        // 🎯 전체선택 마스터 체크박스 이벤트 연결
        document.getElementById('masterPathCheckbox').addEventListener('change', toggleAllCheckboxes);
        
        document.getElementById('curveCloseBtn').addEventListener('click', function() {
            const box = document.getElementById('missileinfoBox');
            if (box) box.style.display = 'none';
        });
    }

    function toggleVisibility() {
        pathsVisible = !pathsVisible;
        
        for (const pathId in pathEntities) {
            if (pathEntities[pathId]) pathEntities[pathId].show = pathsVisible;
        }
        for (const pathId in modelEntities) {
            if (modelEntities[pathId]) modelEntities[pathId].show = pathsVisible;
        }

        const btn = document.getElementById('togglepathButton');
        if (btn) btn.textContent = pathsVisible ? '🔴 라인 숨기기' : '🔴 라인 보이기';
        
        // 마스터 및 전체 상태와 개별 체크박스 싱크 유지
        const itemCheckboxes = document.querySelectorAll('.missile-item-checkbox');
        itemCheckboxes.forEach(cb => { cb.checked = pathsVisible; });
        const masterCheckbox = document.getElementById('masterPathCheckbox');
        if (masterCheckbox) masterCheckbox.checked = pathsVisible;

        showNotification(pathsVisible ? "전체 경로 표시 활성화" : "전체 경로 표시 비활성화", "success");
    }

    function labeltoggleVisibility() {
        labelsVisible = !labelsVisible;
        Object.values(labelEntities).forEach(labelsArray => {
            labelsArray.forEach(label => {
                label.show = labelsVisible;
            });
        });
        
        const btn = document.getElementById('labeltogglepathButton');
        if (btn) btn.textContent = labelsVisible ? '🏷️ 라인정보 숨기기' : '🏷️ 라인정보 보이기';
        showNotification(labelsVisible ? "정보 라벨 표출 활성화" : "정보 라벨 표출 비활성화", "success");
    }

    function drawPathFromInput() {
        const pathConfig = gatherInputValues();
        if (isNaN(pathConfig.coordinates.startLongitude) || isNaN(pathConfig.coordinates.endLongitude)) {
            showNotification("올바른 좌표 값을 입력해주세요.", "error");
            return;
        }
        
        const pathId = nextId++;
        pathConfig.id = pathId;
        pathConfigurations.push(pathConfig);

        curvDraw(
            pathId,
            pathConfig.coordinates.startLongitude,
            pathConfig.coordinates.startLatitude,
            pathConfig.coordinates.endLongitude,
            pathConfig.coordinates.endLatitude,
            pathConfig.altitudes.lowAltitude,
            pathConfig.altitudes.highAltitude
        );
        
        updateCurveListbox();
        showNotification(`경로 [ID: ${pathId}] 생성 완료`, "success");
    }

    function gatherInputValues() {
        return {
            coordinates: {
                startLongitude: parseFloat(document.getElementById('startLongitude').value),
                startLatitude: parseFloat(document.getElementById('startLatitude').value),
                endLongitude: parseFloat(document.getElementById('endLongitude').value),
                endLatitude: parseFloat(document.getElementById('endLatitude').value)
            },
            altitudes: {
                lowAltitude: parseFloat(document.getElementById('lowAltitude').value),
                highAltitude: parseFloat(document.getElementById('highAltitude').value)
            }
        };
    }

    function curvDraw(pathId, startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
        const ellipsePoints = [];
        const labels = [];
        const numPoints = 30;
        
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);
            ellipsePoints.push(position);

            if (i % 4 === 0) {
                const label = viewer.entities.add({
                    position: position,
                    label: {
                        text: `Lon: ${interpolatedLon.toFixed(2)}\nLat: ${interpolatedLat.toFixed(2)}\nAlt: ${altitude.toFixed(0)} m`,
                        font: '8pt sans-serif',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 1.5,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20),
                        show: labelsVisible 
                    }
                });
                labels.push(label);
            }
        }

        const pathEntity = viewer.entities.add({
            id: `curve_line_${pathId}`,
            polyline: {
                positions: ellipsePoints,
                width: 2.0,
                material: Cesium.Color.RED
            },
            show: pathsVisible,
            pickable: false,
        });

        pathEntities[pathId] = pathEntity;
        labelEntities[pathId] = labels;

        addModelFollowingPath(pathId, ellipsePoints);
    }

    function addModelFollowingPath(pathId, ellipsePoints) {
        const positionProperty = new Cesium.SampledPositionProperty();
        const totalSeconds = 30;
        const interval = 10; 
        const totalIntervals = (totalSeconds * 1000) / interval;
        let currentInterval = 0;
        
        ellipsePoints.forEach((point, index) => {
            const time = Cesium.JulianDate.addSeconds(Cesium.JulianDate.now(), index, new Cesium.JulianDate());
            positionProperty.addSample(time, point);
        });
    
        const baseOrientation = new Cesium.VelocityOrientationProperty(positionProperty);
    
        const adjustedOrientationProperty = new Cesium.CallbackProperty((time, result) => {
            const baseOrientationQuaternion = baseOrientation.getValue(time, result);
            if (!baseOrientationQuaternion) return Cesium.Quaternion.IDENTITY;
            const headingOffset = Cesium.Math.toRadians(0);
            const rotationQuaternion = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, headingOffset);
    
            return Cesium.Quaternion.multiply(baseOrientationQuaternion, rotationQuaternion, result);
        }, false);
    
        const modelEntity = viewer.entities.add({
            id: `curve_model_${pathId}`,
            position: positionProperty,
            orientation: adjustedOrientationProperty,
            show: pathsVisible, 
            model: {
                uri: '/object/kn-23.gltf',
                scale: 1.0
            },
        });

        modelEntities[pathId] = modelEntity;
    
        const timerId = setInterval(() => {
            if (!viewer.entities.getById(`curve_model_${pathId}`)) {
                clearInterval(timerId);
                return;
            }
            currentInterval = (currentInterval + 1) % totalIntervals;
            const t = currentInterval / totalIntervals;
            const position = interpolatePosition(ellipsePoints, t);
            positionProperty.addSample(Cesium.JulianDate.now(), position);
        }, interval);
    }
    
    function interpolatePosition(points, t) {
        const totalPoints = points.length;
        const scaledT = t * (totalPoints - 1);
        const index = Math.floor(scaledT);
        const frac = scaledT - index;
    
        if (index >= totalPoints - 1) return points[totalPoints - 1];
    
        const start = points[index];
        const end = points[index + 1];
    
        return Cesium.Cartesian3.lerp(start, end, frac, new Cesium.Cartesian3());
    }
   
    function removePathById() {
        const pathId = parseInt(document.getElementById('pathId').value);
        if (isNaN(pathId)) {
            showNotification("삭제할 대상을 리스트에서 선택하거나 ID를 적어주세요.", "error");
            return;
        }

        if (pathEntities[pathId]) {
            viewer.entities.remove(pathEntities[pathId]);
            delete pathEntities[pathId];
        }
        if (modelEntities[pathId]) {
            viewer.entities.remove(modelEntities[pathId]);
            delete modelEntities[pathId];
        }
        if (labelEntities[pathId]) {
            labelEntities[pathId].forEach(lbl => viewer.entities.remove(lbl));
            delete labelEntities[pathId];
        }

        pathConfigurations = pathConfigurations.filter(config => config.id !== pathId);
        updateCurveListbox();
        showNotification(`경로 [ID: ${pathId}] 정상 삭제`, "success");
    }

    function loadJsonFromFile(event) {
        const input = event.target;
        if (!input || input.files.length === 0) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.paths) return;

                removeAllPaths();

                data.paths.forEach(path => {
                    const pathId = nextId++;
                    path.id = pathId;
                    pathConfigurations.push(path);

                    const { startLongitude, startLatitude, endLongitude, endLatitude } = path.coordinates;
                    const { lowAltitude, highAltitude } = path.altitudes;

                    curvDraw(pathId, startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude);
                });

                updateCurveListbox();
                showNotification("JSON 파일 경로 연동 성공", "success");
                viewer.zoomTo(viewer.entities);
            } catch (error) {
                console.error('Failed to parse JSON', error);
                showNotification("파일 파싱 실패", "error");
            }
        };
        reader.readAsText(input.files[0]);
    }

    function removeAllPaths() {
        Object.values(pathEntities).forEach(entity => viewer.entities.remove(entity));
        Object.values(modelEntities).forEach(entity => viewer.entities.remove(entity));
        Object.values(labelEntities).forEach(labelsArray => {
            labelsArray.forEach(lbl => viewer.entities.remove(lbl));
        });

        pathEntities = {};
        modelEntities = {};
        labelEntities = {};
        pathConfigurations = [];
        
        updateCurveListbox();
        showNotification("모든 경로를 청소했습니다.", "success");
    }

    function savePathsAsJson() {
        if (pathConfigurations.length === 0) return;
        const blob = new Blob([JSON.stringify({ paths: pathConfigurations }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'path_configurations.json';
        a.click();
        URL.revokeObjectURL(url);
        showNotification("JSON 내보내기 성공", "success");
    }

    function showNotification(message, type) {
        const el = document.getElementById('curveNotification');
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
        const header = document.getElementById('missileHeader');

        header.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            if (e.target.id === 'curveCloseBtn' || e.target.tagName.toLowerCase() === 'input') {
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
            const box = document.getElementById('missileinfoBox');
            if (box) {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? 'block' : 'none';
                if (isHidden) updateCurveListbox();
            } else {
                createInfoBox();
            }
        }
    };
})();



/*
window.curve = (function() {
    const viewer = window.CesiumViewer;
    let pathEntities = {}; // Changed from array to object for storing entities by ID
    let pathConfigurations = [];
    let nextId = 1; // To generate unique IDs

    function createInfoBox() {
        const infoBox = document.createElement('div');
        infoBox.id = 'infoBox';
        infoBox.style.position = 'absolute';
        infoBox.style.top = '150px';
        infoBox.style.left = '10px';
        infoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        infoBox.style.padding = '10px';
        infoBox.style.borderRadius = '10px';
        infoBox.style.zIndex = '100';
        infoBox.style.boxShadow = '3px 3px 10px rgba(0, 0, 0, 0.3)';
        infoBox.style.border = '1px solid #ccc';

        infoBox.innerHTML = `
            <div>
                <label for="startLongitude">Start Longitude:</label>
                <input type="number" id="startLongitude" step="0.0001" value="125.9935">
            </div>
            <div>
                <label for="startLatitude">Start Latitude:</label>
                <input type="number" id="startLatitude" step="0.0001" value="40.8379">
            </div>
            <div>
                <label for="endLongitude">End Longitude:</label>
                <input type="number" id="endLongitude" step="0.0001" value="127.1036">
            </div>
            <div>
                <label for="endLatitude">End Latitude:</label>
                <input type="number" id="endLatitude" step="0.0001" value="36.6362">
            </div>
            <div>
                <label for="lowAltitude">Low Altitude (m):</label>
                <input type="number" id="lowAltitude" step="1" value="100">
            </div>
            <div>
                <label for="highAltitude">High Altitude (m):</label>
                <input type="number" id="highAltitude" step="1" value="120000">
            </div>
            <div>
                <label for="pathId">Path ID:</label>
                <input type="number" id="pathId" step="1">
            </div>
            <input type="file" id="jsonFileInput" accept=".json">
            <button id="drawPathButton">Draw Path</button>
            <button id="removeByIdButton">Remove Path By ID</button>
            <button id="loadJsonButton">Load from JSON</button>
            <button id="removeAllButton">Remove All Paths</button>
            <button id="saveJsonButton">Save Paths as JSON</button>
            <button id="closeInfoBoxButton">Close</button>
        `;

        document.body.appendChild(infoBox);
        makeElementDraggable(infoBox);

        document.getElementById('drawPathButton').addEventListener('click', drawPathFromInput);
        document.getElementById('removeByIdButton').addEventListener('click', removePathById);
        document.getElementById('loadJsonButton').addEventListener('click', loadJsonFromFile);
        document.getElementById('removeAllButton').addEventListener('click', removeAllPaths);
        document.getElementById('saveJsonButton').addEventListener('click', savePathsAsJson);
        document.getElementById('closeInfoBoxButton').addEventListener('click', function() {
            infoBox.remove();
        });
    }

    function drawPathFromInput() {
        const pathConfig = gatherInputValues();
        pathConfigurations.push(pathConfig);

        const pathId = nextId++;
        pathConfig.id = pathId; // Assign ID to configuration
        curvDraw(
            pathId,
            pathConfig.coordinates.startLongitude,
            pathConfig.coordinates.startLatitude,
            pathConfig.coordinates.endLongitude,
            pathConfig.coordinates.endLatitude,
            pathConfig.altitudes.lowAltitude,
            pathConfig.altitudes.highAltitude
        );
    }

    function gatherInputValues() {
        return {
            coordinates: {
                startLongitude: parseFloat(document.getElementById('startLongitude').value),
                startLatitude: parseFloat(document.getElementById('startLatitude').value),
                endLongitude: parseFloat(document.getElementById('endLongitude').value),
                endLatitude: parseFloat(document.getElementById('endLatitude').value)
            },
            altitudes: {
                lowAltitude: parseFloat(document.getElementById('lowAltitude').value),
                highAltitude: parseFloat(document.getElementById('highAltitude').value)
            }
        };
    }

    function curvDraw(pathId, startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
        const ellipsePoints = [];
        const numPoints = 30;
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);
            ellipsePoints.push(position);

            if (i % 4 === 0) {
                viewer.entities.add({
                    position: position,
                    label: {
                        text: `Lon: ${interpolatedLon.toFixed(2)}\nLat: ${interpolatedLat.toFixed(2)}\nAlt: ${altitude.toFixed(0)} m`,
                        font: '5pt sans-serif',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 0.5,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20)
                    }
                });
            }
        }

        const pathEntity = viewer.entities.add({
            polyline: {
                positions: ellipsePoints,
                width: 0.5,
                material: Cesium.Color.RED
            },
            pickable: false,
        });

        pathEntities[pathId] = pathEntity;
    }

    function removePathById() {
        const pathId = parseInt(document.getElementById('pathId').value);
        if (pathEntities[pathId]) {
            viewer.entities.remove(pathEntities[pathId]);
            delete pathEntities[pathId];
            pathConfigurations = pathConfigurations.filter(config => config.id !== pathId);
        }
    }

    function loadJsonFromFile() {
        const input = document.getElementById('jsonFileInput');
        if (input.files.length === 0) {
            console.warn("No file selected!");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                data.paths.forEach(path => {
                    const pathId = nextId++;
                    path.id = pathId; // Assign ID to each path
                    pathConfigurations.push(path);

                    const { startLongitude, startLatitude, endLongitude, endLatitude } = path.coordinates;
                    const { lowAltitude, highAltitude } = path.altitudes;

                    curvDraw(pathId, startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude);
                });

                viewer.zoomTo(viewer.entities);
            } catch (error) {
                console.error('Failed to parse JSON', error);
            }
        };
        reader.readAsText(input.files[0]);
    }

    function removeAllPaths() {
        Object.values(pathEntities).forEach(entity => viewer.entities.remove(entity));
        pathEntities = {};
        pathConfigurations = [];
    }

    function savePathsAsJson() {
        const blob = new Blob([JSON.stringify({ paths: pathConfigurations }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'path_configurations.json';
        a.textContent = 'Download paths config JSON file';
        a.click();
        URL.revokeObjectURL(url);
    }

    function makeElementDraggable(element) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0, initialX = 0, initialY = 0;

        element.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            if (e.target.tagName.toLowerCase() === 'input') {
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

    // Invoke the InfoBox creation
    return {createInfoBox };
})();
*/
/*
(function () {
    const viewer = window.CesiumViewer;
    
    // Function to create and add a particle system at a specific position
    function addParticleEffect(position) {
        viewer.scene.primitives.add(new Cesium.ParticleSystem({
            modelMatrix : Cesium.Transforms.eastNorthUpToFixedFrame(position),
            image : '/object/fire.png', // Path to the particle image
            startColor : Cesium.Color.WHITE.withAlpha(0.7),
            endColor : Cesium.Color.GRAY.withAlpha(0.1),
            minimumSpeed : 1.0,
            maximumSpeed : 4.0,
            lifetime : 5.0,
            emitter : new Cesium.ConeEmitter(Cesium.Math.toRadians(45.0)),
            emitterModelMatrix : Cesium.Matrix4.fromTranslation(Cesium.Cartesian3.UNIT_Z.negate(Cesium.Cartesian3.ZERO))
        }));
    }

    // Function to draw curve given coordinates and altitude
    function curvDraw(startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
        const ellipsePoints = [];
        const numPoints = 30; // Number of points in the path
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);

            ellipsePoints.push(position);

            // Check if this is the position to add a particle effect
            if (/i === Math.floor(numPoints / 2) // condition to target specific location like below: 
            if (/ i === Math.floor(numPoints / 2)  {
                addParticleEffect(position);
            }

            // Add label at certain intervals
            if (i % 4 === 0) {
                viewer.entities.add({
                    position: position,
                    label: {
                        text: `Lon: ${interpolatedLon.toFixed(2)}\nLat: ${interpolatedLat.toFixed(2)}\nAlt: ${altitude.toFixed(0)} m`,
                        font: '5pt sans-serif',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 0.5,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20)
                    }
                });
            }
        }

        // Add the elliptical path to the scene
        viewer.entities.add({
            polyline: {
                positions: ellipsePoints,
                width: 0.5,
                material: Cesium.Color.RED
            }
        });
    }

    // Load JSON file and process each path
    function loadJsonAndDraw(url) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            })
            .then(data => {
                data.paths.forEach(path => {
                    const { startLongitude, startLatitude, endLongitude, endLatitude } = path.coordinates;
                    const { lowAltitude, highAltitude } = path.altitudes;
                    
                    // Function call to draw each path
                    curvDraw(startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude);
                });

                // Zoom to all entities in the viewer
                viewer.zoomTo(viewer.entities);
            })
            .catch(error => console.error('Error loading JSON:', error));
    }

    // Call the function with your JSON file path
    loadJsonAndDraw('/jsonData/datajson.json');
})();
*/

/*
(function () {
    const viewer = window.CesiumViewer;
    // Define start and end coordinates, and altitudes
    const startLon = 125.9935;
    const startLat = 39.9236;
    const endLon = 126.9211;
    const endLat = 37.5252;
    const minAltitude = 100.0; // in meters
    const maxAltitude = 100000.0; // in meters

    const ellipsePoints = [];

    function curvDraw(startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
        const numPoints = 30; // Number of points in the path
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);
            ellipsePoints.push(position);

            // Add label at certain intervals
            if (i % 4 === 0) {  // Add a label every 4th point
                viewer.entities.add({
                    position: position,
                    label: {
                        text: `Lon: ${interpolatedLon.toFixed(2)}\nLat: ${interpolatedLat.toFixed(2)}\nAlt: ${altitude.toFixed(0)} m`,
                        font: '14pt sans-serif',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20)
                    }
                });
            }
        }
    }

    // Add the elliptical path to the scene
    viewer.entities.add({
        polyline: {
            positions: ellipsePoints,
            width: 3,
            material: Cesium.Color.RED
        }
    });

    // JSON 파일에서 데이터를 로드하는 함수
    function loadJson(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("JSON 파일을 불러오는데 실패했습니다.");
                }
                return response.json();
            });
    }

// Zoom to the path
viewer.zoomTo(viewer.entities);

})();

*/