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
            아래 군대부호를 지도 위 원하는 위치로 드래그하세요.
          </div>
          <div id="symbolList" style="display: flex; justify-content: center; align-items: center; margin-bottom: 10px; height: 90px; cursor: grab; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px;">
          </div>
          <div id="symbolSelectionInfo" style="min-height: 34px; margin: -4px 0 8px; color: #555; font-size: 11px; text-align: center; line-height: 1.45;"></div>
          
          <div style="display: flex; align-items: center; margin-bottom: 10px; font-size: 13px;">
            <label for="sympo2" style="margin-right: 10px; width: 60px;">피아식별</label>
            <select name="StandardIdentity/ExerciseDescriptor" id="sympo2" style="padding: 4px; background: #f4f4f4; border: 1px solid #d1d1d1; border-radius: 4px; font-size: 12px; flex-grow: 1; outline: none;">
              <option value="-">미지정</option>
              <option value="P">판단 대기</option>
              <option value="U">미상</option>
              <option value="A">우군 추정</option>
              <option value="F">우군</option>
              <option value="N">중립</option>
              <option value="S">적성 의심</option>
              <option value="H">적군</option>
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

    document.getElementById("btnUnifiedClose").addEventListener("click", () => toggleUI());

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
      if (typeof sidc !== "string" || sidc.length !== 15) return sidc;
      return sidc.substring(0, 1) + affiliation + sidc.substring(2);
    }

    function renderSymbol(sidc, metadata = currentSymbolMetadata) {
      symbolList.innerHTML = ""; 
      currentSymbolMetadata = metadata || {};
      const info = document.getElementById("symbolSelectionInfo");
      const geometry = currentSymbolMetadata.geometry || "POINT";
      const renderer = currentSymbolMetadata.renderer || "milsymbol";
      const displayName = currentSymbolMetadata.text || currentSymbolMetadata.textEn || "군대부호";

      if (info) {
        info.textContent = `${displayName} · ${sidc || "SIDC 없음"}`;
      }

      if (!sidc || renderer !== "milsymbol" || geometry !== "POINT") {
        const guide = document.createElement("div");
        guide.style.cssText = "padding:10px; text-align:center; color:#555; line-height:1.5;";
        guide.innerHTML = `<strong>${displayName}</strong><br><span>${geometry} 전술도형 · 지도 그리기 도구 연동 필요</span>`;
        symbolList.appendChild(guide);
        return;
      }

      let symbolUrl = "";
      try {
        const symbol = new ms.Symbol(sidc, { size: 60 });
        symbolUrl = symbol.asSVG();
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
      if (currentSidc.length >= 15) {
        currentSidc = currentSidc.substring(0, 1) + indc + currentSidc.substring(2);
        renderSymbol(currentSidc);
      }
    });

    initLayerTree(renderSymbol, applyAffiliation);

    setupSymbolDropLogic();
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
    const treeDataUrl = new URL("data1/alldata-2525c-ko.json", document.baseURI).href;

    $tree
      .off("select_node.jstree.unifiedPanel ready.jstree.unifiedPanel load_node.jstree.unifiedPanel")
      .on("ready.jstree.unifiedPanel", () => {
        if (statusElement) statusElement.style.display = "none";
        const treeInstance = $tree.jstree(true);
        if (treeInstance) treeInstance.open_node("2525C");
      })
      .on("select_node.jstree.unifiedPanel", (event, data) => {
        const treeInstance = $tree.jstree(true);
        if (treeInstance && data.node.children && data.node.children.length > 0) {
          treeInstance.toggle_node(data.node);
        }

        const selectedNodeData = data.node.data || (data.node.original && data.node.original.data);
        const original = data.node.original || {};
        if (!selectedNodeData || original.selectable === false) return;

        const indc = document.getElementById("sympo2").value;
        currentSidc = selectedNodeData.toString();
        if (indc !== "-") currentSidc = applyAffiliation(currentSidc, indc);
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
          instance.open_node("2525C");
        }
      };
    }
  }

  // 군대부호 미리보기를 Cesium 지도에 드롭하여 도시한다.
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

      let svg;
      try {
        svg = new ms.Symbol(sidc, { size: 60 }).asSVG();
      } catch (error) {
        console.error("군대부호 생성 실패:", error);
        alert("군대부호 이미지를 생성하지 못했습니다.");
        return;
      }

      const imageUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lng = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const name = `군대부호 ${entityIdCounter}`;
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
          viewer.entities.remove(entity);
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
            const entity = viewer.entities.add({
              name: data.name,
              position: Cesium.Cartesian3.fromDegrees(data.longitude, data.latitude, data.height)
            });
            addEntityToListBox(entity, data.name, data.longitude, data.latitude, `${data.height ? data.height.toFixed(2) : 0} m`);
          });
        };
        reader.readAsText(file);
      });
    }
  }

  function serializeEntities(viewer) {
    return viewer.entities.values.map(entity => {
      const carto = Cesium.Cartographic.fromCartesian(
        entity.position?.getValue(viewer.clock.currentTime) || Cesium.Cartesian3.ZERO
      );
      return {
        name: entity.name || "",
        longitude: Cesium.Math.toDegrees(carto.longitude),
        latitude: Cesium.Math.toDegrees(carto.latitude),
        height: carto.height
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
    openMilitary: () => toggleMilitaryUI(true)
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
