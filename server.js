
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const http = require('http');
const { spawn } = require('child_process');
const mqtt = require('mqtt');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const port = Number(process.env.PORT) || 8090;
const favoritesFile = path.join(__dirname, 'jsonData', 'favorites.json');
const shapeDataPath = path.join(__dirname, 'shape-data');
const server = http.createServer(app);
const gpsWebSocketServer = new WebSocketServer({ server, path: '/gps-ws' });
const gpsWebSocketServers = new Set([gpsWebSocketServer]);
let customWebSocketHttpServer = null;
let customGpsWebSocketServer = null;
let customWebSocketConfig = null;

function normalizeGpsData(source, input, fallbackDeviceId) {
  const latitude = Number(input?.latitude ?? input?.lat);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng);
  const altitude = Number(input?.altitude ?? input?.height ?? 0);
  const speed = Number(input?.speed ?? 0);
  const heading = Number(input?.heading ?? input?.course ?? 0);
  const parsedTimestamp = new Date(input?.timestamp ?? Date.now()).getTime();
  const deviceId = String(input?.deviceId ?? input?.id ?? fallbackDeviceId ?? '').trim();
  const ratKey = String(input?.rat ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const ratNames = {
    '5g': '5G',
    d2d: 'D2D',
    'x위성': 'X위성',
    'l위성': 'L위성'
  };
  const rat = ratNames[ratKey] || '';

  if (!deviceId || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return {
    type: 'gps', source, deviceId, rat, latitude, longitude,
    altitude: Number.isFinite(altitude) ? altitude : 0,
    speed: Number.isFinite(speed) ? speed : 0,
    heading: Number.isFinite(heading) ? heading : 0,
    timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now()
  };
}

function broadcastGps(data) {
  const payload = JSON.stringify(data);
  gpsWebSocketServers.forEach(webSocketServer => {
    webSocketServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  });
}

function attachGpsWebSocketServer(webSocketServer) {
  webSocketServer.on('connection', socket => {
    socket.send(JSON.stringify({ type: 'connection', ok: true }));
    socket.on('message', raw => {
      try {
        const gps = normalizeGpsData('websocket', JSON.parse(raw.toString()));
        if (!gps) return socket.send(JSON.stringify({ type: 'error', error: '잘못된 GPS 데이터입니다.' }));
        broadcastGps(gps);
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: 'JSON 형식을 확인하세요.' }));
      }
    });
  });
}

attachGpsWebSocketServer(gpsWebSocketServer);

function stopCustomWebSocketServer() {
  const httpServer = customWebSocketHttpServer;
  const webSocketServer = customGpsWebSocketServer;
  customWebSocketHttpServer = null;
  customGpsWebSocketServer = null;
  customWebSocketConfig = null;
  if (webSocketServer) {
    gpsWebSocketServers.delete(webSocketServer);
    webSocketServer.clients.forEach(client => client.terminate());
    webSocketServer.close();
  }
  return new Promise(resolve => {
    if (!httpServer?.listening) return resolve();
    httpServer.close(() => resolve());
  });
}

