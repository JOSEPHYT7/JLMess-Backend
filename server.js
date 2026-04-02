const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Initialize Automated Cron Tasks
const initCronTasks = require('./cronTasks');
initCronTasks();

const app = express();

// Security
app.use(helmet());

const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10kb' }));

// HTTP + Socket.io server
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.set('socketio', io);

io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/config', require('./routes/systemConfigRoutes'));

// Health check
app.get('/', (req, res) => res.json({ status: 'running', mode: process.env.NODE_ENV }));

// Error handling
app.use(notFound);
app.use(errorHandler);

// Prevent crashes from unhandled errors
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err.message);
});

const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.\nRun this to fix it: powershell -Command "Get-Process -Name node | Stop-Process -Force"\nThen restart with: npm run dev\n`);
        process.exit(1);
    } else {
        throw err;
    }
});

server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT} [${process.env.NODE_ENV} mode]`);
});
