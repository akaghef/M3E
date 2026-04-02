Option Explicit

Dim sh, scriptDir, launchBat, cmd
Set sh = CreateObject("WScript.Shell")

scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
launchBat = scriptDir & "\launch.bat"

cmd = "cmd /c """ & launchBat & """"
sh.Run cmd, 0, False
