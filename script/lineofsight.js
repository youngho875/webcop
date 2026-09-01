/*
* 
* @param {*} dataSource Cesium.DataSource the entities that you don't want to exculded in the hit measurement
* @param {*} positionData is an array contains [startPoint, startPoint], both are Cesium.Cartesian3


var drawSightViewLine= function (dataSource, positionData) {
    var direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(positionData[1], positionData[0], new Cesium.Cartesian3()),
      new Cesium.Cartesian3());
        var ray = new Cesium.Ray(positionData[0], direction);
        var objectsToExclude = [];
    var result = viewer.scene.pickFromRay(ray, dataSource.entities.values);
        if (result !== undefined) {
            dataSource.entities.add({
                polyline: {
                    positions: [positionData[0], result.position],
                    arcType: Cesium.ArcType.NONE,
                    width: 30.0,
                    material: new Cesium.PolylineGlowMaterialProperty({
                      color: Cesium.Color.DEEPSKYBLUE,
                      glowPower: 0.05,
                    }),
                    depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
                      color: Cesium.Color.DEEPSKYBLUE,
                      glowPower: 0.05, 
                    }),

                }
            });
            dataSource.entities.add({
                polyline: {
                    positions: [result.position, positionData[1]],
                    arcType: Cesium.ArcType.NONE,
                    width: 3,
                    material: new Cesium.PolylineOutlineMaterialProperty({
                        color: Cesium.Color.RED,
                        outlineWidth: 0
                    }),
                    depthFailMaterial: new Cesium.PolylineOutlineMaterialProperty({
                        color: Cesium.Color.RED.withAlpha(0.5),
                        outlineWidth: 0
                    })

                }
            });
        } else {
            dataSource.entities.add({
                polyline: {
                    positions: positionData,
                    arcType: Cesium.ArcType.NONE,
                    width: 30.0,
                    material: new Cesium.PolylineGlowMaterialProperty({
                      color: Cesium.Color.DEEPSKYBLUE,
                      glowPower: 0.05,
                    }),
                    depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
                      color: Cesium.Color.DEEPSKYBLUE,
                      glowPower: 0.05,
                    }),

                }
            });
        }
};
*/


