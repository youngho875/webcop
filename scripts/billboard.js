// 빌보드를 표시할 위치 지정
window.billboard = (function() {
    const viewer = window.CesiumViewer;
    let billboardEntity = null;
    
 
    function craeteBillboard() {
        if (!billboardEntity) {
            // If the billboard doesn't exist, create it
            billboardEntity = viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(126.2412, 43.000, 0.0), // Set appropriate latitude, longitude, altitude
                billboard: {
                    image: '/img/tempsnip.png',
                    width: 300,       // 이미지 너비
                    height: 40,      // 이미지 높이
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM
                },
                // 지형에 클램프
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            });
        } else {
            // If the billboard exists, toggle its visibility
            billboardEntity.show = !billboardEntity.show;
        }
    }

    return { craeteBillboard };

})();