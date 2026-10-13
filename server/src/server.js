const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// The database module now handles its own initialization synchronously.
// If it fails, it will throw an error and stop the process.
const db = require('./database'); 

const evaluationRoutes = require('./routes/evaluationRoutes');
const { saveScoreSubmission, getDashboardResults, ensureJuryAccessCode } = require('./controllers/evaluationController');

const app = express();
const server = http.createServer(app);

// Setup CORS - This must be configured before your routes.
// Allow CORS from any origin (for LAN access). For production, restrict origins.
app.use(cors({
    origin: true
}));

// Middlewares
app.use(express.json()); // Crucial for parsing JSON bodies from requests

// API Routes
app.use('/api', evaluationRoutes);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

const clientBuildPath = path.join(__dirname, '../../client/build');
const clientIndexPath = path.join(clientBuildPath, 'index.html');
const hasClientBuild = fs.existsSync(clientIndexPath);

if (hasClientBuild) {
    app.use(express.static(clientBuildPath));
}

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }

    if (hasClientBuild) {
        return res.sendFile(clientIndexPath);
    }

    const clientPort = process.env.CLIENT_PORT || 5001;
    const devClientHost = `${req.protocol}://${req.hostname}:${clientPort}`;
    return res.redirect(`${devClientHost}${req.originalUrl}`);
});

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('A user connected via WebSocket');
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('submitScore', async (data) => {
        try {
            await saveScoreSubmission(data);
            const results = await getDashboardResults();
            io.emit('updateResults', results);
            io.emit('results_updated', results);
        } catch (error) {
            console.error('Failed to save score submission:', error.message);
            socket.emit('score_error', { error: error.message });
        }
    });
});

// Make io accessible to other modules, like our controllers.
// This allows controllers to emit events.
app.set('socketio', io);


const PORT = process.env.PORT || 5000;

// Listen on all network interfaces so other devices on the LAN can reach the server.
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (listening on 0.0.0.0).`);
    console.log('The application is now ready.');

    // Print local LAN addresses for convenience
    try {
        const os = require('os');
        const ifaces = os.networkInterfaces();
        Object.keys(ifaces).forEach((ifname) => {
            ifaces[ifname].forEach((iface) => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(`Accessible at: http://${iface.address}:${PORT}`);
                }
            });
        });
    } catch (e) {
        // ignore
    }
});

ensureJuryAccessCode().catch((err) => {
    console.error('Failed to ensure jury access codes:', err.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server shut down.');
        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Database connection closed.');
            process.exit(0);
        });
    });
});
