"use client";

import { ADMIN_EXACT_EN, ADMIN_EXACT_KY } from "@/components/i18n/translations-admin-reviewed";
import { QA_REVIEWED_RU, QA_REVIEWED_EN, QA_REVIEWED_KY } from "@/components/i18n/translations-reviewed-qa-residual";

import { useEffect, useRef, useState } from "react";
import { HOME_EN, HOME_KY, PAGE_HERO_TRANSLATIONS } from "@/components/i18n/translations-home";
import { REVIEWED_RU, REVIEWED_EN, REVIEWED_KY } from "@/components/i18n/translations-coverage";
import { AI_ADMIN_EN, AI_ADMIN_KY } from "@/components/i18n/translations-ai-admin";
import { ACCOUNT_SECURITY_EN, ACCOUNT_SECURITY_KY } from "@/components/i18n/translations-account-security";
import { CATALOG_EN, CATALOG_KY } from "@/components/i18n/translations-public-catalog";
import { FORMS_EN, FORMS_KY } from "@/components/i18n/translations-forms";
import { RU_TO_KY_CLIENT } from "@/components/i18n/translations-client-ky";
import { RU_TO_KY_TEAM_PREVIEW } from "@/components/i18n/translations-team-preview-ky";
import { EN_TO_RU, RU_TO_KY, type KolLocale } from "@/components/i18n/translations";
import { RU_TO_KY_PRESENTATION } from "@/components/i18n/translations-presentation";
import { EN_TO_RU_FINAL } from "@/components/i18n/translations-final-en";
import { RU_TO_KY_FINAL } from "@/components/i18n/translations-final-ky";
import { RU_TO_KY_AUDIT } from "@/components/i18n/translations-final-audit";
import { RU_TO_KY_POLISH } from "@/components/i18n/translations-final-polish";
import { EN_TO_RU_INTERFACE_1 } from "@/components/i18n/translations-interface-en-1";
import { EN_TO_RU_INTERFACE_2 } from "@/components/i18n/translations-interface-en-2";
import { EN_TO_RU_INTERFACE_3 } from "@/components/i18n/translations-interface-en-3";
import { RU_TO_KY_INTERFACE_1 } from "@/components/i18n/translations-interface-ky-1";
import { RU_TO_KY_INTERFACE_2 } from "@/components/i18n/translations-interface-ky-2";
import { RU_TO_KY_INTERFACE_3 } from "@/components/i18n/translations-interface-ky-3";

const RU_TO_EN_EXISTING = Object.fromEntries(
  Object.entries({
    ...EN_TO_RU,
    ...EN_TO_RU_FINAL,
    ...EN_TO_RU_INTERFACE_1,
    ...EN_TO_RU_INTERFACE_2,
    ...EN_TO_RU_INTERFACE_3
  }).map(([english, russian]) => [russian, english])
) as Record<string, string>;

const textOriginals = new WeakMap<Text, string>();
const lastAppliedText = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const lastAppliedAttrs = new WeakMap<Element, Map<string, string>>();
const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "PRE", "CODE"]);
// Cache patterns once: rebuilding 2,000 sorted replacements for every DOM text
// node made the language buttons feel unresponsive on long partner/admin pages.
const compiledDictionaryPatterns = new WeakMap<Record<string, string>, RegExp>();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceDictionary(value: string, dictionary: Record<string, string>) {
  const direct = dictionary[value];
  if (direct !== undefined) return direct;
  let pattern = compiledDictionaryPatterns.get(dictionary);
  if (!pattern) {
    const keys = Object.keys(dictionary).filter(Boolean)
      .sort((a, b) => b.length - a.length);
    // Unicode word boundaries prevent "Order" replacing a fragment inside
    // another word. A single pass cannot translate its own replacement again.
    pattern = new RegExp(
      "(?<![\\p{L}\\p{N}_])(?:" +
      keys.map(escapeRegExp).join("|") +
      ")(?![\\p{L}\\p{N}_])", "gu"
    );
    compiledDictionaryPatterns.set(dictionary, pattern);
  }
  return value.replace(pattern, (found) => dictionary[found] ?? found);
}

