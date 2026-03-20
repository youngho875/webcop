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
    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;
    let drawnPolygons = [];
    let selectedPolygon = null;

    // 팝업 생성 및 스타일 적용
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
    document.body.appendChild(popup);

    // 위경도로부터 점 생성
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

    // 폴리곤 생성
    function drawShape(positionData) {
        if (activeShape) {
            viewer.entities.remove(activeShape);
        }
        activeShape = viewer.entities.add({
            id: 'polygon_' + Math.random().toString(36).substr(2, 9),
            polygon: {
                hierarchy: positionData,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.7)),
                clampToGround: true
            }
        });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    function activate() {
        reset();
        // 좌클릭으로 점 추가
        handler.setInputAction(function(event) {
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            
            if (Cesium.defined(earthPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);

                console.log(`위도: ${latitude}, 경도: ${longitude}`); // 위경도 콘솔 출력

                activeShapePoints.push(position);

                if (activeShapePoints.length === 1) {
                    floatingPoint = createPoint(position);

                    // Create a dynamic position property that doesn't modify activeShapePoints directly
                    const dynamicPositions = new Cesium.CallbackProperty(function() {
                        // floatingPoint의 위치가 정의되어 있는지 확인
                        if (Cesium.defined(floatingPoint)) {
                            return new Cesium.PolygonHierarchy(activeShapePoints.concat([floatingPoint.position.getValue()]));
                        } else {
                            return new Cesium.PolygonHierarchy(activeShapePoints);
                        }
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
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    floatingPoint.position.setValue(newPosition);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 더블블클릭으로 폴리곤 완료
        handler.setInputAction(function(event) {
            if (activeShapePoints.length > 2) {
                viewer.entities.remove(floatingPoint);

                const polygon = viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy(activeShapePoints),
                        material: Cesium.Color.BLUE.withAlpha(0.7),
                        clampToGround: true
                    }
                });
                drawnPolygons.push(polygon);

                floatingPoint = undefined;
                activeShapePoints = [];
                activeShape = undefined;
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        // 폴리곤 클릭 시 팝업 표시
        viewer.screenSpaceEventHandler.setInputAction(function (click) {
            const picked = viewer.scene.pick(click.position);
            if (Cesium.defined(picked) && drawnPolygons.includes(picked.id)) {
            const position = viewer.scene.pickPosition(click.position);
            const carto = Cesium.Cartographic.fromCartesian(position);
            const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
            const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);

            popup.innerHTML = `<strong>선택된 폴리곤</strong><br>위도: ${lat}<br>경도: ${lon}`;
            const screen = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, position);
            popup.style.left = screen.x + 10 + 'px';
            popup.style.top = screen.y - 30 + 'px';
            popup.style.display = 'block';
            } else {
                popup.style.display = 'none';
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
        //handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }

    return {
        activate,
        reset
    };

  
/*
    function selectObject() {
        // 폴리곤 클릭 시 팝업 표시
        viewer.screenSpaceEventHandler.setInputAction(function (click) {
            const picked = viewer.scene.pick(click.position);
            if (Cesium.defined(picked) && drawnPolygons.includes(picked.id)) {
            const position = viewer.scene.pickPosition(click.position);
            const carto = Cesium.Cartographic.fromCartesian(position);
            const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
            const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);

            popup.innerHTML = `<strong>선택된 폴리곤</strong><br>위도: ${lat}<br>경도: ${lon}`;
            const screen = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, position);
            popup.style.left = screen.x + 10 + 'px';
            popup.style.top = screen.y - 30 + 'px';
            popup.style.display = 'block';
            } else {
                popup.style.display = 'none';
            }
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
*/        

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

