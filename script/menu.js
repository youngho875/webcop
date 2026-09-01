//////////////////////////////////////////////////////////////////////////
// CesiumJS Draggable Horizontal Icon Menu (Robust JS Hover Delay Fixed)
//////////////////////////////////////////////////////////////////////////

(function() {
    const viewer = window.CesiumViewer;
    
    // ✨ 불필요해진 CSS 브릿지를 제거하고 깔끔하게 정돈된 스타일 주입
    const style = document.createElement('style');
    style.innerHTML = `
        #menu {
            position: absolute;
            top: 15px; 
            left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 20, 20, 0.85); 
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            padding: 8px 12px;
            width: max-content;
            max-width: calc(100vw - 30px);
            display: flex;
            flex-direction: row;
            gap: 12px;        
            align-items: center;
            flex-wrap: nowrap;
            border-radius: 30px; 
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 1000;
            cursor: move; 
            user-select: none;
            box-sizing: border-box;
        }

        /* 🟢 이미지 형태의 아이콘 버튼 공통 스타일 */
        .icon-btn, .drop-trigger {
            position: relative;
            flex: 0 0 auto;
            width: 36px;
            height: 36px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-sizing: border-box;
            padding: 0;
        }

        .icon-btn:hover, .drop-trigger:hover {
            background: rgba(0, 122, 204, 0.5);
            border-color: #007acc;
            box-shadow: 0 0 12px rgba(0, 122, 204, 0.6);
            transform: scale(1.1);
        }

        .icon-btn.profile-active {
            background: rgba(0, 180, 216, 0.55);
            border-color: #22d3ee;
            box-shadow: 0 0 14px rgba(34, 211, 238, 0.75);
        }

        .icon-btn img, .drop-trigger img {
            width: 20px;
            height: 20px;
            pointer-events: none; 
            filter: invert(1);    
        }

        /* 🎈 풍선도움말(Tooltip) 기본 설정 (일반 단독 버튼용) */
        .icon-btn::after {
            content: attr(data-tooltip); 
            position: absolute;
            left: 50%;
            top: 48px;
            transform: translateX(-50%) scale(0.8);
            background: rgba(15, 15, 15, 0.95);
            color: #ffffff;
            font-size: 12px;
            font-family: 'Segoe UI', sans-serif;
            font-weight: 500;
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 1010;
            box-shadow: 4px 4px 15px rgba(0, 0, 0, 0.5);
        }
        .icon-btn::before {
            content: '';
            position: absolute;
            left: 50%;
            top: 42px;
            transform: translateX(-50%);
            border-width: 0 4px 6px 4px;
            border-style: solid;
            border-color: transparent transparent rgba(15, 15, 15, 0.95) transparent;
            pointer-events: none;
            opacity: 0;
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 1010;
        }
        .icon-btn:hover::after, .icon-btn:hover::before {
            opacity: 1;
            transform: translateX(-50%) scale(1);
        }

        /* 📦 드롭다운 감싸는 래퍼 */
        .dropdown-wrapper {
            position: relative;
            display: inline-block;
            flex: 0 0 auto;
            width: auto;
            display: flex;
            justify-content: center;
        }

        /* 📦 아래로 펼쳐지는 드롭다운 서브메뉴 리스트 */
        .dropdown-content {
            display: none; 
            position: absolute;
            left: 50%;
            top: 48px;
            transform: translateX(-50%);
            background-color: rgba(25, 25, 26, 0.98); 
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            min-width: 180px;
            border-radius: 6px;
            box-shadow: 5px 5px 25px rgba(0,0,0,0.5);
            border: 1px solid rgba(255, 255, 255, 0.12);
            z-index: 1005; 
            padding: 6px 0;
            overflow: hidden;
            cursor: default;
        }

        .dropdown-content a {
            color: #d4d4d8;
            padding: 10px 16px;
            text-decoration: none;
            display: block;
            font-size: 13px;
            transition: all 0.2s;
            text-align: left;
        }
        .dropdown-content a:hover {
            background-color: rgba(0, 122, 204, 0.25);
            color: #fff;
            padding-left: 20px;
        }

        /* 그리기 메뉴 분류 및 하위 메뉴 */
        .draw-menu-group {
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .draw-menu-group:last-child {
            border-bottom: 0;
        }
        .draw-menu-group summary {
            position: relative;
            padding: 10px 34px 10px 16px;
            color: #e2e8f0;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            list-style: none;
            transition: all 0.2s;
        }
        .draw-menu-group summary::-webkit-details-marker { display: none; }
        .draw-menu-group summary::after {
            content: '›';
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            font-size: 20px;
            transition: transform 0.2s;
        }
        .draw-menu-group[open] summary::after {
            transform: translateY(-50%) rotate(90deg);
        }
        .draw-menu-group summary:hover,
        .draw-menu-group[open] summary {
            color: #fff;
            background: rgba(0, 122, 204, 0.2);
        }
        .draw-submenu {
            padding: 3px 0 6px;
            background: rgba(0, 0, 0, 0.18);
        }
        .draw-submenu a {
            padding: 8px 16px 8px 32px;
            color: #b8c5d1;
        }
        .draw-submenu a:hover {
            padding-left: 37px;
        }
        .draw-direct-link {
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            font-weight: 600;
        }
        .draw-dropdown-content {
            max-height: min(620px, calc(100vh - 90px));
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #475569 transparent;
        }
        .dropdown-content label {
            color: #d4d4d8;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
            text-align: left;
        }
        .dropdown-content label:hover {
            background-color: rgba(255, 255, 255, 0.05);
            color: #fff;
        }

        input[type="radio"], input[type="checkbox"] {
            margin-right: 8px;
            accent-color: #007acc;
            cursor: pointer;
        }

        /* Reset 전용 버튼 경고 컬러 스타일링 */
        .btn-reset {
            background: rgba(239, 68, 68, 0.15) !important;
            border-color: rgba(239, 68, 68, 0.3) !important;
        }
        .btn-reset:hover {
            background: rgba(239, 68, 68, 0.7) !important;
            border-color: #ef4444 !important;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.6) !important;
        }
    `;
    document.head.appendChild(style);

    // 메뉴 UI 생성
    const menu = document.createElement('div');
    menu.id = 'menu';
    document.body.appendChild(menu);

    function installDialogBelowMainMenu() {
        const selector = [
            'dialog', '[role="dialog"]',
            '[id*="dialog" i]', '[id*="modal" i]', '[id*="popup" i]', '[id*="panel" i]',
            '[class*="dialog" i]', '[class*="modal" i]', '[class*="popup" i]', '[class*="panel" i]'
        ].join(',');
        const excluded = '#menu,.dropdown-content,.layer-context-menu,[class*="context-menu" i],.td-map-editor,.drawing-multi-selection-box';
        let scheduled = false;

        function isTopLevelDialog(element) {
            if (!(element instanceof HTMLElement) || !element.matches(selector) || element.matches(excluded) || element.dataset.allowMenuOverlap === 'true') return false;
            return element.parentElement === document.body || element.parentElement === viewer?.container;
        }

        function placeBelowMenu(element) {
            if (!isTopLevelDialog(element)) return;
            const computed = getComputedStyle(element);
            if (computed.display === 'none' || computed.visibility === 'hidden' || !['fixed', 'absolute'].includes(computed.position)) return;
            const menuBottom = menu.getBoundingClientRect().bottom + 8;
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.top >= menuBottom) return;
            const currentTop = Number.parseFloat(computed.top);
            const nextTop = (Number.isFinite(currentTop) ? currentTop : rect.top) + (menuBottom - rect.top);
            element.style.top = `${Math.max(menuBottom, nextTop)}px`;
            if (computed.bottom !== 'auto') element.style.bottom = 'auto';
        }

        function clampAllDialogs() {
            scheduled = false;
            document.querySelectorAll(selector).forEach(placeBelowMenu);
        }

        function scheduleClamp() {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(clampAllDialogs);
        }

        new MutationObserver(scheduleClamp).observe(document.body, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['style', 'class', 'hidden', 'open']
        });
        window.addEventListener('resize', scheduleClamp);
        document.addEventListener('dialog-opened', scheduleClamp);
        scheduleClamp();
        globalThis.DialogBelowMainMenu = { refresh: scheduleClamp };
    }

    installDialogBelowMainMenu();

    function installDrawingSelectionBox() {
        if (!document.getElementById('military-selection-indicator-style')) {
            const style = document.createElement('style');
            style.id = 'military-selection-indicator-style';
            style.textContent = `
                .drawing-bounds-selected .cesium-selection-wrapper,
                .drawing-bounds-selected .cesium-selection-wrapper-visible {
                    display: none !important;
                    visibility: hidden !important;
                }
            `;
            document.head.appendChild(style);
        }

        const box = document.createElement('div');
        box.id = 'drawing-selection-box';
        box.style.cssText = 'display:none;position:absolute;pointer-events:none;border:2px solid #22d3ee;background:transparent;box-shadow:0 0 0 1px rgba(0,0,0,.75),0 0 10px rgba(34,211,238,.8);z-index:900;box-sizing:border-box;';
        viewer.container.appendChild(box);

        const sphere = new Cesium.BoundingSphere();
        let selectedDrawing = null;

        function resolveDrawing(entity) {
            const candidate = entity?._lineOwner || entity?._drawingOwner || entity;
            const group = candidate?.customData?.groupEntity;
            if (group && viewer.entities.contains(group)) return group;
            return candidate?.customData?.drawingType || candidate?.customData?.militarySymbol || candidate?.customData?.source === 'unifiedControlPanel' ? candidate : null;
        }

        function hideBox() {
            box.style.display = 'none';
        }

        function geometryScreenBounds(entity, read) {
            let positions = [];
            const hierarchy = entity.polygon ? read(entity.polygon.hierarchy) : null;
            if (Array.isArray(hierarchy)) positions = hierarchy;
            else if (Array.isArray(hierarchy?.positions)) positions = hierarchy.positions;
            if (!positions.length && entity.polyline) positions = read(entity.polyline.positions) || [];
            if (!positions.length && entity.rectangle) {
                const rectangle = read(entity.rectangle.coordinates);
                if (rectangle) {
                    positions = [
                        Cesium.Rectangle.northwest(rectangle), Cesium.Rectangle.northeast(rectangle),
                        Cesium.Rectangle.southeast(rectangle), Cesium.Rectangle.southwest(rectangle)
                    ].map(point => Cesium.Cartesian3.fromRadians(point.longitude, point.latitude));
                }
            }
            if (!positions.length && entity.customData?.start && entity.customData?.end) {
                positions = [entity.customData.start, entity.customData.end];
            }
            const points = positions
                .map(position => Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position))
                .filter(Cesium.defined);
            if (points.length < 2) return null;
            return points.reduce((bounds, point) => ({
                left: Math.min(bounds.left, point.x), top: Math.min(bounds.top, point.y),
                right: Math.max(bounds.right, point.x), bottom: Math.max(bounds.bottom, point.y)
            }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
        }

        function showBox(bounds, padding = 2) {
            box.style.display = 'block';
            box.style.left = `${bounds.left - padding}px`;
            box.style.top = `${bounds.top - padding}px`;
            box.style.width = `${Math.max(1, bounds.right - bounds.left) + padding * 2}px`;
            box.style.height = `${Math.max(1, bounds.bottom - bounds.top) + padding * 2}px`;
        }

        function updateBox() {
            if (!selectedDrawing || !viewer.entities.contains(selectedDrawing) || selectedDrawing.show === false) return hideBox();
            const time = viewer.clock.currentTime;
            const read = property => property?.getValue ? property.getValue(time) : property;
            if ((selectedDrawing.customData?.militarySymbol || selectedDrawing.customData?.source === 'unifiedControlPanel') && selectedDrawing.billboard) {
                const position = read(selectedDrawing.position);
                const center = Cesium.defined(position) ? Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position) : null;
                if (!Cesium.defined(center)) return hideBox();
                const scale = Number(read(selectedDrawing.billboard.scale)) || 1;
                const savedSize = selectedDrawing.customData?.billboardScreenSize;
                const width = Math.max(36, Number(savedSize?.width) || (Number(read(selectedDrawing.billboard.width)) || 60) * scale);
                const height = Math.max(36, Number(savedSize?.height) || (Number(read(selectedDrawing.billboard.height)) || 60) * scale);
                const padding = 2;
                box.style.display = 'block';
                box.style.left = `${center.x - width / 2 - padding}px`;
                box.style.top = `${center.y - height / 2 - padding}px`;
                box.style.width = `${width + padding * 2}px`;
                box.style.height = `${height + padding * 2}px`;
                return;
            }
            const geometryBounds = geometryScreenBounds(selectedDrawing, read);
            if (geometryBounds) return showBox(geometryBounds);
            const state = viewer.dataSourceDisplay.getBoundingSphere(selectedDrawing, false, sphere);
            if (state !== Cesium.BoundingSphereState.DONE) return hideBox();
            const center = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, sphere.center);
            if (!Cesium.defined(center)) return hideBox();
            const metersPerPixel = viewer.camera.getPixelSize(sphere, viewer.scene.drawingBufferWidth, viewer.scene.drawingBufferHeight);
            if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return hideBox();
            const radius = Math.max(12, sphere.radius / metersPerPixel);
            const padding = 2;
            box.style.display = 'block';
            box.style.left = `${center.x - radius - padding}px`;
            box.style.top = `${center.y - radius - padding}px`;
            box.style.width = `${radius * 2 + padding * 2}px`;
            box.style.height = `${radius * 2 + padding * 2}px`;
        }

        viewer.selectedEntityChanged.addEventListener(entity => {
            selectedDrawing = resolveDrawing(entity);
            updateBox();
            const militarySelected = selectedDrawing && (selectedDrawing.customData?.militarySymbol || selectedDrawing.customData?.source === 'unifiedControlPanel');
            viewer.container.classList.toggle('drawing-bounds-selected', Boolean(selectedDrawing));
            if (militarySelected) {
                requestAnimationFrame(() => {
                    if (viewer.selectedEntity !== entity) return;
                    if (viewer.selectionIndicator?.viewModel) viewer.selectionIndicator.viewModel.showSelection = false;
                    if (viewer.infoBox?.viewModel) viewer.infoBox.viewModel.showInfo = false;
                });
            }
        });
        viewer.scene.preRender.addEventListener(updateBox);

        const selectionHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        selectionHandler.setInputAction(event => {
            if (performance.now() < (window.__suppressDrawingSelectionUntil || 0)) return;
            const picked = viewer.scene.pick(event.position);
            const drawing = resolveDrawing(picked?.id);
            if (drawing) {
                const wasAlreadySelected = viewer.selectedEntity === drawing;
                viewer.selectedEntity = drawing;
                if (drawing.customData?.drawingType === 'line') window.lineDrawing?.editEntity?.(drawing);
                if (wasAlreadySelected && drawing._areaStyleEditor && window.AreaStylePanel?.edit) {
                    const editor = drawing._areaStyleEditor;
                    window.AreaStylePanel.edit(editor.title, editor.style, () => {
                        const nextStyle = window.AreaStylePanel.getStyle();
                        editor.style = { ...nextStyle };
                        editor.applyCallback(nextStyle);
                        viewer.scene.requestRender();
                    });
                }
            }
            else if (!picked?.id) viewer.selectedEntity = undefined;
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    installDrawingSelectionBox();

    const HOME_VIEW_DESTINATION = Cesium.Cartesian3.fromDegrees(127.0, 37.5, 800000.0);

    // 홈 뷰 (단독 버튼)
    const homeButton = createIconButton('🏠 Home', 'home', () => {
        viewer.camera.flyTo({
            destination: HOME_VIEW_DESTINATION,
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-90.0),
                roll: 0.0
            }
        });
    });

    // 🗺️ 지도 레이어 관리
    createIconButton('🗺️ 레이어 관리', 'layers', () => {
        if (window.LayerManager && typeof window.LayerManager.open === 'function') {
            window.LayerManager.open();
        } else {
            console.warn("LayerManager 스크립트가 로드되지 않았습니다.");
        }
    });

    createIconButton('🎨 군대부호', 'military-tech', () => {
        if (window.militarySymbolDialog && typeof window.militarySymbolDialog.toggle === 'function') {
            window.militarySymbolDialog.toggle();
        } else if (window.unifiedControlPanel && typeof window.unifiedControlPanel.toggleMilitary === 'function') {
            window.unifiedControlPanel.toggleMilitary();
        } else if (typeof window.openSymbolPopup === 'function') {
            window.openSymbolPopup();
        } else {
            console.warn("군대부호 다이얼로그 스크립트가 로드되지 않았습니다.");
        }
    });
    
    // 단독 실행형 아이콘 버튼 생성 함수
    function createIconButton(tooltipText, iconName, clickCallback, customClass = '') {
        const btn = document.createElement('button');
        btn.className = `icon-btn ${customClass}`;
        btn.setAttribute('data-tooltip', tooltipText);

        const img = document.createElement('img');
        img.src = `img/${iconName}.png`;
        btn.appendChild(img);

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            clickCallback(e);
        });

        menu.appendChild(btn);
        return btn;
    }

    // 투명도 그리기 객체 생성 기록 기반 Undo / Redo
    const undoStack = [];
    const redoStack = [];
    const historyRecordedEntities = new WeakSet();
    let replayingHistory = false;

    function historyEntities(entity) {
        return [entity, ...(entity?.customData?.subEntities || [])].filter(Boolean);
    }

    function refreshHistoryButtons() {
        if (!undoButton || !redoButton) return;
        undoButton.disabled = undoStack.length === 0;
        redoButton.disabled = redoStack.length === 0;
        undoButton.style.opacity = undoButton.disabled ? '.35' : '1';
        redoButton.style.opacity = redoButton.disabled ? '.35' : '1';
    }

    function undoDrawing() {
        const command = undoStack.pop();
        if (!command) return;
        replayingHistory = true;
        if (viewer.selectedEntity === command.entity) viewer.selectedEntity = undefined;
        command.entities.forEach(entity => viewer.entities.remove(entity));
        replayingHistory = false;
        redoStack.push(command);
        refreshHistoryButtons();
        viewer.scene.requestRender();
    }

    function redoDrawing() {
        const command = redoStack.pop();
        if (!command) return;
        replayingHistory = true;
        command.entities.forEach(entity => { if (!viewer.entities.contains(entity)) viewer.entities.add(entity); });
        document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity: command.entity } }));
        replayingHistory = false;
        undoStack.push(command);
        refreshHistoryButtons();
        viewer.scene.requestRender();
    }

    function clearDrawingHistory() {
        undoStack.length = 0;
        redoStack.length = 0;
        refreshHistoryButtons();
    }

    document.addEventListener('drawing-entity-added', event => {
        const entity = event.detail?.entity;
        if (replayingHistory || !entity?.customData?.drawingType || entity.customData.isDrawingGroup || historyRecordedEntities.has(entity)) return;
        historyRecordedEntities.add(entity);
        undoStack.push({ entity, entities: historyEntities(entity) });
        redoStack.length = 0;
        refreshHistoryButtons();
    });

    function createHistoryButton(imagePath, tooltip, action) {
        const button = document.createElement('button');
        button.className = 'icon-btn';
        button.type = 'button';
        button.setAttribute('data-tooltip', tooltip);
        const image = document.createElement('img');
        image.src = imagePath;
        image.alt = tooltip;
        button.appendChild(image);
        button.addEventListener('click', event => { event.stopPropagation(); action(); });
        menu.appendChild(button);
        return button;
    }

    const undoButton = createHistoryButton('/img/Left.png', '실행 취소 (Ctrl+Z)', undoDrawing);
    const redoButton = createHistoryButton('/img/Right.png', '다시 실행 (Ctrl+R)', redoDrawing);
    homeButton.after(undoButton, redoButton);
    refreshHistoryButtons();

    document.addEventListener('keydown', event => {
        if (!event.ctrlKey || event.altKey) return;
        if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        const key = event.key.toLowerCase();
        if (key === 'z') {
            event.preventDefault();
            undoDrawing();
        } else if (key === 'r') {
            event.preventDefault();
            redoDrawing();
        }
    });

    // 💡 헬퍼 2: 마우스 지연 반응 타이머 기반 드롭다운 생성 함수
    function createDropdownIconButton(tooltipText, iconName) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dropdown-wrapper';

        const triggerBtn = document.createElement('button');
        triggerBtn.className = 'drop-trigger';
        triggerBtn.setAttribute('title', tooltipText); 

        const img = document.createElement('img');
        //img.src = `https://api.iconify.design/material-symbols:${iconName}-rounded.svg`;
        img.src = `img/${iconName}.png`;
        triggerBtn.appendChild(img);
        wrapper.appendChild(triggerBtn);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'dropdown-content';
        wrapper.appendChild(contentDiv);

        let closeTimer = null;

        const showMenu = () => {
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
            contentDiv.style.display = 'block';
        };

        const hideMenuDeferred = () => {
            if (!closeTimer) {
                closeTimer = setTimeout(() => {
                    contentDiv.style.display = 'none';
                }, 200); 
            }
        };

        wrapper.addEventListener('mouseenter', showMenu);
        wrapper.addEventListener('mouseleave', hideMenuDeferred);
        contentDiv.addEventListener('mouseenter', showMenu);
        contentDiv.addEventListener('mouseleave', hideMenuDeferred);

        menu.appendChild(wrapper);
        return contentDiv; 
    }


    // ==========================================
    // ⚙️ 버튼 및 드롭다운 아이콘 셋 정의
    // ==========================================

    // createIconButton('🖼️ 빌보드 핀 배치', 'pin-drop', () => {
    //     if (window.billboard) {
    //         const dialog = document.getElementById('billboard-dialog');
            
    //         // 1. 다이얼로그가 숨겨져 있다면 먼저 화면에 표시합니다.
    //         if (dialog && getComputedStyle(dialog).display === 'none') {
    //             window.billboard.showUI();
    //         }
            
    //         // 2. UI에 입력된 위경도/이미지 설정값으로 빌보드를 생성(또는 토글)합니다.
    //         if (typeof window.billboard.createBillboardFromUI === 'function') {
    //             window.billboard.createBillboardFromUI();
    //         }
    //     } else {
    //         console.warn("billboard 모듈이 로드되지 않았습니다.");
    //     }
    // });


    // 3. 👁 보기 (스케일바 / 상태바 표시 전환)
    const viewDropContent = createDropdownIconButton('👁 보기', 'View-In-Ar');

    function createViewAction(labelText, action) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = labelText;
        link.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            action();
        });
        viewDropContent.appendChild(link);
        return link;
    }

    // 보기 메뉴의 첫 항목
    createViewAction('빌보드 배치', () => {
        const dialog = document.getElementById('billboard-dialog');
        if (dialog) {
            const isHidden = getComputedStyle(dialog).display === 'none';
            dialog.style.display = isHidden ? 'block' : 'none';
        } else if (window.billboard && typeof window.billboard.createBillboardFromUI === 'function') {
            window.billboard.createBillboardFromUI();
        }
    });

    function createViewCheckbox(labelText, checked, onChange) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        const text = document.createElement('span');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        text.textContent = labelText;
        label.append(checkbox, text);
        viewDropContent.appendChild(label);
        checkbox.addEventListener('change', () => onChange(checkbox.checked));
        return checkbox;
    }

    const compassCheckbox = createViewCheckbox('나침반', true, checked => {
        const compass = document.getElementById('compass');
        const visible = compass ? getComputedStyle(compass).display !== 'none' : !checked;
        if (visible !== checked && typeof toggleCompass === 'function') toggleCompass();
    });
    const syncCompassCheckbox = () => {
        const compass = document.getElementById('compass');
        if (compass) compassCheckbox.checked = getComputedStyle(compass).display !== 'none';
    };
    window.addEventListener('load', syncCompassCheckbox, { once: true });
    setTimeout(syncCompassCheckbox, 0);

    // mapDraw.ModelDraw()의 초기값이 숨김이므로 체크 해제 상태로 시작한다.
    createViewCheckbox('3D 모델 ON/OFF', false, () => {
        window.mapDrawing?.toggleTilesetVisibility?.();
    });

    function createVisibilityToggle(labelText, controlName, changeEventName) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        const text = document.createElement('span');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        text.textContent = labelText;
        label.append(checkbox, text);
        viewDropContent.appendChild(label);

        const sync = () => {
            const control = window[controlName];
            checkbox.checked = control ? control.isVisible() : false;
            checkbox.disabled = !control;
        };
        checkbox.addEventListener('change', () => {
            window[controlName]?.setVisible(checkbox.checked);
        });
        document.addEventListener(changeEventName, sync);
        window.addEventListener('load', sync, { once: true });
        setTimeout(sync, 0);
        return checkbox;
    }

    createVisibilityToggle('스케일바', 'ScaleBarControl', 'scalebar-visibility-changed');
    createVisibilityToggle('Status Bar', 'StatusBarControl', 'statusbar-visibility-changed');

    // 2차원 지도 체크 시 2D로, 체크 해제 시 기본 3D 보기로 전환합니다.
    const map2DLabel = document.createElement('label');
    const map2DCheckbox = document.createElement('input');
    const map2DText = document.createElement('span');
    map2DCheckbox.type = 'checkbox';
    map2DCheckbox.checked = viewer.scene.mode === Cesium.SceneMode.SCENE2D;
    map2DText.textContent = '2차원 지도';
    map2DLabel.append(map2DCheckbox, map2DText);
    viewDropContent.appendChild(map2DLabel);

    map2DCheckbox.addEventListener('change', () => {
        if (map2DCheckbox.checked) {
            viewer.scene.morphTo2D(1.0);
        } else {
            viewer.scene.morphTo3D(1.0);
        }
    });

    // 다른 코드에서 보기 모드를 변경해도 메뉴 체크 상태를 실제 지도와 맞춥니다.
    viewer.scene.morphComplete.addEventListener(() => {
        const is2D = viewer.scene.mode === Cesium.SceneMode.SCENE2D;
        map2DCheckbox.checked = is2D;

        if (is2D) {
            // 3D 홈 버튼과 동일한 중심 좌표 및 확대 수준을 사용합니다.
            viewer.camera.setView({
                destination: HOME_VIEW_DESTINATION
            });
        } else if (viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
            // 3D 복귀 시에도 홈 버튼과 동일한 위치와 수직 하향 시점을 적용합니다.
            viewer.camera.setView({
                destination: HOME_VIEW_DESTINATION,
                orientation: {
                    heading: Cesium.Math.toRadians(0.0),
                    pitch: Cesium.Math.toRadians(-90.0),
                    roll: 0.0
                }
            });
        }

        viewer.scene.requestRender();
    });

    // 4. ⭐ 즐겨찾기 (드롭다운 아이콘)
    const favDropContent = createDropdownIconButton('⭐ 즐겨찾기', 'star');

    let favoriteManagerPanel = null;
    let userFavorites = [];
    let selectedFavoriteIndex = -1;
    let editingFavoriteIndex = -1;

    async function loadUserFavorites() {
        try {
            const response = await fetch('/api/favorites', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            userFavorites = Array.isArray(data.favorites) ? data.favorites : [];
            selectedFavoriteIndex = -1;
            renderFavoriteManagerList();
        } catch (error) {
            console.error('즐겨찾기 JSON 읽기 실패:', error);
            const status = favoriteManagerPanel?.querySelector('.favorite-manager-status');
            if (status) status.textContent = 'JSON 데이터를 불러오지 못했습니다.';
        }
    }

    async function saveUserFavorites() {
        const status = favoriteManagerPanel?.querySelector('.favorite-manager-status');
        try {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorites: userFavorites })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
            userFavorites = data.favorites;
            if (status) status.textContent = '/jsonData/favorites.json 파일에 저장했습니다.';
            renderFavoriteManagerList();
        } catch (error) {
            console.error('즐겨찾기 JSON 저장 실패:', error);
            if (status) status.textContent = error.message || 'JSON 파일 저장에 실패했습니다.';
        }
    }

    function moveToFavorite(item) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude, 10000),
            duration: 2
        });
    }

    function renderFavoriteManagerList() {
        const list = favoriteManagerPanel?.querySelector('.favorite-manager-list');
        if (!list) return;
        list.replaceChildren();
        if (!userFavorites.length) {
            const empty = document.createElement('div');
            empty.textContent = '등록된 즐겨찾기가 없습니다.';
            empty.style.cssText = 'padding:12px;color:#9ca3af;text-align:center;';
            list.appendChild(empty);
            return;
        }
        userFavorites.forEach((item, index) => {
            const row = document.createElement('div');
            row.style.cssText = `display:grid;grid-template-columns:24px minmax(90px,1fr) 92px 92px;gap:5px;align-items:center;padding:7px;border-bottom:1px solid #3f4650;cursor:pointer;${selectedFavoriteIndex === index ? 'background:#164e63;' : ''}`;
            const select = document.createElement('input');
            select.type = 'radio';
            select.name = 'favorite-manager-selection';
            select.checked = selectedFavoriteIndex === index;
            const name = document.createElement('span');
            name.textContent = item.name;
            const longitude = document.createElement('span');
            longitude.textContent = Number(item.longitude).toFixed(6);
            const latitude = document.createElement('span');
            latitude.textContent = Number(item.latitude).toFixed(6);
            const choose = () => {
                selectedFavoriteIndex = index;
                renderFavoriteManagerList();
            };
            row.addEventListener('click', choose);
            row.addEventListener('dblclick', () => moveToFavorite(item));
            select.addEventListener('change', choose);
            row.append(select, name, longitude, latitude);
            list.appendChild(row);
        });
    }

    function showFavoriteManager() {
        if (!favoriteManagerPanel) {
            favoriteManagerPanel = document.createElement('section');
            favoriteManagerPanel.style.cssText = 'position:absolute;top:70px;left:20px;width:500px;z-index:1100;padding:12px;border:1px solid #59616c;border-radius:9px;background:rgba(27,29,32,.97);box-shadow:0 12px 30px rgba(0,0,0,.5);color:#fff;font:13px sans-serif;';
            favoriteManagerPanel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-weight:700;font-size:15px;"><span>⭐ 즐겨찾기 등록/수정/삭제</span><button class="favorite-manager-close" style="border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer;">×</button></div>
                <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:6px;margin-bottom:8px;"><input class="favorite-manager-name" placeholder="명칭"><input class="favorite-manager-longitude" type="number" step="0.000001" placeholder="경도"><input class="favorite-manager-latitude" type="number" step="0.000001" placeholder="위도"><button class="favorite-manager-add">목록 등록</button></div>
                <div style="display:grid;grid-template-columns:24px minmax(90px,1fr) 92px 92px;gap:5px;padding:6px 7px;background:#374151;color:#e5e7eb;font-weight:700;"><span></span><span>명칭</span><span>경도</span><span>위도</span></div>
                <div class="favorite-manager-list" style="max-height:280px;overflow:auto;border:1px solid #3f4650;border-radius:0 0 5px 5px;"></div>
                <div style="display:flex;gap:7px;margin-top:9px;"><button class="favorite-manager-move">선택 위치 이동</button><button class="favorite-manager-edit">선택 수정</button><button class="favorite-manager-delete">선택 삭제</button><button class="favorite-manager-save">JSON 저장</button><span class="favorite-manager-status" style="align-self:center;color:#7dd3fc;"></span></div>`;
            document.body.appendChild(favoriteManagerPanel);
            favoriteManagerPanel.hidden = true;
            favoriteManagerPanel.querySelectorAll('input:not([type=radio])').forEach(input => { input.style.cssText = 'min-width:0;padding:7px;border:1px solid #59616c;border-radius:4px;background:#111827;color:#fff;'; });
            favoriteManagerPanel.querySelectorAll('button:not(.favorite-manager-close)').forEach(button => { button.style.cssText = 'padding:7px 10px;border:0;border-radius:4px;background:#0284c7;color:#fff;cursor:pointer;'; });
            favoriteManagerPanel.querySelector('.favorite-manager-close').addEventListener('click', () => { favoriteManagerPanel.hidden = true; });
            favoriteManagerPanel.querySelector('.favorite-manager-add').addEventListener('click', async () => {
                const nameInput = favoriteManagerPanel.querySelector('.favorite-manager-name');
                const longitudeInput = favoriteManagerPanel.querySelector('.favorite-manager-longitude');
                const latitudeInput = favoriteManagerPanel.querySelector('.favorite-manager-latitude');
                const name = nameInput.value.trim();
                const longitude = Number(longitudeInput.value);
                const latitude = Number(latitudeInput.value);
                if (!name || !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return alert('명칭, 경도(-180~180), 위도(-90~90)를 올바르게 입력하세요.');
                const status = favoriteManagerPanel.querySelector('.favorite-manager-status');
                if (editingFavoriteIndex >= 0) {
                    userFavorites[editingFavoriteIndex] = { ...userFavorites[editingFavoriteIndex], name, longitude, latitude };
                    selectedFavoriteIndex = editingFavoriteIndex;
                    editingFavoriteIndex = -1;
                    nameInput.value = longitudeInput.value = latitudeInput.value = '';
                    status.textContent = '수정했습니다. JSON 저장 버튼을 눌러 반영하세요.';
                    renderFavoriteManagerList();
                    return;
                }
                try {
                    const response = await fetch('/api/favorites/append', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: `favorite-${Date.now()}`, name, longitude, latitude })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
                    userFavorites = data.favorites;
                    selectedFavoriteIndex = userFavorites.length - 1;
                    nameInput.value = longitudeInput.value = latitudeInput.value = '';
                    status.textContent = '목록 등록과 JSON 추가 저장을 완료했습니다.';
                    renderFavoriteManagerList();
                } catch (error) {
                    console.error('즐겨찾기 추가 저장 실패:', error);
                    status.textContent = error.message || 'JSON 추가 저장에 실패했습니다.';
                }
            });
            favoriteManagerPanel.querySelector('.favorite-manager-move').addEventListener('click', () => {
                if (selectedFavoriteIndex < 0) return alert('이동할 항목을 선택하세요.');
                moveToFavorite(userFavorites[selectedFavoriteIndex]);
            });
            favoriteManagerPanel.querySelector('.favorite-manager-edit').addEventListener('click', () => {
                if (selectedFavoriteIndex < 0) return alert('수정할 항목을 선택하세요.');
                const item = userFavorites[selectedFavoriteIndex];
                favoriteManagerPanel.querySelector('.favorite-manager-name').value = item.name;
                favoriteManagerPanel.querySelector('.favorite-manager-longitude').value = item.longitude;
                favoriteManagerPanel.querySelector('.favorite-manager-latitude').value = item.latitude;
                editingFavoriteIndex = selectedFavoriteIndex;
                favoriteManagerPanel.querySelector('.favorite-manager-name').focus();
            });
            favoriteManagerPanel.querySelector('.favorite-manager-delete').addEventListener('click', () => {
                if (selectedFavoriteIndex < 0) return alert('삭제할 항목을 선택하세요.');
                userFavorites.splice(selectedFavoriteIndex, 1);
                selectedFavoriteIndex = -1;
                renderFavoriteManagerList();
            });
            favoriteManagerPanel.querySelector('.favorite-manager-save').addEventListener('click', saveUserFavorites);
        }
        favoriteManagerPanel.hidden = !favoriteManagerPanel.hidden;
        if (!favoriteManagerPanel.hidden) loadUserFavorites();
    }

    loadUserFavorites();
    document.addEventListener('favorite-data-changed', loadUserFavorites);

    const favoriteManagerLink = document.createElement('a');
    favoriteManagerLink.textContent = '⭐ 즐겨찾기 등록/수정/삭제';
    favoriteManagerLink.href = '#';
    favoriteManagerLink.style.borderBottom = '1px solid rgba(255,255,255,.1)';
    favoriteManagerLink.addEventListener('click', event => { event.preventDefault(); showFavoriteManager(); });
    favDropContent.appendChild(favoriteManagerLink);
    
    const moveLink = document.createElement('a');
    moveLink.textContent = '📍 사용자 지정 위치 이동';
    moveLink.href = '#';
    moveLink.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    moveLink.style.fontWeight = 'bold';
    moveLink.style.color = '#38bdf8';
    moveLink.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.moveLocation && typeof window.moveLocation.showMoveInfo === 'function') {
            window.moveLocation.showMoveInfo();
        }
    });
    favDropContent.appendChild(moveLink);


    // 4. 📐 측정 도구 (드롭다운 아이콘)
    const measureDropContent = createDropdownIconButton('📐 측정 기능 모음', 'straighten');
    const measureActions = [
        { name: '📏 거리 측정', action: () => { if(window.distance) distance.start(); } },
        { name: '📐 면적 측정', action: () => { if(window.measure) measure.start(); } },
        { name: '👁️‍🗨️ 가시선(LOS) 작도', action: () => { if(window.drawSightViewLine) drawSightViewLine.start(); } },
        { name: '📊 차폐/LOS 분석', action: () => { 
            if (window.angleLos && typeof window.angleLos.showMoveInfo === 'function') window.angleLos.showMoveInfo();
        }}
    ];
    measureActions.forEach(item => {
        const link = document.createElement('a');
        link.textContent = item.name;
        link.href = '#';
        link.addEventListener('click', function(e) {
            e.preventDefault();
            item.action();
        });
        measureDropContent.appendChild(link);
    });


    // 5. 🚀 대탄도탄 작전 (드롭다운 아이콘)
    const opDropContent = createDropdownIconButton('🚀 대탄도탄 작전 모음', 'rocket-launch');
    const opActions = [
        { name: '🗺️ 공역생성', action: () => {
            if (window.airspace && typeof window.airspace.togglePanel === 'function') {
                window.airspace.togglePanel();
            } else {
                console.error('airspace.js가 로드되지 않았습니다.');
                alert('공역생성 모듈을 불러오지 못했습니다.');
            }
        }},
        { name: '🌐 Dome 그리기', action: () => {
            if (window.domeDrawing && typeof window.domeDrawing.createControlPanel === 'function') {
                const existBox = document.getElementById('controlPanel');
                !existBox ? window.domeDrawing.createControlPanel() : window.domeDrawing.toggleInfoBox();
            }
        }},
        { name: '📡 레이다 빔', action: () => {
            if (window.radar && typeof window.radar.createInfoBox === 'function') {
                const existBox = document.getElementById('radarInfoBox');
                !existBox ? window.radar.createInfoBox() : window.radar.toggleInfoBox();
            }
        }},
        { name: '🚀 탄도탄 경로', action: () => {
            if (window.curve && typeof window.curve.createInfoBox === 'function') {
                const existBox = document.getElementById('missileinfoBox');
                !existBox ? window.curve.createInfoBox() : window.curve.toggleInfoBox();
            }
        }},
        { name: '✈️ 항공기 항적', action: () => {
            if (window.airpath && typeof window.airpath.createInfoBox === 'function') {
                const existBox = document.getElementById('airpathinfoBox');
                !existBox ? window.airpath.createInfoBox() : window.airpath.toggleInfoBox();
            }
        }},
        { name: '🔥 유도탄 항적', action: () => {
            if (window.particle && typeof window.particle.createInfoBox === 'function') {
                const existBox = document.getElementById('particleinfoBox');
                !existBox ? window.particle.createInfoBox() : window.particle.toggleInfoBox();
            }
        }},
        { name: '📈 풀업 항적', action: () => {
            if (window.pullup && typeof window.pullup.createInfoBox === 'function') {
                const existBox = document.getElementById('pullupinfoBox');
                !existBox ? window.pullup.createInfoBox() : window.pullup.toggleInfoBox();
            }
        }}
    ];
    opActions.forEach(item => {
        const link = document.createElement('a');
        link.textContent = item.name;
        link.href = '#';
        link.addEventListener('click', function(e) {
            e.preventDefault();
            item.action();
        });
        opDropContent.appendChild(link);
    });


    // 6. ✏️ 그리기 도구 (드롭다운 아이콘)
    const drawDropContent = createDropdownIconButton('✏️ 자유 투명도 그리기', 'edit');
    drawDropContent.classList.add('draw-dropdown-content');
    let customDrawingHandler = null;
    let customDrawingCameraLocked = false;
    let customDrawingPreview = null;
    let drawCompletionHandler = null;
    const customDrawingEntities = [];

    function clearDrawCompletionHandler() {
        if (drawCompletionHandler) document.removeEventListener('drawing-entity-added', drawCompletionHandler);
        drawCompletionHandler = null;
    }

    function finishAfterOneShape(action) {
        clearDrawCompletionHandler();
        drawCompletionHandler = () => {
            clearDrawCompletionHandler();
            setTimeout(() => {
                action.deactivate?.();
                window.AreaStylePanel?.close?.();
            }, 0);
        };
        document.addEventListener('drawing-entity-added', drawCompletionHandler);
    }

    function deactivateCustomDrawing() {
        if (customDrawingHandler && !customDrawingHandler.isDestroyed()) customDrawingHandler.destroy();
        customDrawingHandler = null;
        if (customDrawingPreview) viewer.entities.remove(customDrawingPreview);
        customDrawingPreview = null;
        if (customDrawingCameraLocked && viewer?.scene?.screenSpaceCameraController) {
            viewer.scene.screenSpaceCameraController.enableInputs = true;
            customDrawingCameraLocked = false;
        }
    }

    function pickDrawPosition(screenPosition) {
        const ray = viewer.camera.getPickRay(screenPosition);
        let cartesian = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (!Cesium.defined(cartesian)) {
            cartesian = viewer.scene.pickPositionSupported
                ? viewer.scene.pickPosition(screenPosition)
                : undefined;
        }
        return cartesian;
    }

    function createPointSymbol(shape, style = window.AreaStylePanel?.getStyle?.() || {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 42;
        canvas.height = 42;
        const ctx = canvas.getContext('2d');
        ctx.translate(21, 21);
        ctx.beginPath();
        if (shape === 'circle') ctx.arc(0, 0, 11, 0, Math.PI * 2);
        if (shape === 'square') ctx.rect(-10, -10, 20, 20);
        if (shape === 'diamond') { ctx.moveTo(0, -13); ctx.lineTo(13, 0); ctx.lineTo(0, 13); ctx.lineTo(-13, 0); ctx.closePath(); }
        if (shape === 'star') {
            for (let i = 0; i < 10; i++) {
                const angle = -Math.PI / 2 + i * Math.PI / 5;
                const radius = i % 2 === 0 ? 14 : 6;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
        }
        ctx.globalAlpha = (style.fillOpacity ?? 100) / 100;
        if (style.fillType === 'gradient') {
            const gradient = ctx.createLinearGradient(-14, -14, 14, 14);
            gradient.addColorStop(0, style.fillColor || '#22d3ee');
            gradient.addColorStop(1, '#ffffff');
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = style.fillColor || '#22d3ee';
        }
        if (style.fillType !== 'none') ctx.fill();
        if (style.lineType !== 'none') {
            ctx.globalAlpha = (style.lineOpacity ?? 100) / 100;
            ctx.strokeStyle = style.lineColor || '#ffffff';
            ctx.lineWidth = Math.max(1, style.lineWidth || 2);
            ctx.stroke();
        }
        return canvas;
    }

    function buildGroundPointPositions(shape, longitude, latitude, width, height) {
        const center = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
        const halfWidth = Math.max(0.5, Number(width) / 2);
        const halfHeight = Math.max(0.5, Number(height) / 2);
        const normalized = [];
        if (shape === 'circle') {
            for (let index = 0; index < 48; index++) {
                const angle = index / 48 * Math.PI * 2;
                normalized.push([Math.cos(angle), Math.sin(angle)]);
            }
        } else if (shape === 'square') {
            normalized.push([-1,-1],[1,-1],[1,1],[-1,1]);
        } else if (shape === 'diamond') {
            normalized.push([0,-1],[1,0],[0,1],[-1,0]);
        } else {
            for (let index = 0; index < 10; index++) {
                const angle = -Math.PI / 2 + index * Math.PI / 5;
                const radius = index % 2 === 0 ? 1 : .43;
                normalized.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
            }
        }
        return normalized.map(([x, y]) => Cesium.Matrix4.multiplyByPoint(
            transform,
            new Cesium.Cartesian3(x * halfWidth, y * halfHeight, 0),
            new Cesium.Cartesian3()
        ));
    }

    function activatePointDrawing(shape, title) {
        deactivateCustomDrawing();
        customDrawingHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        customDrawingHandler.setInputAction(click => {
            const picked = viewer.scene.pick(click.position);
            if (Cesium.defined(picked) && picked.id?._areaStyleEditor) {
                viewer.selectedEntity = picked.id.customData?.groupEntity || picked.id;
                return;
            }
            const cartesian = pickDrawPosition(click.position);
            if (!Cesium.defined(cartesian)) return;
            const style = window.AreaStylePanel?.getStyle?.() || {};
            const center = Cesium.Cartographic.fromCartesian(cartesian);
            const pointStyle = {
                ...style,
                pointGeometry: true,
                pointShapeType: shape,
                pointLongitude: Cesium.Math.toDegrees(center.longitude),
                pointLatitude: Cesium.Math.toDegrees(center.latitude),
                pointWidth: 30,
                pointHeight: 30
            };
            const groundPositions = buildGroundPointPositions(shape, pointStyle.pointLongitude, pointStyle.pointLatitude, pointStyle.pointWidth, pointStyle.pointHeight);
            const entity = viewer.entities.add({
                name: String(style.shapeName || title.replace(/\s*설정\/편집$/, '')).trim(),
                position: cartesian,
                polygon: {
                    hierarchy: groundPositions,
                    material: window.ShapeDrawingCore?.fillMaterial?.(style) || Cesium.Color.CYAN.withAlpha(.32),
                    fill: style.fillType !== 'none',
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    classificationType: Cesium.ClassificationType.TERRAIN
                },
                polyline: {
                    positions: [...groundPositions, groundPositions[0]],
                    width: style.lineWidth || 2,
                    material: window.ShapeDrawingCore?.lineMaterial?.(style) || Cesium.Color.WHITE,
                    clampToGround: true,
                    show: style.lineType !== 'none'
                }
            });
            entity.customData = { drawingType: 'point-symbol', displayName: entity.name };
            window.ShapeDrawingCore?.attachEditor?.(viewer, entity, title, pointStyle, nextStyle => {
                const longitude = Number(nextStyle.pointLongitude);
                const latitude = Number(nextStyle.pointLatitude);
                const width = Number(nextStyle.pointWidth);
                const height = Number(nextStyle.pointHeight);
                const nextShape = ['circle', 'square', 'diamond', 'star'].includes(nextStyle.pointShapeType) ? nextStyle.pointShapeType : shape;
                if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
                    window.alert('중심 경도·위도와 너비·높이를 올바르게 입력하세요.');
                    return;
                }
                entity.name = String(nextStyle.shapeName || entity.name).trim();
                entity.customData.displayName = entity.name;
                const nextCenter = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
                const nextPositions = buildGroundPointPositions(nextShape, longitude, latitude, width, height);
                entity.position = nextCenter;
                entity.polygon.hierarchy = nextPositions;
                entity.polygon.fill = nextStyle.fillType !== 'none';
                entity.polygon.material = window.ShapeDrawingCore?.fillMaterial?.(nextStyle) || Cesium.Color.CYAN.withAlpha(.32);
                entity.polyline.positions = [...nextPositions, nextPositions[0]];
                entity.polyline.show = nextStyle.lineType !== 'none';
                entity.polyline.width = nextStyle.lineWidth || 2;
                entity.polyline.material = window.ShapeDrawingCore?.lineMaterial?.(nextStyle) || Cesium.Color.WHITE;
                entity.customData.centerLongitude = longitude;
                entity.customData.centerLatitude = latitude;
                entity.customData.pointWidth = width;
                entity.customData.pointHeight = height;
                entity.customData.pointShapeType = nextShape;
                nextStyle.pointShapeType = nextShape;
                document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
                viewer.scene.requestRender();
            });
            entity.customData.centerLongitude = pointStyle.pointLongitude;
            entity.customData.centerLatitude = pointStyle.pointLatitude;
            entity.customData.pointWidth = 30;
            entity.customData.pointHeight = 30;
            entity.customData.pointShapeType = shape;
            customDrawingEntities.push(entity);
            document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity } }));
            viewer.scene.requestRender();
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    function buildAreaPositions(shape, center, edge) {
        const centerCarto = Cesium.Cartographic.fromCartesian(center);
        const edgeCarto = Cesium.Cartographic.fromCartesian(edge);
        const lon = Cesium.Math.toDegrees(centerCarto.longitude);
        const lat = Cesium.Math.toDegrees(centerCarto.latitude);
        const edgeLon = Cesium.Math.toDegrees(edgeCarto.longitude);
        const edgeLat = Cesium.Math.toDegrees(edgeCarto.latitude);
        const dx = (edgeLon - lon) * Math.cos(centerCarto.latitude);
        const dy = edgeLat - lat;
        const radius = Math.max(Math.hypot(dx, dy), 0.0001);
        const rotation = Math.atan2(dy, dx);
        const points = [];
        const addPolar = (angle, scale = 1) => {
            points.push(lon + Math.cos(angle) * radius * scale / Math.cos(centerCarto.latitude));
            points.push(lat + Math.sin(angle) * radius * scale);
        };
        const regular = count => { for (let i = 0; i < count; i++) addPolar(rotation + i * Math.PI * 2 / count); };

        if (shape === 'rectangle') {
            [[-1,-.7],[1,-.7],[1,.7],[-1,.7]].forEach(([x,y]) => { points.push(lon + x * radius / Math.cos(centerCarto.latitude), lat + y * radius); });
        } else if (shape === 'pentagon') regular(5);
        else if (shape === 'hexagon') regular(6);
        else if (shape === 'diamond') { for (let i = 0; i < 4; i++) addPolar(rotation + i * Math.PI / 2); }
        else if (shape === 'triangle') regular(3);
        else if (shape === 'star') { for (let i = 0; i < 10; i++) addPolar(rotation - Math.PI / 2 + i * Math.PI / 5, i % 2 ? .45 : 1); }
        else if (shape === 'parallelogram') {
            [[-1,-.65],[.55,-.65],[1,.65],[-.55,.65]].forEach(([x,y]) => { points.push(lon + x * radius / Math.cos(centerCarto.latitude), lat + y * radius); });
        } else if (shape === 'trapezoid') {
            [[-.55,-.65],[.55,-.65],[1,.65],[-1,.65]].forEach(([x,y]) => { points.push(lon + x * radius / Math.cos(centerCarto.latitude), lat + y * radius); });
        } else if (shape === 'arc') {
            for (let i = 0; i <= 32; i++) addPolar(rotation + Math.PI * i / 32);
        } else if (shape === 'sector') {
            points.push(lon, lat);
            const halfAngle = Math.PI / 4;
            for (let i = 0; i <= 32; i++) {
                addPolar(rotation - halfAngle + (halfAngle * 2 * i / 32));
            }
        }
        return points;
    }

    function activateAreaDrawing(shape) {
        deactivateCustomDrawing();
        let center = null;
        customDrawingHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        customDrawingHandler.setInputAction(movement => {
            if (!center) return;
            const cursor = pickDrawPosition(movement.endPosition);
            if (!Cesium.defined(cursor)) return;
            let degrees = buildAreaPositions(shape, center, cursor);
            if (shape === 'sector' || shape === 'arc') {
                const geometry = window.ShapeDrawingCore?.arcGeometryFromPoints?.(center, cursor, shape === 'arc' ? 180 : 90);
                if (geometry) degrees = window.ShapeDrawingCore.arcGeometryPoints(geometry.longitude, geometry.latitude, geometry.direction, geometry.centralAngle, geometry.radius, shape === 'sector').points;
            }
            if (shape !== 'arc' && degrees.length >= 4) degrees = degrees.concat(degrees.slice(0, 2));
            const style = window.AreaStylePanel?.getStyle?.() || {};
            const positions = Cesium.Cartesian3.fromDegreesArray(degrees);
            if (!customDrawingPreview) {
                customDrawingPreview = viewer.entities.add({ polyline: { positions, width: Math.max(2, Number(style.lineWidth) || 2), material: window.ShapeDrawingCore?.lineMaterial?.({ ...style, lineType: 'solid' }) || Cesium.Color.CYAN, clampToGround: true } });
            } else customDrawingPreview.polyline.positions = positions;
            viewer.scene.requestRender();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        customDrawingHandler.setInputAction(click => {
            const cartesian = pickDrawPosition(click.position);
            if (!Cesium.defined(cartesian)) return;
            if (!center) {
                center = cartesian;
                if (viewer?.scene?.screenSpaceCameraController) {
                    viewer.scene.screenSpaceCameraController.enableInputs = false;
                    customDrawingCameraLocked = true;
                }
                return;
            }
            let degrees = buildAreaPositions(shape, center, cartesian);
            const isArc = shape === 'arc';
            const style = window.AreaStylePanel?.getStyle?.() || {};
            const arcGeometry = (shape === 'sector' || shape === 'arc')
                ? window.ShapeDrawingCore?.arcGeometryFromPoints?.(center, cartesian, isArc ? 180 : 90)
                : null;
            if (arcGeometry) {
                degrees = window.ShapeDrawingCore.arcGeometryPoints(
                    arcGeometry.longitude, arcGeometry.latitude, arcGeometry.direction,
                    arcGeometry.centralAngle, arcGeometry.radius, !isArc
                ).points;
            }
            const editorStyle = arcGeometry ? {
                ...style, arcGeometry: true, arcShapeType: shape,
                arcLongitude: arcGeometry.longitude, arcLatitude: arcGeometry.latitude,
                arcDirection: arcGeometry.direction, arcAngle: arcGeometry.centralAngle,
                arcRadius: arcGeometry.radius
            } : style;
            let outlineEntity = null;
            const entity = isArc
                ? viewer.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArray(degrees), width: style.lineWidth || 4, material: window.ShapeDrawingCore?.lineMaterial?.(style) || Cesium.Color.CYAN, clampToGround: true } })
                : viewer.entities.add({ polygon: { hierarchy: Cesium.Cartesian3.fromDegreesArray(degrees), material: window.ShapeDrawingCore?.fillMaterial?.(style) || Cesium.Color.CYAN.withAlpha(.32), outline: false, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, classificationType: Cesium.ClassificationType.TERRAIN } });
            if (arcGeometry) {
                const sectorDegrees = window.ShapeDrawingCore.arcGeometryPoints(
                    arcGeometry.longitude, arcGeometry.latitude, arcGeometry.direction,
                    arcGeometry.centralAngle, arcGeometry.radius, true
                ).points;
                const closedDegrees = sectorDegrees.concat(sectorDegrees.slice(0, 2));
                outlineEntity = viewer.entities.add({
                    show: !isArc && style.lineType !== 'none',
                    polyline: {
                        positions: Cesium.Cartesian3.fromDegreesArray(closedDegrees),
                        width: Math.max(1, Number(style.lineWidth) || 2),
                        material: window.ShapeDrawingCore?.lineMaterial?.(style) || Cesium.Color.WHITE,
                        clampToGround: true
                    }
                });
                outlineEntity._drawingOwner = entity;
            }
            const defaultName = shape === 'sector' ? '부채꼴' : shape === 'arc' ? '원호' : '면 도형';
            entity.name = String(style.shapeName || defaultName).trim() || defaultName;
            entity.customData = { drawingType: shape, displayName: entity.name, subEntities: outlineEntity ? [outlineEntity] : [], ...(arcGeometry ? { arcGeometry: { ...arcGeometry } } : {}) };
            window.ShapeDrawingCore?.attachEditor?.(viewer, entity, `${entity.name} 설정/편집`, editorStyle, nextStyle => {
                entity.name = String(nextStyle.shapeName || entity.name).trim();
                entity.customData.displayName = entity.name;
                if (arcGeometry) {
                    const selectedType = nextStyle.arcShapeType === 'arc' ? 'arc' : 'sector';
                    const longitude = Number(nextStyle.arcLongitude);
                    const latitude = Number(nextStyle.arcLatitude);
                    const direction = Number(nextStyle.arcDirection);
                    const centralAngle = Number(nextStyle.arcAngle);
                    const radius = Number(nextStyle.arcRadius);
                    if (!Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(direction) || !Number.isFinite(centralAngle) || centralAngle <= 0 || centralAngle > 360 || !Number.isFinite(radius) || radius < 1) {
                        window.alert('중심좌표, 방향, 중심 내각과 반지름을 올바르게 입력하세요.');
                        return;
                    }
                    const arcDegrees = window.ShapeDrawingCore.arcGeometryPoints(longitude, latitude, direction, centralAngle, radius, false).points;
                    const sectorDegrees = window.ShapeDrawingCore.arcGeometryPoints(longitude, latitude, direction, centralAngle, radius, true).points;
                    const arcPositions = Cesium.Cartesian3.fromDegreesArray(arcDegrees);
                    const sectorPositions = Cesium.Cartesian3.fromDegreesArray(sectorDegrees);
                    if (selectedType === 'arc') {
                        if (!entity.polyline) entity.polyline = new Cesium.PolylineGraphics();
                        entity.polyline.positions = arcPositions;
                        entity.polyline.clampToGround = true;
                        entity.polyline.show = nextStyle.lineType !== 'none';
                        entity.polyline.width = Math.max(1, Number(nextStyle.lineWidth) || 1);
                        entity.polyline.material = window.ShapeDrawingCore.lineMaterial(nextStyle);
                        if (entity.polygon) entity.polygon.show = false;
                        if (outlineEntity) outlineEntity.show = false;
                    } else {
                        if (!entity.polygon) entity.polygon = new Cesium.PolygonGraphics();
                        entity.polygon.hierarchy = sectorPositions;
                        entity.polygon.show = true;
                        entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
                        entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
                        entity.polygon.material = window.ShapeDrawingCore.fillMaterial(nextStyle);
                        if (entity.polyline) entity.polyline.show = false;
                        if (outlineEntity) {
                            outlineEntity.polyline.positions = [...sectorPositions, sectorPositions[0]];
                            outlineEntity.show = nextStyle.lineType !== 'none';
                        }
                    }
                    entity.customData.drawingType = selectedType;
                    entity.customData.arcGeometry = { longitude, latitude, direction: ((direction % 360) + 360) % 360, centralAngle, radius };
                    nextStyle.arcShapeType = selectedType;
                }
                if (entity.customData.drawingType === 'sector' && entity.polygon) {
                    entity.polygon.material = window.ShapeDrawingCore.fillMaterial(nextStyle);
                    if (outlineEntity) {
                        outlineEntity.show = nextStyle.lineType !== 'none';
                        outlineEntity.polyline.width = Math.max(1, Number(nextStyle.lineWidth) || 1);
                        outlineEntity.polyline.material = window.ShapeDrawingCore.lineMaterial(nextStyle);
                    }
                } else if (entity.customData.drawingType === 'arc' && entity.polyline) {
                    if (outlineEntity) outlineEntity.show = false;
                    entity.polyline.show = nextStyle.lineType !== 'none';
                    entity.polyline.width = nextStyle.lineWidth;
                    entity.polyline.material = window.ShapeDrawingCore.lineMaterial(nextStyle);
                }
                document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
            });
            customDrawingEntities.push(entity);
            if (outlineEntity) customDrawingEntities.push(outlineEntity);
            if (customDrawingPreview) viewer.entities.remove(customDrawingPreview);
            customDrawingPreview = null;
            center = null;
            if (customDrawingCameraLocked && viewer?.scene?.screenSpaceCameraController) {
                viewer.scene.screenSpaceCameraController.enableInputs = true;
                customDrawingCameraLocked = false;
            }
            document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity } }));
            viewer.scene.requestRender();
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    const action = (name, activate) => ({ name, activate, deactivate: deactivateCustomDrawing });
    const moduleAction = (name, globalName) => ({
        name,
        activate: () => {
            const title = `${name.split(' ').slice(1, -1).join(' ')} 설정/편집`;
            window.AreaStylePanel?.open?.(title, () => window[globalName]?.activate?.());
        },
        deactivate: () => window[globalName]?.deactivate?.()
    });
    const styledAction = (name, activate, deactivate) => ({
        name,
        activate: () => {
            const title = `${name.split(' ').slice(1, -1).join(' ')} 설정/편집`;
            window.AreaStylePanel?.open?.(title, activate);
        },
        deactivate
    });

    const styledLineAction = (name, activate, deactivate) => ({
        name,
        activate: () => {
            const title = name.split(' ').slice(1, -1).join(' ') + ' 설정/편집';
            window.AreaStylePanel?.openLine?.(title, activate);
        },
        deactivate
    });

    const selectableShapeModules = {
        rectangle: 'RectangleDrawing', roundedRectangle: 'RoundedRectangleDrawing',
        parallelogram: 'ParallelogramDrawing', trapezoid: 'TrapezoidDrawing',
        diamond: 'DiamondDrawing', pentagon: 'PentagonDrawing', hexagon: 'HexagonDrawing', star: 'StarDrawing'
    };
    const deactivateSelectableShapes = () => Object.values(selectableShapeModules).forEach(globalName => window[globalName]?.deactivate?.());

    const drawActions = {
        point: {
            name: '📍 점 그리기',
            activate: () => {
                const title = '점 설정/편집';
                window.AreaStylePanel?.openPoint?.(title, () => {
                    const shape = window.AreaStylePanel?.getStyle?.().pointShapeType || 'circle';
                    activatePointDrawing(shape, title);
                });
            },
            deactivate: deactivateCustomDrawing
        },
        line: {
            name: '📏 선 그리기',
            activate: () => window.AreaStylePanel?.openLine?.('선 설정/편집', () => {
                const style = window.AreaStylePanel?.getStyle?.() || {};
                if (style.lineShapeType === 'polyline') window.PolylineDrawing?.activate?.();
                else window.lineDrawing?.activateWithStyle?.(style);
            }),
            deactivate: () => {
                window.lineDrawing?.close?.();
                window.PolylineDrawing?.deactivate?.();
            }
        },
        polygon: styledAction('⬡ 폴리곤 그리기', window.PolygonDrawing?.activate, window.PolygonDrawing?.deactivate),
        circle: {
            name: '○ 원 그리기',
            activate: () => window.AreaStylePanel?.openCircle?.('원 설정/편집', window.circleDrawing?.activate),
            deactivate: window.circleDrawing?.deactivate
        },
        areaRectangle: {
            name: '▭ 사각형 그리기',
            activate: () => window.AreaStylePanel?.openShape?.('사각형 설정/편집', () => {
                const type = window.AreaStylePanel?.getStyle?.()?.rectangleShapeType || 'rectangle';
                window[selectableShapeModules[type] || 'RectangleDrawing']?.activate?.();
            }),
            deactivate: deactivateSelectableShapes
        },
        areaTriangle: {
            name: '△ 삼각형 그리기',
            activate: () => window.AreaStylePanel?.openTriangle?.('삼각형 설정/편집', () => window.TriangleDrawing?.activate?.()),
            deactivate: () => window.TriangleDrawing?.deactivate?.()
        },
        areaCone: {
            name: '◔ 부채꼴 그리기',
            activate: () => window.AreaStylePanel?.openArcShape?.('부채꼴 설정/편집', () => {
                const type = window.AreaStylePanel?.getStyle?.()?.arcShapeType === 'arc' ? 'arc' : 'sector';
                activateAreaDrawing(type);
            }),
            deactivate: deactivateCustomDrawing
        },
        text: { name: '🔤 텍스트 그리기', activate: window.TextDrawing?.open, deactivate: window.TextDrawing?.deactivate }
    };

    function deactivateAllDrawActions() {
        clearDrawCompletionHandler();
        Object.values(drawActions).forEach(action => action.deactivate && action.deactivate());
    }

    function createDrawLink(action, className = '') {
        const link = document.createElement('a');
        link.textContent = action.name;
        link.href = '#';
        if (className) link.className = className;
        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            deactivateAllDrawActions();
            if (action !== drawActions.text) finishAfterOneShape(action);
            if (action.activate) action.activate();
        });
        return link;
    }

    function createDrawGroup(title, actions) {
        const group = document.createElement('details');
        group.className = 'draw-menu-group';
        const summary = document.createElement('summary');
        summary.textContent = title;
        const submenu = document.createElement('div');
        submenu.className = 'draw-submenu';
        actions.forEach(action => submenu.appendChild(createDrawLink(action)));
        group.append(summary, submenu);
        drawDropContent.appendChild(group);
    }

    drawDropContent.appendChild(createDrawLink(drawActions.point));
    drawDropContent.appendChild(createDrawLink(drawActions.line));
    createDrawGroup('▣ 면 그리기', [
        drawActions.polygon, drawActions.circle, drawActions.areaRectangle,
        drawActions.areaTriangle,
        drawActions.areaCone
    ]);
    drawDropContent.appendChild(createDrawLink(drawActions.text));


    // ⛰️ 지형 프로파일링: Floor.png 버튼을 누른 후 지도에서 시작점/끝점을 선택합니다.
    let terrainProfileDialog = null;
    let terrainProfileActive = false;
    let terrainProfileEntities = [];
    let terrainProfileButton = null;

    function clearTerrainProfileEntities() {
        terrainProfileEntities.forEach(entity => viewer.entities.remove(entity));
        terrainProfileEntities = [];
    }

    async function resolveTerrainPoint(event) {
        const rect = viewer.canvas.getBoundingClientRect();
        const screenPosition = new Cesium.Cartesian2(
            event.clientX - rect.left,
            event.clientY - rect.top
        );

        let cartesian;
        if (viewer.scene.pickPositionSupported) {
            cartesian = viewer.scene.pickPosition(screenPosition);
        }
        if (!Cesium.defined(cartesian)) {
            const ray = viewer.camera.getPickRay(screenPosition);
            cartesian = ray && viewer.scene.globe.pick(ray, viewer.scene);
        }
        if (!Cesium.defined(cartesian)) return null;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        return {
            lon: Cesium.Math.toDegrees(cartographic.longitude),
            lat: Cesium.Math.toDegrees(cartographic.latitude),
            elevation: cartographic.height
        };
    }

    async function createTerrainSamples(start, end) {
        const sampleCount = 100;
        const startPosition = Cesium.Cartographic.fromDegrees(start.lon, start.lat);
        const endPosition = Cesium.Cartographic.fromDegrees(end.lon, end.lat);
        const geodesic = new Cesium.EllipsoidGeodesic(startPosition, endPosition);
        const positions = Array.from({ length: sampleCount }, (_, index) =>
            geodesic.interpolateUsingFraction(index / (sampleCount - 1))
        );
        const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);

        return sampled.map((position, index) => ({
            distance: geodesic.surfaceDistance * index / (sampleCount - 1),
            elevation: Number.isFinite(position.height) ? position.height : 0,
            lon: Cesium.Math.toDegrees(position.longitude),
            lat: Cesium.Math.toDegrees(position.latitude)
        }));
    }

    function stopTerrainProfiling() {
        terrainProfileActive = false;
        terrainProfileDialog?.disablePointSelection();
        terrainProfileButton?.classList.remove('profile-active');
        terrainProfileButton?.setAttribute('data-tooltip', '⛰️ 지형 프로파일링');
        viewer.canvas.style.cursor = '';
    }

    terrainProfileButton = createIconButton('⛰️ 지형 프로파일링', 'Floor', () => {
        if (terrainProfileActive) {
            stopTerrainProfiling();
            return;
        }
        if (!window.TerrainProfileDialog) {
            console.error('TerrainProfileDialog가 없습니다. D3와 script/terrainProfile.js를 menu.js보다 먼저 로드하세요.');
            alert('지형 프로파일링 스크립트를 불러오지 못했습니다.');
            return;
        }

        if (!terrainProfileDialog) {
            terrainProfileDialog = new window.TerrainProfileDialog({
                title: '지형 프로파일링',
                onClose: () => {
                    clearTerrainProfileEntities();
                    stopTerrainProfiling();
                    viewer.scene.requestRender();
                }
            });
        }
        clearTerrainProfileEntities();
        terrainProfileActive = true;
        terrainProfileButton.classList.add('profile-active');
        terrainProfileButton.setAttribute('data-tooltip', '지도에서 시작점을 클릭하세요');
        viewer.canvas.style.cursor = 'crosshair';

        terrainProfileDialog.enablePointSelection(viewer.canvas, {
            pointResolver: resolveTerrainPoint,
            profileProvider: createTerrainSamples,
            resetAfterComplete: false,
            onPoint: (point, index) => {
                terrainProfileButton.setAttribute(
                    'data-tooltip',
                    index === 1 ? '지도에서 끝점을 클릭하세요' : '프로파일 생성 중…'
                );
                const marker = viewer.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, Math.max(0, point.elevation || 0)),
                    point: {
                        pixelSize: 11,
                        color: index === 1 ? Cesium.Color.LIME : Cesium.Color.ORANGE,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                terrainProfileEntities.push(marker);
            },
            onComplete: ({ start, end }) => {
                terrainProfileEntities.push(viewer.entities.add({
                    polyline: {
                        positions: Cesium.Cartesian3.fromDegreesArray([
                            start.lon, start.lat, end.lon, end.lat
                        ]),
                        width: 3,
                        material: Cesium.Color.CYAN,
                        clampToGround: true
                    }
                }));
                stopTerrainProfiling();
            }
        });
    });

    // 좌표변환 다이얼로그 (Degree/DMS 입력 -> DMS, UTM, MGRS, GEOREF)
    createIconButton('🌐 좌표 변환', 'Transform', () => {
        if (window.CoordinateDialog && typeof window.CoordinateDialog.toggle === 'function') {
            window.CoordinateDialog.toggle();
        } else {
            console.warn('CoordinateDialog 스크립트가 로드되지 않았습니다.');
        }
    });

    // 환경 설정 (Base Map, GPS, 화면 설정)
    createIconButton('⚙️ 설정', 'settings', () => {
        if (window.SettingDialog && typeof window.SettingDialog.toggle === 'function') {
            window.SettingDialog.toggle();
        } else {
            console.warn('SettingDialog 스크립트가 로드되지 않았습니다.');
        }
    });

    // 💡 지도 레이어를 제외한 모든 엔티티, 측정선, 군대부호, 그리기 객체를 삭제하고 모듈을 초기화합니다.
    createIconButton('🔄 초기화', 'refresh', () => {
        clearDrawingHistory();
        // 활성화된 그리기/편집 이벤트를 먼저 끊어 삭제 후 지도 클릭으로 다시 그려지지 않게 한다.
        deactivateAllDrawActions();
        stopTerrainProfiling();
        clearTerrainProfileEntities();
        window.AreaStylePanel?.close?.();

        // Cesium Viewer 기본 엔티티 & 데이터소스 전체 삭제
        if (viewer) {
            viewer.selectedEntity = undefined;
            viewer.trackedEntity = undefined;
            viewer.entities.removeAll();
            viewer.dataSources.removeAll();
        }

        // 외부 모듈별 리셋 및 삭제 함수 실행 (선택적 초기화)
        // [그리기 도구]
        if (window.PolygonDrawing?.reset) window.PolygonDrawing.reset();
        if (window.PolylineDrawing?.reset) window.PolylineDrawing.reset();
        if (window.circleDrawing?.reset) window.circleDrawing.reset();
        if (window.lineDrawing?.reset) window.lineDrawing.reset();
        if (window.TextDrawing?.reset) window.TextDrawing.reset();
        deactivateCustomDrawing();
        customDrawingEntities.splice(0).forEach(entity => viewer.entities.remove(entity));
        ['RectangleDrawing', 'PentagonDrawing', 'HexagonDrawing', 'StarDrawing',
         'DiamondDrawing', 'RoundedRectangleDrawing', 'ArcDrawing', 'TriangleDrawing',
         'ParallelogramDrawing', 'TrapezoidDrawing', 'ConeDrawing']
            .forEach(name => window[name]?.reset?.());

        // [측정 및 가시선 도구]
        if (window.distance?.clear) window.distance.clear();
        if (window.measure?.clear) window.measure.clear();
        if (window.drawSightViewLine?.clear) window.drawSightViewLine.clear();

        // [군대부호 및 관제 패널]
        if (window.unifiedControlPanel && typeof window.unifiedControlPanel.reset === 'function') {
            window.unifiedControlPanel.reset();
        }

        // [대탄도탄 작전 모듈 (도원, 레이다, 경로 등)]
        if (window.domeDrawing?.reset) window.domeDrawing.reset();
        if (window.radar?.reset) window.radar.reset();
        if (window.curve?.reset) window.curve.reset();
        if (window.airpath?.reset) window.airpath.reset();
        if (window.particle?.reset) window.particle.reset();
        if (window.pullup?.reset) window.pullup.reset();
        if (window.airspace?.clear) window.airspace.clear();
        if (window.airspace?.hidePanel) window.airspace.hidePanel();

        // [빌보드 모듈]
        if (window.billboard?.removeAll) window.billboard.removeAll();

        // 일부 레거시 reset 함수가 내부 입력 이벤트를 다시 등록하므로 마지막에 한 번 더 해제한다.
        deactivateAllDrawActions();
        deactivateCustomDrawing();
        viewer.canvas.style.cursor = 'default';
        viewer.scene.screenSpaceCameraController.enableInputs = true;

        // 씬(Scene) 재요청으로 화면 갱신
        if (viewer && viewer.scene) {
            viewer.scene.requestRender();
        }

        console.log(" 지도 타일 레이어를 제외한 모든 화면 객체가 성공적으로 삭제되었습니다.");
    }, 'btn-reset');


    // ==========================================
    // 🖱️ 메뉴 마우스 드래그 이동 기능 로직 구현
    // ==========================================
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    menu.addEventListener('mousedown', function(e) {
        const isClickableElement = e.target.closest('button') || 
                                   e.target.closest('.dropdown-content') ||
                                   e.target.tagName === 'IMG';
        if (isClickableElement) return;

        isDragging = true;
        viewer.scene.screenSpaceCameraController.enableInputs = false;

        offsetX = e.clientX - menu.getBoundingClientRect().left;
        offsetY = e.clientY - menu.getBoundingClientRect().top;

        // 초기 중앙 정렬용 transform을 해제한 뒤 드래그 좌표를 적용합니다.
        const menuRect = menu.getBoundingClientRect();
        menu.style.transform = 'none';
        menu.style.left = `${menuRect.left}px`;
        menu.style.top = `${menuRect.top}px`;
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        const maxX = window.innerWidth - menu.offsetWidth;
        const maxY = window.innerHeight - menu.offsetHeight;

        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            viewer.scene.screenSpaceCameraController.enableInputs = true;
        }
    });

})();
