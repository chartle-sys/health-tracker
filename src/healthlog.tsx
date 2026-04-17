import { useState, useReducer, useEffect } from "react";
import { loadRemoteState, saveRemoteState } from "./supabase";

const D = {
  bg:"#1a1a1a", surface:"#242424", card:"#2e2e2e", border:"#3a3a3a",
  text:"#e8e8e8", muted:"#777", accent:"#7F77DD", accentDim:"#3C3489",
  green:"#1D9E75", greenDim:"#085041", amber:"#EF9F27", amberDim:"#854F0B",
  red:"#E24B4A", redDim:"#A32D2D",
};

const EXERCISES = [
  {key:"pull",  label:"Pull",        unit:"reps", weeklyTarget:120, defaultSet:6},
  {key:"push",  label:"Push",        unit:"reps", weeklyTarget:420, defaultSet:10},
  {key:"plank", label:"Plank",       unit:"min",  weeklyTarget:20,  defaultSet:60, seconds:true},
  {key:"bssh",  label:"BSSH",        unit:"min",  weeklyTarget:20,  defaultSet:60, seconds:true},
  {key:"lhpThr",label:"1LHpThr",     unit:"reps", weeklyTarget:200, defaultSet:10},
  {key:"run",   label:"Run",         unit:"miles",weeklyTarget:18,  defaultSet:1},
  {key:"cardio",label:"Extra Cardio",unit:"min",  weeklyTarget:30,  defaultSet:30},
];

const DEFAULT_HABITS = [
  {id:1,name:"Sleep ≥7 hrs",cat:"healthy"},
  {id:2,name:"Water",       cat:"healthy"},
  {id:3,name:"Mindfulness", cat:"healthy"},
  {id:4,name:"Redlight",    cat:"healthy"},
  {id:7,name:"Stretching",  cat:"healthy"},
  {id:5,name:"Coffee ≤2",   cat:"limit"},
  {id:6,name:"No alcohol",  cat:"healthy"},
];

const DEFAULT_HABIT_GOAL = 5;
const MEAL_TYPES = ["Breakfast","Lunch","Dinner","Snack"];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function todayStr(){return new Date().toISOString().split("T")[0];}
function weekStart(dateStr){
  const d=new Date(dateStr+"T12:00:00"), day=d.getDay();
  d.setDate(d.getDate()+(day===0?-6:1-day));
  return d.toISOString().split("T")[0];
}
function weekDates(dateStr){
  const ws=weekStart(dateStr);
  return Array.from({length:7},(_,i)=>{
    const d=new Date(ws+"T12:00:00"); d.setDate(d.getDate()+i);
    return d.toISOString().split("T")[0];
  });
}
function datesInSameWeek(d1,d2){return weekStart(d1)===weekStart(d2);}
function emptyDay(){return{workouts:[],meals:[],habitLogs:{},supportLogs:{},mood:3,energy:3,note:""};}

function initState(){
  try{
    const raw=localStorage.getItem("healthlog_v8");
    if(!raw) throw new Error("fresh");
    const s=JSON.parse(raw);
    return{
      habits:    (s.habits&&s.habits.length)?s.habits:DEFAULT_HABITS,
      days:      s.days       ||{},
      weekSets:  s.weekSets   ||{},
      habitGoals:s.habitGoals ||{},
      supportExercises: s.supportExercises||[],
      nextHabitId:s.nextHabitId||9,
      nextSupportId:s.nextSupportId||1,
    };
  }catch{
    return{habits:DEFAULT_HABITS,days:{},weekSets:{},habitGoals:{},supportExercises:[],nextHabitId:9,nextSupportId:1};
  }
}

function reducer(state,{type,payload}){
  switch(type){
    case"SET_DAY":         return{...state,days:{...state.days,[payload.date]:payload.day}};
    case"SET_WEEKSETS":    return{...state,weekSets:{...state.weekSets,[payload.ws]:payload.sets}};
    case"SET_HABIT_GOAL":  return{...state,habitGoals:{...state.habitGoals,[payload.id]:payload.goal}};
    case"SET_HABITS":      return{...state,habits:payload};
    case"ADD_HABIT":       return{...state,habits:[...state.habits,{id:state.nextHabitId,name:payload.name,cat:payload.cat}],nextHabitId:state.nextHabitId+1};
    case"DEL_HABIT":       return{...state,habits:state.habits.filter(h=>h.id!==payload.id)};
    case"UPDATE_HABIT":    return{...state,habits:state.habits.map(h=>h.id===payload.id?{...h,...payload.changes}:h)};
    case"ADD_SUPPORT":     return{...state,supportExercises:[...state.supportExercises,{id:state.nextSupportId,name:payload.name}],nextSupportId:state.nextSupportId+1};
    case"DEL_SUPPORT":     return{...state,supportExercises:state.supportExercises.filter(e=>e.id!==payload.id)};
    case"RENAME_SUPPORT":  return{...state,supportExercises:state.supportExercises.map(e=>e.id===payload.id?{...e,name:payload.name}:e)};
    case"SET_ALL":        return{...payload};
    default:return state;
  }
}