window.drawSightViewLine = (function() {
    const viewer = window.CesiumViewer;

    let observerPosition = null;
    let targetPosition = null;
    let floatingPoint = null;
    let tempLine = null;
    let trackedEntities = []; // LOS 관련 객체만 관리

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
        trackedEntities.push(entity);
        return entity;
    }

    // 마우스 이동 시 건물/지형 표면에 붙어 따라오는 임시 가이드 선
    function drawTempLine() {
        const entity = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => {
                    return observerPosition && targetPosition ? [observerPosition, targetPosition] : [];
                }, false),
                width: 3,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.YELLOW
                }),
                clampToGround: true // 🌟 지형 및 건물 표면 밀착
            }
        });
        trackedEntities.push(entity);
        return entity;
    }

    function start() {
        reset(); 

        // 1. 마우스 클릭 이벤트
        handler.setInputAction(clickEvent => {
            // 🌟 pickPosition은 건물(3D Tiles) 옥상이나 벽면의 위치도 정확히 가져옵니다.
            const pickedPosition = viewer.scene.pickPosition(clickEvent.position);
            if (!Cesium.defined(pickedPosition)) return;

            if (!observerPosition) {
                // [Step 1] 관측점(시작점) 설정
                observerPosition = pickedPosition;
                createPoint(observerPosition);
                
                targetPosition = pickedPosition;
                tempLine = drawTempLine();
                floatingPoint = viewer.entities.add({
                    position: new Cesium.CallbackProperty(() => targetPosition, false),
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
            } else {
                // [Step 2] 표적점(끝점) 설정 및 3D 공간 교차분석 수행
                targetPosition = pickedPosition;
                createPoint(targetPosition);

                if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = null; }
                if (tempLine) { viewer.entities.remove(tempLine); tempLine = null; }

                // 🌟 3D 레이 캐스팅 기반 분석 호출
                perform3DObjectLOSAnalysis(observerPosition, targetPosition);

                detachEvents();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 2. 마우스 이동 이벤트
        handler.setInputAction(movement => {
            if (!observerPosition) return;
            const movePosition = viewer.scene.pickPosition(movement.endPosition);
            if (Cesium.defined(movePosition)) {
                targetPosition = movePosition;
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    // 📐 [핵심] 건물 및 지형 레이 캐스팅(Ray Casting) 가시선 분석 로직
    function perform3DObjectLOSAnalysis(obsPos, tgtPos) {
        // 1. 관측점에서 표적점 방향으로의 벡터 및 Ray(광선) 생성
        const direction = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.subtract(tgtPos, obsPos, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        const ray = new Cesium.Ray(obsPos, direction);

        // 2. 🌟 3D Scene 물리 충돌 테스트 (지형 및 3D Tiles 건물 전체 대상)
        // 관측 시선 상에 최초로 닿는 충돌 지점(intersection result)을 찾아냅니다.
        const result = viewer.scene.pickFromRay(ray);

        const totalDistance = Cesium.Cartesian3.distance(obsPos, tgtPos);

        if (Cesium.defined(result) && Cesium.defined(result.position)) {
            const hitPosition = result.position;
            const hitDistance = Cesium.Cartesian3.distance(obsPos, hitPosition);

            // 충돌 지점이 실제 지정한 표적점보다 멀리 있다면 가시선이 확보된 것으로 판단
            if (hitDistance >= totalDistance - 0.1) {
                // 🟢 구간 A: 전체 구간 가시 확보 (파란색 통짜 밀착선)
                drawLOSSegment(obsPos, tgtPos, true);
            } else {
                // 🔴 구간 B: 충돌 지점 기준으로 앞쪽은 가시, 뒤쪽은 차폐 분할 처리
                drawLOSSegment(obsPos, hitPosition, true);  // 관측점 ~ 건물 충돌 지점 (가시)
                drawLOSSegment(hitPosition, tgtPos, false); // 건물 충돌 지점 ~ 표적점 (차폐)
            }
        } else {
            // 허공을 가르거나 아무 장애물도 만나지 않은 경우 전체 가시 처리
            drawLOSSegment(obsPos, tgtPos, true);
        }
    }

    // 🎨 결과선을 지형 및 건물(3D Tiles) 겉면에 밀착시켜 그리는 헬퍼 함수
    function drawLOSSegment(startPos, endPos, isVisible) {
        const segment = viewer.entities.add({
            polyline: {
                positions: [startPos, endPos],
                width: 5,
                // 가시 확보 = DEEPSKYBLUE, 건물 등에 가로막힘 = RED
                material: isVisible ? Cesium.Color.DEEPSKYBLUE : Cesium.Color.RED,
                clampToGround: true, // 🌟 지형 굴곡 밀착
                classificationType: Cesium.ClassificationType.BOTH, // 🌟 지형 및 3D 건물 표면에 모두 투영 밀착시킴
                depthFailMaterial: isVisible 
                    ? Cesium.Color.DEEPSKYBLUE.withAlpha(0.3) 
                    : Cesium.Color.RED.withAlpha(0.3)
            }
        });
        trackedEntities.push(segment);
    }

    function detachEvents() {
        if (handler) {
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        }
        
        viewer.selectedEntity = undefined;
        viewer.trackedEntity = undefined;
    }

    function reset() {
        detachEvents();

        if (floatingPoint) { viewer.entities.remove(floatingPoint); floatingPoint = null; }
        if (tempLine) { viewer.entities.remove(tempLine); tempLine = null; }

        trackedEntities.forEach(entity => {
            viewer.entities.remove(entity);
        });

        trackedEntities = [];
        observerPosition = null;
        targetPosition = null;
    }

    return {
        start,
        reset
    };
})();

