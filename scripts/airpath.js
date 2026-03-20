(function () {
    // Create Cesium Viewer
    const viewer = window.CesiumViewer;

    let activeShapePoints = [];
    let activeShape;
    let floatingPoint;
    const polylines = []; // Store drawn polylines

    // Create an InfoBox
    const infoBox = document.createElement('div');
    infoBox.id = 'infoBox';
    infoBox.style.position = 'absolute';
    infoBox.style.top = '50px';
    infoBox.style.left = '50px';
    infoBox.style.width = '320px';
    infoBox.style.background = 'white';
    infoBox.style.border = '1px solid #ccc';
    infoBox.style.padding = '10px';
    infoBox.style.borderRadius = '5px';
    infoBox.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    infoBox.style.zIndex = 1000;
    infoBox.style.cursor = 'move';
    infoBox.innerHTML = `
        <label>Line Width: <input type="text" id="lineWidthInput" value="3"></label><br>
        <label>Color: <input type="color" id="colorInput" value="#ff0000"></label><br>
        <label>Latitude: <input type="text" id="latitudeInput" placeholder="0.0"></label><br>
        <label>Longitude: <input type="text" id="longitudeInput" placeholder="0.0"></label><br>
        <label>Height: <input type="text" id="heightInput" placeholder="0.0"></label><br>
        <label>Pitch: <input type="text" id="pitchInput" placeholder="0.0"></label><br>
        <label>Roll: <input type="text" id="rollInput" placeholder="0.0"></label><br>
        <button id="addPointButton">Add Point</button>
        <button id="startDrawingButton">Start Drawing</button>
        <button id="saveButton">Save to JSON</button>
        <input type="file" id="loadFile" style="display: none;">
        <button id="loadButton">Load JSON</button>
    `;
    document.body.appendChild(infoBox);

    // Make the infoBox draggable
    (function makeDraggable() {
        let offsetX, offsetY;
        infoBox.addEventListener('mousedown', function (e) {
            offsetX = e.clientX - infoBox.offsetLeft;
            offsetY = e.clientY - infoBox.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
        });

        document.addEventListener('mouseup', function () {
            document.removeEventListener('mousemove', onMouseMove);
        });

        function onMouseMove(e) {
            infoBox.style.left = (e.clientX - offsetX) + 'px';
            infoBox.style.top = (e.clientY - offsetY) + 'px';
        }
    })();

    // Add event listeners for polyline drawing
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function startDrawing() {
        reset();
        // Left click to add a point
        handler.setInputAction(function (event) {
            const earthPosition = viewer.camera.pickEllipsoid(event.position, Cesium.Ellipsoid.WGS84);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(earthPosition);
                    startPolyline([earthPosition]);
                }
                activeShapePoints.push(earthPosition);
                createPoint(earthPosition);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Mouse move to update the temporary polyline
        handler.setInputAction(function (event) {
            if (Cesium.defined(floatingPoint)) {
                const newPosition = viewer.camera.pickEllipsoid(event.endPosition, Cesium.Ellipsoid.WGS84);
                if (Cesium.defined(newPosition)) {
                    activeShapePoints.pop();
                    activeShapePoints.push(newPosition);
                    floatingPoint.position.setValue(newPosition);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Double click to finish drawing
        handler.setInputAction(function (event) {
            if (activeShapePoints.length > 1) {
                finishDrawing();
                reset();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    function createPoint(worldPosition) {
        return viewer.entities.add({
            position: worldPosition,
            point: {
                color: Cesium.Color.YELLOW,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    function startPolyline(positionData) {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);
        const dynamicPositions = new Cesium.CallbackProperty(function () {
            return new Cesium.PolylineGeometry({
                positions: activeShapePoints,
            });
        }, false);

        activeShape = viewer.entities.add({
            polyline: {
                positions: dynamicPositions,
                clampToGround: true,
                width: parseFloat(document.getElementById('lineWidthInput').value),
                material: color
            }
        });
    }

    function finishDrawing() {
        const colorValue = document.getElementById('colorInput').value;
        const color = Cesium.Color.fromCssColorString(colorValue);
        const lineWidth = parseFloat(document.getElementById('lineWidthInput').value);

        const polylineEntity = viewer.entities.add({
            polyline: {
                positions: activeShapePoints,
                clampToGround: true,
                width: lineWidth,
                material: color
            }
        });
        polylines.push({
            id: polylineEntity.id,
            coordinates: activeShapePoints.map(pos => {
                const cartographic = Cesium.Cartographic.fromCartesian(pos);
                return {
                    longitude: Cesium.Math.toDegrees(cartographic.longitude),
                    latitude: Cesium.Math.toDegrees(cartographic.latitude),
                    height: cartographic.height
                };
            }),
            color: colorValue,
            width: lineWidth
        });

        viewer.entities.remove(floatingPoint);
        viewer.entities.remove(activeShape);
    }

    function reset() {
        if (activeShape) {
            viewer.entities.remove(activeShape);
            activeShape = undefined;
        }
        activeShapePoints = [];
        floatingPoint = undefined;
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    document.getElementById('addPointButton').addEventListener('click', function () {
        const latitude = parseFloat(document.getElementById('latitudeInput').value);
        const longitude = parseFloat(document.getElementById('longitudeInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(height)) {
            alert("Please enter valid numbers for latitude, longitude, and height.");
            return;
        }

        const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        activeShapePoints.push(cartesian);
        createPoint(cartesian);

        if (activeShapePoints.length === 1) {
            startPolyline(activeShapePoints);
        }
    });

    // Save polylines to JSON file
    document.getElementById('saveButton').addEventListener('click', function () {
        const jsonStr = JSON.stringify(polylines, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "polylines.json";
        a.click();
        URL.revokeObjectURL(url);
    });

    // Load polylines from JSON file
    document.getElementById('loadButton').addEventListener('click', function () {
        document.getElementById('loadFile').click();
    });

    document.getElementById('loadFile').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                try {
                    const loadedPolylines = JSON.parse(content);
                    loadedPolylines.forEach(loadPolyline);
                } catch (error) {
                    alert("Invalid JSON file");
                }
            };
            reader.readAsText(file);
        }
    });

    function loadPolyline(polylineData) {
        const color = Cesium.Color.fromCssColorString(polylineData.color);
        const positions = polylineData.coordinates.map(coordinate => Cesium.Cartesian3.fromDegrees(
            coordinate.longitude, coordinate.latitude, coordinate.height
        ));

        viewer.entities.add({
            id: polylineData.id,
            polyline: {
                positions: positions,
                clampToGround: true,
                width: polylineData.width,
                material: color
            }
        });
    }

    document.getElementById('startDrawingButton').addEventListener('click', startDrawing);
})();