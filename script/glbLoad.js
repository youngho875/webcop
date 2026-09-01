window.airpath = (function () {
    const viewer = window.CesiumViewer;
    let activeShapes = {};
    let floatingPoint = null;
    let polylineId = 0;
    let activeShape = null;
    let currentHandler = null;
    let loadedPolylines = {};
    let modelEntitys = []; // 애니메이션 실행 중인 모델들의 참조 배열
    let modelVisible = true;
    let splinesVisible = true;
    
    let isInitialized = false;

    function init() {
        // 초기화 로직
    }

    // 🎯 [수정] 체크박스 On/Off 시 선(Polyline)과 3D 모델(.glb)을 모두 제어
    function updateRouteListbox() {
        const listbox = document.getElementById('airpathRouteList');
        if (!listbox) return;

        listbox.innerHTML = '';

        const allIds = new Set([
            ...Object.keys(activeShapes).map(Number),
            ...Object.keys(loadedPolylines).map(Number)
        ]);

        Array.from(allIds).sort((a, b) => a - b).forEach(id => {
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
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.cssText = `
                margin: 0;
                cursor: pointer;
                accent-color: #007acc;
            `;
            
            const lineEntity = viewer.entities.getById(`polyline_${id}`);
            checkbox.checked = lineEntity ? lineEntity.show : true;

            // ✨ 체크박스 변경 시 선과 모델 가시성을 동시 제어
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation(); 
                
                // 1. 항적선(Polyline) 가시성 토글
                const targetLine = viewer.entities.getById(`polyline_${id}`);
                if (targetLine) {
                    targetLine.show = checkbox.checked;
                }

                // 2. 해당 경로 ID를 가지고 가동 중인 3D 모델(.glb) 엔티티 제어
                const targetModel = viewer.entities.getById(`model_${id}`);
                if (targetModel) {
                    targetModel.show = checkbox.checked;
                }

                showNotification(`경로 #${id} 및 객체 표출 ${checkbox.checked ? '켜짐' : '꺼짐'}`, "success");
            });

            option.addEventListener('click', () => {
                document.getElementById('polyId').value = id;
                document.getElementById('deleteId').value = id;
                
                Array.from(listbox.children).forEach(child => child.style.background = 'rgba(255, 255, 255, 0.05)');
                option.style.background = 'rgba(0, 122, 204, 0.3)';
            });

            const textContainer = document.createElement('div');
            textContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                flex: 1;
                align-items: center;
            `;
            textContainer.innerHTML = `
                <span>✈️ 경로 ID: <strong>${id}</strong></span>
                <span style="font-size: 10px; color: #aaa;">포인트: ${activeShapes[id] ? activeShapes[id].length : 0}개</span>
            `;

            option.appendChild(checkbox);
            option.appendChild(textContainer);
            listbox.appendChild(option);
        });

        if (allIds.size === 0) {
            listbox.innerHTML = `<div style="text-align:center; color:#777; font-size:11px; padding-top:20px;">등록된 항적 경로가 없습니다.</div>`;
        }
    }

    // 🎯 UI 생성 함수
    function createInfoBox() {
        const existBox = document.getElementById('airpathinfoBox');
        if (existBox) {
            existBox.style.display = 'block';
            updateRouteListbox();
            return;
        }

        const airpathinfoBox = document.createElement('div');
        airpathinfoBox.id = 'airpathinfoBox';
        airpathinfoBox.style.cssText = `
            position: absolute; 
            top: 150px; 
            left: 20px; 
            background-color: rgba(30, 30, 30, 0.85);
            backdrop-filter: blur(4px);
            padding: 16px; 
            border-radius: 8px; 
            z-index: 1005; 
            box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            width: 300px;
            box-sizing: border-box;
        `;

        airpathinfoBox.innerHTML = `
            <div>
                <div id="airpathHeader" style="margin: 0 0 14px 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #fff; letter-spacing: 0.5px;">✈️ 비행 경로 매니저 (Airpath)</span>
                    <span id="closeBtn" style="cursor: pointer; color: #aaa; font-size: 20px; font-weight: bold; line-height: 1;">&times;</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center;">
                        <label style="width: 85px; font-size: 11px; color: #aaa;">경로 ID</label>
                        <input type="number" id="polyId" value="1" style="flex: 1; padding: 5px 8px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 12px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 85px; font-size: 11px; color: #aaa;">비행고도 (m)</label>
                        <input type="number" id="pointAltitude" step="1" value="100" style="flex: 1; padding: 5px 8px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 12px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 85px; font-size: 11px; color: #aaa;">선 색상</label>
                        <input type="color" id="lineColor" value="#0000ff" style="flex: 1; height: 28px; padding: 0; background: none; border: 1px solid #434346; border-radius: 4px; cursor: pointer;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 85px; font-size: 11px; color: #aaa;">선 두께 (px)</label>
                        <input type="number" id="lineWidth" value="5" min="1" style="flex: 1; padding: 5px 8px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 12px;">
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; color: #007acc; font-weight: bold; display: block; margin-bottom: 4px;">📊 현재 항적 경로 리스트 (체크: 표출)</label>
                    <div id="airpathRouteList" style="width: 100%; height: 100px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 6px; box-sizing: border-box; overflow-y: auto;"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px;">
                    <button id="drawBtn" style="padding: 7px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; grid-column: span 2; font-size: 12px;">🎨 그리기 시작</button>
                    <button id="saveBtn" style="padding: 6px; background-color: #3e3e42; border: 1px solid #555; color: #eee; font-size: 11px; border-radius: 4px; cursor: pointer;">현재 저장</button>
                    <button id="saveAllBtn" style="padding: 6px; background-color: #2d7d46; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">전체 저장</button>
                    <button id="loadBtn" style="padding: 7px; background-color: #1f7887; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; grid-column: span 2; font-size: 12px;">📂 JSON 파일 불러오기</button>
                    <input type="file" id="fileInput" accept=".json" style="display: none;">
                </div>
                
                <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.15); margin: 12px 0;">
                
                <div style="margin-bottom: 10px; display: flex; gap: 4px;">
                    <input type="number" id="deleteId" placeholder="ID 입력" style="width: 80px; padding: 5px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                    <button id="deleteBtn" style="flex: 1; padding: 5px; background-color: #a83232; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">선택 삭제</button>
                    <button id="clearBtn" style="flex: 1; padding: 5px; background-color: #555; border: none; color: #eee; font-size: 11px; border-radius: 4px; cursor: pointer;">전체 비우기</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <button id="toggleModelBtn" style="padding: 6px; background-color: #2d2d30; border: 1px solid #434346; color: #ccc; font-size: 11px; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 8px;">🤖 모델 보이기 / 숨기기</button>
                    <button id="toggleSplinesBtn" style="padding: 6px; background-color: #2d2d30; border: 1px solid #434346; color: #ccc; font-size: 11px; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 8px;">📈 스플라인 보이기 / 숨기기</button>
                    <button id="animateBtn" style="padding: 8px; background-color: #d19a11; border: none; color: #111; font-weight: bold; border-radius: 4px; cursor: pointer; margin-top: 4px; font-size: 12px;">🎬 3D 모델 애니메이션 기동</button>
                </div>
                
                <div id="notification" style="margin-top: 10px; display: none; text-align: center; font-size: 11px; padding: 5px; border-radius: 4px; font-weight: bold;"></div>
            </div>
        `;
        document.body.appendChild(airpathinfoBox);
        
        const cBtn = document.getElementById('closeBtn');
        cBtn.addEventListener('mouseenter', () => cBtn.style.color = '#ff6b6b');
        cBtn.addEventListener('mouseleave', () => cBtn.style.color = '#aaa');

        makeElementDraggable(airpathinfoBox);
        setupEventListeners();
        
        updateRouteListbox();
    }

    function setupEventListeners() {
        if (isInitialized) return;

        document.getElementById('drawBtn').addEventListener('click', startDrawing);
        document.getElementById('saveBtn').addEventListener('click', saveCurrentPolyline);
        document.getElementById('saveAllBtn').addEventListener('click', saveAllPolylines);
        document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('deleteBtn').addEventListener('click', deletePolylineById);
        document.getElementById('clearBtn').addEventListener('click', clearAll);
        document.getElementById('closeBtn').addEventListener('click', () => {
            const box = document.getElementById('airpathinfoBox');
            if (box) box.style.display = 'none';
        });
        document.getElementById('fileInput').addEventListener('change', handleFileUpload);
        document.getElementById('toggleModelBtn').addEventListener('click', toggleModelVisibility);
        document.getElementById('toggleSplinesBtn').addEventListener('click', toggleSplinesVisibility);
        document.getElementById('animateBtn').addEventListener('click', animateAllModels);

        isInitialized = true;
    }

    function toggleModelVisibility() {
        modelVisible = !modelVisible;
        modelEntitys.forEach(entity => { entity.show = modelVisible; });
        showNotification(modelVisible ? "🤖 전체 모델 켜짐" : "🤖 전체 모델 꺼짐", "success");
    }

    function toggleSplinesVisibility() {
        splinesVisible = !splinesVisible;
        Object.values(loadedPolylines).forEach(entity => { entity.show = splinesVisible; });
        updateRouteListbox();
        showNotification(splinesVisible ? "📈 전체 스플라인 켜짐" : "📈 전체 스플라인 꺼짐", "success");
    }

    function startDrawing() {
        resetState();
        polylineId = parseInt(document.getElementById('polyId').value) || 0;
        activeShapes[polylineId] = [];
        
        currentHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        viewer.scene.screenSpaceCameraController.enableInputs = false;

        currentHandler.setInputAction(handleLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        currentHandler.setInputAction(handleRightClick, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        currentHandler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        showNotification(`경로 #${polylineId} 화면 드로잉 활성화`, "success");
    }

    function handleLeftClick(event) {
        const position = getTerrainPosition(event.position);
        if (!position) return;

        const altitude = parseFloat(document.getElementById('pointAltitude').value);
        if (isNaN(altitude)) return;

        const cartoPosition = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);
        const adjustedPosition = Cesium.Cartesian3.fromRadians(
            cartoPosition.longitude,
            cartoPosition.latitude,
            altitude
        );

        activeShapes[polylineId].push(adjustedPosition.clone());

        if (activeShapes[polylineId].length === 1) {
            floatingPoint = createPoint(adjustedPosition);
        }
        updatePreview();
    }

    function handleRightClick() {
        if (activeShapes[polylineId]?.length > 1) {
            applySplineToPolyline(activeShapes[polylineId]);
            showNotification(`경로 #${polylineId} 스플라인 맵핑 완료`, 'success');
        }
        cleanupDrawing();
        updateRouteListbox(); 
    }

    function handleMouseMove(event) {
        if (!floatingPoint || !activeShapes[polylineId] || activeShapes[polylineId].length < 1) return;
        const position = getTerrainPosition(event.endPosition);
        if (position) floatingPoint.position.setValue(position);
        updatePreview();
    }

    function applySplineToPolyline(positions) {
        const spline = new Cesium.CatmullRomSpline({
            times: positions.map((_, index) => index),
            points: positions
        });

        const splinePositions = [];
        for (let t = 0; t < positions.length - 1; t += 0.01) {
            splinePositions.push(spline.evaluate(t));
        }

        const entity = viewer.entities.add({
            id: `polyline_${polylineId}`,
            polyline: {
                positions: splinePositions,
                width: getLineWidth(),
                material: getLineColor(),
                clampToGround: false
            }
        });
        loadedPolylines[polylineId] = entity;
    }

    // 🎯 [수정] 3D 모델 개별 관리를 위한 고유 식별 명세(id: `model_${id}`) 주입
    function animateAllModels() {
        const allPolylineIds = Object.keys(activeShapes);
        if (allPolylineIds.length === 0) {
            showNotification('애니메이션 대상 경로가 없습니다.', 'error');
            return;
        }
    
        allPolylineIds.forEach(id => {
            // 이미 해당 ID로 구동중인 모델이 있다면 중복 생성 방지를 위해 제거 후 재생성
            const existingModel = viewer.entities.getById(`model_${id}`);
            if (existingModel) viewer.entities.remove(existingModel);

            const entity = viewer.entities.getById(`polyline_${id}`);
            if (!entity) return;
    
            const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
            if (!positions || positions.length < 2) return;
    
            let currentIndex = 0;
            const interval = 100; 
            const totalPositions = positions.length;
    
            const positionProperty = new Cesium.SampledPositionProperty();
            positions.forEach((position, index) => {
                const time = Cesium.JulianDate.addSeconds(Cesium.JulianDate.now(), index, new Cesium.JulianDate());
                positionProperty.addSample(time, position);
            });
    
            const baseOrientation = new Cesium.VelocityOrientationProperty(positionProperty);
            const adjustedOrientationProperty = new Cesium.CallbackProperty((time, result) => {
                const baseOrientationQuaternion = baseOrientation.getValue(time, result);
                if (!baseOrientationQuaternion) return Cesium.Quaternion.IDENTITY;
                return Cesium.Quaternion.multiply(baseOrientationQuaternion, Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, 0), result);
            }, false);
            
            // 현재 해당 라인이 숨겨진 상태라면 모델도 숨겨진 상태로 시작하도록 동기화
            const isLineVisible = entity.show;
    
            const newmodelEntity = viewer.entities.add({
                id: `model_${id}`, // ✨ 핵심 수정: 개별 제어를 위한 고유 ID 부여
                position: new Cesium.CallbackProperty(() => positions[currentIndex], false),
                orientation: adjustedOrientationProperty,
                show: isLineVisible, // 라인의 표시 상태를 그대로 상속
                model: {
                    uri: '/object/Cesium_Air.glb',
                    scale: 200,
                    minimumPixelSize: 64,
                    maximumScale: 200,
                    silhouetteColor: Cesium.Color.WHITE,
                    silhouetteSize: 1
                },
            });

            modelEntitys.push(newmodelEntity);
    
            // 객체 지향 타이머 세팅 구조 유지
            const animTimer = setInterval(() => {
                // 만약 엔티티가 중간에 삭제되었다면 인터벌 타이머를 스스로 해제하도록 안전 처리
                if (!viewer.entities.getById(`model_${id}`)) {
                    clearInterval(animTimer);
                    return;
                }
                currentIndex = (currentIndex + 1) % totalPositions;
            }, interval);
        });
        showNotification("🤖 전체 시뮬레이션 애니메이션 구동 시작", "success");
    }
    
    function saveCurrentPolyline() {
        const id = parseInt(document.getElementById('polyId').value);
        if (!activeShapes[id]?.length) {
            showNotification('저장할 데이터셋 없음', 'error');
            return;
        }

        const data = {
            id: id,
            color: document.getElementById('lineColor').value,
            width: getLineWidth(),
            coordinates: activeShapes[id].map(cartesianToGeo)
        };

        downloadJSON(data, `polyline_${id}.json`);
        showNotification('현재 레이어 저장 성공', 'success');
    }

    function saveAllPolylines() {
        if (Object.keys(activeShapes).length === 0) {
            showNotification('패키징 처리할 데이터셋 없음', 'error');
            return;
        }

        const allData = {
            version: "1.0",
            created: new Date().toISOString(),
            polylines: Object.entries(activeShapes).map(([id, positions]) => ({
                id: parseInt(id),
                color: getSavedColor(id) || '#0000ff',
                width: getSavedWidth(id) || 5,
                coordinates: positions.map(cartesianToGeo)
            }))
        };

        downloadJSON(allData, `all_polylines_${new Date().toISOString().slice(0,10)}.json`);
        showNotification('전체 데이터 백업 성공', 'success');
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const jsonData = JSON.parse(e.target.result);
                loadDataFromJSON(jsonData);
                showNotification('JSON 패키지 복원 성공!', 'success');
            } catch (error) {
                showNotification('표준 형식이 아닙니다.', 'error');
            }
        };
        reader.readAsText(file);
    }

    function loadDataFromJSON(data) {
        if (!Array.isArray(data.polylines)) return;
        data.polylines.forEach(loadPolylineFromJSON);
        updateRouteListbox(); 
        animateAllModels();
    }

    function loadPolylineFromJSON(jsonData) {
        try {
            const existingEntity = viewer.entities.getById(`polyline_${jsonData.id}`);
            if (existingEntity) viewer.entities.remove(existingEntity);
            
            const positions = jsonData.coordinates.map(coord =>
                Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
            );
    
            const spline = new Cesium.CatmullRomSpline({
                times: positions.map((_, index) => index),
                points: positions
            });

            const splinePositions = [];
            for (let t = 0; t < positions.length - 1; t += 0.01) {
                splinePositions.push(spline.evaluate(t));
            }

            const entity = viewer.entities.add({
                id: `polyline_${jsonData.id}`,
                polyline: {
                    positions: splinePositions,
                    width: jsonData.width || 5,
                    material: Cesium.Color.fromCssColorString(jsonData.color || '#0000FF')
                }
            });
    
            activeShapes[jsonData.id] = splinePositions;
            loadedPolylines[jsonData.id] = entity;
        } catch (error) {
            console.error(error);
        }
    }

    function deletePolylineById() {
        const deleteId = parseInt(document.getElementById('deleteId').value);
        if (isNaN(deleteId)) return;

        // 선 삭제
        const entity = viewer.entities.getById(`polyline_${deleteId}`);
        if (entity) viewer.entities.remove(entity);

        // 모델 삭제
        const modelEntity = viewer.entities.getById(`model_${deleteId}`);
        if (modelEntity) viewer.entities.remove(modelEntity);

        if (activeShapes[deleteId]) delete activeShapes[deleteId];
        if (loadedPolylines[deleteId]) delete loadedPolylines[deleteId];

        viewer.entities.values
            .filter(e => e.id && e.id.startsWith(`point_${deleteId}_`))
            .forEach(e => viewer.entities.remove(e));

        showNotification(`식별 ID #${deleteId} 영구 제거 완료`, 'success');
        updateRouteListbox(); 
    }

    function getTerrainPosition(screenPosition) {
        const ray = viewer.camera.getPickRay(screenPosition);
        return viewer.scene.globe.pick(ray, viewer.scene);
    }

    function createPoint(position) {
        return viewer.entities.add({
            id: `point_${polylineId}_${activeShapes[polylineId].length}`,
            position: position,
            point: { pixelSize: 8, color: Cesium.Color.RED }
        });
    }

    function updatePreview() {
        if (activeShape) viewer.entities.remove(activeShape);
        if (!floatingPoint || !activeShapes[polylineId]) return;
        
        activeShape = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => 
                    [...activeShapes[polylineId], floatingPoint.position.getValue()], 
                    false
                ),
                width: getLineWidth(),
                material: getLineColor(),
                clampToGround: false
            }
        });
    }

    function cleanupDrawing() {
        if (currentHandler) {
            currentHandler.destroy();
            currentHandler = null;
        }
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        resetState();
    }

    function resetState() {
        if (activeShape) viewer.entities.remove(activeShape);
        if (floatingPoint) viewer.entities.remove(floatingPoint);
        activeShape = floatingPoint = null;
    }

    function clearAll() {
        for (const id in activeShapes) {
            const entity = viewer.entities.getById(`polyline_${id}`);
            if (entity) viewer.entities.remove(entity);
            const modelEntity = viewer.entities.getById(`model_${id}`);
            if (modelEntity) viewer.entities.remove(modelEntity);
        }
        for (const id in loadedPolylines) {
            const entity = loadedPolylines[id];
            if (entity) viewer.entities.remove(entity);
        }
        modelEntitys.forEach(entity => viewer.entities.remove(entity));
        
        viewer.entities.values
            .filter(e => e.id && (e.id.startsWith('point_') || e.id.startsWith('polyline_') || e.id.startsWith('model_')))
            .forEach(e => viewer.entities.remove(e));
    
        activeShapes = {};
        loadedPolylines = {};
        modelEntitys = [];
        showNotification('모든 데이터를 초기화했습니다.', 'success');
        updateRouteListbox(); 
    }

    function showNotification(message, type) {
        const el = document.getElementById('notification');
        if (!el) return;
        el.textContent = message;
        el.style.backgroundColor = type === 'success' ? 'rgba(46, 125, 50, 0.85)' : 'rgba(184, 43, 43, 0.85)';
        el.style.color = '#fff';
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    function cartesianToGeo(position) {
        const carto = Cesium.Cartographic.fromCartesian(position);
        return {
            longitude: Cesium.Math.toDegrees(carto.longitude),
            latitude: Cesium.Math.toDegrees(carto.latitude),
            height: carto.height
        };
    }

    function getSavedColor(id) {
        const entity = viewer.entities.getById(`polyline_${id}`);
        return entity?.polyline?.material?.color?.toString();
    }

    function getSavedWidth(id) {
        const entity = viewer.entities.getById(`polyline_${id}`);
        return entity?.polyline?.width?.getValue();
    }

    function getLineColor() {
        return Cesium.Color.fromCssColorString(document.getElementById('lineColor').value);
    }

    function getLineWidth() {
        return parseInt(document.getElementById('lineWidth').value);
    }

    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function makeElementDraggable(el) {
        let isDragging = false;
        let offset = [0, 0];
        const header = document.getElementById('airpathHeader');

        header.addEventListener('mousedown', e => {
            if(e.target.id === 'closeBtn') return;
            isDragging = true;
            offset = [e.offsetX, e.offsetY];
            e.preventDefault();
        });

        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            el.style.left = `${e.clientX - offset[0]}px`;
            el.style.top = `${e.clientY - offset[1]}px`;
        });
    }

    init();

    return {
        saveCurrent: saveCurrentPolyline,
        loadFromJSON: loadDataFromJSON,
        deleteById: deletePolylineById,
        saveAll: saveAllPolylines,
        createInfoBox: createInfoBox, 
        toggleInfoBox: function() {
            const box = document.getElementById('airpathinfoBox');
            if (box) {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? 'block' : 'none';
                if (isHidden) updateRouteListbox(); 
            }
        }
    };
})();