function normalizeWebSocketPath(value) {
  const pathText = String(value || 'ws').trim().replace(/^\/+|\/+$/g, '');
  if (!pathText || pathText.length > 200 || !/^[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/.test(pathText)) return null;
  return `/${pathText}`;
}

const mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
const mqttTopic = process.env.MQTT_TOPIC || 'gps/+/location';
const mqttClient = mqtt.connect(mqttUrl, { reconnectPeriod: 5000 });
let lastMqttErrorLogAt = 0;

mqttClient.on('connect', () => {
  mqttClient.subscribe(mqttTopic, { qos: 1 }, error => {
    if (error) console.error('[MQTT] 구독 실패:', error.message);
    else console.log(`[MQTT] ${mqttUrl} / ${mqttTopic} 구독 중`);
  });
});
mqttClient.on('message', (topic, raw) => {
  try {
    const topicDeviceId = topic.split('/')[1];
    const gps = normalizeGpsData('mqtt', JSON.parse(raw.toString()), topicDeviceId);
    if (gps) broadcastGps(gps);
  } catch (error) {
    console.warn(`[MQTT] ${topic} 메시지 처리 실패:`, error.message);
  }
});
mqttClient.on('error', error => {
  const now = Date.now();
  if (now - lastMqttErrorLogAt < 30000) return;
  lastMqttErrorLogAt = now;
  console.warn('[MQTT] 연결 오류:', error.message || error.code || '브로커에 연결할 수 없습니다.');
});

app.use(express.json({ limit: '100kb' }));

app.get('/api/websocket/status', (req, res) => {
  res.json({ running: Boolean(customWebSocketHttpServer?.listening), config: customWebSocketConfig });
});

app.post('/api/websocket/start', async (req, res) => {
  const host = String(req.body?.host || '').trim();
  const customPort = Number(req.body?.port);
  const socketPath = normalizeWebSocketPath(req.body?.path);
  if (!host || host.length > 255 || /[:/\\\s]/.test(host) ||
      !Number.isInteger(customPort) || customPort < 1 || customPort > 65535 || !socketPath) {
    return res.status(400).json({ error: 'IP, 포트 번호 또는 경로를 확인하세요.' });
  }

  try {
    await stopCustomWebSocketServer();
    const httpServer = http.createServer();
    const webSocketServer = new WebSocketServer({ server: httpServer, path: socketPath });
    attachGpsWebSocketServer(webSocketServer);
    customWebSocketHttpServer = httpServer;
    customGpsWebSocketServer = webSocketServer;
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(customPort, host, resolve);
    });
    customWebSocketConfig = { host, port: customPort, path: socketPath };
    gpsWebSocketServers.add(webSocketServer);
    res.json({ running: true, url: `ws://${host}:${customPort}${socketPath}` });
  } catch (error) {
    console.error('[WebSocket 서버] 시작 실패:', error);
    await stopCustomWebSocketServer();
    res.status(500).json({ error: `WebSocket 서버를 시작할 수 없습니다: ${error.message}` });
  }
});

app.post('/api/websocket/stop', async (req, res) => {
  await stopCustomWebSocketServer();
  res.json({ running: false });
});

app.get('/api/favorites', async (req, res) => {
  try {
    const raw = await fs.readFile(favoritesFile, 'utf8');
    const data = JSON.parse(raw);
    res.json({ favorites: Array.isArray(data.favorites) ? data.favorites : [] });
  } catch (error) {
    if (error.code === 'ENOENT') return res.json({ favorites: [] });
    console.error('즐겨찾기 JSON 읽기 실패:', error);
    res.status(500).json({ error: '즐겨찾기 데이터를 읽지 못했습니다.' });
  }
});

app.get('/api/original-shapes', async (req, res) => {
  try {
    const entries = await fs.readdir(shapeDataPath, { withFileTypes: true });
    const names = entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.shp'))
      .map(entry => entry.name.slice(0, -4))
      .sort((left, right) => left.localeCompare(right));
    const layers = await Promise.all(names.map(async name => {
      const info = await fs.stat(path.join(shapeDataPath, `${name}.shp`));
      return { name, size: info.size };
    }));
    res.json({ layers });
  } catch (error) {
    console.error('원본 SHAPE 목록 읽기 실패:', error);
    res.status(500).json({ error: '원본 SHAPE 목록을 읽지 못했습니다.' });
  }
});

