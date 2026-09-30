import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import fileRoutes from './routes/file.routes.js';
import { cleanupService } from './services/cleanup.service.js';

const app = express();

const allowedOrigins = [
  'https://guardian-box-jogg.vercel.app',
  'https://guardian-qrvok1zhm-sujan-ays.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guardian-IV', 'X-Guardian-Salt'],
  exposedHeaders: [
    'X-Guardian-IV',
    'X-Guardian-Salt',
    'X-Guardian-Burned',
    'X-Guardian-Downloads-Count',
    'X-Guardian-Max-Downloads',
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'GuardianBox Blind Storage Server' });
});

// Mounting router at base route prefix /api/files
app.use('/api/files', fileRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'GuardianBox Blind Storage Server',
    version: '1.0.0',
    zeroKnowledge: true,
    storageType: config.storageType,
    time: new Date().toISOString(),
  });
});

cleanupService.start();

const server = app.listen(config.port, () => {
  console.log(`🛡️ GuardianBox Server running on port ${config.port}`);
});

const shutdown = () => {
  cleanupService.stop();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);