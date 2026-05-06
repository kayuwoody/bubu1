/* global React, ReactDOM, CO_App */
const { useState, useEffect } = React;

function DeviceFrame({ children, width, height, kind, label }) {
  // iPhone-like frame for mobile, plain card for tablet/desktop
  const isPhone = kind === "mobile";
  const isTablet = kind === "tablet";
  const chrome = isPhone ? 16 : 8;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{
        fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 13,
        color: "rgba(58,36,20,.55)", letterSpacing: ".05em", textTransform: "uppercase",
      }}>{label}</div>
      <div style={{
        width, height,
        background: "#1b0e05",
        borderRadius: isPhone ? 46 : (isTablet ? 28 : 12),
        padding: chrome,
        boxShadow: `0 30px 60px -20px rgba(58,36,20,.35), 0 0 0 2px rgba(0,0,0,.1) inset`,
        position: "relative",
      }}>
        {isPhone && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            width: 100, height: 26, borderRadius: 99, background: "#000", zIndex: 30,
          }}/>
        )}
        <div style={{
          width: "100%", height: "100%",
          background: "#fff",
          borderRadius: isPhone ? 32 : (isTablet ? 20 : 6),
          overflow: "hidden",
          position: "relative",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Device({ kind, viewportWidth, viewportHeight, tweaks }) {
  return (
    <div style={{ width: viewportWidth, height: viewportHeight, overflow: "auto" }}>
      <CO_App tweaks={tweaks} viewport={kind}/>
    </div>
  );
}

// ============= TWEAKS PANEL =============
function TweaksPanel({ tweaks, setTweaks, open, setOpen }) {
  const set = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    if (window.parent !== window) {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
    }
  };
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 100,
      background: "#fff", borderRadius: 20,
      padding: 18, width: 280,
      boxShadow: "0 20px 60px rgba(58,36,20,.25), 0 0 0 1px rgba(58,36,20,.08)",
      fontFamily: "'Nunito', system-ui",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 18, color: "#3A2414" }}>Tweaks</div>
        <button onClick={()=>setOpen(false)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#3A2414", fontSize: 20, lineHeight: 1 }}>Tweaks</button>
      </div>

      <TweakRow label="Primary color">
        <ColorSwatches value={tweaks.primaryColor} onChange={v=>set("primaryColor", v)} options={["#F58220","#E85F1B","#D9402F","#C9752E","#5B3A1E","#3F8F6E","#2F6B9E"]}/>
      </TweakRow>

      <TweakRow label="Background">
        <ColorSwatches value={tweaks.bgColor} onChange={v=>set("bgColor", v)} options={["#FFF6E8","#FFFBF2","#FFFFFF","#FFEAD2","#F4EFE6","#2A1608"]}/>
      </TweakRow>

      <TweakRow label="Mascot prominence">
        <Seg value={tweaks.mascotProminence} onChange={v=>set("mascotProminence", v)} options={[
          ["hidden","Off"],["supporting","Supporting"],["hero","Hero"]
        ]}/>
      </TweakRow>

      <TweakRow label="Corner radius">
        <input type="range" min="8" max="32" value={tweaks.cornerRadius}
          onChange={e=>set("cornerRadius", Number(e.target.value))}
          style={{ width: "100%", accentColor: "#F58220" }}/>
      </TweakRow>

      <TweakRow label="Stickers & playful bits">
        <Seg value={tweaks.showStickers ? "on" : "off"} onChange={v=>set("showStickers", v==="on")} options={[["on","On"],["off","Off"]]}/>
      </TweakRow>

      <TweakRow label="Reorder tile (returning users)">
        <Seg value={tweaks.showReorder ? "on" : "off"} onChange={v=>set("showReorder", v==="on")} options={[["on","On"],["off","Off"]]}/>
      </TweakRow>

      <TweakRow label="Loyalty stamps">
        <Seg value={tweaks.showLoyalty ? "on" : "off"} onChange={v=>set("showLoyalty", v==="on")} options={[["on","On"],["off","Off"]]}/>
      </TweakRow>
    </div>
  );
}

function TweakRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(58,36,20,.55)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#FFF6E8", padding: 3, borderRadius: 10 }}>
      {options.map(([v,l])=>(
        <button key={v} onClick={()=>onChange(v)} style={{
          flex: 1, padding: "7px 8px", borderRadius: 8, border: "none",
          background: value===v ? "#3A2414" : "transparent",
          color: value===v ? "#fff" : "#3A2414",
          fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 12,
          cursor: "pointer",
        }}>{l}</button>
      ))}
    </div>
  );
}

function ColorSwatches({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(c=>(
        <button key={c} onClick={()=>onChange(c)} style={{
          width: 28, height: 28, borderRadius: 8,
          border: value===c ? "2.5px solid #3A2414" : "1.5px solid rgba(58,36,20,.1)",
          background: c, cursor: "pointer", padding: 0,
        }} aria-label={c}/>
      ))}
    </div>
  );
}

