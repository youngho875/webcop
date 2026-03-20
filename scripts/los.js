window.los = (function() {

    const viewer = window.CesiumViewer;

    let observerPosition;
    let targetPosition;

   
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function start() {
        reset();
        
        // Capture mouse click to set positions for LOS calculation
        handler.setInputAction(clickEvent => {
            const pickedPosition = viewer.scene.pickPosition(clickEvent.position);

            if (!Cesium.defined(pickedPosition)) {
                console.log('Clicked location is not on the 3D scene.');
                return;
            }

            if (!observerPosition) {
                // Set the observer's position
                observerPosition = pickedPosition;
                console.log('Observer position set.');
            } else {
                // Set the target's position and perform LOS analysis
                targetPosition = pickedPosition;
                console.log('Target position set.');

                performLineOfSightAnalysis(observerPosition, targetPosition);

                // Reset positions for new input
                observerPosition = null;
                targetPosition = null;
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    }

    async function performLineOfSightAnalysis(observerPosition, targetPosition) {
        const numberOfSamples = 100;
        const positions = [];
        const cartographicObserver = Cesium.Cartographic.fromCartesian(observerPosition);
        const cartographicTarget = Cesium.Cartographic.fromCartesian(targetPosition);

        // Interpolate positions between observer and target
        for (let i = 0; i <= numberOfSamples; i++) {
            const interpolation = Cesium.Cartesian3.lerp(observerPosition, targetPosition, i / numberOfSamples, new Cesium.Cartesian3());
            positions.push(Cesium.Cartographic.fromCartesian(interpolation));
        }

        // Sample terrain heights
        const sampledPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);

        // Clear previous visualization
        viewer.entities.removeAll();

        for (let i = 0; i < sampledPositions.length - 1; i++) {
            const currentHeight = sampledPositions[i].height;
            const nextHeight = sampledPositions[i + 1].height;

            // Calculate visibility directly into heights
        // Determine if the line gets blocked by checking if both points in the height sample are viable.
        const heightAboveTerrainCurrent = positions[i].height;
        const heightAboveTerrainNext = positions[i + 1].height;

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

        // Add a segment with color based on visibility
        viewer.entities.add({
            polyline: {
                positions: [currentCartesian, nextCartesian],
                width: 3,
                material: visibleSegment ? Cesium.Color.BLUE : Cesium.Color.RED
                }
            });
        }
    }

    function reset() {
        if (observerPosition) {
            viewer.entities.remove(observerPosition);
            observerPosition = undefined;
        }
        targetPosition = undefined;
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        //handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    return {
        start,
        reset
    };

})();