export function profitSummary(p: {revenue?:number;materials?:number;labor?:number;disposal?:number;other?:number}) {
 const cents=(n:number=0)=>Math.round(n*100);
 const revenue=cents(p.revenue),costs=cents(p.materials)+cents(p.labor)+cents(p.disposal)+cents(p.other);
 return {costs:costs/100,profit:(revenue-costs)/100,margin:revenue?((revenue-costs)/revenue)*100:null};
}
export function latestUnanswered<T extends {lead_id:string;status:string;created_at:string;status_updated_at?:string}>(quotes:T[],closed:Set<string>,days:number,now:number){
 const latest=new Map<string,T>();for(const q of quotes){const old=latest.get(q.lead_id);if(!old||q.created_at>old.created_at)latest.set(q.lead_id,q);}
 return [...latest.values()].filter(q=>q.status==="Sent"&&!closed.has(q.lead_id)&&now-new Date(q.status_updated_at||q.created_at).getTime()>=days*86400000);
}
