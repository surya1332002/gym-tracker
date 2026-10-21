# Android installed-PWA display boundary

ARC FIT requests `display: standalone` and `viewport-fit=cover`. The HTML theme color, manifest launch/theme colors and root/header/dock backgrounds now use true black. The mobile header remains 56px and dock 61px, in addition to any protected areas reported by the browser. No fullscreen, immersive, negative-inset or Android flag workaround is used.

## Top inset inspection

There is no duplicated status-bar padding in the current shell. Global border-box sizing makes the fixed header's total height `56px + safe-top`, with `safe-top` reserved once inside that height. The hamburger begins at `safe-top + 6px`. The separate content container reserves that same total header height because the header is fixed; this does not add the inset twice to header controls. These values were retained rather than reduced without phone evidence.

If Chrome gives the web viewport space behind the status bar, the black header paints that space while its controls remain below the reported safe area. If Chrome reserves the status bar outside the web viewport, a zero top inset is expected and the shell already begins at the first available web pixel. CSS cannot expand an Android activity's native content bounds.

## Browser support is conditional

Chromium's [Android web-app architecture](https://chromium.googlesource.com/chromium/src.git/+/main/components/webapps/docs/android_architecture.md#display-modes-and-immersive-mode), inspected for this task, distinguishes immersive fullscreen from non-immersive cutout rendering. It documents the latter behind `WebAppShortEdgesCutoutMode` and the default-off `enable_standalone` parameter. This is development-branch documentation, not proof of the feature/rollout state of a particular released Chrome build. A Pixel 9 Pro model name alone cannot establish support. Chrome's [edge-to-edge migration guide](https://developer.chrome.com/docs/css-ui/edge-to-edge) primarily describes extension into the bottom gesture area; it is not evidence that every installed standalone PWA can draw behind the top status bar.

The browser/Android controls native system-bar coloring and contrast. True-black web surfaces and theme requests provide the supported visual match, but cannot force transparent native bars or hide/move the clock, camera cutout, battery or gestures.

## Actual phone verification

No connected Pixel installed-PWA runtime is available to the current browser automation. Desktop 320/390px tests are labelled desktop and cannot establish Android status-bar behavior.

While online, launch the installed ARC FIT app on the Pixel, then open **Profile > Appearance > Open installed display check**. Do not open the link in an ordinary Chrome tab. Confirm the readout says `standalone`, then note the browser version and reported top/bottom safe insets. Observe the real clock/camera/battery placement separately, ideally with Android USB remote inspection or a phone screenshot. Neither zero nor positive CSS inset values alone prove native overlap. Share the readout and Android version to distinguish browser support from app layout; the page does not read accounts/storage, transmit telemetry or access Supabase.

Do not clear app storage, uninstall the PWA or enable experimental browser flags for this check. Normal waiting-worker and installed-manifest updates may require closing existing ARC FIT windows and reopening; their timing belongs to the browser. Existing workout recovery remains unchanged.
