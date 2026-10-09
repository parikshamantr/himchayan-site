const AUTH_API = "https://himchayan-auth-bridge-test.pmindia.workers.dev";
const PAYMENT_API = "https://himchayan-payment.pmindia.workers.dev";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}
});
const like=value=>"%"+String(value||"").replace(/[%_]/g,"")+"%";
const isTrue=value=>value===true||value===1||value==="1";
async function userFromRequest(req) {
  const auth=req.headers.get("Authorization")||"";
  if(!/^Bearer\s+\S+/.test(auth))return null;
  try {
    const token=auth.replace(/^Bearer\s+/i,"");
    const r=await fetch(AUTH_API+"/auth/user",{headers:{Authorization:auth,Accept:"application/json"}});
    if(r.ok){const data=await r.json().catch(()=>({}));if(data?.user?.id)return data.user;}
    const sr=await fetch("https://ugfimbafjqajpogatvld.supabase.co/auth/v1/user",{headers:{apikey:"sb_publishable_aIb1saXm-6vbXcFi2E__w_6eDrGn4r",Authorization:"Bearer "+token}});
    if(!sr.ok)return null;
    const su=await sr.json().catch(()=>({}));
    return su?.id?{id:su.id,email:su.email||"",user_metadata:su.user_metadata||{},role:su.role||"authenticated"}:null;
  } catch { return null; }
}
function addFilter(where,args,key,value) {
  if(value===undefined||value===null||value==="")return;
  if(Array.isArray(value)) {
    const vals=value.map(v=>String(v)).filter(Boolean).slice(0,30);
    if(!vals.length)return;
    where.push(key + " IN (" + vals.map(()=>"?").join(",") + ")");
    args.push(...vals);
  } else {
    where.push(key + " = ?");
    args.push(String(value));
  }
}
async function listResources(env,body) {
  const where=["is_published=1","is_active=1","UPPER(access_type)!='HIDDEN'"];
  const args=[];
  const q=String(body.q||body.search||"").trim().slice(0,120);
  if(q) {
    const p=like(q);
    where.push("(title LIKE ? OR description LIKE ? OR exam_group LIKE ? OR exam_name LIKE ? OR content_type LIKE ? OR subject LIKE ? OR file_type LIKE ?)");
    args.push(p,p,p,p,p,p,p);
  }
  if(body.access_type_exclude) { where.push("UPPER(access_type) != UPPER(?)"); args.push(String(body.access_type_exclude)); }
  for(const key of ["exam_group","exam_name","content_type","file_type","subject"])addFilter(where,args,key,body[key]);
  const result=await env.DB.prepare(
    "SELECT id,exam_group,exam_name,content_type,subject,title,description,file_type,storage_path,external_url,access_type,price,allow_view,allow_download,is_published,is_active,display_order,created_at,updated_at FROM exam_resources WHERE "+where.join(" AND ")+" ORDER BY display_order ASC,created_at DESC LIMIT 200"
  ).bind(...args).all();
  return result.results||[];
}
async function gatewayAction(req,env,user,body) {
  const action=String(body.action||"");
  if(action==="get_resource") {
    if(!user)return json({error:"Login required"},401);
    const id=String(body.resource_id||"");
    if(!id)return json({error:"Resource ID required"},400);
    const r=await env.DB.prepare("SELECT * FROM exam_resources WHERE id=? LIMIT 1").bind(id).first();
    if(!r||!isTrue(r.is_active)||!isTrue(r.is_published)||String(r.access_type||"").toUpperCase()==="HIDDEN")return json({error:"Resource not found or unavailable"},404);
    const download=!!body.download;
    if(!isTrue(r.allow_view))return json({error:"Viewing is disabled"},403);
    if(download&&!isTrue(r.allow_download))return json({error:"Download is disabled"},403);
    const adminRow=await env.DB.prepare("SELECT user_id FROM admin_users WHERE user_id=? LIMIT 1").bind(user.id).first();
    const isAdmin=!!adminRow||String(user.email||"").trim().toLowerCase()==="rajpootbawan@gmail.com";
    const accessType=String(r.access_type||"FREE").toUpperCase();
    let allowed=accessType==="FREE"||isAdmin;
    if(accessType==="PAID"&&!isAdmin) {
      const access=await env.DB.prepare("SELECT id,expires_at FROM resource_access WHERE user_id=? AND resource_id=? AND is_active=1 LIMIT 1").bind(user.id,id).first();
      allowed=!!access&&(!access.expires_at||new Date(access.expires_at).getTime()>Date.now());
    }
    if(accessType==="ADMIN_ONLY"&&!isAdmin)allowed=false;
    if(!allowed)return json({error:"Purchase required",requires_purchase:accessType==="PAID"},403);
    const external=String(r.external_url||"").trim();
    const fileType=String(r.file_type||"").toUpperCase();
    if((fileType==="LINK"||fileType==="MOCK")&&external) {
      return json({url:external,external:true,download,title:r.title,file_type:fileType,allow_download:isTrue(r.allow_download)});
    }
    if(external&&(!r.storage_path||(fileType!=="PDF"&&fileType!=="IMAGE"))) {
      return json({url:external,external:true,download,title:r.title,file_type:fileType,allow_download:isTrue(r.allow_download)});
    }
    if(r.storage_path) {
      return json({error:"File storage is awaiting the separately planned R2 migration. Existing resource access and payment records are preserved.",storage_pending:true},503);
    }
    if(external) return json({url:external,external:true,download,title:r.title,file_type:fileType,allow_download:isTrue(r.allow_download)});
    return json({error:"Resource file is not configured"},404);
  }
  if(action==="create_order"||action==="verify_payment") {
    if(!user)return json({error:"Login required"},401);
    const mapped={...body,action:action==="create_order"?"resource_create_order":"resource_verify_payment"};
    try {
      const response=await fetch(PAYMENT_API,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:req.headers.get("Authorization")||""},
        body:JSON.stringify(mapped)
      });
      const data=await response.json().catch(()=>({error:"Payment service returned invalid JSON"}));
      return json(data,response.status);
    } catch {
      return json({error:"Payment service is temporarily unavailable"},503);
    }
  }
  return json({error:"Unknown action"},400);
}
export default {
  async fetch(req,env) {
    if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
    if(!env.DB)return json({error:"D1 binding DB missing"},500);
    if(!["GET","POST"].includes(req.method))return json({error:"Method not allowed"},405);
    const url=new URL(req.url);
    const body=req.method==="POST"?await req.json().catch(()=>({})):Object.fromEntries(url.searchParams.entries());
    const action=String(body.action||"search");
    try {
      if(action==="health"||url.pathname==="/health") {
        const r=await env.DB.prepare("SELECT COUNT(*) AS resources FROM exam_resources WHERE is_published=1 AND is_active=1").first();
        return json({ok:true,service:"himchayan-resource-gateway",storage:"D1",resources:Number(r?.resources||0),fileStorage:"R2 migration pending"});
      }
      if(action==="search"||action==="list"||!body.action) {
        const data=await listResources(env,body);
        return json({data,ok:true});
      }
      const user=await userFromRequest(req);
      return await gatewayAction(req,env,user,body);
    } catch(error) {
      console.error("resource-gateway-error",String(error?.message||error));
      return json({error:"Resource request failed"},500);
    }
  }
};