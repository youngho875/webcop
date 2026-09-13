(function (global) {
    'use strict';

    const viewer = global.CesiumViewer;
    const Cesium = global.Cesium;
    if (!viewer || !Cesium) return;

    let copiedEntities = [];
    let copiedGroup = null;
    let pastePosition = null;
    let pasteSequence = 0;
    const nameSequences = new Map();

    const graphicNames = [
        'billboard', 'box', 'corridor', 'cylinder', 'ellipse', 'ellipsoid',
        'label', 'model', 'path', 'plane', 'point', 'polygon', 'polyline',
        'polylineVolume', 'rectangle', 'tileset', 'wall'
    ];

    function propertyValue(property) {
        if (!property) return undefined;
        return property.getValue ? property.getValue(viewer.clock.currentTime) : property;
    }

    function isMilitary(entity) {
        return Boolean(entity?.customData?.militarySymbol || entity?.customData?.source === 'unifiedControlPanel' || entity?.customData?.isMilitaryGroup);
    }

    function isManagedObject(entity) {
        return Boolean(entity?.customData?.drawingType || entity?.customData?.isDrawingGroup || isMilitary(entity));
    }

    function selectedManagedObject() {
        const selected = viewer.selectedEntity;
        if (!isManagedObject(selected)) return null;
        return selected.customData?.groupEntity && viewer.entities.contains(selected.customData.groupEntity)
            ? selected.customData.groupEntity
            : selected;
    }

    function collectHierarchyPositions(hierarchy, result) {
        if (!hierarchy) return;
        (hierarchy.positions || []).forEach(position => result.push(position));
        (hierarchy.holes || []).forEach(hole => collectHierarchyPositions(hole, result));
    }

    function entityPositions(entity) {
        const result = [];
        const position = propertyValue(entity.position);
        if (Cesium.defined(position)) result.push(position);
        ['polyline', 'corridor', 'wall', 'polylineVolume'].forEach(name => {
            const positions = propertyValue(entity[name]?.positions);
            if (Array.isArray(positions)) result.push(...positions);
        });
        collectHierarchyPositions(propertyValue(entity.polygon?.hierarchy), result);
        const rectangle = propertyValue(entity.rectangle?.coordinates);
        if (rectangle) result.push(Cesium.Cartesian3.fromRadians(
            (rectangle.west + rectangle.east) / 2,
            (rectangle.south + rectangle.north) / 2
        ));
        return result.filter(position => Cesium.defined(position));
    }

    function anchorFor(entities) {
        const positions = entities.flatMap(entityPositions);
        if (!positions.length) return null;
        return Cesium.Cartographic.fromCartesian(Cesium.BoundingSphere.fromPoints(positions).center);
    }

    function translateCartesian(position, sourceAnchor, targetAnchor) {
        if (!Cesium.defined(position)) return position;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        return Cesium.Cartesian3.fromRadians(
            targetAnchor.longitude + (cartographic.longitude - sourceAnchor.longitude),
            targetAnchor.latitude + (cartographic.latitude - sourceAnchor.latitude),
            Math.max(0, cartographic.height)
        );
    }

    function translateHierarchy(hierarchy, sourceAnchor, targetAnchor) {
        if (!hierarchy) return hierarchy;
        return new Cesium.PolygonHierarchy(
            (hierarchy.positions || []).map(position => translateCartesian(position, sourceAnchor, targetAnchor)),
            (hierarchy.holes || []).map(hole => translateHierarchy(hole, sourceAnchor, targetAnchor))
        );
    }

    function cleanCustomData(customData) {
        const clone = { ...(customData || {}) };
        delete clone.groupId;
        delete clone.groupName;
        delete clone.groupEntity;
        delete clone.groupMembers;
        delete clone.isDrawingGroup;
        delete clone.isMilitaryGroup;
        delete clone.subEntities;
        delete clone.renderedEntityIds;
        if (clone.textSettings) clone.textSettings = { ...clone.textSettings };
        if (clone.textBoxDimensions) clone.textBoxDimensions = { ...clone.textBoxDimensions };
        return clone;
    }

    function translatedCustomData(customData, sourceAnchor, targetAnchor) {
        const clone = cleanCustomData(customData);
        const longitudeOffset = targetAnchor.longitude - sourceAnchor.longitude;
        const latitudeOffset = targetAnchor.latitude - sourceAnchor.latitude;
        if (Array.isArray(clone.positions)) clone.positions = clone.positions.map(point => ({...point,
            lon:point.lon + Cesium.Math.toDegrees(longitudeOffset),lat:point.lat + Cesium.Math.toDegrees(latitudeOffset)}));
        ['center', 'start', 'end', 'startPoint', 'endPoint'].forEach(key => {
            if (Cesium.defined(clone[key])) clone[key] = translateCartesian(clone[key], sourceAnchor, targetAnchor);
        });
        if (Array.isArray(clone.customPoints)) {
            clone.customPoints = clone.customPoints.map(position => translateCartesian(position, sourceAnchor, targetAnchor));
        }
        ['sizedGeometry', 'arcGeometry', 'triangleCenter'].forEach(key => {
            if (!clone[key]) return;
            clone[key] = { ...clone[key] };
            if (Number.isFinite(Number(clone[key].longitude))) clone[key].longitude = Number(clone[key].longitude) + Cesium.Math.toDegrees(longitudeOffset);
            if (Number.isFinite(Number(clone[key].latitude))) clone[key].latitude = Number(clone[key].latitude) + Cesium.Math.toDegrees(latitudeOffset);
        });
        if (Number.isFinite(Number(clone.centerLongitude))) clone.centerLongitude = Number(clone.centerLongitude) + Cesium.Math.toDegrees(longitudeOffset);
        if (Number.isFinite(Number(clone.centerLatitude))) clone.centerLatitude = Number(clone.centerLatitude) + Cesium.Math.toDegrees(latitudeOffset);
        return clone;
    }

    function cloneGraphic(graphic) {
        return graphic?.clone ? graphic.clone() : graphic;
    }

    function translateCoordinateText(text, sourceAnchor, targetAnchor) {
        if (typeof text !== 'string' || !text.trim()) return text;
        const lonOffset = Cesium.Math.toDegrees(targetAnchor.longitude - sourceAnchor.longitude);
        const latOffset = Cesium.Math.toDegrees(targetAnchor.latitude - sourceAnchor.latitude);
        const pairs = text.split(',').map(part => part.trim().split(/\s+/).map(Number));
        if (!pairs.length || pairs.some(pair => pair.length < 2 || !pair.every(Number.isFinite))) return text;
        return pairs.map(pair => `${(pair[0] + lonOffset).toFixed(6)} ${(pair[1] + latOffset).toFixed(6)}`).join(', ');
    }

    function translatedEditorStyle(style, copyName, sourceAnchor, targetAnchor) {
        const result = { ...(style || {}), shapeName: copyName };
        const lonOffset = Cesium.Math.toDegrees(targetAnchor.longitude - sourceAnchor.longitude);
        const latOffset = Cesium.Math.toDegrees(targetAnchor.latitude - sourceAnchor.latitude);
        ['pointLongitude', 'circleLongitude', 'rectangleLongitude', 'arcLongitude', 'triangleLongitude'].forEach(key => {
            if (Number.isFinite(Number(result[key]))) result[key] = Number(result[key]) + lonOffset;
        });
        ['pointLatitude', 'circleLatitude', 'rectangleLatitude', 'arcLatitude', 'triangleLatitude'].forEach(key => {
            if (Number.isFinite(Number(result[key]))) result[key] = Number(result[key]) + latOffset;
        });
        if (result.coordinateText) result.coordinateText = translateCoordinateText(result.coordinateText, sourceAnchor, targetAnchor);
        return result;
    }

    function parseCoordinateText(text, minimum = 2) {
        const pairs = String(text || '').split(',').map(part => part.trim().split(/\s+/).map(Number));
        if (pairs.length < minimum || pairs.some(pair => pair.length !== 2 || !pair.every(Number.isFinite) || Math.abs(pair[0]) > 180 || Math.abs(pair[1]) > 90)) return null;
        return pairs.map(pair => Cesium.Cartesian3.fromDegrees(pair[0], pair[1], 0));
    }

    function applyEditableStyle(entity, nextStyle) {
        const shapeCore = global.ShapeDrawingCore;
        entity.name = String(nextStyle.shapeName || entity.name || '객체').trim();
        entity.customData.displayName = entity.name;
        const helpers = entity.customData?.subEntities || [];
        const allPolylines = [entity, ...helpers].filter(item => item?.polyline);
        if (entity.polygon) {
            entity.polygon.material = shapeCore?.fillMaterial?.(nextStyle) || entity.polygon.material;
            entity.polygon.fill = nextStyle.fillType !== 'none';
        }
        if (entity.ellipse) {
            entity.ellipse.material = shapeCore?.fillMaterial?.(nextStyle) || entity.ellipse.material;
            const longitude = Number(nextStyle.circleLongitude);
            const latitude = Number(nextStyle.circleLatitude);
            const circle = nextStyle.circleShapeType !== 'ellipse';
            const major = circle ? Number(nextStyle.circleRadius) : Number(nextStyle.circleMajorRadius);
            const minor = circle ? major : Number(nextStyle.circleMinorRadius);
            if (Number.isFinite(longitude) && Number.isFinite(latitude)) entity.position = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
            if (Number.isFinite(major) && major > 0) entity.ellipse.semiMajorAxis = major;
            if (Number.isFinite(minor) && minor > 0) entity.ellipse.semiMinorAxis = minor;
        }
        const editedPositions = nextStyle.coordinateGeometry ? parseCoordinateText(nextStyle.coordinateText, entity.polygon ? 3 : 2) : null;
        if (editedPositions) {
            if (entity.polygon) entity.polygon.hierarchy = new Cesium.PolygonHierarchy(editedPositions);
            if (entity.polyline) entity.polyline.positions = entity.polygon ? [...editedPositions, editedPositions[0]] : editedPositions;
            helpers.filter(item => item?.polyline).forEach(item => { item.polyline.positions = [...editedPositions, editedPositions[0]]; });
            entity.customPoints = editedPositions.slice();
        }
        allPolylines.forEach(item => {
            item.show = nextStyle.lineType !== 'none';
            item.polyline.width = Math.max(1, Number(nextStyle.lineWidth) || 1);
            item.polyline.material = shapeCore?.lineMaterial?.(nextStyle) || item.polyline.material;
        });
        document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
        viewer.scene.requestRender();
    }

    function cloneAuxiliaryEntity(source, owner, sourceAnchor, targetAnchor) {
        const child = viewer.entities.add({ show: propertyValue(source.show) !== false });
        graphicNames.forEach(name => { if (source[name]) child[name] = cloneGraphic(source[name]); });
        const position = propertyValue(source.position);
        if (Cesium.defined(position)) child.position = translateCartesian(position, sourceAnchor, targetAnchor);
        const positions = propertyValue(source.polyline?.positions);
        if (child.polyline && Array.isArray(positions)) child.polyline.positions = positions.map(item => translateCartesian(item, sourceAnchor, targetAnchor));
        const hierarchy = propertyValue(source.polygon?.hierarchy);
        if (child.polygon && hierarchy) child.polygon.hierarchy = translateHierarchy(hierarchy, sourceAnchor, targetAnchor);
        if (source.parent) child.parent = owner;
        if (source._lineOwner) child._lineOwner = owner;
        else child._drawingOwner = owner;
        return child;
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function nextNumberedName(entity) {
        const rawName = String(entity?.customData?.displayName || entity?.name || '객체').trim();
        const baseName = rawName.replace(/\s*\(\d+\)$/, '') || '객체';
        if (!nameSequences.has(baseName)) {
            const pattern = new RegExp(`^${escapeRegExp(baseName)}\\s*\\((\\d+)\\)$`);
            const highest = viewer.entities.values.reduce((max, item) => {
                const name = String(item?.customData?.displayName || item?.name || '').trim();
                const match = name.match(pattern);
                return match ? Math.max(max, Number(match[1]) || 0) : max;
            }, 0);
            nameSequences.set(baseName, highest);
        }
        let next = nameSequences.get(baseName) + 1;
        const existingNames = new Set(viewer.entities.values.map(item => String(item?.customData?.displayName || item?.name || '').trim()));
        while (existingNames.has(`${baseName} (${next})`)) next += 1;
        nameSequences.set(baseName, next);
        return `${baseName} (${next})`;
    }

    function cloneEntity(source, sourceAnchor, targetAnchor) {
        const copy = viewer.entities.add({ name: nextNumberedName(source) });
        graphicNames.forEach(name => {
            if (source[name]) copy[name] = cloneGraphic(source[name]);
        });
        const position = propertyValue(source.position);
        if (Cesium.defined(position)) copy.position = translateCartesian(position, sourceAnchor, targetAnchor);
        ['polyline', 'corridor', 'wall', 'polylineVolume'].forEach(name => {
            const positions = propertyValue(source[name]?.positions);
            if (copy[name] && Array.isArray(positions)) {
                copy[name].positions = positions.map(item => translateCartesian(item, sourceAnchor, targetAnchor));
            }
        });
        const hierarchy = propertyValue(source.polygon?.hierarchy);
        if (copy.polygon && hierarchy) copy.polygon.hierarchy = translateHierarchy(hierarchy, sourceAnchor, targetAnchor);
        const rectangle = propertyValue(source.rectangle?.coordinates);
        if (copy.rectangle && rectangle) {
            copy.rectangle.coordinates = new Cesium.Rectangle(
                targetAnchor.longitude + rectangle.west - sourceAnchor.longitude,
                targetAnchor.latitude + rectangle.south - sourceAnchor.latitude,
                targetAnchor.longitude + rectangle.east - sourceAnchor.longitude,
                targetAnchor.latitude + rectangle.north - sourceAnchor.latitude
            );
        }
        copy.customData = translatedCustomData(source.customData, sourceAnchor, targetAnchor);
        if (copy.customData?.displayName) copy.customData.displayName = copy.name;
        const auxiliaryCopies = (source.customData?.subEntities || [])
            .filter(child => viewer.entities.contains(child))
            .map(child => cloneAuxiliaryEntity(child, copy, sourceAnchor, targetAnchor));
        if (auxiliaryCopies.length) copy.customData.subEntities = auxiliaryCopies;
        if (source.customData?.renderedEntityIds) {
            copy.customData.renderedEntityIds = source.customData.renderedEntityIds
                .map(id => viewer.entities.getById(id)).filter(Boolean)
                .map(child => cloneAuxiliaryEntity(child, copy, sourceAnchor, targetAnchor).id);
        }
        if (source._areaStyleEditor) {
            const editorStyle = translatedEditorStyle(source._areaStyleEditor.style, copy.name, sourceAnchor, targetAnchor);
            copy._areaStyleEditor = {
                title: `${copy.name} 설정/편집`,
                style: editorStyle,
                applyCallback: nextStyle => {
                    applyEditableStyle(copy, nextStyle);
                    copy._areaStyleEditor.style = { ...nextStyle };
                }
            };
        }
        document.dispatchEvent(new CustomEvent(isMilitary(copy) ? 'military-symbol-added' : 'drawing-entity-added', { detail: { entity: copy } }));
        return copy;
    }

    function copySelection() {
        const selected = selectedManagedObject();
        if (!selected) return false;
        copiedGroup = (selected.customData?.isDrawingGroup || selected.customData?.isMilitaryGroup) ? selected : null;
        copiedEntities = copiedGroup ? (copiedGroup.customData.groupMembers || []).slice() : [selected];
        return copiedEntities.length > 0;
    }

    function pasteSelection() {
        if (!copiedEntities.length || !Cesium.defined(pastePosition)) return false;
        const sourceAnchor = anchorFor(copiedEntities);
        if (!sourceAnchor) return false;
        const targetAnchor = Cesium.Cartographic.fromCartesian(pastePosition);
        const copies = copiedEntities.map(entity => cloneEntity(entity, sourceAnchor, targetAnchor));
        if (copiedGroup && copies.length) {
            const militaryGroup = copiedGroup.customData?.isMilitaryGroup === true;
            const groupName = nextNumberedName(copiedGroup);
            pasteSequence += 1;
            const groupId = `drawing-group-copy-${Date.now()}-${pasteSequence}`;
            const group = viewer.entities.add({ name: groupName });
            group.customData = {
                ...(militaryGroup
                    ? { source: 'unifiedControlPanel', militarySymbol: true, isMilitaryGroup: true }
                    : { drawingType: 'drawing-group', isDrawingGroup: true }),
                displayName: groupName, groupId, groupMembers: copies,
                subEntities: copies.flatMap(member => [member, ...(member.customData?.subEntities || [])])
            };
            copies.forEach(member => {
                member.customData.groupId = groupId;
                member.customData.groupName = groupName;
                member.customData.groupEntity = group;
            });
            viewer.selectedEntity = group;
            document.dispatchEvent(new CustomEvent('drawing-group-changed', { detail: { group, members: copies } }));
            document.dispatchEvent(new CustomEvent(militaryGroup ? 'military-symbol-added' : 'drawing-entity-added', { detail: { entity: group } }));
        } else {
            viewer.selectedEntity = copies[0];
        }
        viewer.scene.requestRender();
        return true;
    }

    function setPastePositionFromScreen(screenPosition) {
        if (!screenPosition) return false;
        const ray = viewer.camera.getPickRay(screenPosition);
        pastePosition = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (!Cesium.defined(pastePosition) && viewer.scene.pickPositionSupported) pastePosition = viewer.scene.pickPosition(screenPosition);
        return Cesium.defined(pastePosition);
    }

    function removeEntity(entity) {
        (entity.customData?.renderedEntityIds || []).forEach(id => viewer.entities.removeById(id));
        (entity.customData?.subEntities || []).forEach(child => viewer.entities.remove(child));
        viewer.entities.remove(entity);
        document.dispatchEvent(new CustomEvent(isMilitary(entity) ? 'military-symbol-removed' : 'drawing-entity-removed', { detail: { entity } }));
    }

    function deleteObject(entity) {
        if (!isManagedObject(entity) || !viewer.entities.contains(entity) || entity.customData?.isDrawingGroup || entity.customData?.isMilitaryGroup) return false;
        const group = entity.customData?.groupEntity;
        if (group?.customData) {
            group.customData.groupMembers = (group.customData.groupMembers || []).filter(member => member !== entity);
            group.customData.subEntities = (group.customData.subEntities || []).filter(child => child !== entity && !(entity.customData?.subEntities || []).includes(child));
        }
        viewer.selectedEntity = undefined;
        removeEntity(entity);
        if (group) document.dispatchEvent(new CustomEvent('drawing-group-changed',{detail:{groups:[group]}}));
        viewer.scene.requestRender();
        return true;
    }

    function deleteSelection() {
        const selected = selectedManagedObject();
        if (!selected) return false;
        viewer.selectedEntity = undefined;
        if (selected.customData?.isDrawingGroup || selected.customData?.isMilitaryGroup) {
            const militaryGroup = selected.customData?.isMilitaryGroup === true;
            (selected.customData.groupMembers || []).slice().forEach(removeEntity);
            viewer.entities.remove(selected);
            document.dispatchEvent(new CustomEvent('drawing-group-changed', { detail: { groups: [selected] } }));
            document.dispatchEvent(new CustomEvent(militaryGroup ? 'military-symbol-removed' : 'drawing-entity-removed', { detail: { entity: selected } }));
        } else {
            removeEntity(selected);
        }
        viewer.scene.requestRender();
        return true;
    }

    const positionHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    positionHandler.setInputAction(event => {
        const ray = viewer.camera.getPickRay(event.position);
        pastePosition = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (!Cesium.defined(pastePosition) && viewer.scene.pickPositionSupported) {
            pastePosition = viewer.scene.pickPosition(event.position);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewer.selectedEntityChanged.addEventListener(entity => {
        const group = entity?.customData?.groupEntity;
        if (!group || !viewer.entities.contains(group) || viewer.selectedEntity === group) return;
        viewer.selectedEntity = group;
    });

    document.addEventListener('keydown', event => {
        const target = event.target;
        if (target?.matches?.('input, textarea, select') || target?.isContentEditable) return;
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && key === 'c' && copySelection()) event.preventDefault();
        if ((event.ctrlKey || event.metaKey) && key === 'v' && pasteSelection()) event.preventDefault();
        if (!event.ctrlKey && !event.metaKey && (event.key === 'Delete' || event.key === 'Del') && deleteSelection()) event.preventDefault();
    });

    global.DrawingClipboard = {
        copySelection,
        pasteSelection,
        deleteSelection,
        deleteObject,
        setPastePositionFromScreen,
        hasCopy: () => copiedEntities.length > 0
    };
})(window);
