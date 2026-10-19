const fs=require("fs");
const p=".vercel/output/functions/render.func/.vc-config.json";
if(fs.existsSync(p)){
  const d=JSON.parse(fs.readFileSync(p,"utf8"));
  delete d.runtime;
  fs.writeFileSync(p,JSON.stringify(d,null,4)+String.fromCharCode(10));
  console.log("stripped runtime from .vc-config.json");
}