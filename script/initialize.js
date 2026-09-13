//////////////////////////////////////////////////////////////////////////
// Creating the CesiumJS world viewer
//////////////////////////////////////////////////////////////////////////


(function() {
    // 배포 환경에서 window.CESIUM_ION_ACCESS_TOKEN을 먼저 설정하면 해당 토큰을 사용합니다.
    //Cesium.Ion.defaultAccessToken = window.CESIUM_ION_ACCESS_TOKEN ||
     //   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZmNiNWM2Yy04OTczLTRhNjgtYTczOC02OTdiNGU0ZDZiZDEiLCJpZCI6MTQwNDAsImlhdCI6MTcwNDI1NDkzNn0.vvFyO9b6nC3PKjWZpYcFc-67IX4vvlPu6gt6GdYQvHQ';

    // 배포 환경에서 설정한 Cesium ion access token을 사용합니다.
    if (window.CESIUM_ION_ACCESS_TOKEN) {
        Cesium.Ion.defaultAccessToken = window.CESIUM_ION_ACCESS_TOKEN;
    }
    // 로컬 NaturalEarthII를 항상 기본 레이어로 유지합니다. 온라인 레이어가
    // 실패하거나 인터넷이 끊기면 이 레이어가 즉시 보입니다.
    const localBaseProvider = new Cesium.UrlTemplateImageryProvider({
        url: '/NaturalEarthII/{z}/{x}/{reverseY}.jpg',
        tilingScheme: new Cesium.GeographicTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 2,
        tileWidth: 256,
        tileHeight: 256,
        credit: 'Natural Earth II'
    });
    window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
        // 기본 지도 보기 모드는 3차원으로 시작합니다.
        sceneMode: Cesium.SceneMode.SCENE3D,
        sceneModePicker: false,
        baseLayerPicker: false,

        baseLayer: false,
        animation : false,
        timeline : false,
        geocoder : false,
        homeButton : false,
        fullscreenButton : false,
        navigationHelpButton: false,
        infoBox: false,
        requestvertexNormal: true,
        shouldAnimate: true,  // 애니메이션 활성화
        // 인터넷이 없어도 지구 표면과 로컬 영상이 즉시 렌더링되도록
        // 네트워크 요청이 없는 타원체 지형을 기본으로 사용합니다.
        terrainProvider: new Cesium.EllipsoidTerrainProvider()
    });

    const viewer = window.CesiumViewer;
    const localBaseLayer = viewer.imageryLayers.addImageryProvider(localBaseProvider, 0);
    let automaticOnlineLayer = null;
    let onlineRequestId = 0;
    let terrainRequestId = 0;
    let onlineTerrainProvider = null;
    let offlineColorLayer = null;
    let offlineColorRectangle = null;

    function removeAutomaticOnlineLayer() {
        onlineRequestId += 1;
        if (automaticOnlineLayer && viewer.imageryLayers.contains(automaticOnlineLayer)) {
            viewer.imageryLayers.remove(automaticOnlineLayer, true);
        }
        automaticOnlineLayer = null;
        viewer.scene.requestRender();
    }

    function useEllipsoidTerrain() {
        terrainRequestId += 1;
        onlineTerrainProvider = null;
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        viewer.scene.requestRender();
    }

    async function tryOnlineTerrain() {
        if (!navigator.onLine || onlineTerrainProvider) return false;
        const requestId = ++terrainRequestId;
        try {
            const provider = typeof Cesium.createWorldTerrainAsync === 'function'
                ? await Cesium.createWorldTerrainAsync({
                    requestVertexNormals: true,
                    requestWaterMask: true
                })
                : await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
                    requestVertexNormals: true,
                    requestWaterMask: true
                });
            if (requestId !== terrainRequestId || !navigator.onLine) return false;
            onlineTerrainProvider = provider;
            viewer.terrainProvider = provider;
            viewer.scene.globe.depthTestAgainstTerrain = true;
            provider.errorEvent?.addEventListener(function (error) {
                console.warn('[Terrain] 온라인 지형 타일 오류가 발생했습니다.', error);
            });
            viewer.scene.requestRender();
            console.info('[Terrain] Cesium World Terrain을 적용했습니다.');
            return true;
        } catch (error) {
            if (requestId === terrainRequestId) useEllipsoidTerrain();
            console.warn('[Terrain] 온라인 지형을 불러오지 못해 기본 지형을 사용합니다.', error);
            return false;
        }
    }

    async function tryOnlineImagery() {
        if (!navigator.onLine || automaticOnlineLayer) return false;
        const requestId = ++onlineRequestId;
        try {
            const provider = await Cesium.IonImageryProvider.fromAssetId(2);
            if (requestId !== onlineRequestId || !navigator.onLine) return false;
            let errorCount = 0;
            automaticOnlineLayer = viewer.imageryLayers.addImageryProvider(provider);
            if (offlineColorLayer && viewer.imageryLayers.contains(offlineColorLayer)) {
                viewer.imageryLayers.raiseToTop(offlineColorLayer);
            }
            provider.errorEvent?.addEventListener(function () {
                errorCount += 1;
                if (errorCount >= 3) removeAutomaticOnlineLayer();
            });
            viewer.scene.requestRender();
            return true;
        } catch (error) {
            console.warn('[Base Map] 온라인 지도를 불러오지 못해 로컬 지도를 사용합니다.', error);
            return false;
        }
    }

    async function loadOfflineColorImagery() {
        try {
            const response = await fetch('/api/offline-color-imagery', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const item = await response.json();
            if (!item.available || !Array.isArray(item.bounds) || item.bounds.length !== 4) return false;
            offlineColorRectangle = Cesium.Rectangle.fromDegrees(...item.bounds);
            const provider = new Cesium.UrlTemplateImageryProvider({
                url: item.url,
                rectangle: offlineColorRectangle,
                tilingScheme: new Cesium.GeographicTilingScheme(),
                minimumLevel: item.minimumLevel,
                maximumLevel: item.maximumLevel,
                tileWidth: 256,
                tileHeight: 256,
                credit: item.name
            });
            offlineColorLayer = viewer.imageryLayers.addImageryProvider(provider);
            viewer.imageryLayers.raiseToTop(offlineColorLayer);
            provider.errorEvent?.addEventListener(function (error) {
                console.warn('[Base Map] 오프라인 컬러영상 타일을 읽지 못했습니다.', error);
            });
            viewer.scene.requestRender();
            return true;
        } catch (error) {
            console.warn('[Base Map] Stand 컬러영상을 불러오지 못했습니다.', error);
            return false;
        }
    }

    function flyToOfflineColor() {
        if (!offlineColorRectangle) return false;
        if (offlineColorLayer) {
            offlineColorLayer.show = true;
            viewer.imageryLayers.raiseToTop(offlineColorLayer);
        }
        viewer.camera.flyTo({ destination: offlineColorRectangle, duration: 1.5 });
        return true;
    }

    window.WebCopOfflineMap = Object.freeze({
        localLayer: localBaseLayer,
        showLocalOnly: removeAutomaticOnlineLayer,
        tryOnline: tryOnlineImagery,
        loadColorImagery: loadOfflineColorImagery,
        flyToColorImagery: flyToOfflineColor,
        getColorLayer: function () { return offlineColorLayer; },
        tryOnlineTerrain: tryOnlineTerrain,
        useEllipsoidTerrain: useEllipsoidTerrain
    });
    window.addEventListener('offline', function () {
        removeAutomaticOnlineLayer();
        useEllipsoidTerrain();
    });
    window.addEventListener('online', function () {
        tryOnlineImagery();
        tryOnlineTerrain();
    });
    tryOnlineImagery();
    tryOnlineTerrain();
    loadOfflineColorImagery();

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
