# Internal updater helper. Usage: bash stage-macos-update.sh verified.dmg staged.app expected-version
set -eu
mountpoint=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/jotpoc-volume.XXXXXXXX")
mounted=false
cleanup() {
  if "$mounted"; then
    /usr/bin/hdiutil detach "$mountpoint" || /usr/bin/hdiutil detach -force "$mountpoint" || return 1
    mounted=false
  fi
  /bin/rmdir "$mountpoint"
}
trap cleanup EXIT
/usr/bin/hdiutil attach -readonly -nobrowse -noautoopen -mountpoint "$mountpoint" "$1" </dev/null >/dev/null
mounted=true
source_app="$mountpoint/JotPoc.app"
plist="$source_app/Contents/Info.plist"
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$plist")" = app.twist.jotpoc
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$plist")" = "$3"
test -x "$source_app/Contents/MacOS/twist-jotpoc"
/usr/bin/ditto "$source_app" "$2"
cleanup
trap - EXIT
