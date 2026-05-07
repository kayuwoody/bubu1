/* global React, CO_Icon, CO_hex */
// Coffee Oasis — next-step components:
//  - ReorderTile: one-tap reorder of last order
//  - ModifierSheet: slide-up sheet for size / milk / sugar / ice / notes
//  - LoyaltyStrip: stamp card progress
//  - ConfirmLoyalty: stamp animation on confirmation

const { useState, useEffect, useMemo } = React;
const Icon = CO_Icon;
const hex = CO_hex;

// ============= REORDER TILE =============
function ReorderTile({ tweaks, viewport, onReorder }) {
  const compact = viewport === "mobile";
  const last = window.CO_DATA.lastOrder;
  if (!last) return null;
  const items = last.items.map(li => ({
    ...li,
    item: window.CO_DATA.items.find(x => x.id === li.id),
  }));
  const summary = items.map(li => `${li.qty}× ${li.item?.name}`).join(", ");

  return (
    <section style={{
      margin: compact ? "12px 16px 0" : "16px 28px 0",
      background: "#fff",
      border: `1.5px solid ${hex(tweaks.inkColor, .08)}`,
      borderRadius: tweaks.cornerRadius,
      padding: compact ? 12 : 14,
      display: "flex", alignItems: "center", gap: compact ? 10 : 14,
      boxShadow: `0 4px 0 ${hex(tweaks.inkColor, .05)}`,
    }}>
      <div style={{
        width: compact ? 48 : 56, height: compact ? 48 : 56,
        borderRadius: "50%",
        background: tweaks.secondaryColor,
        display: "grid", placeItems: "center",
        flexShrink: 0,
        color: tweaks.inkColor,
      }}>
        <Icon.Bolt width={compact ? 22 : 26} height={compact ? 22 : 26}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Baloo 2', system-ui", fontWeight: 800,
          fontSize: compact ? 15 : 16, color: tweaks.inkColor, lineHeight: 1.1,
        }}>Reorder the usual</div>
        <div style={{
          fontFamily: "'Nunito', system-ui", fontSize: 12,
          color: hex(tweaks.inkColor, .6), marginTop: 3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{summary} · {last.when}</div>
      </div>
      <button onClick={onReorder} style={{
        background: tweaks.inkColor, color: "#fff",
        border: "none", borderRadius: 999,
        padding: compact ? "10px 14px" : "12px 18px",
        fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14,
        cursor: "pointer", whiteSpace: "nowrap",
        boxShadow: `0 4px 0 ${hex(tweaks.inkColor, .25)}`,
        display: "flex", alignItems: "center", gap: 6,
        flexShrink: 0,
      }}>
        <Icon.Bolt width="14" height="14"/> 1-tap
      </button>
    </section>
  );
}

