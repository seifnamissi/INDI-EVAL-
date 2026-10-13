const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../database');
const evaluationModeFilePath = path.join(__dirname, '..', 'evaluation-mode.json');

const getStoredEvaluationMode = () => {
    try {
        const stored = JSON.parse(fs.readFileSync(evaluationModeFilePath, 'utf8'));
        return stored.mode === 'collective' ? 'collective' : 'teams';
    } catch (error) {
        return 'teams';
    }
};

const getEvaluationLockScope = (team, accessCode, mode = getStoredEvaluationMode()) => (
    mode === 'collective' ? `__COLLECTIVE__:${String(accessCode || '').toUpperCase()}` : team
);

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) {
            reject(err);
            return;
        }
        resolve(this);
    });
});

const getAllAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) {
            reject(err);
            return;
        }
        resolve(rows || []);
    });
});

const generateJuryAccessCode = (juryName) => {
    const normalizedJury = String(juryName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
    return `INDIGO-${normalizedJury || 'JURY'}`.toUpperCase();
};

const getUniqueJuryAccessCode = async (juryName, juryId = null) => {
    const baseCode = generateJuryAccessCode(juryName);
    let candidateCode = baseCode;
    let suffix = 2;

    while (true) {
        const rows = await getAllAsync(
            'SELECT id FROM juries WHERE accessCode = ? AND (? IS NULL OR id != ?)',
            [candidateCode, juryId, juryId]
        );

        if (rows.length === 0) {
            return candidateCode;
        }

        candidateCode = `${baseCode}-${suffix}`;
        suffix += 1;
    }
};

const ensureJuryAccessCode = async () => {
    const juries = await getAllAsync('SELECT id, name, accessCode FROM juries ORDER BY team ASC, name ASC, id ASC');
    for (const jury of juries) {
        const code = await getUniqueJuryAccessCode(jury.name, jury.id);
        if (jury.accessCode !== code) {
            await runAsync('UPDATE juries SET accessCode = ? WHERE id = ?', [code, jury.id]);
        }
    }
};

const getParticipants = (req, res) => {
    db.all("SELECT * FROM candidates", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: "success",
            data: rows || []
        });
    });
};

const getTeams = (req, res) => {
    db.all("SELECT * FROM teams ORDER BY name ASC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'success', data: rows || [] });
    });
};

const addTeam = (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
    }

    db.run('INSERT INTO teams (name) VALUES (?)', [name], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Team already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'success', id: this.lastID });
    });
};

const updateTeam = (req, res) => {
    const { name } = req.body;
    const teamId = req.params.id;

    if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
    }

    db.get('SELECT * FROM teams WHERE id = ?', [teamId], (findErr, teamRow) => {
        if (findErr) {
            return res.status(500).json({ error: findErr.message });
        }
        if (!teamRow) {
            return res.status(404).json({ error: 'Team not found' });
        }

        db.get('SELECT * FROM teams WHERE name = ? AND id != ?', [name, teamId], (duplicateErr, duplicateRow) => {
            if (duplicateErr) {
                return res.status(500).json({ error: duplicateErr.message });
            }
            if (duplicateRow) {
                return res.status(409).json({ error: 'Team already exists' });
            }

            const previousName = teamRow.name;

            db.serialize(() => {
                db.run('UPDATE teams SET name = ? WHERE id = ?', [name, teamId], function (updateErr) {
                    if (updateErr) {
                        return res.status(500).json({ error: updateErr.message });
                    }

                    db.run('UPDATE candidates SET team = ? WHERE team = ?', [name, previousName], (participantsErr) => {
                        if (participantsErr) {
                            return res.status(500).json({ error: participantsErr.message });
                        }

                        db.run('UPDATE juries SET team = ? WHERE team = ?', [name, previousName], (juriesErr) => {
                            if (juriesErr) {
                                return res.status(500).json({ error: juriesErr.message });
                            }

                                db.run('UPDATE scores SET team = ? WHERE team = ?', [name, previousName], async (scoresErr) => {
                                    if (scoresErr) {
                                        return res.status(500).json({ error: scoresErr.message });
                                    }

                                    try {
                                        const juriesForTeam = await getAllAsync('SELECT id, name FROM juries WHERE team = ?', [name]);
                                        for (const jury of juriesForTeam) {
                                            const juryCode = await getUniqueJuryAccessCode(jury.name, jury.id);
                                            await runAsync('UPDATE juries SET accessCode = ? WHERE id = ?', [juryCode, jury.id]);
                                        }

                                        const updatedJuryCode = juriesForTeam.length > 0
                                            ? await getUniqueJuryAccessCode(juriesForTeam[0].name, juriesForTeam[0].id)
                                            : null;

                                        res.json({ message: 'updated', id: Number(teamId), previousName, name, accessCode: updatedJuryCode });
                                    } catch (codeErr) {
                                        return res.status(500).json({ error: codeErr.message });
                                    }
                                });
                        });
                    });
                });
            });
        });
    });
};

