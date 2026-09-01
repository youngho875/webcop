window.distance = (function() {
    const viewer = window.CesiumViewer;
    let positions = [];
    let trackedEntities = []; // 생성된 모든 포인트/라인/라벨 관리 배열
    let tempLine = null;
    let floatingPoint = null;
    let floatingLabel = null; // 마우스 커서를 따라다닐 실시간 가이드 라벨

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    // 헬퍼: 거리 포맷팅 (m 단위를 km로 자동 변환)
    function formatDistance(meters) {
        return meters >= 1000 
            ? `${(meters / 1000).toFixed(2)} km` 
            : `${meters.toFixed(1)} m`;
    }

    // 헬퍼: 3차원 공간 실제 거리 계산 (고도 차이 반영)
    function getDistance3D(p1, p2) {
        if (!p1 || !p2) return 0;
        return Cesium.Cartesian3.distance(p1, p2);
    }

    // 헬퍼: 현재까지 확정된 점들의 총 누적 거리 계산
    function getAccumulatedDistance(posArray) {
        let distance = 0;
        const limit = posArray.length - 1; 
        for (let i = 0; i < limit - 1; i++) {
            distance += getDistance3D(posArray[i], posArray[i + 1]);
        }
        return distance;
    }

    // 📍 점 생성 함수 (노란색 원 스타일 적용)
    function createPoint(position) {
        const entity = viewer.entities.add({
            position: position,
            point: {
                pixelSize: 8,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
        });
        trackedEntities.push(entity);
        return entity;
    }

    function drawLine() {
        const entity = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => positions, false),
                width: 3,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Cesium.Color.CYAN
                }),
                clampToGround: true
            },
        });
        trackedEntities.push(entity);
        return entity;
    }

    function showDistanceLabel(position, text, isFloating = false) {
        const entity = viewer.entities.add({
            position: position,
            label: {
                text: text,
                font: "12px sans-serif",
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
        });
        
        // 💡 나중에 0.0m 라벨을 판별해서 지우기 위해 커스텀 태그 속성을 부여합니다.
        entity.isDistanceLabel = true; 
        
        if (!isFloating) {
            trackedEntities.push(entity);
        }
        return entity;
    }

    function start() {
        stop(); // 기존 잔상 제거 및 완전 초기화

        // 1. 마우스 클릭 (점 추가 및 구간 거리 확정)
        handler.setInputAction(function(click) {
            const earthPosition = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(earthPosition)) return;

            if (positions.length === 0) {
                // 최초 시작점 생성 (노란색 원)
                createPoint(earthPosition);
                
                floatingPoint = viewer.entities.add({
                    position: earthPosition,
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                floatingLabel = showDistanceLabel(earthPosition, "0 m", true);
                
                positions.push(earthPosition);
                positions.push(earthPosition); // 마우스 이동용 임시 좌표
                tempLine = drawLine();
            } else {
                const lastIdx = positions.length - 2;
                const lastPosition = positions[lastIdx];
                
                // 임시 점 바로 앞에 확정 좌표 삽입
                positions.splice(positions.length - 1, 0, earthPosition); 
                createPoint(earthPosition);

                // 구간 거리 측정 라벨 생성
                const midPoint = Cesium.Cartesian3.midpoint(lastPosition, earthPosition, new Cesium.Cartesian3());
                const segmentDist = getDistance3D(lastPosition, earthPosition);
                showDistanceLabel(midPoint, formatDistance(segmentDist));
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 2. 마우스 이동 (실시간 가이드 선 및 누적 거리 피드백)
        handler.setInputAction(function(movement) {
            if (!Cesium.defined(floatingPoint) || positions.length < 2) return;

            const newPosition = viewer.scene.pickPosition(movement.endPosition);
            if (Cesium.defined(newPosition)) {
                floatingPoint.position.setValue(newPosition);
                positions[positions.length - 1] = newPosition; // 임시 좌표 실시간 갱신

                const baseDistance = getAccumulatedDistance(positions);
                const currentSegment = getDistance3D(positions[positions.length - 2], newPosition);
                const totalPending = baseDistance + currentSegment;
                
                floatingLabel.position.setValue(newPosition);
                floatingLabel.label.text = `이동 거리: ${formatDistance(totalPending)}`;
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 3. 더블 클릭 (종료 시 유령 0.0m 라벨 필터링 파괴 로직 내장)
        handler.setInputAction(function(event) {
            if (positions.length < 3) return;

            if (viewer.cesiumWidget && viewer.cesiumWidget.screenSpaceEventHandler) {
                viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            }

            // [좌표 제어] 임시 가이드 좌표 및 더블클릭 첫 타 때 유입된 중복 좌표 제거
            positions.pop(); 
            positions.pop(); 

            // 더블클릭 속도가 느려 클릭 이벤트가 유입되었을 때를 위한 추가 마감 방어
            if (positions.length > 2) {
                const pEnd = positions[positions.length - 1];
                const pPrev = positions[positions.length - 2];
                if (Cesium.Cartesian3.distance(pEnd, pPrev) < 0.5) {
                    positions.pop();
                }
            }

            // 가이드용 움직이는 요소 제거
            if (floatingLabel) { viewer.entities.remove(floatingLabel); floatingLabel = null; }
            if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = null; }

            // 💡 [버그 해결 핵심] 더블클릭 버그로 인해 렌더링된 '0.0 m' 또는 '0.00 km' 구간 라벨 일괄 삭제
            trackedEntities = trackedEntities.filter(entity => {
                if (entity.isDistanceLabel && entity.label) {
                    const text = entity.label.text.getValue(Cesium.JulianDate.now());
                    // 라벨 내용이 0.0 m 이거나 0.00 km 인 유령 엔티티를 찾아 분쇄합니다.
                    if (text === "0.0 m" || text === "0.00 km" || text.includes(" 0.0 ")) {
                        viewer.entities.remove(entity);
                        return false; // 배열에서 제외
                    }
                }
                return true;
            });

            // 최종 확정 노선 기반 총 거리 계산
            let totalDistance = 0;
            for (let i = 0; i < positions.length - 1; i++) {
                totalDistance += getDistance3D(positions[i], positions[i + 1]);
            }
            
            // 📍 최종 마감 끝점 마커 및 총 거리 표출 (더 이상 0.0m와 겹치지 않음)
            const finalPoint = positions[positions.length - 1];
            createPoint(finalPoint); 
            showDistanceLabel(finalPoint, `총 거리: ${formatDistance(totalDistance)}`);

            // 선 데이터 최종 갱신 및 고정
            tempLine.polyline.positions = [...positions];

            detachEvents();
            
            viewer.selectedEntity = undefined;
            viewer.trackedEntity = undefined;

        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function detachEvents() {
        if (handler) {
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
    }

    function stop() {
        detachEvents();

        if (floatingLabel) { viewer.entities.remove(floatingLabel); floatingLabel = null; }
        if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = null; }

        trackedEntities.forEach(entity => {
            viewer.entities.remove(entity);
        });
        
        trackedEntities = [];
        positions = [];
        tempLine = null;
        
        viewer.selectedEntity = undefined;
        viewer.trackedEntity = undefined;
    }

    return {
        start,
        stop
    };
})(); 