// mousePosition.js
/*
(function() {
    // 스타일 동적 추가
    const style = document.createElement('style');
    style.innerHTML = `
        #coordinateDisplay {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(40, 40, 40, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
        }
    `;
    document.head.appendChild(style);

    // 좌표 및 고도 표시 요소 생성
    const coordDisplay = document.createElement('div');
    coordDisplay.id = 'coordinateDisplay';
    coordDisplay.textContent = 'Lon: 0, Lat: 0, Alt: 0';
    document.body.appendChild(coordDisplay);

    // Cesium Viewer 초기화 및 좌표 표시 기능 설정
    window.initCoordinateDisplay = function(viewer) {
        const scene = viewer.scene;
        const ellipsoid = scene.globe.ellipsoid;

        // 화면의 마우스 움직임을 추적
        const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
        handler.setInputAction(function(movement) {
            const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
            if (cartesian) {
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(5);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(5);

                // 고도 값 계산
                const altitude = cartographic.height.toFixed(2);

                coordDisplay.textContent = `Lon: ${longitude}, Lat: ${latitude}, Alt: ${altitude} m`;
            } else {
                coordDisplay.textContent = 'Lon: -, Lat: -, Alt: -'; // 마우스가 지표면 외부에 있는 경우 표시
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    };
})();
*/

// latLonAltitudeOnMouseMove.js

(function() {
    const viewer = window.CesiumViewer;

    const infoBox = document.createElement('div');
    infoBox.id = 'infoBox';
    document.body.appendChild(infoBox);

    // JavaScript 내에서 스타일 설정
    infoBox.style.position = 'absolute';
    infoBox.style.bottom = '10px';
    infoBox.style.right = '10px';
    infoBox.style.padding = '10px';
    infoBox.style.backgroundColor = 'rgba(42, 42, 42, 0.8)';
    infoBox.style.color = 'white';
    infoBox.style.fontFamily = 'sans-serif';
    infoBox.style.borderRadius = '5px';
    infoBox.style.zIndex = '100';

    function displayLatLonAlt(cartographic) {
        const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
        const altitude = cartographic.height.toFixed(2);

        infoBox.innerHTML = `위도: ${latitude}<br>경도: ${longitude}<br>고도: ${altitude} m`;
    }

    const coordhandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // 마우스 이동으로 위경도 및 고도 표시
    coordhandler.setInputAction(function(event) {
        const earthPosition = viewer.scene.pickPosition(event.endPosition); //viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
        //window.viewer.scene.pickPosition(event.endPosition);
        if (Cesium.defined(earthPosition)) {
            const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
            displayLatLonAlt(cartographic);
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

})();