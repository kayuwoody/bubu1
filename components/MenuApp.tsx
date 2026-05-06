'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Branch, CartLine, Product, SelectionConfig, Viewport, XorGroup } from '@/lib/types';

interface Category { id: string; label: string }

// ── Constants ──────────────────────────────────────────────────────────────
const T = {
  primaryColor:   '#F58220',
  secondaryColor: '#F5D77A',
  accentColor:    '#F47B8E',
  bgColor:        '#FFF6E8',
  inkColor:       '#3A2414',
  cornerRadius:   22,
};

const DRINK_CATS = new Set(['coffee', 'non-coffee', 'cold']);

const CAT_SWATCHES: Record<string, string> = {
  coffee:       '#C88A54',
  'non-coffee': '#8CA86A',
  cold:         '#C9A07A',
  food:         '#E3B876',
  combo:        '#D9A977',
};

const DRINK_MODS = {
  size:  { label: 'Size',  required: true,  options: [{ id: 's', label: 'Regular', delta: 0 }, { id: 'm', label: 'Large', delta: 2.00 }] },
  milk:  { label: 'Milk',  required: false, options: [{ id: 'whole', label: 'Whole', delta: 0 }, { id: 'skim', label: 'Skim', delta: 0 }, { id: 'oat', label: 'Oat', delta: 2.00 }, { id: 'almond', label: 'Almond', delta: 2.00 }, { id: 'soy', label: 'Soy', delta: 1.50 }] },
  sugar: { label: 'Sugar', required: false, options: [{ id: 'none', label: 'None', delta: 0 }, { id: 'less', label: 'Less', delta: 0 }, { id: 'std',  label: 'Normal', delta: 0 }, { id: 'extra', label: 'Extra', delta: 0 }] },
  ice:   { label: 'Ice',   options: [{ id: 'none', label: 'No ice' }, { id: 'less', label: 'Less' }, { id: 'std', label: 'Normal' }] },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function isDrink(cat: string) { return DRINK_CATS.has(cat); }
function needsSheet(p: Product) { return isDrink(p.category) || p.selection_config != null; }
function catSwatch(cat: string) { return CAT_SWATCHES[cat] ?? '#C88A54'; }

function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>('mobile');
  useEffect(() => {
    const update = () => setVp(window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop');
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return vp;
}

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = {
  Cart:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.5L20.5 8H6"/></svg>,
  Plus:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Minus: (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...p}><path d="M5 12h14"/></svg>,
  Clock: (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  Pin:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  Bolt:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>,
  Car:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 13l2-6h14l2 6M5 13h14v5H5z"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>,
  Walk:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="13" cy="4" r="2"/><path d="M9 22l3-8 3 3v5M9 14l-3-3 4-5 3 3 3 1"/></svg>,
  X:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>,
};

// ── Illustrations ──────────────────────────────────────────────────────────
function DrinkSVG({ col, size = 72 }: { col: string; size?: number }) {
  const id = col.replace('#', '');
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <defs><clipPath id={`cup-${id}`}><path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z"/></clipPath></defs>
      <ellipse cx="36" cy="63" rx="26" ry="4" fill="rgba(58,36,20,.08)"/>
      <path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z" fill="#fff" stroke="#3A2414" strokeWidth="2.2"/>
      <rect x="16" y="22" width="40" height="10" fill={col} clipPath={`url(#cup-${id})`}/>
      <ellipse cx="36" cy="23" rx="20" ry="3.2" fill={col}/>
      <ellipse cx="36" cy="22" rx="20" ry="3.2" fill="none" stroke="#3A2414" strokeWidth="2.2"/>
      <path d="M56 28 q10 2 10 10 q0 8 -10 10" fill="none" stroke="#3A2414" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M28 12 q3 -4 0 -8 M36 12 q3 -4 0 -8 M44 12 q3 -4 0 -8" fill="none" stroke="#3A2414" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
    </svg>
  );
}

function PastrySVG({ col, size = 72 }: { col: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <ellipse cx="36" cy="60" rx="24" ry="3" fill="rgba(58,36,20,.08)"/>
      <path d="M12 40 q0 -18 24 -18 q24 0 24 18 q0 14 -24 14 q-24 0 -24 -14z" fill={col} stroke="#3A2414" strokeWidth="2.2"/>
      <path d="M20 38 q8 -6 16 -6 q8 0 16 6" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55"/>
      <path d="M22 45 q6 -4 14 -4 q8 0 14 4" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55"/>
      <circle cx="28" cy="34" r="1.6" fill="#3A2414" opacity=".5"/>
      <circle cx="42" cy="36" r="1.6" fill="#3A2414" opacity=".5"/>
    </svg>
  );
}

function ItemThumb({ product, size = 72 }: { product: Product; size?: number }) {
  if (product.image_url) {
    return <img src={product.image_url} alt="" style={{ width: size, height: size, objectFit: 'cover', borderRadius: 10 }}/>;
  }
  const col = catSwatch(product.category);
  return product.category === 'food'
    ? <PastrySVG col={col} size={size}/>
    : <DrinkSVG col={col} size={size}/>;
}

function Sticker({ children, rotate = -6, bg, color }: { children: React.ReactNode; rotate?: number; bg: string; color: string }) {
  return (
    <span style={{ display:'inline-block', transform:`rotate(${rotate}deg)`, background:bg, color, padding:'4px 10px', borderRadius:999, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:12, letterSpacing:'.02em', boxShadow:'2px 2px 0 rgba(58,36,20,.15)', whiteSpace:'nowrap' }}>
      {children}
    </span>
  );
}

// ── Cart ───────────────────────────────────────────────────────────────────
function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const modKey = (mods: Record<string, unknown> | null) => JSON.stringify(mods ?? {});

  const addLine = (id: string, name: string, qty = 1, mods: Record<string, unknown> | null = null, unitPrice: number) => {
    setLines(prev => {
      const key = modKey(mods);
      const idx = prev.findIndex(l => l.id === id && modKey(l.mods) === key);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { lid: Math.random().toString(36).slice(2,9), id, name, qty, mods, unitPrice }];
    });
  };
  const incLine = (lid: string) => setLines(prev => prev.map(l => l.lid === lid ? { ...l, qty: l.qty + 1 } : l));
  const decLine = (lid: string) => setLines(prev => prev.flatMap(l => l.lid === lid ? (l.qty <= 1 ? [] : [{ ...l, qty: l.qty - 1 }]) : [l]));
  const qtyFor  = (id: string) => lines.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
  const incById = (id: string, name: string, unitPrice: number) => {
    const idx = lines.findIndex(l => l.id === id);
    if (idx >= 0) incLine(lines[idx].lid);
    else addLine(id, name, 1, null, unitPrice);
  };
  const decById = (id: string) => { const idx = lines.findIndex(l => l.id === id); if (idx >= 0) decLine(lines[idx].lid); };
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return { lines, addLine, incLine, decLine, qtyFor, incById, decById, count, total };
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header({ onCartClick, cartCount, viewport, branch }: { onCartClick: () => void; cartCount: number; viewport: Viewport; branch: Branch | null }) {
  const compact = viewport === 'mobile';
  return (
    <header style={{ position:'sticky', top:0, zIndex:20, background:T.bgColor, borderBottom:`1px solid ${hex(T.inkColor,.08)}`, padding:compact?'12px 16px':'16px 28px', display:'flex', alignItems:'center', gap:12 }}>
      <img src="/co-logo.png" alt="Coffee Oasis" style={{ height:compact?36:44, width:'auto', objectFit:'contain' }}/>
      {!compact && (
        <div style={{ marginLeft:12, fontFamily:"'Nunito',system-ui", color:T.inkColor, fontSize:13, display:'flex', alignItems:'center', gap:6, opacity:.75 }}>
          <Icon.Pin width="14" height="14"/> {branch?.address ?? ''} · Open till 10pm
        </div>
      )}
      <div style={{ marginLeft:'auto' }}>
        <button onClick={onCartClick} aria-label="Cart" style={{ position:'relative', background:T.inkColor, color:'#fff', border:'none', borderRadius:999, padding:compact?'10px 14px':'12px 18px', display:'flex', alignItems:'center', gap:8, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 6px 0 rgba(58,36,20,.18)' }}>
          <Icon.Cart width="18" height="18"/>
          {!compact && <span>Cart</span>}
          {cartCount > 0 && <span style={{ background:T.primaryColor, color:'#fff', borderRadius:999, padding:'1px 7px', fontSize:12, fontWeight:800, border:'2px solid #fff', position:'absolute', top:-6, right:-6, minWidth:20, textAlign:'center' }}>{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero({ viewport }: { viewport: Viewport }) {
  const compact = viewport === 'mobile';
  return (
    <section style={{ margin:compact?'12px 16px 0':'16px 28px 0', background:`linear-gradient(135deg,${T.primaryColor} 0%,#FF9A3D 100%)`, borderRadius:T.cornerRadius+6, padding:compact?'20px 18px':'28px 32px', display:'flex', alignItems:'center', gap:compact?8:24, color:'#fff', overflow:'hidden', position:'relative', boxShadow:`0 10px 0 ${hex(T.primaryColor,.2)},0 18px 40px ${hex(T.inkColor,.12)}` }}>
      <svg style={{ position:'absolute', inset:0, opacity:.18, pointerEvents:'none' }} aria-hidden>
        <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#fff"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#dots)"/>
      </svg>
      <div style={{ flex:1, position:'relative' }}>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <span style={{ background:'#fff', color:T.primaryColor, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:12, padding:'4px 10px', borderRadius:999, display:'inline-flex', alignItems:'center', gap:4 }}><Icon.Bolt width="12" height="12"/> Ready in ~4 min</span>
        </div>
        <h1 style={{ margin:0, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:compact?30:44, lineHeight:1, letterSpacing:'-.01em', textShadow:'0 2px 0 rgba(58,36,20,.25)' }}>Coffee, sorted.<br/>Skip the line.</h1>
        <p style={{ margin:'10px 0 0', maxWidth:420, fontFamily:"'Nunito',system-ui", fontSize:compact?14:16, opacity:.95, lineHeight:1.4 }}>Order ahead, we'll hand it over at the counter when you pull in.</p>
      </div>
      <div style={{ position:'relative', width:compact?100:160, flexShrink:0 }}>
        <img src="/co-mascot.png" alt="" style={{ width:'100%', height:'auto', display:'block', filter:'drop-shadow(0 8px 0 rgba(58,36,20,.2))', transform:'rotate(-4deg)' }}/>
        <div style={{ position:'absolute', top:-6, right:-4 }}><Sticker bg="#fff" color={T.primaryColor} rotate={10}>Hi there!</Sticker></div>
      </div>
    </section>
  );
}

// ── Pickup Bar ─────────────────────────────────────────────────────────────
function PickupBar({ viewport, pickup, setPickup, branch }: { viewport: Viewport; pickup: string; setPickup: (v: 'counter'|'curbside') => void; branch: Branch | null }) {
  const compact = viewport === 'mobile';
  const opts = [
    { id:'counter',  label:'At counter', Ico:Icon.Walk },
    { id:'curbside', label:'Curbside',   Ico:Icon.Car  },
  ] as const;
  return (
    <div style={{ margin:compact?'12px 16px 0':'16px 28px 0', background:'#fff', border:`1.5px solid ${hex(T.inkColor,.08)}`, borderRadius:T.cornerRadius, padding:compact?10:12, display:'flex', alignItems:'center', gap:10, flexWrap:compact?'wrap':'nowrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', fontFamily:"'Nunito',system-ui", fontWeight:700, fontSize:13, color:T.inkColor, whiteSpace:'nowrap' }}>
        <Icon.Clock width="16" height="16"/> {branch?.name ?? 'Coffee Oasis'} · ~4 min
      </div>
      <div style={{ display:'flex', gap:6, flex:1, minWidth:compact?'100%':0 }}>
        {opts.map(o => {
          const active = pickup === o.id;
          return (
            <button key={o.id} onClick={() => setPickup(o.id)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 12px', borderRadius:T.cornerRadius-6, border:`1.5px solid ${active?T.inkColor:hex(T.inkColor,.1)}`, background:active?T.inkColor:'#fff', color:active?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, cursor:'pointer', transition:'all .15s' }}>
              <o.Ico width="18" height="18"/> {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Category Chips ─────────────────────────────────────────────────────────
function CatBar({ cats, active, setActive, viewport }: { cats: Category[]; active: string; setActive: (id: string) => void; viewport: Viewport }) {
  const compact = viewport === 'mobile';
  return (
    <div style={{ position:'sticky', top:compact?60:76, zIndex:10, background:`linear-gradient(to bottom,${T.bgColor} 70%,transparent)`, padding:compact?'14px 16px 10px':'18px 28px 12px' }}>
      <div className="hide-scroll" style={{ display:'flex', gap:8, overflowX:'auto' }}>
        {cats.map(c => {
          const on = active === c.id;
          return (
            <button key={c.id} onClick={() => setActive(c.id)} style={{ flexShrink:0, padding:'9px 16px', borderRadius:999, border:'none', background:on?T.inkColor:'#fff', color:on?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:on?`0 4px 0 ${hex(T.inkColor,.25)}`:`0 2px 0 ${hex(T.inkColor,.08)}`, transition:'all .12s' }}>{c.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── Item Card ──────────────────────────────────────────────────────────────
function qtyBtn(bg: string, fg: string): React.CSSProperties {
  return { width:30, height:30, borderRadius:'50%', background:bg, color:fg, border:'none', display:'grid', placeItems:'center', cursor:'pointer' };
}

function ItemCard({ product, qty, onAdd, onSub, onCustomize, viewport }: { product: Product; qty: number; onAdd: () => void; onSub: () => void; onCustomize: () => void; viewport: Viewport }) {
  const sheet = needsSheet(product);
  const compact = viewport === 'mobile';
  const col = catSwatch(product.category);
  const soldOut = product.stock_quantity !== null && product.stock_quantity <= 0;
  return (
    <div style={{ background:'#fff', borderRadius:T.cornerRadius, padding:compact?14:16, display:'flex', gap:compact?12:14, alignItems:'center', border:`1.5px solid ${hex(T.inkColor,.06)}`, boxShadow:`0 4px 0 ${hex(T.inkColor,.05)}`, ...(soldOut ? { opacity:.45, pointerEvents:'none' } : {}) }}>
      <div style={{ width:compact?72:84, height:compact?72:84, flexShrink:0, background:`radial-gradient(circle at 50% 55%,${hex(col,.22)},${hex(col,.05)} 65%)`, borderRadius:T.cornerRadius-4, display:'grid', placeItems:'center', overflow:'hidden' }}>
        <ItemThumb product={product} size={compact?64:74}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?17:18, color:T.inkColor, lineHeight:1.1 }}>{product.name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
          <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?16:17, color:T.inkColor }}>RM {product.base_price.toFixed(2)}</div>
          {soldOut && <span style={{ fontFamily:"'Nunito',system-ui", fontWeight:700, fontSize:11, background:hex(T.inkColor,.08), color:T.inkColor, borderRadius:6, padding:'2px 7px' }}>Sold out</span>}
        </div>
      </div>
      {!soldOut && (qty > 0 && !sheet ? (
        <div style={{ display:'flex', alignItems:'center', gap:10, background:T.inkColor, color:'#fff', borderRadius:999, padding:4 }}>
          <button onClick={onSub} style={qtyBtn('#fff', T.inkColor)}><Icon.Minus width="16" height="16"/></button>
          <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, minWidth:16, textAlign:'center' }}>{qty}</span>
          <button onClick={onAdd} style={qtyBtn('#fff', T.inkColor)}><Icon.Plus width="16" height="16"/></button>
        </div>
      ) : sheet ? (
        <button onClick={onCustomize} style={{ position:'relative', width:44, height:44, borderRadius:'50%', border:'none', background:T.primaryColor, color:'#fff', display:'grid', placeItems:'center', cursor:'pointer', boxShadow:`0 4px 0 ${hex(T.primaryColor,.4)}`, flexShrink:0 }}>
          <Icon.Plus width="20" height="20"/>
          {qty > 0 && <span style={{ position:'absolute', top:-4, right:-4, background:T.inkColor, color:'#fff', borderRadius:999, padding:'1px 6px', fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:11, border:'2px solid #fff' }}>{qty}</span>}
        </button>
      ) : (
        <button onClick={onAdd} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:T.primaryColor, color:'#fff', display:'grid', placeItems:'center', cursor:'pointer', boxShadow:`0 4px 0 ${hex(T.primaryColor,.4)}`, flexShrink:0 }}>
          <Icon.Plus width="20" height="20"/>
        </button>
      ))}
    </div>
  );
}

// ── Cart Bar ───────────────────────────────────────────────────────────────
function CartBar({ count, total, onClick, viewport }: { count: number; total: number; onClick: () => void; viewport: Viewport }) {
  if (count === 0) return null;
  const compact = viewport === 'mobile';
  return (
    <div style={{ position:'sticky', bottom:compact?12:20, margin:compact?'0 16px 12px':'0 28px 20px', marginTop:20, zIndex:15 }}>
      <button onClick={onClick} style={{ width:'100%', padding:compact?'14px 18px':'16px 22px', background:T.inkColor, color:'#fff', border:'none', borderRadius:T.cornerRadius, display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?15:16, cursor:'pointer', boxShadow:`0 8px 0 ${hex(T.inkColor,.25)},0 18px 40px ${hex(T.inkColor,.2)}` }}>
        <span style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ background:T.primaryColor, padding:'2px 10px', borderRadius:999, fontSize:14 }}>{count}</span>
          Review order
        </span>
        <span>RM {total.toFixed(2)} →</span>
      </button>
    </div>
  );
}

// ── Customize Sheet ────────────────────────────────────────────────────────
type DrinkSel = { size: string; milk: string; sugar: string; ice: string; notes: string };

function pillStyle(on: boolean): React.CSSProperties {
  return { padding:'8px 14px', borderRadius:999, border:on?`2px solid ${T.inkColor}`:`1.5px solid ${hex(T.inkColor,.12)}`, background:on?T.inkColor:'#fff', color:on?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 };
}

function ComboSection({ cfg, selections, selectedOptionals, onSelect, onToggleOptional }: {
  cfg: SelectionConfig;
  selections: Record<string, string>;
  selectedOptionals: Set<string>;
  onSelect: (groupKey: string, itemId: string, parentGroupKey?: string) => void;
  onToggleOptional: (id: string) => void;
}) {
  const topLevel = cfg.xorGroups.filter((g: XorGroup) => !g.parentProductId);
  const nested   = cfg.xorGroups.filter((g: XorGroup) => !!g.parentProductId);
  const hasOverride = true; // combos always have override in practice; show +RM / Included

  return (
    <>
      {topLevel.map(group => {
        const selectedId = selections[group.uniqueKey];
        const childGroups = nested.filter(ng => ng.parentProductId === selectedId);
        return (
          <div key={group.uniqueKey} style={{ marginTop:14 }}>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8, display:'flex', gap:6, alignItems:'baseline' }}>
              {group.groupName} <span style={{ fontSize:11, color:'#D9402F', fontWeight:800 }}>Required</span>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {group.items.map(item => {
                const on = selectedId === item.id;
                const priceLabel = hasOverride
                  ? (item.priceAdjustment > 0 ? `+RM${item.priceAdjustment.toFixed(2)}` : 'Included')
                  : `RM${item.basePrice.toFixed(2)}`;
                return (
                  <button key={item.id} onClick={() => onSelect(group.uniqueKey, item.id)} style={pillStyle(on)}>
                    {item.name}
                    {!on && <span style={{ opacity:.6, fontWeight:600, fontSize:11 }}>{priceLabel}</span>}
                  </button>
                );
              })}
            </div>
            {/* Nested groups appear below the parent group, only when their parent item is selected */}
            {childGroups.map(ng => (
              <div key={ng.uniqueKey} style={{ marginTop:10, paddingLeft:12, borderLeft:`2px solid ${hex(T.inkColor,.08)}` }}>
                <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, color:T.inkColor, marginBottom:6 }}>{ng.groupName}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {ng.items.map(ni => {
                    const non = selections[ng.uniqueKey] === ni.id;
                    return (
                      <button key={ni.id} onClick={() => onSelect(ng.uniqueKey, ni.id)} style={pillStyle(non)}>
                        {ni.name}
                        {ni.priceAdjustment > 0 && !non && <span style={{ opacity:.6, fontWeight:600, fontSize:11 }}>+RM{ni.priceAdjustment.toFixed(2)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {cfg.optionalItems.length > 0 && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Add-ons</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {cfg.optionalItems.map(opt => {
              const checked = selectedOptionals.has(opt.id);
              return (
                <button key={opt.id} onClick={() => onToggleOptional(opt.id)} style={{ ...pillStyle(checked), outline: checked ? `2px solid ${T.primaryColor}` : 'none' }}>
                  {opt.name}
                  {!checked && opt.priceAdjustment > 0 && <span style={{ opacity:.6, fontWeight:600, fontSize:11 }}>+RM{opt.priceAdjustment.toFixed(2)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function CustomizeSheet({ product, open, onClose, onConfirm }: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (mods: Record<string, unknown>, qty: number, unitPrice: number) => void;
}) {
  const drinkDefaults: DrinkSel = useMemo(() => ({ size:'s', milk:'whole', sugar:'std', ice:'std', notes:'' }), []);
  const [drinkSel, setDrinkSel] = useState<DrinkSel>({ ...drinkDefaults });
  // combo state
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [selectedOptionals, setSelectedOptionals] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState(1);

  const cfg = product?.selection_config ?? null;
  const drink = !!product && isDrink(product.category) && !cfg;

  // derive nested groups once
  const nestedGroups = useMemo(() => cfg?.xorGroups.filter(g => !!g.parentProductId) ?? [], [cfg]);

  const initComboSelections = (c: SelectionConfig) => {
    const init: Record<string, string> = {};
    const nested = c.xorGroups.filter(g => !!g.parentProductId);
    for (const group of c.xorGroups.filter(g => !g.parentProductId)) {
      if (group.items.length > 0) {
        const firstId = group.items[0].id;
        init[group.uniqueKey] = firstId;
        for (const ng of nested.filter(ng => ng.parentProductId === firstId)) {
          if (ng.items.length > 0) init[ng.uniqueKey] = ng.items[0].id;
        }
      }
    }
    return init;
  };

  useEffect(() => {
    if (!open || !product) return;
    setQty(1);
    setNotes('');
    if (drink) {
      setDrinkSel({ ...drinkDefaults });
    } else if (cfg) {
      setSelections(initComboSelections(cfg));
      setSelectedOptionals(new Set());
    }
  }, [open, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (groupKey: string, itemId: string) => {
    setSelections(prev => {
      const prevId = prev[groupKey];
      const next = { ...prev, [groupKey]: itemId };
      // remove stale nested selections for previous choice
      if (prevId) {
        for (const ng of nestedGroups.filter(ng => ng.parentProductId === prevId)) {
          delete next[ng.uniqueKey];
        }
      }
      // auto-select defaults for new choice's nested groups
      for (const ng of nestedGroups.filter(ng => ng.parentProductId === itemId)) {
        if (ng.items.length > 0) next[ng.uniqueKey] = ng.items[0].id;
      }
      return next;
    });
  };

  const toggleOptional = (id: string) =>
    setSelectedOptionals(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  if (!open || !product) return null;

  // price
  const unitPrice = (() => {
    if (drink) {
      return product.base_price
        + (DRINK_MODS.size.options.find(o => o.id === drinkSel.size)?.delta ?? 0)
        + (DRINK_MODS.milk.options.find(o => o.id === drinkSel.milk)?.delta ?? 0);
    }
    if (!cfg) return product.base_price;
    let adj = 0;
    for (const g of cfg.xorGroups) {
      const item = g.items.find(i => i.id === selections[g.uniqueKey]);
      if (item) adj += item.priceAdjustment;
    }
    for (const opt of cfg.optionalItems) {
      if (selectedOptionals.has(opt.id)) adj += opt.priceAdjustment;
    }
    return (product.combo_price_override ?? product.base_price) + adj;
  })();

  const handleConfirm = () => {
    let mods: Record<string, unknown>;
    if (drink) {
      mods = {
        size:  DRINK_MODS.size.options.find(o => o.id === drinkSel.size)?.label,
        milk:  DRINK_MODS.milk.options.find(o => o.id === drinkSel.milk)?.label,
        sugar: DRINK_MODS.sugar.options.find(o => o.id === drinkSel.sugar)?.label,
        ...(product.category === 'cold' ? { ice: DRINK_MODS.ice.options.find(o => o.id === drinkSel.ice)?.label } : {}),
        ...(drinkSel.notes ? { notes: drinkSel.notes } : {}),
      };
    } else if (cfg) {
      const combo_selections: Record<string, { id: string; name: string }> = {};
      for (const g of cfg.xorGroups) {
        const selId = selections[g.uniqueKey];
        if (selId) {
          const item = g.items.find(i => i.id === selId);
          if (item) combo_selections[g.uniqueKey] = { id: selId, name: item.name };
        }
      }
      const sel_opts = cfg.optionalItems.filter(o => selectedOptionals.has(o.id)).map(o => ({ id: o.id, name: o.name }));
      mods = {
        combo_selections,
        ...(sel_opts.length > 0 ? { selected_optionals: sel_opts } : {}),
        ...(notes ? { notes } : {}),
      };
    } else {
      mods = {};
    }
    onConfirm(mods, qty, unitPrice);
  };

  const col = catSwatch(product.category);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(58,36,20,.45)' }}/>
      <div style={{ position:'relative', width:'min(520px,100%)', maxHeight:'92vh', background:T.bgColor, borderTopLeftRadius:28, borderTopRightRadius:28, display:'flex', flexDirection:'column', boxShadow:'0 -10px 40px rgba(58,36,20,.25)', animation:'coSheetIn .25s ease-out' }}>
        <div style={{ padding:'10px 0 0', textAlign:'center' }}><div style={{ width:40, height:4, background:hex(T.inkColor,.2), borderRadius:999, margin:'0 auto' }}/></div>
        <div style={{ padding:'14px 20px 8px', display:'flex', gap:14, alignItems:'center' }}>
          <div style={{ width:70, height:70, borderRadius:18, flexShrink:0, background:`radial-gradient(circle at 50% 55%,${hex(col,.22)},${hex(col,.05)} 65%)`, display:'grid', placeItems:'center', overflow:'hidden' }}>
            <ItemThumb product={product} size={60}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:T.inkColor, lineHeight:1.1 }}>{product.name}</div>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:16, color:T.inkColor, marginTop:4 }}>RM {unitPrice.toFixed(2)}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.inkColor, alignSelf:'flex-start' }}><Icon.X width="22" height="22"/></button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'4px 20px 12px' }}>
          {drink ? (
            <>
              {([['size', DRINK_MODS.size], ['milk', DRINK_MODS.milk], ['sugar', DRINK_MODS.sugar]] as const).map(([key, mod]) => (
                <div key={key} style={{ marginTop:14 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8, display:'flex', gap:6, alignItems:'baseline' }}>
                    {mod.label} {mod.required && <span style={{ fontSize:11, color:'#D9402F', fontWeight:800 }}>Required</span>}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {mod.options.map(o => {
                      const on = drinkSel[key] === o.id;
                      return (
                        <button key={o.id} onClick={() => setDrinkSel(s => ({ ...s, [key]: o.id }))} style={pillStyle(on)}>
                          {o.label}{(o.delta ?? 0) > 0 && !on && <span style={{ opacity:.6, fontWeight:600, fontSize:11 }}>+RM{(o.delta ?? 0).toFixed(2)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {product.category === 'cold' && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Ice</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {DRINK_MODS.ice.options.map(o => {
                      const on = drinkSel.ice === o.id;
                      return <button key={o.id} onClick={() => setDrinkSel(s => ({ ...s, ice: o.id }))} style={pillStyle(on)}>{o.label}</button>;
                    })}
                  </div>
                </div>
              )}
              <div style={{ marginTop:14 }}>
                <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Notes to barista</div>
                <input value={drinkSel.notes} onChange={e => setDrinkSel(s => ({ ...s, notes: e.target.value }))} placeholder="e.g. extra hot, no foam" style={{ width:'100%', padding:'12px 14px', fontFamily:"'Nunito',system-ui", fontSize:14, color:T.inkColor, background:'#fff', border:`1.5px solid ${hex(T.inkColor,.1)}`, borderRadius:T.cornerRadius-8, outline:'none', boxSizing:'border-box' }}/>
              </div>
            </>
          ) : cfg ? (
            <>
              <ComboSection cfg={cfg} selections={selections} selectedOptionals={selectedOptionals} onSelect={handleSelect} onToggleOptional={toggleOptional}/>
              <div style={{ marginTop:14 }}>
                <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Notes</div>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. allergies, special requests" style={{ width:'100%', padding:'12px 14px', fontFamily:"'Nunito',system-ui", fontSize:14, color:T.inkColor, background:'#fff', border:`1.5px solid ${hex(T.inkColor,.1)}`, borderRadius:T.cornerRadius-8, outline:'none', boxSizing:'border-box' }}/>
              </div>
            </>
          ) : null}
        </div>

        <div style={{ padding:'14px 20px 20px', borderTop:`1px solid ${hex(T.inkColor,.08)}`, background:'#fff', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bgColor, borderRadius:999, padding:4 }}>
            <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width:34, height:34, borderRadius:'50%', background:'#fff', color:T.inkColor, border:'none', display:'grid', placeItems:'center', cursor:'pointer' }}><Icon.Minus width="16" height="16"/></button>
            <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, minWidth:18, textAlign:'center', color:T.inkColor }}>{qty}</span>
            <button onClick={() => setQty(q => q+1)} style={{ width:34, height:34, borderRadius:'50%', background:'#fff', color:T.inkColor, border:'none', display:'grid', placeItems:'center', cursor:'pointer' }}><Icon.Plus width="16" height="16"/></button>
          </div>
          <button onClick={handleConfirm} style={{ flex:1, padding:'14px 18px', background:T.primaryColor, color:'#fff', border:'none', borderRadius:T.cornerRadius, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:`0 5px 0 ${hex(T.primaryColor,.4)}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Add to order</span><span>RM {(unitPrice * qty).toFixed(2)}</span>
          </button>
        </div>
      </div>
      <style>{`@keyframes coSheetIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

// ── Loyalty Strip ──────────────────────────────────────────────────────────
function LoyaltyStrip({ viewport }: { viewport: Viewport }) {
  const compact = viewport === 'mobile';
  const goal = 10, current = 7;
  return (
    <section style={{ margin:compact?'12px 16px 0':'16px 28px 0', background:T.inkColor, color:'#fff', borderRadius:T.cornerRadius, padding:compact?14:16, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ background:T.secondaryColor, color:T.inkColor, padding:'3px 10px', borderRadius:999, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>Oasis Stamps</span>
        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, opacity:.85 }}><b>{goal - current}</b> more for a free drink</div>
      </div>
      <div style={{ display:'flex', gap:compact?5:7 }}>
        {Array.from({ length: goal }).map((_, i) => {
          const stamped = i < current;
          return (
            <div key={i} style={{ flex:1, aspectRatio:'1', borderRadius:'50%', border:`1.5px dashed ${stamped?'transparent':'rgba(255,255,255,.3)'}`, background:stamped?(i===goal-1?T.accentColor:T.primaryColor):'transparent', display:'grid', placeItems:'center', transition:'all .3s' }}>
              {stamped
                ? (i===goal-1 ? <span style={{fontSize:compact?14:16}}>★</span> : <svg width="60%" height="60%" viewBox="0 0 24 24" fill="#fff"><ellipse cx="12" cy="12" rx="6" ry="9" transform="rotate(-20 12 12)"/><path d="M8 6 Q13 12 14 18" stroke="#3A2414" strokeWidth="1.3" fill="none" strokeLinecap="round" transform="rotate(-20 12 12)" opacity=".7"/></svg>)
                : <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:11, opacity:.5 }}>{i===goal-1?'★':i+1}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Cart Drawer ────────────────────────────────────────────────────────────
function CartDrawer({ open, onClose, lines, incLine, decLine, total, pickup, branch }: {
  open: boolean; onClose: () => void; lines: CartLine[];
  incLine: (lid: string) => void; decLine: (lid: string) => void;
  total: number; pickup: 'counter'|'curbside'; branch: Branch | null;
}) {
  const router = useRouter();
  if (!open) return null;

  const modSummary = (line: CartLine): string | null => {
    if (!line.mods) return null;
    const m = line.mods;
    const parts: string[] = [];
    if (m.combo_selections && typeof m.combo_selections === 'object') {
      for (const v of Object.values(m.combo_selections as Record<string, { name: string }>)) {
        if (v?.name) parts.push(v.name);
      }
    } else {
      if (m.size && m.size !== 'Regular') parts.push(m.size as string);
      if (m.milk && m.milk !== 'Whole')   parts.push(m.milk as string);
      if (m.sugar && m.sugar !== 'Normal') parts.push((m.sugar as string) + ' sugar');
      if (m.ice)   parts.push(m.ice as string);
    }
    if (Array.isArray(m.selected_optionals)) {
      for (const o of m.selected_optionals as Array<{ name: string }>) {
        if (o?.name) parts.push(`+ ${o.name}`);
      }
    }
    if (m.notes) parts.push(`"${m.notes}"`);
    return parts.filter(Boolean).join(' · ') || null;
  };

  const handlePay = () => {
    try { localStorage.setItem('co_pending', JSON.stringify({ lines, pickup, total })); } catch { /* ignore */ }
    router.push('/checkout');
  };

  const locationLabel = branch?.address ?? '';

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(58,36,20,.4)' }}/>
      <div style={{ position:'relative', width:'min(460px,100%)', height:'100%', background:T.bgColor, display:'flex', flexDirection:'column', boxShadow:'-10px 0 40px rgba(58,36,20,.2)' }}>
        <div style={{ padding:'18px 20px', display:'flex', alignItems:'center', borderBottom:`1px solid ${hex(T.inkColor,.08)}` }}>
          <h2 style={{ margin:0, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:T.inkColor }}>Your order</h2>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', cursor:'pointer', color:T.inkColor }}><Icon.X width="22" height="22"/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:10 }}>
          {lines.map(line => {
            const sum = modSummary(line);
            return (
              <div key={line.lid} style={{ display:'flex', gap:12, alignItems:'center', background:'#fff', padding:12, borderRadius:T.cornerRadius-4, border:`1.5px solid ${hex(T.inkColor,.06)}` }}>
                <div style={{ width:44, height:44, borderRadius:12, background:hex(T.primaryColor,.15), display:'grid', placeItems:'center', flexShrink:0, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:16, color:T.inkColor }}>
                  {line.qty}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, color:T.inkColor, lineHeight:1.2 }}>{line.name}</div>
                  {sum && <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.65), marginTop:2, lineHeight:1.3 }}>{sum}</div>}
                  <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:hex(T.inkColor,.7), marginTop:3 }}>RM {line.unitPrice.toFixed(2)}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bgColor, borderRadius:999, padding:4 }}>
                  <button onClick={() => decLine(line.lid)} style={qtyBtn('#fff', T.inkColor)}><Icon.Minus width="14" height="14"/></button>
                  <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, minWidth:14, textAlign:'center' }}>{line.qty}</span>
                  <button onClick={() => incLine(line.lid)} style={qtyBtn('#fff', T.inkColor)}><Icon.Plus width="14" height="14"/></button>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop:8, padding:14, background:'#fff', borderRadius:T.cornerRadius-4, border:`1.5px dashed ${hex(T.inkColor,.15)}`, display:'flex', alignItems:'center', gap:10, fontFamily:"'Nunito',system-ui", fontSize:14, color:T.inkColor }}>
            {pickup === 'curbside' ? <Icon.Car width="20" height="20"/> : <Icon.Walk width="20" height="20"/>}
            <div>
              <div style={{ fontWeight:700 }}>{pickup === 'curbside' ? 'Curbside pickup' : 'Counter pickup'}</div>
              <div style={{ opacity:.65, fontSize:12 }}>{locationLabel}</div>
            </div>
          </div>
        </div>
        <div style={{ padding:20, borderTop:`1px solid ${hex(T.inkColor,.08)}`, background:'#fff' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:T.inkColor, marginBottom:12 }}>
            <span>Total</span><span>RM {total.toFixed(2)}</span>
          </div>
          <button onClick={handlePay} style={{ width:'100%', padding:'16px', background:T.primaryColor, color:'#fff', border:'none', borderRadius:T.cornerRadius, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:17, cursor:'pointer', boxShadow:`0 6px 0 ${hex(T.primaryColor,.4)}` }}>
            Pay now →
          </button>
          <div style={{ textAlign:'center', marginTop:8, fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.55) }}>
            FPX · GrabPay · Boost · Touch 'n Go
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function SkeletonCard({ viewport }: { viewport: Viewport }) {
  const compact = viewport === 'mobile';
  return (
    <div style={{ background:'#fff', borderRadius:T.cornerRadius, padding:compact?14:16, display:'flex', gap:compact?12:14, alignItems:'center', border:`1.5px solid ${hex(T.inkColor,.06)}` }}>
      <div style={{ width:compact?72:84, height:compact?72:84, flexShrink:0, background:hex(T.inkColor,.06), borderRadius:T.cornerRadius-4 }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ height:18, width:'60%', background:hex(T.inkColor,.06), borderRadius:6 }}/>
        <div style={{ height:14, width:'35%', background:hex(T.inkColor,.04), borderRadius:6 }}/>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function MenuApp() {
  const viewport = useViewport();
  const [activeCat, setActiveCat] = useState('');
  const [pickup, setPickup] = useState<'counter'|'curbside'>('counter');
  const [cartOpen, setCartOpen] = useState(false);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [intakePaused, setIntakePaused] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const { lines, addLine, incLine, decLine, qtyFor, incById, decById, count, total } = useCart();

  useEffect(() => {
    fetch('/api/menu')
      .then(r => r.json())
      .then(d => {
        setProducts(d.products ?? []);
        setCategories(d.categories ?? []);
        setIntakePaused(d.intake_paused ?? false);
        setBranch(d.branch ?? null);
        if (d.categories?.length) setActiveCat(d.categories[0].id);
      })
      .catch(() => {})
      .finally(() => setMenuLoading(false));
  }, []);

  const filtered = products.filter(p => p.category === activeCat);

  return (
    <div style={{ background:T.bgColor, minHeight:'100vh', color:T.inkColor, fontFamily:"'Nunito',system-ui" }}>
      <Header onCartClick={() => setCartOpen(true)} cartCount={count} viewport={viewport} branch={branch}/>
      <Hero viewport={viewport}/>
      {intakePaused && (
        <div style={{ margin:viewport==='mobile'?'12px 16px 0':'16px 28px 0', padding:'12px 16px', background:'#FFF3CD', border:'1px solid #FFE082', borderRadius:T.cornerRadius-4, fontSize:14, fontWeight:600, color:'#7B5800', textAlign:'center' }}>
          Online ordering is temporarily paused — please try again shortly.
        </div>
      )}
      <PickupBar viewport={viewport} pickup={pickup} setPickup={setPickup} branch={branch}/>
      <LoyaltyStrip viewport={viewport}/>
      <CatBar cats={categories} active={activeCat} setActive={setActiveCat} viewport={viewport}/>
      <main style={{ padding:viewport==='mobile'?'0 16px 100px':'0 28px 40px', display:'grid', gridTemplateColumns:viewport==='desktop'?'1fr 1fr':'1fr', gap:10 }}>
        {menuLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} viewport={viewport}/>)
          : filtered.map(p => (
            <ItemCard
              key={p.id}
              product={p}
              qty={qtyFor(p.id)}
              onAdd={() => incById(p.id, p.name, p.base_price)}
              onSub={() => decById(p.id)}
              onCustomize={() => setSheetProduct(p)}
              viewport={viewport}
            />
          ))
        }
      </main>
      <CartBar count={count} total={total} onClick={() => setCartOpen(true)} viewport={viewport}/>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} lines={lines} incLine={incLine} decLine={decLine} total={total} pickup={pickup} branch={branch}/>
      <CustomizeSheet
        product={sheetProduct}
        open={!!sheetProduct}
        onClose={() => setSheetProduct(null)}
        onConfirm={(mods, qty, unitPrice) => {
          if (sheetProduct) {
            addLine(sheetProduct.id, sheetProduct.name, qty, mods, unitPrice);
            setSheetProduct(null);
          }
        }}
      />
      <style>{`
        .hide-scroll { scrollbar-width: none; }
        .hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
