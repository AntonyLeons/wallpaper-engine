import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const bundle=await build({stdin:{contents:"export { VisualizerRenderer } from './src/render/VisualizerRenderer'; export { settingsManager, DEFAULT_SETTINGS, VISUALIZER_POSITIONS } from './src/config/settings';",resolveDir:root},bundle:true,write:false,format:'esm',platform:'node'});
const {VisualizerRenderer,settingsManager,DEFAULT_SETTINGS,VISUALIZER_POSITIONS}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const manager=new settingsManager.constructor();
const update=p=>manager.updateFromWallpaperEngine(p);
update({visualizerposition:{value:'custom'}});
update({visualizerpositionx:{value:120}});
update({visualizerpositiony:{value:-20}});
assert.equal(manager.settings.visualizerPosition,'custom');assert.equal(manager.settings.visualizerPositionX,100);assert.equal(manager.settings.visualizerPositionY,0);
for(const raw of [NaN,Infinity,-Infinity,'NaN','Infinity','',true,null]){
update({visualizerpositionx:{value:raw},visualizerpositiony:{value:raw},visualizerposition:{value:'invalid'}});
assert.equal(manager.settings.visualizerPosition,'custom');assert.equal(manager.settings.visualizerPositionX,100);assert.equal(manager.settings.visualizerPositionY,0);
}
update({visualizerpositiony:{value:'75'}});assert.equal(manager.settings.visualizerPositionY,75);assert.equal(manager.settings.visualizerPositionX,100);
globalThis.window={location:{search:'?visualizerposition=top_right&visualizerpositionx=23&visualizerpositiony=77'}};
const urlManager=new settingsManager.constructor();delete globalThis.window;
assert.equal(urlManager.settings.visualizerPosition,'top_right');assert.equal(urlManager.settings.visualizerPositionX,23);assert.equal(urlManager.settings.visualizerPositionY,77);
const project=JSON.parse(readFileSync(new URL('../project.json',import.meta.url),'utf8'));
for(const [key,field]of [['visualizerposition','visualizerPosition'],['visualizerpositionx','visualizerPositionX'],['visualizerpositiony','visualizerPositionY']])assert.equal(project.general.properties[key].value,DEFAULT_SETTINGS[field]);
const audio={hasAudio:true,spectrum:new Float32Array(32).fill(1)};
let points=[],gradients=0;
const ctx={save(){},restore(){},beginPath(){},stroke(){},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},createLinearGradient(){gradients++;return{addColorStop(){}};}};
const renderer=new VisualizerRenderer();
for(const [width,height]of [[1920,1080],[1920,1200],[2560,1080],[3840,1080],[720,1280],[3840,2160]]){
for(const style of ['bars','waveform'])for(const position of VISUALIZER_POSITIONS){
for(const [x,y]of position==='custom'?[[0,0],[100,0],[0,100],[100,100],[25,75]]:[[50,100]]){
points=[];renderer.render(ctx,width,height,1/60,{...DEFAULT_SETTINGS,visualizerStyle:style,visualizerPosition:position,visualizerPositionX:x,visualizerPositionY:y},audio);
assert.ok(points.length>0);
for(const [px,py]of points){assert.ok(Number.isFinite(px)&&Number.isFinite(py));assert.ok(px>=1&&px<=width-1,`${style} ${position} horizontal clipping`);assert.ok(py>=1&&py<=height-DEFAULT_SETTINGS.taskbarOffset,`${style} ${position} vertical clipping`);}
if(position==='bottom_center'&&style==='bars'){
const ys=points.map(p=>p[1]);assert.ok(Math.abs((Math.min(...ys)+Math.max(...ys))/2-(height-DEFAULT_SETTINGS.taskbarOffset-24))<0.001);
}
}
}
}
for(const [width,height]of [[1920,1080],[720,1280],[3840,1080]]) {
for(const bounds of [
{left:50,right:330,top:0,bottom:150,width:280},
{left:width-330,right:width-50,top:height-230,bottom:height-80,width:280},
{left:width/2-140,right:width/2+140,top:height/2-75,bottom:height/2+75,width:280},
])for(const style of ['bars','waveform']){
points=[];renderer.render(ctx,width,height,1/60,{...DEFAULT_SETTINGS,visualizerStyle:style},audio,bounds);
const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
assert.ok(Math.min(...ys)>=bounds.bottom+10||Math.max(...ys)<=bounds.top-10,'linked visualizer must not overlap the clock');
const span=Math.min(width*0.38,360,Math.max(120,bounds.width));
const expected=Math.max(1+span/2,Math.min(width-1-span/2,(bounds.left+bounds.right)/2));
assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2-expected)<0.001,'linked visualizer must centre on clock within viewport');
for(const [x,y]of points)assert.ok(x>=1&&x<=width-1&&y>=1&&y<=height-DEFAULT_SETTINGS.taskbarOffset);
}
}
points=[];renderer.render(ctx,1920,1080,0,{...DEFAULT_SETTINGS,showClock:false},audio,{left:100,right:400,top:100,bottom:250,width:300});
assert.ok(points.every(p=>p[1]>900),'hidden clock falls back to bottom centre');
points=[];renderer.render(ctx,1920,1080,0,{...DEFAULT_SETTINGS,visualizerStyle:'off'},audio);assert.equal(points.length,0);
renderer.render(ctx,1920,1080,0,DEFAULT_SETTINGS,{...audio,hasAudio:false});assert.equal(points.length,0);
const cacheRenderer=new VisualizerRenderer();cacheRenderer.render(ctx,1920,1080,0,{...DEFAULT_SETTINGS,visualizerPosition:'top_left'},audio);const count=gradients;
cacheRenderer.render(ctx,1920,1080,0,{...DEFAULT_SETTINGS,visualizerPosition:'bottom_left'},audio);assert.equal(gradients,count);
cacheRenderer.render(ctx,1920,1080,0,{...DEFAULT_SETTINGS,visualizerPosition:'bottom_right'},audio);assert.equal(gradients,count+1);
console.log('PASS: both styles, all positions and custom extremes across six screen sizes; partial updates, validation, URL options, defaults, idle/off states, clock linking/fallback and gradient cache.');
