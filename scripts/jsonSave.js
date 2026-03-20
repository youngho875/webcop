window.savejson = (function() {    
    const viewer = window.CesiumViewer;

    // 전역 데이터 저장 배열
    window.jsonData = [];

    // 클릭 이벤트 리스너 추가
    viewer.screenSpaceEventHandler.setInputAction((movement) => {
        const pickedPosition = viewer.scene.pickPosition(movement.position);
        
        if (Cesium.defined(pickedPosition)) {
            const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

            // 현재 시간 기록
            const currentTime = new Date().toISOString();

            // JSON 구조로 좌표와 시간 저장
            const data = {
                latitude: latitude,
                longitude: longitude,
                time: currentTime
            };

            // 데이터 배열에 추가
            window.jsonData.push(data);

            viewer.entities.add({
                position: pickedPosition,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.BLUE
                }
            });
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // JSON 데이터를 파일로 저장하는 함수
    function saveJsonData() {
        if (window.jsonData.length === 0) {
            alert('No data to save!');
            return;
        }

        const fileName = prompt("Enter the file name:", "data.json");
        if (fileName) {
            const jsonBlob = new Blob([JSON.stringify(window.jsonData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(jsonBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
    return {saveJsonData};

})();