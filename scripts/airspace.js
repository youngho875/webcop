
window.airspace = (function() {
	const viewer = CesiumViewer;
	const entities = [];
	
	function loadJson(url) {
		return fetch(url)
			.then(response => {
				if (!response.ok) {
					throw new Error("Failed to load JSON file.");
				}
				return response.json();
			});
	}

	function initializeScene(geometryData) {
		geometryData.shapes.forEach(shapeData => {
			switch (shapeData.type) {
				case 'fanSector':
					createFanSector(viewer, shapeData);
					break;
				case 'donut':
					createDonut(viewer, shapeData);
					break;
				case 'arcWave':
					createArcWave(viewer, shapeData);
					break;
				case 'wave':
					createWave(viewer, shapeData);
					break;
				case 'geometricSurface':
					createGeometricSurface(viewer, shapeData);
					break;
				case 'box':
					createBox(viewer, shapeData);
					break;
				case 'polygon':
					createPolygon(viewer, shapeData);
					break;
				case 'cylinder':
					createCylinder(viewer, shapeData);
					break;
				default:
					console.error("Unknown shape type:", shapeData.type);
			}
		});
		setupInfoPane(viewer);
	}

	function createFanSector(viewer, data) {
		const positions = [];
		const center = Cesium.Cartesian3.fromDegrees(...data.center);
		const increment = Cesium.Math.toRadians(1); // 1 degree steps

		for (let angle = Cesium.Math.toRadians(data.startAngle); angle <= Cesium.Math.toRadians(data.endAngle); angle += increment) {
			const x = data.center[0] + Math.cos(angle) * data.radius / 111320;
			const y = data.center[1] + Math.sin(angle) * data.radius / 111320;
			positions.push(Cesium.Cartesian3.fromDegrees(x, y));
		}

		positions.push(center); // Closing the fan by connecting back to the center

		entities.push(viewer.entities.add({
			polygon: {
				hierarchy: new Cesium.PolygonHierarchy(positions),
				material: Cesium.Color.fromBytes(...data.color),
				extrudedHeight: data.height
			},
			description: 'Fan Sector'
		}));
	}

	function createDonut(viewer, data) {
		const outerCircle = createCirclePoints(data.center, data.outerRadius, 36);
		const innerCircle = createCirclePoints(data.center, data.innerRadius, 36);

		entities.push(viewer.entities.add({
			polygon: {
				hierarchy: new Cesium.PolygonHierarchy(outerCircle, [new Cesium.PolygonHierarchy(innerCircle)]),
				material: Cesium.Color.fromBytes(...data.color),
				extrudedHeight: data.height
			},
			description: 'Donut Shape'
		}));
	}

	function createArcWave(viewer, data) {
		const positions = [];
		const center = Cesium.Cartesian3.fromDegrees(...data.center);
		const increment = Cesium.Math.toRadians(25); // Adjust for frequency

		for (let angle = 0; angle <= Cesium.Math.TWO_PI; angle += increment) {
			const waveOffset = Math.sin(angle * data.frequency) * data.amplitude;
			const x = data.center[0] + (data.radius + waveOffset) * Math.cos(angle) / 111320;
			const y = data.center[1] + (data.radius + waveOffset) * Math.sin(angle) / 111320;
			positions.push(Cesium.Cartesian3.fromDegrees(x, y));
		}
		positions.push(positions[0]);

		entities.push(viewer.entities.add({
			polygon: {
				hierarchy: new Cesium.PolygonHierarchy(positions),
				material: Cesium.Color.fromBytes(...data.color),
				extrudedHeight: data.height
			},
			description: 'Arc Wave Shape'
		}));
	}

	function createWave(viewer, data) {
		const positions = [];
		const length = Math.sqrt(Math.pow((data.end[0] - data.start[0]), 2) + Math.pow((data.end[1] - data.start[1]), 2)) * 111320;
		const step = 5; // Meters per wave
		for (let i = 0; i <= length; i += step) {
			const waveOffset = Math.sin(i * data.frequency / 50) * data.amplitude;
			const x = data.start[0] + ((data.end[0] - data.start[0]) * (i / length));
			const y = data.start[1] + ((data.end[1] - data.start[1]) * (i / length)) + (waveOffset / 111320);
			positions.push(Cesium.Cartesian3.fromDegrees(x, y));
		}

		entities.push(viewer.entities.add({
			polyline: {
				positions: positions,
				width: 3,
				material: Cesium.Color.fromBytes(...data.color)
			},
			description: 'Wave Shape'
		}));
	}

	function createGeometricSurface(viewer, data) {
		const positions = data.points.map(point => {
			return Cesium.Cartesian3.fromDegrees(...point);
		});
		entities.push(viewer.entities.add({
			polygon: {
				hierarchy: new Cesium.PolygonHierarchy(positions),
				material: Cesium.Color.fromBytes(...data.color),
				extrudedHeight: data.height
			},
			description: 'Geometric Surface'
		}));
	}

	function createBox(viewer, boxData) {
		const boxPosition = boxData.points.map(boxData => {
			return Cesium.Cartesian3.fromDegrees(...boxData.position);
		});

		entities.push(viewer.entities.add({
			name: data.name,
			position: boxPosition,
			box: {
				dimensions: new Cesium.Cartesian3(boxData.dimensions[0], boxData.dimensions[1], boxData.dimensions[2]),
				material: Cesium.Color.fromBytes(...boxData.color),
				outline: true,
				outlineColor: Cesium.Color.BLACK
			},
			description: 'Box Shape' +  boxData.name
		}));
	}
	
	function createPolygon(viewer, polygonData) {
		const outerBoundary = polygonData.points.map(point => Cesium.Cartesian3.fromDegrees(...point.position));

        const holes = polygonData.holes.map(hole => {
            return new Cesium.PolygonHierarchy(hole.map(point => Cesium.Cartesian3.fromDegrees(...point.position)));
        });

        polygonData.circularHoles.forEach(circleData => {
            const circleHole = createCircleHole(circleData);
            holes.push(circleHole);
        });

        polygonData.arcHoles.forEach(arcData => {
            const arcHole = createArcHole(arcData);
            holes.push(arcHole);
        });

		entities.push(viewer.entities.add({
			name: polygonData.name,
			polygon: {
				hierarchy: new Cesium.PolygonHierarchy(outerBoundary, holes),
				material: Cesium.Color.fromBytes(...polygonData.color),
				extrudedHeight: polygonData.extrusionHeight,
				outline: true,
				outlineColor: Cesium.Color.BLACK,
				outlineWidth: 1
			},
			description: 'This is a 3D Polygon named ' + polygonData.name
		}));
	}

	function createCircleHole(circleData, numSides = 36) {
		const positions = [];
		const increment = Cesium.Math.TWO_PI / numSides;
		for (let i = 0; i < numSides; i++) {
			const angle = i * increment;
			const offsetX = circleData.radius * Math.cos(angle);
			const offsetY = circleData.radius * Math.sin(angle);
			const point = Cesium.Cartesian3.fromDegrees(
				circleData.center[0] + offsetX / 111320,
				circleData.center[1] + offsetY / (111320 * Math.cos(Cesium.Math.toRadians(circleData.center[1])))
			);
			positions.push(point);
		}
		return new Cesium.PolygonHierarchy(positions);
	}

	// Function to create a polygonal approximation of an arc-shaped hole
    function createArcHole(arcData, numSides = 36) {
        const positions = [];
        const increment = (arcData.endAngle - arcData.startAngle) / numSides;

        for (let i = 0; i <= numSides; i++) {
            const angle = Cesium.Math.toRadians(arcData.startAngle + i * increment);
            const offsetX = arcData.radius * Math.cos(angle);
            const offsetY = arcData.radius * Math.sin(angle);

            const point = Cesium.Cartesian3.fromDegrees(
                arcData.center[0] + offsetX / 110540, // meters per degree latitude
                arcData.center[1] + offsetY / (111320 * Math.cos(Cesium.Math.toRadians(arcData.center[1])))
            );

            positions.push(point);
        }

        return new Cesium.PolygonHierarchy(positions);
    }
	
	function createCylinder(viewer, cylinderData) {
		const cylinderPosition = Cesium.Cartesian3.fromDegrees(...cylinderData.position);
		entities.push(viewer.entities.add({
			name: cylinderData.name,
			position: cylinderPosition,
			cylinder: {
				length: cylinderData.length,
				topRadius: cylinderData.topRadius,
				bottomRadius: cylinderData.bottomRadius,
				material: Cesium.Color.fromBytes(...cylinderData.color),
				outline: true,
				outlineColor: Cesium.Color.BLACK
			},
			description: 'This is ' + cylinderData.name
		}));
	}
	
	function createBox(viewer, boxData) {
		const boxPosition = Cesium.Cartesian3.fromDegrees(...boxData.position);
		entities.push(viewer.entities.add({
			name: boxData.name,
			position: boxPosition,
			box: {
				dimensions: new Cesium.Cartesian3(boxData.dimensions[0], boxData.dimensions[1], boxData.dimensions[2]),
				material: Cesium.Color.fromBytes(...boxData.color),
				outline: true,
				outlineColor: Cesium.Color.BLACK
			},
			description: 'Box Shape' + boxData.name
		}));
	}

	function createCirclePoints(center, radius, numPoints) {
		const positions = [];
		for (let i = 0; i < numPoints; i++) {
			const angle = (i / numPoints) * Cesium.Math.TWO_PI;
			positions.push(Cesium.Cartesian3.fromDegrees(
				center[0] + Math.cos(angle) * radius / 111320,
				center[1] + Math.sin(angle) * radius / 111320
			));
		}
		return positions;
	}

	function setupInfoPane(viewer) {
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction(function(movement) {
            const pickedObject = viewer.scene.pick(movement.endPosition);
            const infoPane = document.getElementById('infoPane');
            if (Cesium.defined(pickedObject) && pickedObject.id) {
                const pickedEntity = pickedObject.id;
                infoPane.style.display = 'block';
                infoPane.style.left = movement.endPosition.x + 15 + 'px';
                infoPane.style.top = movement.endPosition.y + 15 + 'px';
                infoPane.innerHTML = 'Name: ' + pickedEntity.name + '<br>' + pickedEntity.description;
            } else {
                infoPane.style.display = 'none';
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        const infoPane = document.createElement('div');
        infoPane.id = 'infoPane';
        infoPane.style.position = 'absolute';
        infoPane.style.backgroundColor = 'rgba(42, 42, 42, 0.8)';
        infoPane.style.padding = '5px';
        infoPane.style.color = 'white';
        infoPane.style.borderRadius = '4px';
        infoPane.style.pointerEvents = 'none';
        infoPane.style.display = 'none';
        document.body.appendChild(infoPane);
    }
	
	// Load geometry data from JSON and initialize the scene
	loadJson('/jsonData/airSpace1.json').then(initializeScene).catch(error => {
		console.error("Error initializing scene:", error);
	});
	
})();
