/** Common communication dialog UI, dragging and device colors. */
(function(root){
"use strict";
    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function createSettingInput(id, type, value) {
        const input = createElement("input", "webcop-setting-input");
        input.id = id;
        input.type = type;
        input.value = value;
        return input;
    }

        function makeWsRow(labelText, input) {
            const row = createElement("div", "webcop-setting-row");
            const label = createElement("label", "webcop-setting-label", labelText);
            label.htmlFor = input.id;
            row.append(label, input);
            return row;
        }

function create(id,caption){
const DIALOG_ID=id;
    function injectStyle() {
        if (document.getElementById(DIALOG_ID + "-style")) return;
        const style = document.createElement("style");
        style.id = DIALOG_ID + "-style";
        style.textContent = `
            #${DIALOG_ID} {
                --setting-accent: #38bdf8;
                position: fixed;
                top: 105px;
                left: calc(50vw - 175px);
                z-index: 2250;
                width: min(350px, calc(100vw - 16px));
                display: flex;
                flex-direction: column;
                height: auto;
                max-height: calc(100vh - 16px);
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
            #${DIALOG_ID} details.webcop-setting-section > summary {
                cursor: pointer; color: #e4e4e7; font-size: 13px;
                font-weight: 600; padding: 3px 0 6px; user-select: none;
            }
            #${DIALOG_ID} .communication-section-content {
                border: 0; background: transparent; margin: 0; padding: 5px 0 0;
                min-width: 0;
            }
            #${DIALOG_ID} .webcop-setting-header {
                flex: 0 0 48px;
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
            #${DIALOG_ID} .webcop-setting-body {
                height: auto;
                min-height: 0;
                flex: 0 1 auto;
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


let dialog;
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


injectStyle();
dialog=createElement("section");
dialog.id=id;dialog.hidden=true;dialog.setAttribute("role","dialog");
dialog.setAttribute("aria-labelledby",id+"-title");
const header=createElement("header","webcop-setting-header");
const title=createElement("h2","webcop-setting-title",caption);title.id=id+"-title";
const close=createElement("button","webcop-setting-close","×");close.type="button";close.setAttribute("aria-label",caption+" 닫기");
const body=createElement("div","webcop-setting-body");
const status=createElement("p","webcop-setting-status","");status.setAttribute("role","status");
header.append(title,close);dialog.append(header,body);document.body.appendChild(dialog);
function hide(){dialog.hidden=true;}
close.addEventListener("click",hide);
dialog.addEventListener("keydown",e=>{if(e.key==="Escape")hide();});
enableDragging(header);
function show() {
    // 기존 컨트롤과 이벤트는 그대로 두고 각 fieldset을 독립 접기 영역으로 감싼다.
    Array.from(body.children).filter(element => element.tagName === 'FIELDSET').forEach((section, index) => {
        const legend = section.querySelector('legend');
        const caption = legend?.textContent || '설정';
        const details = createElement('details', 'webcop-setting-section');
        const summary = createElement('summary', '', caption);
        details.open = index === 0;
        body.insertBefore(details, section);
        if (legend) legend.remove();
        section.className = 'communication-section-content';
        section.setAttribute('aria-label', caption);
        details.append(summary, section);
    });
    dialog.hidden = false;
    const rect = dialog.getBoundingClientRect();
    dialog.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - rect.height - 8))}px`;
}
return {dialog,body,status,show,hide};
}
function addDeviceColors(body,prefix){
        const ratSection = createElement("fieldset", "webcop-setting-section");
        ratSection.appendChild(createElement("legend", "", "통신 유형별 아이콘 색상"));
        const ratInputs = {};
        ["5G", "D2D", "X위성", "L위성", "RAT 없음"].forEach((rat, index) => {
            const input = createSettingInput(`${prefix}-rat-color-${index}`, "color",
                root.realtimeGps.getRatColor(rat));
            ratInputs[rat] = input;
            ratSection.appendChild(makeWsRow(rat, input));
        });
        const ratActions = createElement("div", "webcop-setting-actions");
        const ratSave = createElement("button", "webcop-setting-button", "적용·저장");
        const ratReset = createElement("button", "webcop-setting-button secondary", "기본 색상");
        ratSave.type = ratReset.type = "button";
        ratActions.append(ratSave, ratReset);
        const ratStatus = createElement("p", "webcop-setting-status", "통신 유형 색상 우선 · rat 미입력은 ‘RAT 없음’ 색상 적용");
        ratStatus.setAttribute("role", "status");
        ratSection.append(ratActions, ratStatus);
        body.appendChild(ratSection);
        ratSave.addEventListener("click", () => {
            const colors = Object.fromEntries(Object.entries(ratInputs).map(([rat, input]) => [rat, input.value]));
            ratStatus.textContent = root.realtimeGps.setRatColors(colors)
                ? "통신 유형 색상 적용 및 저장 완료 · 통신 유형 색상 우선"
                : "색상 또는 브라우저 저장 권한을 확인하세요.";
        });
        ratReset.addEventListener("click", () => {
            ratStatus.textContent = root.realtimeGps.resetRatColors()
                ? "기본 통신 유형 색상으로 변경했습니다."
                : "브라우저 저장 권한을 확인하세요.";
        });
        document.addEventListener("gps-rat-colors-changed", () => {
            Object.entries(ratInputs).forEach(([rat, input]) => { input.value = root.realtimeGps.getRatColor(rat); });
            updateDeviceColor();
        });
        const deviceColorSection = document.createElement("fieldset");
        deviceColorSection.className = "webcop-setting-section";
        deviceColorSection.appendChild(createElement("legend", "", "장비 ID별 색상"));
        const deviceId = createSettingInput(prefix + "-gps-device-id", "text", "");
        deviceId.placeholder = "미수신 장비 ID도 직접 입력 가능";
        const deviceIds = createElement("select", "webcop-setting-select");
        deviceIds.id = prefix + "-gps-device-ids";
        const deviceColor = createSettingInput(prefix + "-gps-device-color", "color", "#00cfff");
        const deviceColorActions = createElement("div", "webcop-setting-actions");
        const applyDeviceColor = createElement("button", "webcop-setting-button", "적용·저장");
        const resetDeviceColor = createElement("button", "webcop-setting-button secondary", "자동 색상");
        applyDeviceColor.type = resetDeviceColor.type = "button";
        deviceColorActions.append(applyDeviceColor, resetDeviceColor);
        const deviceColorStatus = createElement("p", "webcop-setting-status", "미지정 ID는 자동 색상으로 표시됩니다.");
        deviceColorStatus.setAttribute("role", "status");
        deviceColorSection.append(makeWsRow("장비 목록", deviceIds), makeWsRow("장비 ID", deviceId),
            makeWsRow("표시 색상", deviceColor), deviceColorActions, deviceColorStatus);

        function updateDeviceIds(event) {
            if (event?.detail?.cleared) {
                deviceId.value = "";
                deviceColor.value = "#00cfff";
                deviceColorStatus.textContent = "연결 종료: 장비 목록을 초기화했습니다.";
            }
            const selectedId = deviceId.value.trim();
            deviceIds.replaceChildren();
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "장비 ID 선택";
            deviceIds.appendChild(placeholder);
            (root.realtimeGps?.getDeviceIds?.() || []).forEach(id => {
                const option = document.createElement("option");
                option.value = id;
                option.textContent = id;
                deviceIds.appendChild(option);
            });
            deviceIds.value = Array.from(deviceIds.options).some(option => option.value === selectedId)
                ? selectedId : "";
        }
        function updateDeviceColor() {
            const id = deviceId.value.trim();
            if (id) deviceColor.value = root.realtimeGps?.getDeviceColor?.(id) || "#00cfff";
        }
        deviceIds.addEventListener("change", function () {
            deviceId.value = deviceIds.value;
            updateDeviceColor();
        });
        deviceId.addEventListener("input", function () {
            const id = deviceId.value.trim();
            deviceIds.value = Array.from(deviceIds.options).some(option => option.value === id) ? id : "";
            updateDeviceColor();
        });
        applyDeviceColor.addEventListener("click", function () {
            const id = deviceId.value.trim();
            const saved = root.realtimeGps?.setDeviceColor?.(id, deviceColor.value);
            deviceColorStatus.textContent = saved ? `${id}: 색상 적용 및 저장 완료` : "장비 ID 또는 브라우저 저장 권한을 확인하세요.";
        });
        resetDeviceColor.addEventListener("click", function () {
            const id = deviceId.value.trim();
            const saved = root.realtimeGps?.resetDeviceColor?.(id);
            if (saved) updateDeviceColor();
            deviceColorStatus.textContent = saved ? `${id}: 자동 색상으로 변경했습니다.` : "장비 ID 또는 브라우저 저장 권한을 확인하세요.";
        });
        document.addEventListener("gps-device-list-changed", updateDeviceIds);
        document.addEventListener("gps-device-colors-changed", () => { updateDeviceIds(); updateDeviceColor(); });
        updateDeviceIds();


body.appendChild(deviceColorSection);
const manualSection = createElement('fieldset', 'webcop-setting-section');
manualSection.appendChild(createElement('legend', '', '수동 장비 위치 입력'));
const manualId = createSettingInput(prefix + '-manual-id', 'text', '');
const manualLat = createSettingInput(prefix + '-manual-lat', 'number', '');
const manualLon = createSettingInput(prefix + '-manual-lon', 'number', '');
const manualAlt = createSettingInput(prefix + '-manual-alt', 'number', '');
manualLat.min = '-90'; manualLat.max = '90'; manualLat.step = 'any';
manualLon.min = '-180'; manualLon.max = '180'; manualLon.step = 'any'; manualAlt.step = 'any';
manualAlt.placeholder = '미입력 시 지형 밀착';
const manualRat = createElement('select', 'webcop-setting-select');
manualRat.id = prefix + '-manual-rat';
[['', 'RAT 없음'], ['5G', '5G'], ['D2D', 'D2D'], ['X위성', 'X위성'], ['L위성', 'L위성']].forEach(([value, label]) => {
    const option = createElement('option', '', label); option.value = value; manualRat.appendChild(option);
});
const manualActions = createElement('div', 'webcop-setting-actions webcop-setting-ws-actions');
const manualApply = createElement('button', 'webcop-setting-button', '등록·수정');
const manualDelete = createElement('button', 'webcop-setting-button secondary', '수동 위치 삭제');
manualApply.type = manualDelete.type = 'button'; manualActions.append(manualApply, manualDelete);
const manualStatus = createElement('p', 'webcop-setting-status', 'ID·위도·경도 필수 · 같은 ID의 GPS 수신 위치 우선');
manualStatus.setAttribute('role', 'status');
manualSection.append(makeWsRow('장비 ID *', manualId), makeWsRow('위도 *', manualLat), makeWsRow('경도 *', manualLon),
    makeWsRow('고도(m)', manualAlt), makeWsRow('통신 유형', manualRat), manualActions, manualStatus);
manualApply.addEventListener('click', () => {
    const success = root.realtimeGps.setManualDevice({ deviceId: manualId.value, latitude: manualLat.value,
        longitude: manualLon.value, altitude: manualAlt.value, rat: manualRat.value });
    manualStatus.textContent = success ? '수동 위치 등록 완료 · 자동 GPS 수신 위치가 있으면 GPS 우선'
        : 'ID·위도(-90~90)·경도(-180~180)와 고도를 확인하세요.';
});
manualDelete.addEventListener('click', () => {
    manualStatus.textContent = root.realtimeGps.removeManualDevice(manualId.value)
        ? '수동 위치를 삭제했습니다. 자동 GPS 데이터는 유지됩니다.' : '해당 ID의 수동 위치가 없습니다.';
});
body.appendChild(manualSection);
return updateDeviceIds;
}
root.CommunicationDialog=Object.freeze({create,createElement,createSettingInput,makeWsRow,addDeviceColors});
})(window);
