/* global React, ReactDOM */
const { useState, useEffect, useMemo, useRef } = React;

// ============= TWEAKS =============
const TWEAKS = /*EDITMODE-BEGIN*/{
  "primaryColor": "#F58220",
  "secondaryColor": "#F5D77A",
  "accentColor": "#F47B8E",
  "bgColor": "#FFF6E8",
  "inkColor": "#3A2414",
  "mascotProminence": "supporting",
  "cornerRadius": 22,
  "density": "roomy",
  "showStickers": true,
  "showReorder": true,
  "showLoyalty": true
} /*EDITMODE-END*/;

// Expose for index to hydrate
window.CO_TWEAKS = TWEAKS;

// ============= ICONS =============
const Icon = {
  Cart: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.5L20.5 8H6" /></svg>,
  Plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  Minus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...p}><path d="M5 12h14" /></svg>,
  Clock: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  Pin: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" /></svg>,
  Search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  Bolt: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></svg>,
  Check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5L20 7" /></svg>,
  Car: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 13l2-6h14l2 6M5 13h14v5H5z" /><circle cx="8" cy="18" r="1.5" /><circle cx="16" cy="18" r="1.5" /></svg>,
  Walk: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="13" cy="4" r="2" /><path d="M9 22l3-8 3 3v5M9 14l-3-3 4-5 3 3 3 1" /></svg>,
  X: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
};

// ============= LITTLE UI BITS =============
function Sticker({ children, rotate = -6, bg, color }) {
  return (
    <span style={{
      display: "inline-block",
      transform: `rotate(${rotate}deg)`,
      background: bg,
      color: color,
      padding: "4px 10px",
      borderRadius: 999,
      fontFamily: "'Baloo 2', system-ui",
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: ".02em",
      boxShadow: "2px 2px 0 rgba(58,36,20,.15)",
      whiteSpace: "nowrap"
    }}>{children}</span>);

}

function Drink({ swatch, size = 72 }) {
  // Playful stylized cup placeholder when there's no real photo
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 72 72" aria-hidden>
      <defs>
        <clipPath id={`cup-${swatch}`}>
          <path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z" />
        </clipPath>
      </defs>
      {/* saucer */}
      <ellipse cx="36" cy="63" rx="26" ry="4" fill="rgba(58,36,20,.08)" />
      {/* cup body */}
      <path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z" fill="#fff" stroke="#3A2414" strokeWidth="2.2" />
      {/* liquid */}
      <rect x="16" y="22" width="40" height="10" fill={swatch} clipPath={`url(#cup-${swatch})`} />
      <ellipse cx="36" cy="23" rx="20" ry="3.2" fill={swatch} />
      <ellipse cx="36" cy="22" rx="20" ry="3.2" fill="none" stroke="#3A2414" strokeWidth="2.2" />
      {/* handle */}
      <path d="M56 28 q10 2 10 10 q0 8 -10 10" fill="none" stroke="#3A2414" strokeWidth="2.2" strokeLinecap="round" />
      {/* steam */}
      <path d="M28 12 q3 -4 0 -8 M36 12 q3 -4 0 -8 M44 12 q3 -4 0 -8" fill="none" stroke="#3A2414" strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </svg>);

}

function Pastry({ swatch, size = 72 }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 72 72" aria-hidden>
      <ellipse cx="36" cy="60" rx="24" ry="3" fill="rgba(58,36,20,.08)" />
      <path d="M12 40 q0 -18 24 -18 q24 0 24 18 q0 14 -24 14 q-24 0 -24 -14z" fill={swatch} stroke="#3A2414" strokeWidth="2.2" />
      <path d="M20 38 q8 -6 16 -6 q8 0 16 6" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
      <path d="M22 45 q6 -4 14 -4 q8 0 14 4" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
      <circle cx="28" cy="34" r="1.6" fill="#3A2414" opacity=".5" />
      <circle cx="42" cy="36" r="1.6" fill="#3A2414" opacity=".5" />
    </svg>);

}

function ItemThumb({ item, size = 72 }) {
  return item.cat === "pastry" ? <Pastry swatch={item.swatch} size={size} /> : <Drink swatch={item.swatch} size={size} />;
}

