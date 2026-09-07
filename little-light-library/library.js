'use strict';
const search=document.querySelector('#find-book');
if(search){
 const range=document.querySelector('#book-range'),cards=[...document.querySelectorAll('.card')],count=document.querySelector('#result-count');
 function filter(){const query=search.value.trim().toLocaleLowerCase(),bounds=range.value.split('-').map(Number);let found=0;
  for(const card of cards){const number=Number(card.dataset.volume);const show=card.dataset.search.includes(query)&&number>=bounds[0]&&number<=bounds[1];card.hidden=!show;if(show)found++;}
  count.textContent=`${found} of 50 books`;document.querySelector('#empty').hidden=found!==0;
 }
 search.addEventListener('input',filter);range.addEventListener('change',filter);
}
const bigger=document.querySelector('#bigger');
if(bigger){let size=1.25;const smaller=document.querySelector('#smaller'),label=document.querySelector('#text-size');
 function resize(delta){size=Math.max(1,Math.min(2.5,Math.round((size+delta)*100)/100));document.documentElement.style.setProperty('--reader-size',`${size}rem`);label.textContent=`${Math.round(size/1.25*100)}%`;smaller.disabled=size<=1;bigger.disabled=size>=2.5;}
 bigger.addEventListener('click',()=>resize(.25));smaller.addEventListener('click',()=>resize(-.25));
 document.querySelector('#text-only').addEventListener('change',e=>document.querySelector('#story').classList.toggle('text-only',e.target.checked));
}