app.get('/api/local-shapes/:layerName', async (req, res) => {
  const layerName = String(req.params.layerName || '');
  if (!/^[A-Za-z0-9_-]+$/.test(layerName)) {
    return res.status(400).json({ error: '올바른 SHAPE 레이어명이 아닙니다.' });
  }

  const bbox = String(req.query.bbox || '').split(',').map(Number);
  if (bbox.length !== 4 || bbox.some(value => !Number.isFinite(value)) ||
      bbox[0] >= bbox[2] || bbox[1] >= bbox[3] ||
      bbox[0] < -180 || bbox[2] > 180 || bbox[1] < -90 || bbox[3] > 90) {
    return res.status(400).json({ error: 'bbox=minLon,minLat,maxLon,maxLat 형식을 확인하세요.' });
  }

  const shapeFile = path.join(shapeDataPath, `${layerName}.shp`);
  try {
    await fs.access(shapeFile);
  } catch {
    return res.status(404).json({ error: `${layerName}.shp 파일을 찾을 수 없습니다.` });
  }

  const ogr2ogr = process.env.OGR2OGR_PATH || 'ogr2ogr';
  const args = [
    '-f', 'GeoJSON', '/vsistdout/', shapeFile,
    '-spat', ...bbox.map(String),
    '-spat_srs', 'EPSG:4326',
    '-t_srs', 'EPSG:4326',
    '-lco', 'RFC7946=YES'
  ];
  const ogr = spawn(ogr2ogr, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const output = [];
  const errors = [];
  let outputSize = 0;
  let finished = false;
  let responseTooLarge = false;
  let spawnFailed = false;
  const maximumResponseBytes = 128 * 1024 * 1024;

  const stop = () => {
    if (!finished && !ogr.killed) ogr.kill('SIGTERM');
  };
  req.once('aborted', stop);
  res.once('close', () => {
    if (!res.writableEnded) stop();
  });
  const timeout = setTimeout(stop, 120000);

  ogr.stdout.on('data', chunk => {
    if (responseTooLarge) return;
    outputSize += chunk.length;
    if (outputSize > maximumResponseBytes) {
      responseTooLarge = true;
      errors.push(Buffer.from('조회 결과가 128MB를 초과했습니다. 지도를 확대해 주세요.'));
      stop();
      return;
    }
    output.push(chunk);
  });
  ogr.stderr.on('data', chunk => errors.push(chunk));
  ogr.on('error', error => {
    spawnFailed = true;
    errors.push(Buffer.from(error.message));
  });
  ogr.on('close', code => {
    finished = true;
    clearTimeout(timeout);
    if (res.headersSent || res.writableEnded) return;
    if (code !== 0 || spawnFailed || responseTooLarge) {
      const detail = Buffer.concat(errors).toString('utf8').trim();
      console.error(`[SHAPE bbox] ${layerName} 조회 실패:`, detail || `종료 코드 ${code}`);
      return res.status(500).json({
        error: detail.includes('128MB')
          ? detail
          : '영역 SHAPE 데이터를 생성하지 못했습니다. GDAL(ogr2ogr) 설치와 경로를 확인하세요.'
      });
    }
    res.set('Cache-Control', 'no-store');
    res.type('application/geo+json').send(Buffer.concat(output));
  });
});

app.post('/api/favorites/append', async (req, res) => {
  const favorite = {
    id: String(req.body?.id || `favorite-${Date.now()}`),
    name: String(req.body?.name || '').trim(),
    longitude: Number(req.body?.longitude),
    latitude: Number(req.body?.latitude)
  };
  if (!favorite.name || !Number.isFinite(favorite.longitude) || !Number.isFinite(favorite.latitude) || Math.abs(favorite.longitude) > 180 || Math.abs(favorite.latitude) > 90) {
    return res.status(400).json({ error: '명칭, 경도, 위도 값을 확인하세요.' });
  }
  try {
    let favorites = [];
    try {
      const current = JSON.parse(await fs.readFile(favoritesFile, 'utf8'));
      favorites = Array.isArray(current.favorites) ? current.favorites : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    favorites.push(favorite);
    await fs.mkdir(path.dirname(favoritesFile), { recursive: true });
    const temporaryFile = `${favoritesFile}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify({ favorites }, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, favoritesFile);
    res.json({ ok: true, favorite, favorites });
  } catch (error) {
    console.error('즐겨찾기 JSON 추가 실패:', error);
    res.status(500).json({ error: '즐겨찾기를 JSON 파일에 추가하지 못했습니다.' });
  }
});

app.post('/api/favorites', async (req, res) => {
  const source = req.body?.favorites;
  if (!Array.isArray(source) || source.length > 1000) return res.status(400).json({ error: '올바른 즐겨찾기 목록이 아닙니다.' });
  const favorites = source.map((item, index) => ({
    id: String(item.id || `favorite-${Date.now()}-${index}`),
    name: String(item.name || '').trim(),
    longitude: Number(item.longitude),
    latitude: Number(item.latitude)
  }));
  const invalid = favorites.some(item => !item.name || !Number.isFinite(item.longitude) || !Number.isFinite(item.latitude) || Math.abs(item.longitude) > 180 || Math.abs(item.latitude) > 90);
  if (invalid) return res.status(400).json({ error: '명칭, 경도, 위도 값을 확인하세요.' });
  try {
    await fs.mkdir(path.dirname(favoritesFile), { recursive: true });
    const temporaryFile = `${favoritesFile}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify({ favorites }, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, favoritesFile);
    res.json({ ok: true, favorites });
  } catch (error) {
    console.error('즐겨찾기 JSON 저장 실패:', error);
    res.status(500).json({ error: '즐겨찾기 데이터를 저장하지 못했습니다.' });
  }
});

//app.use('/scripts', express.static('public/scripts'));

// CesiumJS는 'node_modules' 안에 설치되며, 이를 정적 경로로 설정
app.use('/node_modules/cesium/Build/Cesium', express.static(path.join(__dirname, 'node_modules/cesium/Build/Cesium')));
app.use('/script', express.static(path.join(__dirname, 'script')));
app.use('/ThirdParty', express.static(path.join(__dirname, 'ThirdParty')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/icops', express.static(path.join(__dirname, 'icops')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/object', express.static(path.join(__dirname, 'object')));
app.use('/jsonData', express.static(path.join(__dirname, 'jsonData')));
app.use('/node_modules/milsymbol/dist', express.static(path.join(__dirname, 'node_modules/milsymbol/dist')));
app.use(
  '/node_modules/@armyc2.c5isr.renderer/mil-sym-ts-web',
  express.static(path.join(__dirname, 'node_modules/@armyc2.c5isr.renderer/mil-sym-ts-web'))
);
app.use('/node_modules/vue/dist', express.static(path.join(__dirname, 'node_modules/vue/dist')));
app.use('/node_modules/proj4/dist', express.static(path.join(__dirname, 'node_modules/proj4/dist')));
app.use('/node_modules/mgrs/dist', express.static(path.join(__dirname, 'node_modules/mgrs/dist')));
app.use('/node_modules/geotiff/dist-browser', express.static(path.join(__dirname, 'node_modules/geotiff/dist-browser')));
app.use('/node_modules/d3/dist', express.static(path.join(__dirname, 'node_modules/d3/dist')));
app.use('/node_modules/shpjs/dist', express.static(path.join(__dirname, 'node_modules/shpjs/dist')));
app.use('/shape-data', express.static(shapeDataPath, { index: false }));
app.use('/NaturalEarthII', express.static(path.join(__dirname, 'NaturalEarthII')));
const offlineColorImageryPath = path.join(__dirname, 'local-imagery', 'stand-color');
app.use('/offline-color-imagery', express.static(offlineColorImageryPath, { index: false }));
app.get('/api/offline-color-imagery', async (req, res) => {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(offlineColorImageryPath, 'manifest.json'), 'utf8'));
    res.json({
      available: true,
      name: manifest.name || 'Stand 컬러영상',
      bounds: manifest.bounds,
      minimumLevel: manifest.minimumLevel,
      maximumLevel: manifest.maximumLevel,
      url: '/offline-color-imagery/{z}/{x}/{y}.png'
    });
  } catch (error) {
    if (error.code === 'ENOENT') return res.json({ available: false });
    res.status(500).json({ error: '오프라인 컬러영상 정보를 읽지 못했습니다.' });
  }
});


// 기본 페이지로 리디렉션
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'cop', 'index.html'));
});

//app.get('/sample', function (reg, res) {
//    res.sendFile(path.join(__dirname, 'cop', 'sample.html'));
//});

app.get('/symbol', function (reg, res) {
    res.sendFile(path.join(__dirname, 'cop', 'symbol.html'));
});

/*
server.listen(port, '0.0.0.0', () => {
console.log(`Cesium development server running at http://192.168.0.32:${port}`);
console.log(`GPS WebSocket endpoint: ws://192.168.0.32:${port}/gps-ws`);
*/

server.listen(port, '127.0.0.1', () => {
console.log(`Cesium development server running at http://localhost:${port}`);
console.log(`GPS WebSocket endpoint: ws://localhost:${port}/gps-ws`);

});
