/* global Cesium, CesiumViewer */
/**
 * Cesium airspace drawing/editor.
 *
 * Usage: load this script after CesiumViewer has been created. The toolbar is
 * created automatically. Public API: window.airspace.exportJson(),
 * window.airspace.importJson(data), window.airspace.startDrawing(type), ...
 */
window.airspace = (function () {
  "use strict";

  const viewer = window.CesiumViewer;
  if (!viewer || !window.Cesium) {
    console.error("airspace.js: CesiumViewer 또는 Cesium을 찾을 수 없습니다.");
    return {};
  }

  const VERSION = 1;
  const shapes = new Map();
  const entities = [];
  let selectedId = null;
  let drawing = null;
  let previewEntity = null;
  let editHandles = [];
  let draggedHandle = null;
  let idSequence = 0;

  const drawHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const editHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  const defaults = {
    name: "새 공역",
    baseHeight: 0,
    topHeight: 1000,
    color: "#00bfff",
    opacity: 0.35,
    width: 80,
    radius: 500
  };

  function uid() {
    idSequence += 1;
    return "airspace-" + Date.now().toString(36) + "-" + idSequence;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function valueOf(property) {
    return property && typeof property.getValue === "function"
      ? property.getValue(viewer.clock.currentTime)
      : property;
  }

  function colorFromCss(css, opacity) {
    return Cesium.Color.fromCssColorString(css || defaults.color)
      .withAlpha(Number.isFinite(Number(opacity)) ? Number(opacity) : defaults.opacity);
  }

  function outlineColor(css) {
    return Cesium.Color.fromCssColorString(css || defaults.color).brighten(0.25, new Cesium.Color());
  }

  function cartesian(point, height) {
    return Cesium.Cartesian3.fromDegrees(Number(point[0]), Number(point[1]), Number(height || 0));
  }

  function degrees(position) {
    const c = Cesium.Cartographic.fromCartesian(position);
    return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
  }

  function pickGlobe(screenPosition) {
    const scene = viewer.scene;
    let result;
    if (scene.pickPositionSupported) {
      result = scene.pickPosition(screenPosition);
    }
    if (!Cesium.defined(result)) {
      result = scene.globe.pick(viewer.camera.getPickRay(screenPosition), scene);
    }
    return result;
  }

  function geodesicDistance(a, b) {
    const ca = Cesium.Cartographic.fromDegrees(a[0], a[1]);
    const cb = Cesium.Cartographic.fromDegrees(b[0], b[1]);
    const g = new Cesium.EllipsoidGeodesic(ca, cb);
    return g.surfaceDistance;
  }

  function midpoint(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function normalizeShape(input) {
    const s = Object.assign({}, defaults, clone(input || {}));
    s.id = String(s.id || uid());
    s.type = String(s.type || "polygon").toLowerCase();
    s.name = String(s.name || defaults.name);
    s.points = Array.isArray(s.points) ? s.points.map(function (p) {
      if (Array.isArray(p)) return [Number(p[0]), Number(p[1])];
      if (p && Array.isArray(p.position)) return [Number(p.position[0]), Number(p.position[1])];
      return null;
    }).filter(Boolean) : [];
    s.center = Array.isArray(s.center) ? [Number(s.center[0]), Number(s.center[1])] : null;
    s.radius = Math.max(1, Number(s.radius) || defaults.radius);
    s.width = Math.max(1, Number(s.width) || defaults.width);
    s.baseHeight = Number(s.baseHeight ?? s.height ?? 0);
    s.topHeight = Number(s.topHeight ?? s.extrudedHeight ?? s.extrusionHeight ?? defaults.topHeight);
    if (s.topHeight < s.baseHeight) [s.baseHeight, s.topHeight] = [s.topHeight, s.baseHeight];
    s.opacity = Math.min(1, Math.max(0.05, Number(s.opacity) || defaults.opacity));
    s.color = String(s.color || defaults.color);
    return s;
  }

  function entityCommon(shape) {
    return {
      id: shape.id,
      name: shape.name,
      description: shape.type + " / " + shape.baseHeight + "m ~ " + shape.topHeight + "m",
      properties: { airspaceId: shape.id, airspaceType: shape.type }
    };
  }

  function circlePositions(center, radius, count) {
    const result = [];
    const origin = cartesian(center, 0);
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
    for (let i = 0; i < (count || 96); i += 1) {
      const angle = i * Cesium.Math.TWO_PI / (count || 96);
      const local = new Cesium.Cartesian3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      result.push(degrees(Cesium.Matrix4.multiplyByPoint(transform, local, new Cesium.Cartesian3())));
    }
    return result;
  }

  function rectanglePositions(points) {
    if (points.length < 2) return points;
    const a = points[0];
    const b = points[1];
    return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
  }

  function renderShape(input) {
    const shape = normalizeShape(input);
    removeEntityOnly(shape.id);
    shapes.set(shape.id, shape);
    const common = entityCommon(shape);
    const fill = colorFromCss(shape.color, shape.opacity);
    const line = outlineColor(shape.color);
    let entity;

    if (shape.type === "point") {
      const length = Math.max(0.1, shape.topHeight - shape.baseHeight);
      entity = viewer.entities.add(Object.assign(common, {
        position: cartesian(shape.points[0], shape.baseHeight + length / 2),
        cylinder: {
          length: length,
          topRadius: shape.radius,
          bottomRadius: shape.radius,
          material: fill,
          outline: true,
          outlineColor: line,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        }
      }));
    } else {
      let footprint = shape.points;
      if (shape.type === "rectangle") footprint = rectanglePositions(shape.points);
      if (shape.type === "circle") footprint = circlePositions(shape.center, shape.radius);
      if (shape.type === "line" || shape.type === "polyline") {
        entity = viewer.entities.add(Object.assign(common, {
          corridor: {
            positions: footprint.map(function (p) { return cartesian(p, shape.baseHeight); }),
            width: shape.width,
            height: shape.baseHeight,
            extrudedHeight: shape.topHeight,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            material: fill,
            outline: true,
            outlineColor: line
          }
        }));
      } else {
        entity = viewer.entities.add(Object.assign(common, {
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(footprint.map(function (p) { return cartesian(p, shape.baseHeight); })),
            height: shape.baseHeight,
            extrudedHeight: shape.topHeight,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            material: fill,
            outline: true,
            outlineColor: line,
            closeTop: true,
            closeBottom: true
          }
        }));
      }
    }
    entities.push(entity);
    if (selectedId === shape.id) showEditHandles(shape);
    return entity;
  }

  function removeEntityOnly(id) {
    const old = viewer.entities.getById(id);
    if (old) viewer.entities.remove(old);
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      if (entities[i].id === id) entities.splice(i, 1);
    }
  }

  function deleteShape(id) {
    const target = id || selectedId;
    if (!target) return;
    removeEntityOnly(target);
    shapes.delete(target);
    if (selectedId === target) selectShape(null);
  }

  function clearAll() {
    Array.from(shapes.keys()).forEach(removeEntityOnly);
    shapes.clear();
    selectShape(null);
  }

  function handlePoints(shape) {
    if (shape.type === "circle") {
      const edge = circlePositions(shape.center, shape.radius, 4)[0];
      return [{ kind: "center", point: shape.center }, { kind: "radius", point: edge }];
    }
    return shape.points.map(function (p, index) { return { kind: "point", index: index, point: p }; });
  }

  function clearEditHandles() {
    editHandles.forEach(function (e) { viewer.entities.remove(e); });
    editHandles = [];
  }

  function showEditHandles(shape) {
    clearEditHandles();
    handlePoints(shape).forEach(function (h) {
      editHandles.push(viewer.entities.add({
        position: cartesian(h.point, shape.topHeight),
        point: {
          pixelSize: 12,
          color: h.kind === "radius" ? Cesium.Color.ORANGE : Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        },
        properties: { editHandle: true, shapeId: shape.id, kind: h.kind, index: h.index ?? -1 }
      }));
    });
  }

  function selectShape(id) {
    selectedId = id && shapes.has(id) ? id : null;
    if (selectedId) showEditHandles(shapes.get(selectedId));
    else clearEditHandles();
    syncPanel();
  }

  function pickedProperty(entity, name) {
    return entity && entity.properties ? valueOf(entity.properties[name]) : undefined;
  }

  function installEditing() {
    editHandler.setInputAction(function (movement) {
      if (drawing) return;
      const picked = viewer.scene.pick(movement.position);
      if (!Cesium.defined(picked) || !picked.id) {
        selectShape(null);
        return;
      }
      if (pickedProperty(picked.id, "editHandle")) {
        draggedHandle = {
          entity: picked.id,
          shapeId: pickedProperty(picked.id, "shapeId"),
          kind: pickedProperty(picked.id, "kind"),
          index: Number(pickedProperty(picked.id, "index"))
        };
        viewer.scene.screenSpaceCameraController.enableRotate = false;
        return;
      }
      const id = pickedProperty(picked.id, "airspaceId") || picked.id.id;
      selectShape(shapes.has(id) ? id : null);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    editHandler.setInputAction(function (movement) {
      if (!draggedHandle) return;
      const world = pickGlobe(movement.endPosition);
      if (!world) return;
      const p = degrees(world);
      const shape = shapes.get(draggedHandle.shapeId);
      if (!shape) return;
      if (draggedHandle.kind === "center") shape.center = p;
      else if (draggedHandle.kind === "radius") shape.radius = geodesicDistance(shape.center, p);
      else shape.points[draggedHandle.index] = p;
      renderShape(shape);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    editHandler.setInputAction(function () {
      if (!draggedHandle) return;
      draggedHandle = null;
      viewer.scene.screenSpaceCameraController.enableRotate = true;
      if (selectedId) showEditHandles(shapes.get(selectedId));
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
  }

  function preview(points, cursor) {
    if (previewEntity) viewer.entities.remove(previewEntity);
    const list = cursor ? points.concat([cursor]) : points.slice();
    if (!list.length) return;
    previewEntity = viewer.entities.add({
      polyline: {
        positions: list.map(function (p) { return cartesian(p, 0); }),
        clampToGround: true,
        width: 3,
        material: Cesium.Color.YELLOW
      },
      point: list.length === 1 ? { pixelSize: 10, color: Cesium.Color.YELLOW } : undefined,
      position: list.length === 1 ? cartesian(list[0], 0) : undefined
    });
  }

  function stopDrawing() {
    drawing = null;
    if (previewEntity) viewer.entities.remove(previewEntity);
    previewEntity = null;
    viewer.canvas.style.cursor = "default";
    drawHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    drawHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    drawHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    drawHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    setStatus("선택 또는 그리기 도구를 사용하세요.");
  }

  function finishDrawing() {
    if (!drawing) return;
    const type = drawing.type;
    const points = drawing.points;
    const minimum = type === "point" ? 1 : (type === "polygon" ? 3 : 2);
    if (points.length < minimum) {
      setStatus("점이 부족합니다. 계속 클릭하거나 Esc로 취소하세요.");
      return;
    }
    const panel = panelValues();
    const shape = Object.assign({}, panel, { id: uid(), type: type, points: points });
    if (type === "circle") {
      shape.center = points[0];
      shape.radius = geodesicDistance(points[0], points[1]);
      shape.points = [];
    }
    const entity = renderShape(shape);
    stopDrawing();
    selectShape(entity.id);
  }

  function startDrawing(type) {
    stopDrawing();
    selectShape(null);
    drawing = { type: type, points: [] };
    viewer.canvas.style.cursor = "crosshair";
    setStatus(type + " 그리기: 좌클릭으로 점 추가, 우클릭/더블클릭으로 완료, Esc로 취소");

    drawHandler.setInputAction(function (click) {
      const world = pickGlobe(click.position);
      if (!world || !drawing) return;
      drawing.points.push(degrees(world));
      preview(drawing.points);
      if (type === "point") finishDrawing();
      if ((type === "line" || type === "rectangle" || type === "circle") && drawing && drawing.points.length === 2) finishDrawing();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    drawHandler.setInputAction(function (movement) {
      if (!drawing || !drawing.points.length) return;
      const world = pickGlobe(movement.endPosition);
      if (world) preview(drawing.points, degrees(world));
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    drawHandler.setInputAction(finishDrawing, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    if (type === "polyline" || type === "polygon") {
      drawHandler.setInputAction(finishDrawing, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
  }

  function panelValues() {
    const q = function (id) { return document.getElementById(id); };
    return normalizeShape({
      name: q("as-name").value,
      baseHeight: q("as-base").value,
      topHeight: q("as-top").value,
      width: q("as-width").value,
      radius: q("as-radius").value,
      color: q("as-color").value,
      opacity: q("as-opacity").value
    });
  }

  function applyPanel() {
    if (!selectedId) return;
    const old = shapes.get(selectedId);
    const values = panelValues();
    ["name", "baseHeight", "topHeight", "width", "radius", "color", "opacity"].forEach(function (key) {
      old[key] = values[key];
    });
    renderShape(old);
    syncPanel();
  }

  function syncPanel() {
    const shape = selectedId ? shapes.get(selectedId) : defaults;
    const set = function (id, value) {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = value;
    };
    set("as-name", shape.name);
    set("as-base", shape.baseHeight);
    set("as-top", shape.topHeight);
    set("as-width", shape.width);
    set("as-radius", shape.radius);
    set("as-color", shape.color);
    set("as-opacity", shape.opacity);
    const label = document.getElementById("as-selected");
    if (label) label.textContent = selectedId ? "선택: " + shape.name + " (핸들 드래그로 편집)" : "선택된 도형 없음";
  }

  function exportJson() {
    return { format: "cesium-airspace", version: VERSION, shapes: Array.from(shapes.values()).map(clone) };
  }

  function downloadJson(filename) {
    const blob = new Blob([JSON.stringify(exportJson(), null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "airspace-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(data, options) {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.shapes;
    if (!Array.isArray(list)) throw new Error("JSON에 shapes 배열이 없습니다.");
    if (!options || options.replace !== false) clearAll();
    list.forEach(function (item) {
      try { renderShape(item); } catch (error) { console.warn("도형을 불러오지 못했습니다.", item, error); }
    });
    setStatus(list.length + "개 도형을 불러왔습니다.");
    return list.length;
  }

  function loadJson(url, options) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("JSON 로드 실패: " + response.status);
      return response.json();
    }).then(function (data) { return importJson(data, options); });
  }

  function setStatus(message) {
    const el = document.getElementById("as-status");
    if (el) el.textContent = message;
  }

  function createToolbar() {
    if (document.getElementById("airspace-editor")) return;
    const style = document.createElement("style");
    style.textContent = "#airspace-editor{position:absolute;z-index:1000;top:12px;left:12px;width:320px;background:rgba(25,29,34,.94);color:#fff;padding:12px;border-radius:8px;font:13px/1.35 Arial,sans-serif;box-shadow:0 2px 14px #0008}#airspace-editor .as-header{display:flex;align-items:center;justify-content:space-between;margin:-12px -12px 8px;padding:9px 10px 8px 12px;border-bottom:1px solid #ffffff2b;cursor:move;user-select:none}#airspace-editor .as-close{font-size:18px;line-height:20px;width:28px;height:26px;padding:0;background:#552f35;border-color:#8d5961;cursor:pointer}#airspace-editor .as-row{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap}#airspace-editor button{background:#394651;color:#fff;border:1px solid #697985;border-radius:4px;padding:5px 8px;cursor:pointer}#airspace-editor button:hover{background:#247ba0}#airspace-editor label{display:flex;align-items:center;gap:5px;flex:1;min-width:140px}#airspace-editor input{width:82px;background:#15191d;color:#fff;border:1px solid #65717b;border-radius:3px;padding:4px}#airspace-editor input[type=text]{width:220px}#airspace-editor input[type=color]{width:38px;padding:1px}#as-status{color:#ffd166;min-height:18px}#as-selected{color:#8ee3ef}";
    document.head.appendChild(style);
    const box = document.createElement("div");
    box.id = "airspace-editor";
    box.style.display = "none";
    box.innerHTML = '<div class="as-header"><strong>공역 도형 편집기</strong><button class="as-close" type="button" title="닫기" aria-label="공역 편집기 닫기">&times;</button></div>' +
      '<div class="as-row"><button data-draw="point">점/기둥</button><button data-draw="line">라인</button><button data-draw="polyline">폴리라인</button><button data-draw="polygon">폴리곤</button><button data-draw="rectangle">사각형</button><button data-draw="circle">원</button></div>' +
      '<div class="as-row"><label>이름 <input id="as-name" type="text" value="새 공역"></label></div>' +
      '<div class="as-row"><label>하단 높이(m) <input id="as-base" type="number" value="0"></label><label>상단 높이(m) <input id="as-top" type="number" value="1000"></label></div>' +
      '<div class="as-row"><label>라인 폭(m) <input id="as-width" type="number" min="1" value="80"></label><label>기둥 반경(m) <input id="as-radius" type="number" min="1" value="500"></label></div>' +
      '<div class="as-row"><label>색상 <input id="as-color" type="color" value="#00bfff"></label><label>투명도 <input id="as-opacity" type="number" min="0.05" max="1" step="0.05" value="0.35"></label></div>' +
      '<div id="as-selected">선택된 도형 없음</div><div id="as-status">선택 또는 그리기 도구를 사용하세요.</div>' +
      '<div class="as-row"><button id="as-apply">속성 적용</button><button id="as-delete">선택 삭제</button><button id="as-save">JSON 저장</button><button id="as-load">JSON 불러오기</button><button id="as-clear">전체 삭제</button><input id="as-file" type="file" accept="application/json,.json" hidden></div>';
    const container = viewer.container || document.body;
    container.appendChild(box);
    box.querySelectorAll("[data-draw]").forEach(function (button) {
      button.addEventListener("click", function () { startDrawing(button.dataset.draw); });
    });
    document.getElementById("as-apply").addEventListener("click", applyPanel);
    document.getElementById("as-delete").addEventListener("click", function () { deleteShape(); });
    document.getElementById("as-save").addEventListener("click", function () { downloadJson(); });
    document.getElementById("as-load").addEventListener("click", function () { document.getElementById("as-file").click(); });
    document.getElementById("as-clear").addEventListener("click", function () { if (window.confirm("모든 공역 도형을 삭제할까요?")) clearAll(); });
    box.querySelector(".as-close").addEventListener("click", hidePanel);
    document.getElementById("as-file").addEventListener("change", function (event) {
      const file = event.target.files[0];
      if (!file) return;
      file.text().then(function (text) { importJson(text); }).catch(function (error) { window.alert(error.message); });
      event.target.value = "";
    });
    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") stopDrawing();
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !/INPUT|TEXTAREA/.test(event.target.tagName)) deleteShape();
    });
    installPanelDragging(box);
  }

  function installPanelDragging(panel) {
    const header = panel.querySelector(".as-header");
    let dragState = null;

    header.addEventListener("mousedown", function (event) {
      if (event.button !== 0 || event.target.closest("button,input,select,textarea")) return;
      const rect = panel.getBoundingClientRect();
      dragState = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      event.preventDefault();
    });

    window.addEventListener("mousemove", function (event) {
      if (!dragState) return;
      const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
      panel.style.left = Math.min(maxLeft, Math.max(0, event.clientX - dragState.offsetX)) + "px";
      panel.style.top = Math.min(maxTop, Math.max(0, event.clientY - dragState.offsetY)) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });

    window.addEventListener("mouseup", function () { dragState = null; });
  }

  createToolbar();
  installEditing();

  function showPanel() {
    const panel = document.getElementById("airspace-editor");
    if (panel) panel.style.display = "block";
  }

  function hidePanel() {
    const panel = document.getElementById("airspace-editor");
    if (panel) panel.style.display = "none";
    stopDrawing();
  }

  function togglePanel() {
    const panel = document.getElementById("airspace-editor");
    if (!panel) return;
    if (panel.style.display === "none") showPanel();
    else hidePanel();
  }

  return {
    showPanel: showPanel,
    hidePanel: hidePanel,
    togglePanel: togglePanel,
    startDrawing: startDrawing,
    stopDrawing: stopDrawing,
    select: selectShape,
    remove: deleteShape,
    clear: clearAll,
    exportJson: exportJson,
    downloadJson: downloadJson,
    importJson: importJson,
    loadJson: loadJson,
    getShapes: function () { return Array.from(shapes.values()).map(clone); }
  };
}());
