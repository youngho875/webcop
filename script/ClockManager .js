// ClockManager.js
const ClockManager = (function() {
    let viewer;

    function init(cesiumViewer) {
        viewer = cesiumViewer;
    }

    function setClock(startTime, stopTime, multiplier) {
        if (!viewer) {
            console.error("Viewer is not initialized.");
            return;
        }
        viewer.clock.startTime = startTime.clone();
        viewer.clock.stopTime = stopTime.clone();
        viewer.clock.currentTime = startTime.clone();
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // Loop at the end
        viewer.clock.multiplier = multiplier; // Playback speed
        viewer.clock.shouldAnimate = true;
    }

    return {
        init: init,
        setClock: setClock
    };
})();