import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw } from "lucide-react";

const API=import.meta.env.VITE_API_BASE_URL??"";
async function get<T>(path:string):Promise<T>{const r=await fetch(`${API}${path}`,{credentials:"include"});const d=await r.json();if(!r.ok)throw new Error(d.error??"Request failed");return d;}
type Account={id:number;code:string;name:string;type:string;isActive:boolean};
type Journal={entry:{id:number;entryDate:string;description:string;status:string;source:string};lines:Array<{accountId:number;debit:string;credit:string;description?:string}>};
export default function Accounting(){
 const [accounts,setAccounts]=useState<Account[]>([]); const [journals,setJournals]=useState<Journal[]>([]);
 const [tb,setTb]=useState<any>(null); const [pl,setPl]=useState<any>(null); const [bs,setBs]=useState<any[]>([]);
 const [tab,setTab]=useState("overview"); const [error,setError]=useState("");
 const load=async()=>{try{setError("");const [a,j,t,p,b]=await Promise.all([get<Account[]>("/api/accounting/accounts"),get<Journal[]>("/api/accounting/journals?status=posted"),get<any>("/api/accounting/trial-balance"),get<any>("/api/accounting/profit-loss"),get<any[]>("/api/accounting/balance-sheet")]);setAccounts(a);setJournals(j);setTb(t);setPl(p);setBs(b);}catch(e){setError(e instanceof Error?e.message:"Unable to load accounting data");}};
 useEffect(()=>{load()},[]);
 return <div className="space-y-6">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/finance/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>Finance reports</Link><h1 className="mt-2 text-3xl font-semibold">Accounting</h1><p className="text-muted-foreground">Double-entry ledger, chart of accounts and financial statements.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
  {error&&<div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
  <div className="flex gap-2 border-b">{["overview","accounts","journals"].map(x=><button key={x} onClick={()=>setTab(x)} className={`px-4 py-2 text-sm capitalize ${tab===x?"border-b-2 border-primary font-medium":""}`}>{x}</button>)}</div>
  {tab==="overview"&&<div className="grid gap-4 md:grid-cols-3">
   <div className="rounded-xl border p-5"><p className="text-sm text-muted-foreground">Revenue</p><p className="mt-2 text-2xl font-semibold">AED {(pl?.totalRevenue??0).toFixed(2)}</p></div>
   <div className="rounded-xl border p-5"><p className="text-sm text-muted-foreground">Expenses</p><p className="mt-2 text-2xl font-semibold">AED {(pl?.totalExpenses??0).toFixed(2)}</p></div>
   <div className="rounded-xl border p-5"><p className="text-sm text-muted-foreground">Net profit</p><p className="mt-2 text-2xl font-semibold">AED {(pl?.netProfit??0).toFixed(2)}</p></div>
   <div className="rounded-xl border p-5 md:col-span-3"><h2 className="font-semibold">Trial balance</h2><div className="mt-4 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Code</th><th className="p-2">Account</th><th className="p-2">Debit</th><th className="p-2">Credit</th><th className="p-2">Balance</th></tr></thead><tbody>{(tb?.accounts??[]).map((a:any)=><tr key={a.id} className="border-b"><td className="p-2">{a.code}</td><td className="p-2">{a.name}</td><td className="p-2">AED {a.debit.toFixed(2)}</td><td className="p-2">AED {a.credit.toFixed(2)}</td><td className="p-2">AED {a.balance.toFixed(2)}</td></tr>)}</tbody></table></div><div className="mt-3 text-sm font-medium">Debits AED {(tb?.totalDebit??0).toFixed(2)} · Credits AED {(tb?.totalCredit??0).toFixed(2)}</div></div>
  </div>}
  {tab==="accounts"&&<div className="rounded-xl border overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Code</th><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Status</th></tr></thead><tbody>{accounts.map(a=><tr key={a.id} className="border-b"><td className="p-3 font-mono">{a.code}</td><td className="p-3">{a.name}</td><td className="p-3 capitalize">{a.type}</td><td className="p-3">{a.isActive?"Active":"Inactive"}</td></tr>)}</tbody></table></div>}
  {tab==="journals"&&<div className="space-y-3">{journals.map(j=><div key={j.entry.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><span className="font-medium">#{j.entry.id} · {j.entry.description}</span><p className="text-sm text-muted-foreground">{j.entry.entryDate} · {j.entry.source}</p></div><span className="text-sm capitalize">{j.entry.status}</span></div><div className="mt-3 overflow-auto"><table className="w-full text-sm"><tbody>{j.lines.map((l,i)=><tr key={i} className="border-t"><td className="py-2">{accounts.find(a=>a.id===l.accountId)?.code} · {accounts.find(a=>a.id===l.accountId)?.name}</td><td className="py-2 text-right">AED {Number(l.debit).toFixed(2)}</td><td className="py-2 text-right">AED {Number(l.credit).toFixed(2)}</td></tr>)}</tbody></table></div></div>)}</div>}
 </div>;
}