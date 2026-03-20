// app.js
window.domeDrawing = (function() {
    // 스타일을 동적으로 추가
    const style = document.createElement('style');
    style.innerHTML = `

    #editor {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(255, 255, 255, 0.8);
        padding: 10px;
        z-index: 10;
    }
    #editor input, #editor button {
        margin-top: 5px;
        width: 100%;
    }
    `;
    document.head.appendChild(style);

    const viewer = window.CesiumViewer;

    let currentDome;

    function createEditor() {
        // 편집기 UI 생성
        const editor = document.createElement('div');
        editor.id = 'editor';
        editor.style.position = 'absolute';
        editor.style.top = '10px';
        editor.style.left = '10px';
        editor.style.background = 'rgba(255, 255, 255, 0.8)';
        editor.style.padding = '10px';
        editor.style.zIndex = '10';
        editor.style.width = '200px'; // 최소 크기 설정
        editor.style.cursor = 'grab'; // 손잡이 커서
        document.body.appendChild(editor);

        const dragHeader = document.createElement('div');
        dragHeader.style.display = 'flex';
        dragHeader.style.justifyContent = 'space-between';
        dragHeader.style.alignItems = 'center';
        dragHeader.style.cursor = 'move'; // 드래그 표시
        dragHeader.style.background = 'lightgray';
        dragHeader.style.padding = '4px';
        dragHeader.style.position = 'relative'; // 상대 위치 설정
        dragHeader.textContent = 'Editor';

        // 닫기 버튼 추가
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.cursor = 'pointer';
        closeButton.style.border = 'none';
        closeButton.style.marginLeft = '10px'; // 간격 조정
        closeButton.style.padding = '4px';
        closeButton.addEventListener('click', function() {
            editor.style.display = 'none'; // 창 숨기기
        });

        dragHeader.appendChild(closeButton);
        editor.appendChild(dragHeader);

        const createLabeledInput = (labelText, inputId, defaultValue, type = 'number', step = '0.1') => {
            const label = document.createElement('label');
            label.textContent = labelText;
            const input = document.createElement('input');
            input.type = type;
            input.id = inputId;
            input.value = defaultValue;
            input.style.width = '100%'; // 입력 필드 크기 조정
            if (type === 'number') {
                input.step = step;
            }
            label.appendChild(input);
            //label.appendChild(document.createElement('br')); // 줄바꿈 추가

            const valueDisplay = document.createElement('span');
            valueDisplay.id = inputId + 'Value';
            valueDisplay.textContent = defaultValue;
            label.appendChild(document.createElement('br'));
            label.appendChild(valueDisplay);

            input.addEventListener('input', function() {
                document.getElementById(inputId + 'Value').textContent = input.value;
            });
        
            

            return label;
        };

        editor.appendChild(createLabeledInput('Longitude:', 'longitude', '126.9292'));
        editor.appendChild(createLabeledInput('Latitude:', 'latitude', '37.5252'));
        editor.appendChild(createLabeledInput('Height:', 'height', '100', 'number', '10'));
        editor.appendChild(createLabeledInput('Radius:', 'radius', '5000', 'number', '100'));
        editor.appendChild(createLabeledInput('Red:', 'red', '1', 'range', '0.1').childNodes[1]);
        editor.appendChild(createLabeledInput('Green:', 'green', '0', 'range', '0.1').childNodes[1]);
        editor.appendChild(createLabeledInput('Blue:', 'blue', '0', 'range', '0.1').childNodes[1]);
        editor.appendChild(createLabeledInput('Alpha:', 'alpha', '0.5', 'range', '0.1').childNodes[1]);

        const drawDomeButton = document.createElement('button');
        drawDomeButton.textContent = 'Draw Dome';
        drawDomeButton.style.marginTop = '5px';
        drawDomeButton.style.width = '100%';
        editor.appendChild(drawDomeButton);

        // 드로잉 기능
        drawDomeButton.addEventListener('click', function() {
            const longitude = parseFloat(document.getElementById('longitude').value);
            const latitude = parseFloat(document.getElementById('latitude').value);
            const height = parseFloat(document.getElementById('height').value);
            const radius = parseFloat(document.getElementById('radius').value);

            const red = parseFloat(document.getElementById('red').value);
            const green = parseFloat(document.getElementById('green').value);
            const blue = parseFloat(document.getElementById('blue').value);
            const alpha = parseFloat(document.getElementById('alpha').value);

            const color = new Cesium.Color(red, green, blue, alpha);

            if (currentDome) {
                viewer.scene.primitives.remove(currentDome);
            }

            currentDome = drawDome(longitude, latitude, height, radius, color);
        });

        let isDragging = false;
        let offset = { x: 0, y: 0 };

        dragHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset.x = e.clientX - editor.offsetLeft;
            offset.y = e.clientY - editor.offsetTop;
            editor.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                editor.style.left = `${e.clientX - offset.x}px`;
                editor.style.top = `${e.clientY - offset.y}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            editor.style.cursor = 'grab';
        });
    };


    function drawDome(longitude, latitude, height, radius, color) {
        const center = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);

        if (!center) {
            console.error("Invalid center value");
            return;
        }
    
        const sphereGeometry = new Cesium.SphereGeometry({
            radius: radius,
            stackPartitions: 16,
            slicePartitions: 32,
        });
    
        if (!sphereGeometry) {
            console.error("Failed to create geometry");
            return;
        }

        const modelMatrix = Cesium.Matrix4.multiplyByTranslation(
            Cesium.Transforms.eastNorthUpToFixedFrame(center),
            new Cesium.Cartesian3(0.0, 0.0, radius / 2),
            new Cesium.Matrix4()  // 새로운 Matrix4 객체 생성
        );

        if (!modelMatrix) {
            console.error("Failed to create model matrix");
            return;
        }
    
        const sphereInstance = new Cesium.GeometryInstance({
            geometry: sphereGeometry,
            modelMatrix: modelMatrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
            },
        });
    
        return viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: sphereInstance,
            appearance: new Cesium.PerInstanceColorAppearance({
                closed: true,
                translucent: true
            })
        }));
    }

    /*
    // 돔 그리기 함수
    function drawDome(longitude, latitude, height, radius, color) {
        const center = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);

        if (!center) {
            console.error("Invalid center value");
            return;
        }

        const domeGeometry = new Cesium.CylinderGeometry({
            length: radius,
            topRadius: radius,
            bottomRadius: radius,
            slices: 64,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        });

        if (!domeGeometry) {
            console.error("Failed to create geometry");
            return;
        }
    
        const matrix = Cesium.Matrix4.multiplyByTranslation(
            Cesium.Transforms.eastNorthUpToFixedFrame(center),
            new Cesium.Cartesian3(0.0, 0.0, radius / 2),
            new Cesium.Matrix4()  // 추가된 부분: 출력 결과를 받을 새로운 Matrix4 객체를 생성
        );
    
        if (!matrix) {
            console.error("Failed to create model matrix");
            return;
        }

        const domeInstance = new Cesium.GeometryInstance({
            geometry: domeGeometry,
            modelMatrix: matrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
            },
        });

        return viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: domeInstance,
            appearance: new Cesium.PerInstanceColorAppearance({
                closed: true,
                translucent: true
            })
        }));
    }
    */
    // 드래그 앤 드롭 이벤트 구현부
    
    

    return {createEditor, drawDome};

})();