export default function App(){
  const [state,dispatch]=useReducer(reducer,null,initState);
  const [tab,setTab]=useState("log");
  const [date,setDate]=useState(todayStr());
  const [editHabits,setEditHabits]=useState(false);
  const [dashRange,setDashRange]=useState(30);
  const [synced,setSynced]=useState(false);

  // Save to localStorage immediately on every state change
  useEffect(()=>{try{localStorage.setItem("healthlog_v8",JSON.stringify(state));}catch{}}, [state]);

  // On mount: load from Supabase and replace local state if remote exists
  useEffect(()=>{
    loadRemoteState().then(remote=>{
      if(remote) dispatch({type:"SET_ALL",payload:remote});
      setSynced(true);
    });
  },[]);

  // Debounce-save to Supabase 2s after each state change (once initial load is done)
  useEffect(()=>{
    if(!synced) return;
    const t=setTimeout(()=>{saveRemoteState(state);},2000);
    return()=>clearTimeout(t);
  },[state,synced]);

  const day=state.days[date]||emptyDay();
  const updateDay=fn=>dispatch({type:"SET_DAY",payload:{date,day:fn(day)}});
  const ws=weekStart(date);
  const weekSets=state.weekSets[ws]||{};
  const setWeekSets=sets=>dispatch({type:"SET_WEEKSETS",payload:{ws,sets}});
  const getSetAmt=ex=>weekSets[ex.key]!=null?weekSets[ex.key]:ex.defaultSet;
  const getHabitGoal=id=>state.habitGoals[id]!=null?state.habitGoals[id]:DEFAULT_HABIT_GOAL;
  const setHabitGoal=(id,goal)=>dispatch({type:"SET_HABIT_GOAL",payload:{id,goal:Math.min(7,Math.max(1,+goal))}});
  const getDayData=d=>state.days[d]||emptyDay();
  const updateDayByDate=(d,fn)=>dispatch({type:"SET_DAY",payload:{date:d,day:fn(getDayData(d))}});

  const weekTotals=Object.entries(state.days).reduce((acc,[d,dd])=>{
    if(!datesInSameWeek(d,date)) return acc;
    (dd.workouts||[]).forEach(w=>{acc[w.exKey]=(acc[w.exKey]||0)+(+w.amount||0);});
    return acc;
  },{});

  // weekly support totals
  const weekSupportTotals=Object.entries(state.days).reduce((acc,[d,dd])=>{
    if(!datesInSameWeek(d,date)) return acc;
    Object.entries(dd.supportLogs||{}).forEach(([id,amt])=>{acc[id]=(acc[id]||0)+(+amt||0);});
    return acc;
  },{});

  return(
    <div style={{fontFamily:"system-ui,sans-serif",background:D.bg,minHeight:"100vh",color:D.text,fontSize:14}}>
      <Header tab={tab} setTab={setTab}/>
      {tab==="log"
        ?<LogTab
            day={day} updateDay={updateDay} date={date} setDate={setDate}
            habits={state.habits} editHabits={editHabits} setEditHabits={setEditHabits}
            dispatch={dispatch} weekTotals={weekTotals}
            weekSets={weekSets} setWeekSets={setWeekSets} getSetAmt={getSetAmt}
            getDayData={getDayData} updateDayByDate={updateDayByDate}
            getHabitGoal={getHabitGoal} setHabitGoal={setHabitGoal}
            supportExercises={state.supportExercises} weekSupportTotals={weekSupportTotals}/>
        :<DashTab days={state.days} habits={state.habits} range={dashRange} setRange={setDashRange}/>}
    </div>
  );
}

