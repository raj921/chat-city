const $=id=>document.getElementById(id);
async function action(route,body){
 try{const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error);$('action-result').textContent=data.message||'City updated.';}
 catch(error){$('action-result').textContent=error.message;}
}
function renderJob(job,active){
 const card=document.createElement('article');card.className='job-card '+job.status;
 const header=document.createElement('div');header.className='job-header';
 const author=document.createElement('strong');author.textContent='@'+job.author;
 const status=document.createElement('span');status.className='job-status';status.textContent=job.status+(job.priority?' · priority':'');
 header.append(author,status);card.append(header);
 const prompt=document.createElement('p');prompt.textContent=job.prompt;card.append(prompt);
 const meta=document.createElement('div');meta.className='job-meta';meta.textContent=job.source+' / '+new Date(job.createdAt).toLocaleTimeString()+(job.moderation==='skipped'?' / moderation off':'');card.append(meta);
 if(job.progress?.length){const progress=document.createElement('div');progress.className='job-progress';progress.textContent=job.progress.at(-1);card.append(progress);}
 if(job.error){const error=document.createElement('p');error.className='error-text';error.textContent=job.error;card.append(error);}
 if(job.durationMs){const timing=document.createElement('small');timing.textContent=`Built in ${(job.durationMs/1000).toFixed(1)}s`;card.append(timing);}
 if(active&&['pending','approved','moderating'].includes(job.status)){
  const buttons=document.createElement('div');buttons.className='job-actions';
  if(job.status==='pending'){const approve=document.createElement('button');approve.type='button';approve.textContent='Approve build →';approve.onclick=()=>action('./api/jobs/approve',{id:job.id});buttons.append(approve);}
  const skip=document.createElement('button');skip.type='button';skip.className='secondary';skip.textContent='Skip & refund';skip.onclick=()=>action('./api/jobs/skip',{id:job.id});buttons.append(skip);card.append(buttons);
 }
 return card;
}
function render(state){
 const waiting=state.jobs.filter(job=>['moderating','pending','approved','building'].includes(job.status)).sort((a,b)=>b.priority-a.priority);
 $('total-built').textContent=state.plots.filter(plot=>plot.status==='built').length;
 $('active-count').textContent=`${state.active} / ${state.settings.maxConcurrent}`;$('budget').textContent=`${state.stream.attempts} / ${state.settings.maxBuilds}`;
 $('waiting-count').textContent=waiting.length;$('auto-approve').checked=state.settings.autoApprove;
 $('twitch-status').textContent=state.runtime?.twitch||'disabled';$('moderation-status').textContent=state.runtime?.moderation?'OpenAI moderation enabled':'Moderation off · manual approval';
 $('jobs').replaceChildren(...waiting.map(job=>renderJob(job,true)));
 if(!waiting.length){const empty=document.createElement('div');empty.className='empty-state';const title=document.createElement('h3');title.textContent='The next great idea is in chat.';const p=document.createElement('p');p.textContent='Ask a viewer to type !build, or try the local playground.';empty.append(title,p);$('jobs').append(empty);}
 $('history').replaceChildren(...state.jobs.filter(job=>['built','failed','skipped'].includes(job.status)).slice(-15).reverse().map(job=>renderJob(job,false)));
 $('activity').replaceChildren(...state.activity.slice(0,10).map(item=>{const li=document.createElement('li');li.textContent=item.text;li.className=item.kind;return li;}));
 if(state.fault)$('action-result').textContent=state.fault;
}
$('auto-approve').onchange=event=>action('./api/settings',{autoApprove:event.target.checked});
$('new-stream').onclick=()=>action('./api/new-stream',{});
$('demolish-form').onsubmit=event=>{event.preventDefault();void action('./api/demolish',{author:$('demolish-author').value.trim().toLowerCase()});};
function connect(){const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);socket.onopen=()=>{$('connection').textContent='● Connected';};socket.onmessage=event=>render(JSON.parse(event.data));socket.onclose=()=>{$('connection').textContent='Reconnecting…';setTimeout(connect,1500);};socket.onerror=()=>socket.close();}connect();
