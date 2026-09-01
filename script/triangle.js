window.triangle = (function() {
    const viewer = window.CesiumViewer;
/*
    // 위도와 경도에 따른 그물망 생성
    var lonStep = 10.0; // 경도 간격
    var latStep = 10.0; // 위도 간격

    var instances = [];

    function triangleDraw() {
        for (var lon = -180.0; lon <= 180.0; lon += lonStep) {
            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolylineGeometry({
                    positions: Cesium.Cartesian3.fromDegreesArray([
                        lon, -90,
                        lon, 90
                    ]),
                    width: 2.0 // 최소 0.0125 이상으로 설정
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE)
                }
            }));
        }
        
        // 위도 라인
        for (var lat = -90.0; lat <= 90.0; lat += latStep) {
            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolylineGeometry({
                    positions: Cesium.Cartesian3.fromDegreesArray([
                        -180, lat,
                        180, lat
                    ]),
                    width: 2.0 // 최소 0.0125 이상으로 설정
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE)
                }
            }));
        }
        
        viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: instances,
            appearance: new Cesium.PolylineColorAppearance()
        }));
    };
*/
    function triangleDraw() {
        // GroundPrimitive 사용을 위한 설정
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // 위도와 경도에 따른 그물망 생성
        var lonStep = 10.0; // 경도 간격
        var latStep = 10.0; // 위도 간격

        var instances = [];

        // 경도 라인
        for (var lon = -180.0; lon <= 180.0; lon += lonStep) {
            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolylineGeometry({
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                        lon, -90, 0,
                        lon, 90, 0
                    ]),
                    width: 2.0 // 선의 두께
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE)
                }
            }));
        }

        // 위도 라인
        for (var lat = -90.0; lat <= 90.0; lat += latStep) {
            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolylineGeometry({
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                        -180, lat, 0,
                        180, lat, 0
                    ]),
                    width: 2.0 // 선의 두께
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE)
                }
            }));
        }

        viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: instances,
            appearance: new Cesium.PolylineColorAppearance({
                translucent: false
            })
        }));
    }
    return { triangleDraw };

})();
/*
var viewer = new Cesium.Viewer('cesiumContainer');

// 라인 두께 설정
var lineWidth = 2.0;

// 그물망을 그리기 위한 PolylineCollection 생성
var polylines = new Cesium.PolylineCollection();
viewer.scene.primitives.add(polylines);

// 위도와 경도에 따른 그물망 생성
var lonStep = 10.0; // 경도 간격
var latStep = 10.0; // 위도 간격

// 경도 라인
for (var lon = -180.0; lon <= 180.0; lon += lonStep) {
    polylines.add({
        positions: Cesium.Cartesian3.fromDegreesArray([lon, -90, lon, 90]),
        width: lineWidth,
        material: Cesium.Material.fromType('Color', {
            color: Cesium.Color.WHITE
        })
    });
}

// 위도 라인
for (var lat = -90.0; lat <= 90.0; lat += latStep) {
    polylines.add({
        positions: Cesium.Cartesian3.fromDegreesArray([-180, lat, 180, lat]),
        width: lineWidth,
        material: Cesium.Material.fromType('Color', {
            color: Cesium.Color.WHITE
        })
    });
}
*/