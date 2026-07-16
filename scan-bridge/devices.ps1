# Liste les scanners WIA via l'API COM (synchrone, sans risque de deadlock).
$ErrorActionPreference = 'Stop'
try {
  $wia = New-Object -ComObject WIA.DeviceManager
  $list = @()
  foreach ($di in $wia.DeviceInfos) {
    # Type 1 = ScannerDeviceType
    if ($di.Type -eq 1) {
      $name = ''
      try { $name = $di.Properties('Name').Value } catch { $name = "Scanner ($($di.DeviceID))" }
      $list += [pscustomobject]@{ deviceId = $di.DeviceID; name = $name }
    }
  }
  ConvertTo-Json @($list) -Compress
} catch {
  Write-Output '[]'
}
