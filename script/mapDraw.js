
window.mapDrawing =  (function() {
    
    const viewer = window.CesiumViewer;

    let tileset;
    let cibLayer = null;
    let offlineMapLayer = null;
    let originalGeoTiffLayer = null;
    let originalGeoTiffObjectUrl = null;
    const localShapeLayers = new Map();
    let localShapeLoadGeneration = 0;
    let localShapeAbortController = null;
    let localShapeSceneModeListenerRegistered = false;
    let localShapeViewportListenerRegistered = false;
    let localShapeViewportTimer = null;
    let localShapeViewportAbortController = null;
    let localShapeViewportGeneration = 0;
    const geoJsonLayers = new Map();
    const fdbLoadGenerations = new Map();
    let scaleListenerRegistered = false;

    const MAPSERVER_BASE_URL = 'http://localhost/cgi-bin/mapserv.exe';
    const MAPSERVER_APP_PATH = '/ms4w/apps/local-demo';

    // MapServer 없이 제공하는 정적 XYZ 타일 위치. 필요하면
    // mapDrawing.configureOfflineMap({ url, minimumLevel, maximumLevel, rectangle })로 변경한다.
    const OFFLINE_MAP_CONFIG = {
        url: '/data/offline-tiles/{z}/{x}/{y}.png',
        minimumLevel: 0,
        maximumLevel: 18,
        rectangle: [124.0, 33.0, 132.0, 39.5]
    };

    // XML 파일별 MapServer map 파일. 서버 파일명이 다르면 여기만 수정한다.
    const MAP_FILE_BY_XML = {
        // 육도
        'cop_land_5_unix.xml': 'fdb_l5m.map',
        'cop_land_10_unix.xml': 'fdb_l10m.map',
        'cop_land_25_unix.xml': 'fdb_l25m.map',
        'cop_land_50_unix.xml': 'fdb_l50m.map',
        'cop_land_100_unix.xml': 'fdb_l100m.map',

        // 공도
        'cop_air_25_unix.xml': 'fdb_a25m.map',
        'cop_air_50_unix.xml': 'fdb_a50m.map',
        'cop_air_100_unix.xml': 'fdb_a100m.map',
        'cop_air_200_unix.xml': 'fdb_a200m.map',

        // 해도
        'cop_kr_1_unix.xml': 'fdb_kr1.map',
        'cop_kr_2_unix.xml': 'fdb_kr2.map',
        'cop_kr_3_unix.xml': 'fdb_kr3.map',
        'cop_kr_4_unix.xml': 'fdb_kr4.map',
        'cop_kr_5_unix.xml': 'fdb_kr5.map'
    };

    const rasterLayers = new Map();

    // RASTER 축척별 WMS .map 파일과 MAP 파일 내부 LAYER NAME 설정
    const RASTER_MAP_CONFIG = {
        land: {
            25: { mapFile: 'land_25m.map', layers: 'land_25m' },
            50: { mapFile: 'land_50m.map', layers: 'land_50m' },
            100: { mapFile: 'land_100m.map', layers: 'land_100m' }
        },
        air: {
            25: { mapFile: 'cadrg_25.map', layers: 'cadrg_25m' },
            50: { mapFile: 'cadrg_50.map', layers: 'cadrg_50m' },
            100: { mapFile: 'cadrg_100.map', layers: 'cadrg_100m' }
        }
    };

    //viewer.imageryLayers.remove(viewer.imageryLayers.get(0));

    function wmssatilite() {
        viewer.imageryLayers.remove(viewer.imageryLayers.get(0));

        var world = new Cesium.WebMapServiceImageryProvider({
            url : "http://10.240.33.120/cgi-bin/mapserv.exe?map=/ms4w/apps/local-demo/ne1_hr.map",
            // map: "/ms4w/apps/local-demo/land_200m.map",
            layers : "NE1_HR",
            parameters : {
            transparent : true,
            format : "image/png",
            tiled: true,
            enablePickFeatures: true
        },
        });
        viewer.imageryLayers.addImageryProvider(world);
        viewer.imageryLayers._layers[0].show = true;
    }

    /*******************************************************************************
    //
    //  tilemap service(TMS)
    //
    *******************************************************************************/

    function tilemap() {
        var tms = Cesium.TileMapServiceImageryProvider.fromUrl(
            "../Source/Assets/Textures/NaturalEarthII/", {
            fileExtension: 'jpg',
            maximumLevel: 8,
            

        });
        viewer.imageryLayers.addImageryProvider(tms);
    }

    /*******************************************************************************
    //
    //  Add a WMS imagery layer
    //  CADRG  WMS 처리
    //
    *******************************************************************************/    
/* 
    function air_200() {
        var air_200 = new Cesium.WebMapServiceImageryProvider({
                url : "http://localhost/cgi-bin/mapserv.exe?map=/ms4w/apps/local-demo/cadrg_5.map",
                // map: "/ms4w/apps/local-demo/land_200m.map",
                layers : "cadrg_5m",
                parameters : {
                transparent : true,
                format : "image/png",
                tiled: true,  
                //enablePickFeatures: true
            },
        });

        viewer.imageryLayers.addImageryProvider(air_200);
        viewer.imageryLayers._layers[1].show = false;
    };


   var  wfs = new Cesium.WebMapServiceImageryProvider({
        url : "http://localhost/cgi-bin/mapserv.exe?map=/ms4w/apps/local-demo/fdb_l100m.map",
        // map: "/ms4w/apps/local-demo/land_200m.map",
        layers : "ABA030",
        parameters : {
        transparent : true,
        format : "image/png",
        tiled: true,
        enablePickFeatures: true
      },
    });
    viewer.imageryLayers.addImageryProvider(wfs);
    viewer.imageryLayers._layers[2].show = false;
*/

    function cib(visible = true) {
        if (!viewer || !viewer.imageryLayers) {
            console.error('CesiumViewer가 초기화되지 않았습니다.');
            return null;
        }

        // 최초 호출 때만 CIB 레이어를 생성하고 이후에는 표시 상태만 변경한다.
        if (!cibLayer) {
            const cibProvider = new Cesium.WebMapServiceImageryProvider({
                url : "http://localhost/cgi-bin/mapserv.exe?map=/ms4w/apps/local-demo/cib2.map",
                layers : "cib",
                parameters : {
                    transparent : true,
                    format : "image/png",
                    tiled: true,
                },
            });

            cibLayer = viewer.imageryLayers.addImageryProvider(cibProvider);
        }

        cibLayer.show = Boolean(visible);
        return cibLayer;
    }

    function configureOfflineMap(options = {}) {
        Object.assign(OFFLINE_MAP_CONFIG, options);
    }

    /** MapServer 없이 웹 서버의 XYZ 타일을 배경지도로 표시한다. */
    function offlineMap(visible = true) {
        if (!viewer || !viewer.imageryLayers) {
            throw new Error('CesiumViewer가 초기화되지 않았습니다.');
        }

        if (!offlineMapLayer && visible) {
            const bounds = OFFLINE_MAP_CONFIG.rectangle;
            const rectangle = Array.isArray(bounds) && bounds.length === 4
                ? Cesium.Rectangle.fromDegrees(...bounds.map(Number))
                : undefined;
            const provider = new Cesium.UrlTemplateImageryProvider({
                url: OFFLINE_MAP_CONFIG.url,
                minimumLevel: Number(OFFLINE_MAP_CONFIG.minimumLevel) || 0,
                maximumLevel: Number(OFFLINE_MAP_CONFIG.maximumLevel) || 18,
                rectangle,
                tilingScheme: new Cesium.WebMercatorTilingScheme()
            });
            provider.errorEvent.addEventListener(error => {
                console.error('[mapDrawing] off-line 지도 타일 로딩 실패:', error);
            });
            offlineMapLayer = viewer.imageryLayers.addImageryProvider(provider, 0);
            if (rectangle) viewer.camera.flyTo({ destination: rectangle });
        }

        if (offlineMapLayer) offlineMapLayer.show = Boolean(visible);
        viewer.scene.requestRender();
        return offlineMapLayer;
    }

    function getGeoTiffEpsgCode(image) {
        const keys = image.getGeoKeys ? image.getGeoKeys() : {};
        return Number(
            keys.ProjectedCSTypeGeoKey ||
            keys.GeographicTypeGeoKey ||
            0
        );
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('GeoTIFF 화면 이미지 생성에 실패했습니다.'));
            }, 'image/png');
        });
    }

    /** 선택한 원본 GeoTIFF를 브라우저에서 직접 디코딩해 표시한다. */
    async function originalGeoTiff(file, visible = true) {
        if (!viewer || !viewer.imageryLayers) {
            throw new Error('CesiumViewer가 초기화되지 않았습니다.');
        }

        if (!file) {
            if (originalGeoTiffLayer) {
                originalGeoTiffLayer.show = Boolean(visible);
                viewer.scene.requestRender();
            }
            return originalGeoTiffLayer;
        }
        if (!window.GeoTIFF || typeof window.GeoTIFF.fromBlob !== 'function') {
            throw new Error('GeoTIFF.js가 로드되지 않았습니다.');
        }

        const tiff = await window.GeoTIFF.fromBlob(file);
        const image = await tiff.getImage();
        const bbox = image.getBoundingBox();
        const epsg = getGeoTiffEpsgCode(image);

        if (epsg && epsg !== 4326) {
            throw new Error(
                `현재 원본 지도 직접 표시는 EPSG:4326만 지원합니다. 선택 파일 좌표계: EPSG:${epsg}`
            );
        }
        if (!bbox.every(Number.isFinite) || bbox[0] < -180 || bbox[2] > 180 || bbox[1] < -90 || bbox[3] > 90) {
            throw new Error('GeoTIFF 경계좌표가 위경도(EPSG:4326)가 아닙니다.');
        }

        const sourceWidth = image.getWidth();
        const sourceHeight = image.getHeight();
        const gl = viewer.scene.context._gl;
        const textureLimit = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxSide = Math.min(textureLimit, 8192);
        const scale = Math.min(1, maxSide / sourceWidth, maxSide / sourceHeight);
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const rgb = await image.readRGB({ width, height, interleave: true });
        const rgba = new Uint8ClampedArray(width * height * 4);

        for (let sourceIndex = 0, targetIndex = 0; targetIndex < rgba.length; sourceIndex += 3, targetIndex += 4) {
            rgba[targetIndex] = rgb[sourceIndex];
            rgba[targetIndex + 1] = rgb[sourceIndex + 1];
            rgba[targetIndex + 2] = rgb[sourceIndex + 2];
            rgba[targetIndex + 3] = 255;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
        const blob = await canvasToBlob(canvas);
        const objectUrl = URL.createObjectURL(blob);
        const rectangle = Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]);

        if (originalGeoTiffLayer) viewer.imageryLayers.remove(originalGeoTiffLayer, true);
        if (originalGeoTiffObjectUrl) URL.revokeObjectURL(originalGeoTiffObjectUrl);
        originalGeoTiffObjectUrl = objectUrl;

        const provider = await Cesium.SingleTileImageryProvider.fromUrl(objectUrl, { rectangle });
        originalGeoTiffLayer = viewer.imageryLayers.addImageryProvider(provider);
        originalGeoTiffLayer.show = Boolean(visible);
        viewer.camera.flyTo({ destination: rectangle });
        viewer.scene.requestRender();

        return {
            layer: originalGeoTiffLayer,
            fileName: file.name,
            sourceWidth,
            sourceHeight,
            displayWidth: width,
            displayHeight: height,
            reduced: scale < 1
        };
    }

    function getLocalShapeViewBbox(expandRatio = 0) {
        const rectangle = viewer?.camera?.computeViewRectangle(viewer.scene.globe.ellipsoid);
        if (!rectangle) return null;
        let west = Cesium.Math.toDegrees(rectangle.west);
        let east = Cesium.Math.toDegrees(rectangle.east);
        let south = Cesium.Math.toDegrees(rectangle.south);
        let north = Cesium.Math.toDegrees(rectangle.north);
        if (east < west) {
            west = -180;
            east = 180;
        }
        const lonPadding = (east - west) * expandRatio;
        const latPadding = (north - south) * expandRatio;
        return [
            Math.max(-180, west - lonPadding),
            Math.max(-90, south - latPadding),
            Math.min(180, east + lonPadding),
            Math.min(90, north + latPadding)
        ];
    }

    function bboxContains(outer, inner) {
        return Boolean(outer && inner &&
            outer[0] <= inner[0] && outer[1] <= inner[1] &&
            outer[2] >= inner[2] && outer[3] >= inner[3]);
    }

    function shouldShowLocalShapeLayer(layerInfo, visible) {
        return Boolean(visible && isLayerInScaleRange(layerInfo, getCurrentScaleDenominator()));
    }

    async function readLocalShape(layerName, signal, bbox) {
        if (!bbox) throw new Error('현재 화면의 지도 영역을 계산하지 못했습니다.');
        const url = new URL(`/api/local-shapes/${encodeURIComponent(layerName)}`, window.location.origin);
        url.searchParams.set('bbox', bbox.map(value => Number(value).toFixed(6)).join(','));
        const response = await fetch(url, { signal, cache: 'no-store' });
        if (!response.ok) {
            let message = `${layerName} 영역 요청 실패 (${response.status})`;
            try {
                const payload = await response.json();
                if (payload.error) message = payload.error;
            } catch {}
            throw new Error(message);
        }
        return response.json();
    }

    function waitForNextFrame(signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new DOMException('로딩이 중단되었습니다.', 'AbortError'));
            requestAnimationFrame(() => signal?.aborted
                ? reject(new DOMException('로딩이 중단되었습니다.', 'AbortError'))
                : resolve());
        });
    }

    async function createLocalShape2DDataSources(record, options = {}) {
        if (String(record.layerInfo.displayType).toUpperCase() === 'LABEL') return [];
        if (record.dataSources2D.length || record.dataSources2DPromise) {
            return record.dataSources2DPromise || record.dataSources2D;
        }

        record.dataSources2DPromise = (async () => {
            try {
                for (const geoJson of record.collections) {
                    const features = geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)
                        ? geoJson.features
                        : [geoJson];
                    const chunkSize = Math.max(25, Number(options.chunkSize) || 200);
                    for (let offset = 0; offset < features.length; offset += chunkSize) {
                        await waitForNextFrame(options.signal);
                        if (record.disposed) throw new DOMException('이전 지도 영역 로딩이 중단되었습니다.', 'AbortError');
                        const chunk = geoJson.type === 'FeatureCollection'
                            ? { ...geoJson, features: features.slice(offset, offset + chunkSize) }
                            : features[offset];
                        const dataSource = await Cesium.GeoJsonDataSource.load(chunk, {
                            clampToGround: true,
                            stroke: Cesium.Color.CYAN,
                            strokeWidth: 2,
                            fill: Cesium.Color.CYAN.withAlpha(0.24),
                            markerColor: Cesium.Color.YELLOW,
                            markerSize: 16
                        });
                        dataSource.name = record.layerInfo.name || geoJson.fileName || record.layerName;
                        dataSource.show = shouldShowLocalShapeLayer(record.layerInfo, record.visible) &&
                            viewer.scene.mode === Cesium.SceneMode.SCENE2D;
                        await viewer.dataSources.add(dataSource);
                        record.dataSources2D.push(dataSource);
                        dataSource.entities.values.forEach(entity => {
                            selectXmlStyles(entity, record.layerInfo).forEach(style => applyXmlStyle(entity, style));
                        });
                    }
                }
                return record.dataSources2D;
            } catch (error) {
                record.dataSources2D.forEach(dataSource => viewer.dataSources.remove(dataSource, true));
                record.dataSources2D.length = 0;
                throw error;
            } finally {
                record.dataSources2DPromise = null;
            }
        })();
        return record.dataSources2DPromise;
    }

    async function syncLocalShapeSceneMode(options = {}) {
        const is3D = viewer.scene.mode === Cesium.SceneMode.SCENE3D;
        const is2D = viewer.scene.mode === Cesium.SceneMode.SCENE2D;
        const recordsToCreate = [];
        localShapeLayers.forEach(record => {
            const layerVisible = shouldShowLocalShapeLayer(record.layerInfo, record.visible);
            record.primitives.forEach(primitive => {
                primitive.show = layerVisible && is3D;
            });
            record.dataSources2D.forEach(dataSource => {
                dataSource.show = layerVisible && is2D;
            });
            record.labels.forEach(collection => {
                collection.show = layerVisible && (is2D || is3D);
            });
            if (layerVisible && is2D && !record.dataSources2D.length) {
                recordsToCreate.push(record);
            }
        });
        let nextRecord = 0;
        async function createWorker() {
            while (nextRecord < recordsToCreate.length) {
                const record = recordsToCreate[nextRecord++];
                await createLocalShape2DDataSources(record, options);
            }
        }
        await Promise.all(Array.from(
            { length: Math.min(2, recordsToCreate.length) },
            createWorker
        ));
        viewer.scene.requestRender();
    }

    function ensureLocalShapeSceneModeListener() {
        if (localShapeSceneModeListenerRegistered) return;
        viewer.scene.morphStart.addEventListener(() => {
            localShapeLayers.forEach(record => {
                record.primitives.forEach(primitive => { primitive.show = false; });
            });
        });
        viewer.scene.morphComplete.addEventListener(() => {
            syncLocalShapeSceneMode().catch(error => {
                console.error('[mapDrawing] 2D/3D 로컬 SHAPE 전환 실패:', error);
            });
        });
        localShapeSceneModeListenerRegistered = true;
    }

    function destroyLocalShapeRecord(record) {
        if (!record) return;
        record.disposed = true;
        record.primitives.forEach(primitive => viewer.scene.primitives.remove(primitive));
        record.labels.forEach(collection => viewer.scene.primitives.remove(collection));
        record.dataSources2D.forEach(dataSource => viewer.dataSources.remove(dataSource, true));
        record.primitives.length = 0;
        record.labels.length = 0;
        record.dataSources2D.length = 0;
    }

    async function refreshLocalShapesForView() {
        await syncLocalShapeSceneMode();
        const viewBbox = getLocalShapeViewBbox(0);
        if (!viewBbox) return;
        const records = Array.from(localShapeLayers.values()).filter(record =>
            shouldShowLocalShapeLayer(record.layerInfo, record.visible) &&
            !bboxContains(record.bbox, viewBbox)
        );
        if (!records.length) return;

        localShapeViewportGeneration += 1;
        const generation = localShapeViewportGeneration;
        localShapeViewportAbortController?.abort();
        const controller = new AbortController();
        localShapeViewportAbortController = controller;
        const bbox = getLocalShapeViewBbox(0.25);
        let nextIndex = 0;

        async function refreshWorker() {
            while (nextIndex < records.length && generation === localShapeViewportGeneration) {
                const previous = records[nextIndex++];
                try {
                    const prepared = await createLocalShapeGeoJson(previous.layerInfo, {
                        signal: controller.signal,
                        bbox
                    });
                    await renderLocalShapeGeoJson(previous.layerInfo, prepared, previous.visible, {
                        signal: controller.signal
                    });
                    const current = localShapeLayers.get(previous.layerName);
                    if (generation !== localShapeViewportGeneration) {
                        destroyLocalShapeRecord(current);
                        localShapeLayers.set(previous.layerName, previous);
                        return;
                    }
                    destroyLocalShapeRecord(previous);
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.error(`[mapDrawing] ${previous.layerName} 화면 영역 갱신 실패:`, error);
                    }
                }
            }
        }

        await Promise.all(Array.from({ length: Math.min(2, records.length) }, refreshWorker));
        if (localShapeViewportAbortController === controller) localShapeViewportAbortController = null;
        viewer.scene.requestRender();
    }

    function scheduleLocalShapeViewportRefresh() {
        clearTimeout(localShapeViewportTimer);
        localShapeViewportTimer = setTimeout(() => {
            refreshLocalShapesForView().catch(error => {
                if (error.name !== 'AbortError') console.error('[mapDrawing] 화면 영역 SHAPE 갱신 실패:', error);
            });
        }, 300);
    }

    function ensureLocalShapeViewportListener() {
        if (localShapeViewportListenerRegistered) return;
        viewer.camera.moveEnd.addEventListener(scheduleLocalShapeViewportRefresh);
        localShapeViewportListenerRegistered = true;
    }

    async function createLocalShapeGeoJson(layerInfo, options = {}) {
        const layerName = layerInfo?.localShapeName || layerInfo?.source;
        if (!layerName || !/^[A-Za-z0-9_-]+$/.test(layerName)) throw new Error('매핑된 SHAPE 파일명이 없습니다.');
        options.onStage?.({ stage: 'geojson', layerName });
        const bbox = options.bbox || getLocalShapeViewBbox(0.25);
        const converted = await readLocalShape(layerName, options.signal, bbox);
        const collections = (Array.isArray(converted) ? converted : [converted]).filter(Boolean);
        if (!collections.length) throw new Error(`${layerName}에서 도형을 찾지 못했습니다.`);
        return { layerName, collections, bbox };
    }

    function addGeoJsonLabels(labelCollection, geoJson, layerInfo) {
        const features = geoJson.type === 'FeatureCollection' ? geoJson.features || [] : [geoJson];
        const style = layerInfo.styleDefinition || {};
        const fillColor = xmlColor(style.Color, Cesium.Color.WHITE);
        const outlineColor = xmlColor(style.BackColor, Cesium.Color.BLACK);
        const size = Math.max(9, Number(style.Size) || 12);
        const fontName = style.Font || 'sans-serif';

        const addPosition = (coordinates, properties) => {
            if (!Array.isArray(coordinates) || coordinates.length < 2) return;
            const text = propertyValueFromObject(properties, layerInfo.labelColumnName);
            if (text === undefined || text === null || String(text).trim() === '') return;
            labelCollection.add({
                position: Cesium.Cartesian3.fromDegrees(Number(coordinates[0]), Number(coordinates[1]), 0),
                text: String(text),
                font: `${size}px ${fontName}`,
                fillColor,
                outlineColor,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                pixelOffset: new Cesium.Cartesian2(Number(style.xmove) || 0, -(Number(style.ymove) || 0)),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            });
        };

        features.forEach(feature => {
            const geometry = feature?.geometry;
            if (!geometry) return;
            if (geometry.type === 'Point') addPosition(geometry.coordinates, feature.properties || {});
            if (geometry.type === 'MultiPoint') {
                geometry.coordinates.forEach(position => addPosition(position, feature.properties || {}));
            }
        });
    }

    async function renderLocalShapeGeoJson(layerInfo, prepared, visible = true, options = {}) {
        if (!viewer || !viewer.scene?.primitives) throw new Error('CesiumViewer가 초기화되지 않았습니다.');
        if (!Cesium.GeoJsonPrimitive) throw new Error('현재 Cesium 버전에서 GeoJsonPrimitive를 사용할 수 없습니다.');
        const { layerName, collections, bbox } = prepared;
        options.onStage?.({ stage: 'render', layerName });
        const primitives = [];
        const labels = [];
        const isLabelLayer = String(layerInfo.displayType).toUpperCase() === 'LABEL';
        try {
            for (const geoJson of collections) {
                const features = geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)
                    ? geoJson.features
                    : [geoJson];
                const chunkSize = Math.max(25, Number(options.chunkSize) || 200);
                for (let offset = 0; offset < features.length; offset += chunkSize) {
                    await waitForNextFrame(options.signal);
                    const chunk = geoJson.type === 'FeatureCollection'
                        ? { ...geoJson, features: features.slice(offset, offset + chunkSize) }
                        : features[offset];
                    if (options.signal?.aborted) throw new DOMException('로딩이 중단되었습니다.', 'AbortError');
                    if (isLabelLayer) {
                        const labelCollection = new Cesium.LabelCollection({ scene: viewer.scene });
                        labelCollection.name = layerInfo.name || geoJson.fileName || layerName;
                        labelCollection.show = shouldShowLocalShapeLayer(layerInfo, visible);
                        addGeoJsonLabels(labelCollection, chunk, layerInfo);
                        viewer.scene.primitives.add(labelCollection);
                        labels.push(labelCollection);
                    } else {
                        const primitive = Cesium.GeoJsonPrimitive.fromGeoJson(chunk, {
                            show: shouldShowLocalShapeLayer(layerInfo, visible) &&
                                viewer.scene.mode === Cesium.SceneMode.SCENE3D,
                            allowPicking: options.allowPicking !== false
                        });
                        primitive.name = layerInfo.name || geoJson.fileName || layerName;
                        applyXmlStylesToGeoJsonPrimitive(primitive, layerInfo);
                        viewer.scene.primitives.add(primitive);
                        primitives.push(primitive);
                    }
                    options.onFeatureProgress?.({
                        completed: Math.min(features.length, offset + chunkSize),
                        total: features.length
                    });
                }
            }
        } catch (error) {
            primitives.forEach(primitive => viewer.scene.primitives.remove(primitive));
            labels.forEach(collection => viewer.scene.primitives.remove(collection));
            throw error;
        }
        const record = {
            layerName,
            layerInfo,
            collections,
            primitives,
            labels,
            dataSources2D: [],
            dataSources2DPromise: null,
            visible: Boolean(visible),
            bbox,
            disposed: false
        };
        localShapeLayers.set(layerName, record);
        ensureLocalShapeSceneModeListener();
        ensureLocalShapeViewportListener();
        if (viewer.scene.mode === Cesium.SceneMode.SCENE2D) {
            await createLocalShape2DDataSources(record, options);
        }
        viewer.scene.requestRender();
        return primitives;
    }

    async function localShape(layerInfo, visible = true, options = {}) {
        if (!viewer || !viewer.scene?.primitives) throw new Error('CesiumViewer가 초기화되지 않았습니다.');
        const layerName = layerInfo?.localShapeName || layerInfo?.source;
        if (!layerName || !/^[A-Za-z0-9_-]+$/.test(layerName)) throw new Error('매핑된 SHAPE 파일명이 없습니다.');
        const existing = localShapeLayers.get(layerName);
        if (existing) {
            existing.visible = Boolean(visible);
            await syncLocalShapeSceneMode(options);
            if (visible) scheduleLocalShapeViewportRefresh();
            viewer.scene.requestRender();
            return existing.primitives;
        }
        if (!visible) return [];
        const prepared = await createLocalShapeGeoJson(layerInfo, options);
        return renderLocalShapeGeoJson(layerInfo, prepared, visible, options);
    }

    function cancelLocalShapeLoad() {
        localShapeLoadGeneration += 1;
        localShapeAbortController?.abort();
        localShapeAbortController = null;
    }

    async function localShapes(layerNodes, visible = true, options = {}) {
        const layers = (Array.isArray(layerNodes) ? layerNodes : [layerNodes])
            .filter(layer => layer?.source && layer?.localShapeName);
        if (!layers.length) return { loaded: 0, failed: 0, cancelled: false, errors: [] };
        if (!visible) {
            cancelLocalShapeLoad();
            layers.forEach(layer => {
                const layerName = layer.localShapeName || layer.source;
                const record = localShapeLayers.get(layerName);
                if (record) record.visible = false;
            });
            await syncLocalShapeSceneMode(options);
            options.onProgress?.({ completed: layers.length, total: layers.length, current: '', cancelled: false });
            return { loaded: 0, failed: 0, cancelled: false, errors: [] };
        }

        cancelLocalShapeLoad();
        const generation = localShapeLoadGeneration;
        const controller = new AbortController();
        localShapeAbortController = controller;
        const concurrency = Math.max(1, Math.min(4, Number(options.concurrency) || 2));
        const errors = [];
        let nextIndex = 0;
        let completed = 0;
        let loaded = 0;
        options.onProgress?.({ completed, total: layers.length, current: '', cancelled: false });

        async function worker() {
            while (nextIndex < layers.length && generation === localShapeLoadGeneration) {
                const layer = layers[nextIndex++];
                options.onProgress?.({ completed, total: layers.length, current: layer.name || layer.source, cancelled: false });
                try {
                    await localShape(layer, true, {
                        signal: controller.signal,
                        chunkSize: options.chunkSize,
                        onStage: stageInfo => options.onProgress?.({
                            completed,
                            total: layers.length,
                            current: layer.name || layer.source,
                            stage: stageInfo.stage,
                            cancelled: false
                        }),
                        onFeatureProgress: featureProgress => options.onProgress?.({
                            completed,
                            total: layers.length,
                            current: `${layer.name || layer.source} · 객체 ${featureProgress.completed}/${featureProgress.total}`,
                            stage: 'render',
                            cancelled: false
                        })
                    });
                    loaded += 1;
                } catch (error) {
                    if (error.name === 'AbortError') return;
                    errors.push({ layer, error });
                    console.error(`[mapDrawing] ${layer.source} 로컬 SHAPE 로딩 실패:`, error);
                } finally {
                    if (generation === localShapeLoadGeneration) {
                        completed += 1;
                        options.onProgress?.({ completed, total: layers.length, current: layer.name || layer.source, cancelled: false });
                    }
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, layers.length) }, worker));
        const cancelled = generation !== localShapeLoadGeneration || controller.signal.aborted;
        if (localShapeAbortController === controller) localShapeAbortController = null;
        options.onProgress?.({ completed, total: layers.length, current: '', cancelled });
        return { loaded, failed: errors.length, cancelled, errors };
    }

 
    function xmlColor(value, fallback, alpha = 1.0) {
        const hex = String(value || '').replace(/^#/, '').trim();
        if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
        return Cesium.Color.fromCssColorString(`#${hex}`).withAlpha(alpha);
    }

    function propertyValue(entity, propertyName) {
        if (!entity.properties || !propertyName) return undefined;
        const propertyNames = entity.properties.propertyNames || [];
        let actualName = propertyNames.find(name =>
            name.toLowerCase() === propertyName.toLowerCase()
        );
        let property = actualName ? entity.properties[actualName] : undefined;
        if (!property && propertyName.toLowerCase() === 'map_cd') {
            const codeName = propertyNames.find(name => name.toLowerCase() === 'code');
            property = codeName ? entity.properties[codeName] : undefined;
            actualName = codeName;
        }
        const value = property && typeof property.getValue === 'function'
            ? property.getValue(Cesium.JulianDate.now())
            : property;
        return normalizeXmlStyleValue(propertyName, actualName, value);
    }

    function selectXmlStyles(entity, layerInfo) {
        if (layerInfo.styleRules && layerInfo.styleRules.length) {
            const featureValue = propertyValue(entity, layerInfo.styleColumnName);
            const rule = layerInfo.styleRules.find(item =>
                String(item.value) === String(featureValue)
            );
            if (rule && rule.styles.length) return rule.styles;
        }
        return layerInfo.styleDefinition ? [layerInfo.styleDefinition] : [];
    }

    function propertyValueFromObject(properties, propertyName) {
        if (!properties || !propertyName) return undefined;
        const actualName = Object.keys(properties).find(name =>
            name.toLowerCase() === propertyName.toLowerCase()
        );
        if (actualName) return properties[actualName];
        if (propertyName.toLowerCase() === 'map_cd') {
            const codeName = Object.keys(properties).find(name => name.toLowerCase() === 'code');
            return normalizeXmlStyleValue(propertyName, codeName, codeName ? properties[codeName] : undefined);
        }
        return undefined;
    }

    function normalizeXmlStyleValue(requestedName, actualName, value) {
        if (String(requestedName).toLowerCase() !== 'map_cd' ||
            String(actualName).toLowerCase() !== 'code') return value;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.abs(numeric) % 100000 : value;
    }

    function selectXmlStylesFromProperties(properties, layerInfo) {
        if (layerInfo.styleRules && layerInfo.styleRules.length) {
            const featureValue = propertyValueFromObject(properties, layerInfo.styleColumnName);
            const rule = layerInfo.styleRules.find(item =>
                String(item.value) === String(featureValue)
            );
            if (rule?.styles?.length) return rule.styles;
        }
        return layerInfo.styleDefinition ? [layerInfo.styleDefinition] : [];
    }

    function geometryXmlStyle(styles, geometryType) {
        const wanted = String(geometryType).toUpperCase();
        return styles.find(style => String(style?.type || '').toUpperCase() === wanted)
            || styles.find(style => String(style?.type || '').toUpperCase() !== 'LABEL')
            || null;
    }

    function applyXmlStylesToGeoJsonPrimitive(primitive, layerInfo) {
        const applyCollection = (collection, PrimitiveClass, geometryType, materialFactory) => {
            if (!collection) return;
            const item = new PrimitiveClass();
            for (let index = 0; index < collection.primitiveCount; index += 1) {
                collection.get(index, item);
                const properties = primitive.properties[item.featureId] || {};
                const styles = selectXmlStylesFromProperties(properties, layerInfo);
                item.setMaterial(materialFactory(geometryXmlStyle(styles, geometryType)));
            }
        };

        applyCollection(primitive.points, Cesium.BufferPoint, 'POINT', style => {
            const color = xmlColor(style?.Color || style?.FillColor || style?.LineColor, Cesium.Color.YELLOW);
            return new Cesium.BufferPointMaterial({
                color,
                outlineColor: xmlColor(style?.OutColor, Cesium.Color.CYAN),
                outlineWidth: Math.max(0, Number(style?.OutSize) || 1),
                size: Math.max(4, Number(style?.Size) || 8)
            });
        });

        applyCollection(primitive.polylines, Cesium.BufferPolyline, 'LINE', style =>
            new Cesium.BufferPolylineMaterial({
                color: xmlColor(style?.LineColor || style?.Color, Cesium.Color.CYAN),
                width: Math.max(1, Number(style?.LineWidth || style?.Width) || 2)
            })
        );

        applyCollection(primitive.polygons, Cesium.BufferPolygon, 'POLYGON', style =>
            new Cesium.BufferPolygonMaterial({
                color: xmlColor(style?.FillColor, Cesium.Color.CYAN, style ? 0.75 : 0.24),
                outlineColor: xmlColor(style?.LineColor || style?.Color, Cesium.Color.CYAN),
                outlineWidth: Math.max(0, Number(style?.LineWidth || style?.Width) || 1)
            })
        );
    }

    /** 현재 카메라 높이를 지도 축척 분모로 근사한다. */
    function getCurrentScaleDenominator() {
        if (!viewer || !viewer.camera || !viewer.scene) return 1;

        const height = Math.max(1, viewer.camera.positionCartographic.height);
        const canvasHeight = Math.max(1, viewer.scene.canvas.clientHeight);
        const fovy = viewer.camera.frustum.fovy || Cesium.Math.toRadians(60);
        const metersPerPixel = (2 * height * Math.tan(fovy / 2)) / canvasHeight;

        // CSS 표준 해상도 96dpi를 기준으로 축척 분모 계산
        return metersPerPixel * (96 / 0.0254);
    }

    function isLayerInScaleRange(layerInfo, scaleDenominator) {
        if (!layerInfo || layerInfo.useScale === false) return true;

        const minScale = Number(layerInfo.minScale) || 0;
        const maxScale = Number(layerInfo.maxScale) || Number.POSITIVE_INFINITY;
        return scaleDenominator >= minScale && scaleDenominator <= maxScale;
    }

    function shouldShowGeoJsonEntry(entry, scaleDenominator) {
        return Boolean(
            entry.visible &&
            isLayerInScaleRange(entry.layerInfo, scaleDenominator)
        );
    }

    /** 카메라 줌이 바뀌면 XML MinScale/MaxScale에 맞는 레이어만 표시한다. */
    function updateGeoJsonScaleVisibility() {
        const currentScale = getCurrentScaleDenominator();

        geoJsonLayers.forEach(entry => {
            if (entry.dataSource) {
                entry.dataSource.show = shouldShowGeoJsonEntry(entry, currentScale);
            }
        });
    }

    function ensureScaleListener() {
        if (scaleListenerRegistered || !viewer || !viewer.camera) return;
        viewer.camera.moveEnd.addEventListener(updateGeoJsonScaleVisibility);
        scaleListenerRegistered = true;
    }

    /** 레이어가 속한 축척 XML에 대응하는 MapServer URL을 만든다. */
    function resolveWfsBaseUrl(layerInfo) {
        if (layerInfo.wfsUrl) return layerInfo.wfsUrl;

        const mapFile = layerInfo.mapFile || MAP_FILE_BY_XML[layerInfo.xmlFile];
        if (!mapFile) {
            console.warn(
                `[mapDrawing] ${layerInfo.xmlFile || layerInfo.mapScale}의 .map 매핑이 없어 shape.map을 사용합니다.`
            );
        }

        const resolvedMapFile = mapFile || 'shape.map';
        const mapPath = resolvedMapFile.startsWith('/')
            ? resolvedMapFile
            : `${MAPSERVER_APP_PATH}/${resolvedMapFile}`;

        return `${MAPSERVER_BASE_URL}?map=${encodeURIComponent(mapPath)}`;
    }

    function configureMapFiles(mappings) {
        if (!mappings || typeof mappings !== 'object') return;
        Object.assign(MAP_FILE_BY_XML, mappings);
    }

    function configureRasterMaps(mappings) {
        if (!mappings || typeof mappings !== 'object') return;
        Object.keys(mappings).forEach(type => {
            RASTER_MAP_CONFIG[type] = {
                ...(RASTER_MAP_CONFIG[type] || {}),
                ...mappings[type]
            };
        });
    }

    /** RASTER 육도/공도의 선택 축척 .map 파일을 WMS로 표시/숨김한다. */
    function raster(layerInfo, visible = true) {
        if (!layerInfo || !layerInfo.rasterType || !layerInfo.scaleCode) {
            throw new Error('RASTER 종류(rasterType)와 축척(scaleCode)이 필요합니다.');
        }

        const typeConfig = RASTER_MAP_CONFIG[layerInfo.rasterType] || {};
        const config = typeConfig[layerInfo.scaleCode];
        if (!config && !layerInfo.mapFile) {
            throw new Error(
                `${layerInfo.rasterType} ${layerInfo.scaleCode} 축척의 RASTER .map 설정이 없습니다.`
            );
        }

        const mapFile = layerInfo.mapFile || config.mapFile;
        const wmsLayers = layerInfo.wmsLayers || config.layers;
        const key = `${layerInfo.rasterType}:${layerInfo.scaleCode}`;
        let imageryLayer = rasterLayers.get(key);

        if (!imageryLayer && visible) {
            const mapPath = mapFile.startsWith('/')
                ? mapFile
                : `${MAPSERVER_APP_PATH}/${mapFile}`;
            const provider = new Cesium.WebMapServiceImageryProvider({
                url: `${MAPSERVER_BASE_URL}?map=${encodeURIComponent(mapPath)}`,
                layers: wmsLayers,
                parameters: {
                    service: 'WMS',
                    version: '1.3.0',
                    request: 'GetMap',
                    format: 'image/png',
                    transparent: true,
                    tiled: true
                },
                enablePickFeatures: false
            });

            imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
            imageryLayer._rasterInfo = layerInfo;
            rasterLayers.set(key, imageryLayer);
        }

        if (imageryLayer) imageryLayer.show = Boolean(visible);
        return imageryLayer || null;
    }

    function applyXmlStyle(entity, style) {
        if (!style) return;

        const styleType = String(style.type || '').toUpperCase();
        const lineColor = xmlColor(style.LineColor || style.Color, Cesium.Color.RED);
        const fillColor = xmlColor(style.FillColor, Cesium.Color.YELLOW, 0.75);
        const width = Math.max(1, Number(style.LineWidth || style.Width) || 1);

        if ((styleType === 'POLYGON' || entity.polygon) && entity.polygon) {
            entity.polygon.material = fillColor;
            entity.polygon.outline = Number(style.LineWidth || style.Width) > 0;
            entity.polygon.outlineColor = lineColor;
        }

        if ((styleType === 'LINE' || entity.polyline) && entity.polyline) {
            entity.polyline.material = lineColor;
            entity.polyline.width = width;
            entity.polyline.clampToGround = true;
        }

        if (styleType === 'POINT' || entity.point || entity.billboard) {
            const pointColor = xmlColor(
                style.Color || style.FillColor || style.LineColor,
                Cesium.Color.RED
            );
            const pointSize = Math.max(4, Number(style.Size) || 8);

            if (entity.point) {
                entity.point.color = pointColor;
                entity.point.pixelSize = pointSize;
                entity.point.outlineColor = xmlColor(style.OutColor, lineColor);
                entity.point.outlineWidth = Math.max(0, Number(style.OutSize) || 1);
            }
            if (entity.billboard) {
                entity.billboard.color = pointColor;
                entity.billboard.scale = Math.max(0.5, pointSize / 16);
            }
        }

        if (styleType === 'LABEL') {
            if (!entity.label) {
                entity.label = new Cesium.LabelGraphics({
                    text: entity.name || ''
                });
            }
            entity.label.fillColor = xmlColor(style.Color, Cesium.Color.WHITE);
            entity.label.outlineColor = xmlColor(style.BackColor, Cesium.Color.BLACK);
            entity.label.outlineWidth = 2;
            entity.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
            entity.label.font = `${Math.max(9, Number(style.Size) || 12)}px sans-serif`;
        }
    }

    /**
     * XML 레이어 정보를 WFS GeoJSON으로 불러오고 XML 스타일을 적용한다.
     * @param {Object|string} layerInfo LayerManager 노드 또는 기존 TYPENAME 문자열
     * @param {boolean} visible 표시 여부
     */
    async function geojsonCreate(layerInfo, visible = true) {
        if (typeof layerInfo === 'string') {
            layerInfo = { source: layerInfo, name: layerInfo };
        }
        if (!layerInfo || !layerInfo.source) {
            throw new Error('WFS 레이어의 Source가 없습니다.');
        }

        const key = `${layerInfo.xmlFile || ''}:${layerInfo.source}`;
        let entry = geoJsonLayers.get(key);

        if (entry) {
            entry.visible = Boolean(visible);
            entry.layerInfo = layerInfo;
            if (entry.dataSource) {
                entry.dataSource.show = shouldShowGeoJsonEntry(
                    entry,
                    getCurrentScaleDenominator()
                );
            }
            return entry.promise;
        }

        if (!visible) return null;

        entry = {
            dataSource: null,
            visible: true,
            promise: null,
            layerInfo: layerInfo
        };
        geoJsonLayers.set(key, entry);
        ensureScaleListener();

        const baseUrl = resolveWfsBaseUrl(layerInfo);
        const separator = baseUrl.includes('?') ? '&' : '?';
        const url = `${baseUrl}${separator}` + new URLSearchParams({
            Service: 'WFS',
            version: '2.0.0',
            srs: 'epsg:4326',
            request: 'GetFeature',
            TYPENAME: layerInfo.source,
            outputformat: 'geojson'
        }).toString();

        entry.promise = Cesium.GeoJsonDataSource.load(url, {
            clampToGround: true
        }).then(dataSource => {
            entry.dataSource = dataSource;
            dataSource.name = layerInfo.name || layerInfo.source;
            dataSource.show = shouldShowGeoJsonEntry(
                entry,
                getCurrentScaleDenominator()
            );
            viewer.dataSources.add(dataSource);

            dataSource.entities.values.forEach(entity => {
                const styles = selectXmlStyles(entity, layerInfo);
                styles.forEach(style => applyXmlStyle(entity, style));
            });

            return dataSource;
        }).catch(error => {
            geoJsonLayers.delete(key);
            console.error(`[mapDrawing] ${layerInfo.source} GeoJSON 로딩 실패:`, error);
            throw error;
        });

        return entry.promise;
    }

    /**
     * 선택한 육도 축척 XML에 속한 FDB 레이어를 제한 병렬로 그린다.
     * 각 레이어는 geojsonCreate()에서 해당 축척 XML 스타일을 적용받는다.
     */
    async function fdb(layerNodes, visible = true, options = {}) {
        const layers = (Array.isArray(layerNodes) ? layerNodes : [layerNodes])
            .filter(layer => layer && layer.source);
        if (!layers.length) return { loaded: 0, failed: 0, errors: [] };

        const groupKey = layers[0].xmlFile || layers[0].mapScale || 'fdb';
        const generation = (fdbLoadGenerations.get(groupKey) || 0) + 1;
        fdbLoadGenerations.set(groupKey, generation);

        // 체크 해제는 이미 생성/로딩 중인 레이어를 즉시 숨긴다.
        if (!visible) {
            await Promise.all(layers.map(layer => geojsonCreate(layer, false)));
            return { loaded: 0, failed: 0, errors: [] };
        }

        const concurrency = Math.max(1, Math.min(12, Number(options.concurrency) || 6));
        const errors = [];
        let nextIndex = 0;
        let loaded = 0;

        async function worker() {
            while (nextIndex < layers.length) {
                // 로딩 도중 같은 축척이 체크 해제되거나 다시 선택되면 이전 작업 중단
                if (fdbLoadGenerations.get(groupKey) !== generation) return;

                const layer = layers[nextIndex++];
                try {
                    await geojsonCreate(layer, true);
                    loaded += 1;
                } catch (error) {
                    errors.push({ layer, error });
                }
            }
        }

        await Promise.all(
            Array.from({ length: Math.min(concurrency, layers.length) }, worker)
        );
        updateGeoJsonScaleVisibility();

        return {
            loaded,
            failed: errors.length,
            errors
        };
    }



    async function ModelDraw() {
        //let  tileset;
        try {
            tileset = await Cesium.createOsmBuildingsAsync({
            style: new Cesium.Cesium3DTileStyle({
                color: {
                    conditions: [
                        ["${feature['building']} === 'hospital'", "color('#0000FF')"],
                        ["${feature['building']} === 'school'", "color('#00FF00')"],
                        [true, "color('#ffffff')"]
                    ]
                }
            })
        });
            viewer.scene.primitives.add(tileset);
            viewer.scene.globe.depthTestAgainstTerrain = true;

            tileset.show = false;
            //viewer.scene.terrainProvider = terrainProvider;
            //updateTileset(tileset.root);
        // 
        //    var boundingSphere = tileset.boundingSphere;
        //    viewer.camera.viewBoundingSphere(boundingSphere, new Cesium.HeadingPitchRange(0.5, -6.2, boundingSphere.radius * 1.0));
        //    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        //  
        } catch (error) {
            console.log(`Error creating tileset: ${error}`);
        }
    };

    function toggleTilesetVisibility() {
        if (tileset) {
            tileset.show = !tileset.show;
        } else {
            console.error('Tileset is not initialized.');
        }
    };

    // DOM이 로드된 후 작업 실행
    document.addEventListener('DOMContentLoaded', function() {
        // 폐쇄망에서는 Cesium ion의 OSM Buildings를 자동 호출하지 않는다.
    });

    return {
        tilemap,
        cib,
        offlineMap,
        originalGeoTiff,
        createLocalShapeGeoJson,
        renderLocalShapeGeoJson,
        localShape,
        localShapes,
        cancelLocalShapeLoad,
        configureOfflineMap,
        fdb,
        geojsonCreate,
        raster,
        configureMapFiles,
        configureRasterMaps,
        resolveWfsBaseUrl,
        getCurrentScaleDenominator,
        updateGeoJsonScaleVisibility,
        wmssatilite,
        ModelDraw,
        toggleTilesetVisibility
    };

})();
