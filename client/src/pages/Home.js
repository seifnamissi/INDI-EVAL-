import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import { API_URL } from '../api';

const Home = () => {
    const [juryCode, setJuryCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const ADMIN_CODE = 'adminindigo';
    const RESULTS_CODE = 'indigo6result';

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedCode = juryCode.trim().toLowerCase();
        if (!trimmedCode) return;

        setError('');
        setLoading(true);

        try {
            if (trimmedCode === ADMIN_CODE) {
                sessionStorage.setItem('accessRole', 'admin');
                sessionStorage.setItem('adminInfo', JSON.stringify({ code: ADMIN_CODE }));
                navigate('/admin');
                return;
            }

            if (trimmedCode === RESULTS_CODE) {
                sessionStorage.setItem('accessRole', 'admin');
                sessionStorage.setItem('adminInfo', JSON.stringify({ code: RESULTS_CODE }));
                navigate('/dashboard');
                return;
            }

            const response = await fetch(`${API_URL}/api/juries/code/${encodeURIComponent(trimmedCode.toUpperCase())}`);
            const data = await response.json();

            if (!response.ok || !data.data) {
                throw new Error(data.error || 'Code invalide');
            }

            const modeResponse = await fetch(`${API_URL}/api/evaluation-mode`);
            const modeData = await modeResponse.json().catch(() => ({}));
            const evaluationMode = data.data.evaluationMode || modeData.mode || 'teams';

            const lockResponse = await fetch(`${API_URL}/api/evaluations/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team: data.data.team,
                    accessCode: data.data.accessCode,
                    juryName: data.data.name,
                    mode: evaluationMode
                })
            });
            const lockData = await lockResponse.json().catch(() => ({}));

            if (!lockResponse.ok && lockData?.error) {
                throw new Error(lockData.error);
            }

            sessionStorage.setItem('accessRole', 'jury');
            sessionStorage.setItem('juryInfo', JSON.stringify(data.data));
            localStorage.setItem('juryInfo', JSON.stringify(data.data));
            sessionStorage.setItem('activeEvaluationLock', JSON.stringify({
                team: data.data.team,
                accessCode: data.data.accessCode,
                juryName: data.data.name,
                evaluationMode
            }));
            localStorage.setItem('activeEvaluationLock', JSON.stringify({
                team: data.data.team,
                accessCode: data.data.accessCode,
                juryName: data.data.name,
                evaluationMode
            }));
            navigate('/evaluation-simultaneous');
        } catch (fetchError) {
            setError(fetchError.message || 'Code invalide');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="home-container">
            <div className="login-box">
                <h2>Entrer un code d'accès</h2>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Code d'accès</label>
                        <input 
                            type="text" 
                            value={juryCode} 
                            onChange={(e) => setJuryCode(e.target.value)} 
                            required 
                            autoComplete="off"
                            placeholder="Ex: ADMININDIGO ou A1B2C3"
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? 'Vérification...' : 'Accéder'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Home;