// ============= ORDER STORE =============
// Line items support modifiers. Each line: { lid, id, qty, mods, unitPrice }
function useCart() {
  const [lines, setLines] = useState([]);

  const modKey = (mods) => JSON.stringify(mods || {});

  const addLine = (id, qty = 1, mods = null, unitPriceOverride = null) => {
    const item = window.CO_DATA.items.find((x) => x.id === id);
    if (!item) return;
    const unitPrice = unitPriceOverride != null ? unitPriceOverride : item.price;
    setLines((prev) => {
      // merge with existing line if same id + same mods
      const key = modKey(mods);
      const idx = prev.findIndex((l) => l.id === id && modKey(l.mods) === key);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { lid: Math.random().toString(36).slice(2, 9), id, qty, mods, unitPrice }];
    });
  };

  const incLine = (lid) => setLines((prev) => prev.map((l) => l.lid === lid ? { ...l, qty: l.qty + 1 } : l));
  const decLine = (lid) => setLines((prev) => prev.flatMap((l) => l.lid === lid ? l.qty - 1 <= 0 ? [] : [{ ...l, qty: l.qty - 1 }] : [l]));
  const clear = () => setLines([]);

  // simple id-based lookups (for item cards)
  const qtyFor = (id) => lines.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);
  const incById = (id) => {
    // bump the first line matching id (drinks w/ mods not supported via card +)
    const idx = lines.findIndex((l) => l.id === id);
    if (idx >= 0) incLine(lines[idx].lid);else addLine(id, 1);
  };
  const decById = (id) => {
    const idx = lines.findIndex((l) => l.id === id);
    if (idx >= 0) decLine(lines[idx].lid);
  };

  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return { lines, addLine, incLine, decLine, clear, qtyFor, incById, decById, count, total };
}

// ============= HEADER (compact, with pickup pill + ETA inline) =============
function Header({ tweaks, onCartClick, cartCount, viewport, pickup, setPickup, etaMin, onLoyaltyClick, loyaltyCurrent, loyaltyGoal }) {
  const compact = viewport === "mobile";
  const PickupIcon = pickup === "car" ? Icon.Car : Icon.Walk;
  const togglePickup = () => setPickup(pickup === "car" ? "counter" : "car");
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20,
      background: tweaks.bgColor,
      borderBottom: `1px solid ${hex(tweaks.inkColor, .08)}`,
      padding: compact ? "10px 14px" : "14px 24px",
      display: "flex", alignItems: "center", gap: 10
    }}>
      <img src="assets/co-logo.png" alt="Coffee Oasis" style={{ ...{
          height: compact ? 38 : 44, width: "auto", objectFit: "contain", flexShrink: 0
        }, height: "50px" }} />

      {/* Pickup pill — tap to toggle counter / curbside, shows ETA */}
      <button onClick={togglePickup} style={{ ...{
          marginLeft: compact ? 4 : 10,
          display: "flex", alignItems: "center", gap: 6,
          padding: compact ? "6px 10px 6px 8px" : "8px 14px 8px 10px",
          borderRadius: 999,
          border: `1.5px solid ${hex(tweaks.inkColor, .12)}`,
          background: "#fff", color: tweaks.inkColor,
          fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: compact ? 12 : 13,
          cursor: "pointer",
          whiteSpace: "nowrap"
        }, fontSize: "1px" }}>
        <PickupIcon width={compact ? 14 : 16} height={compact ? 14 : 16} />
        <span style={{ fontSize: "1px" }}>{pickup === "car" ? "Curbside" : "Counter"}</span>
        <span style={{ opacity: .35, fontSize: 11, margin: "0 2px" }}>·</span>
        <Icon.Clock width={compact ? 12 : 14} height={compact ? 12 : 14} />
        <span style={{ color: tweaks.primaryColor }}>~{etaMin}m</span>
      </button>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {/* Loyalty mini chip */}
        {onLoyaltyClick &&
        <button onClick={onLoyaltyClick} aria-label="Stamps" style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: compact ? "6px 10px" : "8px 12px",
          borderRadius: 999,
          background: tweaks.secondaryColor, color: tweaks.inkColor,
          border: "none",
          fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: compact ? 12 : 13,
          cursor: "pointer", whiteSpace: "nowrap"
        }}>
            <span style={{ fontSize: 13 }}>★</span>
            {loyaltyCurrent}/{loyaltyGoal}
          </button>
        }

        <button onClick={onCartClick} aria-label="Cart" style={{
          position: "relative",
          background: tweaks.inkColor, color: "#fff",
          border: "none", borderRadius: 999,
          padding: compact ? "8px 12px" : "10px 16px",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: compact ? 13 : 14,
          cursor: "pointer"
        }}>
          <Icon.Cart width={compact ? 16 : 18} height={compact ? 16 : 18} />
          {cartCount > 0 &&
          <span style={{
            background: tweaks.primaryColor, color: "#fff",
            borderRadius: 999, padding: "1px 7px",
            fontSize: 11, fontWeight: 800,
            border: "2px solid #fff",
            position: "absolute", top: -5, right: -5,
            minWidth: 18, textAlign: "center"
          }}>{cartCount}</span>
          }
        </button>
      </div>
    </header>);

}

