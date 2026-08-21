"use client";

import { useEffect, useRef, useState } from "react";
import { RU_TO_KY_CLIENT } from "@/components/i18n/translations-client-ky";
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

const textOriginals = new WeakMap<Text, string>();
const lastAppliedText = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "PRE", "CODE"]);
const boundaryCharacters = "\\s.,:;!?()\\[\\]{}\\\"'«»/·—–-";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceDictionary(value: string, dictionary: Record<string, string>) {
  const entries = Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length);
  return entries.reduce((result, [from, to]) => {
    if (from.includes(" ") || from.length > 11 || /[—.,:;!?/]/.test(from)) return result.split(from).join(to);
    const escaped = escapeRegExp(from);
    const pattern = new RegExp(`(^|[${boundaryCharacters}])(${escaped})(?=$|[${boundaryCharacters}])`, "g");
    return result.replace(pattern, (_match, prefix: string) => `${prefix}${to}`);
  }, value);
}

function translated(value: string, locale: KolLocale) {
  const interfaceRu1 = replaceDictionary(value, EN_TO_RU_INTERFACE_1);
  const interfaceRu2 = replaceDictionary(interfaceRu1, EN_TO_RU_INTERFACE_2);
  const interfaceRu3 = replaceDictionary(interfaceRu2, EN_TO_RU_INTERFACE_3);
  const russian = replaceDictionary(replaceDictionary(interfaceRu3, EN_TO_RU_FINAL), EN_TO_RU);
  if (locale !== "ky") return russian;
  const client = replaceDictionary(russian, RU_TO_KY_CLIENT);
  const presentation = replaceDictionary(client, RU_TO_KY_PRESENTATION);
  const interfaceKy1 = replaceDictionary(presentation, RU_TO_KY_INTERFACE_1);
  const interfaceKy2 = replaceDictionary(interfaceKy1, RU_TO_KY_INTERFACE_2);
  const interfaceKy3 = replaceDictionary(interfaceKy2, RU_TO_KY_INTERFACE_3);
  const finalPhrases = replaceDictionary(interfaceKy3, RU_TO_KY_FINAL);
  const audited = replaceDictionary(finalPhrases, RU_TO_KY_AUDIT);
  const polished = replaceDictionary(audited, RU_TO_KY_POLISH);
  return replaceDictionary(polished, RU_TO_KY);
}

function translateElementAttributes(element: Element, locale: KolLocale) {
  const names = ["placeholder", "title", "aria-label"];
  let originals = attrOriginals.get(element);
  if (!originals) {
    originals = new Map<string, string>();
    attrOriginals.set(element, originals);
  }
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value === null) continue;
    const original = originals.get(name) ?? value;
    if (!originals.has(name)) originals.set(name, original);
    element.setAttribute(name, translated(original, locale));
  }
}

function translateTextNode(node: Text, locale: KolLocale) {
  const parent = node.parentElement;
  if (!parent || ignoredTags.has(parent.tagName)) return;
  const current = node.nodeValue ?? "";
  const original = textOriginals.get(node) ?? current;
  if (!textOriginals.has(node)) textOriginals.set(node, original);
  const next = translated(original, locale);
  if (current !== next) {
    lastAppliedText.set(node, next);
    node.nodeValue = next;
  }
}

function translateTree(root: Node, locale: KolLocale) {
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
    root.querySelectorAll?.("[placeholder],[title],[aria-label]").forEach((element) => translateElementAttributes(element, locale));
  }
}

export function LanguageRuntime() {
  const [locale, setLocale] = useState<KolLocale>("ru");
  const applying = useRef(false);

  useEffect(() => {
    if (window.localStorage.getItem("kol-locale") !== "ky") return;
    const frame = window.requestAnimationFrame(() => setLocale("ky"));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kol-locale", locale);
    document.documentElement.lang = locale === "ky" ? "ky" : "ru";

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
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div className="fixed bottom-3 right-3 z-[100] flex rounded-xl border border-white/30 bg-slate-950/92 p-1 text-white shadow-xl backdrop-blur-xl sm:bottom-5 sm:right-5" aria-label="Язык / Тил">
      <button
        className={`rounded-lg px-3 py-2 text-xs font-bold transition ${locale === "ru" ? "bg-white text-slate-950" : "text-white/80 hover:bg-white/10"}`}
        onClick={() => setLocale("ru")}
        type="button"
      >
        RU
      </button>
      <button
        className={`rounded-lg px-3 py-2 text-xs font-bold transition ${locale === "ky" ? "bg-cyan-300 text-slate-950" : "text-white/80 hover:bg-white/10"}`}
        onClick={() => setLocale("ky")}
        type="button"
      >
        KG
      </button>
    </div>
  );
}
