window.domeDrawing = (function() {
    const viewer = window.CesiumViewer;
    let domes = {}; // Store domes by ID

    let areDomesVisible = true;

    function createControlPanel() {
        if (document.getElementById('controlPanel')) {
            return;
        }

        const controlPanel = document.createElement('div');
        controlPanel.id = 'controlPanel';
        controlPanel.style.position = 'absolute';
        controlPanel.style.top = '150px';
        controlPanel.style.left = '10px';
        controlPanel.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        controlPanel.style.padding = '10px';
        controlPanel.style.borderRadius = '10px';
        controlPanel.style.zIndex = '100';
        controlPanel.style.boxShadow = '3px 3px 10px rgba(0, 0, 0, 0.3)';
        controlPanel.style.border = '1px solid #ccc';

        controlPanel.innerHTML = `
            <div>
            <h3 style="margin: 0 0 10px 0; text-align: center;">방공망 제어</h3> 
                <div>
                    <label for="domeId">Dome ID: </label>
                    <input type="text" id="domeId">
                </div>
                <div>
                    <label for="longitude">Longitude: </label>
                    <input type="number" id="longitude" step="0.0001" value="126.9211">
                </div>
                <div>
                    <label for="latitude">Latitude: </label>
                    <input type="number" id="latitude" step="0.0001" value="37.5252">
                </div>
                <div>
                    <label for="radius">Radius: </label>
                    <input type="number" id="radius" step="1" value="50000">
                </div>
                <div>
                    <label for="color">Color: </label>
                    <input type="text" id="color" value="rgba(0, 0, 255, 0.5)">
                </div>
                <div>
                    <label for="renderMode">Render Mode: </label>
                    <select id="renderMode">
                        <option value="wireframe">Wireframe</option>
                        <option value="transparent">Transparent</option>
                        <option value="mesh">Mesh</option>
                    </select>
                </div>
                <button id="createDomeButton">Create Dome</button>
                <button id="removeDomeButton">Remove Dome by ID</button>
                <button id="removeAllDomesButton">Remove All Domes</button>
                <button id="saveDomesButton">Save Domes as JSON</button>
                <button id="toggleButton">토글</button>
                <button id="closePanelButton">Close Panel</button>                
                <div>
                    <label for="domejsonFileInput">Load Domes from JSON: </label>
                    <input type="file" id="domejsonFileInput" accept=".json">
                    <button id="loadDomesButton">Load Domes</button>
                </div>

            </div>
        `;

        document.body.appendChild(controlPanel);
        makeElementDraggable(controlPanel);

        document.getElementById('createDomeButton').addEventListener('click', function() {
            const domeId = document.getElementById('domeId').value;
            if (domeId in domes) {
                console.warn(`Dome with ID '${domeId}' already exists.`);
                return;
            }

            const longitude = parseFloat(document.getElementById('longitude').value);
            const latitude = parseFloat(document.getElementById('latitude').value);
            const radius = parseFloat(document.getElementById('radius').value);
            const color = document.getElementById('color').value;
            const renderMode = document.getElementById('renderMode').value;

            createDome(domeId, longitude, latitude, radius, color, renderMode);
        });

        document.getElementById('removeDomeButton').addEventListener('click', function() {
            const domeId = document.getElementById('domeId').value;
            removeDome(domeId);
        });

        document.getElementById('removeAllDomesButton').addEventListener('click', removeAllDomes);

        document.getElementById('loadDomesButton').addEventListener('click', loadDomesFromJson);

        document.getElementById('saveDomesButton').addEventListener('click', saveDomesToJson);

        document.getElementById('toggleButton').addEventListener('click', toggleDomesVisibility);

        document.getElementById('closePanelButton').addEventListener('click', function() {
            controlPanel.remove();
        });
    }

    function toggleDomesVisibility() {
        areDomesVisible = !areDomesVisible;
        for (const domeId in domes) {
            if (domes[domeId]) {
                const domeEntities = domes[domeId].entities;
                domeEntities.forEach(entity => {
                    entity.show = areDomesVisible;
                });
            }
        }

        const toggleButton = document.getElementById('toggleVisibilityButton');
        toggleButton.textContent = areDomesVisible ? 'Hide Domes' : 'Show Domes';
    }

    function makeElementDraggable(element) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0, initialX = 0, initialY = 0;

        element.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'select') {
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

    function createDome(domeId, longitude, latitude, radius, color, renderMode) {
        let dome;
        switch (renderMode) {
            case 'mesh':
                dome = createMeshDome(longitude, latitude, radius, color);
                break;
            case 'transparent':
                dome = createTransparentDome(longitude, latitude, radius, color);
                break;
            default:
                dome = createWireframeDome(longitude, latitude, radius, color);
                break;
        }
        if (dome) {
            domes[domeId] = {
                entities: dome,
                config: { domeId, longitude, latitude, radius, color, renderMode }
            };
        }
    }

    function createWireframeDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        const verticalSegments = 64;
        const horizontalSegments = 32;
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition);
        const entities = []; // To track entities
        
        // Draw horizontal circles
        for (let j = 0; j <= horizontalSegments; j++) {
            const phi = (Math.PI / 2) * (j / horizontalSegments);
            const circlePositions = [];
            for (let i = 0; i <= verticalSegments; i++) {
                const theta = (Math.PI * 2) * (i / verticalSegments);
                const x = radius * Math.cos(theta) * Math.sin(phi);
                const y = radius * Math.sin(theta) * Math.sin(phi);
                const z = radius * Math.cos(phi);
    
                const position = new Cesium.Cartesian3(x, y, z);
                const globalPosition = Cesium.Matrix4.multiplyByPoint(transform, position, new Cesium.Cartesian3());
                circlePositions.push(globalPosition);
            }
    
            const entity = viewer.entities.add({
                polyline: {
                    positions: circlePositions,
                    width: 1.5,
                    material: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
                 }
                
            });
            entities.push(entity);
        }
        
        // Draw vertical segments
        for (let i = 0; i <= verticalSegments; i++) {
            const theta = (Math.PI * 2) * (i / verticalSegments);
            const verticalPositions = [];
            for (let j = 0; j <= horizontalSegments; j++) {
                const phi = (Math.PI / 2) * (j / horizontalSegments);
                const x = radius * Math.cos(theta) * Math.sin(phi);
                const y = radius * Math.sin(theta) * Math.sin(phi);
                const z = radius * Math.cos(phi);
    
                const position = new Cesium.Cartesian3(x, y, z);
                const globalPosition = Cesium.Matrix4.multiplyByPoint(transform, position, new Cesium.Cartesian3());
                verticalPositions.push(globalPosition);
            }
    
            const entity = viewer.entities.add({
                polyline: {
                    positions: verticalPositions,
                    width: 1.5,
                    material: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
                },
                
            });
            entities.push(entity);
        }
        
        return entities;
    }

    function createMeshDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);

        const sphereGeometry = new Cesium.SphereGeometry({
            vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
            radius: radius
        });

        const geometryInstance = new Cesium.GeometryInstance({
            geometry: sphereGeometry,
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color))
            }
        });

        const appearance = new Cesium.PerInstanceColorAppearance({
            flat: true,
            translucent: true
        });

        const dome = viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: geometryInstance,
            appearance: appearance,
            asynchronous: false
        }));

        return dome;
    }

    function createTransparentDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);

        const sphereGeometry = new Cesium.SphereGeometry({
            vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
            radius: radius,
            slicePartitions: 16,
            stackPartitions: 16
        });

        const geometryInstance = new Cesium.GeometryInstance({
            geometry: sphereGeometry,
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color))
            }
        });

        const meshAppearance = new Cesium.MaterialAppearance({
            material: Cesium.Material.fromType('Color', {
                color: Cesium.Color.fromCssColorString(color).withAlpha(0.2)
            }),
            translucent: true,
            faceForward: true
        });

        const dome = viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: geometryInstance,
            appearance: meshAppearance,
            asynchronous: false
        }));

        return dome;
    }
