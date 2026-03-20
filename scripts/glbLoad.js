
(function() {
    const viewer = window.CesiumViewer;

    const modelUrl = '/data1/result.glb'; // GLB 파일 경로 지정

    function loadModelAtPosition(latitude, longitude, altitude) {
        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);
        const heading = Cesium.Math.toRadians(135);
        const pitch = 0;
        const roll = 0;
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

        const model = viewer.scene.primitives.add(new Cesium.Model({
            url: modelUrl,
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
            scale: 1.0,
            minimumPixelSize: 64,
            orientation: orientation
        }));


        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude + 500),
            orientation: {
                heading: heading,
                pitch: Cesium.Math.toRadians(-20),
                roll: 0
            }
        });

    }
    let latitude = 37;
    let longitude = 127;
    let altitude = 100;
    loadModelAtPosition(latitude, longitude, altitude);
})();