// ============= GREETING BAND (slim, takes the hero's place) =============
function GreetingBand({ tweaks, viewport, hasReorder, onReorder, lastSummary }) {
  const compact = viewport === "mobile";
  const showMascot = tweaks.mascotProminence !== "hidden";
  return (
    <section style={{
      margin: compact ? "8px 14px 0" : "12px 24px 0",
      background: `linear-gradient(135deg, ${tweaks.primaryColor} 0%, #FF9A3D 100%)`,
      borderRadius: tweaks.cornerRadius,
      padding: compact ? "10px 12px" : "12px 16px",
      display: "flex", alignItems: "center", gap: compact ? 10 : 14,
      color: "#fff",
      position: "relative", overflow: "hidden", height: "100px"
    }}>
      {showMascot &&
      <img src="assets/co-mascot.png" alt=""
      style={{ ...{
          width: compact ? 44 : 56, height: compact ? 44 : 56,
          objectFit: "contain", flexShrink: 0,
          transform: "rotate(-4deg)",
          filter: "drop-shadow(0 4px 0 rgba(58,36,20,.18))"
        }, height: "90px", width: "90px", objectFit: "contain" }} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...{
            fontFamily: "'Baloo 2', system-ui", fontWeight: 800,
            fontSize: compact ? 16 : 18, lineHeight: 1.1
          }, fontSize: "22px", lineHeight: "1.4" }}>{hasReorder ? "Welcome back ✨" : "Coffee, sorted."}</div>
        <div style={{ ...{
            fontFamily: "'Nunito', system-ui", fontSize: compact ? 12 : 13,
            opacity: .92, marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
          }, fontSize: "16px" }}>{hasReorder ? lastSummary : "Order ahead, skip the line."}</div>
      </div>
      {hasReorder &&
      <button onClick={onReorder} style={{
        background: "#fff", color: tweaks.primaryColor,
        border: "none", borderRadius: 999,
        padding: compact ? "7px 12px" : "9px 16px",
        fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: compact ? 12 : 13,
        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 5
      }}>
          <Icon.Bolt width="12" height="12" /> Reorder
        </button>
      }
    </section>);

}

