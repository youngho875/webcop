/**
 * 좌표변환 다이얼로그 UI.
 * convertCoordinates.js의 CoordinatesConverter 공개 API를 사용합니다.
 */
(function (root) {
    "use strict";

    const DIALOG_ID = "coordinate-converter-dialog";
    let dialog = null;
    let fields = null;
    let convertTimer = null;

    function injectStyle() {
        if (document.getElementById("coordinate-converter-style")) return;

        const style = document.createElement("style");
        style.id = "coordinate-converter-style";
        style.textContent = `
            #${DIALOG_ID} {
                --coord-bg: rgba(37, 39, 43, 0.97);
                --coord-border: #111317;
                --coord-accent: #38bdf8;
                position: fixed;
                top: 110px;
                left: calc(50vw - 175px);
                z-index: 2200;
                width: min(350px, calc(100vw - 16px));
                height: min(400px, calc(100vh - 16px));
                color: #f4f4f5;
                background: linear-gradient(145deg, rgba(44, 47, 52, 0.98), var(--coord-bg));
                border: 1px solid rgba(255, 255, 255, 0.13);
                border-radius: 9px;
                box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.3);
                font-family: "Malgun Gothic", "Segoe UI", sans-serif;
                box-sizing: border-box;
                overflow: hidden;
            }
            #${DIALOG_ID}[hidden] { display: none; }
            #${DIALOG_ID} * { box-sizing: border-box; }
            .coordinate-dialog-header {
                display: flex;
                align-items: center;
                min-height: 44px;
                padding: 5px 7px 5px 9px;
                background: rgba(15, 17, 20, 0.35);
                border-bottom: 1px solid rgba(255, 255, 255, 0.16);
                cursor: move;
                user-select: none;
                touch-action: none;
            }
            .coordinate-dialog-title {
                flex: 1;
                margin: 0;
                padding: 2px 5px;
                border: 0;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.2;
                text-align: left;
                letter-spacing: -0.3px;
            }
            .coordinate-dialog-title::before {
                content: '↔';
                display: inline-grid;
                place-items: center;
                width: 24px;
                height: 24px;
                margin-right: 6px;
                color: var(--coord-accent);
                background: rgba(56, 189, 248, 0.12);
                border: 1px solid rgba(56, 189, 248, 0.28);
                border-radius: 6px;
                font-size: 15px;
                vertical-align: middle;
            }
            .coordinate-dialog-close {
                flex: 0 0 30px;
                height: 30px;
                margin-left: 4px;
                color: #a1a1aa;
                background: transparent;
                border: 0;
                border-radius: 7px;
                font-size: 22px;
                line-height: 1;
                cursor: pointer;
                transition: color 0.15s, background 0.15s;
            }
            .coordinate-dialog-close:hover,
            .coordinate-dialog-close:focus-visible { color: #fff; background: rgba(239, 68, 68, 0.72); outline: none; }
            .coordinate-dialog-body {
                height: calc(100% - 44px);
                padding: 13px 12px 10px;
                overflow-y: auto;
            }
            .coordinate-dialog-row {
                display: grid;
                grid-template-columns: 52px minmax(0, 1fr);
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            .coordinate-dialog-row label {
                color: #d4d4d8;
                font-size: 12px;
                font-weight: 600;
                text-align: right;
                letter-spacing: -0.2px;
            }
            .coordinate-dialog-input,
            .coordinate-dialog-output {
                width: 100%;
                min-height: 35px;
                height: 35px;
                padding: 7px 9px;
                color: #18181b;
                background: #ffffff;
                border: 1px solid #d4d4d8;
                border-radius: 5px;
                font: 12.5px/1.25 ui-monospace, SFMono-Regular, Consolas, monospace;
                transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
                cursor: text;
                user-select: text;
                -webkit-user-select: text;
            }
            .coordinate-dialog-input::placeholder { color: #9ca3af; }
            .coordinate-dialog-input:focus {
                color: #09090b;
                background: #ffffff;
                border-color: var(--coord-accent);
                box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.13);
                outline: none;
            }
            .coordinate-dialog-output {
                color: #18181b;
                background: #ffffff;
                border-color: #d4d4d8;
                cursor: text;
            }
            .coordinate-dialog-divider {
                height: 1px;
                margin: 7px 0;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            }
            .coordinate-dialog-hint {
                margin: -1px 0 7px 60px;
                color: #a1a1aa;
                font-size: 10px;
            }
            .coordinate-dialog-error {
                min-height: 13px;
                margin: 2px 0 0 60px;
                color: #fecaca;
                font-size: 10px;
            }
            @media (max-width: 600px) {
                #${DIALOG_ID} { left: 8px; top: 55px; }
                .coordinate-dialog-title { font-size: 13px; }
                .coordinate-dialog-body { padding: 6px; }
                .coordinate-dialog-row { grid-template-columns: 41px minmax(0, 1fr); gap: 4px; }
                .coordinate-dialog-row label { font-size: 9.5px; }
                .coordinate-dialog-hint, .coordinate-dialog-error { margin-left: 45px; }
            }
        `;
        document.head.appendChild(style);
    }

    function createRow(labelText, id, editable) {
        const row = document.createElement("div");
        row.className = "coordinate-dialog-row";

        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = labelText;

        const input = document.createElement("input");
        input.id = id;
        input.className = editable ? "coordinate-dialog-input" : "coordinate-dialog-output";
        input.type = "text";
        input.autocomplete = "off";
        input.spellcheck = false;
        if (!editable) {
            input.readOnly = true;
            input.tabIndex = 0;
        }

        row.append(label, input);
        return { row, input };
    }

    function createDialog() {
        if (dialog) return dialog;
        injectStyle();

        dialog = document.createElement("section");
        dialog.id = DIALOG_ID;
        dialog.hidden = true;
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "false");
        dialog.setAttribute("aria-labelledby", "coordinate-dialog-title");

        const header = document.createElement("header");
        header.className = "coordinate-dialog-header";
        const title = document.createElement("h2");
        title.id = "coordinate-dialog-title";
        title.className = "coordinate-dialog-title";
        title.textContent = "좌표변환";
        const closeButton = document.createElement("button");
        closeButton.className = "coordinate-dialog-close";
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "좌표변환 창 닫기");
        closeButton.textContent = "×";
        header.append(title, closeButton);

        const body = document.createElement("div");
        body.className = "coordinate-dialog-body";
        const longitude = createRow("경도", "coordinate-longitude", true);
        const latitude = createRow("위도", "coordinate-latitude", true);
        longitude.input.placeholder = "Degree 예: 126.978";
        latitude.input.placeholder = "Degree 예: 37.5665";
        longitude.input.inputMode = "decimal";
        latitude.input.inputMode = "decimal";
        const hint = document.createElement("p");
        hint.className = "coordinate-dialog-hint";
        hint.textContent = "어느 좌표든 입력하면 나머지 좌표가 자동 변환됩니다.";
        const divider = document.createElement("div");
        divider.className = "coordinate-dialog-divider";
        const dms = createRow("도분초", "coordinate-dms", true);
        const utm = createRow("UTM", "coordinate-utm", true);
        const mgrs = createRow("MGRS", "coordinate-mgrs", true);
        const georef = createRow("GEOREF", "coordinate-georef", true);
        dms.input.placeholder = "37°33′59.4″N, 126°58′40.8″E";
        utm.input.placeholder = "52N 321424 4159641";
        mgrs.input.placeholder = "52SCG2142459640";
        georef.input.placeholder = "WJGH586339";
        const error = document.createElement("p");
        error.className = "coordinate-dialog-error";
        error.setAttribute("role", "status");
        error.setAttribute("aria-live", "polite");

        body.append(
            longitude.row, latitude.row, hint, divider,
            dms.row, utm.row, mgrs.row, georef.row, error
        );
        dialog.append(header, body);
        document.body.appendChild(dialog);

        fields = {
            longitude: longitude.input,
            latitude: latitude.input,
            dms: dms.input,
            utm: utm.input,
            mgrs: mgrs.input,
            georef: georef.input,
            error
        };

        closeButton.addEventListener("click", hide);
        Object.entries(fields).forEach(function ([source, element]) {
            if (source === "error") return;
            element.dataset.coordinateSource = source;
            element.addEventListener("input", scheduleConvert);
            element.addEventListener("keydown", convertOnEnter);
        });
        dialog.addEventListener("keydown", function (event) {
            if (event.key === "Escape") hide();
        });
        enableDragging(header);
        return dialog;
    }

    function convertOnEnter(event) {
        if (event.key !== "Enter") return;
        clearTimeout(convertTimer);
        updateResults(event.currentTarget.dataset.coordinateSource);
    }

    function scheduleConvert(event) {
        clearTimeout(convertTimer);
        const source = event.currentTarget.dataset.coordinateSource;
        convertTimer = setTimeout(function () { updateResults(source); }, 180);
    }

    function parseCoordinate(value, coordinateType) {
        const text = String(value).trim().toUpperCase();
        if (!text) throw new Error(`${coordinateType === "longitude" ? "경도" : "위도"}를 입력하세요.`);

        const decimal = Number(text);
        if (Number.isFinite(decimal)) return decimal;

        const directionMatch = text.match(/[NSEW]/);
        const direction = directionMatch ? directionMatch[0] : "";
        if (coordinateType === "longitude" && direction && !/[EW]/.test(direction)) {
            throw new Error("경도 방향은 E 또는 W여야 합니다.");
        }
        if (coordinateType === "latitude" && direction && !/[NS]/.test(direction)) {
            throw new Error("위도 방향은 N 또는 S여야 합니다.");
        }

        const parts = text.replace(/[NSEW]/g, "").match(/[-+]?\d+(?:\.\d+)?/g);
        if (!parts || parts.length < 1 || parts.length > 3) {
            throw new Error("좌표 형식을 확인하세요. 예: 37.5665 또는 37°33′59.4″N");
        }

        const rawDegrees = Number(parts[0]);
        const minutes = Number(parts[1] || 0);
        const seconds = Number(parts[2] || 0);
        if (minutes >= 60 || seconds >= 60) throw new Error("분과 초는 60보다 작아야 합니다.");

        const directionSign = /[WS]/.test(direction) ? -1 : 1;
        const numericSign = rawDegrees < 0 ? -1 : 1;
        return (Math.abs(rawDegrees) + minutes / 60 + seconds / 3600)
            * (direction ? directionSign : numericSign);
    }

    function parseDegreeCoordinate(value, coordinateType) {
        const text = String(value).trim();
        const name = coordinateType === "longitude" ? "경도" : "위도";
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
            throw new Error(`${name}는 Degree 숫자만 입력하세요. 예: ${coordinateType === "longitude" ? "126.978" : "37.5665"}`);
        }
        const coordinate = Number(text);
        const limit = coordinateType === "longitude" ? 180 : 90;
        if (!Number.isFinite(coordinate) || coordinate < -limit || coordinate > limit) {
            throw new RangeError(`${name} 범위는 ${-limit}~${limit}도입니다.`);
        }
        return coordinate;
    }

    function parseDmsPair(value) {
        const text = String(value).trim().toUpperCase();
        const latitudeMatch = text.match(/(?:^|[,;])\s*([^,;]*[NS])/);
        const longitudeMatch = text.match(/(?:^|[,;])\s*([^,;]*[EW])/);
        if (latitudeMatch && longitudeMatch) {
            return {
                longitude: parseCoordinate(longitudeMatch[1], "longitude"),
                latitude: parseCoordinate(latitudeMatch[1], "latitude")
            };
        }
        const parts = text.split(/[,;]/).map(function (part) { return part.trim(); }).filter(Boolean);
        if (parts.length === 2) {
            return {
                latitude: parseCoordinate(parts[0], "latitude"),
                longitude: parseCoordinate(parts[1], "longitude")
            };
        }
        throw new Error("도분초 형식: 37°33′59.4″N, 126°58′40.8″E");
    }

    function clearOtherFields(source) {
        ["longitude", "latitude", "dms", "utm", "mgrs", "georef"].forEach(function (name) {
            if (name !== source && !(source === "longitude" && name === "latitude") && !(source === "latitude" && name === "longitude")) {
                fields[name].value = "";
            }
        });
    }

    function getDegreeCoordinate(source) {
        if (source === "longitude" || source === "latitude" || source === "degree" || !source) {
            return {
                longitude: parseDegreeCoordinate(fields.longitude.value, "longitude"),
                latitude: parseDegreeCoordinate(fields.latitude.value, "latitude")
            };
        }
        if (source === "dms") return parseDmsPair(fields.dms.value);
        if (source === "utm") return root.CoordinatesConverter.convertFromUTM(fields.utm.value);
        if (source === "mgrs") return root.CoordinatesConverter.convertFromMGRS(fields.mgrs.value);
        if (source === "georef") return root.CoordinatesConverter.convertFromGEOREF(fields.georef.value);
        throw new Error("지원하지 않는 좌표 형식입니다.");
    }

    function updateResults(source = "degree") {
        const sourceElement = source === "degree" ? fields.longitude : fields[source];
        if (!sourceElement || !sourceElement.value.trim()
            || ((source === "longitude" || source === "latitude" || source === "degree")
                && (!fields.longitude.value.trim() || !fields.latitude.value.trim()))) {
            clearOtherFields(source);
            fields.error.textContent = "";
            return null;
        }

        try {
            if (!root.CoordinatesConverter) {
                throw new Error("convertCoordinates.js가 먼저 로드되어야 합니다.");
            }
            const coordinate = getDegreeCoordinate(source);
            const result = root.CoordinatesConverter.convertCoordinates(coordinate.longitude, coordinate.latitude);
            fields.longitude.value = Number(result.degree.longitude.toFixed(8));
            fields.latitude.value = Number(result.degree.latitude.toFixed(8));
            fields.dms.value = result.dms.text;
            fields.utm.value = result.utm.text;
            fields.mgrs.value = result.mgrs;
            fields.georef.value = result.georef;
            fields.error.textContent = "";
            return result;
        } catch (error) {
            clearOtherFields(source);
            fields.error.textContent = error.message || "좌표를 변환할 수 없습니다.";
            return null;
        }
    }

    function enableDragging(handle) {
        let activePointerId = null;
        let offsetX = 0;
        let offsetY = 0;
        let cesiumInputsWereEnabled = null;

        handle.addEventListener("pointerdown", function (event) {
            if (event.target.closest("button")) return;
            const rect = dialog.getBoundingClientRect();
            activePointerId = event.pointerId;
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            handle.setPointerCapture(activePointerId);

            const controller = root.CesiumViewer?.scene?.screenSpaceCameraController;
            if (controller) {
                cesiumInputsWereEnabled = controller.enableInputs;
                controller.enableInputs = false;
            }
            event.preventDefault();
        });

        handle.addEventListener("pointermove", function (event) {
            if (event.pointerId !== activePointerId) return;
            const maxX = Math.max(0, window.innerWidth - dialog.offsetWidth);
            const maxY = Math.max(0, window.innerHeight - dialog.offsetHeight);
            const x = Math.max(0, Math.min(event.clientX - offsetX, maxX));
            const y = Math.max(0, Math.min(event.clientY - offsetY, maxY));
            dialog.style.left = `${x}px`;
            dialog.style.top = `${y}px`;
        });

        function stopDragging(event) {
            if (event.pointerId !== activePointerId) return;
            activePointerId = null;
            const controller = root.CesiumViewer?.scene?.screenSpaceCameraController;
            if (controller && cesiumInputsWereEnabled !== null) controller.enableInputs = cesiumInputsWereEnabled;
            cesiumInputsWereEnabled = null;
        }
        handle.addEventListener("pointerup", stopDragging);
        handle.addEventListener("pointercancel", stopDragging);
    }

    function show(initialCoordinate) {
        createDialog();
        dialog.hidden = false;
        if (initialCoordinate) setCoordinate(initialCoordinate.longitude, initialCoordinate.latitude);
        fields.longitude.focus();
    }

    function hide() {
        if (dialog) dialog.hidden = true;
    }

    function toggle() {
        createDialog();
        if (dialog.hidden) show();
        else hide();
    }

    function setCoordinate(longitude, latitude) {
        createDialog();
        fields.longitude.value = longitude;
        fields.latitude.value = latitude;
        return updateResults();
    }

    root.CoordinateDialog = Object.freeze({
        show,
        hide,
        toggle,
        setCoordinate,
        convert: updateResults,
        parseCoordinate,
        parseDegreeCoordinate
    });
})(typeof globalThis !== "undefined" ? globalThis : window);
