import assert from 'node:assert/strict';import {test} from 'node:test';import {RivalHeat} from '../arcade/custom/kosher-lines/rival-heat.mjs';
import {KosherSim} from '../arcade/custom/kosher-lines/simulation.mjs';
test('rival earns points through real skating and freezes with the player',()=>{const r=new RivalHeat();r.start();const p=new KosherSim();p.start();for(let i=0;i<21600;i++)r.step(1/120,p);assert(r.sim.stats.distance>500,'Rival must keep riding the route rather than farming stationary tricks at an obstruction');assert(r.sim.stats.tricks>0);assert(r.sim.score>0);assert.equal(r.elapsed,180);assert.equal(r.result.art,r.sim.score);assert.equal(r.snapshot().scoreSource,'live-KosherSim-bank-events');const clock=r.elapsed;r.step(.02,{...p,paused:true});assert.equal(r.elapsed,clock);});

test('the final heat result banks both riders once before choosing the winner', () => {
 const heat = new RivalHeat();
 const player = new KosherSim();
 player.start();
 heat.start();
 heat.elapsed = heat.limit - .01;
 player.unbanked = 120;
 heat.sim.unbanked = 100;
 heat.sim.comboLeft = 1;
 heat.step(.02, player);
 assert.deepEqual(heat.result, {player:120, art:100, winner:'BLP'});
 assert.equal(player.unbanked, 0);
 assert.equal(heat.sim.unbanked, 0);
 player.unbanked = 30;
 heat.step(.02, player);
 assert.equal(player.unbanked, 30);
 assert.equal(heat.result.player, 120);
});
