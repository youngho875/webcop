/**
 * CesiumJS GPS 빌보드 위치 표시 및 카메라 추적 모듈
 *
 * 사용법:
 * window.gps.gpsStart();
 * window.gps.gpsEnd();
 * window.gps.followStart();
 * window.gps.followEnd();
 * window.gps.destroy();
 */
window.gps = (function () {
  const ENTITY_ID = "current-gps-position";

  let viewer = null;
  let gpsEntity = null;
  let watchId = null;
  let isFirstPosition = true;
  // 기본값은 자유 카메라입니다. followStart()를 호출할 때만 GPS를 추적합니다.
  let followEnabled = false;

  function getViewer() {
    const cesiumViewer = window.CesiumViewer;

    if (!cesiumViewer?.entities || !cesiumViewer?.camera) {
      console.error(
        "window.CesiumViewer가 생성되지 않았습니다. " +
        "Cesium Viewer 생성 후 gpsStart()를 호출하세요."
      );
      return null;
    }

    return cesiumViewer;
  }

  /** 외부 이미지 파일 없이 사용하는 GPS 핀 SVG */
  function createGpsPinImage() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">
        <path d="M24 1C11.3 1 1 11.3 1 24c0 17.3 23 39 23 39s23-21.7 23-39C47 11.3 36.7 1 24 1z"
              fill="#e53935" stroke="#ffffff" stroke-width="3"/>
        <circle cx="24" cy="24" r="8" fill="#ffffff"/>
      </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function createGpsEntity() {
    if (gpsEntity) {
      return gpsEntity;
    }

    const oldEntity = viewer.entities.getById(ENTITY_ID);
    if (oldEntity) {
      viewer.entities.remove(oldEntity);
    }

    gpsEntity = viewer.entities.add({
      id: ENTITY_ID,
      name: "현재 GPS 위치",
      show: false,

      billboard: {
        image: createGpsPinImage(),
        width: 36,
        height: 48,

        // 핀 이미지의 아래쪽 중앙이 실제 GPS 좌표에 고정됩니다.
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: Cesium.Cartesian2.ZERO,
        eyeOffset: Cesium.Cartesian3.ZERO,

        // 지형·건물·지구 뒤에서 마커가 비쳐 보이지 않게 합니다.
        disableDepthTestDistance: 0,
      },

      label: {
        text: "현재 위치",
        font: "16px sans-serif",
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -54),
        disableDepthTestDistance: 0,
      },
    });

    return gpsEntity;
  }

  function handlePosition(position) {
    const coords = position?.coords;

    if (!coords) {
      console.error("GPS 좌표 정보가 없습니다.");
      return;
    }

    const {
      latitude,
      longitude,
      altitude,
      altitudeAccuracy,
      accuracy,
      speed,
      heading,
    } = coords;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.error("유효하지 않은 GPS 좌표입니다.", {
        latitude,
        longitude,
      });
      return;
    }

    const hasAltitude = Number.isFinite(altitude);
    const height = hasAltitude ? altitude : 0;
    const heightReference = hasAltitude
      ? Cesium.HeightReference.NONE
      : Cesium.HeightReference.CLAMP_TO_GROUND;

    // Entity의 위치는 항상 실제 경도/위도 좌표이며 카메라와 무관합니다.
    gpsEntity.position = Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      height
    );

    // GPS 고도가 없으면 지형 표면에 고정합니다.
    gpsEntity.billboard.heightReference = heightReference;
    gpsEntity.label.heightReference = heightReference;
    gpsEntity.show = true;

    updateGpsLabel({
      latitude,
      longitude,
      altitude,
      altitudeAccuracy,
      accuracy,
      speed,
      heading,
    });

    if (isFirstPosition) {
      isFirstPosition = false;

      // 최초 수신 때만 GPS 위치로 이동합니다. trackedEntity는 설정하지
      // 않으므로 이동 완료 후 사용자가 지도를 자유롭게 움직일 수 있습니다.
      viewer.flyTo(gpsEntity, {
        duration: 1.5,
        offset: new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(-60),
          1000
        ),
      });
    } else if (
      followEnabled &&
      viewer.trackedEntity !== gpsEntity
    ) {
      viewer.trackedEntity = gpsEntity;
    }

    console.log("GPS 위치 수신:", {
      latitude,
      longitude,
      altitude,
      altitudeAccuracy,
      accuracy,
      speed,
      heading,
      timestamp: position.timestamp,
    });
  }

  function updateGpsLabel(data) {
    if (!gpsEntity) {
      return;
    }

    const information = [
      "현재 위치",
      `위도: ${data.latitude.toFixed(6)}`,
      `경도: ${data.longitude.toFixed(6)}`,
    ];

    if (Number.isFinite(data.altitude)) {
      information.push(`고도: ${data.altitude.toFixed(1)} m`);

      if (Number.isFinite(data.altitudeAccuracy)) {
        information.push(
          `고도 정확도: 약 ${data.altitudeAccuracy.toFixed(1)} m`
        );
      }
    } else {
      information.push("고도: 수신 불가 (지형에 고정)");
    }

    if (Number.isFinite(data.accuracy)) {
      information.push(`정확도: 약 ${data.accuracy.toFixed(1)} m`);
    } else {
      information.push("정확도: 알 수 없음");
    }

    if (Number.isFinite(data.speed)) {
      information.push(`속도: ${(data.speed * 3.6).toFixed(1)} km/h`);
    }

    if (Number.isFinite(data.heading)) {
      information.push(`방향: ${data.heading.toFixed(1)}°`);
    }

    gpsEntity.label.text = information.join("\n");
  }

  function handlePositionError(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error(
          "위치 권한이 거부되었습니다. " +
          "브라우저 설정에서 위치 권한을 허용하세요.",
          error
        );
        stopGpsTracking();
        break;

      case error.POSITION_UNAVAILABLE:
        console.error(
          "현재 위치를 확인할 수 없습니다. " +
          "기기의 GPS와 위치 서비스를 확인하세요.",
          error
        );
        break;

      case error.TIMEOUT:
        console.warn(
          "GPS 요청 시간이 초과되었습니다. " +
          "다음 위치 수신을 기다립니다.",
          error
        );
        break;

      default:
        console.error(`GPS 오류: ${error.message || error.code}`, error);
    }
  }

  function startGpsTracking() {
    if (!window.isSecureContext) {
      console.error("GPS는 HTTPS 또는 localhost 환경에서만 사용할 수 있습니다.");
      return false;
    }

    if (!("geolocation" in navigator)) {
      console.error("이 브라우저는 Geolocation API를 지원하지 않습니다.");
      return false;
    }

    if (watchId !== null) {
      console.warn("GPS 추적이 이미 실행 중입니다.");
      return false;
    }

    viewer = getViewer();
    if (!viewer) {
      return false;
    }

    createGpsEntity();
    isFirstPosition = true;
    followEnabled = false;

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handlePositionError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );

    console.log("GPS 추적을 시작했습니다.");
    return true;
  }

  function stopGpsTracking(options = {}) {
    const { hideMarker = false, resetCameraMove = true } = options;

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (viewer && viewer.trackedEntity === gpsEntity) {
      viewer.trackedEntity = undefined;
    }

    if (hideMarker && gpsEntity) {
      gpsEntity.show = false;
    }

    if (resetCameraMove) {
      isFirstPosition = true;
    }

    console.log("GPS 추적을 종료했습니다.");
    return true;
  }

  function startCameraFollow() {
    followEnabled = true;

    if (!viewer) {
      viewer = getViewer();
    }

    if (!viewer || !gpsEntity) {
      console.warn("GPS 위치가 아직 수신되지 않았습니다.");
      return false;
    }

    const currentPosition = gpsEntity.position?.getValue(
      Cesium.JulianDate.now()
    );

    if (!currentPosition) {
      console.warn("GPS 위치가 아직 수신되지 않았습니다.");
      return false;
    }

    viewer.trackedEntity = gpsEntity;
    console.log("GPS 카메라 추적을 시작했습니다.");
    return true;
  }

  function stopCameraFollow() {
    followEnabled = false;

    if (viewer && viewer.trackedEntity === gpsEntity) {
      viewer.trackedEntity = undefined;
    }

    console.log("GPS 카메라 추적을 해제했습니다.");
    return true;
  }

  function destroy() {
    stopGpsTracking({ hideMarker: true, resetCameraMove: true });

    if (viewer && gpsEntity) {
      viewer.entities.remove(gpsEntity);
    }

    gpsEntity = null;
    viewer = null;
    isFirstPosition = true;
    followEnabled = false;

    console.log("GPS 엔티티를 삭제했습니다.");
  }

  function isRunning() {
    return watchId !== null;
  }

  function isFollowing() {
    return Boolean(
      followEnabled &&
      viewer &&
      gpsEntity &&
      viewer.trackedEntity === gpsEntity
    );
  }

  return {
    gpsStart: startGpsTracking,
    gpsEnd: stopGpsTracking,
    followStart: startCameraFollow,
    followEnd: stopCameraFollow,
    destroy,
    isRunning,
    isFollowing,
  };
})();
