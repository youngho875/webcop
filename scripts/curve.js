window.curve = (function() {
    const viewer = window.CesiumViewer;
    let pathEntities = {}; // Storing entities by ID
    let pathConfigurations = [];
    let nextId = 1; // To generate unique IDs
    let pathsVisible = true;
    let labelEntities = {};
    let labelsVisible = true;

    function createInfoBox() {
        const missileinfoBox = document.createElement('div');
        missileinfoBox.id = 'missileinfoBox';
        missileinfoBox.style.position = 'absolute';
        missileinfoBox.style.top = '150px';
        missileinfoBox.style.left = '10px';
        missileinfoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        missileinfoBox.style.padding = '10px';
        missileinfoBox.style.borderRadius = '10px';
        missileinfoBox.style.zIndex = '100';
        missileinfoBox.style.boxShadow = '3px 3px 10px rgba(0, 0, 0, 0.3)';
        missileinfoBox.style.border = '1px solid #ccc';

        missileinfoBox.innerHTML = `
            <div>
                <h3 style="margin: 0 0 10px 0; text-align: center;">미사일 경로 설정</h3> <!-- 제목 추가 -->
                <div>
                    <label for="pathId">Path ID:</label>
                    <input type="number" id="pathId" step="1">
                </div>
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

                <input type="file" id="curvejsonFileInput" accept=".json">
                <button id="drawPathButton">Draw Path</button>
                <button id="removeByIdButton">Remove Path By ID</button>
                <button id="curveloadJsonButton">Load from JSON</button>
                <button id="removeAllButton">Remove All Paths</button>
                <button id="saveJsonButton">Save Paths as JSON</button>
                <button id="togglepathButton">라인토글</button>
                <button id="labeltogglepathButton">라인정보토글</button>
                <button id="closeInfoBoxButton">Close</button>
            </div>
        `;

        document.body.appendChild(missileinfoBox);
        makeElementDraggable(missileinfoBox);

        document.getElementById('drawPathButton').addEventListener('click', drawPathFromInput);
        document.getElementById('removeByIdButton').addEventListener('click', removePathById);
        document.getElementById('curveloadJsonButton').addEventListener('click', loadJsonFromFile);
        document.getElementById('removeAllButton').addEventListener('click', removeAllPaths);
        document.getElementById('saveJsonButton').addEventListener('click', savePathsAsJson);
        document.getElementById('togglepathButton').addEventListener('click', toggleVisibility);
        document.getElementById('labeltogglepathButton').addEventListener('click', labeltoggleVisibility);
        document.getElementById('closeInfoBoxButton').addEventListener('click', function() {
            missileinfoBox.remove();
        });
    }

    function toggleVisibility() {
        pathsVisible = !pathsVisible;
        for (const pathId in pathEntities) {
            if (pathEntities[pathId]) {
                pathEntities[pathId].show = pathsVisible;
            }
        }
        const entities = viewer.entities.values;
        entities.forEach(entity => {
            if (entity.model) {
                entity.show = pathsVisible;
            }
        });

        toggleButton.textContent = pathsVisible ? 'Hide Paths' : 'Show Paths';
    }

    function labeltoggleVisibility() {
        labelsVisible = !labelsVisible;
        Object.values(labelEntities).forEach(labelsArray => {
            labelsArray.forEach(label => {
                label.show = labelsVisible;
            });
        });
        toggleButton.textContent = labelsVisible ? 'Hide Labels' : 'Show Labels';
    }

    function drawPathFromInput() {
        const pathConfig = gatherInputValues();
        pathConfigurations.push(pathConfig);

        const pathId = nextId++;
        pathConfig.id = pathId; // Assign ID to configuration
        curvDraw(
            pathId,
            pathConfig.coordinates.startLongitude,
            pathConfig.coordinates.startLatitude,
            pathConfig.coordinates.endLongitude,
            pathConfig.coordinates.endLatitude,
            pathConfig.altitudes.lowAltitude,
            pathConfig.altitudes.highAltitude
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
            }
        };
    }

    function curvDraw(pathId, startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
        const ellipsePoints = [];
        const labels = [];
        const numPoints = 30;
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);
            ellipsePoints.push(position);

            if (i % 4 === 0) {
                const label = viewer.entities.add({
                    position: position,
                    label: {
                        text: `Lon: ${interpolatedLon.toFixed(2)}\nLat: ${interpolatedLat.toFixed(2)}\nAlt: ${altitude.toFixed(0)} m`,
                        font: '5pt sans-serif',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 0.5,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20),
                        show: labelsVisible // Initial visibility
                    }
                });
                labels.push(label);
            }
        }

        const pathEntity = viewer.entities.add({
            polyline: {
                positions: ellipsePoints,
                width: 0.5,
                material: Cesium.Color.RED
            },
            show: pathsVisible,
            pickable: false,
        });

        pathEntities[pathId] = pathEntity;
        labelEntities[pathId] = labels;

        addModelFollowingPath(ellipsePoints, 0);
    }

    function addModelFollowingPath(ellipsePoints, rollInDegrees) {
        const positionProperty = new Cesium.SampledPositionProperty();
        const totalSeconds = 30;
        const interval = 10; // 10 milliseconds
        const totalIntervals = (totalSeconds * 1000) / interval;
        let currentInterval = 0;
        
        ellipsePoints.forEach((point, index) => {
            const time = Cesium.JulianDate.addSeconds(Cesium.JulianDate.now(), index, new Cesium.JulianDate());
            positionProperty.addSample(time, point);
        });
    
        const baseOrientation = new Cesium.VelocityOrientationProperty(positionProperty);
    
        const adjustedOrientationProperty = new Cesium.CallbackProperty((time, result) => {
            const baseOrientationQuaternion = baseOrientation.getValue(time, result);
            const headingOffset = Cesium.Math.toRadians(0);
            const rotationQuaternion = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, headingOffset);
    
            return Cesium.Quaternion.multiply(baseOrientationQuaternion, rotationQuaternion, result);
        }, false);
    
        const modelEntity = viewer.entities.add({
            position: positionProperty,
            orientation: adjustedOrientationProperty,
            model: {
                uri: '/object/kn-23.gltf',
                scale: 1.0
            },
        });
    
        // Use setInterval for continuous animation
        setInterval(() => {
            currentInterval = (currentInterval + 1) % totalIntervals;
            const t = currentInterval / totalIntervals;
            const position = interpolatePosition(ellipsePoints, t);
            positionProperty.addSample(Cesium.JulianDate.now(), position);
        }, interval);
    }
    
    function interpolatePosition(points, t) {
        const totalPoints = points.length;
        const scaledT = t * (totalPoints - 1);
        const index = Math.floor(scaledT);
        const frac = scaledT - index;
    
        if (index >= totalPoints - 1) return points[totalPoints - 1];
    
        const start = points[index];
        const end = points[index + 1];
    
        return Cesium.Cartesian3.lerp(start, end, frac, new Cesium.Cartesian3());
    }

    /*
    function addModelFollowingPath(ellipsePoints, rollInDegrees) {
        const positionProperty = new Cesium.SampledPositionProperty();
        const totalSeconds = 30;
        const interval = 10;
        const totalIntervals = (totalSeconds * 1000) / interval;
        let currentInterval = 0;
        
        ellipsePoints.forEach((point, index) => {
            const time = Cesium.JulianDate.addSeconds(Cesium.JulianDate.now(), index, new Cesium.JulianDate());
            positionProperty.addSample(time, point);
        });
    
        const baseOrientation = new Cesium.VelocityOrientationProperty(positionProperty);
    
        const adjustedOrientationProperty = new Cesium.CallbackProperty((time, result) => {
            const baseOrientationQuaternion = baseOrientation.getValue(time, result);
            const headingOffset = Cesium.Math.toRadians(90);  // Adjust this value as necessary
            const rotationQuaternion = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, headingOffset);
    
            return Cesium.Quaternion.multiply(baseOrientationQuaternion, rotationQuaternion, result);
        }, false);
    
        const modelEntity = viewer.entities.add({
            position: positionProperty,
            orientation: adjustedOrientationProperty,
            model: {
                uri: '/object/kn-23.gltf',
                scale: 1.0
            },
        });
    
        const animateModel = () => {
            if (currentInterval < totalIntervals) {
                currentInterval++;
            } else {
                currentInterval = 0; // Reset to start over
            }
            setTimeout(animateModel, interval);
        };
    
        animateModel();
    }
    */
    /*
    function addModelFollowingPath(ellipsePoints) {

        const positionProperty = new Cesium.SampledPositionProperty();

        const startTime = Cesium.JulianDate.now();
        const totalSeconds = 30;  // Adjust total travel time

        ellipsePoints.forEach((position, i) => {
            const time = Cesium.JulianDate.addSeconds(startTime, i * (totalSeconds / ellipsePoints.length), new Cesium.JulianDate());
            positionProperty.addSample(time, position);

        });

        const orientation = new Cesium.VelocityOrientationProperty(positionProperty);

        viewer.entities.add({
            position: positionProperty,
            orientation: orientation,
            model: {
                uri: '/object/kn-23.gltf',  // Replace with the path to your GLTF model
                scale: 1.0
            },
        });

   
        //ClockManager.init(viewer);
        // Change direct clock manipulation to use ClockManager
        //const stopTime = Cesium.JulianDate.addSeconds(startTime, totalSeconds, new Cesium.JulianDate());
        //ClockManager.setClock(viewer.clock.currentTime, stopTime, 1);

        viewer.clock.startTime = startTime.clone();
        viewer.clock.stopTime = Cesium.JulianDate.addSeconds(startTime, 30, new Cesium.JulianDate());
        viewer.clock.currentTime = startTime.clone();
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;  // Loop at the end
        viewer.clock.multiplier = 1;  // Playback speed
        viewer.clock.shouldAnimate = true;
    }
    */
   
    function removePathById() {
        const pathId = parseInt(document.getElementById('pathId').value);
        if (pathEntities[pathId]) {
            viewer.entities.remove(pathEntities[pathId]);
            delete pathEntities[pathId];
            pathConfigurations = pathConfigurations.filter(config => config.id !== pathId);
        }
    }

    function loadJsonFromFile() {
        const input = document.getElementById('curvejsonFileInput');
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

                    curvDraw(pathId, startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude);
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


    // Invoke the InfoBox creation
    return {createInfoBox};
})();



