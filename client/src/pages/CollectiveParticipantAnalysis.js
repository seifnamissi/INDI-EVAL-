import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import './CollectiveParticipantAnalysis.css';

const average = (values) => values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;

const CollectiveParticipantAnalysis = () => {
    const { participantName } = useParams();
    const decodedName = decodeURIComponent(participantName || '');
    const [entries, setEntries] = useState([]);
    const [questions, setQuestions] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/api/results`).then((response) => response.json()),
            fetch(`${API_URL}/api/questions`).then((response) => response.json())
        ])
            .then(([data, questionData]) => {
                const participantEntries = (Array.isArray(data.scoreEntries) ? data.scoreEntries : [])
                    .filter((entry) => entry.candidate === decodedName);
                setEntries(participantEntries);
                setQuestions(questionData && typeof questionData === 'object' ? questionData : {});
            })
            .catch((error) => console.error('Failed to load participant analysis:', error))
            .finally(() => setLoading(false));
    }, [decodedName]);

    const juries = Array.from(new Set(entries.map((entry) => entry.juryName).filter(Boolean))).sort();
    const questionGroups = Object.values(entries.reduce((groups, entry) => {
        const key = `${entry.section}::${entry.criterion}`;
        if (!groups[key]) {
            groups[key] = { section: entry.section, criterion: entry.criterion, entries: [] };
        }
        groups[key].entries.push(entry);
        return groups;
    }, {}));
    const sectionGroups = Object.entries(questionGroups.reduce((groups, question) => {
        if (!groups[question.section]) groups[question.section] = [];
        groups[question.section].push(question);
        return groups;
    }, {}));
    const allScores = entries.map((entry) => Number(entry.score || 0));
    const overallAverage = average(allScores);
    const teams = Array.from(new Set(entries.map((entry) => entry.team).filter(Boolean))).join(', ');
    const getQuestionMax = (question) => {
        const configuredQuestion = Array.isArray(questions[question.section])
            ? questions[question.section].find((item) => item.name === question.criterion)
            : null;
        const configuredMax = Number(configuredQuestion?.max);
        return Number.isFinite(configuredMax) && configuredMax > 0
            ? configuredMax
            : Array.isArray(configuredQuestion?.descriptions) && configuredQuestion.descriptions.length > 0
                ? configuredQuestion.descriptions.length
                : 4;
    };

    return (
        <div className="participant-analysis-container">
            <div className="participant-analysis-nav">
                <Link to="/collective-dashboard">Retour au dashboard collectif</Link>
                <Link to="/dashboard">Dashboard classique</Link>
            </div>
            {loading ? <p>Chargement de l’analyse...</p> : (
                <>
                    <header className="participant-analysis-header">
                        <div>
                            <p className="analysis-eyebrow">Analyse détaillée du participant</p>
                            <h1>{decodedName}</h1>
                            <p>Équipe(s) : {teams || 'Aucune équipe enregistrée'}</p>
                        </div>
                        <div className="overall-score-card">
                            <span>Moyenne générale</span>
                            <strong>{overallAverage === null ? '—' : overallAverage.toFixed(2)}</strong>
                            <small>{entries.length} note(s) enregistrée(s)</small>
                        </div>
                    </header>

                    {entries.length === 0 ? <p>Aucune note enregistrée pour ce participant.</p> : (
                        <>
                            <section className="analysis-section">
                                <h2>Moyennes par section</h2>
                                <div className="section-summary-grid">
                                    {sectionGroups.map(([section, questions]) => {
                                        const sectionScores = questions.flatMap((question) => question.entries.map((entry) => Number(entry.score || 0)));
                                        return <article className="section-summary-card" key={section}><h3>{section}</h3><strong>{average(sectionScores).toFixed(2)}</strong><span>{sectionScores.length} note(s)</span></article>;
                                    })}
                                </div>
                            </section>

                            <section className="analysis-section">
                                <h2>Moyennes par question et par jury</h2>
                                <div className="analysis-table-wrapper">
                                    <table className="analysis-table">
                                        <thead>
                                            <tr><th>Section</th><th>Question</th>{juries.map((jury) => <th key={jury}>{jury}</th>)}<th>Moyenne générale</th><th>Statut</th><th>Commentaires</th></tr>
                                        </thead>
                                        <tbody>
                                            {questionGroups.map((question) => {
                                                const values = question.entries.map((entry) => Number(entry.score || 0));
                                                const comments = question.entries.map((entry) => entry.comment).filter(Boolean);
                                                const questionAverage = average(values);
                                                const questionMax = getQuestionMax(question);
                                                const passed = questionAverage >= questionMax / 2;
                                                return <tr key={`${question.section}-${question.criterion}`}><td>{question.section}</td><td><strong>{question.criterion}</strong></td>{juries.map((jury) => { const juryValues = question.entries.filter((entry) => entry.juryName === jury).map((entry) => Number(entry.score || 0)); return <td key={jury}>{average(juryValues) === null ? '—' : average(juryValues).toFixed(2)}</td>; })}<td><strong>{questionAverage.toFixed(2)}</strong><small>/ {questionMax}</small></td><td><span className={`question-status ${passed ? 'passed' : 'needs-improvement'}`}>{passed ? 'Réussi' : 'À améliorer'}</span></td><td>{comments.length > 0 ? comments.map((comment, index) => <div className="analysis-comment" key={index}>{comment}</div>) : '—'}</td></tr>;
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default CollectiveParticipantAnalysis;
