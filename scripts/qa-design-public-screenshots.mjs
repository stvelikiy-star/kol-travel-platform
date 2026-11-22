/**
 * Disposable mock-mode visual evidence only; no sessions, mutations or production calls.
 * The demo catalog/banner/dated mock fixtures deliberately stay unchanged.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.KOL_PLAYWRIGHT_MODULE || 'playwright');

if (process.env.DATA_SOURCE_MODE !== 'mock' ||
    process.env.KOL_DEPLOYMENT_ENV === 'production' ||
    process.env.ALCOHOL_MODULE_ENABLED !== 'false') {
  throw new Error('Public screenshots require explicitly isolated mock environment');
}
const routes = [
  ['home','/'],['stays','/stays'],
  ['stay-detail','/stays/guest-house-bosteri-ui'],
  ['tour-detail','/tours/boat-trip-cholpon-ata'],
  ['delivery','/delivery'],['cart','/cart'],['checkout','/checkout'],
  ['contacts','/contacts'],['partners','/partners'],['transfer','/transfer'],['login','/login']
];
const sizes=[['desktop',1440,900],['mobile',390,844]];
const directory='visual-artifacts/kol-next-public';
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true});
const records=[];
try{
 for (const [name,route] of routes){
  for(const [profile,width,height] of sizes) {
   const page=await browser.newPage({viewport:{width,height},locale:'ru-RU'});
   const pageErrors=[];
   page.on('pageerror',(e)=>pageErrors.push(String(e).slice(0,180)));
   let result={name,route,profile,width,status:0,overflow:null,h1:null,
     error:null,shot:directory+'/'+profile+'--'+name+'.png'};
   try{
    const response=await page.goto('http://127.0.0.1:3100'+route,
       {waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(350);
    const metrics=await page.evaluate(()=>{
      const vw=document.documentElement.clientWidth;
      const sw=Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0);
      return {sw,vw,h1:document.querySelector('h1')?.textContent?.trim()?.slice(0,110),
        accessibleTitle:document.querySelector('h1')?.getAttribute('aria-label')};
    });
    result={...result,status:response?.status()||0,overflow:metrics.sw>metrics.vw+2,
      scrollWidth:metrics.sw,h1:metrics.h1,accessibleTitle:metrics.accessibleTitle};
    await page.screenshot({path:result.shot,fullPage:true,animations:'disabled',timeout:60000});
   }catch(e){result.error=String(e).slice(0,340)}
   result.pageErrors=pageErrors;
   records.push(result);
   console.log('KOL_PUBLIC_CAPTURE',name,profile,result.status,
     result.overflow?'OVERFLOW':(result.error||'PASS'));
   await page.close();
  }
 }
}catch(e){console.error('KOL_PUBLIC_CAPTURE_FATAL',String(e))}
finally{
 await browser.close();
 writeFileSync(directory+'/qa-results.json',JSON.stringify(records,null,2)+'\n');
}
if(records.length !== routes.length*sizes.length ||
    records.some(x=>x.status!==200||x.overflow||x.error)) {
  process.exitCode=1;
}else{
 console.log('KOL_PUBLIC_CAPTURE_PASS: 22 screenshots on 1440 and 390; mock labels retained');
}
