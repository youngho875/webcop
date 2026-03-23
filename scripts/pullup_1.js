(function() {
    const viewer = window.CesiumViewer;

    // JSON 데이터 로드 함수
    function loadMissilePath(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            });
    }

    // 미사일 경로 설정 함수
    function setupMissilePath(data) {
        const positions = data.positions.map(pos => 
            Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt)
        );
        
        const times = data.positions.map(pos => 
            Cesium.JulianDate.fromIso8601(pos.timestamp)
        );

        const orientations = data.positions.map(pos =>
            Cesium.Transforms.headingPitchRollQuaternion(
                Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt),
                new Cesium.HeadingPitchRoll(
                    0,  // Placeholder for heading
                    Cesium.Math.toRadians(pos.pitch),
                    0   // Placeholder for roll
                )
            )
        );

        // 스플라인 생성
        const positionSpline = new Cesium.CatmullRomSpline({
            times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
            points: positions
        });

        const orientationSpline = new Cesium.QuaternionSpline({
            times: times.map(t => Cesium.JulianDate.secondsDifference(t, times[0])),
            points: orientations
        });

        // 미사일 엔티티 생성
        const missileEntity = viewer.entities.add({
            position: positions[0],
            orientation: orientations[0],
            model: {
                uri: '/object/CesiumDrone.glb', // 미사일 모델 경로
                scale: 2000.0,
                minimumPixelSize: 64
            }
        });

        // 경로 폴리라인 추가
        viewer.entities.add({
            polyline: {
                positions: positions,
                width: 0.5,
                material: Cesium.Color.RED
            }
        });

        // 애니메이션 설정
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
                missileEntity.position.setValue(newPosition);
                missileEntity.orientation.setValue(newOrientation);
            }
        });

        // 초기 뷰어 위치 설정
        viewer.zoomTo(viewer.entities);
    }

    // JSON 경로 및 미사일 경로 설정 시작
    loadMissilePath('/jsonData/pullupData.json')
        .then(data => {
            setupMissilePath(data);
        })
        .catch(error => {
            console.error("Error loading missile path:", error);
        });
})();

/*
(function() {
    const viewer = window.CesiumViewer;

    // 4개의 점 (경도, 위도, 고도)
    const positions = [
        Cesium.Cartesian3.fromDegrees(125.7446, 39.5386, 0),
        Cesium.Cartesian3.fromDegrees(125.7446, 38.8353, 100000),
        Cesium.Cartesian3.fromDegrees(125.7446, 38.2238, 5000),
        Cesium.Cartesian3.fromDegrees(125.7446, 37.7978, 100000),
        Cesium.Cartesian3.fromDegrees(125.7446, 37.38091, 5000),
        Cesium.Cartesian3.fromDegrees(126.88676, 37.440, 0)
    ];

    // Hermite Spline 사용 (Catmull-Rom은 자동 설정)
    const spline = new Cesium.CatmullRomSpline({
        times: [0.0, 0.33, 0.5, 0.6, 0.8, 1.0],
        points: positions,
    });

    
    // 곡선을 따라 일정 간격으로 샘플링
    const sampledPoints = [];
    for (let t = 0; t <= 1; t += 0.1) {
        sampledPoints.push(spline.evaluate(t));
    }

    // 폴리라인으로 표시
    viewer.entities.add({
        polyline: {
            positions: sampledPoints,
            width: 0.5,
            material: Cesium.Color.RED,
        },
    });

    viewer.zoomTo(viewer.entities);
})();
*/