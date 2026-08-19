param(
  [int]$Frame = 0,
  [int]$FrameCount = 1,
  [string]$OutputPath = ''
)

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$theme = Join-Path $root 'minecraft-steve'
$output = if ($OutputPath) { $OutputPath } else { Join-Path $theme 'preview.jpg' }
$outputDist = Join-Path $theme 'dist\preview.jpg'

$canvas = [System.Drawing.Bitmap]::new(1600, 900)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

$background = [System.Drawing.Image]::FromFile((Join-Path $theme 'public\minecraft-panorama.png'))
$graphics.DrawImage($background, [System.Drawing.Rectangle]::new(0, 0, 1600, 900))
$shade = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(110, 3, 9, 18))
$graphics.FillRectangle($shade, 0, 0, 1600, 900)

function Draw-Crop($graphics, $image, $x, $y, $width, $height, $sourceX, $sourceY, $sourceWidth, $sourceHeight) {
  $destination = [System.Drawing.Rectangle]::new([int]$x, [int]$y, [int]$width, [int]$height)
  $source = [System.Drawing.Rectangle]::new($sourceX, $sourceY, $sourceWidth, $sourceHeight)
  $graphics.DrawImage($image, $destination, $source.X, $source.Y, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Head($graphics, $image, $x, $y, $size, $angle) {
  $graphics.TranslateTransform($x + $size / 2, $y + $size)
  $graphics.RotateTransform($angle)
  Draw-Crop $graphics $image (-$size / 2) (-$size) $size $size 8 8 8 8
  $graphics.ResetTransform()
}

function Draw-Player($graphics, $image, $x, $scale, $angle, $headOffset) {
  $head = 8 * $scale; $bodyW = 8 * $scale; $bodyH = 12 * $scale; $limbW = 4 * $scale; $limbH = 12 * $scale
  $baseY = 760
  Draw-Crop $graphics $image ($x - $bodyW / 2 - $limbW) ($baseY - $bodyH - $limbH) $limbW $limbH 44 20 4 12
  Draw-Crop $graphics $image ($x + $bodyW / 2) ($baseY - $bodyH - $limbH) $limbW $limbH 44 20 4 12
  Draw-Crop $graphics $image ($x - $bodyW / 2) ($baseY - $bodyH - $limbH) $bodyW $bodyH 20 20 8 12
  Draw-Crop $graphics $image ($x - $limbW) ($baseY - $limbH) $limbW $limbH 4 20 4 12
  Draw-Crop $graphics $image $x ($baseY - $limbH) $limbW $limbH 4 20 4 12
  Draw-Head $graphics $image ($x - $head / 2 + $headOffset) ($baseY - $bodyH - $limbH - $head) $head $angle
}

function Draw-Creeper($graphics, $image, $x, $scale, $angle, $headOffset) {
  $head = 8 * $scale; $bodyW = 8 * $scale; $bodyH = 12 * $scale; $leg = 4 * $scale; $legH = 6 * $scale
  $baseY = 760
  Draw-Crop $graphics $image ($x - $bodyW / 2) ($baseY - $legH - $bodyH) $bodyW $bodyH 20 20 8 12
  foreach ($offset in @(-$leg, 0)) { Draw-Crop $graphics $image ($x + $offset) ($baseY - $legH) $leg $legH 4 20 4 6 }
  Draw-Head $graphics $image ($x - $head / 2 + $headOffset) ($baseY - $legH - $bodyH - $head) $head $angle
}

function Draw-Enderman($graphics, $image, $x, $scale, $angle, $headOffset) {
  $head = 8 * $scale; $bodyW = 8 * $scale; $bodyH = 12 * $scale; $limb = 2 * $scale; $limbH = 30 * $scale
  $baseY = 800
  Draw-Crop $graphics $image ($x - $limb - $limb / 2) ($baseY - $limbH) $limb $limbH 58 2 2 30
  Draw-Crop $graphics $image ($x + $limb / 2) ($baseY - $limbH) $limb $limbH 58 2 2 30
  Draw-Crop $graphics $image ($x - $bodyW / 2) ($baseY - $limbH - $bodyH) $bodyW $bodyH 36 20 8 12
  Draw-Crop $graphics $image ($x - $bodyW / 2 - $limb) ($baseY - $limbH - $bodyH) $limb $limbH 58 2 2 30
  Draw-Crop $graphics $image ($x + $bodyW / 2) ($baseY - $limbH - $bodyH) $limb $limbH 58 2 2 30
  Draw-Head $graphics $image ($x - $head / 2 + $headOffset) ($baseY - $limbH - $bodyH - $head + 22) $head $angle
}

$steve = [System.Drawing.Image]::FromFile((Join-Path $theme 'src\steve.png'))
$alex = [System.Drawing.Image]::FromFile((Join-Path $theme 'src\alex.png'))
$creeper = [System.Drawing.Image]::FromFile((Join-Path $theme 'src\creeper.png'))
$enderman = [System.Drawing.Image]::FromFile((Join-Path $theme 'src\enderman.png'))

$panels = @(@{ X = 230; Label = 'STEVE' }, @{ X = 610; Label = 'ALEX' }, @{ X = 990; Label = 'CREEPER' }, @{ X = 1370; Label = 'ENDERMAN' })
foreach ($panel in $panels) {
  $panelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(55, 8, 12, 25))
  $graphics.FillRectangle($panelBrush, $panel.X - 165, 210, 330, 590)
  $panelBrush.Dispose()
}

$phase = 2 * [Math]::PI * $Frame / [Math]::Max(1, $FrameCount)
$motion = if ($FrameCount -gt 1) { 1 } else { 0 }
$stevePhase = $phase
$alexPhase = $phase + 1.5
$creeperPhase = $phase + 3.1
$endermanPhase = $phase + 4.5
Draw-Player $graphics $steve 230 13 (-3 + $motion * 4 * [Math]::Sin($stevePhase)) ($motion * 4 * [Math]::Sin($stevePhase))
Draw-Player $graphics $alex 610 13 (2.5 + $motion * 3.5 * [Math]::Sin($alexPhase)) ($motion * 3 * [Math]::Sin($alexPhase))
Draw-Creeper $graphics $creeper 990 15 (-2 + $motion * 2.5 * [Math]::Sin($creeperPhase)) ($motion * 3 * [Math]::Sin($creeperPhase))
Draw-Enderman $graphics $enderman 1370 12 (1.5 + $motion * 2 * [Math]::Sin($endermanPhase)) ($motion * 2 * [Math]::Sin($endermanPhase))

$headerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 6, 10, 22))
$graphics.FillRectangle($headerBrush, 0, 0, 1600, 170)
$titleFont = [System.Drawing.Font]::new('Arial', 48, [System.Drawing.FontStyle]::Bold)
$subtitleFont = [System.Drawing.Font]::new('Arial', 21, [System.Drawing.FontStyle]::Bold)
$labelFont = [System.Drawing.Font]::new('Arial', 19, [System.Drawing.FontStyle]::Bold)
$white = [System.Drawing.Brushes]::White
$purple = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(221, 115, 255))
$format = [System.Drawing.StringFormat]::new(); $format.Alignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('MINECRAFT CHARACTERS', $titleFont, $white, 800, 31, $format)
$graphics.DrawString('3D MOUSE LOOK  •  HEAD & WAIST TILT', $subtitleFont, $purple, 800, 102, $format)
foreach ($panel in $panels) { $graphics.DrawString($panel.Label, $labelFont, $white, $panel.X, 824, $format) }

$mousePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(231, 174, 255), 5)
$graphics.DrawArc($mousePen, 720, 180, 160, 80, 198, 144)
$graphics.DrawLine($mousePen, 720, 230, 745, 255); $graphics.DrawLine($mousePen, 880, 230, 855, 255)
$graphics.DrawString('FOLLOW THE CURSOR', $subtitleFont, $white, 800, 175, $format)

$canvas.Save($output, [System.Drawing.Imaging.ImageFormat]::Jpeg)
if (-not $OutputPath) { Copy-Item -LiteralPath $output -Destination $outputDist -Force }

$mousePen.Dispose(); $purple.Dispose(); $format.Dispose(); $labelFont.Dispose(); $subtitleFont.Dispose(); $titleFont.Dispose(); $headerBrush.Dispose(); $shade.Dispose()
$enderman.Dispose(); $creeper.Dispose(); $alex.Dispose(); $steve.Dispose(); $background.Dispose(); $graphics.Dispose(); $canvas.Dispose()
