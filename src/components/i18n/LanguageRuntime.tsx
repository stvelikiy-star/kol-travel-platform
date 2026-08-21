"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EN_TO_RU, RU_TO_KY, type KolLocale } from "@/components/i18n/translations";

const textOriginals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "PRE", "CODE"]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceDictionary(value: string, dictionary: Record<string, string>) {
  const entries = Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length);
  return entries.reduce((result, [from, to]) => {
    if (from.includes(" ") || from.length > 11 || /[—.,:;!?/]/u.test(from)) {
      return result.split(from).join(to);
    }
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(from)}(?![\\p{L}\\p{N}_])`, "gu");
    return result.replace(pattern, to);
  }, value);
}

function translated(value: string, locale: KolLocale) {
  const russian = replaceDictionary(value, EN_TO_RU);
  return locale === "ky" ? replaceDictionary(russian, RU_TO_KY) : russian;
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

function translateTextNode(node: Text, locale: KolLocale) {
  const parent = node.parentElement;
  if (!parent || ignoredTags.has(parent.tagName)) return;
  const original = textOriginals.get(node) ?? node.nodeValue ?? "";
  if (!textOriginals.has(node)) textOriginals.set(node, original);
  const next = translated(original, locale);
  if (node.nodeValue !== next) node.nodeValue = next;
}

function initialLocale(): KolLocale {
  if (typeof window === "undefined") return "ru";
  return window.localStorage.getItem("kol-locale") === "ky" ? "ky" : "ru";
}

export function LanguageRuntime() {
  const [locale, setLocale] = useState<KolLocale>(initialLocale);
  const applying = useRef(false);

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
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div className="fixed bottom-3 left-1/2 z-[100] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-white/30 bg-slate-950/95 p-1.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:gap-2 sm:p-2">
      <div className="flex shrink-0 rounded-xl bg-white/10 p-1" aria-label="Язык / Тил">
        <button className={`rounded-lg px-3 py-2 text-xs font-bold transition ${locale === "ru" ? "bg-white text-slate-950" : "text-white/80 hover:bg-white/10"}`} onClick={() => setLocale("ru")} type="button">RU</button>
        <button className={`rounded-lg px-3 py-2 text-xs font-bold transition ${locale === "ky" ? "bg-cyan-300 text-slate-950" : "text-white/80 hover:bg-white/10"}`} onClick={() => setLocale("ky")} type="button">KG</button>
      </div>
      <div className="h-7 w-px shrink-0 bg-white/20" />
      <RoleLink href="/" label="Главная" />
      <RoleLink href="/owner" label="Собственник" />
      <RoleLink href="/partner" label="Партнёр" />
      <RoleLink href="/courier" label="Курьер" />
      <RoleLink href="/admin" label="Администратор" />
      <RoleLink href="/client" label="Клиент" />
    </div>
  );
}

function RoleLink({ href, label }: { href: string; label: string }) {
  return <Link className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white" href={href}>{label}</Link>;
}
