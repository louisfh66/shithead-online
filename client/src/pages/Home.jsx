import { useState, useEffect } from "react";
import socket from "../socket";

// ─── STYLES ───────────────────────────────────────────────────
const S = {
  gold: "#C9A84C", goldLt: "#E4C876",
  ivory: "#F5F0E8", ember: "#C0392B", emberLt: "#E74C3C",
  felt: "#0C3526", feltMid: "#0F4A35",
  dark: "#090C0B", muted: "#7A9E8E", cardBg: "#FAFAF8",
};

function Divider() {
  return <div style={{ height:1, background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.07) 30%,rgba(255,255,255,0.07) 70%,transparent 100%)", margin:"0 48px" }} />;
}

// ─── FAN CARD ─────────────────────────────────────────────────
function FanCard({ rank, suit, tx, rot, color }) {
  const isRed = color === "red";
  return (
    <div style={{
      position:"absolute", bottom:0, left:"calc(50% - 40px)",
      width:80, height:112, borderRadius:8,
      background:S.cardBg,
      boxShadow:"0 16px 48px rgba(0,0,0,0.7),0 4px 12px rgba(0,0,0,0.4)",
      transform:`translateX(${tx}px) rotate(${rot}deg)`,
      transformOrigin:"bottom center",
    }}>
      <div style={{ position:"absolute", inset:6, border:"1px solid rgba(0,0,0,0.08)", borderRadius:5, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"5px 6px" }}>
        <div style={{ color:isRed?S.ember:S.dark, fontSize:"0.9rem", fontWeight:700, fontFamily:"Cinzel,Georgia,serif", lineHeight:1 }}>
          <div>{rank}</div><div style={{fontSize:"0.75rem"}}>{suit}</div>
        </div>
        <div style={{ fontSize:"1.6rem", textAlign:"center", color:isRed?S.ember:S.dark }}>{suit}</div>
        <div style={{ color:isRed?S.ember:S.dark, fontSize:"0.9rem", fontWeight:700, fontFamily:"Cinzel,Georgia,serif", lineHeight:1, transform:"rotate(180deg)" }}>
          <div>{rank}</div>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION COMPONENTS ───────────────────────────────────────
function SectionLabel({ children }) {
  return <div style={{ fontSize:"0.72rem", fontWeight:600, letterSpacing:"0.22em", textTransform:"uppercase", color:S.gold, marginBottom:16 }}>{children}</div>;
}

function SectionTitle({ children }) {
  return <h2 style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"clamp(2rem,4vw,3rem)", fontWeight:700, color:S.ivory, lineHeight:1.15, marginBottom:20 }}>{children}</h2>;
}

// ─── CARD RULE CELL ───────────────────────────────────────────
function RuleCell({ dataCard, iconBg, iconBorder, icon, name, desc }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        background: hover?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.025)",
        padding:"36px 32px", position:"relative", overflow:"hidden",
        transition:"background 0.2s", cursor:"default",
      }}
    >
      <div style={{ position:"absolute", top:16, right:20, fontFamily:"Cinzel,Georgia,serif", fontSize:"3rem", fontWeight:900, opacity:0.07, lineHeight:1 }}>{dataCard}</div>
      <div style={{ width:44, height:44, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", marginBottom:20, background:iconBg, border:`1px solid ${iconBorder}` }}>{icon}</div>
      <div style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"1.05rem", fontWeight:700, color:S.ivory, marginBottom:8 }}>{name}</div>
      <p style={{ fontSize:"0.9rem", color:S.muted, lineHeight:1.65 }}>{desc}</p>
    </div>
  );
}

