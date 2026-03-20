window.angleLos = (function() {
    // Initialize the Cesium Viewer with the terrain provider enabled
    const viewer = window.CesiumViewer;

    let observerPosition;

    // Set up mouse click handling to set the observer position
    viewer.screenSpaceEventHandler.setInputAction(clickEvent => {
        const pickedPosition = viewer.scene.pickPosition(clickEvent.position);

        if (!Cesium.defined(pickedPosition)) {
            console.log('Clicked location is not on the 3D scene.');
            return;
        }

        // Set the observer's position
        observerPosition = pickedPosition;
        console.log('Observer position set.');

        // Define the angle range and distance for the fan shape
        const startHeading = Cesium.Math.toRadians(30); // 30 degrees
        const endHeading = Cesium.Math.toRadians(60);   // 60 degrees
        const pitch = Cesium.Math.toRadians(0);         // Horizontal
        const distance = 1000;                          // Distance in meters
        const steps = 10;                               // Number of paths defining the fan bounds

        // Define array to hold the positions for the fan shape
        const fanPositions = [observerPosition];
        for (let i = 0; i <= steps; i++) {
            const heading = Cesium.Math.lerp(startHeading, endHeading, i / steps);
            const targetPosition = calculateTargetPosition(observerPosition, heading, pitch, distance);
            fanPositions.push(targetPosition);
        }

        // Perform LOS analysis over the fan shape
        performLineOfSightAnalysis(observerPosition, fanPositions);

    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    function calculateTargetPosition(observerPosition, heading, pitch, distance) {
        const direction = new Cesium.Cartesian3();
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(heading, pitch, 0));
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
        const initialDirection = Cesium.Cartesian3.UNIT_X; // Forward direction
        Cesium.Matrix3.multiplyByVector(rotationMatrix, initialDirection, direction);
        const normalizedDirection = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());
        const scaledDirection = Cesium.Cartesian3.multiplyByScalar(normalizedDirection, distance, new Cesium.Cartesian3());
        return Cesium.Cartesian3.add(observerPosition, scaledDirection, new Cesium.Cartesian3());
    }

    async function performLineOfSightAnalysis(observerPosition, fanPositions) {
        const positions = fanPositions.map(pos => Cesium.Cartographic.fromCartesian(pos));

        // Sample terrain heights
        const sampledPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);

        // Calculate visibility for the entire fan
        let visible = true;
        for (let i = 0; i < sampledPositions.length; i++) {
            const terrainHeight = sampledPositions[i].height;
            const positionHeight = positions[i].height;

            if (terrainHeight > positionHeight + 1.5) { // Assuming an observer height of 1.5 meters
                visible = false;
                break;
            }
        }

        // Visualize the fan shape
        viewer.entities.removeAll();  // Clear previous visualizations
        viewer.entities.add({
            polygon: {
                hierarchy: {
                    positions: sampledPositions.map(pos => Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height))
                },
                material: visible ? Cesium.Color.BLUE.withAlpha(0.5) : Cesium.Color.RED.withAlpha(0.5)
            }
        });
    }
})();