// ============= PICKUP BAR =============
function PickupBar({ tweaks, viewport, pickup, setPickup, etaMin }) {
  const compact = viewport === "mobile";
  const options = [
  { id: "counter", label: "At counter", icon: Icon.Walk, sub: "Walk in" },
  { id: "car", label: "Curbside", icon: Icon.Car, sub: "We bring it out" }];

  return (
    <div style={{
      margin: compact ? "12px 16px 0" : "16px 28px 0",
      background: "#fff",
      border: `1.5px solid ${hex(tweaks.inkColor, .08)}`,
      borderRadius: tweaks.cornerRadius,
      padding: compact ? 10 : 12,
      display: "flex", alignItems: "center", gap: 10,
      flexWrap: compact ? "wrap" : "nowrap"
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px",
        fontFamily: "'Nunito', system-ui", fontWeight: 700, fontSize: 13,
        color: tweaks.inkColor, whiteSpace: "nowrap"
      }}>
        <Icon.Clock width="16" height="16" /> Pickup in ~{etaMin} min
      </div>
      <div style={{ display: "flex", gap: 6, flex: 1, minWidth: compact ? "100%" : 0 }}>
        {options.map((o) => {
          const active = pickup === o.id;
          const I = o.icon;
          return (
            <button key={o.id} onClick={() => setPickup(o.id)} style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 12px",
              borderRadius: tweaks.cornerRadius - 6,
              border: `1.5px solid ${active ? tweaks.inkColor : hex(tweaks.inkColor, .1)}`,
              background: active ? tweaks.inkColor : "#fff",
              color: active ? "#fff" : tweaks.inkColor,
              fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14,
              cursor: "pointer",
              transition: "all .15s"
            }}>
              <I width="18" height="18" /> {o.label}
              {!compact && <span style={{ opacity: .6, fontWeight: 500, fontSize: 12 }}>· {o.sub}</span>}
            </button>);

        })}
      </div>
    </div>);

}

// ============= CATEGORY CHIPS =============
function CatBar({ tweaks, cats, active, setActive, viewport }) {
  const compact = viewport === "mobile";
  return (
    <div style={{
      position: "sticky", top: compact ? 52 : 68, zIndex: 10,
      background: `linear-gradient(to bottom, ${tweaks.bgColor} 70%, transparent)`,
      padding: compact ? "10px 14px 8px" : "12px 24px 10px"
    }}>
      <div style={{
        display: "flex", gap: 6, overflowX: "auto",
        scrollbarWidth: "none", fontSize: "18px"
      }} className="hide-scroll">
        {cats.map((c) => {
          const on = active === c.id;
          return (
            <button key={c.id} onClick={() => setActive(c.id)} style={{
              flexShrink: 0,
              padding: "7px 14px",
              borderRadius: 999,
              border: "none",
              background: on ? tweaks.inkColor : "#fff",
              color: on ? "#fff" : tweaks.inkColor,
              fontFamily: "'Baloo 2', system-ui", fontWeight: 700,
              cursor: "pointer",
              boxShadow: on ? `0 3px 0 ${hex(tweaks.inkColor, .25)}` : `0 1px 0 ${hex(tweaks.inkColor, .06)}`,
              transition: "all .12s", fontSize: "18px"
            }}>{c.label}</button>);

        })}
      </div>
    </div>);

}