function translated(value: string, locale: KolLocale) {
  // Reviewed exact residual messages must not be fragmented by legacy dictionaries.
  if (locale === "ru" && QA_REVIEWED_RU[value] !== undefined) return QA_REVIEWED_RU[value];
  if (locale === "en" && QA_REVIEWED_EN[value] !== undefined) return QA_REVIEWED_EN[value];
  if (locale === "ky" && QA_REVIEWED_KY[value] !== undefined) return QA_REVIEWED_KY[value];
  // Complete, reviewed messages are authoritative: never pass a translated
  // sentence through fragment dictionaries that can corrupt individual words.
  if (locale === "en" && ADMIN_EXACT_EN[value] !== undefined) return ADMIN_EXACT_EN[value];
  if (locale === "ky" && ADMIN_EXACT_KY[value] !== undefined) return ADMIN_EXACT_KY[value];
  // Treat every reviewed sentence as a unit before the legacy fragment maps.
  if (locale === "ru" && REVIEWED_RU[value] !== undefined) return REVIEWED_RU[value];
  if (locale === "en" && ACCOUNT_SECURITY_EN[value] !== undefined) return ACCOUNT_SECURITY_EN[value];
  if (locale === "ky" && ACCOUNT_SECURITY_KY[value] !== undefined) return ACCOUNT_SECURITY_KY[value];
  if (locale === "en" && AI_ADMIN_EN[value] !== undefined) return AI_ADMIN_EN[value];
  if (locale === "ky" && AI_ADMIN_KY[value] !== undefined) return AI_ADMIN_KY[value];
  if (locale === "en" && REVIEWED_EN[value] !== undefined) return REVIEWED_EN[value];
  if (locale === "ky" && REVIEWED_KY[value] !== undefined) return REVIEWED_KY[value];
  const interfaceRu1 = replaceDictionary(value, EN_TO_RU_INTERFACE_1);
  const interfaceRu2 = replaceDictionary(interfaceRu1, EN_TO_RU_INTERFACE_2);
  const interfaceRu3 = replaceDictionary(interfaceRu2, EN_TO_RU_INTERFACE_3);
  const russian = replaceDictionary(replaceDictionary(interfaceRu3, EN_TO_RU_FINAL), EN_TO_RU);
  if (locale === "en") {
    const english = replaceDictionary(replaceDictionary(replaceDictionary(
      replaceDictionary(russian, FORMS_EN), CATALOG_EN), HOME_EN), RU_TO_EN_EXISTING);
    const translatedExisting=replaceDictionary(replaceDictionary(replaceDictionary(english, REVIEWED_EN), AI_ADMIN_EN), ACCOUNT_SECURITY_EN);
    return replaceDictionary(translatedExisting, QA_REVIEWED_EN);
  }
  if (locale !== "ky") return russian;
  const exact = HOME_KY[russian] ?? CATALOG_KY[russian] ?? FORMS_KY[russian];
  if (exact) return exact;
  const client = replaceDictionary(russian, RU_TO_KY_CLIENT);
  const teamPreview = replaceDictionary(client, RU_TO_KY_TEAM_PREVIEW);
  const presentation = replaceDictionary(teamPreview, RU_TO_KY_PRESENTATION);
  const interfaceKy1 = replaceDictionary(presentation, RU_TO_KY_INTERFACE_1);
  const interfaceKy2 = replaceDictionary(interfaceKy1, RU_TO_KY_INTERFACE_2);
  const interfaceKy3 = replaceDictionary(interfaceKy2, RU_TO_KY_INTERFACE_3);
  const finalPhrases = replaceDictionary(interfaceKy3, RU_TO_KY_FINAL);
  const audited = replaceDictionary(finalPhrases, RU_TO_KY_AUDIT);
  const polished = replaceDictionary(audited, RU_TO_KY_POLISH);
  const kyrgyz = replaceDictionary(replaceDictionary(replaceDictionary(
    replaceDictionary(polished, FORMS_KY), CATALOG_KY), HOME_KY), RU_TO_KY);
  const translatedExisting=replaceDictionary(replaceDictionary(replaceDictionary(kyrgyz, REVIEWED_KY), AI_ADMIN_KY), ACCOUNT_SECURITY_KY);
  return replaceDictionary(translatedExisting, QA_REVIEWED_KY);
}

