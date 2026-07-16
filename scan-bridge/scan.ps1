# Importation via WIA COM avec support du chargeur multi-pages (ADF).
# Sortie stdout : OK|<nom du scanner>|<nb pages>|<fichier1;fichier2;...>
#             ou ERR|<code>|<message>
param(
  [int]$DPI = 300,
  [int]$Color = 1,          # 1 = Couleur, 2 = Niveaux de gris, 4 = Noir et blanc
  [string]$OutBase = "$env:TEMP\archiveo-scan",
  [string]$DeviceId = '',
  [string]$PageSize = 'A4'  # A4 | Letter | Legal | Auto (pleine vitre)
)
$ErrorActionPreference = 'Stop'

$jpegFmt = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
$FEED_READY = 1   # bit de Document Handling Status
$FEEDER = 1       # valeurs de Document Handling Select
$FLATBED = 2
$MAX_PAGES = 50

try {
  $wia = New-Object -ComObject WIA.DeviceManager
} catch {
  Write-Output "ERR|NO_WIA|WIA non disponible : $($_.Exception.Message)"
  exit 1
}

$devInfo = $null
if ($DeviceId) {
  foreach ($di in $wia.DeviceInfos) {
    if ($di.DeviceID -eq $DeviceId) { $devInfo = $di; break }
  }
}
if (-not $devInfo) {
  foreach ($di in $wia.DeviceInfos) {
    if ($di.Type -eq 1) { $devInfo = $di; break }
  }
}
if (-not $devInfo) {
  Write-Output 'ERR|NO_SCANNER|Aucun scanner detecte'
  exit 2
}

$deviceName = ''
try { $deviceName = $devInfo.Properties('Name').Value } catch { $deviceName = "Scanner ($($devInfo.DeviceID))" }

try {
  $device = $devInfo.Connect()
} catch {
  Write-Output "ERR|CONNECT_FAILED|Connexion au scanner '$deviceName' impossible : $($_.Exception.Message)"
  exit 3
}

if ($device.Items.Count -eq 0) {
  Write-Output "ERR|NO_ITEM|Le scanner '$deviceName' n'expose aucun element scannable"
  exit 3
}

function Get-DevProp($device, [string]$name) {
  try { return $device.Properties($name).Value } catch { return $null }
}
function Set-DevProp($device, [string]$name, $value) {
  try { $device.Properties($name).Value = $value; return $true } catch { return $false }
}

# Chargeur (ADF) : si du papier est present dans le chargeur, on l'utilise,
# sinon on numerise depuis la vitre.
$usingFeeder = $false
$handlingStatus = Get-DevProp $device 'Document Handling Status'
if ($null -ne $handlingStatus -and (($handlingStatus -band $FEED_READY) -eq $FEED_READY)) {
  if (Set-DevProp $device 'Document Handling Select' $FEEDER) {
    $usingFeeder = $true
    Set-DevProp $device 'Pages' 1 | Out-Null   # une page par transfert
  }
} else {
  Set-DevProp $device 'Document Handling Select' $FLATBED | Out-Null
}

$item = $device.Items[1]
try { $item.Properties('Horizontal Resolution').Value = $DPI } catch {}
try { $item.Properties('Vertical Resolution').Value = $DPI } catch {}
try { $item.Properties('Current Intent').Value = $Color } catch {}

# Cadrage de la zone de scan selon le format papier demande (en pixels au DPI courant).
# Sans cela, beaucoup de scanners numerisent toute la vitre (souvent Legal 8.5x14),
# ce qui laisse une bande vierge sous un document A4.
$pageSizes = @{
  'A4'     = @(8.27, 11.69)
  'Letter' = @(8.5, 11.0)
  'Legal'  = @(8.5, 14.0)
}
if ($pageSizes.ContainsKey($PageSize)) {
  $wIn = $pageSizes[$PageSize][0]
  $hIn = $pageSizes[$PageSize][1]
  try { $item.Properties('Horizontal Start Position').Value = [int]0 } catch {}
  try { $item.Properties('Vertical Start Position').Value = [int]0 } catch {}
  try { $item.Properties('Horizontal Extent').Value = [int][math]::Floor($wIn * $DPI) } catch {}
  try { $item.Properties('Vertical Extent').Value = [int][math]::Floor($hIn * $DPI) } catch {}
}

Add-Type -AssemblyName System.Drawing
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)

$files = @()
$pageNum = 0

while ($pageNum -lt $MAX_PAGES) {
  $pageNum++

  $image = $null
  try {
    $image = $item.Transfer($jpegFmt)
  } catch {
    $ex = $_.Exception
    while ($ex.InnerException) { $ex = $ex.InnerException }
    $hres = ''; try { $hres = '0x' + $ex.HResult.ToString('X8') } catch {}

    # 0x80210003 = WIA_ERROR_PAPER_EMPTY : plus de feuilles dans le chargeur
    if ($hres -eq '0x80210003' -and $files.Count -gt 0) { break }
    if ($files.Count -gt 0) { break }  # erreur apres au moins une page : on garde l'acquis

    if ($hres -eq '0x80210003') {
      Write-Output "ERR|NO_PAPER|Aucun document dans le chargeur ni sur la vitre de '$deviceName'"
    } elseif ($hres -eq '0x8021000B' -or $ex.Message -match 'prend pas en charge cette commande') {
      Write-Output "ERR|DRIVER_STUB|Le pilote Windows de '$deviceName' est incomplet et refuse la numerisation. Installez le pilote complet du fabricant ou connectez le scanner en reseau/Wi-Fi."
    } else {
      Write-Output "ERR|SCAN_FAILED|Echec de la numerisation sur '$deviceName' : $($ex.Message) [$hres]"
    }
    exit 4
  }

  # Sauvegarde brute puis conversion JPEG (les pilotes renvoient souvent du BMP)
  $rawFile = "$OutBase-p$pageNum.raw"
  $outFile = "$OutBase-p$pageNum.jpg"
  try {
    if (Test-Path $rawFile) { Remove-Item $rawFile -Force }
    $image.SaveFile($rawFile)
    $src = [System.Drawing.Image]::FromFile($rawFile)
    if (Test-Path $outFile) { Remove-Item $outFile -Force }
    $src.Save($outFile, $jpegCodec, $encParams)
    $src.Dispose()
    Remove-Item $rawFile -Force
  } catch {
    Write-Output "ERR|SAVE_FAILED|Sauvegarde/conversion de la page $pageNum impossible : $($_.Exception.Message)"
    exit 5
  }
  $files += $outFile

  # Continuer uniquement si le chargeur est actif et contient encore du papier
  if (-not $usingFeeder) { break }
  $st = Get-DevProp $device 'Document Handling Status'
  if ($null -eq $st -or (($st -band $FEED_READY) -ne $FEED_READY)) { break }
}

if ($files.Count -eq 0) {
  Write-Output 'ERR|NO_PAGE|Aucune page numerisee'
  exit 5
}

Write-Output ("OK|" + $deviceName + "|" + $files.Count + "|" + ($files -join ';'))
