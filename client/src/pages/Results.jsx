import socket from "../socket";

const PLAYER_COLOURS = ["#C9A84C","#5B9BD5","#C0392B","#27AE60","#9B59B6"];

function playerColour(players, id) {
  const idx = players.findIndex(p => p.id === id);
  return PLAYER_COLOURS[idx % PLAYER_COLOURS.length];
}

export default function Results({ gameState }) {
  if (!gameState) return null;
  const { players, finishOrder, shitheadId, myId, hostId, stats } = gameState;
  const isHost = myId === hostId;
  const amShithead = myId === shitheadId;
  const ranked = finishOrder.map(id => players.find(p => p.id === id)).filter(Boolean);

  // Compute stat leaders
  const statLeaders = {};
  if (stats && Object.keys(stats).length > 0) {
    const allBurns = Object.entries(stats).sort((a,b) => (b[1].burns||0) - (a[1].burns||0));
    const allPickups = Object.entries(stats).sort((a,b) => (b[1].pickups||0) - (a[1].pickups||0));
    if (allBurns[0]?.[1]?.burns > 0) statLeaders.topBurner = { id: allBurns[0][0], count: allBurns[0][1].burns };
    if (allPickups[0]?.[1]?.pickups > 0) statLeaders.topPickup = { id: allPickups[0][0], count: allPickups[0][1].pickups };
  }

  function playerName(id) {
    return players.find(p => p.id === id)?.name || "Unknown";
  }

  return (
    <div style={{
      minHeight:"100vh",
      background:"radial-gradient(ellipse 80% 60% at 50% 40%,#0F4A35 0%,#090C0B 70%)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:24, fontFamily:"system-ui,sans-serif",
    }}>
      {/* Result */}
      <div style={{fontSize:72,marginBottom:12}}>{amShithead?"💀":"🏆"}</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:36,fontWeight:900,color:amShithead?"#C0392B":"#C9A84C",letterSpacing:2,marginBottom:8}}>
        {amShithead?"SHITHEAD":"YOU WIN"}
      </div>
      <div style={{fontSize:14,color:"#7A9E8E",marginBottom:36,textAlign:"center"}}>
        {amShithead?"You were the last one holding cards.":"You escaped before the rest."}
      </div>

      <div style={{width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:16}}>

        {/* Rankings */}
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:24}}>
          <div style={{fontSize:11,color:"#7A9E8E",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Final Rankings</div>
          {ranked.map((p,i)=>{
            const isShithead = p.id===shitheadId;
            const isMe = p.id===myId;
            const colour = playerColour(players,p.id);
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:i<ranked.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:isShithead?"rgba(192,57,43,0.15)":"rgba(255,255,255,0.04)",border:`2px solid ${isShithead?"#C0392B":colour}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",fontWeight:900,fontSize:14,color:isShithead?"#C0392B":colour,flexShrink:0}}>
                  {isShithead?"💩":i+1}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:colour}}/>
                    <div style={{fontWeight:isMe?700:400,color:isMe?"#F5F0E8":"#7A9E8E",fontSize:15}}>
                      {p.name}{isMe?" (you)":""}
                    </div>
                  </div>
                  {p.shitheadCount>0&&<div style={{fontSize:11,color:"#3a5a4a",marginTop:2}}>{"💩".repeat(p.shitheadCount)} {p.shitheadCount}× Shithead</div>}
                </div>
                <div style={{fontSize:13,color:isShithead?"#C0392B":"#3a5a4a",fontWeight:isShithead?700:400}}>
                  {isShithead?"SHITHEAD":`#${i+1}`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Round stats */}
        {(statLeaders.topBurner || statLeaders.topPickup) && (
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:20}}>
            <div style={{fontSize:11,color:"#7A9E8E",letterSpacing:3,textTransform:"uppercase",marginBottom:14}}>Round Stats</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {statLeaders.topBurner&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:13,color:"#7A9E8E"}}>🔥 Most burns</div>
                  <div style={{fontSize:13,color:playerColour(players,statLeaders.topBurner.id),fontWeight:600}}>
                    {playerName(statLeaders.topBurner.id)} · {statLeaders.topBurner.count}
                  </div>
                </div>
              )}
              {statLeaders.topPickup&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:13,color:"#7A9E8E"}}>😬 Most pickups</div>
                  <div style={{fontSize:13,color:playerColour(players,statLeaders.topPickup.id),fontWeight:600}}>
                    {playerName(statLeaders.topPickup.id)} · {statLeaders.topPickup.count}
                  </div>
                </div>
              )}
              {/* Individual stats */}
              {players.map(p=>{
                const s = stats?.[p.id];
                if (!s) return null;
                const isMe = p.id===myId;
                return (
                  <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:playerColour(players,p.id)}}/>
                      <div style={{fontSize:12,color:isMe?"#F5F0E8":"#7A9E8E"}}>{p.name}</div>
                    </div>
                    <div style={{fontSize:11,color:"#3a5a4a",display:"flex",gap:12}}>
                      <span>🔥 {s.burns||0}</span>
                      <span>😬 {s.pickups||0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div>
          {isHost?(
            <button onClick={()=>socket.emit("newRound")} style={{width:"100%",padding:"15px",background:"#C9A84C",color:"#090C0B",border:"none",borderRadius:10,fontSize:15,fontWeight:700,fontFamily:"Georgia,serif",letterSpacing:2,cursor:"pointer"}}>
              NEW ROUND
            </button>
          ):(
            <div style={{textAlign:"center",fontSize:13,color:"#3a5a4a",padding:"14px 0"}}>Waiting for host to start a new round…</div>
          )}
        </div>
      </div>
    </div>
  );
}