const deleteTeam = (req, res) => {
    const teamId = req.params.id;

    db.get('SELECT * FROM teams WHERE id = ?', [teamId], (findErr, teamRow) => {
        if (findErr) {
            return res.status(500).json({ error: findErr.message });
        }
        if (!teamRow) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const teamName = teamRow.name;

        db.serialize(() => {
            db.run('DELETE FROM candidates WHERE team = ?', [teamName], (participantsErr) => {
                if (participantsErr) {
                    return res.status(500).json({ error: participantsErr.message });
                }

                db.run('DELETE FROM juries WHERE team = ?', [teamName], (juriesErr) => {
                    if (juriesErr) {
                        return res.status(500).json({ error: juriesErr.message });
                    }

                    db.run('DELETE FROM scores WHERE team = ?', [teamName], (scoresErr) => {
                        if (scoresErr) {
                            return res.status(500).json({ error: scoresErr.message });
                        }

                        db.run('DELETE FROM teams WHERE id = ?', [teamId], function (deleteErr) {
                            if (deleteErr) {
                                return res.status(500).json({ error: deleteErr.message });
                            }
                            res.json({ message: 'deleted', changes: this.changes, removedTeamName: teamName });
                        });
                    });
                });
            });
        });
    });
};

const getJuries = (req, res) => {
    ensureJuryAccessCode()
        .then(() => {
            db.all("SELECT * FROM juries ORDER BY name ASC", [], (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({
                    message: 'success',
                    data: (rows || []).map((jury) => ({
                        ...jury,
                        accessCode: jury.accessCode || generateJuryAccessCode(jury.name)
                    }))
                });
            });
        })
        .catch((err) => res.status(500).json({ error: err.message }));
};

const getJuryByCode = (req, res) => {
    const { code } = req.params;
    const normalizedCode = String(code || '').trim().toUpperCase();

    if (!normalizedCode) {
        return res.status(400).json({ error: 'Code is required' });
    }

    ensureJuryAccessCode()
        .then(() => {
            db.get('SELECT * FROM juries WHERE accessCode = ?', [normalizedCode], async (err, row) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                if (!row) {
                    return res.status(404).json({ error: 'Invalid code' });
                }

                try {
                    const evaluationMode = getStoredEvaluationMode();
                    const lockScope = getEvaluationLockScope(row.team, row.accessCode, evaluationMode);
                    const activeLocks = await getAllAsync(
                        'SELECT * FROM evaluation_locks WHERE team = ? ORDER BY startedAt DESC LIMIT 1',
                        [lockScope]
                    );

                    if (activeLocks.length > 0) {
                        const activeLock = activeLocks[0];
                        const sameJury = String(activeLock.accessCode || '').toUpperCase() === normalizedCode;

                        if (!sameJury) {
                            return res.status(409).json({
                                error: `Une évaluation est déjà en cours pour l'équipe ${row.team}.`,
                                activeLock: activeLock
                            });
                        }
                    }

                    res.json({
                        message: 'success',
                        data: {
                            id: row.id,
                            name: row.name,
                            team: row.team,
                            accessCode: row.accessCode,
                            evaluationMode
                        }
                    });
                } catch (lockErr) {
                    return res.status(500).json({ error: lockErr.message });
                }
            });
        })
        .catch((err) => res.status(500).json({ error: err.message }));
};

const addJury = (req, res) => {
    const { name } = req.body;
    const mode = req.body?.mode || getStoredEvaluationMode();
    const team = mode === 'collective' ? 'Toutes les équipes' : req.body?.team;

    if (!name || !team) {
        return res.status(400).json({ error: 'Jury name and team are required' });
    }

    getUniqueJuryAccessCode(name)
        .then((accessCode) => {
            db.run('INSERT INTO juries (name, team, accessCode) VALUES (?, ?, ?)', [name, team, accessCode], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Jury already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ message: 'success', id: this.lastID, accessCode });
            });
        })
        .catch((err) => res.status(500).json({ error: err.message }));
};

