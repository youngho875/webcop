window.unifiedControlPanel = (function () {
  // ==========================================
  // 전역 상태 관리 (sample 로직용)
  // ==========================================
  const waypointsByEntity = new Map();   // Map<Entity, Array<{lon,lat,dur,height}>>
  const boundTimelines = new Map();      // Map<Entity, SampledPositionProperty>
  const lastSampleTime = new Map();      // Map<Entity, JulianDate>
  let isInitialized = false;
  let currentSidc = "SFZ*-----------";

  // ==========================================
  // 1. UI 동적 생성 (통합 UI)
  // ==========================================
  function createUnifiedUI() {
    if (document.getElementById("UnifiedControlModal")) return;

    const uiHTML = `
      <div id="UnifiedControlModal" class="unified-modal" style="display: none; position: fixed; top: 20px; left: 20px; z-index: 9999; background: white; border: 1px solid #ccc; padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); width: 360px; font-family: sans-serif; font-size: 13px; color: #333; box-sizing: border-box; user-select: none;">
        
        <!-- 드래그 핸들 겸 상단 헤더 -->
        <div id="unifiedHeader" style="background: #34495e; color: white; padding: 8px 12px; cursor: move; display: flex; justify-content: space-between; align-items: center; border-top-left-radius: 6px; border-top-right-radius: 6px; margin: -15px -15px 10px -15px;">
          <span style="font-weight: bold; font-size: 14px;">통합 관제 패널</span>
          <button id="btnUnifiedClose" style="background: transparent; border: none; color: white; font-size: 18px; cursor: pointer; font-weight: bold; line-height: 1;">&times;</button>
        </div>

        <!-- Tab 버튼 영역 -->
        <div style="display: flex; border-bottom: 2px solid #ddd; margin-bottom: 12px;">
          <button id="tabBtnSymbol" style="flex: 1; padding: 8px; background: #e0e0e0; border: none; font-weight: bold; cursor: pointer; border-top-left-radius: 4px; border-top-right-radius: 4px;">군대 부호</button>
          <button id="tabBtnControl" style="flex: 1; padding: 8px; background: #fff; border: none; font-weight: bold; cursor: pointer; border-top-left-radius: 4px; border-top-right-radius: 4px;">객체/관제</button>
        </div>

        <!-- ================= TAB 1: 군대 부호 선택 ================= -->
        <div id="tabContentSymbol" style="display: block;">
          <div id="symbolList" style="display: flex; justify-content: center; align-items: center; margin-bottom: 10px; height: 90px; cursor: grab; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px;">
          </div>
          
          <div style="display: flex; align-items: center; margin-bottom: 10px; font-size: 13px;">
            <label for="sympo2" style="margin-right: 10px; width: 60px;">피아식별</label>
            <select name="StandardIdentity/ExerciseDescriptor" id="sympo2" style="padding: 4px; background: #f4f4f4; border: 1px solid #d1d1d1; border-radius: 4px; font-size: 12px; flex-grow: 1; outline: none;">
              <option value="-">NULL</option>
              <option value="P">PENDING</option>
              <option value="U">UNKNOWN</option>
              <option value="A">ASSUMED FRIEND</option>
              <option value="F">FRIEND</option>
              <option value="N">NEUTRAL</option>
              <option value="S">SUSPECT</option>
              <option value="H">HOSTILE</option>
              <option value="G">EXERCISE PENDING</option>
              <option value="W">EXERCISE UNKNOWN</option>
              <option value="M">EXERCISE ASSUMED FRIEND</option>
              <option value="D">EXERCISE FRIEND</option>
              <option value="L">EXERCISE NEUTRAL</option>
              <option value="J">JOKER</option>
              <option value="K">FAKER</option>
            </select>
          </div>

          <div style="border: 1px solid #ccc; background: white; height: 320px; overflow: auto; padding: 5px;">
            <div id="layerTree" style="font-size: 13px; color: #000;"></div>
          </div>
        </div>

        <!-- ================= TAB 2: Cesium 객체 및 관제 ================= -->
        <div id="tabContentControl" style="display: none;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 65px;">경도(Lng):</label>
              <input type="text" id="lng" value="126.9780" style="flex: 1; padding: 4px;" />
            </div>
            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 65px;">위도(Lat):</label>
              <input type="text" id="lat" value="37.5665" style="flex: 1; padding: 4px;" />
            </div>
            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 65px;">라벨명:</label>
              <input type="text" id="nameLabel" value="객체 1" style="flex: 1; padding: 4px;" />
            </div>
            <div style="display: flex; gap: 5px; align-items: center;">
              <label style="width: 65px;">모양:</label>
              <select id="shape" style="flex: 1; padding: 4px;">
                <option value="box">Box (상자)</option>
                <option value="sphere1">Sphere 1 (빨강)</option>
                <option value="sphere2">Sphere 2 (파랑)</option>
                <option value="sphere3">Sphere 3 (노랑)</option>
                <option value="billboard1">Billboard 1</option>
                <option value="billboard2">Billboard 2</option>
                <option value="billboard3">Billboard 3</option>
              </select>
            </div>

            <div id="boxFields" style="display: block; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 2px;">
              <div style="display: flex; gap: 5px; margin-bottom: 4px;">
                <span>가로: <input type="number" id="boxWidth" value="20" style="width: 45px; padding: 2px;" /></span>
                <span>세로: <input type="number" id="boxDepth" value="20" style="width: 45px; padding: 2px;" /></span>
                <span>높이: <input type="number" id="boxHeight" value="20" style="width: 45px; padding: 2px;" /></span>
              </div>
            </div>

            <button id="addBtn" style="padding: 6px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">객체 생성</button>

            <hr style="width: 100%; border: 0; border-top: 1px solid #eee; margin: 5px 0;" />

            <div style="font-weight: bold; margin-bottom: 2px;">웨이포인트 이동</div>
            <div style="display: flex; gap: 5px;">
              <input type="text" id="lonInput" placeholder="경도" style="width: 30%; padding: 4px;" />
              <input type="text" id="latInput" placeholder="위도" style="width: 30%; padding: 4px;" />
              <input type="number" id="durationInput" placeholder="초(s)" value="5" style="width: 30%; padding: 4px;" />
            </div>
            <div style="display: flex; gap: 5px; margin-top: 4px;">
              <button id="addWaypointBtn" style="flex: 1; padding: 5px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">경로 추가</button>
              <button id="startMoveBtn" style="flex: 1; padding: 5px; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer;">이동 시작</button>
            </div>

            <hr style="width: 100%; border: 0; border-top: 1px solid #eee; margin: 5px 0;" />

            <div style="display: flex; gap: 5px;">
              <button id="deleteBtn" style="flex: 1; padding: 4px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">선택 삭제</button>
              <button id="deleteAllBtn" style="flex: 1; padding: 4px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer;">전체 삭제</button>
            </div>
            <div style="display: flex; gap: 5px; margin-top: 4px;">
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
      tabContentSymbol.style.display = "none";
      tabContentControl.style.display = "block";
      tabBtnSymbol.style.background = "#fff";
      tabBtnControl.style.background = "#e0e0e0";
    });

    makeElementDraggable(
      document.getElementById("UnifiedControlModal"), 
      document.getElementById("unifiedHeader")
    );
  }

  // ==========================================
  // 2. 다이얼로그 드래그 함수 (통합)
  // ==========================================
  function makeElementDraggable(elmnt, dragHandle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    dragHandle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      if (e.target.id === 'btnUnifiedClose') return;

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

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      elmnt.style.top = newTop + "px";
      elmnt.style.left = newLeft + "px";
      elmnt.style.right = "auto";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // ==========================================
  // 3. 군대부호(milsymbol) 및 jstree 로직
  // ==========================================
  function initSymbolLogic() {
    const symbolList = document.getElementById("symbolList");
    const sympo2 = document.getElementById("sympo2");

    if (!symbolList || !sympo2) return;

    function renderSymbol(sidc) {
      symbolList.innerHTML = ""; 

      let symbolUrl = "";
      try {
        const symbol = new ms.Symbol(sidc, { size: 60 });
        symbolUrl = symbol.asSVG();
      } catch (e) {
        console.warn("milsymbol.js 에러:", e);
        symbolUrl = `<div style="width:80px; height:80px; background:#ccc; display:flex; justify-content:center; align-items:center;">?</div>`;
      }

      const div = document.createElement("div");
      div.className = "symbolItem symbol";
      div.draggable = true;
      div.innerHTML = symbolUrl;

      div.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", sidc);
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

    if (typeof $ !== "undefined" && $.fn.jstree) {
      $('#layerTree').jstree({
        "plugins": ["wholerow"],
        "core": {
          "check_callback": true,
          "data": {
            "url": "data1/alldata.json",
            "dataType": "json",
            "error": function(jqXHR, textStatus, errorThrown) {
              console.error("jstree 데이터 로드 실패:");
              console.error("상태: " + textStatus);
              console.error("에러: " + errorThrown);
              $('#layerTree').html("<div style='color:red; padding:10px;'>데이터를 불러오지 못했습니다.<br>경로나 JSON 형식을 확인하세요.</div>");
            }
          }
        }
      });

      $('#layerTree').on('select_node.jstree', function(event, data) {
        var selectedNodeId = data.node.id;
        var selectedNodeData = data.node.data || (data.node.original && data.node.original.data);

        console.log('선택된 노드 ID:', selectedNodeId);
        console.log('선택된 노드 데이터:', selectedNodeData);

        if (selectedNodeData) {
          const indc = document.getElementById("sympo2").value;
          currentSidc = "S" + indc.toString() + selectedNodeData.toString().substr(2, 13);
          renderSymbol(currentSidc);
        }
      });
    } else {
      console.warn("jQuery 또는 jstree 플러그인이 로드되지 않았습니다.");
    }
  }

  // ==========================================
  // 4. Cesium / Sample 관제 로직
  // ==========================================
  function initSampleLogic() {
    const modal = document.getElementById("UnifiedControlModal") || document;
    const shapeSelect = modal.querySelector('#shape');
    const boxFields = modal.querySelector('#boxFields');

    if (shapeSelect && boxFields) {
      shapeSelect.addEventListener('change', () => {
        boxFields.style.display = shapeSelect.value === 'box' ? 'block' : 'none';
      });
    }

    const addBtn = modal.querySelector('#addBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const currentModal = document.getElementById("UnifiedControlModal") || document;
        const lng = parseFloat(currentModal.querySelector('#lng')?.value);
        const lat = parseFloat(currentModal.querySelector('#lat')?.value);
        const userText = currentModal.querySelector("#nameLabel")?.value || "객체";
        const shape = shapeSelect ? shapeSelect.value : 'box';
        const viewer = window.CesiumViewer;
        if (!viewer || isNaN(lng) || isNaN(lat)) return;

        let entity = null;
        let groundHeightText = "계산 중...";

        if (shape === 'box') {
          const w = parseFloat(currentModal.querySelector('#boxWidth')?.value) || 20;
          const d = parseFloat(currentModal.querySelector('#boxDepth')?.value) || 20;
          const h = parseFloat(currentModal.querySelector('#boxHeight')?.value) || 20;

          entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            box: {
              dimensions: new Cesium.Cartesian3(w, d, h),
              material: Cesium.Color.GREEN.withAlpha(0.6),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
          });
          updateEntityDescription(entity, viewer, lng, lat);

        } else if (shape.includes('sphere')) {
          // [요청 반영] sphere 분기
          entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            ellipsoid: {
              radii: new Cesium.Cartesian3(1, 1, 1),
              material: shape == 'sphere1' ? Cesium.Color.RED.withAlpha(0.6) : shape == 'sphere2' ? Cesium.Color.BLUE.withAlpha(0.6) : Cesium.Color.YELLOW.withAlpha(0.6),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            billboard: {
              image: shape == 'sphere1'? 
            "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigyNTUsMTI4LDEyOCk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMS42MjM0NCAwIDAgMS42MjQ1OSA2Ni4xMzMzIDY2LjEzMzMpIj48cG9seWdvbiBwb2ludHM9IjAsNzA3IDcwNywwIDE0MTQsNzA3IDcwNywxNDE0IiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg=="
            :shape == 'sphere2'? "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxODEiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMzYyMCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxMjgsMjI0LDI1NSk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4yNDk5NSAwIDAgMi4yNTYzOCA5MS42NDU2IDkxLjg1MTkpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTUwMCIgaGVpZ2h0PSIxMDAwIiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg=="
            :"data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxNzAsMjU1LDE3MCk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4wNjM1NSAwIDAgMi4wNjU0MyA4NC4wNjc4IDg0LjA2NzgpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTEwMCIgaGVpZ2h0PSIxMTAwIiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg==",
            scale: 0.2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
          });

          const positions = [Cesium.Cartographic.fromDegrees(lng, lat)];
          if (viewer.terrainProvider) {
            Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions).then(updated => {
              if (updated && updated[0] && Number.isFinite(updated[0].height)) {
                groundHeightText = `${updated[0].height.toFixed(2)} m`;
              }
            });
          }

          entity.description = new Cesium.CallbackProperty(() => {
            const time = viewer.clock ? viewer.clock.currentTime : Cesium.JulianDate.now();
            const carto = Cesium.Cartographic.fromCartesian(
              entity.position.getValue(time)
            );
            const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
            const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);

            return `
              <p><b>좌표:</b> ${lon}, ${lat}</p>
              <p><b>지면 고도:</b> ${groundHeightText}</p>
            `;
          }, false);

        } else if (shape === "billboard3") {
          // [요청 반영] billboard3 분기
          entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            billboard: {
              image: "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMTgiIGhlaWdodD0iMTIxIiB2aWV3Qm94PSIwIDAgMjM2MCAyNDIwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxMjgsMjI0LDI1NSk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MDt9LnRzMCB7Zm9udC1mYW1pbHk6QXJpYWw7Zm9udC1zaXplOjI1MTdweDtmb250LXdlaWdodDpib2xkO2ZpbGw6YmxhY2s7dGV4dC1hbmNob3I6bWlkZGxlO308L3N0eWxlPjwvZGVmcz48ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjUxMDc5IDAgMCAxLjUxMTg5IDQwIDg0NS40KSI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjE1MDAiIGhlaWdodD0iMTAwMCIgY2xhc3M9InNzMCIvPjwvZz48ZyB0cmFuc2Zvcm09Im1hdHJpeCgwLjIgMCAwIDAuMiA0MCA0MCkiPjx0ZXh0IHg9IjU2NzMiIHk9IjM1MTQiIGNsYXNzPSJ0czAiPkkgSTwvdGV4dD48L2c+PC9zdmc+",
              scale: 0.5,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
          });

          const positions = [Cesium.Cartographic.fromDegrees(lng, lat)];
          if (viewer.terrainProvider) {
            Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions).then(updated => {
              if (updated && updated[0] && Number.isFinite(updated[0].height)) {
                groundHeightText = `${updated[0].height.toFixed(2)} m`;
              }
            });
          }

          entity.description = new Cesium.CallbackProperty(() => {
            const time = viewer.clock ? viewer.clock.currentTime : Cesium.JulianDate.now();
            const carto = Cesium.Cartographic.fromCartesian(
              entity.position.getValue(time)
            );
            const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
            const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);

            return `
              <p><b>좌표:</b> ${lon}, ${lat}</p>
              <p><b>지면 고도:</b> ${groundHeightText}</p>
            `;
          }, false);

        } else {
          // [요청 반영] 기타 billboard1 / billboard2 분기
          entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            name: userText,
            ellipsoid: {
              radii: new Cesium.Cartesian3(3, 3, 3),
              material: shape == 'billboard1' ? Cesium.Color.RED.withAlpha(0.6) : Cesium.Color.BLUE.withAlpha(0.6),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            billboard: {
              image: shape == 'billboard1'? "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PG1hc2sgaWQ9ImNyMCIgbWFza1VuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeD0iMCIgeT0iMCIgd2lkdGg9IjI0ODAiIGhlaWdodD0iMjQ4MCIgZmlsbC1ydWxlPSJub256ZXJvIj48dXNlIHhsaW5rOmhyZWY9IiNjcDAiIGZpbGw9IndoaXRlIi8+PC9tYXNrPjxwb2x5Z29uIGlkPSJjcDAiIHBvaW50cz0iNjYsMTIyMyAxMjIzLDY2IDIzNDgsMTIyMyAxMjIzLDIzNDgiIHNoYXBlLXJlbmRlcmluZz0iY3Jpc3BFZGdlcyIvPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+LnNzMCB7ZmlsbDpyZ2IoMjU1LDEyOCwxMjgpO3N0cm9rZTpibGFjaztzdHJva2Utd2lkdGg6NDE7fS5iczAge2ZpbGw6YmxhY2s7c3Ryb2tlOm5vbmU7fTwvc3R5bGU+PC9kZWZzPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNjIzNDQgMCAwIDEuNjI0NTkgNjYuMTMzMyA2Ni4xMzMzKSI+PHBvbHlnb24gcG9pbnRzPSIwLDcwNyA3MDcsMCAxNDE0LDcwNyA3MDcsMTQxNCIgY2xhc3M9InNzMCIvPjwvZz48ZyBtYXNrPSJ1cmwoI2NyMCkiPjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNjIzNDQgMCAwIDEuNjI0NTkgNjYuMTMzMyA2Ni4xMzMzKSI+PHBvbHlnb24gcG9pbnRzPSI0MzMsNDI3IDcwNyw1NzUgOTgxLDQyNyA5ODEsNTQ2IDcwNyw2OTQgNDMzLDU0NiIgY2xhc3M9ImJzMCIvPjwvZz48L2c+PC9zdmc+"
              : "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxODEiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMzYyMCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PG1hc2sgaWQ9ImNyMCIgbWFza1VuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeD0iMCIgeT0iMCIgd2lkdGg9IjM2MjAiIGhlaWdodD0iMjQ4MCIgZmlsbC1ydWxlPSJub256ZXJvIj48dXNlIHhsaW5rOmhyZWY9IiNjcDAiIGZpbGw9IndoaXRlIi8+PC9tYXNrPjxwb2x5Z29uIGlkPSJjcDAiIHBvaW50cz0iOTIsOTIgMzQ4Myw5MiAzNDgzLDIzNDIgOTIsMjM0MiIgc2hhcGUtcmVuZGVyaW5nPSJjcmlzcEVkZ2VzIi8+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxMjgsMjI0LDI1NSk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9LmJzMCB7ZmlsbDpibGFjaztzdHJva2U6bm9uZTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4yNDk5NSAwIDAgMi4yNTYzOCA5MS42NDU2IDkxLjg1MTkpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTUwMCIgaGVpZ2h0PSIxMDAwIiBjbGFzcz0ic3MwIi8+PC9nPjxnIG1hc2s9InVybCgjY3IwKSI+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4yNDk5NSAwIDAgMi4yNTYzOCA5MS42NDU2IDkxLjg1MTkpIj48cG9seWdvbiBwb2ludHM9IjQ3NiwyMjAgNzUwLDM2OCAxMDI0LDIyMCAxMDI0LDMzOSA3NTAsNDg3IDQ3NiwzMzkiIGNsYXNzPSJiczAiLz48L2c+PC9nPjwvc3ZnPg==",
              scale: 0.2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
          });
          updateEntityDescription(entity, viewer, lng, lat);
        }

        if (entity) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, 500)
          });
        }
      });
    }

    setupActionButtons();
    setupWaypointLogic();
  }

  function updateEntityDescription(entity, viewer, lng, lat) {
    let groundHeightText = "0 m";
    const positions = [Cesium.Cartographic.fromDegrees(lng, lat)];
    if (viewer.terrainProvider) {
      Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions).then(updated => {
        if (updated && updated[0] && Number.isFinite(updated[0].height)) {
          groundHeightText = `${updated[0].height.toFixed(2)} m`;
        }
      });
    }

    entity.description = new Cesium.CallbackProperty(() => {
      const time = viewer.clock ? viewer.clock.currentTime : Cesium.JulianDate.now();
      const posVal = entity.position ? entity.position.getValue(time) : null;
      if (!posVal) return `<p><b>이름:</b> ${entity.name || ''}</p><p>위치 없음</p>`;

      const carto = Cesium.Cartographic.fromCartesian(posVal);
      const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
      const latVal = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
      return `<p><b>좌표:</b> ${lon}, ${latVal}</p><p><b>지면 고도:</b> ${groundHeightText}</p>`;
    }, false);
  }

  function setupActionButtons() {
    const modal = document.getElementById("UnifiedControlModal") || document;

    modal.querySelector("#deleteBtn")?.addEventListener("click", () => {
      const viewer = window.CesiumViewer;
      if (viewer && viewer.selectedEntity) viewer.entities.remove(viewer.selectedEntity);
    });

    modal.querySelector("#deleteAllBtn")?.addEventListener("click", () => {
      window.CesiumViewer?.entities.removeAll();
    });

    modal.querySelector("#saveFileBtn")?.addEventListener("click", () => {
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

    const loadFileBtn = modal.querySelector("#loadFileBtn");
    const fileInput = modal.querySelector("#fileInput");
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

          entitiesData.forEach(data => {
            const options = {
              name: data.name,
              position: Cesium.Cartesian3.fromDegrees(data.longitude, data.latitude, data.height)
            };
            const entity = viewer.entities.add(options);
            updateEntityDescription(entity, viewer, data.longitude, data.latitude);
          });
        };
        reader.readAsText(file);
      });
    }
  }

  function serializeEntities(viewer) {
    const time = viewer.clock ? viewer.clock.currentTime : Cesium.JulianDate.now();
    return viewer.entities.values.map(entity => {
      const carto = Cesium.Cartographic.fromCartesian(
        entity.position?.getValue(time) || Cesium.Cartesian3.ZERO
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
    const viewer = window.CesiumViewer;
    if (viewer && !viewer._unifiedWaypointHandlerBound) {
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && Cesium.defined(picked.id)) {
          viewer.selectedEntity = picked.id;
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      viewer._unifiedWaypointHandlerBound = true;
    }

    const modal = document.getElementById("UnifiedControlModal") || document;

    modal.querySelector("#addWaypointBtn")?.addEventListener("click", async () => {
      const lon = parseFloat(modal.querySelector("#lonInput")?.value);
      const lat = parseFloat(modal.querySelector("#latInput")?.value);
      const dur = parseFloat(modal.querySelector("#durationInput")?.value);
      if (isNaN(lon) || isNaN(lat)) { alert("위도/경도를 올바르게 입력하세요."); return; }
      await queueWaypointForSelectedEntity(lon, lat, isNaN(dur) ? 5 : dur);
    });

    modal.querySelector("#startMoveBtn")?.addEventListener("click", () => {
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
    if (!entity) { alert('먼저 객체를 선택하세요.'); return; }
    const dur = Math.max(0.1, Number(durationSec) || 5);

    let q = waypointsByEntity.get(entity);
    if (!q) { q = []; waypointsByEntity.set(entity, q); }

    let height = 0;
    try {
      const carto = Cesium.Cartographic.fromDegrees(lon, lat);
      if (viewer.terrainProvider) {
        const updated = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [carto]);
        if (updated && updated[0] && Number.isFinite(updated[0].height)) {
          height = updated[0].height;
        }
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
  // 5. 공통 제어 및 외부 호환성 API
  // ==========================================
  function init() {
    if (isInitialized) return;
    createUnifiedUI();
    initSymbolLogic();
    initSampleLogic();
    isInitialized = true;
  }

  function toggleUI() {
    if (!isInitialized) {
      init();
    }
    const modal = document.getElementById("UnifiedControlModal");
    if (!modal) return;
    modal.style.display = (modal.style.display === "none" || modal.style.display === "") ? "block" : "none";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  return {
    init: init,
    toggle: toggleUI
  };
})();

// 기존 외부 스크립트 호환성 바인딩
window.openSymbolPopup = function () {
  window.unifiedControlPanel.toggle();
};

window.sample = {
  init: function () {
    window.unifiedControlPanel.init();
  },
  toggle: function () {
    window.unifiedControlPanel.toggle();
  }
};