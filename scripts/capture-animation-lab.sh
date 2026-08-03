#!/bin/zsh
set -euo pipefail

if ! pgrep -x RobloxStudio >/dev/null; then
	print -u2 "Animation Lab capture requires the existing Roblox Studio session."
	exit 1
fi

capture_root="${ANIMATION_LAB_CAPTURE_DIR:-artifacts/animation-lab}"
frame_count="${ANIMATION_LAB_FRAME_COUNT:-48}"
frame_interval="${ANIMATION_LAB_FRAME_INTERVAL:-0.25}"
session_stamp="$(date +%Y%m%d-%H%M%S)"
session_dir="${capture_root}/${session_stamp}"
mkdir -p "${session_dir}"

osascript \
	-e 'tell application id "com.Roblox.RobloxStudio" to activate' \
	-e 'tell application "System Events" to tell process "RobloxStudio" to click menu item "Stop" of menu "Test" of menu bar item "Test" of menu bar 1' \
	2>/dev/null || true
sleep 2
osascript \
	-e 'tell application id "com.Roblox.RobloxStudio" to activate' \
	-e 'tell application "System Events" to tell process "RobloxStudio" to click menu item "Test" of menu 1 of menu item "Start Test Session" of menu "Test" of menu bar item "Test" of menu bar 1'
sleep 2

studio_window_id=$(osascript -l JavaScript -e '
	ObjC.import("Cocoa");
	ObjC.import("CoreGraphics");
	function run() {
		const windows = ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1, 0));
		for (let index = 0; index < Number(windows.count); index++) {
			const window = windows.objectAtIndex(index);
			const owner = String(ObjC.unwrap(window.objectForKey("kCGWindowOwnerName")));
			const name = String(ObjC.unwrap(window.objectForKey("kCGWindowName")));
			if (owner === "Roblox Studio" && name.includes("Roblox Studio")) {
				return String(ObjC.unwrap(window.objectForKey("kCGWindowNumber")));
			}
		}
		return "";
	}
')
if [[ -z "${studio_window_id}" ]]; then
	print -u2 "Could not locate the existing Roblox Studio place window."
	exit 1
fi

integer frame=1
while (( frame <= frame_count )); do
	frame_name=$(printf 'frame-%04d.png' "${frame}")
	/usr/sbin/screencapture -x -l"${studio_window_id}" "${session_dir}/${frame_name}"
	/usr/bin/sips -Z 1440 "${session_dir}/${frame_name}" >/dev/null
	sleep "${frame_interval}"
	(( frame += 1 ))
done

print "Animation Lab capture saved to ${session_dir}"
