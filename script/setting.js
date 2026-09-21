/**
 * WebCOP 설정 다이얼로그
 * - Base Map 선택
 * - GPS ON/OFF (기본 OFF)
 * - 영상 명도/채도/색상/투명도 조절
 */
(function (root) {
    "use strict";

    const DIALOG_ID = "webcop-setting-dialog";
    const MENU_ORIENTATION_KEY = "webcop-main-menu-orientation";
    let dialog = null;
    let controls = null;
    let managedBaseLayer = null;

    function injectStyle() {
        if (document.getElementById("webcop-setting-style")) return;
        const style = document.createElement("style");
        style.id = "webcop-setting-style";
        style.textContent = `
            #${DIALOG_ID} {
                --setting-accent: #38bdf8;
                position: fixed;
                top: 105px;
                left: calc(50vw - 175px);
                z-index: 2250;
                width: min(350px, calc(100vw - 16px));
                height: min(500px, calc(100vh - 16px));
                color: #f4f4f5;
                background: linear-gradient(145deg, rgba(44, 47, 52, 0.98), rgba(31, 33, 37, 0.98));
                border: 1px solid rgba(255, 255, 255, 0.13);
                border-radius: 11px;
                box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55);
                font-family: "Malgun Gothic", "Segoe UI", sans-serif;
                overflow: hidden;
                box-sizing: border-box;
            }
            #${DIALOG_ID}[hidden] { display: none; }
            #${DIALOG_ID} [hidden] { display: none !important; }
            #${DIALOG_ID} * { box-sizing: border-box; }
            .webcop-setting-header {
                display: flex;
                align-items: center;
                height: 48px;
                padding: 6px 8px 6px 12px;
                background: rgba(15, 17, 20, 0.36);
                border-bottom: 1px solid rgba(255, 255, 255, 0.13);
                cursor: move;
                user-select: none;
                touch-action: none;
            }
            .webcop-setting-title {
                flex: 1;
                margin: 0;
                font-size: 17px;
                font-weight: 600;
            }
            .webcop-setting-title::before {
                content: '⚙';
                display: inline-grid;
                place-items: center;
                width: 26px;
                height: 26px;
                margin-right: 8px;
                color: var(--setting-accent);
                background: rgba(56, 189, 248, 0.12);
                border: 1px solid rgba(56, 189, 248, 0.28);
                border-radius: 7px;
                vertical-align: middle;
            }
            .webcop-setting-close {
                width: 31px;
                height: 31px;
                padding: 0;
                color: #a1a1aa;
                background: transparent;
                border: 0;
                border-radius: 7px;
                font-size: 23px;
                cursor: pointer;
            }
            .webcop-setting-close:hover { color: #fff; background: rgba(239, 68, 68, 0.72); }
            .webcop-setting-body {
                height: calc(100% - 48px);
                padding: 12px 16px;
                overflow-y: auto;
            }
            .webcop-setting-row {
                display: grid;
                grid-template-columns: 84px minmax(0, 1fr);
                align-items: center;
                gap: 10px;
                min-height: 33px;
                margin-bottom: 7px;
            }
            .webcop-setting-label {
                color: #d4d4d8;
                font-size: 13px;
                font-weight: 600;
                text-align: right;
            }
            .webcop-setting-select {
                width: 100%;
                height: 30px;
                padding: 3px 8px;
                color: #18181b;
                background: #fff;
                border: 1px solid #d4d4d8;
                border-radius: 6px;
                font-size: 12px;
            }
            .webcop-setting-input {
                width: 100%;
                height: 28px;
                padding: 3px 8px;
                color: #18181b;
                background: #fff;
                border: 1px solid #d4d4d8;
                border-radius: 6px;
                font-size: 12px;
            }
            .webcop-setting-input[readonly] { color: #bae6fd; background: #27272a; border-color: #52525b; }
            .webcop-setting-actions { display: flex; flex-wrap: wrap; gap: 7px; margin: 7px 0 2px 94px; }
            .webcop-setting-ws-actions { flex-wrap: nowrap; margin-left: 0; }
            .webcop-setting-ws-actions .webcop-setting-button {
                flex: 1 1 0; min-width: 0; padding: 0 4px; white-space: nowrap;
            }
            .webcop-setting-button {
                min-width: 68px; height: 28px; padding: 0 10px; color: #fff;
                background: #0369a1; border: 1px solid #38bdf8; border-radius: 6px; cursor: pointer;
            }
            .webcop-setting-button.secondary { color: #e4e4e7; background: #3f3f46; border-color: #71717a; }
            .webcop-setting-gps {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                width: fit-content;
                color: #f4f4f5;
                font-size: 13px;
                cursor: pointer;
                user-select: none;
            }
            .webcop-setting-gps input {
                width: 17px;
                height: 17px;
                margin: 0;
                accent-color: var(--setting-accent);
            }
            .webcop-setting-section {
                margin-top: 8px;
                padding: 9px 10px 5px;
                border: 1px solid rgba(255, 255, 255, 0.13);
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.12);
            }
            .webcop-setting-section legend {
                padding: 0 7px;
                color: #e4e4e7;
                font-size: 13px;
                font-weight: 600;
            }
            .webcop-setting-range-row {
                display: grid;
                grid-template-columns: 52px minmax(0, 1fr) 37px;
                align-items: center;
                gap: 7px;
                min-height: 32px;
            }
            .webcop-setting-range-row label { color: #d4d4d8; font-size: 12px; }
            .webcop-setting-range-row input[type="range"] { width: 100%; accent-color: var(--setting-accent); }
            .webcop-setting-value { color: #bae6fd; font: 10px ui-monospace, monospace; text-align: right; }
            .webcop-setting-status {
                min-height: 14px;
                margin: 4px 0 0 94px;
                color: #a1a1aa;
                font-size: 10px;
            }
            @media (max-width: 420px) {
                #${DIALOG_ID} { left: 8px; top: 55px; }
            }
        `;
        document.head.appendChild(style);
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function createRange(labelText, name, min, max, step, value) {
        const row = createElement("div", "webcop-setting-range-row");
        const label = createElement("label", "", labelText);
        const input = document.createElement("input");
        const output = createElement("span", "webcop-setting-value", String(value));
        input.type = "range";
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = value;
        input.dataset.settingName = name;
        label.htmlFor = `setting-${name}`;
        input.id = `setting-${name}`;
        input.addEventListener("input", function () {
            output.textContent = name === "alpha" ? `${input.value}%` : input.value;
            applyScreenSettings();
        });
        row.append(label, input, output);
        return { row, input };
    }

    function createDialog() {
        if (dialog) return dialog;
        injectStyle();

        dialog = createElement("section");
        dialog.id = DIALOG_ID;
        dialog.hidden = true;
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-labelledby", "webcop-setting-title");

        const header = createElement("header", "webcop-setting-header");
        const title = createElement("h2", "webcop-setting-title", "설정");
        title.id = "webcop-setting-title";
        const closeButton = createElement("button", "webcop-setting-close", "×");
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "설정 창 닫기");
        header.append(title, closeButton);

        const body = createElement("div", "webcop-setting-body");
        const baseMapRow = createElement("div", "webcop-setting-row");
        const baseMapLabel = createElement("label", "webcop-setting-label", "Base Map");
        const baseMap = createElement("select", "webcop-setting-select");
        baseMapLabel.htmlFor = "setting-base-map";
        baseMap.id = "setting-base-map";
        [
            ["current", "현재 지도"],
            ["offline", "오프라인 지도"],
            ["offline-color", "오프라인 컬러영상"],
            ["osm", "OpenStreetMap"],
            ["world", "World Imagery"]
        ].forEach(function ([value, label]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            baseMap.appendChild(option);
        });
        baseMapRow.append(baseMapLabel, baseMap);

        const gpsRow = createElement("div", "webcop-setting-row");
        const gpsTitle = createElement("span", "webcop-setting-label", "GPS");
        const gpsLabel = createElement("label", "webcop-setting-gps");
        const gpsCheckbox = document.createElement("input");
        gpsCheckbox.type = "checkbox";
        gpsCheckbox.id = "setting-gps-enabled";
        gpsCheckbox.checked = false;
        gpsLabel.append(gpsCheckbox, document.createTextNode("GPS 사용"));
        gpsRow.append(gpsTitle, gpsLabel);

        const menuOrientationRow = createElement("div", "webcop-setting-row");
        const menuOrientationLabel = createElement("label", "webcop-setting-label", "메인 메뉴");
        const menuOrientation = createElement("select", "webcop-setting-select");
        menuOrientationLabel.htmlFor = "setting-main-menu-orientation";
        menuOrientation.id = "setting-main-menu-orientation";
        [["horizontal", "가로"], ["vertical", "세로"]].forEach(function ([value, label]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            menuOrientation.appendChild(option);
        });
        menuOrientation.value = localStorage.getItem(MENU_ORIENTATION_KEY) === "vertical" ? "vertical" : "horizontal";
        menuOrientationRow.append(menuOrientationLabel, menuOrientation);

        const status = createElement("p", "webcop-setting-status", "GPS 기본 상태: OFF");
        status.setAttribute("role", "status");
        const section = document.createElement("fieldset");
        section.className = "webcop-setting-section";
        section.appendChild(createElement("legend", "", "화면 설정"));
        const brightness = createRange("명도", "brightness", 0.2, 2, 0.05, 1);
        const saturation = createRange("채도", "saturation", 0, 2, 0.05, 1);
        const hue = createRange("색상", "hue", -180, 180, 1, 0);
        const alpha = createRange("투명도", "alpha", 0, 100, 1, 100);
        section.append(brightness.row, saturation.row, hue.row, alpha.row);
        body.append(baseMapRow, gpsRow, menuOrientationRow, status, section);
        dialog.append(header, body);
        document.body.appendChild(dialog);

        controls = {
            baseMap,
            gpsCheckbox,
            menuOrientation,
            brightness: brightness.input,
            saturation: saturation.input,
            hue: hue.input,
            alpha: alpha.input,
            status
        };

        closeButton.addEventListener("click", hide);
        baseMap.addEventListener("change", changeBaseMap);
        gpsCheckbox.addEventListener("change", function () {
            setGpsEnabled(gpsCheckbox.checked);
        });
        menuOrientation.addEventListener("change", function () {
            const orientation = menuOrientation.value === "vertical" ? "vertical" : "horizontal";
            localStorage.setItem(MENU_ORIENTATION_KEY, orientation);
            root.MainMenuLayout?.setOrientation?.(orientation);
            controls.status.textContent = `메인 메뉴: ${orientation === "vertical" ? "세로" : "가로"}`;
        });
        dialog.addEventListener("keydown", function (event) {
            if (event.key === "Escape") hide();
        });
        enableDragging(header);
        return dialog;
    }

    function setGpsEnabled(enabled) {
        createDialog();
        const gpsApi = root.gps;
        if (!gpsApi || typeof gpsApi.gpsStart !== "function" || typeof gpsApi.gpsEnd !== "function") {
            controls.gpsCheckbox.checked = false;
            controls.status.textContent = "gps.js가 로드되지 않았습니다.";
            return false;
        }

        if (enabled) {
            const started = gpsApi.isRunning?.() || gpsApi.gpsStart();
            controls.gpsCheckbox.checked = Boolean(started || gpsApi.isRunning?.());
            controls.status.textContent = controls.gpsCheckbox.checked ? "GPS 상태: ON" : "GPS를 시작할 수 없습니다.";
        } else {
            gpsApi.gpsEnd({ hideMarker: true, resetCameraMove: true });
            controls.gpsCheckbox.checked = false;
            controls.status.textContent = "GPS 상태: OFF";
        }
        return controls.gpsCheckbox.checked;
    }

    async function changeBaseMap() {
        const viewer = root.CesiumViewer;
        if (!viewer?.imageryLayers || typeof Cesium === "undefined") {
            controls.status.textContent = "Cesium 지도가 준비되지 않았습니다.";
            return;
        }
        const selected = controls.baseMap.value;
        if (selected === "current") return;

        try {
            let provider;
            root.WebCopOfflineMap?.showLocalOnly?.();
            if (managedBaseLayer && viewer.imageryLayers.contains(managedBaseLayer)) {
                viewer.imageryLayers.remove(managedBaseLayer, true);
            }
            managedBaseLayer = null;
            if (selected === "offline" || selected === "offline-color") {
                applyScreenSettings();
                viewer.scene.requestRender();
                if (selected === "offline-color") {
                    const moved = root.WebCopOfflineMap?.flyToColorImagery?.();
                    controls.status.textContent = moved ? "Stand 오프라인 컬러영상 적용" : "컬러영상을 불러오는 중입니다.";
                    if (!moved) {
                        root.WebCopOfflineMap?.loadColorImagery?.().then(function () {
                            root.WebCopOfflineMap?.flyToColorImagery?.();
                        });
                    }
                } else {
                    controls.status.textContent = "오프라인 지도 적용";
                }
                return;
            } else if (selected === "osm") {
                provider = new Cesium.OpenStreetMapImageryProvider({
                    url: "https://tile.openstreetmap.org/"
                });
            } else {
                provider = await Cesium.IonImageryProvider.fromAssetId(2);
            }
            managedBaseLayer = viewer.imageryLayers.addImageryProvider(provider);
            let errorCount = 0;
            provider.errorEvent?.addEventListener(function () {
                errorCount += 1;
                if (errorCount < 3 || !managedBaseLayer || !viewer.imageryLayers.contains(managedBaseLayer)) return;
                viewer.imageryLayers.remove(managedBaseLayer, true);
                managedBaseLayer = null;
                controls.status.textContent = "인터넷 연결 실패: 오프라인 지도로 자동 전환";
                viewer.scene.requestRender();
            });
            applyScreenSettings();
            viewer.scene.requestRender();
            controls.status.textContent = `${controls.baseMap.options[controls.baseMap.selectedIndex].text} 적용`;
        } catch (error) {
            controls.status.textContent = "Base Map을 변경할 수 없습니다.";
            console.error("Base Map 변경 오류:", error);
        }
    }

    function applyScreenSettings() {
        const viewer = root.CesiumViewer;
        if (!controls || !viewer?.imageryLayers) return;
        const brightness = Number(controls.brightness.value);
        const saturation = Number(controls.saturation.value);
        const hue = Cesium.Math.toRadians(Number(controls.hue.value));
        const alpha = Number(controls.alpha.value) / 100;
        for (let index = 0; index < viewer.imageryLayers.length; index += 1) {
            const layer = viewer.imageryLayers.get(index);
            layer.brightness = brightness;
            layer.saturation = saturation;
            layer.hue = hue;
            layer.alpha = alpha;
        }
        viewer.scene.requestRender();
    }

    function enableDragging(handle) {
        let pointerId = null;
        let offsetX = 0;
        let offsetY = 0;
        let previousCesiumInputs = null;
        handle.addEventListener("pointerdown", function (event) {
            if (event.target.closest("button")) return;
            const rect = dialog.getBoundingClientRect();
            pointerId = event.pointerId;
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            handle.setPointerCapture(pointerId);
            const controller = root.CesiumViewer?.scene?.screenSpaceCameraController;
            if (controller) {
                previousCesiumInputs = controller.enableInputs;
                controller.enableInputs = false;
            }
            event.preventDefault();
        });
        handle.addEventListener("pointermove", function (event) {
            if (event.pointerId !== pointerId) return;
            const x = Math.max(0, Math.min(event.clientX - offsetX, innerWidth - dialog.offsetWidth));
            const y = Math.max(0, Math.min(event.clientY - offsetY, innerHeight - dialog.offsetHeight));
            dialog.style.left = `${x}px`;
            dialog.style.top = `${y}px`;
        });
        function stop(event) {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            const controller = root.CesiumViewer?.scene?.screenSpaceCameraController;
            if (controller && previousCesiumInputs !== null) controller.enableInputs = previousCesiumInputs;
            previousCesiumInputs = null;
        }
        handle.addEventListener("pointerup", stop);
        handle.addEventListener("pointercancel", stop);
    }

    function show() {
        createDialog();
        controls.menuOrientation.value = root.MainMenuLayout?.getOrientation?.() ||
            (localStorage.getItem(MENU_ORIENTATION_KEY) === "vertical" ? "vertical" : "horizontal");
        controls.gpsCheckbox.checked = Boolean(root.gps?.isRunning?.());
        controls.status.textContent = controls.gpsCheckbox.checked ? "GPS 상태: ON" : "GPS 상태: OFF";
        dialog.hidden = false;
    }

    function hide() {
        if (dialog) dialog.hidden = true;
    }

    function toggle() {
        createDialog();
        if (dialog.hidden) show();
        else hide();
    }

    root.SettingDialog = Object.freeze({
        show,
        hide,
        toggle,
        showSocket: () => root.SocketSettingDialog?.show(),
        showMqtt: () => root.MqttSettingDialog?.show(),
        setGpsEnabled,
        applyScreenSettings
    });
})(typeof globalThis !== "undefined" ? globalThis : window);
