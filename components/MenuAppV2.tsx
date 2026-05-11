'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import type { Branch, CartLine, LoyaltyConfig, LoyaltyMember, LoyaltyTransaction, Voucher, Product, SelectionConfig, Viewport, XorGroup } from '@/lib/types';

interface Category { id: string; label: string }

// ── Theme ──────────────────────────────────────────────────────────────────
const T = {
  primaryColor:   '#F58220',
  secondaryColor: '#F5D77A',
  accentColor:    '#F47B8E',
  bgColor:        '#FFF6E8',
  inkColor:       '#3A2414',
  cornerRadius:   22,
};

const DRINK_CATS = new Set(['coffee', 'non-coffee']);
const CAT_SWATCHES: Record<string, string> = {
  coffee: '#C88A54', 'non-coffee': '#8CA86A', cold: '#C9A07A', food: '#E3B876', combo: '#D9A977',
};
const DRINK_MODS = {
  sugar: { label: 'Sugar', options: [{ id: 'zero', label: 'Zero', delta: 0 }, { id: 'less', label: 'Less', delta: 0 }, { id: 'medium', label: 'Medium', delta: 0 }, { id: 'sweet', label: 'Sweet', delta: 0 }] },
  /* milk: { label: 'Milk', options: [{ id: 'full', label: 'Full', delta: 0 }, { id: 'skim', label: 'Skim', delta: 0 }, { id: 'oat', label: 'Oat', delta: 2.00 }, { id: 'almond', label: 'Almond', delta: 2.00 }] }, */
  ice:   { label: 'Ice', options: [{ id: 'none', label: 'No ice' }, { id: 'less', label: 'Less' }, { id: 'std', label: 'Normal' }] },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function isDrink(cat: string) { return DRINK_CATS.has(cat.toLowerCase()); }
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
  Car:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 13l2-6h14l2 6M5 13h14v5H5z"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>,
  Walk:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="13" cy="4" r="2"/><path d="M9 22l3-8 3 3v5M9 14l-3-3 4-5 3 3 3 1"/></svg>,
  X:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>,
  Bolt:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>,
  Check: (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5L20 7"/></svg>,
};

// ── Illustrations ──────────────────────────────────────────────────────────
function DrinkSVG({ col, size = 72 }: { col: string; size?: number }) {
  const id = col.replace('#','');
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <defs><clipPath id={`cv2-${id}`}><path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z"/></clipPath></defs>
      <ellipse cx="36" cy="63" rx="26" ry="4" fill="rgba(58,36,20,.08)"/>
      <path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z" fill="#fff" stroke="#3A2414" strokeWidth="2.2"/>
      <rect x="16" y="22" width="40" height="10" fill={col} clipPath={`url(#cv2-${id})`}/>
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
function ItemThumb({ product, size = 100 }: { product: Product; size?: number }) {
  if (product.image_url) return <img src={product.image_url} alt="" style={{ width: size, height: size, objectFit: 'contain', position: 'relative', inset: 0, borderRadius: 0 }}/>;
  const col = catSwatch(product.category);
  return product.category === 'food' ? <PastrySVG col={col} size={size}/> : <DrinkSVG col={col} size={size}/>;
}

// ── Cart ───────────────────────────────────────────────────────────────────
function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const modKey = (mods: Record<string, unknown> | null) => JSON.stringify(mods ?? {});
  const addLine = (id: string, name: string, qty = 1, mods: Record<string, unknown> | null = null, unitPrice: number) => {
    setLines(prev => {
      const key = modKey(mods);
      const idx = prev.findIndex(l => l.id === id && modKey(l.mods) === key);
      if (idx >= 0) { const next = prev.slice(); next[idx] = { ...next[idx], qty: next[idx].qty + qty }; return next; }
      return [...prev, { lid: Math.random().toString(36).slice(2,9), id, name, qty, mods, unitPrice }];
    });
  };
  const incLine  = (lid: string) => setLines(prev => prev.map(l => l.lid === lid ? { ...l, qty: l.qty + 1 } : l));
  const decLine  = (lid: string) => setLines(prev => prev.flatMap(l => l.lid === lid ? (l.qty <= 1 ? [] : [{ ...l, qty: l.qty - 1 }]) : [l]));
  const qtyFor   = (id: string) => lines.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
  const incById  = (id: string, name: string, up: number) => { const idx = lines.findIndex(l => l.id === id); if (idx >= 0) incLine(lines[idx].lid); else addLine(id, name, 1, null, up); };
  const decById  = (id: string) => { const idx = lines.findIndex(l => l.id === id); if (idx >= 0) decLine(lines[idx].lid); };
  const count    = lines.reduce((a, l) => a + l.qty, 0);
  const total    = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return { lines, addLine, incLine, decLine, qtyFor, incById, decById, count, total };
}

// ── v2 Header (compact: logo + pickup pill + ETA + loyalty + cart) ─────────
function Header({ viewport, pickup, setPickup, cartCount, onCartClick, loyaltyActive, customerPoints, onLoyaltyClick }: {
  viewport: Viewport; pickup: 'counter'|'curbside'; setPickup: (v: 'counter'|'curbside') => void;
  cartCount: number; onCartClick: () => void;
  loyaltyActive: boolean; customerPoints: number | null; onLoyaltyClick: () => void;
}) {
  const compact = viewport === 'mobile';
  const toggle  = () => setPickup(pickup === 'curbside' ? 'counter' : 'curbside');
  const PickupIcon = pickup === 'curbside' ? Icon.Car : Icon.Walk;
  return (
    <header style={{ position:'sticky', top:0, zIndex:20, background:T.bgColor, borderBottom:`1px solid ${hex(T.inkColor,.08)}`, padding:compact?'5px 12px':'5px 15px', display:'flex', alignItems:'center', gap:8 }}>
      <img src="/co-logo.png" alt="Coffee Oasis" style={{ height:compact?40:80, maxWidth:compact?200:400, width:'auto', objectFit:'contain', flexShrink:0 }}/>

      {/* Pickup pill — tap to toggle; ETA hidden on mobile to save space */}
      <button onClick={toggle} style={{ marginLeft:compact?2:10, display:'flex', alignItems:'center', gap:5, padding:compact?'5px 8px 5px 7px':'8px 14px 8px 10px', borderRadius:999, border:`1.5px solid ${hex(T.inkColor,.12)}`, background:'#fff', color:T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?11:13, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
        <PickupIcon width={compact?13:16} height={compact?13:16}/>
        <span>{pickup === 'curbside' ? 'Curbside' : 'Counter'}</span>
        {!compact && <><span style={{ opacity:.35, fontSize:11, margin:'0 2px' }}>·</span><Icon.Clock width={14} height={14}/><span style={{ color:T.primaryColor }}>~4m</span></>}
      </button>

      <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
        {loyaltyActive && (
          <button onClick={onLoyaltyClick} style={{ display:'flex', alignItems:'center', gap:4, padding:compact?'6px 8px':'8px 12px', borderRadius:999, background:T.secondaryColor, color:T.inkColor, border:'none', fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:compact?12:13, cursor:'pointer', whiteSpace:'nowrap' }}>
            <span style={{ fontSize:13 }}>★</span>
            {/* show pts on non-mobile; just the star on mobile to save space */}
            {!compact && (customerPoints !== null ? `${customerPoints} pts` : 'Loyalty')}
          </button>
        )}
        <button onClick={onCartClick} aria-label="Cart" style={{ position:'relative', background:T.inkColor, color:'#fff', border:'none', borderRadius:999, padding:compact?'7px 10px':'10px 16px', display:'flex', alignItems:'center', gap:6, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?13:14, cursor:'pointer' }}>
          <Icon.Cart width={compact?22:26} height={compact?22:26}/>
          {cartCount > 0 && <span style={{ background:T.primaryColor, color:'#fff', borderRadius:999, padding:'1px 6px', fontSize:11, fontWeight:800, border:'2px solid #fff', position:'absolute', top:-5, right:-5, minWidth:18, textAlign:'center' }}>{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

// ── v2 Greeting Band (slim gradient, replaces hero) ────────────────────────
function GreetingBand({ viewport, isReturning, hasReorder, onReorder, lastSummary }: {
  viewport: Viewport; isReturning: boolean;
  hasReorder: boolean; onReorder: () => void; lastSummary: string;
}) {
  const compact = viewport === 'mobile';
  return (
    <section style={{ margin:compact?'8px 14px 10px':'12px 24px 10px', background:`linear-gradient(135deg,${T.primaryColor} 0%,#FF9A3D 100%)`, borderRadius:T.cornerRadius, padding:compact?'10px 12px':'12px 16px', display:'flex', alignItems:'center', gap:compact?10:14, color:'#fff', overflow:'hidden' }}>
      <img src="/co-mascot.png" alt="" style={{ width:compact?60:120, height:compact?60:120, objectFit:'contain', flexShrink:0, transform:'rotate(-4deg)', filter:'drop-shadow(0 4px 0 rgba(58,36,20,.18))' }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:compact?22:32, lineHeight:1.1 }}>
          {isReturning ? 'Welcome back ✨' : 'Coffee, sorted.'}
        </div>
        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:compact?16:18, opacity:.92, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {hasReorder ? lastSummary : 'Order ahead, skip the line.'}
        </div>
      </div>
      {hasReorder && (
        <button onClick={onReorder} style={{ background:'#fff', color:T.primaryColor, border:'none', borderRadius:999, padding:compact?'10px 12px':'12px 16px', fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:compact?22:32, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, display:'flex', alignItems:'center', gap:5 }}>
          <Icon.Bolt width="12" height="12"/> Reorder
        </button>
      )}
    </section>
  );
}

// ── Category Chips ─────────────────────────────────────────────────────────
function CatBar({ cats, active, setActive, viewport }: { cats: Category[]; active: string; setActive: (id: string) => void; viewport: Viewport }) {
  const compact = viewport === 'mobile';
  return (
    <div style={{ position:'sticky', top:compact?12:18, zIndex:10, background:`linear-gradient(to bottom,${T.bgColor} 70%,transparent)`, padding:compact?'10px 12px 10px':'10px 24px 13px' }}>
      <div className="hide-scroll" style={{ display:'flex', gap:3, overflowX:'auto', scrollbarWidth:'thin' }}>
        {cats.map(c => {
          const on = active === c.id;
          return <button key={c.id} onClick={() => setActive(c.id)} style={{ flexShrink:0, padding:'10px 16px', borderRadius:999, border:'none', background:on?T.inkColor:'#fff', color:on?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?14:18, cursor:'pointer', boxShadow:on?`0 3px 0 ${hex(T.inkColor,.25)}`:`0 1px 0 ${hex(T.inkColor,.06)}`, transition:'all .12s' }}>{c.label}</button>;
        })}
      </div>
    </div>
  );
}

// ── Item Card ──────────────────────────────────────────────────────────────
function qtyBtn(bg: string, fg: string): React.CSSProperties {
  return { width:30, height:30, borderRadius:'50%', background:bg, color:fg, border:'none', display:'grid', placeItems:'center', cursor:'pointer' };
}

function ItemCard({ product, qty, onAdd, onCustomize, viewport }: { product: Product; qty: number; onAdd: () => void; onCustomize: () => void; viewport: Viewport }) {
  const sheet = needsSheet(product);
  const compact = viewport === 'mobile';
  const col = catSwatch(product.category);
  const soldOut = product.stock_quantity !== null && product.stock_quantity <= 0;

  const handleClick = () => { if (!soldOut) { if (sheet) onCustomize(); else onAdd(); } };

  return (
    <div onClick={handleClick} style={{ background:'#fff', borderRadius:T.cornerRadius, border:`1.5px solid ${hex(T.inkColor,.06)}`, boxShadow:`0 4px 0 ${hex(T.inkColor,.05)}`, cursor:soldOut?'default':'pointer', opacity:soldOut?.45:1, display:'flex', flexDirection:'column', overflow:'hidden', userSelect:'none' }}>
      {/* Image */}
      <div style={{ width:'100%', aspectRatio:'1', background:`radial-gradient(circle at 50% 55%,${hex(col,.22)},${hex(col,.05)} 65%)`, display:'grid', placeItems:'center', position:'relative', overflow:'hidden' }}>
        <ItemThumb product={product} size={compact?200:400}/>
        {soldOut && (
          <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,.6)', display:'grid', placeItems:'center' }}>
            <span style={{ fontFamily:"'Nunito',system-ui", fontWeight:800, fontSize:11, background:hex(T.inkColor,.85), color:'#fff', borderRadius:6, padding:'3px 8px' }}>Sold out</span>
          </div>
        )}
        {qty > 0 && !soldOut && (
          <span style={{ position:'absolute', top:6, right:6, background:T.inkColor, color:'#fff', borderRadius:999, padding:'2px 7px', fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:12, border:'2px solid #fff', lineHeight:1.4 }}>{qty}</span>
        )}
      </div>
      {/* Text */}
      <div style={{ padding:compact?'8px 8px 8px':'8px 8px 8px', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?12:14, color:T.inkColor, lineHeight:1.25, wordBreak:'break-word' }}>{product.name}</div>
        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?12:14, color:T.primaryColor, marginTop:'auto', paddingTop:4 }}>RM {product.base_price.toFixed(2)}</div>
      </div>
    </div>
  );
}

// ── Cart Bar (sticky bottom) ───────────────────────────────────────────────
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

// ── Cart Drawer ────────────────────────────────────────────────────────────
function CartDrawer({ open, onClose, lines, incLine, decLine, total, pickup, branch, onPay }: {
  open: boolean; onClose: () => void; lines: CartLine[];
  incLine: (lid: string) => void; decLine: (lid: string) => void;
  total: number; pickup: 'counter'|'curbside'; branch: Branch | null; onPay: () => void;
}) {
  if (!open) return null;

  const modSummary = (line: CartLine): string | null => {
    if (!line.mods) return null;
    const m = line.mods;
    const parts: string[] = [];
    if (m.combo_selections && typeof m.combo_selections === 'object') {
      for (const v of Object.values(m.combo_selections as Record<string, { name: string }>)) { if (v?.name) parts.push(v.name); }
    }
    if (m.sugar && m.sugar !== 'Zero') parts.push((m.sugar as string) + ' sugar');
    // if (m.milk) parts.push(m.milk as string);
    if (Array.isArray(m.selected_optionals)) {
      for (const o of m.selected_optionals as Array<{ name: string }>) { if (o?.name) parts.push(`+ ${o.name}`); }
    }
    if (m.notes) parts.push(`"${m.notes}"`);
    return parts.filter(Boolean).join(' · ') || null;
  };

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
                <div style={{ width:52, height:52, borderRadius:14, background:hex(T.primaryColor,.1), display:'grid', placeItems:'center', flexShrink:0, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:16, color:T.inkColor }}>{line.qty}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, color:T.inkColor, lineHeight:1.2 }}>{line.name}</div>
                  {sum && <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.65), marginTop:2, lineHeight:1.3 }}>{sum}</div>}
                  <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:hex(T.inkColor,.7), marginTop:3 }}>RM {line.unitPrice.toFixed(2)}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bgColor, borderRadius:999, padding:4 }}>
                  <button onClick={() => decLine(line.lid)} style={qtyBtn('#fff',T.inkColor)}><Icon.Minus width="14" height="14"/></button>
                  <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, minWidth:14, textAlign:'center' }}>{line.qty}</span>
                  <button onClick={() => incLine(line.lid)} style={qtyBtn('#fff',T.inkColor)}><Icon.Plus width="14" height="14"/></button>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop:8, padding:14, background:'#fff', borderRadius:T.cornerRadius-4, border:`1.5px dashed ${hex(T.inkColor,.15)}`, display:'flex', alignItems:'center', gap:10, fontFamily:"'Nunito',system-ui", fontSize:14, color:T.inkColor }}>
            {pickup === 'curbside' ? <Icon.Car width="20" height="20"/> : <Icon.Walk width="20" height="20"/>}
            <div>
              <div style={{ fontWeight:700 }}>{pickup === 'curbside' ? 'Curbside pickup' : 'Counter pickup'}</div>
              {branch?.address && <div style={{ opacity:.65, fontSize:12 }}>{branch.address}</div>}
            </div>
          </div>
        </div>
        <div style={{ padding:20, borderTop:`1px solid ${hex(T.inkColor,.08)}`, background:'#fff' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:T.inkColor, marginBottom:12 }}>
            <span>Total</span><span>RM {total.toFixed(2)}</span>
          </div>
          <button onClick={onPay} style={{ width:'100%', padding:'16px', background:T.primaryColor, color:'#fff', border:'none', borderRadius:T.cornerRadius, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:17, cursor:'pointer', boxShadow:`0 6px 0 ${hex(T.primaryColor,.4)}` }}>
            Proceed to checkout →
          </button>
          <div style={{ textAlign:'center', marginTop:8, fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.55) }}>
            FPX · GrabPay · Boost · Touch 'n Go
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Customize Sheet ────────────────────────────────────────────────────────
type DrinkSel = { sugar: string; milk: string; notes: string };
function pillStyle(on: boolean): React.CSSProperties {
  return { padding:'8px 14px', borderRadius:999, border:on?`2px solid ${T.inkColor}`:`1.5px solid ${hex(T.inkColor,.12)}`, background:on?T.inkColor:'#fff', color:on?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 };
}

