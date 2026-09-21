/** MQTT broker settings dialog. Passwords are not persisted. */
(function(root){
"use strict";
const {createElement,createSettingInput,makeWsRow}=root.CommunicationDialog;
let ui,refresh,updateDeviceIds;
function ensure(){if(ui)return;ui=root.CommunicationDialog.create("webcop-mqtt-setting-dialog","MQTT통신설정");const {body,dialog}=ui;
        const mqttSection = document.createElement("fieldset");
        mqttSection.className = "webcop-setting-section";
        mqttSection.appendChild(createElement("legend", "", "MQTT 브로커 연결 설정"));
        let savedMqtt = {};
        try { savedMqtt = JSON.parse(localStorage.getItem("webcop-mqtt-settings") || "{}"); } catch {}
        const mqttHost = createSettingInput("setting-mqtt-host", "text", savedMqtt?.host || "localhost");
        const mqttPort = createSettingInput("setting-mqtt-port", "number", savedMqtt?.port || "1883");
        const mqttTopic = createSettingInput("setting-mqtt-topic", "text", savedMqtt?.topic || "gps/+/location");
        const mqttUsername = createSettingInput("setting-mqtt-username", "text", savedMqtt?.username || "");
        const mqttPassword = createSettingInput("setting-mqtt-password", "password", "");
        mqttPassword.autocomplete = "new-password";
        const mqttTls = createElement("select", "webcop-setting-select");
        mqttTls.id = "setting-mqtt-tls";
        [["false", "MQTT"], ["true", "MQTTS (TLS)"]].forEach(([value, label]) => {
            const option = document.createElement("option"); option.value = value; option.textContent = label; mqttTls.appendChild(option);
        });
        mqttTls.value = savedMqtt?.tls ? "true" : "false";
        const mqttActions = createElement("div", "webcop-setting-actions webcop-setting-ws-actions");
        const mqttStart = createElement("button", "webcop-setting-button", "시작");
        const mqttStop = createElement("button", "webcop-setting-button secondary", "종료");
        mqttStart.type = mqttStop.type = "button";
        mqttActions.append(mqttStart, mqttStop);
        const mqttStatus = createElement("p", "webcop-setting-status", "MQTT 미사용 · 시작 전에는 접속하지 않습니다.");
        mqttStatus.setAttribute("role", "status");
        mqttSection.append(makeWsRow("IP/호스트", mqttHost), makeWsRow("포트", mqttPort),
            makeWsRow("프로토콜", mqttTls), makeWsRow("구독 토픽", mqttTopic),
            makeWsRow("사용자명", mqttUsername), makeWsRow("비밀번호", mqttPassword), mqttActions, mqttStatus);
        let mqttStatusPending = false;
        async function updateMqttStatus() {
            if (mqttStatusPending) return;
            mqttStatusPending = true;
            try {
                const response = await fetch("/api/mqtt/status");
                if (!response.ok) throw new Error("서버의 MQTT 설정 API를 확인하세요.");
                const result = await response.json();
                const labels = { stopped: "종료", connecting: "연결 중", connected: "연결 및 구독 완료", disconnected: "연결 끊김", error: "연결 실패" };
                mqttStatus.textContent = `MQTT ${labels[result.state] || result.state}${result.error ? ': ' + result.error : ''}`;
            } catch (error) { mqttStatus.textContent = error.message; }
            finally { mqttStatusPending = false; }
        }
        mqttStart.addEventListener("click", async function () {
            mqttStart.disabled = true;
            try {
                const config = { host: mqttHost.value.trim(), port: Number(mqttPort.value), topic: mqttTopic.value.trim(),
                    tls: mqttTls.value === "true", username: mqttUsername.value.trim() };
                const response = await fetch("/api/mqtt/start", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...config, password: mqttPassword.value }) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "MQTT 시작 실패");
                localStorage.setItem("webcop-mqtt-settings", JSON.stringify(config));
                root.realtimeGps?.setMode?.("both");
                if (root.realtimeGps?.getConnectionState?.() !== "connected") {
                    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
                    root.realtimeGps?.configure?.({ url: `${protocol}//${location.host}/gps-ws` });
                }
                await updateMqttStatus();
            } catch (error) { mqttStatus.textContent = error.message; }
            finally { mqttStart.disabled = false; }
        });
        mqttStop.addEventListener("click", async function () {
            try {
                const response = await fetch("/api/mqtt/stop", { method: "POST" });
                if (!response.ok) throw new Error("MQTT 종료 실패");
                await updateMqttStatus();
            } catch (error) { mqttStatus.textContent = error.message; }
        });
        setInterval(() => { if (!dialog.hidden && !mqttSection.hidden) updateMqttStatus(); }, 2000);

body.append(mqttSection);updateDeviceIds=root.CommunicationDialog.addDeviceColors(body,"mqtt-setting");refresh=updateMqttStatus;
}
function show(){ensure();updateDeviceIds();ui.show();refresh();}
function hide(){ui?.hide();}
root.MqttSettingDialog=Object.freeze({show,hide,toggle:()=>{if(!ui||ui.dialog.hidden)show();else hide();}});
})(window);
