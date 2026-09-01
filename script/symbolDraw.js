
(function() {
  const viewer = window.CesiumViewer;

  let entity = null;
    let selectedEntity = null; 
  let isDraging = false;

  // 드래그된 기호를 놓을 수 있게 설정
  viewer.container.addEventListener("dragover", (e) => e.preventDefault());

  viewer.container.addEventListener("drop", (e) => {
    e.preventDefault();

    const sidc = e.dataTransfer.getData("text/plain");
    if (!sidc) return;

    const rect = viewer.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const windowPosition = new Cesium.Cartesian2(x, y);
    const cartesian = viewer.scene.pickPosition(windowPosition);


    if (cartesian) {
      const symbol = new ms.Symbol(sidc, { size: 50 });

      entity = viewer.entities.add({
        position: cartesian,
        billboard: {
          image: symbol.asCanvas(),
          width: 50,
          height: 50,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM
        }
      });
    }
  });


  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction(function(click) {
    const picked = viewer.scene.pick(click.position);
    if(Cesium.defined(picked) && picked.id === entity) {
      isDraging = true;
      selectedEntity  = picked.id;
      //viewer.setInputActionv = picked.id;
      viewer.scene.screenSpaceCameraController.enableRotate= false;
    }
    else {
      selectedEntity = null;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);


  // Move entity on mouse move
  handler.setInputAction(function (movement) {
    if (Cesium.defined(selectedEntity)) {
      const cartesian = viewer.scene.pickPosition(movement.endPosition);
      //const cartesian = viewer.scene.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
      if (cartesian) {
          //selectedEntity.position = cartesian;
          selectedEntity.position = new Cesium.ConstantPositionProperty(cartesian);
      }

    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Deselect on left button up
  handler.setInputAction(function () {
      isDraging = false;
      selectedEntity = null;
      viewer.scene.screenSpaceCameraController.enableRotate= true;
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);


  // function openSymbolPopup() {
  //     window.open("symbol.html", "symbolPopup", "width=300,height=400");
  // }
})();