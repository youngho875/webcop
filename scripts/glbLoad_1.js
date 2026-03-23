/*
(function() {
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain()
        });
    }

    const viewer = window.CesiumViewer;

     // 모델 URL
        const modelUrl = '../object/CesiumDrone.glb'; // GLB 파일 경로

        // 위치 설정 함수
        function loadModelAtPosition(latitude, longitude, altitude, scale, headingDeg, pitchDeg, rollDeg) {
            const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);
            const heading = Cesium.Math.toRadians(headingDeg);
            const pitch = Cesium.Math.toRadians(pitchDeg);
            const roll = Cesium.Math.toRadians(rollDeg);
            const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
            
            // 모델 추가
            const entity = viewer.entities.add({
                name: 'Model',
                position: position,
                orientation: orientation,
                model: {
                    uri: modelUrl,
                    scale: scale,
                    minimumPixelSize: 128 // 화면에서 최소 크기 설정
                }
            });

            // 모델을 볼 수 있는 카메라 뷰로 이동
            viewer.flyTo(entity, {
                offset: new Cesium.HeadingPitchRange(heading, pitch - 0.5, 1000)
            });
        }

        // 모델 위치, 스케일, 자세 설정
        const latitude = 37.7749; // 위도
        const longitude = 127.4194; // 경도
        const altitude = 100; // 고도(m)
        const scale = 1.0; // 모델 스케일 (1.0은 원본 크기)
        const heading = 135; // 방향 (도)
        const pitch = 0; // 피치 (도)
        const roll = 0; // 롤 (도)

        // 위치 및 설정 값으로 모델 로드
        loadModelAtPosition(latitude, longitude, altitude, scale, heading, pitch, roll);
})();
*/

(function() {
    // Cesium Viewer 설정
    const viewer = window.CesiumViewer;

    // JSON 데이터 로드 함수
    function loadWaypoints(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            });
    }

    // 웨이포인트 기반 경로 및 모델 설정
    function setupModelPath(waypoints) {
        waypoints.forEach(([waypointSetName, waypointSet]) => {
            // 웨이포인트에서 위치 정보 추출
            const positions = waypointSet.map(w =>
                Cesium.Cartesian3.fromDegrees(parseFloat(w.longitude), parseFloat(w.latitude), parseFloat(w.altitude))
            );

            // 시계 및 애니메이션 설정 (1분 애니메이션)
            const start = Cesium.JulianDate.now();
            const stop = Cesium.JulianDate.addSeconds(start, 20, new Cesium.JulianDate());

            viewer.clock.startTime = start.clone();
            viewer.clock.stopTime = stop.clone();
            viewer.clock.currentTime = start.clone();
            viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
            viewer.clock.multiplier = 1;

            // SampledPositionProperty에 시간별 위치 샘플 추가
            const position = new Cesium.SampledPositionProperty();
            const interval = 60 / (positions.length - 1); // 각 구간당 시간 간격

            for (let i = 0; i < positions.length; i++) {
                const time = Cesium.JulianDate.addSeconds(start, i * interval, new Cesium.JulianDate());
                position.addSample(time, positions[i]);
            }

            // 움직이는 객체(모델) 생성
            const entity = viewer.entities.add({
                availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
                    start: start,
                    stop: stop,
                })]),
                position: position,
                orientation: new Cesium.VelocityOrientationProperty(position),
                model: {
                    uri: "/object/Cesium_Air.glb",
                    minimumPixelSize: 64,
                    scale: 300.0,
                },
                path: {
                    resolution: 1,
                    material: new Cesium.PolylineGlowMaterialProperty({
                        glowPower: 0.2,
                        color: Cesium.Color.BLUE,
                    }),
                    width: 10,
                }
            });

            // 웨이포인트(경로) 폴리라인 추가
            viewer.entities.add({
                name: `${waypointSetName} Path`,
                polyline: {
                    positions: positions,
                    width: 0.2,
                    material: Cesium.Color.BLUE
                }
            });
        });

        // 초기 화면 줌 설정
        viewer.zoomTo(viewer.entities);
    }

    // JSON 데이터 로드 및 경로 설정
    loadWaypoints('/jsonData/airwaypoint.json') // 실제 JSON 파일 경로로 교체하세요.
        .then(data => {
            setupModelPath(Object.entries(data));
        })
        .catch(error => {
            console.error("Error loading waypoints:", error);
        });
})();