function ComboSection({ cfg, selections, selectedOptionals, onSelect, onToggleOptional }: {
  cfg: SelectionConfig; selections: Record<string,string>; selectedOptionals: Set<string>;
  onSelect: (key: string, id: string) => void; onToggleOptional: (id: string) => void;
}) {
  const topLevel = cfg.xorGroups.filter((g: XorGroup) => !g.parentProductId);
  const nested   = cfg.xorGroups.filter((g: XorGroup) => !!g.parentProductId);
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
                const priceLabel = item.priceAdjustment > 0 ? `+RM${item.priceAdjustment.toFixed(2)}` : 'Included';
                return (
                  <button key={item.id} onClick={() => onSelect(group.uniqueKey, item.id)} style={pillStyle(on)}>
                    {item.name}{!on && <span style={{ opacity:.6, fontWeight:600, fontSize:11 }}>{priceLabel}</span>}
                  </button>
                );
              })}
            </div>
            {childGroups.map(ng => (
              <div key={ng.uniqueKey} style={{ marginTop:10, paddingLeft:12, borderLeft:`2px solid ${hex(T.inkColor,.08)}` }}>
                <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, color:T.inkColor, marginBottom:6 }}>{ng.groupName}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {ng.items.map(ni => {
                    const non = selections[ng.uniqueKey] === ni.id;
                    return <button key={ni.id} onClick={() => onSelect(ng.uniqueKey, ni.id)} style={pillStyle(non)}>{ni.name}{ni.priceAdjustment > 0 && !non && <span style={{ opacity:.6, fontWeight:600, fontSize:11 }}>+RM{ni.priceAdjustment.toFixed(2)}</span>}</button>;
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
              return <button key={opt.id} onClick={() => onToggleOptional(opt.id)} style={{ ...pillStyle(checked), outline:checked?`2px solid ${T.primaryColor}`:'none' }}>{opt.name}{!checked && opt.priceAdjustment > 0 && <span style={{ opacity:.6, fontWeight:600, fontSize:11 }}>+RM{opt.priceAdjustment.toFixed(2)}</span>}</button>;
            })}
          </div>
        </div>
      )}
    </>
  );
}