// ============= ITEM CARD =============
function ItemCard({ item, qty, onAdd, onSub, onCustomize, tweaks, viewport }) {
  const isDrink = window.CO_DATA.drinkCats.includes(item.cat);
  return (
    <div style={{
      background: "#fff",
      borderRadius: tweaks.cornerRadius,
      border: `1.5px solid ${hex(tweaks.inkColor, .06)}`,
      boxShadow: `0 4px 0 ${hex(tweaks.inkColor, .05)}`,
      position: "relative",
      display: "flex", flexDirection: "column",
      overflow: "hidden"
    }}>
      {/* IMAGE AREA — square, big */}
      <div style={{ ...{
          width: "100%", aspectRatio: "1",
          background: `radial-gradient(circle at 50% 55%, ${hex(item.swatch, .28)}, ${hex(item.swatch, .06)} 70%)`,
          display: "grid", placeItems: "center",
          position: "relative"
        }, background: "radial-gradient(circle at 50% 55%, rgba(200, 138, 84, 0.28), rgba(200, 138, 84, 0.06) 70%) 0% 0% / cover" }}>
        <div style={{ width: "78%", aspectRatio: "1", display: "grid", placeItems: "center" }}>
          <svg viewBox="0 0 72 72" style={{ width: "100%", height: "100%" }}>
            {item.cat === "pastry" ?
            <>
                <ellipse cx="36" cy="60" rx="24" ry="3" fill="rgba(58,36,20,.08)" />
                <path d="M12 40 q0 -18 24 -18 q24 0 24 18 q0 14 -24 14 q-24 0 -24 -14z" fill={item.swatch} stroke="#3A2414" strokeWidth="2.2" />
                <path d="M20 38 q8 -6 16 -6 q8 0 16 6" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
                <path d="M22 45 q6 -4 14 -4 q8 0 14 4" fill="none" stroke="#3A2414" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
                <circle cx="28" cy="34" r="1.6" fill="#3A2414" opacity=".5" />
                <circle cx="42" cy="36" r="1.6" fill="#3A2414" opacity=".5" />
              </> :

            <>
                <ellipse cx="36" cy="63" rx="26" ry="4" fill="rgba(58,36,20,.08)" />
                <path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z" fill="#fff" stroke="#3A2414" strokeWidth="2.2" />
                <ellipse cx="36" cy="22" rx="20" ry="3.2" fill={item.swatch} stroke="#3A2414" strokeWidth="2.2" />
                <path d="M56 28 q10 2 10 10 q0 8 -10 10" fill="none" stroke="#3A2414" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M28 12 q3 -4 0 -8 M36 12 q3 -4 0 -8 M44 12 q3 -4 0 -8" fill="none" stroke="#3A2414" strokeWidth="2" strokeLinecap="round" opacity=".5" />
              </>
            }
          </svg>
        </div>
        {item.tag &&
        <div style={{ position: "absolute", top: 8, left: 8 }}>
            <Sticker bg={tweaks.secondaryColor} color={tweaks.inkColor} rotate={-3}>{item.tag}</Sticker>
          </div>
        }
      </div>

      {/* CONTENT */}
      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{
          fontFamily: "'Baloo 2', system-ui", fontWeight: 700,
          fontSize: 15, color: tweaks.inkColor,
          lineHeight: 1.15,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          minHeight: 34
        }}>{item.name}</div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4
        }}>
          <span style={{
            fontFamily: "'Baloo 2', system-ui", fontWeight: 800,
            fontSize: 16, color: tweaks.inkColor
          }}>RM {item.price.toFixed(2)}</span>

          {qty > 0 && !isDrink ?
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: tweaks.inkColor, color: "#fff",
            borderRadius: 999, padding: 3
          }}>
              <button onClick={onSub} aria-label="Decrease" style={qtyBtn("#fff", tweaks.inkColor, 24)}><Icon.Minus width="13" height="13" /></button>
              <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, minWidth: 12, textAlign: "center", fontSize: 13 }}>{qty}</span>
              <button onClick={onAdd} aria-label="Increase" style={qtyBtn("#fff", tweaks.inkColor, 24)}><Icon.Plus width="13" height="13" /></button>
            </div> :
          isDrink ?
          <button onClick={onCustomize} aria-label={`Customize ${item.name}`} style={{
            position: "relative",
            width: 36, height: 36, borderRadius: "50%",
            border: "none",
            background: tweaks.primaryColor, color: "#fff",
            display: "grid", placeItems: "center",
            cursor: "pointer",
            boxShadow: `0 3px 0 ${hex(tweaks.primaryColor, .4)}`,
            flexShrink: 0
          }}>
              <Icon.Plus width="18" height="18" />
              {qty > 0 &&
            <span style={{
              position: "absolute", top: -4, right: -4,
              background: tweaks.inkColor, color: "#fff",
              borderRadius: 999, padding: "1px 5px",
              fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 10,
              border: "2px solid #fff"
            }}>{qty}</span>
            }
            </button> :

          <button onClick={onAdd} aria-label={`Add ${item.name}`} style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "none",
            background: tweaks.primaryColor, color: "#fff",
            display: "grid", placeItems: "center",
            cursor: "pointer",
            boxShadow: `0 3px 0 ${hex(tweaks.primaryColor, .4)}`,
            flexShrink: 0
          }}><Icon.Plus width="18" height="18" /></button>
          }
        </div>
      </div>
    </div>);

}

function qtyBtn(bg, fg, size = 30) {
  return {
    width: size, height: size, borderRadius: "50%",
    background: bg, color: fg, border: "none",
    display: "grid", placeItems: "center",
    cursor: "pointer"
  };
}

