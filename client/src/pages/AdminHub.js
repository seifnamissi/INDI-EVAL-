import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminHub.css';
import { API_URL } from '../api';

const AdminHub = () => {
    const navigate = useNavigate();

    const openPage = (path) => {
        navigate(path);
    };

    const handleClearScores = async () => {
        if (window.confirm('⚠️ Êtes-vous sûr ? Cela supprimera TOUTES les évaluations précédentes.')) {
            try {
                const response = await fetch(`${API_URL}/api/scores/clear-all`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    const data = await response.json();
                    alert(`✓ ${data.changes} évaluations supprimées.`);
                } else {
                    alert('Erreur lors de la suppression des évaluations.');
                }
            } catch (error) {
                alert('Erreur: ' + error.message);
            }
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('accessRole');
        sessionStorage.removeItem('adminInfo');
        navigate('/');
    };

    return (
        <div className="admin-hub-container">
            <div className="admin-hub-card">
                <p className="admin-badge">Mode administrateur</p>
                <h1>Tableau de bord principal</h1>
                <p className="admin-hub-text">
                    Accédez à toute la plateforme depuis cet écran : création des équipes,
                    gestion des jurys, configuration de l'évaluation et dashboard.
                </p>

                <div className="admin-actions-grid">
                    <button onClick={() => openPage('/manage-participants')}>Créer / modifier les équipes</button>
                    <button onClick={() => openPage('/manage-juries')}>Créer les jurys</button>
                    <button onClick={() => openPage('/manage-questions')}>Créer l'évaluation</button>
                    <button onClick={() => openPage('/manage-scale')}>Modifier l'échelle et les statuts</button>
                    <button onClick={() => openPage('/evaluation-simultaneous')}>Lancer l'évaluation</button>
                    <button onClick={() => openPage('/dashboard')}>Ouvrir le dashboard</button>
                    <button onClick={() => openPage('/collective-dashboard')}>Dashboard collectif</button>
                    <button onClick={handleClearScores} className="danger-btn">🗑️ Effacer les évaluations</button>
                </div>

                <button className="logout-btn" onClick={handleLogout}>Quitter le mode admin</button>
            </div>
        </div>
    );
};

export default AdminHub;
