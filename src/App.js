import { useState, useEffect, useRef, useCallback } from "react";

const GW = 390, GH = 650, PS = 38, OS = 46, PR = 80;
const STAGE_LENGTH = 3000;

const TYPES = [
  { type:"bump",   color:"#4a90d9", points:100, balloons:["ドン！","ぶつかるぞ！"] },
  { type:"cough",  color:"#5aad6f", points:150, balloons:["ゴホッ！","ゴホゴホ！","ケホッ！"] },
  { type:"insult", color:"#c0392b", points:200, balloons:["ブス！","うるさい！","どけ！","チッ！"] },
];

// 通行人（無害・背景）
function mkPasserby(id) {
  const side = Math.random() > 0.5 ? "left" : "right";
  const colors = ["#888","#999","#777","#aaa","#666"];
  return {
    id, kind:"passerby",
    x: side==="left" ? -OS : GW,
    y: Math.random()*(GH-200)+60,
    vx: side==="left" ? 1.5+Math.random() : -(1.5+Math.random()),
    color: colors[Math.floor(Math.random()*colors.length)],
    alpha: 0.45 + Math.random()*0.3,
  };
}

function mkOjisan(id, score, rage) {
  const side = Math.random() > 0.5 ? "left" : "right";
  const typeIdx = Math.random() < 0.45 ? 0 : Math.random() < 0.55 ? 1 : 2;
  const baseLurk = 140 + Math.floor(Math.random()*80);
  return {
    id, typeIdx, kind:"ojisan",
    x: side==="left" ? -OS : GW,
    y: Math.random()*(GH-300)+60,
    state: "lurk",
    lurkTimer: baseLurk,
    flyVx:0, flyVy:0, rotation:0,
    speed: (rage ? 2.5 : 0.8) + Math.min(1.2, score/4000) + Math.random()*0.3,
    balloon:null, balloonTimer:0,
    alpha:0,
  };
}

