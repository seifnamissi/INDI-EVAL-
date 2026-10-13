import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './ManageScale.css';
import { API_URL } from '../api';

const defaultScale = (maxScore) => [
    { label: 'Insuffisant', min: 0, max: maxScore / 4 },
    { label: 'Intermédiaire', min: maxScore / 4, max: maxScore / 2 },
    { label: 'Satisfaisant', min: maxScore / 2, max: (maxScore * 3) / 4 },
    { label: 'Très bon', min: (maxScore * 3) / 4, max: maxScore }
].map((level) => ({ ...level, min: Number(level.min.toFixed(2)), max: Number(level.max.toFixed(2)) }));

const ManageScale = () => {
    const [maxScore, setMaxScore] = useState(0);
    const [scale, setScale] = useState([]);
    const [saveStatus, setSaveStatus] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/api/scale`)
            .then((response) => response.json())
            .then((data) => {
                const total = Number(data.maxScore || 0);
                setMaxScore(total);
                setScale(Array.isArray(data.scale) && data.scale.length === 4 ? data.scale : defaultScale(total));
            })
            .catch(() => setSaveStatus({ type: 'error', message: 'Impossible de charger l’échelle.' }));
    }, []);

    const updateLevel = (index, field, value) => {
        setScale((current) => current.map((level, levelIndex) => (
            levelIndex === index
                ? { ...level, [field]: field === 'label' ? value : Number(value) }
                : level
        )));
        setSaveStatus(null);
    };

    const resetScale = () => {
        setScale(defaultScale(maxScore));
        setSaveStatus(null);
    };

    const saveChanges = async () => {
        setSaving(true);
        setSaveStatus(null);
        try {
            const response = await fetch(`${API_URL}/api/scale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scale })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Enregistrement impossible.');
            setScale(data.scale);
            setSaveStatus({ type: 'success', message: 'Échelle enregistrée.' });
        } catch (error) {
            setSaveStatus({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="manage-scale-container">
            <div className="scale-navigation">
                <Link to="/admin">Accueil admin</Link>
                <Link to="/manage-questions">Créer l’évaluation</Link>
                <Link to="/dashboard">Dashboard</Link>
            </div>
            <h1>Échelle des statuts</h1>
            <p className="scale-intro">Les bornes sont calculées sur le score maximal de l’évaluation. Tu peux modifier les bornes et le nom de chaque statut.</p>
            <div className="max-score-card">
                <span>Score maximal calculé</span>
                <strong>{maxScore.toFixed(2)} points</strong>
            </div>
            {saveStatus && <div className={`scale-status ${saveStatus.type}`} role="status">{saveStatus.message}</div>}
            <div className="scale-table-wrapper">
                <table className="scale-table">
                    <thead>
                        <tr><th>Niveau</th><th>Statut affiché</th><th>Minimum</th><th>Maximum</th></tr>
                    </thead>
                    <tbody>
                        {scale.map((level, index) => (
                            <tr key={index}>
                                <td><span className={`scale-index scale-index-${index}`}>{index + 1}</span></td>
                                <td><input value={level.label} onChange={(event) => updateLevel(index, 'label', event.target.value)} /></td>
                                <td><input type="number" min="0" step="0.01" value={level.min} onChange={(event) => updateLevel(index, 'min', event.target.value)} /></td>
                                <td><input type="number" min="0" step="0.01" value={level.max} onChange={(event) => updateLevel(index, 'max', event.target.value)} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="scale-actions">
                <button type="button" className="reset-scale-button" onClick={resetScale}>Réinitialiser automatiquement</button>
                <button type="button" className="save-scale-button" onClick={saveChanges} disabled={saving || scale.length !== 4}>{saving ? 'Enregistrement...' : 'Enregistrer l’échelle'}</button>
            </div>
        </div>
    );
};

export default ManageScale;
