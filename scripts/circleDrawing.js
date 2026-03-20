// circleDrawingWithLatLon.js

window.circleDrawing = (function() {
    const viewer = window.CesiumViewer;
    let centerPoint;
    let activeCircle;
    let floatingPoint;

    // 위경도 좌표에 점 생성
    function createPoint(latitude, longitude) {
        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        return viewer.entities.add({
            position: position,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    // 위경도 좌표로 원 그리기
    function drawCircle(center, radius) {
        return viewer.entities.add({
            id: 'circle_' + Math.random().toString(36).substr(2, 9),
            position: center,
            ellipse: {
                semiMajorAxis: radius,
                semiMinorAxis: radius,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.5)),
                outline: true,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function activate() {
        reset();
        // 좌클릭으로 중심 설정 또는 원 크기 조정
        handler.setInputAction(function(event) {
            //const earthPosition = window.viewer.scene.pickPosition(event.position);
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);

                if (!centerPoint) {
                    // 중심점 설정
                    centerPoint = createPoint(latitude, longitude);
                    floatingPoint = createPoint(latitude, longitude);
                } else {
                    // 끝점 설정 및 반경 계산하여 원 생성
                    const radius = Cesium.Cartesian3.distance(centerPoint.position.getValue(Cesium.JulianDate.now()), earthPosition);
                    activeCircle = drawCircle(centerPoint.position.getValue(Cesium.JulianDate.now()), radius);

                    // 초기화
                    viewer.entities.remove(floatingPoint);
                    centerPoint = undefined;
                    floatingPoint = undefined;
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 마우스 이동으로 실시간 원 크기 표시
        handler.setInputAction(function(event) {
            if (Cesium.defined(floatingPoint)) {
                //const newPosition = window.viewer.scene.pickPosition(event.endPosition);
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    floatingPoint.position.setValue(newPosition);
                    if (Cesium.defined(activeCircle)) {
                        viewer.entities.remove(activeCircle);
                    }
                    const radius = Cesium.Cartesian3.distance(centerPoint.position.getValue(Cesium.JulianDate.now()), newPosition);
                    activeCircle = drawCircle(centerPoint.position.getValue(Cesium.JulianDate.now()), radius);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    function reset() {
        if (activeCircle) {
            viewer.entities.remove(activeCircle);
            activeCircle = undefined;
        }
        center = undefined;
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
       // handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }

    return {
        activate,
        reset
    };

})();