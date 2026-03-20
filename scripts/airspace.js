(function() {
    const viewer = window.CesiumViewer;

    function loadJson(url) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("HTTP error " + response.status);
                }
                return response.json();
            })
            .then(data => {
                data.entities.forEach(entity => {
                    switch (entity.type) {
                        case "cylinder":
                            viewer.entities.add({
                                name: entity.name,
                                position: Cesium.Cartesian3.fromDegrees(...entity.position),
                                cylinder: {
                                    length: entity.length,
                                    topRadius: entity.topRadius,
                                    bottomRadius: entity.bottomRadius,
                                    material: Cesium.Color.fromBytes(...entity.color)
                                }
                            });
                            break;
                        case "box":
                            viewer.entities.add({
                                name: entity.name,
                                position: Cesium.Cartesian3.fromDegrees(...entity.position),
                                box: {
                                    dimensions: new Cesium.Cartesian3(...entity.dimensions),
                                    material: Cesium.Color.fromBytes(...entity.color)
                                }
                            });
                            break;
                        case "polygon":
                            viewer.entities.add({
                                name: entity.name,
                                polygon: {
                                    hierarchy: Cesium.Cartesian3.fromDegreesArray(entity.positions),
                                    material: Cesium.Color.fromBytes(...entity.color)
                                }
                            });
                            break;
                        case "arcPolygon":
                            viewer.entities.add({
                                name: entity.name,
                                polygon: {
                                    hierarchy: new Cesium.PolygonHierarchy(
                                        Cesium.Cartesian3.fromDegreesArray(entity.positions),
                                        entity.holes.map(hole => Cesium.Cartesian3.fromDegreesArray(hole))
                                    ),
                                    material: Cesium.Color.fromBytes(...entity.color)
                                }
                            });
                            break;
                    }
                });

                viewer.zoomTo(viewer.entities);
            })
            .catch(error => {
                console.error('Error loading JSON:', error);
            });
    }

    // Load JSON file and initialize entities
    loadJson('/jsonData/entities.json');
})();