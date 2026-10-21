export function displayReadout(environment, insetStyle) {
  const mode = ['standalone', 'fullscreen', 'minimal-ui'].find(value => environment.matchMedia(`(display-mode: ${value})`).matches) ?? 'browser'
  const inset = value => { const parsed=Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : 'unknown' }
  return {
    displayMode: mode,
    secureContext: environment.isSecureContext === true,
    browser: environment.navigator.userAgent,
    viewport: { width: environment.innerWidth, height: environment.innerHeight },
    visualViewport: environment.visualViewport ? { width: environment.visualViewport.width, height: environment.visualViewport.height, scale: environment.visualViewport.scale } : null,
    safeAreaCssPx: { top: inset(insetStyle.paddingTop), right: inset(insetStyle.paddingRight), bottom: inset(insetStyle.paddingBottom), left: inset(insetStyle.paddingLeft) },
    statusBarOverlap: 'Not detectable from these web metrics; requires inspection on the actual installed device.',
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const render = () => {
    const report=displayReadout(window,getComputedStyle(document.getElementById('safe-area-probe')))
    document.getElementById('display-report').textContent=JSON.stringify(report,null,2)
    document.getElementById('mode-status').textContent=report.displayMode==='standalone'
      ? 'Standalone mode is active on this browser. This alone does not prove Android status-bar overlap.'
      : `Current mode: ${report.displayMode}. This is not a standalone installed-PWA test.`
  }
  document.getElementById('refresh-report').addEventListener('click',render)
  render()
}
