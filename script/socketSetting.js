/** WebSocket settings dialog. */
(function(root){
"use strict";
const WEBSOCKET_SETTINGS_KEY="webcop-websocket-settings";
const {createElement,createSettingInput,makeWsRow}=root.CommunicationDialog;
let ui,updateDeviceIds;
    function readWebSocketSettings() {
        const fallback = {
            role: "client",
            host: location.hostname || "127.0.0.1",
            port: location.port || "8090",
            path: "ws"
        };
        try { return { ...fallback, ...JSON.parse(localStorage.getItem(WEBSOCKET_SETTINGS_KEY) || "{}") }; }
        catch { return fallback; }
    }

    function normalizeSocketPath(value) {
        return String(value || "ws").trim().replace(/^\/+|\/+$/g, "") || "ws";
    }

    function buildWebSocketUrl(host, port, path) {
        return `ws://${String(host).trim()}:${String(port).trim()}/${normalizeSocketPath(path)}`;
    }


function ensure(){if(ui)return;ui=root.CommunicationDialog.create("webcop-socket-setting-dialog","소켓통신설정");
const {body,dialog,status}=ui;const controls={status};const hide=ui.hide;
        const savedWebSocket = readWebSocketSettings();
        const webSocketSection = document.createElement("fieldset");
        webSocketSection.className = "webcop-setting-section";
        webSocketSection.appendChild(createElement("legend", "", "WebSocket 설정"));

        const wsRoleRow = createElement("div", "webcop-setting-row");
        const wsRoleLabel = createElement("label", "webcop-setting-label", "시작 방식");
        const wsRole = createElement("select", "webcop-setting-select");
        wsRoleLabel.htmlFor = "setting-websocket-role";
        wsRole.id = "setting-websocket-role";
        [["client", "클라이언트 시작"], ["server", "서버 시작"]].forEach(function ([value, label]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            wsRole.appendChild(option);
        });
        wsRole.value = savedWebSocket.role === "server" ? "server" : "client";
        wsRoleRow.append(wsRoleLabel, wsRole);

        const wsHost = createSettingInput("setting-websocket-host", "text", savedWebSocket.host);
        const wsPort = createSettingInput("setting-websocket-port", "number", savedWebSocket.port);
        wsPort.min = "1"; wsPort.max = "65535";
        const wsPath = createSettingInput("setting-websocket-path", "text", savedWebSocket.path);
        wsPath.placeholder = "ws 또는 gps-ws";
        const wsUrl = createSettingInput("setting-websocket-url", "text", "");
        wsUrl.readOnly = true;
        const wsActions = createElement("div", "webcop-setting-actions webcop-setting-ws-actions");
        const wsStart = createElement("button", "webcop-setting-button", "시작");
        const wsStop = createElement("button", "webcop-setting-button secondary", "중지");
        const wsDisconnect = createElement("button", "webcop-setting-button secondary", "종료");
        const wsLog = createElement("button", "webcop-setting-button secondary", "로그");
        wsStart.type = wsStop.type = wsDisconnect.type = wsLog.type = "button";
        wsActions.append(wsStart, wsStop, wsDisconnect, wsLog);
        webSocketSection.append(
            wsRoleRow,
            makeWsRow("IP", wsHost),
            makeWsRow("포트", wsPort),
            makeWsRow("마지막 경로", wsPath),
            makeWsRow("접속 주소", wsUrl),
            wsActions
        );


body.append(webSocketSection);updateDeviceIds=root.CommunicationDialog.addDeviceColors(body,"socket-setting");body.append(status);
        function updateWebSocketPreview() {
            wsUrl.value = buildWebSocketUrl(wsHost.value, wsPort.value, wsPath.value);
        }
        function saveWebSocketSettings() {
            const config = {
                role: wsRole.value,
                host: wsHost.value.trim(),
                port: wsPort.value.trim(),
                path: normalizeSocketPath(wsPath.value),
                url: wsUrl.value
            };
            localStorage.setItem(WEBSOCKET_SETTINGS_KEY, JSON.stringify(config));
            return config;
        }
        [wsHost, wsPort, wsPath].forEach(function (input) {
            input.addEventListener("input", function () { updateWebSocketPreview(); saveWebSocketSettings(); });
        });
        wsRole.addEventListener("change", function () { updateWebSocketPreview(); saveWebSocketSettings(); });
        wsStart.addEventListener("click", async function () {
            root.realtimeGps?.setPaused?.(false);
            root.WebSocketLogWindow?.open?.();
            updateWebSocketPreview();
            const config = saveWebSocketSettings();
            root.WebSocketLogWindow?.log?.("info", `${config.role === "server" ? "서버" : "클라이언트"} 시작 요청`, config.url);
            if (!config.host || !/^\d+$/.test(config.port) || Number(config.port) < 1 || Number(config.port) > 65535) {
                controls.status.textContent = "WebSocket IP와 포트를 확인하세요.";
                root.WebSocketLogWindow?.log?.("error", controls.status.textContent);
                return;
            }
            if (config.role === "client") {
                const started = root.realtimeGps?.configure?.({ url: config.url });
                controls.status.textContent = started ? `WebSocket 클라이언트 연결 중: ${config.url}` : "WebSocket 주소를 확인하세요.";
                return;
            }
            try {
                const response = await fetch("/api/websocket/start", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ host: config.host, port: Number(config.port), path: config.path })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "서버 시작 실패");
                root.WebSocketLogWindow?.log?.("success", "WebSocket 서버가 시작되었습니다.", result);
                const clientHost = ["0.0.0.0", "::"].includes(config.host)
                    ? (location.hostname || "127.0.0.1") : config.host;
                const clientUrl = buildWebSocketUrl(clientHost, config.port, config.path);
                localStorage.setItem(WEBSOCKET_SETTINGS_KEY, JSON.stringify({ ...config, url: clientUrl }));
                const connected = root.realtimeGps?.configure?.({ url: clientUrl });
                controls.status.textContent = connected
                    ? `WebSocket 서버 시작 · 자체 화면 연결 중: ${clientUrl}`
                    : `WebSocket 서버 시작: ${result.url}`;
            } catch (error) {
                controls.status.textContent = error.message;
                root.WebSocketLogWindow?.log?.("error", "WebSocket 서버 시작 실패", error.message);
            }
        });
        wsLog.addEventListener("click", function () { root.WebSocketLogWindow?.open?.(); });
        function updateProcessingButton() {
            wsStop.textContent = root.realtimeGps?.isPaused?.() ? "재시작" : "중지";
        }
        document.addEventListener("gps-processing-state-changed", updateProcessingButton);
        updateProcessingButton();
        wsStop.addEventListener("click", function () {
            const paused = !root.realtimeGps?.isPaused?.();
            root.realtimeGps?.setPaused?.(paused);
            controls.status.textContent = paused
                ? "데이터 처리 중지 · 연결 유지 (수신 데이터 무시)"
                : "데이터 처리 재시작 · 이후 수신 데이터부터 처리";
        });
        wsDisconnect.addEventListener("click", async function () {
            if (wsRole.value === "client") {
                root.realtimeGps?.disconnect?.();
                controls.status.textContent = "WebSocket 클라이언트 연결 종료";
                root.WebSocketLogWindow?.close?.();
                return;
            }
            try {
                const response = await fetch("/api/websocket/stop", { method: "POST" });
                if (!response.ok) throw new Error("서버 중지 실패");
                root.realtimeGps?.disconnect?.();
                controls.status.textContent = "WebSocket 서버 및 자체 화면 연결 종료";
                root.WebSocketLogWindow?.close?.();
            } catch (error) { controls.status.textContent = error.message; }
        });
        updateWebSocketPreview();

}
function show(){ensure();updateDeviceIds();ui.show();}
function hide(){ui?.hide();}
document.addEventListener("gps-websocket-state-changed",event=>{if(event.detail?.state==="connected")hide();});
root.SocketSettingDialog=Object.freeze({show,hide,toggle:()=>{if(!ui||ui.dialog.hidden)show();else hide();}});
})(window);
