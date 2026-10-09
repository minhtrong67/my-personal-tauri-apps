; Material Edit — NSIS installer hooks.
; This file is included before the installer pages are declared, so the uninstaller icon can be set here
; (Tauri's default template only sets the installer icon, which leaves uninstall.exe with the generic NSIS icon).
!define MUI_UNICON "${__FILEDIR__}\icons\uninstaller.ico"
