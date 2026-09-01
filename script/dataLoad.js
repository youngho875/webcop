(function(){
    const viewer = window.CesiumViewer;

    fetch("/jsonData/data.json")
        .then(response => response.json())
        .then(data => {
            const positions = data.positions;
            const cartesianPositions = positions.map(p => 
                Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
            );

            // 스플라인을 사용하여 부드러운 곡선 생성
            const spline = new Cesium.CatmullRomSpline({
                times : positions.map((_, index) => index), // 각 점의 시퀀스를 시간으로 설정
                points : cartesianPositions
            });

            const interpolatedPoints = [];
            const numSegments = 100;
            for (let i = 0; i <= numSegments; i++) {
                interpolatedPoints.push(spline.evaluate(i / numSegments * (positions.length - 1)));
            }

            // 부드러운 곡선(Polyline) 추가
            viewer.entities.add({
                name: data.name,
                polyline: {
                    positions: interpolatedPoints,
                    width: 3,
                    material: Cesium.Color.RED,
                    clampToGround: false
                }
            });

            // 각 지점에 상태 아이콘 또는 텍스트 추가
            positions.forEach((p, i) => {
                viewer.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt),
                    label: {
                        text: `Status: ${p.status}\nPitch: ${p.pitch}°\n경도: ${p.lon}\n위도: ${p.lat}\n높이: ${p.alt}\n스피드: ${p.speed}\n시간: ${p.timestamps}`,
                        font: "12px sans-serif",
                        fillColor: Cesium.Color.YELLOW,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -15)
                    },
                    point: {
                        pixelSize: 6,
                        color: Cesium.Color.CYAN
                    }
                });
            });

            viewer.zoomTo(viewer.entities);
        });
})();