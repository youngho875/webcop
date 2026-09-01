// 빌보드를 표시할 위치 지정
window.billboard = (function () {
    // 1. CSS 스타일 동적 주입
    function injectStyles() {
        const styleId = 'cesium-billboard-ui-style';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Billboard Dialog UI Styling */
            .cesium-billboard-dialog {
                position: absolute;
                top: 20px;
                left: 20px;
                z-index: 9999;
                background: rgba(28, 33, 40, 0.95);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                color: #e6edf3;
                padding: 18px 20px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.12);
                width: 360px;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                user-select: none;
            }

            .cesium-billboard-dialog .dialog-header {
                margin: -18px -20px 14px -20px;
                padding: 14px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: move;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 12px 12px 0 0;
            }

            .cesium-billboard-dialog .dialog-title {
                font-size: 15px;
                font-weight: 600;
                color: #ffffff;
                display: flex;
                align-items: center;
                pointer-events: none;
            }

            .cesium-billboard-dialog .status-badge {
                display: inline-block;
                width: 9px;
                height: 9px;
                border-radius: 50%;
                background-color: #ef4444;
                margin-right: 8px;
                box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
                transition: background-color 0.3s, box-shadow 0.3s;
            }

            .cesium-billboard-dialog .status-badge.active {
                background-color: #10b981;
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
            }

            .cesium-billboard-dialog .close-btn {
                background: transparent;
                border: none;
                color: #9ca3af;
                font-size: 20px;
                line-height: 1;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 4px;
                transition: color 0.2s, background-color 0.2s;
            }

            .cesium-billboard-dialog .close-btn:hover {
                color: #ffffff;
                background-color: rgba(255, 255, 255, 0.2);
            }

            .cesium-billboard-dialog .form-group {
                margin-bottom: 10px;
            }

            .cesium-billboard-dialog .form-row {
                display: flex;
                gap: 10px;
            }

            .cesium-billboard-dialog .form-row .form-group {
                flex: 1;
            }

            .cesium-billboard-dialog label {
                display: block;
                font-size: 11px;
                margin-bottom: 4px;
                color: #9ca3af;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .cesium-billboard-dialog input[type="text"],
            .cesium-billboard-dialog input[type="number"] {
                width: 100%;
                padding: 7px 10px;
                background: rgba(15, 23, 42, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                border-radius: 6px;
                box-sizing: border-box;
                font-size: 12px;
                transition: border-color 0.2s, box-shadow 0.2s;
            }

            .cesium-billboard-dialog input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
            }

            /* 지도 선택 모드 버튼 스타일 */
            .cesium-billboard-dialog button.pick-btn {
                width: 100%;
                padding: 6px;
                margin-bottom: 10px;
                background: rgba(59, 130, 246, 0.15);
                border: 1px dashed #3b82f6;
                color: #60a5fa;
                font-size: 11px;
                font-weight: 500;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .cesium-billboard-dialog button.pick-btn:hover {
                background: rgba(59, 130, 246, 0.3);
            }

            .cesium-billboard-dialog button.pick-btn.active {
                background: #2563eb;
                color: #ffffff;
                border-style: solid;
            }

            .cesium-billboard-dialog .list-section {
                margin-top: 14px;
                border-top: 1px solid rgba(255, 255, 255, 0.12);
                padding-top: 12px;
            }

            .cesium-billboard-dialog .list-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
            }

            .cesium-billboard-dialog .list-header label {
                margin-bottom: 0;
                cursor: pointer;
            }

            .cesium-billboard-dialog .billboard-list {
                max-height: 140px;
                overflow-y: auto;
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                padding: 4px;
            }

            .cesium-billboard-dialog .list-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                font-size: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                cursor: pointer;
            }

            .cesium-billboard-dialog .list-item:last-child {
                border-bottom: none;
            }

            .cesium-billboard-dialog .list-item:hover {
                background: rgba(255, 255, 255, 0.08);
            }

            .cesium-billboard-dialog .item-info {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .cesium-billboard-dialog .item-name {
                font-weight: 600;
                color: #ffffff;
                display: block;
            }

            .cesium-billboard-dialog .item-coords {
                font-size: 10px;
                color: #9ca3af;
            }

            .cesium-billboard-dialog .btn-group {
                margin-top: 12px;
                display: flex;
                gap: 8px;
            }

            .cesium-billboard-dialog button.action-btn {
                flex: 1;
                padding: 8px 10px;
                background: #2563eb;
                border: none;
                color: white;
                font-weight: 600;
                font-size: 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s, transform 0.1s;
            }

            .cesium-billboard-dialog button.action-btn:hover {
                background: #1d4ed8;
            }

            .cesium-billboard-dialog button.btn-danger {
                background: #dc2626;
            }

            .cesium-billboard-dialog button.btn-danger:hover {
                background: #b91c1c;
            }
        `;
        document.head.appendChild(style);
    }

    // 2. HTML UI 엘리먼트 주입 및 이벤트 바인딩
    function injectUI() {
        const dialogId = 'billboard-dialog';
        if (document.getElementById(dialogId)) return;

        const container = document.createElement('div');
        container.id = dialogId;
        container.className = 'cesium-billboard-dialog';
        container.style.display = 'none';

        container.innerHTML = `
            <div class="dialog-header" id="billboard-dialog-header">
                <div class="dialog-title">
                    <i class="status-badge" id="billboard-status-dot"></i>빌보드 관리
                </div>
                <button type="button" class="close-btn" id="btn-billboard-close" title="닫기">&times;</button>
            </div>
            
            <div class="form-group">
                <label for="billboard-name">빌보드 이름</label>
                <input type="text" id="billboard-name" value="빌보드 1" placeholder="이름을 입력하세요">
            </div>

            <div class="form-group">
                <label for="billboard-img-path">이미지 경로 / URL</label>
                <input type="text" id="billboard-img-path" value="/img/tempsnip.png" placeholder="/img/tempsnip.png">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="billboard-img-width">너비 (px)</label>
                    <input type="number" id="billboard-img-width" value="300" min="10">
                </div>
                <div class="form-group">
                    <label for="billboard-img-height">높이 (px)</label>
                    <input type="number" id="billboard-img-height" value="40" min="10">
                </div>
            </div>

            <!-- 지도 좌표 선택 버튼 -->
            <button type="button" class="pick-btn" id="btn-pick-location">📍 지도 클릭하여 좌표 가져오기 (OFF)</button>

            <div class="form-row">
                <div class="form-group">
                    <label for="billboard-geo-lon">경도 (Longitude)</label>
                    <input type="number" id="billboard-geo-lon" step="0.000001" value="126.2412">
                </div>
                <div class="form-group">
                    <label for="billboard-geo-lat">위도 (Latitude)</label>
                    <input type="number" id="billboard-geo-lat" step="0.000001" value="43.0000">
                </div>
            </div>

            <div class="form-group">
                <label for="billboard-geo-alt">고도 (Height)</label>
                <input type="number" id="billboard-geo-alt" step="0.1" value="0">
            </div>

            <div class="btn-group">
                <button type="button" class="action-btn" id="btn-billboard-add">빌보드 추가</button>
            </div>

            <!-- 빌보드 목록 관리 영역 -->
            <div class="list-section">
                <div class="list-header">
                    <label style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" id="chk-billboard-all" checked>
                        <span>전체 선택 / 해제</span>
                    </label>
                </div>

                <div class="billboard-list" id="billboard-list-container">
                    <!-- Dynamic List Items -->
                </div>

                <div class="btn-group">
                    <button type="button" class="action-btn btn-danger" id="btn-billboard-delete">선택 삭제</button>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // 이벤트 바인딩
        const closeBtn = document.getElementById('btn-billboard-close');
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            billboardController.hideUI();
        });

        document.getElementById('btn-billboard-add').addEventListener('click', () => {
            billboardController.addBillboardFromUI();
        });

        document.getElementById('btn-pick-location').addEventListener('click', () => {
            billboardController.togglePickerMode();
        });

        document.getElementById('chk-billboard-all').addEventListener('change', (e) => {
            billboardController.toggleAll(e.target.checked);
        });

        document.getElementById('btn-billboard-delete').addEventListener('click', () => {
            billboardController.deleteSelected();
        });

        makeDraggable(container, document.getElementById('billboard-dialog-header'));
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            if (e.target.id === 'btn-billboard-close' || e.target.classList.contains('close-btn')) return;

            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;

            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();

            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles();
            injectUI();
        });
    } else {
        injectStyles();
        injectUI();
    }

    // 3. 다중 빌보드 제어 및 클릭 좌표 피킹
    let billboardMap = new Map();
    let idCounter = 1;
    let clickHandler = null; // Cesium ScreenSpaceEventHandler
    let isPickerActive = false;

    const billboardController = {
        showUI: function() {
            const dialog = document.getElementById('billboard-dialog');
            if (dialog) dialog.style.display = 'block';
        },

        hideUI: function() {
            const dialog = document.getElementById('billboard-dialog');
            if (dialog) dialog.style.display = 'none';
            this.disablePickerMode(); // UI 닫히면 피커 모드 종료
        },

        toggleUI: function() {
            const dialog = document.getElementById('billboard-dialog');
            if (dialog) {
                const isHidden = getComputedStyle(dialog).display === 'none';
                if (isHidden) {
                    this.showUI();
                } else {
                    this.hideUI();
                }
            }
        },

        // ★ 지도 클릭을 통한 좌표 자동 입력 토글
        togglePickerMode: function() {
            if (isPickerActive) {
                this.disablePickerMode();
            } else {
                this.enablePickerMode();
            }
        },

        enablePickerMode: function() {
            const viewer = window.CesiumViewer;
            if (!viewer) {
                console.error("[Cesium Billboard] window.CesiumViewer가 존재하지 않습니다.");
                return;
            }

            const pickBtn = document.getElementById('btn-pick-location');
            isPickerActive = true;
            if (pickBtn) {
                pickBtn.classList.add('active');
                pickBtn.textContent = '🎯 지도를 클릭하세요 (ON)';
            }

            if (!clickHandler) {
                clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
            }

            // 마우스 좌클릭 이벤트 등록
            clickHandler.setInputAction((click) => {
                const ray = viewer.camera.getPickRay(click.position);
                const cartesian = viewer.scene.globe.pick(ray, viewer.scene);

                if (cartesian) {
                    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                    const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
                    const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
                    const alt = cartographic.height.toFixed(1);

                    // UI Input 요소에 자동 입력
                    document.getElementById('billboard-geo-lon').value = lon;
                    document.getElementById('billboard-geo-lat').value = lat;
                    document.getElementById('billboard-geo-alt').value = alt;

                    // 한번 클릭 후 피커 모드 자동 해제
                    this.disablePickerMode();
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        },

        disablePickerMode: function() {
            isPickerActive = false;
            const pickBtn = document.getElementById('btn-pick-location');
            if (pickBtn) {
                pickBtn.classList.remove('active');
                pickBtn.textContent = '📍 지도 클릭하여 좌표 가져오기 (OFF)';
            }

            if (clickHandler) {
                clickHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            }
        },

        // 빌보드 추가
        addBillboard: function (config) {
            const viewer = window.CesiumViewer;
            if (!viewer) {
                console.error("[Cesium Billboard] window.CesiumViewer가 필요합니다.");
                return;
            }

            const id = 'bb_' + idCounter++;
            const options = Object.assign({
                name: '빌보드 ' + idCounter,
                lon: 126.2412,
                lat: 43.000,
                alt: 0.0,
                image: '/img/tempsnip.png',
                width: 300,
                height: 40
            }, config);

            const entity = viewer.entities.add({
                id: id,
                name: options.name,
                position: Cesium.Cartesian3.fromDegrees(
                    parseFloat(options.lon),
                    parseFloat(options.lat),
                    parseFloat(options.alt)
                ),
                billboard: {
                    image: options.image,
                    width: parseFloat(options.width),
                    height: parseFloat(options.height),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });

            billboardMap.set(id, { entity, config: options });

            this.updateUIList();
            this.updateStatusDot();
        },

        addBillboardFromUI: function () {
            const nameInput = document.getElementById('billboard-name');
            const config = {
                name: nameInput.value.trim() || '무제 빌보드',
                image: document.getElementById('billboard-img-path').value,
                width: document.getElementById('billboard-img-width').value,
                height: document.getElementById('billboard-img-height').value,
                lon: document.getElementById('billboard-geo-lon').value,
                lat: document.getElementById('billboard-geo-lat').value,
                alt: document.getElementById('billboard-geo-alt').value
            };

            this.addBillboard(config);
            nameInput.value = `빌보드 ${idCounter}`;
        },

        toggleVisibility: function (id, visible) {
            const item = billboardMap.get(id);
            if (item) {
                item.entity.show = visible;
            }
            this.updateStatusDot();
        },

        toggleAll: function (visible) {
            const listContainer = document.getElementById('billboard-list-container');
            const checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');

            checkboxes.forEach(chk => {
                chk.checked = visible;
                const id = chk.dataset.id;
                this.toggleVisibility(id, visible);
            });
        },

        deleteSelected: function () {
            const viewer = window.CesiumViewer;
            if (!viewer) return;

            const listContainer = document.getElementById('billboard-list-container');
            const checkboxes = listContainer.querySelectorAll('input[type="checkbox"]:checked');

            if (checkboxes.length === 0) {
                alert('삭제할 빌보드를 선택해 주세요.');
                return;
            }

            checkboxes.forEach(chk => {
                const id = chk.dataset.id;
                const item = billboardMap.get(id);
                if (item) {
                    viewer.entities.remove(item.entity);
                    billboardMap.delete(id);
                }
            });

            this.updateUIList();
            this.updateStatusDot();
        },

        flyToById: function (id) {
            const viewer = window.CesiumViewer;
            const item = billboardMap.get(id);
            if (viewer && item) {
                item.entity.show = true;
                
                const chk = document.querySelector(`input[data-id="${id}"]`);
                if (chk) chk.checked = true;

                viewer.flyTo(item.entity, {
                    duration: 1.5,
                    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), 2000)
                });
            }
        },

        updateUIList: function () {
            const listContainer = document.getElementById('billboard-list-container');
            if (!listContainer) return;

            listContainer.innerHTML = '';

            if (billboardMap.size === 0) {
                listContainer.innerHTML = `<div style="text-align:center; color:#9ca3af; font-size:11px; padding:12px;">등록된 빌보드가 없습니다.</div>`;
                return;
            }

            billboardMap.forEach((val, id) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'list-item';

                const isShow = val.entity.show;

                itemDiv.innerHTML = `
                    <input type="checkbox" data-id="${id}" ${isShow ? 'checked' : ''}>
                    <div class="item-info">
                        <span class="item-name">${val.config.name}</span>
                        <span class="item-coords">경도: ${val.config.lon} | 위도: ${val.config.lat}</span>
                    </div>
                `;

                const chk = itemDiv.querySelector('input[type="checkbox"]');
                chk.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleVisibility(id, e.target.checked);
                });

                itemDiv.addEventListener('click', (e) => {
                    if (e.target !== chk) {
                        this.flyToById(id);
                    }
                });

                listContainer.appendChild(itemDiv);
            });
        },

        updateStatusDot: function() {
            const statusDot = document.getElementById('billboard-status-dot');
            if (!statusDot) return;

            let hasVisible = false;
            billboardMap.forEach(val => {
                if (val.entity.show) hasVisible = true;
            });

            if (hasVisible) {
                statusDot.classList.add('active');
            } else {
                statusDot.classList.remove('active');
            }
        }
    };

    window.billboard = billboardController;
    return billboardController;
})();