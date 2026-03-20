// Cesium Viewer 생성
(function() {
    const viewer = window.CesiumViewer;

    // 레이다 빔 그리기
const longitude = 126.9224;
const latitude = 37.5240;
const height = 0; // 방사 높이
const baseRadius = 0; // 빔의 기반 반경
const topRadius = 100; // 빔 끝의 반경 (원뿔형임)
const length = 5000; // 빔의 길이
const color = Cesium.Color.GREEN.withAlpha(0.5); // 빔의 색상과 불투명도

// 각도 설정 (degrees로)
const heading = 0; // 동쪽 방향 각도
const pitch = -60;  // 지면 아래로 30도
const roll = 0;     // 롤 회전 없음

function drawRadarBeam(longitude, latitude, height, baseRadius, topRadius, length, color, heading, pitch, roll) {
    const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);

    const beamGeometry = new Cesium.CylinderGeometry({
        length: length,
        topRadius: topRadius,
        bottomRadius: baseRadius,
        slices: 64,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
    });

     // 기본적 매트릭스 설정
     const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);

     // 회전 매트릭스 추가
     const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(
         new Cesium.HeadingPitchRoll(
             Cesium.Math.toRadians(heading),
             Cesium.Math.toRadians(pitch),
             Cesium.Math.toRadians(roll)
         )
     );
     const rotationTranslationMatrix = Cesium.Matrix4.fromRotationTranslation(rotationMatrix);
 
     // 최종 매트릭스에 회전 적용
     Cesium.Matrix4.multiply(modelMatrix, rotationTranslationMatrix, modelMatrix);
 
     // 모델 매트릭스에 상단 위치 조정
     Cesium.Matrix4.multiplyByTranslation(
         modelMatrix,
         new Cesium.Cartesian3(0.0, 0.0, length / 2),
         modelMatrix
     );
 
     const beamInstance = new Cesium.GeometryInstance({
         geometry: beamGeometry,
         modelMatrix: modelMatrix,
         attributes: {
             color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
         }
     });
 
     viewer.scene.primitives.add(new Cesium.Primitive({
         geometryInstances: beamInstance,
         appearance: new Cesium.PerInstanceColorAppearance({
             closed: true,
             translucent: true
         })
     }));
 }

drawRadarBeam(longitude, latitude, height, baseRadius, topRadius, length, color, heading, pitch, roll);

})();