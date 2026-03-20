window.particle = (function() {
    const viewer = window.CesiumViewer;
    let particleaddedPoints = [];
    let particleaddedEntityIds = [];
    let lineColor = Cesium.Color.BLUE;
    let lineWidth = 2;
    let modelEntity = null; // Model entity to animate

    

    function createInfoBox() {
        const particleinfoBox = document.createElement('div');
        particleinfoBox.id = 'particleinfoBox';
        particleinfoBox.style.position = 'absolute';
        particleinfoBox.style.top = '150px';
        particleinfoBox.style.left = '10px';
        particleinfoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        particleinfoBox.style.padding = '10px';
        particleinfoBox.style.borderRadius = '10px';
        particleinfoBox.style.zIndex = '100';
        particleinfoBox.style.boxShadow = '3px 3px 10px rgba(0, 0, 0, 0.3)';
        particleinfoBox.style.border = '1px solid #ccc';
        particleinfoBox.style.cursor = 'move';

        particleinfoBox.innerHTML = `
            <div>
                <h3 style="margin: 0 0 10px 0; text-align: center;">유도탄 정보</h3> <!-- 제목 추가 -->
                <div>
                    <label for="particle-id">ID:</label>
                    <input type="text" id="particle-id" placeholder="ID"> <!-- 'particle-id'로 고침 -->
                </div>
                <div>
                    <label for="particle-lat">위도:</label>
                    <input type="number" id="particle-lat" step="0.01" placeholder="위도">
                </div>
                <div>
                    <label for="particle-lon">경도:</label>
                    <input type="number" id="particle-lon" step="0.01" placeholder="경도">
                </div>
                <div>
                    <label for="particle-alt">고도:</label>
                    <input type="number" id="particle-alt" step="1" placeholder="고도">
                </div>
                <div>
                    <label for="triggerFire">Fire Trigger:</label>
                    <input type="checkbox" id="triggerFire">
                </div>
                <div>
                    <label for="lineColor">Line Color:</label>
                    <input type="color" id="lineColor" value="#008000">
                </div>
                <div>
                    <label for="lineWidth">Line Width:</label>
                    <input type="number" id="lineWidth" step="1" value="2">
                </div>
                <div>
                    <button id="addPointBtn">포인트 추가</button>
                    <button id="saveBtn">JSON 저장</button>
                    <button id="loadBtn">JSON 불러오기</button>
                    <input type="file" id="sfileInput" accept=".json" style="display: none;">
                    <button id="deleteAllBtn">전체 삭제</button>
                    <button id="particlecloseBtn">닫기</button>
                </div>
                <div id="notification" style="margin-top: 10px;"></div>
            </div>
        `;
        document.body.appendChild(particleinfoBox);

        makeElementDraggable(particleinfoBox);

        document.getElementById('addPointBtn').addEventListener('click', particleaddPoint);
        document.getElementById('saveBtn').addEventListener('click', saveJSON);
        document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('sfileInput').click());
        document.getElementById('sfileInput').addEventListener('change', particlehandleFileUpload);
        document.getElementById('deleteAllBtn').addEventListener('click', clearAll);
        //document.getElementById('startAnimationBtn').addEventListener('click', () => initializeModelAnimation());
        document.getElementById('particlecloseBtn').addEventListener('click', closeInfoBox);
        document.getElementById('lineColor').addEventListener('change', (event) => {
            lineColor = Cesium.Color.fromCssColorString(event.target.value);
        });
        document.getElementById('lineWidth').addEventListener('change', (event) => {
            lineWidth = parseFloat(event.target.value);
        });
    }

    function init() {
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction(function (click) {
            const pickedPosition = viewer.scene.pickPosition(click.position);

            if (Cesium.defined(pickedPosition)) {
                const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

                // Update input fields with the clicked position
                document.getElementById('particle-lon').value = longitude;
                document.getElementById('particle-lat').value = latitude;
            } else {
                showNotification('지형에 위치를 선택하세요.', 'error');
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    
    function makeElementDraggable(el) {
        let isDragging = false;
        let offset = [0, 0];

        el.addEventListener('mousedown', e => {
            isDragging = true;
            offset = [e.clientX - el.getBoundingClientRect().left, e.clientY - el.getBoundingClientRect().top];
            el.style.cursor = 'grabbing';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            el.style.cursor = 'move';
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            el.style.left = `${e.clientX - offset[0]}px`;
            el.style.top = `${e.clientY - offset[1]}px`;
        });
    }

    function particleaddPoint() {
        const id = document.getElementById('particle-id').value.trim();
        const lat = parseFloat(document.getElementById('particle-lat').value);
        const lon = parseFloat(document.getElementById('particle-lon').value);
        const alt = parseFloat(document.getElementById('particle-alt').value);
        const triggerFire = document.getElementById('triggerFire').checked;

        if (!id) {
            //showNotification('ID를 입력하세요.', 'error');
            return;
        }
        if (isNaN(lat) || isNaN(lon) || isNaN(alt)) {
            //showNotification('올바른 좌표를 입력하세요.', 'error');
            return;
        }

        const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        particleaddedPoints.push({ id, lon, lat, alt, triggerFire });

        const pointEntity = viewer.entities.add({
            id: `point-${id}-${lon}-${lat}`,
            position: position,
            point: {
                pixelSize: 10,
                color: Cesium.Color.RED,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });

        particleaddedEntityIds.push(pointEntity.id);

        // if (triggerFire) {
        //     const particleSystem = viewer.scene.primitives.add(new Cesium.ParticleSystem({
        //         image: '/object/fire.png',
        //         startColor: Cesium.Color.RED.withAlpha(0.7),
        //         endColor: Cesium.Color.YELLOW.withAlpha(0.3),
        //         startScale: 1.0,
        //         endScale: 4.0,
        //         minimumParticleLife: 1.0,
        //         maximumParticleLife: 2.0,
        //         minimumSpeed: 5.0,
        //         maximumSpeed: 10.0,
        //         imageSize: new Cesium.Cartesian2(3000, 3000),
        //         emissionRate: 20.0,
        //         lifetime: Number.MAX_VALUE,
        //         emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(45.0)),
        //         modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
        //         sizeInMeters: true
        //     }));

        //     addedEntityIds.push(particleSystem.id);
        // }

        updatePolyline();
        //showNotification('포인트 추가 성공!', 'success');
    }

    function addParticleEffectAtDestination() {
        const destinationPosition = Cesium.Cartesian3.fromDegrees(
            particleaddedPoints[particleaddedPoints.length - 1].lon,
            particleaddedPoints[particleaddedPoints.length - 1].lat,
            particleaddedPoints[particleaddedPoints.length - 1].alt
        );

        const particleSystem = new Cesium.ParticleSystem({
            image: '/object/fire.png',  // 파티클 이미지 경로
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
            sizeInMeters: true
        });

        viewer.scene.primitives.add(particleSystem);

         // 파티클 효과를 10초 후에 제거
         setTimeout(() => {
            viewer.scene.primitives.remove(particleSystem);
        }, 4000); // 10,000 밀리초 = 10
    }

    function updatePolyline() {
        const existingLine = viewer.entities.getById("addedSpline");
        if (existingLine) {
            viewer.entities.remove(existingLine);
            particleaddedEntityIds = particleaddedEntityIds.filter(id => id !== existingLine.id);
        }
        
        if (particleaddedPoints.length > 1) {
            const positions = particleaddedPoints.map(p =>
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
                    }),
                    clampToGround: true
                }
            });

            particleaddedEntityIds.push(splineEntity.id);
        }
    }

    function saveJSON() {
        const lineData = [{
            id: 'particleline-1',
            lineColor: document.getElementById('lineColor').value,
            lineWidth: lineWidth,
            points: particleaddedPoints
        }];

        const blob = new Blob([JSON.stringify(lineData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'particlepData.json';
        a.click();
        URL.revokeObjectURL(url);
        //showNotification('JSON 저장 완료!', 'success');
    }

    function particlehandleFileUpload(event) {
        const file = event.target.files[0];
    
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const fileData = JSON.parse(e.target.result);
    
                    if (!Array.isArray(fileData)) {
                        showNotification('올바른 JSON 포맷이 아닙니다.', 'error');
                        return;
                    }
    
                    // Clear existing points
                    particleaddedPoints = [];
    
                    fileData.forEach(item => {
                        // Verify item structure
                        (item.points || []).forEach(coord => {
                            if (coord.lon !== undefined && coord.lat !== undefined && coord.alt !== undefined) {
                                particleaddedPoints.push({
                                    id: item.id,
                                    lon: coord.lon,
                                    lat: coord.lat,
                                    alt: coord.alt,
                                    triggerFire: coord.triggerFire || false
                                });
                            } else {
                                console.warn('불완전한 좌표 데이터를 건너뜀:', coord);
                            }
                        });
                    });
    
                    createLineAndParticles(fileData);
                    //showNotification('JSON 불러오기 성공!', 'success');
                    initializeModelAnimation();
                } catch (error) {
                    console.error('JSON 파싱 오류:', error);
                    //showNotification('파일 형식이 잘못되었습니다.', 'error');
                }
            };
            reader.readAsText(file);
        }
    }

    function createLineAndParticles(data) {
        data.forEach(item => {
            const positions = item.points.map(coord =>
                Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt)
            );

            const lineEntity = viewer.entities.add({
                id: `particleline-${item.id}`,
                polyline: {
                    positions: positions,
                    width: item.lineWidth || 2,
                    material: Cesium.Color.fromCssColorString(item.lineColor || '#008000')
                }
            });

            particleaddedEntityIds.push(lineEntity.id);

            item.points.forEach(coord => {
                const pointEntity = viewer.entities.add({
                    id: `point-${item.id}-${coord.lon}-${coord.lat}`,
                    position: Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt),
                    point: {
                        pixelSize: 0.1,
                        color: Cesium.Color.RED,
                        //heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                });

                particleaddedEntityIds.push(pointEntity.id);

                // if (coord.triggerFire) {
                //     const particleSystem = viewer.scene.primitives.add(new Cesium.ParticleSystem({
                //         image: '/object/fire.png',
                //         startColor: Cesium.Color.RED.withAlpha(0.7),
                //         endColor: Cesium.Color.YELLOW.withAlpha(0.3),
                //         startScale: 1.0,
                //         endScale: 4.0,
                //         minimumParticleLife: 1.0,
                //         maximumParticleLife: 2.0,
                //         minimumSpeed: 5.0,
                //         maximumSpeed: 10.0,
                //         imageSize: new Cesium.Cartesian2(3000, 3000),
                //         emissionRate: 20.0,
                //         lifetime: Number.MAX_VALUE,
                //         emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(45.0)),
                //         modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
                //             Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt)
                //         ),
                //         sizeInMeters: true
                //     }));

                //     addedEntityIds.push(particleSystem.id);
                // }
            });
        });
    }

    function initializeModelAnimation() {
        if (particleaddedPoints.length < 2) {
            showNotification('애니메이션을 수행하려면 최소 두 개의 포인트가 필요합니다.', 'error');
            return;
        }
        
        const positions = particleaddedPoints.map(p =>
            Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
        );
        
        const times = Array.from({ length: positions.length }, (_, index) => index);
    
        const spline = new Cesium.CatmullRomSpline({
            times: times,
            points: positions
        });
    
        const splinePositions = [];
        const numberOfSamples = 100; // 스플라인을 따라 샘플링할 포인트 수
    
        for (let i = 0; i <= numberOfSamples; i++) {
            const t = (i / numberOfSamples) * (positions.length - 1); // 전체 시간 길이로 확장
            splinePositions.push(spline.evaluate(t));
        }
        
        let currentIndex = 0;
        const interval = 50; // 업데이트 간격 (밀리초 단위)
    
        const modelEntity = viewer.entities.add({
            id: 'particleModel',
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
                uri: '/object/M-SAM2.gltf',
                scale: 1.5,
                minimumPixelSize: 64
            }
        });
    
        // 애니메이션 루프를 시작
        function animateModel() {
            currentIndex = (currentIndex + 1) % splinePositions.length;
    
            if (currentIndex === splinePositions.length - 1) {
                addParticleEffectAtDestination();
            }
    
            setTimeout(animateModel, interval);
        }
    
        animateModel();
    }

    /*
    function initializeModelAnimation() {
        if (addedPoints.length < 2) {
            //showNotification('애니메이션을 수행하려면 최소 두 개의 포인트가 필요합니다.', 'error');
            return;
        }
        
        const positions = addedPoints.map(p =>
            Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
        );
        
        const times = Array.from({ length: positions.length }, (_, index) => index);
     
        const spline = new Cesium.CatmullRomSpline({
            times: times,
            points: positions
        });
        
        const splinePositions = [];
        const numberOfSamples = 100; // 스플라인을 따라 샘플링할 포인트 수
        
        for (let i = 0; i <= numberOfSamples; i++) {
            const t = (i / numberOfSamples) * (positions.length - 1); // 전체 시간 길이로 확장
            splinePositions.push(spline.evaluate(t));
        }
    
        
        const positionProperty = new Cesium.SampledPositionProperty();
        const startTime = Cesium.JulianDate.now();
        const totalDurationSeconds = 30; // 애니메이션의 전체 지속 시간
        
        splinePositions.forEach((position, index) => {
            const time = Cesium.JulianDate.addSeconds(startTime, (totalDurationSeconds / numberOfSamples) * index, new Cesium.JulianDate());
            positionProperty.addSample(time, position);
        });
    
        const baseOrientation = new Cesium.VelocityOrientationProperty(positionProperty);
    
        const adjustedOrientationProperty = new Cesium.CallbackProperty((time, result) => {
            const baseOrientationQuaternion = baseOrientation.getValue(time, result);
            const headingOffset = Cesium.Math.toRadians(90);
            const rotationQuaternion = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, headingOffset);
    
            return Cesium.Quaternion.multiply(baseOrientationQuaternion, rotationQuaternion, result);
        }, false);
    
        if (modelEntity) {
            viewer.entities.remove(modelEntity);
        }
    
        modelEntity = viewer.entities.add({
            id: 'animatedModel',
            position: positionProperty,
            orientation: adjustedOrientationProperty,
            model: {
                uri: '/object/M-SAM2.gltf',
                scale: 1.0,
                minimumPixelSize: 64
            }
        });
    
        viewer.clock.startTime = startTime.clone();
        viewer.clock.stopTime = Cesium.JulianDate.addSeconds(startTime, totalDurationSeconds, new Cesium.JulianDate());
        viewer.clock.currentTime = startTime.clone();
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.shouldAnimate = true;

        viewer.clock.onTick.addEventListener(() => {
        const timeDifference = Cesium.JulianDate.secondsDifference(viewer.clock.stopTime, viewer.clock.currentTime);
        const threshold = 0.1; // 임계값

        if (Math.abs(timeDifference) < threshold) {
            viewer.clock.currentTime = viewer.clock.startTime.clone();  // 현재 시간을 시작 시간으로 재설정
            addParticleEffectAtDestination();
        }
        });
    }
    */

    function clearAll() {
        particleaddedEntityIds.forEach(id => {
            const entity = viewer.entities.getById(id);
            if (entity) {
                viewer.entities.remove(entity);
            }
        });
    
        while (viewer.scene.primitives.length > 0) {
            const primitive = viewer.scene.primitives.get(0);
            viewer.scene.primitives.remove(primitive);
        }
    
        particleaddedEntityIds = [];
        particleaddedPoints = [];
        showNotification('모든 데이터 삭제 완료', 'success');
    }

    function closeInfoBox() {
        const particleinfoBox = document.getElementById('particleinfoBox');
        if (particleinfoBox) {
            particleinfoBox.remove();
        }
    }

    function showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.style.color = type === 'success' ? 'green' : 'red';
        setTimeout(() => {
            notification.textContent = '';
        }, 3000);
    }

    document.addEventListener('DOMContentLoaded', init);

    return { createInfoBox, init };
})();