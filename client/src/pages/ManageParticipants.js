import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { useNavigate } from 'react-router-dom';
import './ManageParticipants.css';

const ManageParticipants = () => {
    const [participants, setParticipants] = useState([]);
    const [teams, setTeams] = useState([]);
    const [newTeamName, setNewTeamName] = useState('');
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [editingTeamName, setEditingTeamName] = useState('');
    const [newParticipantName, setNewParticipantName] = useState('');
    const [newParticipantTeam, setNewParticipantTeam] = useState('');
    const [evaluationMode, setEvaluationMode] = useState('teams');
    const navigate = useNavigate();

    const fetchParticipants = () => {
        fetch(`${API_URL}/api/participants`)
            .then(res => res.json())
            .then(data => setParticipants(data.data))
            .catch(err => console.error("Failed to fetch participants:", err));
    };

    const refreshTeams = () => {
        fetch(`${API_URL}/api/teams`)
            .then(res => res.json())
            .then(data => {
                const loadedTeams = Array.isArray(data.data) ? data.data : [];
                setTeams(loadedTeams);
                if (loadedTeams.length > 0) {
                    setNewParticipantTeam(prev => {
                        const isStillValid = loadedTeams.some(team => team.name === prev);
                        return isStillValid ? prev : loadedTeams[0].name;
                    });
                } else {
                    setNewParticipantTeam('');
                }
            })
            .catch(err => console.error('Failed to fetch teams:', err));
    };

    useEffect(() => {
        fetchParticipants();
        refreshTeams();
        fetch(`${API_URL}/api/evaluation-mode`)
            .then(res => res.json())
            .then(data => setEvaluationMode(data.mode === 'collective' ? 'collective' : 'teams'))
            .catch(() => {});
    }, []);

    const handleEvaluationModeChange = async (mode) => {
        try {
            const response = await fetch(`${API_URL}/api/evaluation-mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            if (!response.ok) throw new Error('Impossible de modifier le mode.');
            setEvaluationMode(mode);
        } catch (error) {
            window.alert(error.message);
        }
    };

    const handleAddTeam = (e) => {
        e.preventDefault();
        if (!newTeamName.trim()) return;

        fetch(`${API_URL}/api/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newTeamName.trim() })
        })
            .then(res => res.json())
            .then(data => {
                if (data.message === 'success') {
                    setNewTeamName('');
                    refreshTeams();
                }
            })
            .catch(err => console.error('Failed to add team:', err));
    };

    const handleStartEditTeam = (team) => {
        setEditingTeamId(team.id);
        setEditingTeamName(team.name);
    };

    const handleCancelEditTeam = () => {
        setEditingTeamId(null);
        setEditingTeamName('');
    };

    const handleSaveTeam = (teamId) => {
        if (!editingTeamName.trim()) return;

        fetch(`${API_URL}/api/teams/${teamId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editingTeamName.trim() })
        })
            .then(res => res.json())
            .then(data => {
                if (data.message === 'updated') {
                    handleCancelEditTeam();
                    refreshTeams();
                    fetchParticipants();
                }
            })
            .catch(err => console.error('Failed to update team:', err));
    };

    const handleDeleteTeam = (teamId) => {
        fetch(`${API_URL}/api/teams/${teamId}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.message === 'deleted') {
                    if (editingTeamId === teamId) {
                        handleCancelEditTeam();
                    }
                    refreshTeams();
                    fetchParticipants();
                }
            })
            .catch(err => console.error('Failed to delete team:', err));
    };

    const handleAddParticipant = (e) => {
        e.preventDefault();
        if (!newParticipantName || !newParticipantTeam) return;
        
        fetch(`${API_URL}/api/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newParticipantName, team: newParticipantTeam })
        })
        .then(res => res.json())
        .then(data => {
            if(data.message === 'success') {
                fetchParticipants(); // Re-fetch to get the new list with correct ID
                setNewParticipantName('');
                if (teams.length > 0) {
                    setNewParticipantTeam(teams[0].name);
                }
            }
        })
        .catch(err => console.error("Failed to add participant:", err));
    };

    const handleAddParticipantToAllTeams = async () => {
        if (!newParticipantName.trim() || teams.length === 0) return;
        try {
            const response = await fetch(`${API_URL}/api/participants/all-teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newParticipantName.trim() })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Impossible d’ajouter le participant.');
            fetchParticipants();
            setNewParticipantName('');
            window.alert(`Participant ajouté dans ${data.teams.length} équipe(s).`);
        } catch (error) {
            window.alert(error.message);
        }
    };

    const handleDeleteParticipant = (id) => {
        fetch(`${API_URL}/api/participants/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if(data.message === 'deleted') {
                fetchParticipants(); // Re-fetch
            }
        })
        .catch(err => console.error("Failed to delete participant:", err));
    };

    const handleNext = () => {
        sessionStorage.setItem('participants', JSON.stringify(participants));
        sessionStorage.setItem('teams', JSON.stringify(teams));
        navigate('/manage-juries');
    };

    return (
        <div className="manage-participants-container">
            <h2>Créer les équipes et les participants</h2>

            <div className="evaluation-mode-panel">
                <h3>Mode d’évaluation</h3>
                <p>{evaluationMode === 'collective' ? 'Tous les jurys voient tous les participants.' : 'Chaque jury voit uniquement les participants de son équipe.'}</p>
                <div className="evaluation-mode-actions">
                    <button type="button" className={evaluationMode === 'teams' ? 'mode-active' : ''} onClick={() => handleEvaluationModeChange('teams')}>Équipes différentes</button>
                    <button type="button" className={evaluationMode === 'collective' ? 'mode-active' : ''} onClick={() => handleEvaluationModeChange('collective')}>Évaluation collective</button>
                </div>
            </div>

            <form onSubmit={handleAddTeam} className="add-team-form">
                <h3>Ajouter une équipe</h3>
                <input
                    type="text"
                    placeholder="Nom de l'équipe"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                />
                <button type="submit">Ajouter l'équipe</button>
            </form>

            <div className="team-list">
                <h3>Équipes créées</h3>
                {teams.length === 0 ? (
                    <p>Aucune équipe créée pour le moment.</p>
                ) : teams.map(team => (
                    <div key={team.id} className="team-item">
                        {editingTeamId === team.id ? (
                            <div className="team-edit-row">
                                <input
                                    type="text"
                                    value={editingTeamName}
                                    onChange={(e) => setEditingTeamName(e.target.value)}
                                />
                                <div className="team-edit-actions">
                                    <button type="button" className="team-save-btn" onClick={() => handleSaveTeam(team.id)}>Enregistrer</button>
                                    <button type="button" className="team-cancel-btn" onClick={handleCancelEditTeam}>Annuler</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <span>{team.name}</span>
                                <div className="team-actions">
                                    <button type="button" className="team-edit-btn" onClick={() => handleStartEditTeam(team)}>Modifier</button>
                                    <button type="button" className="team-delete-btn" onClick={() => handleDeleteTeam(team.id)}>Supprimer</button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="participant-list">
                <h3>Participants enregistrés</h3>
                {participants.map(p => (
                    <div key={p.id} className="participant-item">
                        <span>{p.name} ({p.team})</span>
                        <button onClick={() => handleDeleteParticipant(p.id)}>Supprimer</button>
                    </div>
                ))}
            </div>

            <form onSubmit={handleAddParticipant} className="add-participant-form">
                <h3>Ajouter un nouveau participant</h3>
                <input 
                    type="text" 
                    placeholder="Nom du participant" 
                    value={newParticipantName} 
                    onChange={(e) => setNewParticipantName(e.target.value)} 
                    required 
                />
                <select
                    value={newParticipantTeam}
                    onChange={(e) => setNewParticipantTeam(e.target.value)}
                    required
                    disabled={teams.length === 0}
                >
                    <option value="">Choisir une équipe</option>
                    {teams.map(team => (
                        <option key={team.id} value={team.name}>{team.name}</option>
                    ))}
                </select>
                <button type="submit">Ajouter</button>
                {evaluationMode === 'collective' && (
                    <button type="button" className="add-all-teams-btn" onClick={handleAddParticipantToAllTeams} disabled={teams.length === 0}>
                        Ajouter le même participant dans toutes les équipes
                    </button>
                )}
            </form>

            <button onClick={handleNext} className="next-btn">Suivant</button>
        </div>
    );
};

export default ManageParticipants;