export default function App() {
  const [screen, setScreen] = useState("title");
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState(0);
  const [lifeDisplay, setLifeDisplay] = useState(100);
  const [rage, setRage] = useState(false);
  const [shake, setShake] = useState(false);
  const cvs = useRef(null);
  const raf = useRef(null);
  const touchState = useRef({ moveId:-1, startX:0, startY:0, dx:0, dy:0, active:false });
  const S = useRef({
    player:{x:GW/2-PS/2, y:GH-180},
    ojisans:[], passerbys:[], hits:[],
    score:0, life:100, combo:0, comboTimer:null,
    punching:false, punchTimer:0,
    frame:0, spawnT:0, spawnInt:130,
    pbySpawnT:0, pbySpawnInt:40,
    nextId:0, scrollY:0,
    rage:false, rageTimer:0, invincible:0,
    keys:{},
  });

  const doShake = (hard=false) => { setShake(true); setTimeout(()=>setShake(false), hard?400:200); };

  const reset = () => {
    const s = S.current;
    Object.assign(s,{
      player:{x:GW/2-PS/2,y:GH-180}, ojisans:[], passerbys:[], hits:[],
      score:0, life:100, combo:0, punching:false, punchTimer:0,
      frame:0, spawnT:0, spawnInt:130, pbySpawnT:0, pbySpawnInt:40,
      nextId:0, scrollY:0, rage:false, rageTimer:0, invincible:0, keys:{},
    });
    touchState.current = {moveId:-1,startX:0,startY:0,dx:0,dy:0,active:false};
    setScore(0); setLifeDisplay(100); setRage(false); setShake(false);
    setScreen("playing");
  };

  const punch = useCallback(() => {
    const s = S.current;
    if (s.punching && !s.rage) return;
    s.punching=true; s.punchTimer=s.rage?8:18;
    let hit=false;
    const range = s.rage ? PR*1.7 : PR;
    s.ojisans = s.ojisans.map(o=>{
      if(o.state!=="walking"&&o.state!=="lurk") return o;
      const dx=(o.x+OS/2)-(s.player.x+PS/2);
      const dy=(o.y+OS/2)-(s.player.y+PS/2);
      if(Math.hypot(dx,dy)<range){
        hit=true; s.combo++;
        s.score += TYPES[o.typeIdx].points * s.combo * (s.rage?3:1);
        clearTimeout(s.comboTimer);
        s.comboTimer=setTimeout(()=>{s.combo=0;},1600);
        const ang=Math.atan2(dy,dx), pow=(s.rage?22:13)+Math.random()*5;
        s.hits.push({id:Date.now()+Math.random(),x:o.x+OS/2,y:o.y,
          text:s.rage?"ブチかました！🔥":s.combo>=2?`${s.combo}コンボ！`:"ドカッ！",
          combo:s.combo,alpha:1,rage:s.rage});
        return {...o,state:"flying",flyVx:Math.cos(ang)*pow,flyVy:Math.sin(ang)*pow-6,rotation:0};
      }
      return o;
    });
    if(hit){setScore(s.score);doShake(s.rage);}
  },[]);

  // Touch handling — left half = joystick move, right half = punch
  useEffect(()=>{
    const el=cvs.current; if(!el) return;
    const R=()=>el.getBoundingClientRect();

    const onStart=e=>{
      e.preventDefault();
      Array.from(e.changedTouches).forEach(t=>{
        const r=R();
        const cx=(t.clientX-r.left)*(GW/r.width);
        const cy=(t.clientY-r.top)*(GH/r.height);
        if(cx < GW/2){
          // joystick
          touchState.current={active:true,moveId:t.identifier,startX:cx,startY:cy,dx:0,dy:0};
        } else {
          punch();
        }
      });
    };
    const onMove=e=>{
      e.preventDefault();
      const r=R();
      Array.from(e.changedTouches).forEach(t=>{
        const ts=touchState.current;
        if(ts.active && t.identifier===ts.moveId){
          ts.dx=(t.clientX-r.left)*(GW/r.width)-ts.startX;
          ts.dy=(t.clientY-r.top)*(GH/r.height)-ts.startY;
        }
      });
    };
    const onEnd=e=>{
      Array.from(e.changedTouches).forEach(t=>{
        const ts=touchState.current;
        if(t.identifier===ts.moveId){
          ts.active=false; ts.dx=0; ts.dy=0;
        }
      });
    };
    el.addEventListener("touchstart",onStart,{passive:false});
    el.addEventListener("touchmove",onMove,{passive:false});
    el.addEventListener("touchend",onEnd,{passive:false});
    el.addEventListener("touchcancel",onEnd,{passive:false});
    return()=>{
      el.removeEventListener("touchstart",onStart);
      el.removeEventListener("touchmove",onMove);
      el.removeEventListener("touchend",onEnd);
      el.removeEventListener("touchcancel",onEnd);
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
      const ts=touchState.current;
      const SPD=s.rage?7:4.2;

      // Scroll
      s.scrollY+=s.rage?4:1.8;
      const prog=Math.min(1,s.scrollY/STAGE_LENGTH);
      if(prog>=1){setHi(p=>Math.max(p,s.score));setScreen("clear");return;}

      // Rage timer
      if(s.rageTimer>0){ s.rageTimer--; if(s.rageTimer<=0){s.rage=false;setRage(false);s.invincible=0;} }
      if(s.invincible>0) s.invincible--;

      // Player movement
      let vx=0,vy=0;
      if(ts.active){
        const len=Math.hypot(ts.dx,ts.dy)||1;
        const clamped=Math.min(len,50);
        vx=(ts.dx/len)*(clamped/50)*SPD*1.5;
        vy=(ts.dy/len)*(clamped/50)*SPD*1.5;
      }
      if(k["ArrowLeft"]||k["a"]||k["A"]) vx=-SPD;
      if(k["ArrowRight"]||k["d"]||k["D"]) vx=SPD;
      if(k["ArrowUp"]||k["w"]||k["W"]) vy=-SPD;
      if(k["ArrowDown"]||k["s"]||k["S"]) vy=SPD;
      s.player.x=Math.max(0,Math.min(GW-PS,s.player.x+vx));
      s.player.y=Math.max(0,Math.min(GH-PS-110,s.player.y+vy));

      if(s.punchTimer>0) s.punchTimer--; else s.punching=false;

      // Spawn passersby
      s.pbySpawnT++;
      if(s.pbySpawnT>=s.pbySpawnInt){
        s.pbySpawnT=0;
        s.passerbys.push(mkPasserby(s.nextId++));
        if(s.passerbys.length>18) s.passerbys.shift();
      }

      // Spawn ojisans
      s.spawnT++;
      const spInterval=s.rage?Math.max(25,s.spawnInt*0.4):Math.max(55,s.spawnInt-0.4);
      if(s.spawnT>=spInterval){
        s.spawnT=0;
        s.ojisans.push(mkOjisan(s.nextId++,s.score,s.rage));
      }

      // Update passerbys
      s.passerbys=s.passerbys.map(p=>({...p,x:p.x+p.vx}))
        .filter(p=>p.x>-80&&p.x<GW+80);

      // Update ojisans
      s.ojisans=s.ojisans.map(o=>{
        if(o.state==="lurk"){
          const dx=(s.player.x+PS/2)-(o.x+OS/2);
          const dy=(s.player.y+PS/2)-(o.y+OS/2);
          const d=Math.hypot(dx,dy)||1;
          o={...o,
            x:o.x+dx/d*o.speed*0.28,
            y:o.y+dy/d*o.speed*0.28,
            alpha:Math.min(0.55,o.alpha+0.008), // stays semi-transparent during lurk
            lurkTimer:o.lurkTimer-1,
          };
          if(o.lurkTimer<=0) o={...o,state:"walking",alpha:1};
          return o;
        }
        if(o.state==="walking"){
          const dx=(s.player.x+PS/2)-(o.x+OS/2);
          const dy=(s.player.y+PS/2)-(o.y+OS/2);
          const d=Math.hypot(dx,dy)||1;
          o={...o,x:o.x+dx/d*o.speed,y:o.y+dy/d*o.speed};
          if(!o.balloon&&Math.random()<0.005){
            const arr=TYPES[o.typeIdx].balloons;
            o={...o,balloon:arr[Math.floor(Math.random()*arr.length)],balloonTimer:100};
          }
          if(o.balloonTimer>0) o={...o,balloonTimer:o.balloonTimer-1};
          else if(o.balloon) o={...o,balloon:null,balloonTimer:0};
          const dist=Math.hypot((o.x+OS/2)-(s.player.x+PS/2),(o.y+OS/2)-(s.player.y+PS/2));
          if(dist<26&&s.invincible<=0){
            if(s.rage){
              const ang=Math.atan2((o.y+OS/2)-(s.player.y+PS/2),(o.x+OS/2)-(s.player.x+PS/2));
              return {...o,state:"flying",flyVx:Math.cos(ang)*18,flyVy:Math.sin(ang)*16-4,rotation:0};
            }
            s.life=Math.max(0,s.life-28);
            s.invincible=70; s.combo=0;
            setLifeDisplay(s.life); doShake(true);
            if(s.life<=0){
              s.rage=true; s.rageTimer=320; s.life=100; s.invincible=40;
              setLifeDisplay(100); setRage(true);
              s.hits.push({id:Date.now(),x:GW/2,y:GH/2-60,text:"ガンギレ発動🔥",combo:99,alpha:1,rage:true,big:true});
            }
            return {...o,state:"dead"};
          }
        }
        if(o.state==="flying"){
          const nx=o.x+o.flyVx,ny=o.y+o.flyVy;
          if(nx<-160||nx>GW+160||ny>GH+160) return {...o,state:"dead"};
          return {...o,x:nx,y:ny,flyVy:o.flyVy+0.5,rotation:o.rotation+14};
        }
        return o;
      }).filter(o=>o.state!=="dead");

      s.hits=s.hits.map(h=>({...h,y:h.y-(h.big?3:2),alpha:h.alpha-(h.big?0.01:0.02)})).filter(h=>h.alpha>0);

      // ===== DRAW =====
      const bg=ctx.createLinearGradient(0,0,0,GH);
      if(s.rage){ bg.addColorStop(0,"#2a0808"); bg.addColorStop(1,"#1a0505"); }
      else { bg.addColorStop(0,"#12082a"); bg.addColorStop(1,"#0a1a30"); }
      ctx.fillStyle=bg; ctx.fillRect(0,0,GW,GH);

      // Platform floor lines scrolling
      const tOff=(s.scrollY*1.8)%80;
      ctx.strokeStyle=s.rage?"rgba(180,30,30,0.1)":"rgba(255,255,255,0.04)";
      ctx.lineWidth=1;
      for(let y=-tOff;y<GH;y+=80){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(GW,y);ctx.stroke(); }
      for(let x=0;x<GW;x+=GW/4){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,GH);ctx.stroke(); }

      // Yellow line
      ctx.fillStyle=s.rage?"rgba(255,50,50,0.12)":"rgba(255,220,50,0.07)";
      ctx.fillRect(0,GH-108,GW,3);

      // Rage ground glow
      if(s.rage){
        const rg=ctx.createRadialGradient(GW/2,GH,0,GW/2,GH,280);
        rg.addColorStop(0,"rgba(255,50,0,0.18)"); rg.addColorStop(1,"transparent");
        ctx.fillStyle=rg; ctx.fillRect(0,0,GW,GH);
      }

      // ---- Draw passerbys (behind everything) ----
      s.passerbys.forEach(p=>{
        ctx.save();
        ctx.globalAlpha=p.alpha;
        ctx.translate(p.x+OS/2,p.y+OS/2);
        // simple silhouette
        ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.roundRect(-11,-6,22,24,4); ctx.fill();
        ctx.fillStyle="#d4a47a";
        ctx.beginPath(); ctx.arc(0,-15,10,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });

      // ---- Draw ojisans ----
      s.ojisans.forEach(o=>{
        const T=TYPES[o.typeIdx];
        ctx.save();
        ctx.translate(o.x+OS/2,o.y+OS/2);
        ctx.rotate(o.rotation*Math.PI/180);
        ctx.globalAlpha=o.alpha??1;

        // Lurk shimmer - ghostly outline only
        if(o.state==="lurk"){
          ctx.strokeStyle=`rgba(200,200,255,${0.15+Math.sin(s.frame*0.08)*0.08})`;
          ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.ellipse(0,2,OS/2,OS/2+2,0,0,Math.PI*2); ctx.stroke();
        }

        ctx.fillStyle="rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(0,OS/2,17,5,0,0,Math.PI*2); ctx.fill();

        ctx.fillStyle=o.state==="flying"?"#ff6b35":T.color;
        ctx.beginPath(); ctx.roundRect(-15,-8,30,30,5); ctx.fill();

        ctx.fillStyle="#f5c5a0";
        ctx.beginPath(); ctx.arc(0,-18,13,0,Math.PI*2); ctx.fill();

        ctx.fillStyle="#2c1810";
        ctx.beginPath(); ctx.arc(-11,-23,6,Math.PI,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(11,-23,6,Math.PI,Math.PI*2); ctx.fill();

        // Eyes: lurk = shifty, walking = angry
        ctx.fillStyle="#000";
        if(o.state==="lurk"){
          ctx.beginPath(); ctx.arc(-3,-19,1.5,0,Math.PI*2); ctx.arc(5,-19,1.5,0,Math.PI*2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(-4,-19,2,0,Math.PI*2); ctx.arc(4,-19,2,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle="#000"; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(-8,-25);ctx.lineTo(-1,-22);ctx.moveTo(8,-25);ctx.lineTo(1,-22); ctx.stroke();
        }

        ctx.textAlign="center";
        if(o.typeIdx===1){
          ctx.fillStyle="rgba(80,200,80,0.7)";
          ctx.beginPath(); ctx.arc(20,-4,9,0,Math.PI*2); ctx.fill();
          ctx.font="11px serif"; ctx.fillText("💨",16,-1);
        } else if(o.typeIdx===2){
          ctx.fillStyle="rgba(200,40,40,0.75)";
          ctx.beginPath(); ctx.arc(20,-4,9,0,Math.PI*2); ctx.fill();
          ctx.fillStyle="#fff"; ctx.font="bold 9px sans-serif"; ctx.fillText("怒",17,-1);
        } else {
          ctx.fillStyle="#8b6914";
          ctx.beginPath(); ctx.roundRect(12,2,10,12,2); ctx.fill();
        }

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

      // ---- Draw Player (female) ----
      ctx.save();
      ctx.translate(s.player.x+PS/2,s.player.y+PS/2);
      const mv=Math.hypot(vx,vy)>0;
      ctx.rotate(Math.sin(s.frame*0.18)*(mv?0.1:0));

      if(s.invincible>0&&Math.floor(s.frame/4)%2===0) ctx.globalAlpha=0.35;

      // Rage aura
      if(s.rage){
        const rg2=ctx.createRadialGradient(0,0,0,0,0,42);
        rg2.addColorStop(0,"rgba(255,50,0,0.45)"); rg2.addColorStop(1,"transparent");
        ctx.fillStyle=rg2; ctx.beginPath(); ctx.arc(0,0,42,0,Math.PI*2); ctx.fill();
        ctx.shadowColor="#ff3300"; ctx.shadowBlur=18+Math.sin(s.frame*0.2)*6;
      }

      // Punch range circle (subtle)
      const rangeR = s.rage ? PR*1.7 : PR;
      ctx.strokeStyle=s.rage?"rgba(255,80,0,0.35)":"rgba(255,255,255,0.12)";
      ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(0,0,rangeR,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);

      ctx.shadowBlur=0;

      // Shadow
      ctx.fillStyle="rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(0,PS/2,13,5,0,0,Math.PI*2); ctx.fill();

      // Body — skirt/dress style
      if(s.punching||s.rage) ctx.shadowColor=s.rage?"#ff2200":"#ff69b4",ctx.shadowBlur=s.rage?28:18;
      ctx.fillStyle=s.rage?"#ff2200":s.punching?"#ff69b4":"#e8a0bf";
      ctx.beginPath(); ctx.roundRect(-13,-6,26,22,5); ctx.fill();
      // Skirt flare
      ctx.beginPath();
      ctx.moveTo(-16,12); ctx.lineTo(-13,6); ctx.lineTo(13,6); ctx.lineTo(16,12);
      ctx.quadraticCurveTo(0,20,-16,12);
      ctx.fillStyle=s.rage?"#cc0000":s.punching?"#e05080":"#c97aa0";
      ctx.fill();
      ctx.shadowBlur=0;

      // Head
      ctx.fillStyle="#f5c5a0";
      ctx.beginPath(); ctx.arc(0,-16,12,0,Math.PI*2); ctx.fill();

      // Hair (longer, female)
      ctx.fillStyle=s.rage?"#ff2200":"#1a0a00";
      ctx.beginPath(); ctx.arc(0,-22,10,Math.PI,Math.PI*2); ctx.fill();
      // Side hair strands
      ctx.fillStyle=s.rage?"#ff2200":"#1a0a00";
      ctx.beginPath(); ctx.ellipse(-13,-18,4,8,0.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(13,-18,4,8,-0.3,0,Math.PI*2); ctx.fill();

      // Eyes
      if(s.rage){
        ctx.fillStyle="#ff4400";
        ctx.beginPath(); ctx.arc(-4,-17,3,0,Math.PI*2); ctx.arc(4,-17,3,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="#ff0"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(-7,-21);ctx.lineTo(-1,-18);ctx.moveTo(7,-21);ctx.lineTo(1,-18); ctx.stroke();
      } else {
        ctx.fillStyle="#444";
        ctx.beginPath(); ctx.arc(-4,-17,2.5,0,Math.PI*2); ctx.arc(4,-17,2.5,0,Math.PI*2); ctx.fill();
        // Eyelashes
        ctx.strokeStyle="#222"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-6,-19);ctx.lineTo(-5,-21);ctx.moveTo(-4,-19.5);ctx.lineTo(-4,-22);ctx.moveTo(-2,-19);ctx.lineTo(-1,-21); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2,-19);ctx.lineTo(1,-21);ctx.moveTo(4,-19.5);ctx.lineTo(4,-22);ctx.moveTo(6,-19);ctx.lineTo(5,-21); ctx.stroke();
      }

      // Punch effect
      if(s.punching){
        ctx.fillStyle=s.rage?"rgba(255,30,0,0.9)":"rgba(255,100,180,0.85)";
        ctx.beginPath(); ctx.arc(s.rage?28:22,0,s.rage?18:14,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#fff"; ctx.font=`bold ${s.rage?13:11}px sans-serif`; ctx.textAlign="center";
        ctx.fillText(s.rage?"ブチかます!!":"ドン!",s.rage?28:22,4);
      }

      ctx.globalAlpha=1;
      ctx.restore();

      // Hit effects
      s.hits.forEach(h=>{
        ctx.save(); ctx.globalAlpha=h.alpha;
        const fs=h.big?30:18+Math.min(h.combo*2,14);
        ctx.font=`bold ${fs}px 'Hiragino Sans',sans-serif`;
        ctx.textAlign="center";
        ctx.fillStyle=h.big?"#ff4400":h.rage?"#ff6600":h.combo>=5?"#ff0":h.combo>=3?"#f90":"#fff";
        ctx.strokeStyle="#000"; ctx.lineWidth=3;
        ctx.strokeText(h.text,h.x,h.y); ctx.fillText(h.text,h.x,h.y);
        ctx.restore();
      });

      // ---- HUD ----
      // Life bar
      ctx.fillStyle="rgba(0,0,0,0.5)";
      ctx.beginPath(); ctx.roundRect(12,12,160,18,9); ctx.fill();
      const lifeW=156*(s.life/100);
      const lifeCol=s.rage?"#ff3300":s.life>60?"#44dd44":s.life>30?"#ffaa00":"#ff4444";
      ctx.fillStyle=lifeCol;
      ctx.beginPath(); ctx.roundRect(14,14,lifeW,14,7); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 10px sans-serif"; ctx.textAlign="left";
      ctx.fillText(s.rage?"🔥 GANKIRE":"HP",16,24);

      if(s.rage&&Math.floor(s.frame/15)%2===0){
        ctx.fillStyle="rgba(255,50,0,0.9)";
        ctx.font="bold 13px 'Hiragino Sans',sans-serif";
        ctx.fillText("⚡ 無敵・超強化中！",16,44);
      }

      // Score
      ctx.fillStyle="#fff"; ctx.font="bold 16px 'Hiragino Sans',sans-serif";
      ctx.textAlign="right"; ctx.fillText(`スコア: ${s.score}`,GW-12,28);
      if(s.combo>1){
        ctx.fillStyle=s.rage?"#ff6600":"#ff0";
        ctx.font=`bold ${12+Math.min(s.combo*2,16)}px 'Hiragino Sans',sans-serif`;
        ctx.fillText(`🔥 ${s.combo} COMBO`,GW-12,50);
      }

      // Touch zone hints
      ctx.fillStyle="rgba(255,255,255,0.025)";
      ctx.fillRect(0,GH-105,GW/2,105);
      ctx.fillStyle="rgba(255,80,80,0.025)";
      ctx.fillRect(GW/2,GH-105,GW/2,105);
      ctx.fillStyle="rgba(255,255,255,0.06)";
      ctx.font="11px sans-serif"; ctx.textAlign="center";
      ctx.fillText("👈 移動",GW/4,GH-12);
      ctx.fillText("👊 パンチ",GW*3/4,GH-12);

      // Joystick visual
      if(ts.active){
        ctx.strokeStyle="rgba(255,255,255,0.2)"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(ts.startX,ts.startY,34,0,Math.PI*2); ctx.stroke();
        const jLen=Math.min(Math.hypot(ts.dx,ts.dy),34);
        const jAng=Math.atan2(ts.dy,ts.dx);
        ctx.fillStyle="rgba(255,255,255,0.32)";
        ctx.beginPath(); ctx.arc(ts.startX+Math.cos(jAng)*jLen,ts.startY+Math.sin(jAng)*jLen,14,0,Math.PI*2); ctx.fill();
      }

      // Progress bar
      ctx.fillStyle="rgba(0,0,0,0.4)";
      ctx.fillRect(0,GH-108,GW,5);
      ctx.fillStyle=s.rage?"#ff4400":"#44aaff";
      ctx.fillRect(0,GH-108,GW*prog,5);
      ctx.fillStyle="rgba(255,255,255,0.45)";
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
  const Btn=({label,onClick})=>(
    <button onClick={onClick} style={{padding:"14px 44px",fontSize:20,fontWeight:"bold",background:"linear-gradient(135deg,#ff69b4,#ff3366)",color:"#fff",border:"none",borderRadius:30,cursor:"pointer",boxShadow:"0 4px 20px rgba(255,51,102,0.45)",letterSpacing:2,WebkitTapHighlightColor:"transparent"}}>
      {label}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#08001a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Hiragino Sans','Yu Gothic',sans-serif",userSelect:"none",WebkitUserSelect:"none"}}>
      <div style={{position:"relative",width:GW,transform:shake?`translate(${(Math.random()-.5)*10}px,${(Math.random()-.5)*10}px)`:"none",transition:shake?"none":"transform 0.1s"}}>
        <canvas ref={cvs} width={GW} height={GH}
          style={{display:"block",borderRadius:16,
            boxShadow:`0 0 60px ${rage?"rgba(255,60,0,0.6)":"rgba(200,80,150,0.4)"}`,
            border:`2px solid ${rage?"rgba(255,60,0,0.4)":"rgba(255,150,200,0.15)"}`,
            touchAction:"none",maxWidth:"100vw"}}
        />

        {screen==="title"&&<OL bg="linear-gradient(180deg,#1a0a2e,#0d1f3c)">
          <div style={{fontSize:52}}>👊</div>
          <h1 style={{color:"#fff",fontSize:28,textAlign:"center",margin:0,lineHeight:1.4,textShadow:"0 0 20px #ff69b4"}}>
            ぶつかりおじさん<br/>
            <span style={{fontSize:14,color:"#999",fontWeight:"normal"}}>ぶっ飛ばしゲーム</span>
          </h1>
          <div style={{color:"#ccc",fontSize:12,textAlign:"center",lineHeight:2.2,background:"rgba(255,255,255,0.05)",padding:"12px 20px",borderRadius:10}}>
            📱 左スワイプ: 移動　右タップ: パンチ<br/>
            💼 ぶつかり　<span style={{color:"#5aad6f"}}>🤧 咳かけ</span>　<span style={{color:"#e05c5c"}}>😡 暴言</span><br/>
            <span style={{color:"#ff9966"}}>⚡ やられたらガンギレ無敵発動！</span><br/>
            🚃 駅のホームを通り抜けたらクリア！
          </div>
          <Btn label="スタート！" onClick={reset}/>
          <div style={{color:"#555",fontSize:12}}>ハイスコア: {hi}</div>
        </OL>}

        {screen==="clear"&&<OL bg="linear-gradient(180deg,#0a1a0a,#0a2a1a)">
          <div style={{fontSize:56}}>🎉</div>
          <h2 style={{color:"#44ff88",fontSize:30,margin:0,textShadow:"0 0 20px #44ff88",textAlign:"center"}}>
            ホーム通過！<br/>
            <span style={{fontSize:16,color:"#aaa",fontWeight:"normal"}}>理不尽に負けなかった！</span>
          </h2>
          <div style={{color:"#fff",fontSize:24}}>スコア: {score}</div>
          <div style={{color:"#ffd700",fontSize:17}}>🏆 ハイスコア: {hi}</div>
          <div style={{color:"#aaa",fontSize:13,textAlign:"center",lineHeight:1.8,padding:"0 20px"}}>
            今日もよく頑張った💪<br/>
            <span style={{fontSize:11,color:"#666"}}>明日も無事に通り抜けられますように</span>
          </div>
          <Btn label="もう一度！" onClick={reset}/>
        </OL>}
      </div>
    </div>
  );
}