import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, accountsTable, accountingPeriodsTable, journalEntriesTable, journalLinesTable, taxCodesTable, bankAccountsTable, bankTransactionsTable, paymentAllocationsTable, counterpartiesTable, accountingAuditLogTable } from "@workspace/db";
import { postSaleTx, postExpenseTx, ensureDefaultAccounts } from "../services/accounting";

const router: IRouter = Router();

function amount(value: unknown) { const n = Number(value); if (!Number.isFinite(n) || n < 0) throw new Error("INVALID_AMOUNT"); return n.toFixed(2); }
function validateDate(value: unknown) { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE"); return value; }

async function assertOpenPeriod(tx: any, date: string) {
  const [closed] = await tx.select({ id: accountingPeriodsTable.id }).from(accountingPeriodsTable)
    .where(and(lte(accountingPeriodsTable.startDate, date), gte(accountingPeriodsTable.endDate, date), eq(accountingPeriodsTable.status, "closed"))).limit(1);
  if (closed) throw new Error("ACCOUNTING_PERIOD_CLOSED");
}

async function audit(tx: any, action: string, entityType: string, entityId: number | null, beforeData: unknown, afterData: unknown, actorId?: number) {
  await tx.insert(accountingAuditLogTable).values({
    action, entityType, entityId, beforeData: beforeData == null ? null : JSON.stringify(beforeData),
    afterData: afterData == null ? null : JSON.stringify(afterData), actorId: actorId ?? null,
  });
}

router.get("/accounting/accounts", async (_req,res) => {
  await db.transaction(tx => ensureDefaultAccounts(tx));
  res.json(await db.select().from(accountsTable).orderBy(accountsTable.code));
});

router.post("/accounting/accounts", async (req,res) => {
  const { code, name, type, parentId } = req.body;
  if (!/^\d{3,8}$/.test(String(code ?? "")) || !name || !["asset","liability","equity","revenue","expense"].includes(type)) { res.status(400).json({error:"Valid code, name and account type are required"}); return; }
  const [row] = await db.insert(accountsTable).values({code:String(code),name:String(name),type,parentId:parentId ? Number(parentId) : null}).returning();
  res.status(201).json(row);
});

router.get("/accounting/journals", async (req,res) => {
  const { from, to, status } = req.query as Record<string,string>;
  const conditions:any[]=[];
  if(from) conditions.push(gte(journalEntriesTable.entryDate, from));
  if(to) conditions.push(lte(journalEntriesTable.entryDate, to));
  if(status) conditions.push(eq(journalEntriesTable.status,status as any));
  const rows=await db.select().from(journalEntriesTable).where(conditions.length?and(...conditions):undefined).orderBy(desc(journalEntriesTable.entryDate),desc(journalEntriesTable.id));
  const result=await Promise.all(rows.map(async e=>({entry:e,lines:await db.select().from(journalLinesTable).where(eq(journalLinesTable.journalEntryId,e.id))})));
  res.json(result);
});

router.post("/accounting/journals", async (req,res) => {
  const { entryDate, description, lines, source="manual" }=req.body;
  try{
    const date=validateDate(entryDate);
    if(!description || !Array.isArray(lines) || lines.length<2) throw new Error("INVALID_JOURNAL");
    const parsed=lines.map((l:any)=>({accountId:Number(l.accountId),description:l.description,debit:Number(l.debit??0),credit:Number(l.credit??0),taxCode:l.taxCode??null}));
    if(parsed.some(l=>!Number.isInteger(l.accountId)||l.debit<0||l.credit<0||(l.debit>0&&l.credit>0)||(l.debit===0&&l.credit===0))) throw new Error("INVALID_JOURNAL");
    const debit=parsed.reduce((s,l)=>s+l.debit,0), credit=parsed.reduce((s,l)=>s+l.credit,0);
    if(Math.abs(debit-credit)>0.005 || debit===0) throw new Error("JOURNAL_NOT_BALANCED");
    const result=await db.transaction(async tx=>{
      await assertOpenPeriod(tx,date);
      const [entry]=await tx.insert(journalEntriesTable).values({entryDate:date,description:String(description),source:String(source),createdBy:(req as any).session?.staffId??null}).returning();
      await tx.insert(journalLinesTable).values(parsed.map(l=>({...l,journalEntryId:entry.id,debit:amount(l.debit),credit:amount(l.credit)})));
      await audit(tx,"create","journal_entry",entry.id,null,{entry,lines:parsed},(req as any).session?.staffId);
      return entry;
    });
    res.status(201).json(result);
  }catch(e){const m=e instanceof Error?e.message:"";const map:any={ACCOUNTING_PERIOD_CLOSED:[409,"Accounting period is closed"],JOURNAL_NOT_BALANCED:[400,"Journal entry must balance debits and credits"],INVALID_JOURNAL:[400,"At least two valid debit/credit lines are required"],INVALID_DATE:[400,"Invalid accounting date"]};if(map[m]){res.status(map[m][0]).json({error:map[m][1]});return;}throw e;}
});

router.post("/accounting/post-sale/:id", async(req,res)=>{
  try{const id=await db.transaction(tx=>postSaleTx(tx,Number(req.params.id),(req as any).session?.staffId));res.status(201).json({journalEntryId:id});}
  catch(e){res.status(400).json({error:e instanceof Error?e.message:"Unable to post sale"});}
});
router.post("/accounting/post-expense/:id", async(req,res)=>{
  try{const id=await db.transaction(tx=>postExpenseTx(tx,Number(req.params.id),(req as any).session?.staffId));res.status(201).json({journalEntryId:id});}
  catch(e){res.status(400).json({error:e instanceof Error?e.message:"Unable to post expense"});}
});

router.post("/accounting/journals/:id/reverse", async(req,res)=>{
  try{
    const id=Number(req.params.id);
    const result=await db.transaction(async tx=>{
      const [original]=await tx.select().from(journalEntriesTable).where(eq(journalEntriesTable.id,id));
      if(!original || original.status!=="posted") throw new Error("JOURNAL_NOT_POSTED");
      await assertOpenPeriod(tx, new Date().toISOString().slice(0,10));
      const lines=await tx.select().from(journalLinesTable).where(eq(journalLinesTable.journalEntryId,id));
      const [reversal]=await tx.insert(journalEntriesTable).values({
        entryDate:new Date().toISOString().slice(0,10),description:`Reversal of #${id}`,
        referenceType:original.referenceType,referenceId:original.referenceId,status:"posted",reversalOfId:id,source:"reversal",createdBy:(req as any).session?.staffId??null,
      }).returning();
      await tx.insert(journalLinesTable).values(lines.map(l=>({journalEntryId:reversal.id,accountId:l.accountId,counterpartyId:l.counterpartyId,description:`Reversal of #${id}`,debit:l.credit,credit:l.debit,taxCode:l.taxCode})));
      await tx.update(journalEntriesTable).set({status:"reversed"}).where(eq(journalEntriesTable.id,id));
      await audit(tx,"reverse","journal_entry",id,original,reversal,(req as any).session?.staffId);
      return reversal;
    });
    res.status(201).json(result);
  }catch(e){res.status(409).json({error:e instanceof Error?e.message:"Unable to reverse journal"});}
});

router.get("/accounting/trial-balance", async(req,res)=>{
  const {from,to}=req.query as Record<string,string>;
  const rows=await db.execute(sql`
    SELECT a.id,a.code,a.name,a.type,COALESCE(SUM(jl.debit),0) debit,COALESCE(SUM(jl.credit),0) credit
    FROM accounts a LEFT JOIN journal_lines jl ON jl.account_id=a.id
    LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id AND je.status='posted'
    WHERE (je.id IS NULL OR (je.entry_date >= COALESCE(${from??null}::date,'1900-01-01') AND je.entry_date <= COALESCE(${to??null}::date,'2999-12-31')))
    GROUP BY a.id ORDER BY a.code
  `);
  const accounts=(rows.rows as any[]).map(r=>({...r,debit:Number(r.debit),credit:Number(r.credit),balance:Number(r.debit)-Number(r.credit)}));
  res.json({accounts,totalDebit:accounts.reduce((s,r)=>s+r.debit,0),totalCredit:accounts.reduce((s,r)=>s+r.credit,0)});
});

router.get("/accounting/profit-loss", async(req,res)=>{
  const {from,to}=req.query as Record<string,string>;
  const rows=await db.execute(sql`
    SELECT a.code,a.name,a.type,COALESCE(SUM(jl.credit-jl.debit),0) amount
    FROM accounts a JOIN journal_lines jl ON jl.account_id=a.id JOIN journal_entries je ON je.id=jl.journal_entry_id
    WHERE je.status='posted' AND a.type IN ('revenue','expense')
      AND je.entry_date >= COALESCE(${from??null}::date,'1900-01-01') AND je.entry_date <= COALESCE(${to??null}::date,'2999-12-31')
    GROUP BY a.id ORDER BY a.code
  `);
  const revenue=(rows.rows as any[]).filter(r=>r.type==="revenue").map(r=>({...r,amount:Number(r.amount)}));
  const expenses=(rows.rows as any[]).filter(r=>r.type==="expense").map(r=>({...r,amount:-Number(r.amount)}));
  res.json({revenue,expenses,totalRevenue:revenue.reduce((s,r)=>s+r.amount,0),totalExpenses:expenses.reduce((s,r)=>s+r.amount,0),netProfit:revenue.reduce((s,r)=>s+r.amount,0)+expenses.reduce((s,r)=>s+r.amount,0)});
});

router.get("/accounting/balance-sheet", async(req,res)=>{
  const {to}=req.query as Record<string,string>;
  const rows=await db.execute(sql`
    SELECT a.code,a.name,a.type,COALESCE(SUM(jl.debit-jl.credit),0) balance
    FROM accounts a JOIN journal_lines jl ON jl.account_id=a.id JOIN journal_entries je ON je.id=jl.journal_entry_id
    WHERE je.status='posted' AND a.type IN ('asset','liability','equity')
      AND je.entry_date <= COALESCE(${to??null}::date,'2999-12-31')
    GROUP BY a.id ORDER BY a.code
  `);
  res.json((rows.rows as any[]).map(r=>({...r,balance:Number(r.balance)})));
});

router.get("/accounting/tax-codes", async(_req,res)=>{
  await db.transaction(tx=>ensureDefaultAccounts(tx));
  res.json(await db.select().from(taxCodesTable).orderBy(taxCodesTable.code));
});

router.post("/accounting/tax-codes", async(req,res)=>{
  const {code,name,rate,outputAccountId,inputAccountId}=req.body;
  if(!code||!name||rate==null||Number(rate)<0){res.status(400).json({error:"Valid tax code, name and rate are required"});return;}
  const [row]=await db.insert(taxCodesTable).values({code,name,rate:String(rate),outputAccountId:outputAccountId?Number(outputAccountId):null,inputAccountId:inputAccountId?Number(inputAccountId):null}).returning();
  res.status(201).json(row);
});

router.post("/accounting/periods", async(req,res)=>{
  const {name,startDate,endDate}=req.body;
  if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||startDate>endDate){res.status(400).json({error:"Valid period dates are required"});return;}
  const [row]=await db.insert(accountingPeriodsTable).values({name,startDate,endDate}).returning();res.status(201).json(row);
});
router.get("/accounting/periods",async(_req,res)=>res.json(await db.select().from(accountingPeriodsTable).orderBy(desc(accountingPeriodsTable.startDate))));
router.post("/accounting/periods/:id/close",async(req,res)=>{
  const id=Number(req.params.id);
  const result=await db.transaction(async tx=>{
    const [period]=await tx.select().from(accountingPeriodsTable).where(eq(accountingPeriodsTable.id,id));
    if(!period||period.status==="closed") throw new Error("PERIOD_ALREADY_CLOSED");
    const [unbalanced]=await tx.execute(sql`SELECT je.id FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id WHERE je.entry_date BETWEEN ${period.startDate} AND ${period.endDate} AND je.status='posted' GROUP BY je.id HAVING ABS(SUM(jl.debit)-SUM(jl.credit)) > 0.005 LIMIT 1`);
    if(unbalanced) throw new Error("UNBALANCED_ENTRY");
    const [closed]=await tx.update(accountingPeriodsTable).set({status:"closed",closedAt:new Date(),closedBy:(req as any).session?.staffId??null}).where(eq(accountingPeriodsTable.id,id)).returning();
    await audit(tx,"close","accounting_period",id,period,closed,(req as any).session?.staffId);
    return closed;
  });
  res.json(result);
});

