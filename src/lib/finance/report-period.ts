import type {FinancePeriod} from "@/lib/finance/analytics";

// Month boundaries are local to Kyrgyzstan; the end date is exclusive.
export function currentBishkekFinanceMonth(now:Date=new Date()):FinancePeriod{
  const fields=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Bishkek",year:"numeric",month:"2-digit"
  }).formatToParts(now);
  const year=Number(fields.find(v=>v.type==="year")?.value);
  const month=Number(fields.find(v=>v.type==="month")?.value);
  if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12)
    throw new Error("Invalid report period");
  const pad=(v:number)=>String(v).padStart(2,"0");
  return {
    from:year+"-"+pad(month)+"-01",
    toExclusive:month===12?(year+1)+"-01-01":year+"-"+pad(month+1)+"-01"
  };
}

export function selectBishkekFinanceMonth(month:unknown):FinancePeriod {
  if(typeof month!=="string"||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return currentBishkekFinanceMonth();
  const year=Number(month.slice(0,4)),m=Number(month.slice(5));
  if(year<2000||year>2100)return currentBishkekFinanceMonth();
  return {from:month+"-01",toExclusive:m===12?(year+1)+"-01-01":year+"-"+String(m+1).padStart(2,"0")+"-01"};
}
