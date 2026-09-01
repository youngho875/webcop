/**
 * WGS84 degree coordinates -> DMS, UTM, MGRS, GEOREF.
 *
 * Required browser libraries:
 *   - proj4 (https://github.com/proj4js/proj4js)
 *   - mgrs  (https://github.com/proj4js/mgrs)
 *
 * @param {number} longitude Longitude in decimal degrees (-180..180)
 * @param {number} latitude Latitude in decimal degrees (-90..90)
 * @param {object} [options]
 * @returns {{degree: object, dms: object, utm: object, mgrs: string, georef: string}}
 */
function convertCoordinates(longitude, latitude, options = {}) {
    const dmsPrecision = options.dmsPrecision ?? 2;
    const mgrsPrecision = options.mgrsPrecision ?? 5;
    const georefPrecision = options.georefPrecision ?? 3;
    const dms = convertToDMS(longitude, latitude, dmsPrecision);
    const utm = convertToUTM(longitude, latitude);

    const result = {
        degree: { longitude, latitude },
        dms,
        utm,
        mgrs: convertToMGRS(longitude, latitude, mgrsPrecision),
        georef: convertToGEOREF(longitude, latitude, georefPrecision)
    };

    // 해당 id의 요소가 HTML에 있을 때만 화면에 표시합니다.
    setResultText("degree-result", `Degree: ${latitude}, ${longitude}`);
    setResultText("dms-result", `DMS: ${result.dms.text}`);
    setResultText(
        "utm-result",
        `UTM Zone: ${utm.zone}${utm.hemisphere}, Easting: ${utm.easting.toFixed(2)}, Northing: ${utm.northing.toFixed(2)}`
    );
    setResultText("mgrs-result", `MGRS Coordinates: ${result.mgrs}`);
    setResultText("georef-result", `GEOREF Coordinates: ${result.georef}`);

    return result;
}

/** Degree 경위도를 도분초(DMS)로 변환합니다. */
function convertToDMS(longitude, latitude, precision = 2) {
    validateDegreeCoordinates(longitude, latitude);
    const result = {
        longitude: decimalToDms(longitude, "E", "W", precision),
        latitude: decimalToDms(latitude, "N", "S", precision)
    };
    result.text = `${result.latitude.text}, ${result.longitude.text}`;
    return result;
}

/** Degree 경위도를 WGS84 UTM으로 변환합니다. */
function convertToUTM(longitude, latitude) {
    validateUtmCoordinates(longitude, latitude);
    const proj4Library = getExternalLibrary("proj4");
    const zone = getUtmZone(longitude, latitude);
    const hemisphere = latitude < 0 ? "S" : "N";
    const band = getLatitudeBand(latitude);
    const southOption = latitude < 0 ? " +south" : "";
    const projection = `+proj=utm +zone=${zone}${southOption} +datum=WGS84 +units=m +no_defs`;
    const coordinates = proj4Library("EPSG:4326", projection, [longitude, latitude]);

    return {
        zone,
        band,
        hemisphere,
        easting: coordinates[0],
        northing: coordinates[1],
        epsg: (latitude < 0 ? 32700 : 32600) + zone,
        text: `${zone}${hemisphere} ${coordinates[0].toFixed(2)} ${coordinates[1].toFixed(2)}`
    };
}

/** Degree 경위도를 MGRS로 변환합니다. */
function convertToMGRS(longitude, latitude, precision = 5) {
    validateUtmCoordinates(longitude, latitude);
    if (!Number.isInteger(precision) || precision < 0 || precision > 5) {
        throw new RangeError("MGRS precision은 0~5 사이의 정수여야 합니다.");
    }
    const mgrsLibrary = getExternalLibrary("mgrs");
    return mgrsLibrary.forward([longitude, latitude], precision);
}

/** Degree 경위도를 GEOREF로 변환합니다. */
function convertToGEOREF(longitude, latitude, precision = 3) {
    validateDegreeCoordinates(longitude, latitude);
    return toGeoref(longitude, latitude, precision);
}