/*
(function() {
    // Cesium Viewer 설정
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain()
        });
    }

    const viewer = window.CesiumViewer;

    // JSON 데이터 로드 함수
    function loadWaypoints(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            });
    }

    // 웨이포인트 기반 경로 및 모델 설정
    function setupModelPath(waypoints) {
        waypoints.forEach(([waypointSetName, waypointSet]) => {
            // 웨이포인트에서 위치 및 방향 정보를 추출
            const positions = waypointSet.map(w => 
                Cesium.Cartesian3.fromDegrees(parseFloat(w.longitude), parseFloat(w.latitude), parseFloat(w.altitude))
            );
            const times = waypointSet.map(w => Cesium.JulianDate.fromIso8601(w.time));
            const orientations = waypointSet.map(w =>
                Cesium.Transforms.headingPitchRollQuaternion(
                    Cesium.Cartesian3.fromDegrees(parseFloat(w.longitude), parseFloat(w.latitude), parseFloat(w.altitude)),
                    new Cesium.HeadingPitchRoll(
                        Cesium.Math.toRadians(parseFloat(w.heading)),
                        Cesium.Math.toRadians(parseFloat(w.pitch)),
                        Cesium.Math.toRadians(parseFloat(w.roll))
                    )
                )
            );

            // 위치 스플라인 및 방향 스플라인 설정
            const positionSpline = new Cesium.CatmullRomSpline({
                times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
                points: positions
            });

            const orientationSpline = new Cesium.QuaternionSpline({
                times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
                points: orientations
            });

            // 모델 엔티티 생성
            const modelEntity = viewer.entities.add({
                name: waypointSetName,
                position: positions[0],
                orientation: orientations[0],
                model: {
                    uri: '/object/Cesium_Air.glb',
                    scale: 100.0,
                    minimumPixelSize: 64
                }
            });

            // 경로 폴리라인 추가
            viewer.entities.add({
                name: `${waypointSetName} Path`,
                polyline: {
                    positions: positions,
                    width: 0.2,
                    material: Cesium.Color.BLUE
                }
            });

            // 시계 및 애니메이션 설정
            const startTime = times[0].clone();
            const stopTime = times[times.length - 1].clone();
            viewer.clock.startTime = startTime.clone();
            viewer.clock.stopTime = stopTime.clone();
            viewer.clock.currentTime = startTime.clone();
            viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
            viewer.clock.multiplier = 1;

            viewer.clock.onTick.addEventListener(function(clock) {
                const elapsedTime = Cesium.JulianDate.secondsDifference(clock.currentTime, startTime);
                const totalDuration = Cesium.JulianDate.secondsDifference(stopTime, startTime);
                if (elapsedTime <= totalDuration) {
                    const normalizedTime = elapsedTime / totalDuration;
                    const newPosition = positionSpline.evaluate(normalizedTime);
                    const newOrientation = orientationSpline.evaluate(normalizedTime);
                    modelEntity.position.setValue(newPosition);
                    modelEntity.orientation.setValue(newOrientation);
                }
            });
        });
        // 초기 화면 줌 설정
        viewer.zoomTo(viewer.entities);
    }

    // JSON 데이터 로드 및 경로 설정
    loadWaypoints('/jsonData/airwaypoint.json')
        .then(data => {
            setupModelPath(Object.entries(data));
        })
        .catch(error => {
            console.error("Error loading waypoints:", error);
        });
})();
*/