// ============= SHELL =============
function Shell() {
  const [tweaks, setTweaks] = useState(window.CO_TWEAKS);
  const [tweakOpen, setTweakOpen] = useState(false);
  const [mode, setMode] = useState("showcase"); // showcase | fullscreen
  const [fullscreenKind, setFullscreenKind] = useState("mobile");

  // edit-mode protocol
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweakOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweakOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  // responsive detection for narrow screens → go fullscreen mobile automatically
  const [narrow, setNarrow] = useState(window.innerWidth < 1000);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 1000);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  if (narrow || mode === "fullscreen") {
    return (
      <div style={{ height: "100vh", width: "100vw", overflow: "hidden", background: tweaks.bgColor }}>
        <div style={{ height: "100%", overflow: "auto" }}>
          <CO_App tweaks={tweaks} viewport={narrow ? (window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop") : fullscreenKind}/>
        </div>
        <FloatingTweakBtn onClick={()=>setTweakOpen(o=>!o)}/>
        <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} open={tweakOpen} setOpen={setTweakOpen}/>
      </div>
    );
  }

  // Showcase: all three side-by-side on desktop
  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: "#EFE4D1",
      backgroundImage: "radial-gradient(circle at 20% 10%, rgba(245,130,32,.08), transparent 50%), radial-gradient(circle at 90% 90%, rgba(244,123,142,.08), transparent 50%)",
      padding: "32px 24px 60px",
      fontFamily: "'Nunito', system-ui",
    }}>
      <header style={{
        display: "flex", alignItems: "flex-end", gap: 16,
        maxWidth: 1800, margin: "0 auto 28px",
      }}>
        <img src="assets/co-logo.png" alt="Coffee Oasis" style={{ height: 56 }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 26, color: "#3A2414", lineHeight: 1 }}>
            Customer Ordering — v2 · Menu-first
          </div>
          <div style={{ fontSize: 14, color: "rgba(58,36,20,.6)", marginTop: 4 }}>
            Compact header · Greeting band · Menu above the fold · Skip-the-line pickup for Shell Seksyen 13
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={()=>{ setMode("fullscreen"); setFullscreenKind("mobile"); }} style={pillBtn}>Open mobile</button>
          <button onClick={()=>{ setMode("fullscreen"); setFullscreenKind("desktop"); }} style={pillBtn}>Open desktop</button>
        </div>
      </header>

      <div style={{
        display: "grid",
        gridTemplateColumns: "390px 820px 1fr",
        gap: 32, alignItems: "start",
        maxWidth: 1800, margin: "0 auto",
        justifyContent: "center",
      }}>
        <DeviceFrame width={390} height={780} kind="mobile" label="Mobile · primary">
          <Device kind="mobile" viewportWidth={358} viewportHeight={748} tweaks={tweaks}/>
        </DeviceFrame>
        <DeviceFrame width={820} height={780} kind="tablet" label="Tablet">
          <Device kind="tablet" viewportWidth={804} viewportHeight={764} tweaks={tweaks}/>
        </DeviceFrame>
        <div style={{ position: "sticky", top: 20 }}>
          <DeviceFrame width="100%" height={780} kind="desktop" label="Desktop">
            <Device kind="desktop" viewportWidth="100%" viewportHeight={764} tweaks={tweaks}/>
          </DeviceFrame>
        </div>
      </div>

      <div style={{
        maxWidth: 1100, margin: "40px auto 0",
        background: "#fff", borderRadius: 20, padding: "20px 24px",
        border: "1px solid rgba(58,36,20,.08)",
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24,
      }}>
        <NoteCol title="Design decisions">
          <li>Single goal: get from open-app to "paid & queued" in <b>&lt;4 taps</b> for a repeat order.</li>
          <li>Category chips sticky; quantity steppers live on the card — no detail page for simple drinks.</li>
          <li>Bottom cart-bar on mobile is always in thumb reach.</li>
        </NoteCol>
        <NoteCol title="Pickup UX">
          <li>Two options only: <b>Counter</b> or <b>Curbside</b>. No delivery. No scheduling for now.</li>
          <li>ETA shown up-front ("Ready in ~4 min") so expectations are set before the menu.</li>
          <li>Confirmation screen names the exact spot ("Shell Seksyen 13") — helps new visitors.</li>
        </NoteCol>
        <NoteCol title="Next steps">
          <li>Modifiers: size, milk, sugar, ice level — slide-up sheet from item card.</li>
          <li>"Reorder last" tile at top for returning customers (biggest friction-killer).</li>
          <li>Loyalty stamp ("10th coffee free") surfacing after checkout.</li>
          <li>Real product images replace the stylized cup placeholders.</li>
        </NoteCol>
      </div>

      <FloatingTweakBtn onClick={()=>setTweakOpen(o=>!o)}/>
      <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} open={tweakOpen} setOpen={setTweakOpen}/>
    </div>
  );
}

const pillBtn = {
  padding: "10px 16px", borderRadius: 999,
  border: "1.5px solid rgba(58,36,20,.15)", background: "#fff",
  fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 13,
  color: "#3A2414", cursor: "pointer",
};

function NoteCol({ title, children }) {
  return (
    <div>
      <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 15, color: "#3A2414", marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "rgba(58,36,20,.75)", lineHeight: 1.55 }}>
        {React.Children.toArray(children)}
      </ul>
    </div>
  );
}

function FloatingTweakBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 99,
      padding: "12px 18px",
      background: "#3A2414", color: "#fff", border: "none",
      borderRadius: 999,
      fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14,
      cursor: "pointer",
      boxShadow: "0 8px 20px rgba(58,36,20,.3)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      Tweaks
    </button>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Shell/>);
