/** MQTT/WebSocket 다중 장비 GPS를 Cesium에 표시하는 모듈 */
window.realtimeGps = (function () {
  const devices = new Map();
  let socket = null;
  let reconnectTimer = null;
  let mode = 'websocket';
  let hasMovedToFirstGps = false;
  let connectionState = 'disconnected';
  let reconnectAttempt = 0;
  let connectionGeneration = 0;
  let shouldReconnect = true;
  const WEBSOCKET_SETTINGS_KEY = 'webcop-websocket-settings';

  function defaultUrl() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/gps-ws`;
  }

  function savedClientUrl() {
    try {
      const saved = JSON.parse(localStorage.getItem(WEBSOCKET_SETTINGS_KEY) || 'null');
      return ['client', 'server'].includes(saved?.role) && /^wss?:\/\//i.test(saved.url || '')
        ? saved.url : defaultUrl();
    } catch {
      return defaultUrl();
    }
  }

  let websocketUrl = savedClientUrl();

  function writeSocketLog(level, message, details) {
    window.WebSocketLogWindow?.log?.(level, message, details);
  }

  function setConnectionState(state, details = {}) {
    connectionState = state;
    window.WebSocketLogWindow?.setState?.(state);
    const level = state === 'connected' ? 'success' : state === 'error' ? 'error' : state === 'disconnected' ? 'warn' : 'info';
    const labels = { connecting: 'WebSocket 연결 시도', connected: 'WebSocket 연결 성공', disconnected: 'WebSocket 연결 종료', error: 'WebSocket 연결 오류' };
    writeSocketLog(level, labels[state] || `WebSocket 상태: ${state}`, details);
    document.dispatchEvent(new CustomEvent('gps-websocket-state-changed', {
      detail: { state, ...details }
    }));
  }

  function sourceAllowed(source) {
    return mode === 'both' || mode === source;
  }

  function getLatestAllowed(record) {
    return Object.values(record.sources)
      .filter(data => sourceAllowed(data.source))
      .sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  }

  function createEntity(deviceId) {
    const entity = window.CesiumViewer.entities.add({
      id: `realtime-gps-${deviceId}`,
      name: `GPS 장비 ${deviceId}`,
      show: false,
      position: Cesium.Cartesian3.ZERO,
      point: {
        pixelSize: 13,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `ID: ${deviceId}`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        pixelOffset: new Cesium.Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    entity.customData = {
      ...(entity.customData || {}),
      isRealtimeGpsDevice: true,
      deviceId
    };
    return entity;
  }

  function flyToDevice(entity) {
    if (!entity?.show || !window.CesiumViewer) return;
    window.CesiumViewer.flyTo(entity, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-60),
        1000
      )
    }).catch(error => console.warn('[GPS 실시간] 장비 위치 이동 실패:', error));
  }

  function renderRecord(record) {
    const data = getLatestAllowed(record);
    record.entity.show = Boolean(data) && mode !== 'off';
    if (!data || mode === 'off') return;

    record.entity.position = Cesium.Cartesian3.fromDegrees(
      data.longitude, data.latitude, data.altitude
    );
    record.entity.point.color = data.source === 'mqtt'
      ? Cesium.Color.ORANGE : Cesium.Color.CYAN;
    record.entity.label.text = data.rat
      ? `ID: ${data.deviceId}\n접속망: ${data.rat}`
      : `ID: ${data.deviceId}`;
  }

  function refreshAllMarkers() {
    devices.forEach(renderRecord);
    const viewer = window.CesiumViewer;
    if (!viewer) return;
    viewer.dataSourceDisplay?.update(viewer.clock.currentTime);
    viewer.scene.requestRender();
  }

  function receive(data) {
    if (data?.type !== 'gps' || !['mqtt', 'websocket'].includes(data.source)) {
      writeSocketLog('warn', '지원하지 않는 메시지를 무시했습니다.', data);
      return;
    }
    if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
      writeSocketLog('warn', '경위도 값이 올바르지 않습니다.', data);
      return;
    }

    let record = devices.get(data.deviceId);
    if (!record) {
      record = { entity: createEntity(data.deviceId), sources: {} };
      devices.set(data.deviceId, record);
      writeSocketLog('success', `새 장비 표시: ${data.deviceId}`);
    }
    const previous = record.sources[data.source];
    if (previous && previous.timestamp > data.timestamp) return;
    record.sources[data.source] = data;
    renderRecord(record);
    window.CesiumViewer.scene.requestRender();

    // 전체 시스템에서 처음 표시되는 GPS 위치로 한 번만 자동 이동합니다.
    if (!hasMovedToFirstGps && mode !== 'off' && sourceAllowed(data.source)) {
      hasMovedToFirstGps = true;
      flyToDevice(record.entity);
    }
  }

  function disconnect() {
    shouldReconnect = false;
    connectionGeneration += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    const currentSocket = socket;
    socket = null;
    if (currentSocket && currentSocket.readyState < WebSocket.CLOSING) currentSocket.close(1000, '사용자 설정 변경');
    setConnectionState('disconnected', { url: websocketUrl });
  }

  function connect(requestedUrl) {
    if (requestedUrl) websocketUrl = requestedUrl;
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      if (socket.url === websocketUrl) {
        console.info('[GPS WebSocket] 이미 연결 중이거나 연결되어 있습니다.');
        return;
      }
      disconnect();
    }
    shouldReconnect = true;
    const url = websocketUrl;
    const generation = ++connectionGeneration;
    reconnectAttempt += 1;
    setConnectionState('connecting', { url, attempt: reconnectAttempt });
    console.info(`[GPS WebSocket] 연결 시도 (${reconnectAttempt}회): ${url}`);

    socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      reconnectAttempt = 0;
      setConnectionState('connected', { url });
      console.info(`[GPS WebSocket] 연결 성공: ${url}`);
    });
    socket.addEventListener('message', event => {
      try {
        const data = JSON.parse(event.data);
        writeSocketLog(data?.type === 'gps' ? 'data' : 'info', 'WebSocket 메시지 수신', data);
        if (data?.type === 'connection') {
          console.info('[GPS WebSocket] 서버 연결 확인:', data);
          return;
        }
        receive(data);
      }
      catch (error) { 
        writeSocketLog('error', 'WebSocket 메시지 JSON 처리 실패', { message: error.message, raw: String(event.data).slice(0, 500) });
        console.warn('[GPS 실시간] 메시지 오류:', error); 
      }
    });
    socket.addEventListener('close', event => {
      if (generation !== connectionGeneration) return;
      const reason = event.reason || '이유 없음';
      setConnectionState('disconnected', {
        code: event.code,
        reason,
        clean: event.wasClean
      });
      console.warn(
        `[GPS WebSocket] 연결 종료: code=${event.code}, reason=${reason}, 정상종료=${event.wasClean}`
      );
      socket = null;
      clearTimeout(reconnectTimer);
      if (!shouldReconnect) return;
      console.info('[GPS WebSocket] 3초 후 재연결합니다.');
      reconnectTimer = setTimeout(() => connect(websocketUrl), 3000);
    });
    socket.addEventListener('error', event => {
      setConnectionState('error', { url });
      console.error(`[GPS WebSocket] 연결 오류: ${url}`, event);
      socket?.close();
    });
  }

  function setMode(nextMode) {
    if (!['websocket', 'mqtt', 'both', 'off'].includes(nextMode)) return false;
    mode = nextMode;
    refreshAllMarkers();
    document.dispatchEvent(new CustomEvent('gps-receive-mode-changed', { detail: { mode } }));
    return true;
  }

  // 사용자가 지도에서 GPS 장비 마커를 선택하면 해당 위치로 이동합니다.
  window.CesiumViewer?.selectedEntityChanged?.addEventListener(entity => {
    if (entity?.customData?.isRealtimeGpsDevice) flyToDevice(entity);
  });

  // Scene 모드 전환 뒤 Cesium이 표시 객체를 다시 구성하므로 GPS 마커의
  // 위치와 show 상태를 재적용하여 2D/3D 모두에서 계속 보이게 합니다.
  window.CesiumViewer?.scene?.morphComplete?.addEventListener(() => {
    refreshAllMarkers();
    requestAnimationFrame(refreshAllMarkers);
  });

  connect();
  return {
    setMode,
    getMode: () => mode,
    getConnectionState: () => connectionState,
    reconnect: connect,
    configure: function (options = {}) {
      const url = String(options.url || '').trim();
      if (!/^wss?:\/\/[^\s/]+(?::\d+)?\/[^\s]+$/i.test(url)) return false;
      disconnect();
      websocketUrl = url;
      if (options.autoConnect !== false) connect(url);
      return true;
    },
    disconnect,
    getUrl: () => websocketUrl,
    receive
  };
})();
