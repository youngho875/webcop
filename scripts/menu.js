(function() {
    // 스타일을 동적으로 추가
    const style = document.createElement('style');
    style.innerHTML = `
        #menu {
            position: absolute;
            top: 50px;
            left: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 10px;
            width: auto;
            display: flex; /* Flexbox로 레이아웃 설정 */
            gap: 10px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
            z-index: 1000;
        }
        #menu.hidden {
            display: none; /* 숨기기 위해 display를 none으로 설정 */
        }
        #menu-toggle {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 1001;
            background: #FFA500;
            color: white;
            border: none;
            padding: 10px 15px;
            cursor: pointer;
            border-radius: 4px;
        }
        #menu button {
            padding: 10px 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        #menu button:hover {
            background-color: #45a049;
        }
        .dropdown {
            position: relative;
            display: inline-block;
        }
        .dropdown-content {
            display: none;
            position: absolute;
            background-color: #f9f9f9;
            min-width: 160px;
            box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
            z-index: 1;
        }
        .dropdown-content a {
            color: black;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
        }
        .dropdown-content a:hover {
            background-color: #f1f1f1;
        }
        .dropdown-content label {
            color: black;
            padding: 8px 12px;
            display: block;
            cursor: pointer;
        }
        .dropdown-content label:hover {
            background-color: #f1f1f1;
        }
        .dropdown:hover .dropdown-content {
            display: block;
        }
        .dropbtn {
            background-color: #4CAF50;
            color: white;
            padding: 16px;
            font-size: 16px;
            border: none;
            cursor: pointer;
            border-radius: 4px;
        }
        .dropbtn:hover {
            background-color: #3e8e41;
        }
        input[type="radio"] {
            margin-right: 10px;
        }
        input[type="checkbox"] {
            margin-right: 10px;
        }
    `;
    document.head.appendChild(style);

    const viewer = window.CesiumViewer;

    // 메뉴 UI 생성
    const menu = document.createElement('div');
    menu.id = 'menu';
    document.body.appendChild(menu);

    const createToggleButton = (text, onAction, offAction) => {
        const button = document.createElement('button');
        button.textContent = text;
        let isActive = false;
        button.addEventListener('click', function() {
            if (isActive) {
                offAction();
                button.classList.remove('active');
            } else {
                onAction();
                button.classList.add('active');
            }
            isActive = !isActive;
        });
        return button;
    };

    const symbolButton = document.createElement('button');
    symbolButton.textContent = '기호선택';
    menu.appendChild(symbolButton);

    const homeButton = document.createElement('button');
    homeButton.textContent = 'Home View';
    menu.appendChild(homeButton);

    // const mapButton = document.createElement('button');
    // mapButton.textContent = 'cadrg_5';
    // menu.appendChild(mapButton);
    /*
    const mapButton = createToggleButton('cadrg_5', mapdraw.cadrg_5Draw, mapdraw.clearDraw);
    menu.appendChild(mapButton);

    const terrainButton = createToggleButton('terrain', mapdraw.terrainDraw, mapdraw.clearTerrain);
    menu.appendChild(terrainButton);
*/
    // const terrainButton = document.createElement('button');
    // terrainButton.id = 'menu-toggle';
    // terrainButton.textContent = 'terrain';
    // menu.appendChild(terrainButton);
    // start view mewu
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';
    menu.appendChild(dropdown);

    const dropbtn = document.createElement('button');
    dropbtn.className = 'dropbtn';
    dropbtn.textContent = 'Views';
    dropdown.appendChild(dropbtn);

    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'dropdown-content';
    dropdown.appendChild(dropdownContent);
    // end view menu

    const drawdropdown = document.createElement('div');
    drawdropdown.className = 'dropdown';
    menu.appendChild(drawdropdown);

    const drawdropbtn = document.createElement('button');
    drawdropbtn.className = 'dropbtn';
    drawdropbtn.textContent = 'Draw';
    drawdropdown.appendChild(drawdropbtn);

    const drawdropdownContent = document.createElement('div');
    drawdropdownContent.className = 'dropdown-content';
    drawdropdown.appendChild(drawdropdownContent);

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Layers';
    menu.appendChild(resetButton);

    // const distanceButton = document.createElement('button');
    // distanceButton.textContent = '거리';
    // menu.appendChild(distanceButton);

    // const losButton = document.createElement('button');
    // losButton.textContent = 'LOS';
    // menu.appendChild(losButton);

    const distanceButton = createToggleButton('거리', distance.start, distance.stop);
    menu.appendChild(distanceButton);

    const losButton = createToggleButton('LOS', los.start, los.stop);
    menu.appendChild(losButton);

    const domeButton = document.createElement('button');
    domeButton.textContent = '돔 그리기기';
    menu.appendChild(domeButton);

    // 버튼 이벤트 핸들링
    symbolButton.addEventListener('click', function() {
        openSymbolPopup();
    });

    homeButton.addEventListener('click', function() {
        viewer.camera.flyHome(1);
    });

    // mapButton.addEventListener('click', function() {
    //     //menu.classList.toggle('hidden');
    //     mapdraw.cadrg_5Draw();
    // });

    // terrainButton.addEventListener('click', function() {
    //     mapdraw.terrainDraw();
    // });

    resetButton.addEventListener('click', function() {
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(Cesium.createWorldImagery());
    });

    distanceButton.addEventListener('click', function() {
        distance.start();
    });

    losButton.addEventListener('click', function() {
        los.start();
    });

    domeButton.addEventListener('click', function() {
        domeDrawing.createEditor();
    });

    const actions = [
        { name: '폴리곤 그리기', activate: window.PolygonDrawing.activate, reset: window.PolygonDrawing.reset },
        { name: '폴리라인 그리기', activate: window.PolylineDrawing.activate, reset: window.PolylineDrawing.reset },
        { name: '원 그리기', activate: window.circleDrawing.activate, reset: window.circleDrawing.reset },
        { name: '라인 그리기', activate: window.lineDrawing.activate, reset: window.lineDrawing.reset }
    ];

    actions.forEach(action => {
        const link = document.createElement('a');
        link.textContent = action.name;
        link.href = '#';
        link.style.cursor = 'pointer';
        link.addEventListener('click', function() {
            actions.forEach(a => a.reset());
            action.activate();
        });
        drawdropdownContent.appendChild(link);
    });

    

/*
    // 라디오 버튼 항목 추가
    const createRadioItem = (name, longitude, latitude, groupName) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = groupName;
        radio.addEventListener('change', () => {
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10000)
            });
        });
        label.appendChild(radio);
        label.appendChild(document.createTextNode(name));
        dropdownContent.appendChild(label);
    };

    // 도시 리스트
    createRadioItem('Tokyo', 139.6917, 35.6895, 'city');
    createRadioItem('New York', -74.0060, 40.7128, 'city');
    createRadioItem('Paris', 2.3522, 48.8566, 'city');
*/

// 체크박스 항목 추가
const createCheckboxItem = (name, longitude, latitude, groupName) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = groupName;
    checkbox.addEventListener('change', () => {
        // 체크박스 변경 시 Cesium 카메라 이동
        if (checkbox.checked) {
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10000)
            });
        }
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(name));
    dropdownContent.appendChild(label);
};

// 도시 리스트
createCheckboxItem('Tokyo', 139.6917, 35.6895, 'city');
createCheckboxItem('New York', -74.0060, 40.7128, 'city');
createCheckboxItem('Paris', 2.3522, 48.8566, 'city');


})();

// function openSymbolPopup() {
//     window.open("milsymbol.html", "symbolPopup", "width=300,height=400");
//     }