$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$androidRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = [IO.Path]::GetFullPath((Join-Path $androidRoot '../public/icons/arc-fit-512.png'))
$resources = Join-Path $androidRoot 'app/src/main/res'
$sourceImage = [Drawing.Image]::FromFile($sourcePath)
function Write-Icon([string]$path, [int]$size, [bool]$adaptive) {
    $bitmap = New-Object Drawing.Bitmap $size, $size
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#0B0B0D'))
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        # The original already includes clear space. Extra adaptive space keeps the
        # whole mark inside Android's central safe circle for all launcher masks.
        $drawSize = if ($adaptive) { [int]($size * 2 / 3) } else { $size }
        $offset = [int](($size - $drawSize) / 2)
        $graphics.DrawImage($sourceImage, $offset, $offset, $drawSize, $drawSize)
        $bitmap.Save($path, [Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
try {
    foreach ($density in @(@('mdpi',48,108), @('hdpi',72,162), @('xhdpi',96,216), @('xxhdpi',144,324), @('xxxhdpi',192,432))) {
        $directory = Join-Path $resources ('mipmap-' + $density[0])
        Write-Icon (Join-Path $directory 'ic_launcher.png') $density[1] $false
        Write-Icon (Join-Path $directory 'ic_launcher_round.png') $density[1] $false
        Write-Icon (Join-Path $directory 'ic_launcher_foreground.png') $density[2] $true
    }
    # Replace only generated Capacitor splash templates, inside this native project.
    Get-ChildItem -LiteralPath $resources -Recurse -Filter 'splash.png' | ForEach-Object {
        $resolvedTarget = [IO.Path]::GetFullPath($_.FullName)
        if (-not $resolvedTarget.StartsWith($resources + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Resource path escaped native project' }
        Remove-Item -LiteralPath $resolvedTarget
    }
    $nodpi = Join-Path $resources 'drawable-nodpi'
    New-Item -ItemType Directory -Path $nodpi -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $nodpi 'arc_fit_brand.png')
} finally { $sourceImage.Dispose() }
