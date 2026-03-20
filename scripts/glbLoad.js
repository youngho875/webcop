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
    /*
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
    */
    
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