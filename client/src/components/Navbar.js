import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    const accessRole = sessionStorage.getItem('accessRole');

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand">Soft Skills Evaluator</Link>
            {accessRole === 'admin' && (
                <div className="nav-links">
                    <Link to="/admin">Accueil admin</Link>
                    <Link to="/manage-participants">Création équipes</Link>
                    <Link to="/manage-juries">Création jurys</Link>
                    <Link to="/manage-questions">Créer l’évaluation</Link>
                    <Link to="/manage-scale">Échelle des statuts</Link>
                    <Link to="/evaluation-simultaneous">Évaluation</Link>
                    <Link to="/dashboard">Dashboard</Link>
                    <Link to="/collective-dashboard">Dashboard collectif</Link>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
