(function (global) {
    'use strict';
    const Cesium = global.Cesium;
    const viewer = global.CesiumViewer || global.viewer;
    if (!Cesium || !viewer) return;

    const handle = document.createElement('div');
    handle.id = 'drawing-rotation-handle';
    handle.title = '드래그하여 회전';
    handle.style.cssText = 'display:none;position:absolute;width:18px;height:18px;border:2px solid #062b34;border-radius:50%;background:#22d3ee;box-shadow:0 0 0 2px #fff,0 2px 8px #000;z-index:905;cursor:grab;box-sizing:border-box;';
    viewer.container.appendChild(handle);

    let selected = null;
    let rotating = false;
    let startPointerAngle = 0;
    let startRotation = 0;
    let screenCenter = null;
    const sphere = new Cesium.BoundingSphere();

    const value = property => property?.getValue ? property.getValue(viewer.clock.currentTime) : property;
    const currentRotation = entity => entity?.customData?.textDrawing
        ? Number(entity.customData.textSettings?.rotation) || 0
        : Number(entity?._areaStyleEditor?.style?.rotation) || 0;
    function eligible(entity) {
        const rotatableDrawing = entity?._areaStyleEditor?.style?.rotationEnabled || entity?.customData?.textDrawing;
        return !!(entity && rotatableDrawing && !entity.customData?.isGroup && viewer.entities.contains(entity));
    }
    function positionsOf(entity) {
        const result = [];
        const add = target => {
            const hierarchy = value(target?.polygon?.hierarchy);
            if (hierarchy?.positions?.length) result.push({ target, kind: 'polygon', positions: hierarchy.positions.slice() });
            const positions = value(target?.polyline?.positions);
            if (positions?.length) result.push({ target, kind: 'polyline', positions: positions.slice() });
        };
        add(entity);
        (entity.customData?.subEntities || []).forEach(add);
        return result;
    }
    function centerOf(entity, sets) {
        const position = value(entity.position);
        if (Cesium.defined(position)) return Cesium.Ellipsoid.WGS84.scaleToGeodeticSurface(position) || position;
        const all = sets.flatMap(set => set.positions);
        if (!all.length) return null;
        const center = Cesium.BoundingSphere.fromPoints(all).center;
        return Cesium.Ellipsoid.WGS84.scaleToGeodeticSurface(center) || center;
    }
    function captureBase(entity, baseRotation) {
        if (!eligible(entity)) return false;
        const sets = positionsOf(entity);
        const center = centerOf(entity, sets);
        if (!center) return false;
        entity._rotationBase = {
            center,
            sets,
            ellipseRotation: entity.ellipse ? Number(value(entity.ellipse.rotation)) || 0 : 0,
            rotation: Number.isFinite(baseRotation) ? baseRotation : currentRotation(entity)
        };
        return true;
    }
    function rotatePositions(positions, center, radians) {
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
        const inverse = Cesium.Matrix4.inverseTransformation(transform, new Cesium.Matrix4());
        const cosine = Math.cos(radians), sine = Math.sin(radians);
        return positions.map(point => {
            const local = Cesium.Matrix4.multiplyByPoint(inverse, point, new Cesium.Cartesian3());
            const x = local.x * cosine - local.y * sine;
            const y = local.x * sine + local.y * cosine;
            return Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(x, y, local.z), new Cesium.Cartesian3());
        });
    }
    function applyAbsolute(entity, degrees) {
        if (!eligible(entity)) return false;
        if (!entity._rotationBase && !captureBase(entity)) return false;
        const base = entity._rotationBase;
        const rawDegrees = Number(degrees) || 0;
        const displayed = Math.max(-360, Math.min(360, rawDegrees));
        // UI 각도는 증가할수록 시계방향으로 회전한다.
        const radians = -Cesium.Math.toRadians(displayed - base.rotation);
        base.sets.forEach(set => {
            const next = rotatePositions(set.positions, base.center, radians);
            if (set.kind === 'polygon') set.target.polygon.hierarchy = new Cesium.PolygonHierarchy(next);
            else set.target.polyline.positions = next;
        });
        if (entity.ellipse) entity.ellipse.rotation = base.ellipseRotation + radians;
        if (entity.billboard) entity.billboard.rotation = -Cesium.Math.toRadians(displayed);
        if (entity.customData?.textDrawing) {
            entity.customData.textSettings = { ...(entity.customData.textSettings || {}), rotation: displayed };
            global.TextDrawing?.setRotation?.(displayed);
        } else {
            entity._areaStyleEditor.style.rotation = displayed;
            global.AreaStylePanel?.setRotation?.(displayed);
        }
        viewer.scene.requestRender();
        return true;
    }
    function updateHandle() {
        if (!eligible(selected) || selected.show === false) { handle.style.display = 'none'; return; }
        const state = viewer.dataSourceDisplay.getBoundingSphere(selected, false, sphere);
        if (state !== Cesium.BoundingSphereState.DONE) { handle.style.display = 'none'; return; }
        const center = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, sphere.center);
        if (!Cesium.defined(center)) { handle.style.display = 'none'; return; }
        const metersPerPixel = viewer.camera.getPixelSize(sphere, viewer.scene.drawingBufferWidth, viewer.scene.drawingBufferHeight);
        if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return;
        const radius = Math.max(12, sphere.radius / metersPerPixel) + 16;
        screenCenter = center;
        handle.style.display = 'block';
        handle.style.left = `${center.x - 9}px`;
        handle.style.top = `${center.y - radius - 28}px`;
    }
    viewer.selectedEntityChanged.addEventListener(entity => {
        selected = eligible(entity) ? entity : null;
        if (selected && !selected.customData?.textDrawing) {
            selected._areaStyleEditor.style.rotationEnabled = true;
        }
        if (selected) captureBase(selected);
        updateHandle();
    });
    viewer.scene.preRender.addEventListener(() => { if (!rotating) updateHandle(); });

    handle.addEventListener('mousedown', event => {
        if (!selected || !screenCenter || !captureBase(selected)) return;
        rotating = true;
        handle.style.cursor = 'grabbing';
        startRotation = currentRotation(selected);
        startPointerAngle = Math.atan2(event.clientY - screenCenter.y, event.clientX - screenCenter.x);
        viewer.scene.screenSpaceCameraController.enableInputs = false;
        event.preventDefault();
        event.stopPropagation();
    });
    document.addEventListener('mousemove', event => {
        if (!rotating || !selected || !screenCenter) return;
        const angle = Math.atan2(event.clientY - screenCenter.y, event.clientX - screenCenter.x);
        applyAbsolute(selected, startRotation + Cesium.Math.toDegrees(angle - startPointerAngle));
    });
    document.addEventListener('mouseup', () => {
        if (!rotating) return;
        rotating = false;
        handle.style.cursor = 'grab';
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        if (selected) {
            captureBase(selected);
            document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity: selected } }));
        }
    });

    global.DrawingRotationManager = { captureBase, applyAbsolute };
})(window);
