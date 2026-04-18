Set shell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
batch = scriptDir & "\open-swingby-client.bat"
shell.Run Chr(34) & batch & Chr(34), 0, False
