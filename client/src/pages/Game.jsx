import { useState, useEffect, useRef } from "react";
import socket from "../socket";
import { soundCardPlay, soundPickUp, soundBurn, soundSkip, soundSeven, soundWin, soundShithead, soundChat, setMuted, isMuted } from "../utils/sounds";

const RANK_VALUE = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};

function effectiveTopCard(pile) {
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank !== "3") return pile[i];
  }
  return null;
}

function canPlay(card, pile, mustPlayLower) {
  if (card.rank === "2" || card.rank === "3" || card.rank === "10") return true;
  if (pile.length === 0) return true;
  const top = effectiveTopCard(pile);
  if (!top) return true;
  const val = RANK_VALUE[card.rank];
  if (mustPlayLower) return val <= 7;
  return val >= RANK_VALUE[top.rank];
}

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return width;
}

// ─── CARD BACK ────────────────────────────────────────────────
function CardBack({ w, h, selected, onClick, disabled }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      width:w, height:h, borderRadius:7, flexShrink:0,
      background:"linear-gradient(145deg,#1a1060 0%,#110a45 100%)",
      border: selected ? "2px solid #C9A84C" : "1px solid rgba(255,255,255,0.18)",
      boxShadow: selected ? "0 0 16px rgba(201,168,76,0.6),0 4px 14px rgba(0,0,0,0.5)" : "0 3px 10px rgba(0,0,0,0.5)",
      transform: selected ? "translateY(-12px)" : "none",
      transition:"all 0.15s", cursor: disabled?"default":"pointer",
      userSelect:"none", position:"relative", overflow:"hidden",
    }}>
      <div style={{position:"absolute",inset:4,border:"1px solid rgba(255,255,255,0.1)",borderRadius:4}}/>
      <div style={{position:"absolute",inset:6,backgroundImage:`repeating-linear-gradient(45deg,rgba(255,255,255,0.035) 0,rgba(255,255,255,0.035) 1px,transparent 1px,transparent 9px),repeating-linear-gradient(-45deg,rgba(255,255,255,0.035) 0,rgba(255,255,255,0.035) 1px,transparent 1px,transparent 9px)`,borderRadius:2}}/>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:h>70?22:14,opacity:0.2,color:"#fff"}}>♠</div>
    </div>
  );
}

