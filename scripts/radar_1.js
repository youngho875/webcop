window.radar = (function() {
    const viewer = window.CesiumViewer;
    let radarPrimitives = {}; // Changed to object to store by ID
    let radarConfigurations = {};
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
                <label for="longitude">Longitude: </label>
                <input type="number" id="longitude" step="0.0001" value="126.9211">
            </div>
            <div>
                <label for="latitude">Latitude: </label>
                <input type="number" id="latitude" step="0.0001" value="37.5252">
            </div>
            <div>
                <label for="height">Height: </label>
                <input type="number" id="height" step="1" value="0">
            </div>
            <div>
                <label for="baseRadius">Base Radius: </label>
                <input type="number" id="baseRadius" step="1" value="100">
            </div>
            <div>
                <label for="topRadius">Top Radius: </label>
                <input type="number" id="topRadius" step="1" value="10000">
            </div>
            <div>
                <label for="length">Length: </label>
                <input type="number" id="length" step="1" value="80000">
            </div>
            <div>
                <label for="color">Color: </label>
                <input type="text" id="color" value="rgba(255, 255, 0, 0.5)">
            </div>
            <div>
                <label for="heading">Heading: </label>
                <input type="number" id="heading" step="1" value="-90">
            </div>
            <div>
                <label for="pitch">Pitch: </label>
                <input type="number" id="pitch" step="1" value="-60">
            </div>
            <div>
                <label for="roll">Roll: </label>
                <input type="number" id="roll" step="1" value="0">
            </div>
            <div>
                <label for="alpha">Alpha: </label>
                <input type="number" id="alpha" step="0.1" value="0.2" min="0" max="1">
            </div>
            <div>
                <label for="radarId">Radar ID: </label>
                <input type="number" id="radarId" step="1">
            </div>
            <input type="file" id="jsonFileInput" accept=".json">
            <button id="loadJsonButton">Load from JSON</button>
            <button id="removeByIdButton">Remove Radar By ID</button>
            <button id="removeAllButton">Remove All Radars</button>
            <button id="drawRadarButton">Draw Radar Beam</button>
            <button id="saveJsonButton">Save All Radars as JSON</button>
            <button id="closeInfoBoxButton">Close</button>
        `;

        document.body.appendChild(infoBox);
        makeElementDraggable(infoBox);

        document.getElementById('loadJsonButton').addEventListener('click', loadRadarsFromJson);
        document.getElementById('removeByIdButton').addEventListener('click', removeRadarById);
        document.getElementById('removeAllButton').addEventListener('click', removeAllRadars);
        document.getElementById('drawRadarButton').addEventListener('click', drawRadarFromInput);
        document.getElementById('saveJsonButton').addEventListener('click', saveAllRadarConfigsAsJson);
        document.getElementById('closeInfoBoxButton').addEventListener('click', function() {
            infoBox.remove();
        });
    }

    function drawRadarFromInput() {
        const radarConfig = gatherInputValues();
        const radarId = nextId++;
        radarConfigurations[radarId] = radarConfig;

        const color = Cesium.Color.fromCssColorString(radarConfig.color).withAlpha(radarConfig.alpha);
        drawRadarBeam(radarId, radarConfig, color);
    }

    function gatherInputValues() {
        return {
            longitude: parseFloat(document.getElementById('longitude').value),
            latitude: parseFloat(document.getElementById('latitude').value),
            height: parseFloat(document.getElementById('height').value),
            baseRadius: parseFloat(document.getElementById('baseRadius').value),
            topRadius: parseFloat(document.getElementById('topRadius').value),
            length: parseFloat(document.getElementById('length').value),
            color: document.getElementById('color').value,
            alpha: parseFloat(document.getElementById('alpha').value),
            heading: parseFloat(document.getElementById('heading').value),
            pitch: parseFloat(document.getElementById('pitch').value),
            roll: parseFloat(document.getElementById('roll').value)
        };
    }

    function drawRadarBeam(radarId, config, color) {
        const position = Cesium.Cartesian3.fromDegrees(config.longitude, config.latitude, config.height);

        const beamGeometry = new Cesium.CylinderGeometry({
            length: config.length,
            topRadius: config.topRadius,
            bottomRadius: config.baseRadius,
            slices: 64,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
        });

        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);

        const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(config.heading),
                Cesium.Math.toRadians(config.pitch),
                Cesium.Math.toRadians(config.roll)
            )
        );
        const rotationTranslationMatrix = Cesium.Matrix4.fromRotationTranslation(rotationMatrix);

        Cesium.Matrix4.multiply(modelMatrix, rotationTranslationMatrix, modelMatrix);
        Cesium.Matrix4.multiplyByTranslation(
            modelMatrix,
            new Cesium.Cartesian3(0.0, 0.0, config.length / 2),
            modelMatrix
        );

        const beamInstance = new Cesium.GeometryInstance({
            geometry: beamGeometry,
            modelMatrix: modelMatrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
            }
        });

        const radarPrimitive = new Cesium.Primitive({
            geometryInstances: beamInstance,
            appearance: new Cesium.PerInstanceColorAppearance({
                closed: true,
                translucent: true
            })
        });

        viewer.scene.primitives.add(radarPrimitive);
        radarPrimitives[radarId] = radarPrimitive;
    }

    function loadRadarsFromJson() {
        const input = document.getElementById('jsonFileInput');
        
        if (input.files.length === 0) {
            console.warn("No file selected!");
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const radars = JSON.parse(event.target.result);
                radars.forEach(radar => {
                    const radarId = nextId++;
                    radarConfigurations[radarId] = radar;
    
                    const color = Cesium.Color.fromCssColorString(radar.color).withAlpha(radar.alpha);
                    drawRadarBeam(radarId, radar, color);
                });
            } catch (error) {
                console.error("Failed to parse JSON", error.message);
                alert(`JSON Parsing Error: ${error.message}`);
            }
        };
        
        reader.onerror = function() {
            console.error("Could not read the file!");
        };
        
        reader.readAsText(input.files[0]);
    }

    /*
    function loadRadarsFromJson() {
        const input = document.getElementById('jsonFileInput');
        if (input.files.length === 0) {
            console.warn("No file selected!");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const radars = JSON.parse(event.target.result);
                radars.forEach(radar => {
                    const radarId = nextId++;
                    radarConfigurations[radarId] = radar;

                    const color = Cesium.Color.fromCssColorString(radar.color).withAlpha(radar.alpha);
                    drawRadarBeam(radarId, radar, color);
                });
            } catch (error) {
                console.error("Failed to parse JSON", error);
            }
        };
        reader.readAsText(input.files[0]);
    }
    */

    function removeRadarById() {
        const radarId = parseInt(document.getElementById('radarId').value);
        if (radarPrimitives[radarId]) {
            viewer.scene.primitives.remove(radarPrimitives[radarId]);
            delete radarPrimitives[radarId];
            delete radarConfigurations[radarId];
        }
    }

    function removeAllRadars() {
        Object.values(radarPrimitives).forEach(primitive => viewer.scene.primitives.remove(primitive));
        radarPrimitives = {};
        radarConfigurations = {};
    }

    function saveAllRadarConfigsAsJson() {
        const blob = new Blob([JSON.stringify(Object.values(radarConfigurations), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'radar_configurations.json';
        a.textContent = 'Download radar config JSON file';
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
    return { createInfoBox };
})();