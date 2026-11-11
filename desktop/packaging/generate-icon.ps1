param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../app/assets'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)
$shape = New-Object System.Drawing.Drawing2D.GraphicsPath
$shape.AddArc(12,12,104,104,180,90)
$shape.AddArc(140,12,104,104,270,90)
$shape.AddArc(140,140,104,104,0,90)
$shape.AddArc(12,140,104,104,90,90)
$shape.CloseFigure()
$box = New-Object System.Drawing.Rectangle 12,12,232,232
$fill = New-Object System.Drawing.Drawing2D.LinearGradientBrush $box,([System.Drawing.Color]::White),([System.Drawing.Color]::FromArgb(235,239,246)),90
$outline = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(212,219,230)),2
$graphics.FillPath($fill,$shape)
$graphics.DrawPath($outline,$shape)
$font = New-Object System.Drawing.Font 'Segoe UI Semibold',100,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34,107,238))
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$textBox = New-Object System.Drawing.RectangleF 8,4,240,240
$graphics.DrawString('O4',$font,$blue,$textBox,$format)
$bitmap.Save((Join-Path $OutputDirectory 'one4all.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$sizes = @(16,24,32,48,64,128,256)
$images = New-Object 'System.Collections.Generic.List[byte[]]'
foreach($size in $sizes) {
 $scaled = New-Object System.Drawing.Bitmap $size,$size
 $canvas = [System.Drawing.Graphics]::FromImage($scaled)
 $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $canvas.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
 $canvas.DrawImage($bitmap,0,0,$size,$size)
 $buffer = New-Object System.IO.MemoryStream
 $scaled.Save($buffer,[System.Drawing.Imaging.ImageFormat]::Png)
 $images.Add($buffer.ToArray())
 $buffer.Dispose(); $canvas.Dispose(); $scaled.Dispose()
}
$stream = [System.IO.File]::Create((Join-Path $OutputDirectory 'one4all.ico'))
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for($index=0; $index -lt $sizes.Count; $index++) {
 $dimension = if($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
 $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
 $writer.Write([byte]0); $writer.Write([byte]0)
 $writer.Write([uint16]1); $writer.Write([uint16]32)
 $writer.Write([uint32]$images[$index].Length); $writer.Write([uint32]$offset)
 $offset += $images[$index].Length
}
foreach($bytes in $images) { $writer.Write($bytes) }
$writer.Dispose(); $stream.Dispose()
$format.Dispose(); $blue.Dispose(); $font.Dispose(); $outline.Dispose(); $fill.Dispose(); $shape.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
Write-Output 'Created One4All PNG and 7-size Windows ICO.'
