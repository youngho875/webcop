(function() {
    if (!window.CesiumViewer) {
        window.CesiumViewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: Cesium.createWorldTerrain(),
            baseLayerPicker: false
        });
    }

    const viewer = window.CesiumViewer;

    // JSON 데이터를 불러오기 위한 함수
    function loadMDLData(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("JSON 파일을 로드하는 데 실패했습니다.");
                }
                return response.json();
            })
            .catch(error => {
                console.error("MDL 데이터를 불러오는 중 오류:", error);
            });
    }

    // 군사분계선을 그리는 함수
    function drawMDL(mdlData) {
        // JSON 데이터 좌표를 Cartesian3로 변환
        const mdlPositions = mdlData.map(coord =>
            Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude)
        );

        // 폴리라인 엔티티 추가
        viewer.entities.add({
            name: "군사분계선",
            polyline: {
                positions: mdlPositions,
                width: 4,
                material: Cesium.Color.YELLOW, // 선 색상 설정
                clampToGround: true // Ensure line follows terrain
            }
            
        });

        // 군사분계선에 화면 줌
        viewer.zoomTo(viewer.entities);
    }

    // JSON 파일에서 데이터 불러와서 그리기
    loadMDLData('/jsonData/mdlLine.json') // JSON 파일 경로
        .then(data => {
            if (data) {
                drawMDL(data);
            }
        });
})();