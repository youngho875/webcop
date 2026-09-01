// polygonDrawingWithLatLon.js
/*
(function() {
    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;

    // 위경도 좌표에 점 생성
    function createPoint(latitude, longitude) {
        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        return window.viewer.entities.add({
            position: position,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    // 위경도 좌표로 폴리곤 그리기
    function drawShape(positionData) {
        if (activeShape) {
            window.viewer.entities.remove(activeShape);
        }
        activeShape = window.viewer.entities.add({
            polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positionData),
                material: new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.5)),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(window.viewer.canvas);

    // 좌클릭으로 점 추가
    handler.setInputAction(function(event) {
        const earthPosition = window.viewer.scene.pickPosition(event.position);
        if (Cesium.defined(earthPosition)) {
            const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);

            activeShapePoints.push(Cesium.Cartesian3.fromDegrees(longitude, latitude));

            if (activeShapePoints.length === 1) {
                floatingPoint = createPoint(latitude, longitude);
                const dynamicPositions = new Cesium.CallbackProperty(function() {
                    return new Cesium.PolygonHierarchy(activeShapePoints);
                }, false);
                drawShape(dynamicPositions);
            } else {
                createPoint(latitude, longitude);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 마우스 이동으로 폴리곤 이어가기
    handler.setInputAction(function(event) {
        if (Cesium.defined(floatingPoint)) {
            const newPosition = window.viewer.scene.pickPosition(event.endPosition);
            if (Cesium.defined(newPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(newPosition);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);

                floatingPoint.position.setValue(Cesium.Cartesian3.fromDegrees(longitude, latitude));
                activeShapePoints.pop();
                activeShapePoints.push(Cesium.Cartesian3.fromDegrees(longitude, latitude));
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 우클릭으로 폴리곤 종료
    handler.setInputAction(function(event) {
        if (activeShapePoints.length > 2) {
            window.viewer.entities.remove(floatingPoint);
            floatingPoint = undefined;
            activeShapePoints = [];
            activeShape = undefined;
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
})();
*/

/*
// polygonDrawingWithPickEllipsoid.js

(function() {
    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;

    // 위경도로부터 점 생성
    function createPoint(worldPosition) {
        return window.viewer.entities.add({
            position: worldPosition,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    // 폴리곤 생성
    function drawShape(positionData) {
        if (activeShape) {
            window.viewer.entities.remove(activeShape);
        }
        activeShape = window.viewer.entities.add({
            polygon: {
                hierarchy: positionData,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.7)),
                clampToGround: true
            }
        });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(window.viewer.canvas);

    // 좌클릭으로 점 추가
    handler.setInputAction(function(event) {
        const earthPosition = window.viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
        
        if (Cesium.defined(earthPosition)) {
            const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);

            console.log(`위도: ${latitude}, 경도: ${longitude}`); // 위경도 콘솔 출력

            activeShapePoints.push(position);

            if (activeShapePoints.length === 1) {
                floatingPoint = createPoint(position);
                const dynamicPositions = new Cesium.CallbackProperty(function() {
                    return new Cesium.PolygonHierarchy(activeShapePoints);
                }, false);
                drawShape(dynamicPositions);
            } else {
                createPoint(position);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 마우스 이동 시 실시간 폴리곤 업데이트
    handler.setInputAction(function(event) {
        if (Cesium.defined(floatingPoint)) {
            const newPosition = window.viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(newPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(newPosition);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);

                floatingPoint.position.setValue(position);
                activeShapePoints.pop();
                activeShapePoints.push(position);
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 우클릭으로 폴리곤 완료
    handler.setInputAction(function(event) {
        if (activeShapePoints.length > 2) {
            window.viewer.entities.remove(floatingPoint);
            drawShape(activeShapePoints); // 최종적으로 폴리곤을 완성함
            floatingPoint = undefined;
            activeShapePoints = [];
            activeShape = undefined;
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

})();

*/



// polygonDrawingWithPickEllipsoid.js

