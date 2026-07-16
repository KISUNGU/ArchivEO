# Liste les imprimantes installées sur la machine (JSON sur stdout)
$ErrorActionPreference = 'Stop'
try {
  $defaultName = ''
  try {
    $defaultName = (Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default }).Name
  } catch {}

  $printers = @(Get-Printer | ForEach-Object {
    [pscustomobject]@{
      name    = $_.Name
      driver  = $_.DriverName
      port    = $_.PortName
      status  = [string]$_.PrinterStatus
      default = ($_.Name -eq $defaultName)
    }
  })
  ConvertTo-Json $printers -Compress
} catch {
  Write-Output '[]'
}
