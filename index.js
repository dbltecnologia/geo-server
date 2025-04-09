// index.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const turf = require('@turf/turf');
const dotenv = require('dotenv');
const normalize = require('normalize-text').default;

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8000;
const STATE_FILE = 'import_status.json';

app.use(express.static('static'));
app.use(bodyParser.json());

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'diego',
  password: process.env.DB_PASSWORD || 'minhasenha',
  database: process.env.DB_NAME || 'ibge',
};

async function waitForDB(config, retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mysql.createConnection({ ...config, database: undefined });
      await conn.end();
      console.log('✔ Banco disponível!');
      return;
    } catch (err) {
      console.log(`⏳ Tentativa ${i + 1}/${retries}: aguardando banco...`, err.message);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error('❌ Falha ao conectar ao banco de dados.');
}

async function initDB() {
  const conn = await mysql.createConnection({ host: dbConfig.host, user: dbConfig.user, password: dbConfig.password });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  await conn.end();
  console.log(`✔ Banco '${dbConfig.database}' garantido.`);
}

function loadGeoJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath));
}

function loadImportState() {
  return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE)) : {};
}

function saveImportState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function populateDB(geojsonData, connection, force = false) {
  const state = force ? {} : loadImportState();
  if (state.populated && !force) {
    console.log('ℹ Banco já populado anteriormente.');
    return;
  }

  const features = geojsonData.features.map((f) => ({
    ...f.properties,
    coords: JSON.stringify(f.geometry.coordinates),
  }));

  await connection.execute('DROP TABLE IF EXISTS faces');
  const keys = Object.keys(features[0]);
  const columns = keys.map((k) => `\`${k}\` TEXT`).join(',');
  await connection.execute(`CREATE TABLE faces (${columns})`);

  for (const row of features) {
    const placeholders = keys.map(() => '?').join(',');
    const values = keys.map((k) => row[k] ?? null);
    try {
      await connection.execute(`INSERT INTO faces (${keys.join(',')}) VALUES (${placeholders})`, values);
    } catch (err) {
      console.error('❌ Erro ao inserir linha:', row, err.message);
    }
  }

  state.populated = true;
  saveImportState(state);
  console.log('✅ Dados importados com sucesso.');
}

app.get('/search', async (req, res) => {
  try {
    const { term, limit = 20, order = 'ASC' } = req.query;
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.query(
      `SELECT * FROM faces WHERE NM_LOG LIKE ? ORDER BY NM_LOG ${order === 'DESC' ? 'DESC' : 'ASC'} LIMIT ?`,
      [`%${term}%`, Number(limit)]
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro /search:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/reverse_full', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM faces');
    await conn.end();

    const userPoint = turf.point([parseFloat(lon), parseFloat(lat)]);
    const nearest = rows.map((r) => {
      const coords = JSON.parse(r.coords);
      const line = turf.lineString(coords);
      const dist = turf.pointToLineDistance(userPoint, line, { units: 'kilometers' });
      return { ...r, dist };
    }).sort((a, b) => a.dist - b.dist)[0];

    res.json(nearest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/suggest', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM faces');
    await conn.end();

    const point = turf.point([parseFloat(lon), parseFloat(lat)]);
    const match = rows.map(r => {
      const line = turf.lineString(JSON.parse(r.coords));
      return { logradouro: r.NM_LOG, dist: turf.pointToLineDistance(point, line, { units: 'meters' }) };
    }).sort((a, b) => a.dist - b.dist)[0];

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/interpolate_number', async (req, res) => {
  try {
    const { id, distance } = req.query;
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM faces WHERE CD_FACE = ?', [id]);
    await conn.end();

    if (rows.length === 0) return res.status(404).json({ error: 'Face não encontrada' });
    const coords = JSON.parse(rows[0].coords);
    const line = turf.lineString(coords);
    const point = turf.along(line, parseFloat(distance), { units: 'kilometers' });
    res.json({ point: point.geometry.coordinates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/normalize_address', async (req, res) => {
  try {
    const { text } = req.query;
    const normalized = normalize(text).replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase();
    res.json({ input: text, normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/nearby_faces', async (req, res) => {
  try {
    const { lat, lon, radius = 0.2 } = req.query;
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM faces');
    await conn.end();

    const point = turf.point([parseFloat(lon), parseFloat(lat)]);
    const filtered = rows.filter(r => {
      const line = turf.lineString(JSON.parse(r.coords));
      return turf.pointToLineDistance(point, line, { units: 'kilometers' }) <= parseFloat(radius);
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/distance', (req, res) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.query;
    const p1 = turf.point([parseFloat(lon1), parseFloat(lat1)]);
    const p2 = turf.point([parseFloat(lon2), parseFloat(lat2)]);
    const dist = turf.distance(p1, p2, { units: 'kilometers' });
    res.json({ distance_km: dist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/route', (req, res) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.query;
    const route = turf.lineString([
      [parseFloat(lon1), parseFloat(lat1)],
      [parseFloat(lon2), parseFloat(lat2)],
    ]);
    res.json({ route });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static/mapa.html'));
});


(async () => {
  try {
    console.log('⌛ Waiting for DB to be ready...');
    await waitForDB(dbConfig);
    console.log('✅ DB is ready.');
    
    console.log('⌛ Initializing DB...');
    await initDB();
    console.log('✅ DB initialized.');
    
    console.log('⌛ Loading GeoJSON data...');
    const geoData = loadGeoJSON(path.resolve('anexo.json'));
    console.log('✅ GeoJSON data loaded.');
    
    console.log('⌛ Creating DB connection...');
    const conn = await mysql.createConnection(dbConfig);
    console.log('✅ DB connection established.');
    
    console.log('⌛ Populating DB...');
    //  await populateDB(geoData, conn, false);
    console.log('✅ DB populated.');
    
    console.log('⌛ Closing DB connection...');
    await conn.end();
    console.log('✅ DB connection closed.');
    
    app.listen(PORT, () => console.log(`🚀 API rodando em http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Erro fatal:', err.message);
    process.exit(1);
  }
})();
