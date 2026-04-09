Option Explicit

Dim sh, fso, scriptDir, launchBat, cmd, exitCode, logFile
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
launchBat = scriptDir & "\launch.bat"
logFile = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\M3E\launch.log"

cmd = "cmd /c """ & launchBat & """"
exitCode = sh.Run(cmd, 0, True)

If exitCode <> 0 Then
  Dim msg
  msg = "M3E launch failed (exit code " & exitCode & ")." & vbCrLf & vbCrLf
  If fso.FileExists(logFile) Then
    msg = msg & "Log: " & logFile
  Else
    msg = msg & "Run install\setup.bat for first-time setup."
  End If
  MsgBox msg, vbExclamation, "M3E"
End If