/*
window.curve = (function() {
    const viewer = window.CesiumViewer;
    let pathEntities = {}; // Changed from array to object for storing entities by ID
    let pathConfigurations = [];
    let nextId = 1; // To generate unique IDs

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
        pathConfigurations.push(pathConfig);

        const pathId = nextId++;
        pathConfig.id = pathId; // Assign ID to configuration
        curvDraw(
            pathId,
            pathConfig.coordinates.startLongitude,
            pathConfig.coordinates.startLatitude,
            pathConfig.coordinates.endLongitude,
            pathConfig.coordinates.endLatitude,
            pathConfig.altitudes.lowAltitude,
            pathConfig.altitudes.highAltitude
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
            }
        };
    }

    function curvDraw(pathId, startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
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
                    path.id = pathId; // Assign ID to each path
                    pathConfigurations.push(path);

                    const { startLongitude, startLatitude, endLongitude, endLatitude } = path.coordinates;
                    const { lowAltitude, highAltitude } = path.altitudes;

                    curvDraw(pathId, startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude);
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

    // Invoke the InfoBox creation
    return {createInfoBox };
})();
*/
/*
(function () {
    const viewer = window.CesiumViewer;
    
    // Function to create and add a particle system at a specific position
    function addParticleEffect(position) {
        viewer.scene.primitives.add(new Cesium.ParticleSystem({
            modelMatrix : Cesium.Transforms.eastNorthUpToFixedFrame(position),
            image : '/object/fire.png', // Path to the particle image
            startColor : Cesium.Color.WHITE.withAlpha(0.7),
            endColor : Cesium.Color.GRAY.withAlpha(0.1),
            minimumSpeed : 1.0,
            maximumSpeed : 4.0,
            lifetime : 5.0,
            emitter : new Cesium.ConeEmitter(Cesium.Math.toRadians(45.0)),
            emitterModelMatrix : Cesium.Matrix4.fromTranslation(Cesium.Cartesian3.UNIT_Z.negate(Cesium.Cartesian3.ZERO))
        }));
    }

    // Function to draw curve given coordinates and altitude
    function curvDraw(startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
        const ellipsePoints = [];
        const numPoints = 30; // Number of points in the path
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);

            ellipsePoints.push(position);

            // Check if this is the position to add a particle effect
            if (/i === Math.floor(numPoints / 2) // condition to target specific location like below: 
            if (/ i === Math.floor(numPoints / 2)  {
                addParticleEffect(position);
            }

            // Add label at certain intervals
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

        // Add the elliptical path to the scene
        viewer.entities.add({
            polyline: {
                positions: ellipsePoints,
                width: 0.5,
                material: Cesium.Color.RED
            }
        });
    }

    // Load JSON file and process each path
    function loadJsonAndDraw(url) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            })
            .then(data => {
                data.paths.forEach(path => {
                    const { startLongitude, startLatitude, endLongitude, endLatitude } = path.coordinates;
                    const { lowAltitude, highAltitude } = path.altitudes;
                    
                    // Function call to draw each path
                    curvDraw(startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude);
                });

                // Zoom to all entities in the viewer
                viewer.zoomTo(viewer.entities);
            })
            .catch(error => console.error('Error loading JSON:', error));
    }

    // Call the function with your JSON file path
    loadJsonAndDraw('/jsonData/datajson.json');
})();
*/

