# Soft Skills Evaluator - BEST TEAM 2026

This is a full-stack web application for evaluating candidates' soft skills during a competition.

## Project Structure

- `client/`: Frontend React application.
- `server/`: Backend Node.js with Express application.

## How to Run the Application

### 1. Prerequisites

- Node.js (v14 or later)
- npm

### 2. Setup

Open a terminal in the root directory of the project.

Install all dependencies for the server and client:

```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### 3. Start the Application

In production you typically serve the client build from the server and run only the backend process.

To start only the backend (recommended for deployment):

```powershell
cd server
.\start-production.ps1
```

This script installs server deps (if needed), attempts to open firewall port `5000` (requires Administrator), and starts the Node server on port `5000`.

Note: Development `npm start` behavior uses concurrently to run both client and server locally; for production serve the content of `client/build` from the server.

## How to Use the Application

1.  **Jury Login**: Open the application in your browser. You will be on the home page. Enter your name, select a candidate, and a team. Click "Start Evaluation".
2.  **Evaluation**: You will be redirected to the evaluation page. Here you can rate the candidate on various criteria. The scores are saved automatically in real-time.
3.  **Dashboard**: Navigate to the "Dashboard" to see the real-time results. The dashboard shows the ranking of participants and teams.

## Technical Details

-   **Frontend**: React, React Router, Socket.IO Client
-   **Backend**: Node.js, Express, Socket.IO, SQLite
-   **Real-time Updates**: WebSockets (Socket.IO) are used to provide real-time updates on the dashboard as juries submit scores.
-   **Database**: SQLite is used as the database. The database file `database.sqlite` is located in the `server` directory.