function Header({tab,setTab}){
  return(
    <div style={{background:D.surface,borderBottom:`1px solid ${D.border}`,padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:820,margin:"0 auto",height:52}}>
        <span style={{fontWeight:600,fontSize:16,color:D.accent}}>HealthLog</span>
        <div style={{display:"flex",gap:4}}>
          {[["log","Daily Log"],["dash","Dashboard"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              background:tab===id?D.accentDim:"transparent",color:tab===id?"#c5c0f5":D.muted,
              border:"none",borderRadius:6,padding:"6px 16px",cursor:"pointer",fontSize:13,fontWeight:500
            }}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LogTab({day,updateDay,date,setDate,habits,editHabits,setEditHabits,dispatch,weekTotals,weekSets,setWeekSets,getSetAmt,getDayData,updateDayByDate,getHabitGoal,setHabitGoal,supportExercises,weekSupportTotals}){
  return(
    <div style={{maxWidth:820,margin:"0 auto",padding:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{background:D.card,border:`1px solid ${D.border}`,color:D.text,borderRadius:6,padding:"6px 10px",fontSize:13}}/>
        {date!==todayStr()&&<span style={{fontSize:12,color:D.amber}}>Editing past entry</span>}
      </div>

      <Section title="Workouts — weekly progress">
        <WorkoutSection day={day} updateDay={updateDay} weekTotals={weekTotals}
          weekSets={weekSets} setWeekSets={setWeekSets} getSetAmt={getSetAmt} date={date}/>
      </Section>

      <Section title="Support exercises — this week">
        <SupportSection
          supportExercises={supportExercises} dispatch={dispatch}
          weekSupportTotals={weekSupportTotals} date={date}
          getDayData={getDayData} updateDayByDate={updateDayByDate}/>
      </Section>

      <Section title="Habits — this week" headerRight={
        <button onClick={()=>setEditHabits(!editHabits)} style={lBtn}>{editHabits?"done":"edit habits"}</button>
      }>
        {editHabits
          ?<HabitEditor habits={habits} dispatch={dispatch}/>
          :<WeeklyHabitGrid habits={habits} date={date}
              getDayData={getDayData} updateDayByDate={updateDayByDate}
              getHabitGoal={getHabitGoal} setHabitGoal={setHabitGoal}/>}
      </Section>

      <Section title="Meals & diet">
        <MealList meals={day.meals} updateDay={updateDay}/>
      </Section>

      <Section title="Daily note">
        <div style={{display:"flex",gap:20,marginBottom:12,flexWrap:"wrap"}}>
          {[["Mood",day.mood,"mood"],["Energy",day.energy,"energy"]].map(([lbl,val,key])=>(
            <div key={key} style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:13,color:D.muted}}>{lbl}</span>
              <input type="range" min={1} max={5} step={1} value={val}
                onChange={e=>updateDay(d=>({...d,[key]:+e.target.value}))} style={{width:80}}/>
              <span style={{fontSize:13,fontWeight:500}}>{val}</span>
            </div>
          ))}
        </div>
        <textarea value={day.note} onChange={e=>updateDay(d=>({...d,note:e.target.value}))}
          placeholder="How did today go?"
          style={{width:"100%",background:D.card,border:`1px solid ${D.border}`,color:D.text,
            borderRadius:8,padding:10,fontSize:13,resize:"vertical",minHeight:68,boxSizing:"border-box"}}/>
      </Section>
    </div>
  );
}

// ── SUPPORT EXERCISES ─────────────────────────────────────

function SupportSection({supportExercises,dispatch,weekSupportTotals,date,getDayData,updateDayByDate}){
  const [newName,setNewName]=useState("");
  const [editing,setEditing]=useState(false);
  const today=todayStr();

  const addReps=(exId,amt)=>{
    if(!amt) return;
    updateDayByDate(today,day=>{
      const prev=day.supportLogs||{};
      return{...day,supportLogs:{...prev,[exId]:(prev[exId]||0)+(+amt)}};
    });
  };

  const addExercise=()=>{
    if(!newName.trim()) return;
    dispatch({type:"ADD_SUPPORT",payload:{name:newName.trim()}});
    setNewName("");
  };

  if(supportExercises.length===0 && !editing){
    return(
      <div>
        <div style={{fontSize:12,color:D.muted,fontStyle:"italic",marginBottom:10}}>No support exercises yet.</div>
        <button onClick={()=>setEditing(true)} style={gBtn}>+ Add exercise</button>
      </div>
    );
  }

  return(
    <div>
      {supportExercises.map(ex=>(
        <SupportRow key={ex.id} ex={ex} total={weekSupportTotals[ex.id]||0}
          editing={editing} dispatch={dispatch} addReps={addReps}/>
      ))}
      <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
        {editing&&(
          <>
            <input placeholder="New exercise name" value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addExercise()}
              style={{...iSt,flex:1,minWidth:140}}/>
            <button onClick={addExercise} style={pBtn}>Add</button>
          </>
        )}
        <button onClick={()=>setEditing(!editing)} style={{...gBtn,marginLeft:"auto"}}>
          {editing?"done editing":"edit exercises"}
        </button>
      </div>
    </div>
  );
}

function SupportRow({ex,total,editing,dispatch,addReps}){
  const [input,setInput]=useState("");
  const submit=()=>{if(input){addReps(ex.id,+input);setInput("");}};
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${D.border}`,flexWrap:"wrap"}}>
      {editing
        ?<input value={ex.name} onChange={e=>dispatch({type:"RENAME_SUPPORT",payload:{id:ex.id,name:e.target.value}})}
            style={{...iSt,flex:1,minWidth:120}}/>
        :<span style={{flex:1,fontSize:13,fontWeight:500}}>{ex.name}</span>}
      <span style={{fontSize:12,color:D.muted,minWidth:60,textAlign:"right"}}>{total} reps</span>
      {!editing&&(
        <div style={{display:"flex",gap:6}}>
          <input type="number" placeholder="reps" value={input} min={1}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{...iSt,width:70}}/>
          <button onClick={submit} style={pBtn}>+</button>
        </div>
      )}
      {editing&&(
        <button onClick={()=>dispatch({type:"DEL_SUPPORT",payload:{id:ex.id}})}
          style={{...lBtn,color:D.red,fontSize:16}}>×</button>
      )}
    </div>
  );
}

// ── HABIT EDITOR WITH DRAG REORDER ────────────────────────

function HabitEditor({habits,dispatch}){
  const [newName,setNewName]=useState("");
  const [newCat,setNewCat]=useState("healthy");
  const [dragIdx,setDragIdx]=useState(null);
  const [overIdx,setOverIdx]=useState(null);

  const add=()=>{
    if(!newName.trim()) return;
    dispatch({type:"ADD_HABIT",payload:{name:newName.trim(),cat:newCat}});
    setNewName("");
  };

  const onDragStart=(i)=>setDragIdx(i);
  const onDragOver=(e,i)=>{e.preventDefault();setOverIdx(i);};
  const onDrop=(e,i)=>{
    e.preventDefault();
    if(dragIdx===null||dragIdx===i){setDragIdx(null);setOverIdx(null);return;}
    const next=[...habits];
    const [moved]=next.splice(dragIdx,1);
    next.splice(i,0,moved);
    dispatch({type:"SET_HABITS",payload:next});
    setDragIdx(null);setOverIdx(null);
  };
  const onDragEnd=()=>{setDragIdx(null);setOverIdx(null);};

  const catColor={healthy:D.green,limit:D.amber,unhealthy:D.red};

  return(
    <div>
      <div style={{fontSize:11,color:D.muted,marginBottom:8}}>Drag ☰ to reorder</div>
      {habits.map((h,i)=>(
        <div key={h.id} draggable
          onDragStart={()=>onDragStart(i)}
          onDragOver={e=>onDragOver(e,i)}
          onDrop={e=>onDrop(e,i)}
          onDragEnd={onDragEnd}
          style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",
            borderBottom:`1px solid ${D.border}`,
            background:overIdx===i?D.surface:"transparent",
            opacity:dragIdx===i?0.4:1,cursor:"grab"}}>
          <span style={{color:D.muted,fontSize:14,cursor:"grab",userSelect:"none"}}>☰</span>
          <select value={h.cat}
            onChange={e=>dispatch({type:"UPDATE_HABIT",payload:{id:h.id,changes:{cat:e.target.value}}})}
            style={{...iSt,width:90,color:catColor[h.cat]||D.muted,fontSize:11}}>
            <option value="healthy">healthy</option>
            <option value="limit">limit</option>
            <option value="unhealthy">unhealthy</option>
          </select>
          <input value={h.name}
            onChange={e=>dispatch({type:"UPDATE_HABIT",payload:{id:h.id,changes:{name:e.target.value}}})}
            style={{...iSt,flex:1}}/>
          <button onClick={()=>dispatch({type:"DEL_HABIT",payload:{id:h.id}})}
            style={{...lBtn,color:D.red,fontSize:16}}>×</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <select value={newCat} onChange={e=>setNewCat(e.target.value)} style={{...iSt,width:90}}>
          <option value="healthy">healthy</option>
          <option value="limit">limit</option>
          <option value="unhealthy">unhealthy</option>
        </select>
        <input placeholder="New habit name" value={newName} onChange={e=>setNewName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&add()} style={{...iSt,flex:1}}/>
        <button onClick={add} style={pBtn}>Add</button>
      </div>
    </div>
  );
}

// ── WEEKLY HABIT GRID ──────────────────────────────────────

function WeeklyHabitGrid({habits,date,getDayData,updateDayByDate,getHabitGoal,setHabitGoal}){
  const dates=weekDates(date);
  const today=todayStr();
  const catColor={healthy:D.green,limit:D.amber,unhealthy:D.red};
  const toggle=(habitId,d)=>updateDayByDate(d,day=>({...day,habitLogs:{...day.habitLogs,[habitId]:!day.habitLogs[habitId]}}));

  return(
    <div style={{overflowX:"auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"140px repeat(7,1fr) 56px",gap:4,marginBottom:6,alignItems:"center"}}>
        <div/>
        {DAY_LABELS.map((lbl,i)=>(
          <div key={lbl} style={{textAlign:"center",fontSize:11,
            color:dates[i]===today?D.accent:D.muted,fontWeight:dates[i]===today?500:400}}>{lbl}</div>
        ))}
        <div style={{textAlign:"center",fontSize:11,color:D.muted}}>goal</div>
      </div>
      {habits.map(h=>{
        const color=catColor[h.cat]||D.muted;
        const goal=getHabitGoal(h.id);
        const count=dates.filter(d=>getDayData(d).habitLogs[h.id]).length;
        const met=count>=goal;
        return(
          <div key={h.id} style={{display:"grid",gridTemplateColumns:"140px repeat(7,1fr) 56px",gap:4,marginBottom:4,alignItems:"center"}}>
            <div style={{fontSize:12,color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:4}}>{h.name}</div>
            {dates.map(d=>{
              const checked=!!getDayData(d).habitLogs[h.id];
              return(
                <div key={d} style={{display:"flex",justifyContent:"center"}}>
                  <button onClick={()=>toggle(h.id,d)} style={{
                    width:26,height:26,borderRadius:5,cursor:"pointer",
                    border:`1.5px solid ${checked?color:D.border}`,
                    background:checked?color+"33":"transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0
                  }}>{checked&&<span style={{color,fontSize:12,lineHeight:1}}>✓</span>}</button>
                </div>
              );
            })}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:2}}>
              <span style={{fontSize:12,fontWeight:500,color:met?D.green:count>0?D.amber:D.muted}}>{count}/</span>
              <input type="number" min={1} max={7} value={goal}
                onChange={e=>setHabitGoal(h.id,e.target.value)}
                style={{width:26,background:"transparent",border:"none",
                  borderBottom:`1px solid ${D.border}`,color:D.muted,
                  fontSize:12,fontWeight:500,textAlign:"center",outline:"none",padding:0}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── WORKOUT SECTION ────────────────────────────────────────

function WorkoutSection({day,updateDay,weekTotals,weekSets,setWeekSets,getSetAmt,date}){
  const [configOpen,setConfigOpen]=useState(false);
  const [logOpen,setLogOpen]=useState(false);
  const [customEx,setCustomEx]=useState("pull");
  const [customAmt,setCustomAmt]=useState("");
  const [customNote,setCustomNote]=useState("");

  const addSet=ex=>{
    const amt=getSetAmt(ex);
    const stored=ex.seconds?amt/60:amt;
    updateDay(d=>({...d,workouts:[...d.workouts,{id:Date.now(),exKey:ex.key,amount:stored,isSet:true}]}));
  };
  const addCustom=()=>{
    if(!customAmt) return;
    const ex=EXERCISES.find(e=>e.key===customEx);
    updateDay(d=>({...d,workouts:[...d.workouts,{id:Date.now(),exKey:customEx,amount:+customAmt,label:customNote||`${customAmt} ${ex.unit}`,isSet:false}]}));
    setCustomAmt(""); setCustomNote("");
  };
  const remove=id=>updateDay(d=>({...d,workouts:d.workouts.filter(w=>w.id!==id)}));

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:8,marginBottom:16}}>
        {EXERCISES.map(ex=>{
          const val=weekTotals[ex.key]||0;
          const pct=Math.min(val/ex.weeklyTarget*100,100);
          const color=pct>=100?D.green:pct>=60?D.amber:D.accent;
          const dispVal=ex.unit==="miles"?val.toFixed(1):Math.round(val);
          return(
            <div key={ex.key} style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,fontWeight:500}}>{ex.label}</span>
                <span style={{fontSize:11,color:D.muted}}>{dispVal}/{ex.weeklyTarget} {ex.unit}</span>
              </div>
              <div style={{height:4,background:D.border,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2,transition:"width 0.2s"}}/>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:D.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.8}}>Tap to log a set</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {EXERCISES.map(ex=>{
            const amt=getSetAmt(ex);
            const label=ex.seconds?`${amt}s`:`${amt} ${ex.unit}`;
            return(
              <button key={ex.key} onClick={()=>addSet(ex)} style={{
                background:D.accentDim,border:`1px solid ${D.accent}44`,color:"#c5c0f5",
                borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:500,
                display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:72
              }}>
                <span>{ex.label}</span>
                <span style={{fontSize:11,color:"#9d97e8",fontWeight:400}}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {day.workouts.length>0&&(
        <div style={{marginBottom:12}}>
          <button onClick={()=>setLogOpen(!logOpen)}
            style={{...lBtn,fontSize:11,textTransform:"uppercase",letterSpacing:.8,color:D.muted,display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            Today's log ({day.workouts.length}) <span style={{fontSize:10}}>{logOpen?"▲":"▼"}</span>
          </button>
          {logOpen&&day.workouts.map(w=>{
            const ex=EXERCISES.find(e=>e.key===w.exKey);
            const dispAmt=ex?.unit==="miles"?`${w.amount.toFixed(1)} miles`:`${w.amount} ${ex?.unit||""}`;
            return(
              <div key={w.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"5px 0",borderBottom:`1px solid ${D.border}26`}}>
                <div style={{fontSize:13}}>
                  <span style={{color:D.accent,fontWeight:500,marginRight:8}}>{ex?.label}</span>
                  <span style={{color:D.muted}}>{dispAmt}</span>
                  {w.label&&!w.isSet&&<span style={{color:D.muted,fontSize:12,marginLeft:6}}>— {w.label}</span>}
                </div>
                <button onClick={()=>remove(w.id)} style={{...lBtn,color:D.red,fontSize:16,lineHeight:1}}>×</button>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={()=>setConfigOpen(!configOpen)} style={{...gBtn,fontSize:12,marginBottom:configOpen?10:0}}>
        {configOpen?"hide config":"⚙ configure sets this week"}
      </button>
      {configOpen&&<WeekSetConfig weekSets={weekSets} setWeekSets={setWeekSets} date={date}/>}

      <div style={{marginTop:10}}>
        <div style={{fontSize:11,color:D.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>Log custom amount</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <select value={customEx} onChange={e=>setCustomEx(e.target.value)} style={{...iSt,width:120}}>
            {EXERCISES.map(e=><option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          <input type="number" placeholder={`Amount (${EXERCISES.find(e=>e.key===customEx)?.unit})`}
            value={customAmt} min={0} step={0.1} onChange={e=>setCustomAmt(e.target.value)} style={{...iSt,width:120}}/>
          <input placeholder="Note (optional)" value={customNote}
            onChange={e=>setCustomNote(e.target.value)} style={{...iSt,flex:1,minWidth:100}}/>
          <button onClick={addCustom} style={pBtn}>Add</button>
        </div>
      </div>
    </div>
  );
}

function WeekSetConfig({weekSets,setWeekSets,date}){
  const ws=weekStart(date);
  const update=(key,val)=>setWeekSets({...weekSets,[key]:val===""?undefined:+val});
  return(
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:8,padding:12,marginTop:4}}>
      <div style={{fontSize:12,color:D.muted,marginBottom:10}}>
        Set amounts for week of <span style={{color:D.text}}>{ws}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
        {EXERCISES.map(ex=>{
          const cur=weekSets[ex.key]!=null?weekSets[ex.key]:ex.defaultSet;
          return(
            <div key={ex.key}>
              <div style={{fontSize:12,color:D.muted,marginBottom:4}}>
                {ex.label} <span style={{fontSize:11}}>({ex.seconds?"seconds":`per set (${ex.unit})`})</span>
              </div>
              <input type="number" value={cur} min={1} step={ex.seconds?15:ex.unit==="miles"?0.25:1}
                onChange={e=>update(ex.key,e.target.value)} style={{...iSt,width:"100%"}}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MEALS ─────────────────────────────────────────────────

function MealList({meals,updateDay}){
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({type:"Breakfast",description:"",wholeFood:false,calories:""});
  const save=()=>{
    if(!form.description) return;
    updateDay(d=>({...d,meals:[...d.meals,{...form,id:Date.now(),calories:+form.calories||0}]}));
    setAdding(false);
    setForm({type:"Breakfast",description:"",wholeFood:false,calories:""});
  };
  const remove=id=>updateDay(d=>({...d,meals:d.meals.filter(m=>m.id!==id)}));
  const total=meals.reduce((s,m)=>s+(m.calories||0),0);
  return(
    <div>
      {meals.map(m=>(
        <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"7px 0",borderBottom:`1px solid ${D.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:11,background:D.accentDim,color:"#c5c0f5",borderRadius:4,padding:"2px 6px"}}>{m.type}</span>
            <span style={{fontSize:13}}>{m.description}</span>
            {m.wholeFood&&<span style={{fontSize:11,background:D.greenDim,color:"#5DCAA5",borderRadius:4,padding:"2px 6px"}}>whole food</span>}
            {m.calories>0&&<span style={{color:D.muted,fontSize:12}}>{m.calories} kcal</span>}
          </div>
          <button onClick={()=>remove(m.id)} style={{...lBtn,color:D.red,fontSize:16}}>×</button>
        </div>
      ))}
      {meals.length>0&&(
        <div style={{textAlign:"right",fontSize:12,color:D.muted,padding:"5px 0"}}>
          Total: <span style={{color:D.text,fontWeight:500}}>{total} kcal</span>
        </div>
      )}
      {adding?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={iSt}>
            {MEAL_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Calories (kcal)" value={form.calories}
            onChange={e=>setForm(f=>({...f,calories:e.target.value}))} style={iSt}/>
          <input placeholder="Description" value={form.description}
            onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...iSt,gridColumn:"span 2"}}/>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",gridColumn:"span 2"}}>
            <input type="checkbox" checked={form.wholeFood} onChange={e=>setForm(f=>({...f,wholeFood:e.target.checked}))}/>
            Whole food only
          </label>
          <div style={{display:"flex",gap:8,gridColumn:"span 2"}}>
            <button onClick={save} style={pBtn}>Add meal</button>
            <button onClick={()=>setAdding(false)} style={gBtn}>Cancel</button>
          </div>
        </div>
      ):(
        <button onClick={()=>setAdding(true)} style={{...gBtn,marginTop:8}}>+ Log meal</button>
      )}
    </div>
  );
}

