window.curve = (function() {
    const viewer = window.CesiumViewer;
    let pathEntities = {};
    let pathConfigurations = [];
    let nextId = 1;

    function createInfoBox() {
        const infoBox = document.createElement('div');
        infoBox.id = 'infoBox';
        infoBox.style.position = 'absolute';
        infoBox.style.top = '150px';
        infoBox.style.left = '10px';
        infoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        infoBox.style.padding = '10px';
        infoBox.style.borderRadius = '10px';
        infoBox.style.zIndex = '100';
        infoBox.style.boxShadow = '3px 3px 10px rgba(0, 0, 0, 0.3)';
        infoBox.style.border = '1px solid #ccc';

        infoBox.innerHTML = `
            <div>
                <label for="startLongitude">Start Longitude:</label>
                <input type="number" id="startLongitude" step="0.0001" value="125.9935">
            </div>
            <div>
                <label for="startLatitude">Start Latitude:</label>
                <input type="number" id="startLatitude" step="0.0001" value="40.8379">
            </div>
            <div>
                <label for="endLongitude">End Longitude:</label>
                <input type="number" id="endLongitude" step="0.0001" value="127.1036">
            </div>
            <div>
                <label for="endLatitude">End Latitude:</label>
                <input type="number" id="endLatitude" step="0.0001" value="36.6362">
            </div>
            <div>
                <label for="lowAltitude">Low Altitude (m):</label>
                <input type="number" id="lowAltitude" step="1" value="100">
            </div>
            <div>
                <label for="highAltitude">High Altitude (m):</label>
                <input type="number" id="highAltitude" step="1" value="120000">
            </div>
            <div>
                <label for="gltfUri">GLTF URI:</label>
                <input type="text" id="gltfUri" value="/object/kn-23.gltf">
            </div>
            <div>
                <label for="heading">Heading (°):</label>
                <input type="number" id="heading" step="0.1" value="0">
            </div>
            <div>
                <label for="pitch">Pitch (°):</label>
                <input type="number" id="pitch" step="0.1" value="0">
            </div>
            <div>
                <label for="roll">Roll (°):</label>
                <input type="number" id="roll" step="0.1" value="0">
            </div>
            <div>
                <label for="pathId">Path ID:</label>
                <input type="number" id="pathId" step="1">
            </div>
            <input type="file" id="jsonFileInput" accept=".json">
            <button id="drawPathButton">Draw Path</button>
            <button id="removeByIdButton">Remove Path By ID</button>
            <button id="loadJsonButton">Load from JSON</button>
            <button id="removeAllButton">Remove All Paths</button>
            <button id="saveJsonButton">Save Paths as JSON</button>
            <button id="closeInfoBoxButton">Close</button>
        `;

        document.body.appendChild(infoBox);
        makeElementDraggable(infoBox);

        document.getElementById('drawPathButton').addEventListener('click', drawPathFromInput);
        document.getElementById('removeByIdButton').addEventListener('click', removePathById);
        document.getElementById('loadJsonButton').addEventListener('click', loadJsonFromFile);
        document.getElementById('removeAllButton').addEventListener('click', removeAllPaths);
        document.getElementById('saveJsonButton').addEventListener('click', savePathsAsJson);
        document.getElementById('closeInfoBoxButton').addEventListener('click', function() {
            infoBox.remove();
        });
    }

    function drawPathFromInput() {
        const pathConfig = gatherInputValues();
        const pathId = nextId++;
        pathConfig.id = pathId;
        pathConfigurations.push(pathConfig);

        curvDraw(
            pathId,
            pathConfig.coordinates.startLongitude,
            pathConfig.coordinates.startLatitude,
            pathConfig.coordinates.endLongitude,
            pathConfig.coordinates.endLatitude,
            pathConfig.altitudes.lowAltitude,
            pathConfig.altitudes.highAltitude,
            pathConfig.gltfUri,
            pathConfig.orientation
        );
    }

    function gatherInputValues() {
        return {
            coordinates: {
                startLongitude: parseFloat(document.getElementById('startLongitude').value),
                startLatitude: parseFloat(document.getElementById('startLatitude').value),
                endLongitude: parseFloat(document.getElementById('endLongitude').value),
                endLatitude: parseFloat(document.getElementById('endLatitude').value)
            },
            altitudes: {
                lowAltitude: parseFloat(document.getElementById('lowAltitude').value),
                highAltitude: parseFloat(document.getElementById('highAltitude').value)
            },
            gltfUri: document.getElementById('gltfUri').value,
            orientation: {
                heading: parseFloat(document.getElementById('heading').value),
                pitch: parseFloat(document.getElementById('pitch').value),
                roll: parseFloat(document.getElementById('roll').value)
            }
        };
    }

    function curvDraw(pathId, startLon, startLat, endLon, endLat, minAltitude, maxAltitude, gltfUri, orientation) {
        const ellipsePoints = [];
        const numPoints = 30;
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);
            ellipsePoints.push(position);

            if (i % 4 === 0) {
                viewer.entities.add({
                    position: position,
                    label: {
                        text: `Lon: ${interpolatedLon.toFixed(2)}\nLat: ${interpolatedLat.toFixed(2)}\nAlt: ${altitude.toFixed(0)} m`,
                        font: '5pt sans-serif',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 0.5,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20)
                    }
                });
            }
        }

        const pathEntity = viewer.entities.add({
            polyline: {
                positions: ellipsePoints,
                width: 0.5,
                material: Cesium.Color.RED
            },
            pickable: false,
        });

        pathEntities[pathId] = pathEntity;

        addModelFollowingPath(ellipsePoints, gltfUri, orientation);
    }

    function addModelFollowingPath(ellipsePoints, gltfUri, orientation) {
        const positionProperty = new Cesium.SampledPositionProperty();

        const startTime = Cesium.JulianDate.now();
        const totalSeconds = 30;

        ellipsePoints.forEach((position, i) => {
            const time = Cesium.JulianDate.addSeconds(startTime, i * (totalSeconds / ellipsePoints.length), new Cesium.JulianDate());
            positionProperty.addSample(time, position);
        });

        const hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(orientation.heading),
            Cesium.Math.toRadians(orientation.pitch),
            Cesium.Math.toRadians(orientation.roll)
        );

        const orientationProperty = new Cesium.VelocityOrientationProperty(positionProperty);

        viewer.entities.add({
            position: positionProperty,
            orientation: orientationProperty,
            model: {
                uri: gltfUri,
                scale: 1.0
            },
            orientation: new Cesium.ConstantProperty(Cesium.Transforms.headingPitchRollQuaternion(Cesium.Cartesian3.ZERO, hpr))
        });

        viewer.clock.startTime = startTime;
        viewer.clock.stopTime = Cesium.JulianDate.addSeconds(startTime, totalSeconds, new Cesium.JulianDate());
        viewer.clock.currentTime = startTime;
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.multiplier = 1;
    }

    function removePathById() {
        const pathId = parseInt(document.getElementById('pathId').value);
        if (pathEntities[pathId]) {
            viewer.entities.remove(pathEntities[pathId]);
            delete pathEntities[pathId];
            pathConfigurations = pathConfigurations.filter(config => config.id !== pathId);
        }
    }

    function loadJsonFromFile() {
        const input = document.getElementById('jsonFileInput');
        if (input.files.length === 0) {
            console.warn("No file selected!");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                data.paths.forEach(path => {
                    const pathId = nextId++;
                    path.id = pathId;
                    pathConfigurations.push(path);

                    const { startLongitude, startLatitude, endLongitude, endLatitude } = path.coordinates;
                    const { lowAltitude, highAltitude } = path.altitudes;
                    const { gltfUri, orientation } = path;

                    curvDraw(pathId, startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude, gltfUri, orientation);
                });

                viewer.zoomTo(viewer.entities);
            } catch (error) {
                console.error('Failed to parse JSON', error);
            }
        };
        reader.readAsText(input.files[0]);
    }

    function removeAllPaths() {
        Object.values(pathEntities).forEach(entity => viewer.entities.remove(entity));
        pathEntities = {};
        pathConfigurations = [];
    }

    function savePathsAsJson() {
        const blob = new Blob([JSON.stringify({ paths: pathConfigurations }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'path_configurations.json';
        a.textContent = 'Download paths config JSON file';
        a.click();
        URL.revokeObjectURL(url);
    }

    function makeElementDraggable(element) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0, initialX = 0, initialY = 0;

        element.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            if (e.target.tagName.toLowerCase() === 'input') {
                return;
            }

            e.preventDefault();
            initialX = e.clientX;
            initialY = e.clientY;
            isDragging = true;
            document.addEventListener('mousemove', elementDrag);
            document.addEventListener('mouseup', closeDragElement);
        }

        function elementDrag(e) {
            if (!isDragging) return;

            e.preventDefault();
            offsetX = initialX - e.clientX;
            offsetY = initialY - e.clientY;
            initialX = e.clientX;
            initialY = e.clientY;
            element.style.top = (element.offsetTop - offsetY) + "px";
            element.style.left = (element.offsetLeft - offsetX) + "px";
        }

        function closeDragElement() {
            isDragging = false;
            document.removeEventListener('mousemove', elementDrag);
            document.removeEventListener('mouseup', closeDragElement);
        }
    }

    return { createInfoBox };
})();