/*
(function () {
    const viewer = window.CesiumViewer;
    // Define start and end coordinates, and altitudes
    const startLon = 125.9935;
    const startLat = 39.9236;
    const endLon = 126.9211;
    const endLat = 37.5252;
    const minAltitude = 100.0; // in meters
    const maxAltitude = 100000.0; // in meters

    const ellipsePoints = [];

    function curvDraw(startLon, startLat, endLon, endLat, minAltitude, maxAltitude) {
        const numPoints = 30; // Number of points in the path
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);
            ellipsePoints.push(position);

            // Add label at certain intervals
            if (i % 4 === 0) {  // Add a label every 4th point
                viewer.entities.add({
                    position: position,
                    label: {
                        text: `Lon: ${interpolatedLon.toFixed(2)}\nLat: ${interpolatedLat.toFixed(2)}\nAlt: ${altitude.toFixed(0)} m`,
                        font: '14pt sans-serif',
                        fillColor: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20)
                    }
                });
            }
        }
    }

    // Add the elliptical path to the scene
    viewer.entities.add({
        polyline: {
            positions: ellipsePoints,
            width: 3,
            material: Cesium.Color.RED
        }
    });

    // JSON 파일에서 데이터를 로드하는 함수
    function loadJson(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("JSON 파일을 불러오는데 실패했습니다.");
                }
                return response.json();
            });
    }

// Zoom to the path
viewer.zoomTo(viewer.entities);

})();

*/