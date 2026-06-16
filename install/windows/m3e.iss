; M3E installer definition
; Build command example:
;   iscc install\windows\m3e.iss

#define AppName "M3E"
#define AppVersion "v260419-2"
#define AppPublisher "M3E"
#define RepoRoot "..\.."
#define AppExe "scripts\\final\\launch.bat"
#define AppIcon "install\\assets\\icons\\m3e-app.ico"

[Setup]
AppId={{D83B4A61-AD4B-4A0B-A87D-FE9F0218C6D1}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\M3E
DefaultGroupName=M3E
DisableProgramGroupPage=yes
OutputDir={#RepoRoot}\install\artifacts
OutputBaseFilename=M3E-Setup-{#AppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile={#RepoRoot}\{#AppIcon}
UninstallDisplayIcon={app}\{#AppIcon}
CloseApplications=force
RestartIfNeededByRun=no

[Languages]
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Files]
Source: "{#RepoRoot}\final\*"; DestDir: "{app}\final"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#RepoRoot}\scripts\final\*"; DestDir: "{app}\scripts\final"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#RepoRoot}\install\*"; DestDir: "{app}\install"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#RepoRoot}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\M3E"; Filename: "{cmd}"; Parameters: "/c ""{app}\{#AppExe}"""; WorkingDir: "{app}"; IconFilename: "{app}\{#AppIcon}"
Name: "{group}\M3E"; Filename: "{cmd}"; Parameters: "/c ""{app}\{#AppExe}"""; WorkingDir: "{app}"; IconFilename: "{app}\{#AppIcon}"

[Run]
Filename: "{app}\install\setup.bat"; Parameters: "--silent --no-launch --log ""{localappdata}\M3E\logs\setup.log"""; Flags: runhidden waituntilterminated
