// compass.js

// 즉시 실행 함수로 스코프 격리
(function() {
    const viewer = window.CesiumViewer;

    // 1. 스타일 동적 생성
    function injectCompassStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            #compass {
                position: absolute;
                top: 50px;
                right: 20px;
                width: 100px;
                height: 100px;
                z-index: 999;
                border: 2px solid #333;
                border-radius: 50%;
                overflow: hidden;
                background: rgba(255, 255, 255, 0.9);
            }
            #compass-img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                transition: transform 0.1s linear;
            }

        `;
        document.head.appendChild(style);
    }

    let compassVisible = true;
    
    window.toggleCompass = function() {
        const compass = document.getElementById('compass');
        if (compass) {
            compass.style.display = compassVisible ? 'none' : 'block';
            compassVisible = !compassVisible;
        }
    }

    // 2. 전역 함수로 노출
    window.initCompass = function() {

        injectCompassStyles();

        // 컨테이너 생성
        const compassContainer = document.createElement('div');
        compassContainer.id = 'compass';
        
        // 이미지 생성
        const compassImg = document.createElement('img');
        compassImg.id = 'compass-img';
        compassImg.src = '../img/compass.jpg'; // 이미지 경로 변경 필요
        compassImg.alt = 'Compass';
        
        // DOM에 추가
        compassContainer.appendChild(compassImg);
        document.body.appendChild(compassContainer);

        // 3. 실시간 회전 업데이트
        viewer.scene.postRender.addEventListener(() => {
            const heading = Cesium.Math.toDegrees(viewer.camera.heading);
            compassImg.style.transform = `rotate(${-heading}deg)`;
        });
    };

    window.toggleCompass = toggleCompass;
/*

        const compassElement = document.getElementById('compass');
        const arrowElement = compassElement.querySelector('.arrow');

        function updateCompass() {
            const camera = viewer.camera;
            const heading = Cesium.Math.toDegrees(camera.heading);

            // Update the rotation of the compass arrow
            arrowElement.style.transform = `rotate(${heading}deg) translateY(-50%)`;
        }

        viewer.camera.changed.addEventListener(updateCompass);
        updateCompass();  // Initialize the compass direction    
*/        
})();