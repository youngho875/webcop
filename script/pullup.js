window.pullup = (function() {
    const viewer = window.CesiumViewer;
    let pullupaddedPoints = [];
    let pullupaddedEntityIds = [];
    let lineColor = Cesium.Color.GREEN;
    let lineWidth = 2;
    let modelEntity = null; // 애니메이션 구동 glb 모델 엔티티
    let entitiesVisible = true; // 풀업 요소들의 전역 가시성 상태
    let particleSystems = []; 
    let isInitialized = false;

    // 🎯 풀업 포인트 리스트박스 실시간 갱신 함수 (개별 체크박스 토글 및 선택 바인딩)
    function updatePullupListbox() {
        const listbox = document.getElementById('pullupRouteList');
        if (!listbox) return;

        listbox.innerHTML = '';

        // 등록된 포인트들을 ID 순서대로 매핑하여 시각화
        pullupaddedPoints.forEach((p, idx) => {
            const option = document.createElement('div');
            option.style.cssText = `
                padding: 6px 10px;
                margin-bottom: 4px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                font-size: 11px;
                color: #ddd;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background 0.2s;
            `;

            // 개별 체크박스 생성
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.cssText = `
                margin: 0;
                cursor: pointer;
                accent-color: #4caf50;
            `;
            
            // 포인트에 매핑된 실제 엔티티 ID 역조회 후 체크 처리
            const targetId = `point-${p.id}-${p.lon}-${p.lat}`;
            const targetEntity = viewer.entities.getById(targetId);
            checkbox.checked = targetEntity ? targetEntity.show : true;

            // 체크박스 핸들러: 해당 노드 포인트만 개별 토글
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const visible = checkbox.checked;
                if (targetEntity) targetEntity.show = visible;
                showNotification(`포인트 [${p.id}] 표출 ${visible ? '켬' : '끎'}`, "success");
            });

            // 리스트 아이템 클릭 시 삭제/입력 폼에 정보 복사 바인딩
            option.addEventListener('click', () => {
                document.getElementById('id').value = p.id;
                document.getElementById('lon').value = p.lon;
                document.getElementById('lat').value = p.lat;
                document.getElementById('alt').value = p.alt;
                document.getElementById('triggerFire').checked = p.triggerFire;
                
                Array.from(listbox.children).forEach(child => child.style.background = 'rgba(255, 255, 255, 0.05)');
                option.style.background = 'rgba(76, 175, 80, 0.3)';
            });

            const textContainer = document.createElement('div');
            textContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                flex: 1;
                align-items: center;
            `;
            textContainer.innerHTML = `
                <span>📍 ID: <strong>${p.id}</strong> (순번: ${idx + 1})</span>
                <span style="font-size: 10px; color: #aaa;">Alt: ${p.alt}m</span>
            `;

            option.appendChild(checkbox);
            option.appendChild(textContainer);
            listbox.appendChild(option);
        });

        if (pullupaddedPoints.length === 0) {
            listbox.innerHTML = `<div style="text-align:center; color:#777; font-size:11px; padding-top:20px;">등록된 풀업 포인트가 없습니다.</div>`;
        }
    }

    // UI 생성 함수 (curve.js 및 radar.js와 동일한 세련된 다크 투명 테마 스타일)
    function createInfoBox() {
        const existBox = document.getElementById('pullupinfoBox');
        if (existBox) {
            existBox.style.display = 'block';
            updatePullupListbox();
            return;
        }

        const pullupinfoBox = document.createElement('div');
        pullupinfoBox.id = 'pullupinfoBox';
        pullupinfoBox.style.cssText = `
            position: absolute; 
            top: 150px; 
            left: 10px; 
            background-color: rgba(30, 30, 30, 0.85);
            backdrop-filter: blur(4px);
            padding: 16px; 
            border-radius: 8px; 
            z-index: 1005; 
            box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            width: 310px;
            box-sizing: border-box;
        `;

        pullupinfoBox.innerHTML = `
            <div>
                <div id="pullupHeader" style="margin: 0 0 14px 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #fff; letter-spacing: 0.5px;">📈 풀업항적 설정</span>
                    <span id="pullupCloseBtn" style="cursor: pointer; color: #aaa; font-size: 20px; font-weight: bold; line-height: 1;">&times;</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">ID:</label>
                        <input type="text" id="id" placeholder="ID 입력" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">위도 (Latitude):</label>
                        <input type="number" id="lat" step="0.000001" placeholder="지도 좌클릭 입력 가능" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">경도 (Longitude):</label>
                        <input type="number" id="lon" step="0.000001" placeholder="지도 좌클릭 입력 가능" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">고도 (Altitude):</label>
                        <input type="number" id="alt" step="1" placeholder="고도 미터 단위" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Line Color:</label>
                        <input type="color" id="lineColor" value="#008000" style="flex: 1; height: 22px; padding: 0; background: none; border: 1px solid #434346; cursor: pointer; border-radius: 4px;">
                    </div>
                    <div style="display: flex; align-items: center;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Line Width:</label>
                        <input type="number" id="lineWidth" step="1" value="2" style="flex: 1; padding: 4px 6px; background: #252526; border: 1px solid #434346; color: white; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div style="display: flex; align-items: center; padding-top: 2px;">
                        <label style="width: 115px; font-size: 11px; color: #aaa;">Fire Trigger:</label>
                        <input type="checkbox" id="triggerFire" style="cursor: pointer; accent-color: #4caf50;">
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; color: #4caf50; font-weight: bold; display: block; margin-bottom: 4px;">📊 등록된 풀업 포인트 리스트</label>
                    <div id="pullupRouteList" style="width: 100%; height: 90px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 6px; box-sizing: border-box; overflow-y: auto;"></div>
                </div>

                <input type="file" id="rfileInput" accept=".json" style="display: none;">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 6px;">
                    <button id="addPointBtn" style="padding: 7px; background-color: #2b6c43; border: none; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; grid-column: span 2; font-size: 12px;">➕ 포인트 추가</button>
                    <button id="pulluploadBtn" style="padding: 5px; background-color: #1f7887; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">📂 Load JSON</button>
                    <button id="saveBtn" style="padding: 5px; background-color: #2d7d46; border: none; color: white; font-size: 11px; border-radius: 4px; cursor: pointer;">💾 Save JSON</button>
                </div>

                <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                    <button id="deleteAllBtn" style="flex: 1; padding: 5px; background-color: #333; border: 1px solid #555; color: #eee; font-size: 11px; border-radius: 4px; cursor: pointer;">Remove All</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button id="togglebtn" style="padding: 5px; background-color: #2d2d30; border: 1px solid #434346; color: #ccc; font-size: 11px; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 8px;">🟠 풀업항적 토글</button>
                </div>

                <div id="notification" style="margin-top: 10px; display: none; text-align: center; font-size: 11px; padding: 5px; border-radius: 4px; font-weight: bold;"></div>
            </div>
        `;

        document.body.appendChild(pullupinfoBox);
        
        const closeBtn = document.getElementById('pullupCloseBtn');
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#ff6b6b');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#aaa');

        makeElementDraggable(pullupinfoBox);
        setupEventListeners();
        updatePullupListbox();
    }

    function setupEventListeners() {
        if (isInitialized) return;

        document.getElementById('addPointBtn').addEventListener('click', addPoint);
        document.getElementById('saveBtn').addEventListener('click', saveJSON);
        document.getElementById('pulluploadBtn').addEventListener('click', () => document.getElementById('rfileInput').click());
        document.getElementById('rfileInput').addEventListener('change', pulluphandleFileUpload);
        document.getElementById('deleteAllBtn').addEventListener('click', clearAll);
        document.getElementById('togglebtn').addEventListener('click', toggleEntityVisibility);
        
        document.getElementById('pullupCloseBtn').addEventListener('click', function() {
            const box = document.getElementById('pullupinfoBox');
            if (box) box.style.display = 'none';
        });

        document.getElementById('lineColor').addEventListener('change', (event) => {
            lineColor = Cesium.Color.fromCssColorString(event.target.value);
            updatePolyline();
        });
        document.getElementById('lineWidth').addEventListener('change', (event) => {
            lineWidth = parseFloat(event.target.value);
            updatePolyline();
        });

        isInitialized = true;
    }

    function toggleEntityVisibility() {
        entitiesVisible = !entitiesVisible;
    
        pullupaddedEntityIds.forEach(id => {
            const entity = viewer.entities.getById(id);
            if (entity) {
                entity.show = entitiesVisible;
            }
        });
    
        particleSystems.forEach(particleSystem => {
            particleSystem.show = entitiesVisible;
        });
    
        if (modelEntity) {
            modelEntity.show = entitiesVisible;
        }

        const btn = document.getElementById('togglebtn');
        if (btn) btn.textContent = entitiesVisible ? '🟠 풀업항적 숨기기' : '🟠 풀업항적 보이기';
        
        showNotification(entitiesVisible ? "풀업항적 표시 활성화" : "풀업항적 표시 비활성화", "success");
    }
    
    function init() {
        if (!viewer) return;
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction(function (click) {
            const pickedPosition = viewer.scene.pickPosition(click.position);

            if (Cesium.defined(pickedPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

                const lonInput = document.getElementById('lon');
                const latInput = document.getElementById('lat');
                if (lonInput && latInput) {
                    lonInput.value = longitude;
                    latInput.value = latitude;
                }
            } else {
                showNotification('지형 위 포인트를 명확히 선택하세요.', 'error');
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    
    function addPoint() {
        const id = document.getElementById('id').value.trim();
        const lat = parseFloat(document.getElementById('lat').value);
        const lon = parseFloat(document.getElementById('lon').value);
        const alt = parseFloat(document.getElementById('alt').value);
        const triggerFire = document.getElementById('triggerFire').checked;

        if (!id) {
            showNotification('ID를 지정하세요.', 'error');
            return;
        }
        if (isNaN(lat) || isNaN(lon) || isNaN(alt)) {
            showNotification('정확한 좌표 및 고도 값을 입력하세요.', 'error');
            return;
        }

        const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        pullupaddedPoints.push({ id, lon, lat, alt, triggerFire });

        const pointEntity = viewer.entities.add({
            id: `point-${id}-${lon}-${lat}`,
            position: position,
            point: {
                pixelSize: 10,
                color: Cesium.Color.RED,
                heightReference: Cesium.HeightReference.NONE
            },
            show: entitiesVisible
        });

        pullupaddedEntityIds.push(pointEntity.id);
        updatePolyline();
        updatePullupListbox();
        showNotification(`포인트 [${id}] 추가 완료`, 'success');
    }

    function addParticleEffectAtDestination() {
        if (pullupaddedPoints.length === 0) return;
        
        const lastPt = pullupaddedPoints[pullupaddedPoints.length - 1];
        const destinationPosition = Cesium.Cartesian3.fromDegrees(lastPt.lon, lastPt.lat, lastPt.alt);

        const particleSystem = new Cesium.ParticleSystem({
            image: '/object/fire.png',  
            startColor: Cesium.Color.RED.withAlpha(0.7),
            endColor: Cesium.Color.YELLOW.withAlpha(0.3),
            startScale: 1.0,
            endScale: 4.0,
            minimumParticleLife: 1.0,
            maximumParticleLife: 2.0,
            minimumSpeed: 5.0,
            maximumSpeed: 10.0,
            imageSize: new Cesium.Cartesian2(3000, 3000),
            emissionRate: 20.0,
            lifetime: 5.0,
            emitter: new Cesium.CircleEmitter(1.0),
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(destinationPosition),
            sizeInMeters: true,
            show: entitiesVisible
        });

        viewer.scene.primitives.add(particleSystem);
        particleSystems.push(particleSystem);

        setTimeout(() => {
            viewer.scene.primitives.remove(particleSystem);
            particleSystems = particleSystems.filter(ps => ps !== particleSystem);
        }, 4000); 
    }

    function updatePolyline() {
        const existingLine = viewer.entities.getById("addedSpline");
        if (existingLine) {
            viewer.entities.remove(existingLine);
            pullupaddedEntityIds = pullupaddedEntityIds.filter(id => id !== existingLine.id);
        }
        
        if (pullupaddedPoints.length > 1) {
            const positions = pullupaddedPoints.map(p =>
                Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
            );

            const splineEntity = viewer.entities.add({
                id: "addedSpline",
                polyline: {
                    positions: positions,
                    width: lineWidth,
                    material: new Cesium.PolylineGlowMaterialProperty({
                        glowPower: 0.2,
                        color: lineColor
                    })
                },
                show: entitiesVisible
            });

            pullupaddedEntityIds.push(splineEntity.id);
        }
    }

    function saveJSON() {
        if (pullupaddedPoints.length === 0) return;
        
        const lineData = [{
            id: 'line-pullup',
            lineColor: document.getElementById('lineColor').value,
            lineWidth: lineWidth,
            points: pullupaddedPoints
        }];

        const blob = new Blob([JSON.stringify(lineData), null, 2], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pullupData.json';
        a.click();
        URL.revokeObjectURL(url);
        showNotification('JSON 파일 저장 성공', 'success');
    }
    
    function pulluphandleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const fileData = JSON.parse(e.target.result);
                if (!Array.isArray(fileData)) {
                    showNotification('유효한 배열 구조의 JSON 파일이 아닙니다.', 'error');
                    return;
                }
    
                clearAll(); // 초기화 후 병합 로드
    
                fileData.forEach(item => {
                    (item.points || []).forEach(coord => {
                        if (coord.lon !== undefined && coord.lat !== undefined && coord.alt !== undefined) {
                            pullupaddedPoints.push({
                                id: coord.id || item.id,
                                lon: coord.lon,
                                lat: coord.lat,
                                alt: coord.alt,
                                triggerFire: coord.triggerFire || false
                            });
                        }
                    });
                });
    
                createLineAndParticles(fileData);
                initializeModelAnimation();
                updatePullupListbox();
                showNotification('JSON 항적 데이터 반영 및 구동 완료', 'success');
            } catch (error) {
                console.error('JSON Parsing Exception:', error);
                showNotification('파일 구조가 파싱될 수 없습니다.', 'error');
            }
        };
        reader.readAsText(file);
    }

    function createLineAndParticles(data) {
        data.forEach(item => {
            const positions = item.points.map(coord =>
                Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt)
            );

            const lineEntity = viewer.entities.add({
                id: `line-${item.id}`,
                polyline: {
                    positions: positions,
                    width: item.lineWidth || 2,
                    material: Cesium.Color.fromCssColorString(item.lineColor || '#008000')
                },
                show: entitiesVisible
            });

            pullupaddedEntityIds.push(lineEntity.id);

            item.points.forEach(coord => {
                const ptId = coord.id || item.id;
                const pointEntity = viewer.entities.add({
                    id: `point-${ptId}-${coord.lon}-${coord.lat}`,
                    position: Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt),
                    point: {
                        pixelSize: 6,
                        color: Cesium.Color.RED
                    },
                    show: entitiesVisible
                });

                pullupaddedEntityIds.push(pointEntity.id);
            });
        });
    }

    function initializeModelAnimation() {
        if (pullupaddedPoints.length < 2) return;
        
        const positions = pullupaddedPoints.map(p =>
            Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
        );
        
        const times = Array.from({ length: positions.length }, (_, index) => index);
    
        const spline = new Cesium.CatmullRomSpline({
            times: times,
            points: positions
        });
    
        const splinePositions = [];
        const numberOfSamples = 100;
    
        for (let i = 0; i <= numberOfSamples; i++) {
            const t = (i / numberOfSamples) * (positions.length - 1);
            splinePositions.push(spline.evaluate(t));
        }
        
        let currentIndex = 0;
        const interval = 50; 
    
        if (modelEntity) {
            viewer.entities.remove(modelEntity);
        }

        modelEntity = viewer.entities.add({
            id: 'animatedModel_pullup',
            position: new Cesium.CallbackProperty(() => {
                return splinePositions[currentIndex];
            }, false),
            orientation: new Cesium.CallbackProperty(() => {
                if (currentIndex < splinePositions.length - 1) {
                    const start = splinePositions[currentIndex];
                    const end = splinePositions[currentIndex + 1];
                    const direction = Cesium.Cartesian3.subtract(end, start, new Cesium.Cartesian3());
                    Cesium.Cartesian3.normalize(direction, direction);
    
                    const heading = Math.atan2(direction.y, direction.x);
                    const pitch = Math.asin(direction.z);
                    const headingOffset = Cesium.Math.toRadians(90);
                    const rotationQuaternion = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, headingOffset);
                    const orientation = Cesium.Transforms.headingPitchRollQuaternion(start, new Cesium.HeadingPitchRoll(heading, pitch, 0));
    
                    return Cesium.Quaternion.multiply(orientation, rotationQuaternion, new Cesium.Quaternion());
                }
                return Cesium.Quaternion.IDENTITY;
            }, false),
            model: {
                uri: '/object/kn-23.gltf',
                scale: 1.0,
                minimumPixelSize: 64
            },
            show: entitiesVisible
        });
    
        const timerId = setInterval(() => {
            if (!viewer.entities.getById('animatedModel_pullup')) {
                clearInterval(timerId);
                return;
            }
            currentIndex = (currentIndex + 1) % splinePositions.length;
    
            if (currentIndex === splinePositions.length - 1) {
                addParticleEffectAtDestination();
            }
        }, interval);
    }
    
    function clearAll() {
        pullupaddedEntityIds.forEach(id => {
            const entity = viewer.entities.getById(id);
            if (entity) viewer.entities.remove(entity);
        });
        
        if (modelEntity) {
            viewer.entities.remove(modelEntity);
            modelEntity = null;
        }

        particleSystems.forEach(ps => viewer.scene.primitives.remove(ps));
        particleSystems = [];
        
        pullupaddedEntityIds = [];
        pullupaddedPoints = [];
        
        updatePullupListbox();
        showNotification('데이터를 깨끗하게 초기화했습니다.', 'success');
    }

    function showNotification(message, type) {
        const el = document.getElementById('notification');
        if (!el) return;
        el.textContent = message;
        el.style.backgroundColor = type === 'success' ? 'rgba(46, 125, 50, 0.85)' : 'rgba(184, 43, 43, 0.85)';
        el.style.color = '#fff';
        el.style.display = 'block';
        el.style.padding = '5px';
        el.style.borderRadius = '4px';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    function makeElementDraggable(element) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0, initialX = 0, initialY = 0;
        const header = document.getElementById('pullupHeader');

        header.addEventListener('mousedown', dragMouseDown);
        function dragMouseDown(e) {
            if (e.target.id === 'pullupCloseBtn' || e.target.tagName.toLowerCase() === 'input') {
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

    // 초기화 리스너 등록
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    return { 
        createInfoBox: createInfoBox,
        init: init,
        toggleInfoBox: function() {
            const box = document.getElementById('pullupinfoBox');
            if (box) {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? 'block' : 'none';
                if (isHidden) updatePullupListbox();
            } else {
                createInfoBox();
            }
        }
    };
})();