const deleteJury = (req, res) => {
    db.run('DELETE FROM juries WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes > 0) {
            res.json({ message: 'deleted', changes: this.changes });
        } else {
            res.status(404).json({ message: 'Jury not found' });
        }
    });
};

const addParticipant = (req, res) => {
    const { name, team } = req.body;
    
    if (!name || !team) {
        return res.status(400).json({ error: "Name and team are required" });
    }

    db.ready.then(() => db.get('SELECT id FROM candidates WHERE name = ? AND team = ?', [name, team], (findErr, existing) => {
        if (findErr) return res.status(500).json({ error: findErr.message });
        if (existing) return res.status(409).json({ error: "Participant already exists in this team." });

        db.run('INSERT INTO candidates (name, team) VALUES (?, ?)', [name, team], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "success", id: this.lastID });
        });
    }));
};

const addParticipantToAllTeams = async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Participant name is required' });

    try {
        await db.ready;
        const teams = await getAllAsync('SELECT name FROM teams ORDER BY name ASC');
        if (teams.length === 0) return res.status(400).json({ error: 'Create at least one team first.' });
        const created = [];
        for (const team of teams) {
            const existing = await getAllAsync('SELECT id FROM candidates WHERE name = ? AND team = ?', [name, team.name]);
            if (existing.length === 0) {
                const result = await runAsync('INSERT INTO candidates (name, team) VALUES (?, ?)', [name, team.name]);
                created.push({ id: result.lastID, name, team: team.name });
            }
        }
        res.status(201).json({ message: 'success', data: created, teams: teams.map(team => team.name) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteParticipant = (req, res) => {
    const sql = 'DELETE FROM candidates WHERE id = ?';
    db.run(sql, [req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes > 0) {
            res.json({ message: "deleted", changes: this.changes });
        } else {
            res.status(404).json({ message: "Participant not found" });
        }
    });
};

const handleScoreSubmission = (req, res) => {
    const { juryName, scores, section } = req.body;
    
    if (!juryName || !scores || !section) {
        return res.status(400).json({ error: "juryName, scores, and section are required" });
    }

    const insertSql = `
        INSERT OR REPLACE INTO scores (juryName, candidate, team, section, criterion, score, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.serialize(() => {
        let count = 0;
        let total = 0;
        for (const [candidateName, criteria] of Object.entries(scores)) {
            for (const [criterion, score] of Object.entries(criteria)) {
                total++;
                const scoreValue = score && typeof score === 'object' ? score.value : score;
                const comment = score && typeof score === 'object' ? score.comment || '' : '';
                db.run(insertSql, [juryName, candidateName, '', section, criterion, scoreValue, comment], (err) => {
                    count++;
                    if (err && count === total) {
                        return res.status(500).json({ error: err.message });
                    }
                    if (count === total) {
                        res.status(200).json({ message: 'Scores submitted successfully' });
                    }
                });
            }
        }
        if (total === 0) {
            res.status(200).json({ message: 'No scores to submit' });
        }
    });
};

const saveScoreSubmission = async ({ juryName, candidate, team, section, criterion, score, comment = '' }) => {
    if (!juryName || !candidate || !team || !section || !criterion || score === undefined || score === null) {
        throw new Error('Missing score payload fields');
    }

    await runAsync(
        `INSERT OR REPLACE INTO scores (juryName, candidate, team, section, criterion, score, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [juryName, candidate, team, section, criterion, score, comment]
    );
};

const getDashboardResults = async () => {
    await ensureJuryAccessCode();

    const participantRows = await getAllAsync(`
        SELECT
            c.id,
            c.name,
            c.team,
            COALESCE(SUM(s.score), 0) AS totalScore,
            COUNT(DISTINCT s.section || '::' || s.criterion) AS scoreCount
        FROM candidates c
        LEFT JOIN scores s ON s.candidate = c.name AND s.team = c.team
        GROUP BY c.id, c.name, c.team
        ORDER BY totalScore DESC, c.name ASC
    `);

    const juryRows = await getAllAsync(`
        SELECT
            juryName AS name,
            COUNT(*) AS scoreCount,
            COALESCE(AVG(score), 0) AS averageScore,
            COALESCE(SUM(score), 0) AS totalScore
        FROM scores
        GROUP BY juryName
        ORDER BY totalScore DESC, name ASC
    `);

    const teamRows = await getAllAsync(`
        SELECT
            team AS name,
            COUNT(*) AS scoreCount,
            AVG(score) AS averageScore
        FROM (
            SELECT
                candidate,
                team,
                COALESCE(SUM(score), 0) AS score
            FROM scores
            GROUP BY candidate, team
        )
        GROUP BY team
        ORDER BY averageScore DESC, name ASC
    `);

    const scoreRows = await getAllAsync(`
        SELECT
            s.id,
            s.juryName,
            s.candidate,
            s.team,
            s.section,
            s.criterion,
            s.score,
            s.comment
        FROM scores s
        ORDER BY s.juryName ASC, s.team ASC, s.candidate ASC, s.section ASC, s.criterion ASC, s.id ASC
    `);

    const juryAccessRows = await getAllAsync(`
        SELECT
            j.id,
            j.name,
            j.team,
            j.accessCode,
            COUNT(c.id) AS participantCount,
            COALESCE(GROUP_CONCAT(c.name, '||'), '') AS participantNames
        FROM juries j
        LEFT JOIN candidates c ON c.team = j.team
        GROUP BY j.id, j.name, j.team, j.accessCode
        ORDER BY j.team ASC, j.name ASC
    `);

    return {
        participants: participantRows.map(row => ({
            id: row.id,
            name: row.name,
            team: row.team,
            score: Number(row.totalScore || 0),
            totalScore: Number(row.totalScore || 0),
            scoreCount: Number(row.scoreCount || 0)
        })),
        juries: juryRows.map(row => ({
            name: row.name,
            scoreCount: Number(row.scoreCount || 0),
            averageScore: Number(row.averageScore || 0),
            totalScore: Number(row.totalScore || 0)
        })),
        teams: teamRows.map(row => ({
            name: row.name,
            scoreCount: Number(row.scoreCount || 0),
            averageScore: Number(row.averageScore || 0)
        })),
        scoreEntries: scoreRows.map(row => ({
            id: row.id,
            juryName: row.juryName,
            candidate: row.candidate,
            team: row.team,
            section: row.section,
            criterion: row.criterion,
            score: Number(row.score || 0),
            comment: row.comment || ''
        })),
        juryAccessCards: juryAccessRows.map(row => ({
            id: row.id,
            name: row.name,
            team: row.team,
            accessCode: row.accessCode,
            participantCount: Number(row.participantCount || 0),
            participants: String(row.participantNames || '')
                .split('||')
                .filter(Boolean)
        }))
    };
};

const getResults = (req, res) => {
    getDashboardResults()
        .then(results => res.json(results))
        .catch(err => res.status(500).json({ error: err.message }));
};

const exportResultsExcel = async (req, res) => {
    try {
        const results = await getDashboardResults();
        const { scale } = getStoredScale();
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Indi Eval';
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.subject = 'Dashboard des résultats';
        workbook.title = 'Export Excel des résultats';
        workbook.company = 'Indi Eval';

        const sectionSummary = new Map();
        const participantSummary = new Map();

        for (const entry of results.scoreEntries) {
            const sectionKey = `${entry.section}::${entry.candidate}`;
            if (!sectionSummary.has(sectionKey)) {
                sectionSummary.set(sectionKey, {
                    section: entry.section,
                    candidate: entry.candidate,
                    team: entry.team,
                    juryCount: new Set(),
                    totalScore: 0,
                    scoreCount: 0
                });
            }

            const sectionRow = sectionSummary.get(sectionKey);
            sectionRow.juryCount.add(entry.juryName);
            sectionRow.totalScore += Number(entry.score || 0);
            sectionRow.scoreCount += 1;

            const participantKey = `${entry.candidate}::${entry.team}`;
            if (!participantSummary.has(participantKey)) {
                participantSummary.set(participantKey, {
                    candidate: entry.candidate,
                    team: entry.team,
                    totalScore: 0,
                    scoreCount: 0,
                    sections: new Set(),
                    juries: new Set()
                });
            }

            const participantRow = participantSummary.get(participantKey);
            participantRow.totalScore += Number(entry.score || 0);
            participantRow.scoreCount += 1;
            participantRow.sections.add(entry.section);
            participantRow.juries.add(entry.juryName);
        }

        const summarySheet = workbook.addWorksheet('Synthese jurys');
        summarySheet.columns = [
            { header: 'Jury', key: 'name', width: 28 },
            { header: 'Nombre de notes', key: 'scoreCount', width: 16 },
            { header: 'Score moyen', key: 'averageScore', width: 14 },
            { header: 'Score total', key: 'totalScore', width: 14 }
        ];
        summarySheet.addRows(results.juries.map((jury) => ({
            name: jury.name,
            scoreCount: jury.scoreCount || 0,
            averageScore: Number(jury.averageScore || 0).toFixed(2),
            totalScore: Number(jury.totalScore || 0).toFixed(2)
        })));

        const participantsSheet = workbook.addWorksheet('Participants');
        participantsSheet.columns = [
            { header: 'Rang', key: 'rank', width: 10 },
            { header: 'Nom', key: 'name', width: 28 },
            { header: 'Équipe', key: 'team', width: 24 },
            { header: 'Note finale', key: 'score', width: 14 },
            { header: 'Critères notés', key: 'scoreCount', width: 16 },
            { header: 'Statut', key: 'status', width: 18 }
        ];
        participantsSheet.addRows(results.participants.map((participant, index) => ({
            rank: index + 1,
            name: participant.name,
            team: participant.team,
            score: Number(participant.score || 0).toFixed(2),
            scoreCount: participant.scoreCount || 0,
            status: getScaleLabel(Number(participant.score || 0), scale)
        })));

        const teamsSheet = workbook.addWorksheet('Equipes');
        teamsSheet.columns = [
            { header: 'Rang', key: 'rank', width: 10 },
            { header: 'Équipe', key: 'name', width: 28 },
            { header: 'Score moyen', key: 'averageScore', width: 14 },
            { header: 'Nombre de notes', key: 'scoreCount', width: 16 }
        ];
        teamsSheet.addRows(results.teams.map((team, index) => ({
            rank: index + 1,
            name: team.name,
            averageScore: Number(team.averageScore || 0).toFixed(2),
            scoreCount: team.scoreCount || 0
        })));

        const detailsSheet = workbook.addWorksheet('Detail des notes');
        detailsSheet.columns = [
            { header: 'Jury', key: 'juryName', width: 24 },
            { header: 'Équipe', key: 'team', width: 22 },
            { header: 'Participant', key: 'candidate', width: 26 },
            { header: 'Section', key: 'section', width: 28 },
            { header: 'Critère', key: 'criterion', width: 34 },
            { header: 'Note', key: 'score', width: 12 }
        ];
        detailsSheet.addRows(results.scoreEntries.map((entry) => ({
            juryName: entry.juryName,
            team: entry.team,
            candidate: entry.candidate,
            section: entry.section,
            criterion: entry.criterion,
            score: Number(entry.score || 0).toFixed(2)
        })));

        const sectionSheet = workbook.addWorksheet('Par section');
        sectionSheet.columns = [
            { header: 'Section', key: 'section', width: 28 },
            { header: 'Participant', key: 'candidate', width: 26 },
            { header: 'Équipe', key: 'team', width: 22 },
            { header: 'Jury(s)', key: 'juryCount', width: 12 },
            { header: 'Score total', key: 'totalScore', width: 14 },
            { header: 'Nombre de notes', key: 'scoreCount', width: 16 }
        ];
        sectionSheet.addRows(Array.from(sectionSummary.values()).map((row) => ({
            section: row.section,
            candidate: row.candidate,
            team: row.team,
            juryCount: row.juryCount.size,
            totalScore: Number(row.totalScore || 0).toFixed(2),
            scoreCount: row.scoreCount
        })).sort((left, right) => left.section.localeCompare(right.section) || left.candidate.localeCompare(right.candidate)));

        const accessSheet = workbook.addWorksheet('Codes jury');
        accessSheet.columns = [
            { header: 'Jury', key: 'name', width: 28 },
            { header: 'Équipe', key: 'team', width: 24 },
            { header: 'Code d\'accès', key: 'accessCode', width: 26 },
            { header: 'Participants', key: 'participantCount', width: 14 }
        ];
        accessSheet.addRows(results.juryAccessCards.map((jury) => ({
            name: jury.name,
            team: jury.team,
            accessCode: jury.accessCode || '',
            participantCount: jury.participantCount || 0
        })));

        [summarySheet, participantsSheet, teamsSheet, detailsSheet, sectionSheet, accessSheet].forEach((sheet) => {
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9E2F3' }
            };
            sheet.views = [{ state: 'frozen', ySplit: 1 }];
            sheet.autoFilter = {
                from: 'A1',
                to: sheet.getRow(1).cellCount ? `${String.fromCharCode(64 + sheet.getRow(1).cellCount)}1` : 'A1'
            };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `dashboard-resultats-${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getInitialData = (req, res) => {
    res.status(501).json({ message: "Not Implemented" });
};

const questionsFilePath = path.join(__dirname, '..', 'questions.json');
const scaleFilePath = path.join(__dirname, '..', 'scale.json');

const getEvaluationMaxScore = () => {
    try {
        const questions = JSON.parse(fs.readFileSync(questionsFilePath, 'utf8'));
        return Object.values(questions).reduce((total, criteria) => (
            total + (Array.isArray(criteria) ? criteria.reduce((sectionTotal, criterion) => {
                const max = Number(criterion.max);
                const fallback = Array.isArray(criterion.descriptions) && criterion.descriptions.length > 0
                    ? criterion.descriptions.length
                    : 4;
                return sectionTotal + (Number.isFinite(max) && max > 0 ? max : fallback);
            }, 0) : 0)
        ), 0);
    } catch (error) {
        return 0;
    }
};

const buildDefaultScale = (maxScore) => {
    const labels = ['Insuffisant', 'Intermédiaire', 'Satisfaisant', 'Très bon'];
    return labels.map((label, index) => ({
        label,
        min: Number((index === 0 ? 0 : maxScore * index / 4).toFixed(2)),
        max: Number((index === 3 ? maxScore : maxScore * (index + 1) / 4).toFixed(2))
    }));
};

const getScaleLabel = (score, scale) => {
    const matchingLevel = scale.find((level) => score >= Number(level.min) && score <= Number(level.max));
    return matchingLevel ? matchingLevel.label : 'Non évalué';
};

const getStoredScale = () => {
    const maxScore = getEvaluationMaxScore();
    try {
        const stored = JSON.parse(fs.readFileSync(scaleFilePath, 'utf8'));
        if (stored.maxScore === maxScore && Array.isArray(stored.scale) && stored.scale.length === 4) {
            return { maxScore, scale: stored.scale };
        }
    } catch (error) {
        // Use a fresh scale when no saved configuration exists.
    }
    return { maxScore, scale: buildDefaultScale(maxScore) };
};

const getScale = (req, res) => {
    res.json(getStoredScale());
};

const saveScale = (req, res) => {
    const { scale } = req.body || {};
    const maxScore = getEvaluationMaxScore();
    if (!Array.isArray(scale) || scale.length !== 4) {
        return res.status(400).json({ error: 'L’échelle doit contenir exactement 4 niveaux.' });
    }

    const normalizedScale = scale.map((level) => ({
        label: String(level.label || '').trim(),
        min: Number(level.min),
        max: Number(level.max)
    }));
    if (normalizedScale.some((level) => !level.label || !Number.isFinite(level.min) || !Number.isFinite(level.max) || level.min > level.max)) {
        return res.status(400).json({ error: 'Chaque niveau doit avoir un nom et des bornes valides.' });
    }

    for (let index = 1; index < normalizedScale.length; index += 1) {
        if (normalizedScale[index].min < normalizedScale[index - 1].min) {
            return res.status(400).json({ error: 'Les niveaux doivent être dans l’ordre croissant.' });
        }
    }

    fs.writeFile(scaleFilePath, JSON.stringify({ maxScore, scale: normalizedScale }, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'saved', maxScore, scale: normalizedScale });
    });
};

const getQuestions = (req, res) => {
    fs.readFile(questionsFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // return default initialSections from ManageQuestions client
                return res.json({});
            }
            return res.status(500).json({ error: err.message });
        }
        try {
            const json = JSON.parse(data);
            res.json(json);
        } catch (parseErr) {
            res.status(500).json({ error: parseErr.message });
        }
    });
};

const saveQuestions = (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid payload' });
    }
    fs.writeFile(questionsFilePath, JSON.stringify(payload, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const io = req.app.get('socketio');
        if (io) {
            io.emit('questions_updated', payload);
        }

        res.json({ message: 'saved', data: payload });
    });
};

const lockEvaluation = async (req, res) => {
    const { team, accessCode, juryName, mode } = req.body || {};

    if (!team || !accessCode || !juryName) {
        return res.status(400).json({ error: 'team, accessCode and juryName are required' });
    }

    try {
        const normalizedAccessCode = String(accessCode || '').toUpperCase();
        const evaluationMode = mode === 'collective' || getStoredEvaluationMode() === 'collective' ? 'collective' : 'teams';
        const lockScope = getEvaluationLockScope(team, normalizedAccessCode, evaluationMode);
        const existingTeamLock = await getAllAsync('SELECT * FROM evaluation_locks WHERE team = ? LIMIT 1', [lockScope]);

        if (existingTeamLock.length > 0) {
            const currentLock = existingTeamLock[0];
            const sameJury = String(currentLock.accessCode || '').toUpperCase() === normalizedAccessCode;

            if (sameJury) {
                return res.json({
                    message: 'locked',
                    data: { id: currentLock.id, team, lockTeam: lockScope, accessCode: currentLock.accessCode, juryName: currentLock.juryName, evaluationMode },
                    reconnected: true
                });
            }

            return res.status(409).json({
                error: `Une évaluation est déjà en cours pour l'équipe ${team}.`,
                activeLock: currentLock
            });
        }

        try {
            const result = await runAsync(
                'INSERT INTO evaluation_locks (team, accessCode, juryName) VALUES (?, ?, ?)',
                [lockScope, normalizedAccessCode, juryName]
            );
            return res.json({ message: 'locked', data: { id: result.lastID, team, lockTeam: lockScope, accessCode: normalizedAccessCode, juryName, evaluationMode } });
        } catch (insertErr) {
            if (String(insertErr.message).includes('UNIQUE constraint failed')) {
                const currentLock = await getAllAsync('SELECT * FROM evaluation_locks WHERE team = ? LIMIT 1', [lockScope]);
                const sameJury = String(currentLock[0]?.accessCode || '').toUpperCase() === normalizedAccessCode;

                if (sameJury) {
                    return res.json({
                        message: 'locked',
                        data: { id: currentLock[0].id, team, lockTeam: lockScope, accessCode: currentLock[0].accessCode, juryName: currentLock[0].juryName, evaluationMode },
                        reconnected: true
                    });
                }

                return res.status(409).json({
                    error: `Une évaluation est déjà en cours pour l'équipe ${team}.`,
                    activeLock: currentLock[0]
                });
            }
            throw insertErr;
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const releaseEvaluation = async (req, res) => {
    const { accessCode } = req.params;
    const team = String(req.query.team || '').trim();
    const mode = String(req.query.mode || getStoredEvaluationMode());

    try {
        const normalizedAccessCode = String(accessCode || '').toUpperCase();
        const lockScope = team ? getEvaluationLockScope(team, normalizedAccessCode, mode) : '';
        const sql = team
            ? 'DELETE FROM evaluation_locks WHERE accessCode = ? AND team = ?'
            : 'DELETE FROM evaluation_locks WHERE accessCode = ?';
        const params = team
            ? [normalizedAccessCode, lockScope]
            : [normalizedAccessCode];

        const result = await runAsync(sql, params);
        return res.json({ message: 'released', changes: result.changes || 0 });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const getEvaluationMode = (req, res) => {
    res.json({ mode: getStoredEvaluationMode() });
};

const saveEvaluationMode = (req, res) => {
    const mode = req.body?.mode === 'collective' ? 'collective' : req.body?.mode === 'teams' ? 'teams' : null;
    if (!mode) {
        return res.status(400).json({ error: 'Mode invalide.' });
    }

    fs.writeFile(evaluationModeFilePath, JSON.stringify({ mode }, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'saved', mode });
    });
};

const clearAllScores = (req, res) => {
    db.run('DELETE FROM scores', [], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'All scores have been deleted', changes: this.changes });
    });
};

module.exports = {
    getParticipants,
    getTeams,
    addTeam,
    updateTeam,
    deleteTeam,
    getJuries,
    getJuryByCode,
    addJury,
    deleteJury,
    addParticipant,
    addParticipantToAllTeams,
    deleteParticipant,
    handleScoreSubmission,
    saveScoreSubmission,
    getDashboardResults,
    exportResultsExcel,
    getResults,
    getInitialData,
    getQuestions,
    saveQuestions,
    getScale,
    saveScale,
    ensureJuryAccessCode,
    lockEvaluation,
    releaseEvaluation,
    getEvaluationMode,
    saveEvaluationMode,
    clearAllScores
};
