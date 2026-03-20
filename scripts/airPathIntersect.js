window.airPathIntersect = (function() {
    const viewer = window.CesiumViewer;
    
    function isPointInsideDome(lon, lat, alt, dome) {
        const domeCenter = Cesium.Cartesian3.fromDegrees(dome.longitude, dome.latitude);
        const point = Cesium.Cartesian3.fromDegrees(lon, lat);
    
        // Calculates the horizontal distance from the dome center to the point
        const horizontalDistance = Cesium.Cartesian3.distance(point, domeCenter);
    
        // Check if the point is within the dome's horizontal range and altitude range
        return (horizontalDistance <= dome.radius) && (alt >= 0 && alt <= dome.radius);
    }
    
    function findPathDomeIntersections(pathPoints, dome) {
        const intersections = [];
    
        pathPoints.forEach(point => {
            const lon = Cesium.Math.toDegrees(point.longitude);
            const lat = Cesium.Math.toDegrees(point.latitude);
            const alt = point.altitude; // Assuming altitude is part of path point data structure
            
            if (isPointInsideDome(lon, lat, alt, dome)) {
                intersections.push({longitude: lon, latitude: lat, altitude: alt});
            }
        });
    
        return intersections;
    }
    
    // // Example usage:
    // const dome = {
    //     longitude: 126.9211, // dome center longitude
    //     latitude: 37.5252,  // dome center latitude
    //     radius: 50000       // dome radius
    // };
    
    // const pathPoints = [
    //     {longitude: 126.9, latitude: 37.5, altitude: 10000},
    //     {longitude: 126.92, latitude: 37.52, altitude: 20000},
    //     // ... other path points
    // ];
    
    // const intersections = findPathDomeIntersections(pathPoints, dome);
    // console.log(intersections);

    return {
        isPointInsideDome,
        findPathDomeIntersections
    };

})();


// Example initialization
//window.airPathIntersect.initHandlers();