function CustomizeSheet({ product, open, onClose, onConfirm }: {
  product: Product | null; open: boolean; onClose: () => void;
  onConfirm: (mods: Record<string,unknown>, qty: number, unitPrice: number) => void;
}) {
  const drinkDefaults: DrinkSel = useMemo(() => ({ sugar: 'zero', milk: '', notes: '' }), []);
  const [drinkSel, setDrinkSel]           = useState<DrinkSel>({ ...drinkDefaults });
  const [selections, setSelections]       = useState<Record<string,string>>({});
  const [selectedOptionals, setSelOpts]   = useState<Set<string>>(new Set());
  const [notes, setNotes]                 = useState('');
  const [qty, setQty]                     = useState(1);

  const cfg   = product?.selection_config ?? null;
  const drink = !!product && isDrink(product.category) && !cfg;
  const nestedGroups = useMemo(() => cfg?.xorGroups.filter(g => !!g.parentProductId) ?? [], [cfg]);

  const comboHasCoffee = useMemo(() => {
    if (!cfg) return false;
    if (product?.category.toLowerCase() === 'coffee') return true;
    return cfg.xorGroups.some(g => {
      const selId = selections[g.uniqueKey];
      return !!g.items.find(i => i.id === selId)?.isCoffee;
    });
  }, [cfg, selections, product]);

  useEffect(() => {
    if (!open || !product) return;
    setQty(1); setNotes('');
    if (drink) setDrinkSel({ ...drinkDefaults });
    else if (cfg) { setSelections({}); setSelOpts(new Set()); setDrinkSel({ ...drinkDefaults }); }
  }, [open, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (key: string, itemId: string) => {
    setSelections(prev => {
      const prevId = prev[key];
      const next = { ...prev, [key]: itemId };
      if (prevId) { for (const ng of nestedGroups.filter(ng => ng.parentProductId === prevId)) delete next[ng.uniqueKey]; }
      for (const ng of nestedGroups.filter(ng => ng.parentProductId === itemId)) { if (ng.items.length > 0) next[ng.uniqueKey] = ng.items[0].id; }
      return next;
    });
  };
  const toggleOpt = (id: string) => setSelOpts(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  if (!open || !product) return null;

  const unitPrice = (() => {
    if (drink) return product.base_price;
    if (!cfg) return product.base_price;
    let adj = 0;
    for (const g of cfg.xorGroups) { const item = g.items.find(i => i.id === selections[g.uniqueKey]); if (item) adj += item.priceAdjustment; }
    for (const opt of cfg.optionalItems) { if (selectedOptionals.has(opt.id)) adj += opt.priceAdjustment; }
    return (product.combo_price_override ?? product.base_price) + adj;
  })();

  const handleConfirm = () => {
    let mods: Record<string,unknown>;
    if (drink) {
      mods = {
        ...(product.category.toLowerCase() === 'coffee' ? { sugar: DRINK_MODS.sugar.options.find(o => o.id === drinkSel.sugar)?.label } : {}),
        // ...(product.category.toLowerCase() === 'coffee' ? { milk: DRINK_MODS.milk.options.find(o => o.id === drinkSel.milk)?.label } : {}),
        ...(drinkSel.notes ? { notes: drinkSel.notes } : {}),
      };
    } else if (cfg) {
      const cs: Record<string,{ id: string; name: string }> = {};
      for (const g of cfg.xorGroups) { const sid = selections[g.uniqueKey]; if (sid) { const item = g.items.find(i => i.id === sid); if (item) cs[g.uniqueKey] = { id: sid, name: item.name }; } }
      const so = cfg.optionalItems.filter(o => selectedOptionals.has(o.id)).map(o => ({ id: o.id, name: o.name }));
      mods = {
        combo_selections: cs,
        ...(comboHasCoffee ? { sugar: DRINK_MODS.sugar.options.find(o => o.id === drinkSel.sugar)?.label } : {}),
        // ...(comboHasCoffee ? { milk: DRINK_MODS.milk.options.find(o => o.id === drinkSel.milk)?.label } : {}),
        ...(so.length > 0 ? { selected_optionals: so } : {}),
        ...(notes ? { notes } : {}),
      };
    } else { mods = {}; }
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
            {/* DEBUG — remove before launch */}
            <div style={{ fontSize:10, color:'#999', marginTop:2 }}>cat:{product.category} drink:{String(drink)} cfg:{String(!!cfg)} coffee:{String(comboHasCoffee)}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.inkColor, alignSelf:'flex-start' }}><Icon.X width="22" height="22"/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'4px 20px 12px' }}>
          {drink ? (
            <>
              {product.category.toLowerCase() === 'coffee' && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Sugar</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {DRINK_MODS.sugar.options.map(o => { const on = drinkSel.sugar === o.id; return <button key={o.id} onClick={() => setDrinkSel(s => ({ ...s, sugar: o.id }))} style={pillStyle(on)}>{o.label}</button>; })}
                  </div>
                </div>
              )}
              {/* milk — coffee only, not offered yet
              {product.category.toLowerCase() === 'coffee' && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Milk</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {DRINK_MODS.milk.options.map(o => { const on = drinkSel.milk === o.id; return <button key={o.id} onClick={() => setDrinkSel(s => ({ ...s, milk: o.id }))} style={pillStyle(on)}>{o.label}</button>; })}
                  </div>
                </div>
              )} */}
              <div style={{ marginTop:14 }}>
                <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Notes to barista</div>
                <input value={drinkSel.notes} onChange={e => setDrinkSel(s => ({ ...s, notes: e.target.value }))} placeholder="e.g. extra hot, no foam" style={{ width:'100%', padding:'12px 14px', fontFamily:"'Nunito',system-ui", fontSize:14, color:T.inkColor, background:'#fff', border:`1.5px solid ${hex(T.inkColor,.1)}`, borderRadius:T.cornerRadius-8, outline:'none', boxSizing:'border-box' }}/>
              </div>
            </>
          ) : cfg ? (
            <>
              <ComboSection cfg={cfg} selections={selections} selectedOptionals={selectedOptionals} onSelect={handleSelect} onToggleOptional={toggleOpt}/>
              {comboHasCoffee && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Sugar</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {DRINK_MODS.sugar.options.map(o => { const on = drinkSel.sugar === o.id; return <button key={o.id} onClick={() => setDrinkSel(s => ({ ...s, sugar: o.id }))} style={pillStyle(on)}>{o.label}</button>; })}
                  </div>
                </div>
              )}
              {/* milk — coffee only, not offered yet
              {comboHasCoffee && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Milk</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {DRINK_MODS.milk.options.map(o => { const on = drinkSel.milk === o.id; return <button key={o.id} onClick={() => setDrinkSel(s => ({ ...s, milk: o.id }))} style={pillStyle(on)}>{o.label}</button>; })}
                  </div>
                </div>
              )} */}
              <div style={{ marginTop:14 }}>
                <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>Notes</div>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. allergies, special requests" style={{ width:'100%', padding:'12px 14px', fontFamily:"'Nunito',system-ui", fontSize:14, color:T.inkColor, background:'#fff', border:`1.5px solid ${hex(T.inkColor,.1)}`, borderRadius:T.cornerRadius-8, outline:'none', boxSizing:'border-box' }}/>
              </div>
            </>
          ) : null}
        </div>
        <div style={{ padding:'14px 20px 20px', borderTop:`1px solid ${hex(T.inkColor,.08)}`, background:'#fff', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bgColor, borderRadius:999, padding:4 }}>
            <button onClick={() => setQty(q => Math.max(1,q-1))} style={{ width:34, height:34, borderRadius:'50%', background:'#fff', color:T.inkColor, border:'none', display:'grid', placeItems:'center', cursor:'pointer' }}><Icon.Minus width="16" height="16"/></button>
            <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, minWidth:18, textAlign:'center', color:T.inkColor }}>{qty}</span>
            <button onClick={() => setQty(q => q+1)} style={{ width:34, height:34, borderRadius:'50%', background:'#fff', color:T.inkColor, border:'none', display:'grid', placeItems:'center', cursor:'pointer' }}><Icon.Plus width="16" height="16"/></button>
          </div>
          <button onClick={handleConfirm} style={{ flex:1, padding:'14px 18px', background:T.primaryColor, color:'#fff', border:'none', borderRadius:T.cornerRadius, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:`0 5px 0 ${hex(T.primaryColor,.4)}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Add to order</span><span>RM {(unitPrice*qty).toFixed(2)}</span>
          </button>
        </div>
      </div>
      <style>{`@keyframes coSheetIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

// ── Loyalty Sheet ─────────────────────────────────────────────────────────
function LoyaltySheet({ open, onClose, config, phone, onPhoneSave }: {
  open: boolean; onClose: () => void;
  config: LoyaltyConfig | null;
  phone: string | null;
  onPhoneSave: (phone: string) => void;
}) {
  const [member,       setMember]       = useState<LoyaltyMember | null>(null);
  const [vouchers,     setVouchers]     = useState<Voucher[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [phoneInput,   setPhoneInput]   = useState('');
  const [phoneErr,     setPhoneErr]     = useState('');

  const activePhone = phone;
  const digits = (activePhone ?? '').replace(/\D/g, '');
  const hasPhone = digits.length >= 8;

  useEffect(() => {
    if (!open || !hasPhone) return;
    setFetching(true);
    fetch(`/api/loyalty/member?phone=${digits}`)
      .then(r => r.json())
      .then(d => {
        setMember(d.member ?? null);
        setVouchers(d.vouchers ?? []);
        setTransactions(d.transactions ?? []);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [open, digits, hasPhone]);

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = phoneInput.replace(/\D/g, '');
    if (d.length < 8) { setPhoneErr('Enter a valid phone number'); return; }
    setPhoneErr('');
    setFetching(true);
    try {
      const res = await fetch(`/api/loyalty/member?phone=${d}`);
      const data = await res.json();
      if (!data.member) { setPhoneErr('No loyalty account found for this number'); setFetching(false); return; }
      onPhoneSave(d);
      setMember(data.member);
      setVouchers(data.vouchers ?? []);
      setTransactions(data.transactions ?? []);
    } catch { setPhoneErr('Could not look up account. Try again.'); }
    finally  { setFetching(false); }
  };

  if (!open) return null;

  const bal = member?.points_balance ?? 0;
  const threshold = config?.points_threshold ?? 10;
  const ptsToNext = threshold - (bal % threshold);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(58,36,20,.45)' }}/>
      <div style={{ position:'relative', width:'min(460px,100%)', background:T.bgColor, borderTopLeftRadius:28, borderTopRightRadius:28, padding:'10px 22px 32px', animation:'coSheetIn .25s ease-out', boxShadow:'0 -10px 40px rgba(58,36,20,.25)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ width:40, height:4, background:hex(T.inkColor,.2), borderRadius:999, margin:'0 auto 16px' }}/>
        <div style={{ display:'flex', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:20, color:T.inkColor }}>Loyalty</div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', cursor:'pointer', color:T.inkColor, fontSize:24, lineHeight:1 }}>×</button>
        </div>

        {/* QR / phone lookup */}
        {hasPhone ? (
          <div style={{ background:T.inkColor, borderRadius:T.cornerRadius, padding:'18px 18px 14px', marginBottom:14, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ background:'#fff', borderRadius:12, padding:10, display:'inline-flex' }}>
              <QRCodeSVG value={digits} size={140} />
            </div>
            <div style={{ color:'#fff', fontFamily:"'Nunito',system-ui", fontSize:13, opacity:.8, textAlign:'center' }}>
              Show this QR at the counter to earn points
            </div>
            <button
              onClick={() => { onPhoneSave(''); setMember(null); setVouchers([]); setTransactions([]); setPhoneInput(''); }}
              style={{ background:'transparent', border:`1px solid rgba(255,255,255,.3)`, borderRadius:999, padding:'4px 12px', color:'rgba(255,255,255,.65)', fontSize:12, cursor:'pointer', fontFamily:"'Nunito',system-ui" }}
            >
              Not you?
            </button>
          </div>
        ) : (
          <form onSubmit={handlePhoneLookup} style={{ background:'#fff', borderRadius:T.cornerRadius-4, padding:'16px', marginBottom:14, border:`1.5px solid ${hex(T.inkColor,.08)}` }}>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:10 }}>
              Enter your phone to see your QR
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                type="tel"
                value={phoneInput}
                onChange={e => { setPhoneInput(e.target.value); setPhoneErr(''); }}
                placeholder="e.g. 0123456789"
                style={{ flex:1, padding:'11px 14px', fontSize:15, color:T.inkColor, background:T.bgColor, border:`1.5px solid ${hex(T.inkColor,.12)}`, borderRadius:T.cornerRadius-10, outline:'none', fontFamily:"'Nunito',system-ui" }}
              />
              <button
                type="submit"
                disabled={fetching}
                style={{ padding:'11px 16px', borderRadius:T.cornerRadius-10, border:'none', background:T.primaryColor, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Nunito',system-ui", opacity:fetching?.6:1 }}
              >
                {fetching ? '…' : 'Find'}
              </button>
            </div>
            {phoneErr && <div style={{ marginTop:7, fontSize:13, color:'#C0392B', fontWeight:600 }}>{phoneErr}</div>}
          </form>
        )}

        {/* Balance */}
        {config?.is_active && (
          <div style={{ background:'#fff', borderRadius:T.cornerRadius-4, padding:'13px 16px', marginBottom:14, border:`1.5px solid ${hex(T.inkColor,.08)}`, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:T.primaryColor, display:'grid', placeItems:'center', flexShrink:0, fontSize:18, color:'#fff' }}>★</div>
            <div>
              {fetching ? (
                <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:hex(T.inkColor,.45) }}>Loading…</div>
              ) : member ? (
                <>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:T.inkColor, lineHeight:1 }}>{bal.toLocaleString()} pts</div>
                  <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.6), marginTop:2 }}>
                    {ptsToNext < threshold ? `${ptsToNext} more to next voucher` : `${threshold} pts = 1 voucher`}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:18, color:T.inkColor }}>Earn 1 pt per visit</div>
                  <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.6), marginTop:2 }}>
                    Get a voucher every {threshold} visits
                    {config.voucher_value > 0 && ` · RM${config.voucher_value.toFixed(2)} off`}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Available vouchers */}
        {vouchers.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, color:hex(T.inkColor,.6), textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Your Vouchers</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {vouchers.map(v => (
                <div key={v.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#fff', borderRadius:T.cornerRadius-6, padding:'11px 14px', border:`1.5px solid ${T.primaryColor}` }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:T.primaryColor, display:'grid', placeItems:'center', flexShrink:0, fontSize:14, color:'#fff', fontWeight:700 }}>
                    {v.type === 'percent' ? `${v.discount_amount}%` : `RM${v.discount_amount}`}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor }}>
                      {v.type === 'percent' ? `${v.discount_amount}% off` : `RM ${v.discount_amount.toFixed(2)} off`}
                    </div>
                    <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.55), marginTop:1, letterSpacing:'.03em' }}>{v.code}</div>
                  </div>
                  {v.expires_at && (
                    <div style={{ fontFamily:"'Nunito',system-ui", fontSize:11, color:hex(T.inkColor,.45), whiteSpace:'nowrap' }}>
                      exp {new Date(v.expires_at).toLocaleDateString('en-MY', { day:'numeric', month:'short' })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <div>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, color:hex(T.inkColor,.6), textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Recent Activity</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {transactions.slice(0,5).map(tx => (
                <div key={tx.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#fff', borderRadius:T.cornerRadius-8, border:`1px solid ${hex(T.inkColor,.07)}` }}>
                  <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:T.inkColor }}>{tx.description ?? tx.type}</div>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, color:tx.points >= 0 ? '#16A34A' : '#DC2626' }}>
                    {tx.points >= 0 ? '+' : ''}{tx.points} pt
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes coSheetIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function MenuAppV2() {
  const router   = useRouter();
  const viewport = useViewport();
  const { lines, addLine, incLine, decLine, qtyFor, incById, decById, count, total } = useCart();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [branch,      setBranch]      = useState<Branch | null>(null);
  const [intakePaused, setIntakePaused] = useState(false);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [savedPhone,  setSavedPhone]  = useState<string | null>(null);
  const [activeCat,   setActiveCat]   = useState('');
  const [pickup,      setPickup]      = useState<'counter'|'curbside'>('counter');
  const [cartOpen,    setCartOpen]    = useState(false);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [isReturning, setIsReturning] = useState(false);
  const [lastOrder,   setLastOrder]   = useState<{ items: CartLine[]; when: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/menu').then(r => r.json()),
      fetch('/api/loyalty').then(r => r.json()),
    ]).then(([menu, loyalty]) => {
      setProducts(menu.products ?? []);
      setCategories(menu.categories ?? []);
      setBranch(menu.branch ?? null);
      setIntakePaused(menu.intake_paused ?? false);
      setLoyaltyConfig(loyalty.config ?? null);
      if (menu.categories?.length) setActiveCat(menu.categories[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Returning-user detection, last order, saved phone
  useEffect(() => {
    try {
      setIsReturning(!!localStorage.getItem('co_session'));
      const lo = localStorage.getItem('co_last_order');
      if (lo) setLastOrder(JSON.parse(lo));
      const saved = localStorage.getItem('co_form');
      if (saved) {
        const { phone } = JSON.parse(saved);
        if (phone) setSavedPhone(phone);
      }
    } catch { /* ignore */ }
  }, []);

  const handlePay = () => {
    try { localStorage.setItem('co_pending', JSON.stringify({ lines, pickup, total })); } catch { /* ignore */ }
    router.push('/checkout');
  };

  const handleReorder = () => {
    if (!lastOrder) return;
    lastOrder.items.forEach(line => {
      addLine(line.id, line.name, line.qty, line.mods ?? null, line.unitPrice);
    });
    setCartOpen(true);
  };

  const compact  = viewport === 'mobile';
  const filtered = products.filter(p => p.category === activeCat);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:T.bgColor, display:'grid', placeItems:'center' }}>
      <div style={{ width:40, height:40, border:`3px solid ${hex(T.primaryColor,.3)}`, borderTopColor:T.primaryColor, borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background:T.bgColor, minHeight:'100vh', color:T.inkColor, fontFamily:"'Nunito',system-ui", width:'100%', maxWidth:'100vw', overflowX:'hidden' }}>
      {intakePaused && (
        <div style={{ background:T.inkColor, color:'#fff', textAlign:'center', padding:'10px 16px', fontSize:14, fontWeight:600 }}>
          Online ordering is temporarily paused — please try again shortly.
        </div>
      )}

      <Header
        viewport={viewport}
        pickup={pickup} setPickup={setPickup}
        cartCount={count} onCartClick={() => setCartOpen(true)}
        loyaltyActive={loyaltyConfig?.is_active ?? false}
        customerPoints={null}
        onLoyaltyClick={() => setLoyaltyOpen(true)}
      />

      <GreetingBand
        viewport={viewport} isReturning={isReturning}
        hasReorder={!!lastOrder} onReorder={handleReorder}
        lastSummary={lastOrder?.items.map(l => `${l.qty}× ${l.name}`).join(', ') ?? ''}
      />

      <CatBar cats={categories} active={activeCat} setActive={setActiveCat} viewport={viewport}/>

      <main style={{ padding:compact?'0 10px 120px':'0 24px 60px', display:'grid', gridTemplateColumns:viewport==='mobile'?'minmax(0,1fr) minmax(0,1fr)':viewport==='tablet'?'repeat(3,minmax(0,1fr))':'repeat(5,minmax(0,1fr))', gap:compact?6:8 }}>
        {filtered.map(p => (
          <ItemCard
            key={p.id} product={p} qty={qtyFor(p.id)}
            onAdd={() => incById(p.id, p.name, p.base_price)}
            onCustomize={() => setSheetProduct(p)}
            viewport={viewport}
          />
        ))}
      </main>

      <CartBar count={count} total={total} onClick={() => setCartOpen(true)} viewport={viewport}/>

      <CartDrawer
        open={cartOpen} onClose={() => setCartOpen(false)}
        lines={lines} incLine={incLine} decLine={decLine}
        total={total} pickup={pickup} branch={branch} onPay={handlePay}
      />

      <CustomizeSheet
        product={sheetProduct} open={!!sheetProduct}
        onClose={() => setSheetProduct(null)}
        onConfirm={(mods, qty, unitPrice) => {
          addLine(sheetProduct!.id, sheetProduct!.name, qty, mods, unitPrice);
          setSheetProduct(null);
        }}
      />

      <LoyaltySheet
        open={loyaltyOpen} onClose={() => setLoyaltyOpen(false)}
        config={loyaltyConfig} phone={savedPhone}
        onPhoneSave={p => {
          setSavedPhone(p || null);
          try {
            if (p) {
              const existing = JSON.parse(localStorage.getItem('co_form') ?? '{}');
              localStorage.setItem('co_form', JSON.stringify({ ...existing, phone: p }));
            } else {
              const existing = JSON.parse(localStorage.getItem('co_form') ?? '{}');
              delete existing.phone;
              localStorage.setItem('co_form', JSON.stringify(existing));
            }
          } catch { /* ignore */ }
        }}
      />

      {/* Version switcher */}
      <a href="/" style={{ position:'fixed', bottom:compact?86:24, left:16, zIndex:50, background:hex(T.inkColor,.85), color:'#fff', padding:'7px 14px', borderRadius:999, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:12, textDecoration:'none', backdropFilter:'blur(4px)' }}>
        ← v1
      </a>
    </div>
  );
}
