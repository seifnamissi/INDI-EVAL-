import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ManageParticipants from './pages/ManageParticipants';
import ManageJuries from './pages/ManageJuries';
import ManageQuestions from './pages/ManageQuestions';
import ManageScale from './pages/ManageScale';
import CollectiveDashboard from './pages/CollectiveDashboard';
import CollectiveParticipantAnalysis from './pages/CollectiveParticipantAnalysis';
import SimultaneousEvaluation from './pages/SimultaneousEvaluation';
import AdminHub from './pages/AdminHub';
import Navbar from './components/Navbar';
import './App.css';

const RequireJury = ({ children }) => {
  const role = sessionStorage.getItem('accessRole');
  return role === 'jury' ? children : <Home />;
};

const RequireAdmin = ({ children }) => {
  const role = sessionStorage.getItem('accessRole');
  return role === 'admin' ? children : <Home />;
};

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/manage-participants" element={<RequireAdmin><ManageParticipants /></RequireAdmin>} />
          <Route path="/manage-juries" element={<RequireAdmin><ManageJuries /></RequireAdmin>} />
          <Route path="/manage-questions" element={<RequireAdmin><ManageQuestions /></RequireAdmin>} />
          <Route path="/manage-scale" element={<RequireAdmin><ManageScale /></RequireAdmin>} />
          <Route path="/admin" element={<RequireAdmin><AdminHub /></RequireAdmin>} />
          <Route path="/evaluation-simultaneous" element={<RequireJury><SimultaneousEvaluation /></RequireJury>} />
          <Route path="/evaluation" element={<RequireJury><SimultaneousEvaluation /></RequireJury>} />
          <Route path="/dashboard" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
          <Route path="/collective-dashboard" element={<RequireAdmin><CollectiveDashboard /></RequireAdmin>} />
          <Route path="/collective-dashboard/participant/:participantName" element={<RequireAdmin><CollectiveParticipantAnalysis /></RequireAdmin>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
