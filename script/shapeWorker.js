/* global importScripts, shp */
importScripts('/node_modules/shpjs/dist/shp.min.js');

async function fetchPart(baseUrl, extension, type, required = false) {
    const response = await fetch(`${baseUrl}.${extension}`);
    if (!response.ok) {
        if (!required && response.status === 404) return undefined;
        throw new Error(`${extension.toUpperCase()} 요청 실패 (${response.status})`);
    }
    return type === 'text' ? response.text() : response.arrayBuffer();
}

self.addEventListener('message', async event => {
    const { layerName, baseUrl } = event.data || {};
    try {
        const [shpBuffer, dbfBuffer, prjText, cpgText] = await Promise.all([
            fetchPart(baseUrl, 'shp', 'buffer', true),
            fetchPart(baseUrl, 'dbf', 'buffer'),
            fetchPart(baseUrl, 'prj', 'text'),
            fetchPart(baseUrl, 'cpg', 'text')
        ]);
        const geoJson = await shp({ shp: shpBuffer, dbf: dbfBuffer, prj: prjText, cpg: cpgText });
        self.postMessage({ ok: true, layerName, geoJson });
    } catch (error) {
        self.postMessage({ ok: false, layerName, error: error.message || String(error) });
    }
});
