const base=process.env.SMOKE_BASE_URL??"http://127.0.0.1:5001";
let cookie="";
async function request(path:string,options:RequestInit={}){const headers:any={"Content-Type":"application/json",...(options.headers??{})};if(cookie)headers.Cookie=cookie;const r=await fetch(base+path,{...options,headers});const set=r.headers.get("set-cookie");if(set)cookie=set.split(";")[0];const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${path} ${r.status}: ${JSON.stringify(d)}`);return d;}
async function main(){
 const email=process.env.SMOKE_ADMIN_EMAIL, password=process.env.SMOKE_ADMIN_PASSWORD;
 if(!email||!password)throw new Error("SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD are required");
 await request("/api/auth/login",{method:"POST",body:JSON.stringify({email,password})});
 const accounts=await request("/api/accounting/accounts");
 const revenue=accounts.find((a:any)=>a.code==="4000"), cash=accounts.find((a:any)=>a.code==="1000");
 if(!revenue||!cash)throw new Error("Default chart of accounts missing");
 const today=new Date().toISOString().slice(0,10);
 const journal=await request("/api/accounting/journals",{method:"POST",body:JSON.stringify({entryDate:today,description:"Stage 3 smoke journal",source:"stage3-smoke",lines:[{accountId:cash.id,debit:100,credit:0},{accountId:revenue.id,debit:0,credit:100}]})});
 const journals=await request("/api/accounting/journals?status=posted");
 if(!journals.some((j:any)=>j.entry.id===journal.id))throw new Error("Posted journal not visible");
 const tb=await request("/api/accounting/trial-balance");
 if(Math.abs(tb.totalDebit-tb.totalCredit)>0.005)throw new Error("Trial balance does not balance");
 const pl=await request("/api/accounting/profit-loss");
 if(typeof pl.netProfit!=="number")throw new Error("P&L unavailable");
 const reversed=await request(`/api/accounting/journals/${journal.id}/reverse`,{method:"POST"});
 if(!reversed.id)throw new Error("Journal reversal failed");
 const period=await request("/api/accounting/periods",{method:"POST",body:JSON.stringify({name:`Stage3 Smoke ${Date.now()}`,startDate:today,endDate:today})});
 const closed=await request(`/api/accounting/periods/${period.id}/close`,{method:"POST"});
 if(closed.status!=="closed")throw new Error("Accounting period did not close");
 await request("/api/auth/logout",{method:"POST"});
 console.log("STAGE3_SMOKE_PASS");
}
main().catch(e=>{console.error(e);process.exit(1);});
