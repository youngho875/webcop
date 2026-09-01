window.moveLocation = (function() {
    const viewer = window.CesiumViewer;
    let uiPanel = null;

    // 1. [스타일, 드래그, 닫기버튼 포함] 좌표 입력창 UI 생성 함수
    function createUiPanel() {
        if (document.getElementById('uiPanel')) return;

        uiPanel = document.createElement('div');
        uiPanel.id = 'uiPanel';
        uiPanel.style.position = 'absolute';
        uiPanel.style.top = '60px'; 
        uiPanel.style.left = '20px';
        uiPanel.style.background = 'rgba(42, 42, 42, 0.95)';
        uiPanel.style.padding = '15px';
        uiPanel.style.borderRadius = '8px';
        uiPanel.style.color = 'white';
        uiPanel.style.fontFamily = 'sans-serif';
        uiPanel.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        uiPanel.style.zIndex = '1001';
        uiPanel.style.display = 'none'; 

        // 내부 HTML (우측 상단 닫기 버튼 포함)
        uiPanel.innerHTML = `
            <div id="uiPanelHeader" style="margin: 0 0 12px 0; border-bottom: 1px solid #555; padding-bottom: 5px; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: bold;">📍 이동 좌표 입력</span>
                <span id="uiPanelCloseBtn" style="cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; line-height: 1; padding: 0 2px;">&times;</span>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 60px; font-size: 13px;">경도:</label>
                <input type="number" id="lng" value="126.9780" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: inline-block; width: 60px; font-size: 13px;">위도:</label>
                <input type="number" id="lat" value="37.5665" step="0.0001" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: inline-block; width: 60px; font-size: 13px;">고도(m):</label>
                <input type="number" id="alt" value="2000" step="100" style="width: 110px; padding: 4px; background: #222; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <div style="display:flex;gap:6px;"><button id="executeMoveBtn" style="flex:1;padding:6px;background-color:#007acc;border:none;color:white;font-weight:bold;border-radius:4px;cursor:pointer;">날아가기</button><button id="showFavoriteNameBtn" style="flex:1;padding:6px;background-color:#0f766e;border:none;color:white;font-weight:bold;border-radius:4px;cursor:pointer;">즐겨찾기 등록</button></div>
            <div id="favoriteNameArea" style="display:none;margin-top:9px;padding-top:9px;border-top:1px solid #555;">
                <input id="moveFavoriteName" placeholder="즐겨찾기 명칭" style="width:100%;box-sizing:border-box;padding:6px;background:#222;border:1px solid #555;color:#fff;border-radius:4px;">
                <div style="display:flex;gap:6px;margin-top:6px;"><button id="confirmFavoriteBtn" style="flex:1;padding:6px;border:0;border-radius:4px;background:#0284c7;color:#fff;cursor:pointer;">등록</button><button id="cancelFavoriteBtn" style="flex:1;padding:6px;border:0;border-radius:4px;background:#6b7280;color:#fff;cursor:pointer;">취소</button></div>
                <div id="moveFavoriteStatus" style="margin-top:6px;color:#7dd3fc;font-size:12px;"></div>
            </div>
        `;
        document.body.appendChild(uiPanel);

        // 팝업창 X 버튼 클릭 시 닫기 이벤트
        document.getElementById('uiPanelCloseBtn').addEventListener('click', function() {
            uiPanel.style.display = 'none';
        });

        // ---- 마우스 드래그 기능 구현 ----
        const header = document.getElementById('uiPanelHeader');
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener('mousedown', function(e) {
            if (e.target.id === 'uiPanelCloseBtn') return; // X 버튼 클릭 시 드래그 방지

            isDragging = true;
            offsetX = e.clientX - uiPanel.offsetLeft;
            offsetY = e.clientY - uiPanel.offsetTop;
            e.preventDefault(); 
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            uiPanel.style.left = (e.clientX - offsetX) + 'px';
            uiPanel.style.top = (e.clientY - offsetY) + 'px';
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
        });

        // [날아가기] 버튼 클릭 이벤트
        document.getElementById('executeMoveBtn').addEventListener('click', function() {
            const longitude = parseFloat(document.getElementById('lng').value);
            const latitude = parseFloat(document.getElementById('lat').value);
            const altitude = parseFloat(document.getElementById('alt').value);

            if (isNaN(longitude) || isNaN(latitude) || isNaN(altitude)) {
                alert('유효한 좌표를 입력해 주세요.');
                return;
            }

            moveToLocation(longitude, latitude, altitude);
        });

        const favoriteNameArea = document.getElementById('favoriteNameArea');
        const favoriteNameInput = document.getElementById('moveFavoriteName');
        const favoriteStatus = document.getElementById('moveFavoriteStatus');
        document.getElementById('showFavoriteNameBtn').addEventListener('click', function() {
            favoriteNameArea.style.display = 'block';
            favoriteStatus.textContent = '';
            favoriteNameInput.focus();
        });
        document.getElementById('cancelFavoriteBtn').addEventListener('click', function() {
            favoriteNameInput.value = '';
            favoriteStatus.textContent = '';
            favoriteNameArea.style.display = 'none';
        });
        document.getElementById('confirmFavoriteBtn').addEventListener('click', async function() {
            const name = favoriteNameInput.value.trim();
            const longitude = Number(document.getElementById('lng').value);
            const latitude = Number(document.getElementById('lat').value);
            if (!name) return alert('즐겨찾기 명칭을 입력하세요.');
            if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return alert('경도와 위도를 올바르게 입력하세요.');
            try {
                const response = await fetch('/api/favorites/append', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: `favorite-${Date.now()}`, name, longitude, latitude })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
                favoriteStatus.textContent = '즐겨찾기 목록과 JSON 파일에 등록했습니다.';
                favoriteNameInput.value = '';
                document.dispatchEvent(new CustomEvent('favorite-data-changed'));
                window.setTimeout(() => { favoriteNameArea.style.display = 'none'; favoriteStatus.textContent = ''; }, 900);
            } catch (error) {
                console.error('즐겨찾기 등록 실패:', error);
                favoriteStatus.textContent = error.message || '즐겨찾기 등록에 실패했습니다.';
            }
        });
    }

    // 2. Cesium 카메라 이동 로직
    function moveToLocation(longitude, latitude, altitude) {
        if (!viewer) return console.error("Cesium Viewer를 찾을 수 없습니다.");

        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude),
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-45.0),
                roll: 0.0
            },
            duration: 2.5
            // complete 콜백(인포박스 표출) 제거됨
        });
    }

    // 초기화 및 입력창 엘리먼트 생성
    createUiPanel();

    // menu.js 인터페이스 매핑
    return {
        showMoveInfo: function() {
            if (!uiPanel) return;
            
            if (uiPanel.style.display === 'none') {
                uiPanel.style.display = 'block';
            } else {
                uiPanel.style.display = 'none';
            }
        }
    };
})();
