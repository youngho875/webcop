// Mouse position status bar (WGS84 / DMS / UTM / MGRS / GEOREF / altitude)
(function () {
    'use strict';

    const viewer = window.CesiumViewer;
    if (!viewer) {
        console.error('CesiumViewer가 생성되지 않았습니다.');
        return;
    }

    const style = document.createElement('style');
    style.id = 'mouse-position-status-style';
    style.textContent = `
        #mouse-position-status {
            position: fixed;
            left: 50%;
            bottom: 8px;
            transform: translateX(-50%);
            z-index: 1300;
            display: flex;
            align-items: stretch;
            max-width: calc(100vw - 16px);
            min-height: 30px;
            color: #e7edf4;
            background: rgba(27, 32, 39, .92);
            border: 1px solid rgba(255, 255, 255, .22);
            border-radius: 5px;
            box-shadow: 0 3px 12px rgba(0, 0, 0, .45);
            backdrop-filter: blur(7px);
            font: 12px/1.25 Arial, sans-serif;
            white-space: nowrap;
            user-select: none;
        }
        #mouse-position-status[hidden] { display: none !important; }
        #mouse-position-status .status-drag-handle {
            display: flex;
            align-items: center;
            padding: 0 8px;
            color: #93a4b7;
            border-right: 1px solid rgba(255, 255, 255, .16);
            cursor: move;
            font-size: 15px;
        }
        #mouse-position-status .status-items {
            display: flex;
            align-items: center;
            overflow-x: auto;
            scrollbar-width: thin;
        }
        #mouse-position-status .status-item {
            padding: 7px 9px;
            border-right: 1px solid rgba(255, 255, 255, .12);
        }
        #mouse-position-status .status-item:last-child { border-right: 0; }
        #mouse-position-status .status-label { color: #76c7ff; margin-right: 4px; }
        #mouse-position-status.dragging { opacity: .88; cursor: move; }
    `;
    document.head.appendChild(style);

    const statusBar = document.createElement('div');
    statusBar.id = 'mouse-position-status';
    statusBar.setAttribute('role', 'status');
    statusBar.innerHTML = `
        <div class="status-drag-handle" title="드래그하여 이동">⋮⋮</div>
        <div class="status-items">
            <span class="status-item"><span class="status-label">경위도</span><b data-field="degree">-</b></span>
            <span class="status-item"><span class="status-label">도분초</span><b data-field="dms">-</b></span>
            <span class="status-item"><span class="status-label">UTM</span><b data-field="utm">-</b></span>
            <span class="status-item"><span class="status-label">MGRS</span><b data-field="mgrs">-</b></span>
            <span class="status-item"><span class="status-label">GEOREF</span><b data-field="georef">-</b></span>
            <span class="status-item"><span class="status-label">고도</span><b data-field="altitude">-</b></span>
        </div>`;
    document.body.appendChild(statusBar);

    const fields = Object.fromEntries(
        Array.from(statusBar.querySelectorAll('[data-field]')).map(el => [el.dataset.field, el])
    );

    function toDms(value, positive, negative) {
        const direction = value >= 0 ? positive : negative;
        let absolute = Math.abs(value);
        let degrees = Math.floor(absolute);
        let minutesFloat = (absolute - degrees) * 60;
        let minutes = Math.floor(minutesFloat);
        let seconds = (minutesFloat - minutes) * 60;
        if (seconds >= 59.995) {
            seconds = 0;
            minutes += 1;
            if (minutes === 60) { minutes = 0; degrees += 1; }
        }
        return `${degrees}°${String(minutes).padStart(2, '0')}′${seconds.toFixed(2).padStart(5, '0')}″${direction}`;
    }

    function latitudeBand(latitude) {
        if (latitude < -80 || latitude > 84) return '';
        return 'CDEFGHJKLMNPQRSTUVWXX'[Math.floor((latitude + 80) / 8)];
    }

    function toUtm(longitude, latitude) {
        if (typeof window.proj4 !== 'function' || latitude < -80 || latitude > 84) return '-';
        const zone = Math.min(60, Math.max(1, Math.floor((longitude + 180) / 6) + 1));
        const south = latitude < 0;
        const definition = `+proj=utm +zone=${zone} ${south ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
        const result = window.proj4('EPSG:4326', definition, [longitude, latitude]);
        return `${zone}${latitudeBand(latitude)} ${Math.round(result[0])}E ${Math.round(result[1])}N`;
    }

    // World Geographic Reference System, 1-minute precision (12 characters).
    function toGeoref(longitude, latitude) {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lon = Math.min(359.999999, ((longitude + 180) % 360 + 360) % 360);
        const lat = Math.min(179.999999, Math.max(0, latitude + 90));
        const lon15 = Math.floor(lon / 15);
        const lat15 = Math.min(11, Math.floor(lat / 15));
        const lonIn = lon - lon15 * 15;
        const latIn = lat - lat15 * 15;
        const lon1 = Math.floor(lonIn);
        const lat1 = Math.floor(latIn);
        const lonMinutes = Math.floor((lonIn - lon1) * 60);
        const latMinutes = Math.floor((latIn - lat1) * 60);
        return letters[lon15] + letters[lat15] + letters[lon1] + letters[lat1] +
            String(lonMinutes).padStart(2, '0') + String(latMinutes).padStart(2, '0');
    }

    function clearValues() {
        Object.values(fields).forEach(field => { field.textContent = '-'; });
    }

    function displayPosition(cartographic) {
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const altitude = Number.isFinite(cartographic.height) ? cartographic.height : 0;

        fields.degree.textContent = `${latitude.toFixed(6)}°, ${longitude.toFixed(6)}°`;
        fields.dms.textContent = `${toDms(latitude, 'N', 'S')} ${toDms(longitude, 'E', 'W')}`;
        try { fields.utm.textContent = toUtm(longitude, latitude); } catch (_) { fields.utm.textContent = '-'; }
        try {
            fields.mgrs.textContent = window.mgrs && latitude >= -80 && latitude <= 84
                ? window.mgrs.forward([longitude, latitude], 5) : '-';
        } catch (_) { fields.mgrs.textContent = '-'; }
        fields.georef.textContent = toGeoref(longitude, latitude);
        fields.altitude.textContent = `${altitude.toFixed(1)} m`;
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function (event) {
        let position;
        if (viewer.scene.pickPositionSupported) position = viewer.scene.pickPosition(event.endPosition);
        if (!Cesium.defined(position)) {
            const ray = viewer.camera.getPickRay(event.endPosition);
            position = ray && viewer.scene.globe.pick(ray, viewer.scene);
        }
        if (!Cesium.defined(position)) return clearValues();
        displayPosition(Cesium.Cartographic.fromCartesian(position));
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    const COLLISION_GAP = 8;
    const dragHandle = statusBar.querySelector('.status-drag-handle');

    function isVisible(element) {
        if (!element || element === statusBar || !element.isConnected) return false;
        const computed = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return computed.display !== 'none' && computed.visibility !== 'hidden' &&
            Number(computed.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    }

    function intersects(a, b) {
        return a.left < b.right + COLLISION_GAP && a.right + COLLISION_GAP > b.left &&
            a.top < b.bottom + COLLISION_GAP && a.bottom + COLLISION_GAP > b.top;
    }

    function getLayoutBounds() {
        const viewport = window.visualViewport;
        const viewportLeft = viewport ? viewport.offsetLeft : 0;
        const viewportTop = viewport ? viewport.offsetTop : 0;
        const viewportRight = viewportLeft + (viewport ? viewport.width : window.innerWidth);
        const viewportBottom = viewportTop + (viewport ? viewport.height : window.innerHeight);
        let left = COLLISION_GAP;
        let right = viewportRight - COLLISION_GAP;
        left = Math.max(left, viewportLeft + COLLISION_GAP);
        document.querySelectorAll('.layer-dialog-container.layer-docked-left').forEach(element => {
            if (isVisible(element)) left = Math.max(left, element.getBoundingClientRect().right + COLLISION_GAP);
        });
        document.querySelectorAll('.layer-dialog-container.layer-docked-right').forEach(element => {
            if (isVisible(element)) right = Math.min(right, element.getBoundingClientRect().left - COLLISION_GAP);
        });
        return {
            left,
            right,
            top: viewportTop + COLLISION_GAP,
            bottom: viewportBottom - COLLISION_GAP
        };
    }

    function placeStatusBar(preferredLeft, preferredTop) {
        if (statusBar.hidden || dragging) return;
        const setStyle = (property, value) => {
            if (statusBar.style[property] !== value) statusBar.style[property] = value;
        };
        const bounds = getLayoutBounds();
        const availableWidth = Math.max(180, bounds.right - bounds.left);
        setStyle('maxWidth', `${availableWidth}px`);
        const width = Math.min(statusBar.offsetWidth, availableWidth);
        const height = statusBar.offsetHeight;
        let left = Math.max(bounds.left, Math.min(preferredLeft, bounds.right - width));
        let top = Math.max(bounds.top, Math.min(preferredTop, bounds.bottom - height));

        const obstacles = Array.from(document.querySelectorAll(
            '.layer-dialog-container.layer-docked, .dock-bar'
        )).filter(isVisible);

        // Resolve each collision using the shortest valid move around the obstacle.
        for (let pass = 0; pass < obstacles.length + 2; pass += 1) {
            const current = { left, top, right: left + width, bottom: top + height };
            const obstacle = obstacles.find(element => intersects(current, element.getBoundingClientRect()));
            if (!obstacle) break;
            const rect = obstacle.getBoundingClientRect();
            const candidates = [
                { left, top: rect.top - height - COLLISION_GAP },
                { left, top: rect.bottom + COLLISION_GAP },
                { left: rect.left - width - COLLISION_GAP, top },
                { left: rect.right + COLLISION_GAP, top }
            ].filter(candidate =>
                candidate.left >= bounds.left && candidate.left + width <= bounds.right &&
                candidate.top >= bounds.top && candidate.top + height <= bounds.bottom
            ).sort((a, b) =>
                Math.hypot(a.left - left, a.top - top) - Math.hypot(b.left - left, b.top - top)
            );
            if (!candidates.length) break;
            left = candidates[0].left;
            top = candidates[0].top;
        }

        setStyle('transform', 'none');
        setStyle('bottom', 'auto');
        setStyle('left', `${left}px`);
        setStyle('top', `${top}px`);
    }

    function adjustStatusBarPosition() {
        if (dragging || statusBar.hidden) return;
        const rect = statusBar.getBoundingClientRect();
        placeStatusBar(rect.left, rect.top);
    }
    dragHandle.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return;
        const rect = statusBar.getBoundingClientRect();
        dragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        statusBar.style.transform = 'none';
        statusBar.style.left = `${rect.left}px`;
        statusBar.style.top = `${rect.top}px`;
        statusBar.style.bottom = 'auto';
        statusBar.classList.add('dragging');
        dragHandle.setPointerCapture(event.pointerId);
        viewer.scene.screenSpaceCameraController.enableInputs = false;
        event.preventDefault();
    });
    dragHandle.addEventListener('pointermove', function (event) {
        if (!dragging) return;
        const bounds = getLayoutBounds();
        const availableWidth = Math.max(180, bounds.right - bounds.left);
        statusBar.style.maxWidth = `${availableWidth}px`;
        const x = Math.max(bounds.left, Math.min(event.clientX - offsetX, bounds.right - statusBar.offsetWidth));
        const y = Math.max(bounds.top, Math.min(event.clientY - offsetY, bounds.bottom - statusBar.offsetHeight));
        statusBar.style.left = `${x}px`;
        statusBar.style.top = `${y}px`;
    });
    function stopDragging(event) {
        if (!dragging) return;
        dragging = false;
        statusBar.classList.remove('dragging');
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        if (event && dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
        const rect = statusBar.getBoundingClientRect();
        placeStatusBar(rect.left, rect.top);
    }
    dragHandle.addEventListener('pointerup', stopDragging);
    dragHandle.addEventListener('pointercancel', stopDragging);

    const layoutObserver = new MutationObserver(adjustStatusBarPosition);
    layoutObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
    });
    const layoutResizeObserver = new ResizeObserver(adjustStatusBarPosition);
    layoutResizeObserver.observe(document.body);
    layoutResizeObserver.observe(statusBar);
    document.querySelectorAll('.layer-dialog-container, .dock-bar').forEach(element => {
        layoutResizeObserver.observe(element);
    });
    window.addEventListener('resize', adjustStatusBarPosition);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustStatusBarPosition);
        window.visualViewport.addEventListener('scroll', adjustStatusBarPosition);
    }
    requestAnimationFrame(adjustStatusBarPosition);

    window.StatusBarControl = {
        element: statusBar,
        isVisible: () => !statusBar.hidden,
        setVisible: visible => {
            statusBar.hidden = !visible;
            if (visible) requestAnimationFrame(adjustStatusBarPosition);
            document.dispatchEvent(new CustomEvent('statusbar-visibility-changed', { detail: { visible: !!visible } }));
        },
        toggle: () => window.StatusBarControl.setVisible(statusBar.hidden)
    };
})();
