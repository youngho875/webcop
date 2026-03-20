// polylineDrawingWithLatLon.js

window.PolylineDrawing = (function() {
    const viewer = window.CesiumViewer;
    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;

    // 위경도 좌표에 점 생성
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

    // 위경도 좌표로 폴리라인 그리기
    function drawPolyline(positionData) {
        if (activeShape) {
            viewer.entities.remove(activeShape);
        }
        activeShape = viewer.entities.add({
            id: 'polyline_' + Math.random().toString(36).substr(2, 9),
            polyline: {
                positions: positionData,
                clampToGround: true,
                width: 3,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.RED)
            }
        });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function activate() {
        reset();
        // 좌클릭으로 점 추가
        handler.setInputAction(function(event) {
            //const earthPosition = window.viewer.scene.pickPosition(event.position);
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);

                activeShapePoints.push(position);

                if (activeShapePoints.length === 1) {
                    floatingPoint = createPoint(latitude, longitude);
                    const dynamicPositions = new Cesium.CallbackProperty(function() {
                        return activeShapePoints;
                    }, false);
                    drawPolyline(dynamicPositions);
                } else {
                    createPoint(position);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 마우스 이동으로 폴리라인 연장
        handler.setInputAction(function(event) {
            if (Cesium.defined(floatingPoint)) {
                //const newPosition = window.viewer.scene.pickPosition(event.endPosition);
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
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

        // 더블클릭으로 폴리라인 종료
        handler.setInputAction(function(event) {
            if (activeShapePoints.length > 1) {
                viewer.entities.remove(floatingPoint);
                drawPolyline(activeShapePoints);
                floatingPoint = undefined;
                activeShapePoints = [];
                activeShape = undefined;
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function reset() {
        if (activeShape) {
            viewer.entities.remove(activeShape);
            activeShape = undefined;
        }
        activeShapePoints = [];
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    return {
        activate,
        reset
    };
})();