// ─── CARD FACE ────────────────────────────────────────────────
function CardFace({ card, w, h, selected, onClick, ghost, disabled, animateIn }) {
  if (!card) return null;
  const isRed = ["♥","♦"].includes(card.suit);
  const fs = h>80?18:h>60?14:11;
  const ss = h>80?13:h>60?10:8;
  return (
    <div onClick={disabled?undefined:onClick} style={{
      width:w, height:h, borderRadius:7, flexShrink:0,
      background:"#FAFAF8",
      border: selected?"2px solid #C9A84C":"1px solid rgba(0,0,0,0.12)",
      boxShadow: selected?"0 0 16px rgba(201,168,76,0.6),0 4px 14px rgba(0,0,0,0.4)":"0 3px 10px rgba(0,0,0,0.4)",
      transform: selected?"translateY(-12px)":"none",
      transition:"all 0.15s",
      cursor: disabled?"default":"pointer",
      display:"flex", flexDirection:"column", justifyContent:"space-between",
      padding:"5px 6px", userSelect:"none", flexShrink:0,
      opacity: ghost?0.5:1, position:"relative",
      animation: animateIn?"slideIn 0.25s ease":"none",
    }}>
      <div style={{color:isRed?"#C0392B":"#0a0a0a",fontSize:fs,fontWeight:700,fontFamily:"Georgia,serif",lineHeight:1.1}}>
        {card.rank}<br/><span style={{fontSize:ss}}>{card.suit}</span>
      </div>
      <div style={{color:isRed?"#C0392B":"#0a0a0a",fontSize:fs,fontWeight:700,fontFamily:"Georgia,serif",lineHeight:1.1,transform:"rotate(180deg)",alignSelf:"flex-end"}}>
        {card.rank}<br/><span style={{fontSize:ss}}>{card.suit}</span>
      </div>
      {ghost && <div style={{position:"absolute",inset:0,background:"rgba(100,180,255,0.15)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:h>70?20:14,opacity:0.5}}>👻</span></div>}
    </div>
  );
}

// ─── GHOST 3 PILE CARD ────────────────────────────────────────
function PileCardDisplay({ card, cardBelow, w, h }) {
  if (card.rank !== "3") return <CardFace card={card} w={w} h={h} disabled />;
  const isRed = ["♥","♦"].includes(card.suit);
  const fs = h>80?18:14; const ss = h>80?13:10;
  return (
    <div style={{position:"relative",width:w,height:h,flexShrink:0}}>
      {cardBelow && <div style={{position:"absolute",inset:0}}><CardFace card={cardBelow} w={w} h={h} disabled /></div>}
      <div style={{position:"absolute",inset:0,width:w,height:h,borderRadius:7,background:"#FAFAF8",border:"1px solid rgba(0,0,0,0.12)",boxShadow:"0 3px 8px rgba(0,0,0,0.4)",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"5px 6px",opacity:0.32}}>
        <div style={{color:isRed?"#C0392B":"#0a0a0a",fontSize:fs,fontWeight:700,fontFamily:"Georgia,serif",lineHeight:1.1}}>{card.rank}<br/><span style={{fontSize:ss}}>{card.suit}</span></div>
        <div style={{color:isRed?"#C0392B":"#0a0a0a",fontSize:fs,fontWeight:700,fontFamily:"Georgia,serif",lineHeight:1.1,transform:"rotate(180deg)",alignSelf:"flex-end"}}>{card.rank}<br/><span style={{fontSize:ss}}>{card.suit}</span></div>
      </div>
    </div>
  );
}

// ─── TABLE SLOT ───────────────────────────────────────────────
function TableSlot({ fdCard, fuCard, w, h, offset, onClickFD, onClickFU, activeFD, activeFU, selectedCards }) {
  return (
    <div style={{position:"relative",width:w,height:h+offset,flexShrink:0}}>
      {fdCard && (
        <div style={{position:"absolute",bottom:0,left:0,zIndex:1}}>
          <CardBack w={w} h={h} disabled={!activeFD} onClick={onClickFD} selected={selectedCards?.includes(fdCard.id)} />
        </div>
      )}
      {fuCard && (
        <div style={{position:"absolute",bottom:offset,left:0,zIndex:2}}>
          <CardFace card={fuCard} w={w} h={h} disabled={!activeFU} onClick={onClickFU} selected={selectedCards?.includes(fuCard.id)} />
        </div>
      )}
    </div>
  );
}

// ─── PILE ─────────────────────────────────────────────────────
function Pile({ pile, w, h, burning }) {
  const show = pile.slice(-4);
  if (pile.length === 0) return (
    <div style={{width:w,height:h,borderRadius:7,border:"1px dashed rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#2a4a3a",fontSize:12}}>Empty</div>
  );
  return (
    <div style={{position:"relative",width:w+12,height:h+12}}>
      {show.map((c,i) => {
        const isTop = i===show.length-1;
        const prevNonThree = show.slice(0,i).filter(x=>x.rank!=="3").pop();
        return (
          <div key={c.id} style={{position:"absolute",top:i*3,left:i*3,zIndex:i,transition:"transform 0.3s ease"}}>
            {isTop ? <PileCardDisplay card={c} cardBelow={prevNonThree} w={w} h={h}/> : <CardFace card={c} w={w} h={h} disabled/>}
          </div>
        );
      })}
      {burning && (
        <div style={{
          position:"absolute", inset:-8, borderRadius:12, zIndex:20,
          background:"radial-gradient(circle,rgba(255,120,0,0.85) 0%,rgba(255,50,0,0.4) 50%,transparent 75%)",
          animation:"burnFlash 0.6s ease-out forwards",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:36, pointerEvents:"none",
        }}>🔥</div>
      )}
    </div>
  );
}

// ─── CHAT ─────────────────────────────────────────────────────
function Chat({ myId, players, isDesktop }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const handler = (msg) => {
      setMessages(prev => [...prev.slice(-49), msg]);
      if (msg.id !== myId) soundChat();
      bottomRef.current?.scrollIntoView({ behavior:"smooth" });
    };
    socket.on("chatMessage", handler);
    return () => socket.off("chatMessage", handler);
  }, [myId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  function send() {
    const msg = input.trim();
    if (!msg) return;
    socket.emit("chatMessage", { message: msg });
    setInput("");
  }

  const COLOURS = ["#C9A84C","#7A9E8E","#C0392B","#9b59b6","#3498db"];
  function colourFor(id) {
    const idx = players.findIndex(p=>p.id===id);
    return COLOURS[idx % COLOURS.length];
  }

  return (
    <div style={{
      display:"flex", flexDirection:"column",
      width: isDesktop ? 240 : "100%",
      borderLeft: isDesktop ? "1px solid rgba(255,255,255,0.06)" : "none",
      borderTop: isDesktop ? "none" : "1px solid rgba(255,255,255,0.06)",
      background:"rgba(0,0,0,0.15)",
      flexShrink:0,
      height: isDesktop ? "100%" : 200,
    }}>
      <div style={{padding:"10px 14px 8px",fontSize:10,color:"#3a5a4a",letterSpacing:3,textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>Chat</div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 12px",display:"flex",flexDirection:"column",gap:6}}>
        {messages.length === 0 && (
          <div style={{fontSize:11,color:"#2a4a3a",textAlign:"center",marginTop:12}}>No messages yet</div>
        )}
        {messages.map((m,i) => (
          <div key={i} style={{fontSize:12,lineHeight:1.4}}>
            <span style={{color:colourFor(m.id),fontWeight:600}}>{m.name}: </span>
            <span style={{color:"#7A9E8E"}}>{m.message}</span>
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:6,padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Message..."
          maxLength={200}
          style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"7px 10px",color:"#F5F0E8",fontSize:12,outline:"none"}}
        />
        <button onClick={send} style={{background:"#C9A84C",border:"none",borderRadius:6,padding:"7px 12px",color:"#090C0B",fontWeight:700,fontSize:12,cursor:"pointer"}}>→</button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function Game({ gameState }) {
  const [selectedCards, setSelectedCards] = useState([]);
  const [timeLeft, setTimeLeft] = useState(20);
  const [burning, setBurning] = useState(false);
  const [muted, setMutedState] = useState(false);
  const winW = useWindowWidth();
  const isDesktop = winW >= 900;
  const prevLogRef = useRef(null);

  const turnDeadline = gameState?.turnDeadline || null;

  useEffect(() => {
    if (!turnDeadline) { setTimeLeft(20); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [turnDeadline]);

  // Sound + animation triggers from log
  useEffect(() => {
    if (!gameState?.log?.[0]) return;
    const latest = gameState.log[0];
    if (latest === prevLogRef.current) return;
    prevLogRef.current = latest;

    if (latest.includes("burns") || latest.includes("burn")) { soundBurn(); setBurning(true); setTimeout(()=>setBurning(false), 700); }
    else if (latest.includes("skips") || latest.includes("skip")) soundSkip();
    else if (latest.includes("picked up")) soundPickUp();
    else if (latest.includes("played 7") || latest.includes("lower")) soundSeven();
    else if (latest.includes("Shithead")) soundShithead();
    else if (latest.includes("is out")) soundWin();
    else soundCardPlay();
  }, [gameState?.log?.[0]]);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  }

  if (!gameState) return null;
  const { pile, deckCount, currentTurn, mustPlayLower, players, myHand, myFaceUp, myFaceDown, myId, log } = gameState;

  const myIdx = players.findIndex(p=>p.id===myId);
  const isMyTurn = currentTurn===myIdx;
  const me = players[myIdx];
  const mySource = myHand.length>0?"hand":myFaceUp.length>0?"faceUp":"faceDown";
  const opponents = players.filter(p=>p.id!==myId);
  const topCard = effectiveTopCard(pile);
  const currentPlayer = players[currentTurn];

  const handW = isDesktop?70:56; const handH = isDesktop?98:78;
  const tableW = isDesktop?62:50; const tableH = isDesktop?88:70;
  const tableOffset = isDesktop?14:11;
  const oppW = isDesktop?48:38; const oppH = isDesktop?66:52; const oppOffset = isDesktop?10:8;
  const pileW = isDesktop?72:60; const pileH = isDesktop?100:84;

  function toggleCard(cardId, source) {
    if (!isMyTurn || source!==mySource) return;
    setSelectedCards(prev => {
      if (prev.includes(cardId)) return prev.filter(id=>id!==cardId);
      const all = source==="hand"?myHand:myFaceUp;
      const thisCard = all.find(c=>c.id===cardId);
      const first = prev[0]?all.find(c=>c.id===prev[0]):null;
      if (first&&thisCard&&first.rank!==thisCard.rank) return [cardId];
      return [...prev,cardId];
    });
  }

  function playFaceDown(cardId) {
    if (!isMyTurn||mySource!=="faceDown") return;
    socket.emit("playCards",{cardIds:[cardId]});
    setSelectedCards([]);
  }

  function playCards() {
    if (!selectedCards.length) return;
    socket.emit("playCards",{cardIds:selectedCards});
    setSelectedCards([]);
  }

  function pickUp() {
    socket.emit("pickUpPile");
    setSelectedCards([]);
  }

  const canPlaySelected = selectedCards.length>0 && mySource!=="faceDown" && selectedCards.every(id=>{
    const all = mySource==="hand"?myHand:myFaceUp;
    const card = all.find(c=>c.id===id);
    return card&&canPlay(card,pile,mustPlayLower);
  });

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#090C0B 0%,#0C3526 50%,#090C0B 100%)",display:"flex",flexDirection:"column",width:"100%"}}>

      <style>{`
        @keyframes slideIn { from{transform:translateY(-20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes burnFlash { 0%{opacity:1;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.1)} 100%{opacity:0;transform:scale(1.3)} }
        @keyframes skipFlash { 0%,100%{opacity:0} 50%{opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:isDesktop?"14px 40px":"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:isDesktop?20:16,fontWeight:900,letterSpacing:2}}>
          <span style={{color:"#C0392B"}}>SHIT</span><span style={{color:"#C9A84C"}}>HEAD</span>
        </div>
        <div style={{fontSize:isDesktop?13:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",padding:isDesktop?"7px 18px":"5px 12px",borderRadius:20,background:isMyTurn?"rgba(201,168,76,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${isMyTurn?"rgba(201,168,76,0.35)":"rgba(255,255,255,0.08)"}`,color:isMyTurn?"#C9A84C":"#7A9E8E"}}>
          {isMyTurn?"⚡ Your turn":`${currentPlayer?.name}'s turn`}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:12,color:"#3a5a4a"}}>🂠 {deckCount}</div>
          <button onClick={toggleMute} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"4px 8px",color:"#7A9E8E",fontSize:14,cursor:"pointer"}}>
            {muted?"🔇":"🔊"}
          </button>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{height:3,background:"rgba(255,255,255,0.06)",width:"100%"}}>
        <div style={{height:"100%",width:turnDeadline?`${(timeLeft/20)*100}%`:"0%",background:timeLeft>10?"#C9A84C":timeLeft>5?"#E74C3C":"#ff2222",transition:"width 0.25s linear,background 0.3s"}}/>
      </div>

      {/* Main area */}
      <div style={{display:"flex",flex:1,flexDirection:isDesktop?"row":"column",overflow:"hidden"}}>

        {/* Opponents */}
        <div style={{padding:isDesktop?"20px 20px 20px 40px":"10px 16px",borderRight:isDesktop?"1px solid rgba(255,255,255,0.06)":"none",borderBottom:isDesktop?"none":"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:isDesktop?"column":"row",gap:isDesktop?16:10,flexWrap:isDesktop?"nowrap":"wrap",minWidth:isDesktop?220:"auto"}}>
          <div style={{fontSize:10,color:"#3a5a4a",letterSpacing:3,textTransform:"uppercase",marginBottom:isDesktop?2:0}}>Opponents</div>
          {opponents.map(opp => {
            const oppIdx = players.findIndex(p=>p.id===opp.id);
            const isOppTurn = currentTurn===oppIdx;
            return (
              <div key={opp.id} style={{background:isOppTurn?"rgba(201,168,76,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${isOppTurn?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.05)"}`,borderRadius:10,padding:"8px 12px",position:"relative",transition:"border-color 0.3s"}}>
                {opp.disconnected && (
                  <div style={{position:"absolute",top:6,right:8,fontSize:10,color:"#E74C3C",fontWeight:700}}>RECONNECTING…</div>
                )}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8}}>
                  <div style={{fontSize:13,color:isOppTurn?"#C9A84C":"#7A9E8E",fontWeight:isOppTurn?700:400}}>
                    {isOppTurn?"▶ ":""}{opp.name}
                    {opp.shitheadCount>0&&<span style={{marginLeft:5}}>{"💩".repeat(opp.shitheadCount)}</span>}
                    {opp.finished&&<span style={{marginLeft:6,color:"#C9A84C",fontSize:10,fontWeight:700}}>✓ OUT</span>}
                  </div>
                  <div style={{fontSize:11,color:"#3a5a4a"}}>✋ {opp.handCount}</div>
                </div>
                <div style={{display:"flex",gap:isDesktop?8:5,alignItems:"flex-end",flexWrap:"wrap"}}>
                  {[0,1,2].map(slot=>(
                    <TableSlot key={slot} small fdCard={opp.faceDown?.[slot]?{id:`opp-${opp.id}-fd-${slot}`,hidden:true}:undefined} fuCard={opp.faceUp?.[slot]} w={oppW} h={oppH} offset={oppOffset} activeFD={false} activeFU={false} selectedCards={[]}/>
                  ))}
                  <div style={{display:"flex",gap:2,alignSelf:"center"}}>
                    {Array.from({length:Math.min(opp.handCount,7)}).map((_,i)=>(
                      <CardBack key={i} w={isDesktop?22:18} h={isDesktop?30:24} disabled/>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Centre */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:isDesktop?"24px 32px":"12px",gap:10,minHeight:isDesktop?0:160}}>
          {mustPlayLower&&(
            <div style={{fontSize:11,color:"#E74C3C",letterSpacing:2,textTransform:"uppercase",fontWeight:700,background:"rgba(192,57,43,0.12)",border:"1px solid rgba(192,57,43,0.3)",padding:"4px 14px",borderRadius:20}}>⬇ Must play lower than 7</div>
          )}
          <Pile pile={pile} w={pileW} h={pileH} burning={burning}/>
          <div style={{fontSize:12,color:"#7A9E8E",textAlign:"center"}}>
            {pile.length>0?`${pile.length} card${pile.length!==1?"s":""} · top: ${topCard?topCard.rank+topCard.suit:"—"}`:"Pile is empty"}
          </div>
          {isMyTurn&&pile.length>0&&(
            <button onClick={pickUp} style={{background:"transparent",color:"#4a7a6a",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"6px 18px",fontSize:12,cursor:"pointer"}}>Pick up pile</button>
          )}
          <div style={{padding:"6px 14px",background:"rgba(255,255,255,0.02)",borderRadius:8,maxWidth:320,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:12,color:"#7A9E8E"}}>{log?.[0]||"—"}</div>
          </div>
        </div>

        {/* Chat */}
        <Chat myId={myId} players={players} isDesktop={isDesktop}/>
      </div>

      {/* My area */}
      <div style={{padding:isDesktop?"16px 40px 20px":"12px 16px 16px",borderTop:"1px solid rgba(255,255,255,0.07)",background:"rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:12,color:"#C9A84C",letterSpacing:2,textTransform:"uppercase",fontWeight:700}}>
            You {me?.shitheadCount>0&&"💩".repeat(me.shitheadCount)}
          </div>
          <div style={{fontSize:11,color:"#4a7a6a"}}>
            {mySource==="hand"?`Hand · ${myHand.length} cards`:mySource==="faceUp"?"Playing face-up cards":"Playing blind 👀"}
          </div>
        </div>

        <div style={{display:"flex",alignItems:"flex-end",gap:isDesktop?28:12,flexWrap:"wrap"}}>
          {/* Table */}
          <div>
            <div style={{fontSize:9,color:"#3a5a4a",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Table</div>
            <div style={{display:"flex",gap:isDesktop?12:8}}>
              {[0,1,2].map(slot=>(
                <TableSlot key={slot}
                  fdCard={myFaceDown?.[slot]}
                  fuCard={myFaceUp?.[slot]}
                  w={tableW} h={tableH} offset={tableOffset}
                  activeFD={isMyTurn&&mySource==="faceDown"}
                  activeFU={isMyTurn&&mySource==="faceUp"}
                  selectedCards={selectedCards}
                  onClickFD={()=>myFaceDown?.[slot]&&playFaceDown(myFaceDown[slot].id)}
                  onClickFU={()=>myFaceUp?.[slot]&&toggleCard(myFaceUp[slot].id,"faceUp")}
                />
              ))}
            </div>
          </div>

          {/* Hand */}
          {myHand.length>0&&(
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:"#3a5a4a",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Hand</div>
              <div style={{display:"flex",gap:isDesktop?10:6,flexWrap:"wrap"}}>
                {myHand.map(card=>(
                  <CardFace key={card.id} card={card} w={handW} h={handH}
                    selected={selectedCards.includes(card.id)}
                    onClick={()=>toggleCard(card.id,"hand")}
                    disabled={!isMyTurn}
                    ghost={isMyTurn&&pile.length>0&&!canPlay(card,pile,mustPlayLower)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{marginTop:14,display:"flex",gap:10}}>
          {isMyTurn&&mySource!=="faceDown"&&(
            <button onClick={playCards} disabled={!canPlaySelected} style={{flex:1,padding:isDesktop?"15px":"13px",background:canPlaySelected?"#C9A84C":"rgba(255,255,255,0.04)",color:canPlaySelected?"#090C0B":"#3a5a4a",border:canPlaySelected?"none":"1px solid rgba(255,255,255,0.08)",borderRadius:10,fontSize:isDesktop?15:14,fontWeight:700,fontFamily:"Georgia,serif",letterSpacing:2,cursor:canPlaySelected?"pointer":"default",transition:"all 0.2s"}}>
              {selectedCards.length===0?"SELECT A CARD":`PLAY ${selectedCards.length>1?selectedCards.length+"× ":""}${(()=>{const all=mySource==="hand"?myHand:myFaceUp;return all.find(c=>c.id===selectedCards[0])?.rank??"";})()} `}
            </button>
          )}
          {isMyTurn&&mySource==="faceDown"&&(
            <div style={{flex:1,textAlign:"center",fontSize:13,color:"#7A9E8E",padding:"13px 0",fontStyle:"italic"}}>Tap a face-down card above to play blind</div>
          )}
          {!isMyTurn&&(
            <div style={{flex:1,textAlign:"center",fontSize:13,color:"#3a5a4a",padding:"13px 0"}}>Waiting for {currentPlayer?.name}…</div>
          )}
        </div>
      </div>
    </div>
  );
}
