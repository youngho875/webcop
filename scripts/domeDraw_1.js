window.domeDrawing = (function() {

    const viewer = window.CesiumViewer;
    
    let primitive = null;
    let infoBox = null;

    // 컨트롤 패널 동적 생성
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
                <label for="color">Color (RGBA): </label>
                <input type="text" id="color" value="rgba(0, 0, 255, 0.5)">
            </div>
            <button id="createDomeButton">Create Dome</button>
            <button id="removeDomeButton">Remove Dome</button>
            <button id="loadJsonButton">Load Domes from JSON</button>
            <button id="createMeshButton">Create Dome Mesh</button>
            <button id="closePanelButton">Close Panel</button>
        `;

        document.body.appendChild(controlPanel);

        makeElementDraggable(controlPanel);

        document.getElementById('createDomeButton').addEventListener('click', function () {
            const longitude = parseFloat(document.getElementById('longitude').value);
            const latitude = parseFloat(document.getElementById('latitude').value);
            const radius = parseFloat(document.getElementById('radius').value);
            const color = document.getElementById('color').value;
            createDome(longitude, latitude, radius, color);
        });

        document.getElementById('removeDomeButton').addEventListener('click', function () {
            removeDome();
        });

        document.getElementById('loadJsonButton').addEventListener('click', function () {
            loadJson('/jsonData/domeData.json').then(domeData => {
                domeData.forEach(data => {
                    createDome(data.longitude, data.latitude, data.radius, data.color);
                });
            }).catch(error => {
                console.error("Error loading dome data:", error);
            });
        });

        document.getElementById('createMeshButton').addEventListener('click', function () {
            const longitude = parseFloat(document.getElementById('longitude').value);
            const latitude = parseFloat(document.getElementById('latitude').value);
            const radius = parseFloat(document.getElementById('radius').value);
            const color = document.getElementById('color').value;
            createWireframeDome(longitude, latitude, radius, color);
        });

        document.getElementById('closePanelButton').addEventListener('click', function() {
            controlPanel.style.display = 'none';
        });
    }

    // 드래그 가능하게 하는 함수
    function makeElementDraggable(element) {
        let offsetX = 0, offsetY = 0, initialX = 0, initialY = 0;

        element.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            e.preventDefault();
            initialX = e.clientX;
            initialY = e.clientY;

            document.addEventListener('mousemove', elementDrag);
            document.addEventListener('mouseup', closeDragElement);
        }

        function elementDrag(e) {
            e.preventDefault();
            offsetX = initialX - e.clientX;
            offsetY = initialY - e.clientY;
            initialX = e.clientX;
            initialY = e.clientY;

            element.style.top = (element.offsetTop - offsetY) + "px";
            element.style.left = (element.offsetLeft - offsetX) + "px";
        }

        function closeDragElement() {
            document.removeEventListener('mousemove', elementDrag);
            document.removeEventListener('mouseup', closeDragElement);
        }
    }

    // 반구 메쉬 생성 함수
    function createWireframeDome(longitude, latitude, radius, color) {
        const cartesianPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude);

        const sphereGeometry = new Cesium.SphereGeometry({
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
            radius: radius
        });

        const geometryInstance = new Cesium.GeometryInstance({
            geometry: sphereGeometry,
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color).withAlpha(0.1)) // Transparent for mesh effect
            }
        });

        const wireframeAppearance = new Cesium.PerInstanceColorAppearance({
            flat: false, // Important for mesh
            faceForward: true,
            renderState: {
                lineWidth: Math.min(2.0, viewer.scene.maximumAliasedLineWidth)
            }
        });

        primitive = new Cesium.Primitive({
            geometryInstances: geometryInstance,
            appearance: wireframeAppearance,
            asynchronous: false
        });

        viewer.scene.primitives.add(primitive);
        
        // 마우스 오버 이벤트 설정
        viewer.screenSpaceEventHandler.setInputAction(function(movement) {
            const pickedObject = viewer.scene.pick(movement.endPosition);
            if (Cesium.defined(pickedObject) && pickedObject.primitive === primitive) {
                showInfoBox(movement.endPosition, longitude, latitude, radius, color);
            } else {
                hideInfoBox();
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    // 마우스 오버 시 정보 박스 표시 함수
    function showInfoBox(position, longitude, latitude, radius, color) {
        if (!infoBox) {
            infoBox = document.createElement('div');
            infoBox.id = 'infoBox';
            infoBox.style.position = 'absolute';
            infoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            infoBox.style.padding = '5px';
            infoBox.style.border = '1px solid #ccc';
            infoBox.style.borderRadius = '5px';
            infoBox.style.zIndex = '101';
            document.body.appendChild(infoBox);
        }

        infoBox.innerHTML = `
            <b>Longitude:</b> ${longitude.toFixed(4)}<br>
            <b>Latitude:</b> ${latitude.toFixed(4)}<br>
            <b>Radius:</b> ${radius}m<br>
            <b>Color:</b> ${color}
        `;
        
        infoBox.style.left = position.x + 20 + 'px';
        infoBox.style.top = position.y + 'px';
        infoBox.style.display = 'block';
    }

    // 정보 박스 숨기는 함수
    function hideInfoBox() {
        if (infoBox) {
            infoBox.style.display = 'none';
        }
    }

    // 반구 제거 함수
    function removeDome() {
        if (primitive) {
            viewer.scene.primitives.remove(primitive);
            primitive = null;
            hideInfoBox();
        }
    }

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

    return { createControlPanel, createWireframeDome };

})();