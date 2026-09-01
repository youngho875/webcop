window.LayerManager = (function () {
  let dialogContainer = null;
  let onLayerChangeCallback = null;
  let onXmlLoadErrorCallback = null;
  let dockPosition = null;
  let isDockCollapsed = false;
  let floatingBounds = null;
  let lastExpandedWidth = 360;
  let lastFloatingHeight = Math.max(240, Math.round(window.innerHeight * 0.75));
  let drawingListenerBound = false;
  let militaryDropBound = false;
  let militarySymbolSequence = 0;
  let vueTreeVm = null;
  let vueOpacityVm = null;
  let vueMilitaryVm = null;
  let isBulkObjectMutation = false;
  let dialogResizeObserver = null;
  let opacityRefreshTimer = null;

  function destroyVueVm(vm) {
    if (vm && typeof vm.$destroy === 'function') vm.$destroy();
  }

  function scheduleOpacityListRefresh() {
    if (opacityRefreshTimer !== null) return;
    opacityRefreshTimer = window.setTimeout(() => {
      opacityRefreshTimer = null;
      const opacityPanel = dialogContainer?.querySelector('[data-tab-panel="opacity"].active');
      if (opacityPanel) renderOpacityPanel();
    }, 0);
  }

  function flyToManagedEntity(entity) {
    const viewer = window.CesiumViewer;
    if (!viewer || !entity || !viewer.entities.contains(entity)) return;
    viewer.selectedEntity = entity;
    if (entity.customData?.isDrawingGroup || entity.customData?.isMilitaryGroup) {
      const spheres = (entity.customData.groupMembers || []).map(member => {
        const sphere = new Cesium.BoundingSphere();
        return viewer.dataSourceDisplay.getBoundingSphere(member, false, sphere) === Cesium.BoundingSphereState.DONE ? sphere : null;
      }).filter(Boolean);
      if (spheres.length) {
        viewer.camera.flyToBoundingSphere(Cesium.BoundingSphere.fromBoundingSpheres(spheres), { duration: 1.2 });
        return;
      }
    }
    Promise.resolve(viewer.flyTo(entity, { duration: 1.2 })).catch(error => {
      console.warn('[LayerManager] 객체 위치 이동 실패:', error);
    });
  }

  document.addEventListener('drawing-group-changed', () => {
    vueOpacityVm?.closeContextMenu?.();
    vueMilitaryVm?.closeContextMenu?.();
    document.querySelectorAll('.layer-context-menu').forEach(menu => { menu.style.display = 'none'; });
    scheduleOpacityListRefresh();
  });

  function militaryCoordinates(entity) {
    const Cesium = window.Cesium;
    if (!Cesium) return { longitude: '-', latitude: '-' };
    const targets = entity.customData?.isMilitaryGroup ? (entity.customData.groupMembers || []) : [entity];
    const coordinates = targets.map(target => {
      const position = target.position?.getValue ? target.position.getValue(Cesium.JulianDate.now()) : target.position;
      if (!Cesium.defined(position)) return null;
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      return {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude)
      };
    }).filter(Boolean);
    if (!coordinates.length) return { longitude: '-', latitude: '-' };
    const longitude = coordinates.reduce((sum, item) => sum + item.longitude, 0) / coordinates.length;
    const latitude = coordinates.reduce((sum, item) => sum + item.latitude, 0) / coordinates.length;
    return { longitude: longitude.toFixed(6), latitude: latitude.toFixed(6) };
  }

  function managedLayerOrder(entity) {
    const value = Number(entity?.customData?.layerOrder);
    return Number.isFinite(value) ? value : 0;
  }

  function sortManagedEntities(entities) {
    return entities.map((entity, index) => ({ entity, index }))
      .sort((a, b) => managedLayerOrder(b.entity) - managedLayerOrder(a.entity) || a.index - b.index)
      .map(entry => entry.entity);
  }

  function setEntityZIndex(entity, zIndex, visited = new Set()) {
    if (!entity || visited.has(entity)) return;
    visited.add(entity);
    entity.customData = entity.customData || {};
    entity.customData.layerOrder = zIndex;
    if (entity.billboard && (entity.customData.militarySymbol || entity.customData.source === 'unifiedControlPanel')) {
      entity.billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
      entity.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
      entity.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }
    ['polygon', 'polyline', 'corridor', 'rectangle', 'ellipse'].forEach(type => {
      if (entity[type]) entity[type].zIndex = zIndex;
    });
    (entity.customData.subEntities || []).forEach(child => setEntityZIndex(child, zIndex, visited));
    (entity.customData.groupMembers || []).forEach(child => setEntityZIndex(child, zIndex, visited));
  }

  function collectManagedRenderEntities(entity, output, visited = new Set()) {
    if (!entity || visited.has(entity)) return;
    visited.add(entity);
    output.push(entity);
    (entity.customData?.subEntities || []).forEach(child => collectManagedRenderEntities(child, output, visited));
    (entity.customData?.groupMembers || []).forEach(child => collectManagedRenderEntities(child, output, visited));
  }

  const militaryRenderLayers = new Map();
  let militaryRenderSyncInstalled = false;

  function propertyValue(property, time) {
    return property?.getValue ? property.getValue(time) : property;
  }

  function groundPosition(position, viewer) {
    const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);
    return cartographic
      ? Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0)
      : position;
  }

  function createMilitary2DLayer(layer, viewer) {
    if (layer.collection2D) return;
    const time = viewer.clock.currentTime;
    const entityBillboard = layer.entity.billboard;
    const position = propertyValue(layer.entity.position, time);
    const image = propertyValue(entityBillboard.image, time);
    if (!Cesium.defined(position) || !image) return;

    const collection2D = viewer.scene.primitives.add(new Cesium.BillboardCollection({ scene: viewer.scene }));
    const billboard2D = collection2D.add({
      id: layer.entity,
      position: groundPosition(position, viewer),
      image,
      width: propertyValue(entityBillboard.width, time),
      height: propertyValue(entityBillboard.height, time),
      scale: Number(propertyValue(entityBillboard.scale, time)) || 1,
      rotation: Number(propertyValue(entityBillboard.rotation, time)) || 0,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      pixelOffset: propertyValue(entityBillboard.pixelOffset, time) || Cesium.Cartesian2.ZERO,
      heightReference: Cesium.HeightReference.NONE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    });
    layer.collection2D = collection2D;
    layer.billboard2D = billboard2D;
  }

  function removeMilitary2DLayer(layer, viewer) {
    if (!layer.collection2D) return;
    viewer.scene.primitives.remove(layer.collection2D);
    layer.collection2D = null;
    layer.billboard2D = null;
  }

  function applyMilitaryLayerMode(layer, viewer) {
    const is2D = viewer.scene.mode === Cesium.SceneMode.SCENE2D;
    const entityVisible = layer.entity.show !== false;

    // 2D 전용 컬렉션은 전환 완료 후 현재 모드에서 새로 생성한다.
    if (is2D) createMilitary2DLayer(layer, viewer);
    else removeMilitary2DLayer(layer, viewer);
    layer.collection.show = entityVisible && !is2D;
    if (layer.collection2D) layer.collection2D.show = entityVisible && is2D;
    layer.entity.billboard.show = false;
  }

  function installMilitaryRenderSync(viewer) {
    if (militaryRenderSyncInstalled) return;
    militaryRenderSyncInstalled = true;
    viewer.scene.preRender.addEventListener(() => {
      const time = viewer.clock.currentTime;
      militaryRenderLayers.forEach((layer, id) => {
        const entity = layer.entity;
        if (!viewer.entities.contains(entity)) {
          viewer.scene.primitives.remove(layer.collection);
          removeMilitary2DLayer(layer, viewer);
          militaryRenderLayers.delete(id);
          return;
        }
        const position = propertyValue(entity.position, time);
        if (Cesium.defined(position)) layer.billboard.position = position;
        if (Cesium.defined(position) && layer.billboard2D) {
          layer.billboard2D.position = groundPosition(position, viewer);
        }
        const is2D = viewer.scene.mode === Cesium.SceneMode.SCENE2D;
        layer.collection.show = entity.show !== false && !is2D;
        if (layer.collection2D) layer.collection2D.show = entity.show !== false && is2D;
        const scale = Number(layer.billboard.scale) || 1;
        const width = Number(layer.billboard.width) || Number(layer.billboard._imageWidth) || 0;
        const height = Number(layer.billboard.height) || Number(layer.billboard._imageHeight) || 0;
        if (width > 0 && height > 0) entity.customData.billboardScreenSize = { width: width * scale, height: height * scale };
      });
    });

    viewer.scene.morphComplete.addEventListener(() => {
      militaryRenderLayers.forEach(layer => applyMilitaryLayerMode(layer, viewer));
      // Entity BillboardVisualizer가 변경된 show/heightReference를 반영할 프레임을 보장한다.
      viewer.scene.requestRender();
      requestAnimationFrame(() => viewer.scene.requestRender());
    });
  }

  function ensureMilitaryRenderLayer(entity, viewer) {
    if (!entity?.billboard || !(entity.customData?.militarySymbol || entity.customData?.source === 'unifiedControlPanel')) return null;
    const existing = militaryRenderLayers.get(entity.id);
    if (existing) return existing;
    const time = viewer.clock.currentTime;
    const image = propertyValue(entity.billboard.image, time);
    const position = propertyValue(entity.position, time);
    if (!image || !Cesium.defined(position)) return null;
    const collection = viewer.scene.primitives.add(new Cesium.BillboardCollection({ scene: viewer.scene }));
    const billboard = collection.add({
      id: entity,
      position,
      image,
      width: propertyValue(entity.billboard.width, time),
      height: propertyValue(entity.billboard.height, time),
      scale: Number(propertyValue(entity.billboard.scale, time)) || 1,
      rotation: Number(propertyValue(entity.billboard.rotation, time)) || 0,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      pixelOffset: propertyValue(entity.billboard.pixelOffset, time) || Cesium.Cartesian2.ZERO,
      eyeOffset: propertyValue(entity.billboard.eyeOffset, time) || Cesium.Cartesian3.ZERO,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    });
    // 기본 Entity BillboardVisualizer의 부호는 숨기고 독립 컬렉션에서 렌더링한다.
    entity.billboard.show = false;
    const layer = { entity, collection, billboard, collection2D: null, billboard2D: null };
    militaryRenderLayers.set(entity.id, layer);
    installMilitaryRenderSync(viewer);
    applyMilitaryLayerMode(layer, viewer);
    viewer.scene.requestRender();
    return layer;
  }

  function refreshMilitarySymbolImage(entity) {
    const viewer = window.CesiumViewer;
    const sidc = String(entity?.customData?.sidc || '').trim().toUpperCase();
    if (!viewer || !entity?.billboard || !/^[A-Z0-9*\-]{15}$/.test(sidc) || !window.ms?.Symbol) return false;
    try {
      const symbolOptions = { size: 60, ...(entity.customData?.symbolOptions || {}) };
      const svg = new window.ms.Symbol(sidc, symbolOptions).asSVG();
      const imageUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      entity.billboard.image = imageUrl;
      const renderLayer = militaryRenderLayers.get(entity.id);
      if (renderLayer?.billboard) renderLayer.billboard.image = imageUrl;
      if (renderLayer?.billboard2D) renderLayer.billboard2D.image = imageUrl;
      viewer.scene.requestRender();
      return true;
    } catch (error) {
      console.error('[LayerManager] 군대부호 이미지 갱신 실패:', error);
      return false;
    }
  }

  document.addEventListener('military-symbol-updated', event => {
    const entity = event.detail?.entity;
    if (!entity) return;
    refreshMilitarySymbolImage(entity);
    if (dialogContainer?.querySelector('[data-tab-panel="military"].active')) renderMilitarySymbolList();
  });

  function reorderManagedRenderEntities(entities) {
    const viewer = window.CesiumViewer;
    if (!viewer?.entities) return;
    const blocks = entities.map(entity => {
      const block = [];
      collectManagedRenderEntities(entity, block);
      return block.filter(item => viewer.entities.contains(item));
    });
    const renderOrder = [];
    const seen = new Set();
    // 목록의 맨 위 객체가 마지막에 렌더링되도록 아래쪽 레이어부터 다시 추가한다.
    blocks.slice().reverse().forEach(block => block.forEach(entity => {
      if (!seen.has(entity)) {
        seen.add(entity);
        renderOrder.push(entity);
      }
    }));
    const selected = viewer.selectedEntity;
    isBulkObjectMutation = true;
    try {
      renderOrder.forEach(entity => viewer.entities.remove(entity));
      renderOrder.forEach(entity => viewer.entities.add(entity));
    } finally {
      isBulkObjectMutation = false;
    }
    if (selected && viewer.entities.contains(selected)) viewer.selectedEntity = selected;
    // BillboardGraphics에는 zIndex가 없으므로 군대부호는 독립 컬렉션 순서를 직접 변경한다.
    renderOrder.forEach(entity => {
      const layer = ensureMilitaryRenderLayer(entity, viewer);
      if (layer) viewer.scene.primitives.raiseToTop(layer.collection);
    });
  }

  function applyManagedLayerOrder(entities) {
    const total = entities.length;
    entities.forEach((entity, index) => setEntityZIndex(entity, (total - index) * 10));
    reorderManagedRenderEntities(entities);
    window.CesiumViewer?.scene?.requestRender?.();
    document.dispatchEvent(new CustomEvent('managed-layer-order-changed', { detail: { entities: entities.slice() } }));
  }

  function managedRoots(military) {
    const viewer = window.CesiumViewer;
    if (!viewer) return [];
    return sortManagedEntities(viewer.entities.values.filter(entity => {
      if (military) return (entity.customData?.source === 'unifiedControlPanel' || entity.customData?.militarySymbol) && (entity.customData?.isMilitaryGroup || !entity.customData?.groupId);
      return entity.customData?.drawingType && (entity.customData?.isDrawingGroup || !entity.customData?.groupId);
    }));
  }

  function moveEntitiesToEdge(targets, edge) {
    const source = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    ['drawing', 'military'].forEach(kind => {
      const military = kind === 'military';
      const roots = [];
      source.forEach(entity => {
        const root = entity.customData?.groupEntity || entity;
        const isMilitary = root.customData?.source === 'unifiedControlPanel' || root.customData?.militarySymbol;
        if (isMilitary === military && !roots.includes(root)) roots.push(root);
      });
      if (!roots.length) return;
      const ordered = managedRoots(military).filter(entity => !roots.includes(entity));
      const next = edge === 'top' ? [...roots, ...ordered] : [...ordered, ...roots];
      applyManagedLayerOrder(next);
      if (military) {
        if (dialogContainer?.querySelector('[data-tab-panel="military"].active')) renderMilitarySymbolList();
      } else if (dialogContainer?.querySelector('[data-tab-panel="opacity"].active')) renderOpacityPanel();
    });
  }

  function installNativeRowSorting(tree, entries) {
    let dragged = null;
    entries.forEach(entry => {
      entry.row.draggable = true;
      entry.row.title = '드래그하여 레이어 순서 변경 · 더블클릭하여 객체 위치로 이동';
      entry.row.addEventListener('dragstart', event => {
        if (event.target.closest('input, button')) return event.preventDefault();
        dragged = entry;
        entry.row.classList.add('layer-row-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', entry.entity.id || 'layer');
      });
      entry.row.addEventListener('dragover', event => {
        if (!dragged || dragged === entry) return;
        event.preventDefault();
        const after = event.clientY > entry.row.getBoundingClientRect().top + entry.row.offsetHeight / 2;
        tree.insertBefore(dragged.row, after ? entry.row.nextSibling : entry.row);
      });
      entry.row.addEventListener('drop', event => event.preventDefault());
      entry.row.addEventListener('dragend', () => {
        if (!dragged) return;
        dragged.row.classList.remove('layer-row-dragging');
        const ordered = [...tree.querySelectorAll(':scope > li')]
          .map(row => entries.find(item => item.row === row)?.entity)
          .filter(Boolean);
        applyManagedLayerOrder(ordered);
        [...tree.children].forEach((row, index) => {
          const number = row.querySelector('.drawing-row-number');
          if (number) number.textContent = String(index + 1);
        });
        dragged = null;
      });
    });
  }

  function normalizeRotationDegrees(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(-360, Math.min(360, number)) : 0;
  }

  function applyDrawingRotation(entity, requestedDegrees) {
    const Cesium = window.Cesium;
    const viewer = window.CesiumViewer;
    if (!Cesium || !entity) return 0;
    const nextDegrees = normalizeRotationDegrees(requestedDegrees);
    const previousDegrees = normalizeRotationDegrees(entity.customData?.rotationDegrees || 0);
    const delta = -Cesium.Math.toRadians(nextDegrees - previousDegrees);
    if (Math.abs(delta) < 1e-10) return nextDegrees;
    const time = viewer?.clock?.currentTime || Cesium.JulianDate.now();
    const read = property => property?.getValue ? property.getValue(time) : property;
    const roots = entity.customData?.isDrawingGroup ? (entity.customData.groupMembers || []) : [entity];
    const targets = [];
    const seen = new Set();
    const addTarget = target => {
      if (!target || seen.has(target)) return;
      seen.add(target); targets.push(target);
      (target.customData?.subEntities || []).forEach(addTarget);
    };
    roots.forEach(addTarget);
    const allPositions = [];
    targets.forEach(target => {
      const position = read(target.position);
      if (Cesium.defined(position)) allPositions.push(position);
      const hierarchy = target.polygon && read(target.polygon.hierarchy);
      if (Array.isArray(hierarchy)) allPositions.push(...hierarchy);
      else if (Array.isArray(hierarchy?.positions)) allPositions.push(...hierarchy.positions);
      const linePositions = target.polyline && read(target.polyline.positions);
      if (Array.isArray(linePositions)) allPositions.push(...linePositions);
    });
    if (!allPositions.length) return nextDegrees;
    const center = Cesium.BoundingSphere.fromPoints(allPositions).center;
    const toWorld = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const toLocal = Cesium.Matrix4.inverseTransformation(toWorld, new Cesium.Matrix4());
    const cosine = Math.cos(delta);
    const sine = Math.sin(delta);
    const rotate = position => {
      const local = Cesium.Matrix4.multiplyByPoint(toLocal, position, new Cesium.Cartesian3());
      const rotated = new Cesium.Cartesian3(local.x * cosine - local.y * sine, local.x * sine + local.y * cosine, local.z);
      return Cesium.Matrix4.multiplyByPoint(toWorld, rotated, new Cesium.Cartesian3());
    };
    targets.forEach(target => {
      const position = read(target.position);
      if (Cesium.defined(position) && (roots.length > 1 || target.billboard || target.label || target.point)) target.position = rotate(position);
      if (target.billboard) target.billboard.rotation = -Cesium.Math.toRadians(nextDegrees);
      if (target.label) target.label.rotation = -Cesium.Math.toRadians(nextDegrees);
      if (target.ellipse) target.ellipse.rotation = -Cesium.Math.toRadians(nextDegrees);
      const hierarchy = target.polygon && read(target.polygon.hierarchy);
      if (Array.isArray(hierarchy)) target.polygon.hierarchy = new Cesium.PolygonHierarchy(hierarchy.map(rotate));
      else if (Array.isArray(hierarchy?.positions)) target.polygon.hierarchy = new Cesium.PolygonHierarchy(hierarchy.positions.map(rotate));
      const linePositions = target.polyline && read(target.polyline.positions);
      if (Array.isArray(linePositions)) target.polyline.positions = linePositions.map(rotate);
      if (Array.isArray(target.customPoints)) target.customPoints = target.customPoints.map(rotate);
      if (target.customData?.start) target.customData.start = rotate(target.customData.start);
      if (target.customData?.end) target.customData.end = rotate(target.customData.end);
      target.customData = { ...(target.customData || {}), rotationDegrees: nextDegrees };
    });
    entity.customData = { ...(entity.customData || {}), rotationDegrees: nextDegrees };
    document.dispatchEvent(new CustomEvent('drawing-entity-updated', { detail: { entity } }));
    viewer?.scene?.requestRender();
    return nextDegrees;
  }

  function createVueListItem(entity, index, type) {
    const coordinates = type === 'military' ? militaryCoordinates(entity) : { longitude: '', latitude: '' };
    const item = {
      id: entity.id,
      number: index + 1,
      name: type === 'military'
        ? (entity.customData?.displayName || entity.name || `객체 ${index + 1}`)
        : (entity.name || `도형 ${index + 1}`),
      code: type === 'military'
        ? (entity.customData?.sidc || entity.customData?.shape || '-')
        : '',
      longitude: coordinates.longitude,
      latitude: coordinates.latitude,
      visible: entity.show !== false,
      rotation: normalizeRotationDegrees(entity.customData?.rotationDegrees || 0)
    };
    Object.defineProperty(item, 'entity', { value: entity, enumerable: false });
    return item;
  }

  function mountVueObjectTree(host, entities, type, setVisible) {
    if (!window.Vue || !host) return null;
    const items = sortManagedEntities(entities).map((entity, index) => createVueListItem(entity, index, type));
    const isMilitary = type === 'military';
    return new window.Vue({
      el: host,
      data: {
        items,
        contextItem: null,
        contextMenuX: 0,
        contextMenuY: 0,
        draggedItem: null
      },
      computed: {
        allSelected() { return this.items.length > 0 && this.items.every(item => item.visible); },
        partlySelected() {
          const count = this.items.filter(item => item.visible).length;
          return count > 0 && count < this.items.length;
        },
        selectedCount() {
          return this.items.filter(item => item.visible).length;
        }
      },
      methods: {
        setItem(item, visible) {
          item.visible = visible;
          setVisible(item.entity, visible);
        },
        setAll(visible) {
          this.items.forEach(item => this.setItem(item, visible));
        },
        setRotation(item, value) {
          item.rotation = applyDrawingRotation(item.entity, value);
        },
        startRowDrag(event, item) {
          if (event.target?.closest?.('input, button')) return event.preventDefault();
          this.draggedItem = item;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', item.id || 'layer');
        },
        moveRowDrag(event, targetItem) {
          if (!this.draggedItem || this.draggedItem === targetItem) return;
          event.preventDefault();
          const from = this.items.indexOf(this.draggedItem);
          const bounds = event.currentTarget.getBoundingClientRect();
          const after = event.clientY > bounds.top + bounds.height / 2;
          this.items.splice(from, 1);
          const targetIndex = this.items.indexOf(targetItem);
          this.items.splice(targetIndex + (after ? 1 : 0), 0, this.draggedItem);
          this.items.forEach((entry, index) => { entry.number = index + 1; });
        },
        finishRowDrag() {
          if (!this.draggedItem) return;
          applyManagedLayerOrder(this.items.map(item => item.entity));
          this.draggedItem = null;
        },
        flyToItem(event, item) {
          if (event.target?.closest?.('input, button')) return;
          this.setItem(item, true);
          flyToManagedEntity(item.entity);
        },
        selectItem(event, item) {
          if (event.target?.closest?.('input, button')) return;
          if (!item.entity.customData?.isDrawingGroup && !item.entity.customData?.isMilitaryGroup) return;
          const viewer = window.CesiumViewer;
          if (!viewer) return;
          viewer.selectedEntity = undefined;
          window.setTimeout(() => { viewer.selectedEntity = item.entity; }, 0);
        },
        openContextMenu(event, item) {
          this.contextItem = item;
          this.contextMenuX = Math.min(event.clientX, window.innerWidth - 130);
          this.contextMenuY = Math.min(event.clientY, window.innerHeight - 165);
        },
        closeContextMenu() {
          this.contextItem = null;
        },
        editContextItem() {
          const item = this.contextItem;
          if (!item) return;
          if (!isMilitary && (item.entity?._areaStyleEditor || item.entity?.customData?.textDrawing)) {
            const viewer = window.CesiumViewer;
            this.closeContextMenu();
            if (viewer) {
              // 같은 객체를 연속으로 편집해도 selectedEntityChanged가 발생하도록 선택을 갱신한다.
              viewer.selectedEntity = undefined;
              window.setTimeout(() => { viewer.selectedEntity = item.entity; }, 0);
            }
            return;
          }
          const nextName = window.prompt('객체 이름을 입력하세요.', item.name);
          if (nextName === null) return this.closeContextMenu();
          const trimmedName = nextName.trim();
          if (trimmedName) {
            item.name = trimmedName;
            item.entity.name = trimmedName;
            if (isMilitary) item.entity.customData.displayName = trimmedName;
          }
          if (isMilitary) {
            const nextCode = window.prompt('군대부호 코드를 입력하세요.', item.code);
            if (nextCode !== null && nextCode.trim()) {
              item.code = nextCode.trim();
              item.entity.customData.sidc = item.code;
            }
          }
          document.dispatchEvent(new CustomEvent(isMilitary ? 'military-symbol-updated' : 'drawing-entity-updated', {
            detail: { entity: item.entity }
          }));
          this.closeContextMenu();
        },
        deleteContextItem() {
          const item = this.contextItem;
          if (!item || !window.confirm(`'${item.name}' 객체를 삭제하시겠습니까?`)) return;
          this.removeItems([item]);
        },
        deleteSelectedItems() {
          const targets = this.items.filter(item => item.visible);
          if (!targets.length) return;
          if (!window.confirm(`선택한 ${targets.length}개 객체를 삭제하시겠습니까?`)) return;
          this.removeItems(targets);
        },
        deleteAllItems() {
          if (!this.allSelected || !this.items.length) return;
          const targets = this.items.slice();
          if (!window.confirm(`전체 ${targets.length}개 객체를 삭제하시겠습니까?`)) return;
          this.removeItems(targets);
        },
        groupSelectedItems() {
          if (!window.DrawingGroupManager) return;
          const entities = this.items.filter(item => item.visible && !item.entity.customData?.isDrawingGroup && !item.entity.customData?.isMilitaryGroup && !item.entity.customData?.groupId).map(item => item.entity);
          if (entities.length < 2) return window.alert('그룹등록할 객체를 체크박스로 2개 이상 선택하세요.');
          this.closeContextMenu();
          this.$nextTick(() => window.DrawingGroupManager.groupEntities(entities));
        },
        ungroupSelectedItems() {
          if (!window.DrawingGroupManager) return;
          const entities = this.items.filter(item => item.visible && (item.entity.customData?.isDrawingGroup || item.entity.customData?.isMilitaryGroup || item.entity.customData?.groupId)).map(item => item.entity);
          if (!entities.length) return window.alert('그룹해제할 그룹을 체크박스로 선택하세요.');
          this.closeContextMenu();
          this.$nextTick(() => window.DrawingGroupManager.ungroupEntities(entities));
        },
        removeItems(targets) {
          const viewer = window.CesiumViewer;
          const targetSet = new Set(targets);
          this.items = this.items.filter(item => !targetSet.has(item));
          this.items.forEach((entry, entryIndex) => { entry.number = entryIndex + 1; });
          this.closeContextMenu();
          isBulkObjectMutation = true;
          try {
            targets.forEach(item => {
              (item.entity.customData?.subEntities || []).forEach(subEntity => viewer?.entities?.remove(subEntity));
              viewer?.entities?.remove(item.entity);
            });
          } finally {
            isBulkObjectMutation = false;
          }
          document.dispatchEvent(new CustomEvent(isMilitary ? 'military-symbol-removed' : 'drawing-entity-removed', {
            detail: { entities: targets.map(item => item.entity) }
          }));
        }
      },
      mounted() {
        this._closeContextMenu = event => {
          if (!event.target?.closest?.('.layer-context-menu')) this.closeContextMenu();
        };
        document.addEventListener('mousedown', this._closeContextMenu);
        window.addEventListener('blur', this._closeContextMenu);
      },
      beforeDestroy() {
        document.removeEventListener('mousedown', this._closeContextMenu);
        window.removeEventListener('blur', this._closeContextMenu);
      },
      render(h) {
        const master = h('input', {
          class: 'drawing-header-checkbox',
          attrs: { type: 'checkbox', title: '전체 선택/해제', 'aria-label': '전체 선택/해제' },
          domProps: { checked: this.allSelected, indeterminate: this.partlySelected },
          on: { change: event => this.setAll(event.target.checked) }
        });
        const headerLabels = isMilitary ? ['번호', '이름', '코드', '경도', '위도'] : ['번호', '이름', '회전각(°)'];
        const header = h('div', { class: isMilitary ? 'military-list-header' : 'drawing-list-header' }, [
          h('span', [master]),
          ...headerLabels.map(label => h('span', label))
        ]);
        const rows = this.items.map(item => h('li', {
          class: [isMilitary ? 'military-visibility-item' : 'drawing-visibility-item', {
            'context-selected': this.contextItem === item,
            'layer-row-dragging': this.draggedItem === item
          }],
          attrs: { role: 'treeitem', draggable: 'true', 'aria-label': item.name, title: '드래그하여 레이어 순서 변경 · 더블클릭하여 객체 위치로 이동' },
          on: {
            click: event => this.selectItem(event, item),
            dblclick: event => this.flyToItem(event, item),
            contextmenu: event => { event.preventDefault(); this.openContextMenu(event, item); },
            dragstart: event => this.startRowDrag(event, item),
            dragover: event => this.moveRowDrag(event, item),
            drop: event => { event.preventDefault(); this.finishRowDrag(); },
            dragend: this.finishRowDrag
          }
        }, [
          h('span', { class: 'drawing-visibility-cell' }, [h('input', {
            attrs: { type: 'checkbox' },
            domProps: { checked: item.visible },
            on: { change: event => this.setItem(item, event.target.checked) }
          })]),
          h('span', { class: 'drawing-row-number' }, String(item.number)),
          h('span', item.name),
          ...(!isMilitary ? [h('span', { class: 'drawing-rotation-cell' }, [h('input', {
            class: 'drawing-rotation-input',
            attrs: { type: 'number', min: '-360', max: '360', step: '1', title: '-360~360도 회전각 (양수: 시계방향, 음수: 반시계방향)' },
            domProps: { value: item.rotation },
            on: {
              change: event => this.setRotation(item, event.target.value),
              keydown: event => { if (event.key === 'Enter') event.target.blur(); }
            }
          })])] : []),
          ...(isMilitary ? [
            h('span', { class: 'military-code', attrs: { title: item.code } }, item.code),
            h('span', { class: 'military-coordinate' }, item.longitude),
            h('span', { class: 'military-coordinate' }, item.latitude)
          ] : [])
        ]));
        const contextMenu = this.contextItem ? h('div', {
          class: 'layer-context-menu',
          style: { left: `${this.contextMenuX}px`, top: `${this.contextMenuY}px` },
          on: { contextmenu: event => event.preventDefault(), mousedown: event => event.stopPropagation() }
        }, [
          h('button', { attrs: { type: 'button' }, on: { click: this.editContextItem } }, '편집'),
          ...([
            h('button', {
              attrs: { type: 'button', disabled: this.items.filter(item => item.visible && !item.entity.customData?.isDrawingGroup && !item.entity.customData?.isMilitaryGroup && !item.entity.customData?.groupId).length < 2 },
              on: { click: this.groupSelectedItems }
            }, '그룹등록'),
            h('button', {
              attrs: { type: 'button', disabled: !this.items.some(item => item.visible && (item.entity.customData?.isDrawingGroup || item.entity.customData?.isMilitaryGroup || item.entity.customData?.groupId)) },
              on: { click: this.ungroupSelectedItems }
            }, '그룹해제')
          ]),
          h('button', { class: 'danger', attrs: { type: 'button' }, on: { click: this.deleteContextItem } }, '삭제'),
          h('div', { class: 'layer-context-separator' }),
          h('button', {
            class: 'danger',
            attrs: { type: 'button', disabled: this.selectedCount === 0 },
            on: { click: this.deleteSelectedItems }
          }, `선택목록삭제 (${this.selectedCount})`),
          h('button', {
            class: 'danger',
            attrs: { type: 'button', disabled: !this.allSelected },
            on: { click: this.deleteAllItems }
          }, '전체삭제')
        ]) : null;
        return h('div', { class: isMilitary ? 'military-list-box' : 'drawing-list-box' }, [
          header,
          h('ul', { class: 'drawing-list-tree', attrs: { role: 'tree' } }, rows),
          contextMenu
        ]);
      }
    });
  }

  function mountVueLayerTree(host) {
    if (!window.Vue || !host) return null;
    const LayerNode = {
      name: 'LayerTreeNode',
      props: ['node', 'onToggle'],
      methods: {
        toggleExpanded() { this.$set(this.node, 'expanded', this.node.expanded === false); },
        changeChecked(event) { this.onToggle(this.node, event.target.checked); }
      },
      render(h) {
        const children = this.node.children || [];
        const hasChildren = children.length > 0;
        const expandControl = hasChildren
          ? h('button', {
              class: 'layer-expand-button',
              attrs: {
                type: 'button',
                'aria-expanded': String(this.node.expanded !== false),
                'aria-label': `${this.node.name || '레이어'} ${this.node.expanded === false ? '펼치기' : '접기'}`
              },
              on: { click: this.toggleExpanded }
            }, '▼')
          : h('span', { class: 'layer-expand-spacer' });
        const content = h('div', { class: 'layer-node-content' }, [
          expandControl,
          h('input', {
            class: 'layer-checkbox',
            attrs: { type: 'checkbox', id: `chk_${this.node.id}` },
            domProps: { checked: Boolean(this.node.checked), indeterminate: Boolean(this.node.indeterminate) },
            on: { change: this.changeChecked }
          }),
          this.node.name ? h('label', { class: 'layer-label', attrs: { for: `chk_${this.node.id}` } }, this.node.name) : null
        ]);
        const nested = hasChildren && this.node.expanded !== false
          ? h('ul', { class: ['layer-tree-list', 'layer-tree-children'] }, children.map(child =>
              h(LayerNode, { key: child.id, props: { node: child, onToggle: this.onToggle } })
            ))
          : null;
        return h('li', { class: 'layer-tree-item' }, [content, nested]);
      }
    };
    return new window.Vue({
      el: host,
      data: { layers: layersData, revision: 0 },
      methods: {
        changeLayer(node, checked) {
          node.checked = checked;
          node.indeterminate = false;
          toggleChildren(node, checked);
          updateParentCheckboxes();
          handleBuiltInLayerChange(node, checked);
          if (onLayerChangeCallback) onLayerChangeCallback(node, checked);
          this.revision += 1;
        }
      },
      render(h) {
        void this.revision;
        return h('ul', { class: 'layer-tree-list', attrs: { role: 'tree', 'aria-label': '지도 레이어 트리' } },
          this.layers.map(node => h(LayerNode, { key: node.id, props: { node, onToggle: this.changeLayer } }))
        );
      }
    });
  }

  // 브라우저에서는 폴더를 직접 열거할 수 없으므로 data 폴더의 XML 목록을 관리한다.
  const DEFAULT_XML_FILES = [
    'cop_land_5_unix.xml',
    'cop_land_10_unix.xml',
    'cop_land_25_unix.xml',
    'cop_land_50_unix.xml',
    'cop_land_100_unix.xml',
    'cop_air_25_unix.xml',
    'cop_air_50_unix.xml',
    'cop_air_100_unix.xml',
    'cop_air_200_unix.xml',
    'cop_kr_1_unix.xml',
    'cop_kr_2_unix.xml',
    'cop_kr_3_unix.xml',
    'cop_kr_4_unix.xml',
    'cop_kr_5_unix.xml'
  ];

  // XML 로딩 전 기본 트리
  let layersData = [
    {
      id: 'fdb_root',
      name: 'FDB',
      checked: false,
      children: []
    },
    {
      id: 'raster_root',
      name: 'RASTER',
      checked: true,
      children: [
        {
          id: 'yukdo',
          name: '육도',
          checked: true,
          children: [
            { id: 'yukdo_sub1', name: '1:25,000', checked: true, rasterType: 'land', scaleCode: 25 },
            { id: 'yukdo_sub2', name: '1:50,000', checked: false, rasterType: 'land', scaleCode: 50 },
            { id: 'yukdo_sub3', name: '1:100,000', checked: false, rasterType: 'land', scaleCode: 100 },
          ]
        },
        {
          id: 'gongdo',
          name: '공도',
          checked: true,
          children: [
            { id: 'gongdo_sub1', name: '1:25,000', checked: true, rasterType: 'air', scaleCode: 25 },
            { id: 'gongdo_sub2', name: '1:50,000', checked: false, rasterType: 'air', scaleCode: 50 },
            { id: 'gongdo_sub3', name: '1:100,000', checked: false, rasterType: 'air', scaleCode: 100 },
          ]
        },
        {
          id: 'satelite',
          name: '위성영상',
          checked: true,
          children: [
            { id: 'satelite_sub1', name: 'CIB(1M)', checked: true },
          ]
        },
      ]
    }
  ];

  /**
   * XML의 <Layers>/<Layer>를
   * FDB → Category → Layer 구조로 변환한다.
   */
  function parseFdbLayers(xmlText, options = {}) {
    const xml = new DOMParser().parseFromString(
      xmlText,
      'application/xml'
    );

    const parseError = xml.querySelector('parsererror');

    if (parseError) {
      throw new Error(
        `XML 파싱 실패: ${parseError.textContent.trim()}`
      );
    }

    const categories = new Map();
    const stylesByName = new Map();
    const styleTablesByName = new Map();

    Array.from(xml.documentElement.children).forEach((element) => {
      if (element.tagName === 'style') {
        const values = {};
        Array.from(element.children).forEach(child => {
          values[child.tagName] = child.textContent.trim();
        });
        stylesByName.set(element.getAttribute('name'), {
          name: element.getAttribute('name') || '',
          type: (element.getAttribute('type') || '').toUpperCase(),
          ...values
        });
      }

      if (element.tagName === 'StyleTable') {
        const rules = Array.from(element.children)
          .filter(child => child.tagName === 'Element')
          .map(child => ({
            value: child.getAttribute('value') || '',
            styleNames: [
              child.getAttribute('polygon'),
              child.getAttribute('line'),
              child.getAttribute('point'),
              child.getAttribute('label')
            ].filter(Boolean)
          }));
        styleTablesByName.set(element.getAttribute('name'), rules);
      }
    });
    const layerElements = Array.from(
      xml.querySelectorAll('Layers > Layer')
    );

    layerElements.forEach((layerElement, index) => {
      const getText = (tagName) => {
        const element = layerElement.querySelector(tagName);

        return element
          ? element.textContent.trim()
          : '';
      };

      const categoryName =
        getText('Category') || '미분류';

      const source = getText('Source');

      const alias =
        layerElement.getAttribute('alias') ||
        source ||
        `Layer ${index + 1}`;

      const visible =
        getText('Visible').toUpperCase() === 'TRUE';

      const geometryStyleName = getText('GeometryStyleName');
      const styleTableName = getText('StyleTableName');
      const styleRules = (styleTablesByName.get(styleTableName) || []).map(rule => ({
        value: rule.value,
        styles: rule.styleNames.map(name => stylesByName.get(name)).filter(Boolean)
      }));

      const safeKey = (
        source || `layer_${index + 1}`
      ).replace(/[^a-zA-Z0-9_-]/g, '_');

      if (!categories.has(categoryName)) {
        categories.set(categoryName, []);
      }

      categories.get(categoryName).push({
        id: `fdb_${options.idPrefix || 'xml'}_${safeKey}_${index}`,
        name: alias,
        checked: visible,

        // 실제 레이어 제어에 사용할 XML 정보
        source: source,
        alias: alias,
        category: categoryName,
        providerName: getText('ProviderName'),
        displayType: getText('DisplayType'),
        useStyleTable:
          getText('UseStyleTable').toUpperCase() === 'TRUE',
        styleTableName: styleTableName,
        styleColumnName: getText('StyleColumnName'),
        geometryStyleName: geometryStyleName,
        styleDefinition: stylesByName.get(geometryStyleName) || null,
        styleRules: styleRules,
        useScale:
          getText('UseScale').toUpperCase() === 'TRUE',
        minScale: getText('MinScale'),
        maxScale: getText('MaxScale')
      });

      Object.assign(
        categories.get(categoryName)[categories.get(categoryName).length - 1],
        {
          xmlFile: options.fileName || '',
          mapType: options.mapType || '',
          mapScale: options.scaleLabel || ''
        }
      );
    });

    return Array.from(
      categories,
      ([categoryName, children], categoryIndex) => ({
        id: `fdb_${options.idPrefix || 'xml'}_category_${categoryIndex}`,
        name: categoryName,
        checked:
          children.length > 0 &&
          children.every((layer) => layer.checked),
        children: children
      })
    );
  }

  function getXmlFileInfo(fileName) {
    const match = fileName.match(/^cop_(land|air|kr)_(\d+)_unix\.xml$/i);
    if (!match) return null;

    const typeCode = match[1].toLowerCase();
    const scaleCode = Number(match[2]);
    const typeInfo = {
      land: { id: 'land', name: '육도', order: 0 },
      air: { id: 'air', name: '공도', order: 1 },
      kr: { id: 'sea', name: '해도', order: 2 }
    }[typeCode];

    return {
      ...typeInfo,
      fileName,
      scaleCode,
      scaleLabel: typeCode === 'kr'
        ? `제${scaleCode}축척군`
        : `1:${(scaleCode * 10000).toLocaleString('ko-KR')}`
    };
  }

  async function fetchXmlText(url, encoding) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url} 요청 실패 (${response.status} ${response.statusText})`);
    }
    return new TextDecoder(encoding).decode(await response.arrayBuffer());
  }

  /** data 폴더의 모든 XML을 FDB > 종류 > 축척 > 카테고리 > 레이어로 만든다. */
  async function loadFromDataFolder(options = {}) {
    const dataPath = (options.dataPath || '/data').replace(/\/$/, '');
    const encoding = options.encoding || 'euc-kr';
    const files = options.xmlFiles || DEFAULT_XML_FILES;
    const targets = files
      .map(fileName => getXmlFileInfo(fileName))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order || a.scaleCode - b.scaleCode);

    const results = await Promise.allSettled(
      targets.map(async info => ({
        info,
        categories: parseFdbLayers(
          await fetchXmlText(`${dataPath}/${info.fileName}`, encoding),
          {
            idPrefix: `${info.id}_${info.scaleCode}`,
            fileName: info.fileName,
            mapType: info.name,
            scaleLabel: info.scaleLabel
          }
        )
      }))
    );

    const typeMap = new Map();
    const errors = [];

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        errors.push({ fileName: targets[index].fileName, error: result.reason });
        console.error(`[LayerManager] ${targets[index].fileName} 로딩 실패:`, result.reason);
        return;
      }

      const { info, categories } = result.value;
      if (!typeMap.has(info.id)) {
        typeMap.set(info.id, {
          id: `fdb_type_${info.id}`,
          name: info.name,
          checked: true,
          expanded: true,
          order: info.order,
          children: []
        });
      }

      typeMap.get(info.id).children.push({
        id: `fdb_scale_${info.id}_${info.scaleCode}`,
        name: info.scaleLabel,
        checked: categories.length > 0 && categories.every(node => node.checked),
        expanded: false,
        xmlFile: info.fileName,
        children: categories
      });
    });

    const fdbChildren = Array.from(typeMap.values())
      .sort((a, b) => a.order - b.order)
      .map(type => {
        delete type.order;
        type.checked = type.children.length > 0 && type.children.every(node => node.checked);
        return type;
      });

    let fdbRoot = layersData.find(layer => layer.id === 'fdb_root');
    if (!fdbRoot) {
      fdbRoot = { id: 'fdb_root', name: 'FDB', checked: false, children: [] };
      layersData.unshift(fdbRoot);
    }
    fdbRoot.children = fdbChildren;
    fdbRoot.checked = fdbChildren.length > 0 && fdbChildren.every(node => node.checked);
    fdbRoot.expanded = true;

    try {
      const baseMapFileName = options.baseMapFile || 'base_COPMap_local.xml';
      const baseMapChildren = parseFdbLayers(
        await fetchXmlText(`${dataPath}/${baseMapFileName}`, encoding),
        { idPrefix: 'basemap', fileName: baseMapFileName, mapType: 'BaseMap', scaleLabel: '' }
      );
      const markBaseMapNode = node => {
        node.baseMapLayer = true;
        if (typeof node.id === 'string') node.id = node.id.replace(/^fdb_/, 'basemap_');
        (node.children || []).forEach(markBaseMapNode);
      };
      baseMapChildren.forEach(markBaseMapNode);
      const baseMapRoot = {
        id: 'basemap_root',
        name: 'BaseMap',
        checked: baseMapChildren.length > 0 && baseMapChildren.every(node => node.checked),
        expanded: true,
        baseMapLayer: true,
        children: baseMapChildren
      };
      const previousIndex = layersData.findIndex(layer => layer.id === 'basemap_root');
      if (previousIndex >= 0) layersData.splice(previousIndex, 1);
      const fdbIndex = layersData.findIndex(layer => layer.id === 'fdb_root');
      layersData.splice(fdbIndex >= 0 ? fdbIndex + 1 : 0, 0, baseMapRoot);
    } catch (error) {
      errors.push({ fileName: options.baseMapFile || 'base_COPMap_local.xml', error });
      console.error('[LayerManager] BaseMap XML 로딩 실패:', error);
    }
    refreshTree();

    if (errors.length && onXmlLoadErrorCallback) onXmlLoadErrorCallback(errors);
    return { tree: fdbChildren, errors };
  }

  /**
   * 현재 레이어 데이터로 트리를 다시 그린다.
   */
  function refreshTree() {
    if (!dialogContainer) {
      return;
    }

    const body = dialogContainer.querySelector('[data-tab-panel="map"]');

    if (!body) {
      return;
    }

    if (window.Vue) {
      destroyVueVm(vueTreeVm);
      body.replaceChildren(document.createElement('div'));
      vueTreeVm = mountVueLayerTree(body.firstElementChild);
    } else {
      body.replaceChildren(renderTree(layersData));
    }
  }

  /** LayerManager 기본 항목과 mapDraw 기능을 연결한다. */
  function handleBuiltInLayerChange(node, isChecked) {
    const isCibNode =
      node.id === 'satelite' ||
      node.id === 'satelite_sub1' ||
      node.name === '위성영상' ||
      node.name === 'CIB(1M)';

    const isLandScaleNode =
      typeof node.id === 'string' &&
      node.id.startsWith('fdb_scale_land_');

    const isBaseMapNode = node.id === 'basemap_root' || node.baseMapLayer === true;

    const isRasterMapNode =
      node.id === 'yukdo' ||
      node.id === 'gongdo' ||
      node.id.startsWith('yukdo_sub') ||
      node.id.startsWith('gongdo_sub');

    if (isRasterMapNode) {
      if (
        !window.mapDrawing ||
        typeof window.mapDrawing.raster !== 'function'
      ) {
        console.warn('[LayerManager] mapDrawing.raster 함수를 찾을 수 없습니다.');
        return;
      }

      const rasterNodes = [];
      const collectRasterLayers = (treeNode) => {
        if (treeNode.rasterType && treeNode.scaleCode) rasterNodes.push(treeNode);
        if (treeNode.children) treeNode.children.forEach(collectRasterLayers);
      };
      collectRasterLayers(node);

      rasterNodes.forEach(rasterNode => {
        window.mapDrawing.raster(rasterNode, isChecked);
      });
      return;
    }

    if (isLandScaleNode) {
      if (
        !window.mapDrawing ||
        typeof window.mapDrawing.fdb !== 'function'
      ) {
        console.warn('[LayerManager] mapDrawing.fdb 함수를 찾을 수 없습니다.');
        return;
      }

      const layerNodes = [];
      const collectLayers = (treeNode) => {
        if (treeNode.source) layerNodes.push(treeNode);
        if (treeNode.children) treeNode.children.forEach(collectLayers);
      };
      collectLayers(node);

      window.mapDrawing.fdb(layerNodes, isChecked, {
        concurrency: 6
      }).then(result => {
        if (result.failed > 0) {
          console.warn(
            `[LayerManager] ${node.name} FDB: ${result.loaded}개 성공, ${result.failed}개 실패`
          );
        }
      }).catch(error => {
        console.error(`[LayerManager] ${node.name} FDB 처리 실패:`, error);
      });
      return;
    }

    if (isBaseMapNode) {
      if (!window.mapDrawing || typeof window.mapDrawing.fdb !== 'function') {
        console.warn('[LayerManager] BaseMap 레이어를 처리할 mapDrawing.fdb 함수를 찾을 수 없습니다.');
        return;
      }
      const layerNodes = [];
      const collectBaseMapLayers = treeNode => {
        if (treeNode.source) layerNodes.push(treeNode);
        (treeNode.children || []).forEach(collectBaseMapLayers);
      };
      collectBaseMapLayers(node);
      window.mapDrawing.fdb(layerNodes, isChecked, { concurrency: 6 }).then(result => {
        if (result.failed > 0) console.warn(`[LayerManager] BaseMap: ${result.loaded}개 성공, ${result.failed}개 실패`);
      }).catch(error => console.error('[LayerManager] BaseMap 처리 실패:', error));
      return;
    }

    if (!isCibNode) {
      if (
        node.source &&
        (!node.children || node.children.length === 0) &&
        window.mapDrawing &&
        typeof window.mapDrawing.geojsonCreate === 'function'
      ) {
        window.mapDrawing.geojsonCreate(node, isChecked).catch(error => {
          console.error(`[LayerManager] ${node.name} WFS 레이어 변경 실패:`, error);
        });
      }
      return;
    }

    if (
      !window.mapDrawing ||
      typeof window.mapDrawing.cib !== 'function'
    ) {
      console.warn('[LayerManager] mapDrawing.cib 함수를 찾을 수 없습니다.');
      return;
    }

    try {
      window.mapDrawing.cib(isChecked);
    } catch (error) {
      console.error('[LayerManager] CIB 레이어 변경 실패:', error);
    }
  }

  /**
   * URL 또는 File 객체에서 XML을 읽는다.
   *
   * @param {string|File} xmlSource
   * @param {Object} options
   * @param {string} options.encoding
   */
  async function loadFromXml(xmlSource, options = {}) {
    if (!xmlSource) {
      throw new Error(
        'xmlSource(URL 문자열 또는 File 객체)가 필요합니다.'
      );
    }

    try {
      let buffer;

      if (typeof xmlSource === 'string') {
        const response = await fetch(xmlSource);

        if (!response.ok) {
          throw new Error(
            `XML 요청 실패 ` +
            `(${response.status} ${response.statusText})`
          );
        }

        buffer = await response.arrayBuffer();
      } else if (
        xmlSource &&
        typeof xmlSource.arrayBuffer === 'function'
      ) {
        buffer = await xmlSource.arrayBuffer();
      } else {
        throw new TypeError(
          'xmlSource는 URL 문자열 또는 File 객체여야 합니다.'
        );
      }

      // cop_land_5_unix.xml의 기본 인코딩은 EUC-KR
      const encoding = options.encoding || 'euc-kr';

      const xmlText = new TextDecoder(
        encoding
      ).decode(buffer);

      const fdbChildren = parseFdbLayers(xmlText);

      let fdbRoot = layersData.find(
        (layer) => layer.id === 'fdb_root'
      );

      if (!fdbRoot) {
        fdbRoot = {
          id: 'fdb_root',
          name: 'FDB',
          checked: false,
          children: []
        };

        layersData.unshift(fdbRoot);
      }

      fdbRoot.children = fdbChildren;
      fdbRoot.checked =
        fdbChildren.length > 0 &&
        fdbChildren.every(
          (category) => category.checked
        );

      refreshTree();

      return fdbChildren;
    } catch (error) {
      console.error(
        '[LayerManager] XML 레이어 로딩 실패:',
        error
      );

      if (onXmlLoadErrorCallback) {
        onXmlLoadErrorCallback(error);
      }

      throw error;
    }
  }

  /**
   * CSS 스타일 주입
   */
  function injectStyles() {
    if (
      document.getElementById('layer-dialog-style')
    ) {
      return;
    }

    const style = document.createElement('style');

    style.id = 'layer-dialog-style';

    style.textContent = `
      .layer-dialog-container {
        position: fixed;
        top: 80px;
        left: 70px;
        width: 320px;
        height: 480px;
        min-width: 240px;
        min-height: 240px;
        max-width: calc(100vw - 12px);
        max-height: calc(100vh - 12px);
        background: rgba(55, 65, 81, 0.97);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid #6b7280;
        border-radius: 12px;
        padding: 16px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        box-shadow:
          0 18px 38px rgba(15, 23, 42, 0.22),
          0 0 0 1px rgba(255, 255, 255, 0.08);
        user-select: none;
        z-index: 1000;
        resize: both;
        overflow: hidden;
        transition:
          transform 0.15s ease,
          box-shadow 0.15s ease;
      }

      .layer-dialog-container.layer-docked {
        top: 0 !important;
        bottom: 0 !important;
        height: auto !important;
        min-height: 240px;
        max-height: none !important;
        border-radius: 0;
        resize: horizontal;
      }

      .layer-dialog-container.layer-docked-left {
        left: 0 !important;
        right: auto !important;
        border-left: 0;
      }

      .layer-dialog-container.layer-docked-right {
        left: auto !important;
        right: 0 !important;
        border-right: 0;
        direction: rtl;
      }

      .layer-dialog-container.layer-docked-right > * {
        direction: ltr;
      }

      body.layer-manager-docked-right #compass {
        right: calc(var(--layer-manager-dock-width, 320px) + 20px) !important;
      }

      .layer-dialog-container.layer-dock-collapsed {
        width: 52px !important;
        min-width: 52px;
        max-width: 52px;
        padding: 12px 8px;
        resize: none;
      }

      .layer-dialog-container.layer-dock-collapsed .layer-dialog-title,
      .layer-dialog-container.layer-dock-collapsed .layer-dialog-tabs,
      .layer-dialog-container.layer-dock-collapsed .layer-tab-panels,
      .layer-dialog-container.layer-dock-collapsed .layer-dialog-body,
      .layer-dialog-container.layer-dock-collapsed .layer-dialog-close {
        display: none;
      }

      .layer-dialog-container.layer-dock-collapsed .layer-dialog-header {
        justify-content: center;
        border-bottom: 0;
        margin: 0;
        padding: 0;
      }

      .layer-dialog-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .layer-dialog-dock,
      .layer-dialog-collapse {
        background: #4b5563;
        border: 1px solid #6b7280;
        color: #e5e7eb;
        width: 26px;
        height: 26px;
        padding: 0;
        border-radius: 6px;
        cursor: pointer;
      }

      .layer-dialog-dock:hover,
      .layer-dialog-collapse:hover {
        color: #0284c7;
        border-color: #38bdf8;
        background:#e0f2fe;
      }

      /* 우측 하단 크기 조절 영역 표시 */
      .layer-dialog-container::after {
        content: '';
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 10px;
        height: 10px;
        pointer-events: none;
        opacity: 0.55;
        background:
          linear-gradient(135deg, transparent 45%, #94a3b8 46%, #94a3b8 54%, transparent 55%) 4px 4px / 6px 6px no-repeat,
          linear-gradient(135deg, transparent 45%, #94a3b8 46%, #94a3b8 54%, transparent 55%) 0 0 / 10px 10px no-repeat;
      }

      .layer-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        margin-bottom: 12px;
        border-bottom:1px solid #6b7280;
        cursor: move;
      }

      .layer-dialog-title {
        color: #f9fafb;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.3px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .layer-dialog-close {
        background: #4b5563;
        border:1px solid #6b7280;
        color: #e5e7eb;
        width: 26px;
        height: 26px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        transition: all 0.2s ease;
      }

      .layer-dialog-close:hover {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.4);
        color: #f87171;
      }

      .layer-dialog-tabs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; margin-bottom:10px; padding:4px; border:1px solid #6b7280; border-radius:8px; background:#1f2937; }
      .layer-dialog-tab { min-width:0; padding:8px 4px; border:1px solid transparent; border-radius:6px; background:transparent; color:#d1d5db; font-size:12px; cursor:pointer; white-space:nowrap; }
      .layer-dialog-tab:hover { color:#fff; background:#4b5563; }
      .layer-dialog-tab.active { color:#fff; border-color:#7dd3fc; background:#0369a1; font-weight:600; }
      .layer-tab-panels { flex:1; min-height:0; display:flex; }
      .layer-tab-panel { display:none; flex:1; min-width:0; min-height:0; }
      .layer-tab-panel.active { display:flex; flex-direction:column; }

      .layer-dialog-body {
        flex: 1;
        background:#fff;
        border:1px solid #d7dee8;
        border-radius: 8px;
        padding: 12px 8px;
        overflow-y: auto;
      }

      [data-tab-panel="map"] {
        background:#fff;
        border-color:#d7dee8;
      }

      [data-tab-panel="map"] .layer-tree-list .layer-tree-list::before {
        background:#d7dee8;
      }

      [data-tab-panel="map"] .layer-node-content:hover {
        background:#f1f5f9;
      }

      [data-tab-panel="map"] .layer-label {
        color:#334155;
      }

      [data-tab-panel="map"] .layer-node-content:hover .layer-label {
        color:#0f172a;
      }

      [data-tab-panel="map"] .layer-expand-button {
        color:#64748b;
      }

      [data-tab-panel="map"] .layer-expand-button:hover {
        color:#0284c7;
      }

      [data-tab-panel="map"] .layer-checkbox {
        background:#fff;
        border-color:#94a3b8;
      }

      [data-tab-panel="map"] .layer-checkbox:hover {
        background:#e0f2fe;
        border-color:#0284c7;
      }

      [data-tab-panel="map"] .layer-checkbox:checked {
        background:#0284c7;
        border-color:#0284c7;
      }

      [data-tab-panel="opacity"] { overflow:hidden; }
      .layer-opacity-list { flex:0 0 auto; display:flex; flex-direction:column; gap:8px; margin-top:8px; }
      .drawing-list-box { flex:1; min-height:0; margin:0; padding:7px; overflow-y:auto; border:1px solid #d7dee8; border-radius:7px; background:#fff; }
      .drawing-list-tree { margin:0; padding:0; list-style:none; }
      .drawing-list-title { margin-bottom:7px; color:#1e293b; font-size:12px; font-weight:600; }
      .drawing-list-actions { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:7px; }
      .drawing-list-action { padding:6px; border:1px solid rgba(56,189,248,.3); border-radius:5px; background:rgba(2,132,199,.15); color:#bae6fd; font-size:11px; cursor:pointer; }
      .drawing-list-toolbar { flex:0 0 auto; display:flex; justify-content:flex-end; padding:0 2px 7px; }
      .drawing-master-toggle { display:flex; align-items:center; gap:6px; color:#f3f4f6; font-size:12px; cursor:pointer; }
      .drawing-master-toggle input { accent-color:#0284c7; }
      .drawing-header-checkbox { margin:0; accent-color:#0284c7; cursor:pointer; }
      .drawing-list-header, .drawing-visibility-item { display:grid; grid-template-columns:42px 54px minmax(0,1fr) 88px; align-items:stretch; gap:0; }
      .drawing-list-header { position:sticky; top:-7px; z-index:1; margin:-7px -7px 0; border-bottom:1px solid #374151; background:#4b5563; color:#f9fafb; font-size:11px; font-weight:600; }
      .drawing-list-header > *, .drawing-visibility-item > * { display:flex; align-items:center; min-width:0; padding:7px 8px; box-sizing:border-box; }
      .drawing-list-header > * { justify-content:center; text-align:center; }
      .drawing-list-header > *:not(:last-child) { border-right:1px solid #6b7280; }
      .drawing-visibility-item > *:not(:last-child) { border-right:1px solid #cbd5e1; }
      .drawing-list-header > :first-child, .drawing-list-header > :nth-child(2), .drawing-visibility-item > :first-child, .drawing-visibility-item > :nth-child(2) { justify-content:center; }
      .drawing-visibility-item, .military-visibility-item { cursor:grab; transition:opacity .12s, box-shadow .12s, transform .12s; }
      .drawing-visibility-item:active, .military-visibility-item:active { cursor:grabbing; }
      .drawing-visibility-item.layer-row-dragging, .military-visibility-item.layer-row-dragging { opacity:.45; box-shadow:inset 3px 0 #2563eb; }
      .drawing-visibility-cell { display:flex; align-items:center; justify-content:center; width:100%; height:100%; padding:0 !important; }
      .drawing-visibility-item { border-bottom:1px solid #e2e8f0; color:#334155; font-size:12px; }
      .drawing-visibility-item:last-child { border-bottom:0; }
      .drawing-visibility-item:hover { background:#f1f5f9; }
      .drawing-visibility-item input { margin:0; accent-color:#38bdf8; }
      .drawing-rotation-cell { justify-content:center; }
      .drawing-rotation-input { width:68px; box-sizing:border-box; padding:4px 5px; border:1px solid #cbd5e1; border-radius:4px; color:#1e293b; text-align:right; }
      .drawing-row-number { color:#64748b; text-align:center; }
      .layer-opacity-item { padding:9px; border:1px solid #dbe3ec; border-radius:7px; background:#f8fafc; }
      .layer-opacity-header { display:flex; justify-content:space-between; gap:8px; margin-bottom:7px; color:#334155; font-size:12px; }
      .layer-opacity-slider { width:100%; accent-color:#38bdf8; }
      .layer-empty-message { padding:20px 10px; color:#94a3b8; font-size:12px; text-align:center; }
      [data-tab-panel="military"] { overflow:hidden; }
      .military-symbol-list-host { flex:1; min-height:0; display:flex; flex-direction:column; }
      .military-list-box { flex:1; min-width:0; min-height:0; padding:7px; overflow-x:auto; overflow-y:auto; scrollbar-gutter:stable; scrollbar-width:thin; border:1px solid #d7dee8; border-radius:7px; background:#fff; }
      .military-list-header, .military-list-box > .drawing-list-tree { min-width:560px; }
      .military-list-header, .military-visibility-item { display:grid; grid-template-columns:42px 46px minmax(90px,1fr) minmax(110px,1.25fr) 88px 88px; align-items:stretch; gap:0; }
      .military-list-header { position:sticky; top:-7px; z-index:1; margin:-7px -7px 0; border-bottom:1px solid #374151; background:#4b5563; color:#f9fafb; font-size:11px; font-weight:600; }
      .military-list-header > *, .military-visibility-item > * { display:flex; align-items:center; min-width:0; padding:7px 8px; box-sizing:border-box; }
      .military-list-header > * { justify-content:center; text-align:center; }
      .military-list-header > *:not(:last-child) { border-right:1px solid #6b7280; }
      .military-visibility-item > *:not(:last-child) { border-right:1px solid #cbd5e1; }
      .military-list-header > :first-child, .military-list-header > :nth-child(2), .military-visibility-item > :first-child, .military-visibility-item > :nth-child(2) { justify-content:center; }
      .military-visibility-item { border-bottom:1px solid #e2e8f0; color:#334155; font-size:12px; }
      .military-visibility-item:last-child { border-bottom:0; }
      .military-visibility-item:hover { background:#f1f5f9; }
      .military-visibility-item input { margin:0; accent-color:#38bdf8; }
      .military-code { overflow:hidden; color:#475569; font-family:monospace; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
      .military-coordinate { justify-content:flex-end; color:#334155; font-family:monospace; font-size:11px; white-space:nowrap; }
      .military-list-box::-webkit-scrollbar { width:9px; height:9px; }
      .military-list-box::-webkit-scrollbar-track { background:#e5e7eb; border-radius:5px; }
      .military-list-box::-webkit-scrollbar-thumb { background:#94a3b8; border:2px solid #e5e7eb; border-radius:5px; }
      .military-list-box::-webkit-scrollbar-thumb:hover { background:#64748b; }
      .drawing-visibility-item.context-selected, .military-visibility-item.context-selected { background:#dbeafe; }
      .layer-context-menu { position:fixed; z-index:10050; width:154px; padding:5px; border:1px solid #6b7280; border-radius:6px; background:#374151; box-shadow:0 8px 24px rgba(0,0,0,.32); }
      .layer-context-menu button { display:block; width:100%; padding:7px 10px; border:0; border-radius:4px; background:transparent; color:#f9fafb; font-size:12px; text-align:left; cursor:pointer; }
      .layer-context-menu button:hover { background:#4b5563; }
      .layer-context-menu button.danger { color:#fca5a5; }
      .layer-context-menu button.danger:hover { background:#7f1d1d; color:#fff; }
      .layer-context-menu button:disabled { background:transparent; color:#6b7280; cursor:not-allowed; }
      .layer-context-menu button:disabled:hover { background:transparent; color:#6b7280; }
      .layer-context-separator { height:1px; margin:4px 3px; background:#6b7280; }

      .layer-dialog-body::-webkit-scrollbar {
        width: 6px;
      }

      .layer-dialog-body::-webkit-scrollbar-thumb {
        background:#cbd5e1;
        border-radius: 3px;
      }

      .layer-dialog-body::-webkit-scrollbar-thumb:hover {
        background:#94a3b8;
      }

      .layer-tree-list {
        list-style: none;
        margin: 0;
        padding-left: 0;
      }

      .layer-tree-list .layer-tree-list {
        padding-left: 20px;
        position: relative;
      }

      .layer-tree-list .layer-tree-list::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 2px;
        bottom: 6px;
        width: 1px;
        background: rgba(255, 255, 255, 0.08);
      }

      .layer-tree-item {
        margin-bottom: 2px;
      }

      .layer-node-content {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 6px;
        transition: background 0.15s ease;
      }

      .layer-node-content:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .layer-expand-button,
      .layer-expand-spacer {
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
      }

      .layer-expand-button {
        padding: 0;
        border: 0;
        background: transparent;
        color: #94a3b8;
        font-size: 11px;
        line-height: 16px;
        text-align: center;
        cursor: pointer;
        transition: color 0.15s ease, transform 0.15s ease;
      }

      .layer-expand-button:hover {
        color: #38bdf8;
      }

      .layer-expand-button[aria-expanded="false"] {
        transform: rotate(-90deg);
      }

      .layer-tree-children[hidden] {
        display: none;
      }

      .layer-checkbox {
        appearance: none;
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        background: rgba(255, 255, 255, 0.08);
        border:
          1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        cursor: pointer;
        position: relative;
        flex-shrink: 0;
        margin: 0;
        transition:
          all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .layer-checkbox:hover {
        border-color: #38bdf8;
        background: rgba(56, 189, 248, 0.1);
      }

      .layer-checkbox:checked {
        background: #0284c7;
        border-color: #38bdf8;
        box-shadow:
          0 0 8px rgba(56, 189, 248, 0.4);
      }

      .layer-checkbox:checked::after {
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }

      .layer-label {
        font-size: 13px;
        color: #cbd5e1;
        cursor: pointer;
        letter-spacing: -0.2px;
        transition: color 0.15s ease;
      }

      .layer-node-content:hover .layer-label {
        color: #ffffff;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 레이어 관리 창 생성
   */
  function createDOM(title) {
    if (dialogContainer) {
      return;
    }

    dialogContainer = document.createElement('div');
    dialogContainer.className =
      'layer-dialog-container';
    dialogContainer.setAttribute('role', 'dialog');
    dialogContainer.setAttribute('aria-label', '레이어관리');

    const header = document.createElement('div');
    header.className = 'layer-dialog-header';

    const titleElement =
      document.createElement('div');

    titleElement.className =
      'layer-dialog-title';

    titleElement.innerHTML =
      `<span>🗺️</span> ` +
      '레이어관리';

    const closeButton =
      document.createElement('button');

    const actions = document.createElement('div');
    actions.className = 'layer-dialog-actions';

    const dockButton = document.createElement('button');
    dockButton.type = 'button';
    dockButton.className = 'layer-dialog-dock';
    dockButton.textContent = '▥';
    dockButton.title = '왼쪽 도킹 / 오른쪽 도킹 / 도킹 해제';
    dockButton.addEventListener('click', cycleDockPosition);

    const collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'layer-dialog-collapse';
    collapseButton.textContent = '◀';
    collapseButton.title = '도킹 바 접기/펼치기';
    collapseButton.addEventListener('click', toggleDockCollapsed);

    closeButton.className =
      'layer-dialog-close';

    closeButton.innerHTML = '&times;';
    closeButton.setAttribute(
      'aria-label',
      '레이어 관리 창 닫기'
    );

    closeButton.addEventListener(
      'click',
      close
    );

    actions.appendChild(dockButton);
    actions.appendChild(collapseButton);
    actions.appendChild(closeButton);
    header.appendChild(titleElement);
    header.appendChild(actions);

    const tabs = document.createElement('div');
    tabs.className = 'layer-dialog-tabs';

    const panels = document.createElement('div');
    panels.className = 'layer-tab-panels';

    const mapPanel = document.createElement('div');
    mapPanel.className = 'layer-tab-panel layer-dialog-body active';
    mapPanel.dataset.tabPanel = 'map';
    const mapTreeHost = document.createElement('div');
    mapPanel.appendChild(mapTreeHost);

    const opacityPanel = document.createElement('div');
    opacityPanel.className = 'layer-tab-panel layer-dialog-body';
    opacityPanel.dataset.tabPanel = 'opacity';

    const militaryPanel = document.createElement('div');
    militaryPanel.className = 'layer-tab-panel layer-dialog-body';
    militaryPanel.dataset.tabPanel = 'military';

    const militaryListHost = document.createElement('div');
    militaryListHost.className = 'military-symbol-list-host';

    militaryPanel.appendChild(militaryListHost);

    [
      ['map', '지도레이어관리'],
      ['opacity', '투명도관리'],
      ['military', '군대부호관리']
    ].forEach(([tabId, label], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `layer-dialog-tab${index === 0 ? ' active' : ''}`;
      button.dataset.tab = tabId;
      button.textContent = label;
      button.addEventListener('click', () => activateMainTab(tabId));
      tabs.appendChild(button);
    });

    panels.appendChild(mapPanel);
    panels.appendChild(opacityPanel);
    panels.appendChild(militaryPanel);

    dialogContainer.appendChild(header);
    dialogContainer.appendChild(tabs);
    dialogContainer.appendChild(panels);

    if (window.Vue) vueTreeVm = mountVueLayerTree(mapTreeHost);
    else mapTreeHost.replaceWith(renderTree(layersData));

    makeDraggable(header, dialogContainer);

    if (window.ResizeObserver) {
      dialogResizeObserver = new ResizeObserver(() => {
        const width = dialogContainer?.getBoundingClientRect().width || 0;
        if (!isDockCollapsed && width >= 120) lastExpandedWidth = width;
        if (!dockPosition && !isDockCollapsed) {
          const height = dialogContainer?.getBoundingClientRect().height || 0;
          if (height >= 240) lastFloatingHeight = height;
        }
        syncCompassWithDock();
        document.dispatchEvent(new CustomEvent('layer-dock-layout-changed'));
      });
      dialogResizeObserver.observe(dialogContainer);
    }

    // 레이어관리는 최초 생성부터 왼쪽 도킹 상태로 표시한다.
    // 일반 다이얼로그는 DialogCollisionManager가 이 영역을 제외해 배치한다.
    setDockPosition('left');

    if (!drawingListenerBound) {
      ['drawing-entity-added', 'drawing-entity-updated', 'drawing-entity-removed'].forEach(eventName => {
        document.addEventListener(eventName, scheduleOpacityListRefresh);
      });
      window.CesiumViewer?.entities?.collectionChanged?.addEventListener(
        (collection, added, removed) => {
          if (isBulkObjectMutation) return;
          const drawingChanged = [...added, ...removed].some(entity =>
            entity.customData?.drawingType
          );
          if (drawingChanged) scheduleOpacityListRefresh();
        }
      );
      drawingListenerBound = true;
    }
    setupMilitarySymbolDropHandler();
  }

  function activateMainTab(tabId) {
    if (!dialogContainer) return;
    dialogContainer.querySelectorAll('.layer-dialog-tab').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabId);
    });
    dialogContainer.querySelectorAll('.layer-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.tabPanel === tabId);
    });
    if (tabId === 'opacity') renderOpacityPanel();
    if (tabId === 'military') renderMilitarySymbolList();
  }

  function setupMilitarySymbolDropHandler() {
    const viewer = window.CesiumViewer;
    if (militaryDropBound || !viewer?.container) return;

    viewer.container.addEventListener('dragover', event => event.preventDefault());
    viewer.container.addEventListener('drop', event => {
      event.preventDefault();
      const sidc = event.dataTransfer.getData('text/plain').trim();
      if (!sidc || !/^[A-Z0-9*\-]{10,30}$/i.test(sidc)) return;

      const rect = viewer.container.getBoundingClientRect();
      const windowPosition = new Cesium.Cartesian2(
        event.clientX - rect.left,
        event.clientY - rect.top
      );
      const position = viewer.scene.pickPosition(windowPosition) ||
        viewer.camera.pickEllipsoid(windowPosition, viewer.scene.globe.ellipsoid);
      if (!Cesium.defined(position)) return;

      try {
        const symbol = new ms.Symbol(sidc, { size: 50 });
        const entity = viewer.entities.add({
          name: `군대부호 ${++militarySymbolSequence}`,
          position,
          billboard: {
            image: symbol.asCanvas(),
            width: 50,
            height: 50 * (symbol.baseHeight / symbol.baseWidth),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        entity.customData = { militarySymbol: true, sidc };
        document.dispatchEvent(new CustomEvent('military-symbol-added', {
          detail: { entity }
        }));
      } catch (error) {
        console.error('[LayerManager] 군대부호 생성 실패:', error);
      }
    });

    document.addEventListener('military-symbol-added', event => {
      const entity = event.detail?.entity;
      if (entity?.billboard) ensureMilitaryRenderLayer(entity, viewer);
      if (dialogContainer?.querySelector('[data-tab-panel="military"].active')) {
        renderMilitarySymbolList();
      }
    });
    viewer.entities.collectionChanged.addEventListener((collection, added, removed) => {
      if (isBulkObjectMutation) return;
      const changed = [...added, ...removed].some(entity =>
        entity.customData?.source === 'unifiedControlPanel' || entity.customData?.militarySymbol
      );
      if (changed && dialogContainer?.querySelector('[data-tab-panel="military"].active')) {
        renderMilitarySymbolList();
      }
    });
    militaryDropBound = true;
  }

  function renderMilitarySymbolList() {
    const host = dialogContainer?.querySelector('.military-symbol-list-host');
    const viewer = window.CesiumViewer;
    if (!host || !viewer) return;
    host.replaceChildren();

    const symbols = sortManagedEntities([...new Map(viewer.entities.values
      .filter(entity =>
        (entity.customData?.source === 'unifiedControlPanel' || entity.customData?.militarySymbol) &&
        (entity.customData?.isMilitaryGroup || !entity.customData?.groupId)
      )
      .map(entity => [entity.id, entity])).values()]);
    symbols.forEach(entity => {
      if (entity.billboard) ensureMilitaryRenderLayer(entity, viewer);
      (entity.customData?.groupMembers || []).forEach(member => { if (member.billboard) ensureMilitaryRenderLayer(member, viewer); });
    });

    const setMilitaryVisible = (entity, visible) => {
      entity.show = visible;
      if (entity.customData?.isMilitaryGroup) {
        (entity.customData.groupMembers || []).forEach(member => setMilitaryVisible(member, visible));
      }
    };

    if (window.Vue) {
      destroyVueVm(vueMilitaryVm);
      const vueHost = document.createElement('div');
      vueHost.className = 'military-symbol-list-host';
      host.appendChild(vueHost);
      vueMilitaryVm = mountVueObjectTree(vueHost, symbols, 'military', (entity, visible) => {
        setMilitaryVisible(entity, visible);
      });
      return;
    }

    const masterCheckbox = document.createElement('input');
    masterCheckbox.type = 'checkbox';
    masterCheckbox.className = 'drawing-header-checkbox';
    masterCheckbox.title = '전체 선택/해제';
    masterCheckbox.setAttribute('aria-label', '전체 선택/해제');

    const box = document.createElement('div');
    box.className = 'military-list-box';
    const header = document.createElement('div');
    header.className = 'military-list-header';
    const visibleHeader = document.createElement('span');
    visibleHeader.appendChild(masterCheckbox);
    header.appendChild(visibleHeader);
    ['번호', '이름', '코드', '경도', '위도'].forEach(label => {
      const cell = document.createElement('span');
      cell.textContent = label;
      header.appendChild(cell);
    });
    box.appendChild(header);

    const tree = document.createElement('ul');
    tree.className = 'drawing-list-tree';
    tree.setAttribute('role', 'tree');
    tree.setAttribute('aria-label', '군대부호 객체 트리');
    box.appendChild(tree);

    const items = [];
    symbols.forEach((entity, index) => {
      const row = document.createElement('li');
      row.className = 'military-visibility-item';
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-label', entity.customData.displayName || entity.name || `객체 ${index + 1}`);
      row.title = '더블클릭하여 객체 위치로 이동';
      row.addEventListener('dblclick', event => {
        if (event.target.closest('input, button')) return;
        checkbox.checked = true;
        entity.show = true;
        updateMasterCheckbox();
        flyToManagedEntity(entity);
      });
      row.addEventListener('click', event => {
        if (event.target.closest('input, button') || !entity.customData?.isMilitaryGroup) return;
        viewer.selectedEntity = undefined;
        window.setTimeout(() => { viewer.selectedEntity = entity; }, 0);
      });
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = entity.show !== false;
      checkbox.addEventListener('change', () => {
        setMilitaryVisible(entity, checkbox.checked);
        updateMasterCheckbox();
      });
      const checkboxCell = document.createElement('span');
      checkboxCell.className = 'drawing-visibility-cell';
      checkboxCell.appendChild(checkbox);
      const number = document.createElement('span');
      number.className = 'drawing-row-number';
      number.textContent = String(index + 1);
      const name = document.createElement('span');
      name.textContent = entity.customData.displayName || entity.name || `객체 ${index + 1}`;
      const code = document.createElement('span');
      code.className = 'military-code';
      code.textContent = entity.customData.sidc || entity.customData.shape || '-';
      code.title = code.textContent;
      const coordinates = militaryCoordinates(entity);
      const longitude = document.createElement('span');
      longitude.className = 'military-coordinate';
      longitude.textContent = coordinates.longitude;
      const latitude = document.createElement('span');
      latitude.className = 'military-coordinate';
      latitude.textContent = coordinates.latitude;
      row.appendChild(checkboxCell);
      row.appendChild(number);
      row.appendChild(name);
      row.appendChild(code);
      row.appendChild(longitude);
      row.appendChild(latitude);
      tree.appendChild(row);
      items.push({ entity, checkbox, row });
    });

    function updateMasterCheckbox() {
      const selectedCount = items.filter(item => item.checkbox.checked).length;
      masterCheckbox.checked = items.length > 0 && selectedCount === items.length;
      masterCheckbox.indeterminate = selectedCount > 0 && selectedCount < items.length;
    }

    masterCheckbox.addEventListener('change', () => {
      items.forEach(item => {
        item.checkbox.checked = masterCheckbox.checked;
        setMilitaryVisible(item.entity, masterCheckbox.checked);
      });
      masterCheckbox.indeterminate = false;
    });

    updateMasterCheckbox();
    installNativeRowSorting(tree, items);
    host.appendChild(box);
  }

  function renderOpacityPanel() {
    if (!dialogContainer) return;
    const panel = dialogContainer.querySelector('[data-tab-panel="opacity"]');
    const viewer = window.CesiumViewer;
    if (!panel) return;
    panel.replaceChildren();

    const list = document.createElement('div');
    list.className = 'layer-opacity-list';
    const controls = [];

    renderDrawingVisibilityList(panel, viewer);

    if (viewer?.imageryLayers) {
      // 0번은 Cesium 기본 영상 레이어(영상 레이어 1)이므로 투명도 관리에서 제외한다.
      for (let i = 1; i < viewer.imageryLayers.length; i += 1) {
        const layer = viewer.imageryLayers.get(i);
        controls.push({
          name: layer._rasterInfo?.name || layer.imageryProvider?.layers || `영상 레이어 ${i + 1}`,
          value: Number(layer.alpha ?? 1),
          setValue: value => { layer.alpha = value; }
        });
      }
    }

    if (viewer?.dataSources) {
      for (let i = 0; i < viewer.dataSources.length; i += 1) {
        const source = viewer.dataSources.get(i);
        controls.push({
          name: source.name || `벡터 레이어 ${i + 1}`,
          value: Number(source._layerOpacity ?? 1),
          setValue: value => setDataSourceOpacity(source, value)
        });
      }
    }

    if (!controls.length) return;

    controls.forEach(control => {
      const item = document.createElement('div');
      item.className = 'layer-opacity-item';
      const header = document.createElement('div');
      header.className = 'layer-opacity-header';
      const name = document.createElement('span');
      name.textContent = control.name;
      const valueLabel = document.createElement('span');
      valueLabel.textContent = `${Math.round(control.value * 100)}%`;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'layer-opacity-slider';
      slider.min = '0'; slider.max = '100'; slider.step = '1';
      slider.value = String(Math.round(control.value * 100));
      slider.addEventListener('input', () => {
        const value = Number(slider.value) / 100;
        valueLabel.textContent = `${slider.value}%`;
        control.setValue(value);
      });
      header.appendChild(name); header.appendChild(valueLabel);
      item.appendChild(header); item.appendChild(slider); list.appendChild(item);
    });
    panel.appendChild(list);
  }

  function renderDrawingVisibilityList(panel, viewer) {
    const drawings = sortManagedEntities([...new Map((viewer?.entities?.values || [])
      .filter(entity => entity.customData?.drawingType && (entity.customData.isDrawingGroup || !entity.customData.groupId))
      .map(entity => [entity.id, entity])).values()]);

    const setDrawingVisible = (entity, visible) => {
      entity.show = visible;
      if (!visible && viewer.selectedEntity === entity) viewer.selectedEntity = undefined;
      if (entity.customData?.isDrawingGroup) {
        (entity.customData.groupMembers || []).forEach(member => setDrawingVisible(member, visible));
        return;
      }
      (entity.customData?.subEntities || []).forEach(subEntity => {
        subEntity.show = visible;
      });
    };

    if (window.Vue) {
      destroyVueVm(vueOpacityVm);
      const vueHost = document.createElement('div');
      vueHost.className = 'vue-object-tree-host';
      panel.appendChild(vueHost);
      vueOpacityVm = mountVueObjectTree(vueHost, drawings, 'drawing', setDrawingVisible);
      return;
    }

    const box = document.createElement('div');
    box.className = 'drawing-list-box';

    const masterCheckbox = document.createElement('input');
    masterCheckbox.type = 'checkbox';
    masterCheckbox.className = 'drawing-header-checkbox';
    masterCheckbox.title = '전체 선택/해제';
    masterCheckbox.setAttribute('aria-label', '전체 선택/해제');

    const header = document.createElement('div');
    header.className = 'drawing-list-header';
    const visibleHeader = document.createElement('span');
    visibleHeader.appendChild(masterCheckbox);
    const numberHeader = document.createElement('span');
    numberHeader.textContent = '번호';
    const nameHeader = document.createElement('span');
    nameHeader.textContent = '이름';
    const rotationHeader = document.createElement('span');
    rotationHeader.textContent = '회전각(°)';
    header.appendChild(visibleHeader);
    header.appendChild(numberHeader);
    header.appendChild(nameHeader);
    header.appendChild(rotationHeader);
    box.appendChild(header);

    const tree = document.createElement('ul');
    tree.className = 'drawing-list-tree';
    tree.setAttribute('role', 'tree');
    tree.setAttribute('aria-label', '작도 객체 트리');
    box.appendChild(tree);

    const checkboxes = [];
    drawings.forEach((entity, index) => {
      const row = document.createElement('li');
      row.className = 'drawing-visibility-item';
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-label', entity.name || `도형 ${index + 1}`);
      row.title = '더블클릭하여 객체 위치로 이동';
      row.addEventListener('dblclick', event => {
        if (event.target.closest('input, button')) return;
        checkbox.checked = true;
        setDrawingVisible(entity, true);
        updateMasterCheckbox();
        flyToManagedEntity(entity);
      });
      row.addEventListener('click', event => {
        if (event.target.closest('input, button') || !entity.customData?.isDrawingGroup) return;
        viewer.selectedEntity = undefined;
        window.setTimeout(() => { viewer.selectedEntity = entity; }, 0);
      });
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = entity.show !== false;
      checkbox.addEventListener('change', () => {
        setDrawingVisible(entity, checkbox.checked);
        updateMasterCheckbox();
      });
      const checkboxCell = document.createElement('span');
      checkboxCell.className = 'drawing-visibility-cell';
      checkboxCell.appendChild(checkbox);
      const number = document.createElement('span');
      number.className = 'drawing-row-number';
      number.textContent = String(index + 1);
      const name = document.createElement('span');
      name.textContent = entity.name || `도형 ${index + 1}`;
      const rotationCell = document.createElement('span');
      rotationCell.className = 'drawing-rotation-cell';
      const rotationInput = document.createElement('input');
      rotationInput.className = 'drawing-rotation-input';
      rotationInput.type = 'number';
      rotationInput.min = '-360'; rotationInput.max = '360'; rotationInput.step = '1';
      rotationInput.value = String(normalizeRotationDegrees(entity.customData?.rotationDegrees || 0));
      rotationInput.title = '-360~360도 회전각 (양수: 시계방향, 음수: 반시계방향)';
      rotationInput.addEventListener('change', () => {
        const applied = applyDrawingRotation(entity, rotationInput.value);
        rotationInput.value = String(applied);
      });
      rotationCell.appendChild(rotationInput);
      row.appendChild(checkboxCell);
      row.appendChild(number);
      row.appendChild(name);
      row.appendChild(rotationCell);
      tree.appendChild(row);
      checkboxes.push({ checkbox, entity, row });
    });

    function updateMasterCheckbox() {
      const selectedCount = checkboxes.filter(item => item.checkbox.checked).length;
      masterCheckbox.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
      masterCheckbox.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
    }

    masterCheckbox.addEventListener('change', () => {
      checkboxes.forEach(item => {
        item.checkbox.checked = masterCheckbox.checked;
        setDrawingVisible(item.entity, masterCheckbox.checked);
      });
      masterCheckbox.indeterminate = false;
    });

    updateMasterCheckbox();
    installNativeRowSorting(tree, checkboxes);
    panel.appendChild(box);
  }

  function setDataSourceOpacity(dataSource, alpha) {
    dataSource._layerOpacity = alpha;
    const time = window.Cesium?.JulianDate?.now();
    dataSource.entities.values.forEach(entity => {
      ['polygon', 'polyline', 'point', 'billboard', 'label'].forEach(type => {
        const graphic = entity[type];
        if (!graphic) return;
        ['material', 'color', 'fillColor', 'outlineColor'].forEach(propertyName => {
          const property = graphic[propertyName];
          if (!property?.getValue) return;
          const current = property.getValue(time);
          if (current?.withAlpha) graphic[propertyName] = current.withAlpha(alpha);
        });
      });
    });
  }

  function saveFloatingBounds() {
    if (!dialogContainer || dockPosition) return;
    const measuredWidth = dialogContainer.offsetWidth;
    const measuredHeight = dialogContainer.offsetHeight;
    if (!isDockCollapsed && measuredWidth >= 120) lastExpandedWidth = measuredWidth;
    if (!isDockCollapsed && measuredHeight >= 240) lastFloatingHeight = measuredHeight;
    floatingBounds = {
      left: dialogContainer.offsetLeft,
      top: dialogContainer.offsetTop,
      width: measuredWidth >= 120 ? measuredWidth : lastExpandedWidth,
      height: measuredHeight >= 240 ? measuredHeight : lastFloatingHeight
    };
  }

  function syncCompassWithDock() {
    const isRightDocked = dockPosition === 'right' && dialogContainer?.isConnected;
    document.body.classList.toggle('layer-manager-docked-right', isRightDocked);

    if (!isRightDocked) {
      document.documentElement.style.removeProperty('--layer-manager-dock-width');
      return;
    }

    const dockWidth = dialogContainer.getBoundingClientRect().width;
    document.documentElement.style.setProperty('--layer-manager-dock-width', `${dockWidth}px`);
  }

  function setDockPosition(position) {
    if (!dialogContainer) return;
    if (!dockPosition && position) saveFloatingBounds();

    const wasCollapsed = isDockCollapsed || dialogContainer.classList.contains('layer-dock-collapsed');
    const currentWidth = dialogContainer.getBoundingClientRect().width;
    if (!wasCollapsed && currentWidth >= 120) lastExpandedWidth = currentWidth;

    dockPosition = position;
    isDockCollapsed = false;
    dialogContainer.classList.remove(
      'layer-docked', 'layer-docked-left', 'layer-docked-right', 'layer-dock-collapsed'
    );
    dialogContainer.style.right = '';

    if (position) {
      dialogContainer.classList.add('layer-docked', `layer-docked-${position}`);
      // 도킹 CSS의 top/bottom이 화면 전체 높이를 결정하게 한다.
      dialogContainer.style.height = '';
      dialogContainer.style.maxHeight = '';
      dialogContainer.style.bottom = '0px';
      if (wasCollapsed || dialogContainer.getBoundingClientRect().width < 120) {
        dialogContainer.style.width = `${lastExpandedWidth}px`;
      }
    } else if (floatingBounds) {
      dialogContainer.style.bottom = '';
      dialogContainer.style.left = `${floatingBounds.left}px`;
      dialogContainer.style.top = `${floatingBounds.top}px`;
      dialogContainer.style.width = `${Math.max(120, floatingBounds.width || lastExpandedWidth)}px`;
      dialogContainer.style.height = `${Math.max(240, floatingBounds.height || lastFloatingHeight)}px`;
      dialogContainer.style.maxHeight = '';
    }

    updateDockButtons();
    requestAnimationFrame(syncCompassWithDock);
    document.dispatchEvent(new CustomEvent('layer-dock-layout-changed', {
      detail: { position: dockPosition, collapsed: isDockCollapsed }
    }));
  }

  function cycleDockPosition() {
    // 버튼은 좌/우 도킹만 전환한다. 부동 창 전환은 제목줄 드래그로 수행한다.
    setDockPosition(dockPosition === 'left' ? 'right' : 'left');
  }

  function toggleDockCollapsed() {
    if (!dockPosition) setDockPosition('left');
    if (!isDockCollapsed) {
      const width = dialogContainer?.getBoundingClientRect().width || 0;
      if (width >= 120) lastExpandedWidth = width;
    }
    isDockCollapsed = !isDockCollapsed;
    dialogContainer.classList.toggle('layer-dock-collapsed', isDockCollapsed);
    updateDockButtons();
    requestAnimationFrame(syncCompassWithDock);
    document.dispatchEvent(new CustomEvent('layer-dock-layout-changed', {
      detail: { position: dockPosition, collapsed: isDockCollapsed }
    }));
  }

  function updateDockButtons() {
    if (!dialogContainer) return;
    const dockButton = dialogContainer.querySelector('.layer-dialog-dock');
    const collapseButton = dialogContainer.querySelector('.layer-dialog-collapse');
    if (dockButton) dockButton.textContent = dockPosition === 'left' ? '▤' : dockPosition === 'right' ? '▥' : '▥';
    if (collapseButton) {
      collapseButton.textContent = isDockCollapsed
        ? (dockPosition === 'right' ? '◀' : '▶')
        : (dockPosition === 'right' ? '▶' : '◀');
    }
  }

  /**
   * 트리 렌더링
   */
  function renderTree(nodes) {
    const ul = document.createElement('ul');
    ul.className = 'layer-tree-list';

    nodes.forEach((node) => {
      const li = document.createElement('li');
      li.className = 'layer-tree-item';

      const content =
        document.createElement('div');

      content.className = 'layer-node-content';

      const hasChildren = Boolean(
        node.children && node.children.length > 0
      );

      let expandButton = null;

      if (hasChildren) {
        expandButton = document.createElement('button');
        expandButton.type = 'button';
        expandButton.className = 'layer-expand-button';
        expandButton.textContent = '▼';
        expandButton.setAttribute(
          'aria-expanded',
          node.expanded === false ? 'false' : 'true'
        );
        expandButton.setAttribute(
          'aria-label',
          `${node.name || '레이어'} ${node.expanded === false ? '펼치기' : '접기'}`
        );
        content.appendChild(expandButton);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'layer-expand-spacer';
        content.appendChild(spacer);
      }

      const checkbox =
        document.createElement('input');

      checkbox.type = 'checkbox';
      checkbox.className = 'layer-checkbox';
      checkbox.id = `chk_${node.id}`;
      checkbox.checked = Boolean(node.checked);

      checkbox.addEventListener(
        'change',
        (event) => {
          const isChecked =
            event.target.checked;

          node.checked = isChecked;

          toggleChildren(node, isChecked);
          updateParentCheckboxes();
          handleBuiltInLayerChange(node, isChecked);

          if (onLayerChangeCallback) {
            onLayerChangeCallback(
              node,
              isChecked
            );
          }
        }
      );

      content.appendChild(checkbox);

      if (node.name) {
        const label =
          document.createElement('label');

        label.className = 'layer-label';
        label.htmlFor = `chk_${node.id}`;
        label.textContent = node.name;

        content.appendChild(label);
      }

      li.appendChild(content);

      if (hasChildren) {
        const childTree = renderTree(node.children);
        childTree.classList.add('layer-tree-children');
        childTree.hidden = node.expanded === false;

        expandButton.addEventListener('click', () => {
          const isExpanded = childTree.hidden;
          childTree.hidden = !isExpanded;
          node.expanded = isExpanded;

          expandButton.setAttribute(
            'aria-expanded',
            String(isExpanded)
          );
          expandButton.setAttribute(
            'aria-label',
            `${node.name || '레이어'} ${isExpanded ? '접기' : '펼치기'}`
          );
        });

        li.appendChild(childTree);
      }

      ul.appendChild(li);
    });

    return ul;
  }

  /**
   * 부모 체크 시 모든 하위 레이어 체크 상태 변경
   */
  function toggleChildren(parentNode, isChecked) {
    if (!parentNode.children) {
      return;
    }

    parentNode.children.forEach((child) => {
      child.checked = isChecked;
      child.indeterminate = false;

      const checkbox =
        document.getElementById(
          `chk_${child.id}`
        );

      if (checkbox) {
        checkbox.checked = isChecked;
        checkbox.indeterminate = false;
      }

      toggleChildren(child, isChecked);
    });
  }

  /**
   * 자식 레이어 변경 시 부모 체크 상태 갱신
   */
  function updateParentCheckboxes() {
    function updateNode(node) {
      if (
        !node.children ||
        node.children.length === 0
      ) {
        return {
          allChecked: Boolean(node.checked),
          someChecked: Boolean(node.checked)
        };
      }

      const childStates =
        node.children.map(updateNode);

      const allChecked =
        childStates.every(
          (state) => state.allChecked
        );

      const someChecked =
        childStates.some(
          (state) => state.someChecked
        );

      node.checked = allChecked;
      node.indeterminate = someChecked && !allChecked;

      const checkbox =
        document.getElementById(
          `chk_${node.id}`
        );

      if (checkbox) {
        checkbox.checked = allChecked;
        checkbox.indeterminate =
          someChecked && !allChecked;
      }

      return {
        allChecked: allChecked,
        someChecked: someChecked
      };
    }

    layersData.forEach(updateNode);
  }

  /**
   * 레이어 관리 창 드래그
   */
  function makeDraggable(
    dragHandle,
    targetElement
  ) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    dragHandle.addEventListener(
      'mousedown',
      (event) => {
        if (
          event.target.closest('button')
        ) {
          return;
        }

        if (dockPosition) {
          const pointerX = event.clientX;
          const pointerY = event.clientY;
          setDockPosition(null);
          targetElement.style.left = `${Math.max(0, pointerX - targetElement.offsetWidth / 2)}px`;
          targetElement.style.top = `${Math.max(0, pointerY - 18)}px`;
        }

        isDragging = true;

        offsetX =
          event.clientX -
          targetElement.offsetLeft;

        offsetY =
          event.clientY -
          targetElement.offsetTop;

        if (
          window.CesiumViewer &&
          window.CesiumViewer.scene
        ) {
          window.CesiumViewer
            .scene
            .screenSpaceCameraController
            .enableInputs = false;
        }

        document.addEventListener(
          'mousemove',
          onMouseMove
        );

        document.addEventListener(
          'mouseup',
          onMouseUp
        );
      }
    );

    function onMouseMove(event) {
      if (!isDragging) {
        return;
      }

      let x = event.clientX - offsetX;
      let y = event.clientY - offsetY;

      const maxX =
        window.innerWidth -
        targetElement.offsetWidth;

      const maxY =
        window.innerHeight -
        targetElement.offsetHeight;

      x = Math.max(
        0,
        Math.min(x, maxX)
      );

      y = Math.max(
        0,
        Math.min(y, maxY)
      );

      targetElement.style.left = `${x}px`;
      targetElement.style.top = `${y}px`;
    }

    function onMouseUp(event) {
      if (!isDragging) {
        return;
      }

      isDragging = false;

      const rect = targetElement.getBoundingClientRect();
      const snapDistance = 80;
      const pointerX = Number.isFinite(event?.clientX) ? event.clientX : rect.left;
      if (rect.left <= snapDistance || pointerX <= snapDistance) {
        setDockPosition('left');
      } else if (window.innerWidth - rect.right <= snapDistance || pointerX >= window.innerWidth - snapDistance) {
        setDockPosition('right');
      } else {
        saveFloatingBounds();
      }

      if (
        window.CesiumViewer &&
        window.CesiumViewer.scene
      ) {
        window.CesiumViewer
          .scene
          .screenSpaceCameraController
          .enableInputs = true;
      }

      document.removeEventListener(
        'mousemove',
        onMouseMove
      );

      document.removeEventListener(
        'mouseup',
        onMouseUp
      );
    }
  }

  /**
   * LayerManager 초기화
   */
  function init(options = {}) {
    injectStyles();

    if (options.layers) {
      layersData = options.layers;
    }

    if (options.onLayerChange) {
      onLayerChangeCallback =
        options.onLayerChange;
    }

    if (options.onXmlLoadError) {
      onXmlLoadErrorCallback =
        options.onXmlLoadError;
    }

    createDOM(options.title);

    if (options.xmlUrl) {
      loadFromXml(options.xmlUrl, {
        encoding:
          options.xmlEncoding || 'euc-kr'
      }).catch(() => {
        // 오류는 loadFromXml 내부에서 처리
      });
    } else if (options.loadDataFolder !== false) {
      loadFromDataFolder({
        dataPath: options.dataPath || '/data',
        xmlFiles: options.xmlFiles,
        encoding: options.xmlEncoding || 'euc-kr'
      }).catch(error => {
        console.error('[LayerManager] data 폴더 로딩 실패:', error);
        if (onXmlLoadErrorCallback) onXmlLoadErrorCallback(error);
      });
    }
  }

  /**
   * 창 열기/닫기
   */
  function toggle() {
    if (!dialogContainer) {
      init();
    }

    if (dialogContainer.parentNode) {
      close();
    } else {
      open();
    }
  }

  /**
   * 창 열기
   */
  function open() {
    if (!dialogContainer) {
      init();
    }

    if (!dialogContainer.parentNode) {
      document.body.appendChild(
        dialogContainer
      );
      requestAnimationFrame(syncCompassWithDock);
    }
  }

  /**
   * 창 닫기
   */
  function close() {
    if (
      dialogContainer &&
      dialogContainer.parentNode
    ) {
      dialogContainer.parentNode.removeChild(
        dialogContainer
      );
      syncCompassWithDock();
    }
  }

  return {
    init: init,
    open: open,
    close: close,
    toggle: toggle,
    dockLeft: () => setDockPosition('left'),
    dockRight: () => setDockPosition('right'),
    undock: () => setDockPosition(null),
    toggleDockCollapsed: toggleDockCollapsed,
    loadFromXml: loadFromXml,
    loadFromDataFolder: loadFromDataFolder,
    parseFdbLayers: parseFdbLayers
    ,moveEntitiesToTop: entities => moveEntitiesToEdge(entities, 'top')
    ,moveEntitiesToBottom: entities => moveEntitiesToEdge(entities, 'bottom')
  };
})();
