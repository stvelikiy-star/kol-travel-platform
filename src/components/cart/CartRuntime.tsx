"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProductStatus } from "@/types";

export type CartItem = {
  id: string;
  itemType: "food" | "product";
  businessId: string;
  title: string;
  partnerName: string;
  quantity: number;
  price: number;
  currency: "KGS";
  status: ProductStatus;
};

type AddCartItem = Omit<CartItem, "quantity"> & { quantity?: number };

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  hydrated: boolean;
  addItem: (item: AddCartItem) => void;
  setQuantity: (id: string, itemType: CartItem["itemType"], quantity: number) => void;
  removeItem: (id: string, itemType: CartItem["itemType"]) => void;
  clear: () => void;
};

const STORAGE_KEY = "kol-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return Boolean(
    typeof item.id === "string" &&
    (item.itemType === "food" || item.itemType === "product") &&
    typeof item.businessId === "string" &&
    typeof item.title === "string" &&
    typeof item.partnerName === "string" &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    typeof item.price === "number" &&
    item.price >= 0 &&
    item.currency === "KGS" &&
    typeof item.status === "string"
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed.filter(isCartItem));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    hydrated,
    addItem(item) {
      const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
      setItems((current) => {
        const index = current.findIndex((existing) => existing.id === item.id && existing.itemType === item.itemType);
        if (index === -1) return [...current, { ...item, quantity }];
        return current.map((existing, existingIndex) => existingIndex === index ? { ...existing, quantity: existing.quantity + quantity, status: item.status } : existing);
      });
    },
    setQuantity(id, itemType, quantity) {
      const safeQuantity = Math.max(1, Math.floor(quantity));
      setItems((current) => current.map((item) => item.id === id && item.itemType === itemType ? { ...item, quantity: safeQuantity } : item));
    },
    removeItem(id, itemType) {
      setItems((current) => current.filter((item) => !(item.id === id && item.itemType === itemType)));
    },
    clear() {
      setItems([]);
    }
  }), [hydrated, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
