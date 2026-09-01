window.measure = (function() {
    const viewer = window.CesiumViewer;

    let activeShapePoints = [];
    let trackedEntities = []; // 🎯 생성된 모든 포인트/폴리곤/라벨 추적 및 관리 배열
    let floatingPoint = null;
    let activeShape = null;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    // 📍 통일된 노란색 마커 원형 포인트 생성 
    function createPoint(position) {
        const entity = viewer.entities.add({
            position: position,
            point: {
                pixelSize: 8,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        trackedEntities.push(entity);
        return entity;
    }

    // 실시간 드로잉 헬퍼 (레드 셰이드 다각형)
    function drawShape(positions) {
        const entity = viewer.entities.add({
            polygon: {
                hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(positions), false),
                material: Cesium.Color.RED.withAlpha(0.4),
                classificationType: Cesium.ClassificationType.BOTH // 지형 및 3D 모델 표면에 밀착
            }
        });
        trackedEntities.push(entity);
        return entity;
    }

    // 📐 타원체면 기반 정밀 면적 계산 공식 (WGS84 국소 투영 구면 다각형 공식)
    function calculateArea(positions) {
        if (positions.length < 3) return 0;
        
        const radiansPerDegree = Math.PI / 180.0;
        const ellipsoid = Cesium.Ellipsoid.WGS84;
        const cartographics = positions.map(p => Cesium.Cartographic.fromCartesian(p));
        const coordinates = cartographics.map(p => [p.longitude / radiansPerDegree, p.latitude / radiansPerDegree]);

        let area = 0;
        for (let i = 0; i < coordinates.length; i++) {
            const [x1, y1] = coordinates[i];
            const [x2, y2] = coordinates[(i + 1) % coordinates.length];
            area += Cesium.Math.toRadians(x2 - x1) *
                    (2 + Math.sin(Cesium.Math.toRadians(y1)) + Math.sin(Cesium.Math.toRadians(y2)));
        }

        area = area * Math.pow(ellipsoid.maximumRadius, 2) / 2.0;
        return Math.abs(area);
    }

    // 💡 [추가] 꼭짓점 배열로부터 폴리곤의 정중앙(Center) 좌표를 역산하는 헬퍼 함수
    function getPolygonCenter(positions) {
        if (!positions || positions.length === 0) return null;
        
        // Cesium의 BoundingSphere 객체를 이용하여 꼭짓점들을 포함하는 가장 이상적인 중심 구체를 계산
        const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);
        return boundingSphere.center;
    }

    // 면적 포맷팅 (m² ➔ km² 단위 자동 변환 기능 포함)
    function formatArea(areaM2) {
        return areaM2 >= 1000000 
            ? `${(areaM2 / 1000000).toFixed(2)} km²` 
            : `${areaM2.toFixed(1)} m²`;
    }

    function showAreaLabel(position, area) {
        const entity = viewer.entities.add({
            position: position,
            label: {
                text: `📐 면적: ${formatArea(area)}`,
                font: '12px sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                verticalOrigin: Cesium.VerticalOrigin.CENTER, // 💡 중앙 배치 정렬 최적화
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        trackedEntities.push(entity);
        return entity;
    }

    function start() {
        stop(); // 완전히 리셋하고 시작

        // 1. 마우스 클릭 (다각형 꼭짓점 추가)
        handler.setInputAction(function (click) {
            const earthPosition = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(earthPosition)) return;

            if (activeShapePoints.length === 0) {
                activeShapePoints.push(earthPosition);
                floatingPoint = createPoint(earthPosition);
                activeShape = drawShape(activeShapePoints);
            }

            activeShapePoints.push(earthPosition);
            createPoint(earthPosition);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 2. 마우스 이동 (마우스 커서 따라 가이드 영역 실시간 투영)
        handler.setInputAction(function (movement) {
            if (!Cesium.defined(floatingPoint) || activeShapePoints.length === 0) return;
            
            const newPosition = viewer.scene.pickPosition(movement.endPosition);
            if (Cesium.defined(newPosition)) {
                floatingPoint.position.setValue(newPosition);
                activeShapePoints[activeShapePoints.length - 1] = newPosition; 
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 3. 더블클릭 (드로잉 최종 완료 및 면적 중앙 산출)
        handler.setInputAction(function (event) {
            if (activeShapePoints.length < 4) return; 

            if (viewer.screenSpaceEventHandler) {
                viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            }

            activeShapePoints.pop(); 
            activeShapePoints.pop(); 

            if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = null; }
            if (activeShape) { viewer.entities.remove(activeShape); activeShape = null; }

            const finalPoint = activeShapePoints[activeShapePoints.length - 1];
            createPoint(finalPoint);

            const finalPolygon = viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(activeShapePoints),
                    material: Cesium.Color.BLUE.withAlpha(0.4),
                    classificationType: Cesium.ClassificationType.BOTH
                }
            });
            trackedEntities.push(finalPolygon);

            // 📍 [수정 구현부] 첫 노드 좌표 대신 다각형 꼭짓점의 정중앙 좌표를 구하여 라벨 투영
            const area = calculateArea(activeShapePoints);
            const centerPosition = getPolygonCenter(activeShapePoints);
            
            showAreaLabel(centerPosition, area);

            detachEvents();

            viewer.selectedEntity = undefined;
            viewer.trackedEntity = undefined;

        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // 이벤트 리스너 리셋 및 해제
    function detachEvents() {
        if (handler) {
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        floatingPoint = null;
        activeShape = null;
    }

    function stop() {
        detachEvents();

        trackedEntities.forEach(entity => {
            viewer.entities.remove(entity);
        });

        trackedEntities = [];
        activeShapePoints = [];
        
        viewer.selectedEntity = undefined;
        viewer.trackedEntity = undefined;
    }

    return {
        start,
        stop,
    };
})();