/** UTM 문자열(예: "52N 321424 4159641")을 Degree 경위도로 변환합니다. */
function convertFromUTM(utmText) {
    const match = String(utmText).trim().toUpperCase().match(
        /^(\d{1,2})\s*([C-HJ-NP-X]|N|S)\s+([0-9]+(?:\.[0-9]+)?)\s*[, ]\s*([0-9]+(?:\.[0-9]+)?)$/
    );
    if (!match) throw new Error("UTM 형식: 52N 321424 4159641");

    const zone = Number(match[1]);
    const zoneLetter = match[2];
    const easting = Number(match[3]);
    const northing = Number(match[4]);
    if (zone < 1 || zone > 60) throw new RangeError("UTM Zone은 1~60이어야 합니다.");
    if (easting < 100000 || easting >= 1000000 || northing < 0 || northing > 10000000) {
        throw new RangeError("UTM Easting 또는 Northing 범위를 확인하세요.");
    }

    const hemisphere = zoneLetter === "S" || (zoneLetter !== "N" && zoneLetter < "N") ? "S" : "N";
    const southOption = hemisphere === "S" ? " +south" : "";
    const projection = `+proj=utm +zone=${zone}${southOption} +datum=WGS84 +units=m +no_defs`;
    const coordinates = getExternalLibrary("proj4")(projection, "EPSG:4326", [easting, northing]);
    validateDegreeCoordinates(coordinates[0], coordinates[1]);
    return { longitude: coordinates[0], latitude: coordinates[1] };
}

/** MGRS 문자열을 Degree 경위도로 변환합니다. */
function convertFromMGRS(mgrsText) {
    const value = String(mgrsText).trim().toUpperCase().replace(/\s+/g, "");
    if (!value) throw new Error("MGRS 좌표를 입력하세요.");
    const bbox = getExternalLibrary("mgrs").inverse(value);
    if (!Array.isArray(bbox) || bbox.length < 4) throw new Error("MGRS 좌표를 변환할 수 없습니다.");
    const longitude = (bbox[0] + bbox[2]) / 2;
    const latitude = (bbox[1] + bbox[3]) / 2;
    validateDegreeCoordinates(longitude, latitude);
    return { longitude, latitude };
}

/** GEOREF 문자열을 Degree 경위도로 변환합니다. */
function convertFromGEOREF(georefText) {
    const value = String(georefText).trim().toUpperCase().replace(/\s+/g, "");
    const match = value.match(/^([A-HJ-NP-Z]{4})(\d*)$/);
    if (!match || match[2].length % 2 !== 0 || match[2].length > 10) {
        throw new Error("GEOREF 형식: WJGH586339");
    }

    const alphabet24 = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const alphabet15 = "ABCDEFGHJKLMNPQ";
    const letters = match[1];
    const lon15 = alphabet24.indexOf(letters[0]);
    const lat15 = alphabet24.indexOf(letters[1]);
    const lon1 = alphabet15.indexOf(letters[2]);
    const lat1 = alphabet15.indexOf(letters[3]);
    if (lon15 < 0 || lon15 > 23 || lat15 < 0 || lat15 > 11 || lon1 < 0 || lat1 < 0) {
        throw new Error("GEOREF 격자 문자를 확인하세요.");
    }

    const precision = match[2].length / 2;
    let lonMinutes = 30;
    let latMinutes = 30;
    if (precision > 0) {
        const scale = 10 ** (precision - 2);
        const unitMinutes = 1 / scale;
        lonMinutes = Number(match[2].slice(0, precision)) / scale + unitMinutes / 2;
        latMinutes = Number(match[2].slice(precision)) / scale + unitMinutes / 2;
        if (lonMinutes >= 60 || latMinutes >= 60) throw new Error("GEOREF 분 값을 확인하세요.");
    }

    const longitude = -180 + lon15 * 15 + lon1 + lonMinutes / 60;
    const latitude = -90 + lat15 * 15 + lat1 + latMinutes / 60;
    validateDegreeCoordinates(longitude, latitude);
    return { longitude, latitude };
}

function validateDegreeCoordinates(longitude, latitude) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        throw new TypeError("경도와 위도는 유한한 숫자여야 합니다.");
    }
    if (longitude < -180 || longitude > 180) {
        throw new RangeError("경도는 -180 이상 180 이하여야 합니다.");
    }
    if (latitude < -90 || latitude > 90) {
        throw new RangeError("위도는 -90 이상 90 이하여야 합니다.");
    }
}

function validateUtmCoordinates(longitude, latitude) {
    validateDegreeCoordinates(longitude, latitude);
    if (latitude < -80 || latitude > 84) {
        throw new RangeError("UTM/MGRS 변환 가능 위도는 남위 80도부터 북위 84도까지입니다.");
    }
}

function getExternalLibrary(name) {
    const scope = typeof globalThis !== "undefined" ? globalThis : window;
    const library = scope[name];
    if (!library) {
        throw new Error(`${name} 변환 라이브러리가 없습니다. ${name}를 먼저 로드하세요.`);
    }
    return library;
}

