
window.distance = (function() {
    const viewer = window.CesiumViewer;
    
    let positions = [];
    let tempLine;
    let floatingPoint;

    function createPoint(position) {
    return viewer.entities.add({
        position: position,
        point: {
        pixelSize: 8,
        color: Cesium.Color.YELLOW,
        },
    });
    }

    function drawLine() {
    return viewer.entities.add({
        polyline: {
        positions: new Cesium.CallbackProperty(() => positions, false),
        width: 3,
        material: Cesium.Color.CYAN,
        },
    });
    }

    function showDistanceLabel(position, text) {
    viewer.entities.add({
        position: position,
        label: {
        text: text,
        font: "16px sans-serif",
        fillColor: Cesium.Color.BLACK,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
    });
    }

    function getDistance(p1, p2) {
        const c1 = Cesium.Cartographic.fromCartesian(p1);
        const c2 = Cesium.Cartographic.fromCartesian(p2);
        //return Cesium.Ellipsoid.WGS84.geodesicSurfaceDistance(c1, c2);
        const ellipsoid = Cesium.Ellipsoid.WGS84;
        const geodesic = new Cesium.EllipsoidGeodesic(c1, c2, ellipsoid);
        const distance = geodesic.surfaceDistance;
        return distance;
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    function start() {
        stop();
        // 마우스 클릭 (점 추가)
        handler.setInputAction((click) => {
        const earthPosition = viewer.camera.pickEllipsoid(click.position, Cesium.Ellipsoid.WGS84);
        if (!Cesium.defined(earthPosition)) return;

        if (positions.length === 0) {
            floatingPoint = createPoint(earthPosition);
            positions.push(earthPosition);
            positions.push(earthPosition); // 임시 포인트
            tempLine = drawLine();
        } else {
            positions.splice(positions.length - 1, 0, earthPosition); // 마지막 임시 점 앞에 삽입
            createPoint(earthPosition);

            // 거리 라벨 표시
            const last = positions[positions.length - 3]; // 새 점 전의 점
            const mid = Cesium.Cartesian3.midpoint(last, earthPosition, new Cesium.Cartesian3());
            const dist = getDistance(last, earthPosition);
            showDistanceLabel(mid, `${dist.toFixed(2)} m`);
        }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 마우스 이동 (임시 선)
        handler.setInputAction((movement) => {
        if (!Cesium.defined(floatingPoint)) return;

        const newPosition = viewer.camera.pickEllipsoid(movement.endPosition, Cesium.Ellipsoid.WGS84);
        if (Cesium.defined(newPosition)) {
            floatingPoint.position.setValue(newPosition);
            positions[positions.length - 1] = newPosition; // 마지막 점 업데이트
        }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 더블 클릭 (측정 종료)
        handler.setInputAction(() => {
        if (positions.length < 3) return;

        // 마지막 임시 포인트 제거
        positions.pop();

        let total = 0;
        for (let i = 0; i < positions.length - 1; i++) {
            total += getDistance(positions[i], positions[i + 1]);
        }

        showDistanceLabel(positions[positions.length - 1], `총 거리: ${total.toFixed(2)} m`);

        stop();
        //handler.destroy(); // 측정 종료
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function stop() {
        positions = [];
        if( handler ) {
            handler.removeInputAction( Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction( Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction( Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
    }

    return {
        start,
        stop,
    }
})();