// ─── MAIN HOME ────────────────────────────────────────────────
export default function Home() {
  const [mode, setMode] = useState(null); // null | "create" | "join"
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleCreate() {
    if (!name.trim()) return;
    socket.emit("createParty", { name: name.trim() });
  }
  function handleJoin() {
    if (!name.trim() || code.trim().length !== 4) return;
    socket.emit("joinParty", { name: name.trim(), code: code.trim().toUpperCase() });
  }

  const inputStyle = {
    width:"100%", padding:"14px 16px",
    background:"rgba(255,255,255,0.05)",
    border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:8, color:S.ivory,
    fontSize:16, outline:"none",
    fontFamily:"system-ui,sans-serif",
  };

  const fanCards = [
    { rank:"A", suit:"♥", tx:-180, rot:-28, color:"red"   },
    { rank:"K", suit:"♠", tx:-120, rot:-18, color:"black" },
    { rank:"10",suit:"♦", tx:-60,  rot:-9,  color:"red"   },
    { rank:"7", suit:"♣", tx:0,    rot:0,   color:"black" },
    { rank:"2", suit:"♥", tx:60,   rot:9,   color:"red"   },
    { rank:"8", suit:"♠", tx:120,  rot:18,  color:"black" },
    { rank:"3", suit:"♦", tx:180,  rot:28,  color:"red"   },
  ];

  // If in create/join mode, show compact modal-style screen
  if (mode) {
    return (
      <div style={{
        minHeight:"100vh",
        background:`radial-gradient(ellipse 80% 60% at 50% 60%,${S.feltMid} 0%,${S.dark} 70%)`,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        padding:24, position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='%23ffffff' fill-opacity='0.025'/%3E%3C/svg%3E")` }}/>

        <div style={{ textAlign:"center", marginBottom:32 }}>
          <h1 style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"clamp(2.5rem,6vw,4.5rem)", fontWeight:900, lineHeight:0.92, letterSpacing:"-0.01em" }}>
            <span style={{color:S.emberLt}}>Shit</span><span style={{color:S.ivory}}>head</span>
          </h1>
          <div style={{ fontSize:11, color:S.muted, letterSpacing:"0.45em", textTransform:"uppercase", marginTop:8 }}>Online</div>
        </div>

        <div style={{ width:"100%", maxWidth:420, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:32 }}>
          {mode === "create" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:11,color:S.muted,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:2}}>Your name</div>
              <input style={inputStyle} placeholder="Enter your name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleCreate()} autoFocus maxLength={16}/>
              <button onClick={handleCreate} style={{ width:"100%", padding:"15px", background:name.trim()?S.gold:"rgba(255,255,255,0.04)", color:name.trim()?S.dark:S.muted, border:"none", borderRadius:8, fontSize:14, fontWeight:700, fontFamily:"Cinzel,Georgia,serif", letterSpacing:3, cursor:name.trim()?"pointer":"default", transition:"all 0.2s" }}>CREATE PARTY</button>
              <button onClick={()=>setMode(null)} style={{ width:"100%", padding:"13px", background:"transparent", color:S.muted, border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:13, cursor:"pointer" }}>← Back</button>
            </div>
          )}
          {mode === "join" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:11,color:S.muted,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:2}}>Your name</div>
              <input style={inputStyle} placeholder="Enter your name" value={name} onChange={e=>setName(e.target.value)} autoFocus maxLength={16}/>
              <div style={{fontSize:11,color:S.muted,letterSpacing:"0.2em",textTransform:"uppercase"}}>Game code</div>
              <input style={{...inputStyle,textTransform:"uppercase",letterSpacing:"0.5em",fontSize:28,textAlign:"center",fontFamily:"Cinzel,Georgia,serif",fontWeight:700,color:S.gold}} placeholder="XXXX" value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,4))} onKeyDown={e=>e.key==="Enter"&&handleJoin()} maxLength={4}/>
              <button onClick={handleJoin} style={{ width:"100%", padding:"15px", background:(name.trim()&&code.length===4)?S.gold:"rgba(255,255,255,0.04)", color:(name.trim()&&code.length===4)?S.dark:S.muted, border:"none", borderRadius:8, fontSize:14, fontWeight:700, fontFamily:"Cinzel,Georgia,serif", letterSpacing:3, cursor:(name.trim()&&code.length===4)?"pointer":"default", transition:"all 0.2s" }}>JOIN PARTY</button>
              <button onClick={()=>setMode(null)} style={{ width:"100%", padding:"13px", background:"transparent", color:S.muted, border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:13, cursor:"pointer" }}>← Back</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── LANDING PAGE ─────────────────────────────────────────
  return (
    <div style={{ background:S.dark, color:S.ivory, fontFamily:"Inter,system-ui,sans-serif", overflowX:"hidden" }}>

      {/* NAV */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:100,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"20px 48px",
        background: scrolled?"rgba(9,12,11,0.95)":"linear-gradient(to bottom,rgba(9,12,11,0.95) 0%,transparent 100%)",
        transition:"background 0.3s",
      }}>
        <span style={{ fontFamily:"Cinzel,Georgia,serif", fontWeight:700, fontSize:"1.1rem", letterSpacing:"0.12em", color:S.gold }}>SHITHEAD ONLINE</span>
        <div style={{display:"flex",gap:32,alignItems:"center"}}>
          {["How to Play","Special Cards","Features"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,"-")}`} style={{ color:S.muted, fontSize:"0.85rem", textDecoration:"none", letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500 }}>{l}</a>
          ))}
          <button onClick={()=>setMode("create")} style={{ background:S.gold, color:S.dark, border:"none", borderRadius:4, padding:"10px 24px", fontWeight:600, fontSize:"0.85rem", letterSpacing:"0.06em", cursor:"pointer" }}>Play Now</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", background:`radial-gradient(ellipse 80% 60% at 50% 60%,${S.feltMid} 0%,${S.dark} 70%)` }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='%23ffffff' fill-opacity='0.03'/%3E%3C/svg%3E")`, pointerEvents:"none" }}/>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at center,transparent 40%,rgba(9,12,11,0.7) 100%)", pointerEvents:"none" }}/>

        <div style={{ position:"relative", zIndex:2, textAlign:"center", maxWidth:780, padding:"0 24px" }}>
          <div style={{ display:"inline-block", fontFamily:"Inter,sans-serif", fontSize:"0.72rem", fontWeight:600, letterSpacing:"0.22em", textTransform:"uppercase", color:S.gold, marginBottom:24, border:`1px solid rgba(201,168,76,0.35)`, padding:"6px 16px", borderRadius:2 }}>
            No Download · No Account Required
          </div>
          <h1 style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"clamp(3.2rem,8vw,6.8rem)", fontWeight:900, lineHeight:0.92, letterSpacing:"-0.01em", color:S.ivory, marginBottom:28 }}>
            <span style={{color:S.emberLt}}>Shit</span>head<br/>Online
          </h1>
          <p style={{ fontSize:"clamp(1.1rem,2.5vw,1.4rem)", fontWeight:300, color:S.muted, lineHeight:1.6, marginBottom:48, maxWidth:500, marginLeft:"auto", marginRight:"auto" }}>
            The card game where <strong style={{color:S.ivory,fontWeight:500}}>everyone wins.</strong><br/>Except one.
          </p>
          <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setMode("create")} style={{ display:"inline-flex", alignItems:"center", background:S.gold, color:S.dark, fontFamily:"Cinzel,Georgia,serif", fontWeight:700, fontSize:"0.95rem", letterSpacing:"0.1em", padding:"16px 40px", borderRadius:4, border:"none", cursor:"pointer" }}>Create a Game</button>
            <button onClick={()=>setMode("join")} style={{ display:"inline-flex", alignItems:"center", background:"transparent", color:S.ivory, fontFamily:"Inter,sans-serif", fontWeight:500, fontSize:"0.9rem", letterSpacing:"0.06em", padding:"16px 32px", borderRadius:4, border:`1px solid rgba(245,240,232,0.2)`, cursor:"pointer" }}>Join with Code</button>
          </div>
        </div>

        {/* Card fan */}
        <div style={{ position:"absolute", bottom:-60, left:"50%", transform:"translateX(-50%)", width:500, height:300, zIndex:1 }}>
          {fanCards.map((c,i) => <FanCard key={i} {...c} />)}
        </div>

        {/* Scroll hint */}
        <div style={{ position:"absolute", bottom:32, left:"50%", transform:"translateX(-50%)", display:"flex", flexDirection:"column", alignItems:"center", gap:8, color:S.muted, fontSize:"0.72rem", letterSpacing:"0.12em", textTransform:"uppercase", animation:"bob 2s ease-in-out infinite" }}>
          <span>Scroll</span>
          <div style={{ width:20, height:20, borderRight:`1px solid ${S.muted}`, borderBottom:`1px solid ${S.muted}`, transform:"rotate(45deg)" }}/>
        </div>
      </section>

      <Divider/>

      {/* HOW TO PLAY */}
      <section id="how-to-play" style={{ background:S.dark }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"100px 48px" }}>
          <SectionLabel>How to Play</SectionLabel>
          <SectionTitle>Up and running in minutes</SectionTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, background:"rgba(255,255,255,0.06)", borderRadius:6, overflow:"hidden", marginTop:64 }}>
            {[
              { n:"01", t:"Enter your name", d:"No account required. Type a display name and create or join a party with a short four-letter code." },
              { n:"02", t:"Set your table cards", d:"Each player gets 6 hand cards. Choose 3 to place face-up on the table — these are played after your hand runs out." },
              { n:"03", t:"Play higher or equal", d:"Take turns playing equal or higher cards onto the pile. Can't play? Pick up the whole pile." },
              { n:"04", t:"Don't be last", d:"Empty your hand, then face-up cards, then face-downs blind. The last player holding cards is the Shithead." },
            ].map(s => (
              <div key={s.n} style={{ background:S.dark, padding:"40px 28px" }}>
                <div style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"2.8rem", fontWeight:900, color:"rgba(201,168,76,0.15)", lineHeight:1, marginBottom:20 }}>{s.n}</div>
                <div style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"0.95rem", fontWeight:700, color:S.ivory, marginBottom:10, letterSpacing:"0.04em" }}>{s.t}</div>
                <p style={{ fontSize:"0.87rem", color:S.muted, lineHeight:1.65 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* SPECIAL CARDS */}
      <section id="special-cards" style={{ background:`linear-gradient(180deg,${S.dark} 0%,rgba(12,53,38,0.25) 50%,${S.dark} 100%)` }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"100px 48px" }}>
          <SectionLabel>Special Cards</SectionLabel>
          <SectionTitle>Cards that change everything</SectionTitle>
          <p style={{ fontSize:"1.05rem", color:S.muted, lineHeight:1.75, maxWidth:540, marginBottom:48 }}>Standard rules only get you so far. These cards flip the table.</p>

          {/* Magic Cards */}
          <div style={{ fontSize:"0.72rem", fontWeight:600, letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(100,180,255,0.7)", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
            <span>✦ Magic Cards</span>
            <div style={{ flex:1, height:1, background:"rgba(100,180,255,0.15)" }}/>
            <span style={{ fontSize:"0.65rem", color:"rgba(100,180,255,0.4)" }}>Can be played at any time</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:2, background:"rgba(100,180,255,0.06)", borderRadius:6, overflow:"hidden", marginBottom:32, border:"1px solid rgba(100,180,255,0.1)" }}>
            <RuleCell dataCard="2" iconBg="rgba(59,130,246,0.15)" iconBorder="rgba(59,130,246,0.3)" icon="💧" name="The Two — Reset" desc="Can be played at any time regardless of the top card. Resets the pile — the next player may play anything they like." />
            <RuleCell dataCard="3" iconBg="rgba(255,255,255,0.06)" iconBorder="rgba(255,255,255,0.15)" icon="👻" name="The Three — Invisible" desc="Plays as a ghost: takes on the rank of the card beneath it. Appears semi-transparent on the pile. Can be played any time." />
            <RuleCell dataCard="10" iconBg="rgba(245,158,11,0.12)" iconBorder="rgba(245,158,11,0.3)" icon="🔥" name="The Ten — Burn" desc="Can be played at any time. Instantly burns the entire pile — it's gone. You keep your turn and play again from a clear slate." />
          </div>

          {/* Special Cards */}
          <div style={{ fontSize:"0.72rem", fontWeight:600, letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(192,57,43,0.8)", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
            <span>⚡ Special Cards</span>
            <div style={{ flex:1, height:1, background:"rgba(192,57,43,0.15)" }}/>
            <span style={{ fontSize:"0.65rem", color:"rgba(192,57,43,0.4)" }}>Normal play restrictions apply</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:2, background:"rgba(192,57,43,0.05)", borderRadius:6, overflow:"hidden", marginBottom:32, border:"1px solid rgba(192,57,43,0.1)" }}>
            <RuleCell dataCard="7" iconBg="rgba(192,57,43,0.15)" iconBorder="rgba(192,57,43,0.3)" icon="⬇" name="The Seven — Reverse" desc="Normal restrictions apply when playing it. But once on the pile, the next player must play lower than 7, not higher." />
            <RuleCell dataCard="8" iconBg="rgba(139,92,246,0.12)" iconBorder="rgba(139,92,246,0.25)" icon="⏭" name="The Eight — Skip" desc="Skips the next player. Play two 8s to skip two players. Three skips three. Stack as many as you dare." />
          </div>

          {/* Auto burn */}
          <div style={{ fontSize:"0.72rem", fontWeight:600, letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(239,68,68,0.7)", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
            <span>💀 Burn Rule</span>
            <div style={{ flex:1, height:1, background:"rgba(239,68,68,0.12)" }}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:2, background:"rgba(239,68,68,0.05)", borderRadius:6, overflow:"hidden", border:"1px solid rgba(239,68,68,0.1)" }}>
            <RuleCell dataCard="✕" iconBg="rgba(239,68,68,0.12)" iconBorder="rgba(239,68,68,0.3)" icon="💀" name="Four of a Kind — Auto Burn" desc="Four identical ranks appearing consecutively on the pile trigger an automatic burn, even across multiple turns. Threes don't count toward the four." />
          </div>
        </div>
      </section>

      <Divider/>

      {/* FEATURES */}
      <section id="features" style={{ background:"rgba(255,255,255,0.015)", borderTop:`1px solid rgba(255,255,255,0.05)`, borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"100px 48px" }}>
          <SectionLabel>Features</SectionLabel>
          <SectionTitle>Built for the table</SectionTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:48, marginTop:64 }}>
            {[
              { icon:"🃏", t:"Real-time Multiplayer", d:"Smooth WebSocket gameplay. A reconnect window means a dropped connection doesn't ruin the game." },
              { icon:"📱", t:"Mobile & Desktop", d:"Fully responsive layout with large touch targets. Works in portrait and landscape on any screen." },
              { icon:"⚡", t:"No Signup Required", d:"Jump straight in as a guest with a display name. Optional accounts coming with stats and achievements." },
              { icon:"🎭", t:"Spectator Mode", d:"Watch live games without interrupting. See all public information without peeking at face-down cards." },
              { icon:"🏆", t:"Round Tracking", d:"Track shithead counts across rounds with 💩 counters per player. The winner of each round starts the next." },
              { icon:"⚙️", t:"Host Controls", d:"Start the game, kick players, and begin new rounds. Full control before and during the game." },
            ].map(f => (
              <div key={f.t} style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{ fontSize:"1.6rem", width:52, height:52, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", flexShrink:0 }}>{f.icon}</div>
                <div style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"1rem", fontWeight:700, color:S.ivory }}>{f.t}</div>
                <p style={{ fontSize:"0.88rem", color:S.muted, lineHeight:1.65 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* CTA */}
      <section style={{ background:S.dark, textAlign:"center" }}>
        <div style={{ maxWidth:640, margin:"0 auto", padding:"120px 48px" }}>
          <div style={{ background:`linear-gradient(135deg,${S.felt} 0%,${S.feltMid} 100%)`, borderRadius:12, padding:"72px 80px", position:"relative", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.6)", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ position:"absolute", inset:10, border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, pointerEvents:"none" }}/>
            <h2 style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"clamp(1.8rem,4vw,2.8rem)", fontWeight:900, color:S.ivory, marginBottom:16, position:"relative", zIndex:1 }}>Deal me in</h2>
            <p style={{ color:S.muted, fontSize:"1rem", lineHeight:1.65, marginBottom:40, position:"relative", zIndex:1 }}>Get a four-letter code, share it with your mates, and find out who's the Shithead. No download. No account. Just cards.</p>
            <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", position:"relative", zIndex:1 }}>
              <button onClick={()=>setMode("create")} style={{ background:S.gold, color:S.dark, border:"none", borderRadius:4, padding:"16px 40px", fontFamily:"Cinzel,Georgia,serif", fontWeight:700, fontSize:"0.95rem", letterSpacing:"0.1em", cursor:"pointer" }}>Create a Game</button>
              <button onClick={()=>setMode("join")} style={{ background:"transparent", color:S.ivory, border:`1px solid rgba(245,240,232,0.2)`, borderRadius:4, padding:"16px 32px", fontFamily:"Inter,sans-serif", fontWeight:500, fontSize:"0.9rem", cursor:"pointer" }}>Join with Code</button>
            </div>
            <p style={{ marginTop:20, fontSize:"0.78rem", color:"rgba(122,158,142,0.6)", position:"relative", zIndex:1 }}>Free to play · Works on any browser · No app required</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:"1px solid rgba(255,255,255,0.05)", padding:"40px 48px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
        <div style={{ fontFamily:"Cinzel,Georgia,serif", fontWeight:700, fontSize:"0.95rem", color:S.gold, letterSpacing:"0.1em" }}>SHITHEAD ONLINE</div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          {["Rules","Changelog","Discord","Privacy"].map(l => (
            <a key={l} href="#" style={{ fontSize:"0.78rem", color:"rgba(122,158,142,0.6)", textDecoration:"none", letterSpacing:"0.05em", textTransform:"uppercase" }}>{l}</a>
          ))}
        </div>
        <div style={{ fontSize:"0.75rem", color:"rgba(122,158,142,0.4)" }}>© 2026 Shithead Online</div>
      </footer>

      <style>{`
        @keyframes bob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }
        @media(max-width:900px){
          nav { padding: 16px 24px !important; }
          nav > div { display: none !important; }
        }
        @media(max-width:700px){
          div[style*="repeat(4,1fr)"] { grid-template-columns: 1fr 1fr !important; }
          div[style*="repeat(3,1fr)"] { grid-template-columns: 1fr !important; }
          div[style*="repeat(auto-fit"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
