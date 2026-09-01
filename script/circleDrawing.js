window.circleDrawing = (function() {
    const viewer = window.CesiumViewer;
    
    let centerPosition = null;  // 중심점 좌표 (Cartesian3)
    let targetPosition = null;  // 외곽선 반지름 조절용 좌표 (Cartesian3)
    let currentRadius = 0;      // 현재 계산된 반지름(m)
    let currentMajorRadius = 1;
    let currentMinorRadius = 1;
    let currentRotation = 0;
    let currentShapeType = 'circle';

    let activeCircle = null;    // 현재 그리고 있거나 편집 중인 원 엔티티
    let centerPointMarker = null; // 중심점 노란 마커
    let edgePointMarker = null;   // 외곽 조절용 노란 마커

    let trackedEntities = [];   // 확정된 원들을 담아두는 배열
    let circleSequence = 0;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

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
        return entity;
    }

    // 🎨 CallbackProperty를 활용한 동적 원 생성 함수
    function drawDynamicCircle() {
        const style = window.ShapeDrawingCore?.getStyle?.() || {};
        const fill = window.ShapeDrawingCore?.fillMaterial?.(style) || Cesium.Color.BLUE.withAlpha(0.4);
        const lineColor = Cesium.Color.fromCssColorString(style.lineColor || '#0000ff').withAlpha((style.lineOpacity ?? 100) / 100);
        return viewer.entities.add({
            position: new Cesium.CallbackProperty(() => centerPosition, false),
            ellipse: {
                semiMajorAxis: new Cesium.CallbackProperty(() => currentShapeType === 'ellipse' ? currentMajorRadius : currentRadius, false),
                semiMinorAxis: new Cesium.CallbackProperty(() => currentShapeType === 'ellipse' ? currentMinorRadius : currentRadius, false),
                rotation: new Cesium.CallbackProperty(() => currentShapeType === 'ellipse' ? currentRotation : 0, false),
                material: fill,
                outline: style.lineType !== 'none',
                outlineColor: lineColor,
                outlineWidth: style.lineWidth || 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                classificationType: Cesium.ClassificationType.BOTH // 지형 및 3D 건물 위 밀착
            },
            polyline: {
                positions: new Cesium.CallbackProperty(() => circleOutlinePositions(centerPosition, currentShapeType === 'ellipse' ? currentMajorRadius : currentRadius, currentShapeType === 'ellipse' ? currentMinorRadius : currentRadius, currentShapeType === 'ellipse' ? currentRotation : 0, 96), false),
                width: Math.max(2, Number(style.lineWidth) || 2),
                material: window.ShapeDrawingCore?.lineMaterial?.({ ...style, lineType: 'solid' }) || lineColor,
                clampToGround: true
            }
        });
    }

    function circleOutlinePositions(center, majorRadius, minorRadius = majorRadius, rotation = 0, segments = 128) {
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
        const positions = [];
        // Cesium EllipseGraphics와 동일하게 동쪽 축을 0으로 두고 회전한다.
        const eastAngle = rotation;
        const cosRotation = Math.cos(eastAngle);
        const sinRotation = Math.sin(eastAngle);
        for (let i = 0; i <= segments; i++) {
            const angle = i * Cesium.Math.TWO_PI / segments;
            const x = Math.cos(angle) * majorRadius;
            const y = Math.sin(angle) * minorRadius;
            const local = new Cesium.Cartesian3(x * cosRotation - y * sinRotation, x * sinRotation + y * cosRotation, 0);
            positions.push(Cesium.Matrix4.multiplyByPoint(transform, local, new Cesium.Cartesian3()));
        }
        return positions;
    }

    // 💾 고정된 값으로 정적 원 확정 보존 함수
    function drawStaticCircle(center, radius, shapeType = 'circle', majorRadius = radius, minorRadius = radius, ellipseRotation = 0) {
        const style = window.ShapeDrawingCore?.getStyle?.() || {};
        const centerCartographic = Cesium.Cartographic.fromCartesian(center);
        const editorStyle = {
            ...style,
            circleGeometry: true,
            circleShapeType: shapeType,
            circleLongitude: Cesium.Math.toDegrees(centerCartographic.longitude),
            circleLatitude: Cesium.Math.toDegrees(centerCartographic.latitude),
            circleRadius: radius,
            circleMajorRadius: majorRadius,
            circleMinorRadius: minorRadius
        };
        const fill = window.ShapeDrawingCore?.fillMaterial?.(style) || Cesium.Color.BLUE.withAlpha(0.3);
        const entity = viewer.entities.add({
            name: String(style.shapeName || ('원' + (++circleSequence))).trim(),
            position: center,
            ellipse: {
                semiMajorAxis: majorRadius,
                semiMinorAxis: minorRadius,
                rotation: ellipseRotation,
                material: fill,
                outline: false,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                classificationType: Cesium.ClassificationType.BOTH
            }
        });
        const outlineEntity = viewer.entities.add({
            show: style.lineType !== 'none',
            polyline: {
                positions: circleOutlinePositions(center, majorRadius, minorRadius, ellipseRotation),
                width: Math.max(1, Number(style.lineWidth) || 2),
                material: window.ShapeDrawingCore?.lineMaterial?.(style) || Cesium.Color.BLUE,
                clampToGround: true,
                arcType: Cesium.ArcType.GEODESIC
            }
        });
        outlineEntity._drawingOwner = entity;
        window.ShapeDrawingCore?.attachEditor?.(viewer, entity, '원 설정/편집', editorStyle, nextStyle => {
            const longitude = Number(nextStyle.circleLongitude);
            const latitude = Number(nextStyle.circleLatitude);
            const shapeType = nextStyle.circleShapeType === 'ellipse' ? 'ellipse' : 'circle';
            const nextRadius = Number(nextStyle.circleRadius);
            const majorRadius = shapeType === 'ellipse' ? Number(nextStyle.circleMajorRadius) : nextRadius;
            const minorRadius = shapeType === 'ellipse' ? Number(nextStyle.circleMinorRadius) : nextRadius;
            if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(majorRadius) || majorRadius < 1 || !Number.isFinite(minorRadius) || minorRadius < 1 || majorRadius < minorRadius) {
                window.alert('중심좌표와 반지름을 확인하세요. 타원형의 장축 반지름은 단축 반지름보다 크거나 같아야 합니다.');
                return;
            }
            center = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
            radius = shapeType === 'circle' ? nextRadius : majorRadius;
            entity.name = String(nextStyle.shapeName || entity.name).trim();
            entity.customData.displayName = entity.name;
            entity.position = center;
            entity.ellipse.semiMajorAxis = majorRadius;
            entity.ellipse.semiMinorAxis = minorRadius;
            entity.ellipse.material = window.ShapeDrawingCore.fillMaterial(nextStyle);
            outlineEntity.show = nextStyle.lineType !== 'none';
            entity.ellipse.rotation = shapeType === 'ellipse' ? ellipseRotation : 0;
            outlineEntity.polyline.positions = circleOutlinePositions(center, majorRadius, minorRadius, shapeType === 'ellipse' ? ellipseRotation : 0);
            outlineEntity.polyline.width = Math.max(1, Number(nextStyle.lineWidth) || 1);
            outlineEntity.polyline.material = window.ShapeDrawingCore.lineMaterial(nextStyle);
            entity.customData.center = center;
            entity.customData.radius = radius;
            entity.customData.majorRadius = majorRadius;
            entity.customData.minorRadius = minorRadius;
            entity.customData.drawingType = shapeType;
            nextStyle.circleShapeType = shapeType;
            nextStyle.circleMajorRadius = majorRadius;
            nextStyle.circleMinorRadius = minorRadius;
            document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
            viewer.scene.requestRender();
        });
        // 원래 반지름과 중심 데이터를 커스텀 속성으로 바인딩 (클릭 편집용)
        entity.customData = { center: center, radius: radius, majorRadius, minorRadius, ellipseRotation, drawingType: shapeType, displayName: entity.name, subEntities: [outlineEntity] };
        trackedEntities.push(entity);
        document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity } }));
        return entity;
    }

    function activate() {
        deactivate();
        currentShapeType = window.AreaStylePanel?.getStyle?.()?.circleShapeType === 'ellipse' ? 'ellipse' : 'circle';
        if (centerPointMarker) viewer.entities.remove(centerPointMarker);
        if (edgePointMarker) viewer.entities.remove(edgePointMarker);
        if (activeCircle) viewer.entities.remove(activeCircle);
        centerPointMarker = edgePointMarker = activeCircle = null;
        centerPosition = targetPosition = null;
        currentRadius = 0;
        currentMajorRadius = currentMinorRadius = 1;
        currentRotation = 0;
        bindDragEvents();
    }

    function updateDragAxes(position) {
        if (!centerPosition || !Cesium.defined(position)) return;
        currentRadius = Math.max(1, Cesium.Cartesian3.distance(centerPosition, position));
        if (currentShapeType !== 'ellipse') {
            currentMajorRadius = currentMinorRadius = currentRadius;
            currentRotation = 0;
            return;
        }
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(centerPosition);
        const inverse = Cesium.Matrix4.inverseTransformation(transform, new Cesium.Matrix4());
        const local = Cesium.Matrix4.multiplyByPoint(inverse, position, new Cesium.Cartesian3());
        const eastRadius = Math.max(1, Math.abs(local.x));
        const northRadius = Math.max(1, Math.abs(local.y));
        currentMajorRadius = Math.max(eastRadius, northRadius);
        currentMinorRadius = Math.min(eastRadius, northRadius);
        currentRotation = eastRadius >= northRadius ? 0 : Math.PI / 2;
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
            centerPosition = start;
            targetPosition = start;
            currentRadius = 1;
            currentMajorRadius = currentMinorRadius = 1;
            currentRotation = 0;
            centerPointMarker = createPoint(start);
            edgePointMarker = createPoint(start);
            activeCircle = drawDynamicCircle();
            dragging = true;
            viewer.scene.screenSpaceCameraController.enableInputs = false;
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        handler.setInputAction(event => {
            if (!dragging || !centerPosition) return;
            const position = pickPosition(event.endPosition);
            if (!Cesium.defined(position)) return;
            targetPosition = position;
            updateDragAxes(targetPosition);
            if (edgePointMarker) edgePointMarker.position.setValue(targetPosition);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.setInputAction(event => {
            if (!dragging || !centerPosition) return;
            const end = pickPosition(event.position);
            if (Cesium.defined(end)) updateDragAxes(end);
            drawStaticCircle(centerPosition, currentRadius, currentShapeType, currentMajorRadius, currentMinorRadius, currentRotation);
            if (centerPointMarker) viewer.entities.remove(centerPointMarker);
            if (edgePointMarker) viewer.entities.remove(edgePointMarker);
            if (activeCircle) viewer.entities.remove(activeCircle);
            centerPointMarker = edgePointMarker = activeCircle = null;
            centerPosition = targetPosition = null;
            currentRadius = 0;
            currentMajorRadius = currentMinorRadius = 1;
            currentRotation = 0;
            dragging = false;
            viewer.scene.screenSpaceCameraController.enableInputs = true;
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    function bindEvents() {
        // 1. 마우스 단일 좌클릭 (그리기 시작 또는 기존 원 선택하여 편집 모드 진입)
        handler.setInputAction(function(click) {
            // 오브젝트 픽킹 테스트 (기존에 그려진 원이 있는지 확인)
            const pickedObject = viewer.scene.pick(click.position);
            
            // [A] 아무것도 안 그리고 있을 때 기존 원을 클릭한 경우 -> 편집 모드 재진입
            if (!centerPosition && Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.ellipse && pickedObject.id.customData) {
                const selectedCircle = pickedObject.id;
                
                // 기존 확정 목록에서 삭제하고 편집 대상으로 전환
                trackedEntities = trackedEntities.filter(e => e.id !== selectedCircle.id);
                viewer.entities.remove(selectedCircle);

                centerPosition = selectedCircle.customData.center;
                currentRadius = selectedCircle.customData.radius;
                
                // 현재 반지름 기준 외곽 조절점 위치 계산
                const heading = Cesium.Math.toRadians(0);
                const angle = Cesium.Matrix3.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(heading, 0, 0));
                const offset = Cesium.Matrix3.multiplyByVector(angle, new Cesium.Cartesian3(0, currentRadius, 0), new Cesium.Cartesian3());
                targetPosition = Cesium.Cartesian3.add(centerPosition, offset, new Cesium.Cartesian3());

                // 가이드 헬퍼 인터페이스 배치 및 동적 원 활성화
                centerPointMarker = createPoint(centerPosition);
                edgePointMarker = createPoint(targetPosition);
                activeCircle = drawDynamicCircle();
                return;
            }

            // [B] 첫 클릭 시: 그리기 시작 (중심점 지정)
            const earthPosition = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(earthPosition)) return;

            if (!centerPosition) {
                centerPosition = earthPosition;
                targetPosition = earthPosition;
                currentRadius = 0;

                centerPointMarker = createPoint(centerPosition);
                edgePointMarker = createPoint(targetPosition);
                activeCircle = drawDynamicCircle();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 2. 마우스 이동 (실시간 반경 크기 업데이트 가이드)
        handler.setInputAction(function(movement) {
            if (!centerPosition || !activeCircle) return;

            const newPosition = viewer.scene.pickPosition(movement.endPosition);
            if (Cesium.defined(newPosition)) {
                targetPosition = newPosition;
                if (edgePointMarker) {
                    edgePointMarker.position.setValue(targetPosition);
                }
                // 중심점과 마우스 커서 사이의 거리를 구해 실시간 반지름 반영
                currentRadius = Cesium.Cartesian3.distance(centerPosition, targetPosition);
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 3. 마우스 더블클릭 (원 그리기/편집 완료 및 고정 종료)
        handler.setInputAction(function(event) {
            if (!centerPosition) return;

            // 💡 Cesium 기본 카메라 더블클릭 화면 줌인 현상 차단
            if (viewer.screenSpaceEventHandler) {
                viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            }

            // 현재 가이드 반지름 스펙으로 정적 원 엔티티 확정 생성
            drawStaticCircle(centerPosition, currentRadius);

            // 가이드 인터페이스 UI 요소 청소
            if (centerPointMarker) { viewer.entities.remove(centerPointMarker); centerPointMarker = null; }
            if (edgePointMarker) { viewer.entities.remove(edgePointMarker); edgePointMarker = null; }
            if (activeCircle) { viewer.entities.remove(activeCircle); activeCircle = null; }

            // 변수 상태 리셋 (다시 단일 클릭으로 원을 선택할 수 있는 대기 상태)
            centerPosition = null;
            targetPosition = null;
            currentRadius = 0;

            // 💡 선택/트래킹 강제 취소
            viewer.selectedEntity = undefined;
            viewer.trackedEntity = undefined;

            // 더블클릭 리스너 재등록 처리를 위해 이벤트 핸들러 초기 결합 유지
            bindEvents(); 
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function deactivate() {
        if (handler) {
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);
        }
        viewer.scene.screenSpaceCameraController.enableInputs = true;
    }

    // 완전히 화면을 리셋하여 청소할 때 호출
    function reset() {
        deactivate();

        if (centerPointMarker) { viewer.entities.remove(centerPointMarker); centerPointMarker = null; }
        if (edgePointMarker) { viewer.entities.remove(edgePointMarker); edgePointMarker = null; }
        if (activeCircle) { viewer.entities.remove(activeCircle); activeCircle = null; }

        trackedEntities.forEach(entity => {
            (entity.customData?.subEntities || []).forEach(subEntity => viewer.entities.remove(subEntity));
            viewer.entities.remove(entity);
        });

        trackedEntities = [];
        centerPosition = null;
        targetPosition = null;
        currentRadius = 0;

        viewer.selectedEntity = undefined;
        viewer.trackedEntity = undefined;
    }

    return {
        activate,
        reset,
        deactivate
    };
})();
