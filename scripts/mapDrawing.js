window.mapdraw = (function() {

    const viewer = window.CesiumViewer;

    let cadrglayer;

    function cadrg_5Draw() 
    {
        // WMS ImageryProvider 설정
        const air_200 = new Cesium.WebMapServiceImageryProvider({
            url: "http://localhost/cgi-bin/mapserv.exe?map=/ms4w/apps/local-demo/cadrg_5.map",  // 사용하려는 WMS 서버 URL
            layers: 'cadrg_5m',  // 사용하려는 레이어 이름
            parameters: {
                service: 'WMS',
                version: '1.3.0',
                request: 'GetMap',
                format: 'image/png',  // 이미지 포맷
                transparent: true,    // 투명 여부
                // 추가 설정이 필요한 경우 이곳에 추가 가능
            }
        });

        // Cesium 뷰어에 WMS ImageryProvider 추가
        cadrglayer = viewer.imageryLayers.addImageryProvider(air_200);
    }

    function disableCadrgLayer() {
        if (cadrgLayer) {
            viewer.imageryLayers.remove(cadrgLayer, false); // false는 현재 뷰에 또 다른 동일한 provider가 있을 때 뷰를 업데이트하지 않도록 합니다
            cadrgLayer = null; // 레이어 참조 제거
        }
    }

    function tmsDraw() {
        var tms = new Cesium.TileMapServiceImageryProvider.fromUrl(
            "../Source/Assets/Textures/NaturalEarthII/", {
            fileExtension: 'jpg',
            maximumLevel: 2,
            

        });
        viewer.imageryLayers.addImageryProvider(tms);
    }

    function cibDraw() {
        var cib = new Cesium.WebMapServiceImageryProvider({
            url : "http://localhost/cgi-bin/mapserv.exe?map=/ms4w/apps/local-demo/cib2.map",
            // map: "/ms4w/apps/local-demo/land_200m.map",
            layers : "cib",
            parameters : {
            transparent : true,
            format : "image/png",
            tiled: true,
            //enablePickFeatures: true
        },
        });
        viewer.imageryLayers.addImageryProvider(cib);
        viewer.imageryLayers._layers[2].show = false;
    }

    function terrainDraw() {
        const customTerrainProvider  = new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl("http://localhost:9000/tilesets/terrain"));
        viewer.scene.setTerrain(customTerrainProvider );


        customTerrainProvider.readyEvent.addEventListener(provider => {
            viewer.scene.globe.enableLighting = true;

            customTerrainProvider.provider.errorEvent.addEventListener(error => {
                alert(`Encountered an error while loading terrain tiles! ${error}`);
            });
        });
    }

    /*******************************************************************************
    //
    //  3D Tile 처리
    //
    *******************************************************************************/
    async function osmModel() { 
        let  tileset;
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

            // Ensure that depth testing is enabled
            viewer.scene.globe.depthTestAgainstTerrain = true;

        } catch(error) {
            console.log(`Error creating tileset: ${error}`);
        }

    }

    function computeTransformationMatrix(lon, lat, height, rotation, scale) {

        const location = Cesium.Cartesian3.fromDegrees(lon, lat, height);
        const translationMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(location);
    
        const scaleMatrix = Cesium.Matrix4.fromScale(scale)
    
        const rotationMatrixX = Cesium.Matrix3.fromRotationX(rotation.x);
        const rotationMatrixY = Cesium.Matrix3.fromRotationY(rotation.y);
        const rotationMatrixZ = Cesium.Matrix3.fromRotationZ(rotation.z);
    
        const rotation3 = new Cesium.Matrix3();
        Cesium.Matrix3.multiply(rotationMatrixZ, rotationMatrixY, rotation3);
        Cesium.Matrix3.multiply(rotationMatrixX, rotation3, rotation3);
    
        const rotationMatrix = Cesium.Matrix4.fromRotation(rotation3);
    
        const matrix = new Cesium.Matrix4();
        Cesium.Matrix4.multiply(translationMatrix, scaleMatrix, matrix);
        Cesium.Matrix4.multiply(matrix, rotationMatrix, matrix);
    
        return matrix;
    }

    async function sampleModel() {
        try {

                const tileset1 = await Cesium.Cesium3DTileset.fromUrl("/data1/tileset.json");
                //tileset.clampToGround = true;
                // style = new Cesium.Cesium3DTileStyle({
                //  color: "rgba(255, 0, 0, 0.5)",
                //});
        
                viewer.scene.primitives.add(tileset1);
                tileset1.debugShowBoundingVolume = true;
                tileset1.clampToGround = true;

                const lon = 126.9214;
                const lat = 37.5256;
                const height = 28.2;
                const rotationXYZ = new Cesium.Cartesian3(0.0, 0, Math.PI + 0.05); //Rotation in radians about the XYZ axis applied in the order X,Y,Z
                const scale = new Cesium.Cartesian3(1, 1, 1); // XYZ scale
        
            tileset1.modelMatrix = computeTransformationMatrix(lon, lat, height, rotationXYZ, scale);

        } catch (error) {
            console.error(`Error creating tileset: ${error}`);
        }
    }

 /*   async function ModelDraw() {
        try {
            // 3D 타일 세트 로드
            const tileset = await  viewer.scene.primitives.add(new Cesium.Cesium3DTileset({
                url: "/data1/tileset.json"
            }));
            

            // 타일셋 준비 완료 후 위치 조정
            await tileset.readyPromise;
            console.log('Tileset loaded:', tileset);

            // 목표 위경도 좌표: 타일을 배치할 위치
            const longitude = Cesium.Math.toRadians(126.9214); // 경도
            const latitude = Cesium.Math.toRadians(37.5256);   // 위도

            // 카르토그래픽 좌표를 카르테시안으로 변환
            // Sample the terrain height at the location
        const terrainProvider = viewer.terrainProvider;
        const positions = [Cesium.Cartographic.fromRadians(longitude, latitude)];
        const updatedPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);

        if (!updatedPositions || !updatedPositions[0]) {
            throw new Error('Failed to sample terrain heights.');
        }
        
        // Use the sampled height as the position's height
        const heightAboveTerrain = 0; // Additional height above the terrain if needed
        const height = updatedPositions[0].height + heightAboveTerrain;

        // Convert cartographic coordinates to Cartesian3
        const position = Cesium.Cartesian3.fromRadians(longitude, latitude, height);

        // Create a fixed frame transform without heading, pitch, or roll
        const transform = Cesium.Transforms.headingPitchRollToFixedFrame(
            position,
            new Cesium.HeadingPitchRoll(0.0, 0.0, 0.0)
        );

        // Apply the transform to the model matrix
        tileset.modelMatrix = transform;

        } catch (error) {
            console.error('Error loading or processing the tileset:', error);
        }

        
    }
*/

    return {cadrg_5Draw, terrainDraw, cibDraw, tmsDraw, osmModel, sampleModel };

})();