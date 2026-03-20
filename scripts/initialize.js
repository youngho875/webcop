//////////////////////////////////////////////////////////////////////////
// Creating the CesiumJS world viewer
//////////////////////////////////////////////////////////////////////////
/*
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZmNiNWM2Yy04OTczLTRhNjgtYTczOC02OTdiNGU0ZDZiZDEiLCJpZCI6MTQwNDAsImlhdCI6MTcwNDI1NDkzNn0.vvFyO9b6nC3PKjWZpYcFc-67IX4vvlPu6gt6GdYQvHQ';
var viewer = new Cesium.Viewer('cesiumContainer', {
    //selectionIndicator: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    animation : false,
    timeline : false,
    geocoder : false,
    homeButton : false,
    fullscreenButton : false,
    navigationHelpButton: false,
    requestvertexNormal: true,
    terrain: Cesium.Terrain.fromWorldTerrain(),
    
});
*/

// viewerSetup.js

(function() {
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZmNiNWM2Yy04OTczLTRhNjgtYTczOC02OTdiNGU0ZDZiZDEiLCJpZCI6MTQwNDAsImlhdCI6MTcwNDI1NDkzNn0.vvFyO9b6nC3PKjWZpYcFc-67IX4vvlPu6gt6GdYQvHQ';
    window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
        sceneModePicker: false,
        baseLayerPicker: false,
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        fullscreenButton: false,
        navigationHelpButton: false,
        requestRenderMode: true, // 이 옵션은 켜는 것이 좋습니다. 성능 최적화
        //terrainProvider: new Cesium.EllipsoidTerrainProvider()
        terrain: Cesium.Terrain.fromWorldTerrain(),
    });

    window.setview = function() {
        window.CesiumViewer.scene.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(126.9213, 37.5256, 4000000),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-90),
                roll: Cesium.Math.toRadians(0)
            },
        });
    
    }

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

})();