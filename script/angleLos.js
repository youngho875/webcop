window.angleLos = (function() {
    const viewer = window.CesiumViewer;
    let uiPanel = null;
    let losEntities = [];
    let centerCartographic = null;
    let directionHeading = null;
    let clickStep = 0;

    // 1. 입력 팝업창 UI 생성 함수
    function createUiPanel() {
        if (document.getElementById('losUiPanel')) return;

        uiPanel = document.createElement('div');
        uiPanel.id = 'losUiPanel';
        uiPanel.style.position = 'absolute';
        uiPanel.style.top = '60px'; 
        uiPanel.style.left = '20px';
        uiPanel.style.background = 'rgba(42, 42, 42, 0.95)';
        uiPanel.style.padding = '15px';
        uiPanel.style.borderRadius = '8px';
        uiPanel.style.color = 'white';
        uiPanel.style.fontFamily = 'sans-serif';
        uiPanel.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        uiPanel.style.zIndex = '1001';
        uiPanel.style.display = 'none'; 

        uiPanel.innerHTML = `
            <div id="losPanelHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: bold;">📡 부채꼴 지형/건물 통합 LOS 분석</span>
                <span id="losPanelCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 110px; font-size: 13px;">중심 경도:</label>
                <input type="number" id="losLng" value="126.9780" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 110px; font-size: 13px;">중심 위도:</label>
                <input type="number" id="losLat" value="37.5665" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 110px; font-size: 13px;">장비 높이 (AGL m):</label>
                <input type="number" id="losAlt" value="20" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 110px; font-size: 13px;">반경 (거리 m):</label>
                <input type="number" id="losDistance" value="500" step="50" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: inline-block; width: 110px; font-size: 13px;">총 각도(도):</label>
                <input type="number" id="losAngle" value="60" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div id="losClickGuide" style="margin-bottom: 10px; font-size: 12px; color: #ffd166;">
                지도에서 관측 중심점을 클릭하세요.
            </div>
            <button id="executeLosBtn" style="width: 100%; padding: 6px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">분석 실행</button>
        `;
        document.body.appendChild(uiPanel);

        document.getElementById('losPanelCloseBtn').addEventListener('click', () => { uiPanel.style.display = 'none'; });

        const header = document.getElementById('losPanelHeader');
        let isDragging = false; let offsetX = 0; let offsetY = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'losPanelCloseBtn') return;
            isDragging = true; offsetX = e.clientX - uiPanel.offsetLeft; offsetY = e.clientY - uiPanel.offsetTop;
            e.preventDefault(); 
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            uiPanel.style.left = (e.clientX - offsetX) + 'px'; uiPanel.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });

        document.getElementById('executeLosBtn').addEventListener('click', async function() {
            const lng = parseFloat(document.getElementById('losLng').value);
            const lat = parseFloat(document.getElementById('losLat').value);
            const alt = parseFloat(document.getElementById('losAlt').value);
            const distance = parseFloat(document.getElementById('losDistance').value);
            const totalAngle = parseFloat(document.getElementById('losAngle').value);

            if ([lng, lat, alt, distance, totalAngle].some(isNaN)) {
                alert('올바른 값을 입력해 주세요.'); return;
            }

            if (!Cesium.defined(directionHeading)) {
                alert('지도에서 관측 중심점과 방향점을 차례로 클릭해 주세요.'); return;
            }
            
            const btn = document.getElementById('executeLosBtn');
            btn.innerText = "3D 지형/건물 연산 중...";
            btn.disabled = true;

            await runUnifiedLosAnalysis(lng, lat, alt, distance, totalAngle, directionHeading);

            btn.innerText = "분석 실행";
            btn.disabled = false;
        });

        // 마우스 클릭 이벤트를 처리하는 핸들러 등록
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction(function(clickEvent) {
            // 1. 화면 클릭 매니저가 3D 씬(지형 또는 3D 건물)에서 정확한 3D Cartesian3 좌표를 피킹합니다.
            const cartesian = viewer.scene.pickPosition(clickEvent.position);

            if (Cesium.defined(cartesian)) {
                // 2. Cartesian3(XYZ) 좌표를 Ellipsoid(타원체) 기준 위경도 라디안 구조로 변환합니다.
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                
                // 3. 라디안 단위를 우리가 사용하는 도(Degree) 단위로 변환합니다.
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);

                // 첫 번째 클릭은 관측 중심점, 두 번째 클릭은 LOS 중앙 방향으로 사용합니다.
                const lngInput = document.getElementById('losLng');
                const latInput = document.getElementById('losLat');
                const guide = document.getElementById('losClickGuide');

                if (lngInput && latInput) {
                    if (clickStep === 0) {
                        centerCartographic = Cesium.Cartographic.clone(cartographic);
                        directionHeading = null;
                        lngInput.value = longitude.toFixed(6);
                        latInput.value = latitude.toFixed(6);
                        clickStep = 1;
                        if (guide) guide.textContent = 'LOS가 향할 두 번째 점을 클릭하세요.';
                        console.log(`관측 중심점 -> 경도: ${longitude.toFixed(6)}, 위도: ${latitude.toFixed(6)}`);
                    } else {
                        const geodesic = new Cesium.EllipsoidGeodesic(centerCartographic, cartographic);
                        if (geodesic.surfaceDistance < 0.01) {
                            if (guide) guide.textContent = '중심점과 다른 위치를 클릭하세요.';
                            return;
                        }

                        directionHeading = geodesic.startHeading;
                        clickStep = 0;
                        const headingDegrees = Cesium.Math.zeroToTwoPi(directionHeading) * 180 / Math.PI;
                        if (guide) {
                            guide.textContent = `방향 설정 완료: ${headingDegrees.toFixed(1)}° (다시 클릭하면 중심점 재설정)`;
                        }
                        console.log(`LOS 중앙 방향 -> ${headingDegrees.toFixed(1)}°`);
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    // 3D 껍데기가 완벽히 브라우저에 매핑될 때까지 잡아두는 프레임 헬퍼
    function waitUntilTilesLoaded() {
        return new Promise((resolve) => {
            if (viewer.scene.globe.tilesLoaded) { resolve(); return; }
            const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength) => {
                if (queueLength === 0) { removeListener(); resolve(); }
            });
        });
    }

    // 2. 통합 환경 가시선 분석 핵심 비동기 함수
    async function runUnifiedLosAnalysis(lng, lat, userAlt, distance, totalAngle, centerHeading) {
        if (!viewer) return console.error("Cesium Viewer를 찾을 수 없습니다.");
        
        losEntities.forEach(ent => viewer.entities.remove(ent));
        losEntities = [];

        // 1. 관측지 중심 위치의 실제 지형 고도 구하기
        const centerBaseCarto = Cesium.Cartographic.fromDegrees(lng, lat, 0);
        let sampledCenter;
        try {
            sampledCenter = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centerBaseCarto]);
        } catch (e) {
            sampledCenter = [centerBaseCarto];
        }
        const terrainHeight = sampledCenter[0].height || 0;
        const finalObserverHeight = terrainHeight + userAlt;

        // 카메라 비행 이동 및 타일 로드 대기
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, finalObserverHeight + distance * 1.5),
            orientation: { heading: centerHeading, pitch: Cesium.Math.toRadians(-60.0), roll: 0.0 }
        });

        await new Promise(resolve => setTimeout(resolve, 600)); 
        await waitUntilTilesLoaded();

        const observerCartesian = Cesium.Cartesian3.fromDegrees(lng, lat, finalObserverHeight);

        // 연산 부하 완화를 위한 최적 해상도 격자망
        const angleSteps = 20; 
        const distanceSteps = 10; 
        
        const halfAngleRad = Cesium.Math.toRadians(totalAngle / 2);
        const startHeading = centerHeading - halfAngleRad;
        const endHeading = centerHeading + halfAngleRad;

        const obsCartesianEmpty = Cesium.Cartesian3.fromDegrees(lng, lat, 0);
        const gridPointsCartographic = [];
        for (let d = 0; d <= distanceSteps; d++) {
            const currentDist = (distance / distanceSteps) * d;
            for (let a = 0; a <= angleSteps; a++) {
                const heading = Cesium.Math.lerp(startHeading, endHeading, a / angleSteps);
                const ptCartesian = calculateTargetPosition(obsCartesianEmpty, heading, currentDist);
                gridPointsCartographic.push(Cesium.Cartographic.fromCartesian(ptCartesian));
            }
        }

        let gridPositions;
        try {
            gridPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, gridPointsCartographic);
        } catch (e) {
            console.error("지형 로드 실패", e); return;
        }

        const gridNodes = [];
        let index = 0;
        for (let d = 0; d <= distanceSteps; d++) {
            gridNodes[d] = [];
            for (let a = 0; a <= angleSteps; a++) {
                gridNodes[d][a] = gridPositions[index++];
            }
        }

        const polygonRenderQueue = [];

        // 3. 물리적 광선 피킹 루프 (await 적용 확인)
        for (let d = 0; d < distanceSteps; d++) {
            for (let a = 0; a < angleSteps; a++) {
                const nodeTL = gridNodes[d][a];     
                const nodeTR = gridNodes[d][a+1];   
                const nodeBR = gridNodes[d+1][a+1]; 
                const nodeBL = gridNodes[d+1][a];   

                const centerLon = (nodeTL.longitude + nodeTR.longitude + nodeBR.longitude + nodeBL.longitude) / 4;
                const centerLat = (nodeTL.latitude + nodeTR.latitude + nodeBR.latitude + nodeBL.latitude) / 4;
                const centerTerrainHeight = (nodeTL.height + nodeTR.height + nodeBR.height + nodeBL.height) / 4;

                // 타겟 검증 위치 정의 (지상 0.5m 공중 배치)
                const targetCartesian = Cesium.Cartesian3.fromRadians(centerLon, centerLat, centerTerrainHeight + 0.5);

                const rayDirection = Cesium.Cartesian3.subtract(targetCartesian, observerCartesian, new Cesium.Cartesian3());
                const rayLength = Cesium.Cartesian3.magnitude(rayDirection);
                Cesium.Cartesian3.normalize(rayDirection, rayDirection);
                
                const ray = new Cesium.Ray(observerCartesian, rayDirection);

                // pickFromRayMostDetailed는 비동기 함수(Promise 반환)이므로 반드시 앞에 await를 붙여서 결과 인스턴스를 받아내야 합니다.
                const intersection = await viewer.scene.pickFromRayMostDetailed(ray, losEntities);
 
                let isVisible = true;
                // 비동기 대기 후 정상 추출된 intersection 결과 파싱
                if (Cesium.defined(intersection) && Cesium.defined(intersection.position)) {
                    const intersectionDistance = Cesium.Cartesian3.distance(observerCartesian, intersection.position);
                    
                    // 레이저 최종 목적지(셀 중심)보다 짧은 거리에서 충돌했다면 무언가(산/빌딩)에 막힌 것임
                    if (intersectionDistance < (rayLength - 2.0)) {
                        isVisible = false; // 안보임 (RED)
                    }
                }

                polygonRenderQueue.push({
                    coords: [nodeTL, nodeTR, nodeBR, nodeBL],
                    isVisible: isVisible
                });
            }
        }

        // 4. 스티커 다각형 일괄 렌더링
        polygonRenderQueue.forEach(item => {
            const pTL = Cesium.Cartesian3.fromRadians(item.coords[0].longitude, item.coords[0].latitude, item.coords[0].height);
            const pTR = Cesium.Cartesian3.fromRadians(item.coords[1].longitude, item.coords[1].latitude, item.coords[1].height);
            const pBR = Cesium.Cartesian3.fromRadians(item.coords[2].longitude, item.coords[2].latitude, item.coords[2].height);
            const pBL = Cesium.Cartesian3.fromRadians(item.coords[3].longitude, item.coords[3].latitude, item.coords[3].height);

            const polygonEntity = viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy([pTL, pTR, pBR, pBL]),
                    material: item.isVisible 
                        ? Cesium.Color.BLUE.withAlpha(0.4) 
                        : Cesium.Color.RED.withAlpha(0.4),
                    classificationType: Cesium.ClassificationType.BOTH
                }
            });
            losEntities.push(polygonEntity);
        });
    }

    function calculateTargetPosition(observerPosition, heading, distance) {
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(observerPosition);
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(heading, 0, 0));
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
        
        const localDirection = new Cesium.Cartesian3(0, 1, 0); 
        Cesium.Matrix3.multiplyByVector(rotationMatrix, localDirection, localDirection);

        const globalDirection = new Cesium.Cartesian3();
        Cesium.Matrix3.multiplyByVector(Cesium.Matrix4.getMatrix3(enuMatrix, new Cesium.Matrix3()), localDirection, globalDirection);
        
        const normalizedDirection = Cesium.Cartesian3.normalize(globalDirection, new Cesium.Cartesian3());
        const scaledDirection = Cesium.Cartesian3.multiplyByScalar(normalizedDirection, distance, new Cesium.Cartesian3());
        
        return Cesium.Cartesian3.add(observerPosition, scaledDirection, new Cesium.Cartesian3());
    }

    createUiPanel();

    return {
        showMoveInfo: function() {
            if (!uiPanel) return;
            uiPanel.style.display = (uiPanel.style.display === 'none') ? 'block' : 'none';
        }
    };
})();

