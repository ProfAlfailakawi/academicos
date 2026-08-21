import { performance } from 'node:perf_hooks';

const option=process.argv.find(x=>x.startsWith('--records='));const records=Math.min(2_000_000,Math.max(100_000,Number(option?.split('=')[1]||1_000_000)));const users=10_000,pageSize=100;
const started=performance.now(),byUser=new Map(),byAssignment=new Map();
for(let i=0;i<records;i++){const userId=`u_${i%users}`,assignmentId=`a_${i%5000}`,row={id:`p_${i}`,updatedAt:records-i,status:i%7===0?'released':'submitted'};let list=byUser.get(userId);if(!list){list=[];byUser.set(userId,list)}list.push(row);let queue=byAssignment.get(assignmentId);if(!queue){queue=[];byAssignment.set(assignmentId,queue)}queue.push(row);}
const indexMs=performance.now()-started,timings=[];
for(let round=0;round<200;round++){const t=performance.now(),list=round%2?byUser.get(`u_${round%users}`)||[]:byAssignment.get(`a_${round%5000}`)||[];const page=list.slice(0,pageSize);if(page.length>pageSize)throw new Error('Unbounded result page');timings.push(performance.now()-t);}
timings.sort((a,b)=>a-b);const p95=timings[Math.floor(timings.length*.95)],heapMb=process.memoryUsage().heapUsed/1024/1024;
const result={records,users,assignments:5000,pageSize,indexBuildMs:Number(indexMs.toFixed(1)),queryP95Ms:Number(p95.toFixed(3)),heapMb:Number(heapMb.toFixed(1)),bounded:true,workloads:['student receipt history','faculty grading queue']};console.log(JSON.stringify(result));
if(p95>50||heapMb>650)process.exitCode=1;
