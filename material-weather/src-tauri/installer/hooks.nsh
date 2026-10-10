; Show the dedicated uninstall icon in Windows "Settings > Apps > Installed apps".
; uninstall.ico is shipped next to the exe via bundle.resources.
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "DisplayIcon" "$\"$INSTDIR\uninstall.ico$\""
!macroend
