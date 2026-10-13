const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');

router.get('/initial-data', evaluationController.getInitialData);
router.get('/results/export-excel', evaluationController.exportResultsExcel);
router.get('/results', evaluationController.getResults);
router.get('/questions', evaluationController.getQuestions);
router.post('/questions', evaluationController.saveQuestions);
router.get('/scale', evaluationController.getScale);
router.post('/scale', evaluationController.saveScale);
router.get('/evaluation-mode', evaluationController.getEvaluationMode);
router.post('/evaluation-mode', evaluationController.saveEvaluationMode);

// Participant routes
router.get('/participants', evaluationController.getParticipants);
router.post('/participants', evaluationController.addParticipant);
router.post('/participants/all-teams', evaluationController.addParticipantToAllTeams);
router.delete('/participants/:id', evaluationController.deleteParticipant);

// Team routes
router.get('/teams', evaluationController.getTeams);
router.post('/teams', evaluationController.addTeam);
router.put('/teams/:id', evaluationController.updateTeam);
router.delete('/teams/:id', evaluationController.deleteTeam);

// Jury routes
router.get('/juries', evaluationController.getJuries);
router.get('/juries/code/:code', evaluationController.getJuryByCode);
router.post('/juries', evaluationController.addJury);
router.delete('/juries/:id', evaluationController.deleteJury);
router.post('/evaluations/lock', evaluationController.lockEvaluation);
router.delete('/evaluations/lock/:accessCode', evaluationController.releaseEvaluation);

// Admin routes
router.delete('/scores/clear-all', evaluationController.clearAllScores);

module.exports = router;