function decimalToDms(value, positiveDirection, negativeDirection, precision) {
    if (!Number.isInteger(precision) || precision < 0 || precision > 9) {
        throw new RangeError("DMS precision은 0~9 사이의 정수여야 합니다.");
    }

    const direction = value < 0 ? negativeDirection : positiveDirection;
    let degrees = Math.floor(Math.abs(value));
    let minutes = Math.floor((Math.abs(value) - degrees) * 60);
    let seconds = Number((((Math.abs(value) - degrees) * 60 - minutes) * 60).toFixed(precision));

    // 반올림 결과가 60초 또는 60분이 되는 경우 올림 처리합니다.
    if (seconds >= 60) {
        seconds = 0;
        minutes += 1;
    }
    if (minutes >= 60) {
        minutes = 0;
        degrees += 1;
    }

    const secondsText = seconds
        .toFixed(precision)
        .padStart(precision === 0 ? 2 : precision + 3, "0");

    return {
        degrees,
        minutes,
        seconds,
        direction,
        text: `${degrees}\u00b0 ${String(minutes).padStart(2, "0")}' ${secondsText}\" ${direction}`
    };
}

function getUtmZone(longitude, latitude) {
    const normalizedLongitude = longitude === 180
        ? 180
        : ((longitude + 180) % 360 + 360) % 360 - 180;
    let zone = normalizedLongitude === 180
        ? 60
        : Math.floor((normalizedLongitude + 180) / 6) + 1;

    // UTM 표준의 노르웨이 및 스발바르 예외 존입니다.
    if (latitude >= 56 && latitude < 64 && normalizedLongitude >= 3 && normalizedLongitude < 12) {
        zone = 32;
    } else if (latitude >= 72 && latitude < 84) {
        if (normalizedLongitude >= 0 && normalizedLongitude < 9) zone = 31;
        else if (normalizedLongitude >= 9 && normalizedLongitude < 21) zone = 33;
        else if (normalizedLongitude >= 21 && normalizedLongitude < 33) zone = 35;
        else if (normalizedLongitude >= 33 && normalizedLongitude < 42) zone = 37;
    }

    return zone;
}

function getLatitudeBand(latitude) {
    const bands = "CDEFGHJKLMNPQRSTUVWXX";
    return bands[Math.min(19, Math.floor((latitude + 80) / 8))];
}

function toGeoref(longitude, latitude, precision) {
    if (!Number.isInteger(precision) || precision < 0 || precision > 5) {
        throw new RangeError("GEOREF precision은 0~5 사이의 정수여야 합니다.");
    }

    const alphabet24 = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const alphabet15 = "ABCDEFGHJKLMNPQ";
    // GEOREF는 남서쪽(-180, -90)을 원점으로 사용합니다.
    const shiftedLongitude = longitude === 180 ? 360 - Number.EPSILON * 360 : longitude + 180;
    const shiftedLatitude = latitude === 90 ? 180 - Number.EPSILON * 180 : latitude + 90;
    const longitude15 = Math.min(23, Math.floor(shiftedLongitude / 15));
    const latitude15 = Math.min(11, Math.floor(shiftedLatitude / 15));
    const longitudeWithin15 = shiftedLongitude - longitude15 * 15;
    const latitudeWithin15 = shiftedLatitude - latitude15 * 15;
    const longitude1 = Math.min(14, Math.floor(longitudeWithin15));
    const latitude1 = Math.min(14, Math.floor(latitudeWithin15));
    const letters = alphabet24[longitude15]
        + alphabet24[latitude15]
        + alphabet15[longitude1]
        + alphabet15[latitude1];

    if (precision === 0) return letters;

    // precision 1~5: 10분, 1분, 0.1분, 0.01분, 0.001분 단위
    const scale = 10 ** (precision - 2);
    const longitudeMinutes = String(
        Math.floor((longitudeWithin15 - longitude1) * 60 * scale)
    ).padStart(precision, "0");
    const latitudeMinutes = String(
        Math.floor((latitudeWithin15 - latitude1) * 60 * scale)
    ).padStart(precision, "0");

    return letters + longitudeMinutes + latitudeMinutes;
}

function setResultText(elementId, text) {
    if (typeof document === "undefined") return;
    const element = document.getElementById(elementId);
    if (element) element.textContent = text;
}

// 다른 스크립트에서 사용할 공개 API입니다.
const CoordinatesConverter = Object.freeze({
    convertCoordinates,
    convertToDMS,
    convertToUTM,
    convertToMGRS,
    convertToGEOREF,
    convertFromUTM,
    convertFromMGRS,
    convertFromGEOREF
});

// <script> 태그로 불러온 브라우저 환경:
// CoordinatesConverter.convertToUTM(126.978, 37.5665)
if (typeof globalThis !== "undefined") {
    globalThis.CoordinatesConverter = CoordinatesConverter;
}

// Node.js/CommonJS 환경:
// const { convertToUTM } = require("./convertCoordinates.js");
if (typeof module !== "undefined" && module.exports) {
    module.exports = CoordinatesConverter;
}
