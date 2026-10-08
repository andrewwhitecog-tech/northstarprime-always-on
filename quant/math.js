"use strict";
(function(root){
function probability(v){if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>1)throw new RangeError("Enter a finite probability from 0% to 100%.");return v;}
function fromPercent(v){if(!["number","string"].includes(typeof v)||(typeof v==="string"&&!/^(?:\d+\.?\d*|\.\d+)$/.test(v.trim())))throw new RangeError("Enter a probability from 0% to 100%.");return probability(Number(v)/100);}
function shrink(p){return Math.round((.9*probability(p)+.05)*1e6)/1e6;}
function brier(p,y){probability(p);if(y!==0&&y!==1)throw new RangeError("A resolved outcome must be Yes or No.");return(p-y)**2;}
function compare(p,y=null){probability(p);const adjusted=shrink(p);if(y===null)return{p,adjusted,outcome:y,original:null,adjustedScore:null,difference:null};const original=brier(p,y),adjustedScore=brier(adjusted,y);return{p,adjusted,outcome:y,original,adjustedScore,difference:adjustedScore-original};}
function csv(r){return"mode,probability,comparison_probability,manually_entered_outcome,brier,comparison_brier\r\n"+["SIMULATED / PAPER ONLY",r.p,r.adjusted,r.outcome===null?"UNRESOLVED":r.outcome,r.original===null?"":r.original,r.adjustedScore===null?"":r.adjustedScore].join(",")+"\r\n";}
const api=Object.freeze({probability,fromPercent,shrink,brier,compare,csv});if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.NSPPaperMath=api;
})(globalThis);