import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';
import './CollectiveDashboard.css';

const CollectiveDashboard = () => {
    const [results, setResults] = useState({ participants: [], scoreEntries: [] });
    const [maxScore, setMaxScore] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [resultsResponse, questionsResponse] = await Promise.all([
                    fetch(`${API_URL}/api/results`),
                    fetch(`${API_URL}/api/questions`)
                ]);
                const data = await resultsResponse.json();
                const questions = await questionsResponse.json();
                const total = Object.values(questions || {}).reduce((sum, criteria) => (
                    sum + (Array.isArray(criteria) ? criteria.reduce((sectionSum, criterion) => {
                        const max = Number(criterion.max);
                        const fallback = Array.isArray(criterion.descriptions) && criterion.descriptions.length > 0 ? criterion.descriptions.length : 4;
                        return sectionSum + (Number.isFinite(max) && max > 0 ? max : fallback);
                    }, 0) : 0)
                ), 0);
                setMaxScore(total);
                setResults({
                    participants: Array.isArray(data.participants) ? data.participants : [],
                    scoreEntries: Array.isArray(data.scoreEntries) ? data.scoreEntries : []
                });
            } catch (error) {
                console.error('Failed to load collective dashboard:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

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
            console.error('Failed to export collective dashboard results:', error);
            window.alert('Export Excel impossible pour le moment.');
        } finally {
            setIsExporting(false);
        }
    };

    const juries = Array.from(new Set(results.scoreEntries.map((entry) => entry.juryName).filter(Boolean))).sort();
    const collectiveParticipants = Array.from(new Map(results.participants.map((participant) => [participant.name, {
        ...participant,
        team: 'Toutes les équipes'
    }])).values());
    const getJuryScore = (participant, juryName) => {
        const entries = results.scoreEntries.filter((entry) => entry.candidate === participant.name && entry.juryName === juryName);
        if (entries.length === 0) return null;
        const score = entries.reduce((total, entry) => total + Number(entry.score || 0), 0);
        return { score, count: entries.length, comments: entries.map((entry) => entry.comment).filter(Boolean) };
    };

    return (
        <div className="collective-dashboard-container">
            <div className="collective-dashboard-nav">
                <Link to="/admin">Accueil admin</Link>
                <Link to="/manage-participants">Mode d’évaluation</Link>
                <Link to="/dashboard">Dashboard classique</Link>
            </div>
            <div className="collective-dashboard-header">
                <div>
                    <p className="collective-eyebrow">Évaluation collective</p>
                    <h1>Résultats par participant et par jury</h1>
                    <p>Chaque cellule affiche la note attribuée par un jury à un participant.</p>
                </div>
                <div className="collective-dashboard-actions">
                    <strong>Score maximal : {maxScore.toFixed(2)}</strong>
                    <button className="collective-export-excel-button" onClick={handleDownloadExcel} disabled={isExporting}>
                        {isExporting ? 'Création du fichier...' : 'Télécharger version Excel'}
                    </button>
                </div>
            </div>
            {loading ? <p>Chargement des résultats...</p> : (
                <div className="collective-table-wrapper">
                    <table className="collective-results-table">
                        <thead>
                            <tr>
                                <th>Participant</th>
                                <th>Équipe</th>
                                {juries.map((jury) => <th key={jury}>{jury}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {collectiveParticipants.map((participant) => (
                                <tr key={participant.id || `${participant.name}-${participant.team}`}>
                                    <td><Link className="participant-link" to={`/collective-dashboard/participant/${encodeURIComponent(participant.name)}`}><strong>{participant.name}</strong></Link></td>
                                    <td>{participant.team}</td>
                                    {juries.map((jury) => {
                                        const result = getJuryScore(participant, jury);
                                        return <td key={`${participant.id}-${jury}`}>{result ? <><strong>{result.score.toFixed(2)}</strong><small>{result.count} notes</small>{result.comments.map((comment, index) => <small className="result-comment" key={index}>Commentaire : {comment}</small>)}</> : <span className="not-rated">Non noté</span>}</td>;
                                    })}
                                </tr>
                            ))}
                            {collectiveParticipants.length === 0 && <tr><td colSpan={Math.max(2, juries.length + 2)}>Aucun participant disponible.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CollectiveDashboard;
