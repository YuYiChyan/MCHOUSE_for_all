Unicode true
RequestExecutionLevel user
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
Name "One4All Desktop"
Caption "One4All Desktop 安装"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\One4All"
InstallDirRegKey HKCU "Software\One4AllDesktop" "InstallLocation"
VIProductVersion "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "ProductName" "One4All Desktop"
VIAddVersionKey /LANG=2052 "FileDescription" "One4All Desktop 安装程序"
VIAddVersionKey /LANG=2052 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=2052 "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "One4All contributors"
BrandingText "One4All Desktop"
ShowInstDetails show
ShowUninstDetails show
!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "x64.nsh"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\One4AllDesktop"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "安装 One4All Desktop"
!define MUI_WELCOMEPAGE_TEXT "统一设备设置、商品图与按需驱动下载。$\r$\n$\r$\n本安装包包含独立运行环境和公共设备控制库。各品牌完整驱动按需获取。$\r$\n$\r$\n更新安装会保留您已有的设置、设备模块和下载缓存。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\One4All.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_RUN_TEXT "打开 One4All Desktop"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
UninstPage custom un.Options un.OptionsLeave
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
Var RemoveData
Var RemoveDataCheckbox

Function .onInit
 SetShellVarContext current
 ${IfNot} ${RunningX64}
  MessageBox MB_OK|MB_ICONSTOP "此安装包需要 64 位 Windows。"
  Abort
 ${EndIf}
FunctionEnd

Function CheckApplicationClosed
 retry:
 IfFileExists "$INSTDIR\One4All.exe" 0 done
 ClearErrors
 FileOpen $0 "$INSTDIR\One4All.exe" a
 IfErrors locked
 FileClose $0
 Goto done
 locked:
 IfSilent abort
 MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请先关闭 One4All Desktop，然后重试。" IDRETRY retry
 abort:
 SetErrorLevel 2
 Abort
 done:
FunctionEnd

Section "One4All Desktop（必需）" MainSection
 SectionIn RO
 SetShellVarContext current
 Call CheckApplicationClosed
 SetOverwrite on
 !include "${INSTALL_FILES}"
 SetOutPath "$INSTDIR"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "Software\One4AllDesktop" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "One4All Desktop"
 WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
 WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "One4All contributors"
 WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\resources\app\app\assets\one4all.ico"
 WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
 WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" ${ESTIMATED_KB}
 WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
 WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
 CreateDirectory "$SMPROGRAMS\One4All Desktop"
 CreateShortCut "$SMPROGRAMS\One4All Desktop\One4All Desktop.lnk" "$INSTDIR\One4All.exe" "" "$INSTDIR\resources\app\app\assets\one4all.ico" 0
 CreateShortCut "$SMPROGRAMS\One4All Desktop\卸载 One4All Desktop.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\resources\app\app\assets\one4all.ico" 0
SectionEnd

Section "桌面快捷方式" DesktopSection
 CreateShortCut "$DESKTOP\One4All Desktop.lnk" "$INSTDIR\One4All.exe" "" "$INSTDIR\resources\app\app\assets\one4all.ico" 0
SectionEnd

Function un.onInit
 SetShellVarContext current
 StrCpy $RemoveData 0
 ClearErrors
 FileOpen $0 "$INSTDIR\.one4all-install" r
 IfErrors wrongDirectory
 FileRead $0 $1
 FileClose $0
 StrCmp $1 "org.one4all.desktop" validDirectory
 wrongDirectory:
 MessageBox MB_OK|MB_ICONSTOP "未找到 One4All 安装记录，请从系统的已安装应用列表卸载。"
 Abort
 validDirectory:
FunctionEnd

Function un.Options
 nsDialogs::Create 1018
 Pop $0
 ${NSD_CreateLabel} 0 0 100% 34u "默认仅卸载应用，保留本账户的设置、设备模块和下载缓存，以便重新安装后继续使用。"
 Pop $1
 ${NSD_CreateCheckbox} 0 48u 100% 26u "同时删除本账户的 One4All 设置、设备模块和下载缓存"
 Pop $RemoveDataCheckbox
 ${NSD_CreateLabel} 0 84u 100% 36u "此选项只清理 One4All-Desktop 的个人目录，不会卸载厂商驱动或删除旧 One4All 安装。"
 Pop $1
 nsDialogs::Show
FunctionEnd

Function un.OptionsLeave
 ${NSD_GetState} $RemoveDataCheckbox $RemoveData
FunctionEnd

Function un.CheckApplicationClosed
 retry:
 IfFileExists "$INSTDIR\One4All.exe" 0 done
 ClearErrors
 FileOpen $0 "$INSTDIR\One4All.exe" a
 IfErrors locked
 FileClose $0
 Goto done
 locked:
 IfSilent abort
 MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请先关闭 One4All Desktop，然后重试卸载。" IDRETRY retry
 abort:
 SetErrorLevel 2
 Abort
 done:
FunctionEnd

Section "Uninstall"
 SetShellVarContext current
 Call un.CheckApplicationClosed
 !include "${UNINSTALL_FILES}"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 Delete "$DESKTOP\One4All Desktop.lnk"
 Delete "$SMPROGRAMS\One4All Desktop\One4All Desktop.lnk"
 Delete "$SMPROGRAMS\One4All Desktop\卸载 One4All Desktop.lnk"
 RMDir "$SMPROGRAMS\One4All Desktop"
 DeleteRegKey HKCU "${UNINSTALL_KEY}"
 DeleteRegKey HKCU "Software\One4AllDesktop"
 ${If} $RemoveData == ${BST_CHECKED}
  RMDir /r "$APPDATA\One4All-Desktop"
  RMDir /r "$LOCALAPPDATA\One4All-Desktop"
 ${EndIf}
SectionEnd
