// scalebar.js

(function () {
    function injectScaleBarStyles() {
        if (document.getElementById('cesium-scale-bar-style')) return;

        const style = document.createElement('style');
        style.id = 'cesium-scale-bar-style';
        style.textContent = `
            #cesium-scale-bar {
                position: fixed;
                bottom: 30px;
                left: 20px;
                z-index: 10020 !important;
                color: #fff;
                font-family: Arial, sans-serif;
                font-size: 13px;
                text-align: center;
                pointer-events: none;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
            }

            #cesium-scale-bar-label {
                margin-bottom: 4px;
                white-space: nowrap;
            }

            #cesium-scale-bar-line {
                position: relative;
                width: 100px;
                height: 8px;
                border: 2px solid #fff;
                border-top: none;
                box-sizing: border-box;
                filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.8));
            }

            #cesium-scale-bar-line::after {
                content: "";
                position: absolute;
                left: 50%;
                bottom: 0;
                height: 5px;
                border-left: 2px solid #fff;
                transform: translateX(-1px);
            }
        `;

        document.head.appendChild(style);
    }

    function getNiceDistance(distance) {
        const exponent = Math.floor(Math.log10(distance));
        const fraction = distance / Math.pow(10, exponent);

        let niceFraction;

        if (fraction >= 5) {
            niceFraction = 5;
        } else if (fraction >= 2) {
            niceFraction = 2;
        } else {
            niceFraction = 1;
        }

        return niceFraction * Math.pow(10, exponent);
    }

    function formatDistance(meters) {
        if (meters >= 1000) {
            const kilometers = meters / 1000;

            return `${Number(kilometers.toFixed(2))} km`;
        }

        if (meters >= 1) {
            return `${Math.round(meters)} m`;
        }

        return `${Math.round(meters * 100)} cm`;
    }

    window.createScaleBar = function () {
        const viewer = window.CesiumViewer;

        if (!viewer) {
            console.error('CesiumViewer가 생성되지 않았습니다.');
            return;
        }

        injectScaleBarStyles();

        // 중복 생성 방지
        document.getElementById('cesium-scale-bar')?.remove();

        const scaleBar = document.createElement('div');
        scaleBar.id = 'cesium-scale-bar';
        scaleBar.innerHTML = `
            <div id="cesium-scale-bar-label">0 m</div>
            <div id="cesium-scale-bar-line"></div>
        `;

        // body에 직접 배치해 Cesium 컨테이너의 stacking context에 가려지지 않게 한다.
        document.body.appendChild(scaleBar);
        let scaleBarVisible = true;

        const label = scaleBar.querySelector('#cesium-scale-bar-label');
        const line = scaleBar.querySelector('#cesium-scale-bar-line');

        const SCALE_GAP = 12;

        function isVisible(element) {
            if (!element || element === scaleBar || !element.isConnected) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
                Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
        }

        function intersects(a, b) {
            return a.left < b.right + SCALE_GAP && a.right + SCALE_GAP > b.left &&
                a.top < b.bottom + SCALE_GAP && a.bottom + SCALE_GAP > b.top;
        }

        // 좌우 고정 도킹 및 이동 가능한 도킹바를 모두 피해 축척 바를 배치한다.
        function updateScaleBarPosition() {
            if (!scaleBarVisible || scaleBar.style.display === 'none') return;

            const viewport = window.visualViewport;
            const viewportLeft = viewport ? viewport.offsetLeft : 0;
            const viewportTop = viewport ? viewport.offsetTop : 0;
            const viewportRight = viewportLeft + (viewport ? viewport.width : window.innerWidth);
            const viewportBottom = viewportTop + (viewport ? viewport.height : window.innerHeight);
            let boundLeft = viewportLeft + SCALE_GAP;
            let boundRight = viewportRight - SCALE_GAP;
            document.querySelectorAll('.layer-dialog-container.layer-docked-left').forEach(element => {
                if (isVisible(element)) boundLeft = Math.max(boundLeft, element.getBoundingClientRect().right + SCALE_GAP);
            });
            document.querySelectorAll('.layer-dialog-container.layer-docked-right').forEach(element => {
                if (isVisible(element)) boundRight = Math.min(boundRight, element.getBoundingClientRect().left - SCALE_GAP);
            });

            const width = scaleBar.offsetWidth;
            const height = scaleBar.offsetHeight;
            let left = Math.max(boundLeft, Math.min(boundLeft + 8, boundRight - width));
            let top = viewportBottom - height - 30;
            const obstacles = Array.from(document.querySelectorAll(
                '.layer-dialog-container, .dock-bar'
            )).filter(isVisible);

            for (let pass = 0; pass < obstacles.length + 2; pass += 1) {
                const current = { left, top, right: left + width, bottom: top + height };
                const obstacle = obstacles.find(element => intersects(current, element.getBoundingClientRect()));
                if (!obstacle) break;
                const rect = obstacle.getBoundingClientRect();
                const candidates = [
                    { left: rect.right + SCALE_GAP, top },
                    { left, top: rect.top - height - SCALE_GAP },
                    { left: rect.left - width - SCALE_GAP, top },
                    { left, top: rect.bottom + SCALE_GAP }
                ].filter(candidate =>
                    candidate.left >= boundLeft && candidate.left + width <= boundRight &&
                    candidate.top >= viewportTop + SCALE_GAP && candidate.top + height <= viewportBottom - SCALE_GAP
                ).sort((a, b) =>
                    Math.hypot(a.left - left, a.top - top) - Math.hypot(b.left - left, b.top - top)
                );
                if (!candidates.length) break;
                left = candidates[0].left;
                top = candidates[0].top;
            }

            let positionChanged = false;
            const setStyle = (property, value) => {
                if (scaleBar.style[property] !== value) {
                    scaleBar.style[property] = value;
                    positionChanged = true;
                }
            };
            setStyle('left', `${left}px`);
            setStyle('top', `${top}px`);
            setStyle('bottom', 'auto');
            if (positionChanged) document.dispatchEvent(new CustomEvent('scalebar-position-changed'));
        }

        let layoutFrame = null;
        function scheduleScaleBarLayout() {
            if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
            let remainingFrames = 3;
            const refresh = () => {
                updateScaleBarPosition();
                remainingFrames -= 1;
                layoutFrame = remainingFrames > 0 ? requestAnimationFrame(refresh) : null;
            };
            layoutFrame = requestAnimationFrame(refresh);
        }

        function updateScaleBar() {
            const scene = viewer.scene;
            const canvas = scene.canvas;

            if (!canvas.clientHeight) return;

            const camera = viewer.camera;
            const frustum = camera.frustum;
            const fovy = frustum.fovy;

            scaleBar.style.display = scaleBarVisible ? 'block' : 'none';
            if (!scaleBarVisible) return;

            let metersPerPixel;

            if (Cesium.defined(fovy)) {
                // 3D 원근 투영에서 화면 한 픽셀이 나타내는 실제 거리
                const cartographic = Cesium.Cartographic.fromCartesian(camera.positionWC);
                if (!cartographic) return;
                const height = Math.max(cartographic.height, 0);
                metersPerPixel =
                    (2 * height * Math.tan(fovy / 2)) /
                    canvas.clientHeight;
            } else {
                // 2D 직교 투영에서는 현재 프러스텀의 가로 폭이 실제 지도 폭입니다.
                const frustumWidth = Cesium.defined(frustum.width)
                    ? frustum.width
                    : Math.abs(frustum.right - frustum.left);
                metersPerPixel = frustumWidth / canvas.clientWidth;
            }

            if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
                return;
            }

            const targetWidth = 120;
            const distance = getNiceDistance(
                metersPerPixel * targetWidth
            );

            const pixelWidth = Math.max(
                40,
                Math.min(160, distance / metersPerPixel)
            );

            line.style.width = `${pixelWidth}px`;
            label.textContent = formatDistance(distance);
            updateScaleBarPosition();
        }

        const resizeObserver = new ResizeObserver(updateScaleBarPosition);
        resizeObserver.observe(document.body);
        resizeObserver.observe(scaleBar);

        function observeDockElements(root) {
            if (root.nodeType !== Node.ELEMENT_NODE) return;
            if (root.matches?.('.layer-dialog-container, .dock-bar')) resizeObserver.observe(root);
            root.querySelectorAll?.('.layer-dialog-container, .dock-bar').forEach(element => {
                resizeObserver.observe(element);
            });
        }
        document.querySelectorAll('.layer-dialog-container, .dock-bar').forEach(element => resizeObserver.observe(element));

        const dockObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => mutation.addedNodes.forEach(observeDockElements));
            updateScaleBarPosition();
        });
        dockObserver.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        window.addEventListener('resize', updateScaleBarPosition);
        document.addEventListener('layer-dock-layout-changed', scheduleScaleBarLayout);
        // DOM 도킹바 드래그는 Cesium 렌더를 발생시키지 않을 수 있으므로 직접 추적한다.
        document.addEventListener('mousemove', event => {
            if (event.buttons === 1) scheduleScaleBarLayout();
        }, true);
        document.addEventListener('mouseup', scheduleScaleBarLayout, true);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateScaleBarPosition);
            window.visualViewport.addEventListener('scroll', updateScaleBarPosition);
        }

        viewer.scene.postRender.addEventListener(updateScaleBar);
        updateScaleBar();

        window.ScaleBarControl = {
            element: scaleBar,
            isVisible: () => scaleBarVisible,
            setVisible: visible => {
                scaleBarVisible = !!visible;
                scaleBar.style.display = scaleBarVisible ? 'block' : 'none';
                document.dispatchEvent(new CustomEvent('scalebar-visibility-changed', {
                    detail: { visible: scaleBarVisible }
                }));
                if (scaleBarVisible) updateScaleBar();
            },
            toggle: () => window.ScaleBarControl.setVisible(!scaleBarVisible)
        };
    };
})();
