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
        const steps = 20;                               // Number of paths within the fan shape

        // Perform LOS analysis over the specified angle range
        viewer.entities.removeAll(); // Clear previous entities
        for (let i = 0; i <= steps; i++) {
            const heading = Cesium.Math.lerp(startHeading, endHeading, i / steps);
            const targetPosition = calculateTargetPosition(observerPosition, heading, pitch, distance);
            performLineOfSightAnalysis(observerPosition, targetPosition);
        }

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

    async function performLineOfSightAnalysis(observerPosition, targetPosition) {
        const numberOfSamples = 100;
        const positions = [];

        // Interpolate positions between observer and target
        for (let i = 0; i <= numberOfSamples; i++) {
            const interpolation = Cesium.Cartesian3.lerp(observerPosition, targetPosition, i / numberOfSamples, new Cesium.Cartesian3());
            positions.push(Cesium.Cartographic.fromCartesian(interpolation));
        }

        // Sample terrain heights
        const sampledPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);

        for (let i = 0; i < sampledPositions.length - 1; i++) {
            const currentHeight = sampledPositions[i].height;
            const nextHeight = sampledPositions[i + 1].height;

            const heightAboveTerrainCurrent = positions[i].height;
            const heightAboveTerrainNext = positions[i + 1].height;

            // Check visibility and color accordingly
            const visibleSegment = currentHeight <= heightAboveTerrainCurrent && nextHeight <= heightAboveTerrainNext;

            const currentCartesian = Cesium.Cartesian3.fromRadians(
                sampledPositions[i].longitude,
                sampledPositions[i].latitude,
                currentHeight
            );

            const nextCartesian = Cesium.Cartesian3.fromRadians(
                sampledPositions[i + 1].longitude,
                sampledPositions[i + 1].latitude,
                nextHeight
            );

            // Visualize the segment
            viewer.entities.add({
                polyline: {
                    positions: [currentCartesian, nextCartesian],
                    width: 3,
                    material: visibleSegment ? Cesium.Color.BLUE : Cesium.Color.RED
                }
            });
        }
    }
})();