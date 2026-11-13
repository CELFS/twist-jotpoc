"""Add the update components after Tauri generates the Android project.
Usage: python3 .github/packages/configure-android-update.py src-tauri/gen/android
"""
import shutil
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

main = Path(sys.argv[1]) / "app/src/main"
source = Path(__file__).resolve().parents[2] / "src-tauri/android-update"
dest = main / "java/app/twist/jotpoc"
dest.mkdir(parents=True, exist_ok=True)
for file in source.glob("*.kt"):
    shutil.copyfile(file, dest / file.name)

manifest = main / "AndroidManifest.xml"
text = manifest.read_text()
root = ET.fromstring(text)
name = "{http://schemas.android.com/apk/res/android}name"
for permission in ["android.permission.REQUEST_INSTALL_PACKAGES", "android.permission.POST_NOTIFICATIONS"]:
    if not any(node.get(name) == permission for node in root.findall("uses-permission")):
        text = text.replace("<application", f'<uses-permission android:name="{permission}"/>\n    <application', 1)
if not any(node.get(name) == ".UpdateInstallActivity" for node in root.findall("application/activity")):
    text = text.replace("</application>", '''    <activity android:name=".UpdateInstallActivity" android:exported="false"
            android:theme="@android:style/Theme.Translucent.NoTitleBar" />
        <receiver android:name=".UpdateCompleteReceiver" android:exported="true" android:permission="android.permission.SEND_DOWNLOAD_COMPLETED_INTENTS">
            <intent-filter><action android:name="android.intent.action.DOWNLOAD_COMPLETE" /></intent-filter>
        </receiver>
    </application>''')
ET.fromstring(text)
manifest.write_text(text)