// ── SECTION WRAPPER ───────────────────────────────────────

function Section({title,children,headerRight}){
  const [open,setOpen]=useState(true);
  return(
    <div style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"10px 14px",cursor:"pointer",userSelect:"none"}}>
        <span style={{fontWeight:500,fontSize:13}}>{title}</span>
        <div style={{display:"flex",alignItems:"center",gap:10}} onClick={e=>e.stopPropagation()}>
          {headerRight}
          <span style={{color:D.muted,fontSize:11}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&<div style={{padding:"0 14px 14px"}}>{children}</div>}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────

function DashTab({days,habits,range,setRange}){
  const dates=[];
  for(let i=range-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().split("T")[0]);}
  const weeklyEx=buildWeeklyEx(days,dates);
  const totalSessions=Object.values(days).reduce((s,d)=>s+(d.workouts?.length||0),0);
  const daysWithMeals=dates.filter(d=>(days[d]?.meals||[]).length>0);
  const avgCals=daysWithMeals.length?Math.round(daysWithMeals.reduce((s,d)=>s+days[d].meals.reduce((ms,m)=>ms+(m.calories||0),0),0)/daysWithMeals.length):0;
  const wholeFoodDays=dates.filter(d=>{const m=days[d]?.meals||[];return m.length>0&&m.every(x=>x.wholeFood);}).length;

  return(
    <div style={{maxWidth:820,margin:"0 auto",padding:16}}>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[7,30,90].map(r=>(
          <button key={r} onClick={()=>setRange(r)} style={{
            background:range===r?D.accentDim:"transparent",color:range===r?"#c5c0f5":D.muted,
            border:`1px solid ${D.border}`,borderRadius:6,padding:"5px 14px",cursor:"pointer",fontSize:12
          }}>{r}d</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[["Total sessions",totalSessions,""],["Avg daily calories",avgCals||"—","kcal"],["100% whole food days",wholeFoodDays,"days"]].map(([l,v,u])=>(
          <div key={l} style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:D.muted,marginBottom:4}}>{l}</div>
            <div style={{fontSize:22,fontWeight:600}}>{v} <span style={{fontSize:12,fontWeight:400,color:D.muted}}>{u}</span></div>
          </div>
        ))}
      </div>
      <DashCard title="Weekly exercise vs. targets"><WeeklyExChart weeklyEx={weeklyEx}/></DashCard>
      <DashCard title="Habit consistency"><HabitHeatmap habits={habits} dates={dates} days={days}/></DashCard>
      <DashCard title="Diet — calories & whole food quality"><DietChart dates={dates} days={days}/></DashCard>
    </div>
  );
}

