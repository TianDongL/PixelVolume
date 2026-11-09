; Inputs: $INSTDIR and $PLUGINSDIR\PixelVolume.exe. Result: $ReplaceResult (0 = success).
; Keep the existing application until the complete replacement has been staged.
; This function is also exercised by the isolated installer test harness.
Var ReplaceResult
Var ReplaceAttempt
Function ReplaceApplication
    StrCpy $ReplaceResult 3
    CreateDirectory "$INSTDIR"
    ClearErrors
    CopyFiles /SILENT "$PLUGINSDIR\PixelVolume.exe" "$INSTDIR\PixelVolume.update-new.exe"
    IfErrors replaceFailed
    IfFileExists "$INSTDIR\PixelVolume.exe" 0 installStaged
    ; Never overwrite a recovery copy left by a failed earlier attempt.
    IfFileExists "$INSTDIR\PixelVolume.update-backup.exe" replaceFailed
    StrCpy $ReplaceAttempt 0
    retryBackup:
    ClearErrors
    Rename "$INSTDIR\PixelVolume.exe" "$INSTDIR\PixelVolume.update-backup.exe"
    IfErrors 0 installStaged
    IntOp $ReplaceAttempt $ReplaceAttempt + 1
    IntCmp $ReplaceAttempt 40 replaceFailed 0 replaceFailed
    Sleep 250
    Goto retryBackup
    installStaged:
    ClearErrors
    Rename "$INSTDIR\PixelVolume.update-new.exe" "$INSTDIR\PixelVolume.exe"
    IfErrors restoreApplication
    StrCpy $ReplaceResult 0
    Delete "$INSTDIR\PixelVolume.update-backup.exe"
    Return
    restoreApplication:
    Rename "$INSTDIR\PixelVolume.update-backup.exe" "$INSTDIR\PixelVolume.exe"
    replaceFailed:
    Delete "$INSTDIR\PixelVolume.update-new.exe"
FunctionEnd
