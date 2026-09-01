
//////////////////////////////////////////////////////////////////////////
// CesiumJS 텍스트 설정/편집 및 지도 배치 도구
//////////////////////////////////////////////////////////////////////////

(function (global) {
    'use strict';

    const DIALOG_ID = 'text-drawing-dialog';
    const STYLE_ID = 'text-drawing-style';
    let viewer = null;
    let dialog = null;
    let handler = null;
    let active = false;
    let editingEntity = null;
    let selectionBoundViewer = null;
    let draftContent = '';
    let contentEditor = null;
    let selectionBox = null;
    let selectedTextEntity = null;
    let suppressContentEditor = false;
    let textInteractionHandler = null;
    let keyboardBound = false;
    let draggingText = null;
    let dragStartScreen = null;
    let dragMoved = false;
    let dragLastPosition = null;
    const createdEntities = [];

    function getViewer() {
        return global.CesiumViewer || global.viewer || null;
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${DIALOG_ID} {
                --td-accent:#38bdf8; --td-accent-strong:#0ea5e9; --td-border:rgba(148,163,184,.22);
                position:fixed; left:24px; top:72px; z-index:2200; width:340px;
                padding:0; overflow:hidden; color:#e8f2f7;
                background:linear-gradient(145deg,rgba(16,34,46,.97),rgba(8,22,32,.98));
                border:1px solid rgba(125,211,252,.26); border-radius:18px;
                box-shadow:0 24px 70px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.035) inset;
                backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
                font:12px/1.4 "Pretendard","Noto Sans KR","Malgun Gothic",Arial,sans-serif;
                box-sizing:border-box; user-select:none;
            }
            #${DIALOG_ID}[hidden] { display: none; }
            #${DIALOG_ID} * { box-sizing: border-box; }
            #${DIALOG_ID} .td-titlebar { display:flex; align-items:center; justify-content:space-between; padding:11px 13px; cursor:move; border-bottom:1px solid var(--td-border); background:linear-gradient(90deg,rgba(14,165,233,.14),transparent 70%); }
            #${DIALOG_ID} .td-heading { display:flex; align-items:center; gap:8px; }
            #${DIALOG_ID} .td-title-icon { display:grid; place-items:center; width:29px; height:29px; border-radius:8px; color:#fff; font-size:15px; background:linear-gradient(135deg,#38bdf8,#2563eb); box-shadow:0 6px 16px rgba(14,165,233,.28); }
            #${DIALOG_ID} .td-title { font-size:14px; line-height:1.2; font-weight:750; letter-spacing:-.2px; }
            #${DIALOG_ID} .td-subtitle { margin-top:2px; color:#91a8b8; font-size:9px; }
            #${DIALOG_ID} .td-close { display:grid; place-items:center; width:26px; height:26px; border:1px solid transparent; border-radius:7px; background:rgba(255,255,255,.035); color:#9fb2bf; font-size:18px; line-height:1; cursor:pointer; transition:.18s ease; }
            #${DIALOG_ID} .td-close:hover { color:#fff; border-color:rgba(248,113,113,.35); background:rgba(239,68,68,.16); transform:rotate(4deg); }
            #${DIALOG_ID} .td-body { padding:11px 13px 13px; max-height:calc(100vh - 125px); overflow:auto; scrollbar-width:thin; scrollbar-color:#355568 transparent; }
            #${DIALOG_ID} .td-row { display:grid; grid-template-columns:74px 1fr; align-items:center; gap:8px; margin:0 0 8px; }
            #${DIALOG_ID} label { color:#bdccd6; font-weight:600; font-size:10px; }
            #${DIALOG_ID} .td-coordinates { display:grid; grid-template-columns:auto 1fr auto 1fr; align-items:center; gap:5px; margin:3px 0 10px; padding:8px; border:1px solid var(--td-border); border-radius:8px; background:rgba(2,12,20,.25); }
            #${DIALOG_ID} input, #${DIALOG_ID} select, #${DIALOG_ID} textarea, #${DIALOG_ID} button { font:inherit; }
            #${DIALOG_ID} input, #${DIALOG_ID} select, #${DIALOG_ID} textarea {
                width:100%; min-width:0; border:1px solid rgba(148,163,184,.2); border-radius:9px;
                outline:none; background:rgba(2,12,20,.52); color:#f1f7fa; padding:6px 8px; transition:border-color .18s,box-shadow .18s,background .18s;
            }
            #${DIALOG_ID} input::placeholder,#${DIALOG_ID} textarea::placeholder { color:#60798a; }
            #${DIALOG_ID} input:focus,#${DIALOG_ID} select:focus,#${DIALOG_ID} textarea:focus { border-color:var(--td-accent); background:rgba(7,25,36,.82); box-shadow:0 0 0 3px rgba(56,189,248,.12); }
            #${DIALOG_ID} select { height:30px; color-scheme:dark; }
            #${DIALOG_ID} input[type="color"] { width:36px; height:27px; justify-self:end; padding:2px; border-radius:6px; cursor:pointer; }
            #${DIALOG_ID} input[type="checkbox"] { appearance:auto; width:15px; height:15px; justify-self:end; padding:0; border:0; border-radius:2px; accent-color:#0ea5e9; cursor:pointer; }
            #${DIALOG_ID} input[type="range"] { padding:0; border:0; height:4px; accent-color:var(--td-accent); background:#294454; cursor:pointer; }
            #${DIALOG_ID} fieldset { border:1px solid var(--td-border); border-radius:9px; padding:10px 9px 9px; margin:0 0 9px; background:rgba(2,12,20,.22); }
            #${DIALOG_ID} legend { color:#d9e7ed; padding:0 8px; font-size:12px; font-weight:700; letter-spacing:.3px; }
            #${DIALOG_ID} .td-option-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px 10px; }
            #${DIALOG_ID} .td-option { display:grid; grid-template-columns:1fr 54px; align-items:center; gap:5px; min-height:27px; }
            #${DIALOG_ID} .td-option-wide { grid-column:1 / -1; grid-template-columns:82px 1fr; }
            #${DIALOG_ID} .td-alpha-row { grid-template-columns:82px auto 1fr; }
            #${DIALOG_ID} #td-alpha-value { color:#7dd3fc; font-size:11px; font-weight:700; }
            #${DIALOG_ID} .td-actions { display:grid; grid-template-columns:1fr; gap:8px; margin-top:10px; }
            #${DIALOG_ID} .td-actions button { min-height:32px; padding:6px 5px; border:1px solid var(--td-border); border-radius:7px; color:#cbd9e1; background:rgba(255,255,255,.045); cursor:pointer; font-weight:700; font-size:10px; transition:.18s ease; }
            #${DIALOG_ID} .td-actions button:hover { transform:translateY(-1px); color:#fff; border-color:rgba(125,211,252,.42); background:rgba(56,189,248,.12); box-shadow:0 7px 18px rgba(0,0,0,.18); }
            #${DIALOG_ID} #td-apply { border-color:rgba(56,189,248,.35); color:#fff; background:linear-gradient(135deg,#0ea5e9,#2563eb); box-shadow:0 7px 18px rgba(14,165,233,.2); }
            #${DIALOG_ID} .td-status { display:flex; align-items:flex-start; gap:5px; margin-top:8px; min-height:15px; padding:6px 7px; border-radius:6px; color:#91b3c5; background:rgba(2,12,20,.3); font-size:9px; }
            #${DIALOG_ID} .td-status::before { content:"●"; color:#38bdf8; font-size:8px; margin-top:3px; }
            #${DIALOG_ID}.td-create-mode .td-edit-only { display:none !important; }
            #${DIALOG_ID}.td-create-mode .td-actions { grid-template-columns:1fr; }
            .td-map-editor { position:absolute; z-index:2147483100; display:inline-block; width:max-content; min-width:20px; max-width:420px; min-height:1.35em; padding:2px 4px; transform:translate(0,-100%); border:1px dashed rgba(56,189,248,.8); outline:none; background:rgba(15,23,42,.2); color:#fff; caret-color:#facc15; white-space:pre-wrap; overflow-wrap:anywhere; box-shadow:0 0 0 2px rgba(56,189,248,.12); box-sizing:border-box; user-select:text; }
            .td-map-editor:empty::before { content:"텍스트 입력"; color:rgba(226,232,240,.55); pointer-events:none; }
            .td-map-editor:focus { border-color:#facc15; box-shadow:0 0 8px rgba(250,204,21,.55); }
            .td-selection-box { position:absolute; z-index:2147483000; display:none; pointer-events:none; border:2px dashed #facc15; background:rgba(250,204,21,.06); box-shadow:0 0 9px rgba(250,204,21,.72); box-sizing:border-box; }
            @media (max-width: 620px) {
                #${DIALOG_ID} { left:10px; top:10px; width:calc(100vw - 20px); }
                #${DIALOG_ID} .td-body { max-height:calc(100vh - 92px); }
                #${DIALOG_ID} .td-option-grid { grid-template-columns:1fr; }
                #${DIALOG_ID} .td-option-wide { grid-column:1; }
            }
        `;
        document.head.appendChild(style);
    }

    function createDialog() {
        if (dialog) return dialog;
        injectStyle();
        dialog = document.createElement('section');
        dialog.id = DIALOG_ID;
        dialog.hidden = true;
        dialog.innerHTML = `
            <div class="td-titlebar">
                <div class="td-heading"><div class="td-title-icon">T</div><div><div class="td-title">텍스트 설정/편집</div><div class="td-subtitle">지도 위에 텍스트를 배치하고 꾸며보세요</div></div></div>
                <button class="td-close" type="button" aria-label="닫기">×</button>
            </div>
            <div class="td-body">
            <div class="td-row"><label for="td-name">텍스트 이름</label><input id="td-name" type="text" placeholder="텍스트 이름"></div>
            <div class="td-row td-edit-only"><label for="td-direction">텍스트 방향</label><select id="td-direction"><option value="horizontal">가로쓰기</option><option value="vertical">세로쓰기</option></select></div>
            <div class="td-row td-edit-only"><label for="td-rotation">회전(°)</label><input id="td-rotation" type="number" min="-360" max="360" step="0.1" value="0"></div>
            <div class="td-coordinates td-edit-only"><label for="td-lon">경도</label><input id="td-lon" type="number" step="any" placeholder="경도"><label for="td-lat">위도</label><input id="td-lat" type="number" step="any" placeholder="위도"></div>
            <fieldset class="td-edit-only">
                <legend>옵션</legend>
                <div class="td-option-grid">
                    <label class="td-option td-option-wide">폰트<select id="td-font"><option>Arial</option><option>Malgun Gothic</option><option>sans-serif</option><option>serif</option><option>monospace</option></select></label>
                    <label class="td-option">폰트크기<input id="td-size" type="number" min="8" max="200" value="28"></label>
                    <label class="td-option">폰트색<input id="td-color" type="color" value="#ffffff"></label>
                    <label class="td-option" title="텍스트 박스의 테두리 선을 표시합니다.">선<input id="td-outline" type="checkbox"></label>
                    <label class="td-option">선색<input id="td-outline-color" type="color" value="#000000"></label>
                    <label class="td-option" title="텍스트 박스의 배경 면을 채웁니다.">면<input id="td-background" type="checkbox"></label>
                    <label class="td-option">면색<input id="td-background-color" type="color" value="#000000"></label>
                    <label class="td-option td-option-wide td-alpha-row">투명도 <span id="td-alpha-value">100%</span><input id="td-alpha" type="range" min="0" max="100" value="100"></label>
                </div>
            </fieldset>
            <div class="td-actions"><button id="td-apply" type="button">적용</button></div>
            <div id="td-status" class="td-status" role="status" aria-live="polite">지도에 배치 버튼을 누른 뒤 지도를 클릭하세요.</div>
            </div>
        `;
        document.body.appendChild(dialog);

        dialog.querySelector('.td-close').addEventListener('click', close);
        dialog.querySelector('#td-alpha').addEventListener('input', event => {
            dialog.querySelector('#td-alpha-value').textContent = `${event.target.value}%`;
        });
        dialog.querySelector('#td-apply').addEventListener('click', applyCurrentMode);
        makeDraggable(dialog, dialog.querySelector('.td-titlebar'));
        return dialog;
    }

    function makeDraggable(element, handle) {
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;
        handle.addEventListener('mousedown', event => {
            if (event.target.closest('button')) return;
            dragging = true;
            const rect = element.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            event.preventDefault();
        });
        document.addEventListener('mousemove', event => {
            if (!dragging) return;
            const left = Math.max(0, Math.min(event.clientX - offsetX, innerWidth - element.offsetWidth));
            const top = Math.max(0, Math.min(event.clientY - offsetY, innerHeight - element.offsetHeight));
            element.style.left = `${left}px`;
            element.style.top = `${top}px`;
        });
        document.addEventListener('mouseup', () => { dragging = false; });
    }

    function value(id) {
        return dialog.querySelector(`#${id}`);
    }

    function status(message) {
        const statusElement = value('td-status') || dialog?.querySelector('.td-status');
        if (statusElement) statusElement.textContent = message;
    }

    function setCreateMode() {
        createDialog().classList.add('td-create-mode');
        dialog.querySelector('.td-title').textContent = '텍스트 그리기';
        dialog.querySelector('.td-subtitle').textContent = '이름을 입력하고 지도에 한 번 배치하세요';
        value('td-apply').textContent = '적용';
    }

    function setEditMode() {
        createDialog().classList.remove('td-create-mode');
        dialog.querySelector('.td-title').textContent = '텍스트 설정/편집';
        dialog.querySelector('.td-subtitle').textContent = '텍스트와 텍스트 박스 스타일을 편집하세요';
        value('td-apply').textContent = '적용';
    }

    function getText() {
        const raw = draftContent || value('td-name').value || '텍스트';
        return value('td-direction').value === 'vertical'
            ? raw.split('\n').map(line => Array.from(line).join('\n')).join('\n')
            : raw;
    }

    function readFormSettings() {
        return {
            name: value('td-name').value.trim() || '텍스트',
            content: draftContent,
            direction: value('td-direction').value,
            rotation: Math.max(-360, Math.min(360, Number(value('td-rotation').value) || 0)),
            font: value('td-font').value,
            size: Number(value('td-size').value) || 28,
            color: value('td-color').value,
            outline: value('td-outline').checked,
            outlineColor: value('td-outline-color').value,
            background: value('td-background').checked,
            backgroundColor: value('td-background-color').value,
            alpha: Number(value('td-alpha').value) || 0
        };
    }

    function loadFormSettings(settings) {
        value('td-name').value = settings.name || '텍스트';
        draftContent = settings.content || '';
        value('td-direction').value = settings.direction || 'horizontal';
        value('td-rotation').value = Math.max(-360, Math.min(360, Number(settings.rotation) || 0));
        value('td-font').value = settings.font || 'Arial';
        value('td-size').value = settings.size || 28;
        value('td-color').value = settings.color || '#ffffff';
        value('td-outline').checked = settings.outline !== false;
        value('td-outline-color').value = settings.outlineColor || '#000000';
        value('td-background').checked = settings.background === true;
        value('td-background-color').value = settings.backgroundColor || '#000000';
        value('td-alpha').value = Number.isFinite(Number(settings.alpha)) ? settings.alpha : 100;
        value('td-alpha-value').textContent = `${value('td-alpha').value}%`;
    }

    function positionOf(entity) {
        if (!viewer || !global.Cesium || !entity?.position) return null;
        const time = viewer.clock?.currentTime || global.Cesium.JulianDate.now();
        const cartesian = entity.position.getValue ? entity.position.getValue(time) : entity.position;
        if (!global.Cesium.defined(cartesian)) return null;
        const cartographic = global.Cesium.Cartographic.fromCartesian(cartesian);
        return {
            longitude: global.Cesium.Math.toDegrees(cartographic.longitude),
            latitude: global.Cesium.Math.toDegrees(cartographic.latitude)
        };
    }

    function screenPositionOf(entity) {
        if (!viewer || !global.Cesium || !entity?.position) return null;
        const time = viewer.clock?.currentTime || global.Cesium.JulianDate.now();
        const cartesian = entity.position.getValue ? entity.position.getValue(time) : entity.position;
        if (!global.Cesium.defined(cartesian)) return null;
        return global.Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian);
    }

    function removeContentEditor() {
        contentEditor?.remove();
        contentEditor = null;
    }

    function showContentEditor(screenPosition, initialText, onSave) {
        removeContentEditor();
        if (!viewer || !screenPosition) return;
        contentEditor = document.createElement('div');
        contentEditor.className = 'td-map-editor';
        contentEditor.contentEditable = 'true';
        contentEditor.setAttribute('role', 'textbox');
        contentEditor.setAttribute('aria-label', '텍스트 내용');
        contentEditor.spellcheck = false;
        contentEditor.textContent = initialText || '';
        const settings = readFormSettings();
        contentEditor.style.font = `${settings.size}px "${settings.font}"`;
        contentEditor.style.color = settings.color;
        viewer.container.appendChild(contentEditor);
        contentEditor.style.left = `${Math.max(8, Math.min(screenPosition.x, viewer.container.clientWidth - 8))}px`;
        contentEditor.style.top = `${Math.max(8, Math.min(screenPosition.y, viewer.container.clientHeight - 8))}px`;
        let finished = false;
        const finish = save => {
            if (finished) return;
            finished = true;
            const text = contentEditor?.innerText.replace(/\n$/, '').trim() || '';
            removeContentEditor();
            if (save && text) onSave(text);
        };
        contentEditor.addEventListener('mousedown', event => event.stopPropagation());
        contentEditor.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                finish(true);
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            }
        });
        contentEditor.addEventListener('blur', () => finish(true));
        window.setTimeout(() => {
            if (!contentEditor) return;
            contentEditor.focus();
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(contentEditor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }, 0);
    }

    function ensureSelectionBox() {
        if (!viewer || selectionBox?.isConnected) return;
        selectionBox = document.createElement('div');
        selectionBox.className = 'td-selection-box';
        viewer.container.appendChild(selectionBox);
    }

    function updateSelectionBox() {
        ensureSelectionBox();
        if (!selectionBox || !selectedTextEntity || selectedTextEntity.show === false || viewer?.selectedEntity !== selectedTextEntity) {
            if (selectionBox) selectionBox.style.display = 'none';
            return;
        }
        const screen = screenPositionOf(selectedTextEntity);
        if (!screen) {
            selectionBox.style.display = 'none';
            return;
        }
        const dimensions = selectedTextEntity.customData?.textBoxDimensions || { width: 80, height: 40 };
        const scaleProperty = selectedTextEntity.billboard?.scale;
        const time = viewer.clock?.currentTime || global.Cesium.JulianDate.now();
        const scale = Number(scaleProperty?.getValue ? scaleProperty.getValue(time) : scaleProperty) || 1;
        const width = dimensions.width * scale;
        const height = dimensions.height * scale;
        selectionBox.style.display = 'block';
        selectionBox.style.left = `${screen.x - 6}px`;
        selectionBox.style.top = `${screen.y - height - 6}px`;
        selectionBox.style.width = `${width + 12}px`;
        selectionBox.style.height = `${height + 12}px`;
    }

    function editSelectedText(entity, openEditor = true) {
        if (!entity?.customData?.textDrawing) return;
        deactivateHandler();
        editingEntity = entity;
        createDialog().hidden = false;
        setEditMode();
        loadFormSettings(entity.customData.textSettings || { name: entity.name });
        const position = positionOf(entity);
        if (position) {
            value('td-lon').value = position.longitude.toFixed(6);
            value('td-lat').value = position.latitude.toFixed(6);
        }
        value('td-apply').textContent = '적용';
        status(`'${entity.name || '텍스트'}' 선택됨 — 옵션을 변경한 뒤 적용하세요.`);
        updateSelectionBox();
        if (openEditor) {
            window.setTimeout(() => showContentEditor(
                screenPositionOf(entity),
                entity.customData?.textSettings?.content || '',
                text => {
                    draftContent = text;
                    const position = positionOf(entity);
                    if (position) addOrUpdate(position.longitude, position.latitude, 0);
                }
            ), 0);
        }
    }

    function bindTextSelection() {
        viewer = getViewer();
        if (!viewer || selectionBoundViewer === viewer) return;
        selectionBoundViewer = viewer;
        ensureSelectionBox();
        viewer.selectedEntityChanged.addEventListener(entity => {
            selectedTextEntity = entity?.customData?.textDrawing ? entity : null;
            removeContentEditor();
            if (selectedTextEntity) {
                editingEntity = selectedTextEntity;
                status(`'${selectedTextEntity.name || '텍스트'}' 선택됨 — Delete: 삭제, 더블클릭: 편집`);
            } else if (!dialog?.hidden) {
                editingEntity = null;
            }
            suppressContentEditor = false;
            updateSelectionBox();
        });
        viewer.scene.preRender.addEventListener(updateSelectionBox);
        viewer.screenSpaceEventHandler?.removeInputAction(global.Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        if (textInteractionHandler && !textInteractionHandler.isDestroyed()) textInteractionHandler.destroy();
        textInteractionHandler = new global.Cesium.ScreenSpaceEventHandler(viewer.canvas);
        textInteractionHandler.setInputAction(event => {
            const picked = viewer.scene.pick(event.position);
            const entity = picked?.id;
            if (!entity?.customData?.textDrawing || entity !== selectedTextEntity) return;
            draggingText = entity;
            dragStartScreen = global.Cesium.Cartesian2.clone(event.position);
            dragMoved = false;
            dragLastPosition = null;
            viewer.scene.screenSpaceCameraController.enableInputs = false;
            viewer.canvas.style.cursor = 'grabbing';
        }, global.Cesium.ScreenSpaceEventType.LEFT_DOWN);
        textInteractionHandler.setInputAction(event => {
            if (!draggingText || !dragStartScreen) return;
            const dx = event.endPosition.x - dragStartScreen.x;
            const dy = event.endPosition.y - dragStartScreen.y;
            if (!dragMoved && Math.hypot(dx, dy) < 3) return;
            const cartesian = pickPosition(event.endPosition);
            if (!global.Cesium.defined(cartesian)) return;
            dragMoved = true;
            dragLastPosition = cartesian;
            draggingText.position = cartesian;
            viewer.scene.requestRender();
            updateSelectionBox();
        }, global.Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        textInteractionHandler.setInputAction(() => {
            if (!draggingText) return;
            const movedEntity = draggingText;
            draggingText = null;
            dragStartScreen = null;
            viewer.scene.screenSpaceCameraController.enableInputs = true;
            viewer.canvas.style.cursor = '';
            if (!dragMoved || !global.Cesium.defined(dragLastPosition)) {
                dragMoved = false;
                dragLastPosition = null;
                return;
            }
            const cartographic = global.Cesium.Cartographic.fromCartesian(dragLastPosition);
            const lon = global.Cesium.Math.toDegrees(cartographic.longitude);
            const lat = global.Cesium.Math.toDegrees(cartographic.latitude);
            if (dialog) {
                value('td-lon').value = lon.toFixed(6);
                value('td-lat').value = lat.toFixed(6);
            }
            dragMoved = false;
            dragLastPosition = null;
            global.__suppressDrawingSelectionUntil = performance.now() + 250;
            document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity: movedEntity } }));
            viewer.scene.requestRender();
            status(`텍스트 위치가 이동되었습니다. (${lon.toFixed(6)}, ${lat.toFixed(6)})`);
        }, global.Cesium.ScreenSpaceEventType.LEFT_UP);
        textInteractionHandler.setInputAction(event => {
            const picked = viewer.scene.pick(event.position);
            const entity = picked?.id;
            if (!entity?.customData?.textDrawing) return;
            const group = entity.customData?.groupEntity;
            if (group && viewer.entities.contains(group)) {
                viewer.selectedEntity = group;
                return;
            }
            viewer.selectedEntity = entity;
            selectedTextEntity = entity;
            editSelectedText(entity, true);
        }, global.Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        if (!keyboardBound) {
            keyboardBound = true;
            document.addEventListener('keydown', event => {
                if (event.key !== 'Delete' && event.key !== 'Del') return;
                const target = event.target;
                if (target?.matches?.('input, textarea, select') || target?.isContentEditable) return;
                if (!selectedTextEntity || !viewer?.entities?.contains(selectedTextEntity)) return;
                event.preventDefault();
                editingEntity = selectedTextEntity;
                removeSelected();
            });
        }
    }

    function buildBillboard() {
        const Cesium = global.Cesium;
        const alpha = Number(value('td-alpha').value) / 100;
        const hasBorder = value('td-outline').checked;
        const hasFill = value('td-background').checked;
        const fontSize = Number(value('td-size').value) || 28;
        const fontFamily = value('td-font').value;
        const lines = getText().split('\n');
        const padding = 10;
        const borderWidth = hasBorder ? 2 : 0;
        const measureCanvas = document.createElement('canvas');
        const measureContext = measureCanvas.getContext('2d');
        measureContext.font = `${fontSize}px "${fontFamily}"`;
        const textWidth = Math.max(1, ...lines.map(line => measureContext.measureText(line || ' ').width));
        const lineHeight = Math.ceil(fontSize * 1.25);
        const width = Math.ceil(textWidth + padding * 2 + borderWidth * 2);
        const height = Math.ceil(lines.length * lineHeight + padding * 2 + borderWidth * 2);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(2, width);
        canvas.height = Math.max(2, height);
        const context = canvas.getContext('2d');
        context.globalAlpha = alpha;
        if (hasFill) {
            context.fillStyle = value('td-background-color').value;
            context.fillRect(borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth);
        }
        if (hasBorder) {
            context.strokeStyle = value('td-outline-color').value;
            context.lineWidth = borderWidth;
            context.strokeRect(1, 1, width - 2, height - 2);
        }
        context.font = `${fontSize}px "${fontFamily}"`;
        context.fillStyle = value('td-color').value;
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        lines.forEach((line, index) => context.fillText(line, padding + borderWidth, padding + borderWidth + lineHeight * (index + .5)));
        return { graphic: {
            image: canvas,
            rotation: -Cesium.Math.toRadians(Math.max(-360, Math.min(360, Number(value('td-rotation').value) || 0))),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }, dimensions: { width, height } };
    }

    function addOrUpdate(lon, lat, height) {
        if (!global.Cesium || !viewer) return;
        const isNew = !editingEntity;
        const settings = readFormSettings();
        const billboard = buildBillboard();
        const position = global.Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(0, height || 0));
        if (editingEntity) {
            editingEntity.name = settings.name;
            editingEntity.position = position;
            editingEntity.label = undefined;
            editingEntity.billboard = billboard.graphic;
            editingEntity.customData = Object.assign({}, editingEntity.customData, {
                drawingType: 'text',
                textDrawing: true,
                textSettings: settings,
                textBoxDimensions: billboard.dimensions
            });
        } else {
            editingEntity = viewer.entities.add({
                name: settings.name,
                position,
                billboard: billboard.graphic
            });
            editingEntity.customData = { drawingType: 'text', textDrawing: true, textSettings: settings, textBoxDimensions: billboard.dimensions };
            createdEntities.push(editingEntity);
            document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity: editingEntity } }));
        }
        suppressContentEditor = true;
        viewer.selectedEntity = editingEntity;
        suppressContentEditor = false;
        selectedTextEntity = editingEntity;
        viewer.scene.requestRender();
        updateSelectionBox();
        document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity: editingEntity } }));
        value('td-apply').textContent = '적용';
        status(`텍스트가 적용되었습니다. (${lon.toFixed(6)}, ${lat.toFixed(6)})`);
        if (isNew) dialog.hidden = true;
    }

    function pickPosition(screenPosition) {
        const ray = viewer.camera.getPickRay(screenPosition);
        let cartesian = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (!global.Cesium.defined(cartesian)) {
            cartesian = viewer.scene.pickPositionSupported ? viewer.scene.pickPosition(screenPosition) : undefined;
        }
        return cartesian;
    }

    function activatePlacement() {
        viewer = getViewer();
        if (!viewer || !global.Cesium) {
            status('Cesium Viewer를 찾을 수 없습니다.');
            return;
        }
        if (!value('td-name').value.trim()) {
            status('텍스트 이름을 입력하세요.');
            value('td-name').focus();
            return;
        }
        deactivateHandler();
        active = true;
        editingEntity = null;
        value('td-apply').textContent = '적용';
        handler = new global.Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction(click => {
            const cartesian = pickPosition(click.position);
            if (!global.Cesium.defined(cartesian)) return;
            const position = global.Cesium.Cartographic.fromCartesian(cartesian);
            const lon = global.Cesium.Math.toDegrees(position.longitude);
            const lat = global.Cesium.Math.toDegrees(position.latitude);
            value('td-lon').value = lon.toFixed(6);
            value('td-lat').value = lat.toFixed(6);
            deactivateHandler();
            showContentEditor(click.position, '', text => {
                draftContent = text;
                addOrUpdate(lon, lat, position.height);
            });
            status('클릭 위치에서 바로 입력하세요. Enter: 완료, Shift+Enter: 줄바꿈, Esc: 취소');
        }, global.Cesium.ScreenSpaceEventType.LEFT_CLICK);
        status('텍스트를 배치할 지도 위치를 클릭하세요.');
    }

    function applyAtCoordinates() {
        viewer = getViewer();
        const lonText = value('td-lon').value.trim();
        const latText = value('td-lat').value.trim();
        const lon = Number(lonText);
        const lat = Number(latText);
        if (!viewer || !global.Cesium) {
            status('Cesium Viewer를 찾을 수 없습니다.');
            return;
        }
        if (!lonText || !latText || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
            status('올바른 경도(-180~180)와 위도(-90~90)를 입력하세요.');
            return;
        }
        addOrUpdate(lon, lat, 0);
    }

    function applyCurrentMode() {
        if (dialog?.classList.contains('td-create-mode') || !editingEntity) activatePlacement();
        else applyAtCoordinates();
    }

    function removeSelected() {
        if (!viewer || !editingEntity) return status('삭제할 텍스트가 선택되지 않았습니다.');
        viewer.entities.remove(editingEntity);
        document.dispatchEvent(new CustomEvent('drawing-entity-removed', { detail: { entity: editingEntity } }));
        const index = createdEntities.indexOf(editingEntity);
        if (index >= 0) createdEntities.splice(index, 1);
        if (viewer.selectedEntity === editingEntity) viewer.selectedEntity = undefined;
        selectedTextEntity = null;
        editingEntity = null;
        removeContentEditor();
        updateSelectionBox();
        viewer.scene.requestRender();
        status('선택한 텍스트를 삭제했습니다.');
    }

    function deactivateHandler() {
        active = false;
        if (handler && !handler.isDestroyed()) handler.destroy();
        handler = null;
    }

    function open() {
        createDialog().hidden = false;
        viewer = getViewer();
        bindTextSelection();
        deactivateHandler();
        removeContentEditor();
        editingEntity = null;
        draftContent = '';
        value('td-name').value = '';
        value('td-outline').checked = false;
        setCreateMode();
        status('텍스트 이름을 입력하고 지도에 배치 버튼을 누르세요.');
        window.setTimeout(() => value('td-name').focus(), 0);
    }

    function close() {
        deactivateHandler();
        removeContentEditor();
        if (dialog) dialog.hidden = true;
    }

    function toggle() {
        createDialog();
        dialog.hidden ? open() : close();
    }

    function reset() {
        deactivateHandler();
        viewer = getViewer();
        if (viewer) createdEntities.splice(0).forEach(entity => {
            viewer.entities.remove(entity);
            document.dispatchEvent(new CustomEvent('drawing-entity-removed', { detail: { entity } }));
        });
        selectedTextEntity = null;
        editingEntity = null;
        removeContentEditor();
        updateSelectionBox();
    }

    function setRotation(valueInDegrees) {
        const rotation = Math.max(-360, Math.min(360, Number(valueInDegrees) || 0));
        if (dialog) value('td-rotation').value = rotation.toFixed(1);
        if (selectedTextEntity?.customData?.textSettings) selectedTextEntity.customData.textSettings.rotation = rotation;
    }

    global.TextDrawing = {
        open,
        close,
        toggle,
        activate: open,
        deactivate: deactivateHandler,
        setRotation,
        reset,
        isActive: () => active
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindTextSelection, { once: true });
    } else {
        bindTextSelection();
    }
})(typeof window !== 'undefined' ? window : globalThis);
