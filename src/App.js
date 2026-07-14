import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Search, Phone, Clock, X, Minus, CreditCard, Banknote,
  FileCheck2, MoreHorizontal, CheckCircle2, ArrowLeft, Trash2,
  Pencil, ChevronRight, Calendar as CalendarIcon, Settings,
  ListChecks, Users, History, Coffee, Beer, Wine, GlassWater,
  IceCream, Utensils, Sparkles, Martini, CupSoda, Baby, AlertTriangle,
} from "lucide-react";

/* ============================================================
   CAMP'ARDOISE — Gestionnaire indépendant de notes de bar
   Stockage: localStorage
   ============================================================ */

// ---------- Argent : tout en centimes ----------
const toCents = (euros) => Math.round(euros * 100);
const fromCents = (cents) => cents / 100;
const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const money = (cents) => fmt.format(fromCents(cents));

// ---------- IDs ----------
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ---------- Icônes par catégorie ----------
const CATEGORY_ICONS = {
  favorites: Sparkles,
  cocktails: Martini,
  beers: Beer,
  wines: Wine,
  spirits: Sparkles,
  softs: CupSoda,
};
const iconFor = (categoryId) => CATEGORY_ICONS[categoryId] || Coffee;

// ---------- Recherche floue ----------
const normalizeSearch = (str) =>
  str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const fuzzyMatch = (haystack, needle) => {
  const n = normalizeSearch(needle).trim();
  if (!n) return true;
  return normalizeSearch(haystack).includes(n);
};

// ============================================================
// SEED DATA
// ============================================================
const SEED = {
  categories: [
    { id: "favorites", name: "Favorite 🌟", displayOrder: 0 },
    { id: "cocktails", name: "Cocktails 🍹", displayOrder: 1 },
    { id: "beers", name: "Bières 🍺", displayOrder: 2 },
    { id: "wines", name: "Vins 🍷", displayOrder: 3 },
    { id: "spirits", name: "Apéritifs & Spiritueux 🥃", displayOrder: 4 },
    { id: "softs", name: "Boissons Soft & Eaux 🥤", displayOrder: 5 },
  ],
  options: [
    { id: "opt_sirop", name: "Sirop", additionalPrice: 0.5 },
    { id: "opt_picon", name: "Picon", additionalPrice: 1.0 },
  ],
  products: [
    { id: "fav-mojito", categoryId: "favorites", name: "Mojito (selon arrivage)", priceCents: 800, allowOptions: false },
    { id: "fav-heineken-pinte", categoryId: "favorites", name: "Heineken (Pinte 50cl)", priceCents: 700, allowOptions: true },
    { id: "fav-ricard", categoryId: "favorites", name: "Ricard 45", priceCents: 400, allowOptions: false },
    { id: "fav-limonade", categoryId: "favorites", name: "Limonade", priceCents: 250, allowOptions: true },
    { id: "c-spritz", categoryId: "cocktails", name: "Spritz", priceCents: 800, allowOptions: false },
    { id: "c-bloody", categoryId: "cocktails", name: "Bloody Mary", priceCents: 800, allowOptions: false },
    { id: "c-mojito", categoryId: "cocktails", name: "Mojito (selon arrivage)", priceCents: 800, allowOptions: false },
    { id: "b-heineken-demi", categoryId: "beers", name: "Heineken (Demi 25cl)", priceCents: 350, allowOptions: true },
    { id: "b-heineken-pinte", categoryId: "beers", name: "Heineken (Pinte 50cl)", priceCents: 700, allowOptions: true },
    { id: "b-affligem-demi", categoryId: "beers", name: "Affligem (Demi 25cl)", priceCents: 400, allowOptions: true },
    { id: "v-verre", categoryId: "wines", name: "Verre de vin", priceCents: 300, allowOptions: false },
    { id: "s-ricard", categoryId: "spirits", name: "Ricard 45", priceCents: 400, allowOptions: false },
    { id: "so-limonade", categoryId: "softs", name: "Limonade", priceCents: 250, allowOptions: true },
  ].map((p) => ({ ...p, imageUrl: null, price: fromCents(p.priceCents) })),
  clientNotes: [],
};

// ============================================================
// STOCKAGE
// ============================================================
const STORAGE_PREFIX = "campardoise::bar::";
const SESSION_KEY = "campardoise::session";

