window.domeDrawing = (function() {

    const viewer = window.CesiumViewer;
    
    let primitives = [];
    let infoBox = null;
    let renderMode = "transparent";

    function createControlPanel() {
        // Check if control panel already exists
        if (document.getElementById('controlPanel')) {
            return; // If control panel already exists, don't recreate it
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
            <button id="removeDomeButton">Remove Dome</button>
            <button id="loadJsonMeshButton">Load Domes from JSON</button>
            <button id="closePanelButton">Close Panel</button>
        `;

        document.body.appendChild(controlPanel);

        makeElementDraggable(controlPanel);

        
        document.getElementById('createDomeButton').addEventListener('click', function() {
            const longitude = parseFloat(document.getElementById('longitude').value);
            const latitude = parseFloat(document.getElementById('latitude').value);
            const radius = parseFloat(document.getElementById('radius').value);
            const color = document.getElementById('color').value;
            renderMode = document.getElementById('renderMode').value;
            createDome(longitude, latitude, radius, color, renderMode);
        });

        document.getElementById('removeDomeButton').addEventListener('click', removeDomes);

        document.getElementById('loadJsonMeshButton').addEventListener('click', function() {
            const renderMode = document.getElementById('renderMode').value;
            loadJson('/jsonData/domeData.json').then(domeData => {
                domeData.forEach(data => {
                    const { longitude, latitude, radius, color } = data;
                    switch (renderMode) {
                        case 'transparent':
                            createTransparentDome(longitude, latitude, radius, color);
                            break;
                        case 'mesh':
                            createMeshDome(longitude, latitude, radius, color);
                            break;
                        default:
                            createWireframeDome(longitude, latitude, radius, "black");
                            break;
                    }
                });
            }).catch(error => {
                console.error("Error loading dome data:", error);
            });
        });

        document.getElementById('closePanelButton').addEventListener('click', function() {
            // Only close the control panel without removing domes
            controlPanel.remove(); // Remove only the control panel from DOM
        });
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

    function createDome(longitude, latitude, radius, color, renderMode) {
        switch (renderMode) {
            case 'mesh':
                createMeshDome(longitude, latitude, radius, color);
                break;
            case 'transparent':
                createTransparentDome(longitude, latitude, radius, color);
                break;
            default:
                createWireframeDome(longitude, latitude, radius, color);
                break;
        }
    }

    function createWireframeDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);
        const verticalSegments = 64;
        const horizontalSegments = 32;
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition);
    
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
    
            viewer.entities.add({
                polyline: {
                    positions: circlePositions,
                    width: 1.5,
                    material: Cesium.Color.fromCssColorString(color).withAlpha(0.2)
                }
            });
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
    
            viewer.entities.add({
                polyline: {
                    positions: verticalPositions,
                    width: 1.5,
                    material: Cesium.Color.fromCssColorString(color).withAlpha(0.2)
                }
            });
        }
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

        primitives.push(dome);
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

        primitives.push(dome);
    }

    function removeDomes() {
        primitives.forEach(primitive => {
            if (viewer.entities.contains(primitive)) {
                viewer.entities.remove(primitive);
            } else {
                viewer.scene.primitives.remove(primitive);
            }
        });
        primitives = [];
    }

    function loadJson(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            });
    }

    return { createControlPanel, createDome };

})();