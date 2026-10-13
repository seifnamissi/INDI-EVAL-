import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManageQuestions.css';
import { API_URL } from '../api';

const initialSections = {
    "SECTION 1 - PANEL": [
        { name: "Écoute active", descriptions: ["distrait / pas attentif", "écoute mais peu de réaction", "écoute + réactions pertinentes", "rebondit, connecte les idées, très engagé"] },
        { name: "Communication orale", descriptions: ["ne parle pas / hors sujet", "interventions courtes ou peu claires", "interventions claires et pertinentes", "prise de parole structurée + impactante"] },
        { name: "Curiosité / Esprit critique", descriptions: ["aucune question / passif", "questions simples", "questions pertinentes", "questions approfondies + lien métier"] }
    ],
    "SECTION 2 - ACTIVITÉ 1 (Build Identity)": [
        { name: "Créativité", descriptions: ["idées très basiques ou copiées", "quelques idées intéressantes mais peu originales", "créativité cohérente et adaptée au concept", "idées très originales, différenciantes et impactantes"] },
        { name: "Contribution au groupe", descriptions: ["passif / ne contribue pas", "participe peu", "participe activement et contribue aux échanges", "moteur du groupe impulse les idées et dynamise l'équipe"] },
        { name: "Structuration des idées", descriptions: ["désorganisé / confus", "partiellement structuré", "structuré et logique", "très clair + vision forte"] },
        { name: "Collaboration & Teamwork", descriptions: ["travaille seul, peu d'écoute des autres", "collaboration limitée, difficulté à intégrer les idées", "bonne collaboration et écoute des membres", "excellente synergie, facilite la collaboration du groupe"] },
        { name: "Communication - Présentation finale", descriptions: ["confus ou absent", "peu fluide / peu structuré", "clair et compréhensible", "storytelling fort, impactant et fluide"] }
    ],
    "SECTION 3 - ACTIVITÉ 2 (Fusion Challenge)": [
        { name: "Collaboration inter-équipe", descriptions: ["refuse d'interagir ou reste dans son groupe initial", "interaction limitée avec l'autre équipe", "bonne coopération et échanges équilibrés", "crée une vraie dynamique collective entre les deux équipes"] },
        { name: "Écoute & ouverture aux idées", descriptions: ["coupe la parole / ignore les idées des autres", "écoute partiellement mais reste centré sur ses idées", "écoute et prend en compte les propositions", "valorise activement les idées des autres et rebondit dessus"] },
        { name: "Résolution de problème", descriptions: ["bloque face aux difficultés ou désaccords", "tente de résoudre les problèmes avec difficulté", "propose des solutions pertinentes", "trouve rapidement des solutions et aide le groupe à avancer"] },
        { name: "Participation & implication", descriptions: ["passif ou peu impliqué", "implication irrégulière", "participe activement tout au long de l'activité", "très impliqué, dynamise les échanges et les actions"] },
        { name: "Communication - Pitch final", descriptions: ["présentation confuse ou peu claire", "communication hésitante ou peu structurée", "présentation claire et compréhensible", "communication fluide, convaincante et impactante"] }
    ],
    "SECTION 4 - TRANSVERSAL": [
        { name: "Leadership naturel", descriptions: ["aucun impact sur le groupe", "influence faible ou occasionnelle", "influence positive et visible", "leader naturel, fédère et guide le groupe"] },
        { name: "Adaptabilité", descriptions: ["difficulté à s'adapter", "adaptation lente ou partielle", "bonne adaptation aux situations", "très flexible, s'adapte facilement aux changements et aux autres"] },
        { name: "Engagement & énergie", descriptions: ["très passif, peu impliqué", "implication irrégulière", "engagement constant dans les activités", "énergie positive forte, motivé et dynamique"] },
        { name: "Gestion du temps & organisation", descriptions: ["désorganisé, difficulté à gérer les priorités", "organisation partielle ou irrégulière", "bien organisé et respecte les délais", "très structuré, optimise le temps et aide le groupe à avancer efficacement"] }
    ]
};

