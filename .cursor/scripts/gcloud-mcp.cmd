@echo off
REM Cursor on Windows does not load fnm shell hooks — put node + gcloud on PATH.
set "PATH=%USERPROFILE%\AppData\Roaming\fnm\aliases\default;C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin;%PATH%"
npx -y @google-cloud/gcloud-mcp
