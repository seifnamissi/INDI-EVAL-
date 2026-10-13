Backup instructions for the SQLite database

- The database file is `server/database.sqlite`.
- A simple PowerShell script is provided to copy the DB to `server/backups` with a timestamp:

  ```powershell
  .\backup_db.ps1
  ```

- To run automatically on Windows:
  1. Open Task Scheduler.
  2. Create a new basic task that runs every hour (or every 15 minutes) and executes `powershell.exe -File "C:\path\to\project\server\backup_db.ps1"`.
  3. Ensure the task runs under an account with file system access and with "Run whether user is logged on or not" if needed.

- For production or more reliability, consider migrating to Postgres and using managed backups.
