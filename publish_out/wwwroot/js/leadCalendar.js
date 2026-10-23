/* ============================
   LeadCalendar – FIXED
   ============================ */

   requireUser(); // עכשיו נטען מ-session.js

   const API_BASE = "/simcenter/PocusSchedualer/api";
   
   const EP = {
     calendar: `${API_BASE}/leadcalendar`,
     reminder: `${API_BASE}/leadcalendar/instances`,
   };
   
   const els = {
     monthTitle: document.getElementById("monthTitle"),
     prev: document.getElementById("btnPrev"),
     next: document.getElementById("btnNext"),
     refresh: document.getElementById("btnRefresh"),
     search: document.getElementById("searchBox"),
     legend: document.getElementById("legendItems"),
     grid: document.getElementById("grid"),
   };
   
   let current = new Date();
   let raw = null;
   
   /* ---------- helpers ---------- */
   const pad = n => String(n).padStart(2, "0");
   const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
   
   function monthLabel(d){
     return new Intl.DateTimeFormat("he-IL",{month:"long",year:"numeric"}).format(d);
   }
   
   /* ---------- API ---------- */
   async function apiGet(url){
     const r = await fetch(url,{credentials:"include"});
     if(!r.ok) throw new Error(`HTTP ${r.status}`);
     return r.json();
   }
   
   /* ---------- load ---------- */
   async function loadMonth(){
     const from = new Date(current.getFullYear(), current.getMonth(), 1);
     const to   = new Date(current.getFullYear(), current.getMonth()+1, 0);
   
     els.monthTitle.textContent = monthLabel(current);
   
     const url = `${EP.calendar}?from=${from.toISOString()}&to=${to.toISOString()}`;
     raw = await apiGet(url);
   
     renderLegend();
     renderCalendar();
   }
   
   /* ---------- legend ---------- */
   function renderLegend(){
     els.legend.innerHTML = (raw.activities || []).map(a=>`
       <div class="legend-item">
         <span class="swatch" style="background:${a.color}"></span>
         ${a.activityName}
       </div>
     `).join("");
   }
   
   /* ---------- calendar ---------- */
   function renderCalendar(){
     els.grid.innerHTML = "";
   
     const map = {};
     for(const it of raw.instances || []){
       const d = new Date(it.startUtc);
       const key = ymd(d);
       (map[key] ||= []).push(it);
     }
   
     const start = new Date(current.getFullYear(), current.getMonth(), 1);
     const offset = start.getDay();
     start.setDate(start.getDate() - offset);
   
     for(let i=0;i<42;i++){
       const d = new Date(start);
       d.setDate(start.getDate()+i);
   
       const key = ymd(d);
       const items = map[key] || [];
   
       const cell = document.createElement("div");
       cell.className = "day";
   
       cell.innerHTML = `
         <div class="day-head">${d.getDate()}</div>
         <div class="items"></div>
       `;
   
       const wrap = cell.querySelector(".items");
   
       for(const it of items){
         const el = document.createElement("div");
         el.className = "item";
         el.style.borderColor = it.color;
         el.innerHTML = `
           <div class="item-title">${it.activityName}</div>
           <div class="item-meta">#${it.instanceId}</div>
         `;
         wrap.appendChild(el);
       }
   
       els.grid.appendChild(cell);
     }
   }
   
   /* ---------- events ---------- */
   els.prev.onclick = ()=>{ current.setMonth(current.getMonth()-1); loadMonth(); };
   els.next.onclick = ()=>{ current.setMonth(current.getMonth()+1); loadMonth(); };
   els.refresh.onclick = loadMonth;
   
   loadMonth();
   