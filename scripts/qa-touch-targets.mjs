import fs from "node:fs";
import { chromium } from "./playwright-qa.mjs";

const base="http://127.0.0.1:3100";
const routes=["/","/checkout","/booking/checkout","/partners","/admin","/owner","/partner","/courier"];
const widths=[320,375,390,430,1440];
const locales=["ru","ky","en"];
const issues=[];
const report=[];
const browser=await chromium.launch({headless:true});
async function checkTargets(frame,where){
  const bad=await frame.evaluate(()=>{
    const selector="button,a[href],input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,summary,[role=button]";
    return Array.from(document.querySelectorAll(selector)).flatMap(el=>{
      const style=getComputedStyle(el),r=el.getBoundingClientRect();
      if(style.visibility==="hidden"||style.display==="none"||r.width===0||r.height===0||
         r.right<=0||r.left>=innerWidth||r.bottom<=0||r.top>=innerHeight||
         el.closest('[aria-hidden="true"]')||el.hasAttribute("disabled"))return [];
      if(r.width>=44&&r.height>=44)return [];
      return [{tag:el.tagName,name:el.getAttribute("aria-label")??el.textContent?.trim().slice(0,35),
        w:Math.round(r.width),h:Math.round(r.height)}];
    });
  });
  if(bad.length)issues.push({where,bad:bad.slice(0,20)});
}
try{
  for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:844}});
    for(const lang of locales){
      for(const route of routes){
        // 375/430 are supplemental touch regressions; full locales/routes on 320/390/1440.
        if([375,430].includes(width)&&!["/","/checkout","/booking/checkout"].includes(route))continue;
        const page=await context.newPage();
        try{
          const res=await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:20000});
          if(!res||res.status()>=500)throw new Error(`HTTP ${res?.status()}`);
          const option=page.locator(`[data-language-option="${lang}"]:visible`).first();
          await option.waitFor({state:"visible",timeout:10000});
          await option.click();
          await page.waitForFunction(want=>document.documentElement.lang===want,lang,{timeout:5000});
          await checkTargets(page,`${width}/${lang}/${route}`);
          if(route==="/"){
            const stage=page.frameLocator('iframe[src="/kol-stage/scene.html"]');
            if(await stage.locator("body").count())await checkTargets(stage,`${width}/${lang}/stage`);
          }
          report.push({width,lang,route,status:"PASS"});
        }catch(error){
          issues.push({width,lang,route,error:String(error)});
        }finally{await page.close()}
      }
    }
    await context.close();
  }
}finally{await browser.close()}
fs.mkdirSync("visual-artifacts",{recursive:true});
fs.writeFileSync("visual-artifacts/touch-targets.json",JSON.stringify({report,issues},null,2));
if(issues.length){
  console.error("TOUCH_TARGETS_FAIL: "+issues.length+" route/locale/target issues");
  for(const issue of issues.slice(0,35))console.error(JSON.stringify(issue));
  process.exitCode=1;
}else console.log(`TOUCH_TARGETS_PASS: ${report.length} route/locale/viewport checks, min 44x44`);
