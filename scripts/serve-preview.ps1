$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
$Port = if ($env:PORT) { $env:PORT } else { "4173" }
python -m http.server $Port --directory preview
