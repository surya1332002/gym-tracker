import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {displayReadout} from '../public/display-check.js'

const browser=mode=>({matchMedia:query=>({matches:query===`(display-mode: ${mode})`}),isSecureContext:true,navigator:{userAgent:'synthetic-browser'},innerWidth:390,innerHeight:800,visualViewport:{width:390,height:800,scale:1}})
const zero={paddingTop:'0px',paddingRight:'0px',paddingBottom:'0px',paddingLeft:'0px'}
test('ordinary browser and installed standalone checks are explicitly different',()=>{
  assert.equal(displayReadout(browser('browser'),zero).displayMode,'browser')
  assert.equal(displayReadout(browser('standalone'),zero).displayMode,'standalone')
  assert.equal(displayReadout(browser('fullscreen'),zero).displayMode,'fullscreen')
})
test('zero or positive insets never become a false claim of status-bar overlap',()=>{
  for(const top of ['0px','32px','invalid']){
    const report=displayReadout(browser('standalone'),{...zero,paddingTop:top,paddingBottom:'24px'})
    assert.equal(report.safeAreaCssPx.top,top==='invalid'?'unknown':Number.parseFloat(top));assert.equal(report.safeAreaCssPx.bottom,24)
    assert.match(report.statusBarOverlap,/Not detectable/)
  }
})
test('device check contains no account, storage, network or immersive operations',()=>{
  const script=readFileSync('public/display-check.js','utf8'),html=readFileSync('public/display-check.html','utf8')
  assert.doesNotMatch(script,/fetch\(|localStorage|indexedDB|supabase|requestFullscreen|sendBeacon|XMLHttpRequest/)
  assert.match(html,/viewport-fit=cover/);assert.match(html,/theme-color" content="#000000"/)
  assert.match(html,/zero top inset can mean the viewport is already below the status bar/)
})
