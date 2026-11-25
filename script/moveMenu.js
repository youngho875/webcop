(function() {
    const viewer = window.CesiumViewer;
    
    // 스타일을 동적으로 추가
    const style = document.createElement('style');
    style.innerHTML = `
        .menu {
            position: fixed;
            top: 10px;
            left: -200px; /* 화면 바깥쪽에서 시작 */
            width: 200px;
            background-color: rgba(255, 255, 255, 0.8);
            padding: 10px;
            transition: left 0.5s; /* 부드럽게 이동 */
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }
        .menu.open {
            left: 10px; /* 열릴 때 위치 */
        }
        .menu button {
            display: block;
            width: 100%;
            margin: 5px 0;
            padding: 10px;
            border: none;
            background-color: #0078D7;
            color: white;
            cursor: pointer;
        }
        .menu button:hover {
            background-color: #0056A1;
        }
    `;
    document.head.appendChild(style);

     // 메뉴 생성
     const menu = document.createElement('div');
     menu.className = 'menu';
     menu.id = 'menu';
     document.body.appendChild(menu);
 
     // 메뉴 항목 생성
     const menuItems = ['Menu Item 1', 'Menu Item 2', 'Menu Item 3'];
     menuItems.forEach(item => {
         const button = document.createElement('button');
         button.innerText = item;
         button.addEventListener('click', function() {
             alert(`\${item} Clicked`);
         });
         menu.appendChild(button);
     });
 
     // 메뉴를 열고 닫는 함수
     function toggleMenu() {
         menu.classList.toggle('open');
     }
 
     // 지도를 클릭하면 메뉴가 열리도록 설정
     viewer.screenSpaceEventHandler.setInputAction(function(movement) {
         const pickedObject = viewer.scene.pick(movement.endPosition);
         if (Cesium.defined(pickedObject)) {
             toggleMenu();
         }
     }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

})();