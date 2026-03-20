(function () {
    const viewer = window.CesiumViewer;
    

    function curvDraw(startLon, startLat, endLon, endLat, minAltitude, maxAltitude, durationSeconds) {
        const ellipsePoints = [];
        const sampledPosition = new Cesium.SampledPositionProperty(Cesium.ReferenceFrame.FIXED);
        const numPoints = 100; // 경로의 포인트 수 증가

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const interpolatedLon = Cesium.Math.lerp(startLon, endLon, t);
            const interpolatedLat = Cesium.Math.lerp(startLat, endLat, t);
            const altitude = Cesium.Math.lerp(minAltitude, maxAltitude, Math.sin(Math.PI * t));
            const position = Cesium.Cartesian3.fromDegrees(interpolatedLon, interpolatedLat, altitude);
            ellipsePoints.push(position);

            const time = Cesium.JulianDate.addSeconds(Cesium.JulianDate.now(), t * durationSeconds, new Cesium.JulianDate());
            sampledPosition.addSample(time, position);
        }

        viewer.entities.add({
            polyline: {
                positions: ellipsePoints,
                width: 0.5,
                material: Cesium.Color.RED
            }
        });

        const start = Cesium.JulianDate.now();
        const end = Cesium.JulianDate.addSeconds(start, durationSeconds, new Cesium.JulianDate());

        viewer.entities.add({
            availability: new Cesium.TimeIntervalCollection([
                new Cesium.TimeInterval({
                    start: start,
                    stop: end
                })
            ]),
            position: sampledPosition,
            model: {
                uri: '/object/CesiumDrone.glb',  // .glb 파일의 실제 경로
                minimumPixelSize: 64,
                maximumScale: 200
            },
            orientation: new Cesium.VelocityOrientationProperty(sampledPosition)
        });

        viewer.clock.startTime = start.clone();
        viewer.clock.stopTime = end.clone();
        viewer.clock.currentTime = start.clone();
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.multiplier = 100; // 애니메이션 속도
    }

    function loadJsonAndDraw(url) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("JSON 파일을 로드하는 데 실패했습니다.");
                }
                return response.json();
            })
            .then(data => {
                const durationSeconds = 30; // 애니메이션 지속 시간
                data.paths.forEach(path => {
                    const { startLongitude, startLatitude, endLongitude, endLatitude } = path.coordinates;
                    const { lowAltitude, highAltitude } = path.altitudes;
                    curvDraw(startLongitude, startLatitude, endLongitude, endLatitude, lowAltitude, highAltitude, durationSeconds);
                });
                viewer.zoomTo(viewer.entities);
            })
            .catch(error => console.error('JSON 로드 중 오류:', error));
    }

    loadJsonAndDraw('/jsonData/datajson.json');
})();