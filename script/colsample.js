(function () {
    const viewer = window.CesiumViewer;
    let primitives = [];
    let domes = [];

    // Function to create a control panel
    function createControlPanel() {
        const controlPanel = document.createElement('div');
        controlPanel.id = 'controlPanel';
        controlPanel.style.position = 'absolute';
        controlPanel.style.top = '10px';
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
                <input type="number" id="radius" step="1" value="500">
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
        
        document.getElementById('createDomeButton').addEventListener('click', function () {
            const longitude = parseFloat(document.getElementById('longitude').value);
            const latitude = parseFloat(document.getElementById('latitude').value);
            const radius = parseFloat(document.getElementById('radius').value);
            const color = document.getElementById('color').value;
            const renderMode = document.getElementById('renderMode').value;
            createDome(longitude, latitude, radius, color, renderMode);
        });

        document.getElementById('removeDomeButton').addEventListener('click', removeDomes);

        document.getElementById('loadJsonMeshButton').addEventListener('click', function () {
            loadJson('/jsonData/domeData.json').then(domeData => {
                domeData.forEach(data => {
                    const { longitude, latitude, radius, color } = data;
                    createDome(longitude, latitude, radius, color, renderMode);
                });
            }).catch(error => {
                console.error("Error loading dome data:", error);
            });
        });

        document.getElementById('closePanelButton').addEventListener('click', function () {
            controlPanel.style.display = 'none';
        });
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
            if(!isDragging) return;
    
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

            primitives.push(viewer.entities.add({
                polyline: {
                    positions: circlePositions,
                    width: 1.5,
                    material: Cesium.Color.fromCssColorString(color).withAlpha(0.2)
                }
            }));
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

        domes.push(dome);
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

        domes.push(dome);
    }

    function removeDomes() {
        primitives.forEach(primitive => {
            if (viewer.entities.contains(primitive)) {
                viewer.entities.remove(primitive);
            } else {
                viewer.scene.primitives.remove(primitive);
            }
        });
        domes.forEach(dome => {
            viewer.scene.primitives.remove(dome);
        });
        primitives = [];
        domes = [];
    }

    // Function to create and add a particle system at a specific position
    function addParticleEffect(position) {
        viewer.scene.primitives.add(new Cesium.ParticleSystem({
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
            image: '/object/fire.png', // Path to the particle image
            startColor: Cesium.Color.WHITE.withAlpha(0.7),
            endColor: Cesium.Color.GRAY.withAlpha(0.1),
            minimumSpeed: 1.0,
            maximumSpeed: 4.0,
            lifetime: 5.0,
            emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(45.0)),
            emitterModelMatrix: Cesium.Matrix4.fromTranslation(Cesium.Cartesian3.UNIT_Z.negate(Cesium.Cartesian3.ZERO))
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

            // Check if this is the position to add a particle effect at a dome
            if (i === Math.floor(numPoints / 2)) {
                domes.forEach(dome => {
                    const domePosition = Cesium.Matrix4.getTranslation(dome.modelMatrix, new Cesium.Cartesian3());
                    if (Cesium.Cartesian3.distance(position, domePosition) < maxAltitude / 2) {
                        addParticleEffect(position);
                    }
                });
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

    // Initialize the control panel
    createControlPanel();
    
    // Example call to load JSON file and draw
    loadJsonAndDraw('/jsonData/datajson.json');
})();