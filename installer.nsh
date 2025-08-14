!macro customInstall
  ; כתיבת context-menu עבור כל הקבצים (*)
  WriteRegStr HKCR "*\shell\GeminiApp" "" "Open with GeminiApp"
  WriteRegStr HKCR "*\shell\GeminiApp" "Icon" "$INSTDIR\\GeminiApp.exe,0"
  WriteRegStr HKCR "*\shell\GeminiApp\\command" "" '"$INSTDIR\\GeminiApp.exe" "%1"'
!macroend

!macro customUninstall
  ; הסרה נייה בעת uninstall
  DeleteRegKey HKCR "*\shell\GeminiApp"
!macroend
