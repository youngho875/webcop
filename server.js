
const express = require('express');
const path = require('path');

const app = express();
const port = 8090;

// CesiumJS 및 public 디렉토리를 정적으로 서빙
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules/cesium/Build/Cesium', express.static(path.join(__dirname, '/node_modules/cesium/Build/Cesium')));
app.use('/scripts',  express.static(path.join(__dirname, 'scripts')));
app.use('/Thirdparty',  express.static(path.join(__dirname, 'Thirdparty')));
app.use('/img',  express.static(path.join(__dirname, 'img')));
app.use('/data1', express.static(path.join(__dirname, 'data1')));
app.use('/jsonData', express.static(path.join(__dirname, 'jsonData')));
app.use('/node_modules/milsymbol/dist', express.static(path.join(__dirname, '/node_modules/milsymbol/dist')));
app.use('/node_modules/proj4/dist', express.static(path.join(__dirname, '/node_modules/proj4/dist')));
app.use('/node_modules/mgrs/dist', express.static(path.join(__dirname, '/node_modules/mgrs/dist')));

app.get('/', function (reg, res) {
    res.sendFile(path.join(__dirname, 'cop', 'main.html'));
});

app.get('/symbol', function (reg, res) {
    res.sendFile(path.join(__dirname, 'cop', 'symbol.html'));
});


// 서버 실행
app.listen(port, () => {
    console.log(`Cesium app running at http://localhost:${port}`);
});