/*
// 건물이 있는 경우
window.angleLos = (function() {
    const viewer = window.CesiumViewer;
    let uiPanel = null;

    // 1. 입력 팝업창 UI 생성 함수
    function createUiPanel() {
        if (document.getElementById('losUiPanel')) return;

        uiPanel = document.createElement('div');
        uiPanel.id = 'losUiPanel';
        uiPanel.style.position = 'absolute';
        uiPanel.style.top = '60px'; 
        uiPanel.style.left = '20px';
        uiPanel.style.background = 'rgba(42, 42, 42, 0.95)';
        uiPanel.style.padding = '15px';
        uiPanel.style.borderRadius = '8px';
        uiPanel.style.color = 'white';
        uiPanel.style.fontFamily = 'sans-serif';
        uiPanel.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        uiPanel.style.zIndex = '1001';
        uiPanel.style.display = 'none'; 

        uiPanel.innerHTML = `
            <div id="losPanelHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: bold;">📡 부채꼴 건물 통합 LOS 분석</span>
                <span id="losPanelCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">중심 경도:</label>
                <input type="number" id="losLng" value="126.9780" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">중심 위도:</label>
                <input type="number" id="losLat" value="37.5665" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">장비 높이(m):</label>
                <input type="number" id="losAlt" value="20" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">반경 (거리 m):</label>
                <input type="number" id="losDistance" value="500" step="50" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">총 각도(도):</label>
                <input type="number" id="losAngle" value="60" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <button id="executeLosBtn" style="width: 100%; padding: 6px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">분석 실행</button>
        `;
        document.body.appendChild(uiPanel);

        document.getElementById('losPanelCloseBtn').addEventListener('click', () => { uiPanel.style.display = 'none'; });

        // 마우스 드래그 기능
        const header = document.getElementById('losPanelHeader');
        let isDragging = false; let offsetX = 0; let offsetY = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'losPanelCloseBtn') return;
            isDragging = true; offsetX = e.clientX - uiPanel.offsetLeft; offsetY = e.clientY - uiPanel.offsetTop;
            e.preventDefault(); 
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            uiPanel.style.left = (e.clientX - offsetX) + 'px'; uiPanel.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });

        // 분석 실행 클릭 이벤트
        document.getElementById('executeLosBtn').addEventListener('click', async function() {
            const lng = parseFloat(document.getElementById('losLng').value);
            const lat = parseFloat(document.getElementById('losLat').value);
            const alt = parseFloat(document.getElementById('losAlt').value);
            const distance = parseFloat(document.getElementById('losDistance').value);
            const totalAngle = parseFloat(document.getElementById('losAngle').value);

            if ([lng, lat, alt, distance, totalAngle].some(isNaN)) {
                alert('올바른 값을 입력해 주세요.'); return;
            }
            
            await run3DTilesLosAnalysis(lng, lat, alt, distance, totalAngle);
        });
    }

    // 2. 3D Tiles 건물 피킹 기반의 핵심 분석 함수
    async function run3DTilesLosAnalysis(lng, lat, userAlt, distance, totalAngle) {
        if (!viewer) return console.error("Cesium Viewer를 찾을 수 없습니다.");
        viewer.entities.removeAll(); 

        // 1. 관측지 바닥의 초기 지형 고도 계산
        const centerBaseCarto = Cesium.Cartographic.fromDegrees(lng, lat, 0);
        let sampledCenter;
        try {
            sampledCenter = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centerBaseCarto]);
        } catch (e) {
            sampledCenter = [centerBaseCarto];
        }
        const terrainHeight = sampledCenter[0].height || 0;
        const finalObserverHeight = terrainHeight + userAlt;

        // 카메라 이동
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, finalObserverHeight + distance * 1.5),
            orientation: { heading: Cesium.Math.toRadians(0.0), pitch: Cesium.Math.toRadians(-60.0), roll: 0.0 }
        });

        // 관측점 절대 Cartesian3 지정
        const observerCartesian = Cesium.Cartesian3.fromDegrees(lng, lat, finalObserverHeight);

        // 부채꼴 격자 분할 수 설정 (Scene 픽 연산 성능을 고려해 최적 수치로 조율)
        const angleSteps = 24; 
        const distanceSteps = 12; 
        
        const halfAngleRad = Cesium.Math.toRadians(totalAngle / 2);
        const startHeading = -halfAngleRad;
        const endHeading = halfAngleRad;

        // 임시 0m 고도 기반 격자망 사전 수집
        const obsCartesianEmpty = Cesium.Cartesian3.fromDegrees(lng, lat, 0);
        const gridPointsCartographic = [];
        for (let d = 0; d <= distanceSteps; d++) {
            const currentDist = (distance / distanceSteps) * d;
            for (let a = 0; a <= angleSteps; a++) {
                const heading = Cesium.Math.lerp(startHeading, endHeading, a / angleSteps);
                const ptCartesian = calculateTargetPosition(obsCartesianEmpty, heading, currentDist);
                gridPointsCartographic.push(Cesium.Cartographic.fromCartesian(ptCartesian));
            }
        }

        // 지형 고도 일괄 샘플링 (기본 격자 틀 형성용)
        let gridPositions;
        try {
            gridPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, gridPointsCartographic);
        } catch (e) {
            console.error("지형 정보를 로드하지 못했습니다.", e); return;
        }

        const gridNodes = [];
        let index = 0;
        for (let d = 0; d <= distanceSteps; d++) {
            gridNodes[d] = [];
            for (let a = 0; a <= angleSteps; a++) {
                gridNodes[d][a] = gridPositions[index++];
            }
        }

        // 3D 씬 피킹 레이캐스팅 수행 루프
        for (let d = 0; d < distanceSteps; d++) {
            for (let a = 0; a < angleSteps; a++) {
                const nodeTL = gridNodes[d][a];     
                const nodeTR = gridNodes[d][a+1];   
                const nodeBR = gridNodes[d+1][a+1]; 
                const nodeBL = gridNodes[d+1][a];   

                // 셀 중심 바닥 위경도
                const centerLon = (nodeTL.longitude + nodeTR.longitude + nodeBR.longitude + nodeBL.longitude) / 4;
                const centerLat = (nodeTL.latitude + nodeTR.latitude + nodeBR.latitude + nodeBL.latitude) / 4;
                const centerTerrainHeight = (nodeTL.height + nodeTR.height + nodeBR.height + nodeBL.height) / 4;

                // ⭐ [수정 핵심] 타겟 위치를 지형 바닥보다 0.5m 공중으로 세팅 (자체 바닥 충돌 간섭 방지)
                const targetCartesian = Cesium.Cartesian3.fromRadians(centerLon, centerLat, centerTerrainHeight + 0.5);

                // 레이(Ray) 선분 객체 생성: 관측점 방향 벡터 추출
                const rayDirection = Cesium.Cartesian3.subtract(targetCartesian, observerCartesian, new Cesium.Cartesian3());
                const rayLength = Cesium.Cartesian3.magnitude(rayDirection);
                Cesium.Cartesian3.normalize(rayDirection, rayDirection);
                
                const ray = new Cesium.Ray(observerCartesian, rayDirection);

                // ⭐ [3D 건물 충돌체 체크] 3D Tiles 건물과 지형을 통틀어 중간에 레이와 충돌하는 무언가가 있는지 찾습니다.
                // 가로막는 엔티티(자기 자신 폴리곤 등)는 무시하기 위해 objectsToExclude 옵션을 활용합니다.
                const intersection = viewer.scene.pickFromRayMostDetailed(ray);

                let isVisible = true;
                if (Cesium.defined(intersection) && Cesium.defined(intersection.position)) {
                    // 충돌된 지점까지의 거리 측정
                    const intersectionDistance = Cesium.Cartesian3.distance(observerCartesian, intersection.position);
                    
                    // 만약 가로막힌 장애물의 거리가 원래 타겟 셀 중심점 거리보다 짧다면 건물이나 산에 가려진 것임
                    if (intersectionDistance < rayLength - 1.0) {
                        isVisible = false; // 안보임 (RED)
                    }
                }

                const pTL = Cesium.Cartesian3.fromRadians(nodeTL.longitude, nodeTL.latitude, nodeTL.height);
                const pTR = Cesium.Cartesian3.fromRadians(nodeTR.longitude, nodeTR.latitude, nodeTR.height);
                const pBR = Cesium.Cartesian3.fromRadians(nodeBR.longitude, nodeBR.latitude, nodeBR.height);
                const pBL = Cesium.Cartesian3.fromRadians(nodeBL.longitude, nodeBL.latitude, nodeBL.height);

                // 다각형 면 색칠
                viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy([pTL, pTR, pBR, pBL]),
                        material: isVisible 
                            ? Cesium.Color.BLUE.withAlpha(0.4) 
                            : Cesium.Color.RED.withAlpha(0.4),
                        classificationType: Cesium.ClassificationType.CESIUM_3D_TILE // 지형뿐만 아니라 건물 지붕 위에도 면이 밀착되어 그려집니다.
                    }
                });
            }
        }
    }

    function calculateTargetPosition(observerPosition, heading, distance) {
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(observerPosition);
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(heading, 0, 0));
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
        
        const localDirection = new Cesium.Cartesian3(0, 1, 0); 
        Cesium.Matrix3.multiplyByVector(rotationMatrix, localDirection, localDirection);

        const globalDirection = new Cesium.Cartesian3();
        Cesium.Matrix3.multiplyByVector(Cesium.Matrix4.getMatrix3(enuMatrix, new Cesium.Matrix3()), localDirection, globalDirection);
        
        const normalizedDirection = Cesium.Cartesian3.normalize(globalDirection, new Cesium.Cartesian3());
        const scaledDirection = Cesium.Cartesian3.multiplyByScalar(normalizedDirection, distance, new Cesium.Cartesian3());
        
        return Cesium.Cartesian3.add(observerPosition, scaledDirection, new Cesium.Cartesian3());
    }

    createUiPanel();

    return {
        showMoveInfo: function() {
            if (!uiPanel) return;
            uiPanel.style.display = (uiPanel.style.display === 'none') ? 'block' : 'none';
        }
    };
})();
*/

