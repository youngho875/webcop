//////////////////////////////////////////////////////////////////////////
// Creating the CesiumJS world viewer
//////////////////////////////////////////////////////////////////////////


(function() {
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZmNiNWM2Yy04OTczLTRhNjgtYTczOC02OTdiNGU0ZDZiZDEiLCJpZCI6MTQwNDAsImlhdCI6MTcwNDI1NDkzNn0.vvFyO9b6nC3PKjWZpYcFc-67IX4vvlPu6gt6GdYQvHQ';
    window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
        // 기본 지도 보기 모드는 3차원으로 시작합니다.
        sceneMode: Cesium.SceneMode.SCENE3D,
        sceneModePicker: false,
        baseLayerPicker: false,
        animation : false,
        timeline : false,
        geocoder : false,
        homeButton : false,
        fullscreenButton : false,
        navigationHelpButton: false,
        infoBox: false,
        requestvertexNormal: true,
        shouldAnimate: true,  // 애니메이션 활성화
        //terrainProvider: Cesium.createWorldTerrain(),
         terrain: Cesium.Terrain.fromWorldTerrain(),
         //terrainProvider: Cesium.EllipsoidTerrainProvider()
    });

    const viewer = window.CesiumViewer;

    // 하단의 cesiumion 로고 숨기기
    viewer.creditDisplay.container.style.display = 'none';


    // 뷰어 생성 시 카메라를 서울 중심 상공으로 고정하는 코드
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(127.0, 37.5, 800000.0), // 경도, 위도, 고도(미터)
        orientation: {
            heading: Cesium.Math.toRadians(0.0),   // 정북 방향 바라보기
            pitch: Cesium.Math.toRadians(-90.0),  // 하늘에서 땅을 수직으로 내려다보기
            roll: 0.0
        }
    });

/*
    viewer.imageryLayers.remove(viewer.imageryLayers.get(0));

    const handler = new Cesium.ScreenSpaceEventHandler(window.CesiumViewer.scene.canvas);

    function highlightEntity(entity) {
        if (entity.polygon) {
            entity.polygon.material = Cesium.Color.YELLO.withAlpha(0.5);
        } else if (entity.polyline) {
            entity.polyline.material = new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW.withAlpha(0.5));
        } else if (entity.ellipse) {
            entity.ellipse.material = new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW.withAlpha(0.5));
        } else if (entity.line) {
            entity.ellipse.material = new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW.withAlpha(0.5));
        }
    }

    // Handle click events to select entities
    handler.setInputAction(function(event) {
        const pickedObject = window.CesiumViewer.scene.pick(event.position);
        if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            highlightEntity(pickedObject.id);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
*/
})();
