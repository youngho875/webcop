(function (global) {
    const viewer = global.CesiumViewer;
    const Cesium = global.Cesium;
    if (!viewer || !Cesium) return;

    let dragStart = null;
    let dragging = false;
    let selectedEntities = [];
    let selectedGroup = null;
    let groupSequence = 0;

    if (getComputedStyle(viewer.container).position === 'static') viewer.container.style.position = 'relative';
    const marquee = document.createElement('div');
    marquee.style.cssText = 'display:none;position:absolute;z-index:2147483000;pointer-events:none;box-sizing:border-box;border:2px dashed #22d3ee;background:rgba(34,211,238,.2);box-shadow:0 0 0 1px rgba(0,0,0,.8),inset 0 0 18px rgba(34,211,238,.22),0 0 12px rgba(34,211,238,.8);';
    const marqueeCount = document.createElement('span');
    marqueeCount.style.cssText = 'position:absolute;right:-2px;top:-25px;min-width:68px;padding:3px 7px;border-radius:4px 4px 0 0;background:#0891b2;color:#fff;font:700 12px sans-serif;text-align:center;white-space:nowrap;';
    marqueeCount.textContent = '0개 선택';
    marquee.appendChild(marqueeCount);
    viewer.container.appendChild(marquee);

    const contextMenu = document.createElement('div');
    contextMenu.style.cssText = 'display:none;position:absolute;z-index:1300;min-width:125px;padding:5px;border:1px solid #475569;border-radius:6px;background:#1f2937;box-shadow:0 8px 22px rgba(0,0,0,.45);';
    contextMenu.innerHTML = '<button data-action="edit">편집</button><button data-action="group">그룹</button><button data-action="ungroup">그룹해제</button><div class="drawing-layer-position"><button data-action="layer-position">레이어 위치 ▸</button><div class="drawing-layer-submenu"><button data-action="layer-top">맨 위</button><button data-action="layer-bottom">맨 아래</button></div></div>';
    contextMenu.querySelectorAll('button').forEach(button => { button.style.cssText = 'display:block;width:100%;padding:7px 12px;border:0;border-radius:4px;background:transparent;color:#fff;text-align:left;cursor:pointer;'; });
    const layerPosition = contextMenu.querySelector('.drawing-layer-position');
    const layerSubmenu = contextMenu.querySelector('.drawing-layer-submenu');
    layerPosition.style.cssText = 'position:relative;';
    layerSubmenu.style.cssText = 'display:none;position:absolute;left:100%;top:0;min-width:105px;padding:5px;border:1px solid #475569;border-radius:6px;background:#1f2937;box-shadow:0 8px 22px rgba(0,0,0,.45);';
    layerPosition.addEventListener('mouseenter', () => { layerSubmenu.style.display = 'block'; });
    layerPosition.addEventListener('mouseleave', () => { layerSubmenu.style.display = 'none'; });
    viewer.container.appendChild(contextMenu);

    const editorPanel = document.createElement('div');
    editorPanel.id = 'military-symbol-editor';
    editorPanel.dataset.allowMenuOverlap = 'true';
    editorPanel.style.cssText = 'display:none;position:fixed;right:20px;top:86px;z-index:2147483600;width:390px;max-height:calc(100vh - 110px);overflow:auto;box-sizing:border-box;padding:0;border:1px solid #475569;border-radius:10px;background:#f8fafc;color:#1f2937;box-shadow:0 16px 45px rgba(0,0,0,.42);font:13px sans-serif;';
    editorPanel.innerHTML = `
      <div data-editor-header style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:10px 13px;background:#1f2937;color:#fff;cursor:move;">
        <strong>군대부호 편집</strong>
        <button type="button" data-editor-close aria-label="닫기" style="border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer;">&times;</button>
      </div>
      <div style="padding:12px;">
        <div data-editor-preview style="height:105px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;border:1px solid #d5dbe3;border-radius:7px;background:#fff;"></div>
        <div style="display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:center;">
          <label for="mse-name">표시 이름</label><input id="mse-name" name="name" maxlength="80" />
          <label for="mse-sidc">2525C SIDC</label><input id="mse-sidc" name="sidc" maxlength="15" spellcheck="false" style="font-family:monospace;text-transform:uppercase;" />
          <label for="mse-symbol-type">육군 부대종류</label><select id="mse-symbol-type" name="symbolType"></select>
          <label for="mse-command">지휘 유형</label><select id="mse-command" name="commandModifier">
            <option value="-">일반 부대</option><option value="A">지휘소</option><option value="B">임무부대 지휘소</option>
            <option value="C">기만 지휘소</option><option value="D">기만 임무부대 지휘소</option><option value="E">임무부대</option>
            <option value="F">기만부대</option><option value="G">기만 임무부대</option>
          </select>
          <label for="mse-echelon">제대</label><select id="mse-echelon" name="echelon">
            <option value="-">미지정</option><option value="A">조/승무원</option><option value="B">분대</option>
            <option value="C">반</option><option value="D">소대/분견대</option><option value="E">중대/포대/기병중대</option>
            <option value="F">대대/비행대대</option><option value="G">연대/단</option><option value="H">여단</option>
            <option value="I">사단</option><option value="J">군단</option><option value="K">야전군</option>
            <option value="L">집단군</option><option value="M">지역/전구</option><option value="N">사령부</option>
          </select>
          <label for="mse-size">부호 크기</label><input id="mse-size" name="size" type="number" min="20" max="200" step="1" />
          <label for="mse-designation">고유명칭</label><input id="mse-designation" name="uniqueDesignation" maxlength="40" />
          <label for="mse-formation">상급부대</label><input id="mse-formation" name="higherFormation" maxlength="40" />
          <label for="mse-quantity">수량</label><input id="mse-quantity" name="quantity" type="number" min="0" max="999999" step="1" />
          <label for="mse-additional">추가정보</label><input id="mse-additional" name="additionalInformation" maxlength="80" />
          <label for="mse-comments">참모의견</label><input id="mse-comments" name="staffComments" maxlength="80" />
          <label for="mse-direction">방향(도)</label><input id="mse-direction" name="direction" type="number" min="0" max="359.99" step="0.1" />
          <span>표현 방식</span><div style="display:flex;gap:16px;"><label><input name="fill" type="checkbox" /> 채움</label><label><input name="frame" type="checkbox" /> 프레임</label></div>
        </div>
        <div data-editor-error style="min-height:18px;margin-top:8px;color:#c0392b;font-size:12px;"></div>
        <div style="display:flex;justify-content:flex-end;gap:7px;margin-top:5px;">
          <button type="button" data-editor-cancel style="padding:7px 13px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer;">취소</button>
          <button type="button" data-editor-apply style="padding:7px 13px;border:0;border-radius:5px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;">적용</button>
        </div>
      </div>`;
    editorPanel.querySelectorAll('input:not([type=checkbox])').forEach(input => {
        input.style.cssText += 'box-sizing:border-box;width:100%;padding:6px 7px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;color:#111827;';
    });
    editorPanel.querySelectorAll('select').forEach(select => {
        select.style.cssText = 'box-sizing:border-box;width:100%;padding:6px 7px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;color:#111827;';
    });
    document.body.appendChild(editorPanel);
    let editorEntity = null;
    let symbolCatalog = null;
    let symbolCatalogPromise = null;

    function isMilitaryEntity(entity) {
        return entity?.customData?.source === 'unifiedControlPanel' || entity?.customData?.militarySymbol === true;
    }

    function drawingRoots() {
        return viewer.entities.values.filter(entity =>
            (entity.customData?.drawingType || isMilitaryEntity(entity)) &&
            !entity.customData?.isDrawingGroup && !entity.customData?.isMilitaryGroup
        );
    }

    function entityScreenBounds(entity) {
        if (!entity || entity.show === false) return null;
        const time = viewer.clock.currentTime;
        const read = property => property?.getValue ? property.getValue(time) : property;
        const position = read(entity.position);
        const screen = Cesium.defined(position) ? Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position) : null;
        if (Cesium.defined(screen) && entity.billboard) {
            const scale = Number(read(entity.billboard.scale)) || 1;
            const savedSize = entity.customData?.billboardScreenSize;
            const image = read(entity.billboard.image);
            const width = Math.max(20, Number(savedSize?.width) || (Number(read(entity.billboard.width)) || Number(image?.width) || 60) * scale);
            const height = Math.max(20, Number(savedSize?.height) || (Number(read(entity.billboard.height)) || Number(image?.height) || 60) * scale);
            const pixelOffset = read(entity.billboard.pixelOffset) || Cesium.Cartesian2.ZERO;
            const centerX = screen.x + pixelOffset.x;
            const centerY = screen.y + pixelOffset.y;
            if (entity.customData?.textDrawing) {
                const dimensions = entity.customData.textBoxDimensions || { width, height };
                return { left: centerX, top: centerY - dimensions.height * scale, right: centerX + dimensions.width * scale, bottom: centerY };
            }
            return { left: centerX - width / 2, top: centerY - height / 2, right: centerX + width / 2, bottom: centerY + height / 2 };
        }
        const sphere = new Cesium.BoundingSphere();
        const state = viewer.dataSourceDisplay.getBoundingSphere(entity, false, sphere);
        if (state !== Cesium.BoundingSphereState.DONE) return null;
        const center = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, sphere.center);
        if (!Cesium.defined(center)) return null;
        const metersPerPixel = viewer.camera.getPixelSize(sphere, viewer.scene.drawingBufferWidth, viewer.scene.drawingBufferHeight);
        const radius = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? Math.max(8, sphere.radius / metersPerPixel) : 8;
        return { left: center.x - radius, top: center.y - radius, right: center.x + radius, bottom: center.y + radius };
    }

    function selectionRect(end) {
        return {
            left: Math.min(dragStart.x, end.x), top: Math.min(dragStart.y, end.y),
            right: Math.max(dragStart.x, end.x), bottom: Math.max(dragStart.y, end.y)
        };
    }

    function intersects(a, b) {
        return a && a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
    }

    function updateMarquee(end) {
        const rect = selectionRect(end);
        marquee.style.display = 'block';
        marquee.style.left = `${rect.left}px`;
        marquee.style.top = `${rect.top}px`;
        marquee.style.width = `${Math.max(2, rect.right - rect.left)}px`;
        marquee.style.height = `${Math.max(2, rect.bottom - rect.top)}px`;
        const count = drawingRoots().filter(entity => intersects(rect, entityScreenBounds(entity))).length;
        marqueeCount.textContent = `${count}개 선택`;
    }

    function updateSelectionBoxes() {
        viewer.container.querySelectorAll('.drawing-multi-selection-box').forEach(box => box.remove());
        if (selectedGroup) {
            const bounds = (selectedGroup.customData?.groupMembers || []).map(entityScreenBounds).filter(Boolean);
            if (!bounds.length) return;
            const rect = bounds.reduce((result, bound) => ({
                left: Math.min(result.left, bound.left), top: Math.min(result.top, bound.top),
                right: Math.max(result.right, bound.right), bottom: Math.max(result.bottom, bound.bottom)
            }));
            const box = document.createElement('div');
            box.className = 'drawing-multi-selection-box';
            box.style.cssText = `position:absolute;z-index:1240;pointer-events:none;border:3px solid #f59e0b;box-shadow:0 0 12px rgba(245,158,11,.85);left:${rect.left - 6}px;top:${rect.top - 6}px;width:${rect.right - rect.left + 12}px;height:${rect.bottom - rect.top + 12}px;box-sizing:border-box;`;
            const label = document.createElement('span');
            label.textContent = selectedGroup.name || selectedGroup.customData?.displayName || '그룹';
            label.style.cssText = 'position:absolute;left:-3px;top:-25px;padding:3px 8px;border-radius:4px 4px 0 0;background:#f59e0b;color:#111827;font:700 12px sans-serif;white-space:nowrap;';
            box.appendChild(label);
            viewer.container.appendChild(box);
            return;
        }
        selectedEntities.forEach(entity => {
            const rect = entityScreenBounds(entity);
            if (!rect) return;
            const box = document.createElement('div');
            box.className = 'drawing-multi-selection-box';
            box.style.cssText = `position:absolute;z-index:1240;pointer-events:none;border:2px dashed #facc15;left:${rect.left}px;top:${rect.top}px;width:${rect.right - rect.left}px;height:${rect.bottom - rect.top}px;box-sizing:border-box;`;
            viewer.container.appendChild(box);
        });
    }

    function finishSelection(end) {
        const rect = selectionRect(end);
        selectedGroup = null;
        selectedEntities = drawingRoots().filter(entity => intersects(rect, entityScreenBounds(entity)));
        marquee.style.display = 'none';
        updateSelectionBoxes();
        if (selectedEntities.length === 1) viewer.selectedEntity = selectedEntities[0];
        document.dispatchEvent(new CustomEvent('drawing-multi-selection-changed', { detail: { entities: selectedEntities.slice() } }));
    }

    function createGroup(targetEntities = selectedEntities) {
        contextMenu.style.display = 'none';
        const source = Array.isArray(targetEntities) ? targetEntities : selectedEntities;
        const first = source.find(entity => entity?.customData?.drawingType || isMilitaryEntity(entity));
        if (!first) return;
        const militaryGroup = isMilitaryEntity(first);
        const members = source.filter(entity => {
            const sameKind = militaryGroup ? isMilitaryEntity(entity) : Boolean(entity?.customData?.drawingType);
            return sameKind && !entity.customData.isDrawingGroup && !entity.customData.isMilitaryGroup && !entity.customData.groupId;
        });
        if (members.length < 2) return;
        const name = (global.prompt('그룹명을 입력하세요.', `그룹 ${++groupSequence}`) || '').trim();
        if (!name) return;
        const groupId = `drawing-group-${Date.now()}`;
        const groupEntity = viewer.entities.add({ name });
        groupEntity.customData = {
            ...(militaryGroup ? { source: 'unifiedControlPanel', militarySymbol: true, isMilitaryGroup: true } : { drawingType: 'drawing-group', isDrawingGroup: true }),
            displayName: name, groupId,
            groupMembers: members,
            subEntities: members.flatMap(member => [member, ...(member.customData?.subEntities || [])])
        };
        members.forEach(member => {
            member.customData.groupId = groupId;
            member.customData.groupName = name;
            member.customData.groupEntity = groupEntity;
        });
        selectedEntities = members.slice();
        selectedGroup = groupEntity;
        viewer.selectedEntity = groupEntity;
        contextMenu.style.display = 'none';
        updateSelectionBoxes();
        document.dispatchEvent(new CustomEvent('drawing-group-changed', { detail: { group: groupEntity, members } }));
        document.dispatchEvent(new CustomEvent(militaryGroup ? 'military-symbol-added' : 'drawing-entity-added', { detail: { entity: groupEntity } }));
    }

    function ungroup(targetEntities = selectedEntities) {
        contextMenu.style.display = 'none';
        const source = Array.isArray(targetEntities) ? targetEntities : selectedEntities;
        const groups = new Map();
        source.forEach(entity => {
            const group = (entity.customData?.isDrawingGroup || entity.customData?.isMilitaryGroup) ? entity : entity.customData?.groupEntity;
            if (group) groups.set(group.id, group);
        });
        groups.forEach(group => {
            (group.customData?.groupMembers || []).forEach(member => {
                delete member.customData.groupId;
                delete member.customData.groupName;
                delete member.customData.groupEntity;
            });
            viewer.entities.remove(group);
        });
        contextMenu.style.display = 'none';
        selectedGroup = null;
        selectedEntities = [];
        document.dispatchEvent(new CustomEvent('drawing-group-changed', { detail: { groups: [...groups.values()] } }));
        updateSelectionBoxes();
    }

    function editableMilitaryEntity() {
        if (selectedGroup || selectedEntities.length !== 1) return null;
        const entity = selectedEntities[0];
        return isMilitaryEntity(entity) && !entity.customData?.isMilitaryGroup ? entity : null;
    }

    function loadSymbolCatalog() {
        if (symbolCatalog) return Promise.resolve(symbolCatalog);
        if (!symbolCatalogPromise) {
            const url = new URL('data1/alldata-2525c-ko.json', document.baseURI).href;
            symbolCatalogPromise = fetch(url, { cache: 'no-store' })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    symbolCatalog = Array.isArray(data) ? data : [];
                    return symbolCatalog;
                })
                .catch(error => {
                    symbolCatalogPromise = null;
                    console.error('[DrawingGroupManager] 2525C 카탈로그 로드 실패:', error);
                    return [];
                });
        }
        return symbolCatalogPromise;
    }

    function populateUnitTypeOptions(sidc) {
        const select = editorPanel.querySelector('[name="symbolType"]');
        select.replaceChildren();
        const units = (symbolCatalog || []).filter(node =>
            node?.data?.length === 15 && node.editorCapabilities?.unitModifiers === true
        );
        const unique = new Map();
        units.forEach(node => {
            const key = node.data[0] + node.data[2] + node.data.slice(4, 10);
            if (!unique.has(key)) unique.set(key, node);
        });
        [...unique.values()]
            .sort((a, b) => String(a.text).localeCompare(String(b.text), 'ko'))
            .forEach(node => {
                const option = document.createElement('option');
                option.value = node.data;
                option.textContent = `${node.text} (${node.textEn})`;
                select.appendChild(option);
            });
        const currentKey = sidc[0] + sidc[2] + sidc.slice(4, 10);
        const match = [...select.options].find(option => {
            const template = option.value;
            return template[0] + template[2] + template.slice(4, 10) === currentKey;
        });
        if (match) {
            select.value = match.value;
            select.disabled = false;
        } else {
            const current = document.createElement('option');
            current.value = sidc;
            current.textContent = '현재 부호(부대 편집 미지원)';
            current.dataset.unsupported = 'true';
            select.insertBefore(current, select.firstChild);
            select.value = sidc;
            select.disabled = true;
        }
        updateUnitModifierAvailability();
    }

    function updateUnitModifierAvailability() {
        const typeSelect = editorPanel.querySelector('[name="symbolType"]');
        const supported = !typeSelect.disabled && typeSelect.selectedOptions[0]?.dataset.unsupported !== 'true';
        editorPanel.querySelector('[name="commandModifier"]').disabled = !supported;
        editorPanel.querySelector('[name="echelon"]').disabled = !supported;
    }

    function syncSidcFromUnitControls() {
        const sidcInput = editorPanel.querySelector('[name="sidc"]');
        const template = editorPanel.querySelector('[name="symbolType"]').value;
        if (!/^[A-Z0-9*\-]{15}$/.test(sidcInput.value.trim().toUpperCase()) || !/^[A-Z0-9*\-]{15}$/.test(template)) return;
        const sidc = sidcInput.value.trim().toUpperCase().split('');
        sidc[0] = template[0];
        sidc[2] = template[2];
        for (let index = 4; index < 10; index += 1) sidc[index] = template[index];
        sidc[10] = editorPanel.querySelector('[name="commandModifier"]').value;
        sidc[11] = editorPanel.querySelector('[name="echelon"]').value;
        sidcInput.value = sidc.join('');
        updateEditorPreview();
    }

    function editorOptions() {
        const value = name => editorPanel.querySelector(`[name="${name}"]`).value.trim();
        const numberValue = name => {
            const raw = value(name);
            return raw === '' ? undefined : Number(raw);
        };
        return {
            size: Math.max(20, Math.min(200, numberValue('size') || 60)),
            uniqueDesignation: value('uniqueDesignation'),
            higherFormation: value('higherFormation'),
            quantity: numberValue('quantity'),
            additionalInformation: value('additionalInformation'),
            staffComments: value('staffComments'),
            direction: numberValue('direction'),
            fill: editorPanel.querySelector('[name="fill"]').checked,
            frame: editorPanel.querySelector('[name="frame"]').checked
        };
    }

    function updateEditorPreview() {
        const preview = editorPanel.querySelector('[data-editor-preview]');
        const error = editorPanel.querySelector('[data-editor-error]');
        const sidc = editorPanel.querySelector('[name="sidc"]').value.trim().toUpperCase();
        error.textContent = '';
        preview.replaceChildren();
        if (!/^[A-Z0-9*\-]{15}$/.test(sidc)) {
            error.textContent = 'SIDC는 영문 대문자, 숫자, *, -로 구성된 15자리여야 합니다.';
            return false;
        }
        try {
            const svg = new global.ms.Symbol(sidc, editorOptions()).asSVG();
            const image = document.createElement('img');
            image.alt = '군대부호 미리보기';
            image.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
            image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            preview.appendChild(image);
            return true;
        } catch (exception) {
            error.textContent = 'milsymbol에서 처리할 수 없는 SIDC 또는 속성입니다.';
            return false;
        }
    }

    function closeMilitaryEditor() {
        editorPanel.style.display = 'none';
        editorEntity = null;
    }

    async function openMilitaryEditor() {
        const entity = editableMilitaryEntity();
        contextMenu.style.display = 'none';
        layerSubmenu.style.display = 'none';
        if (!entity) return;
        editorEntity = entity;
        const options = entity.customData?.symbolOptions || {};
        const set = (name, value) => { editorPanel.querySelector(`[name="${name}"]`).value = value ?? ''; };
        set('name', entity.customData?.displayName || entity.name || '군대부호');
        const currentSidc = String(entity.customData?.sidc || '').toUpperCase();
        set('sidc', currentSidc);
        set('size', options.size ?? 60);
        set('uniqueDesignation', options.uniqueDesignation);
        set('higherFormation', options.higherFormation);
        set('quantity', options.quantity);
        set('additionalInformation', options.additionalInformation);
        set('staffComments', options.staffComments);
        set('direction', options.direction);
        editorPanel.querySelector('[name="fill"]').checked = options.fill ?? true;
        editorPanel.querySelector('[name="frame"]').checked = options.frame ?? true;
        const modifier1 = currentSidc[10];
        const modifier2 = currentSidc[11];
        editorPanel.querySelector('[name="commandModifier"]').value = 'ABCDEFG'.includes(modifier1) ? modifier1 : '-';
        editorPanel.querySelector('[name="echelon"]').value = 'ABCDEFGHIJKLMN'.includes(modifier2) ? modifier2 : '-';
        await loadSymbolCatalog();
        if (editorEntity !== entity) return;
        populateUnitTypeOptions(currentSidc);
        editorPanel.style.display = 'block';
        updateEditorPreview();
        editorPanel.querySelector('[name="name"]').focus();
    }

    contextMenu.querySelector('[data-action=edit]').addEventListener('click', openMilitaryEditor);
    contextMenu.querySelector('[data-action=group]').addEventListener('click', () => createGroup());
    contextMenu.querySelector('[data-action=ungroup]').addEventListener('click', () => ungroup());
    editorPanel.querySelector('[data-editor-close]').addEventListener('click', closeMilitaryEditor);
    editorPanel.querySelector('[data-editor-cancel]').addEventListener('click', closeMilitaryEditor);
    editorPanel.querySelector('[data-editor-apply]').addEventListener('click', () => {
        if (!editorEntity || !viewer.entities.contains(editorEntity) || !updateEditorPreview()) return;
        const name = editorPanel.querySelector('[name="name"]').value.trim() || '군대부호';
        const sidc = editorPanel.querySelector('[name="sidc"]').value.trim().toUpperCase();
        const symbolOptions = editorOptions();
        editorEntity.name = name;
        editorEntity.customData = {
            ...(editorEntity.customData || {}),
            displayName: name,
            sidc,
            symbolOptions,
            militarySymbol: true
        };
        document.dispatchEvent(new CustomEvent('military-symbol-updated', {
            detail: { entity: editorEntity, sidc, symbolOptions }
        }));
        viewer.scene.requestRender();
        closeMilitaryEditor();
    });
    editorPanel.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateEditorPreview);
        input.addEventListener('change', updateEditorPreview);
    });
    editorPanel.querySelector('[name="symbolType"]').addEventListener('change', () => {
        updateUnitModifierAvailability();
        syncSidcFromUnitControls();
    });
    editorPanel.querySelector('[name="commandModifier"]').addEventListener('change', syncSidcFromUnitControls);
    editorPanel.querySelector('[name="echelon"]').addEventListener('change', syncSidcFromUnitControls);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && editorPanel.style.display !== 'none') closeMilitaryEditor();
    });

    const editorHeader = editorPanel.querySelector('[data-editor-header]');
    let editorDrag = null;
    editorHeader.addEventListener('mousedown', event => {
        if (event.target.closest('button')) return;
        const rect = editorPanel.getBoundingClientRect();
        editorDrag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        editorPanel.style.right = 'auto';
        event.preventDefault();
    });
    document.addEventListener('mousemove', event => {
        if (!editorDrag) return;
        const maxLeft = Math.max(0, window.innerWidth - editorPanel.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - 50);
        editorPanel.style.left = `${Math.max(0, Math.min(maxLeft, event.clientX - editorDrag.x))}px`;
        editorPanel.style.top = `${Math.max(0, Math.min(maxTop, event.clientY - editorDrag.y))}px`;
    });
    document.addEventListener('mouseup', () => { editorDrag = null; });

    function changeLayerPosition(edge) {
        const targets = selectedGroup ? [selectedGroup] : selectedEntities.slice();
        if (!targets.length || !global.LayerManager) return;
        if (edge === 'top') global.LayerManager.moveEntitiesToTop?.(targets);
        else global.LayerManager.moveEntitiesToBottom?.(targets);
        contextMenu.style.display = 'none';
    }
    contextMenu.querySelector('[data-action=layer-top]').addEventListener('click', () => changeLayerPosition('top'));
    contextMenu.querySelector('[data-action=layer-bottom]').addEventListener('click', () => changeLayerPosition('bottom'));
    viewer.canvas.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('mousedown', event => { if (!event.target.closest?.('[data-action]')) contextMenu.style.display = 'none'; });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    handler.setInputAction(event => {
        dragStart = Cesium.Cartesian2.clone(event.position);
        dragging = true;
        contextMenu.style.display = 'none';
        viewer.scene.screenSpaceCameraController.enableInputs = false;
        updateMarquee(dragStart);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.SHIFT);
    handler.setInputAction(event => { if (dragging) updateMarquee(event.endPosition); }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction(event => {
        if (!dragging) return;
        dragging = false;
        global.__suppressDrawingSelectionUntil = performance.now() + 300;
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        finishSelection(event.position);
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
    handler.setInputAction(event => {
        if (!selectedEntities.length) {
            const picked = viewer.scene.pick(event.position)?.id;
            const candidate = picked?._drawingOwner || picked?._lineOwner || picked;
            const root = candidate?.customData?.groupEntity || candidate;
            if (root?.customData?.drawingType || isMilitaryEntity(root)) {
                viewer.selectedEntity = root;
                selectedGroup = root.customData?.isDrawingGroup || root.customData?.isMilitaryGroup ? root : null;
                selectedEntities = selectedGroup ? (selectedGroup.customData?.groupMembers || []).slice() : [root];
            }
        }
        if (!selectedEntities.length) return;
        const hasGrouped = selectedEntities.some(entity => entity.customData?.groupId || entity.customData?.isDrawingGroup || entity.customData?.isMilitaryGroup);
        const groupButton = contextMenu.querySelector('[data-action=group]');
        const ungroupButton = contextMenu.querySelector('[data-action=ungroup]');
        const editButton = contextMenu.querySelector('[data-action=edit]');
        editButton.disabled = !editableMilitaryEntity();
        groupButton.disabled = selectedEntities.filter(entity => !entity.customData?.groupId && !entity.customData?.isDrawingGroup && !entity.customData?.isMilitaryGroup).length < 2;
        ungroupButton.disabled = !hasGrouped;
        [editButton, groupButton, ungroupButton].forEach(button => { button.style.opacity = button.disabled ? '.4' : '1'; });
        contextMenu.style.left = `${event.position.x}px`;
        contextMenu.style.top = `${event.position.y}px`;
        contextMenu.style.display = 'block';
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    viewer.selectedEntityChanged.addEventListener(entity => {
        contextMenu.style.display = 'none';
        layerSubmenu.style.display = 'none';
        if (editorEntity && entity !== editorEntity) closeMilitaryEditor();
        if (dragging) return;
        const group = (entity?.customData?.isDrawingGroup || entity?.customData?.isMilitaryGroup) ? entity : entity?.customData?.groupEntity;
        if (group && viewer.entities.contains(group)) {
            selectedGroup = group;
            selectedEntities = (group.customData?.groupMembers || []).slice();
        } else {
            selectedGroup = null;
            selectedEntities = [];
        }
        updateSelectionBoxes();
    });
    viewer.scene.preRender.addEventListener(() => { if (selectedEntities.length && !dragging) updateSelectionBoxes(); });

    global.DrawingGroupManager = {
        getSelection: () => selectedEntities.slice(),
        createGroup,
        ungroup,
        groupEntities: entities => createGroup(entities),
        ungroupEntities: entities => ungroup(entities)
    };
})(window);