function buildWeeklyEx(days,dates){
  const weeks={};
  dates.forEach(d=>{
    const ws=weekStart(d);
    if(!weeks[ws]) weeks[ws]={};
    (days[d]?.workouts||[]).forEach(w=>{weeks[ws][w.exKey]=(weeks[ws][w.exKey]||0)+(+w.amount||0);});
  });
  return weeks;
}

function DashCard({title,children}){
  return(
    <div style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:10,marginBottom:12,padding:14}}>
      <div style={{fontSize:13,fontWeight:500,color:D.muted,marginBottom:12}}>{title}</div>
      {children}
    </div>
  );
}

function WeeklyExChart({weeklyEx}){
  const weeks=Object.keys(weeklyEx).sort();
  if(!weeks.length) return <Empty/>;
  return(
    <div>
      {EXERCISES.map(ex=>{
        const bars=weeks.map(w=>({week:w,val:weeklyEx[w][ex.key]||0}));
        const max=Math.max(...bars.map(b=>b.val),ex.weeklyTarget);
        return(
          <div key={ex.key} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,fontWeight:500}}>{ex.label}</span>
              <span style={{fontSize:11,color:D.muted}}>target {ex.weeklyTarget} {ex.unit}/wk</span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:48,position:"relative"}}>
              <div style={{position:"absolute",left:0,right:0,bottom:`${Math.min(ex.weeklyTarget/max*100,98)}%`,borderTop:`1px dashed ${D.muted}44`}}/>
              {bars.map(b=>{
                const pct=b.val/max*100;
                const color=b.val>=ex.weeklyTarget?D.green:b.val>=ex.weeklyTarget*.6?D.amber:D.accent;
                return<div key={b.week} title={`${b.week}: ${b.val.toFixed(1)} ${ex.unit}`}
                  style={{flex:1,minWidth:8,background:b.val>0?color:D.border,
                    height:`${Math.max(pct,b.val>0?6:2)}%`,borderRadius:"2px 2px 0 0",opacity:b.val>0?.9:.3}}/>;
              })}
            </div>
            <div style={{display:"flex",gap:4,marginTop:2}}>
              {bars.map(b=><div key={b.week} style={{flex:1,fontSize:9,color:D.muted,textAlign:"center",overflow:"hidden"}}>{b.week.slice(5)}</div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HabitHeatmap({habits,dates,days}){
  if(!habits.length) return <Empty/>;
  const cell=Math.max(9,Math.min(18,Math.floor(560/dates.length)));
  const cc={healthy:D.green,limit:D.amber,unhealthy:D.red};
  return(
    <div style={{overflowX:"auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"110px 1fr 90px",gap:"4px 6px",alignItems:"center"}}>
        {habits.map(h=>{
          const color=cc[h.cat]||D.muted;
          const pct=Math.round(dates.filter(d=>days[d]?.habitLogs?.[h.id]).length/dates.length*100);
          let streak=0;
          for(let i=dates.length-1;i>=0;i--){if(days[dates[i]]?.habitLogs?.[h.id])streak++;else break;}
          return[
            <div key={`l${h.id}`} style={{fontSize:12,color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>,
            <div key={`b${h.id}`} style={{display:"flex",gap:2}}>
              {dates.map(d=>{
                const on=!!days[d]?.habitLogs?.[h.id];
                return<div key={d} title={d} style={{width:cell,height:cell,borderRadius:2,flexShrink:0,background:on?color:D.border,opacity:on?.85:.25}}/>;
              })}
            </div>,
            <div key={`s${h.id}`} style={{fontSize:11,color:D.muted,textAlign:"right",whiteSpace:"nowrap"}}>{pct}% · {streak}d</div>
          ];
        })}
      </div>
    </div>
  );
}

function DietChart({dates,days}){
  const data=dates.map(d=>{
    const meals=days[d]?.meals||[];
    const cals=meals.reduce((s,m)=>s+(m.calories||0),0);
    const wfPct=meals.length?meals.filter(m=>m.wholeFood).length/meals.length*100:null;
    return{date:d,cals,wfPct};
  });
  const maxCal=Math.max(...data.map(d=>d.cals),1800);
  return(
    <div>
      <div style={{display:"flex",alignItems:"flex-end",gap:dates.length>30?2:3,height:80,marginBottom:4}}>
        {data.map(d=>{
          const color=d.wfPct===100?D.green:d.wfPct!=null&&d.wfPct>=50?D.amber:d.cals>0?D.red:D.border;
          return<div key={d.date} title={`${d.date}: ${d.cals} kcal`}
            style={{flex:1,minWidth:2,background:color,
              height:`${Math.max(d.cals>0?d.cals/maxCal*100:0,d.cals>0?6:3)}%`,
              borderRadius:"2px 2px 0 0",opacity:d.cals>0?.85:.3}}/>;
        })}
      </div>
      <div style={{display:"flex",gap:16,fontSize:11,color:D.muted,flexWrap:"wrap"}}>
        {[[D.green,"100% whole food"],[D.amber,">50% whole food"],[D.red,"mixed / none"]].map(([c,l])=>(
          <span key={l}><span style={{display:"inline-block",width:8,height:8,background:c,borderRadius:2,marginRight:4}}/>{l}</span>
        ))}
      </div>
    </div>
  );
}

function Empty(){return<div style={{fontSize:12,color:D.muted,fontStyle:"italic",padding:"8px 0"}}>No data yet — log sessions to see charts.</div>;}

const iSt={background:D.surface,border:`1px solid ${D.border}`,color:D.text,borderRadius:6,padding:"6px 10px",fontSize:13,boxSizing:"border-box",outline:"none"};
const pBtn={background:D.accentDim,color:"#c5c0f5",border:"none",borderRadius:6,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:500};
const gBtn={background:"transparent",color:D.muted,border:`1px solid ${D.border}`,borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:13};
const lBtn={background:"transparent",border:"none",color:D.accent,cursor:"pointer",fontSize:12,padding:0};
