import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import './Dashboard.css';

import { API_URL, SOCKET_URL } from '../api';
const socket = io(SOCKET_URL);

const buildDefaultScale = (maxScore) => [
    { label: 'Insuffisant', min: 0, max: maxScore / 4 },
    { label: 'Intermédiaire', min: maxScore / 4, max: maxScore / 2 },
    { label: 'Satisfaisant', min: maxScore / 2, max: (maxScore * 3) / 4 },
    { label: 'Très bon', min: (maxScore * 3) / 4, max: maxScore }
];

const Dashboard = () => {
    const buildAccessCode = (teamName) => `INDIGO-${String(teamName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') || 'team'}`.toUpperCase();
    const accessRole = sessionStorage.getItem('accessRole');
    const [questions, setQuestions] = useState({});
    const [evaluationScale, setEvaluationScale] = useState([]);
    const [results, setResults] = useState({
        participants: [],
        juries: [],
        teams: [],
        scoreEntries: [],
        juryAccessCards: []
    });
    const [isExporting, setIsExporting] = useState(false);
    const [filters, setFilters] = useState({
        juryName: 'all',
        team: 'all',
        candidate: 'all',
        section: 'all'
    });

    const evaluationCriteria = Object.entries(questions).flatMap(([section, criteria]) => (
        (Array.isArray(criteria) ? criteria : []).map((criterion) => ({
            key: `${section}::${criterion.name}`,
            min: Number.isFinite(Number(criterion.min)) ? Number(criterion.min) : 1,
            max: Number.isFinite(Number(criterion.max)) ? Number(criterion.max) : (
                Array.isArray(criterion.descriptions) && criterion.descriptions.length > 0
                    ? criterion.descriptions.length
                    : 4
            )
        }))
    ));
    const criteriaByKey = new Map(evaluationCriteria.map((criterion) => [criterion.key, criterion]));
    const criterionCount = evaluationCriteria.length;
    const maxScore = evaluationCriteria.reduce((total, criterion) => total + criterion.max, 0);
    const defaultScale = buildDefaultScale(maxScore);
    const activeScale = evaluationScale.length === 4 ? evaluationScale : defaultScale;

    useEffect(() => {
        const loadQuestions = async () => {
            try {
                const response = await fetch(`${API_URL}/api/questions`);
                const data = await response.json();
                if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                    setQuestions(data);
                } else {
                    setQuestions({});
                }
            } catch (error) {
                console.error('Failed to load evaluation questions:', error);
                setQuestions({});
            }
        };

        const loadResults = async () => {
            try {
                const response = await fetch(`${API_URL}/api/results`);
                const data = await response.json();
                setResults({
                    participants: Array.isArray(data.participants) ? data.participants : [],
                    juries: Array.isArray(data.juries) ? data.juries : [],
                    teams: Array.isArray(data.teams) ? data.teams : [],
                    scoreEntries: Array.isArray(data.scoreEntries) ? data.scoreEntries : [],
                    juryAccessCards: Array.isArray(data.juryAccessCards) ? data.juryAccessCards : []
                });
            } catch (error) {
                console.error('Failed to load dashboard results:', error);
                setResults({ participants: [], juries: [], teams: [], scoreEntries: [], juryAccessCards: [] });
            }
        };

        const loadScale = async () => {
            try {
                const response = await fetch(`${API_URL}/api/scale`);
                const data = await response.json();
                if (Array.isArray(data.scale) && data.scale.length === 4) {
                    setEvaluationScale(data.scale);
                }
            } catch (error) {
                console.error('Failed to load evaluation scale:', error);
            }
        };

        loadQuestions();
        loadResults();
        loadScale();

        socket.on('updateResults', (data) => {
            setResults({
                participants: Array.isArray(data.participants) ? data.participants : [],
                juries: Array.isArray(data.juries) ? data.juries : [],
                teams: Array.isArray(data.teams) ? data.teams : [],
                    scoreEntries: Array.isArray(data.scoreEntries) ? data.scoreEntries : [],
                    juryAccessCards: Array.isArray(data.juryAccessCards) ? data.juryAccessCards : []
            });
        });

        socket.on('questions_updated', (data) => {
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                setQuestions(data);
            }
        });

        return () => {
            socket.off('updateResults');
            socket.off('questions_updated');
        };
    }, []);

    const getScoreColor = (score) => {
        const level = getScoreLevel(score);
        const levelIndex = activeScale.findIndex((item) => item.label === level.label);
        return ['#ef4444', '#f59e0b', '#0f766e', '#2563eb'][Math.max(0, levelIndex)] || '#64748b';
    };

    const getScoreLevel = (score) => {
        const matchingLevel = activeScale.find((level) => score >= Number(level.min) && score <= Number(level.max));
        if (matchingLevel) return matchingLevel;
        return activeScale.reduce((current, level) => (
            Number(level.min) <= score && Number(level.min) >= Number(current.min) ? level : current
        ), activeScale[0] || { label: 'Non évalué', min: 0, max: 0 });
    };

    const getScoreLabel = (score) => getScoreLevel(score).label;

    const participantScoreRows = Object.values(
        results.scoreEntries.reduce((accumulator, entry) => {
            const key = `${entry.candidate}::${entry.team}`;
            if (!accumulator[key]) {
                accumulator[key] = {
                    name: entry.candidate,
                    team: entry.team,
                    criteria: {}
                };
            }

            const participantRow = accumulator[key];
            const uniqueCriterionKey = `${entry.section}::${entry.criterion}`;
            if (!participantRow.criteria[uniqueCriterionKey]) {
                participantRow.criteria[uniqueCriterionKey] = [];
            }
            participantRow.criteria[uniqueCriterionKey].push(Number(entry.score || 0));

            return accumulator;
        }, {})
    )
        .map((row) => {
            const criteria = Object.entries(row.criteria).map(([criterionKey, scores]) => {
                const criterion = criteriaByKey.get(criterionKey);
                const averageScore = scores.reduce((total, score) => total + score, 0) / scores.length;
                return {
                    averageScore,
                    max: criterion ? criterion.max : Math.max(...scores, 0)
                };
            });
            const totalScore = criteria.reduce((total, criterion) => total + criterion.averageScore, 0);
            return {
                name: row.name,
                team: row.team,
                score: Number(totalScore || 0),
                totalScore: Number(totalScore || 0),
                scoreCount: criteria.length
            };
        })
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

    const bestParticipant = participantScoreRows.length > 0 ? participantScoreRows[0] : null;
    const teamScoreRows = Object.values(
        participantScoreRows.reduce((accumulator, participant) => {
            if (!accumulator[participant.team]) {
                accumulator[participant.team] = { name: participant.team, totalScore: 0, participantCount: 0 };
            }
            accumulator[participant.team].totalScore += participant.score;
            accumulator[participant.team].participantCount += 1;
            return accumulator;
        }, {})
    )
        .map((team) => ({
            ...team,
            averageScore: team.participantCount > 0 ? team.totalScore / team.participantCount : 0
        }))
        .sort((left, right) => right.averageScore - left.averageScore || left.name.localeCompare(right.name));
    const juryOptions = Array.from(new Set(results.scoreEntries.map((entry) => entry.juryName).filter(Boolean))).sort();
    const teamOptions = Array.from(new Set(results.scoreEntries.map((entry) => entry.team).filter(Boolean))).sort();
    const participantOptions = Array.from(new Set(results.scoreEntries.map((entry) => entry.candidate).filter(Boolean))).sort();
    const sectionOptions = Array.from(new Set(results.scoreEntries.map((entry) => entry.section).filter(Boolean))).sort();

    const filteredScoreEntries = results.scoreEntries.filter((entry) => {
        return (
            (filters.juryName === 'all' || entry.juryName === filters.juryName) &&
            (filters.team === 'all' || entry.team === filters.team) &&
            (filters.candidate === 'all' || entry.candidate === filters.candidate) &&
            (filters.section === 'all' || entry.section === filters.section)
        );
    });

    const handleFilterChange = (field, value) => {
        setFilters((currentFilters) => ({
            ...currentFilters,
            [field]: value
        }));
    };

    const handleDownloadExcel = async () => {
        try {
            setIsExporting(true);
            const response = await fetch(`${API_URL}/api/results/export-excel`);

            if (!response.ok) {
                throw new Error('Impossible de générer le fichier Excel');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const fileNameHeader = response.headers.get('content-disposition') || '';
            const fileNameMatch = fileNameHeader.match(/filename="?([^";]+)"?/i);
            const fileName = fileNameMatch ? fileNameMatch[1] : 'dashboard-resultats.xlsx';

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Failed to export dashboard results:', error);
            window.alert('Export Excel impossible pour le moment.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="dashboard-container">
            {accessRole === 'admin' && (
                <div className="admin-dashboard-nav">
                    <Link to="/admin">Accueil admin</Link>
                    <Link to="/manage-participants">Création équipes</Link>
                    <Link to="/manage-juries">Création jurys</Link>
                    <Link to="/manage-questions">Créer l’évaluation</Link>
                    <Link to="/evaluation-simultaneous">Évaluation</Link>
                    <Link to="/dashboard" className="active">Dashboard</Link>
                </div>
            )}

            <div className="dashboard-header">
                <h1>Dashboard des Résultats</h1>
                <button className="export-excel-button" onClick={handleDownloadExcel} disabled={isExporting}>
                    {isExporting ? 'Création du fichier...' : 'Télécharger version Excel'}
                </button>
            </div>

            <div className="results-section">
                <h2>Configuration active de l’évaluation</h2>
                {Object.keys(questions).length > 0 ? (
                    <div className="questions-summary-grid">
                        {Object.entries(questions).map(([sectionName, criterionList]) => (
                            <div key={sectionName} className="question-summary-card">
                                <h3>{sectionName}</h3>
                                <ul>
                                    {(Array.isArray(criterionList) ? criterionList : []).map((criterion) => (
                                        <li key={`${sectionName}-${criterion.name}`}>
                                            <strong>{criterion.name}</strong>
                                            <span>{Array.isArray(criterion.descriptions) ? ` • ${criterion.descriptions.length} niveaux` : ''}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>Aucune configuration d'évaluation enregistrée.</p>
                )}
            </div>

            {accessRole === 'admin' && (
                <div className="results-section access-section">
                    <h2>Codes d'accès jury</h2>
                    <div className="jury-access-grid">
                        {results.juryAccessCards.map((jury) => (
                            <div className="jury-access-card" key={jury.id}>
                                <div className="jury-access-header">
                                    <h3>{jury.name}</h3>
                                    <span className="jury-access-code">{jury.accessCode || buildAccessCode(jury.team)}</span>
                                </div>
                                <p><strong>Équipe :</strong> {jury.team}</p>
                                <p><strong>Participants :</strong> {jury.participantCount}</p>
                                <ul className="jury-participant-list">
                                    {jury.participants.map((participant) => (
                                        <li key={`${jury.id}-${participant}`}>{participant}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        {results.juryAccessCards.length === 0 && (
                            <p>Aucun jury n'a encore été créé.</p>
                        )}
                    </div>
                </div>
            )}

            {bestParticipant && (
                <div className="best-participant-card">
                    <h2>🌟 Meilleur Participant 🌟</h2>
                    <h3>{bestParticipant.name}</h3>
                    <p>Équipe: {bestParticipant.team}</p>
                    <p>Note finale: {(bestParticipant.score || 0).toFixed(2)} / {maxScore.toFixed(2)}</p>
                    <p>Évaluations: {bestParticipant.scoreCount || 0} / {criterionCount} critères notés</p>
                    <p>Statut: {getScoreLabel(bestParticipant.score || 0)}</p>
                    <p>Niveau: {getScoreLabel(bestParticipant.score || 0)}</p>
                </div>
            )}

            <div className="results-section">
                <h2>Notes par Jury</h2>
                <table className="results-table">
                    <thead>
                        <tr>
                            <th>Jury</th>
                            <th>Nombre de notes</th>
                            <th>Score moyen</th>
                            <th>Score total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.juries.map((jury) => (
                            <tr key={jury.name}>
                                <td>{jury.name}</td>
                                <td>{jury.scoreCount || 0}</td>
                                <td>{(jury.averageScore || 0).toFixed(2)}</td>
                                <td>{(jury.totalScore || 0).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="results-section">
                <h2>Résultat par Participant - Score sur {maxScore.toFixed(2)}</h2>
                <table className="results-table">
                    <thead>
                        <tr>
                            <th>Rang</th>
                            <th>Nom</th>
                            <th>Équipe</th>
                            <th>Note finale</th>
                            <th>Critères notés</th>
                            <th>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participantScoreRows.map((p, index) => (
                            <tr key={`${p.name}-${p.team}`} style={{ color: getScoreColor(p.score) }}>
                                <td>{index + 1}</td>
                                <td>{p.name}</td>
                                <td>{p.team}</td>
                                <td><strong>{(p.score || 0).toFixed(2)} / {maxScore.toFixed(2)}</strong></td>
                                <td>{p.scoreCount || 0} / {criterionCount}</td>
                                <td>{getScoreLabel(p.score || 0)}</td>
                            </tr>
                        ))}
                        {participantScoreRows.length === 0 && (
                            <tr>
                                <td colSpan="6">Aucun résultat participant disponible.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="results-section">
                <h2>Classement par Équipe</h2>
                <table className="results-table">
                    <thead>
                        <tr>
                            <th>Rang</th>
                            <th>Équipe</th>
                            <th>Score Moyen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teamScoreRows.map((t, index) => (
                            <tr key={t.name}>
                                <td>{index + 1}</td>
                                <td>{t.name}</td>
                                <td>{(t.averageScore || 0).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="results-section">
                <h2>Détail des notes</h2>
                <div className="dashboard-filters">
                    <label>
                        Jury
                        <select value={filters.juryName} onChange={(event) => handleFilterChange('juryName', event.target.value)}>
                            <option value="all">Tous</option>
                            {juryOptions.map((juryName) => (
                                <option key={juryName} value={juryName}>{juryName}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Équipe
                        <select value={filters.team} onChange={(event) => handleFilterChange('team', event.target.value)}>
                            <option value="all">Toutes</option>
                            {teamOptions.map((team) => (
                                <option key={team} value={team}>{team}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Participant
                        <select value={filters.candidate} onChange={(event) => handleFilterChange('candidate', event.target.value)}>
                            <option value="all">Tous</option>
                            {participantOptions.map((candidate) => (
                                <option key={candidate} value={candidate}>{candidate}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Panel / Section
                        <select value={filters.section} onChange={(event) => handleFilterChange('section', event.target.value)}>
                            <option value="all">Toutes</option>
                            {sectionOptions.map((section) => (
                                <option key={section} value={section}>{section}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <table className="results-table">
                    <thead>
                        <tr>
                            <th>Jury</th>
                            <th>Équipe</th>
                            <th>Participant</th>
                            <th>Section</th>
                            <th>Critère</th>
                            <th>Note</th>
                            <th>Commentaire</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredScoreEntries.map((entry) => (
                            <tr key={entry.id}>
                                <td>{entry.juryName}</td>
                                <td>{entry.team}</td>
                                <td>{entry.candidate}</td>
                                <td>{entry.section}</td>
                                <td>{entry.criterion}</td>
                                <td>{Number(entry.score).toFixed(2)}</td>
                                <td>{entry.comment || '—'}</td>
                            </tr>
                        ))}
                        {filteredScoreEntries.length === 0 && (
                            <tr>
                                <td colSpan="7">Aucune note ne correspond à ces filtres.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
