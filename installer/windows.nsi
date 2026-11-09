Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

Name "像素音量"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\PixelVolume"
InstallDirRegKey HKCU "Software\PixelVolume" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "Pixel Volume 0.2.4"
VIProductVersion "0.2.4.0"
VIAddVersionKey /LANG=2052 "ProductName" "像素音量"
VIAddVersionKey /LANG=2052 "FileDescription" "像素音量安装程序"
VIAddVersionKey /LANG=2052 "FileVersion" "0.2.4"
VIAddVersionKey /LANG=2052 "ProductVersion" "0.2.4"
VIAddVersionKey /LANG=2052 "LegalCopyright" "Pixel Volume; UI by @Lattice_Node (MIT)"

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "欢迎安装像素音量"
!define MUI_WELCOMEPAGE_TEXT "用像素房间调节 Windows 音量。$\r$\n$\r$\n安装后首次打开，会显示使用引导。登录时自动启动由你自行选择，默认关闭。$\r$\n$\r$\n安装到当前用户，无需管理员权限。如系统缺少界面组件，安装时会联网补齐。$\r$\n$\r$\n请先退出正在运行的旧版像素音量。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\PixelVolume.exe"
!define MUI_FINISHPAGE_RUN_TEXT "打开像素音量并查看首次使用引导"
!define MUI_FINISHPAGE_RUN_PARAMETERS "--welcome"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
    SetShellVarContext current
    ${IfNot} ${RunningX64}
        MessageBox MB_ICONSTOP "此安装包需要 64 位 Windows。"
        Abort
    ${EndIf}
    ${IfNot} ${AtLeastWin10}
        MessageBox MB_ICONSTOP "像素音量需要 Windows 10 或 Windows 11。"
        Abort
    ${EndIf}
    SetRegView 64
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
    ${If} $0 < 19041
        MessageBox MB_ICONSTOP "请先更新到 Windows 10 2004 或更新版本。"
        Abort
    ${EndIf}
FunctionEnd

Section "像素音量（必需）" MainSection
    SectionIn RO
    SetShellVarContext current
    SetRegView 64
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File "${PUBLISH_DIR}\PixelVolume.exe"
    ExecWait '"$PLUGINSDIR\PixelVolume.exe" --check-webview' $0
    ${If} $0 != 0
        DetailPrint "正在补齐界面组件，请保持联网…"
        File "${BOOTSTRAPPER}"
        ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $0
        ExecWait '"$PLUGINSDIR\PixelVolume.exe" --check-webview' $0
        ${If} $0 != 0
            MessageBox MB_ICONSTOP "界面组件尚未安装成功。请连接网络后重新运行安装包。"
            SetErrorLevel 2
            Abort
        ${EndIf}
    ${EndIf}
    SetOutPath "$INSTDIR"
    IfFileExists "$INSTDIR\PixelVolume.exe" 0 writeApplication
    ExecWait '"$INSTDIR\PixelVolume.exe" --quit' $0
    Sleep 1000
    writeApplication:
    ClearErrors
    CopyFiles /SILENT "$PLUGINSDIR\PixelVolume.exe" "$INSTDIR\PixelVolume.exe"
    ${If} ${Errors}
        MessageBox MB_ICONSTOP "无法写入应用文件。请退出正在运行的像素音量，再重新运行安装包。"
        SetErrorLevel 3
        Abort
    ${EndIf}
    File "${PUBLISH_DIR}\Readme.txt"
    SetOutPath "$INSTDIR\Licenses"
    File "${PUBLISH_DIR}\Licenses\*.txt"
    SetOutPath "$INSTDIR"
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    CreateShortcut "$SMPROGRAMS\像素音量.lnk" "$INSTDIR\PixelVolume.exe"
    WriteRegStr HKCU "Software\PixelVolume" "InstallDir" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "DisplayName" "像素音量"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "DisplayVersion" "0.2.4"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "Publisher" "Pixel Volume"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "DisplayIcon" "$INSTDIR\PixelVolume.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "NoRepair" 1
SectionEnd

Section /o "创建桌面快捷方式" DesktopSection
    CreateShortcut "$DESKTOP\像素音量.lnk" "$INSTDIR\PixelVolume.exe"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${MainSection} "安装像素音量及使用说明，并添加到开始菜单。首次使用时自行选择是否开机启动。"
    !insertmacro MUI_DESCRIPTION_TEXT ${DesktopSection} "在桌面添加一个像素音量快捷方式。"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function un.onInit
    SetShellVarContext current
    SetRegView 64
FunctionEnd

Section "Uninstall"
    IfFileExists "$INSTDIR\PixelVolume.exe" 0 cleanupFiles
    ExecWait '"$INSTDIR\PixelVolume.exe" --uninstall' $0
    ${If} $0 != 0
        MessageBox MB_ICONSTOP "无法关闭像素音量。请先从托盘菜单退出应用，再重试卸载。"
        SetErrorLevel 4
        Abort
    ${EndIf}
    Sleep 1000
    cleanupFiles:
    ClearErrors
    Delete "$INSTDIR\PixelVolume.exe"
    ${If} ${Errors}
        MessageBox MB_ICONSTOP "应用文件正在使用中，请退出像素音量后重新卸载。"
        SetErrorLevel 5
        Abort
    ${EndIf}
    Delete "$INSTDIR\Readme.txt"
    Delete "$INSTDIR\Licenses\NET-Desktop-LICENSE.txt"
    Delete "$INSTDIR\Licenses\NET-Runtime-LICENSE.txt"
    Delete "$INSTDIR\Licenses\NET-Runtime-THIRD-PARTY-NOTICES.txt"
    Delete "$INSTDIR\Licenses\SliderResident-MIT.txt"
    Delete "$INSTDIR\Licenses\WebView2-LICENSE.txt"
    Delete "$INSTDIR\Licenses\WebView2-NOTICE.txt"
    RMDir "$INSTDIR\Licenses"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"
    ReadRegStr $0 HKCU "Software\PixelVolume" "InstallDir"
    ${If} $0 == $INSTDIR
        DeleteRegKey HKCU "Software\PixelVolume"
    ${EndIf}
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume" "InstallLocation"
    ${If} $0 == $INSTDIR
        DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelVolume"
    ${EndIf}
SectionEnd