/*
    function removeDome(domeId) {
        if (domes[domeId]) {
            const dome = domes[domeId].entities;
            if (Array.isArray(dome)) {
                dome.forEach(primitive => {
                    viewer.entities.remove(primitive);
                });
            } else {
                viewer.scene.primitives.remove(dome);
            }
            delete domes[domeId];
        } else {
            console.warn(`No dome found with ID '${domeId}'.`);
        }
    }

    function removeAllDomes() {
        for (const domeId in domes) {
            if (domes.hasOwnProperty(domeId)) {
                removeDome(domeId);
            }
        }
        domes = {};
    }
*/
    function removeDome(domeId) {
        if (domes[domeId]) {
            const { entities } = domes[domeId];
            entities.forEach(entity => {
                viewer.entities.remove(entity);
            });
            delete domes[domeId];
        } else {
            console.warn(`No dome found with ID '${domeId}'.`);
        }
    }
    
    function removeAllDomes() {
        for (const domeId in domes) {
            removeDome(domeId);
        }
        domes = {};
    }

    function loadDomesFromJson() {
        const input = document.getElementById('domejsonFileInput');
        if (input.files.length === 0) {
            console.warn("No file selected!");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const domeData = JSON.parse(event.target.result);
                domeData.forEach(data => {
                    const { domeId, longitude, latitude, radius, color, renderMode } = data;
                    if (!(domeId in domes)) {
                        createDome(domeId, longitude, latitude, radius, color, renderMode || 'wireframe');
                    } else {
                        console.warn(`Dome with ID '${domeId}' already exists.`);
                    }
                });
            } catch (error) {
                console.error("Failed to parse JSON", error);
            }
        };
        reader.readAsText(input.files[0]);
    }

    function saveDomesToJson() {
        const domeArray = Object.values(domes).map(d => d.config);
        const jsonString = JSON.stringify(domeArray, null, 2);
        
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'domes.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return { createControlPanel };

})();