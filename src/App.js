import { useState, useEffect, useRef, useCallback } from "react";

const GW = 390, GH = 650, PS = 38, OS = 46, PR = 78;
const STAGE_LENGTH = 3000; // scroll distance to clear

const TYPES = [
  { type:"bump",   color:"#4a90d9", points:100, balloons:["ドン！","ぶつかるぞ！"] },
  { type:"cough",  color:"#5aad6f", points:150, balloons:["ゴホッ！","ゴホゴホ！","ケホッ！"] },
  { type:"insult", color:"#c0392b", points:200, balloons:["ブス！","うるさい！","どけ！","チッ！"] },
];

function mkOjisan(id, scrollY, rage) {
  const side = Math.random() > 0.5 ? "left" : "right";
  const typeIdx = Math.random() < 0.45 ? 0 : Math.random() < 0.55 ? 1 : 2;
  return {
    id, typeIdx,
    x: side==="left" ? -OS : GW,
    y: Math.random()*(GH-300)+60,
    state: "lurk", // lurk → walking → flying/dead
    lurkTimer: 80 + Math.floor(Math.random()*80), // silent approach frames
    flyVx:0, flyVy:0, rotation:0,
    speed: (rage ? 2.8 : 1.4) + Math.random()*0.5,
    balloon:null, balloonTimer:0,
    alpha:0, // fade in during lurk
  };
}

