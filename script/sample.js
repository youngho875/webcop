window.sample = (function () {
    // 전역 상태 관리
    const waypointsByEntity = new Map();   // Map<Entity, Array<{lon,lat,dur,height}>>
    const boundTimelines = new Map();      // Map<Entity, SampledPositionProperty>
    const lastSampleTime = new Map();      // Map<Entity, JulianDate>
    let isInitialized = false;

    // UI 생성 및 초기화
    function init() {
        if (isInitialized) return;

        let sampleContainer = document.getElementById("sample");
        if (!sampleContainer) {
            sampleContainer = document.createElement("div");
            sampleContainer.id = "sample";
            sampleContainer.style.cssText = "display: block; position: fixed; top: 20px; left: 20px; z-index: 9999; background: white; border: 1px solid #ccc; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 320px; font-family: sans-serif; font-size: 13px; color: #333;";
            document.body.appendChild(sampleContainer);
        }

        sampleContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; gap: 5px; align-items: center;">
                    <label style="width: 60px;">경도(Lng):</label>
                    <input type="text" id="lng" value="126.9780" style="flex: 1; padding: 4px;" />
                </div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <label style="width: 60px;">위도(Lat):</label>
                    <input type="text" id="lat" value="37.5665" style="flex: 1; padding: 4px;" />
                </div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <label style="width: 60px;">라벨명:</label>
                    <input type="text" id="nameLabel" value="객체 1" style="flex: 1; padding: 4px;" />
                </div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <label style="width: 60px;">모양:</label>
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
        `;

        initDialogUI();

        const shapeSelect = document.getElementById('shape');
        const boxFields = document.getElementById('boxFields');

        if (shapeSelect && boxFields) {
            shapeSelect.addEventListener('change', () => {
                boxFields.style.display = shapeSelect.value === 'box' ? 'block' : 'none';
            });
        }

        const addBtn = document.getElementById('addBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const lng = parseFloat(document.getElementById('lng').value);
                const lat = parseFloat(document.getElementById('lat').value);
                const userText = document.getElementById("nameLabel").value;
                const shape = shapeSelect.value;
                const viewer = window.CesiumViewer;
                if (!viewer) return;

                if (shape === 'box') {
                    const w = parseFloat(document.getElementById('boxWidth').value);
                    const d = parseFloat(document.getElementById('boxDepth').value);
                    const h = parseFloat(document.getElementById('boxHeight').value);

                    const entity = viewer.entities.add({
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
                    const entity = viewer.entities.add({
                        position: Cesium.Cartesian3.fromDegrees(lng, lat),
                        name: userText,
                        ellipsoid: {
                            radii: new Cesium.Cartesian3(1, 1, 1),
                            material: shape == 'sphere1' ? Cesium.Color.RED.withAlpha(0.6) : shape == 'sphere2' ? Cesium.Color.BLUE.withAlpha(0.6) : Cesium.Color.YELLOW.withAlpha(0.6),
                            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                        }
                    });
                    updateEntityDescription(entity, viewer, lng, lat);
                } else {
                    const entity = viewer.entities.add({
                        position: Cesium.Cartesian3.fromDegrees(lng, lat),
                        name: userText,
                        billboard: {
                            image: shape == 'sphere1'? 
                            "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigyNTUsMTI4LDEyOCk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMS42MjM0NCAwIDAgMS42MjQ1OSA2Ni4xMzMzIDY2LjEzMzMpIj48cG9seWdvbiBwb2ludHM9IjAsNzA3IDcwNywwIDE0MTQsNzA3IDcwNywxNDE0IiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg=="
                            :shape == 'sphere2'? "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxODEiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMzYyMCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxMjgsMjI0LDI1NSk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4yNDk5NSAwIDAgMi4yNTYzOCA5MS42NDU2IDkxLjg1MTkpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTUwMCIgaGVpZ2h0PSIxMDAwIiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg=="
                            :"data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGJhc2VQcm9maWxlPSJmdWxsIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHdpZHRoPSIxMjQiIGhlaWdodD0iMTI0IiB2aWV3Qm94PSIwIDAgMjQ4MCAyNDgwIj48bWV0YWRhdGE+PHJkZjpSREY+PHJkZjpEZXNjcmlwdGlvbj48ZGM6ZGVzY3JpcHRpb24+TVNTL01pbFgtRXhwb3J0IHRvIFNWRzwvZGM6ZGVzY3JpcHRpb24+PGRjOnB1Ymxpc2hlcj5ncy1zb2Z0IEFHPC9kYzpwdWJsaXNoZXI+PC9yZGY6RGVzY3JpcHRpb24+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3MwIHtmaWxsOnJnYigxNzAsMjU1LDE3MCk7c3Ryb2tlOmJsYWNrO3N0cm9rZS13aWR0aDo0MTt9PC9zdHlsZT48L2RlZnM+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMi4wNjM1NSAwIDAgMi4wNjU0MyA4NC4wNjc4IDg0LjA2NzgpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTEwMCIgaGVpZ2h0PSIxMTAwIiBjbGFzcz0ic3MwIi8+PC9nPjwvc3ZnPg==",
                            scale: 0.2,
                        }
                    });
                    updateEntityDescription(entity, viewer, lng, lat);
                }

                viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(lng, lat, 500)
                });
            });
        }

        setupActionButtons();
        setupWaypointLogic();
        isInitialized = true;
    }

    function initDialogUI() {
        const sampleDiv = document.getElementById("sample");
        if (!sampleDiv) return;

        if (!document.getElementById("closeDialogBtn")) {
            const headerBar = document.createElement("div");
            headerBar.style.cssText = "background: #34495e; color: white; padding: 8px 12px; cursor: move; display: flex; justify-content: space-between; align-items: center; border-top-left-radius: 6px; border-top-right-radius: 6px; margin: -15px -15px 15px -15px;";
            headerBar.innerHTML = `<span style="font-weight: bold; font-size: 13px;">관제 패널</span><button id="closeDialogBtn" style="background: transparent; border: none; color: white; font-size: 16px; cursor: pointer; font-weight: bold;">&times;</button>`;
            
            sampleDiv.insertBefore(headerBar, sampleDiv.firstChild);

            document.getElementById("closeDialogBtn").addEventListener("click", () => {
                toggle();
            });

            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            headerBar.addEventListener("mousedown", (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = sampleDiv.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
                
                sampleDiv.style.position = "fixed";
                sampleDiv.style.margin = "0";
                e.preventDefault();
            });

            document.addEventListener("mousemove", (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                sampleDiv.style.left = `${initialLeft + dx}px`;
                sampleDiv.style.top = `${initialTop + dy}px`;
            });

            document.addEventListener("mouseup", () => {
                isDragging = false;
            });
        }
    }

    function toggle() {
        if (!isInitialized) {
            init();
        }
        const sym = document.getElementById("sample");
        if (!sym) return;
        sym.style.display = (sym.style.display === "none" || sym.style.display === "") ? "block" : "none";
    }

    function updateEntityDescription(entity, viewer, lng, lat) {
        let groundHeightText = "0 m";
        const positions = [Cesium.Cartographic.fromDegrees(lng, lat)];
        Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions).then(updated => {
            if (updated && updated[0]) {
                groundHeightText = `${updated[0].height.toFixed(2)} m`;
            }
        });

        entity.description = new Cesium.CallbackProperty(() => {
            const carto = Cesium.Cartographic.fromCartesian(
                entity.position.getValue(viewer.clock.currentTime)
            );
            const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
            const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
            return `<p><b>좌표:</b> ${lon}, ${lat}</p><p><b>지면 고도:</b> ${groundHeightText}</p>`;
        }, false);
    }

    function setupActionButtons() {
        document.getElementById("deleteBtn")?.addEventListener("click", () => {
            const viewer = window.CesiumViewer;
            if (viewer && viewer.selectedEntity) viewer.entities.remove(viewer.selectedEntity);
        });

        document.getElementById("deleteAllBtn")?.addEventListener("click", () => {
            window.CesiumViewer?.entities.removeAll();
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
        const viewer = window.CesiumViewer;
        if (viewer) {
            const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
            handler.setInputAction((click) => {
                const picked = viewer.scene.pick(click.position);
                if (Cesium.defined(picked) && Cesium.defined(picked.id)) {
                    viewer.selectedEntity = picked.id;
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        }

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
        if (!entity) { alert('먼저 객체를 선택하세요.'); return; }
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

    // 외부로 메서드 공개
    return {
        init: init,
        toggle: toggle
    };
})();