/** Keep animated two-line PageHero headings as one translatable phrase. */
function translatePageHeroTitles(root: Node, locale: KolLocale) {
  const headings: Element[] = [];
  if (root instanceof Element && root.matches("[data-kol-pagehero-original]")) headings.push(root);
  if (root instanceof Document || root instanceof DocumentFragment || root instanceof Element) {
    headings.push(...Array.from(root.querySelectorAll("[data-kol-pagehero-original]")));
  }
  for (const heading of headings) {
    const original = heading.getAttribute("data-kol-pagehero-original");
    if (!original) continue;
    const translatedTitle = locale === "ru" ? null : PAGE_HERO_TRANSLATIONS[original]?.[locale];
    const top = heading.querySelector("[data-kol-pagehero-top]");
    const accent = heading.querySelector("[data-kol-pagehero-accent]");
    if (!top || !accent) continue;
    if (translatedTitle) {
      top.textContent = translatedTitle.top;
      accent.textContent = translatedTitle.accent;
      heading.setAttribute("aria-label", `${translatedTitle.top} ${translatedTitle.accent}`);
    } else if (locale === "ru") {
      // Original values are kept separately on the two span nodes.
      const originalTop = heading.getAttribute("data-kol-pagehero-ru-top");
      const originalAccent = heading.getAttribute("data-kol-pagehero-ru-accent");
      if (originalTop && originalAccent) {
        top.textContent = originalTop;
        accent.textContent = originalAccent;
      }
      heading.setAttribute("aria-label", original);
    }
  }
}

function isTranslationIgnored(element: Element | null) {
  return Boolean(element?.closest('[translate="no"],[data-i18n-ignore="true"]'));
}

function translateElementAttributes(element: Element, locale: KolLocale) {
  if (isTranslationIgnored(element)) return;
  const names = ["placeholder", "title", "aria-label", "aria-description", "alt"];
  // The value of a submit button is visible text, unlike user-entered input values.
  if (element instanceof HTMLInputElement && ["submit", "button", "reset"].includes(element.type)) {
    names.push("value");
  }
  let originals = attrOriginals.get(element);
  if (!originals) {
    originals = new Map<string, string>();
    attrOriginals.set(element, originals);
  }
  let applied = lastAppliedAttrs.get(element);
  if (!applied) {
    applied = new Map<string, string>();
    lastAppliedAttrs.set(element, applied);
  }
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value === null) {
      originals.delete(name);
      applied.delete(name);
      continue;
    }
    const previousTranslation = applied.get(name);
    let original = originals.get(name);
    // A React update can replace a label without replacing its DOM element.
    // Rebase only when the new value came from React, not our own translation.
    if (original === undefined || (value !== previousTranslation && value !== original)) {
      original = value;
      originals.set(name, original);
    }
    const next = translated(original, locale);
    applied.set(name, next);
    if (value !== next) element.setAttribute(name, next);
  }
}

function translateTextNode(node: Text, locale: KolLocale) {
  const parent = node.parentElement;
  if (!parent || ignoredTags.has(parent.tagName) || isTranslationIgnored(parent)) return;
  const current = node.nodeValue ?? "";
  const original = textOriginals.get(node) ?? current;
  if (!textOriginals.has(node)) textOriginals.set(node, original);
  // JSX can put spaces around a label next to a number or an inline element.
  // Translate the label as a complete message and keep its original spacing.
  const next = original.replace(/\S(?:[\s\S]*\S)?/, (message) => translated(message, locale));
  if (current !== next) {
    lastAppliedText.set(node, next);
    node.nodeValue = next;
  }
}

function translateTree(root: Node, locale: KolLocale) {
  translatePageHeroTitles(root, locale);
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }
  if (root instanceof Element) translateElementAttributes(root, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    translateTextNode(current as Text, locale);
    current = walker.nextNode();
  }
  if (root instanceof Document || root instanceof DocumentFragment || root instanceof Element) {
    root.querySelectorAll?.("[placeholder],[title],[aria-label],[aria-description],[alt],input[type=submit][value],input[type=button][value],input[type=reset][value]").forEach((element) => translateElementAttributes(element, locale));
  }
}