// ============= MODIFIER SHEET =============
function ModifierSheet({ tweaks, item, open, onClose, onConfirm, initial }) {
  const isCold = item?.cat === "cold";
  const mods = window.CO_DATA.modifiers;

  const defaults = useMemo(() => ({
    size: "s",
    milk: "whole",
    sugar: "std",
    ice: "std",
    notes: "",
    qty: 1,
  }), []);

  const [sel, setSel] = useState({ ...defaults, ...(initial || {}) });

  useEffect(() => {
    if (open) setSel({ ...defaults, ...(initial || {}) });
  }, [open, item?.id]); // eslint-disable-line

  if (!open || !item) return null;

  const sizeDelta = mods.size.options.find(o => o.id === sel.size)?.delta || 0;
  const milkDelta = mods.milk.options.find(o => o.id === sel.milk)?.delta || 0;
  const unitPrice = item.price + sizeDelta + milkDelta;
  const total = unitPrice * sel.qty;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(58,36,20,.45)" }}/>
      <div style={{
        position: "relative",
        width: "min(520px, 100%)", maxHeight: "92vh",
        background: tweaks.bgColor,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: "flex", flexDirection: "column",
        boxShadow: "0 -10px 40px rgba(58,36,20,.25)",
        animation: "coSheetIn .25s ease-out",
      }}>
        {/* grab handle */}
        <div style={{ padding: "10px 0 0", textAlign: "center" }}>
          <div style={{ width: 40, height: 4, background: hex(tweaks.inkColor, .2), borderRadius: 999, margin: "0 auto" }}/>
        </div>

        {/* header */}
        <div style={{ padding: "14px 20px 8px", display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{
            width: 70, height: 70, borderRadius: 18, flexShrink: 0,
            background: `radial-gradient(circle at 50% 55%, ${hex(item.swatch, .22)}, ${hex(item.swatch, .05)} 65%)`,
            display: "grid", placeItems: "center",
          }}>
            <ItemThumbInline item={item} size={60}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 22, color: tweaks.inkColor, lineHeight: 1.1 }}>{item.name}</div>
            <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 13, color: hex(tweaks.inkColor, .6), marginTop: 3 }}>{item.desc}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: tweaks.inkColor, alignSelf: "flex-start" }}><Icon.X width="22" height="22"/></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "4px 20px 12px" }}>
          <ModGroup label={mods.size.label} required>
            <ChipRow options={mods.size.options} value={sel.size} onChange={v=>setSel(s=>({...s, size: v}))} tweaks={tweaks} showDelta/>
          </ModGroup>

          <ModGroup label={mods.milk.label}>
            <ChipRow options={mods.milk.options} value={sel.milk} onChange={v=>setSel(s=>({...s, milk: v}))} tweaks={tweaks} showDelta/>
          </ModGroup>

          <ModGroup label={mods.sugar.label}>
            <ChipRow options={mods.sugar.options} value={sel.sugar} onChange={v=>setSel(s=>({...s, sugar: v}))} tweaks={tweaks}/>
          </ModGroup>

          {isCold && (
            <ModGroup label={mods.ice.label}>
              <ChipRow options={mods.ice.options} value={sel.ice} onChange={v=>setSel(s=>({...s, ice: v}))} tweaks={tweaks}/>
            </ModGroup>
          )}

          <ModGroup label={mods.notes.label}>
            <input
              value={sel.notes}
              onChange={e=>setSel(s=>({...s, notes: e.target.value}))}
              placeholder={mods.notes.placeholder}
              style={{
                width: "100%", padding: "12px 14px",
                fontFamily: "'Nunito', system-ui", fontSize: 14, color: tweaks.inkColor,
                background: "#fff",
                border: `1.5px solid ${hex(tweaks.inkColor, .1)}`,
                borderRadius: tweaks.cornerRadius - 8,
                outline: "none",
              }}
            />
          </ModGroup>
        </div>

        {/* footer */}
        <div style={{
          padding: "14px 20px 20px",
          borderTop: `1px solid ${hex(tweaks.inkColor, .08)}`,
          background: "#fff",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: tweaks.bgColor, borderRadius: 999, padding: 4,
          }}>
            <button onClick={()=>setSel(s=>({...s, qty: Math.max(1, s.qty-1)}))}
              style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", color: tweaks.inkColor, border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <Icon.Minus width="16" height="16"/>
            </button>
            <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, minWidth: 18, textAlign: "center", color: tweaks.inkColor }}>{sel.qty}</span>
            <button onClick={()=>setSel(s=>({...s, qty: s.qty+1}))}
              style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", color: tweaks.inkColor, border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <Icon.Plus width="16" height="16"/>
            </button>
          </div>
          <button onClick={()=>onConfirm({ ...sel, unitPrice })} style={{
            flex: 1, padding: "14px 18px",
            background: tweaks.primaryColor, color: "#fff",
            border: "none", borderRadius: tweaks.cornerRadius,
            fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 16,
            cursor: "pointer",
            boxShadow: `0 5px 0 ${hex(tweaks.primaryColor, .4)}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>Add to order</span>
            <span>RM {total.toFixed(2)}</span>
          </button>
        </div>
      </div>
      <style>{`@keyframes coSheetIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

function ModGroup({ label, required, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 6,
        fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14,
        color: "#3A2414", marginBottom: 8,
      }}>
        {label}
        {required && <span style={{ fontSize: 11, color: "#D9402F", fontWeight: 800 }}>Required</span>}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ options, value, onChange, tweaks, showDelta }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={()=>onChange(o.id)} style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: on ? `2px solid ${tweaks.inkColor}` : `1.5px solid ${hex(tweaks.inkColor, .12)}`,
            background: on ? tweaks.inkColor : "#fff",
            color: on ? "#fff" : tweaks.inkColor,
            fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 13,
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            {o.label}
            {showDelta && o.delta ? (
              <span style={{ opacity: .7, fontWeight: 600, fontSize: 11 }}>+RM{o.delta.toFixed(2)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// small duplicate of drink/pastry thumb so this file is standalone-ish
function ItemThumbInline({ item, size = 60 }) {
  // Use the same SVGs the app already renders by reaching into the exported component
  // Fallback: colored circle
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 72 72">
      {item.cat === "pastry" ? (
        <>
          <path d="M12 40 q0 -18 24 -18 q24 0 24 18 q0 14 -24 14 q-24 0 -24 -14z" fill={item.swatch} stroke="#3A2414" strokeWidth="2.2"/>
          <circle cx="28" cy="34" r="1.6" fill="#3A2414" opacity=".5"/>
          <circle cx="42" cy="36" r="1.6" fill="#3A2414" opacity=".5"/>
        </>
      ) : (
        <>
          <path d="M16 22 h40 l-3 34 a8 8 0 0 1 -8 7 h-18 a8 8 0 0 1 -8 -7 z" fill="#fff" stroke="#3A2414" strokeWidth="2.2"/>
          <ellipse cx="36" cy="23" rx="20" ry="3.2" fill={item.swatch}/>
          <ellipse cx="36" cy="22" rx="20" ry="3.2" fill="none" stroke="#3A2414" strokeWidth="2.2"/>
          <path d="M56 28 q10 2 10 10 q0 8 -10 10" fill="none" stroke="#3A2414" strokeWidth="2.2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}

// ============= LOYALTY STRIP =============
function LoyaltyStrip({ tweaks, viewport }) {
  const compact = viewport === "mobile";
  const { goal, current, reward, program } = window.CO_DATA.loyalty;
  const pct = (current / goal) * 100;
  return (
    <section style={{
      margin: compact ? "12px 16px 0" : "16px 28px 0",
      background: tweaks.inkColor,
      color: "#fff",
      borderRadius: tweaks.cornerRadius,
      padding: compact ? 14 : 16,
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{
          background: tweaks.secondaryColor, color: tweaks.inkColor,
          padding: "3px 10px", borderRadius: 999,
          fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 11,
          textTransform: "uppercase", letterSpacing: ".05em",
        }}>{program}</span>
        <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 13, opacity: .85 }}>
          <b>{goal - current}</b> more for a {reward.toLowerCase()}
        </div>
      </div>
      <div style={{ display: "flex", gap: compact ? 5 : 7 }}>
        {Array.from({ length: goal }).map((_, i) => {
          const stamped = i < current;
          const isReward = i === goal - 1;
          return (
            <div key={i} style={{
              flex: 1, aspectRatio: "1",
              borderRadius: "50%",
              border: `1.5px dashed ${stamped ? "transparent" : "rgba(255,255,255,.3)"}`,
              background: stamped ? (isReward ? tweaks.accentColor : tweaks.primaryColor) : "transparent",
              display: "grid", placeItems: "center",
              transition: "all .3s",
              position: "relative",
            }}>
              {stamped ? (
                isReward
                  ? <span style={{ fontSize: compact ? 14 : 16 }}>★</span>
                  : <StampBean/>
              ) : (
                <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 11, opacity: .5 }}>
                  {isReward ? "★" : i + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StampBean() {
  return (
    <svg width="60%" height="60%" viewBox="0 0 24 24" fill="#fff">
      <ellipse cx="12" cy="12" rx="6" ry="9" transform="rotate(-20 12 12)"/>
      <path d="M8 6 Q13 12 14 18" stroke="#3A2414" strokeWidth="1.3" fill="none" strokeLinecap="round" transform="rotate(-20 12 12)" opacity=".7"/>
    </svg>
  );
}

// ============= CONFIRM LOYALTY (for confirmation screen) =============
function ConfirmLoyaltyBadge({ tweaks }) {
  const { goal, current, reward } = window.CO_DATA.loyalty;
  const next = Math.min(goal, current + 1);
  return (
    <div style={{
      width: "100%",
      background: tweaks.inkColor, color: "#fff",
      borderRadius: tweaks.cornerRadius - 4,
      padding: 14,
      textAlign: "left",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: "50%",
        background: tweaks.primaryColor,
        display: "grid", placeItems: "center",
        flexShrink: 0,
      }}>
        <StampBean/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 15 }}>+1 stamp earned!</div>
        <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 12, opacity: .8 }}>
          {next}/{goal} · {goal - next === 0 ? `${reward} unlocked 🎉` : `${goal - next} more for a ${reward.toLowerCase()}`}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  CO_ReorderTile: ReorderTile,
  CO_ModifierSheet: ModifierSheet,
  CO_LoyaltyStrip: LoyaltyStrip,
  CO_ConfirmLoyaltyBadge: ConfirmLoyaltyBadge,
  CO_LoyaltySheet: LoyaltySheet,
});

// ============= LOYALTY SHEET (popup, not always-visible strip) =============
function LoyaltySheet({ tweaks, open, onClose }) {
  if (!open) return null;
  const { goal, current, reward, program } = window.CO_DATA.loyalty;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(58,36,20,.45)" }}/>
      <div style={{
        position: "relative", width: "min(460px, 100%)",
        background: tweaks.bgColor,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: "10px 22px 28px",
        animation: "coSheetIn .25s ease-out",
        boxShadow: "0 -10px 40px rgba(58,36,20,.25)",
      }}>
        <div style={{ width: 40, height: 4, background: hex(tweaks.inkColor, .2), borderRadius: 999, margin: "0 auto 16px" }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{
            background: tweaks.secondaryColor, color: tweaks.inkColor,
            padding: "4px 12px", borderRadius: 999,
            fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 12,
            textTransform: "uppercase", letterSpacing: ".05em",
          }}>{program}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: tweaks.inkColor, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 22, color: tweaks.inkColor, lineHeight: 1.1 }}>
          {goal - current} more for a {reward.toLowerCase()}
        </div>
        <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 13, color: hex(tweaks.inkColor, .6), marginTop: 4, marginBottom: 16 }}>
          Earn 1 stamp every drink. Stamps don't expire.
        </div>
        <div style={{ display: "flex", gap: 6, padding: 14, background: tweaks.inkColor, borderRadius: tweaks.cornerRadius }}>
          {Array.from({ length: goal }).map((_, i) => {
            const stamped = i < current;
            const isReward = i === goal - 1;
            return (
              <div key={i} style={{
                flex: 1, aspectRatio: "1",
                borderRadius: "50%",
                border: `1.5px dashed ${stamped ? "transparent" : "rgba(255,255,255,.3)"}`,
                background: stamped ? (isReward ? tweaks.accentColor : tweaks.primaryColor) : "transparent",
                display: "grid", placeItems: "center", color: "#fff",
              }}>
                {stamped
                  ? (isReward ? <span style={{ fontSize: 16 }}>★</span> : <StampBean/>)
                  : <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 11, opacity: .5, color: "#fff" }}>{isReward ? "★" : i + 1}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
