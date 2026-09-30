import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import fileRoutes from './routes/file.routes.js';
import { cleanupService } from './services/cleanup.service.js';

const app = express();

// Allowed origins setup
const allowedOrigins = [
  'https://guardian-qrvok1zhm-sujan-ays.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Allow matching origins or any Vercel preview deployment for this project
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
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Root route handler to satisfy Render root health pings (avoids 404s in logs)
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'GuardianBox Blind Storage Server' });
});

// API Routes (Upload endpoint will be POST /api/upload or POST /api/files)
app.use('/api', fileRoutes);

// Health check endpoint
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

// Start cleanup background worker
cleanupService.start();

const server = app.listen(config.port, () => {
  console.log('====================================================');
  console.log(`🛡️  GuardianBox Blind Server running on port ${config.port}`);
  console.log(`🔒 Zero-Knowledge Architecture active`);
  console.log(`📦 Storage backend: ${config.storageType.toUpperCase()}`);
  console.log(`🌐 Health check: http://localhost:${config.port}/api/health`);
  console.log('====================================================');
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Server] Shutting down gracefully...');
  cleanupService.stop();
  server.close(() => {
    console.log('[Server] Closed all connections.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);