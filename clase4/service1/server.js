const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const morgan = require('morgan');
const cors = require('cors');

const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/postsdb';
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// MongoDB
mongoose.connect(MONGO_URL, { })
  .then(() => console.log('[DB] Conectado a MongoDB'))
  .catch(err => { console.error('[DB] Error:', err.message); process.exit(1); });

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// Redis
const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
redis.on('connect', () => console.log('[Redis] Conectado'));
redis.on('error', (e) => console.error('[Redis] Error', e.message));

const KEY_ALL = 'posts:all';
const KEY_ONE = (id) => `posts:${id}`;

// Health
app.get('/api/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    await redis.ping();
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// GET /api/posts - lista con cache
app.get('/api/posts', async (req, res) => {
  try {
    const cached = await redis.get(KEY_ALL);
    if (cached) {
      console.log('Cache HIT: /api/posts');
      return res.json({ source: 'cache', data: JSON.parse(cached) });
    }
    console.log('Cache MISS: /api/posts');
    const posts = await Post.find().sort({ createdAt: -1 }).lean();
    await redis.set(KEY_ALL, JSON.stringify(posts), 'EX', 60); // TTL 60s
    res.json({ source: 'database', data: posts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/posts/:id - detalle con cache
app.get('/api/posts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const key = KEY_ONE(id);
    const cached = await redis.get(key);
    if (cached) {
      console.log('Cache HIT: /api/posts/:id');
      return res.json({ source: 'cache', data: JSON.parse(cached) });
    }
    console.log('Cache MISS: /api/posts/:id');
    const post = await Post.findById(id).lean();
    if (!post) return res.status(404).json({ error: 'Not found' });
    await redis.set(key, JSON.stringify(post), 'EX', 120);
    res.json({ source: 'database', data: post });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/posts - crear y invalidar cache
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
    const doc = await Post.create({ title, content });

    // invalidar caches relevantes
    await redis.del(KEY_ALL);
    await redis.del(KEY_ONE(doc._id.toString()));

    res.status(201).json({ ok: true, id: doc._id, data: doc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Seed simple si no hay posts
app.post('/api/seed', async (req, res) => {
  const count = await Post.countDocuments();
  if (count > 0) return res.json({ ok: true, message: 'ya existen posts' });
  const demo = await Post.create([
    { title: 'Hola Mundo', content: 'Primer post con cache y gateway.' },
    { title: 'Microservicios', content: 'Docker, Nginx, Redis y Mongo.' }
  ]);
  await redis.del(KEY_ALL);
  res.json({ ok: true, inserted: demo.length });
});

app.listen(PORT, () => console.log(`[API] Escuchando en puerto ${PORT}`));
