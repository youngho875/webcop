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
        if (clone.textSettings) clone.textSettings = { ...clone.textSettings };
        if (clone.textBoxDimensions) clone.textBoxDimensions = { ...clone.textBoxDimensions };
        return clone;
    }

    function cloneGraphic(graphic) {
        return graphic?.clone ? graphic.clone() : graphic;
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
        copy.customData = cleanCustomData(source.customData);
        if (copy.customData?.displayName) copy.customData.displayName = copy.name;
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

    function removeEntity(entity) {
        (entity.customData?.subEntities || []).forEach(child => viewer.entities.remove(child));
        viewer.entities.remove(entity);
        document.dispatchEvent(new CustomEvent(isMilitary(entity) ? 'military-symbol-removed' : 'drawing-entity-removed', { detail: { entity } }));
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

    global.DrawingClipboard = { copySelection, pasteSelection, deleteSelection };
})(window);
