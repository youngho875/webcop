// scalebar.js

(function() {
    const viewer = window.CesiumViewer;

    // 스타일 동적 정의 (CSS 생성)
    function injectScaleBarStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            #cesium-scale-bar {
                position: absolute;
                bottom: 30px;
                left: 20px;
                background: rgba(40, 40, 40, 0.7);
                color: white;
                padding: 8px 15px;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 999;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
        `;
        document.head.appendChild(style);
    } 

    // 스케일바 초기화 함수  
    window.createScaleBar = function() {
        // 스타일 적용
        injectScaleBarStyles();

        // 스케일바 요소 생성
        const scaleBar = document.createElement('div');
        scaleBar.id = 'cesium-scale-bar';
        scaleBar.textContent = 'Scale: 1 : 0';
        document.body.appendChild(scaleBar);

        // 카메라 변경 시 축척 업데이트
        viewer.scene.postRender.addEventListener(() => {
            const camera = viewer.camera;
            const canvas = viewer.scene.canvas;
            const cartographic = Cesium.Cartographic.fromCartesian(camera.position);
            const height = cartographic.height;
            const fovy = Cesium.Math.toRadians(camera.frustum.fovy);
            const groundResolution = (2 * height * Math.tan(fovy / 2)) / canvas.clientHeight;

            const dpi = 96;
            const inchesPerMeter = 39.37;
            const scaleDenominator = Math.round(groundResolution * dpi * inchesPerMeter);
            
            scaleBar.textContent = `Scale: 1 : ${scaleDenominator.toLocaleString()}`;
        });
    };
})();