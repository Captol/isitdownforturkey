const fs=require("fs");
const p=".vercel/output/functions/_render.func/.vc-config.json";
if(fs.existsSync(p)){
  const d=JSON.parse(fs.readFileSync(p,"utf8"));
  d.runtime="nodejs22.x";
  fs.writeFileSync(p,JSON.stringify(d,null,4)+String.fromCharCode(10));
  console.log("set runtime to nodejs22.x");
}