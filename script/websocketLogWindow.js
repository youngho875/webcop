/** WebSocket 상태와 수신 메시지를 별도 브라우저 창에 표시합니다. */
(function (root) {
    "use strict";

    const WINDOW_NAME = "webcop-websocket-log";
    const entries = [];
    let logWindow = null;
    let list = null;
    let stateText = null;
    let paused = false;

    function stringify(value) {
        if (value === undefined) return "";
        try { return typeof value === "string" ? value : JSON.stringify(value); }
        catch { return String(value); }
    }

    function buildWindow(target) {
        const doc = target.document;
        doc.title = "WebCOP WebSocket 로그";
        doc.documentElement.lang = "ko";
        doc.body.replaceChildren();
        const style = doc.createElement("style");
        style.textContent = `
            :root { color-scheme: dark; font-family: "Malgun Gothic", "Segoe UI", sans-serif; }
            body { margin: 0; color: #e4e4e7; background: #111318; overflow: hidden; }
            header { display: flex; align-items: center; gap: 8px; height: 50px; padding: 0 12px;
                background: #20232a; border-bottom: 1px solid #3f3f46; box-sizing: border-box; }
            h1 { flex: 1; margin: 0; font-size: 16px; }
            #state { padding: 4px 9px; color: #bae6fd; background: #0c4a6e; border-radius: 12px; font-size: 11px; }
            button { height: 29px; padding: 0 10px; color: #f4f4f5; background: #3f3f46;
                border: 1px solid #71717a; border-radius: 5px; cursor: pointer; }
            button:hover { background: #52525b; }
            #logs { height: calc(100vh - 50px); margin: 0; padding: 10px 12px; overflow: auto;
                box-sizing: border-box; list-style: none; font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
            #logs li { padding: 3px 5px; border-bottom: 1px solid rgba(255,255,255,.06); white-space: pre-wrap; overflow-wrap: anywhere; }
            #logs .info { color: #d4d4d8; } #logs .success { color: #86efac; }
            #logs .warn { color: #fde68a; } #logs .error { color: #fca5a5; } #logs .data { color: #7dd3fc; }
            time { color: #71717a; margin-right: 8px; }
        `;
        const header = doc.createElement("header");
        const title = doc.createElement("h1");
        title.textContent = "WebSocket 로그";
        stateText = doc.createElement("span");
        stateText.id = "state";
        stateText.textContent = root.realtimeGps?.getConnectionState?.() || "대기";
        const pauseButton = doc.createElement("button");
        pauseButton.textContent = "일시정지";
        const clearButton = doc.createElement("button");
        clearButton.textContent = "지우기";
        const reconnectButton = doc.createElement("button");
        reconnectButton.textContent = "재연결";
        const disconnectButton = doc.createElement("button");
        disconnectButton.textContent = "연결 종료";
        const closeButton = doc.createElement("button");
        closeButton.textContent = "창 닫기";
        header.append(title, stateText, pauseButton, clearButton, reconnectButton, disconnectButton, closeButton);
        list = doc.createElement("ul");
        list.id = "logs";
        doc.head.replaceChildren(style);
        doc.body.append(header, list);

        pauseButton.onclick = function () {
            paused = !paused;
            pauseButton.textContent = paused ? "계속 표시" : "일시정지";
            if (!paused) render();
        };
        clearButton.onclick = function () { entries.length = 0; render(); };
        reconnectButton.onclick = function () { root.realtimeGps?.reconnect?.(root.realtimeGps?.getUrl?.()); };
        disconnectButton.onclick = function () { root.realtimeGps?.disconnect?.(); };
        closeButton.onclick = close;
        render();
    }

    function open() {
        if (!logWindow || logWindow.closed) {
            logWindow = root.open("", WINDOW_NAME, "popup=yes,width=760,height=480,resizable=yes,scrollbars=yes");
            if (!logWindow) return null;
            buildWindow(logWindow);
        }
        logWindow.focus();
        return logWindow;
    }

    function close() {
        if (logWindow && !logWindow.closed) logWindow.close();
        logWindow = null;
        list = null;
        stateText = null;
    }

    function render() {
        if (paused || !list || !logWindow || logWindow.closed) return;
        const doc = logWindow.document;
        list.replaceChildren(...entries.map(function (entry) {
            const item = doc.createElement("li");
            item.className = entry.level;
            const time = doc.createElement("time");
            time.textContent = entry.time;
            item.append(time, doc.createTextNode(`${entry.message}${entry.details ? `  ${entry.details}` : ""}`));
            return item;
        }));
        list.scrollTop = list.scrollHeight;
    }

    function log(level, message, details) {
        entries.push({
            level: ["success", "warn", "error", "data"].includes(level) ? level : "info",
            time: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
            message: String(message),
            details: stringify(details)
        });
        if (entries.length > 1000) entries.splice(0, entries.length - 1000);
        render();
    }

    function setState(state) {
        if (stateText && logWindow && !logWindow.closed) stateText.textContent = state;
    }

    root.WebSocketLogWindow = Object.freeze({ open, close, log, setState });
})(typeof globalThis !== "undefined" ? globalThis : window);
