/* Three-language text for the isolated approved KÖL animation.
 * The visual movement, imagery and link targets are unchanged.
 */
(function () {
  "use strict";
  var stage = window.KOLStage;
  var season = window.KOL_SEASON;
  if (!stage || !season || !season.scenes) return;
  var originals = JSON.parse(JSON.stringify(season.scenes));
  var translated = {
    ky: [
      {label:"Турак жай",short:"Мейманканалар",lines:["Ысык-Көл жээгинде","ойгонуңуз"],lead:"Кышкы Ысык-Көл жээгиндеги мейманканалар, конок үйлөр жана коттедждер. Күндөрдү жана коноктордун санын тандап, өтүнмө калтырыңыз.",link:"Күндөр боюнча издөө",cta:"Турак жай тандоо",steps:["Келүү күндөрү","Коноктордун саны","Өнөктөшкө өтүнмө"]},
      {label:"Турлар",short:"Турлар",lines:["Жээктен да","көбүрөөк","ачылыштар"],lead:"Көл жана тоолор боюнча маршруттар. Күндү жана катышуучулардын санын тандап, өтүнмө калтырыңыз.",link:"Күн боюнча издөө",cta:"Турларды көрүү",steps:["Маршрут","Күнү","Катышуучулар"]},
      {label:"Жеткирүү",short:"Жеткирүү",lines:["Даамдуу эс алуу.","Баары жакын."],lead:"Тамак-аш жана товарлар дарегиңизге жеткирилет: ресторандар, дүкөндөр, сувенирлер. Категорияны жана даректи тандаңыз.",link:"Даректи көрсөтүү",cta:"Жеткирүү бөлүмү",steps:["Жеткирүү дареги","Категория","Өнөктөшкө өтүнмө"]},
      {label:"Трансфер",short:"Трансфер",lines:["Эс алууңуз","жолдон","башталат"],lead:"Такси жана тосуп алуу: аэропорт, жээктеги шаарлар, мейманканалар. Маршрут менен күндү көрсөтүңүз.",link:"Маршрутту көрсөтүү",cta:"Трансфер тандоо",steps:["Кайдан жана кайда","Күнү","Жүргүнчүлөр"]}
    ],
    en: [
      {label:"Stays",short:"Hotels",lines:["Wake up","by Issyk-Kul"],lead:"Hotels, guesthouses and cottages on the wintry lakeshore. Select dates and guests and send an enquiry.",link:"Search by dates",cta:"Explore stays",steps:["Check-in dates","Number of guests","Partner enquiry"]},
      {label:"Tours",short:"Tours",lines:["Discover","more than","the shore"],lead:"Mountain and lakeside tours. Choose a date and group size, then send an enquiry.",link:"Search by date",cta:"Explore tours",steps:["Route","Date","Participants"]},
      {label:"Delivery",short:"Delivery",lines:["Delicious trips.","Everything nearby."],lead:"Food and goods delivered to you: restaurants, shops and souvenirs. Select a category and enter an address.",link:"Enter address",cta:"Explore delivery",steps:["Delivery address","Category","Partner enquiry"]},
      {label:"Transfers",short:"Transfers",lines:["Your journey","starts","on the road"],lead:"Taxis and pickups from airports, lakeside towns and hotels. Enter a route and date.",link:"Enter route",cta:"Explore transfers",steps:["From and to","Date","Passengers"]}
    ]
  };
  var staticOriginals = [
    ["#stage-panel .glass-h","Что указать"],
    [".stage-demo","КӨЛ — проживание, туры, доставка и трансфер."],
    [".thumb[data-i=\"0\"] .thumb-lbl","Отели"],
    [".thumb[data-i=\"1\"] .thumb-lbl","Туры"],
    [".thumb[data-i=\"2\"] .thumb-lbl","Доставка"],
    [".thumb[data-i=\"3\"] .thumb-lbl","Трансфер"]
  ];
  var staticTexts = {
    ky:["Эмнени көрсөтүү керек","КӨЛ — турак жай, турлар, жеткирүү жана трансфер.","Мейманканалар","Турлар","Жеткирүү","Трансфер"],
    en:["What to enter","KÖL — stays, tours, delivery and transfers.","Hotels","Tours","Delivery","Transfers"]
  };
  function safeText(text) { return String(text).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]}); }
  function render() {
    var idx=stage.state.index;
    var s=season.scenes[idx];
    var title=document.getElementById("stage-title");
    if (!title || !s) return;
    title.innerHTML=s.lines.map(function(t,i){return '<span class="ln" style="--l:'+i+'"><span>'+safeText(t)+'</span></span>'}).join("");
    var set=function(id,text){var el=document.getElementById(id);if(el)el.textContent=text};
    set("sk-lbl",s.label);set("stage-lead",s.lead);set("stage-cta-t",s.cta);
    var link=document.querySelector(".stage-link");if(link)link.textContent=s.link;
    var list=document.getElementById("glass-list");
    if(list){var spans=list.querySelectorAll("li span");if(spans.length===s.steps.length)for(var i=0;i<spans.length;i++)spans[i].textContent=s.steps[i][1]}
  }
  function setLocale(locale) {
    if (locale!=="ky" && locale!=="en") locale="ru";
    document.documentElement.lang=locale;
    originals.forEach(function(original,i){
      var localized=locale==="ru" ? null : translated[locale][i];
      Object.keys(original).forEach(function(k){season.scenes[i][k]=original[k]});
      if(localized){Object.keys(localized).forEach(function(k){
        if(k==="steps")season.scenes[i].steps=original.steps.map(function(step,j){return [step[0],localized.steps[j]]});
        else season.scenes[i][k]=localized[k];
      })}
    });
    staticOriginals.forEach(function(pair,i){var node=document.querySelector(pair[0]);if(node)node.textContent=locale==="ru"?pair[1]:staticTexts[locale][i]});
    if(!stage.state.running)render();
  }
  window.addEventListener("message",function(event){
    if(event.origin!==window.location.origin || event.source!==window.parent) return;
    if(!event.data || event.data.type!=="kol-locale")return;
    setLocale(event.data.locale);
  });
  setLocale("ru");
})();
