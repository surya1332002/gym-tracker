$ErrorActionPreference = 'Stop'
$androidRoot = $PSScriptRoot
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
    throw 'Set JAVA_HOME to a compatible JDK (21 recommended; 21-24 supported by this Gradle wrapper).'
}
$javaProcess = New-Object Diagnostics.Process
$javaProcess.StartInfo.FileName = Join-Path $env:JAVA_HOME 'bin/java.exe'
$javaProcess.StartInfo.Arguments = '-version'
$javaProcess.StartInfo.UseShellExecute = $false
$javaProcess.StartInfo.CreateNoWindow = $true
$javaProcess.StartInfo.RedirectStandardError = $true
try {
    $javaProcess.Start() | Out-Null
    if (-not $javaProcess.WaitForExit(10000)) {
        $javaProcess.Kill()
        throw 'JAVA_HOME Java did not respond within 10 seconds.'
    }
    $javaVersion = $javaProcess.StandardError.ReadToEnd()
} finally { $javaProcess.Dispose() }
if ($javaVersion -notmatch 'version "(\d+)' -or [int]$Matches[1] -lt 21 -or [int]$Matches[1] -gt 24) {
    throw 'This native project requires JDK 21-24; JDK 25 needs a newer Gradle major. Use JDK 21 without upgrading the pinned wrapper.'
}
$sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if (-not $sdkPath -or -not (Test-Path -LiteralPath (Join-Path $sdkPath 'platforms/android-36/android.jar'))) {
    throw 'Set ANDROID_HOME to an Android SDK containing platforms;android-36 and build-tools;35.0.0 (or the version required by AGP). Review and accept licenses yourself in Android Studio.'
}
# Keep downloaded dependencies inside this ignored project directory.
$env:GRADLE_USER_HOME = Join-Path $androidRoot '.gradle-cache'
Push-Location $androidRoot
try {
    & .\gradlew.bat --no-daemon assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Android build failed with exit code $LASTEXITCODE" }
    Write-Output (Join-Path $androidRoot 'app/build/outputs/apk/debug/app-debug.apk')
} finally { Pop-Location }
