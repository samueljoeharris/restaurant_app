@echo off
REM Postgres MCP requires the DB URL as a CLI arg (envFile alone does not work).
set "PATH=%USERPROFILE%\AppData\Roaming\fnm\aliases\default;%PATH%"
npx -y @modelcontextprotocol/server-postgres postgresql://ttf_app:ttf_local@localhost:5432/ttf
