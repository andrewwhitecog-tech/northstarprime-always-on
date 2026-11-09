'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {trackOwnedChild,stopOwnedChild}=require('./chrono-gameplay-showcase.cjs');
const input=path.resolve(process.env.CHRONO_MASTER_INPUT),out=path.resolve(process.env.CHRONO_MASTER_OUT);
fs.mkdirSync(out,{recursive:true});
const report={sourceRun:42589037599,sourceArtifact:13660302566,status:'started',accepted:false,listened:false,perceptualSyncAccepted:false,steps:[],errors:[]};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const children=new Set();let terminating=false;
async function run(tool,args,log,binary=false){
 assert.equal(terminating,false,'Refuse new work after termination');
 const child=spawn(tool,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let spawnError;child.once('error',e=>{spawnError=e;});
 assert.ok(Number.isInteger(child.pid)&&child.pid>0,'Actual child PID required');
 const done=trackOwnedChild(child,'master:'+tool);children.add(child);
 const output=[],errors=[];let timedOut=false,stopReceipt;
 child.stdout.on('data',chunk=>output.push(chunk));child.stderr.on('data',chunk=>errors.push(chunk));
 const timer=setTimeout(()=>{timedOut=true;stopOwnedChild(child).then(r=>{stopReceipt=r;},e=>{report.errors.push(String(e));});},60000);
 const exit=await done;clearTimeout(timer);children.delete(child);
 const stderr=Buffer.concat(errors).toString('utf8');fs.writeFileSync(path.join(out,log),stderr);
 report.steps.push({tool,args,exit,timedOut,stopReceipt,stderrLog:log});
 if(spawnError)throw spawnError;
 assert.equal(timedOut,false,'Actual tool timed out: '+log);
 assert.equal(exit.code,0,'Actual tool failed: '+log);
 const data=Buffer.concat(output);return binary?data:data.toString('utf8');
}
async function probe(file,label){
 const p=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],label+'-probe.log'));
 write(label+'-ffprobe.json',p);return p;
}
async function videoPackets(file,label){
 const p=JSON.parse(await run('ffprobe',['-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pts,dts,duration,size,flags','-of','json',file],label+'-packets.log'));
 write(label+'-video-packets.json',p);
 return p.packets.map(x=>({pts:x.pts,dts:x.dts,duration:x.duration,size:x.size,flags:x.flags}));
}
async function codedVideoHash(file,label){
 const value=await run('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-'],label+'-video-hash.log');
 const match=value.match(/SHA256=([0-9a-f]{64})/i);assert.ok(match,'Actual coded-video hash missing');return match[1].toLowerCase();
}
async function pcm(file,label){
 const bytes=await run('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-ac','1','-ar','8000','-f','f32le','-'],label+'-pcm.log',true);
 assert.equal(bytes.length%4,0);const samples=new Float32Array(bytes.length/4);
 for(let i=0;i<samples.length;i++)samples[i]=bytes.readFloatLE(i*4);
 return samples;
}
function correlate(a,b,lag,stride){
 const start=Math.max(0,-lag),end=Math.min(a.length,b.length-lag);let aa=0,bb=0,ab=0;
 for(let i=start;i<end;i+=stride){const x=a[i],y=b[i+lag];aa+=x*x;bb+=y*y;ab+=x*y;}
 return aa&&bb?ab/Math.sqrt(aa*bb):-1;
}
function bestLag(a,b){
 let coarse={samples:0,correlation:-2};
 for(let lag=-2000;lag<=2000;lag+=8){const c=correlate(a,b,lag,8);if(c>coarse.correlation)coarse={samples:lag,correlation:c};}
 let fine={samples:coarse.samples,correlation:-2};
 for(let lag=coarse.samples-8;lag<=coarse.samples+8;lag++){const c=correlate(a,b,lag,1);if(c>fine.correlation)fine={samples:lag,correlation:c};}
 return {...fine,milliseconds:fine.samples/8,definition:'Positive means master audio lags source; original baseline only, not perceptual game/SFX sync acceptance'};
}
async function main(){
 const original=JSON.parse(fs.readFileSync(path.join(input,'CAPTURE_ACTUAL.json'),'utf8'));
 const source=path.join(input,'chrono-gameplay-native.mp4');
 const sourceSha=hash(fs.readFileSync(source));
 assert.equal(sourceSha,'4b491aa30ff2014a9bab51ab5f41ce91e120e4c8c12433bb4adcad2389dd7fd2');
 assert.equal(sourceSha,original.output.sha256);
 report.source={file:'chrono-gameplay-native.mp4',sha256:sourceSha,gameCommit:original.source.commit,raw:original.rawOutput,originalInputInterval:original.actualInputDurationSeconds};
 const sourceProbe=await probe(source,'source'),sourceVideo=sourceProbe.streams.find(s=>s.codec_type==='video'),sourceAudio=sourceProbe.streams.find(s=>s.codec_type==='audio');
 assert.ok(sourceVideo&&sourceAudio);assert.equal(sourceVideo.codec_name,'h264');
 const timebase=sourceVideo.time_base.match(/^1\/(\d+)$/);assert.ok(timebase,'Exact video timebase required');
 const target='loudnorm=I=-14:TP=-1.5:LRA=11';
 await run('ffmpeg',['-hide_banner','-i',source,'-map','0:a:0','-af',target+':print_format=json','-f','null','-'],'first-pass.log');
 const firstText=fs.readFileSync(path.join(out,'first-pass.log'),'utf8');
 const blocks=[...firstText.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];assert.ok(blocks.length);
 const measured=JSON.parse(blocks.at(-1)[0]);
 for(const key of ['input_i','input_tp','input_lra','input_thresh','target_offset'])assert.ok(Number.isFinite(Number(measured[key])),'Actual finite measurement missing: '+key);
 write('FIRST_PASS_ACTUAL.json',measured);report.firstPass=measured;
 const filter=target+':measured_I='+measured.input_i+':measured_TP='+measured.input_tp+':measured_LRA='+measured.input_lra+':measured_thresh='+measured.input_thresh+':offset='+measured.target_offset+':linear=true:print_format=json';
 const final=path.join(out,'NorthStar_Chrono_Defender_20s_Gameplay_Master_v01.mp4');
 await run('ffmpeg',['-hide_banner','-y','-copyts','-i',source,'-map','0:v:0','-map','0:a:0','-c:v','copy','-video_track_timescale',timebase[1],
  '-af',filter,'-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-avoid_negative_ts','disabled','-movflags','+faststart',final],'second-pass.log');
 const masterProbe=await probe(final,'master'),masterVideo=masterProbe.streams.find(s=>s.codec_type==='video'),masterAudio=masterProbe.streams.find(s=>s.codec_type==='audio');
 assert.equal(masterVideo.time_base,sourceVideo.time_base);assert.equal(masterVideo.start_time,sourceVideo.start_time);
 assert.equal(masterVideo.duration,sourceVideo.duration);
 assert.ok(Math.abs(Number(masterAudio.start_time)-Number(sourceAudio.start_time))<=1/48000);
 assert.ok(Math.abs(Number(masterAudio.duration)-Number(sourceAudio.duration))<=1024/48000);
 assert.ok(Math.abs(Number(masterProbe.format.duration)-Number(sourceProbe.format.duration))<=1024/48000);
 const sourcePackets=await videoPackets(source,'source'),masterPackets=await videoPackets(final,'master');
 assert.deepEqual(masterPackets,sourcePackets,'Video packet timestamps/sizes/flags changed');
 const sourceVideoHash=await codedVideoHash(source,'source'),masterVideoHash=await codedVideoHash(final,'master');
 assert.equal(masterVideoHash,sourceVideoHash,'Coded video payload changed');
 report.videoBinding={sourceVideoHash,masterVideoHash,packetCount:sourcePackets.length,packetManifestSha256:hash(Buffer.from(JSON.stringify(sourcePackets))),packetIdentity:true,noVideoRerender:true};
 write('VIDEO_BINDING_ACTUAL.json',report.videoBinding);
 await run('ffmpeg',['-v','error','-i',final,'-f','null','-'],'full-decode.log');
 const duration=Number(masterProbe.format.duration);report.frames=[];
 for(const [i,fraction]of [0,.25,.5,.75,1].entries()){
  const at=Math.min(duration-.15,duration*fraction),name='frame-'+i+'.png';
  await run('ffmpeg',['-v','error','-y','-ss',String(at),'-i',final,'-frames:v','1',path.join(out,name)],'frame-'+i+'.log');
  const masterHash=hash(fs.readFileSync(path.join(out,name))),sourceFrame=path.join(input,name);
  report.frames.push({file:name,atSeconds:at,sha256:masterHash,sourcePngIdentical:fs.existsSync(sourceFrame)?masterHash===hash(fs.readFileSync(sourceFrame)):null});
 }
 await run('ffmpeg',['-hide_banner','-i',final,'-filter_complex','ebur128=peak=true','-f','null','-'],'audio-loudness.log');
 const summary=fs.readFileSync(path.join(out,'audio-loudness.log'),'utf8').split('Summary:').at(-1);
 const integrated=summary.match(/I:\s+([+-]?[\d.]+) LUFS/),peak=summary.match(/True peak:[\s\S]*?Peak:\s+([+-]?[\d.]+) dBFS/);
 assert.ok(integrated&&peak,'Actual final loudness summary missing');
 report.masterAudio={integratedLufs:Number(integrated[1]),truePeakDbtp:Number(peak[1]),sourceAudioPreservedInOriginalArtifact:true};
 assert.ok(Math.abs(report.masterAudio.integratedLufs+14)<=.3,'Actual integrated loudness misses target');
 assert.ok(report.masterAudio.truePeakDbtp<=-1,'Actual true peak exceeds target');
 await run('ffmpeg',['-hide_banner','-i',final,'-af','volumedetect','-f','null','-'],'audio-volume.log');
 await run('ffmpeg',['-v','error','-y','-i',final,'-filter_complex','showwavespic=s=1200x240:colors=gold','-frames:v','1',path.join(out,'actual-audio-waveform.png')],'waveform.log');
 const sourcePcm=await pcm(source,'source'),masterPcm=await pcm(final,'master'),alignment=bestLag(sourcePcm,masterPcm);
 report.audioBaselineAlignment={...alignment,sourceSamples:sourcePcm.length,masterSamples:masterPcm.length,analysisRate:8000};
 write('AUDIO_BASELINE_ALIGNMENT_ACTUAL.json',report.audioBaselineAlignment);
 assert.ok(Math.abs(alignment.milliseconds)<=2&&alignment.correlation>=.95,'Master audio does not preserve demonstrable source baseline alignment');
 report.output={file:path.basename(final),sha256:hash(fs.readFileSync(final)),bytes:fs.statSync(final).size,duration};
 report.status='master-produced-awaiting-personal-listening-and-lead-review';
}
async function stopAll(reason){
 terminating=true;report.cleanupReason=reason;
 report.cleanup=await Promise.all([...children].map(child=>stopOwnedChild(child)));
 if(report.cleanup.some(r=>!r.closedConfirmed)){report.status='failed';report.errors.push('Owned child closure unconfirmed');process.exitCode ||= 1;}
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
 if(terminating)return;report.status='failed';report.errors.push('Received '+signal);
 stopAll(signal).finally(()=>{write('MASTER_ACTUAL.json',report);process.exit(signal==='SIGTERM'?143:130);});
});
(async()=>{
 try{await main();}
 catch(error){report.status='failed';report.errors.push(error.stack||String(error));process.exitCode=1;}
 finally{await stopAll('finally');report.finishedUtc=new Date().toISOString();write('MASTER_ACTUAL.json',report);console.log(JSON.stringify({status:report.status,accepted:false,output:report.output,masterAudio:report.masterAudio,videoBinding:report.videoBinding,audioBaselineAlignment:report.audioBaselineAlignment,errors:report.errors},null,2));}
})();