/*
window.airpath = (function () {
    const viewer = window.CesiumViewer;
    let activeShapes = {};
    let floatingPoint = null;
    let polylineId = 0;
    let activeShape = null;
    let currentHandler = null;
    let loadedPolylines = {};
    let modelEntitys = [];
    let modelVisible = true;
    let splinesVisible = true;

    function init() {
        //animateAllModels(); 
    }

    function createInfoBox() {
        const airpathinfoBox = document.createElement('div');
        airpathinfoBox.id = 'airpathinfoBox';
        airpathinfoBox.style.cssText = `
            position: absolute; top: 150px; left: 10px; background-color: rgba(255, 255, 255, 0.9);
            padding: 10px; border-radius: 10px; z-index: 100; box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.3);
            border: 1px solid #ccc;
        `;

        airpathinfoBox.innerHTML = `
            <div>
                <label for="polylineId">ID:</label>
                <input type="number" id="polyId" value="1">
                <div>
                    <label for="pointAltitude">비행고도:</label>
                    <input type="number" id="pointAltitude" step="1" value="100">
                </div>
                <div>
                    <label for="color">색상:</label>
                    <input type="color" id="lineColor" value="#0000ff">
                </div>
                <div>
                    <label for="linewidth">두께:</label>
                    <input type="number" id="lineWidth" value="5" min="1">
                </div>
                <div>
                    <button id="drawBtn">그리기 시작</button>
                    <button id="saveBtn">현재 저장</button>
                    <button id="saveAllBtn">전체 저장</button>
                    <button id="loadBtn">불러오기</button>
                    <input type="file" id="fileInput" accept=".json" style="display: none;">
                </div>
                <div>
                    <input type="number" id="deleteId" placeholder="삭제할 ID">
                    <button id="deleteBtn">삭제</button>
                    <button id="clearBtn">전체 삭제</button>
                    <button id="toggleModelBtn">모델 보이기/숨기기</button>
                    <button id="toggleSplinesBtn">스플라인 보이기/숨기기</button>
                    <button id="closeBtn">닫기</button>
                    <button id="animateBtn">모델 애니메이션</button>
                </div>
                <div id="notification"></div>
            </div>
        `;
        document.body.appendChild(airpathinfoBox);
        makeElementDraggable(airpathinfoBox);
        setupEventListeners();
    }

    function setupEventListeners() {
        document.getElementById('drawBtn').addEventListener('click', startDrawing);
        document.getElementById('saveBtn').addEventListener('click', saveCurrentPolyline);
        document.getElementById('saveAllBtn').addEventListener('click', saveAllPolylines);
        document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('deleteBtn').addEventListener('click', deletePolylineById);
        document.getElementById('clearBtn').addEventListener('click', clearAll);
        document.getElementById('closeBtn').addEventListener('click', () => document.getElementById('airpathinfoBox').remove());
        document.getElementById('fileInput').addEventListener('change', handleFileUpload);
        //document.getElementById('animateBtn').addEventListener('click', () => animateModel(parseInt(document.getElementById('polyId').value)));
        //document.getElementById('animateBtn').addEventListener('click', () => animateAllModels());
        document.getElementById('toggleModelBtn').addEventListener('click', toggleModelVisibility);
        document.getElementById('toggleSplinesBtn').addEventListener('click', toggleSplinesVisibility);
    }



    function toggleModelVisibility() {
        modelVisible = !modelVisible;
        modelEntitys.forEach(entity => {
            entity.show = modelVisible;
        });
    }

    function toggleSplinesVisibility() {
        splinesVisible = !splinesVisible;
        Object.values(loadedPolylines).forEach(entity => {
            entity.show = splinesVisible;
        });
    }

    function startDrawing() {
        resetState();
        polylineId = parseInt(document.getElementById('polyId').value) || 0;
        activeShapes[polylineId] = [];
        
        currentHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        viewer.scene.screenSpaceCameraController.enableInputs = false;

        currentHandler.setInputAction(handleLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        currentHandler.setInputAction(handleRightClick, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        currentHandler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    function handleLeftClick(event) {
        const position = getTerrainPosition(event.position);
        if (!position) return;

        const altitude = parseFloat(document.getElementById('pointAltitude').value);
        if (!altitude || isNaN(altitude)) {
            //showNotification('유효한 고도를 입력하세요', 'error');
            return;
        }

        const cartoPosition = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);
        const adjustedPosition = Cesium.Cartesian3.fromRadians(
            cartoPosition.longitude,
            cartoPosition.latitude,
            altitude
        );

        activeShapes[polylineId].push(adjustedPosition.clone());

        if (activeShapes[polylineId].length === 1) {
            floatingPoint = createPoint(adjustedPosition);
        }
        updatePreview();
    }

    function handleRightClick() {
        if (activeShapes[polylineId]?.length > 1) {
            applySplineToPolyline(activeShapes[polylineId]);
            //showNotification(`폴리라인 #${polylineId} 생성 완료`, 'success');
        }
        cleanupDrawing();
    }

    function handleMouseMove(event) {
        if (!floatingPoint || activeShapes[polylineId].length < 1) return;
        const position = getTerrainPosition(event.endPosition);
        if (position) floatingPoint.position.setValue(position);
        updatePreview();
    }

    function applySplineToPolyline(positions) {
        const spline = new Cesium.CatmullRomSpline({
            times: positions.map((_, index) => index),
            points: positions
        });

        const splinePositions = [];
        for (let t = 0; t < positions.length - 1; t += 0.01) {
            splinePositions.push(spline.evaluate(t));
        }

        viewer.entities.add({
            id: `polyline_${polylineId}`,
            polyline: {
                positions: splinePositions,
                width: getLineWidth(),
                material: getLineColor(),
                clampToGround: true
            }
        });
    }


    function animateAllModels() {
        const allPolylineIds = Object.keys(activeShapes);
    
        if (allPolylineIds.length === 0) {
            //showNotification('애니메이션을 위한 데이터가 없습니다', 'error');
            return;
        }
    
        allPolylineIds.forEach(polylineId => {
            const entity = viewer.entities.getById(`polyline_${polylineId}`);
            if (!entity) {
                return;  // 해당 폴리라인이 존재하지 않으면 건너뜁니다.
            }
    
            const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
            if (!positions || positions.length < 2) {
                return; // 충분한 포인트가 없으면 건너뜁니다.
            }
    
            let currentIndex = 0;
            const interval = 100; // 100 milliseconds
            const totalPositions = positions.length;
    
            // 위치 구현
            const positionProperty = new Cesium.SampledPositionProperty();
    
            positions.forEach((position, index) => {
                const time = Cesium.JulianDate.addSeconds(Cesium.JulianDate.now(), index, new Cesium.JulianDate());
                positionProperty.addSample(time, position);
            });
    
            // 기본 방향 설정 및 조정
            const baseOrientation = new Cesium.VelocityOrientationProperty(positionProperty);
    
            const adjustedOrientationProperty = new Cesium.CallbackProperty((time, result) => {
                const baseOrientationQuaternion = baseOrientation.getValue(time, result);
                if (!baseOrientationQuaternion) {
                    return Cesium.Quaternion.IDENTITY;
                }
                const headingOffset = Cesium.Math.toRadians(0);
                const rotationQuaternion = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, headingOffset);
    
                return Cesium.Quaternion.multiply(baseOrientationQuaternion, rotationQuaternion, result);
            }, false);
    
            // 엔티티 생성
             const newmodelEntity = viewer.entities.add({
                position: new Cesium.CallbackProperty(() => {
                    return positions[currentIndex];
                }, false),
                orientation: adjustedOrientationProperty,  // 변경된 방향 사용
                model: {
                    uri: '/object/Cesium_Air.glb',
                    scale: 200,
                    minimumPixelSize: 64,
                    maximumScale: 200,
                    silhouetteColor: Cesium.Color.WHITE,
                    silhouetteSize: 1
                },
            });

            modelEntitys.push(newmodelEntity);
    
            // 모델의 위치를 주기적으로 업데이트
            setInterval(() => {
                currentIndex = (currentIndex + 1) % totalPositions; // 무한 루프로 계속 움직이도록
            }, interval);
        });
    }

    /*
    function animateModel(polylineId) {
        const entity = viewer.entities.getById(`polyline_${polylineId}`);
        if (!entity) {
            //showNotification('잘못된 폴리라인 ID입니다', 'error');
            return;
        }
    
        const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
        if (!positions || positions.length < 2) {
            //showNotification('애니메이션을 위한 데이터 포인트가 충분하지 않습니다', 'error');
            return;
        }
    
        const positionProperty = new Cesium.SampledPositionProperty();
        const startTime = Cesium.JulianDate.now();
        const totalDurationSeconds = 60; // Total duration for the animation
    
        positions.forEach((position, index) => {
            const time = Cesium.JulianDate.addSeconds(startTime, (totalDurationSeconds / positions.length) * index, new Cesium.JulianDate());
            positionProperty.addSample(time, position);
        });
    
        const orientationProperty = new Cesium.VelocityOrientationProperty(positionProperty);
    
        if (modelEntity) {
            viewer.entities.remove(modelEntity);
        }
    
        modelEntity = viewer.entities.add({
            position: positionProperty,
            orientation: orientationProperty,
            model: {
                uri: '/object/Cesium_Air.glb',
                scale: 200,
                minimumPixelSize: 64,
                maximumScale: 200,
                silhouetteColor: Cesium.Color.WHITE,
                silhouetteSize: 1
            }
        });
    
        // Update the viewer clock settings to encompass the animation timerange
        viewer.clock.startTime = startTime.clone();
        viewer.clock.stopTime = Cesium.JulianDate.addSeconds(startTime, totalDurationSeconds, new Cesium.JulianDate());
        viewer.clock.currentTime = startTime.clone();
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
    }
    

    allPolylineIds.forEach((polylineId) => {
        const entity = viewer.entities.getById(`polyline_${polylineId}`);
        if (!entity) return;
    
        const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
        if (!positions || positions.length < 2) return;
    
        let currentIndex = 0;
        const interval = 10;
        const totalDurationMilliseconds = 60000; 
        const steps = totalDurationMilliseconds / interval;
        const stepDistance = positions.length / steps;
    
        const modelEntity = viewer.entities.add({
            position: new Cesium.CallbackProperty(() => {
                const index = Math.floor(currentIndex * stepDistance);
                console.log('Current Position Index:', index); // 디버그 로그 추가
                return positions[Math.min(index, positions.length - 1)];
            }, false),
            orientation: new Cesium.CallbackProperty(() => {
                const nextIndex = Math.min(Math.floor((currentIndex + 1) * stepDistance), positions.length - 1);
                if (positions[currentIndex] && positions[nextIndex]) {
                    const direction = Cesium.Cartesian3.normalize(
                        Cesium.Cartesian3.subtract(
                            positions[nextIndex],
                            positions[Math.min(currentIndex, positions.length - 1)],
                            new Cesium.Cartesian3()
                        ),
                        new Cesium.Cartesian3()
                    );
                    const up = new Cesium.Cartesian3(0, 0, 1);
                    return Cesium.Transforms.headingPitchRollQuaternion(direction, up, 0);
                }
                return new Cesium.Quaternion(); // 기본 Orientation 반환
            }, false),
            model: {
                uri: '/object/Cesium_Air.glb', 
                scale: 200,
                minimumPixelSize: 64,
                maximumScale: 200,
                silhouetteColor: Cesium.Color.WHITE,
                silhouetteSize: 1,
            },
        });
    
        const intervalId = setInterval(() => {
            currentIndex++;
            if (currentIndex >= steps) {
                currentIndex = 0; 
            }
        }, interval);
    });
   
    start 주석  ****************************
    function animateAllModels() {
        const allPolylineIds = Object.keys(activeShapes);
    
        if (allPolylineIds.length === 0) {
            //showNotification('애니메이션을 위한 데이터가 없습니다', 'error');
            return;
        }
    
        allPolylineIds.forEach(polylineId => {
            const entity = viewer.entities.getById(`polyline_${polylineId}`);
            if (!entity) {
                return;  // Skip if the polyline doesn't exist
            }
    
            const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
            if (!positions || positions.length < 2) {
                return; // Skip if there aren't enough points for animation
            }
    
            // Generate a unique property for each model
            const positionProperty = new Cesium.SampledPositionProperty();
            const startTime = Cesium.JulianDate.now();
            const totalDurationSeconds = 60; // Duration for each animation
    
            positions.forEach((position, index) => {
                const time = Cesium.JulianDate.addSeconds(startTime, (totalDurationSeconds / positions.length) * index, new Cesium.JulianDate());
                positionProperty.addSample(time, position);
            });
    
            const orientationProperty = new Cesium.VelocityOrientationProperty(positionProperty);
    
            viewer.entities.add({
                position: positionProperty,
                orientation: orientationProperty,
                model: {
                    uri: '/object/Cesium_Air.glb', // Ensure this path is correct
                    scale: 200,
                    minimumPixelSize: 64,
                    maximumScale: 200,
                    silhouetteColor: Cesium.Color.WHITE,
                    silhouetteSize: 1
                },
            });

            // const stopTime = Cesium.JulianDate.addSeconds(startTime, totalDurationSeconds, new Cesium.JulianDate());
            // ClockManager.setClock(startTime, stopTime, 1);
    
            // This ensures each model's motion is independent and looping
            viewer.clock.startTime = startTime.clone();
            viewer.clock.stopTime = Cesium.JulianDate.addSeconds(startTime, totalDurationSeconds, new Cesium.JulianDate());
            viewer.clock.currentTime = startTime.clone();
            viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
            
        });
    
        // Enable the animation
         viewer.clock.shouldAnimate = true;
    }
    ******************************** end  주석
    
    function saveCurrentPolyline() {
        const id = parseInt(document.getElementById('polyId').value);
        if (!activeShapes[id]?.length) {
            //showNotification('저장할 데이터 없음', 'error');
            return;
        }

        const data = {
            id: id,
            color: document.getElementById('lineColor').value,
            width: getLineWidth(),
            coordinates: activeShapes[id].map(cartesianToGeo)
        };

        downloadJSON(data, `polyline_${id}.json`);
        //showNotification('파일 저장 완료!', 'success');
    }

    function saveAllPolylines() {
        if (Object.keys(activeShapes).length === 0) {
            //showNotification('저장할 데이터가 없습니다', 'error');
            return;
        }

        const allData = {
            version: "1.0",
            created: new Date().toISOString(),
            polylines: Object.entries(activeShapes).map(([id, positions]) => ({
                id: parseInt(id),
                color: getSavedColor(id) || '#0000ff',
                width: getSavedWidth(id) || 5,
                coordinates: positions.map(cartesianToGeo)
            }))
        };

        downloadJSON(allData, `all_polylines_${new Date().toISOString().slice(0,10)}.json`);
        //showNotification('전체 저장 완료!', 'success');
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const jsonData = JSON.parse(e.target.result);
                loadDataFromJSON(jsonData);
                //alert('파일 불러오기 성공!');
            } catch (error) {
                //alert('잘못된 파일 형식');
                console.error('파일 파싱 오류:', error);
            }
        };
        reader.readAsText(file);
    }

    function loadDataFromJSON(data) {
        if (!Array.isArray(data.polylines)) {
            throw new Error("폴리라인 데이터가 필요합니다.");
        }

        data.polylines.forEach(loadPolylineFromJSON);
        animateAllModels();
    }

    function loadPolylineFromJSON(jsonData) {
        try {
            console.log(`Loading polyline with ID: ${jsonData.id}`);
    
            const existingEntity = viewer.entities.getById(`polyline_${jsonData.id}`);
            if (existingEntity) {
                viewer.entities.remove(existingEntity);
            }
            
            const positions = jsonData.coordinates.map(coord =>
                Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
            );
    
            // ID를 사용해서 이전에 사용했던 applySplineToPolyline를 건너뜀
            const spline = new Cesium.CatmullRomSpline({
                times: positions.map((_, index) => index),
                points: positions
            });

            const splinePositions = [];
            for (let t = 0; t < positions.length - 1; t += 0.01) {
                splinePositions.push(spline.evaluate(t));
            }

            const entity = viewer.entities.add({
                id: `polyline_${jsonData.id}`,
                polyline: {
                    positions: splinePositions,
                    width: jsonData.width || 5,
                    material: Cesium.Color.fromCssColorString(jsonData.color || '#0000FF'),
                   // clampToGround: true
                }
            });
    
            //applySplineToPolyline(positions);
            //animateModel(jsonData.id);
            //animateAllModels();

            activeShapes[jsonData.id] = splinePositions;
            loadedPolylines[jsonData.id] = entity;
            console.log(`Loaded polyline:`, loadedPolylines[jsonData.id]);
        } catch (error) {
            console.error(`Failed to load polyline with ID ${jsonData.id}:`, error);
        }
    }

    function deletePolylineById() {
        const deleteId = parseInt(document.getElementById('deleteId').value);
        if (isNaN(deleteId)) {
            //showNotification('유효한 ID를 입력하세요', 'error');
            return;
        }

        const entity = viewer.entities.getById(`polyline_${deleteId}`);
        if (entity) {
            viewer.entities.remove(entity);
        }

        if (activeShapes[deleteId]) {
            delete activeShapes[deleteId];
        }

        viewer.entities.values
            .filter(e => e.id && e.id.startsWith(`point_${deleteId}_`))
            .forEach(e => viewer.entities.remove(e));

        //showNotification(`폴리라인 #${deleteId} 삭제 완료`, 'success');
    }

    function getTerrainPosition(screenPosition) {
        const ray = viewer.camera.getPickRay(screenPosition);
        return viewer.scene.globe.pick(ray, viewer.scene);
    }

    function createPoint(position) {
        return viewer.entities.add({
            id: `point_${polylineId}_${activeShapes[polylineId].length}`,
            position: position,
            point: { pixelSize: 8, color: Cesium.Color.RED }
        });
    }

    function updatePreview() {
        if (activeShape) viewer.entities.remove(activeShape);
        activeShape = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => 
                    [...activeShapes[polylineId], floatingPoint.position.getValue()], 
                    false
                ),
                width: getLineWidth(),
                material: getLineColor(),
                clampToGround: true
            }
        });
    }

    function cleanupDrawing() {
        if (currentHandler) {
            currentHandler.destroy();
            currentHandler = null;
        }
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        resetState();
    }

    function resetState() {
        if (activeShape) viewer.entities.remove(activeShape);
        if (floatingPoint) viewer.entities.remove(floatingPoint);
        activeShape = floatingPoint = null;
    }

    function clearAll() {
        for (const id in activeShapes) {
            const entity = viewer.entities.getById(`polyline_${id}`);
            if (entity) {
                viewer.entities.remove(entity);
            }
        }
    
        for (const id in loadedPolylines) {
            const entity = loadedPolylines[id];
            if (entity) {
                viewer.entities.remove(entity);
            }
        }
    
        viewer.entities.values
            .filter(e => e.id && e.id.startsWith('point_'))
            .forEach(e => viewer.entities.remove(e));
    
        activeShapes = {};
        loadedPolylines = {};
        //alert('모든 폴리라인 삭제 완료');
    }

    function closeInfoBox() {
        const airpathinfoBox = document.getElementById('airpathinfoBox');
        if (airpathinfoBox) airpathinfoBox.remove();
    }

    function showNotification(message, type) {
        const el = document.getElementById('notification');
        el.textContent = message;
        el.className = type;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    function cartesianToGeo(position) {
        const carto = Cesium.Cartographic.fromCartesian(position);
        return {
            longitude: Cesium.Math.toDegrees(carto.longitude),
            latitude: Cesium.Math.toDegrees(carto.latitude),
            height: carto.height
        };
    }

    function getSavedColor(id) {
        const entity = viewer.entities.getById(`polyline_${id}`);
        return entity?.polyline?.material?.color?.toString();
    }

    function getSavedWidth(id) {
        const entity = viewer.entities.getById(`polyline_${id}`);
        return entity?.polyline?.width?.getValue();
    }

    function getLineColor() {
        return Cesium.Color.fromCssColorString(document.getElementById('lineColor').value);
    }

    function getLineWidth() {
        return parseInt(document.getElementById('lineWidth').value);
    }

    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function makeElementDraggable(el) {
        let isDragging = false;
        let offset = [0, 0];

        el.firstElementChild.addEventListener('mousedown', e => {
            isDragging = true;
            offset = [e.offsetX, e.offsetY];
        });

        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            el.style.left = `${e.clientX - offset[0]}px`;
            el.style.top = `${e.clientY - offset[1]}px`;
        });
    }

    init();

    return {
        saveCurrent: saveCurrentPolyline,
        loadFromJSON: loadDataFromJSON,
        deleteById: deletePolylineById,
        saveAll: saveAllPolylines,
        createInfoBox
    };
})();
*/

