import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../api';
import StarRating from '../components/StarRating';
import './SimultaneousEvaluation.css';

const socket = io(SOCKET_URL);
const EVALUATION_STATE_KEY = 'indigo-evaluation-state';

const getEvaluationStateKey = (juryInfo = {}) => {
    const team = String(juryInfo.team || 'unknown').trim();
    const name = String(juryInfo.name || juryInfo.juryName || 'unknown').trim();
    const accessCode = String(juryInfo.accessCode || 'no-code').trim();
    const seed = `${team}-${name}-${accessCode}`.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    return `${EVALUATION_STATE_KEY}:${seed}`;
};

const defaultSections = {
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

const SimultaneousEvaluation = () => {
    const navigate = useNavigate();
    const [questions, setQuestions] = useState({});
    const [participants, setParticipants] = useState([]);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [scores, setScores] = useState({});
    const [juryName, setJuryName] = useState('');
    const [juryTeam, setJuryTeam] = useState('');
    const [loadingParticipants, setLoadingParticipants] = useState(true);
    const [isHydrated, setIsHydrated] = useState(false);
    const [restoredSessionNotice, setRestoredSessionNotice] = useState('');
    const savedStateRef = useRef(null);

    const readSavedState = (juryInfo) => {
        try {
            const stateKey = getEvaluationStateKey(juryInfo);
            const rawState = localStorage.getItem(stateKey) || sessionStorage.getItem(stateKey);
            if (!rawState) return null;

            const parsedState = JSON.parse(rawState);
            if (!parsedState || !parsedState.juryInfo || !juryInfo) return null;

            const sameJury = parsedState.juryInfo.team === juryInfo.team && parsedState.juryInfo.name === juryInfo.name;
            return sameJury ? parsedState : null;
        } catch (error) {
            return null;
        }
    };

    const persistEvaluationState = (nextState) => {
        try {
            const juryInfo = JSON.parse(localStorage.getItem('juryInfo') || sessionStorage.getItem('juryInfo') || '{}') || {};
            const stateKey = getEvaluationStateKey(juryInfo);

            const toStore = { ...nextState };
            try {
                const scores = nextState.scores || {};
                const scoresByName = {};
                Object.entries(scores).forEach(([pid, entry]) => {
                    const found = participants.find(p => String(p.id) === String(pid));
                    if (found) scoresByName[found.name] = entry;
                });
                if (Object.keys(scoresByName).length > 0) {
                    toStore.scoresByName = scoresByName;
                }
            } catch (e) {
                // ignore mapping errors
            }

            localStorage.setItem(stateKey, JSON.stringify(toStore));
            sessionStorage.setItem(stateKey, JSON.stringify(toStore));
        } catch (error) {
            // Ignore storage quota / privacy mode issues.
        }
    };

    const releaseCurrentLock = async () => {
        try {
            const juryInfo = JSON.parse(localStorage.getItem('juryInfo') || sessionStorage.getItem('juryInfo') || '{}') || {};
            const accessCode = String(juryInfo.accessCode || '').toUpperCase();
            const team = String(juryInfo.team || '').trim();
            const mode = juryInfo.evaluationMode || 'teams';
            if (!accessCode || !team) {
                return;
            }

            await fetch(`${API_URL}/api/evaluations/lock/${encodeURIComponent(accessCode)}?team=${encodeURIComponent(team)}&mode=${encodeURIComponent(mode)}`, {
                method: 'DELETE'
            });

            sessionStorage.removeItem('activeEvaluationLock');
            localStorage.removeItem('activeEvaluationLock');
            sessionStorage.removeItem('juryInfo');
            localStorage.removeItem('juryInfo');
        } catch (error) {
            // ignore cleanup errors
        }
    };

    useEffect(() => {
        const loadLatestQuestions = async () => {
            try {
                const response = await fetch(`${API_URL}/api/questions`);
                const data = await response.json();
                if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                    sessionStorage.setItem('evaluationQuestions', JSON.stringify(data));
                    return data;
                }
            } catch (error) {
                console.warn('Failed to load latest evaluation questions from server:', error);
            }

            try {
                const storedQuestions = JSON.parse(sessionStorage.getItem('evaluationQuestions'));
                if (storedQuestions && typeof storedQuestions === 'object' && Object.keys(storedQuestions).length > 0) {
                    return storedQuestions;
                }
            } catch (error) {
                // ignore parse issues and use default sections below
            }

            return defaultSections;
        };

        const juryInfo = JSON.parse(localStorage.getItem('juryInfo') || sessionStorage.getItem('juryInfo') || 'null');
        if (!juryInfo || !juryInfo.name || !juryInfo.team) {
            navigate('/');
            return;
        }

        const savedState = readSavedState(juryInfo);
        if (savedState) savedStateRef.current = savedState;

        const activeLock = JSON.parse(localStorage.getItem('activeEvaluationLock') || sessionStorage.getItem('activeEvaluationLock') || 'null');
        if (!activeLock || activeLock.team !== juryInfo.team || activeLock.accessCode !== juryInfo.accessCode || (activeLock.evaluationMode || 'teams') !== (juryInfo.evaluationMode || 'teams')) {
            alert('Session d’évaluation invalide. Veuillez recommencer.');
            navigate('/');
            return;
        }

        loadLatestQuestions().then((questionsToUse) => {
            setQuestions(questionsToUse);
        }).catch(() => {
            setQuestions(defaultSections);
        });

        if (juryInfo) {
            setJuryName(juryInfo.name || juryInfo.juryName || '');
            setJuryTeam(juryInfo.evaluationMode === 'collective' ? 'Toutes les équipes' : (juryInfo.team || ''));
        }

        // NOTE: do not set scores here — wait until participants are loaded to restore reliably

        // Fetch participants from the server
        fetch(`${API_URL}/api/participants`)
            .then(res => res.json())
            .then(data => {
                if (data.data && Array.isArray(data.data)) {
                    const teamParticipants = juryInfo && juryInfo.team && juryInfo.evaluationMode !== 'collective'
                        ? data.data.filter(participant => participant.team === juryInfo.team)
                        : data.data;
                    const filteredParticipants = juryInfo.evaluationMode === 'collective'
                        ? teamParticipants.filter((participant, index, list) => list.findIndex(item => item.name === participant.name) === index)
                        : teamParticipants;
                    setParticipants(filteredParticipants);
                } else {
                    setParticipants([]);
                }
                setLoadingParticipants(false);
                // Now that participants are loaded, attempt to restore saved state (if any)
                try {
                    const toRestore = savedStateRef.current;
                    if (toRestore) {
                        setRestoredSessionNotice('Session retrouvée / progression restaurée');
                        // Map saved scores to current participant IDs. Support both id-keyed and name-keyed saves.
                        const restoredScores = {};
                        const savedScores = toRestore.scores || {};
                        const allTeamParticipants = (juryInfo && juryInfo.team && juryInfo.evaluationMode !== 'collective') ? (data.data || []).filter(p => p.team === juryInfo.team) : (data.data || []);
                        const currentParticipants = juryInfo.evaluationMode === 'collective'
                            ? allTeamParticipants.filter((participant, index, list) => list.findIndex(item => item.name === participant.name) === index)
                            : allTeamParticipants;

                        // Helper to determine if saved keys look like numeric IDs
                        const savedKeys = Object.keys(savedScores);
                        const keysLookLikeIds = savedKeys.length > 0 && savedKeys.every(k => /^\d+$/.test(k));

                        if (keysLookLikeIds) {
                            // If IDs are still present in current participants, keep them; otherwise try mapping by name
                            const currentIds = new Set((currentParticipants || []).map(p => String(p.id)));
                            if (savedKeys.every(k => currentIds.has(k))) {
                                // IDs match, use as-is
                                Object.assign(restoredScores, savedScores);
                            } else {
                                // If we have a name-keyed backup, use it to map into current ids
                                if (toRestore.scoresByName && typeof toRestore.scoresByName === 'object') {
                                    for (const [nameKey, entry] of Object.entries(toRestore.scoresByName)) {
                                        const found = (currentParticipants || []).find(p => p.name === nameKey);
                                        if (found) {
                                            restoredScores[found.id] = entry;
                                        }
                                    }
                                }
                                // otherwise we cannot reliably map numeric-id keyed saved scores to new participants
                            }
                        } else {
                            // Keys look like names — map by participant name to current id
                            for (const [nameKey, entry] of Object.entries(savedScores)) {
                                const found = (currentParticipants || []).find(p => p.name === nameKey || String(p.id) === nameKey);
                                if (found) {
                                    restoredScores[found.id] = entry;
                                }
                            }
                        }

                        // If we couldn't map anything but a saved currentSectionIndex exists, still restore the section index
                        if (Object.keys(restoredScores).length > 0) {
                            setScores(restoredScores);
                        }

                        setCurrentSectionIndex(Number.isInteger(toRestore.currentSectionIndex) ? toRestore.currentSectionIndex : 0);
                        // Clear savedStateRef so we don't re-apply
                        savedStateRef.current = null;
                    }
                } catch (e) {
                    console.error('Failed to restore saved evaluation state:', e);
                }
                // Hydration complete after participants are loaded and restore attempted
                setIsHydrated(true);
            })
            .catch(err => {
                console.error("Failed to fetch participants:", err);
                setParticipants([]);
                setLoadingParticipants(false);
                // Even on error, mark hydration complete so persistence can start
                setIsHydrated(true);
            });
    }, [navigate]);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        const juryInfo = JSON.parse(localStorage.getItem('juryInfo') || sessionStorage.getItem('juryInfo') || 'null');
        if (!juryInfo || !juryInfo.name || !juryInfo.team) {
            return;
        }

        persistEvaluationState({
            juryInfo: {
                name: juryInfo.name || juryInfo.juryName || '',
                team: juryInfo.team || '',
                accessCode: juryInfo.accessCode || ''
            },
            questions,
            currentSectionIndex,
            scores
        });
    }, [isHydrated, questions, currentSectionIndex, scores]);

    // The evaluation lock must stay active while the jury is working.
    // We release it only when the jury explicitly finishes or exits from the evaluation,
    // to avoid accidental unlocks caused by React StrictMode or page re-renders.

    const sectionNames = Object.keys(questions);
    const currentSectionName = sectionNames[currentSectionIndex] || '';
    const currentCriterions = Array.isArray(questions[currentSectionName]) ? questions[currentSectionName] : [];

    const handleScoreChange = (participantId, criterionName, value) => {
        const newScores = {
            ...scores,
            [participantId]: {
                ...scores[participantId],
                [criterionName]: {
                    ...(scores[participantId] && scores[participantId][criterionName] && typeof scores[participantId][criterionName] === 'object' ? scores[participantId][criterionName] : { value: (scores[participantId] && scores[participantId][criterionName]) || 0 }),
                    value
                }
            }
        };
        setScores(newScores);
    };

    const handleCommentChange = (participantId, criterionName, text) => {
        const newScores = {
            ...scores,
            [participantId]: {
                ...scores[participantId],
                [criterionName]: {
                    ...(scores[participantId] && scores[participantId][criterionName] && typeof scores[participantId][criterionName] === 'object' ? scores[participantId][criterionName] : { value: (scores[participantId] && scores[participantId][criterionName]) || 0 }),
                    comment: text
                }
            }
        };
        setScores(newScores);
    };

    const handleSubmitSection = () => {
        // Require completeness: every participant must have a score for every criterion
        const missing = [];
        participants.forEach(p => {
            currentCriterions.forEach(c => {
                const raw = scores[p.id]?.[c.name];
                const value = (typeof raw === 'object' && raw !== null) ? raw.value : raw;
                if (value === undefined || value === null || value === '') {
                    missing.push({ participant: p.name, criterion: c.name });
                }
            });
        });

        if (missing.length > 0) {
            alert('Veuillez noter tous les participants pour cette section avant de continuer.');
            return;
        }

        // Submit all scores for the current section (all required values are present)
        participants.forEach(p => {
            currentCriterions.forEach(c => {
                const raw = scores[p.id]?.[c.name];
                const value = (typeof raw === 'object' && raw !== null) ? raw.value : raw;
                const comment = (typeof raw === 'object' && raw !== null) ? raw.comment : undefined;
                // value should be defined because of the completeness check
                socket.emit('submitScore', {
                    juryName,
                    candidate: p.name,
                    team: p.team,
                    section: currentSectionName,
                    criterion: c.name,
                    score: value,
                    comment
                });
            });
        });

        // Move to next section
        if (currentSectionIndex < sectionNames.length - 1) {
            setCurrentSectionIndex(currentSectionIndex + 1);
        } else {
            alert("Évaluation terminée !");
            try {
                const juryInfo = JSON.parse(localStorage.getItem('juryInfo') || sessionStorage.getItem('juryInfo') || '{}') || {};
                localStorage.removeItem(getEvaluationStateKey(juryInfo));
                sessionStorage.removeItem(getEvaluationStateKey(juryInfo));
            } catch (error) {
                // ignore
            }
            releaseCurrentLock();
        }
    };

    return (
        <div className="simultaneous-evaluation-container">
            {restoredSessionNotice && (
                <div className="restored-session-banner" role="status" aria-live="polite">
                    {restoredSessionNotice}
                </div>
            )}
            <h1>Évaluation {JSON.parse(localStorage.getItem('juryInfo') || sessionStorage.getItem('juryInfo') || '{}').evaluationMode === 'collective' ? 'Collective' : 'Simultanée'} - {currentSectionName}</h1>
            <p>Évaluateur: {juryName}</p>
            {juryTeam && <p>Équipe évaluée: {juryTeam}</p>}

            {sectionNames.length === 0 && (
                <p>Aucune configuration d'évaluation n'a été trouvée. Les sections par défaut ont été chargées.</p>
            )}

            <div className="participants-grid">
                {loadingParticipants && (
                    <p>Chargement des participants...</p>
                )}
                {!loadingParticipants && participants.length === 0 && (
                    <p>Aucun participant n'a été chargé. Vérifiez la page Gestion des Participants.</p>
                )}
                {participants.map(p => (
                    <div key={p.id} className="participant-card">
                        <h3>{p.name}</h3>
                        {currentCriterions.map(c => (
                            <div key={c.name} className="criterion-block">
                                <h4>{c.name}</h4>
                                {Array.isArray(c.descriptions) && c.descriptions.length > 0 ? (
                                    <ul className="criterion-descriptions">
                                        {c.descriptions.map((desc, i) => (
                                            <li key={i}><strong>{i + 1}:</strong> {desc}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="criterion-descriptions">Aucune description disponible pour cette question.</p>
                                )}
                                <StarRating 
                                    score={(scores[p.id] && scores[p.id][c.name] && ((typeof scores[p.id][c.name] === 'object') ? scores[p.id][c.name].value : scores[p.id][c.name])) || 0}
                                    onChange={(score) => handleScoreChange(p.id, c.name, score)}
                                    max={c.max || 4}
                                />
                                <textarea className="criterion-comment" placeholder="Ajouter un commentaire (optionnel)" value={(scores[p.id] && scores[p.id][c.name] && scores[p.id][c.name].comment) || ''} onChange={(e) => handleCommentChange(p.id, c.name, e.target.value)} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <button onClick={handleSubmitSection} className="next-btn">
                {currentSectionIndex < sectionNames.length - 1 ? 'Valider et passer à la section suivante' : 'Terminer l\'évaluation'}
            </button>
        </div>
    );
};

export default SimultaneousEvaluation;
