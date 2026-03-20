// planeLineDrawing.js

window.lineDrawing = (function() {
    const viewer = window.CesiumViewer;

    let startPoint;
    let endPoint;
    let activeLine;
    let floatingPoint;

    // 위경도 좌표에 점 생성
    function createPoint(latitude, longitude) {
        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        return viewer.entities.add({
            id: 'line_' + Math.random().toString(36).substr(2, 9),
            position: position,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    // 위경도 좌표로 라인 그리기
    function drawLine(start, end) {
        return viewer.entities.add({
            polyline: {
                positions: [start, end],
                clampToGround: true,
                width: 3,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.RED)
            }
        });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function activate() {
        reset();
        handler.setInputAction(function(event) {
            //const earthPosition = window.viewer.scene.pickPosition(event.position);
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);

                if (!startPoint) {
                    // 시작점 설정
                    startPoint = createPoint(latitude, longitude);
                    floatingPoint = createPoint(latitude, longitude); // 임시 포인터 생성
                } else {
                    // 끝점 설정 및 라인 생성
                    endPoint = createPoint(latitude, longitude);
                    drawLine(startPoint.position.getValue(Cesium.JulianDate.now()), endPoint.position.getValue(Cesium.JulianDate.now()));

                    // 초기화
                    viewer.entities.remove(floatingPoint);
                    startPoint = undefined;
                    endPoint = undefined;
                    floatingPoint = undefined;
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 마우스 이동으로 실시간 라인 표시
        handler.setInputAction(function(event) {
            if (Cesium.defined(floatingPoint)) {
                //const newPosition = window.viewer.scene.pickPosition(event.endPosition);
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    floatingPoint.position.setValue(newPosition);
                    if (Cesium.defined(activeLine)) {
                        viewer.entities.remove(activeLine);
                    }
                    activeLine = drawLine(startPoint.position.getValue(Cesium.JulianDate.now()), newPosition);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    function reset() {
        if (activeLine) {
            viewer.entities.remove(activeLine);
            activeLine = undefined;
        }
        startPoint = undefined;
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    return {
        activate,
        reset
    };

})();