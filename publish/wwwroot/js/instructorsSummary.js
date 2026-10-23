
async function fetchJson(url){
const r = await fetch(url,{credentials:'include'});
if(!r.ok) throw new Error("API error "+r.status);
return await r.json();
}

function pickText(x){
if(x==null) return "";
if(typeof x==="string") return x;
if(typeof x==="number") return x.toString();
if(typeof x==="object"){
return x.name || x.courseName || x.typeName || x.label || "";
}
return "";
}

function renderPills(el,items,fallback){
if(!items || !items.length){
el.innerHTML = "<span class='pill'>"+fallback+"</span>";
return;
}

el.innerHTML = items.map(x=>"<span class='pill'>"+pickText(x)+"</span>").join("");
}

function renderTable(rows){

const body = document.getElementById("tblBody");

if(!rows || !rows.length){
body.innerHTML="<tr><td colspan='3'>אין נתונים</td></tr>";
return;
}

body.innerHTML = rows.map(x=>`
<tr>
<td>${pickText(x.activityName || x.name)}</td>
<td>${x.instanceCount || x.count || 0}</td>
<td>${(x.totalHours || x.hours || 0).toFixed ? (x.totalHours || x.hours || 0).toFixed(1) : x.totalHours}</td>
</tr>
`).join("");
}

async function load(){

try{

const me = await fetchJson("/api/me");

document.getElementById("meLine").textContent =
"משתמש: " + (me.fullName || me.email || "");

document.getElementById("loggedRole").textContent =
"תפקיד: " + (me.roleName || me.role || "");

const stats = await fetchJson("/api/instructors/stats");

document.getElementById("totalInstances").textContent =
stats.summary?.totalInstances || 0;

document.getElementById("totalHours").textContent =
stats.summary?.totalHours || 0;

document.getElementById("distinctActivities").textContent =
stats.summary?.distinctActivities || 0;

renderPills(
document.getElementById("certifications"),
stats.certifications || [],
"אין הסמכות"
);

renderPills(
document.getElementById("courses"),
stats.courses || [],
"אין קורסים"
);

renderTable(stats.byActivity || []);

}catch(e){

document.getElementById("errBox").textContent=e.message;

}

}

document.getElementById("btnRefresh").onclick=load;

window.onload=load;
