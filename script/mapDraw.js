
window.mapDrawing =  (function() {
    
    const viewer = window.CesiumViewer;

    let tileset;
    let cibLayer = null;
    const geoJsonLayers = new Map();
    const fdbLoadGenerations = new Map();
    let scaleListenerRegistered = false;

    const MAPSERVER_BASE_URL = 'http://localhost/cgi-bin/mapserv.exe';
    const MAPSERVER_APP_PATH = '/ms4w/apps/local-demo';

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

 
    function xmlColor(value, fallback, alpha = 1.0) {
        const hex = String(value || '').replace(/^#/, '').trim();
        if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
        return Cesium.Color.fromCssColorString(`#${hex}`).withAlpha(alpha);
    }

    function propertyValue(entity, propertyName) {
        if (!entity.properties || !propertyName) return undefined;
        const actualName = (entity.properties.propertyNames || []).find(name =>
            name.toLowerCase() === propertyName.toLowerCase()
        ) || propertyName;
        const property = entity.properties[actualName];
        return property && typeof property.getValue === 'function'
            ? property.getValue(Cesium.JulianDate.now())
            : property;
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
        // 초기화 시 ModelDraw 호출
        ModelDraw();
    });

    return {
        tilemap,
        cib,
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
