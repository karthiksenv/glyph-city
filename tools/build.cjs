const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=['world.js','renderer.js','app.js'].map(file=>fs.readFileSync(path.join(root,'src',file),'utf8')).join('\n');
const html=fs.readFileSync(path.join(root,'src','shell.html'),'utf8').replace('<!-- ENGINE -->','<script>\n'+source+'\n</script>');
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built self-contained index.html ('+Buffer.byteLength(html)+' bytes)');
