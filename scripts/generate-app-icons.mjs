// Original ARC FIT vector mark, rasterized without fonts or third-party artwork.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const outer = [[98,365],[196,147],[246,147],[314,365],[259,365],[247,320],[170,320],[150,365]]
const hole = [[188,274],[235,274],[218,208]]
const letterF = [[310,147],[415,147],[415,196],[360,196],[360,234],[409,234],[409,282],[360,282],[360,365],[310,365]]
function inside(x, y, points) {
  let hit = false
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const [a,b]=points[i], [c,d]=points[j]
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) hit=!hit
  }
  return hit
}
function crc(bytes) {
  let value=0xffffffff
  for (const byte of bytes) { value^=byte; for(let n=0;n<8;n++) value=(value>>>1)^((value&1)?0xedb88320:0) }
  return (value^0xffffffff)>>>0
}
function chunk(type, data) {
  const body=Buffer.concat([Buffer.from(type),data]), size=Buffer.alloc(4), sum=Buffer.alloc(4)
  size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(body));return Buffer.concat([size,body,sum])
}
for (const size of [192,512]) {
  const raw=Buffer.alloc((size*3+1)*size)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const rgb=[0,0,0]
    for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++) {
      const px=(x+(sx+.5)/4)*512/size,py=(y+(sy+.5)/4)*512/size
      const color=inside(px,py,letterF)?[245,245,245]:inside(px,py,outer)&&!inside(px,py,hole)?[239,51,64]:[11,11,13]
      color.forEach((value,i)=>{rgb[i]+=value/16})
    }
    const offset=y*(size*3+1)+1+x*3;rgb.forEach((value,i)=>{raw[offset+i]=Math.round(value)})
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])
  writeFileSync(`public/icons/arc-fit-${size}.png`,png)
  writeFileSync(`public/icons/icon-${size}.png`,png) // Retained legacy URL, with current branding.
  if(size===512)writeFileSync('public/icons/arc-fit-maskable-512.png',png)
}
