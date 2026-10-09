export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,content-type'}});
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,content-type'}});
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const requireUser=async()=>{if(!token)return null;const r=await fetch('https://ugfimbafjqajpogatvld.supabase.co/auth/v1/user',{headers:{apikey:'sb_publishable_aIb1saXm-6vbXcFi2E__w_6eDrGn4r',Authorization:'Bearer '+token}});if(!r.ok)return null;const u=await r.json().catch(()=>null);return u&&u.id?u:null;};
  if(url.pathname==='/health'){
   const r=await env.DB.prepare('SELECT (SELECT COUNT(*) FROM profiles) profiles,(SELECT COUNT(*) FROM rank_predictor_submissions) submissions,(SELECT COUNT(*) FROM rank_predictor_saved_links) saved_links').first();
   return json({ok:true,service:'himchayan-rank-test',database:'himchayan-core-migration',counts:r});
  }
  if(url.pathname==='/canonical'){
   let vName=(url.searchParams.get('examName')||'').trim(),vDate=(url.searchParams.get('examDate')||'').trim(),vShift=(url.searchParams.get('shift')||'').trim();
   let m=vName.match(/exam\s*date\s*[:\-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);if(m)vDate=m[1];
   m=vName.match(/shift\s*[:\-]?\s*([0-9]{1,2}:[0-9]{2}\s*[ap]m\s*-\s*[0-9]{1,2}:[0-9]{2}\s*[ap]m)/i);if(m)vShift=m[1];
   vName=vName.replace(/\s+(application\s*(id|no)|roll\s*no|applicant\s*name|candidate\s*(name|application)|category|exam\s*date|shift)\s*[:\-]?.*$/i,'');
   vName=vName.trim().replace(/\s+/g,' ').toLowerCase();vDate=vDate.trim().toLowerCase();vShift=vShift.trim().replace(/\s+/g,' ').toLowerCase();
   return json({exam_name:vName,exam_date:vDate,shift:vShift,exam_key:(vName+'|'+vDate+'|'+vShift).slice(0,300)});
  }
  if(url.pathname==='/rank'){
   const examKey=(url.searchParams.get('examKey')||'').trim(),category=(url.searchParams.get('category')||'').trim(),shift=(url.searchParams.get('shift')||examKey.split('|')[2]||'').trim(),marks=Number(url.searchParams.get('marks')||0);
   const base=examKey.split('|')[0].trim().toLowerCase(),date=examKey.split('|')[1].trim().toLowerCase(),normShift=shift.replace(/\s+/g,' ').toLowerCase();
   const q=await env.DB.prepare('SELECT category,exam_date,shift,marks,exam_name,source_url,created_at,id FROM rank_predictor_submissions WHERE source_url IS NOT NULL AND trim(source_url) <> ? ORDER BY created_at DESC,id DESC').bind('').all();
   const seen=new Set(),b=[];for(const row of (q.results||[])){const k=(row.source_url||'').trim().replace(/\/+ /g,'/').toLowerCase();if(!k||seen.has(k))continue;seen.add(k);b.push(row);}
   const scoped=b.filter(row=>(row.exam_name||'').split(/ application id /i)[0].trim().toLowerCase()===base);
   const canonShift=(s)=>{s=(s||'').trim().replace(/\s+/g,' ').toLowerCase();if(['4','4 pm','4:00','4:00 pm'].includes(s))return '4:00 pm - 5:30 pm';if(['12','12 pm','12:30','12:30 pm'].includes(s))return '12:30 pm - 2:00 pm';return s;};
   const cr=scoped.filter(row=>(row.category||'').trim().toLowerCase()===category.toLowerCase());
   const sr=scoped.filter(row=>(row.exam_date||'').trim().toLowerCase()===date&&canonShift(row.shift)===normShift);
   const rank=a=>1+a.filter(row=>Number(row.marks)>marks).length,pct=(n,r)=>n>0?Math.round(((n-r)/n*100)*100)/100:0;
   const or=rank(scoped),crk=rank(cr),srk=rank(sr);
   return json({overallRank:or,categoryRank:crk,shiftRank:srk,overallCandidates:scoped.length,categoryCandidates:cr.length,shiftCandidates:sr.length,overallPercentile:pct(scoped.length,or),categoryPercentile:pct(cr.length,crk),shiftPercentile:pct(sr.length,srk)});
  }
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const u=await requireUser();if(!u)return json({ok:false,error:'LOGIN_REQUIRED'},401);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||'');
  if(action==='submit_rank_predictor_result'){
   const examKey=String(body.p_exam_key||'').slice(0,300),examName=String(body.p_exam_name||'').slice(0,300),category=String(body.p_category||'').slice(0,50),gender=String(body.p_gender||'').slice(0,20),state=String(body.p_state||'').slice(0,80),examDate=String(body.p_exam_date||'').slice(0,80),shift=String(body.p_shift||'').slice(0,120),sourceUrl=String(body.p_source_url||'').slice(0,2000);
   if(!examKey||!category)return json({ok:false,error:'INVALID_SUBMISSION'},400);
   const id=crypto.randomUUID(),now=new Date().toISOString();
   await env.DB.prepare('INSERT INTO rank_predictor_submissions (id,user_id,exam_key,exam_name,category,gender,state,exam_date,shift,total_questions,attempted,correct,wrong,skipped,marks,percentile,normalized_score,source_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,u.id,examKey,examName,category,gender,state,examDate,shift,Math.max(0,Math.trunc(Number(body.p_total_questions)||0)),Math.max(0,Math.trunc(Number(body.p_attempted)||0)),Math.max(0,Math.trunc(Number(body.p_correct)||0)),Math.max(0,Math.trunc(Number(body.p_wrong)||0)),Math.max(0,Math.trunc(Number(body.p_skipped)||0)),Number(body.p_marks)||0,body.p_percentile==null?null:Number(body.p_percentile),body.p_normalized_score==null?null:Number(body.p_normalized_score),sourceUrl,now,now).run();
   return json({success:true,id});
  }
  if(action==='get_rank_predictor_stats'){
   const examKey=String(body.p_exam_key||'').slice(0,300),category=String(body.p_category||'').slice(0,50),state=String(body.p_state||'').slice(0,80),shift=String(body.p_shift||'').slice(0,120),marks=Number(body.p_marks)||0;
   const r=await env.DB.prepare('SELECT marks,category,state,shift FROM rank_predictor_submissions WHERE exam_key=?').bind(examKey).all();
   const rows=r.results||[],cat=rows.filter(x=>(x.category||'')===category),st=rows.filter(x=>(x.state||'')===state&&(!shift||(x.shift||'')===shift));
   const rank=a=>1+a.filter(x=>Number(x.marks)>marks).length,pct=(n,ra)=>n?Math.round((n-ra)*10000/n)/100:0;
   const rr=rank(rows),cr=rank(cat),sr=rank(st);
   return json({overallRank:rr,categoryRank:cr,stateRank:sr,overallCandidates:rows.length,categoryCandidates:cat.length,stateCandidates:st.length,overallPercentile:pct(rows.length,rr),categoryPercentile:pct(cat.length,cr),statePercentile:pct(st.length,sr)});
  }
  return json({ok:false,error:'UNKNOWN_ACTION'},400);
 }
}