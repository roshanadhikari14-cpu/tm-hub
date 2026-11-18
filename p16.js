const fs=require('fs');let a=fs.readFileSync('lib/ptmAuto.js','utf8').split('\r').join('');
const rep=(x,y)=>{if(!a.includes(x))throw new Error('missing '+x.slice(0,60));a=a.replace(x,()=>y);};
rep("  out.cycle = m(/Monthly Learning Report (\d+ \w+ – \d+ \w+)/);","  out.cycle = m(/Monthly Learning Report (?:· )?(\d+ \w+ – \d+ \w+)/) || m(/(\d{1,2} [A-Z][a-z]{2,4} – \d{1,2} [A-Z][a-z]{2,4})/);");
rep("  const att = all.match(","  const att2 = all.match(/we conducted (\d+) classes.{0,160}?attended (\d+) of them/) || all.match(/attended (\d+) of (\d+) (?:regular )?classes/);\n  const att = all.match(");
rep("  out.attended = att ? Number(att[1]) : null;\n  out.classes = att ? Number(att[2]) : null;",
"  const aa = att ? [Number(att[1]), Number(att[2])] : att2 ? (/we conducted/.test(att2[0]) ? [Number(att2[2]), Number(att2[1])] : [Number(att2[1]), Number(att2[2])]) : null;\n  out.attended = aa ? aa[0] : null;\n  out.classes = aa ? aa[1] : null;");
fs.writeFileSync('lib/ptmAuto.js',a);
