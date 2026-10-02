/* Original live cabinet treatment around the retained Sibyl Vanta master. */
window.OracleCabinetScene = (()=>{
  const portrait=new Image();portrait.onload=()=>window.dispatchEvent(new Event('oracle-art-ready'));portrait.src='/static/games/family_v06/sibyl_vanta_family_v02.png';
  let frames=0;
  return {draw(ctx,w,h,{reading,progress,chamber,calm,armed}){
    if(!portrait.complete||!portrait.naturalWidth)return false;
    frames++;
    const colors=[['#d0a35e','#86cdcb'],['#a5befa','#d686e5'],['#aa94ba','#b6a47e']][chamber];
    const t=calm?0:performance.now()/1000;
    ctx.save();ctx.fillStyle='#08090f';ctx.fillRect(0,0,w,h);
    // Contain the complete authored figure, then fill the sides with chamber atmosphere.
    const ph=h*1.08,pw=ph*portrait.naturalWidth/portrait.naturalHeight;
    const dx=(w-pw)/2,dy=-h*.025;
    ctx.drawImage(portrait,dx,dy,pw,ph);
    const shade=ctx.createLinearGradient(dx-1,0,dx+pw+1,0);
    shade.addColorStop(0,'#07080c');shade.addColorStop(.15,'rgba(7,8,12,0)');shade.addColorStop(.85,'rgba(7,8,12,0)');shade.addColorStop(1,'#07080c');
    ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    // A brass arched glass enclosure with measured edge highlights.
    for(let i=0;i<3;i++){
      ctx.strokeStyle=i===1?'#d4b77c':'#513b24';ctx.lineWidth=i===1?Math.max(1,w*.002):Math.max(2,w*.005);
      ctx.beginPath();ctx.roundRect(w*(.045+i*.012),h*(.018+i*.01),w*(.91-i*.024),h*(.964-i*.02),[w*.33,w*.33,8,8]);ctx.stroke();
    }
    for(let side=0;side<2;side++){
      const x=w*(side?.9:.1);
      for(let i=0;i<7;i++){
        const y=h*(.29+i*.086);
        const glow=ctx.createRadialGradient(x,y,0,x,y,w*.03);glow.addColorStop(0,'#fff0c9');glow.addColorStop(.16,colors[0]);glow.addColorStop(1,'rgba(180,115,30,0)');
        ctx.fillStyle=glow;ctx.fillRect(x-w*.035,y-w*.035,w*.07,w*.07);
      }
    }
    // Orb responds to token/reading state; no generated text or fabricated prophecy.
    const x=w*.5,y=h*.815,r=Math.min(w*.125,h*.105);
    const glow=ctx.createRadialGradient(x,y,0,x,y,r*2.5);glow.addColorStop(0,armed?'rgba(130,218,245,.6)':'rgba(101,139,205,.35)');glow.addColorStop(1,'rgba(70,95,145,0)');
    ctx.fillStyle=glow;ctx.fillRect(x-r*2.5,y-r*2.5,r*5,r*5);
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
    const orb=ctx.createRadialGradient(x-r*.3,y-r*.4,0,x,y,r);orb.addColorStop(0,'#f6efff');orb.addColorStop(.15,colors[1]);orb.addColorStop(.5,'#375173');orb.addColorStop(1,'#0a1329');ctx.fillStyle=orb;ctx.fillRect(x-r,y-r,r*2,r*2);
    for(let i=0;i<9;i++){
      ctx.strokeStyle=colors[i%2];ctx.globalAlpha=.2;ctx.lineWidth=1.2;
      ctx.beginPath();ctx.ellipse(x+Math.sin(t*.3+i)*r*.2,y,r*(.3+i*.08),r*.92,t*.12+i*.34,0,Math.PI*2);ctx.stroke();
    }
    ctx.globalAlpha=.8;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x-r*.35,y-r*.48,r*.23,r*.09,-.45,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.strokeStyle='#a8c5df';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
    if(reading){ctx.strokeStyle=colors[0];ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,r*1.18,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();}
    const reflected=ctx.createLinearGradient(0,0,w,h);reflected.addColorStop(0,'rgba(228,243,255,.13)');reflected.addColorStop(.3,'rgba(255,255,255,0)');reflected.addColorStop(.8,'rgba(255,255,255,0)');reflected.addColorStop(1,'rgba(186,219,255,.08)');ctx.fillStyle=reflected;ctx.fillRect(0,0,w,h);
    ctx.restore();return true;
  },status:()=>({portraitReady:portrait.complete&&portrait.naturalWidth>0,frames})};
})();