window.PolygonDrawing = (function() {
    const viewer = window.CesiumViewer;
    
    let activeShapePoints = [];  // 현재 드로잉/편집 중인 꼭짓점 목록 (Cartesian3)
    let activeShape = null;      // 동적 가이드용 폴리곤 엔티티
    let floatingPoint = null;    // 마우스 커서를 따라다니는 임시 포인트 엔티티
    let markerEntities = [];     // 현재 화면에 배치된 꼭짓점 마커 엔티티 배열
    let drawnPolygons = [];      // 최종 확정된 고정 폴리곤 배열
    let polygonSequence = 0;

    function formatCoordinateList(positions) {
        return positions.map(position => {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            return `${Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)} ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)}`;
        }).join(', ');
    }

    function parseCoordinateList(text) {
        const entries = String(text || '').split(',').map(item => item.trim()).filter(Boolean);
        if (entries.length < 3) return null;
        const coordinates = entries.map(entry => entry.split(/\s+/).map(Number));
        if (coordinates.some(pair => pair.length !== 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[0]) > 180 || Math.abs(pair[1]) > 90)) return null;
        return coordinates.map(([longitude, latitude]) => Cesium.Cartesian3.fromDegrees(longitude, latitude));
    }
    
    let isEditing = false;       // 현재 기존 폴리곤을 편집 중인지 여부
    let editingPolygon = null;   // 현재 편집 대상이 된 폴리곤 인스턴스

    // 팝업 HTML 요소 초기화 및 주입
    const popup = document.createElement('div');
    popup.id = 'popup';
    popup.style.cssText = `
        position: absolute;
        background: rgba(255, 255, 255, 0.95);
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #ccc;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        color: #333;
        min-width: 180px;
        max-width: 250px;
        z-index: 999;
        display: none;
        pointer-events: none;
    `;
    if (!document.getElementById('popup')) {
        document.body.appendChild(popup);
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    function pickGroundPosition(screenPosition) {
        const ray = viewer.camera.getPickRay(screenPosition);
        let position = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (!Cesium.defined(position) && viewer.scene.pickPositionSupported) position = viewer.scene.pickPosition(screenPosition);
        return position;
    }

    // 📍 꼭짓점 마커 생성 헬퍼
    function createPoint(worldPosition, index) {
        const entity = viewer.entities.add({
            position: worldPosition,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 8,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        entity.customIndex = index; 
        markerEntities.push(entity);
        return entity;
    }

    // 🎨 CallbackProperty 기반 동적 가이드 폴리곤 생성
    function drawDynamicShape() {
        const style = window.ShapeDrawingCore?.getStyle?.() || {};
        const fill = window.ShapeDrawingCore?.fillMaterial?.(style) || Cesium.Color.BLUE.withAlpha(0.4);
        const lineColor = Cesium.Color.fromCssColorString(style.lineColor || '#0000ff').withAlpha((style.lineOpacity ?? 100) / 100);
        return viewer.entities.add({
            polygon: {
                hierarchy: new Cesium.CallbackProperty(() => {
                    return new Cesium.PolygonHierarchy(activeShapePoints);
                }, false),
                material: fill,
                outline: style.lineType !== 'none',
                outlineColor: lineColor,
                outlineWidth: style.lineWidth || 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                classificationType: Cesium.ClassificationType.BOTH
            }
        });
    }

    // 💾 확정 고정 폴리곤 생성 함수
    function drawStaticPolygon(points) {
        const style = window.ShapeDrawingCore?.getStyle?.() || {};
        style.coordinateGeometry = true;
        style.coordinateText = formatCoordinateList(points);
        const fill = window.ShapeDrawingCore?.fillMaterial?.(style) || Cesium.Color.BLUE.withAlpha(0.3);
        const entity = viewer.entities.add({
            name: String(style.shapeName || ('폴리곤' + (++polygonSequence))).trim(),
            polygon: {
                hierarchy: new Cesium.PolygonHierarchy(points),
                material: fill,
                outline: false,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                classificationType: Cesium.ClassificationType.BOTH
            },
            polyline: {
                positions: new Cesium.CallbackProperty(() => activeShapePoints.length > 1 ? [...activeShapePoints, activeShapePoints[0]] : activeShapePoints, false),
                width: Math.max(2, Number(style.lineWidth) || 2),
                material: window.ShapeDrawingCore?.lineMaterial?.({ ...style, lineType: 'solid' }) || lineColor,
                clampToGround: true
            }
        });
        const outlineEntity = viewer.entities.add({
            show: style.lineType !== 'none',
            polyline: {
                positions: points.concat([points[0]]),
                width: Math.max(1, Number(style.lineWidth) || 2),
                material: window.ShapeDrawingCore?.lineMaterial?.(style) || Cesium.Color.BLUE,
                clampToGround: true,
                arcType: Cesium.ArcType.GEODESIC
            }
        });
        outlineEntity._drawingOwner = entity;
        window.ShapeDrawingCore?.attachEditor?.(viewer, entity, '폴리곤 설정/편집', style, nextStyle => {
            const editedPositions = parseCoordinateList(nextStyle.coordinateText);
            if (!editedPositions) {
                window.alert('좌표를 "경도 위도, 경도 위도, ..." 형식으로 3개 이상 입력하세요.');
                return;
            }
            points = editedPositions;
            entity.name = String(nextStyle.shapeName || entity.name).trim();
            entity.customData.displayName = entity.name;
            entity.polygon.hierarchy = new Cesium.PolygonHierarchy(points);
            entity.polygon.material = window.ShapeDrawingCore.fillMaterial(nextStyle);
            outlineEntity.show = nextStyle.lineType !== 'none';
            outlineEntity.polyline.positions = points.concat([points[0]]);
            outlineEntity.polyline.width = Math.max(1, Number(nextStyle.lineWidth) || 1);
            outlineEntity.polyline.material = window.ShapeDrawingCore.lineMaterial(nextStyle);
            entity.customPoints = [...points];
            document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
            viewer.scene.requestRender();
        });
        entity.customPoints = [...points];
        entity.customData = { drawingType: 'polygon', displayName: entity.name, subEntities: [outlineEntity] };
        drawnPolygons.push(entity);
        document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity } }));
        return entity;
    }

    // 🚀 모듈 시작 시 딱 한 번 이벤트를 바인딩하는 진입점
    function activate() {
        deactivate();
        clearUIElements();
        activeShapePoints = [];
        activeShape = null;
        floatingPoint = null;
        isEditing = false;
        editingPolygon = null;
        bindEvents();
    }

    function bindDragEvents() {
        deactivate();
        let dragging = false;
        const pickPosition = position => {
            const ray = viewer.camera.getPickRay(position);
            let result = ray && viewer.scene.globe.pick(ray, viewer.scene);
            if (!Cesium.defined(result)) {
                result = viewer.scene.pickPositionSupported ? viewer.scene.pickPosition(position) : undefined;
            }
            return result;
        };
        handler.setInputAction(event => {
            const picked = viewer.scene.pick(event.position);
            if (Cesium.defined(picked) && picked.id?._areaStyleEditor) {
                viewer.selectedEntity = picked.id.customData?.groupEntity || picked.id;
                return;
            }
            const start = pickPosition(event.position);
            if (!Cesium.defined(start)) return;
            clearUIElements();
            activeShapePoints = [start, start, start];
            activeShape = drawDynamicShape();
            dragging = true;
            viewer.scene.screenSpaceCameraController.enableInputs = false;
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        handler.setInputAction(event => {
            if (!dragging) return;
            const position = pickPosition(event.endPosition);
            if (!Cesium.defined(position)) return;
            if (activeShapePoints.length === 3 &&
                Cesium.Cartesian3.distance(activeShapePoints[0], activeShapePoints[1]) === 0) {
                activeShapePoints[1] = position;
                activeShapePoints[2] = position;
                return;
            }
            const last = activeShapePoints[activeShapePoints.length - 1];
            if (Cesium.Cartesian3.distance(last, position) > 1) activeShapePoints.push(position);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.setInputAction(event => {
            if (!dragging) return;
            const end = pickPosition(event.position);
            if (Cesium.defined(end)) activeShapePoints.push(end);
            if (activeShapePoints.length >= 4) drawStaticPolygon(activeShapePoints);
            clearUIElements();
            activeShapePoints = [];
            dragging = false;
            viewer.scene.screenSpaceCameraController.enableInputs = true;
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    function bindEvents() {
        deactivate(); // 중복 리스너 등록 방지

        // 1. 마우스 좌클릭 (꼭짓점 추가 또는 완료된 폴리곤 클릭 시 편집 모드 활성화)
        handler.setInputAction(function(event) {
            const pickedObject = viewer.scene.pick(event.position);

            // 💡 [A] 아무것도 안 그리고 있을 때 확정된 폴리곤을 클릭한 경우 -> 편집 모드 활성화
            if (activeShapePoints.length === 0 && Cesium.defined(pickedObject) && pickedObject.id && drawnPolygons.includes(pickedObject.id)) {
                editingPolygon = pickedObject.id;
                isEditing = true;

                // 기존 확정 풀에서 제외 후 엔티티 임시 제거
                drawnPolygons = drawnPolygons.filter(p => p.id !== editingPolygon.id);
                activeShapePoints = [...editingPolygon.customPoints];
                viewer.entities.remove(editingPolygon);

                // 꼭짓점 제어용 마커 배치
                activeShapePoints.forEach((pt, idx) => {
                    createPoint(pt, idx);
                });

                // 편집 중 실시간 렌더링용 동적 폴리곤 구동
                activeShape = drawDynamicShape();
                return;
            }

            // 지형/건물 고도 픽킹
            const earthPosition = pickGroundPosition(event.position);
            if (!Cesium.defined(earthPosition)) return;

            // [B] 신규 작도 첫 노드 배치
            if (activeShapePoints.length === 0) {
                activeShapePoints.push(earthPosition); // 고정 첫 노드
                activeShapePoints.push(earthPosition); // 마우스 무브 추적용 가이드 노드
                
                createPoint(earthPosition, 0);
                floatingPoint = createPoint(earthPosition, 1);
                
                activeShape = drawDynamicShape();
            } else {
                // [C] 신규 꼭짓점 추가 적치 (가이드 노드 직전 인덱스에 삽입)
                const insertIdx = activeShapePoints.length - 1;
                activeShapePoints.splice(insertIdx, 0, earthPosition);
                createPoint(earthPosition, insertIdx);
                
                if (floatingPoint) {
                    floatingPoint.customIndex = activeShapePoints.length - 1;
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 2. 마우스 이동 (신규 작도 가이드 또는 마우스 오버 팝업)
        handler.setInputAction(function(event) {
            const movePosition = pickGroundPosition(event.endPosition);
            
            // 드로잉/편집 진행 중일 때 마우스 위치 실시간 반영
            if (activeShapePoints.length > 0 && activeShape && Cesium.defined(movePosition)) {
                activeShapePoints[activeShapePoints.length - 1] = movePosition;
                if (floatingPoint) {
                    floatingPoint.position.setValue(movePosition);
                }
                return;
            }

            // 평상시 폴리곤 위 마우스 오버 시 정보 팝업 출력
            if (Cesium.defined(movePosition)) {
                const picked = viewer.scene.pick(event.endPosition);
                if (Cesium.defined(picked) && drawnPolygons.includes(picked.id)) {
                    const carto = Cesium.Cartographic.fromCartesian(movePosition);
                    const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
                    const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);

                    popup.innerHTML = `<strong>클릭 시 편집 가능</strong><br>위도: ${lat}<br>경도: ${lon}`;

                    const screenCoords = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene,  movePosition);
                    if (!Cesium.defined(screenCoords)) {
                    return;
                    } else if(screenCoords){
                        popup.style.left = screenCoords.x + 12 + 'px';
                        popup.style.top = screenCoords.y - 35 + 'px';
                        popup.style.display = 'block';
                    } else {
                        popup.style.display = 'none';
                    }

                //     const x = windowPosition.x;
                //     const y = windowPosition.y;


                //     const screenCoords = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, movePosition);
                //     if (screenCoords) {
                //         popup.style.left = screenCoords.x + 12 + 'px';
                //         popup.style.top = screenCoords.y - 35 + 'px';
                //         popup.style.display = 'block';
                //     }
                // } else {
                //     popup.style.display = 'none';
                // }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 3. 마우스 더블클릭 (작도/편집 모드 완전 종료 및 확정)
        handler.setInputAction(function(event) {
            if (activeShapePoints.length < 4) return; // 유효 점 개수 체크 (가이드 점 포함 최소 4개)

            // Cesium 카메라 기본 더블클릭 줌 현상 차단
            if (viewer.screenSpaceEventHandler) {
                viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            }

            // 마우스를 따라다니는 마지막 가이드 좌표와 더블클릭 중복점을 제거한다.
            activeShapePoints.pop();
            while (activeShapePoints.length > 1 && Cesium.Cartesian3.distance(activeShapePoints[activeShapePoints.length - 1], activeShapePoints[activeShapePoints.length - 2]) < 0.01) activeShapePoints.pop();

            if (activeShapePoints.length < 3) return;

            // 정적 폴리곤 확정 생성 및 고정
            drawStaticPolygon(activeShapePoints);

            // 가이드라인 및 꼭짓점 UI 팩 리셋 제거
            clearUIElements();

            // 내부 메모리 변수 상태 기본값 초기화
            activeShapePoints = [];
            activeShape = null;
            floatingPoint = null;
            isEditing = false;
            editingPolygon = null;

            viewer.selectedEntity = undefined;
            viewer.trackedEntity = undefined;

            // 💡 [핵심 버그 수정] 그리기 이벤트를 강제로 완전히 해제하지 않고, 
            // 다시 클릭했을 때 새 드로잉이 시작되거나 기존 폴리곤을 선택할 수 있는 대기 리스너 상태 유지
            bindEvents();
            
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function clearUIElements() {
        if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = null; }
        if (activeShape) { viewer.entities.remove(activeShape); activeShape = null; }
        markerEntities.forEach(m => viewer.entities.remove(m));
        markerEntities = [];
    }

    // 마우스 이벤트 핸들러 초기화
    function deactivate() {
        if (handler) {
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);
        }
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        popup.style.display = 'none';
    }

    // 완전히 전체 레이어를 클리어하고 대기할 때 호출
    function reset() {
        deactivate();
        clearUIElements();

        drawnPolygons.forEach(p => {
            (p.customData?.subEntities || []).forEach(entity => viewer.entities.remove(entity));
            viewer.entities.remove(p);
        });
        drawnPolygons = [];
        
        activeShapePoints = [];
        activeShape = null;
        isEditing = false;
        editingPolygon = null;

        viewer.selectedEntity = undefined;
        viewer.trackedEntity = undefined;
        
        // 완전히 리셋 후 다시 빈 캔버스 핸들러 바인딩 대기
        bindEvents();
    }

    return {
        activate,
        reset,
        deactivate
    };
})();


 /*  
    // 폴리곤 선택 이벤트
    handler.setInputAction(function(event) {
        const pickedObject = window.viewer.scene.pick(event.position);
        if (Cesium.defined(pickedObject) && pickedObject.id.polygon) 
        {
            // 기존 선택된 폴리곤의 색상 초기화
            if (selectedPolygon) {
                selectedPolygon.polygon.material.color.setValue(Cesium.Color.BLUE.withAlpha(0.7));
            }

            // 클릭한 폴리곤 선택
            selectedPolygon = pickedObject.id;
            selectedPolygon.polygon.material.color.setValue(Cesium.Color.YELLOW.withAlpha(0.7));
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
*/  

