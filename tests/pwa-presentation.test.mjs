import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

test('ARC FIT manifest has stable root identity, standalone display and matching dark launch chrome', () => {
  const manifest=JSON.parse(readFileSync('public/manifest.json','utf8')), html=readFileSync('index.html','utf8')
  assert.equal(manifest.name,'ARC FIT');assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone')
  assert.equal(manifest.background_color,'#0b0b0d');assert.equal(manifest.theme_color,'#0b0b0d')
  assert.match(html,/viewport-fit=cover/);assert.match(html,/<meta name="theme-color" content="#0b0b0d"/);assert.match(html,/\/icons\/arc-fit\.svg/)
  assert.ok(!html.includes('vite.svg'));assert.ok(!html.includes('cdn.tailwindcss.com'))
})
test('actual PNG assets match declared sizes and keep all artwork inside Android maskable safe circle', () => {
  const manifest=JSON.parse(readFileSync('public/manifest.json','utf8'))
  for(const icon of manifest.icons){
    const png=readFileSync('public'+icon.src);assert.equal(png.readUInt32BE(0),0x89504e47)
    const width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert.equal(`${width}x${height}`,icon.sizes)
    const chunks=[];for(let offset=8;offset<png.length;){const size=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8);if(kind==='IDAT')chunks.push(png.subarray(offset+8,offset+8+size));offset+=size+12}
    const pixels=inflateSync(Buffer.concat(chunks));assert.equal(pixels.length,(width*3+1)*height)
    let foreground=0
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const offset=y*(width*3+1)+1+x*3;const background=pixels[offset]===11&&pixels[offset+1]===11&&pixels[offset+2]===13;if(!background){foreground++;if(icon.purpose==='maskable')assert.ok(Math.hypot(x+.5-width/2,y+.5-height/2)<=width*.4+1,'Artwork would be cropped by a compliant mask')}}
    assert.ok(foreground>width*height*.1,'Logo must contain visible artwork')
  }
})
test('system chrome stays dark and inset-aware without fullscreen or storage-reset code', () => {
  const css=readFileSync('src/app/shell.css','utf8'),root=readFileSync('src/index.css','utf8'),shell=readFileSync('src/app/AppShell.tsx','utf8'),auth=readFileSync('src/auth/AuthGate.tsx','utf8')
  for(const side of ['top','right','bottom','left'])assert.ok(root.includes(`safe-area-inset-${side}`))
  assert.match(css,/\.mobile-dock::after/);assert.match(css,/bottom: calc\(var\(--keyboard-offset\) \+ var\(--safe-bottom\)\)/)
  assert.match(css,/padding-bottom: calc\(var\(--dock-height\) \+ var\(--safe-bottom\)\)/)
  assert.ok(!shell.includes('· Gym Tracker'));assert.ok(!shell.includes('>GT<'));assert.ok(!auth.includes('Workout logging is coming soon'))
  assert.ok(!shell.includes('requestFullscreen'));assert.ok(!shell.includes('localStorage.clear'));assert.ok(!shell.includes('deleteDatabase'))
})
