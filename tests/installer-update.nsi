Unicode true
!include "LogicLib.nsh"
!include "..\installer\ReplaceApplication.nsh"
Name "Pixel Volume isolated file replacement test"
OutFile "${TEST_OUTPUT}"
RequestExecutionLevel user
SilentInstall silent
Section
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File /oname=PixelVolume.exe "${TEST_PAYLOAD}"
    Call ReplaceApplication
    SetErrorLevel $ReplaceResult
SectionEnd
