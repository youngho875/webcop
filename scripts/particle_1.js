/*
(function() {
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain()
        });
    }

    const viewer = window.CesiumViewer;

 
    // 파티클 시스템 생성
    const particleSystem = new Cesium.ParticleSystem({
        image: '/object/fire.png', // 불 이미지 경로
        startColor: Cesium.Color.RED.withAlpha(0.7),
        endColor: Cesium.Color.YELLOW.withAlpha(0.3),
        startScale: 1.0,
        endScale: 4.0,
        minimumParticleLife: 1.0,
        maximumParticleLife: 2.0,
        minimumSpeed: 5.0,
        maximumSpeed: 10.0,
        imageSize: new Cesium.Cartesian2(1000, 1000),
        emissionRate: 20.0,
        lifetime: Number.MAX_VALUE, // 장면을 계속 유지하도록 매우 큰 값 사용
        emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(45.0)),
        modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
            Cesium.Cartesian3.fromDegrees(126.2787, 38.3920, 70000.0)
        ),
        sizeInMeters: true
    });

    // 파티클 시스템을 장면에 추가
    viewer.scene.primitives.add(particleSystem);

    // 특정 위치로 카메라 줌
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(126.2787, 38.3920, 100000.0),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-30.0),
            roll: 0.0
        }
    });

    // 클럭을 무제한으로 진행되도록 설정
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
})();
*/

(function() {
  
    const viewer = window.CesiumViewer;

    // JSON 데이터를 로드하는 함수
    function loadFireData(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load JSON file.");
                }
                return response.json();
            });
    }

    // 데이터를 기반으로 라인 및 파티클을 생성하는 함수
    function createLineAndParticles(data) {
        Object.values(data).forEach(fireSet => {
            const positions = fireSet.map(coord => 
                Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt)
            );

            // 라인을 추가
            viewer.entities.add({
                polyline: {
                    positions: positions,
                    width: 2,
                    material: Cesium.Color.BLUE
                }
            });

            // 파티클 효과 추가
            fireSet.forEach(coord => {
                if (coord.triggerFire) {
                    const particleSystem = new Cesium.ParticleSystem({
                        image: '/object/fire.png', // 불 이미지 경로
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
                        lifetime: Number.MAX_VALUE,
                        emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(45.0)),
                        modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
                            Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, coord.alt)
                        ),
                        sizeInMeters: true
                    });

                    viewer.scene.primitives.add(particleSystem);
                }
            });
        });
    }

    // JSON 데이터 로드 및 처리
    loadFireData('/jsonData/sample.json') // 실제 JSON 파일의 경로로 변경
        .then(data => {
            createLineAndParticles(data);
        })
        .catch(error => {
            console.error("Error loading fire data:", error);
        });

    // 카메라 초기 설정
    // viewer.camera.flyTo({
    //     destination: Cesium.Cartesian3.fromDegrees(127.5, 37.5, 100000.0),
    //     orientation: {
    //         heading: Cesium.Math.toRadians(0.0),
    //         pitch: Cesium.Math.toRadians(-30.0),
    //         roll: 0.0
    //     }
    // });

    // 클락을 무제한으로 설정하여 장면을 유지
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
})();