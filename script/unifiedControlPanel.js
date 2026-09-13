window.unifiedControlPanel = (function () {
  // ==========================================
  // 전역 상태 관리
  // ==========================================
  const waypointsByEntity = new Map();   // Map<Entity, Array<{lon,lat,dur,height}>>
  const boundTimelines = new Map();      // Map<Entity, SampledPositionProperty>
  const lastSampleTime = new Map();      // Map<Entity, JulianDate>
  const entityListMap = new Map();       // Map<Entity, { id, name, lon, lat, heightText, checkbox, listItemDom }>

  let isInitialized = false;
  let currentSidc = "SFZ*-----------";
  let currentSymbolMetadata = {};
  let entityIdCounter = 1;
  let globalClickHandler = null;
  let symbolDropTarget = null;
  let symbolDragOverHandler = null;
  let symbolDropHandler = null;
  let multipointHandler = null;
  let multipointEntity = null;
  let liveTacticalEntity = null;
  let lastTacticalPreviewAt = 0;
  let multipointPositions = [];
  let multipointMousePosition = null;
  let savedDoubleClickAction = null;
  let lastMultipointClickAt = 0;
  let multipointRequirements = { min: 2, max: Infinity };
  let activeMultipointType = "line";
  let entityDragHandler = null;
  let entityDragCanvas = null;
  let entityDragState = null;

  // ==========================================
  // 1. UI 동적 생성 (통합 UI + 리스트박스)
  // ==========================================
  function createUnifiedUI() {
    if (document.getElementById("UnifiedControlModal")) return;

    const uiHTML = `
      <div id="UnifiedControlModal" class="unified-modal" style="display: none; position: fixed; top: 20px; left: 20px; z-index: 9999; background: white; border: 1px solid #ccc; padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); width: 380px; font-family: sans-serif; font-size: 13px; color: #333; box-sizing: border-box; user-select: none;">
        
        <!-- 헤더 -->
        <div id="unifiedHeader" style="background: #34495e; color: white; padding: 8px 12px; cursor: move; display: flex; justify-content: space-between; align-items: center; border-top-left-radius: 6px; border-top-right-radius: 6px; margin: -15px -15px 10px -15px;">
          <span style="font-weight: bold; font-size: 14px;">객체/관제 패널</span>
          <button id="btnUnifiedClose" style="background: transparent; border: none; color: white; font-size: 18px; cursor: pointer; font-weight: bold; line-height: 1;">&times;</button>
        </div>

        <!-- Tab 버튼 -->
        <div style="display: flex; border-bottom: 2px solid #ddd; margin-bottom: 12px;">
          <button id="tabBtnSymbol" style="flex: 1; padding: 8px; background: #e0e0e0; border: none; font-weight: bold; cursor: pointer; border-top-left-radius: 4px; border-top-right-radius: 4px;">군대 부호</button>
          <button id="tabBtnControl" style="flex: 1; padding: 8px; background: #fff; border: none; font-weight: bold; cursor: pointer; border-top-left-radius: 4px; border-top-right-radius: 4px;">객체/관제</button>
        </div>

        <!-- TAB 1: 군대 부호 -->
        <div id="tabContentSymbol" style="display: block;">
          <div style="margin-bottom: 6px; color: #555; font-size: 12px; text-align: center;">
            부호 선택 → 배치 전 속성 편집 → 적용 후 지도를 클릭하세요.
          </div>
          <div id="symbolList" style="display: flex; justify-content: center; align-items: center; margin-bottom: 10px; height: 90px; cursor: grab; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px;">
          </div>
          <div id="symbolSelectionInfo" style="min-height: 34px; margin: -4px 0 8px; color: #555; font-size: 11px; text-align: center; line-height: 1.45;"></div>

          <div style="display: flex; align-items: center; margin-bottom: 10px; font-size: 13px;">
            <label for="sympo2" style="margin-right: 10px; width: 60px;">피아식별</label>
            <select name="StandardIdentity/ExerciseDescriptor" id="sympo2" style="padding: 4px; background: #f4f4f4; border: 1px solid #d1d1d1; border-radius: 4px; font-size: 12px; flex-grow: 1; outline: none;">
              <option value="-">미지정</option>
              <option value="P">식별보류</option>
              <option value="U">미식별</option>
              <option value="F">아군</option>
              <option value="N">중립</option>
              <option value="H">적군</option>
              <option value="A">아군간주</option>
              <option value="S">적군간주</option>
              <option value="G">(훈)식별보류</option>
              <option value="W">(훈)미식별</option>
              <option value="D">(훈)아군</option>
              <option value="L">(훈)중립</option>
              <option value="M">(훈)아군간주</option>
              <option value="J">의심적</option>
              <option value="K">가상적</option>
            </select>
          </div>

          <div style="display: flex; gap: 5px; margin-bottom: 8px;">
            <input id="symbolTreeSearch" type="search" placeholder="한글·영문·약어로 부호 검색" aria-label="군대부호 검색" style="min-width: 0; flex: 1; padding: 6px 8px; border: 1px solid #d1d1d1; border-radius: 4px; font-size: 12px; outline: none;" />
            <button id="symbolTreeSearchClear" type="button" style="padding: 5px 9px; border: 1px solid #d1d1d1; border-radius: 4px; background: #f4f4f4; cursor: pointer;">초기화</button>
          </div>

          <div style="border: 1px solid #ccc; background: white; height: 320px; overflow: auto; padding: 5px;">
            <div id="layerTreeStatus" style="display: none; padding: 8px; color: #777; font-size: 12px;"></div>
            <div id="layerTree" style="font-size: 13px; color: #000;"></div>
          </div>
          <div style="position:sticky;bottom:0;background:white;padding-top:8px;display:flex;gap:6px;">
            <button id="editSelectedIcopSymbol" type="button" disabled style="flex:1;padding:7px;">배치 전 속성 편집</button>
          </div>
        </div>

        <!-- TAB 2: Cesium 객체 및 관제 -->
        <div id="tabContentControl" style="display: none;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 55px;">경도:</label>
              <input type="text" id="lng" value="126.9780" style="flex: 1; padding: 4px;" />
            </div>
            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 55px;">위도:</label>
              <input type="text" id="lat" value="37.5665" style="flex: 1; padding: 4px;" />
            </div>
            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 55px;">이름:</label>
              <input type="text" id="nameLabel" value="객체 1" style="flex: 1; padding: 4px;" />
            </div>

            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 55px;">객체:</label>
              <select id="shape" style="flex: 1; padding: 4px;">
                <option value="obstacle">장애물</option>
                <option value="sphere1">사람(적)</option>
                <option value="sphere2">사람(아군)</option>
                <option value="sphere3">사람(민간인)</option>
                <option value="billboard1">UGV(적)</option>
                <option value="billboard2">UGV(아군)</option>
                <option value="billboard3">대대(아군)</option>
              </select>
            </div>

            <!-- 장애물 수치 입력 -->
            <div id="boxFields" style="display: block; border-top: 1px dashed #ccc; padding-top: 5px;">
              <div style="display: flex; gap: 5px;">
                <span>가로: <input type="number" id="boxWidth" value="20" style="width: 40px; padding: 2px;" /></span>
                <span>세로: <input type="number" id="boxDepth" value="20" style="width: 40px; padding: 2px;" /></span>
                <span>높이: <input type="number" id="boxHeight" value="20" style="width: 40px; padding: 2px;" /></span>
              </div>
            </div>

            <button id="addBtn" style="padding: 6px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">등록</button>

            <!-- 리스트박스 영역 -->
            <div style="border: 1px solid #ccc; border-radius: 4px; padding: 6px; background: #fafafa; margin-top: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 4px;">
                <label style="font-weight: bold; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                  <input type="checkbox" id="selectAllCheckbox" /> 전체 선택/해제
                </label>
                <span style="font-size: 11px; color: #666;">등록 목록</span>
              </div>
              <div id="entityListBox" style="height: 110px; overflow-y: auto; background: white; border: 1px solid #eee; padding: 2px;">
              </div>
            </div>

            <!-- 웨이포인트 영역 -->
            <div style="font-weight: bold; margin-top: 2px;">웨이포인트 이동</div>
            <div style="display: flex; gap: 5px;">
              <input type="text" id="lonInput" placeholder="경도" style="width: 30%; padding: 4px;" />
              <input type="text" id="latInput" placeholder="위도" style="width: 30%; padding: 4px;" />
              <input type="number" id="durationInput" placeholder="초(s)" value="5" style="width: 30%; padding: 4px;" />
            </div>
            <div style="display: flex; gap: 5px;">
              <button id="addWaypointBtn" style="flex: 1; padding: 5px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">좌표 입력</button>
              <button id="startMoveBtn" style="flex: 1; padding: 5px; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer;">이동 실행</button>
            </div>

            <hr style="width: 100%; border: 0; border-top: 1px solid #eee; margin: 2px 0;" />

            <!-- 버튼 영역 -->
            <div style="display: flex; gap: 5px;">
              <button id="deleteBtn" style="flex: 1; padding: 5px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">선택 삭제</button>
              <button id="deleteAllBtn" style="flex: 1; padding: 5px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer;">전체 삭제</button>
            </div>
            <div style="display: flex; gap: 5px;">
              <button id="saveFileBtn" style="flex: 1; padding: 4px; background: #7f8c8d; color: white; border: none; border-radius: 4px; cursor: pointer;">파일 저장</button>
              <button id="loadFileBtn" style="flex: 1; padding: 4px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">파일 불러오기</button>
              <input type="file" id="fileInput" style="display: none;" accept=".json" />
            </div>
          </div>
        </div>

      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", uiHTML);

    document.getElementById("btnUnifiedClose").addEventListener("click", () => {
      cancelMultipointDrawing(true);
      toggleUI();
    });

    const tabBtnSymbol = document.getElementById("tabBtnSymbol");
    const tabBtnControl = document.getElementById("tabBtnControl");
    const tabContentSymbol = document.getElementById("tabContentSymbol");
    const tabContentControl = document.getElementById("tabContentControl");

    tabBtnSymbol.addEventListener("click", () => {
      tabContentSymbol.style.display = "block";
      tabContentControl.style.display = "none";
      tabBtnSymbol.style.background = "#e0e0e0";
      tabBtnControl.style.background = "#fff";
    });

    tabBtnControl.addEventListener("click", () => {
      cancelMultipointDrawing(true);
      tabContentSymbol.style.display = "none";
      tabContentControl.style.display = "block";
      tabBtnSymbol.style.background = "#fff";
      tabBtnControl.style.background = "#e0e0e0";
    });

    makeElementDraggable(
      document.getElementById("UnifiedControlModal"), 
      document.getElementById("unifiedHeader")
    );

    separateMilitarySymbolDialog(tabContentSymbol, tabBtnSymbol, tabBtnControl);
  }

  function separateMilitarySymbolDialog(symbolContent, symbolTabButton, controlTabButton) {
    if (!symbolContent || document.getElementById("MilitarySymbolDialog")) return;
    const controlContent = document.getElementById("tabContentControl");
    const tabBar = symbolTabButton?.parentElement;

    const dialog = document.createElement("div");
    dialog.id = "MilitarySymbolDialog";
    dialog.className = "unified-modal military-symbol-dialog";
    dialog.style.cssText = "display:none;position:fixed;top:70px;left:20px;z-index:10000;width:420px;max-height:calc(100vh - 90px);overflow:auto;box-sizing:border-box;padding:15px;border:1px solid #ccc;border-radius:8px;background:#fff;color:#333;box-shadow:0 4px 15px rgba(0,0,0,.2);font:13px sans-serif;user-select:none;";

    const header = document.createElement("div");
    header.id = "militarySymbolDialogHeader";
    header.style.cssText = "position:sticky;top:-15px;z-index:3;display:flex;align-items:center;justify-content:space-between;margin:-15px -15px 10px;padding:9px 12px;border-radius:7px 7px 0 0;background:#34495e;color:#fff;cursor:move;";
    const title = document.createElement("strong");
    title.textContent = "군대부호";
    const closeButton = document.createElement("button");
    closeButton.id = "btnMilitarySymbolClose";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "군대부호 창 닫기");
    closeButton.innerHTML = "&times;";
    closeButton.style.cssText = "border:0;background:transparent;color:#fff;font-size:20px;font-weight:bold;cursor:pointer;";
    closeButton.addEventListener("click", toggleMilitaryUI);
    header.append(title, closeButton);

    symbolContent.style.display = "block";
    dialog.append(header, symbolContent);
    document.body.appendChild(dialog);

    if (controlContent) controlContent.style.display = "block";
    if (tabBar) tabBar.remove();
    else {
      symbolTabButton?.remove();
      controlTabButton?.remove();
    }
    makeElementDraggable(dialog, header);
  }

  function makeElementDraggable(elmnt, dragHandle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    dragHandle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      if (e.target.closest?.('button')) return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      let newTop = elmnt.offsetTop - pos2;
      let newLeft = elmnt.offsetLeft - pos1;

      const maxLeft = window.innerWidth - elmnt.offsetWidth;
      const maxTop = window.innerHeight - elmnt.offsetHeight;

      elmnt.style.top = Math.max(0, Math.min(newTop, maxTop)) + "px";
      elmnt.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + "px";
      elmnt.style.right = "auto";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  function initSymbolLogic() {
    const symbolList = document.getElementById("symbolList");
    const sympo2 = document.getElementById("sympo2");

    if (!symbolList || !sympo2) return;

    function applyAffiliation(sidc, affiliation) {
      if (typeof sidc !== "string" || sidc.length !== 15 || sidc.startsWith("W")) return sidc;
      return sidc.substring(0, 1) + affiliation + sidc.substring(2);
    }

    function renderSymbol(sidc, metadata = currentSymbolMetadata) {
      symbolList.innerHTML = "";
      symbolList.style.height = "90px";
      currentSymbolMetadata = metadata || {};
      const info = document.getElementById("symbolSelectionInfo");
      const geometry = currentSymbolMetadata.geometry || "POINT";
      const renderer = currentSymbolMetadata.renderer || "milsymbol";
      const displayName = currentSymbolMetadata.text || currentSymbolMetadata.textEn || "군대부호";

      if (info) {
        info.textContent = `${displayName} · ${sidc || "SIDC 없음"}`;
      }

      if (!sidc || !["milsymbol","icop-svg"].includes(renderer) || geometry !== "POINT") {
        const guide = document.createElement("div");
        guide.style.cssText = "padding:10px; text-align:center; color:#555; line-height:1.5;";
        const title = document.createElement("strong");
        title.textContent = displayName;
        guide.appendChild(title);
        const hint = document.createElement("div");
        hint.textContent = "속성을 편집한 후 지도 배치를 시작하세요.";
        guide.appendChild(hint);
        symbolList.appendChild(guide);
        if (["LINE", "POLYGON", "MULTIPOINT"].includes(geometry)) {
          try {
            const state = currentSymbolMetadata.icopEditor || {name:displayName,values:{}};
            const geo = window.unifiedControlPanel.previewTactical(currentSymbolMetadata,null,state,sidc);
            if (!geo) throw new Error("미리보기를 생성할 수 없습니다.");
            guide.replaceChildren(window.IcopSymbolEditor.buildTacticalPreview(geo));
            guide.style.cssText = "width:100%;";
            symbolList.style.height = "130px";
          } catch(error) { hint.textContent = error.message; }

        }
        return;
      }

      if (multipointHandler) cancelMultipointDrawing(true);

      let symbolUrl = "";
      try {
        symbolUrl = currentSymbolMetadata.renderer === "icop-svg"
          ? window.IcopSvgRenderer.render(currentSymbolMetadata,sidc,{size:60,...(currentSymbolMetadata.symbolOptions||{})},currentSymbolMetadata.icopEditor?.values||{})
          : new ms.Symbol(sidc, { size: 60, ...(currentSymbolMetadata.symbolOptions || {}) }).asSVG();
      } catch (e) {
        symbolUrl = `<div style="width:80px; height:80px; background:#ccc; display:flex; justify-content:center; align-items:center;">?</div>`;
      }

      const div = document.createElement("div");
      div.className = "symbolItem symbol";
      div.draggable = true;
      div.innerHTML = symbolUrl;

      div.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("application/x-military-sidc", sidc);
        e.dataTransfer.setData("text/plain", sidc);
        e.dataTransfer.setData("application/x-webcop-symbol",JSON.stringify(currentSymbolMetadata));
        div.style.cursor = "grabbing";
        div.style.opacity = "0.65";
      });

      div.addEventListener("dragend", () => {
        div.style.cursor = "grab";
        div.style.opacity = "1";
      });

      symbolList.appendChild(div);
    }

    renderSymbol(currentSidc);

    sympo2.addEventListener("change", (e) => {
      const indc = e.target.value;
      if (currentSidc && currentSidc.length >= 15) {
        currentSidc = applyAffiliation(currentSidc, indc);
        renderSymbol(currentSidc);
      }
    });

    document.getElementById("editSelectedIcopSymbol").onclick = () => {
      cancelMultipointDrawing(true);
      window.IcopSymbolEditor.open(currentSymbolMetadata, null, ({state,sidc,symbolOptions}) => {
        currentSymbolMetadata = {...currentSymbolMetadata, icopEditor:state, symbolOptions};
        currentSidc = currentSymbolMetadata.selectable === false ? "" : sidc;
        if (!sidc.startsWith("W")) sympo2.value = "-PUFNHASGWDLMJK".includes(sidc[1]) ? sidc[1] : "-";
        if (currentSidc) {
          renderSymbol(currentSidc,currentSymbolMetadata);
          if (["LINE","POLYGON","MULTIPOINT"].includes(currentSymbolMetadata.geometry)) startMultipointDrawing();
          else startPointPlacement();
        }
        else setMultipointStatus(`${currentSymbolMetadata.text} · 편집값 저장 완료`);
      });
    };
    initLayerTree(renderSymbol, applyAffiliation);

    setupSymbolDropLogic();
  }

  function setMultipointStatus(message) {
    const status = document.getElementById("symbolSelectionInfo");
    if (status && message) status.textContent = message;
  }

  function getSelectedMultipointType() {
    const geometry = currentSymbolMetadata.geometry;
    const hierarchy = String(currentSymbolMetadata.hierarchy || "");
    const name = String(currentSymbolMetadata.textEn || currentSymbolMetadata.text || "");
    if (geometry === "POLYGON") return "area";
    if (/AXSADV|AXIS OF ADVANCE/i.test(`${hierarchy} ${name}`)) return "axis";
    if (geometry === "MULTIPOINT") return "arrow";
    return "line";
  }

  function getMultipointViewer() {
    return window.CesiumViewer || (typeof viewer !== "undefined" ? viewer : null);
  }

  function pickMultipointPosition(currentViewer, screenPosition) {
    let cartesian;
    if (currentViewer.scene.pickPositionSupported) {
      cartesian = currentViewer.scene.pickPosition(screenPosition);
    }
    if (!Cesium.defined(cartesian)) {
      cartesian = currentViewer.camera.pickEllipsoid(screenPosition, currentViewer.scene.globe.ellipsoid);
    }
    return Cesium.defined(cartesian) ? cartesian : null;
  }

  function getMultipointPreviewPositions() {
    return multipointMousePosition
      ? multipointPositions.concat([multipointMousePosition])
      : multipointPositions.slice();
  }

  function cesiumColor(value, fallback, alpha) {
    let color = fallback;
    try {
      if (typeof value === "string" && value) color = Cesium.Color.fromCssColorString(value);
    } catch (error) {}
    if (!color) color = Cesium.Color.YELLOW;
    return Number.isFinite(alpha) ? color.withAlpha(alpha) : color;
  }

  function getRendererView(currentViewer, coordinates) {
    const rectangle = currentViewer.camera.computeViewRectangle(currentViewer.scene.globe.ellipsoid);
    let bbox = "";
    if (rectangle) {
      bbox = [rectangle.west, rectangle.south, rectangle.east, rectangle.north]
        .map(value => Cesium.Math.toDegrees(value))
        .join(",");
    } else {
      const lons = coordinates.map(point => point.lon);
      const lats = coordinates.map(point => point.lat);
      bbox = `${Math.min(...lons) - 1},${Math.min(...lats) - 1},${Math.max(...lons) + 1},${Math.max(...lats) + 1}`;
    }
    const height = currentViewer.camera.positionCartographic?.height || 50000;
    return { bbox: bbox, scale: Math.max(5000, Math.round(height * 2)) };
  }

  function polygonHierarchyFromCoordinates(rings) {
    if (!Array.isArray(rings) || !rings.length) return null;
    const toCartesian = ring => ring.map(point => Cesium.Cartesian3.fromDegrees(point[0], point[1], point[2] || 0));
    return new Cesium.PolygonHierarchy(
      toCartesian(rings[0]),
      rings.slice(1).map(ring => new Cesium.PolygonHierarchy(toCartesian(ring)))
    );
  }

  function addRenderedGeoJsonFeature(currentViewer, feature, parent, childIds) {
    const geometry = feature?.geometry;
    const properties = feature?.properties || {};
    if (!geometry || !geometry.type || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return;

    const addLine = coordinates => {
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      const child = currentViewer.entities.add({
        parent: parent,
        polyline: {
          positions: coordinates.map(point => Cesium.Cartesian3.fromDegrees(point[0], point[1], point[2] || 0)),
          width: Number(properties.strokeWidth || properties.strokeWeight) || 3,
          clampToGround: true,
          material: Array.isArray(properties.strokeDasharray) && properties.strokeDasharray.length
            ? new Cesium.PolylineDashMaterialProperty({color:cesiumColor(properties.strokeColor,Cesium.Color.YELLOW,Number(properties.lineOpacity)),dashLength:properties.strokeDasharray.reduce((sum,n)=>sum+Number(n),0) || 16})
            : cesiumColor(properties.strokeColor, Cesium.Color.YELLOW, Number(properties.lineOpacity))
        }
      });
      childIds.push(child.id);
    };

    const addPolygon = rings => {
      const hierarchy = polygonHierarchyFromCoordinates(rings);
      if (!hierarchy) return;
      const fillAlpha = Number.isFinite(Number(properties.fillOpacity)) ? Number(properties.fillOpacity) : 0.25;
      const child = currentViewer.entities.add({
        parent: parent,
        polygon: {
          hierarchy: hierarchy,
          material: properties.fillPattern
            ? new Cesium.ImageMaterialProperty({image:properties.fillPattern,transparent:true,repeat:new Cesium.Cartesian2(12,12)})
            : cesiumColor(properties.fillColor, Cesium.Color.YELLOW, fillAlpha),
          outline: false,
          outlineColor: cesiumColor(properties.strokeColor, Cesium.Color.YELLOW),
          height: 0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
      childIds.push(child.id);
      rings.forEach(ring => { if (ring.length > 1) addLine(ring); });
    };

    if (geometry.type === "LineString") addLine(geometry.coordinates);
    if (geometry.type === "MultiLineString") geometry.coordinates.forEach(addLine);
    if (geometry.type === "Polygon") addPolygon(geometry.coordinates);
    if (geometry.type === "MultiPolygon") geometry.coordinates.forEach(addPolygon);
    if (geometry.type === "Point" && properties.image) {
      const point = geometry.coordinates;
      const child = currentViewer.entities.add({parent,
        position:Cesium.Cartesian3.fromDegrees(point[0],point[1],point[2] || 0),
        billboard:{image:properties.image,rotation:-Cesium.Math.toRadians(Number(properties.rotation)||0),
          pixelOffset:new Cesium.Cartesian2(Number(properties.anchorOffsetX)||0,Number(properties.anchorOffsetY)||0),
          heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
      childIds.push(child.id);
    }
    if (geometry.type === "Point" && properties.label) {
      const point = geometry.coordinates;
      const fontSize = parseInt(properties.fontSize, 10) || 12;
      const child = currentViewer.entities.add({
        parent: parent,
        position: Cesium.Cartesian3.fromDegrees(point[0], point[1], point[2] || 0),
        label: {
          text: String(properties.label),
          font: `${properties.fontWeight || "bold"} ${fontSize}px ${properties.fontFamily || "sans-serif"}`,
          fillColor: cesiumColor(properties.fontColor, Cesium.Color.YELLOW),
          outlineColor: cesiumColor(properties.labelOutlineColor, Cesium.Color.BLACK),
          outlineWidth: Number(properties.labelOutlineWidth) || 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      childIds.push(child.id);
    }
  }

  function getTacticalModifierValues(overrides) {
    return {
      distance1: Number(overrides?.distance1) || 1000,
      distance2: Number(overrides?.distance2) || 5000,
      azimuth1: Number(overrides?.azimuth1 ?? 315),
      azimuth2: Number(overrides?.azimuth2 ?? 45)
    };
  }

  function renderMilitaryTacticalGraphic(currentViewer, sidc, coordinates, name, modifierOverrides, previewOnly = false) {
    const renderer = window.C5Ren;
    if (!renderer?.C2DLookup || !renderer?.WebRenderer || !Array.isArray(coordinates)) return null;

    let root = null;
    const childIds = [];
    try {
      const sourceDefinition = window.IcopDefinitionRenderer?.definition(sidc);
      const convertedSidc = sourceDefinition ? sidc : renderer.C2DLookup.getInstance().getDCode(sidc);
      if (!convertedSidc) throw new Error(`2525D 변환 코드가 없습니다: ${sidc}`);

      const controlPoints = coordinates.map(point => `${point.lon},${point.lat}`).join(" ");
      const view = getRendererView(currentViewer, coordinates);
      const values = getTacticalModifierValues(modifierOverrides);
      const modifiers = new Map([
        [renderer.Modifiers.AM_DISTANCE, `${values.distance1},${values.distance2}`],
        [renderer.Modifiers.AN_AZIMUTH, `${Number.isFinite(values.azimuth1) ? values.azimuth1 : 315},${Number.isFinite(values.azimuth2) ? values.azimuth2 : 45}`],
        [renderer.Modifiers.T_UNIQUE_DESIGNATION_1, name]
      ]);
      for (const [key,value] of Object.entries(modifierOverrides?.icopValues || {})) {
        if (!/^(B|C|D|F|G|H[12]?|J|K|L|M|N|P|Q|R2?|S|T[12]?|V|W1?|X|Y|Z|AA|AB|AC|AD|AE|AF|AG)$/.test(key)) continue;
        const modifierName = Object.keys(renderer.Modifiers).find(name => name.startsWith(key+"_"));
        if (modifierName && value !== "" && value != null) modifiers.set(renderer.Modifiers[modifierName], String(value));
      }
      const output = sourceDefinition
        ? window.IcopDefinitionRenderer.render(sidc,coordinates,name,modifierOverrides?.icopValues || {})
        : renderer.WebRenderer.RenderSymbol(
        `tg-${Date.now()}`,
        name,
        "",
        convertedSidc,
        controlPoints,
        "clampToGround",
        view.scale,
        view.bbox,
        modifiers,
        new Map(),
        renderer.WebRenderer.OUTPUT_FORMAT_GEOJSON
      );
      const geoJson = typeof output === "string" ? JSON.parse(output) : output;
      if (!geoJson || geoJson.type === "error" || !Array.isArray(geoJson.features)) {
        throw new Error(geoJson?.error || "GeoJSON 결과가 없습니다.");
      }

      if (previewOnly) return geoJson;
      const first = coordinates[0];
      root = currentViewer.entities.add({
        name: name,
        position: Cesium.Cartesian3.fromDegrees(first.lon, first.lat)
      });
      geoJson.features.forEach(feature => addRenderedGeoJsonFeature(currentViewer, feature, root, childIds));
      if (childIds.length === 0) {
        currentViewer.entities.remove(root);
        throw new Error("표시 가능한 선·면·문자 형상이 없습니다.");
      }
      root.customData = { renderedEntityIds: childIds, convertedSidc: convertedSidc };
      return root;
    } catch (error) {
      childIds.forEach(id => currentViewer.entities.removeById(id));
      if (root) currentViewer.entities.remove(root);
      console.warn("MIL-STD-2525 전술도형 렌더링 실패.", error);
      return null;
    }
  }

  function tacticalPreviewCoordinates(sidc, geometry, values = {}) {
    if (window.IcopDefinitionRenderer?.definition(sidc)) return window.IcopDefinitionRenderer.sample(sidc,values);
    const requirements = getMultipointRequirements(sidc, geometry === "POLYGON" ? "area" : "line");
    const count = Math.max(requirements.min, Math.min(geometry === "LINE" ? 3 : 4, requirements.max));
    const base = geometry === "LINE"
      ? [{lon:127,lat:37},{lon:127.08,lat:37.04},{lon:127.16,lat:37}]
      : [{lon:127,lat:37},{lon:127.02,lat:37.08},{lon:127.12,lat:37.09},{lon:127.16,lat:37.01}];
    if (count <= base.length) return base.slice(0,count);
    return Array.from({length:count},(_,i)=>({lon:127.08+0.08*Math.cos(i*2*Math.PI/count),lat:37.05+0.05*Math.sin(i*2*Math.PI/count)}));
  }

  function getMultipointRequirements(sidc, fallbackType, values = {}) {
    const defined = window.IcopDefinitionRenderer?.requirements(sidc,values);
    if (defined) return defined;
    const fallback = { min: fallbackType === "area" ? 3 : 2, max: Infinity };
    const renderer = window.C5Ren;
    if (!sidc || !renderer?.C2DLookup || !renderer?.MSLookup) return fallback;
    try {
      const convertedSidc = renderer.C2DLookup.getInstance().getDCode(sidc);
      const info = convertedSidc && renderer.MSLookup.getInstance().getMSLInfo(convertedSidc);
      if (!info) return fallback;
      const maximum = info.getMaxPointCount();
      return {
        min: Math.max(1, info.getMinPointCount()),
        max: Number.isFinite(maximum) && maximum < 1000 ? maximum : Infinity
      };
    } catch (error) {
      return fallback;
    }
  }

  function createMultipointEntity(currentViewer, type) {
    const positions = new Cesium.CallbackProperty(getMultipointPreviewPositions, false);
    const arrowMaterial = typeof Cesium.PolylineArrowMaterialProperty === "function"
      ? new Cesium.PolylineArrowMaterialProperty(Cesium.Color.RED.withAlpha(0.9))
      : Cesium.Color.RED.withAlpha(0.9);
    const polyline = {
      positions: positions,
      width: type === "axis" ? 7 : 4,
      clampToGround: true,
      material: type === "arrow" || type === "axis"
        ? arrowMaterial
        : Cesium.Color.YELLOW.withAlpha(0.9)
    };

    if (type === "area") {
      return currentViewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const preview = getMultipointPreviewPositions();
            return preview.length >= 3 ? new Cesium.PolygonHierarchy(preview) : null;
          }, false),
          material: Cesium.Color.RED.withAlpha(0.25),
          outline: true,
          outlineColor: Cesium.Color.RED,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const preview = getMultipointPreviewPositions();
            return preview.length >= 2 ? preview.concat([preview[0]]) : preview;
          }, false),
          width: 3,
          clampToGround: true,
          material: Cesium.Color.RED
        }
      });
    }

    if (type === "axis") {
      return currentViewer.entities.add({
        corridor: {
          positions: positions,
          width: 80,
          material: Cesium.Color.RED.withAlpha(0.22),
          outline: true,
          outlineColor: Cesium.Color.RED,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        polyline: polyline
      });
    }

    return currentViewer.entities.add({ polyline: polyline });
  }

  function clearLiveTacticalPreview(currentViewer) {
    if (!currentViewer || !liveTacticalEntity) return;
    for (const id of liveTacticalEntity.customData?.renderedEntityIds || []) currentViewer.entities.removeById(id);
    currentViewer.entities.remove(liveTacticalEntity);
    liveTacticalEntity = null;
  }

  function refreshLiveTacticalPreview(force = false) {
    const currentViewer = getMultipointViewer();
    if (!currentViewer || !multipointEntity) return;
    if (!force && Date.now() - lastTacticalPreviewAt < 100) return;
    lastTacticalPreviewAt = Date.now();
    const positions = getMultipointPreviewPositions().slice(0, multipointRequirements.max);
    if (positions.length < multipointRequirements.min) return;
    const coordinates = positions.map(position => {
      const point = Cesium.Cartographic.fromCartesian(position);
      return {lon:Cesium.Math.toDegrees(point.longitude),lat:Cesium.Math.toDegrees(point.latitude)};
    });
    const rendered = renderMilitaryTacticalGraphic(currentViewer,currentSidc,coordinates,
      currentSymbolMetadata.icopEditor?.name || currentSymbolMetadata.text,
      {icopValues:currentSymbolMetadata.icopEditor?.values || {}});
    if (!rendered) {
      clearLiveTacticalPreview(currentViewer);
      multipointEntity.show = true;
      return;
    }
    clearLiveTacticalPreview(currentViewer);
    liveTacticalEntity = rendered;
    multipointEntity.show = false;
    currentViewer.scene.requestRender();
  }

  function startMultipointDrawing() {
    const currentViewer = getMultipointViewer();
    if (!currentViewer) {
      alert("Cesium 지도가 준비되지 않았습니다.");
      return;
    }

    cancelMultipointDrawing(true);
    multipointPositions = [];
    multipointMousePosition = null;
    const selectedGeometry = currentSymbolMetadata.geometry;
    const selectedSidc = ["LINE", "POLYGON", "MULTIPOINT"].includes(selectedGeometry) ? currentSidc : null;
    activeMultipointType = getSelectedMultipointType();
    multipointRequirements = getMultipointRequirements(selectedSidc, activeMultipointType,currentSymbolMetadata.icopEditor?.values || {});
    multipointEntity = createMultipointEntity(currentViewer, activeMultipointType);
    multipointHandler = new Cesium.ScreenSpaceEventHandler(currentViewer.scene.canvas);

    multipointHandler.setInputAction(click => {
      const clickTime = Date.now();
      if (clickTime - lastMultipointClickAt < 300) return;
      lastMultipointClickAt = clickTime;
      if (multipointPositions.length >= multipointRequirements.max) return;
      const position = pickMultipointPosition(currentViewer, click.position);
      if (!position) return;
      const previous = multipointPositions[multipointPositions.length - 1];
      if (!previous || Cesium.Cartesian3.distance(previous, position) > 0.1) {
        multipointPositions.push(position);
      }
      multipointMousePosition = null;
      refreshLiveTacticalPreview(true);
      if (multipointRequirements.max === 1) { finishMultipointDrawing(); return; }
      setMultipointStatus(`${currentSymbolMetadata.text || currentSymbolMetadata.textEn} · ${multipointPositions.length}개 지점 선택됨 · 더블클릭으로 완료`);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    multipointHandler.setInputAction(movement => {
      if (multipointPositions.length === 0) return;
      multipointMousePosition = pickMultipointPosition(currentViewer, movement.endPosition);
      refreshLiveTacticalPreview();
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    multipointHandler.setInputAction(finishMultipointDrawing, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    multipointHandler.setInputAction(() => cancelMultipointDrawing(false), Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    savedDoubleClickAction = currentViewer.screenSpaceEventHandler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    currentViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    const maximumGuide = Number.isFinite(multipointRequirements.max) ? `, 최대 ${multipointRequirements.max}개` : "";
    setMultipointStatus(`${currentSymbolMetadata.text || currentSymbolMetadata.textEn} · 지도에서 지점을 선택하세요(최소 ${multipointRequirements.min}개${maximumGuide}) · 우클릭 취소${activeMultipointType === "axis" ? " · 전진축은 진행 경로와 마지막 폭 지정점에 따라 모양이 달라집니다." : ""}`);
  }

  function finishMultipointDrawing() {
    const currentViewer = getMultipointViewer();
    if (!currentViewer || !multipointEntity) return;

    const type = activeMultipointType;
    const minimumPoints = multipointRequirements.min;
    const finalPositions = multipointPositions.slice();
    if (finalPositions.length > 1 && Cesium.Cartesian3.distance(
      finalPositions[finalPositions.length - 1], finalPositions[finalPositions.length - 2]
    ) < 0.1) finalPositions.pop();

    if (finalPositions.length < minimumPoints) {
      alert(`${minimumPoints}개 이상의 지점을 선택해주세요.`);
      return;
    }

    const typeNames = { line: "전술 선형", arrow: "전술 화살표", area: "폐쇄구역", axis: "작전축" };
    const selectedGeometry = currentSymbolMetadata.geometry;
    const selectedTacticalName = ["LINE", "POLYGON", "MULTIPOINT"].includes(selectedGeometry)
      ? (currentSymbolMetadata.text || currentSymbolMetadata.textEn)
      : null;
    const name = currentSymbolMetadata.icopEditor?.name || `${selectedTacticalName || typeNames[type]} ${entityIdCounter}`;
    const coordinates = finalPositions.map(position => {
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      return {
        lon: Cesium.Math.toDegrees(cartographic.longitude),
        lat: Cesium.Math.toDegrees(cartographic.latitude)
      };
    });
    let entity = selectedTacticalName
      ? renderMilitaryTacticalGraphic(currentViewer, currentSidc, coordinates, name, {icopValues:currentSymbolMetadata.icopEditor?.values || {}})
      : null;
    if (selectedTacticalName && !entity) {
      setMultipointStatus("부호 형상을 만들 수 없습니다. 지점 배치와 폭 지정점을 확인하거나 우클릭으로 취소하세요.");
      return;
    }
    clearLiveTacticalPreview(currentViewer);
    if (entity) {
      currentViewer.entities.remove(multipointEntity);
    } else {
      entity = multipointEntity;
      entity.name = name;
      if (entity.polyline) entity.polyline.positions = type === "area" ? finalPositions.concat([finalPositions[0]]) : finalPositions;
      if (entity.polygon) entity.polygon.hierarchy = new Cesium.PolygonHierarchy(finalPositions);
      if (entity.corridor) entity.corridor.positions = finalPositions;
    }
    entity.customData = {
      ...(entity.customData || {}),
      militarySymbol: true,
      multipointTacticalGraphic: true,
      source: "unifiedControlPanel",
      sidc: selectedTacticalName ? currentSidc : null,
      shape: type,
      displayName: name,
      symbolMetadata: selectedTacticalName ? currentSymbolMetadata : null,
      modifiers: {...getTacticalModifierValues(), icopValues:currentSymbolMetadata.icopEditor?.values || {}},
      icopEditor: currentSymbolMetadata.icopEditor || null,
      positions: coordinates
    };
    entity.description = `<p><b>전술도형:</b> ${typeNames[type]}</p><p><b>지점 수:</b> ${finalPositions.length}</p>`;

    addEntityToListBox(entity, name, coordinates[0].lon, coordinates[0].lat, `${finalPositions.length}개 지점`);
    document.dispatchEvent(new CustomEvent("military-symbol-added", { detail: { entity: entity } }));
    document.dispatchEvent(new CustomEvent("multipoint-tactical-graphic-added", { detail: { entity: entity } }));

    multipointEntity = null;
    stopMultipointHandler(currentViewer);
    currentViewer.selectedEntity = entity;
    currentViewer.scene.requestRender();
    setMultipointStatus(`${name} · 도시 완료`);
  }

  function stopMultipointHandler(currentViewer) {
    clearLiveTacticalPreview(currentViewer);
    lastTacticalPreviewAt = 0;
    if (multipointHandler && !multipointHandler.isDestroyed()) multipointHandler.destroy();
    multipointHandler = null;
    multipointPositions = [];
    multipointMousePosition = null;
    lastMultipointClickAt = 0;
    multipointRequirements = { min: 2, max: Infinity };
    activeMultipointType = "line";
    if (currentViewer && savedDoubleClickAction) {
      currentViewer.screenSpaceEventHandler.setInputAction(savedDoubleClickAction, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
    savedDoubleClickAction = null;
  }

  function cancelMultipointDrawing(silent) {
    const currentViewer = getMultipointViewer();
    if (currentViewer && multipointEntity) currentViewer.entities.remove(multipointEntity);
    multipointEntity = null;
    stopMultipointHandler(currentViewer);
    if (!silent) setMultipointStatus("전술도형 그리기가 취소되었습니다. 트리에서 다시 선택할 수 있습니다.");
  }

  // jsTree와 데이터가 준비된 뒤 트리를 초기화한다. 실패해도 트리 DOM은 훼손하지 않는다.
  function initLayerTree(renderSymbol, applyAffiliation, retryCount = 0) {
    const treeElement = document.getElementById("layerTree");
    const statusElement = document.getElementById("layerTreeStatus");
    const searchInput = document.getElementById("symbolTreeSearch");
    const searchClear = document.getElementById("symbolTreeSearchClear");
    if (!treeElement) return;

    if (typeof $ === "undefined" || !$.fn || !$.fn.jstree) {
      if (retryCount < 10) {
        setTimeout(() => initLayerTree(renderSymbol, applyAffiliation, retryCount + 1), 300);
      } else if (statusElement) {
        statusElement.style.display = "block";
        statusElement.style.color = "#c0392b";
        statusElement.textContent = "군대부호 트리 모듈을 불러오지 못했습니다.";
      }
      return;
    }

    const $tree = $(treeElement);
    const existingTree = $tree.jstree(true);
    if (existingTree) existingTree.destroy();

    if (statusElement) {
      statusElement.style.display = "block";
      statusElement.style.color = "#777";
      statusElement.textContent = "군대부호 목록을 불러오는 중입니다...";
    }

    // <base> 태그가 있거나 현재 페이지 경로가 바뀌어도 같은 JSON을 찾도록 절대 URL로 변환한다.
    const rootId = "ICOP";
    const treeDataUrl = new URL("icops/alldata-icop-ko.json", document.baseURI).href;

    $tree
      .off("select_node.jstree.unifiedPanel ready.jstree.unifiedPanel load_node.jstree.unifiedPanel")
      .on("ready.jstree.unifiedPanel", () => {
        if (statusElement) statusElement.style.display = "none";
        const treeInstance = $tree.jstree(true);
        if (treeInstance) {
          treeInstance.open_node(rootId);
          if (searchInput?.value.trim()) treeInstance.search(searchInput.value.trim());
        }
      })
      .on("select_node.jstree.unifiedPanel", (event, data) => {
        const treeInstance = $tree.jstree(true);
        if (treeInstance && data.node.children && data.node.children.length > 0) {
          treeInstance.toggle_node(data.node);
        }

        const selectedNodeData = data.node.data || (data.node.original && data.node.original.data);
        const original = {...(data.node.original || {})};
        document.getElementById("editSelectedIcopSymbol").disabled = !original.icopCode && !original.data;
        const draft = window.IcopSymbolEditor?.readDraft(original.id);
        if (draft) { original.icopEditor=draft; original.symbolOptions=draft.symbolOptions || {}; }
        if (!selectedNodeData || original.selectable === false) {
          cancelMultipointDrawing(true);
          currentSidc = "";
          currentSymbolMetadata = original;
          document.getElementById("symbolList").replaceChildren();
          document.getElementById("symbolSelectionInfo").textContent = original.mappingStatus === "unsupported"
            ? `${original.text} · 현재 지원되는 대응 부호가 없습니다.` : "하위 부호를 선택하세요.";
          return;
        }
        cancelMultipointDrawing(true);

        const indc = document.getElementById("sympo2").value;
        currentSidc = draft?.renderSidc || selectedNodeData.toString();
        if (indc !== "-") currentSidc = applyAffiliation(currentSidc, indc);
        else if (draft && !currentSidc.startsWith("W")) document.getElementById("sympo2").value = "-PUFNHASGWDLMJK".includes(currentSidc[1]) ? currentSidc[1] : "-";
        renderSymbol(currentSidc, original);
      })
      .jstree({
        "plugins": ["wholerow", "search"],
        "search": {
          "show_only_matches": true,
          "show_only_matches_children": true,
          "case_sensitive": false,
          "search_callback": function(searchText, node) {
            const original = node.original || {};
            const keywords = Array.isArray(original.keywords) ? original.keywords.join(" ") : "";
            const haystack = [node.text, original.textEn, keywords, original.data].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(searchText.toLowerCase());
          }
        },
        "core": {
          "check_callback": true,
          "dblclick_toggle": false,
          "themes": {
            "dots": true,
            "icons": true,
            "stripes": false
          },
          "data": {
            "url": treeDataUrl,
            "dataType": "json",
            "cache": false,
            "error": function() {
              if (statusElement) {
                statusElement.style.display = "block";
                statusElement.style.color = "#c0392b";
                statusElement.textContent = "군대부호 목록을 불러오지 못했습니다. 잠시 후 다시 시도합니다.";
              }
              if (retryCount < 3) {
                setTimeout(() => initLayerTree(renderSymbol, applyAffiliation, retryCount + 1), 1000);
              }
            }
          }
        }
      });

    let searchTimer = null;
    if (searchInput) {
      searchInput.oninput = () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const instance = $tree.jstree(true);
          if (instance) instance.search(searchInput.value.trim());
        }, 180);
      };
    }
    if (searchClear) {
      searchClear.onclick = () => {
        if (searchInput) searchInput.value = "";
        const instance = $tree.jstree(true);
        if (instance) {
          instance.clear_search();
          instance.close_all();
          instance.open_node(rootId);
        }
      };
    }
  }

  // 군대부호 미리보기를 Cesium 지도에 드롭하여 도시한다.
  function placePointSymbol(currentViewer,cartesian,sidc,dropMetadata) {
      let svg;
      try {
        svg = dropMetadata.renderer === "icop-svg"
          ? window.IcopSvgRenderer.render(dropMetadata,sidc,{size:60,...(dropMetadata.symbolOptions||{})},dropMetadata.icopEditor?.values||{})
          : new ms.Symbol(sidc, { size: 60, ...(dropMetadata.symbolOptions || {}) }).asSVG();
      } catch (error) {
        console.error("군대부호 생성 실패:", error);
        alert("군대부호 이미지를 생성하지 못했습니다.");
        return;
      }

      const imageUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lng = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const name = `${dropMetadata.icopEditor?.name || dropMetadata.text || "군대부호"} ${entityIdCounter}`;
      const entity = currentViewer.entities.add({
        name: name,
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        billboard: {
          image: imageUrl,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      entity.customData = {
        militarySymbol: true,
        source: "unifiedControlPanel",
        sidc: sidc,
        icopCode: dropMetadata.icopCode || null,
        symbolName: dropMetadata.text || null,
        symbolMetadata: dropMetadata,
        symbolOptions: dropMetadata.symbolOptions || {},
        icopEditor: dropMetadata.icopEditor || null,
        shape: "militarySymbol",
        displayName: name
      };
      entity.description = `<p><b>군대부호:</b> ${sidc}</p><p><b>좌표:</b> ${lng.toFixed(5)}, ${lat.toFixed(5)}</p>`;

      addEntityToListBox(entity, name, lng, lat, "지면 고정");
      document.dispatchEvent(new CustomEvent("military-symbol-added", {
        detail: { entity: entity }
      }));
      // 드롭 직후에는 선택하지 않는다. 사용자가 지도에서 직접 클릭할 때만 바운딩 박스를 표시한다.
      currentViewer.selectedEntity = undefined;
      currentViewer.scene.requestRender();
      return entity;
  }

  function startPointPlacement() {
    const currentViewer=getMultipointViewer();
    if (!currentViewer || !currentSidc) return;
    cancelMultipointDrawing(true);
    const sidc=currentSidc, metadata=currentSymbolMetadata;
    multipointHandler=new Cesium.ScreenSpaceEventHandler(currentViewer.scene.canvas);
    multipointHandler.setInputAction(click=>{
      const position=pickMultipointPosition(currentViewer,click.position);
      if (!position) { setMultipointStatus("지도 위의 유효한 위치를 클릭하세요."); return; }
      const entity=placePointSymbol(currentViewer,position,sidc,metadata);
      if (entity) {
        stopMultipointHandler(currentViewer);
        setMultipointStatus(`${entity.name} · 도시 완료`);
      }
    },Cesium.ScreenSpaceEventType.LEFT_CLICK);
    multipointHandler.setInputAction(()=>cancelMultipointDrawing(false),Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    setMultipointStatus(`${metadata.icopEditor?.name || metadata.text} · 지도 위치를 클릭해 배치하세요 · 우클릭 취소`);
  }

  function setupSymbolDropLogic() {
    const currentViewer = window.CesiumViewer || (typeof viewer !== "undefined" ? viewer : null);
    if (!currentViewer || !currentViewer.scene || !currentViewer.scene.canvas) {
      setTimeout(setupSymbolDropLogic, 500);
      return;
    }

    const canvas = currentViewer.scene.canvas;
    if (symbolDropTarget === canvas) return;

    if (symbolDropTarget) {
      symbolDropTarget.removeEventListener("dragover", symbolDragOverHandler);
      symbolDropTarget.removeEventListener("drop", symbolDropHandler);
    }

    symbolDragOverHandler = (event) => {
      const types = Array.from(event.dataTransfer?.types || []);
      if (!types.includes("application/x-military-sidc")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    };

    symbolDropHandler = (event) => {
      const sidc = event.dataTransfer?.getData("application/x-military-sidc");
      if (!sidc) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const windowPosition = new Cesium.Cartesian2(
        event.clientX - rect.left,
        event.clientY - rect.top
      );

      let cartesian;
      if (currentViewer.scene.pickPositionSupported) {
        cartesian = currentViewer.scene.pickPosition(windowPosition);
      }
      if (!Cesium.defined(cartesian)) {
        cartesian = currentViewer.camera.pickEllipsoid(windowPosition, currentViewer.scene.globe.ellipsoid);
      }
      if (!Cesium.defined(cartesian)) {
        alert("지도 위의 유효한 위치에 군대부호를 놓아주세요.");
        return;
      }

      let dropMetadata=currentSymbolMetadata;
      try {
        const payload=event.dataTransfer?.getData("application/x-webcop-symbol");
        if (payload) dropMetadata=JSON.parse(payload);
      } catch(error) { setMultipointStatus("부호 정보를 읽을 수 없습니다."); return; }
      cancelMultipointDrawing(true);
      placePointSymbol(currentViewer,cartesian,sidc,dropMetadata);
    };

    canvas.addEventListener("dragover", symbolDragOverHandler);
    canvas.addEventListener("drop", symbolDropHandler);
    symbolDropTarget = canvas;
  }

  function addEntityToListBox(entity, name, lng, lat, initialHeightText) {
    const listBox = document.getElementById("entityListBox");
    if (!listBox) return;

    const id = entityIdCounter++;
    const itemDiv = document.createElement("div");
    itemDiv.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 3px 5px; border-bottom: 1px solid #f0f0f0; font-size: 11px;";

    const leftSpan = document.createElement("span");
    leftSpan.style.cssText = "display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "entity-chk";

    chk.addEventListener("change", () => {
      updateSelectAllCheckboxState();
    });

    const infoSpan = document.createElement("span");
    infoSpan.innerHTML = `<b>${name}</b> (${lng.toFixed(4)}, ${lat.toFixed(4)})`;

    leftSpan.appendChild(chk);
    leftSpan.appendChild(infoSpan);

    const heightSpan = document.createElement("span");
    heightSpan.style.cssText = "color: #27ae60; font-weight: bold; margin-left: 5px; white-space: nowrap;";
    heightSpan.innerText = initialHeightText;

    itemDiv.appendChild(leftSpan);
    itemDiv.appendChild(heightSpan);

    itemDiv.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      const viewer = window.CesiumViewer;
      if (viewer) {
        viewer.selectedEntity = entity;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lng, lat, 500)
        });
      }
    });

    listBox.appendChild(itemDiv);

    entityListMap.set(entity, {
      id: id,
      name: name,
      lon: lng,
      lat: lat,
      infoSpan: infoSpan,
      heightSpan: heightSpan,
      checkbox: chk,
      dom: itemDiv
    });
  }

  function updateSelectAllCheckboxState() {
    const selectAllChk = document.getElementById("selectAllCheckbox");
    if (!selectAllChk) return;
    const allChks = Array.from(document.querySelectorAll(".entity-chk"));
    if (allChks.length === 0) {
      selectAllChk.checked = false;
      return;
    }
    selectAllChk.checked = allChks.every(c => c.checked);
  }

  function translateCartesian(position, deltaLongitude, deltaLatitude) {
    if (!position) return position;
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    return Cesium.Cartesian3.fromRadians(
      cartographic.longitude + deltaLongitude,
      Math.max(-Cesium.Math.PI_OVER_TWO, Math.min(Cesium.Math.PI_OVER_TWO, cartographic.latitude + deltaLatitude)),
      cartographic.height
    );
  }

  function translatePolygonHierarchy(hierarchy, deltaLongitude, deltaLatitude) {
    if (!hierarchy) return hierarchy;
    return new Cesium.PolygonHierarchy(
      (hierarchy.positions || []).map(position => translateCartesian(position, deltaLongitude, deltaLatitude)),
      (hierarchy.holes || []).map(hole => translatePolygonHierarchy(hole, deltaLongitude, deltaLatitude))
    );
  }

  function snapshotMovableGraphics(entity, time) {
    const snapshot = { entity: entity };
    if (entity.position) snapshot.position = entity.position.getValue(time);
    if (entity.polyline?.positions) snapshot.polyline = entity.polyline.positions.getValue(time)?.slice();
    if (entity.corridor?.positions) snapshot.corridor = entity.corridor.positions.getValue(time)?.slice();
    if (entity.polygon?.hierarchy) snapshot.polygon = entity.polygon.hierarchy.getValue(time);
    snapshot.customGeometry = {};
    ["center", "start", "end", "startPoint", "endPoint"].forEach(key => {
      const value = entity.customData?.[key];
      if (value instanceof Cesium.Cartesian3) snapshot.customGeometry[key] = Cesium.Cartesian3.clone(value);
    });
    if (Array.isArray(entity.customPoints)) {
      snapshot.customGeometry.customPoints = entity.customPoints.map(point => Cesium.Cartesian3.clone(point));
    }
    ["sizedGeometry", "arcGeometry", "triangleCenter"].forEach(key => {
      if (entity.customData?.[key]) snapshot.customGeometry[key] = { ...entity.customData[key] };
    });
    return snapshot;
  }

  function applyGraphicTranslation(snapshot, deltaLongitude, deltaLatitude) {
    const entity = snapshot.entity;
    if (snapshot.position) entity.position = translateCartesian(snapshot.position, deltaLongitude, deltaLatitude);
    if (snapshot.polyline) {
      entity.polyline.positions = snapshot.polyline.map(position => translateCartesian(position, deltaLongitude, deltaLatitude));
    }
    if (snapshot.corridor) {
      entity.corridor.positions = snapshot.corridor.map(position => translateCartesian(position, deltaLongitude, deltaLatitude));
    }
    if (snapshot.polygon) {
      entity.polygon.hierarchy = translatePolygonHierarchy(snapshot.polygon, deltaLongitude, deltaLatitude);
    }
    const geometry = snapshot.customGeometry || {};
    ["center", "start", "end", "startPoint", "endPoint"].forEach(key => {
      if (geometry[key] && entity.customData) {
        entity.customData[key] = translateCartesian(geometry[key], deltaLongitude, deltaLatitude);
      }
    });
    if (geometry.customPoints) {
      entity.customPoints = geometry.customPoints.map(point => translateCartesian(point, deltaLongitude, deltaLatitude));
    }
    ["sizedGeometry", "arcGeometry", "triangleCenter"].forEach(key => {
      if (!geometry[key] || !entity.customData) return;
      entity.customData[key] = {
        ...geometry[key],
        longitude: geometry[key].longitude + Cesium.Math.toDegrees(deltaLongitude),
        latitude: geometry[key].latitude + Cesium.Math.toDegrees(deltaLatitude)
      };
    });

    const editorStyle = entity._areaStyleEditor?.style;
    if (editorStyle) {
      const formatPositions = positions => positions.map(position => {
        const point = Cesium.Cartographic.fromCartesian(position);
        return `${Cesium.Math.toDegrees(point.longitude).toFixed(6)} ${Cesium.Math.toDegrees(point.latitude).toFixed(6)}`;
      }).join(", ");
      if (entity.customPoints?.length) editorStyle.coordinateText = formatPositions(entity.customPoints);
      if (entity.customData?.start && entity.customData?.end) {
        editorStyle.coordinateText = formatPositions([entity.customData.start, entity.customData.end]);
      }
      if (entity.customData?.startPoint && entity.customData?.endPoint) {
        editorStyle.coordinateText = formatPositions([entity.customData.startPoint, entity.customData.endPoint]);
      }
      if (entity.customData?.center) {
        const center = Cesium.Cartographic.fromCartesian(entity.customData.center);
        editorStyle.circleLongitude = Cesium.Math.toDegrees(center.longitude);
        editorStyle.circleLatitude = Cesium.Math.toDegrees(center.latitude);
      }
      if (entity.customData?.sizedGeometry) {
        editorStyle.rectangleLongitude = entity.customData.sizedGeometry.longitude;
        editorStyle.rectangleLatitude = entity.customData.sizedGeometry.latitude;
      }
      if (entity.customData?.arcGeometry) {
        editorStyle.arcLongitude = entity.customData.arcGeometry.longitude;
        editorStyle.arcLatitude = entity.customData.arcGeometry.latitude;
      }
      if (entity.customData?.triangleCenter) {
        editorStyle.triangleLongitude = entity.customData.triangleCenter.longitude;
        editorStyle.triangleLatitude = entity.customData.triangleCenter.latitude;
      }
    }
  }

  function resolveMovableEntity(currentViewer, pickedEntity) {
    if (!(pickedEntity instanceof Cesium.Entity)) return null;
    if (pickedEntity._drawingOwner instanceof Cesium.Entity) return pickedEntity._drawingOwner;
    if (pickedEntity.customData?.groupEntity instanceof Cesium.Entity) return pickedEntity.customData.groupEntity;
    if (pickedEntity.parent?.customData?.multipointTacticalGraphic) return pickedEntity.parent;
    const owner = currentViewer.entities.values.find(candidate =>
      Array.isArray(candidate.customData?.subEntities) && candidate.customData.subEntities.includes(pickedEntity)
    );
    if (owner?.customData?.groupEntity instanceof Cesium.Entity) return owner.customData.groupEntity;
    if (owner) return owner;
    return pickedEntity;
  }

  function collectMovableTargets(currentViewer, root) {
    const targets = [];
    const seen = new Set();
    const add = entity => {
      if (!(entity instanceof Cesium.Entity) || seen.has(entity.id)) return;
      seen.add(entity.id);
      targets.push(entity);
      (entity.customData?.subEntities || []).forEach(add);
    };
    add(root);
    (root.customData?.groupMembers || []).forEach(add);
    (root.customData?.renderedEntityIds || []).forEach(id => add(currentViewer.entities.getById(id)));
    return targets;
  }

  function restoreCameraInputs(controller, savedInputs) {
    if (!controller || !savedInputs) return;
    Object.keys(savedInputs).forEach(key => { controller[key] = savedInputs[key]; });
  }

  function setupEntityDragLogic() {
    const currentViewer = window.CesiumViewer || (typeof viewer !== "undefined" ? viewer : null);
    if (!currentViewer?.scene?.canvas) {
      setTimeout(setupEntityDragLogic, 500);
      return;
    }
    if (entityDragCanvas === currentViewer.scene.canvas && entityDragHandler && !entityDragHandler.isDestroyed()) return;
    if (entityDragHandler && !entityDragHandler.isDestroyed()) entityDragHandler.destroy();

    const canvas = currentViewer.scene.canvas;
    const controller = currentViewer.scene.screenSpaceCameraController;
    entityDragHandler = new Cesium.ScreenSpaceEventHandler(canvas);
    entityDragCanvas = canvas;

    entityDragHandler.setInputAction(click => {
      if (multipointHandler) return;
      const picked = currentViewer.scene.pick(click.position);
      const entity = resolveMovableEntity(currentViewer, picked?.id);
      if (!entity) return;
      const isDrawingEntity = Boolean(
        entity.customData?.drawingType ||
        entity.customData?.isDrawingGroup ||
        entity._areaStyleEditor ||
        entity.polygon || entity.polyline || entity.ellipse || entity.rectangle || entity.corridor || entity.box
      );
      if (!entityListMap.has(entity) && !entity.customData?.militarySymbol && !isDrawingEntity) return;

      const startPosition = pickMultipointPosition(currentViewer, click.position);
      if (!startPosition) return;
      const startCartographic = Cesium.Cartographic.fromCartesian(startPosition);
      const time = currentViewer.clock?.currentTime || Cesium.JulianDate.now();
      const targets = collectMovableTargets(currentViewer, entity);
      const savedInputs = {
        enableRotate: controller.enableRotate,
        enableTranslate: controller.enableTranslate,
        enableTilt: controller.enableTilt,
        enableLook: controller.enableLook
      };
      Object.keys(savedInputs).forEach(key => { controller[key] = false; });

      entityDragState = {
        entity: entity,
        startCartographic: startCartographic,
        snapshots: targets.map(target => snapshotMovableGraphics(target, time)),
        controlPoints: (entity.customData?.positions || []).map(point => ({ ...point })),
        savedInputs: savedInputs
      };
      canvas.style.cursor = "grabbing";
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    entityDragHandler.setInputAction(movement => {
      if (!entityDragState) return;
      const mapPosition = pickMultipointPosition(currentViewer, movement.endPosition);
      if (!mapPosition) return;
      const current = Cesium.Cartographic.fromCartesian(mapPosition);
      const deltaLongitude = current.longitude - entityDragState.startCartographic.longitude;
      const deltaLatitude = current.latitude - entityDragState.startCartographic.latitude;
      entityDragState.snapshots.forEach(snapshot => applyGraphicTranslation(snapshot, deltaLongitude, deltaLatitude));

      const entity = entityDragState.entity;
      if (entityDragState.controlPoints.length) {
        entity.customData.positions = entityDragState.controlPoints.map(point => ({
          ...point,
          lon: point.lon + Cesium.Math.toDegrees(deltaLongitude),
          lat: point.lat + Cesium.Math.toDegrees(deltaLatitude)
        }));
      }
      const item = entityListMap.get(entity);
      if (item) {
        item.lon += Cesium.Math.toDegrees(deltaLongitude) - (item.dragDeltaLongitude || 0);
        item.lat += Cesium.Math.toDegrees(deltaLatitude) - (item.dragDeltaLatitude || 0);
        item.dragDeltaLongitude = Cesium.Math.toDegrees(deltaLongitude);
        item.dragDeltaLatitude = Cesium.Math.toDegrees(deltaLatitude);
        if (item.infoSpan) item.infoSpan.innerHTML = `<b>${item.name}</b> (${item.lon.toFixed(4)}, ${item.lat.toFixed(4)})`;
      }
      currentViewer.scene.requestRender();
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    const finishDrag = () => {
      if (!entityDragState) return;
      const movedEntity = entityDragState.entity;
      const item = entityListMap.get(movedEntity);
      if (item) {
        delete item.dragDeltaLongitude;
        delete item.dragDeltaLatitude;
      }
      restoreCameraInputs(controller, entityDragState.savedInputs);
      entityDragState = null;
      canvas.style.cursor = "default";
      document.dispatchEvent(new CustomEvent("map-entity-moved", { detail: { entity: movedEntity } }));
    };
    entityDragHandler.setInputAction(finishDrag, Cesium.ScreenSpaceEventType.LEFT_UP);
  }

  // ==========================================
  // 2. 등록 및 마우스 클릭 좌표 자동입력 로직
  // ==========================================
  function initSampleLogic() {
    const getViewer = () => window.CesiumViewer || (typeof viewer !== 'undefined' ? viewer : null);
    
    const viewer = getViewer();
    if (!viewer) {
        setTimeout(initSampleLogic, 500);
        return;
    }

    // 기존 이벤트 핸들러가 있다면 파괴 후 재생성
    if (globalClickHandler && !globalClickHandler.isDestroyed()) {
        globalClickHandler.destroy();
    }

    globalClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // [핵심] ID 중복 문제를 회피하고 현재 활성화된 UI 패널 내의 input을 찾아 강제 적용하는 함수
    const updateInputValue = (id, val) => {
        // 1. 현재 화면에 띄워진 모달 요소를 가져옴
        const activeModal = document.getElementById("UnifiedControlModal");
        if (!activeModal) return;

        // 2. 전체 document 대신 activeModal 내부에서만 input 요소를 검색 (중복 ID 꼬임 방지)
        const elem = activeModal.querySelector(`#${id}`);
        if (elem) {
        elem.value = val;
        elem.defaultValue = val;
        elem.setAttribute('value', val);

        // React / Vue / Angular 또는 브라우저 렌더링 동기화를 위한 프로퍼티 디스패치
        const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeValueSetter) {
            nativeValueSetter.call(elem, val);
        }

        // 이벤트 강제 발행
        elem.dispatchEvent(new Event('input', { bubbles: true }));
        elem.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    // 지도를 클릭했을 때 좌표를 업데이트하는 이벤트
    globalClickHandler.setInputAction((click) => {
        const currentViewer = getViewer();
        if (!currentViewer) return;

        let cartesian = currentViewer.scene.pickPosition(click.position);

        if (!Cesium.defined(cartesian)) {
        cartesian = currentViewer.camera.pickEllipsoid(click.position, currentViewer.scene.globe.ellipsoid);
        }

        if (Cesium.defined(cartesian)) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const clickedLng = Cesium.Math.toDegrees(cartographic.longitude).toFixed(5);
        const clickedLat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(5);

        // 1. 등록 좌표 input 갱신 (lng, lat)
        updateInputValue('lng', clickedLng);
        updateInputValue('lat', clickedLat);

        // 2. 웨이포인트 이동 좌표 input 갱신 (lonInput, latInput)
        updateInputValue('lonInput', clickedLng);
        updateInputValue('latInput', clickedLat);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 객체 모양 선택(shape) 드롭다운 이벤트
    const activeModal = document.getElementById("UnifiedControlModal");
    const shapeSelect = activeModal ? activeModal.querySelector('#shape') : document.getElementById('shape');
    const boxFields = activeModal ? activeModal.querySelector('#boxFields') : document.getElementById('boxFields');

    if (shapeSelect && boxFields) {
        shapeSelect.onchange = () => {
        boxFields.style.display = shapeSelect.value === 'obstacle' ? 'block' : 'none';
        };
    }

    // [등록] 버튼 클릭 이벤트
    const addBtn = activeModal ? activeModal.querySelector('#addBtn') : document.getElementById('addBtn');
    if (addBtn) {
        addBtn.onclick = () => {
        const currentViewer = getViewer();
        const currentModal = document.getElementById("UnifiedControlModal") || document;
        
        const lngVal = currentModal.querySelector('#lng')?.value;
        const latVal = currentModal.querySelector('#lat')?.value;
        const lng = parseFloat(lngVal);
        const lat = parseFloat(latVal);
        const userText = currentModal.querySelector("#nameLabel")?.value || "객체";
        const shape = shapeSelect ? shapeSelect.value : "obstacle";

        if (!currentViewer || isNaN(lng) || isNaN(lat)) {
            alert("올바른 경도 및 위도를 입력해주세요.");
            return;
        }

        let groundHeightText = "계산 중...";
        let entity = null;

        // 객체 타입별 생성
        if (shape.includes('sphere')) {
            entity = currentViewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            billboard: {
                image: shape == 'sphere1'? 
              "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigyNTUsMTI4LDEyOCk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMS42MjM0NCAwIDAgMS42MjQ1OSA2Ni4xMzMzIDY2LjEzMzMpIj48cG9seWdvbiBwb2ludHM9IjAsNzA3IDcwNywwIDE0MTQsNzA3IDcwNywxNDE0IiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg=="
              :shape == 'sphere2'? "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxODEiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMzYyMCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxMjgsMjI0LDI1NSk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4yNDk5NSAwIDAgMi4yNTYzOCA5MS42NDU2IDkxLjg1MTkpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTUwMCIgaGVpZ2h0PSIxMDAwIiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg=="
              :"data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxNzAsMjU1LDE3MCk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4wNjM1NSAwIDAgMi4wNjU0MyA4NC4wNjc4IDg0LjA2NzgpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTEwMCIgaGVpZ2h0PSIxMTAwIiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg==",
              scale: 0.2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
            });
        } else if (shape === "billboard3") {
            entity = currentViewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            billboard: {
                image: "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMTgiIGhlaWdodD0iMTIxIiB2aWV3Qm94PSIwIDAgMjM2MCAyNDIwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxMjgsMjI0LDI1NSk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MDt9LnRzMCB7Zm9udC1mYW1pbHk6QXJpYWw7Zm9udC1zaXplOjI1MTdweDtmb250LXdlaWdodDpib2xkO2ZpbGw6YmxhY2s7dGV4dC1hbmNob3I6bWlkZGxlO308L3N0eWxlPjwvZGVmcz48ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjUxMDc5IDAgMCAxLjUxMTg5IDQwIDg0NS40KSI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjE1MDAiIGhlaWdodD0iMTAwMCIgY2xhc3M9InNzMCIvPjwvZz48ZyB0cmFuc2Zvcm09Im1hdHJpeCgwLjIgMCAwIDAuMiA0MCA0MCkiPjx0ZXh0IHg9IjU2NzMiIHk9IjM1MTQiIGNsYXNzPSJ0czAiPkkgSTwvdGV4dD48L2c+PC9zdmc+",
                scale: 0.5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
            });
        } else if (shape === 'obstacle') {
            const w = parseFloat(currentModal.querySelector('#boxWidth')?.value) || 20;
            const d = parseFloat(currentModal.querySelector('#boxDepth')?.value) || 20;
            const h = parseFloat(currentModal.querySelector('#boxHeight')?.value) || 20;

            entity = currentViewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            box: {
                dimensions: new Cesium.Cartesian3(w, d, h),
                material: Cesium.Color.GRAY.withAlpha(0.8),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
            });
        } else {
            entity = currentViewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            billboard: {
                image: shape == 'billboard1'? "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PG1hc2sgaWQ9ImNyMCIgbWFza1VuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeD0iMCIgeT0iMCIgd2lkdGg9IjI0ODAiIGhlaWdodD0iMjQ4MCIgZmlsbC1ydWxlPSJub256ZXJvIj48dXNlIHhsaW5rOmhyZWY9IiNjcDAiIGZpbGw9IndoaXRlIi8+PC9tYXNrPjxwb2x5Z29uIGlkPSJjcDAiIHBvaW50cz0iNjYsMTIyMyAxMjIzLDY2IDIzNDgsMTIyMyAxMjIzLDIzNDgiIHNoYXBlLXJlbmRlcmluZz0iY3Jpc3BFZGdlcyIvPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+LnNzMCB7ZmlsbDpyZ2IoMjU1LDEyOCwxMjgpO3N0cm9rZTpibGFjaztzdHJva2Utd2lkdGg6NDE7fS5iczAge2ZpbGw6YmxhY2s7c3Ryb2tlOm5vbmU7fTwvc3R5bGU+PC9kZWZzPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNjIzNDQgMCAwIDEuNjI0NTkgNjYuMTMzMyA2Ni4xMzMzKSI+PHBvbHlnb24gcG9pbnRzPSIwLDcwNyA3MDcsMCAxNDE0LDcwNyA3MDcsMTQxNCIgY2xhc3M9InNzMCIvPjwvZz48ZyBtYXNrPSJ1cmwoI2NyMCkiPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNjIzNDQgMCAwIDEuNjI0NTkgNjYuMTMzMyA2Ni4xMzMzKSI+PHBvbHlnb24gcG9pbnRzPSI0MzMsNDI3IDcwNyw1NzUgOTgxLDQyNyA5ODEsNTQ2IDcwNyw2OTQgNDMzLDU0NiIgY2xhc3M9ImJzMCIvPjwvZz48L2c+PC9zdmc+"
              : "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxODEiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMzYyMCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PG1hc2sgaWQ9ImNyMCIgbWFza1VuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeD0iMCIgeT0iMCIgd2lkdGg9IjM2MjAiIGhlaWdodD0iMjQ4MCIgZmlsbC1ydWxlPSJub256ZXJvIj48dXNlIHhsaW5rOmhyZWY9IiNjcDAiIGZpbGw9IndoaXRlIi8+PC9tYXNrPjxwb2x5Z29uIGlkPSJjcDAiIHBvaW50cz0iOTIsOTIgMzQ4Myw5MiAzNDgzLDIzNDIgOTIsMjM0MiIgc2hhcGUtcmVuZGVyaW5nPSJjcmlzcEVkZ2VzIi8+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxMjgsMjI0LDI1NSk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9LmJzMCB7ZmlsbDpibGFjaztzdHJva2U6bm9uZTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4yNDk5NSAwIDAgMi4yNTYzOCA5MS42NDU2IDkxLjg1MTkpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTUwMCIgaGVpZ2h0PSIxMDAwIiBjbGFzcz0ic3MwIi8+PC9nPjxnIG1hc2s9InVybCgjY3IwKSI+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4yNDk5NSAwIDAgMi4yNTYzOCA5MS42NDU2IDkxLjg1MTkpIj48cG9seWdvbiBwb2ludHM9IjQ3NiwyMjAgNzUwLDM2OCAxMDI0LDIyMCAxMDI0LDMzOSA3NTAsNDg3IDQ3NiwzMzkiIGNsYXNzPSJiczAiLz48L2c+PC9nPjwvc3ZnPg==",
              scale: 0.2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
            });
        }

        if (entity) {
            if (entity.billboard) {
                entity.billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
                entity.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
                entity.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
            }
            // LayerManager 군대부호관리 탭에서 식별/표시 제어할 수 있도록 메타데이터 저장
            entity.customData = {
                ...(entity.customData || {}),
                militarySymbol: true,
                source: 'unifiedControlPanel',
                sidc: currentSidc,
                shape: shape,
                displayName: userText
            };
            document.dispatchEvent(new CustomEvent('military-symbol-added', {
                detail: { entity: entity }
            }));

            addEntityToListBox(entity, userText, lng, lat, groundHeightText);

            if (currentViewer.terrainProvider) {
            const positions = [Cesium.Cartographic.fromDegrees(lng, lat)];
            Cesium.sampleTerrainMostDetailed(currentViewer.terrainProvider, positions)
                .then(updated => {
                if (updated && updated[0] && Number.isFinite(updated[0].height)) {
                    groundHeightText = `${updated[0].height.toFixed(2)} m`;
                } else {
                    groundHeightText = "0 m (미측정)";
                }
                const itemData = entityListMap.get(entity);
                if (itemData && itemData.heightSpan) {
                    itemData.heightSpan.innerText = groundHeightText;
                }
                })
                .catch(() => {
                const itemData = entityListMap.get(entity);
                if (itemData && itemData.heightSpan) {
                    itemData.heightSpan.innerText = "0 m";
                }
                });
            }

            entity.description = new Cesium.CallbackProperty(() => {
            const time = currentViewer.clock ? currentViewer.clock.currentTime : Cesium.JulianDate.now();
            const posVal = entity.position ? entity.position.getValue(time) : null;
            if (!posVal) return `<p><b>이름:</b> ${userText}</p><p>위치 없음</p>`;
            
            const carto = Cesium.Cartographic.fromCartesian(posVal);
            const curLon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
            const curLat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);

            return `
                <p><b>이름:</b> ${userText}</p>
                <p><b>좌표:</b> ${curLon}, ${curLat}</p>
                <p><b>지면 고도:</b> ${groundHeightText}</p>
            `;
            }, false);

            currentViewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, 500)
            });
        }
        };
    }

    setupActionButtons();
    setupWaypointLogic();
    }

  // ==========================================
  // 3. 기타 이벤트 및 웨이포인트 로직
  // ==========================================
  function removeEntityAndRenderedChildren(viewer, entity) {
    const childIds = entity?.customData?.renderedEntityIds || [];
    childIds.forEach(id => viewer.entities.removeById(id));
    viewer.entities.remove(entity);
  }

  document.addEventListener('military-symbol-removed', event => {
    const entity=event.detail?.entity, item=entityListMap.get(entity);
    if (item) { item.dom.remove(); entityListMap.delete(entity); }
  });

  function setupActionButtons() {
    const selectAllChk = document.getElementById("selectAllCheckbox");
    if (selectAllChk) {
      selectAllChk.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        const allChks = document.querySelectorAll(".entity-chk");
        allChks.forEach(chk => {
          chk.checked = isChecked;
        });
      });
    }

    document.getElementById("deleteBtn")?.addEventListener("click", () => {
      const viewer = window.CesiumViewer;
      if (!viewer) return;

      entityListMap.forEach((item, entity) => {
        if (item.checkbox.checked) {
          removeEntityAndRenderedChildren(viewer, entity);
          item.dom.remove();
          entityListMap.delete(entity);
        }
      });

      updateSelectAllCheckboxState();
    });

    document.getElementById("deleteAllBtn")?.addEventListener("click", () => {
      const viewer = window.CesiumViewer;
      if (viewer) viewer.entities.removeAll();

      const listBox = document.getElementById("entityListBox");
      if (listBox) listBox.innerHTML = "";
      entityListMap.clear();

      const selectAllChk = document.getElementById("selectAllCheckbox");
      if (selectAllChk) selectAllChk.checked = false;
    });

    document.getElementById("saveFileBtn")?.addEventListener("click", () => {
      const viewer = window.CesiumViewer;
      if (!viewer) return;
      const blob = new Blob([JSON.stringify(serializeEntities(viewer), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "entities.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    const loadFileBtn = document.getElementById("loadFileBtn");
    const fileInput = document.getElementById("fileInput");
    if (loadFileBtn && fileInput) {
      loadFileBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const viewer = window.CesiumViewer;
          if (!viewer) return;
          const entitiesData = JSON.parse(e.target.result);

          viewer.entities.removeAll();
          document.getElementById("entityListBox").innerHTML = "";
          entityListMap.clear();

          entitiesData.forEach(data => {
            if (data.kind === "multipointTacticalGraphic" && Array.isArray(data.positions)) {
              const entity = addStaticMultipointGraphic(viewer, data);
              const first = data.positions[0];
              if (entity && first) {
                addEntityToListBox(entity, data.name, first.lon, first.lat, `${data.positions.length}개 지점`);
              }
              return;
            }
            const entity = viewer.entities.add({
              name: data.name,
              position: Cesium.Cartesian3.fromDegrees(data.longitude, data.latitude, data.height)
            });
            if (data.kind === "militaryPoint" && data.sidc) {
              const svg=data.symbolMetadata?.renderer === "icop-svg"
                ? window.IcopSvgRenderer.render(data.symbolMetadata,data.sidc,{size:60,...(data.symbolOptions||{})},data.icopEditor?.values||{})
                : new ms.Symbol(data.sidc,{size:60,...(data.symbolOptions||{})}).asSVG();
              entity.billboard=new Cesium.BillboardGraphics({image:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg),heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY});
              entity.customData={militarySymbol:true,source:"unifiedControlPanel",displayName:data.name,sidc:data.sidc,symbolOptions:data.symbolOptions||{},icopCode:data.icopCode,symbolMetadata:data.symbolMetadata,icopEditor:data.icopEditor};
              document.dispatchEvent(new CustomEvent("military-symbol-added",{detail:{entity}}));
            }
            addEntityToListBox(entity, data.name, data.longitude, data.latitude, `${data.height ? data.height.toFixed(2) : 0} m`);
          });
        };
        reader.readAsText(file);
      });
    }
  }

  function addStaticMultipointGraphic(viewer, data) {
    const positions = data.positions
      .filter(point => Number.isFinite(point.lon) && Number.isFinite(point.lat))
      .map(point => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height || 0));
    if (positions.length < (data.sidc ? getMultipointRequirements(data.sidc, data.shape,data.modifiers?.icopValues || {}).min : (data.shape === "area" ? 3 : 2))) return null;

    if (data.sidc) {
      const exactEntity = renderMilitaryTacticalGraphic(viewer, data.sidc, data.positions, data.name, data.modifiers);
      if (exactEntity) {
        exactEntity.customData = {
          ...(exactEntity.customData || {}),
          militarySymbol: true,
          multipointTacticalGraphic: true,
          source: "unifiedControlPanel",
          shape: data.shape,
          displayName: data.name,
          sidc: data.sidc,
          symbolMetadata: data.symbolMetadata || null,
          icopEditor: data.icopEditor || null,
          modifiers: data.modifiers || null,
          positions: data.positions
        };
        return exactEntity;
      }
      console.warn("저장된 전술부호를 복원하지 못했습니다.", data.sidc);
      return null;
    }

    const arrowMaterial = typeof Cesium.PolylineArrowMaterialProperty === "function"
      ? new Cesium.PolylineArrowMaterialProperty(Cesium.Color.RED.withAlpha(0.9))
      : Cesium.Color.RED.withAlpha(0.9);
    let graphics;
    if (data.shape === "area") {
      graphics = {
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.RED.withAlpha(0.25),
          outline: true,
          outlineColor: Cesium.Color.RED
        },
        polyline: {
          positions: positions.concat([positions[0]]),
          width: 3,
          clampToGround: true,
          material: Cesium.Color.RED
        }
      };
    } else if (data.shape === "axis") {
      graphics = {
        corridor: {
          positions: positions,
          width: 80,
          material: Cesium.Color.RED.withAlpha(0.22),
          outline: true,
          outlineColor: Cesium.Color.RED
        },
        polyline: {
          positions: positions,
          width: 7,
          clampToGround: true,
          material: arrowMaterial
        }
      };
    } else {
      graphics = {
        polyline: {
          positions: positions,
          width: 4,
          clampToGround: true,
          material: data.shape === "arrow" ? arrowMaterial : Cesium.Color.YELLOW.withAlpha(0.9)
        }
      };
    }

    const entity = viewer.entities.add({ name: data.name, ...graphics });
    entity.customData = {
      militarySymbol: true,
      multipointTacticalGraphic: true,
      source: "unifiedControlPanel",
      shape: data.shape,
      displayName: data.name,
      sidc: data.sidc || null,
      symbolMetadata: data.symbolMetadata || null,
          icopEditor: data.icopEditor || null,
      positions: data.positions
    };
    document.dispatchEvent(new CustomEvent("military-symbol-added", { detail: { entity: entity } }));
    document.dispatchEvent(new CustomEvent("multipoint-tactical-graphic-added", { detail: { entity: entity } }));
    return entity;
  }

  function serializeEntities(viewer) {
    return viewer.entities.values
    .filter(entity => !entity.parent?.customData?.multipointTacticalGraphic)
    .map(entity => {
      if (entity.customData?.multipointTacticalGraphic) {
        return {
          kind: "multipointTacticalGraphic",
          name: entity.name || entity.customData.displayName || "전술도형",
          shape: entity.customData.shape,
          sidc: entity.customData.sidc || null,
          symbolMetadata: entity.customData.symbolMetadata || null,
          icopEditor: entity.customData.icopEditor || null,
          modifiers: entity.customData.modifiers || null,
          positions: entity.customData.positions
        };
      }
      const carto = Cesium.Cartographic.fromCartesian(
        entity.position?.getValue(viewer.clock.currentTime) || Cesium.Cartesian3.ZERO
      );
      return {
        name: entity.name || "",
        longitude: Cesium.Math.toDegrees(carto.longitude),
        latitude: Cesium.Math.toDegrees(carto.latitude),
        height: carto.height,
        ...(entity.billboard && entity.customData?.militarySymbol ? {
          kind:"militaryPoint", sidc:entity.customData.sidc,
          symbolOptions:entity.customData.symbolOptions || {},
          icopCode:entity.customData.icopCode || null,
          symbolMetadata:entity.customData.symbolMetadata || null,
          icopEditor:entity.customData.icopEditor || null
        } : {})
      };
    });
  }

  function setupWaypointLogic() {
    document.getElementById("addWaypointBtn")?.addEventListener("click", async () => {
      const lon = parseFloat(document.getElementById("lonInput").value);
      const lat = parseFloat(document.getElementById("latInput").value);
      const dur = parseFloat(document.getElementById("durationInput").value);
      if (isNaN(lon) || isNaN(lat)) { alert("위도/경도를 올바르게 입력하세요."); return; }
      await queueWaypointForSelectedEntity(lon, lat, isNaN(dur) ? 5 : dur);
    });

    document.getElementById("startMoveBtn")?.addEventListener("click", () => {
      bindQueuedWaypointsAndStart();
    });
  }

  function nowJulian() {
    return Cesium.JulianDate.fromDate(new Date());
  }

  function createSafeCallbackPosition(entity, timeline) {
    return new Cesium.CallbackProperty(function(time) {
      try {
        if (timeline && typeof timeline.getValue === 'function') {
          const v = timeline.getValue(time);
          if (Cesium.defined(v)) return v;
        }
        const lt = lastSampleTime.get(entity);
        if (Cesium.defined(lt) && timeline && typeof timeline.getValue === 'function') {
          const fallback = timeline.getValue(lt);
          if (Cesium.defined(fallback)) return fallback;
        }
        if (entity.position && entity.position.x !== undefined) return entity.position;
      } catch (e) {}
      return Cesium.Cartesian3.fromDegrees(0, 0, 0);
    }, false);
  }

  async function queueWaypointForSelectedEntity(lon, lat, durationSec) {
    const viewer = window.CesiumViewer;
    if (!viewer) return;
    const entity = viewer.selectedEntity;
    if (!entity) { alert('먼저 지도의 객체나 리스트 항목을 클릭하여 선택하세요.'); return; }
    const dur = Math.max(0.1, Number(durationSec) || 5);

    let q = waypointsByEntity.get(entity);
    if (!q) { q = []; waypointsByEntity.set(entity, q); }

    let height = 0;
    try {
      const carto = Cesium.Cartographic.fromDegrees(lon, lat);
      const updated = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [carto]);
      if (updated && updated[0] && Number.isFinite(updated[0].height)) {
        height = updated[0].height;
      }
    } catch (e) {}

    q.push({ lon: Number(lon), lat: Number(lat), dur: Number(dur), height: Number(height) });
    viewer.clock.shouldAnimate = false;
  }

  function bindQueuedWaypointsAndStart() {
    const viewer = window.CesiumViewer;
    if (!viewer) return;

    const execNow = nowJulian();
    let globalStop = execNow.clone();

    viewer.clock.startTime = execNow.clone();
    viewer.clock.currentTime = execNow.clone();
    viewer.clock.stopTime = execNow.clone();

    for (const [entity, q] of waypointsByEntity.entries()) {
      try {
        if (!q || q.length === 0) continue;
        let timeline = boundTimelines.get(entity);
        let cursor;

        if (timeline && typeof timeline.addSample === 'function') {
          cursor = lastSampleTime.get(entity) || execNow.clone();
        } else {
          timeline = new Cesium.SampledPositionProperty();
          boundTimelines.set(entity, timeline);

          let startCartesian = undefined;
          try {
            if (entity.position && typeof entity.position.getValue === 'function') {
              startCartesian = entity.position.getValue(execNow);
            }
          } catch (e) {}

          if (!startCartesian) {
            const first = q[0];
            startCartesian = Cesium.Cartesian3.fromDegrees(first.lon, first.lat, first.height || 0);
          }

          timeline.addSample(execNow, startCartesian);
          cursor = execNow.clone();
          entity.position = createSafeCallbackPosition(entity, timeline);
        }

        for (const wp of q) {
          cursor = Cesium.JulianDate.addSeconds(cursor, wp.dur, new Cesium.JulianDate());
          timeline.addSample(cursor, Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.height || 0));
        }

        lastSampleTime.set(entity, cursor.clone());

        try {
          if ((q.length + 1) >= 2) {
            entity.orientation = new Cesium.VelocityOrientationProperty(timeline);
          }
        } catch (e) {}

        boundTimelines.set(entity, timeline);
        if (Cesium.JulianDate.greaterThan(cursor, globalStop)) {
          globalStop = cursor.clone();
        }
        entity.show = true;
        waypointsByEntity.set(entity, []);
      } catch (e) {}
    }

    if (Cesium.JulianDate.lessThan(globalStop, viewer.clock.startTime)) {
      globalStop = Cesium.JulianDate.addSeconds(viewer.clock.startTime, 1, new Cesium.JulianDate());
    }
    viewer.clock.stopTime = globalStop.clone();
    viewer.clock.currentTime = viewer.clock.startTime.clone();

    viewer.clock.shouldAnimate = true;
  }

  // ==========================================
  // 4. 외부 노출 API
  // ==========================================
  function init() {
    if (isInitialized && document.getElementById("UnifiedControlModal") && document.getElementById("MilitarySymbolDialog")) return;
    createUnifiedUI();
    initSymbolLogic();
    initSampleLogic();
    setupEntityDragLogic();
    isInitialized = true;
  }

  function toggleUI() {
    let modal = document.getElementById("UnifiedControlModal");
    if (!modal) {
      init();
      modal = document.getElementById("UnifiedControlModal");
    }

    if (modal) {
      const currentDisplay = window.getComputedStyle(modal).display;
      modal.style.display = (currentDisplay === "none") ? "block" : "none";
    }
  }

  function toggleMilitaryUI(forceOpen) {
    let dialog = document.getElementById("MilitarySymbolDialog");
    if (!dialog) {
      init();
      dialog = document.getElementById("MilitarySymbolDialog");
    }
    if (!dialog) return;
    const isHidden = window.getComputedStyle(dialog).display === "none";
    dialog.style.display = forceOpen === true || isHidden ? "block" : "none";
    if (dialog.style.display === "block") {
      document.getElementById("symbolTreeSearch")?.focus();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  return {
    init: init,
    toggle: toggleUI,
    toggleControl: toggleUI,
    toggleMilitary: toggleMilitaryUI,
    openMilitary: () => toggleMilitaryUI(true),
    previewTactical(metadata, entity, state, sidc) {
      const points = entity?.customData?.positions || tacticalPreviewCoordinates(sidc,metadata.geometry,state.values);
      return renderMilitaryTacticalGraphic(getMultipointViewer(), sidc, points, state.name,
        {...(entity?.customData?.modifiers || {}), icopValues:state.values}, true);
    },
    updateTacticalEntity(entity, state, sidc) {
      const currentViewer=getMultipointViewer();
      const modifiers={...(entity.customData.modifiers || {}), icopValues:state.values};
      const rendered=renderMilitaryTacticalGraphic(currentViewer,sidc,entity.customData.positions,state.name,modifiers);
      if (!rendered) return false;
      for (const id of entity.customData.renderedEntityIds || []) currentViewer.entities.removeById(id);
      for (const key of ["polyline","polygon","corridor","label"]) entity[key]=undefined;
      for (const id of rendered.customData.renderedEntityIds) {
        const child=currentViewer.entities.getById(id);if(child)child.parent=entity;
      }
      entity.customData={...entity.customData,...rendered.customData,modifiers,icopEditor:state};
      currentViewer.entities.remove(rendered);
      return true;
    }
  };
})();

// 글로벌 핸들러
window.openSymbolPopup = function () {
  window.unifiedControlPanel.openMilitary();
};

window.militarySymbolDialog = {
  init: function () { window.unifiedControlPanel.init(); },
  toggle: function () { window.unifiedControlPanel.toggleMilitary(); },
  open: function () { window.unifiedControlPanel.openMilitary(); }
};

window.sample = {
  init: function () { window.unifiedControlPanel.init(); },
  toggle: function () { window.unifiedControlPanel.toggle(); }
};
