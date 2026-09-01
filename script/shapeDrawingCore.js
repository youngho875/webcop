(function (global) {
    'use strict';

    const modules = [];

    function getViewer() {
        return global.CesiumViewer || global.viewer || null;
    }

    function pick(viewer, screenPosition) {
        const Cesium = global.Cesium;
        const ray = viewer.camera.getPickRay(screenPosition);
        let cartesian = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (!Cesium.defined(cartesian)) {
            cartesian = viewer.scene.pickPositionSupported
                ? viewer.scene.pickPosition(screenPosition)
                : undefined;
        }
        return cartesian;
    }

    function context(center, edge) {
        const Cesium = global.Cesium;
        const c = Cesium.Cartographic.fromCartesian(center);
        const e = Cesium.Cartographic.fromCartesian(edge);
        const lon = Cesium.Math.toDegrees(c.longitude);
        const lat = Cesium.Math.toDegrees(c.latitude);
        const edgeLon = Cesium.Math.toDegrees(e.longitude);
        const edgeLat = Cesium.Math.toDegrees(e.latitude);
        const cosLat = Math.max(Math.cos(c.latitude), 0.00001);
        const dx = (edgeLon - lon) * cosLat;
        const dy = edgeLat - lat;
        return {
            lon, lat, cosLat,
            radius: Math.max(Math.hypot(dx, dy), 0.0001),
            rotation: Math.atan2(dy, dx),
            centerHeight: Math.max(0, c.height || 0),
            distance: Cesium.Cartesian3.distance(center, edge)
        };
    }

    function polygonPoints(type, center, edge) {
        const c = context(center, edge);
        const points = [];
        const addXY = (x, y) => points.push(c.lon + x * c.radius / c.cosLat, c.lat + y * c.radius);
        const addRotated = (x, y) => {
            const rotation = c.rotation - Math.PI / 2;
            addXY(x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation));
        };
        const addPolar = (angle, scale = 1) => addXY(Math.cos(angle) * scale, Math.sin(angle) * scale);
        const regular = count => {
            for (let i = 0; i < count; i++) addPolar(c.rotation - Math.PI / 2 + i * Math.PI * 2 / count);
        };

        if (type === 'rectangle') [[-1,-.68],[1,-.68],[1,.68],[-1,.68]].forEach(p => addXY(...p));
        else if (type === 'pentagon') regular(5);
        else if (type === 'hexagon') regular(6);
        else if (type === 'star') {
            for (let i = 0; i < 10; i++) addPolar(c.rotation - Math.PI / 2 + i * Math.PI / 5, i % 2 ? .43 : 1);
        } else if (type === 'diamond') {
            [[0,-1],[1,0],[0,1],[-1,0]].forEach(p => addXY(...p));
        } else if (type === 'triangle' || type === 'equilateralTriangle') {
            [[-.866,-.5],[.866,-.5],[0,1]].forEach(([x,y]) => addRotated(x,y));
        } else if (type === 'isoscelesTriangle') {
            [[-.62,-.72],[.62,-.72],[0,1]].forEach(([x,y]) => addRotated(x,y));
        } else if (type === 'rightTriangle') {
            [[-.8,-.8],[.8,-.8],[-.8,.8]].forEach(([x,y]) => addRotated(x,y));
        } else if (type === 'parallelogram') [[-1,-.65],[.55,-.65],[1,.65],[-.55,.65]].forEach(p => addXY(...p));
        else if (type === 'trapezoid') [[-.58,-.65],[.58,-.65],[1,.65],[-1,.65]].forEach(p => addXY(...p));
        else if (type === 'roundedRectangle') {
            const width = 1, height = .68, corner = .25, steps = 6;
            [[width-corner,height-corner,0],[-width+corner,height-corner,Math.PI/2],[-width+corner,-height+corner,Math.PI],[width-corner,-height+corner,Math.PI*1.5]].forEach(([cx,cy,start]) => {
                for (let i = 0; i <= steps; i++) addXY(cx + Math.cos(start + i*Math.PI/2/steps)*corner, cy + Math.sin(start + i*Math.PI/2/steps)*corner);
            });
        } else if (type === 'cone') {
            // 지형에 붙는 2D 원뿔: 첫 점은 꼭짓점, 두 번째 점은 방향과 길이입니다.
            points.push(c.lon, c.lat);
            const halfAngle = Math.PI / 6;
            for (let i = 0; i <= 40; i++) {
                addPolar(c.rotation - halfAngle + halfAngle * 2 * i / 40);
            }
        }
        return { points, context: c };
    }

    function arcGeometryFromPoints(center, edge, centralAngle = 180) {
        const Cesium = global.Cesium;
        const c = context(center, edge);
        return {
            longitude: c.lon,
            latitude: c.lat,
            direction: (90 - Cesium.Math.toDegrees(c.rotation) + 360) % 360,
            centralAngle,
            radius: Math.max(1, c.distance)
        };
    }

    function arcGeometryPoints(longitude, latitude, direction, centralAngle, radius, includeCenter = false) {
        const Cesium = global.Cesium;
        const origin = Cesium.Cartesian3.fromDegrees(Number(longitude), Number(latitude));
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        const points = [];
        const append = local => {
            const world = Cesium.Matrix4.multiplyByPoint(transform, local, new Cesium.Cartesian3());
            const point = Cesium.Cartographic.fromCartesian(world);
            points.push(Cesium.Math.toDegrees(point.longitude), Cesium.Math.toDegrees(point.latitude));
        };
        if (includeCenter) points.push(Number(longitude), Number(latitude));
        const middle = Math.PI / 2 - Cesium.Math.toRadians(Number(direction));
        const angleRadians = Cesium.Math.toRadians(Number(centralAngle));
        const segments = Math.max(16, Math.ceil(Math.abs(Number(centralAngle)) / 3));
        for (let i = 0; i <= segments; i++) {
            const angle = middle - angleRadians / 2 + angleRadians * i / segments;
            append(new Cesium.Cartesian3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
        }
        return { points };
    }

    function arcPoints(center, edge) {
        const geometry = arcGeometryFromPoints(center, edge, 180);
        return arcGeometryPoints(geometry.longitude, geometry.latitude, geometry.direction, geometry.centralAngle, geometry.radius);
    }

    function currentStyle() {
        return global.AreaStylePanel?.getStyle?.() || {
            fillType: 'solid', fillColor: '#22d3ee', fillOpacity: 32,
            lineType: 'solid', lineColor: '#ffffff', lineOpacity: 100,
            lineWidth: 2, dashType: 'solid'
        };
    }

    const twoPointCoordinateTypes = new Set();
    const sizedQuadrilateralTypes = new Set(['rectangle', 'roundedRectangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'star']);

    function roundedRectangleParameters(start, end) {
        const Cesium = global.Cesium;
        const a = Cesium.Cartographic.fromCartesian(start);
        const b = Cesium.Cartographic.fromCartesian(end);
        const longitude = Cesium.Math.toDegrees((a.longitude + b.longitude) / 2);
        const latitude = Cesium.Math.toDegrees((a.latitude + b.latitude) / 2);
        const width = Math.max(1, Math.abs(Cesium.Math.toDegrees(b.longitude - a.longitude)) * 111320 * Math.max(Math.cos(Cesium.Math.toRadians(latitude)), .00001));
        const height = Math.max(1, Math.abs(Cesium.Math.toDegrees(b.latitude - a.latitude)) * 110574);
        return { longitude, latitude, width, height, radius: Math.min(width, height) * .18 };
    }

    function roundedRectanglePoints(longitude, latitude, width, height, radius) {
        const Cesium = global.Cesium;
        const halfWidth = Math.max(.5, Number(width) / 2);
        const halfHeight = Math.max(.5, Number(height) / 2);
        const cornerRadius = Math.max(0, Math.min(Number(radius) || 0, halfWidth, halfHeight));
        const origin = Cesium.Cartesian3.fromDegrees(Number(longitude), Number(latitude));
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        const points = [];
        const append = (east, north) => {
            const world = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(east, north, 0), new Cesium.Cartesian3());
            const point = Cesium.Cartographic.fromCartesian(world);
            points.push(Cesium.Math.toDegrees(point.longitude), Cesium.Math.toDegrees(point.latitude));
        };
        if (cornerRadius === 0) {
            [[halfWidth,-halfHeight],[halfWidth,halfHeight],[-halfWidth,halfHeight],[-halfWidth,-halfHeight]].forEach(([x,y]) => append(x,y));
        } else {
            const steps = 8;
            [[halfWidth-cornerRadius,-halfHeight+cornerRadius,-Math.PI/2,0],
             [halfWidth-cornerRadius,halfHeight-cornerRadius,0,Math.PI/2],
             [-halfWidth+cornerRadius,halfHeight-cornerRadius,Math.PI/2,Math.PI],
             [-halfWidth+cornerRadius,-halfHeight+cornerRadius,Math.PI,Math.PI*1.5]].forEach(([cx,cy,start,end]) => {
                for (let i = 0; i <= steps; i++) {
                    const angle = start + (end - start) * i / steps;
                    append(cx + Math.cos(angle) * cornerRadius, cy + Math.sin(angle) * cornerRadius);
                }
            });
        }
        return { points };
    }

    function sizedQuadrilateralPoints(type, longitude, latitude, width, height, radius = 0) {
        if (type === 'rectangle') return roundedRectanglePoints(longitude, latitude, width, height, 0);
        if (type === 'roundedRectangle') return roundedRectanglePoints(longitude, latitude, width, height, radius);
        const Cesium = global.Cesium;
        const halfWidth = Math.max(.5, Number(width) / 2);
        const halfHeight = Math.max(.5, Number(height) / 2);
        const origin = Cesium.Cartesian3.fromDegrees(Number(longitude), Number(latitude));
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        let vertices = type === 'diamond'
            ? [[0,-halfHeight],[halfWidth,0],[0,halfHeight],[-halfWidth,0]]
            : type === 'parallelogram'
                ? [[-halfWidth,-halfHeight],[halfWidth*.55,-halfHeight],[halfWidth,halfHeight],[-halfWidth*.55,halfHeight]]
                : type === 'trapezoid'
                    ? [[-halfWidth*.58,-halfHeight],[halfWidth*.58,-halfHeight],[halfWidth,halfHeight],[-halfWidth,halfHeight]]
                    : [];
        if (type === 'pentagon' || type === 'hexagon') {
            const count = type === 'pentagon' ? 5 : 6;
            const unit = Array.from({ length: count }, (_, index) => {
                const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
                return [Math.cos(angle), Math.sin(angle)];
            });
            const xs = unit.map(point => point[0]);
            const ys = unit.map(point => point[1]);
            const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
            vertices = unit.map(([x, y]) => [((x - minX) / (maxX - minX) * 2 - 1) * halfWidth, ((y - minY) / (maxY - minY) * 2 - 1) * halfHeight]);
        } else if (type === 'star') {
            vertices = Array.from({ length: 10 }, (_, index) => {
                const angle = -Math.PI / 2 + index * Math.PI / 5;
                const scale = index % 2 === 0 ? 1 : .43;
                return [Math.cos(angle) * halfWidth * scale, Math.sin(angle) * halfHeight * scale];
            });
        }
        const points = [];
        vertices.forEach(([east, north]) => {
            const world = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(east, north, 0), new Cesium.Cartesian3());
            const point = Cesium.Cartographic.fromCartesian(world);
            points.push(Cesium.Math.toDegrees(point.longitude), Cesium.Math.toDegrees(point.latitude));
        });
        return { points };
    }

    function twoPointPolygonPoints(type, start, end) {
        const Cesium = global.Cesium;
        const startCartographic = Cesium.Cartographic.fromCartesian(start);
        const endCartographic = Cesium.Cartographic.fromCartesian(end);
        const startLon = Cesium.Math.toDegrees(startCartographic.longitude);
        const startLat = Cesium.Math.toDegrees(startCartographic.latitude);
        const endLon = Cesium.Math.toDegrees(endCartographic.longitude);
        const endLat = Cesium.Math.toDegrees(endCartographic.latitude);
        const deltaLon = endLon - startLon;
        const deltaLat = endLat - startLat;
        const points = [];
        const addFraction = (x, y) => points.push(startLon + deltaLon * x, startLat + deltaLat * y);

        if (type === 'rectangle') {
            [[0,0],[1,0],[1,1],[0,1]].forEach(([x,y]) => addFraction(x,y));
        } else if (type === 'diamond') {
            const cosLat = Math.max(Math.cos((startCartographic.latitude + endCartographic.latitude) / 2), .00001);
            const dx = deltaLon * cosLat;
            const dy = deltaLat;
            const midLon = (startLon + endLon) / 2;
            const midLat = (startLat + endLat) / 2;
            const perpendicularX = -dy * .5;
            const perpendicularY = dx * .5;
            points.push(
                startLon, startLat,
                midLon + perpendicularX / cosLat, midLat + perpendicularY,
                endLon, endLat,
                midLon - perpendicularX / cosLat, midLat - perpendicularY
            );
        } else if (type === 'parallelogram') {
            [[0,0],[.75,0],[1,1],[.25,1]].forEach(([x,y]) => addFraction(x,y));
        } else if (type === 'trapezoid') {
            [[0,0],[1,0],[1,1],[.2,1]].forEach(([x,y]) => addFraction(x,y));
        } else {
            [[0,0],[.8,0],[.92,.03],[1,.2],[1,.8],[.97,.92],[.8,1],[.2,1],[.08,.97],[0,.8],[0,.2],[.03,.08]].forEach(([x,y]) => addFraction(x,y));
        }
        return { points, context: context(start, end) };
    }

    function formatTwoPointCoordinates(start, end) {
        const Cesium = global.Cesium;
        return [start, end].map(position => {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            return `${Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)} ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)}`;
        }).join(', ');
    }

    function parseTwoPointCoordinates(text) {
        const Cesium = global.Cesium;
        const entries = String(text || '').split(',').map(item => item.trim()).filter(Boolean);
        if (entries.length !== 2) return null;
        const coordinates = entries.map(entry => entry.split(/\s+/).map(Number));
        if (coordinates.some(pair => pair.length !== 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[0]) > 180 || Math.abs(pair[1]) > 90)) return null;
        return coordinates.map(([longitude, latitude]) => Cesium.Cartesian3.fromDegrees(longitude, latitude));
    }

    function fillMaterial(style) {
        const Cesium = global.Cesium;
        const color = Cesium.Color.fromCssColorString(style.fillColor).withAlpha(style.fillOpacity / 100);
        if (style.fillType === 'none') return Cesium.Color.TRANSPARENT;
        if (style.fillType === 'solid') return color;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (style.fillType === 'gradient') {
            const gradient = ctx.createLinearGradient(0, 0, 64, 64);
            gradient.addColorStop(0, style.fillColor);
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.globalAlpha = style.fillOpacity / 100;
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 64);
        } else {
            ctx.globalAlpha = style.fillOpacity / 100;
            ctx.strokeStyle = style.fillColor;
            ctx.lineWidth = 5;
            for (let x = -64; x < 128; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 64, 64); ctx.stroke(); }
        }
        return new Cesium.ImageMaterialProperty({ image: canvas, transparent: true });
    }

    function lineMaterial(style) {
        const Cesium = global.Cesium;
        const color = Cesium.Color.fromCssColorString(style.lineColor).withAlpha(style.lineOpacity / 100);
        if (style.lineType === 'gradient') return new Cesium.PolylineGlowMaterialProperty({ color, glowPower: 0.22, taperPower: 0.65 });
        if (style.dashType === 'solid') return color;
        const patterns = { dash: 0xF0F0, dot: 0xAAAA, dashdot: 0xE4E4 };
        return new Cesium.PolylineDashMaterialProperty({ color, dashPattern: patterns[style.dashType] || 0xF0F0 });
    }

    function attachEditor(viewer, entity, title, style, applyCallback) {
        const rotationEnabled = !!(entity.polygon || entity.ellipse);
        const editorStyle = { ...style, rotationEnabled, rotation: Number(style.rotation) || 0 };
        entity._areaStyleEditor = { title, style: editorStyle, applyCallback: nextStyle => {
            applyCallback(nextStyle);
            if (rotationEnabled && global.DrawingRotationManager) {
                // applyCallback이 만든 회전 전 형상을 0° 기준으로 삼아 입력값을 절대각으로 적용한다.
                global.DrawingRotationManager.captureBase(entity, 0);
                global.DrawingRotationManager.applyAbsolute(entity, Number(nextStyle.rotation) || 0);
            }
        } };
        if (viewer._areaStyleEditorInstalled) return;
        viewer._areaStyleEditorInstalled = true;
        viewer.selectedEntityChanged.addEventListener(selected => {
            const group = selected?.customData?.groupEntity;
            if (group && viewer.entities.contains(group)) {
                viewer.selectedEntity = group;
                return;
            }
            const editor = selected?._areaStyleEditor;
            if (!editor || !global.AreaStylePanel?.edit) return;
            global.AreaStylePanel.edit(editor.title, editor.style, () => {
                const nextStyle = currentStyle();
                editor.applyCallback(nextStyle);
                editor.style = { ...nextStyle };
                viewer.scene.requestRender();
            });
        });
    }

    function createModule(options) {
        let handler = null;
        let viewer = null;
        let firstPoint = null;
        let previewEntity = null;
        let previewOutlineEntity = null;
        let dragging = false;
        const entities = [];

        function deactivate() {
            firstPoint = null;
            dragging = false;
            if (previewEntity && viewer) viewer.entities.remove(previewEntity);
            if (previewOutlineEntity && viewer) viewer.entities.remove(previewOutlineEntity);
            previewEntity = null;
            previewOutlineEntity = null;
            if (viewer?.scene?.screenSpaceCameraController) viewer.scene.screenSpaceCameraController.enableInputs = true;
            if (handler && !handler.isDestroyed()) handler.destroy();
            handler = null;
        }

        function addShape(center, edge) {
            const Cesium = global.Cesium;
            const style = currentStyle();
            const hasTwoPointCoordinates = twoPointCoordinateTypes.has(options.type);
            const isSizedQuadrilateral = sizedQuadrilateralTypes.has(options.type);
            const isArc = options.type === 'arc';
            const isTriangle = options.type === 'triangle';
            const triangleType = isTriangle && ['equilateralTriangle','isoscelesTriangle','rightTriangle'].includes(style.triangleShapeType) ? style.triangleShapeType : 'equilateralTriangle';
            const triangleCenter = isTriangle ? Cesium.Cartographic.fromCartesian(center) : null;
            const triangleEdge = isTriangle ? Cesium.Cartographic.fromCartesian(edge) : null;
            const triangleLongitude = isTriangle ? Cesium.Math.toDegrees(triangleCenter.longitude) : 0;
            const triangleLatitude = isTriangle ? Cesium.Math.toDegrees(triangleCenter.latitude) : 0;
            const triangleEdgeLongitudeOffset = isTriangle ? Cesium.Math.toDegrees(triangleEdge.longitude - triangleCenter.longitude) : 0;
            const triangleEdgeLatitudeOffset = isTriangle ? Cesium.Math.toDegrees(triangleEdge.latitude - triangleCenter.latitude) : 0;
            const rectangle = isSizedQuadrilateral ? roundedRectangleParameters(center, edge) : null;
            const arcGeometry = isArc ? arcGeometryFromPoints(center, edge, 180) : null;
            const editorStyle = hasTwoPointCoordinates
                ? { ...style, coordinateGeometry: true, coordinateText: formatTwoPointCoordinates(center, edge) }
                : isSizedQuadrilateral ? {
                    ...style, rectangleGeometry: true,
                    rectangleShapeType: options.type,
                    rectangleLongitude: rectangle.longitude, rectangleLatitude: rectangle.latitude,
                    rectangleWidth: rectangle.width, rectangleHeight: rectangle.height,
                    rectangleRadius: options.type === 'roundedRectangle' ? rectangle.radius : 0
                } : isArc ? {
                    ...style, arcGeometry: true, arcShapeType: 'arc',
                    arcLongitude: arcGeometry.longitude, arcLatitude: arcGeometry.latitude,
                    arcDirection: arcGeometry.direction, arcAngle: arcGeometry.centralAngle,
                    arcRadius: arcGeometry.radius
                } : isTriangle ? {
                    ...style, triangleGeometry: true, triangleShapeType: triangleType,
                    triangleLongitude, triangleLatitude
                } : style;
            let entity;
            let outlineEntity = null;
            if (options.type === 'arc') {
                const result = arcPoints(center, edge);
                entity = viewer.entities.add({
                    polyline: {
                        positions: Cesium.Cartesian3.fromDegreesArray(result.points),
                        width: style.lineType === 'none' ? 0 : style.lineWidth,
                        material: lineMaterial(style),
                        clampToGround: true
                    }
                });
            } else {
                const result = isSizedQuadrilateral
                    ? sizedQuadrilateralPoints(options.type, rectangle.longitude, rectangle.latitude, rectangle.width, rectangle.height, rectangle.radius)
                    : isTriangle
                    ? polygonPoints(triangleType, center, edge)
                    : hasTwoPointCoordinates
                    ? twoPointPolygonPoints(options.type, center, edge)
                    : polygonPoints(options.type, center, edge);
                entity = viewer.entities.add({
                    polygon: {
                        hierarchy: Cesium.Cartesian3.fromDegreesArray(result.points),
                        material: fillMaterial(style),
                        outline: false,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        classificationType: Cesium.ClassificationType.BOTH
                    }
                });
                {
                    const closed = result.points.concat(result.points.slice(0, 2));
                    outlineEntity = viewer.entities.add({
                        show: style.lineType !== 'none',
                        polyline: {
                            positions: Cesium.Cartesian3.fromDegreesArray(closed),
                            width: style.lineWidth,
                            material: lineMaterial(style),
                            clampToGround: true
                        }
                    });
                    entities.push(outlineEntity);
                }
            }
            const defaultName = options.name.replace(/\s*그리기$/, '');
            entity.name = String(style.shapeName || defaultName).trim() || defaultName;
            entity.customData = {
                drawingType: options.type,
                displayName: entity.name,
                subEntities: outlineEntity ? [outlineEntity] : [],
                ...(hasTwoPointCoordinates ? { startPoint: center, endPoint: edge } : {}),
                ...(isSizedQuadrilateral ? { sizedGeometry: { type: options.type, longitude: rectangle.longitude, latitude: rectangle.latitude, width: rectangle.width, height: rectangle.height, radius: options.type === 'roundedRectangle' ? rectangle.radius : 0 } } : {}),
                ...(isArc ? { arcGeometry: { ...arcGeometry } } : {})
                ,...(isTriangle ? { triangleType, triangleCenter: { longitude: triangleLongitude, latitude: triangleLatitude } } : {})
            };
            if (outlineEntity) outlineEntity._drawingOwner = entity;
            const title = defaultName + ' 설정/편집';
            attachEditor(viewer, entity, title, editorStyle, nextStyle => {
                if (isTriangle) {
                    const selectedType = ['equilateralTriangle','isoscelesTriangle','rightTriangle'].includes(nextStyle.triangleShapeType) ? nextStyle.triangleShapeType : 'equilateralTriangle';
                    const longitude = Number(nextStyle.triangleLongitude);
                    const latitude = Number(nextStyle.triangleLatitude);
                    if (!Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
                        global.alert('중심 경도와 위도를 올바르게 입력하세요.');
                        return;
                    }
                    const nextCenter = Cesium.Cartesian3.fromDegrees(longitude, latitude);
                    const nextEdge = Cesium.Cartesian3.fromDegrees(longitude + triangleEdgeLongitudeOffset, latitude + triangleEdgeLatitudeOffset);
                    const nextGeometry = polygonPoints(selectedType, nextCenter, nextEdge);
                    const nextPositions = Cesium.Cartesian3.fromDegreesArray(nextGeometry.points);
                    entity.polygon.hierarchy = nextPositions;
                    if (outlineEntity) outlineEntity.polyline.positions = [...nextPositions, nextPositions[0]];
                    entity.customData.triangleType = selectedType;
                    entity.customData.triangleCenter = { longitude, latitude };
                    nextStyle.triangleShapeType = selectedType;
                } else if (isArc) {
                    const longitude = Number(nextStyle.arcLongitude);
                    const latitude = Number(nextStyle.arcLatitude);
                    const direction = Number(nextStyle.arcDirection);
                    const centralAngle = Number(nextStyle.arcAngle);
                    const radius = Number(nextStyle.arcRadius);
                    if (!Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(direction) || !Number.isFinite(centralAngle) || centralAngle <= 0 || centralAngle > 360 || !Number.isFinite(radius) || radius < 1) {
                        global.alert('중심좌표, 방향, 중심 내각과 반지름을 올바르게 입력하세요.');
                        return;
                    }
                    const nextGeometry = arcGeometryPoints(longitude, latitude, direction, centralAngle, radius);
                    entity.polyline.positions = Cesium.Cartesian3.fromDegreesArray(nextGeometry.points);
                    entity.customData.arcGeometry = { longitude, latitude, direction: ((direction % 360) + 360) % 360, centralAngle, radius };
                } else if (isSizedQuadrilateral) {
                    const selectedType = sizedQuadrilateralTypes.has(nextStyle.rectangleShapeType) ? nextStyle.rectangleShapeType : options.type;
                    const longitude = Number(nextStyle.rectangleLongitude);
                    const latitude = Number(nextStyle.rectangleLatitude);
                    const width = Number(nextStyle.rectangleWidth);
                    const height = Number(nextStyle.rectangleHeight);
                    const radius = Number(nextStyle.rectangleRadius) || 0;
                    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90 || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || radius < 0) {
                        global.alert('중심좌표, 너비와 높이를 올바르게 입력하세요.');
                        return;
                    }
                    const limitedRadius = selectedType === 'roundedRectangle' ? Math.min(radius || Math.min(width, height) * .18, width / 2, height / 2) : 0;
                    const nextGeometry = sizedQuadrilateralPoints(selectedType, longitude, latitude, width, height, limitedRadius);
                    const nextPositions = Cesium.Cartesian3.fromDegreesArray(nextGeometry.points);
                    entity.polygon.hierarchy = nextPositions;
                    if (outlineEntity) outlineEntity.polyline.positions = [...nextPositions, nextPositions[0]];
                    entity.customData.drawingType = selectedType;
                    entity.customData.sizedGeometry = { type: selectedType, longitude, latitude, width, height, radius: limitedRadius };
                    nextStyle.rectangleShapeType = selectedType;
                    nextStyle.rectangleRadius = limitedRadius;
                } else if (hasTwoPointCoordinates) {
                    const editedPoints = parseTwoPointCoordinates(nextStyle.coordinateText);
                    if (!editedPoints || Cesium.Cartesian3.distance(editedPoints[0], editedPoints[1]) <= 1) {
                        global.alert('좌표를 "경도 위도, 경도 위도" 형식으로 입력하고 서로 다른 두 점을 지정하세요.');
                        return;
                    }
                    center = editedPoints[0];
                    edge = editedPoints[1];
                    const nextGeometry = twoPointPolygonPoints(options.type, center, edge);
                    const nextPositions = Cesium.Cartesian3.fromDegreesArray(nextGeometry.points);
                    entity.polygon.hierarchy = nextPositions;
                    if (outlineEntity) outlineEntity.polyline.positions = [...nextPositions, nextPositions[0]];
                    entity.customData.startPoint = center;
                    entity.customData.endPoint = edge;
                }
                entity.name = String(nextStyle.shapeName || defaultName).trim() || defaultName;
                entity.customData.displayName = entity.name;
                if (options.type === 'arc') {
                    entity.show = nextStyle.lineType !== 'none';
                    entity.polyline.width = nextStyle.lineWidth;
                    entity.polyline.material = lineMaterial(nextStyle);
                } else {
                    entity.polygon.material = fillMaterial(nextStyle);
                    if (outlineEntity) {
                        outlineEntity.show = nextStyle.lineType !== 'none';
                        outlineEntity.polyline.width = nextStyle.lineWidth;
                        outlineEntity.polyline.material = lineMaterial(nextStyle);
                    }
                }
                document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
            });
            entities.push(entity);
            document.dispatchEvent(new CustomEvent('drawing-entity-added', { detail: { entity } }));
            viewer.scene.requestRender();
        }

        function activate() {
            modules.forEach(module => module.deactivate());
            viewer = getViewer();
            if (!viewer || !global.Cesium) {
                console.warn(`${options.name}: Cesium Viewer를 찾을 수 없습니다.`);
                return;
            }
            handler = new global.Cesium.ScreenSpaceEventHandler(viewer.canvas);
            handler.setInputAction(event => {
                const picked = viewer.scene.pick(event.position);
                if (global.Cesium.defined(picked) && picked.id?._areaStyleEditor) {
                    viewer.selectedEntity = picked.id.customData?.groupEntity || picked.id;
                    return;
                }
                const position = pick(viewer, event.position);
                if (!global.Cesium.defined(position)) return;
                firstPoint = position;
                dragging = true;
                viewer.scene.screenSpaceCameraController.enableInputs = false;
            }, global.Cesium.ScreenSpaceEventType.LEFT_DOWN);

            handler.setInputAction(event => {
                if (!dragging || !firstPoint) return;
                const position = pick(viewer, event.endPosition);
                if (!global.Cesium.defined(position)) return;
                if (previewEntity) viewer.entities.remove(previewEntity);
                if (previewOutlineEntity) viewer.entities.remove(previewOutlineEntity);
                previewOutlineEntity = null;
                const style = currentStyle();
                if (options.type === 'arc') {
                    const result = arcPoints(firstPoint, position);
                    previewEntity = viewer.entities.add({ polyline: { positions: global.Cesium.Cartesian3.fromDegreesArray(result.points), width: style.lineWidth, material: lineMaterial(style), clampToGround: true } });
                } else {
                    const result = options.type === 'triangle'
                        ? polygonPoints((['equilateralTriangle','isoscelesTriangle','rightTriangle'].includes(style.triangleShapeType) ? style.triangleShapeType : 'equilateralTriangle'), firstPoint, position)
                        : sizedQuadrilateralTypes.has(options.type)
                        ? (() => { const p = roundedRectangleParameters(firstPoint, position); return sizedQuadrilateralPoints(options.type, p.longitude, p.latitude, p.width, p.height, p.radius); })()
                        : twoPointCoordinateTypes.has(options.type)
                        ? twoPointPolygonPoints(options.type, firstPoint, position)
                        : polygonPoints(options.type, firstPoint, position);
                    previewEntity = viewer.entities.add({ polygon: { hierarchy: global.Cesium.Cartesian3.fromDegreesArray(result.points), material: fillMaterial(style), classificationType: global.Cesium.ClassificationType.BOTH } });
                    const previewPositions = global.Cesium.Cartesian3.fromDegreesArray(result.points.concat(result.points.slice(0, 2)));
                    previewOutlineEntity = viewer.entities.add({ polyline: { positions: previewPositions, width: Math.max(2, Number(style.lineWidth) || 2), material: lineMaterial({ ...style, lineType: 'solid' }), clampToGround: true } });
                }
            }, global.Cesium.ScreenSpaceEventType.MOUSE_MOVE);

            handler.setInputAction(event => {
                if (!dragging || !firstPoint) return;
                const position = pick(viewer, event.position);
                if (previewEntity) viewer.entities.remove(previewEntity);
                if (previewOutlineEntity) viewer.entities.remove(previewOutlineEntity);
                previewEntity = null;
                previewOutlineEntity = null;
                if (global.Cesium.defined(position) && global.Cesium.Cartesian3.distance(firstPoint, position) > 1) addShape(firstPoint, position);
                firstPoint = null;
                dragging = false;
                viewer.scene.screenSpaceCameraController.enableInputs = true;
            }, global.Cesium.ScreenSpaceEventType.LEFT_UP);
        }

        function reset() {
            deactivate();
            viewer = getViewer();
            if (viewer) entities.splice(0).forEach(entity => viewer.entities.remove(entity));
        }

        const api = { activate, deactivate, reset, isActive: () => Boolean(handler) };
        modules.push(api);
        global[options.globalName] = api;
        return api;
    }

    global.ShapeDrawingCore = {
        createModule,
        getStyle: currentStyle,
        fillMaterial,
        lineMaterial,
        arcGeometryFromPoints,
        arcGeometryPoints,
        attachEditor
    };
})(typeof window !== 'undefined' ? window : globalThis);
