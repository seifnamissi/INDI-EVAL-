const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '..', 'database.sqlite');
let resolveDatabaseReady;
const databaseReady = new Promise((resolve) => {
    resolveDatabaseReady = resolve;
});
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                team TEXT NOT NULL
            )
        `, (err) => {
            if (err) console.error('Error creating candidates table:', err.message);
        });

        db.get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'candidates'", [], (schemaErr, table) => {
            const candidatesSql = String(table?.sql || '').replace(/\s+/g, ' ').toUpperCase();
            const hasUniqueParticipantName = /NAME TEXT (?:NOT NULL UNIQUE|UNIQUE NOT NULL)/.test(candidatesSql);
            if (schemaErr || !table?.sql || !hasUniqueParticipantName) {
                resolveDatabaseReady();
                return;
            }
            db.serialize(() => {
                db.run('DROP TABLE IF EXISTS candidates_migrated');
                db.run(`CREATE TABLE candidates_migrated (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    team TEXT NOT NULL
                )`);
                db.run('INSERT INTO candidates_migrated (id, name, team) SELECT id, name, team FROM candidates');
                db.run('DROP TABLE candidates');
                db.run('ALTER TABLE candidates_migrated RENAME TO candidates', (migrationErr) => {
                    if (migrationErr) console.error('Error migrating candidates table:', migrationErr.message);
                    resolveDatabaseReady();
                });
            });
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )
        `, (err) => {
            if (err) console.error('Error creating teams table:', err.message);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS juries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                team TEXT NOT NULL,
                accessCode TEXT UNIQUE
            )
        `, (err) => {
            if (err) console.error('Error creating juries table:', err.message);
        });

        db.get("PRAGMA table_info(juries)", [], (err, row) => {
            if (err) {
                console.error('Error reading juries table schema:', err.message);
                return;
            }
            db.all("PRAGMA table_info(juries)", [], (schemaErr, columns) => {
                if (schemaErr) {
                    console.error('Error reading juries table schema:', schemaErr.message);
                    return;
                }
                const hasAccessCode = Array.isArray(columns) && columns.some(column => column.name === 'accessCode');
                if (!hasAccessCode) {
                    db.run('ALTER TABLE juries ADD COLUMN accessCode TEXT', (alterErr) => {
                        if (alterErr && !String(alterErr.message).includes('duplicate column name')) {
                            console.error('Error adding accessCode column to juries table:', alterErr.message);
                            return;
                        }
                        db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_juries_accessCode ON juries(accessCode)', (indexErr) => {
                            if (indexErr) {
                                console.error('Error creating juries accessCode index:', indexErr.message);
                            }
                        });
                    });
                } else {
                    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_juries_accessCode ON juries(accessCode)', (indexErr) => {
                        if (indexErr) {
                            console.error('Error creating juries accessCode index:', indexErr.message);
                        }
                    });
                }
            });
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                juryName TEXT NOT NULL,
                candidate TEXT NOT NULL,
                team TEXT NOT NULL,
                section TEXT,
                criterion TEXT,
                score INTEGER,
                UNIQUE(juryName, candidate, criterion)
            )
        `, (err) => {
            if (err) console.error('Error creating scores table:', err.message);
            db.all('PRAGMA table_info(scores)', [], (schemaErr, columns) => {
                if (schemaErr) {
                    console.error('Error reading scores table schema:', schemaErr.message);
                    return;
                }
                if (!columns.some(column => column.name === 'comment')) {
                    db.run('ALTER TABLE scores ADD COLUMN comment TEXT', (alterErr) => {
                        if (alterErr) console.error('Error adding score comments:', alterErr.message);
                    });
                }
            });
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS evaluation_locks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team TEXT NOT NULL UNIQUE,
                accessCode TEXT NOT NULL,
                juryName TEXT NOT NULL,
                startedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating evaluation_locks table:', err.message);
            else console.log('Tables created or already exist.');
        });
    });
}

db.ready = databaseReady;
module.exports = db;
