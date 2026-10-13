import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManageJuries.css';
import { API_URL } from '../api';

const ManageJuries = () => {
    const [juries, setJuries] = useState([]);
    const [teams, setTeams] = useState([]);
    const [juryName, setJuryName] = useState('');
    const [juryTeam, setJuryTeam] = useState('');
    const [evaluationMode, setEvaluationMode] = useState('teams');
    const navigate = useNavigate();

    const buildAccessCode = (juryName) => `INDIGO-${String(juryName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') || 'jury'}`.toUpperCase();

    const fetchJuries = () => {
        fetch(`${API_URL}/api/juries`)
            .then(res => res.json())
            .then(data => setJuries(Array.isArray(data.data) ? data.data : []))
            .catch(err => console.error('Failed to fetch juries:', err));
    };

    useEffect(() => {
        fetchJuries();
        fetch(`${API_URL}/api/evaluation-mode`)
            .then(res => res.json())
            .then(data => setEvaluationMode(data.mode === 'collective' ? 'collective' : 'teams'))
            .catch(() => {});
        fetch(`${API_URL}/api/teams`)
            .then(res => res.json())
            .then(data => {
                const loadedTeams = Array.isArray(data.data) ? data.data : [];
                setTeams(loadedTeams);
                if (loadedTeams.length > 0) {
                    setJuryTeam(prev => prev || loadedTeams[0].name);
                }
            })
            .catch(err => console.error('Failed to fetch teams:', err));
    }, []);

    const handleAddJury = (event) => {
        event.preventDefault();
        const team = evaluationMode === 'collective' ? 'Toutes les équipes' : juryTeam;
        if (!juryName.trim() || !team) return;

        fetch(`${API_URL}/api/juries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: juryName.trim(), team, mode: evaluationMode })
        })
            .then(res => res.json())
            .then(data => {
                if (data.message === 'success') {
                    setJuryName('');
                    fetchJuries();
                }
            })
            .catch(err => console.error('Failed to add jury:', err));
    };

    const handleDeleteJury = (id) => {
        fetch(`${API_URL}/api/juries/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.message === 'deleted') {
                    fetchJuries();
                }
            })
            .catch(err => console.error('Failed to delete jury:', err));
    };

    const handleCopyCode = async (code) => {
        try {
            await navigator.clipboard.writeText(code);
        } catch (error) {
            console.error('Failed to copy jury code:', error);
        }
    };

    const handleUseJury = async (jury) => {
        const accessCode = String(jury.accessCode || buildAccessCode(jury.name)).toUpperCase();
        const modeResponse = await fetch(`${API_URL}/api/evaluation-mode`);
        const modeData = await modeResponse.json().catch(() => ({}));
        const evaluationMode = modeData.mode || 'teams';
        const juryInfo = {
            name: jury.name,
            juryName: jury.name,
            team: jury.team,
            accessCode,
            evaluationMode
        };

        try {
            const lockResponse = await fetch(`${API_URL}/api/evaluations/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team: jury.team,
                    accessCode,
                    juryName: jury.name,
                    mode: evaluationMode
                })
            });
            const lockData = await lockResponse.json().catch(() => ({}));

            if (!lockResponse.ok) {
                throw new Error(lockData.error || 'Impossible de démarrer cette évaluation.');
            }

            const activeLock = JSON.stringify({
                team: jury.team,
                accessCode,
                juryName: jury.name,
                evaluationMode
            });
            sessionStorage.setItem('accessRole', 'jury');
            sessionStorage.setItem('juryInfo', JSON.stringify(juryInfo));
            localStorage.setItem('juryInfo', JSON.stringify(juryInfo));
            sessionStorage.setItem('activeEvaluationLock', activeLock);
            localStorage.setItem('activeEvaluationLock', activeLock);
            navigate('/evaluation-simultaneous');
        } catch (error) {
            window.alert(error.message || 'Impossible de démarrer cette évaluation.');
        }
    };

    return (
        <div className="manage-juries-container">
            <h2>{evaluationMode === 'collective' ? 'Créer les jurys pour toutes les équipes' : 'Créer les jurys et les attribuer à une équipe'}</h2>

            <div className="jury-mode-notice">
                {evaluationMode === 'collective'
                    ? 'Mode collectif : chaque jury verra tous les participants. Il n’est pas nécessaire de choisir une équipe.'
                    : 'Mode équipes différentes : chaque jury est associé à une équipe.'}
            </div>

            <form className="add-jury-form" onSubmit={handleAddJury}>
                <h3>Ajouter un jury</h3>
                <input
                    type="text"
                    placeholder="Nom du jury"
                    value={juryName}
                    onChange={(e) => setJuryName(e.target.value)}
                    required
                />
                {evaluationMode === 'teams' && (
                    <select value={juryTeam} onChange={(e) => setJuryTeam(e.target.value)} required disabled={teams.length === 0}>
                        <option value="">Choisir une équipe</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.name}>{team.name}</option>
                        ))}
                    </select>
                )}
                <button type="submit">Ajouter le jury</button>
            </form>

            <div className="jury-list">
                <h3>Jurys créés</h3>
                {juries.length === 0 ? (
                    <p>Aucun jury créé pour le moment.</p>
                ) : juries.map(jury => (
                    <div key={jury.id} className="jury-item">
                        <div>
                            <strong>{jury.name}</strong>
                            <span> — {evaluationMode === 'collective' ? 'Toutes les équipes' : jury.team}</span>
                            <div className="jury-code-row">
                                <span>Code: {jury.accessCode || buildAccessCode(jury.team)}</span>
                                {jury.accessCode && (
                                    <button type="button" className="copy-btn" onClick={() => handleCopyCode(jury.accessCode)}>Copier</button>
                                )}
                            </div>
                        </div>
                        <div className="jury-actions">
                            <button className="use-btn" onClick={() => handleUseJury(jury)}>Utiliser</button>
                            <button className="delete-btn" onClick={() => handleDeleteJury(jury.id)}>Supprimer</button>
                        </div>
                    </div>
                ))}
            </div>

            <button className="next-btn" onClick={() => navigate('/dashboard')}>Aller au dashboard</button>
        </div>
    );
};

export default ManageJuries;