router.post("/accounting/bank-accounts",async(req,res)=>{
  const {name,accountId,currency="AED"}=req.body;if(!name||!accountId){res.status(400).json({error:"name and accountId required"});return;}
  const [row]=await db.insert(bankAccountsTable).values({name,accountId:Number(accountId),currency}).returning();res.status(201).json(row);
});
router.get("/accounting/bank-accounts",async(_req,res)=>res.json(await db.select().from(bankAccountsTable)));
router.post("/accounting/bank-transactions",async(req,res)=>{
  const {bankAccountId,transactionDate,description,amount:rawAmount,reference}=req.body;
  try{const [row]=await db.insert(bankTransactionsTable).values({bankAccountId:Number(bankAccountId),transactionDate:validateDate(transactionDate),description,amount:amount(rawAmount),reference}).returning();res.status(201).json(row);}
  catch(e){res.status(400).json({error:e instanceof Error?e.message:"Invalid bank transaction"});}
});
router.get("/accounting/bank-transactions",async(req,res)=>{
  const {bankAccountId,status}=req.query as Record<string,string>;const conditions:any[]=[];
  if(bankAccountId)conditions.push(eq(bankTransactionsTable.bankAccountId,Number(bankAccountId)));if(status)conditions.push(eq(bankTransactionsTable.reconciliationStatus,status as any));
  res.json(await db.select().from(bankTransactionsTable).where(conditions.length?and(...conditions):undefined).orderBy(desc(bankTransactionsTable.transactionDate)));
});
router.post("/accounting/bank-transactions/:id/reconcile",async(req,res)=>{
  const id=Number(req.params.id), journalLineId=Number(req.body.journalLineId);
  const [line]=await db.select().from(journalLinesTable).where(eq(journalLinesTable.id,journalLineId));
  if(!line){res.status(404).json({error:"Journal line not found"});return;}
  const [row]=await db.update(bankTransactionsTable).set({reconciliationStatus:"reconciled",matchedJournalLineId:journalLineId}).where(eq(bankTransactionsTable.id,id)).returning();
  if(!row){res.status(404).json({error:"Bank transaction not found"});return;}res.json(row);
});

router.post("/accounting/counterparties",async(req,res)=>{
  const {type,name,clientId}=req.body;if(!["customer","vendor","other"].includes(type)||!name){res.status(400).json({error:"type and name required"});return;}
  const [row]=await db.insert(counterpartiesTable).values({type,name,clientId:clientId?Number(clientId):null}).returning();res.status(201).json(row);
});
router.post("/accounting/payment-allocations",async(req,res)=>{
  const {counterpartyId,journalLineId,allocatedAmount}=req.body;
  const [row]=await db.insert(paymentAllocationsTable).values({counterpartyId:Number(counterpartyId),journalLineId:Number(journalLineId),allocatedAmount:amount(allocatedAmount)}).returning();
  res.status(201).json(row);
});

export default router;
