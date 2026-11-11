"use client";
import {useCallback,useEffect,useState} from "react";

type ForecastDay={date:string;high:number;low:number;rain:number;precip:number;wind:number;gust:number;code:number};
type Place={name:string;latitude:number;longitude:number;timezone:string};
const startingPlace:Place={name:"San Antonio, Texas",latitude:29.4241,longitude:-98.4936,timezone:"America/Chicago"};
const conditions:Record<number,{label:string;icon:string}>={
 0:{label:"Clear sky",icon:"☀️"},1:{label:"Mostly clear",icon:"🌤️"},2:{label:"Partly cloudy",icon:"⛅"},3:{label:"Cloudy",icon:"☁️"},
 45:{label:"Fog",icon:"🌫️"},48:{label:"Freezing fog",icon:"🌫️"},51:{label:"Light drizzle",icon:"🌦️"},53:{label:"Drizzle",icon:"🌦️"},55:{label:"Heavy drizzle",icon:"🌧️"},
 56:{label:"Freezing drizzle",icon:"🌧️"},57:{label:"Freezing drizzle",icon:"🌧️"},61:{label:"Light rain",icon:"🌦️"},63:{label:"Rain",icon:"🌧️"},65:{label:"Heavy rain",icon:"🌧️"},
 66:{label:"Freezing rain",icon:"🌧️"},67:{label:"Heavy freezing rain",icon:"🌧️"},71:{label:"Light snow",icon:"🌨️"},73:{label:"Snow",icon:"🌨️"},75:{label:"Heavy snow",icon:"❄️"},
 77:{label:"Snow grains",icon:"🌨️"},80:{label:"Light showers",icon:"🌦️"},81:{label:"Rain showers",icon:"🌧️"},82:{label:"Heavy showers",icon:"🌧️"},85:{label:"Snow showers",icon:"🌨️"},86:{label:"Heavy snow showers",icon:"❄️"},
 95:{label:"Thunderstorms",icon:"⛈️"},96:{label:"Thunderstorms with hail",icon:"⛈️"},99:{label:"Severe thunderstorms with hail",icon:"⛈️"}
};
function condition(code:number){return conditions[code]||{label:"Variable conditions",icon:"🌤️"};}
function dayName(date:string,timezone:string){return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:timezone}).format(new Date(date+"T12:00:00Z"));}
function workNote(day:ForecastDay){if([95,96,99].includes(day.code))return "Storm risk: review outdoor work";if(day.rain>=60||day.precip>=.25)return "Wet weather possible: plan around rain";if(day.gust>=35||day.wind>=25)return "High winds: review ladder and roofing safety";if(day.high>=100)return "Extreme heat: review crew heat precautions";if(day.low<=32)return "Freezing temperatures: review materials";return "Review site-specific conditions before scheduling";}
function readableError(error:unknown){return error instanceof Error?error.message:"Weather forecast is temporarily unavailable.";}
export default function WeatherForecast(){
 const [place,setPlace]=useState<Place>(startingPlace);
 const [query,setQuery]=useState("");
 const [days,setDays]=useState<ForecastDay[]>([]);
 const [busy,setBusy]=useState(false);
 const [finding,setFinding]=useState(false);
 const [error,setError]=useState("");
 const [updated,setUpdated]=useState("");
 const load=useCallback(async(location:Place,signal?:AbortSignal)=>{
   setBusy(true);setError("");
   try{
     const url=new URL("https://api.open-meteo.com/v1/forecast");
     url.searchParams.set("latitude",String(location.latitude));url.searchParams.set("longitude",String(location.longitude));
     url.searchParams.set("daily","weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max");
     url.searchParams.set("temperature_unit","fahrenheit");url.searchParams.set("wind_speed_unit","mph");url.searchParams.set("precipitation_unit","inch");url.searchParams.set("timezone",location.timezone);url.searchParams.set("forecast_days","7");
     const response=await fetch(url.toString(),{signal,cache:"no-store"});
     if(!response.ok)throw new Error("Forecast service is unavailable right now.");
     const data=await response.json();
     const d=data.daily;
     if(!d||!Array.isArray(d.time)||d.time.length!==7)throw new Error("The weather provider did not return a seven-day forecast.");
     const parsed:ForecastDay[]=d.time.map((date:string,i:number)=>({
       date,code:d.weather_code[i],high:d.temperature_2m_max[i],low:d.temperature_2m_min[i],
       rain:d.precipitation_probability_max[i]??0,precip:d.precipitation_sum[i]??0,
       wind:d.wind_speed_10m_max[i]??0,gust:d.wind_gusts_10m_max[i]??0
     }));
     if(signal?.aborted)return;
     setDays(parsed);setUpdated(new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:location.timezone}).format(new Date()));
   }catch(e){if(signal?.aborted)return;setError(readableError(e));setDays([]);}finally{if(!signal?.aborted)setBusy(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(place,controller.signal);return()=>controller.abort();},[place,load]);
 async function search(event:React.FormEvent<HTMLFormElement>){
   event.preventDefault();if(!query.trim()||finding)return;
   setFinding(true);setError("");
   try{
     const url=new URL("https://geocoding-api.open-meteo.com/v1/search");
     url.searchParams.set("name",query.trim());url.searchParams.set("count","10");url.searchParams.set("language","en");url.searchParams.set("format","json");url.searchParams.set("countryCode","US");
     const response=await fetch(url.toString(),{cache:"no-store"});
     if(!response.ok)throw new Error("Could not search for that city.");
     const data=await response.json();
     const results=(data.results||[]) as {name:string;admin1?:string;latitude:number;longitude:number;timezone?:string}[];
     const result=results[0];
     if(!result)throw new Error("City not found. Enter a US city name, such as Austin or Dallas.");
     setPlace({name:[result.name,result.admin1].filter(Boolean).join(", "),latitude:result.latitude,longitude:result.longitude,timezone:result.timezone||"America/Chicago"});
     setQuery("");
   }catch(e){setError(readableError(e));}finally{setFinding(false);}
 }
 return <div className="card">
  <div className="sectionTitle"><div><h2>7-day weather forecast</h2><p className="muted">Daily conditions for planning roofing inspections, deliveries and installation work.</p></div><button type="button" className="btn secondary" disabled={busy} onClick={()=>void load(place)}>{busy?"Updating…":"Refresh forecast"}</button></div>
  <form onSubmit={search} style={{display:"flex",flexWrap:"wrap",alignItems:"end",gap:12,marginBottom:18}}>
   <div className="field" style={{flex:"1 1 260px",marginBottom:0}}><label htmlFor="weather-city">Forecast city (US)</label><input id="weather-city" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Enter another city (e.g. Pleasanton)" maxLength={90}/></div>
   <button className="btn" disabled={finding||!query.trim()} type="submit">{finding?"Searching…":"Change location"}</button>
   {place.name!=="San Antonio, Texas"&&<button type="button" className="btn secondary" onClick={()=>setPlace(startingPlace)}>Reset to San Antonio</button>}
  </form>
  <p><strong>📍 {place.name}</strong>{updated&&<span className="small muted"> · Last refreshed: {updated}</span>}</p>
  {error&&<p className="notice" role="alert">{error}</p>}
  {busy&&!days.length&&<p className="muted">Loading forecast…</p>}
  {!!days.length&&<div className="weatherForecastGrid">{days.map(day=>{
   const c=condition(day.code);
   return <article className="weatherDayCard" key={day.date}>
    <p className="weatherDayDate">{dayName(day.date,place.timezone)}</p>
    <div className="weatherDayIcon" aria-hidden="true">{c.icon}</div>
    <h3>{c.label}</h3>
    <p className="weatherTemp"><strong>{Math.round(day.high)}°</strong><span>{Math.round(day.low)}°F low</span></p>
    <p>☔ Rain chance: <strong>{Math.round(day.rain)}%</strong></p>
    <p>Rainfall: {day.precip.toFixed(2)} in</p>
    <p>💨 Wind: {Math.round(day.wind)} mph</p>
    <p>Gusts: {Math.round(day.gust)} mph</p>
    <p className="weatherWorkNote">{workNote(day)}</p>
   </article>;
  })}</div>}
  <p className="small muted" style={{marginTop:16}}>Forecast data: Open-Meteo (weather-model estimates). Rain chances are probabilities, not guarantees. Confirm radar, local weather alerts and on-site conditions before roofing or ladder work. This forecast is not a severe-weather warning service.</p>
 </div>;
}