export default function App() {
  const [screen, setScreen] = useState("title");
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState(0);
  const [life, setLife] = useState(100);
  const [progress, setProgress] = useState(0);
  const [rage, setRage] = useState(false);
  const [shake, setShake] = useState(false);
  const cvs = useRef(null);
  const raf = useRef(null);
  const joystick = useRef({active:false,startX:0,startY:0,dx:0,dy:0,id:-1});
  const S = useRef({
    player:{x:GW/2-PS/2, y:GH-180},
    ojisans:[], hits:[],
    score:0, life:100, combo:0, comboTimer:null,
    punching:false, punchTimer:0,
    frame:0, spawnT:0, spawnInt:100, nextId:0,
    scrollY:0, rage:false, rageTimer:0,
    invincible:0,
    keys:{},
  });

  const doShake = (hard=false) => {
    setShake(true);
    setTimeout(()=>setShake(false), hard?400:200);
  };

  const reset = () => {
    const s = S.current;
    Object.assign(s,{
      player:{x:GW/2-PS/2,y:GH-180}, ojisans:[], hits:[],
      score:0, life:100, combo:0, punching:false, punchTimer:0,
      frame:0, spawnT:0, spawnInt:100, nextId:0,
      scrollY:0, rage:false, rageTimer:0, invincible:0, keys:{},
    });
    joystick.current={active:false,startX:0,startY:0,dx:0,dy:0,id:-1};
    setScore(0); setLife(100); setProgress(0); setRage(false); setShake(false);
    setScreen("playing");
  };

  const punch = useCallback(() => {
    const s = S.current;
    if (s.punching && !s.rage) return;
    s.punching=true; s.punchTimer= s.rage ? 10 : 18;
    let hit=false;
    const range = s.rage ? PR*1.6 : PR;
    s.ojisans = s.ojisans.map(o=>{
      if(o.state!=="walking"&&o.state!=="lurk") return o;
      const dx=(o.x+OS/2)-(s.player.x+PS/2);
      const dy=(o.y+OS/2)-(s.player.y+PS/2);
      if(Math.hypot(dx,dy)<range){
        hit=true; s.combo++;
        const bonus = s.rage ? 3 : 1;
        s.score += TYPES[o.typeIdx].points * s.combo * bonus;
        clearTimeout(s.comboTimer);
        s.comboTimer=setTimeout(()=>{s.combo=0;},1600);
        const ang=Math.atan2(dy,dx);
        const pow=(s.rage?22:13)+Math.random()*5;
        s.hits.push({
          id:Date.now()+Math.random(),
          x:o.x+OS/2, y:o.y,
          text: s.rage ? "ブチかました！🔥" : s.combo>=2?`${s.combo}コンボ！`:"ドカッ！",
          combo:s.combo, alpha:1, rage:s.rage
        });
        return {...o, state:"flying", flyVx:Math.cos(ang)*pow, flyVy:Math.sin(ang)*pow-6, rotation:0};
      }
      return o;
    });
    if(hit){ setScore(s.score); doShake(s.rage); }
  },[]);

  // Touch
  useEffect(()=>{
    const el=cvs.current; if(!el) return;
    const rect=()=>el.getBoundingClientRect();
    const onStart=e=>{
      e.preventDefault();
      Array.from(e.changedTouches).forEach(t=>{
        const r=rect();
        const cx=(t.clientX-r.left)*(GW/r.width);
        const cy=(t.clientY-r.top)*(GH/r.height);
        if(cx<GW/2){
          joystick.current={active:true,id:t.identifier,startX:cx,startY:cy,dx:0,dy:0};
        } else { punch(); }
      });
    };
    const onMove=e=>{
      e.preventDefault();
      const r=rect();
      Array.from(e.changedTouches).forEach(t=>{
        const j=joystick.current;
        if(j.active&&t.identifier===j.id){
          j.dx=(t.clientX-r.left)*(GW/r.width)-j.startX;
          j.dy=(t.clientY-r.top)*(GH/r.height)-j.startY;
        }
      });
    };
    const onEnd=e=>{
      Array.from(e.changedTouches).forEach(t=>{
        if(joystick.current.id===t.identifier) joystick.current.active=false;
      });
    };
    el.addEventListener("touchstart",onStart,{passive:false});
    el.addEventListener("touchmove",onMove,{passive:false});
    el.addEventListener("touchend",onEnd,{passive:false});
    return()=>{
      el.removeEventListener("touchstart",onStart);
      el.removeEventListener("touchmove",onMove);
      el.removeEventListener("touchend",onEnd);
    };
  },[punch,screen]);

  useEffect(()=>{
    const fn=e=>{
      S.current.keys[e.key]=e.type==="keydown";
      if(e.type==="keydown"&&(e.key===" "||e.key==="z"||e.key==="Z")) punch();
    };
    window.addEventListener("keydown",fn);
    window.addEventListener("keyup",fn);
    return()=>{window.removeEventListener("keydown",fn);window.removeEventListener("keyup",fn);};
  },[punch]);

  useEffect(()=>{
    if(screen!=="playing") return;
    const loop=()=>{
      const s=S.current;
      const ctx=cvs.current?.getContext("2d");
      if(!ctx) return;
      s.frame++;
      const k=s.keys;
      const j=joystick.current;
      const SPD = s.rage ? 7 : 4.5;

      // Scroll progress
      s.scrollY += s.rage ? 4 : 2;
      const prog = Math.min(1, s.scrollY/STAGE_LENGTH);
      setProgress(prog);
      if(prog>=1){ setHi(p=>Math.max(p,s.score)); setScreen("clear"); return; }

      // Rage timer
      if(s.rageTimer>0){
        s.rageTimer--;
        if(s.rageTimer<=0){ s.rage=false; setRage(false); s.invincible=0; }
      }
      if(s.invincible>0) s.invincible--;

      // Move player
      let vx=0,vy=0;
      if(j.active){
        const len=Math.hypot(j.dx,j.dy)||1;
        const clamped=Math.min(len,50);
        vx=(j.dx/len)*(clamped/50)*SPD*1.4;
        vy=(j.dy/len)*(clamped/50)*SPD*1.4;
      }
      if(k["ArrowLeft"]||k["a"]||k["A"]) vx=-SPD;
      if(k["ArrowRight"]||k["d"]||k["D"]) vx=SPD;
      if(k["ArrowUp"]||k["w"]||k["W"]) vy=-SPD;
      if(k["ArrowDown"]||k["s"]||k["S"]) vy=SPD;
      s.player.x=Math.max(0,Math.min(GW-PS,s.player.x+vx));
      s.player.y=Math.max(0,Math.min(GH-PS-110,s.player.y+vy));

      if(s.punchTimer>0) s.punchTimer--; else s.punching=false;

      // Spawn
      s.spawnT++;
      const interval = s.rage ? Math.max(20,s.spawnInt*0.5) : Math.max(35,s.spawnInt-0.5);
      if(s.spawnT>=interval){
        s.spawnT=0;
        s.ojisans.push(mkOjisan(s.nextId++,s.scrollY,s.rage));
      }

      // Update ojisans
      s.ojisans=s.ojisans.map(o=>{
        if(o.state==="lurk"){
          // Silently creep in, slowly fade visible
          const dx=(s.player.x+PS/2)-(o.x+OS/2);
          const dy=(s.player.y+PS/2)-(o.y+OS/2);
          const d=Math.hypot(dx,dy)||1;
          const creepSpeed=o.speed*0.35;
          o={...o, x:o.x+dx/d*creepSpeed, y:o.y+dy/d*creepSpeed,
            alpha:Math.min(1,o.alpha+0.012),
            lurkTimer:o.lurkTimer-1};
          if(o.lurkTimer<=0) o={...o,state:"walking"};
          return o;
        }
        if(o.state==="walking"){
          const dx=(s.player.x+PS/2)-(o.x+OS/2);
          const dy=(s.player.y+PS/2)-(o.y+OS/2);
          const d=Math.hypot(dx,dy)||1;
          o={...o,x:o.x+dx/d*o.speed,y:o.y+dy/d*o.speed};
          // Balloon: only after lurk phase (walking)
          if(!o.balloon&&Math.random()<0.006){
            const arr=TYPES[o.typeIdx].balloons;
            o={...o,balloon:arr[Math.floor(Math.random()*arr.length)],balloonTimer:100};
          }
          if(o.balloonTimer>0) o={...o,balloonTimer:o.balloonTimer-1};
          else if(o.balloon) o={...o,balloon:null,balloonTimer:0};

          // Hit player
          const dist=Math.hypot((o.x+OS/2)-(s.player.x+PS/2),(o.y+OS/2)-(s.player.y+PS/2));
          if(dist<26 && s.invincible<=0){
            if(s.rage){
              // In rage mode, player bounces them away
              const ang=Math.atan2((o.y+OS/2)-(s.player.y+PS/2),(o.x+OS/2)-(s.player.x+PS/2));
              return {...o,state:"flying",flyVx:Math.cos(ang)*18,flyVy:Math.sin(ang)*18-6,rotation:0};
            }
            s.life=Math.max(0,s.life-25);
            s.invincible=60;
            setLife(s.life);
            doShake(true);
            if(s.life<=0){
              // RAGE MODE TRIGGER
              s.rage=true; s.rageTimer=300; s.life=100; s.invincible=30;
              s.ojisans.forEach(oj=>{ if(oj.state==="walking"||oj.state==="lurk") oj.speed*=0.5; });
              setLife(100); setRage(true);
              s.hits.push({id:Date.now(),x:GW/2,y:GH/2-40,text:"ガンギレ発動🔥",combo:99,alpha:1,rage:true,big:true});
            }
            return {...o,state:"dead"};
          }
        }
        if(o.state==="flying"){
          const nx=o.x+o.flyVx, ny=o.y+o.flyVy;
          if(nx<-150||nx>GW+150||ny>GH+150) return {...o,state:"dead"};
          return {...o,x:nx,y:ny,flyVy:o.flyVy+0.5,rotation:o.rotation+14};
        }
        return o;
      }).filter(o=>o.state!=="dead");

      s.hits=s.hits.map(h=>({...h,y:h.y-(h.big?3:2),alpha:h.alpha-(h.big?0.012:0.022)})).filter(h=>h.alpha>0);

      // ===== DRAW =====
      // BG - platform style
      const bg=ctx.createLinearGradient(0,0,0,GH);
      if(s.rage){
        bg.addColorStop(0,"#2a0808"); bg.addColorStop(1,"#1a0505");
      } else {
        bg.addColorStop(0,"#12082a"); bg.addColorStop(1,"#0a1a30");
      }
      ctx.fillStyle=bg; ctx.fillRect(0,0,GW,GH);

      // Platform floor tiles
      const tileOffset=(s.scrollY*1.5)%80;
      ctx.fillStyle= s.rage ? "rgba(180,30,30,0.08)" : "rgba(255,255,255,0.03)";
      for(let y=-tileOffset;y<GH;y+=80){
        ctx.fillRect(0,y,GW,2);
      }
      // Platform pillars
      for(let i=0;i<5;i++){
        const px=i*(GW/4);
        ctx.fillStyle=s.rage?"rgba(180,30,30,0.06)":"rgba(255,255,255,0.025)";
        ctx.fillRect(px,0,2,GH);
      }
      // Yellow safety line
      ctx.fillStyle=s.rage?"rgba(255,50,50,0.15)":"rgba(255,220,50,0.08)";
      ctx.fillRect(0,GH-108,GW,3);

      // Rage aura on ground
      if(s.rage){
        const rg=ctx.createRadialGradient(GW/2,GH,0,GW/2,GH,300);
        rg.addColorStop(0,"rgba(255,50,0,0.15)"); rg.addColorStop(1,"transparent");
        ctx.fillStyle=rg; ctx.fillRect(0,0,GW,GH);
      }

      // Touch hint
      ctx.fillStyle="rgba(255,255,255,0.04)";
      ctx.fillRect(0,GH-105,GW/2,105);
      ctx.fillStyle=s.rage?"rgba(255,80,0,0.06)":"rgba(255,80,80,0.04)";
      ctx.fillRect(GW/2,GH-105,GW/2,105);
      ctx.fillStyle="rgba(255,255,255,0.07)";
      ctx.font="11px sans-serif"; ctx.textAlign="center";
      ctx.fillText("👈 移動",GW/4,GH-12);
      ctx.fillText("👊 パンチ",GW*3/4,GH-12);

      // Joystick
      if(j.active){
        ctx.strokeStyle="rgba(255,255,255,0.18)"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(j.startX,j.startY,35,0,Math.PI*2); ctx.stroke();
        const len=Math.min(Math.hypot(j.dx,j.dy),35);
        const ang2=Math.atan2(j.dy,j.dx);
        ctx.fillStyle="rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(j.startX+Math.cos(ang2)*len,j.startY+Math.sin(ang2)*len,15,0,Math.PI*2); ctx.fill();
      }

      // Ojisans
      s.ojisans.forEach(o=>{
        const T=TYPES[o.typeIdx];
        ctx.save();
        ctx.translate(o.x+OS/2,o.y+OS/2);
        ctx.rotate(o.rotation*Math.PI/180);
        ctx.globalAlpha=o.alpha??1;

        // Shadow
        ctx.fillStyle="rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(0,OS/2,18,5,0,0,Math.PI*2); ctx.fill();

        // Lurk shimmer effect
        if(o.state==="lurk"){
          ctx.strokeStyle=`rgba(255,255,255,${0.1+Math.sin(s.frame*0.1)*0.05})`;
          ctx.lineWidth=1;
          ctx.beginPath(); ctx.ellipse(0,0,OS/2+4,OS/2+4,0,0,Math.PI*2); ctx.stroke();
        }

        // Body
        ctx.fillStyle=o.state==="flying"?"#ff6b35":T.color;
        ctx.beginPath(); ctx.roundRect(-15,-8,30,30,5); ctx.fill();

        // Head
        ctx.fillStyle="#f5c5a0";
        ctx.beginPath(); ctx.arc(0,-18,13,0,Math.PI*2); ctx.fill();

        // Bald head + side hair
        ctx.fillStyle="#2c1810";
        ctx.beginPath(); ctx.arc(-11,-23,6,Math.PI,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(11,-23,6,Math.PI,Math.PI*2); ctx.fill();

        // Eyes — during lurk: shifty sideways eyes
        ctx.fillStyle="#000";
        if(o.state==="lurk"){
          // sideways glancing eyes
          ctx.beginPath(); ctx.arc(-3,-19,2,0,Math.PI*2); ctx.arc(5,-19,2,0,Math.PI*2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(-4,-19,2,0,Math.PI*2); ctx.arc(4,-19,2,0,Math.PI*2); ctx.fill();
          // Angry brows (only when walking)
          ctx.strokeStyle="#000"; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(-8,-25);ctx.lineTo(-1,-22);ctx.moveTo(8,-25);ctx.lineTo(1,-22); ctx.stroke();
        }

        // Type badge
        ctx.textAlign="center";
        if(o.typeIdx===1){
          ctx.fillStyle="rgba(80,200,80,0.75)";
          ctx.beginPath(); ctx.arc(20,-4,9,0,Math.PI*2); ctx.fill();
          ctx.font="11px serif"; ctx.fillText("💨",16,-1);
        } else if(o.typeIdx===2){
          ctx.fillStyle="rgba(200,40,40,0.8)";
          ctx.beginPath(); ctx.arc(20,-4,9,0,Math.PI*2); ctx.fill();
          ctx.fillStyle="#fff"; ctx.font="bold 9px sans-serif"; ctx.fillText("怒",17,-1);
        } else {
          ctx.fillStyle="#8b6914";
          ctx.beginPath(); ctx.roundRect(12,2,10,12,2); ctx.fill();
        }

        // Balloon (only walking phase)
        if(o.balloon&&o.balloonTimer>0&&o.state==="walking"){
          const a=o.balloonTimer>70?1:o.balloonTimer/70;
          ctx.globalAlpha*=a;
          const bw=o.balloon.length*9+20;
          ctx.fillStyle="rgba(255,255,255,0.93)";
          ctx.strokeStyle="#ccc"; ctx.lineWidth=1;
          ctx.beginPath(); ctx.roundRect(-bw/2,-56,bw,26,6); ctx.fill(); ctx.stroke();
          ctx.fillStyle=o.typeIdx===2?"#c0392b":o.typeIdx===1?"#27ae60":"#333";
          ctx.font="bold 13px 'Hiragino Sans',sans-serif";
          ctx.fillText(o.balloon,0,-38);
        }

        if(o.state==="flying"){
          ctx.globalAlpha=1;
          for(let i=0;i<4;i++){
            const a=(i/4)*Math.PI*2+s.frame*0.25;
            ctx.fillStyle=`hsl(${i*80+s.frame*8},100%,65%)`;
            ctx.font="12px serif"; ctx.fillText("★",Math.cos(a)*22-6,Math.sin(a)*22);
          }
        }
        ctx.restore();
      });

      // Player
      ctx.save();
      ctx.translate(s.player.x+PS/2,s.player.y+PS/2);
      const mv=Math.hypot(vx,vy)>0;
      ctx.rotate(Math.sin(s.frame*0.2)*(mv?0.12:0));

      // Invincible flicker
      if(s.invincible>0 && Math.floor(s.frame/4)%2===0){
        ctx.globalAlpha=0.4;
      }

      // Rage aura
      if(s.rage){
        const rageGlow=ctx.createRadialGradient(0,0,0,0,0,40);
        rageGlow.addColorStop(0,"rgba(255,50,0,0.4)");
        rageGlow.addColorStop(1,"transparent");
        ctx.fillStyle=rageGlow;
        ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI*2); ctx.fill();
        ctx.shadowColor="#ff3300"; ctx.shadowBlur=20+Math.sin(s.frame*0.2)*8;
      }

      ctx.fillStyle="rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(0,PS/2,13,5,0,0,Math.PI*2); ctx.fill();

      if(s.punching||s.rage){ctx.shadowColor=s.rage?"#ff2200":"#ff3366";ctx.shadowBlur=s.rage?30:22;}
      ctx.fillStyle=s.rage?"#ff2200":s.punching?"#ff3366":"#eef6ff";
      ctx.beginPath(); ctx.roundRect(-13,-8,26,26,5); ctx.fill();
      ctx.shadowBlur=0;

      ctx.fillStyle="#f5c5a0";
      ctx.beginPath(); ctx.arc(0,-16,12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#1a0800";
      ctx.beginPath(); ctx.arc(0,-24,9,Math.PI,Math.PI*2); ctx.fill();

      // Eyes: rage = fiery
      if(s.rage){
        ctx.fillStyle="#ff4400";
        ctx.beginPath(); ctx.arc(-4,-17,3,0,Math.PI*2); ctx.arc(4,-17,3,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="#ff0"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(-7,-21);ctx.lineTo(-1,-18);ctx.moveTo(7,-21);ctx.lineTo(1,-18); ctx.stroke();
      } else {
        ctx.fillStyle="#000";
        ctx.beginPath(); ctx.arc(-4,-17,2,0,Math.PI*2); ctx.arc(4,-17,2,0,Math.PI*2); ctx.fill();
      }

      if(s.punching){
        ctx.fillStyle=s.rage?"rgba(255,30,0,0.9)":"rgba(255,80,40,0.85)";
        ctx.beginPath(); ctx.arc(s.rage?28:22,0,s.rage?18:14,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#fff"; ctx.font=`bold ${s.rage?13:11}px sans-serif`; ctx.textAlign="center";
        ctx.fillText(s.rage?"ブチかます!!":"ドン!",s.rage?28:22,4);
      }
      ctx.globalAlpha=1;
      ctx.restore();

      // Hit effects
      s.hits.forEach(h=>{
        ctx.save(); ctx.globalAlpha=h.alpha;
        const fs=h.big?28:18+h.combo*2;
        ctx.font=`bold ${fs}px 'Hiragino Sans',sans-serif`;
        ctx.textAlign="center";
        ctx.fillStyle=h.big?"#ff4400":h.rage?"#ff6600":h.combo>=5?"#ff0":h.combo>=3?"#f90":"#fff";
        ctx.strokeStyle="#000"; ctx.lineWidth=3;
        ctx.strokeText(h.text,h.x,h.y); ctx.fillText(h.text,h.x,h.y);
        ctx.restore();
      });

      // HUD - life bar
      ctx.fillStyle="rgba(0,0,0,0.5)";
      ctx.beginPath(); ctx.roundRect(12,12,160,18,9); ctx.fill();
      const lifeColor = s.rage?"#ff3300":s.life>60?"#44dd44":s.life>30?"#ffaa00":"#ff4444";
      ctx.fillStyle=lifeColor;
      ctx.beginPath(); ctx.roundRect(14,14,(156*(s.life/100)),14,7); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 11px sans-serif"; ctx.textAlign="left";
      ctx.fillText(s.rage?"🔥 GANKIRE MODE":"HP",16,24);

      // Rage mode flashing text
      if(s.rage && Math.floor(s.frame/15)%2===0){
        ctx.fillStyle="rgba(255,50,0,0.85)";
        ctx.font="bold 14px 'Hiragino Sans',sans-serif";
        ctx.textAlign="left";
        ctx.fillText("⚡ 無敵・超強化中",16,44);
      }

      // Score
      ctx.fillStyle="#fff"; ctx.font="bold 16px 'Hiragino Sans',sans-serif";
      ctx.textAlign="right"; ctx.fillText(`スコア: ${s.score}`,GW-12,28);
      if(s.combo>1){
        ctx.fillStyle=s.rage?"#ff6600":"#ff0";
        ctx.font=`bold ${12+s.combo*2}px 'Hiragino Sans',sans-serif`;
        ctx.fillText(`🔥 ${s.combo} COMBO`,GW-12,50);
      }

      // Progress bar (bottom)
      ctx.fillStyle="rgba(0,0,0,0.4)";
      ctx.fillRect(0,GH-108,GW,6);
      const progColor=s.rage?"#ff4400":"#44aaff";
      ctx.fillStyle=progColor;
      ctx.fillRect(0,GH-108,GW*prog,6);
      ctx.fillStyle="rgba(255,255,255,0.5)";
      ctx.font="10px sans-serif"; ctx.textAlign="center";
      ctx.fillText(`🚃 ホーム通過まで ${Math.round((1-prog)*100)}%`,GW/2,GH-112);

      setScore(s.score);
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[screen]);

  const OL=({children,bg="rgba(0,0,0,0.9)"})=>(
    <div style={{position:"absolute",inset:0,borderRadius:16,background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,backdropFilter:"blur(8px)"}}>
      {children}
    </div>
  );
  const Btn=({label,onClick,color="linear-gradient(135deg,#ff3366,#ff6b35)"})=>(
    <button onClick={onClick} style={{padding:"14px 44px",fontSize:20,fontWeight:"bold",background:color,color:"#fff",border:"none",borderRadius:30,cursor:"pointer",boxShadow:"0 4px 20px rgba(255,51,102,0.4)",letterSpacing:2,WebkitTapHighlightColor:"transparent"}}>
      {label}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#08001a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Hiragino Sans','Yu Gothic',sans-serif",userSelect:"none",WebkitUserSelect:"none"}}>
      <div style={{position:"relative",width:GW,transform:shake?`translate(${(Math.random()-.5)*10}px,${(Math.random()-.5)*10}px)`:"none",transition:shake?"none":"transform 0.1s"}}>
        <canvas ref={cvs} width={GW} height={GH}
          style={{display:"block",borderRadius:16,boxShadow:`0 0 60px ${rage?"rgba(255,60,0,0.6)":"rgba(120,60,255,0.4)"}`,border:`2px solid ${rage?"rgba(255,60,0,0.4)":"rgba(255,255,255,0.08)"}`,touchAction:"none",maxWidth:"100vw"}}
        />

        {screen==="title" && <OL bg="linear-gradient(180deg,#1a0a2e,#0d1f3c)">
          <div style={{fontSize:52}}>👊</div>
          <h1 style={{color:"#fff",fontSize:28,textAlign:"center",margin:0,lineHeight:1.4,textShadow:"0 0 20px #ff3366"}}>
            ぶつかりおじさん<br/>
            <span style={{fontSize:14,color:"#999",fontWeight:"normal"}}>ぶっ飛ばしゲーム</span>
          </h1>
          <div style={{color:"#bbb",fontSize:12,textAlign:"center",lineHeight:2.2,background:"rgba(255,255,255,0.05)",padding:"12px 20px",borderRadius:10}}>
            📱 左タップ&スワイプ: 移動　右タップ: パンチ<br/>
            💼 ぶつかり　<span style={{color:"#5aad6f"}}>🤧 咳かけ</span>　<span style={{color:"#e05c5c"}}>😡 暴言</span><br/>
            <span style={{color:"#ff6600"}}>⚡ やられたらガンギレ無敵発動！</span><br/>
            🚃 駅のホームを通り抜けたらクリア！
          </div>
          <Btn label="スタート！" onClick={reset}/>
          <div style={{color:"#555",fontSize:12}}>ハイスコア: {hi}</div>
        </OL>}

        {screen==="clear" && <OL bg="linear-gradient(180deg,#0a1a0a,#0a2a1a)">
          <div style={{fontSize:56}}>🎉</div>
          <h2 style={{color:"#44ff88",fontSize:30,margin:0,textShadow:"0 0 20px #44ff88",textAlign:"center"}}>
            ホーム通過！<br/>
            <span style={{fontSize:18,color:"#aaa",fontWeight:"normal"}}>理不尽に負けなかった！</span>
          </h2>
          <div style={{color:"#fff",fontSize:24}}>スコア: {score}</div>
          <div style={{color:"#ffd700",fontSize:17}}>🏆 ハイスコア: {hi}</div>
          <div style={{color:"#aaa",fontSize:13,textAlign:"center",lineHeight:1.8,padding:"0 20px"}}>
            今日も負けなかった💪<br/>
            <span style={{fontSize:11}}>明日も無事に通り抜けられますように</span>
          </div>
          <Btn label="もう一度！" onClick={reset}/>
        </OL>}
      </div>
    </div>
  );
}