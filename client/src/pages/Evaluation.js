import React, { useState, useEffect } from 'react';
import './Evaluation.css';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../api';
const socket = io(SOCKET_URL);

const sections = {
    "SECTION 1 - PANEL": [
        { name: "Écoute active", min: 1, max: 4, description: ["distrait", "engagé"] },
        { name: "Communication orale", min: 1, max: 4, description: ["ne parle pas", "structuré/impactant"] },
        { name: "Curiosité / Esprit critique", min: 1, max: 4, description: ["aucune question", "approfondies/lien métier"] }
    ],
    "SECTION 2 - ACTIVITÉ 1 (Build Identity)": [
        { name: "Créativité", min: 1, max: 4 },
        { name: "Contribution au groupe", min: 1, max: 4 },
        { name: "Structuration des idées", min: 1, max: 4 },
        { name: "Collaboration & Teamwork", min: 1, max: 4 },
        { name: "Communication finale", min: 1, max: 4 }
    ],
    "SECTION 3 - ACTIVITÉ 2 (Fusion Challenge)": [
        { name: "Collaboration inter-équipe", min: 1, max: 4 },
        { name: "Écoute & ouverture", min: 1, max: 4 },
        { name: "Résolution de problème", min: 1, max: 4 },
        { name: "Participation & Implication", min: 1, max: 4 },
        { name: "Pitch final", min: 1, max: 4 }
    ],
    "SECTION 4 - TRANSVERSAL": [
        { name: "Leadership naturel", min: 1, max: 4 },
        { name: "Adaptabilité", min: 1, max: 4 },
        { name: "Engagement & Énergie", min: 1, max: 4 },
        { name: "Gestion du temps", min: 1, max: 4 }
    ]
};

const Evaluation = () => {
    const [scores, setScores] = useState({});
    const [juryInfo, setJuryInfo] = useState({});

    useEffect(() => {
        const info = JSON.parse(sessionStorage.getItem('juryInfo'));
        if (info) {
            setJuryInfo(info);
        }
    }, []);

    const handleScoreChange = (section, criterion, value) => {
        const newScores = {
            ...scores,
            [section]: {
                ...scores[section],
                [criterion]: value
            }
        };
        setScores(newScores);
        
        const { juryName, candidate, team } = juryInfo;
        socket.emit('submitScore', {
            juryName,
            candidate,
            team,
            section,
            criterion,
            score: value
        });
    };

    return (
        <div className="evaluation-container">
            <h1>Evaluation for {juryInfo.candidate}</h1>
            <p>Evaluated by: {juryInfo.juryName}</p>
            
            {Object.keys(sections).map(sectionName => (
                <div key={sectionName} className="section-card">
                    <h2>{sectionName}</h2>
                    {sections[sectionName].map(criterion => (
                        <div key={criterion.name} className="criterion-row">
                            <label>{criterion.name}</label>
                            <div className="score-input">
                                <span>{criterion.description ? criterion.description[0] : ''}</span>
                                <input 
                                    type="range" 
                                    min={criterion.min} 
                                    max={criterion.max}
                                    value={scores[sectionName]?.[criterion.name] || ''}
                                    onChange={(e) => handleScoreChange(sectionName, criterion.name, parseInt(e.target.value))}
                                />
                                <span>{criterion.description ? criterion.description[1] : ''}</span>
                                <span className="score-value">{scores[sectionName]?.[criterion.name]}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default Evaluation;