function loadBarState(barPassword) {
  const raw = localStorage.getItem(STORAGE_PREFIX + barPassword);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveBarState(barPassword, state) {
  localStorage.setItem(STORAGE_PREFIX + barPassword, JSON.stringify(state));
}
function barExists(barPassword) {
  return localStorage.getItem(STORAGE_PREFIX + barPassword) !== null;
}

// ============================================================
// HOOK PRINCIPAL - Version simplifiée sans référence circulaire
// ============================================================
function useBarState(barPassword) {
  const [state, setState] = useState(() => {
    if (!barPassword) return null;
    return loadBarState(barPassword);
  });

  // Recharger quand le mot de passe change
  useEffect(() => {
    if (!barPassword) {
      setState(null);
      return;
    }
    setState(loadBarState(barPassword));
  }, [barPassword]);

  // Synchronisation entre onglets
  useEffect(() => {
    if (!barPassword) return;
    const key = STORAGE_PREFIX + barPassword;
    const onStorage = (e) => {
      if (e.key === key && e.newValue) {
        try {
          setState(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [barPassword]);

  const update = useCallback((updater) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (barPassword) saveBarState(barPassword, next);
      return next;
    });
  }, [barPassword]);

  return [state, update];
}

// ============================================================
// ÉCRAN D'ACCUEIL
// ============================================================
function AuthScreen({ onEnter }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    const pwd = password.trim();
    if (!pwd) return setError("Merci de saisir un mot de passe.");
    if (barExists(pwd)) {
      setError("Cet espace existe déjà. Rejoignez-le.");
      return;
    }
    saveBarState(pwd, SEED);
    onEnter(pwd);
  };

  const handleJoin = () => {
    const pwd = password.trim();
    if (!pwd) return setError("Merci de saisir le mot de passe.");
    if (!barExists(pwd)) {
      setError("Aucun espace avec ce mot de passe. Créez-le d'abord.");
      return;
    }
    onEnter(pwd);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-600 mb-4">
            <Wine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Camp'Ardoise</h1>
          <p className="text-slate-400 mt-1 text-sm">Le carnet de notes du bar</p>
        </div>

        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Mot de passe
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Ex: chesnaie2026"
            className="w-full h-14 px-4 rounded-2xl bg-slate-800 text-white border border-slate-700 focus:border-indigo-500 focus:outline-none"
            autoFocus
          />
          {error && (
            <div className="mt-3 flex items-start gap-2 text-amber-400 text-sm bg-amber-950/40 border border-amber-900 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={handleCreate}
              className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
            >
              Créer un espace Bar
            </button>
            <button
              onClick={handleJoin}
              className="w-full h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700"
            >
              Rejoindre un Bar existant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPOSANTS PARTAGÉS
// ============================================================
function TopBar({ title, onBack, right }) {
  return (
    <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
      )}
      <h1 className="text-lg font-bold text-white truncate flex-1">{title}</h1>
      {right}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

// ============================================================
// ONGLET 1 — NOTES CLIENTS
// ============================================================
function ClientNotesTab({ bar, updateBar, onOpenClient }) {
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);

  const activeNotes = (bar.clientNotes || []).filter((n) => n.status === "active");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeNotes;
    return activeNotes.filter(n => n.name.toLowerCase().includes(q));
  }, [activeNotes, search]);

  const sorted = [...filtered].sort((a, b) => {
    const aLast = a.orders.length ? a.orders[a.orders.length - 1].timestamp : a.createdAt;
    const bLast = b.orders.length ? b.orders[b.orders.length - 1].timestamp : b.createdAt;
    return new Date(bLast) - new Date(aLast);
  });

  const createNote = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newNote = {
      id: uid("note"),
      name: trimmed,
      status: "active",
      createdAt: new Date().toISOString(),
      closedAt: null,
      paymentMethod: null,
      orders: [],
      totalAmountCents: 0,
    };
    updateBar((prev) => ({ ...prev, clientNotes: [...(prev.clientNotes || []), newNote] }));
    setShowNewModal(false);
  };

  return (
    <div className="pb-28">
      <TopBar title="Ardoises actives" right={
        <span className="text-xs font-semibold text-indigo-300 bg-indigo-950/60 px-3 py-1.5 rounded-full">
          {activeNotes.length} ouverte{activeNotes.length !== 1 ? "s" : ""}
        </span>
      }/>

      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-900 text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-4 mt-16 text-center">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucune ardoise ouverte</p>
        </div>
      ) : (
        <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((note) => (
            <button
              key={note.id}
              onClick={() => onOpenClient(note.id)}
              className="text-left bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:bg-slate-800 transition"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-white text-lg">{note.name}</h3>
                <ChevronRight className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
              </div>
              <div className={`mt-4 text-3xl font-extrabold ${note.totalAmountCents > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                {money(note.totalAmountCents)}
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-2">
                <Clock className="w-3 h-3" />
                {timeAgo(note.orders.length ? note.orders[note.orders.length - 1].timestamp : note.createdAt)}
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowNewModal(true)}
        className="fixed bottom-24 right-5 w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center z-30"
      >
        <Plus className="w-8 h-8 text-white" />
      </button>

      {showNewModal && (
        <Modal onClose={() => setShowNewModal(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Nouvelle ardoise</h2>
              <button onClick={() => setShowNewModal(false)} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom du client"
              className="w-full h-14 px-4 rounded-2xl bg-slate-800 text-white border border-slate-700 focus:border-indigo-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && createNote(search)}
            />
            <button
              onClick={() => createNote(search)}
              disabled={!search.trim()}
              className="w-full h-14 mt-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold"
            >
              Ouvrir l'ardoise
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// ÉCRAN DE COMMANDE
// ============================================================
function OrderScreen({ bar, updateBar, noteId, onBack }) {
  const note = (bar.clientNotes || []).find((n) => n.id === noteId);
  const categories = [...(bar.categories || [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const [activeCat, setActiveCat] = useState(categories[0]?.id || null);
  const [cart, setCart] = useState({});
  const [productSearch, setProductSearch] = useState("");

  if (!note) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Cette ardoise n'existe plus.</p>
        <button onClick={onBack} className="mt-4 text-indigo-400 font-semibold">Retour</button>
      </div>
    );
  }

  const searchActive = productSearch.trim().length > 0;
  const products = searchActive
    ? (bar.products || []).filter((p) => fuzzyMatch(p.name, productSearch))
    : (bar.products || []).filter((p) => p.categoryId === activeCat);

  const cartEntries = Object.values(cart);
  const cartCount = cartEntries.reduce((s, e) => s + e.qty, 0);
  const cartTotalCents = cartEntries.reduce((s, e) => {
    const product = bar.products.find((p) => p.id === e.productId);
    return s + (product?.priceCents || 0) * e.qty;
  }, 0);

  const addToCart = (productId) => {
    setCart((prev) => {
      const key = productId;
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          productId,
          qty: (existing?.qty || 0) + 1,
        },
      };
    });
  };

  const adjustCartQty = (key, delta) => {
    setCart((prev) => {
      const item = prev[key];
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { ...item, qty: newQty } };
    });
  };

  const validateOrder = () => {
    if (cartEntries.length === 0) return;
    const items = cartEntries.map((e) => {
      const product = bar.products.find((p) => p.id === e.productId);
      return {
        productId: e.productId,
        productName: product?.name || "Produit",
        quantity: e.qty,
        priceAtPurchase: fromCents(product?.priceCents || 0),
        priceAtPurchaseCents: product?.priceCents || 0,
      };
    });
    const orderTotal = items.reduce((s, it) => s + it.priceAtPurchaseCents * it.quantity, 0);

    updateBar((prev) => ({
      ...prev,
      clientNotes: prev.clientNotes.map((n) =>
        n.id === noteId ? {
          ...n,
          orders: [...n.orders, { orderId: uid("ord"), timestamp: new Date().toISOString(), items }],
          totalAmountCents: n.totalAmountCents + orderTotal,
        } : n
      ),
    }));
    setCart({});
    onBack();
  };

  return (
    <div className="pb-40">
      <TopBar title={note.name} onBack={onBack} />

      <div className="sticky top-[68px] z-20 bg-slate-950 px-4 pt-3 pb-2 border-b border-slate-900">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Rechercher un article..."
            className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-900 text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between">
          <span className="text-slate-400 text-sm font-medium">Note actuelle</span>
          <span className="text-emerald-400 font-bold text-lg">{money(note.totalAmountCents)}</span>
        </div>
      </div>

      {!searchActive && (
        <div className="mt-3 px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`shrink-0 flex items-center gap-2 h-12 px-4 rounded-2xl font-semibold text-sm whitespace-nowrap transition ${
                  cat.id === activeCat ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((product) => {
          const qty = cartEntries.filter(e => e.productId === product.id).reduce((s, e) => s + e.qty, 0);
          return (
            <button
              key={product.id}
              onClick={() => addToCart(product.id)}
              className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-slate-800 transition"
            >
              {qty > 0 && (
                <span className="absolute -top-2 -right-2 min-w-7 h-7 px-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  x{qty}
                </span>
              )}
              <div className="flex-1">
                <div className="text-white font-semibold text-sm">{product.name}</div>
                <div className="text-slate-400 text-sm font-medium mt-0.5">{money(product.priceCents)}</div>
              </div>
            </button>
          );
        })}
      </div>

      {cartCount > 0 && (
        <div className="fixed left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl" style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}>
          <div className="px-5 pt-3 pb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-300 font-semibold text-sm">Panier — {cartCount} article{cartCount !== 1 ? "s" : ""}</span>
              <span className="text-emerald-400 font-bold">{money(cartTotalCents)}</span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {cartEntries.map((e) => {
                const product = bar.products.find((p) => p.id === e.productId);
                const key = e.productId;
                return (
                  <div key={key} className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2">
                    <div className="text-white text-sm font-semibold">{product?.name}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => adjustCartQty(key, -1)} className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                        <Minus className="w-4 h-4 text-white" />
                      </button>
                      <span className="text-white font-bold w-6 text-center">{e.qty}</span>
                      <button onClick={() => adjustCartQty(key, 1)} className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={validateOrder}
              className="w-full h-16 mt-3 rounded-3xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xl flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-7 h-7" />
              Ajouter — {money(cartTotalCents)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FICHE CLIENT DÉTAILLÉE
// ============================================================
function ClientDetailScreen({ bar, updateBar, noteId, onBack, onOrder }) {
  const note = (bar.clientNotes || []).find((n) => n.id === noteId);
  const [showCloseModal, setShowCloseModal] = useState(false);

  if (!note) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Cette ardoise n'existe plus.</p>
        <button onClick={onBack} className="mt-4 text-indigo-400 font-semibold">Retour</button>
      </div>
    );
  }

  const closeNote = (paymentMethod) => {
    updateBar((prev) => ({
      ...prev,
      clientNotes: prev.clientNotes.map((n) =>
        n.id === noteId ? {
          ...n,
          status: "paye",
          closedAt: new Date().toISOString(),
          paymentMethod,
        } : n
      ),
    }));
    setShowCloseModal(false);
    onBack();
  };

  return (
    <div className="pb-10">
      <TopBar title={note.name} onBack={onBack} />

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center">
          <p className="text-slate-400 text-sm font-medium mb-1">Total de l'ardoise</p>
          <p className="text-5xl font-extrabold text-emerald-400">{money(note.totalAmountCents)}</p>
        </div>

        <button
          onClick={() => onOrder(note.id)}
          className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Ajouter des articles
        </button>

        <button
          onClick={() => setShowCloseModal(true)}
          disabled={note.totalAmountCents === 0}
          className="w-full h-16 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-2"
        >
          <FileCheck2 className="w-5 h-5" />
          Clôturer
        </button>

        <div className="mt-6">
          <h3 className="text-slate-400 font-semibold text-sm mb-2">Historique</h3>
          {note.orders.length === 0 ? (
            <p className="text-slate-600 text-sm">Aucun article ajouté.</p>
          ) : (
            <div className="space-y-2">
              {[...note.orders].reverse().map((order) => (
                <div key={order.orderId} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-slate-500 text-xs font-medium mb-2">
                    {new Date(order.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <ul className="space-y-1">
                    {order.items.map((it, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{it.quantity}x {it.productName}</span>
                        <span className="text-slate-400 font-medium">{money(it.priceAtPurchaseCents * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCloseModal && (
        <Modal onClose={() => setShowCloseModal(false)}>
          <div className="p-6">
            <h2 className="text-white font-bold text-lg mb-4">Clôturer l'ardoise</h2>
            <p className="text-4xl font-extrabold text-emerald-400 mb-6">{money(note.totalAmountCents)}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => closeNote("Espèces")} className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold">
                <Banknote className="w-5 h-5 mx-auto mb-1" /> Espèces
              </button>
              <button onClick={() => closeNote("Carte Bancaire")} className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold">
                <CreditCard className="w-5 h-5 mx-auto mb-1" /> Carte
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// ONGLET 2 — ADMIN
// ============================================================
function AdminTab({ bar, updateBar }) {
  const categories = [...(bar.categories || [])].sort((a, b) => a.displayOrder - b.displayOrder);

  const deleteProduct = (id) => {
    updateBar((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
  };

  return (
    <div className="pb-28">
      <TopBar title="La Carte" />

      <div className="px-4 mt-4">
        <div className="space-y-2">
          {categories.map((cat) => {
            const prods = bar.products.filter((p) => p.categoryId === cat.id);
            if (prods.length === 0) return null;
            return (
              <div key={cat.id} className="mb-4">
                <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wide px-1 mb-2">{cat.name}</h4>
                <div className="space-y-2">
                  {prods.map((p) => (
                    <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-white font-semibold text-sm">{p.name}</div>
                        <div className="text-slate-500 text-xs">{money(p.priceCents)}</div>
                      </div>
                      <button onClick={() => deleteProduct(p.id)} className="w-10 h-10 rounded-xl bg-rose-950/60 flex items-center justify-center">
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ONGLET 3 — HISTORIQUE
// ============================================================
function HistoryTab({ bar }) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const closedNotes = (bar.clientNotes || []).filter(n => 
    n.status === "paye" && n.closedAt && 
    new Date(n.closedAt).toDateString() === selectedDate.toDateString()
  );
  const totalCents = closedNotes.reduce((s, n) => s + n.totalAmountCents, 0);

  return (
    <div className="pb-28">
      <TopBar title="Historique" />

      <div className="px-4 pt-3">
        <label className="flex items-center gap-2 h-12 px-4 rounded-2xl bg-slate-900 border border-slate-800">
          <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="date"
            value={new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().split("T")[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value + "T12:00:00"))}
            className="bg-transparent text-white text-sm flex-1 focus:outline-none"
          />
        </label>
      </div>

      <div className="px-4 mt-5">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <p className="text-slate-400 text-sm font-medium mb-1">Chiffre d'affaires</p>
          <p className="text-4xl font-extrabold text-emerald-400">{money(totalCents)}</p>
          <div className="flex items-center gap-2 text-slate-500 text-sm mt-2">
            <ListChecks className="w-4 h-4" />
            {closedNotes.length} note{closedNotes.length !== 1 ? "s" : ""} soldée{closedNotes.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NAVIGATION
// ============================================================
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "notes", label: "Ardoises", icon: Users },
    { id: "admin", label: "La Carte", icon: Settings },
    { id: "history", label: "Historique", icon: History },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex px-2 pb-[env(safe-area-inset-bottom)]">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5"
        >
          <div className={`w-12 h-9 rounded-2xl flex items-center justify-center transition ${tab === id ? "bg-indigo-600" : ""}`}>
            <Icon className={`w-5 h-5 ${tab === id ? "text-white" : "text-slate-500"}`} />
          </div>
          <span className={`text-xs font-semibold ${tab === id ? "text-indigo-300" : "text-slate-600"}`}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
export default function CampArdoise() {
  const [barPassword, setBarPassword] = useState(() => localStorage.getItem(SESSION_KEY) || null);
  const [bar, updateBar] = useBarState(barPassword);
  const [tab, setTab] = useState("notes");
  const [view, setView] = useState({ screen: "list" });

  const enterBar = (pwd) => {
    localStorage.setItem(SESSION_KEY, pwd);
    setBarPassword(pwd);
  };

  if (!barPassword || !bar) {
    return <AuthScreen onEnter={enterBar} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {tab === "notes" && view.screen === "list" && (
        <ClientNotesTab bar={bar} updateBar={updateBar} onOpenClient={(id) => setView({ screen: "detail", noteId: id })} />
      )}
      {tab === "notes" && view.screen === "detail" && (
        <ClientDetailScreen
          bar={bar}
          updateBar={updateBar}
          noteId={view.noteId}
          onBack={() => setView({ screen: "list" })}
          onOrder={(id) => setView({ screen: "order", noteId: id })}
        />
      )}
      {tab === "notes" && view.screen === "order" && (
        <OrderScreen
          bar={bar}
          updateBar={updateBar}
          noteId={view.noteId}
          onBack={() => setView({ screen: "detail", noteId: view.noteId })}
        />
      )}
      {tab === "admin" && <AdminTab bar={bar} updateBar={updateBar} />}
      {tab === "history" && <HistoryTab bar={bar} />}

      <BottomNav
        tab={tab}
        setTab={(t) => {
          setTab(t);
          setView({ screen: "list" });
        }}
      />
    </div>
  );
}
