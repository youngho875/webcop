
function convertCoordinates(longitude, latitude) {
    // 위경도 좌표 (예: 서울)
    //const latitude = 37.5665;
    //const longitude = 126.9780;

    
    const zone = Math.floor((longitude + 180) / 6) + 1;
    const utmProjection = `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`;

    // UTM 변환을 위한 proj4 정의 (서울의 경우 UTM zone 52N 사용)
    //const utmProjection = "+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs";

    // 위경도 좌표를 UTM으로 변환
    const utmCoordinates = proj4("EPSG:4326", utmProjection, [longitude, latitude]);

    // 위경도 좌표를 MGRS로 변환
    const mgrsCoordinates = mgrs.forward([longitude, latitude]);

    // 결과 출력
    const utmResultElement = document.getElementById("utm-result");
    utmResultElement.textContent = `UTM Zone: ${zone}, Easting: ${utmCoordinates[0].toFixed(2)}, Northing: ${utmCoordinates[1].toFixed(2)}`;
    //utmResultElement.textContent = `UTM Coordinates: Easting: ${utmCoordinates[0].toFixed(2)}, Northing: ${utmCoordinates[1].toFixed(2)}`;

    const mgrsResultElement = document.getElementById("mgrs-result");
    mgrsResultElement.textContent = `MGRS Coordinates: ${mgrsCoordinates}`;
}