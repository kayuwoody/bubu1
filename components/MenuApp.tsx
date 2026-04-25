'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { CartLine, MenuItem, ItemMods, Viewport } from '@/lib/types';
import MENU_DATA from '@/lib/menu-data';

const T = {
  primaryColor:   '#F58220',
  secondaryColor: '#F5D77A',
  accentColor:    '#F47B8E',
  bgColor:        '#FFF6E8',
  inkColor:       '#3A2414',
  cornerRadius:   22,
  showStickers:   true,
  showReorder:    true,
  showLoyalty:    true,
  mascotProminence: 'supporting' as const,
};

function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

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
  Cart:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.5L20.5 8H6"/></svg>,
  Plus:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Minus:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...p}><path d="M5 12h14"/></svg>,
  Clock:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  Pin:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  Bolt:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>,
  Check:  (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5L20 7"/></svg>,
  Car:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 13l2-6h14l2 6M5 13h14v5H5z"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>,
  Walk:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="13" cy="4" r="2"/><path d="M9 22l3-8 3 3v5M9 14l-3-3 4-5 3 3 3 1"/></svg>,
  X:      (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>,
};

// ── Illustrations ──────────────────────────────────────────────────────────
function Drink({ swatch, size = 72 }: { swatch: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <defs><clipPath id={`cup-${swatch.slice(1)}`}><path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z"/></clipPath></defs>
      <ellipse cx="36" cy="63" rx="26" ry="4" fill="rgba(58,36,20,.08)"/>
      <path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z" fill="#fff" stroke="#3A2414" strokeWidth="2.2"/>
      <rect x="16" y="22" width="40" height="10" fill={swatch} clipPath={`url(#cup-${swatch.slice(1)})`}/>
      <ellipse cx="36" cy="23" rx="20" ry="3.2" fill={swatch}/>
      <ellipse cx="36" cy="22" rx="20" ry="3.2" fill="none" stroke="#3A2414" strokeWidth="2.2"/>
      <path d="M56 28 q10 2 10 10 q0 8 -10 10" fill="none" stroke="#3A2414" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M28 12 q3 -4 0 -8 M36 12 q3 -4 0 -8 M44 12 q3 -4 0 -8" fill="none" stroke="#3A2414" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
    </svg>
  );
}

function Pastry({ swatch, size = 72 }: { swatch: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <ellipse cx="36" cy="60" rx="24" ry="3" fill="rgba(58,36,20,.08)"/>
      <path d="M12 40 q0 -18 24 -18 q24 0 24 18 q0 14 -24 14 q-24 0 -24 -14z" fill={swatch} stroke="#3A2414" strokeWidth="2.2"/>
      <path d="M20 38 q8 -6 16 -6 q8 0 16 6" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55"/>
      <path d="M22 45 q6 -4 14 -4 q8 0 14 4" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55"/>
      <circle cx="28" cy="34" r="1.6" fill="#3A2414" opacity=".5"/>
      <circle cx="42" cy="36" r="1.6" fill="#3A2414" opacity=".5"/>
    </svg>
  );
}

function ItemThumb({ item, size = 72 }: { item: MenuItem; size?: number }) {
  return item.cat === 'pastry' ? <Pastry swatch={item.swatch} size={size}/> : <Drink swatch={item.swatch} size={size}/>;
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
  const modKey = (mods: Partial<ItemMods> | null) => JSON.stringify(mods ?? {});

  const addLine = (id: string, qty = 1, mods: Partial<ItemMods> | null = null, unitPriceOverride?: number) => {
    const item = MENU_DATA.items.find(x => x.id === id);
    if (!item) return;
    const unitPrice = unitPriceOverride ?? item.price;
    setLines(prev => {
      const key = modKey(mods);
      const idx = prev.findIndex(l => l.id === id && modKey(l.mods) === key);
      if (idx >= 0) { const next = prev.slice(); next[idx] = { ...next[idx], qty: next[idx].qty + qty }; return next; }
      return [...prev, { lid: Math.random().toString(36).slice(2,9), id, qty, mods, unitPrice }];
    });
  };
  const incLine = (lid: string) => setLines(prev => prev.map(l => l.lid === lid ? { ...l, qty: l.qty + 1 } : l));
  const decLine = (lid: string) => setLines(prev => prev.flatMap(l => l.lid === lid ? (l.qty - 1 <= 0 ? [] : [{ ...l, qty: l.qty - 1 }]) : [l]));
  const clear   = () => setLines([]);
  const qtyFor  = (id: string) => lines.filter(l => l.id === id).reduce((s,l) => s + l.qty, 0);
  const incById = (id: string) => { const idx = lines.findIndex(l => l.id === id); if (idx >= 0) incLine(lines[idx].lid); else addLine(id, 1); };
  const decById = (id: string) => { const idx = lines.findIndex(l => l.id === id); if (idx >= 0) decLine(lines[idx].lid); };
  const count   = lines.reduce((a,l) => a + l.qty, 0);
  const total   = lines.reduce((s,l) => s + l.unitPrice * l.qty, 0);
  return { lines, addLine, incLine, decLine, clear, qtyFor, incById, decById, count, total };
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header({ onCartClick, cartCount, viewport }: { onCartClick: () => void; cartCount: number; viewport: Viewport }) {
  const compact = viewport === 'mobile';
  return (
    <header style={{ position:'sticky', top:0, zIndex:20, background:T.bgColor, borderBottom:`1px solid ${hex(T.inkColor,.08)}`, padding:compact?'12px 16px':'16px 28px', display:'flex', alignItems:'center', gap:12 }}>
      <img src="/co-logo.png" alt="Coffee Oasis" style={{ height:compact?36:44, width:'auto', objectFit:'contain' }}/>
      {!compact && (
        <div style={{ marginLeft:12, fontFamily:"'Nunito',system-ui", color:T.inkColor, fontSize:13, display:'flex', alignItems:'center', gap:6, opacity:.75 }}>
          <Icon.Pin width="14" height="14"/> Shell Seksyen 13, PJ · Open till 10pm
        </div>
      )}
      <div style={{ marginLeft:'auto', display:'flex', gap:10, alignItems:'center' }}>
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
        {T.showStickers && <div style={{ position:'absolute', top:-6, right:-4 }}><Sticker bg="#fff" color={T.primaryColor} rotate={10}>Hi there!</Sticker></div>}
      </div>
    </section>
  );
}

// ── Pickup Bar ─────────────────────────────────────────────────────────────
function PickupBar({ viewport, pickup, setPickup }: { viewport: Viewport; pickup: string; setPickup: (v: 'counter'|'curbside') => void }) {
  const compact = viewport === 'mobile';
  const opts = [
    { id:'counter', label:'At counter', Icon:Icon.Walk, sub:'Walk in' },
    { id:'curbside', label:'Curbside',   Icon:Icon.Car,  sub:'We bring it out' },
  ] as const;
  return (
    <div style={{ margin:compact?'12px 16px 0':'16px 28px 0', background:'#fff', border:`1.5px solid ${hex(T.inkColor,.08)}`, borderRadius:T.cornerRadius, padding:compact?10:12, display:'flex', alignItems:'center', gap:10, flexWrap:compact?'wrap':'nowrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', fontFamily:"'Nunito',system-ui", fontWeight:700, fontSize:13, color:T.inkColor, whiteSpace:'nowrap' }}>
        <Icon.Clock width="16" height="16"/> Pickup in ~4 min
      </div>
      <div style={{ display:'flex', gap:6, flex:1, minWidth:compact?'100%':0 }}>
        {opts.map(o => {
          const active = pickup === o.id;
          return (
            <button key={o.id} onClick={() => setPickup(o.id)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 12px', borderRadius:T.cornerRadius-6, border:`1.5px solid ${active?T.inkColor:hex(T.inkColor,.1)}`, background:active?T.inkColor:'#fff', color:active?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, cursor:'pointer', transition:'all .15s' }}>
              <o.Icon width="18" height="18"/> {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Category Chips ─────────────────────────────────────────────────────────
function CatBar({ cats, active, setActive, viewport }: { cats: typeof MENU_DATA.categories; active: string; setActive: (id: string) => void; viewport: Viewport }) {
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

function ItemCard({ item, qty, onAdd, onSub, onCustomize, viewport }: { item: MenuItem; qty: number; onAdd: () => void; onSub: () => void; onCustomize: () => void; viewport: Viewport }) {
  const isDrink = MENU_DATA.drinkCats.includes(item.cat);
  const compact = viewport === 'mobile';
  return (
    <div style={{ background:'#fff', borderRadius:T.cornerRadius, padding:compact?14:16, display:'flex', gap:compact?12:14, alignItems:'center', border:`1.5px solid ${hex(T.inkColor,.06)}`, boxShadow:`0 4px 0 ${hex(T.inkColor,.05)}` }}>
      <div style={{ width:compact?72:84, height:compact?72:84, flexShrink:0, background:`radial-gradient(circle at 50% 55%,${hex(item.swatch,.22)},${hex(item.swatch,.05)} 65%)`, borderRadius:T.cornerRadius-4, display:'grid', placeItems:'center' }}>
        <ItemThumb item={item} size={compact?64:74}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        {item.tag && <div style={{ marginBottom:4 }}><Sticker bg={T.secondaryColor} color={T.inkColor} rotate={-3}>{item.tag}</Sticker></div>}
        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?17:18, color:T.inkColor, lineHeight:1.1 }}>{item.name}</div>
        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:hex(T.inkColor,.6), marginTop:3, lineHeight:1.3 }}>{item.desc}</div>
        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:compact?16:17, color:T.inkColor, marginTop:6 }}>RM {item.price.toFixed(2)}</div>
      </div>
      {qty > 0 && !isDrink ? (
        <div style={{ display:'flex', alignItems:'center', gap:10, background:T.inkColor, color:'#fff', borderRadius:999, padding:4 }}>
          <button onClick={onSub} style={qtyBtn('#fff', T.inkColor)}><Icon.Minus width="16" height="16"/></button>
          <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, minWidth:16, textAlign:'center' }}>{qty}</span>
          <button onClick={onAdd} style={qtyBtn('#fff', T.inkColor)}><Icon.Plus width="16" height="16"/></button>
        </div>
      ) : isDrink ? (
        <button onClick={onCustomize} style={{ position:'relative', width:44, height:44, borderRadius:'50%', border:'none', background:T.primaryColor, color:'#fff', display:'grid', placeItems:'center', cursor:'pointer', boxShadow:`0 4px 0 ${hex(T.primaryColor,.4)}`, flexShrink:0 }}>
          <Icon.Plus width="20" height="20"/>
          {qty > 0 && <span style={{ position:'absolute', top:-4, right:-4, background:T.inkColor, color:'#fff', borderRadius:999, padding:'1px 6px', fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:11, border:'2px solid #fff' }}>{qty}</span>}
        </button>
      ) : (
        <button onClick={onAdd} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:T.primaryColor, color:'#fff', display:'grid', placeItems:'center', cursor:'pointer', boxShadow:`0 4px 0 ${hex(T.primaryColor,.4)}`, flexShrink:0 }}>
          <Icon.Plus width="20" height="20"/>
        </button>
      )}
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

// ── Modifier Sheet ─────────────────────────────────────────────────────────
function ModifierSheet({ item, open, onClose, onConfirm }: { item: MenuItem|null; open: boolean; onClose: () => void; onConfirm: (sel: Partial<ItemMods> & { qty: number; unitPrice: number }) => void }) {
  const defaults = useMemo(() => ({ size:'s', milk:'whole', sugar:'std', ice:'std', notes:'', qty:1 }), []);
  const [sel, setSel] = useState({ ...defaults });
  useEffect(() => { if (open) setSel({ ...defaults }); }, [open, item?.id, defaults]);
  if (!open || !item) return null;

  const isCold = item.cat === 'cold';
  const mods   = MENU_DATA.modifiers;
  const sizeDelta  = mods.size.options.find(o => o.id === sel.size)?.delta ?? 0;
  const milkDelta  = mods.milk.options.find(o => o.id === sel.milk)?.delta ?? 0;
  const unitPrice  = item.price + sizeDelta + milkDelta;
  const total      = unitPrice * sel.qty;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(58,36,20,.45)' }}/>
      <div style={{ position:'relative', width:'min(520px,100%)', maxHeight:'92vh', background:T.bgColor, borderTopLeftRadius:28, borderTopRightRadius:28, display:'flex', flexDirection:'column', boxShadow:'0 -10px 40px rgba(58,36,20,.25)', animation:'coSheetIn .25s ease-out' }}>
        <div style={{ padding:'10px 0 0', textAlign:'center' }}><div style={{ width:40, height:4, background:hex(T.inkColor,.2), borderRadius:999, margin:'0 auto' }}/></div>
        <div style={{ padding:'14px 20px 8px', display:'flex', gap:14, alignItems:'center' }}>
          <div style={{ width:70, height:70, borderRadius:18, flexShrink:0, background:`radial-gradient(circle at 50% 55%,${hex(item.swatch,.22)},${hex(item.swatch,.05)} 65%)`, display:'grid', placeItems:'center' }}>
            <ItemThumb item={item} size={60}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:T.inkColor, lineHeight:1.1 }}>{item.name}</div>
            <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:hex(T.inkColor,.6), marginTop:3 }}>{item.desc}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.inkColor, alignSelf:'flex-start' }}><Icon.X width="22" height="22"/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'4px 20px 12px' }}>
          {([['size', mods.size], ['milk', mods.milk], ['sugar', mods.sugar]] as const).map(([key, mod]) => (
            <div key={key} style={{ marginTop:14 }}>
              <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8, display:'flex', gap:6, alignItems:'baseline' }}>
                {mod.label} {mod.required && <span style={{ fontSize:11, color:'#D9402F', fontWeight:800 }}>Required</span>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {mod.options.map(o => {
                  const on = sel[key] === o.id;
                  return (
                    <button key={o.id} onClick={() => setSel(s => ({ ...s, [key]: o.id }))} style={{ padding:'8px 14px', borderRadius:999, border:on?`2px solid ${T.inkColor}`:`1.5px solid ${hex(T.inkColor,.12)}`, background:on?T.inkColor:'#fff', color:on?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}>
                      {o.label}{(o.delta ?? 0) > 0 && on === false && <span style={{ opacity:.7, fontWeight:600, fontSize:11 }}>+RM{(o.delta ?? 0).toFixed(2)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {isCold && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>{mods.ice.label}</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {mods.ice.options.map(o => {
                  const on = sel.ice === o.id;
                  return <button key={o.id} onClick={() => setSel(s => ({ ...s, ice: o.id }))} style={{ padding:'8px 14px', borderRadius:999, border:on?`2px solid ${T.inkColor}`:`1.5px solid ${hex(T.inkColor,.12)}`, background:on?T.inkColor:'#fff', color:on?'#fff':T.inkColor, fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, cursor:'pointer' }}>{o.label}</button>;
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop:14 }}>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, color:T.inkColor, marginBottom:8 }}>{mods.notes.label}</div>
            <input value={sel.notes} onChange={e => setSel(s => ({ ...s, notes: e.target.value }))} placeholder={mods.notes.placeholder} style={{ width:'100%', padding:'12px 14px', fontFamily:"'Nunito',system-ui", fontSize:14, color:T.inkColor, background:'#fff', border:`1.5px solid ${hex(T.inkColor,.1)}`, borderRadius:T.cornerRadius-8, outline:'none' }}/>
          </div>
        </div>
        <div style={{ padding:'14px 20px 20px', borderTop:`1px solid ${hex(T.inkColor,.08)}`, background:'#fff', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bgColor, borderRadius:999, padding:4 }}>
            <button onClick={() => setSel(s => ({ ...s, qty: Math.max(1, s.qty-1) }))} style={{ width:34, height:34, borderRadius:'50%', background:'#fff', color:T.inkColor, border:'none', display:'grid', placeItems:'center', cursor:'pointer' }}><Icon.Minus width="16" height="16"/></button>
            <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, minWidth:18, textAlign:'center', color:T.inkColor }}>{sel.qty}</span>
            <button onClick={() => setSel(s => ({ ...s, qty: s.qty+1 }))} style={{ width:34, height:34, borderRadius:'50%', background:'#fff', color:T.inkColor, border:'none', display:'grid', placeItems:'center', cursor:'pointer' }}><Icon.Plus width="16" height="16"/></button>
          </div>
          <button onClick={() => onConfirm({ ...sel, unitPrice })} style={{ flex:1, padding:'14px 18px', background:T.primaryColor, color:'#fff', border:'none', borderRadius:T.cornerRadius, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:`0 5px 0 ${hex(T.primaryColor,.4)}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Add to order</span><span>RM {total.toFixed(2)}</span>
          </button>
        </div>
      </div>
      <style>{`@keyframes coSheetIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

// ── Reorder Tile ───────────────────────────────────────────────────────────
function ReorderTile({ viewport, onReorder }: { viewport: Viewport; onReorder: () => void }) {
  const compact = viewport === 'mobile';
  const last    = MENU_DATA.lastOrder;
  const summary = last.items.map(li => `${li.qty}× ${MENU_DATA.items.find(x => x.id === li.id)?.name}`).join(', ');
  return (
    <section style={{ margin:compact?'12px 16px 0':'16px 28px 0', background:'#fff', border:`1.5px solid ${hex(T.inkColor,.08)}`, borderRadius:T.cornerRadius, padding:compact?12:14, display:'flex', alignItems:'center', gap:compact?10:14, boxShadow:`0 4px 0 ${hex(T.inkColor,.05)}` }}>
      <div style={{ width:compact?48:56, height:compact?48:56, borderRadius:'50%', background:T.secondaryColor, display:'grid', placeItems:'center', flexShrink:0, color:T.inkColor }}><Icon.Bolt width={compact?22:26} height={compact?22:26}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:compact?15:16, color:T.inkColor, lineHeight:1.1 }}>Reorder the usual</div>
        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(T.inkColor,.6), marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{summary} · {last.when}</div>
      </div>
      <button onClick={onReorder} style={{ background:T.inkColor, color:'#fff', border:'none', borderRadius:999, padding:compact?'10px 14px':'12px 18px', fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, cursor:'pointer', whiteSpace:'nowrap', boxShadow:`0 4px 0 ${hex(T.inkColor,.25)}`, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <Icon.Bolt width="14" height="14"/> 1-tap
      </button>
    </section>
  );
}

// ── Loyalty Strip ──────────────────────────────────────────────────────────
function LoyaltyStrip({ viewport }: { viewport: Viewport }) {
  const compact = viewport === 'mobile';
  const { goal, current, reward, program } = MENU_DATA.loyalty;
  return (
    <section style={{ margin:compact?'12px 16px 0':'16px 28px 0', background:T.inkColor, color:'#fff', borderRadius:T.cornerRadius, padding:compact?14:16, overflow:'hidden', position:'relative' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ background:T.secondaryColor, color:T.inkColor, padding:'3px 10px', borderRadius:999, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>{program}</span>
        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, opacity:.85 }}><b>{goal - current}</b> more for a {reward.toLowerCase()}</div>
      </div>
      <div style={{ display:'flex', gap:compact?5:7 }}>
        {Array.from({ length: goal }).map((_,i) => {
          const stamped = i < current;
          return (
            <div key={i} style={{ flex:1, aspectRatio:'1', borderRadius:'50%', border:`1.5px dashed ${stamped?'transparent':'rgba(255,255,255,.3)'}`, background:stamped?(i===goal-1?T.accentColor:T.primaryColor):'transparent', display:'grid', placeItems:'center', transition:'all .3s' }}>
              {stamped ? (i===goal-1?<span style={{fontSize:compact?14:16}}>★</span>:<svg width="60%" height="60%" viewBox="0 0 24 24" fill="#fff"><ellipse cx="12" cy="12" rx="6" ry="9" transform="rotate(-20 12 12)"/><path d="M8 6 Q13 12 14 18" stroke="#3A2414" strokeWidth="1.3" fill="none" strokeLinecap="round" transform="rotate(-20 12 12)" opacity=".7"/></svg>) : <span style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:11, opacity:.5 }}>{i===goal-1?'★':i+1}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Cart Drawer ────────────────────────────────────────────────────────────
function CartDrawer({ open, onClose, lines, incLine, decLine, total, pickup }: {
  open: boolean; onClose: () => void; lines: CartLine[]; incLine: (lid: string) => void;
  decLine: (lid: string) => void; total: number; pickup: 'counter'|'curbside';
}) {
  const router = useRouter();
  if (!open) return null;

  const modSummary = (line: CartLine) => {
    if (!line.mods) return null;
    const m = line.mods; const parts: string[] = [];
    const md = MENU_DATA.modifiers;
    if (m.size)  parts.push(md.size.options.find(o => o.id === m.size)?.label ?? '');
    if (m.milk && m.milk !== 'whole') parts.push(md.milk.options.find(o => o.id === m.milk)?.label ?? '');
    if (m.sugar && m.sugar !== 'std') parts.push(`${md.sugar.options.find(o => o.id === m.sugar)?.label ?? ''} sugar`);
    if (m.notes) parts.push(`"${m.notes}"`);
    return parts.filter(Boolean).join(' · ') || null;
  };

  const handlePay = () => {
    try { localStorage.setItem('co_pending', JSON.stringify({ lines, pickup, total })); } catch { /* ignore */ }
    router.push('/checkout');
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(58,36,20,.4)' }}/>
      <div style={{ position:'relative', width:'min(460px,100%)', height:'100%', background:T.bgColor, display:'flex', flexDirection:'column', boxShadow:'-10px 0 40px rgba(58,36,20,.2)' }}>
        <div style={{ padding:'18px 20px', display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid ${hex(T.inkColor,.08)}` }}>
          <h2 style={{ margin:0, fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:T.inkColor }}>Your order</h2>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', cursor:'pointer', color:T.inkColor }}><Icon.X width="22" height="22"/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:10 }}>
          {lines.map(line => {
            const item = MENU_DATA.items.find(x => x.id === line.id);
            if (!item) return null;
            const sum = modSummary(line);
            return (
              <div key={line.lid} style={{ display:'flex', gap:12, alignItems:'center', background:'#fff', padding:12, borderRadius:T.cornerRadius-4, border:`1.5px solid ${hex(T.inkColor,.06)}` }}>
                <div style={{ width:52, height:52, borderRadius:14, background:hex(item.swatch,.15), display:'grid', placeItems:'center', flexShrink:0 }}><ItemThumb item={item} size={48}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, color:T.inkColor }}>{item.name}</div>
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
              <div style={{ opacity:.65, fontSize:12 }}>Shell Seksyen 13, PJ</div>
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

// ── Main App ───────────────────────────────────────────────────────────────
export default function MenuApp() {
  const viewport    = useViewport();
  const [activeCat, setActiveCat]  = useState('popular');
  const [pickup,    setPickup]     = useState<'counter'|'curbside'>('counter');
  const [cartOpen,  setCartOpen]   = useState(false);
  const [sheetItem, setSheetItem]  = useState<MenuItem|null>(null);
  const { lines, addLine, incLine, decLine, qtyFor, incById, decById, count, total } = useCart();

  const filtered = MENU_DATA.items.filter(i => i.cat === activeCat);

  const handleReorder = () => {
    MENU_DATA.lastOrder.items.forEach(li => {
      const item = MENU_DATA.items.find(x => x.id === li.id);
      if (!item) return;
      if (li.mods) {
        const md = MENU_DATA.modifiers;
        const sd = md.size.options.find(o => o.id === li.mods?.size)?.delta ?? 0;
        const md2 = md.milk.options.find(o => o.id === li.mods?.milk)?.delta ?? 0;
        addLine(li.id, li.qty, { size:'s', milk:'whole', sugar:'std', ice:'std', notes:'', ...li.mods }, item.price + sd + md2);
      } else {
        addLine(li.id, li.qty, null, item.price);
      }
    });
    setCartOpen(true);
  };

  return (
    <div style={{ background:T.bgColor, minHeight:'100vh', color:T.inkColor, fontFamily:"'Nunito',system-ui" }}>
      <Header onCartClick={() => setCartOpen(true)} cartCount={count} viewport={viewport}/>
      <Hero viewport={viewport}/>
      {T.showReorder && <ReorderTile viewport={viewport} onReorder={handleReorder}/>}
      <PickupBar viewport={viewport} pickup={pickup} setPickup={setPickup}/>
      {T.showLoyalty && <LoyaltyStrip viewport={viewport}/>}
      <CatBar cats={MENU_DATA.categories} active={activeCat} setActive={setActiveCat} viewport={viewport}/>
      <main style={{ padding:viewport==='mobile'?'0 16px 100px':'0 28px 40px', display:'grid', gridTemplateColumns:viewport==='desktop'?'1fr 1fr':'1fr', gap:10 }}>
        {filtered.map(it => (
          <ItemCard key={it.id} item={it} qty={qtyFor(it.id)} onAdd={() => incById(it.id)} onSub={() => decById(it.id)} onCustomize={() => setSheetItem(it)} viewport={viewport}/>
        ))}
      </main>
      <CartBar count={count} total={total} onClick={() => setCartOpen(true)} viewport={viewport}/>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} lines={lines} incLine={incLine} decLine={decLine} total={total} pickup={pickup}/>
      <ModifierSheet item={sheetItem} open={!!sheetItem} onClose={() => setSheetItem(null)} onConfirm={sel => { if (sheetItem) { addLine(sheetItem.id, sel.qty, { size:sel.size, milk:sel.milk, sugar:sel.sugar, ice:sel.ice, notes:sel.notes }, sel.unitPrice); setSheetItem(null); } }}/>
    </div>
  );
}