/*
// 건물이 없는 지형만 있는 경우
window.angleLos = (function() {
    const viewer = window.CesiumViewer;
    let uiPanel = null;

    // 1. 입력 팝업창 UI 생성 함수
    function createUiPanel() {
        if (document.getElementById('losUiPanel')) return;

        uiPanel = document.createElement('div');
        uiPanel.id = 'losUiPanel';
        uiPanel.style.position = 'absolute';
        uiPanel.style.top = '60px'; 
        uiPanel.style.left = '20px';
        uiPanel.style.background = 'rgba(42, 42, 42, 0.95)';
        uiPanel.style.padding = '15px';
        uiPanel.style.borderRadius = '8px';
        uiPanel.style.color = 'white';
        uiPanel.style.fontFamily = 'sans-serif';
        uiPanel.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        uiPanel.style.zIndex = '1001';
        uiPanel.style.display = 'none'; 

        uiPanel.innerHTML = `
            <div id="losPanelHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: bold;">📡 부채꼴 면 가시선(LOS) 분석</span>
                <span id="losPanelCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">중심 경도:</label>
                <input type="number" id="losLng" value="126.9780" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">중심 위도:</label>
                <input type="number" id="losLat" value="37.5665" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">장비 높이(m):</label>
                <input type="number" id="losAlt" value="20" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">반경 (거리 m):</label>
                <input type="number" id="losDistance" value="500" step="50" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">총 각도(도):</label>
                <input type="number" id="losAngle" value="60" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <button id="executeLosBtn" style="width: 100%; padding: 6px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">분석 실행</button>
        `;
        document.body.appendChild(uiPanel);

        document.getElementById('losPanelCloseBtn').addEventListener('click', () => { uiPanel.style.display = 'none'; });

        // 드래그 기능
        const header = document.getElementById('losPanelHeader');
        let isDragging = false; let offsetX = 0; let offsetY = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'losPanelCloseBtn') return;
            isDragging = true; offsetX = e.clientX - uiPanel.offsetLeft; offsetY = e.clientY - uiPanel.offsetTop;
            e.preventDefault(); 
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            uiPanel.style.left = (e.clientX - offsetX) + 'px'; uiPanel.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });

        // 분석 실행 클릭 이벤트 (async)
        document.getElementById('executeLosBtn').addEventListener('click', async function() {
            const lng = parseFloat(document.getElementById('losLng').value);
            const lat = parseFloat(document.getElementById('losLat').value);
            const alt = parseFloat(document.getElementById('losAlt').value);
            const distance = parseFloat(document.getElementById('losDistance').value);
            const totalAngle = parseFloat(document.getElementById('losAngle').value);

            if ([lng, lat, alt, distance, totalAngle].some(isNaN)) {
                alert('올바른 값을 입력해 주세요.'); return;
            }
            
            await runSurfaceLosAnalysis(lng, lat, alt, distance, totalAngle);
        });
    }

    // 2. 가시선 분석 핵심 비동기 함수
    async function runSurfaceLosAnalysis(lng, lat, userAlt, distance, totalAngle) {
        if (!viewer) return console.error("Cesium Viewer를 찾을 수 없습니다.");
        viewer.entities.removeAll(); 

        // 1. 관측지 바닥의 실제 지형 고도 구하기
        const centerBaseCartographic = Cesium.Cartographic.fromDegrees(lng, lat, 0);
        let sampledCenter;
        try {
            sampledCenter = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centerBaseCartographic]);
        } catch (e) {
            console.error("지형 고도를 조회하지 못했습니다.", e);
            sampledCenter = [centerBaseCartographic];
        }
        
        const terrainHeightAtCenter = sampledCenter[0].height || 0;
        const finalObserverHeight = terrainHeightAtCenter + userAlt;

        // 카메라 이동
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, finalObserverHeight + distance * 1.5),
            orientation: { heading: Cesium.Math.toRadians(0.0), pitch: Cesium.Math.toRadians(-60.0), roll: 0.0 }
        });

        // 관측지 기본 정보 객체화
        const obsCarto = Cesium.Cartographic.fromDegrees(lng, lat, finalObserverHeight);

        // 격자 해상도 세분화 (정밀 분석용)
        const angleSteps = 30; 
        const distanceSteps = 15; 
        
        const halfAngleRad = Cesium.Math.toRadians(totalAngle / 2);
        const startHeading = -halfAngleRad;
        const endHeading = halfAngleRad;

        // 2. 격자망 교차점 위경도 수집 (기준점은 바닥이므로 고도 0으로 수집)
        const obsCartesianEmpty = Cesium.Cartesian3.fromDegrees(lng, lat, 0);
        const gridPointsCartographic = [];
        for (let d = 0; d <= distanceSteps; d++) {
            const currentDist = (distance / distanceSteps) * d;
            for (let a = 0; a <= angleSteps; a++) {
                const heading = Cesium.Math.lerp(startHeading, endHeading, a / angleSteps);
                const ptCartesian = calculateTargetPosition(obsCartesianEmpty, heading, currentDist);
                gridPointsCartographic.push(Cesium.Cartographic.fromCartesian(ptCartesian));
            }
        }

        // 3. 지형 실시간 고도 일괄 비동기 샘플링
        let sampledPositions;
        try {
            sampledPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, gridPointsCartographic);
        } catch (e) {
            console.error("지형 정보를 가져오지 못했습니다.", e); return;
        }

        const gridNodes = [];
        let index = 0;
        for (let d = 0; d <= distanceSteps; d++) {
            gridNodes[d] = [];
            for (let a = 0; a <= angleSteps; a++) {
                gridNodes[d][a] = sampledPositions[index++];
            }
        }

        // 4. 셀 단위 가시성 검증 및 폴리곤 추가
        for (let d = 0; d < distanceSteps; d++) {
            for (let a = 0; a < angleSteps; a++) {
                const nodeTL = gridNodes[d][a];     
                const nodeTR = gridNodes[d][a+1];   
                const nodeBR = gridNodes[d+1][a+1]; 
                const nodeBL = gridNodes[d+1][a];   

                // 셀 중심 위경도 및 바닥 높이 계산
                const centerLon = (nodeTL.longitude + nodeTR.longitude + nodeBR.longitude + nodeBL.longitude) / 4;
                const centerLat = (nodeTL.latitude + nodeTR.latitude + nodeBR.latitude + nodeBL.latitude) / 4;
                const centerTerrainHeight = (nodeTL.height + nodeTR.height + nodeBR.height + nodeBL.height) / 4;

                const targetCarto = new Cesium.Cartographic(centerLon, centerLat, centerTerrainHeight);

                // ⭐ [교정 핵심] 관측지 위경도 정보와 타겟 위경도 정보를 통해 경로 차폐를 검증합니다.
                const isVisible = await checkVisibilityGeometric(obsCarto, targetCarto, 10);

                const pTL = Cesium.Cartesian3.fromRadians(nodeTL.longitude, nodeTL.latitude, nodeTL.height);
                const pTR = Cesium.Cartesian3.fromRadians(nodeTR.longitude, nodeTR.latitude, nodeTR.height);
                const pBR = Cesium.Cartesian3.fromRadians(nodeBR.longitude, nodeBR.latitude, nodeBR.height);
                const pBL = Cesium.Cartesian3.fromRadians(nodeBL.longitude, nodeBL.latitude, nodeBL.height);

                viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy([pTL, pTR, pBR, pBL]),
                        material: isVisible 
                            ? Cesium.Color.BLUE.withAlpha(0.4) 
                            : Cesium.Color.RED.withAlpha(0.4),
                        classificationType: Cesium.ClassificationType.TERRAIN 
                    }
                });
            }
        }
    }

    function calculateTargetPosition(observerPosition, heading, distance) {
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(observerPosition);
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(heading, 0, 0));
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
        
        const localDirection = new Cesium.Cartesian3(0, 1, 0); 
        Cesium.Matrix3.multiplyByVector(rotationMatrix, localDirection, localDirection);

        const globalDirection = new Cesium.Cartesian3();
        Cesium.Matrix3.multiplyByVector(Cesium.Matrix4.getMatrix3(enuMatrix, new Cesium.Matrix3()), localDirection, globalDirection);
        
        const normalizedDirection = Cesium.Cartesian3.normalize(globalDirection, new Cesium.Cartesian3());
        const scaledDirection = Cesium.Cartesian3.multiplyByScalar(normalizedDirection, distance, new Cesium.Cartesian3());
        
        return Cesium.Cartesian3.add(observerPosition, scaledDirection, new Cesium.Cartesian3());
    }

    // ⭐ [완전 재작성] 위경도 좌표계 분할 방식 기반 정밀 가시선 연산 함수
    async function checkVisibilityGeometric(obsCarto, targetCarto, samplesCount = 10) {
        const rayCartographics = [];
        
        // 1. Cartesian3 선형 보간 대신 위도/경도/고도를 기준으로 공간 선분을 순수 분할 수집합니다.
        // 이를 통해 지구 중심 방향으로 가시선 벡터가 휘어 땅에 박히는 현상을 원천 차단합니다.
        for (let i = 1; i <= samplesCount; i++) {
            const ratio = i / samplesCount;
            const lerpLon = Cesium.Math.lerp(obsCarto.longitude, targetCarto.longitude, ratio);
            const lerpLat = Cesium.Math.lerp(obsCarto.latitude, targetCarto.latitude, ratio);
            
            // 공중 가시선 고도 (관측지 고도에서 타겟 바닥 고도(+1m 보정)로 선형 감소)
            // 도착점 고도에 +1m를 주어 폴리곤 자체 지형 결합에 의한 가림 오류를 상쇄합니다.
            const targetHeightCorrected = targetCarto.height + 1.0;
            const lineOfSightHeight = Cesium.Math.lerp(obsCarto.height, targetHeightCorrected, ratio);

            rayCartographics.push(new Cesium.Cartographic(lerpLon, lerpLat, lineOfSightHeight));
        }

        // 2. 검증 지점들의 '진짜 바닥 지형 고도'를 구하기 위해 복사본 생성 (고도를 0으로 초기화하여 샘플링 요청)
        const terrainSamplePoints = rayCartographics.map(pt => new Cesium.Cartographic(pt.longitude, pt.latitude, 0));

        let sampledTerrainPoints;
        try {
            sampledTerrainPoints = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, terrainSamplePoints);
        } catch (e) {
            return true; 
        }

        // 3. 공중 가시선 고도(rayCartographics)와 실제 뚫고 지나가는 산맥 고도(sampledTerrainPoints) 대조
        for (let i = 0; i < sampledTerrainPoints.length; i++) {
            const actualTerrainHeight = sampledTerrainPoints[i].height || 0; // 실제 산맥 높이
            const lineOfSightHeight = rayCartographics[i].height;            // 허공의 가시선 높이

            // 가시선 높이가 중간의 실제 산 고도보다 낮다면 가려진 상태(RED)
            if (lineOfSightHeight < actualTerrainHeight) {
                return false; 
            }
        }
        return true; // 무사 통과 시 보임(BLUE)
    }

    createUiPanel();

    return {
        showMoveInfo: function() {
            if (!uiPanel) return;
            uiPanel.style.display = (uiPanel.style.display === 'none') ? 'block' : 'none';
        }
    };
})();
*/
/*
window.angleLos = (function() {
    const viewer = window.CesiumViewer;
    let uiPanel = null;

    // 1. 입력 팝업창 UI 생성 함수
    function createUiPanel() {
        if (document.getElementById('losUiPanel')) return;

        uiPanel = document.createElement('div');
        uiPanel.id = 'losUiPanel';
        uiPanel.style.position = 'absolute';
        uiPanel.style.top = '60px'; 
        uiPanel.style.left = '20px';
        uiPanel.style.background = 'rgba(42, 42, 42, 0.95)';
        uiPanel.style.padding = '15px';
        uiPanel.style.borderRadius = '8px';
        uiPanel.style.color = 'white';
        uiPanel.style.fontFamily = 'sans-serif';
        uiPanel.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        uiPanel.style.zIndex = '1001';
        uiPanel.style.display = 'none'; 

        uiPanel.innerHTML = `
            <div id="losPanelHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: bold;">📡 부채꼴 면 가시선(LOS) 분석</span>
                <span id="losPanelCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">중심 경도:</label>
                <input type="number" id="losLng" value="126.9780" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">중심 위도:</label>
                <input type="number" id="losLat" value="37.5665" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">장비 높이(m):</label>
                <input type="number" id="losAlt" value="20" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">반경 (거리 m):</label>
                <input type="number" id="losDistance" value="500" step="50" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: inline-block; width: 95px; font-size: 13px;">총 각도(도):</label>
                <input type="number" id="losAngle" value="60" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <button id="executeLosBtn" style="width: 100%; padding: 6px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">분석 실행</button>
        `;
        document.body.appendChild(uiPanel);

        document.getElementById('losPanelCloseBtn').addEventListener('click', () => { uiPanel.style.display = 'none'; });

        // 마우스 드래그 기능
        const header = document.getElementById('losPanelHeader');
        let isDragging = false; let offsetX = 0; let offsetY = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'losPanelCloseBtn') return;
            isDragging = true; offsetX = e.clientX - uiPanel.offsetLeft; offsetY = e.clientY - uiPanel.offsetTop;
            e.preventDefault(); 
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            uiPanel.style.left = (e.clientX - offsetX) + 'px'; uiPanel.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });

        // ⭐ [수정] 클릭 이벤트 핸들러 자체에 async를 추가하여 내부 비동기 호출을 보장합니다.
        document.getElementById('executeLosBtn').addEventListener('click', async function() {
            const lng = parseFloat(document.getElementById('losLng').value);
            const lat = parseFloat(document.getElementById('losLat').value);
            const alt = parseFloat(document.getElementById('losAlt').value);
            const distance = parseFloat(document.getElementById('losDistance').value);
            const totalAngle = parseFloat(document.getElementById('losAngle').value);

            if ([lng, lat, alt, distance, totalAngle].some(isNaN)) {
                alert('올바른 값을 입력해 주세요.'); return;
            }
            
            // ⭐ 비동기 함수이므로 앞에 await를 꼭 붙여 순차 처리를 보장합니다.
            await runSurfaceLosAnalysis(lng, lat, alt, distance, totalAngle);
        });
    }

    // 2. 가시선 분석 핵심 비동기 함수
    async function runSurfaceLosAnalysis(lng, lat, userAlt, distance, totalAngle) {
        if (!viewer) return console.error("Cesium Viewer를 찾을 수 없습니다.");
        viewer.entities.removeAll(); 

        // 1. 관측지 중심 위치의 실제 지형 고도 구하기
        const centerBaseCartographic = Cesium.Cartographic.fromDegrees(lng, lat, 0);
        let sampledCenter;
        try {
            sampledCenter = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centerBaseCartographic]);
        } catch (e) {
            console.error("지형 고도를 조회하지 못했습니다.", e);
            sampledCenter = [centerBaseCartographic];
        }
        
        const terrainHeightAtCenter = sampledCenter[0].height || 0;
        const finalObserverHeight = terrainHeightAtCenter + userAlt; // 지형 고도 + 장비 높이

        // 카메라 이동
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, finalObserverHeight + distance * 1.5),
            orientation: { heading: Cesium.Math.toRadians(0.0), pitch: Cesium.Math.toRadians(-60.0), roll: 0.0 }
        });

        const observerCartographic = Cesium.Cartographic.fromDegrees(lng, lat, finalObserverHeight);
        const observerCartesian = Cesium.Cartesian3.fromRadians(observerCartographic.longitude, observerCartographic.latitude, observerCartographic.height);

        // 격자 세분화 개수
        const angleSteps = 30; 
        const distanceSteps = 15; 
        
        const halfAngleRad = Cesium.Math.toRadians(totalAngle / 2);
        const startHeading = -halfAngleRad;
        const endHeading = halfAngleRad;

        // 2. 격자망 모든 꼭짓점 좌표 산출
        const gridPointsCartographic = [];
        for (let d = 0; d <= distanceSteps; d++) {
            const currentDist = (distance / distanceSteps) * d;
            for (let a = 0; a <= angleSteps; a++) {
                const heading = Cesium.Math.lerp(startHeading, endHeading, a / angleSteps);
                const ptCartesian = calculateTargetPosition(observerCartesian, heading, currentDist);
                gridPointsCartographic.push(Cesium.Cartographic.fromCartesian(ptCartesian));
            }
        }

        // 3. 지형 실시간 고도 일괄 비동기 샘플링
        let sampledPositions;
        try {
            sampledPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, gridPointsCartographic);
        } catch (e) {
            console.error("지형 정보를 가져오지 못했습니다.", e); return;
        }

        const gridNodes = [];
        let index = 0;
        for (let d = 0; d <= distanceSteps; d++) {
            gridNodes[d] = [];
            for (let a = 0; a <= angleSteps; a++) {
                gridNodes[d][a] = sampledPositions[index++];
            }
        }

        // 4. 셀 단위로 가시선 검증 및 채우기
        for (let d = 0; d < distanceSteps; d++) {
            for (let a = 0; a < angleSteps; a++) {
                const nodeTL = gridNodes[d][a];     
                const nodeTR = gridNodes[d][a+1];   
                const nodeBR = gridNodes[d+1][a+1]; 
                const nodeBL = gridNodes[d+1][a];   

                const centerLon = (nodeTL.longitude + nodeTR.longitude + nodeBR.longitude + nodeBL.longitude) / 4;
                const centerLat = (nodeTL.latitude + nodeTR.latitude + nodeBR.latitude + nodeBL.latitude) / 4;
                const centerTerrainHeight = (nodeTL.height + nodeTR.height + nodeBR.height + nodeBL.height) / 4;

                const centerCartesian = Cesium.Cartesian3.fromRadians(centerLon, centerLat, centerTerrainHeight);

                // ⭐ 이제 리너스에서도 정상적으로 대기하므로 가시성 판별 결과가 온전히 적용됩니다.
                const isVisible = await checkVisibilityBetweenPoints(observerCartesian, centerCartesian, 10);

                const pTL = Cesium.Cartesian3.fromRadians(nodeTL.longitude, nodeTL.latitude, nodeTL.height);
                const pTR = Cesium.Cartesian3.fromRadians(nodeTR.longitude, nodeTR.latitude, nodeTR.height);
                const pBR = Cesium.Cartesian3.fromRadians(nodeBR.longitude, nodeBR.latitude, nodeBR.height);
                const pBL = Cesium.Cartesian3.fromRadians(nodeBL.longitude, nodeBL.latitude, nodeBL.height);

                viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy([pTL, pTR, pBR, pBL]),
                        material: isVisible 
                            ? Cesium.Color.BLUE.withAlpha(0.4) 
                            : Cesium.Color.RED.withAlpha(0.4),
                        classificationType: Cesium.ClassificationType.TERRAIN 
                    }
                });
            }
        }
    }

    function calculateTargetPosition(observerPosition, heading, distance) {
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(observerPosition);
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(heading, 0, 0));
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
        
        const localDirection = new Cesium.Cartesian3(0, 1, 0); 
        Cesium.Matrix3.multiplyByVector(rotationMatrix, localDirection, localDirection);

        const globalDirection = new Cesium.Cartesian3();
        Cesium.Matrix3.multiplyByVector(Cesium.Matrix4.getMatrix3(enuMatrix, new Cesium.Matrix3()), localDirection, globalDirection);
        
        const normalizedDirection = Cesium.Cartesian3.normalize(globalDirection, new Cesium.Cartesian3());
        const scaledDirection = Cesium.Cartesian3.multiplyByScalar(normalizedDirection, distance, new Cesium.Cartesian3());
        
        return Cesium.Cartesian3.add(observerPosition, scaledDirection, new Cesium.Cartesian3());
    }

    async function checkVisibilityBetweenPoints(startCartesian, endCartesian, samplesCount = 10) {
        const rayPositions = [];
        
        for (let i = 1; i <= samplesCount; i++) {
            const lerpCartesian = Cesium.Cartesian3.lerp(startCartesian, endCartesian, i / samplesCount, new Cesium.Cartesian3());
            rayPositions.push(Cesium.Cartographic.fromCartesian(lerpCartesian));
        }

        let sampledPoints;
        try {
            sampledPoints = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, rayPositions);
        } catch (e) {
            return true; 
        }

        for (let i = 0; i < sampledPoints.length; i++) {
            const actualTerrainHeight = sampledPoints[i].height; 
            const lineOfSightHeight = rayPositions[i].height;     

            if (lineOfSightHeight < actualTerrainHeight) {
                return false; 
            }
        }
        return true; 
    }

    createUiPanel();

    return {
        showMoveInfo: function() {
            if (!uiPanel) return;
            uiPanel.style.display = (uiPanel.style.display === 'none') ? 'block' : 'none';
        }
    };
})();
*/
/*
window.angleLos = (function() {
    const viewer = window.CesiumViewer;
    let uiPanel = null;

    // 1. [스타일, 드래그, 닫기포함] 입력 팝업창 UI 생성 함수
    function createUiPanel() {
        if (document.getElementById('losUiPanel')) return;

        uiPanel = document.createElement('div');
        uiPanel.id = 'losUiPanel';
        uiPanel.style.position = 'absolute';
        uiPanel.style.top = '60px'; 
        uiPanel.style.left = '20px';
        uiPanel.style.background = 'rgba(42, 42, 42, 0.95)';
        uiPanel.style.padding = '15px';
        uiPanel.style.borderRadius = '8px';
        uiPanel.style.color = 'white';
        uiPanel.style.fontFamily = 'sans-serif';
        uiPanel.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        uiPanel.style.zIndex = '1001';
        uiPanel.style.display = 'none'; // 기본 숨김

        // UI 구성 (중심좌표, 높이, 반경, 각도 입력창)
        uiPanel.innerHTML = `
            <div id="losPanelHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: bold;">📡 부채꼴 가시선(LOS) 분석</span>
                <span id="losPanelCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 85px; font-size: 13px;">중심 경도:</label>
                <input type="number" id="losLng" value="126.9780" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 85px; font-size: 13px;">중심 위도:</label>
                <input type="number" id="losLat" value="37.5665" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 85px; font-size: 13px;">높이 (고도 m):</label>
                <input type="number" id="losAlt" value="20" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 85px; font-size: 13px;">반경 (거리 m):</label>
                <input type="number" id="losDistance" value="1000" step="100" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: inline-block; width: 85px; font-size: 13px;">총 각도(도):</label>
                <input type="number" id="losAngle" value="60" step="1" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <button id="executeLosBtn" style="width: 100%; padding: 6px; background-color: #007acc; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">분석 실행</button>
        `;
        document.body.appendChild(uiPanel);

        // 팝업창 닫기 버튼 이벤트
        document.getElementById('losPanelCloseBtn').addEventListener('click', function() {
            uiPanel.style.display = 'none';
        });

        // 마우스 드래그 기능 구현
        const header = document.getElementById('losPanelHeader');
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener('mousedown', function(e) {
            if (e.target.id === 'losPanelCloseBtn') return;
            isDragging = true;
            offsetX = e.clientX - uiPanel.offsetLeft;
            offsetY = e.clientY - uiPanel.offsetTop;
            e.preventDefault(); 
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            uiPanel.style.left = (e.clientX - offsetX) + 'px';
            uiPanel.style.top = (e.clientY - offsetY) + 'px';
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
        });

        // [분석 실행] 버튼 클릭 이벤트
        document.getElementById('executeLosBtn').addEventListener('click', function() {
            const lng = parseFloat(document.getElementById('losLng').value);
            const lat = parseFloat(document.getElementById('losLat').value);
            const alt = parseFloat(document.getElementById('losAlt').value);
            const distance = parseFloat(document.getElementById('losDistance').value);
            const totalAngle = parseFloat(document.getElementById('losAngle').value);

            if ([lng, lat, alt, distance, totalAngle].some(isNaN)) {
                alert('올바른 값을 입력해 주세요.');
                return;
            }

            runAngleLosAnalysis(lng, lat, alt, distance, totalAngle);
        });
    }

    // 2. 가시선 분석 핵심 계산 함수
    function runAngleLosAnalysis(lng, lat, alt, distance, totalAngle) {
        if (!viewer) return console.error("Cesium Viewer를 찾을 수 없습니다.");

        viewer.entities.removeAll(); // 이전 분석 결과 초기화

        // 입력받은 경위도 및 높이를 기반으로 옵저버의 Cartesian3 좌표 생성
        // 기본 지형(Terrain) 높이에 사용자가 입력한 고도(alt)를 더하기 위해 먼저 Cartographic 구조 설정
        const observerCartographic = Cesium.Cartographic.fromDegrees(lng, lat, alt);
        
        // 중요: 지형 높이를 고려하기 위해 무조건 0으로 시작하지 않고, 
        // 입력 패널 좌표 기준으로 카메라를 먼저 살짝 부드럽게 이동시켜 뷰를 확보할 수도 있습니다.
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, distance * 1.5),
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-60.0),
                roll: 0.0
            }
        });

        // 진북(Heading 0도) 기준으로 좌우 절반씩 할당하기 위한 라디안 각도 계산
        const halfAngleRad = Cesium.Math.toRadians(totalAngle / 2);
        const startHeading = -halfAngleRad; // 진북 기준 왼쪽 방향
        const endHeading = halfAngleRad;   // 진북 기준 오른쪽 방향
        const pitch = Cesium.Math.toRadians(0); // 수평선 방향
        const steps = 30; // 분석할 레이(선)의 갯수 개수 조정 가능

        // 카테시안3 좌표로 변환하기 위한 근사 계산 (지형 매핑용 타겟 생성기)
        const observerCartesian = Cesium.Cartesian3.fromRadians(observerCartographic.longitude, observerCartographic.latitude, observerCartographic.height);

        for (let i = 0; i <= steps; i++) {
            const heading = Cesium.Math.lerp(startHeading, endHeading, i / steps);
            const targetPosition = calculateTargetPosition(observerCartesian, heading, pitch, distance);
            performLineOfSightAnalysis(observerCartesian, targetPosition);
        }
    }

    // 방향에 따른 타겟 포인트 계산 함수 (East-North-Up 로컬 좌표계 기준 진북 계산 보완)
    function calculateTargetPosition(observerPosition, heading, pitch, distance) {
        // 옵저버 위치 기준 ENU(East-North-Up) 회전 행렬 생성 (이 행렬 기준 Y축이 진북 방향이 됩니다)
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(observerPosition);

        // Heading 각도에 맞춰 회전 행렬 계산 (Cesium에서 Heading 0은 ENU에서 북쪽(Y축)을 뜻함)
        // 기존 Cartesian3.UNIT_X 방식은 전역 절대좌표 기준이라 왜곡이 발생하므로 로컬 행렬을 사용합니다.
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(heading, pitch, 0));
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
        
        // 로컬 기준 앞방향은 Y축(북쪽)
        const localDirection = new Cesium.Cartesian3(0, 1, 0); 
        Cesium.Matrix3.multiplyByVector(rotationMatrix, localDirection, localDirection);

        // 로컬 방향 벡터를 글로벌 데카르트 좌표 방향 벡터로 변환
        const globalDirection = new Cesium.Cartesian3();
        Cesium.Matrix3.multiplyByVector(Cesium.Matrix4.getMatrix3(enuMatrix, new Cesium.Matrix3()), localDirection, globalDirection);
        
        const normalizedDirection = Cesium.Cartesian3.normalize(globalDirection, new Cesium.Cartesian3());
        const scaledDirection = Cesium.Cartesian3.multiplyByScalar(normalizedDirection, distance, new Cesium.Cartesian3());
        
        return Cesium.Cartesian3.add(observerPosition, scaledDirection, new Cesium.Cartesian3());
    }

    // 지형 고도 샘플링 및 가시선(LOS) 드로잉 함수
    async function performLineOfSightAnalysis(observerPosition, targetPosition) {
        const numberOfSamples = 50; // 한 레이(선)당 샘플링할 조각 갯수
        const positions = [];

        // 1. 관측지와 목적지 사이를 등간격 분할하여 공간 좌표 수집
        for (let i = 0; i <= numberOfSamples; i++) {
            const interpolation = Cesium.Cartesian3.lerp(observerPosition, targetPosition, i / numberOfSamples, new Cesium.Cartesian3());
            positions.push(Cesium.Cartographic.fromCartesian(interpolation));
        }

        // 2. 입력받은 분할 지점들에 대해 실제 3D 지형(Terrain) 높이 추출
        let sampledPositions;
        try {
            sampledPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
        } catch (e) {
            console.error("지형 정보를 가져오지 못했습니다.", e);
            return;
        }

        // 가시선 판별용 알고리즘 가다듬기 (직선의 방정식 고도 vs 실제 지형 고도 비교)
        for (let i = 0; i < sampledPositions.length - 1; i++) {
            const terrainHeightCurrent = sampledPositions[i].height;
            const terrainHeightNext = sampledPositions[i + 1].height;

            // 선분(공중을 지나는 가시선) 자체의 절대 고도값
            const lineBoxHeightCurrent = positions[i].height;
            const lineBoxHeightNext = positions[i + 1].height;

            // 현재 조각 세그먼트가 땅에 파묻히는지(보이지 않는지) 여부 판별
            // 공중 가시선 높이가 지형 높이보다 높아야 보임 가능
            const visibleSegment = lineBoxHeightCurrent >= terrainHeightCurrent && lineBoxHeightNext >= terrainHeightNext;

            // 가시선 고도 높이로 선을 그리면 공중에 선이 고도별로 표현됩니다.
            // 만약 땅바닥에 딱 붙는 다채로운 색을 원하시면 lineBoxHeight 대신 terrainHeight를 세 번째 파라미터로 주면 됩니다.
            const currentCartesian = Cesium.Cartesian3.fromRadians(
                sampledPositions[i].longitude,
                sampledPositions[i].latitude,
                lineBoxHeightCurrent 
            );

            const nextCartesian = Cesium.Cartesian3.fromRadians(
                sampledPositions[i + 1].longitude,
                sampledPositions[i + 1].latitude,
                lineBoxHeightNext
            );

            // 가시 유무에 따라 BLUE(보임) / RED(안보임) 렌더링
            viewer.entities.add({
                polyline: {
                    positions: [currentCartesian, nextCartesian],
                    width: 3,
                    material: visibleSegment ? Cesium.Color.BLUE : Cesium.Color.RED,
                    clampToGround: false // 공중 가시 레이 그대로 표현하기 위해 false 설정
                }
            });
        }
    }

    // 요소 자동 빌드
    createUiPanel();

    // 3. menu.js 와의 통신용 인터페이스 인터페이스 이름 유지
    return {
        showMoveInfo: function() {
            if (!uiPanel) return;
            // 입력창 토글 처리
            if (uiPanel.style.display === 'none') {
                uiPanel.style.display = 'block';
            } else {
                uiPanel.style.display = 'none';
            }
        }
    };
})();
*/