const ManageQuestions = () => {
    const [sections, setSections] = useState(initialSections);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const navigate = useNavigate();

    const persistQuestions = async () => {
        setSaving(true);
        setSaveStatus(null);
        try {
            const sectionNames = Object.keys(sections).map(name => name.trim());
            if (sectionNames.some(name => !name)) {
                throw new Error('Chaque section doit avoir un nom.');
            }
            if (new Set(sectionNames).size !== sectionNames.length) {
                throw new Error('Chaque section doit avoir un nom différent.');
            }

            const response = await fetch(`${API_URL}/api/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sections)
            });

            const result = await response.json().catch(() => ({}));
            sessionStorage.setItem('evaluationQuestions', JSON.stringify(sections));

            if (!response.ok && result?.error) {
                throw new Error(result.error);
            }

            return true;
        } catch (error) {
            sessionStorage.setItem('evaluationQuestions', JSON.stringify(sections));
            setSaveStatus({ type: 'error', message: error.message || 'La synchronisation a échoué.' });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSectionNameChange = (oldName, newName) => {
        const trimmedName = newName.trim();
        if (trimmedName && trimmedName !== oldName && Object.prototype.hasOwnProperty.call(sections, trimmedName)) {
            setSaveStatus({ type: 'error', message: 'Ce nom de section existe déjà.' });
            return;
        }

        const newSections = {};
        Object.entries(sections).forEach(([sectionName, questions]) => {
            newSections[sectionName === oldName ? newName : sectionName] = questions;
        });
        setSections(newSections);
        setSaveStatus(null);
    };

    const handleAddSection = () => {
        const sectionNumber = Object.keys(sections).length + 1;
        let sectionName = `Nouvelle section ${sectionNumber}`;
        while (Object.prototype.hasOwnProperty.call(sections, sectionName)) {
            sectionName = `Nouvelle section ${Object.keys(sections).length + 1}`;
        }

        setSections({
            ...sections,
            [sectionName]: [{ name: 'Nouvelle question', min: 1, max: 4, descriptions: ['', '', '', ''] }]
        });
    };

    const handleDeleteSection = (sectionName) => {
        if (Object.keys(sections).length === 1) {
            setSaveStatus({ type: 'error', message: 'Une évaluation doit contenir au moins une section.' });
            return;
        }

        const newSections = { ...sections };
        delete newSections[sectionName];
        setSections(newSections);
        setSaveStatus(null);
    };

    React.useEffect(() => {
        fetch(`${API_URL}/api/questions`)
            .then(res => res.json())
            .then(data => {
                if (data && Object.keys(data).length > 0) {
                    setSections(data);
                }
            })
            .catch(() => {});
    }, []);

    const handleAddQuestion = (sectionName) => {
        const newQuestion = { name: "Nouvelle Question", min: 1, max: 4, descriptions: ["", "", "", ""] };
        const newSections = { ...sections };
        newSections[sectionName] = [...newSections[sectionName], newQuestion];
        setSections(newSections);
    };

    const handleDeleteQuestion = (sectionName, questionName) => {
        const newSections = { ...sections };
        newSections[sectionName] = newSections[sectionName].filter(q => q.name !== questionName);
        setSections(newSections);
    };

    const handleQuestionChange = (sectionName, oldName, newName) => {
        const newSections = { ...sections };
        const question = newSections[sectionName].find(q => q.name === oldName);
        if (question) {
            question.name = newName;
            setSections(newSections);
        }
    };

    const handleDescriptionChange = (sectionName, questionName, idx, value) => {
        const newSections = { ...sections };
        const q = newSections[sectionName].find(q => q.name === questionName);
        if (q) {
            q.descriptions = q.descriptions || ["", "", "", ""];
            q.descriptions[idx] = value;
            setSections(newSections);
        }
    };

    const handleScaleChange = (sectionName, questionName, field, value) => {
        const newSections = { ...sections };
        const q = newSections[sectionName].find(q => q.name === questionName);
        if (q) {
            const num = Number(value);
            q[field] = num;
            if (field === 'max') {
                q.descriptions = q.descriptions || [];
                const desired = Math.max(1, num || 1);
                if (q.descriptions.length < desired) {
                    while (q.descriptions.length < desired) q.descriptions.push('');
                } else if (q.descriptions.length > desired) {
                    q.descriptions = q.descriptions.slice(0, desired);
                }
            }
            setSections(newSections);
        }
    };

    const handleSaveChanges = async () => {
        const saved = await persistQuestions();
        if (saved) {
            setSaveStatus({ type: 'success', message: 'Modifications enregistrées avec succès.' });
            window.setTimeout(() => setSaveStatus(null), 2600);
        }
    };

    const handleStartEvaluation = async () => {
        await persistQuestions();
        localStorage.removeItem('indigo-evaluation-state');
        navigate('/evaluation-simultaneous');
    };

    return (
        <div className="manage-questions-container">
            <h2>Gérer les Questions d'Évaluation</h2>
            {saveStatus && (
                <div className={`save-status ${saveStatus.type}`} role="status" aria-live="polite">
                    {saveStatus.message}
                </div>
            )}
            <div className="sections-toolbar">
                <strong>Nombre de sections : {Object.keys(sections).length}</strong>
                <strong>Score maximal : {Object.values(sections).reduce((total, questions) => total + (Array.isArray(questions) ? questions.reduce((sectionTotal, question) => sectionTotal + (Number(question.max) || (question.descriptions || []).length || 4), 0) : 0), 0).toFixed(2)} points</strong>
                <button type="button" onClick={handleAddSection}>Ajouter une section</button>
            </div>
            {Object.keys(sections).map(sectionName => (
                <div key={sectionName} className="section-card">
                    <div className="section-header">
                        <input
                            type="text"
                            value={sectionName}
                            aria-label={`Nom de la section ${sectionName}`}
                            onChange={(e) => handleSectionNameChange(sectionName, e.target.value)}
                        />
                        <button
                            type="button"
                            className="delete-section-btn"
                            onClick={() => handleDeleteSection(sectionName)}
                            disabled={Object.keys(sections).length === 1}
                        >
                            Supprimer la section
                        </button>
                    </div>
                    {sections[sectionName].map((q, questionIndex) => (
                        <div key={`${sectionName}-${questionIndex}`} className="question-item">
                            <div className="question-header">
                                <input 
                                    type="text" 
                                    value={q.name} 
                                    onChange={(e) => handleQuestionChange(sectionName, q.name, e.target.value)}
                                />
                                <button onClick={() => handleDeleteQuestion(sectionName, q.name)}>Supprimer</button>
                            </div>
                            <div className="question-scales">
                                <label>Min:
                                    <input type="number" value={q.min || 1} onChange={(e) => handleScaleChange(sectionName, q.name, 'min', e.target.value)} />
                                </label>
                                <label>Max:
                                    <input type="number" value={q.max || 4} onChange={(e) => handleScaleChange(sectionName, q.name, 'max', e.target.value)} />
                                </label>
                            </div>
                            <div className="descriptions">
                                <strong>Descriptions (scale)</strong>
                                {Array.from({length: (q.descriptions && q.descriptions.length) || 4}).map((_, idx) => (
                                    <input key={idx} type="text" value={(q.descriptions && q.descriptions[idx]) || ''} placeholder={`${idx+1}: description`} onChange={(e) => handleDescriptionChange(sectionName, q.name, idx, e.target.value)} />
                                ))}
                            </div>
                        </div>
                    ))}
                    <button onClick={() => handleAddQuestion(sectionName)}>Ajouter une question</button>
                </div>
            ))}
            <div className="question-actions">
                <button type="button" className="scale-btn" onClick={() => navigate('/manage-scale')}>
                    Modifier l’échelle des statuts
                </button>
                <button onClick={handleSaveChanges} className="save-btn" disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button onClick={handleStartEvaluation} className="next-btn" disabled={saving}>
                    Démarrer l'évaluation
                </button>
            </div>
        </div>
    );
};

export default ManageQuestions;