/*
window.airpath = (function () {
    const viewer = window.CesiumViewer;
    let activeShapes = {};
    let floatingPoint = null;
    let polylineId = 0;
    let activeShape = null;
    let currentHandler = null;
    let loadedPolylines = {};

    function init() {

    }

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
                <div>
                    <label for="polylineId">ID:</label>
                    <input type="number" id="polyId" value="1">
                </div>
                <div>
                    <label for="pointAltitude">비행고도:</label>
                    <input type="number" id="pointAltitude" step="1" value="100">
                </div>
                <div>
                    <label for="color">색상:</label>
                    <input type="color" id="lineColor" value="#0000ff">
                </div>
                <div>
                    <label for="linewidth">두께:</label>
                    <input type="number" id="lineWidth" value="5" min="1">
                </div>
                <div>
                    <button id="drawBtn">그리기 시작</button>
                    <button id="saveBtn">현재 저장</button>
                    <button id="saveAllBtn">전체 저장</button>
                    <button id="loadBtn">불러오기</button>
                    <input type="file" id="fileInput" accept=".json" style="display: none;">
                </div>
                <div>
                    <input type="number" id="deleteId" placeholder="삭제할 ID">
                    <button id="deleteBtn">삭제</button>
                    <button id="clearBtn">전체 삭제</button>
                    <button id="closeBtn">닫기</button>
                </div>
                <div id="notification"></div>
            </div>
        `;
        document.body.appendChild(infoBox);
        makeElementDraggable(infoBox);

        setupEventListeners();
    }

    function setupEventListeners() {
        document.getElementById('drawBtn').addEventListener('click', startDrawing);
        document.getElementById('saveBtn').addEventListener('click', saveCurrentPolyline);
        document.getElementById('saveAllBtn').addEventListener('click', saveAllPolylines);
        document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('deleteBtn').addEventListener('click', deletePolylineById);
        document.getElementById('clearBtn').addEventListener('click', clearAll);
        document.getElementById('closeBtn').addEventListener('click', () => document.getElementById('infoBox').remove());
        document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    }

    function startDrawing() {
        resetState();
        polylineId = parseInt(document.getElementById('polyId').value) || 0;
        activeShapes[polylineId] = [];
        
        currentHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        viewer.scene.screenSpaceCameraController.enableInputs = false;

        currentHandler.setInputAction(handleLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        currentHandler.setInputAction(handleRightClick, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        currentHandler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    function handleLeftClick(event) {
        const position = getTerrainPosition(event.position);
        if (!position) return;

        const altitude = parseFloat(document.getElementById('pointAltitude').value);
        if (!altitude || isNaN(altitude)) {
            showNotification('유효한 고도를 입력하세요', 'error');
            return;
        }

        const cartoPosition = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);
        const adjustedPosition = Cesium.Cartesian3.fromRadians(
            cartoPosition.longitude,
            cartoPosition.latitude,
            altitude
        );

        activeShapes[polylineId].push(adjustedPosition.clone());

        if (activeShapes[polylineId].length === 1) {
            floatingPoint = createPoint(adjustedPosition);
        }
        updatePreview();
    }

    function handleRightClick() {
        if (activeShapes[polylineId]?.length > 1) {
            applySplineToPolyline(activeShapes[polylineId]);
            showNotification(`폴리라인 #${polylineId} 생성 완료`, 'success');
        }
        cleanupDrawing();
    }

    function handleMouseMove(event) {
        if (!floatingPoint || activeShapes[polylineId].length < 1) return;
        const position = getTerrainPosition(event.endPosition);
        if (position) floatingPoint.position.setValue(position);
        updatePreview();
    }

    function applySplineToPolyline(positions) {
        const spline = new Cesium.CatmullRomSpline({
            times: positions.map((_, index) => index),
            points: positions
        });

        const splinePositions = [];
        for (let t = 0; t < positions.length - 1; t += 0.01) {
            splinePositions.push(spline.evaluate(t));
        }

        viewer.entities.add({
            id: `polyline_${polylineId}`,
            polyline: {
                positions: splinePositions,
                width: getLineWidth(),
                material: getLineColor(),
                clampToGround: true
            }
        });
    }

    function saveCurrentPolyline() {
        const id = parseInt(document.getElementById('polyId').value);
        if (!activeShapes[id]?.length) {
            showNotification('저장할 데이터 없음', 'error');
            return;
        }

        const data = {
            id: id,
            color: document.getElementById('lineColor').value,
            width: getLineWidth(),
            coordinates: activeShapes[id].map(cartesianToGeo)
        };

        downloadJSON(data, `polyline_${id}.json`);
        showNotification('파일 저장 완료!', 'success');
    }

    function saveAllPolylines() {
        if (Object.keys(activeShapes).length === 0) {
            showNotification('저장할 데이터가 없습니다', 'error');
            return;
        }

        const allData = {
            version: "1.0",
            created: new Date().toISOString(),
            polylines: Object.entries(activeShapes).map(([id, positions]) => ({
                id: parseInt(id),
                color: getSavedColor(id) || '#0000ff',
                width: getSavedWidth(id) || 5,
                coordinates: positions.map(cartesianToGeo)
            }))
        };

        downloadJSON(allData, `all_polylines_${new Date().toISOString().slice(0,10)}.json`);
        showNotification('전체 저장 완료!', 'success');
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const jsonData = JSON.parse(e.target.result);
                loadDataFromJSON(jsonData);
                alert('파일 불러오기 성공!');
            } catch (error) {
                alert('잘못된 파일 형식');
                console.error('파일 파싱 오류:', error);
            }
        };
        reader.readAsText(file);
    }

    function loadDataFromJSON(data) {
        if (!Array.isArray(data.polylines)) {
            throw new Error("폴리라인 데이터가 필요합니다.");
        }

        data.polylines.forEach(loadPolylineFromJSON);
    }

    function loadPolylineFromJSON(jsonData) {
        try {
            console.log(`Loading polyline with ID: ${jsonData.id}`);
    
            const existingEntity = viewer.entities.getById(`polyline_${jsonData.id}`);
            if (existingEntity) {
                viewer.entities.remove(existingEntity);
            }
            
            const positions = jsonData.coordinates.map(coord =>
                Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
            );
    
            const entity = viewer.entities.add({
                id: `polyline_${jsonData.id}`,
                polyline: {
                    positions: positions,
                    width: jsonData.width || 5,
                    material: Cesium.Color.fromCssColorString(jsonData.color || '#0000FF'),
                   // clampToGround: true
                }
            });
    
            loadedPolylines[jsonData.id] = entity;
            console.log(`Loaded polyline:`, loadedPolylines[jsonData.id]);
        } catch (error) {
            console.error(`Failed to load polyline with ID ${jsonData.id}:`, error);
        }
    }

    // function loadPolylineFromJSON(jsonData) {
    //     try {
    //         console.log(`Loading polyline with ID: ${jsonData.id}`);
            
    //         // Remove existing polyline with the same ID if it exists
    //         const existingEntity = viewer.entities.getById(`polyline_${jsonData.id}`);
    //         if (existingEntity) {
    //             viewer.entities.remove(existingEntity);
    //         }
            
    //         const positions = jsonData.coordinates.map(coord =>
    //             Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
    //         );
    
    //         applySplineToPolyline(positions);
    
    //         // Use the correct ID from JSON
    //         loadedPolylines[jsonData.id] = viewer.entities.getById(`polyline_${jsonData.id}`);
    //         console.log(`Loaded polyline:`, loadedPolylines[jsonData.id]);
    //     } catch (error) {
    //         console.error(`Failed to load polyline with ID ${jsonData.id}:`, error);
    //     }
    // }

    // function loadPolylineFromJSON(jsonData) {
    //     try {
    //         console.log(`Loading polyline with ID: ${jsonData.id}`);
    //         const positions = jsonData.coordinates.map(coord =>
    //             Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
    //         );
    
    //         applySplineToPolyline(positions);
    //         loadedPolylines[jsonData.id] = viewer.entities.getById(`polyline_${jsonData.id}`);
    //         console.log(`Loaded polyline:`, loadedPolylines[jsonData.id]);
    //     } catch (error) {
    //         console.error(`Failed to load polyline with ID ${jsonData.id}:`, error);
    //     }
    // }

    // function loadPolylineFromJSON(jsonData) {
    //     const positions = jsonData.coordinates.map(coord =>
    //         Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
    //     );

    //     const color = Cesium.Color.fromCssColorString(jsonData.color);
        
    //     // Apply spline to loaded positions
    //     applySplineToPolyline(positions);

    //     loadedPolylines[jsonData.id] = viewer.entities.getById(`polyline_${jsonData.id}`);
    // }

    function deletePolylineById() {
        const deleteId = parseInt(document.getElementById('deleteId').value);
        if (isNaN(deleteId)) {
            showNotification('유효한 ID를 입력하세요', 'error');
            return;
        }

        const entity = viewer.entities.getById(`polyline_${deleteId}`);
        if (entity) {
            viewer.entities.remove(entity);
        }

        if (activeShapes[deleteId]) {
            delete activeShapes[deleteId];
        }

        viewer.entities.values
            .filter(e => e.id && e.id.startsWith(`point_${deleteId}_`))
            .forEach(e => viewer.entities.remove(e));

        showNotification(`폴리라인 #${deleteId} 삭제 완료`, 'success');
    }

    function getTerrainPosition(screenPosition) {
        const ray = viewer.camera.getPickRay(screenPosition);
        return viewer.scene.globe.pick(ray, viewer.scene);
    }

    function createPoint(position) {
        return viewer.entities.add({
            id: `point_${polylineId}_${activeShapes[polylineId].length}`,
            position: position,
            point: { pixelSize: 8, color: Cesium.Color.RED }
        });
    }

    function updatePreview() {
        if (activeShape) viewer.entities.remove(activeShape);
        activeShape = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => 
                    [...activeShapes[polylineId], floatingPoint.position.getValue()], 
                    false
                ),
                width: getLineWidth(),
                material: getLineColor(),
                clampToGround: true
            }
        });
    }

    function cleanupDrawing() {
        if (currentHandler) {
            currentHandler.destroy();
            currentHandler = null;
        }
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        resetState();
    }

    function resetState() {
        if (activeShape) viewer.entities.remove(activeShape);
        if (floatingPoint) viewer.entities.remove(floatingPoint);
        activeShape = floatingPoint = null;
    }

    function clearAll() {
        // activeShapes에 있는 모든 폴리라인을 삭제
        for (const id in activeShapes) {
            const entity = viewer.entities.getById(`polyline_${id}`);
            if (entity) {
                viewer.entities.remove(entity);
            }
        }
    
        // loadedPolylines에 있는 모든 폴리라인을 삭제
        for (const id in loadedPolylines) {
            const entity = loadedPolylines[id];
            if (entity) {
                viewer.entities.remove(entity);
            }
        }
    
        // 엔티티의 포인트들도 삭제
        viewer.entities.values
            .filter(e => e.id && e.id.startsWith('point_'))
            .forEach(e => viewer.entities.remove(e));
    
        // 모든 데이터 구조 초기화
        activeShapes = {};
        loadedPolylines = {};
        alert('모든 폴리라인 삭제 완료');
    }

    function closeInfoBox() {
        const infoBox = document.getElementById('infoBox');
        if (infoBox) infoBox.remove();
    }

    function showNotification(message, type) {
        const el = document.getElementById('notification');
        el.textContent = message;
        el.className = type;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    function cartesianToGeo(position) {
        const carto = Cesium.Cartographic.fromCartesian(position);
        return {
            longitude: Cesium.Math.toDegrees(carto.longitude),
            latitude: Cesium.Math.toDegrees(carto.latitude),
            height: carto.height
        };
    }

    function getSavedColor(id) {
        const entity = viewer.entities.getById(`polyline_${id}`);
        return entity?.polyline?.material?.color?.toString();
    }

    function getSavedWidth(id) {
        const entity = viewer.entities.getById(`polyline_${id}`);
        return entity?.polyline?.width?.getValue();
    }

    function getLineColor() {
        return Cesium.Color.fromCssColorString(document.getElementById('lineColor').value);
    }

    function getLineWidth() {
        return parseInt(document.getElementById('lineWidth').value);
    }

    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function makeElementDraggable(el) {
        let isDragging = false;
        let offset = [0, 0];

        el.firstElementChild.addEventListener('mousedown', e => {
            isDragging = true;
            offset = [e.offsetX, e.offsetY];
        });

        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            el.style.left = `${e.clientX - offset[0]}px`;
            el.style.top = `${e.clientY - offset[1]}px`;
        });
    }

    init();

    return {
        saveCurrent: saveCurrentPolyline,
        loadFromJSON: loadDataFromJSON,
        deleteById: deletePolylineById,
        saveAll: saveAllPolylines,
        createInfoBox
    };
})();
*/