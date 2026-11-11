import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KosherSim,defaultProfile} from '../arcade/custom/kosher-lines/simulation.mjs';
function contact(vx,vz){const s=new KosherSim(defaultProfile());s.sessionMode='chapter';s.start();Object.assign(s,{x:22.999,z:-2,y:.3,grounded:false,mode:'air',vx,vz,speed:Math.hypot(vx,vz),vy:0});return s;}
test('a fast glancing contact preserves travel along the boundary instead of bailing for total speed',()=>{const s=contact(1,-8);s.step(1/120,{grind:false});assert.equal(s.bails,0);assert(s.z< -2.06);assert(s.vz< -7.8);assert.equal(s.vx,0);assert.equal(s.x,22.999);});
test('a genuinely hard normal impact still bails and clears the combo',()=>{const s=contact(8,-1);s.add(120,'Probe flip');s.step(1/120,{grind:false});assert.equal(s.bails,1);assert.equal(s.unbanked,0);assert.equal(s.mode,'bail');});
