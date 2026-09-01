// polylineDrawingWithLatLon.js

window.PolylineDrawing = (function() {
    const viewer = window.CesiumViewer;
    
    let activeShapePoints = [];  // 현재 드로잉/편집 중인 꼭짓점 목록 (Cartesian3)
    let activeShape = null;      // 동적 가이드용 폴리라인 엔티티
    let floatingPoint = null;    // 마우스 커서를 따라다니는 임시 포인트 엔티티
    let markerEntities = [];     // 현재 화면에 배치된 꼭짓점 마커 엔티티 배열
    let drawnPolylines = [];     // 최종 확정된 고정 폴리라인 배열
    let polylineSequence = 0;

    function formatCoordinateList(positions) {
        return positions.map(position => {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            return `${Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)} ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)}`;
        }).join(', ');
    }

    function parseCoordinateList(text) {
        const entries = String(text || '').split(',').map(item => item.trim()).filter(Boolean);
        if (entries.length < 2) return null;
        const coordinates = entries.map(entry => entry.split(/\s+/).map(Number));
        if (coordinates.some(pair => pair.length !== 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[0]) > 180 || Math.abs(pair[1]) > 90)) return null;
        return coordinates.map(([longitude, latitude]) => Cesium.Cartesian3.fromDegrees(longitude, latitude));
    }
    
    let isEditing = false;       // 현재 기존 폴리라인을 편집 중인지 여부
    let editingPolyline = null;  // 현재 편집 대상이 된 폴리라인 인스턴스

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // 📍 꼭짓점 마커 생성 함수
    function createPoint(position, index) {
        const pointEntity = viewer.entities.add({
            position: position,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 8,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        pointEntity.customIndex = index;
        markerEntities.push(pointEntity);
        return pointEntity;
    }

    // 🎨 [핵심 수정] 내부 면 채움(Polygonization) 방지 동적 폴리라인
    function drawDynamicShape() {
        return viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => {
                    return activeShapePoints;
                }, false),
                width: 4,
                material: Cesium.Color.RED,
                arcType: Cesium.ArcType.GEODESIC, // 🌟 지형 상의 곡선을 그대로 유지
                clampToGround: true // 지형 표면을 따라 밀착
            }
        });
    }

    // 💾 [핵심 수정] 확정 고정 폴리라인 생성 함수
    function drawStaticPolyline(points) {
        const style = window.ShapeDrawingCore?.getStyle?.() || { lineColor:'#ff0000', lineOpacity:100, lineWidth:4, lineType:'solid', dashType:'solid' };
        style.coordinateGeometry = true;
        style.coordinateText = formatCoordinateList(points);
        const material = window.ShapeDrawingCore?.lineMaterial?.(style) || Cesium.Color.RED;
        const entity = viewer.entities.add({
            name: String(style.shapeName || ('폴리라인' + (++polylineSequence))).trim(),
            polyline: {
                positions: points,
                width: style.lineType === 'none' ? 0 : style.lineWidth,
                material,
                arcType: Cesium.ArcType.GEODESIC,
                clampToGround: true
            }
        });
        window.ShapeDrawingCore?.attachEditor?.(viewer, entity, '폴리라인 설정/편집', style, nextStyle => {
            const editedPositions = parseCoordinateList(nextStyle.coordinateText);
            if (!editedPositions) {
                window.alert('좌표를 "경도 위도, 경도 위도, ..." 형식으로 2개 이상 입력하세요.');
                return;
            }
            points = editedPositions;
            entity.name = String(nextStyle.shapeName || entity.name).trim();
            entity.customData.displayName = entity.name;
            entity.show = nextStyle.lineType !== 'none';
            entity.polyline.width = nextStyle.lineWidth;
            entity.polyline.material = window.ShapeDrawingCore.lineMaterial(nextStyle);
            entity.polyline.positions = points;
            entity.customPoints = [...points];
            document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
        });
        entity.customPoints = [...points];
        entity.customData = { drawingType: 'polyline', displayName: entity.name };
        drawnPolylines.push(entity);
        document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity } }));
        return entity;
    }

    // 🚀 모듈 활성화 진입점
    function activate() {
        reset();
        bindEvents();
    }

    function bindEvents() {
        deactivate(); // 중복 리스너 방지

        // 1. 마우스 단일 좌클릭 (꼭짓점 추가 또는 클릭 시 편집)
        handler.setInputAction(function(event) {
            const pickedObject = viewer.scene.pick(event.position);

            // [A] 이미 그려진 폴리라인 클릭 -> 편집 모드
            if (activeShapePoints.length === 0 && Cesium.defined(pickedObject) && pickedObject.id && drawnPolylines.includes(pickedObject.id)) {
                viewer.selectedEntity = pickedObject.id;
                return;
            }

            // 지형/모델 피킹
            const ray = viewer.camera.getPickRay(event.position);
            const earthPosition = viewer.scene.globe.pick(ray, viewer.scene);
            
            if (!Cesium.defined(earthPosition)) return;

            // [B] 첫 노드 배치
            if (activeShapePoints.length === 0) {
                activeShapePoints.push(earthPosition); // 고정 첫 노드
                activeShapePoints.push(earthPosition); // 가이드 노드
                
                createPoint(earthPosition, 0);
                floatingPoint = createPoint(earthPosition, 1);
                
                activeShape = drawDynamicShape();
            } else {
                // [C] 신규 꼭짓점 추가
                const insertIdx = activeShapePoints.length - 1;
                activeShapePoints.splice(insertIdx, 0, earthPosition);
                createPoint(earthPosition, insertIdx);
                
                if (floatingPoint) {
                    floatingPoint.customIndex = activeShapePoints.length - 1;
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 2. 마우스 이동
        handler.setInputAction(function(event) {
            if (activeShapePoints.length > 0 && activeShape) {
                const ray = viewer.camera.getPickRay(event.endPosition);
                const movePosition = viewer.scene.globe.pick(ray, viewer.scene);
                
                if (Cesium.defined(movePosition)) {
                    activeShapePoints[activeShapePoints.length - 1] = movePosition;
                    if (floatingPoint) {
                        floatingPoint.position.setValue(movePosition);
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 3. 마우스 더블클릭 (종료)
        handler.setInputAction(function(event) {
            if (activeShapePoints.length < 2) return;

            // 더블클릭 시 추가되는 가이드 포인트 제거
            activeShapePoints.pop(); 
            
            // 정적 폴리라인 생성
            drawStaticPolyline(activeShapePoints);

            // UI 요소 제거 및 초기화
            clearUIElements();

            activeShapePoints = [];
            activeShape = null;
            floatingPoint = null;
            isEditing = false;
            editingPolyline = null;

            viewer.selectedEntity = undefined;
            viewer.trackedEntity = undefined;

            bindEvents();
            
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function clearUIElements() {
        if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = null; }
        if (activeShape) { viewer.entities.remove(activeShape); activeShape = null; }
        markerEntities.forEach(m => viewer.entities.remove(m));
        markerEntities = [];
    }

    function deactivate() {
        if (handler) {
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
    }

    function reset() {
        deactivate();
        clearUIElements();

        drawnPolylines.forEach(p => viewer.entities.remove(p));
        drawnPolylines = [];
        
        activeShapePoints = [];
        activeShape = null;
        isEditing = false;
        editingPolyline = null;

        viewer.selectedEntity = undefined;
        viewer.trackedEntity = undefined;
        
        bindEvents();
    }

    return {
        activate,
        reset,
        deactivate
    };
})();