export function LanguageRuntime() {
  const [locale, setLocale] = useState<KolLocale>("ru");
  const [ready, setReady] = useState(false);
  const applying = useRef(false);
  const originalTitle = useRef<string | null>(null);
  const originalDescription = useRef<string | null>(null);

  useEffect(() => {
    // Restore once after hydration, without prematurely writing RU to storage.
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem("kol-locale");
        if (stored === "ky" || stored === "en") setLocale(stored);
      } catch { /* private browsing may block persistent storage */ }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem("kol-locale", locale); } catch { /* blocked storage */ }
    document.documentElement.lang = locale;
    document.documentElement.dataset.kolLocale = locale;
    // The animated stage can load after the language changes. Repeat once
    // on iframe load, and initialise from saved locale inside stage-i18n.js.
    const stage = document.querySelector<HTMLIFrameElement>('iframe[src="/kol-stage/scene.html"]');
    const notifyStage = () => stage?.contentWindow?.postMessage(
      { type: "kol-locale", locale }, window.location.origin
    );
    stage?.addEventListener("load", notifyStage);
    notifyStage();

    // Next.js may update metadata after client-side navigation. Detect new
    // source metadata, but never mistake our previous translation for source.
    const syncHead = () => {
      const languages: KolLocale[] = ["ru", "ky", "en"];
      const currentTitle = document.title;
      if (originalTitle.current === null ||
          !languages.some((lang) => translated(originalTitle.current!, lang) === currentTitle)) {
        originalTitle.current = currentTitle;
      }
      const nextTitle = translated(originalTitle.current, locale);
      if (currentTitle !== nextTitle) document.title = nextTitle;
      const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (description) {
        const currentDescription = description.content;
        if (originalDescription.current === null ||
            !languages.some((lang) => translated(originalDescription.current!, lang) === currentDescription)) {
          originalDescription.current = currentDescription;
        }
        const nextDescription = translated(originalDescription.current, locale);
        if (currentDescription !== nextDescription) description.content = nextDescription;
      }
    };
    syncHead();
    const headObserver = new MutationObserver(syncHead);
    headObserver.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["content"]
    });

    const apply = (root: Node = document.body) => {
      if (applying.current) return;
      applying.current = true;
      try {
        translateTree(root, locale);
      } finally {
        applying.current = false;
      }
    };

    apply();
    const observer = new MutationObserver((mutations) => {
      if (applying.current) return;
      for (const mutation of mutations) {
        if (mutation.type === "childList") mutation.addedNodes.forEach((node) => apply(node));
        if (mutation.type === "characterData") {
          const node = mutation.target as Text;
          const current = node.nodeValue ?? "";
          if (lastAppliedText.get(node) === current) {
            lastAppliedText.delete(node);
            continue;
          }
          textOriginals.set(node, current);
          apply(node);
        }
        if (mutation.type === "attributes") {
          const element = mutation.target as Element;
          const attribute = mutation.attributeName;
          if (!attribute) continue;
          // Ignore mutation records caused by our own attribute translation.
          if (lastAppliedAttrs.get(element)?.get(attribute) === element.getAttribute(attribute)) continue;
          translateElementAttributes(element, locale);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "aria-description", "alt", "value"]
    });
    return () => {
      observer.disconnect();
      headObserver.disconnect();
      stage?.removeEventListener("load", notifyStage);
    };
  }, [locale, ready]);

  const options: { locale: KolLocale; code: string }[] = [
    { locale: "ru", code: "RU" },
    { locale: "ky", code: "KG" },
    { locale: "en", code: "EN" }
  ];

  const languageLabel = locale === "ky" ? "Тилди тандаңыз" :
    locale === "ru" ? "Выберите язык" : "Choose language";

  return (
    <>
      <div className="fixed bottom-4 left-3 z-100 flex w-fit gap-1 rounded-xl border border-white/30 bg-slate-950/95 p-1 text-white shadow-xl backdrop-blur-xl sm:hidden" aria-label={languageLabel}>
        {options.map((option) => (
          <button
            key={option.locale}
            type="button"
            data-language-option={option.locale}
            aria-pressed={locale === option.locale}
            onClick={() => setLocale(option.locale)}
            className={`min-h-11 min-w-11 rounded-lg px-3 text-xs font-bold transition ${locale === option.locale ? "bg-cyan-300 text-slate-950" : "text-white hover:bg-white/10"}`}
          >{option.code}</button>
        ))}
      </div>
      <div className="fixed bottom-5 right-5 z-100 hidden gap-1 rounded-xl border border-white/30 bg-slate-950/92 p-1 text-white shadow-xl backdrop-blur-xl sm:flex" aria-label={languageLabel}>
        {options.map((option) => (
          <button
            key={option.locale}
            type="button"
            data-language-option={option.locale}
            aria-pressed={locale === option.locale}
            onClick={() => setLocale(option.locale)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${locale === option.locale ? "bg-cyan-300 text-slate-950" : "text-white/80 hover:bg-white/10"}`}
          >{option.code}</button>
        ))}
      </div>
    </>
  );
}
