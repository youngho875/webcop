
(function() {
    const viewer = CesiumViewer;

    const position = Cesium.Cartesian3.fromDegrees(126.7304, 38.1095, 5000);

    // Define heading, pitch, roll in radians
    const heading = Cesium.Math.toRadians(45);  // Heading in degrees
    const pitch = Cesium.Math.toRadians(30);    // Pitch in degrees
    const roll = Cesium.Math.toRadians(0);      // Roll in degrees

    // Create the orientation quaternion
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, new Cesium.HeadingPitchRoll(heading, pitch, roll));

        // Load the GLTF model
    const gltfEntity = viewer.entities.add({
        name: "kn-23",
        position: position,
        orientation: orientation, 
        model: {
            uri: '/object/kn-23.gltf', // Update this path to your GLTF file
            scale: 10.0,
            minimumPixelSize: 64,
            maximumScale: 1000
        }
    });

    // Zoom to the model
    viewer.zoomTo(gltfEntity);
})();