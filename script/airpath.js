window.airpath = (function () {
    // Create Cesium Viewer
    const viewer = window.CesiumViewer;

    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;
    const polylines = []; // Store drawn polylines
    
    let airInfoBox = null; // 생성된 UI 패널 참조 보관
    let isInitialized = false; // 이벤트 핸들러 중복 등록 방지 플래그
    let handler = null; // Cesium 스크린 이벤트 핸들러

    // 🎯 [핵심] menu.js에서 버튼을 클릭할 때 실행될 패널 생성 및 초기화 함수
    function createAirPathBox() {
        // 이미 생성되어 있다면 숨겨진 패널을 보이게만 하고 리턴
        if (airInfoBox) {
            airInfoBox.style.display = 'block';
            return;
        }

        // Cesium 스크린 핸들러 안전하게 초기화
        if (viewer && viewer.scene && viewer.scene.canvas) {
            handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        }

        // 1. angleLos.js 무드의 세련된 다크 반투명 UI 패널 생성
        airInfoBox = document.createElement('div');
        airInfoBox.id = 'airInfoBox';
        airInfoBox.style.position = 'absolute';
        airInfoBox.style.top = '60px';
        airInfoBox.style.left = '20px';
        airInfoBox.style.width = '300px'; 
        airInfoBox.style.background = 'rgba(42, 42, 42, 0.95)'; 
        airInfoBox.style.padding = '15px';
        airInfoBox.style.borderRadius = '8px';
        airInfoBox.style.color = 'white';
        airInfoBox.style.fontFamily = 'sans-serif';
        airInfoBox.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        airInfoBox.style.zIndex = '1001';

        airInfoBox.innerHTML = `
            <div id="airInfoBoxHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: bold;">✈️ 비행 경로 매니저 (Airpath)</span>
                <span id="infoBoxCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 100px; font-size: 12px;">Line Width:</label>
                <input type="number" id="lineWidthInput" value="3" style="width: 150px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 100px; font-size: 12px;">Color:</label>
                <input type="color" id="colorInput" value="#ff0000" style="width: 150px; height: 26px; padding: 0; background: none; border: 1px solid #555; border-radius: 4px; cursor: pointer;">
            </div>
            
            <hr style="border: none; border-top: 1px solid #555; margin: 10px 0;">
            
            <div style="margin-bottom: 6px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 100px; font-size: 12px;">Latitude:</label>
                <input type="number" id="latitudeInput" placeholder="0.0" step="0.0001" style="width: 150px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 6px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 100px; font-size: 12px;">Longitude:</label>
                <input type="number" id="longitudeInput" placeholder="0.0" step="0.0001" style="width: 150px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 100px; font-size: 12px;">Height:</label>
                <input type="number" id="heightInput" placeholder="0.0" step="1" style="width: 150px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 6px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 100px; font-size: 12px;">Pitch:</label>
                <input type="number" id="pitchInput" placeholder="0.0" style="width: 150px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 100px; font-size: 12px;">Roll:</label>
                <input type="number" id="rollInput" placeholder="0.0" style="width: 150px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            
            <button id="addPointButton" style="width: 100%; padding: 6px; margin-bottom: 6px; background-color: #444; border: 1px solid #666; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">📍 Add Point</button>
            <button id="startDrawingButton" style="width: 100%; padding: 6px; margin-bottom: 8px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">🎨 Start Drawing</button>
            
            <div style="display: flex; gap: 6px;">
                <button id="saveButton" style="flex: 1; padding: 6px; background-color: #28a745; border: none; color: white; font-weight: bold; border-radius: 4px; font-size: 12px; cursor: pointer;">Save to JSON</button>
                <button id="loadButton" style="flex: 1; padding: 6px; background-color: #17a2b8; border: none; color: white; font-weight: bold; border-radius: 4px; font-size: 12px; cursor: pointer;">Load JSON</button>
            </div>
            <input type="file" id="loadFile" accept=".json" style="display: none;">
        `;
        document.body.appendChild(airInfoBox);

        // HTML이 완성된 시점에 드래그 기능과 이벤트를 바인딩하여 Null 에러를 원천 차단합니다.
        makeDraggable(airInfoBox);
        bindUiEvents();
    }

    // 2. angleLos.js 무드의 정밀한 드래그 이동 기능
    function makeDraggable(targetBox) {
        let offsetX, offsetY;
        const header = document.getElementById('airInfoBoxHeader');
        
        header.addEventListener('mousedown', function (e) {
            if (e.target.id === 'infoBoxCloseBtn') return;
            offsetX = e.clientX - targetBox.offsetLeft;
            offsetY = e.clientY - targetBox.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            e.preventDefault();
        });

        document.addEventListener('mouseup', function () {
            document.removeEventListener('mousemove', onMouseMove);
        });

        function onMouseMove(e) {
            targetBox.style.left = (e.clientX - offsetX) + 'px';
            targetBox.style.top = (e.clientY - offsetY) + 'px';
        }
    }

    // 3. 내부 요소 이벤트 바인딩
    function bindUiEvents() {
        if (isInitialized) return;

        document.getElementById('infoBoxCloseBtn').addEventListener('click', function() {
            if (airInfoBox) airInfoBox.style.display = 'none';
        });

        document.getElementById('addPointButton').addEventListener('click', addPoint);
        document.getElementById('startDrawingButton').addEventListener('click', startDrawing);
        document.getElementById('saveButton').addEventListener('click', save);
        document.getElementById('loadButton').addEventListener('click', function () {
            document.getElementById('loadFile').click();
        });
        document.getElementById('loadFile').addEventListener('change', fileload);

        isInitialized = true;
    }

    // --- 수동 마우스 그리기 로직 ---
    function startDrawing() {
        if (!handler) return;
        reset();

        // Left click to add a point
        handler.setInputAction(function (event) {
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(earthPosition);
                    startPolyline();
                }
                activeShapePoints.push(earthPosition);
                createPoint(earthPosition);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Mouse move to update the temporary polyline
        handler.setInputAction(function (event) {
            if (Cesium.defined(floatingPoint)) {
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    activeShapePoints.pop();
                    activeShapePoints.push(newPosition);
                    floatingPoint.position.setValue(newPosition);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Double click to finish drawing
        handler.setInputAction(function (event) {
            if (activeShapePoints.length > 1) {
                finishDrawing();
                reset();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function createPoint(worldPosition) {
        return viewer.entities.add({
            position: worldPosition,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    function startPolyline() {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);

        // [교정]: 올바른 CallbackProperty 동적 라인 드로잉 구현
        activeShape = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(function () {
                    return activeShapePoints;
                }, false),
                clampToGround: true,
                width: parseFloat(document.getElementById('lineWidthInput').value),
                material: color
            }
        });
    }

    function finishDrawing() {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);
        const lineWidth = parseFloat(document.getElementById('lineWidthInput').value);

        const polylineEntity = viewer.entities.add({
            polyline: {
                positions: activeShapePoints,
                clampToGround: true,
                width: lineWidth,
                material: color
            }
        });
        
        polylines.push({
            id: polylineEntity.id,
            coordinates: activeShapePoints.map(pos => {
                const cartographic = Cesium.Cartographic.fromCartesian(pos);
                return {
                    longitude: Cesium.Math.toDegrees(cartographic.longitude),
                    latitude: Cesium.Math.toDegrees(cartographic.latitude),
                    height: cartographic.height
                };
            }),
            color: colorValue,
            width: lineWidth
        });

        if (floatingPoint) viewer.entities.remove(floatingPoint);
        if (activeShape) viewer.entities.remove(activeShape);
    }

    function reset() {
        if (!handler) return;
        if (activeShape) {
            viewer.entities.remove(activeShape);
            activeShape = undefined;
        }
        activeShapePoints = [];
        floatingPoint = undefined;
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // 좌표 수동 입력 추가 기능
    function addPoint() {
        const latitude = parseFloat(document.getElementById('latitudeInput').value);
        const longitude = parseFloat(document.getElementById('longitudeInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(height)) {
            alert("Please enter valid numbers for latitude, longitude, and height.");
            return;
        }

        const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        activeShapePoints.push(cartesian);
        createPoint(cartesian);

        if (activeShapePoints.length === 1) {
            startPolyline();
        }
    }

    // Save polylines to JSON file
    function save() {
        const jsonStr = JSON.stringify(polylines, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "polylines.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    // Load polylines from JSON file
    function fileload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                try {
                    const loadedPolylines = JSON.parse(content);
                    // 배열 형태 혹은 단일 데이터 검증 후 그리기
                    if (Array.isArray(loadedPolylines)) {
                        loadedPolylines.forEach(loadPolyline);
                    } else if (loadedPolylines.polylines && Array.isArray(loadedPolylines.polylines)) {
                        loadedPolylines.polylines.forEach(loadPolyline);
                    } else {
                        loadPolyline(loadedPolylines);
                    }
                } catch (error) {
                    alert("Invalid JSON file");
                }
            };
            reader.readAsText(file);
        }
    }

    function loadPolyline(polylineData) {
        const color = Cesium.Color.fromCssColorString(polylineData.color || "#ff0000");
        const positions = polylineData.coordinates.map(coordinate => Cesium.Cartesian3.fromDegrees(
            coordinate.longitude, coordinate.latitude, coordinate.height
        ));

        viewer.entities.add({
            id: polylineData.id,
            polyline: {
                positions: positions,
                clampToGround: true,
                width: polylineData.width || 3,
                material: color
            }
        });
    }

    // 🎯 외부(menu.js 등) 인터페이스 반환
    return {
        createAirPathBox: createAirPathBox,
        toggleInfoBox: function() {
            if (infoBox) return;
                infoBox.style.display = (infoBox.style.display === 'none') ? 'block' : 'none';            
        }
    };
})();

/*
window.airpath = (function () {
    // Create Cesium Viewer
    const viewer = window.CesiumViewer;

    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;
    let polylines = []; // 불러온 전체 항적 데이터 저장 배열
    let currentEntities = []; // 현재 지도에 그려진 엔티티 관리 배열
    
    let infoBox = null; // 생성된 UI 패널 참조 보관
    let isInitialized = false; // 이벤트 핸들러 중복 등록 방지 플래그
    
    // Cesium 핸들러는 viewer가 정상 정의된 후에 안전하게 생성하기 위해 null로 선언
    let handler = null;

    // 🎯 [핵심] menu.js에서 버튼을 클릭할 때 비로소 실행될 패널 생성 및 초기화 함수
    function createAirPathBox() {
        // 이미 생성되어 있다면 숨겨진 패널을 보이게만 하고 리턴
        if (infoBox) {
            infoBox.style.display = 'block';
            return;
        }

        // Cesium 스크린 핸들러 초기화
        if (viewer && viewer.scene && viewer.scene.canvas) {
            handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        }

        // 1. angleLos.js 무드의 세련된 다크 UI 패널 생성
        infoBox = document.createElement('div');
        infoBox.id = 'infoBox';
        infoBox.style.position = 'absolute';
        infoBox.style.top = '60px';
        infoBox.style.left = '20px';
        infoBox.style.width = '280px'; 
        infoBox.style.background = 'rgba(42, 42, 42, 0.95)'; 
        infoBox.style.padding = '15px';
        infoBox.style.borderRadius = '8px';
        infoBox.style.color = 'white';
        infoBox.style.fontFamily = 'sans-serif';
        infoBox.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        infoBox.style.zIndex = '1001';

        infoBox.innerHTML = `
            <div id="infoBoxHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: bold;">✈️ 비행 경로 매니저</span>
                <span id="infoBoxCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">선 두께:</label>
                <input type="number" id="lineWidthInput" value="3" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">선 색상:</label>
                <input type="color" id="colorInput" value="#ff0000" style="width: 140px; height: 26px; padding: 0; background: none; border: 1px solid #555; border-radius: 4px; cursor: pointer;">
            </div>
            
            <hr style="border: none; border-top: 1px solid #555; margin: 10px 0;">
            
            <div id="trackListContainer" style="margin-bottom: 12px; display: none;">
                <label style="display: block; font-size: 13px; margin-bottom: 4px; color: #00aaee; font-weight: bold;">📋 불러온 항공기 항적 목록:</label>
                <select id="trackListBox" size="4" style="width: 100%; background: #222; border: 1px solid #555; color: white; border-radius: 4px; padding: 4px; font-size: 12px; outline: none;">
                </select>
            </div>

            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">위도 (Lat):</label>
                <input type="number" id="latitudeInput" placeholder="0.0" step="0.0001" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">경도 (Lng):</label>
                <input type="number" id="longitudeInput" placeholder="0.0" step="0.0001" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">고도 (Alt m):</label>
                <input type="number" id="heightInput" placeholder="0.0" step="1" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            
            <button id="addPointButton" style="width: 100%; padding: 6px; margin-bottom: 6px; background-color: #444; border: 1px solid #666; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">📍 좌표로 포인트 추가</button>
            <button id="startDrawingButton" style="width: 100%; padding: 6px; margin-bottom: 8px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">🎨 마우스 그리기 시작</button>
            
            <div style="display: flex; gap: 6px;">
                <button id="saveButton" style="flex: 1; padding: 6px; background-color: #28a745; border: none; color: white; font-weight: bold; border-radius: 4px; font-size: 12px; cursor: pointer;">JSON 내보내기</button>
                <button id="loadButton" style="flex: 1; padding: 6px; background-color: #17a2b8; border: none; color: white; font-weight: bold; border-radius: 4px; font-size: 12px; cursor: pointer;">JSON 가져오기</button>
            </div>
            <input type="file" id="loadFile" accept=".json" style="display: none;">
        `;
        document.body.appendChild(infoBox);

        // UI HTML이 body에 완벽히 추가된 직후 이벤트를 연동합니다 (Null 에러 근본적 해결)
        bindUiEvents();
    }

    // 2. 패널 내부 엘리먼트들의 이벤트를 안전하게 연결해주는 내부 함수
    function bindUiEvents() {
        if (isInitialized) return;

        // 닫기 버튼 이벤트
        document.getElementById('infoBoxCloseBtn').addEventListener('click', () => { 
            if (infoBox) infoBox.style.display = 'none'; 
        });

        // 헤더 드래그 기능 (angleLos.js 양식)
        (function makeDraggable() {
            let isDragging = false; let offsetX = 0; let offsetY = 0;
            const header = document.getElementById('infoBoxHeader');
            header.addEventListener('mousedown', (e) => {
                if (e.target.id === 'infoBoxCloseBtn') return;
                isDragging = true; 
                offsetX = e.clientX - infoBox.offsetLeft; 
                offsetY = e.clientY - infoBox.offsetTop;
                e.preventDefault(); 
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                infoBox.style.left = (e.clientX - offsetX) + 'px'; 
                infoBox.style.top = (e.clientY - offsetY) + 'px';
            });
            document.addEventListener('mouseup', () => { isDragging = false; });
        })();

        // 버튼 클릭 핸들러들을 UI 생성 시점에 등록
        document.getElementById('startDrawingButton').addEventListener('click', startDrawing);
        document.getElementById('addPointButton').addEventListener('click', addManualPoint);
        document.getElementById('saveButton').addEventListener('click', exportJson);
        document.getElementById('loadButton').addEventListener('click', () => { document.getElementById('loadFile').click(); });
        document.getElementById('loadFile').addEventListener('change', handleFileLoad);
        document.getElementById('trackListBox').addEventListener('change', function(e) {
            drawSelectedTrack(parseInt(e.target.value));
        });

        isInitialized = true;
    }

    // --- 수동 마우스 그리기 로직 ---
    function startDrawing() {
        if (!handler) return;
        resetDrawingState();
        handler.setInputAction(function (event) {
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(earthPosition);
                    startPolyline();
                }
                activeShapePoints.push(earthPosition);
                createPoint(earthPosition);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(function (event) {
            if (Cesium.defined(floatingPoint)) {
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    activeShapePoints.pop();
                    activeShapePoints.push(newPosition);
                    floatingPoint.position.setValue(newPosition);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(function (event) {
            if (activeShapePoints.length > 1) {
                finishDrawing();
                resetDrawingState();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function createPoint(worldPosition) {
        const ent = viewer.entities.add({
            position: worldPosition,
            point: { color: Cesium.Color.YELLOW, pixelSize: 6 }
        });
        currentEntities.push(ent);
        return ent;
    }

    function startPolyline() {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);
        activeShape = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => activeShapePoints, false),
                clampToGround: false, 
                width: parseFloat(document.getElementById('lineWidthInput').value),
                material: color
            }
        });
        currentEntities.push(activeShape);
    }

    function finishDrawing() {
        const colorValue = document.getElementById('colorInput').value;
        const lineWidth = parseFloat(document.getElementById('lineWidthInput').value);

        const trackId = polylines.length + 1;
        const coordsData = activeShapePoints.map(pos => {
            const cartographic = Cesium.Cartographic.fromCartesian(pos);
            return {
                longitude: Cesium.Math.toDegrees(cartographic.longitude),
                latitude: Cesium.Math.toDegrees(cartographic.latitude),
                height: cartographic.height
            };
        });

        polylines.push({
            id: trackId,
            color: colorValue,
            width: lineWidth,
            coordinates: coordsData
        });

        updateTrackListBox();
        drawSelectedTrack(trackId);
    }

    function resetDrawingState() {
        if (!handler) return;
        if (activeShape) { viewer.entities.remove(activeShape); activeShape = undefined; }
        if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = undefined; }
        activeShapePoints = [];
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // --- JSON 파일 파싱 및 로드 ---
    function handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.polylines && Array.isArray(data.polylines)) {
                    polylines = data.polylines;
                } else if (Array.isArray(data)) {
                    polylines = data;
                } else {
                    alert("지원하지 않는 JSON 포맷입니다."); return;
                }

                const container = document.getElementById('trackListContainer');
                if (container) {
                    container.style.display = 'block';
                }

                updateTrackListBox();
                
                if (polylines.length > 0) {
                    document.getElementById('trackListBox').value = polylines[0].id;
                    drawSelectedTrack(polylines[0].id);
                }
            } catch (error) {
                alert("JSON 파싱 중 오류가 발생했습니다.");
            }
        };
        reader.readAsText(file);
    }

    // 리스트 박스 갱신
    function updateTrackListBox() {
        const listBox = document.getElementById('trackListBox');
        if (!listBox) return;
        listBox.innerHTML = '';

        polylines.forEach(track => {
            const opt = document.createElement('option');
            opt.value = track.id;
            opt.innerText = `✈️ 항적 ID: ${track.id} (노드: ${track.coordinates.length}개)`;
            listBox.appendChild(opt);
        });
    }

    // 선택된 항적 그리기 및 카메라 이동
    function drawSelectedTrack(trackId) {
        currentEntities.forEach(ent => viewer.entities.remove(ent));
        currentEntities = [];

        const track = polylines.find(t => t.id === trackId);
        if (!track) return;

        const positions = track.coordinates.map(coord => 
            Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
        );

        const color = Cesium.Color.fromCssColorString(track.color || "#0000FF");

        const polylineEntity = viewer.entities.add({
            polyline: {
                positions: positions,
                clampToGround: false, 
                width: track.width || 3,
                material: color
            }
        });
        currentEntities.push(polylineEntity);

        positions.forEach(pos => {
            const pt = viewer.entities.add({
                position: pos,
                point: {
                    color: Cesium.Color.CYAN,
                    pixelSize: 6,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1
                }
            });
            currentEntities.push(pt);
        });

        if (positions.length > 0) {
            viewer.zoomTo(polylineEntity, new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(0), 
                Cesium.Math.toRadians(-45), 
                Cesium.Cartesian3.distance(positions[0], positions[positions.length - 1]) * 0.8
            ));
        }
    }

    // 좌표 수동 입력 기능
    function addManualPoint() {
        const latitude = parseFloat(document.getElementById('latitudeInput').value);
        const longitude = parseFloat(document.getElementById('longitudeInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(height)) {
            alert("올바른 수치 좌표를 입력해 주세요."); return;
        }

        const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        activeShapePoints.push(cartesian);
        createPoint(cartesian);

        if (activeShapePoints.length === 1) {
            startPolyline();
        }
    }

    // JSON 파일 다운로드 기능
    function exportJson() {
        const outputData = { version: "1.0", created: new Date().toISOString(), polylines: polylines };
        const jsonStr = JSON.stringify(outputData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "항공기항적_수정.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    // 🎯 외부(menu.js 등) 인터페이스 반환
    return {
        createAirPathBox: createAirPathBox,
        toggleInfoBox: function() {
            if (infoBox) {
                const isHidden = infoBox.style.display === 'none';
                infoBox.style.display = isHidden ? 'block' : 'none';
            }
        }
    };
})();
*/
/*
window.airpath = (function () {
    // Create Cesium Viewer
    const viewer = window.CesiumViewer;

    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;
    let polylines = []; // 불러온 전체 항적 데이터 저장 배열
    let currentEntities = []; // 현재 지도에 그려진 엔티티 관리 배열

    // 1. angleLos.js 무드의 세련된 다크 UI 패널 생성
    const infoBox = document.createElement('div');
    infoBox.id = 'infoBox';
    infoBox.style.position = 'absolute';
    infoBox.style.top = '60px';
    infoBox.style.left = '20px';
    infoBox.style.width = '280px'; 
    infoBox.style.background = 'rgba(42, 42, 42, 0.95)'; 
    infoBox.style.padding = '15px';
    infoBox.style.borderRadius = '8px';
    infoBox.style.color = 'white';
    infoBox.style.fontFamily = 'sans-serif';
    infoBox.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
    infoBox.style.zIndex = '1001';

    infoBox.innerHTML = `
        <div id="infoBoxHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 15px; font-weight: bold;">✈️ 비행 경로 매니저</span>
            <span id="infoBoxCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
        </div>
        
        <div style="margin-bottom: 8px; display: flex; align-items: center;">
            <label style="display: inline-block; width: 95px; font-size: 13px;">선 두께:</label>
            <input type="number" id="lineWidthInput" value="3" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 8px; display: flex; align-items: center;">
            <label style="display: inline-block; width: 95px; font-size: 13px;">선 색상:</label>
            <input type="color" id="colorInput" value="#ff0000" style="width: 140px; height: 26px; padding: 0; background: none; border: 1px solid #555; border-radius: 4px; cursor: pointer;">
        </div>
        
        <hr style="border: none; border-top: 1px solid #555; margin: 10px 0;">
        
        <div id="trackListContainer" style="margin-bottom: 12px; display: none;">
            <label style="display: block; font-size: 13px; margin-bottom: 4px; color: #00aaee; font-weight: bold;">📋 불러온 항공기 항적 목록:</label>
            <select id="trackListBox" size="4" style="width: 100%; background: #222; border: 1px solid #555; color: white; border-radius: 4px; padding: 4px; font-size: 12px; outline: none;">
            </select>
        </div>

        <div style="margin-bottom: 8px; display: flex; align-items: center;">
            <label style="display: inline-block; width: 95px; font-size: 13px;">위도 (Lat):</label>
            <input type="number" id="latitudeInput" placeholder="0.0" step="0.0001" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 8px; display: flex; align-items: center;">
            <label style="display: inline-block; width: 95px; font-size: 13px;">경도 (Lng):</label>
            <input type="number" id="longitudeInput" placeholder="0.0" step="0.0001" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 8px; display: flex; align-items: center;">
            <label style="display: inline-block; width: 95px; font-size: 13px;">고도 (Alt m):</label>
            <input type="number" id="heightInput" placeholder="0.0" step="1" style="width: 140px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
        </div>
        
        <button id="addPointButton" style="width: 100%; padding: 6px; margin-bottom: 6px; background-color: #444; border: 1px solid #666; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">📍 좌표로 포인트 추가</button>
        <button id="startDrawingButton" style="width: 100%; padding: 6px; margin-bottom: 8px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">🎨 마우스 그리기 시작</button>
        
        <div style="display: flex; gap: 6px;">
            <button id="saveButton" style="flex: 1; padding: 6px; background-color: #28a745; border: none; color: white; font-weight: bold; border-radius: 4px; font-size: 12px; cursor: pointer;">JSON 내보내기</button>
            <button id="loadButton" style="flex: 1; padding: 6px; background-color: #17a2b8; border: none; color: white; font-weight: bold; border-radius: 4px; font-size: 12px; cursor: pointer;">JSON 가져오기</button>
        </div>
        <input type="file" id="loadFile" accept=".json" style="display: none;">
    `;
    document.body.appendChild(infoBox);

    // 닫기 버튼 이벤트
    document.getElementById('infoBoxCloseBtn').addEventListener('click', () => { infoBox.style.display = 'none'; });

    // 헤더 드래그 기능 (angleLos.js 양식)
    (function makeDraggable() {
        let isDragging = false; let offsetX = 0; let offsetY = 0;
        const header = document.getElementById('infoBoxHeader');
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'infoBoxCloseBtn') return;
            isDragging = true; offsetX = e.clientX - infoBox.offsetLeft; offsetY = e.clientY - infoBox.offsetTop;
            e.preventDefault(); 
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            infoBox.style.left = (e.clientX - offsetX) + 'px'; infoBox.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    })();

    // --- 수동 마우스 그리기 로직 ---
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function startDrawing() {
        resetDrawingState();
        handler.setInputAction(function (event) {
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(earthPosition);
                    startPolyline();
                }
                activeShapePoints.push(earthPosition);
                createPoint(earthPosition);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(function (event) {
            if (Cesium.defined(floatingPoint)) {
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    activeShapePoints.pop();
                    activeShapePoints.push(newPosition);
                    floatingPoint.position.setValue(newPosition);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(function (event) {
            if (activeShapePoints.length > 1) {
                finishDrawing();
                resetDrawingState();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function createPoint(worldPosition) {
        const ent = viewer.entities.add({
            position: worldPosition,
            point: { color: Cesium.Color.YELLOW, pixelSize: 6 }
        });
        currentEntities.push(ent);
        return ent;
    }

    function startPolyline() {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);
        activeShape = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => activeShapePoints, false),
                clampToGround: false, 
                width: parseFloat(document.getElementById('lineWidthInput').value),
                material: color
            }
        });
        currentEntities.push(activeShape);
    }

    function finishDrawing() {
        const colorValue = document.getElementById('colorInput').value;
        const lineWidth = parseFloat(document.getElementById('lineWidthInput').value);

        const trackId = polylines.length + 1;
        const coordsData = activeShapePoints.map(pos => {
            const cartographic = Cesium.Cartographic.fromCartesian(pos);
            return {
                longitude: Cesium.Math.toDegrees(cartographic.longitude),
                latitude: Cesium.Math.toDegrees(cartographic.latitude),
                height: cartographic.height
            };
        });

        polylines.push({
            id: trackId,
            color: colorValue,
            width: lineWidth,
            coordinates: coordsData
        });

        updateTrackListBox();
        drawSelectedTrack(trackId);
    }
    

    function resetDrawingState() {
        if (activeShape) { viewer.entities.remove(activeShape); activeShape = undefined; }
        if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = undefined; }
        activeShapePoints = [];
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // --- 🎯 JSON 가져오기 및 리스트박스 연동 기능 ---
    document.getElementById('loadButton').addEventListener('click', () => { document.getElementById('loadFile').click(); });

    document.getElementById('loadFile').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // 제공된 구조처럼 내부에 .polylines 배열이 있는지 검증하고 파싱함
                if (data.polylines && Array.isArray(data.polylines)) {
                    polylines = data.polylines;
                } else if (Array.isArray(data)) {
                    polylines = data;
                } else {
                    alert("지원하지 않는 JSON 포맷입니다."); return;
                }

                // 🎯 [버그 수정 포인트 2] 파일 로드 완료 후 강제로 숨겨진 컨테이너를 강제 출력시킴
                const container = document.getElementById('trackListContainer');
                if (container) {
                    container.style.display = 'block';
                }

                // 리스트박스 아이템 채우기
                updateTrackListBox();
                
                // 첫 번째 항적으로 자동 선택 및 지도 투사
                if (polylines.length > 0) {
                    document.getElementById('trackListBox').value = polylines[0].id;
                    drawSelectedTrack(polylines[0].id);
                }
            } catch (error) {
                alert("JSON 파싱 중 오류가 발생했습니다.");
            }
        };
        reader.readAsText(file);
    });

    // 리스트박스 엘리먼트 내부 Option 생성 함수
    function updateTrackListBox() {
        const listBox = document.getElementById('trackListBox');
        if (!listBox) return;
        listBox.innerHTML = '';

        polylines.forEach(track => {
            const opt = document.createElement('option');
            opt.value = track.id;
            opt.innerText = `✈️ 항적 ID: ${track.id} (노드: ${track.coordinates.length}개)`;
            listBox.appendChild(opt);
        });
    }

    // 리스트박스에서 항목 선택 시 이벤트 감지
    document.getElementById('trackListBox').addEventListener('change', function(e) {
        const selectedId = parseInt(e.target.value);
        drawSelectedTrack(selectedId);
    });

    // 선택된 단일 항적을 Cesium 3D 지도 공간에 드로잉하고 카메라를 이동시키는 핵심 함수
    function drawSelectedTrack(trackId) {
        // 기존 지도 상의 엔티티들 깨끗하게 지우기
        currentEntities.forEach(ent => viewer.entities.remove(ent));
        currentEntities = [];

        const track = polylines.find(t => t.id === trackId);
        if (!track) return;

        const positions = track.coordinates.map(coord => 
            Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.height)
        );

        const color = Cesium.Color.fromCssColorString(track.color || "#0000FF");

        // 3D 공간상에 고도(20km)를 반영한 실선 투사
        const polylineEntity = viewer.entities.add({
            polyline: {
                positions: positions,
                clampToGround: false, // 여객기 고도 유지를 위해 false 필수
                width: track.width || 3,
                material: color
            }
        });
        currentEntities.push(polylineEntity);

        // 경로의 변곡점마다 식별용 포인트 오브젝트 배치
        positions.forEach(pos => {
            const pt = viewer.entities.add({
                position: pos,
                point: {
                    color: Cesium.Color.CYAN,
                    pixelSize: 6,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1
                }
            });
            currentEntities.push(pt);
        });

        // 20000m 상공에 비행 항적이 깔끔하게 잡히도록 카메라 뷰 자동 이동
        if (positions.length > 0) {
            viewer.zoomTo(polylineEntity, new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(0), 
                Cesium.Math.toRadians(-45), 
                Cesium.Cartesian3.distance(positions[0], positions[positions.length - 1]) * 0.8
            ));
        }
    }

    // 좌표 수동 입력 추가 기능
    document.getElementById('addPointButton').addEventListener('click', function () {
        const latitude = parseFloat(document.getElementById('latitudeInput').value);
        const longitude = parseFloat(document.getElementById('longitudeInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(height)) {
            alert("올바른 수치 좌표를 입력해 주세요."); return;
        }

        const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        activeShapePoints.push(cartesian);
        createPoint(cartesian);

        if (activeShapePoints.length === 1) {
            startPolyline();
        }
    });
    
    // 현 상태 JSON 다운로드 기능
    document.getElementById('saveButton').addEventListener('click', function () {
        const outputData = { version: "1.0", created: new Date().toISOString(), polylines: polylines };
        const jsonStr = JSON.stringify(outputData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "항공기항적_수정.json";
        a.click();
        URL.revokeObjectURL(url);
    });
    
    document.getElementById('startDrawingButton').addEventListener('click', startDrawing);



    return {
        showInfoBox: function() {
            if (infoBox) infoBox.style.display = 'block';
        },
        hideInfoBox: function() {
            if (infoBox) infoBox.style.display = 'none';
        },
        toggleInfoBox: function() {
            if (infoBox) {
                const isHidden = infoBox.style.display === 'none';
                infoBox.style.display = isHidden ? 'block' : 'none';
            }
        }
    };
})();
*/
/*
// old version
(function () {
    // Create Cesium Viewer
    const viewer = window.CesiumViewer;

    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;
    const polylines = []; // Store drawn polylines

    // Create an InfoBox
    const infoBox = document.createElement('div');
    infoBox.id = 'infoBox';
    infoBox.style.position = 'absolute';
    infoBox.style.top = '50px';
    infoBox.style.left = '50px';
    infoBox.style.width = '320px';
    infoBox.style.background = 'white';
    infoBox.style.border = '1px solid #ccc';
    infoBox.style.padding = '10px';
    infoBox.style.borderRadius = '5px';
    infoBox.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    infoBox.style.zIndex = 1000;
    infoBox.style.cursor = 'move';
    infoBox.innerHTML = `
        <label>Line Width: <input type="text" id="lineWidthInput" value="3"></label><br>
        <label>Color: <input type="color" id="colorInput" value="#ff0000"></label><br>
        <label>Latitude: <input type="text" id="latitudeInput" placeholder="0.0"></label><br>
        <label>Longitude: <input type="text" id="longitudeInput" placeholder="0.0"></label><br>
        <label>Height: <input type="text" id="heightInput" placeholder="0.0"></label><br>
        <label>Pitch: <input type="text" id="pitchInput" placeholder="0.0"></label><br>
        <label>Roll: <input type="text" id="rollInput" placeholder="0.0"></label><br>
        <button id="addPointButton">Add Point</button>
        <button id="startDrawingButton">Start Drawing</button>
        <button id="saveButton">Save to JSON</button>
        <input type="file" id="loadFile" style="display: none;">
        <button id="loadButton">Load JSON</button>
    `;
    document.body.appendChild(infoBox);

    // Make the infoBox draggable
    (function makeDraggable() {
        let offsetX, offsetY;
        infoBox.addEventListener('mousedown', function (e) {
            offsetX = e.clientX - infoBox.offsetLeft;
            offsetY = e.clientY - infoBox.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
        });

        document.addEventListener('mouseup', function () {
            document.removeEventListener('mousemove', onMouseMove);
        });

        function onMouseMove(e) {
            infoBox.style.left = (e.clientX - offsetX) + 'px';
            infoBox.style.top = (e.clientY - offsetY) + 'px';
        }
    })();

    // Add event listeners for polyline drawing
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function startDrawing() {
        reset();
        // Left click to add a point
        handler.setInputAction(function (event) {
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(earthPosition);
                    startPolyline([earthPosition]);
                }
                activeShapePoints.push(earthPosition);
                createPoint(earthPosition);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Mouse move to update the temporary polyline
        handler.setInputAction(function (event) {
            if (Cesium.defined(floatingPoint)) {
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    activeShapePoints.pop();
                    activeShapePoints.push(newPosition);
                    floatingPoint.position.setValue(newPosition);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Double click to finish drawing
        handler.setInputAction(function (event) {
            if (activeShapePoints.length > 1) {
                finishDrawing();
                reset();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function createPoint(worldPosition) {
        return viewer.entities.add({
            position: worldPosition,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    function startPolyline(positionData) {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);
        const dynamicPositions = new Cesium.CallbackProperty(function () {
            return new Cesium.PolylineGeometry({
                positions: activeShapePoints,
            });
        }, false);

        activeShape = viewer.entities.add({
            polyline: {
                positions: dynamicPositions,
                clampToGround: true,
                width: parseFloat(document.getElementById('lineWidthInput').value),
                material: color
            }
        });
    }

    function finishDrawing() {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);
        const lineWidth = parseFloat(document.getElementById('lineWidthInput').value);

        const polylineEntity = viewer.entities.add({
            polyline: {
                positions: activeShapePoints,
                clampToGround: true,
                width: lineWidth,
                material: color
            }
        });
        polylines.push({
            id: polylineEntity.id,
            coordinates: activeShapePoints.map(pos => {
                const cartographic = Cesium.Cartographic.fromCartesian(pos);
                return {
                    longitude: Cesium.Math.toDegrees(cartographic.longitude),
                    latitude: Cesium.Math.toDegrees(cartographic.latitude),
                    height: cartographic.height
                };
            }),
            color: colorValue,
            width: lineWidth
        });

        viewer.entities.remove(floatingPoint);
        viewer.entities.remove(activeShape);
    }

    function reset() {
        if (activeShape) {
            viewer.entities.remove(activeShape);
            activeShape = undefined;
        }
        activeShapePoints = [];
        floatingPoint = undefined;
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    document.getElementById('addPointButton').addEventListener('click', function () {
        const latitude = parseFloat(document.getElementById('latitudeInput').value);
        const longitude = parseFloat(document.getElementById('longitudeInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(height)) {
            alert("Please enter valid numbers for latitude, longitude, and height.");
            return;
        }

        const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        activeShapePoints.push(cartesian);
        createPoint(cartesian);

        if (activeShapePoints.length === 1) {
            startPolyline(activeShapePoints);
        }
    });

    // Save polylines to JSON file
    document.getElementById('saveButton').addEventListener('click', function () {
        const jsonStr = JSON.stringify(polylines, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "polylines.json";
        a.click();
        URL.revokeObjectURL(url);
    });

    // Load polylines from JSON file
    document.getElementById('loadButton').addEventListener('click', function () {
        document.getElementById('loadFile').click();
    });

    document.getElementById('loadFile').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                try {
                    const loadedPolylines = JSON.parse(content);
                    loadedPolylines.forEach(loadPolyline);
                } catch (error) {
                    alert("Invalid JSON file");
                }
            };
            reader.readAsText(file);
        }
    });

    function loadPolyline(polylineData) {
        const color = Cesium.Color.fromCssColorString(polylineData.color);
        const positions = polylineData.coordinates.map(coordinate => Cesium.Cartesian3.fromDegrees(
            coordinate.longitude, coordinate.latitude, coordinate.height
        ));

        viewer.entities.add({
            id: polylineData.id,
            polyline: {
                positions: positions,
                clampToGround: true,
                width: polylineData.width,
                material: color
            }
        });
    }

    document.getElementById('startDrawingButton').addEventListener('click', startDrawing);
})();
*/