// ============= CART BAR (sticky bottom) =============
function CartBar({ tweaks, count, total, onClick, viewport }) {
  if (count === 0) return null;
  const compact = viewport === "mobile";
  return (
    <div style={{
      position: "sticky", bottom: compact ? 12 : 20,
      margin: compact ? "0 16px 12px" : "0 28px 20px",
      marginTop: 20,
      zIndex: 15
    }}>
      <button onClick={onClick} style={{
        width: "100%",
        padding: compact ? "14px 18px" : "16px 22px",
        background: tweaks.inkColor,
        color: "#fff",
        border: "none",
        borderRadius: tweaks.cornerRadius,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: compact ? 15 : 16,
        cursor: "pointer",
        boxShadow: `0 8px 0 ${hex(tweaks.inkColor, .25)}, 0 18px 40px ${hex(tweaks.inkColor, .2)}`
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: tweaks.primaryColor, padding: "2px 10px", borderRadius: 999,
            fontSize: 14
          }}>{count}</span>
          Review order
        </span>
        <span>RM {total.toFixed(2)} →</span>
      </button>
    </div>);

}

// ============= CART DRAWER =============
function CartDrawer({ tweaks, open, onClose, lines, incLine, decLine, total, pickup, onComplete }) {
  const [step, setStep] = useState("review"); // review | confirm
  useEffect(() => {if (!open) setStep("review");}, [open]);
  if (!open) return null;

  const modSummary = (line) => {
    if (!line.mods) return null;
    const m = line.mods;
    const parts = [];
    const mods = window.CO_DATA.modifiers;
    if (m.size) parts.push(mods.size.options.find((o) => o.id === m.size)?.label);
    if (m.milk && m.milk !== "whole") parts.push(mods.milk.options.find((o) => o.id === m.milk)?.label);
    if (m.sugar && m.sugar !== "std") parts.push(`${mods.sugar.options.find((o) => o.id === m.sugar)?.label} sugar`);
    if (m.ice && m.ice !== "std" && window.CO_DATA.items.find((x) => x.id === line.id)?.cat === "cold")
    parts.push(`${mods.ice.options.find((o) => o.id === m.ice)?.label} ice`);
    if (m.notes) parts.push(`“${m.notes}”`);
    return parts.filter(Boolean).join(" · ");
  };

  const etaText = pickup === "car" ? "Pull up to the counter window" : "Collect at the counter";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(58,36,20,.4)" }} />
      <div style={{
        position: "relative", width: "min(460px, 100%)", height: "100%",
        background: tweaks.bgColor, display: "flex", flexDirection: "column",
        boxShadow: "-10px 0 40px rgba(58,36,20,.2)"
      }}>
        <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${hex(tweaks.inkColor, .08)}` }}>
          <h2 style={{ margin: 0, fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 22, color: tweaks.inkColor }}>
            {step === "review" ? "Your order" : "You're all set!"}
          </h2>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: tweaks.inkColor }}><Icon.X width="22" height="22" /></button>
        </div>

        {step === "review" &&
        <>
            <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {lines.map((line) => {
              const item = window.CO_DATA.items.find((x) => x.id === line.id);
              if (!item) return null;
              const sum = modSummary(line);
              return (
                <div key={line.lid} style={{
                  display: "flex", gap: 12, alignItems: "center",
                  background: "#fff", padding: 12, borderRadius: tweaks.cornerRadius - 4,
                  border: `1.5px solid ${hex(tweaks.inkColor, .06)}`
                }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: hex(item.swatch, .15), display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <ItemThumb item={item} size={48} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, color: tweaks.inkColor }}>{item.name}</div>
                      {sum &&
                    <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 12, color: hex(tweaks.inkColor, .65), marginTop: 2, lineHeight: 1.3 }}>{sum}</div>
                    }
                      <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 13, color: hex(tweaks.inkColor, .7), marginTop: 3 }}>RM {line.unitPrice.toFixed(2)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: tweaks.bgColor, borderRadius: 999, padding: 4 }}>
                      <button onClick={() => decLine(line.lid)} style={qtyBtn("#fff", tweaks.inkColor)}><Icon.Minus width="14" height="14" /></button>
                      <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, minWidth: 14, textAlign: "center" }}>{line.qty}</span>
                      <button onClick={() => incLine(line.lid)} style={qtyBtn("#fff", tweaks.inkColor)}><Icon.Plus width="14" height="14" /></button>
                    </div>
                  </div>);

            })}

              <div style={{
              marginTop: 8, padding: 14,
              background: "#fff", borderRadius: tweaks.cornerRadius - 4,
              border: `1.5px dashed ${hex(tweaks.inkColor, .15)}`,
              display: "flex", alignItems: "center", gap: 10,
              fontFamily: "'Nunito', system-ui", fontSize: 14, color: tweaks.inkColor
            }}>
                {pickup === "car" ? <Icon.Car width="20" height="20" /> : <Icon.Walk width="20" height="20" />}
                <div>
                  <div style={{ fontWeight: 700 }}>{pickup === "car" ? "Curbside pickup" : "Counter pickup"}</div>
                  <div style={{ opacity: .65, fontSize: 12 }}>{etaText} · Shell Seksyen 13, PJ</div>
                </div>
              </div>
            </div>

            <div style={{ padding: 20, borderTop: `1px solid ${hex(tweaks.inkColor, .08)}`, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontFamily: "'Nunito', system-ui", fontSize: 14, color: hex(tweaks.inkColor, .6) }}>
                <span>Subtotal</span><span>RM {total.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 22, color: tweaks.inkColor, marginBottom: 12 }}>
                <span>Total</span><span>RM {total.toFixed(2)}</span>
              </div>
              <button onClick={() => setStep("confirm")} style={{
              width: "100%", padding: "16px",
              background: tweaks.primaryColor, color: "#fff", border: "none",
              borderRadius: tweaks.cornerRadius,
              fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 17,
              cursor: "pointer",
              boxShadow: `0 6px 0 ${hex(tweaks.primaryColor, .4)}`
            }}>Pay with GrabPay →</button>
              <div style={{ textAlign: "center", marginTop: 8, fontFamily: "'Nunito', system-ui", fontSize: 12, color: hex(tweaks.inkColor, .55) }}>
                Or pay with FPX · Boost · Touch 'n Go
              </div>
            </div>
          </>
        }

        {step === "confirm" &&
        <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
            <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: tweaks.primaryColor, color: "#fff",
            display: "grid", placeItems: "center",
            boxShadow: `0 6px 0 ${hex(tweaks.primaryColor, .4)}`
          }}><Icon.Check width="40" height="40" /></div>
            <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 26, color: tweaks.inkColor, lineHeight: 1 }}>
              Order #A2183
            </div>
            <img src="assets/co-mascot.png" alt="" style={{ width: 140, transform: "rotate(-4deg)", filter: "drop-shadow(0 8px 0 rgba(58,36,20,.15))" }} />
            <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 15, color: tweaks.inkColor, maxWidth: 300 }}>
              We're on it! Your order will be ready at the counter in <b>~4 minutes</b>. We'll ping you when it's up.
            </div>
            <div style={{
            background: "#fff", padding: 14,
            borderRadius: tweaks.cornerRadius - 4,
            border: `1.5px solid ${hex(tweaks.inkColor, .08)}`,
            width: "100%", textAlign: "left", marginTop: 6
          }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'Nunito', system-ui", fontSize: 14, color: tweaks.inkColor }}>
                <Icon.Pin width="18" height="18" />
                <div>
                  <div style={{ fontWeight: 700 }}>Coffee Oasis · Shell Seksyen 13</div>
                  <div style={{ opacity: .6, fontSize: 12 }}>Jalan Universiti, 46200 Petaling Jaya</div>
                </div>
              </div>
            </div>
            {tweaks.showLoyalty !== false && window.CO_ConfirmLoyaltyBadge &&
          React.createElement(window.CO_ConfirmLoyaltyBadge, { tweaks })
          }
          </div>
        }
      </div>
    </div>);

}

// ============= MENU VIEW =============
function Menu({ tweaks, viewport }) {
  const [activeCat, setActiveCat] = useState("popular");
  const [pickup, setPickup] = useState("counter");
  const [cartOpen, setCartOpen] = useState(false);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState(null);
  const { lines, addLine, incLine, decLine, qtyFor, incById, decById, count, total } = useCart();
  const filtered = window.CO_DATA.items.filter((i) => i.cat === activeCat);

  const handleReorder = () => {
    const last = window.CO_DATA.lastOrder;
    last.items.forEach((li) => {
      const item = window.CO_DATA.items.find((x) => x.id === li.id);
      if (!item) return;
      if (li.mods) {
        const mods = window.CO_DATA.modifiers;
        const sizeDelta = mods.size.options.find((o) => o.id === li.mods.size)?.delta || 0;
        const milkDelta = mods.milk.options.find((o) => o.id === li.mods.milk)?.delta || 0;
        addLine(li.id, li.qty, { size: "s", milk: "whole", sugar: "std", ice: "std", notes: "", ...li.mods }, item.price + sizeDelta + milkDelta);
      } else {
        addLine(li.id, li.qty, null, item.price);
      }
    });
    setCartOpen(true);
  };

  const handleSheetConfirm = (sel) => {
    addLine(sheetItem.id, sel.qty, {
      size: sel.size, milk: sel.milk, sugar: sel.sugar, ice: sel.ice, notes: sel.notes
    }, sel.unitPrice);
    setSheetItem(null);
  };

  return (
    <div style={{ background: tweaks.bgColor, minHeight: "100%", color: tweaks.inkColor, fontFamily: "'Nunito', system-ui" }}>
      <Header
        tweaks={tweaks}
        onCartClick={() => setCartOpen(true)}
        cartCount={count}
        viewport={viewport}
        pickup={pickup} setPickup={setPickup} etaMin={4}
        onLoyaltyClick={tweaks.showLoyalty !== false ? () => setLoyaltyOpen(true) : null}
        loyaltyCurrent={window.CO_DATA.loyalty.current}
        loyaltyGoal={window.CO_DATA.loyalty.goal} />
      
      {tweaks.showReorder !== false && window.CO_DATA.lastOrder &&
      <GreetingBand
        tweaks={tweaks} viewport={viewport}
        hasReorder={true}
        onReorder={handleReorder}
        lastSummary={window.CO_DATA.lastOrder.items.map((li) => `${li.qty}× ${window.CO_DATA.items.find((x) => x.id === li.id)?.name}`).join(", ")} />

      }
      <CatBar tweaks={tweaks} cats={window.CO_DATA.categories} active={activeCat} setActive={setActiveCat} viewport={viewport} />
      <main style={{
        padding: viewport === "mobile" ? "0 14px 100px" : "0 24px 40px",
        display: "grid",
        gridTemplateColumns: viewport === "mobile" ? "1fr 1fr" : viewport === "desktop" ? "1fr 1fr" : "1fr 1fr",
        gap: 10
      }}>
        {filtered.map((it) =>
        <ItemCard
          key={it.id}
          item={it}
          qty={qtyFor(it.id)}
          onAdd={() => incById(it.id)}
          onSub={() => decById(it.id)}
          onCustomize={() => setSheetItem(it)}
          tweaks={tweaks}
          viewport={viewport} />

        )}
      </main>
      <CartBar tweaks={tweaks} count={count} total={total} onClick={() => setCartOpen(true)} viewport={viewport} />
      <CartDrawer tweaks={tweaks} open={cartOpen} onClose={() => setCartOpen(false)} lines={lines} incLine={incLine} decLine={decLine} total={total} pickup={pickup} />
      {window.CO_LoyaltySheet && React.createElement(window.CO_LoyaltySheet, { tweaks, open: loyaltyOpen, onClose: () => setLoyaltyOpen(false) })}
      {window.CO_ModifierSheet && React.createElement(window.CO_ModifierSheet, {
        tweaks, item: sheetItem, open: !!sheetItem,
        onClose: () => setSheetItem(null),
        onConfirm: handleSheetConfirm
      })}
    </div>);

}

// ============= UTIL =============
function hex(h, a = 1) {
  // h is #RRGGBB
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

Object.assign(window, { CO_App: Menu, CO_Icon: Icon, CO_hex: hex });