
const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const port = 8090;
const favoritesFile = path.join(__dirname, 'jsonData', 'favorites.json');

app.use(express.json({ limit: '100kb' }));

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
app.use('/data1', express.static(path.join(__dirname, 'data1')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/object', express.static(path.join(__dirname, 'object')));
app.use('/jsonData', express.static(path.join(__dirname, 'jsonData')));
app.use('/node_modules/milsymbol/dist', express.static(path.join(__dirname, 'node_modules/milsymbol/dist')));
app.use('/node_modules/vue/dist', express.static(path.join(__dirname, 'node_modules/vue/dist')));
app.use('/node_modules/proj4/dist', express.static(path.join(__dirname, 'node_modules/proj4/dist')));
app.use('/node_modules/mgrs/dist', express.static(path.join(__dirname, 'node_modules/mgrs/dist')));


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

app.listen(port, () => {
  console.log(`Cesium development server running at http://localhost:${port}`);
});
