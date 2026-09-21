/** MQTT/WebSocket 다중 장비 GPS를 Cesium에 표시하는 모듈 */
window.realtimeGps = (function () {
  const devices = new Map();
  const DEVICE_COLORS_KEY = 'webcop-gps-device-colors';
  const autoColors = ['#00cfff', '#ff9f43', '#72e572', '#e879f9', '#ffe066', '#ff6b6b', '#a78bfa', '#2dd4bf'];
  const deviceColors = new Map();
  const RAT_COLORS_KEY = 'webcop-gps-rat-colors';
  const defaultRatColors = { '5G': '#00cfff', 'D2D': '#72e572', 'X위성': '#ff9f43', 'L위성': '#e879f9', 'RAT 없음': '#ffe066' };
  let ratColors = { ...defaultRatColors };
  try {
    const saved = JSON.parse(localStorage.getItem(RAT_COLORS_KEY) || '{}');
    Object.keys(defaultRatColors).forEach(rat => {
      if (/^#[0-9a-f]{6}$/i.test(saved?.[rat])) ratColors[rat] = saved[rat];
    });
  } catch (error) { console.warn('[GPS 색상] 통신 유형 설정 읽기 실패:', error); }

  function normalizeRat(rat) {
    const key = String(rat || '').replace(/\s+/g, '').toLowerCase();
    if (!key || key === 'rat없음') return 'RAT 없음';
    return { '5g': '5G', 'd2d': 'D2D', 'x위성': 'X위성', 'l위성': 'L위성' }[key] || '';
  }

  function getRatColor(rat) {
    return ratColors[normalizeRat(rat)] || null;
  }

  function setRatColors(colors) {
    const next = {};
    for (const rat of Object.keys(defaultRatColors)) {
      if (!/^#[0-9a-f]{6}$/i.test(colors?.[rat])) return false;
      next[rat] = colors[rat].toLowerCase();
    }
    try { localStorage.setItem(RAT_COLORS_KEY, JSON.stringify(next)); }
    catch (error) { console.warn('[GPS 색상] 통신 유형 설정 저장 실패:', error); return false; }
    ratColors = next;
    refreshAllMarkers();
    document.dispatchEvent(new CustomEvent('gps-rat-colors-changed'));
    return true;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_COLORS_KEY) || '{}');
    Object.entries(saved || {}).forEach(([id, color]) => {
      if (/^#[0-9a-f]{6}$/i.test(color)) deviceColors.set(id, color);
    });
  } catch (error) { console.warn('[GPS 색상] 저장된 설정 읽기 실패:', error); }

  function getDeviceColor(deviceId, rat) {
    const id = String(deviceId);
    if (rat === undefined) {
      const record = devices.get(deviceId) || devices.get(id);
      if (record) rat = getLatestAllowed(record)?.rat;
    }
    const ratColor = getRatColor(rat);
    if (ratColor) return ratColor;
    if (deviceColors.has(id)) return deviceColors.get(id);
    let hash = 0;
    for (const character of id) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
    return autoColors[hash % autoColors.length];
  }

  function getDeviceIds() {
    return Array.from(devices.keys(), String).sort();
  }

  function clearDevices() {
    const viewer = window.CesiumViewer;
    devices.forEach(record => {
      if (viewer?.selectedEntity === record.entity) viewer.selectedEntity = undefined;
      if (viewer?.trackedEntity === record.entity) viewer.trackedEntity = undefined;
      viewer?.entities.remove(record.entity);
    });
    devices.clear();
    hasMovedToFirstGps = false;
    viewer?.scene.requestRender();
    document.dispatchEvent(new CustomEvent('gps-device-list-changed', { detail: { cleared: true } }));
  }

  function setDeviceColor(deviceId, color) {
    const id = String(deviceId ?? '').trim();
    if (!id || (color !== null && !/^#[0-9a-f]{6}$/i.test(color))) return false;
    const next = new Map(deviceColors);
    if (color === null) next.delete(id);
    else next.set(id, color.toLowerCase());
    try {
      localStorage.setItem(DEVICE_COLORS_KEY, JSON.stringify(Object.fromEntries(next)));
    } catch (error) {
      console.warn('[GPS 색상] 설정 저장 실패:', error);
      return false;
    }
    deviceColors.clear();
    next.forEach((value, key) => deviceColors.set(key, value));
    refreshAllMarkers();
    document.dispatchEvent(new CustomEvent('gps-device-colors-changed'));
    return true;
  }
  let socket = null;
  let reconnectTimer = null;
  let mode = 'websocket';
  let hasMovedToFirstGps = false;
  let connectionState = 'disconnected';
  let reconnectAttempt = 0;
  let connectionGeneration = 0;
  let shouldReconnect = true;
  let processingPaused = false;

  function setPaused(paused) {
    processingPaused = Boolean(paused);
    document.dispatchEvent(new CustomEvent('gps-processing-state-changed', {
      detail: { paused: processingPaused }
    }));
    writeSocketLog('info', processingPaused
      ? '데이터 처리 중지: 연결은 유지하며 수신 GPS 데이터를 무시합니다.'
      : '데이터 처리 재시작: 이후 수신되는 GPS 데이터부터 처리합니다.');
  }
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
      .sort((a, b) => b.timestamp - a.timestamp)[0] || record.manual || null;
  }

  function createEntity(deviceId) {
    const entity = window.CesiumViewer.entities.add({
      id: `realtime-gps-${deviceId}`,
      name: `GPS 장비 ${deviceId}`,
      show: false,
      position: Cesium.Cartesian3.ZERO,
      point: {
        pixelSize: 13,
        color: Cesium.Color.fromCssColorString(getDeviceColor(deviceId)),
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
    record.entity.show = Boolean(data) && (mode !== 'off' || data.source === 'manual');
    if (!data || (mode === 'off' && data.source !== 'manual')) return;

    record.entity.position = Cesium.Cartesian3.fromDegrees(
      data.longitude, data.latitude, data.altitude
    );
    record.entity.point.color = Cesium.Color.fromCssColorString(getDeviceColor(data.deviceId, data.rat));
    const heightReference = data.source === 'manual' && data.clampToGround
      ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE;
    record.entity.point.heightReference = heightReference;
    record.entity.label.heightReference = heightReference;
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

  function setManualDevice(input = {}) {
    const id = String(input.deviceId || '').trim();
    const latText = String(input.latitude ?? '').trim();
    const lonText = String(input.longitude ?? '').trim();
    const altitudeText = String(input.altitude ?? '').trim();
    const latitude = Number(latText), longitude = Number(lonText);
    const altitude = altitudeText ? Number(altitudeText) : 0;
    if (!id || !latText || !lonText || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(altitude)) return false;
    let record = devices.get(id);
    if (!record) {
      record = { entity: createEntity(id), sources: {} };
      devices.set(id, record);
    }
    record.manual = { deviceId: id, latitude, longitude, altitude, rat: String(input.rat || '').trim(),
      source: 'manual', clampToGround: !altitudeText, timestamp: Date.now() };
    refreshAllMarkers();
    document.dispatchEvent(new CustomEvent('gps-device-list-changed'));
    return true;
  }

  function removeManualDevice(deviceId) {
    const id = String(deviceId || '').trim();
    const record = devices.get(id);
    if (!record?.manual) return false;
    delete record.manual;
    if (!Object.keys(record.sources).length) {
      const viewer = window.CesiumViewer;
      if (viewer.selectedEntity === record.entity) viewer.selectedEntity = undefined;
      if (viewer.trackedEntity === record.entity) viewer.trackedEntity = undefined;
      viewer.entities.remove(record.entity);
      devices.delete(id);
    }
    refreshAllMarkers();
    document.dispatchEvent(new CustomEvent('gps-device-list-changed'));
    return true;
  }

  function receive(data) {
    // 중지 중 들어온 데이터는 저장하지 않는다. 재시작 시 재생할 버퍼도 없다.
    if (processingPaused) return;
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
      document.dispatchEvent(new CustomEvent('gps-device-list-changed'));
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
    clearDevices();
    setPaused(false);
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
      if (generation !== connectionGeneration) return;
      reconnectAttempt = 0;
      setConnectionState('connected', { url });
      console.info(`[GPS WebSocket] 연결 성공: ${url}`);
    });
    socket.addEventListener('message', event => {
      if (generation !== connectionGeneration || !shouldReconnect) return;
      try {
        const data = JSON.parse(event.data);
        if (processingPaused && data?.type === 'gps') return;
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
      connectionGeneration += 1;
      clearDevices();
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
      if (generation !== connectionGeneration) return;
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
    setManualDevice,
    removeManualDevice,
    getRatColor,
    setRatColors,
    resetRatColors: () => setRatColors(defaultRatColors),
    setPaused,
    isPaused: () => processingPaused,
    getDeviceIds,
    getDeviceColor,
    setDeviceColor,
    resetDeviceColor: deviceId => setDeviceColor(deviceId, null),
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