/*
(function() {
    // Cesium Viewer 설정
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain()
        });
    }

    const viewer = window.CesiumViewer;

    // JSON 데이터 로드 함수
    function loadWaypoints(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            });
    }

    // 웨이포인트 기반 경로 및 모델 설정
    function setupModelPath(waypoints) {
        // 웨이포인트에서 위치 및 방향 정보를 추출
        const positions = waypoints.map(w => 
            Cesium.Cartesian3.fromDegrees(parseFloat(w.longitude), parseFloat(w.latitude), parseFloat(w.altitude))
        );
        const times = waypoints.map(w => Cesium.JulianDate.fromIso8601(w.time));
        const orientations = waypoints.map(w =>
            Cesium.Transforms.headingPitchRollQuaternion(
                Cesium.Cartesian3.fromDegrees(parseFloat(w.longitude), parseFloat(w.latitude), parseFloat(w.altitude)),
                new Cesium.HeadingPitchRoll(
                    Cesium.Math.toRadians(parseFloat(w.heading)),
                    Cesium.Math.toRadians(parseFloat(w.pitch)),
                    Cesium.Math.toRadians(parseFloat(w.roll))
                )
            )
        );

        // 위치 스플라인 및 방향 스플라인 설정
        const positionSpline = new Cesium.CatmullRomSpline({
            times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
            points: positions
        });

        const orientationSpline = new Cesium.QuaternionSpline({
            times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
            points: orientations
        });

        // 모델 엔티티 생성
        const modelEntity = viewer.entities.add({
            position: positions[0],
            orientation: orientations[0],
            model: {
                uri: '/object/Cesium_Air.glb',
                scale: 100.0,
                minimumPixelSize: 64
            }
        });

        // 경로 폴리라인 추가
        viewer.entities.add({
            polyline: {
                positions: positions,
                width: 0.2,
                material: Cesium.Color.BLUE
            }
        });

        // 시계 및 애니메이션 설정
        const startTime = times[0].clone();
        const stopTime = times[times.length - 1].clone();
        viewer.clock.startTime = startTime.clone();
        viewer.clock.stopTime = stopTime.clone();
        viewer.clock.currentTime = startTime.clone();
        viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
        viewer.clock.multiplier = 1;

        viewer.clock.onTick.addEventListener(function(clock) {
            const elapsedTime = Cesium.JulianDate.secondsDifference(clock.currentTime, startTime);
            const totalDuration = Cesium.JulianDate.secondsDifference(stopTime, startTime);
            if (elapsedTime <= totalDuration) {
                const normalizedTime = elapsedTime / totalDuration;
                const newPosition = positionSpline.evaluate(normalizedTime);
                const newOrientation = orientationSpline.evaluate(normalizedTime);
                modelEntity.position.setValue(newPosition);
                modelEntity.orientation.setValue(newOrientation);
            }
        });

        // 초기 화면 줌 설정
        viewer.zoomTo(viewer.entities);
    }

    // JSON 데이터 로드 및 경로 설정
    loadWaypoints('/jsonData/airwaypoint.json')
        .then(data => {
            setupModelPath(data.waypoints);
        })
        .catch(error => {
            console.error("Error loading waypoints:", error);
        });
})();
*/
/*
(function() {
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain()
        });
    }

    const viewer = window.CesiumViewer;

    // Load JSON file
    function loadWaypoints(url) {
        return fetch(url)
            .then(response => response.json());
    }

    // Setup path based on waypoints
    function setupModelPath(waypoints) {
        const positions = waypoints.map(w => 
            Cesium.Cartesian3.fromDegrees(parseFloat(w.longitude), parseFloat(w.latitude), parseFloat(w.altitude))
        );
        const times = waypoints.map(w => Cesium.JulianDate.fromIso8601(w.time));
        const orientations = waypoints.map(w =>
            Cesium.Transforms.headingPitchRollQuaternion(
                Cesium.Cartesian3.fromDegrees(parseFloat(w.longitude), parseFloat(w.latitude), parseFloat(w.altitude)),
                new Cesium.HeadingPitchRoll(
                    Cesium.Math.toRadians(parseFloat(w.heading)),
                    Cesium.Math.toRadians(parseFloat(w.pitch)),
                    Cesium.Math.toRadians(parseFloat(w.roll))
                )
            )
        );

        // Position and orientation splines
        const positionSpline = new Cesium.CatmullRomSpline({
            times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
            points: positions
        });

        const orientationSpline = new Cesium.LinearSpline({
            times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
            points: orientations
        });

        // Create model entity
        const modelEntity = viewer.entities.add({
            position: positions[0],
            orientation: orientations[0],
            model: {
                uri: '/object/Cesium_Air.glb',
                scale: 100.0,
                minimumPixelSize: 64
            }
        });

        // Add path line
        viewer.entities.add({
            polyline: {
                positions: positions,
                width: 0.2,
                material: Cesium.Color.BLUE
            }
        });

        // Clock and animation setup
        const startTime = times[0].clone();
        const stopTime = times[times.length - 1].clone();
        viewer.clock.startTime = startTime.clone();
        viewer.clock.stopTime = stopTime.clone();
        viewer.clock.currentTime = startTime.clone();
        viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
        viewer.clock.multiplier = 1;

        viewer.clock.onTick.addEventListener(function(clock) {
            const elapsedTime = Cesium.JulianDate.secondsDifference(clock.currentTime, startTime);
            const totalDuration = Cesium.JulianDate.secondsDifference(stopTime, startTime);
            if (elapsedTime <= totalDuration) {
                const normalizedTime = elapsedTime / totalDuration;
                const newPosition = positionSpline.evaluate(normalizedTime);
                const newOrientation = orientationSpline.evaluate(normalizedTime);
                modelEntity.position.setValue(newPosition);
                modelEntity.orientation.setValue(newOrientation);
            }
        });

        // Zoom to the path
        viewer.zoomTo(viewer.entities);
    }

    // JSON 데이터 로드 및 경로 설정
    loadWaypoints('/jsonData/airwaypoint.json')
        .then(data => {
            setupModelPath(data.waypoints);
        })
        .catch(error => {
            console.error("Error loading waypoints:", error);
        });
})();
*/
/*
(function() {
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain()
        });
    }

    const viewer = window.CesiumViewer;

    // 모델 URL
    const modelUrl = '../object/Cesium_Air.glb'; // GLB 파일 경로

    // 경로 설정
    const waypoints = [
        { longitude: 127.1, latitude: 37.5, altitude: 100000 },
        { longitude: 127.15, latitude: 37.55, altitude: 100000 },
        { longitude: 127.2, latitude: 37.6, altitude: 100000 }
    ];

    const positions = waypoints.map(w => Cesium.Cartesian3.fromDegrees(w.longitude, w.latitude, w.altitude));

    // 스플라인 생성
    const spline = new Cesium.CatmullRomSpline({
        times: [0, 0.5, 1], // 각 점의 시간 (0 ~ 1)
        points: positions
    });

    // 모델 엔티티 생성
    const modelEntity = viewer.entities.add({
        position: positions[0],
        model: {
            uri: modelUrl,
            scale: 10.0,
            minimumPixelSize: 64
        }
    }); 

    // 모델을 따라 움직일 경로 추가
    viewer.entities.add({
        polyline: {
            positions: positions,
            width: 5,
            material: Cesium.Color.RED
        }
    });

    // 애니메이션 업데이트
    const start = Cesium.JulianDate.now();
    let stopTime = Cesium.JulianDate.addSeconds(start, 10, new Cesium.JulianDate()); // 총 이동 시간: 10초

    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stopTime.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;  // 애니메이션 반복
    viewer.clock.multiplier = 1;  // time scale

    viewer.clock.onTick.addEventListener(function(clock) {
        const elapsedTime = Cesium.JulianDate.secondsDifference(clock.currentTime, start);
        const t = elapsedTime / 10;  // normalizing time
        const position = spline.evaluate(t);
        modelEntity.position = position;
    });

    // 모델을 처음 뷰어로 설정
    viewer.zoomTo(viewer.entities);
})();   
*/
/*
(function() {
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain()
        });
    }

    const viewer = window.CesiumViewer;

    fetch('pathWithModels.json')
    .then(response => response.json())
    .then(pathData => {
        const times = pathData.map(point => point.timestamp);
        const positions = pathData.map(point =>
            Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitude)
        );

        const splines = [];
        const models = [];
        pathData.forEach((point, index) => {
            if (index < pathData.length - 1) {
                splines.push({
                    spline: new Cesium.CatmullRomSpline({
                        times: [times[index], times[index + 1]],
                        points: [positions[index], positions[index + 1]],
                    }),
                    modelUrl: point.modelUrl
                });

                // 초기에 각 모델을 미리 로드
                models.push(viewer.entities.add({
                    model: {
                        uri: point.modelUrl,
                        minimumPixelSize: 64,
                        scale: 1.0
                    },
                    show: index === 0 // 처음에는 첫 모델만 보여줍니다.
                }));
            }
        });

        const start = Cesium.JulianDate.now();
        const duration = times[times.length - 1]; // 마지막 타임스탬프 기준 총 지속 시간
        const stopTime = Cesium.JulianDate.addSeconds(start, duration, new Cesium.JulianDate());

        viewer.clock.startTime = start.clone();
        viewer.clock.stopTime = stopTime.clone();
        viewer.clock.currentTime = start.clone();
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.multiplier = 1;

        viewer.clock.onTick.addEventListener(function(clock) {
            const elapsedTime = Cesium.JulianDate.secondsDifference(clock.currentTime, start);

            for (let i = 0; i < splines.length; i++) {
                const { spline, modelUrl } = splines[i];
                const segmentStart = times[i];
                const segmentEnd = times[i + 1];
                if (elapsedTime >= segmentStart && elapsedTime <= segmentEnd) {
                    const t = (elapsedTime - segmentStart) / (segmentEnd - segmentStart);
                    const position = spline.evaluate(t);
                    
                    models.forEach((modelEntity, modelIndex) => {
                        modelEntity.position = position;
                        modelEntity.show = (i === modelIndex);
                    });
                }
            }
        });

        viewer.zoomTo(viewer.entities);
    })
    .catch(error => {
        console.error('Error loading path data with models:', error);
    });
})();   
*/
