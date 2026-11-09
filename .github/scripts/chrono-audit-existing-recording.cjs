'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const input=path.resolve(process.env.CHRONO_AUDIT_INPUT),out=path.resolve(process.env.CHRONO_AUDIT_OUT);
fs.mkdirSync(out,{recursive:true});
const media=path.join(input,'chrono-gameplay-native.mp4'),old=JSON.parse(fs.readFileSync(path.join(input,'CAPTURE_ACTUAL.json'),'utf8'));
assert.equal(old.status,'failed');assert.equal(old.accepted,false);
const report={sourceRun:42584376589,sourceArtifact:13658497802,scope:'Read-only audit of a failed real recording; no new capture, no finished-video claim',sourceStillFailed:true,accepted:false,errors:[]};
const run=(tool,args,log)=>{const r=cp.spawnSync(tool,args,{encoding:'utf8',timeout:20000,windowsHide:true,maxBuffer:8*1024*1024});fs.writeFileSync(path.join(out,log),r.stderr||'');assert.equal(r.status,0,tool+' failed; inspect '+log);return r.stdout;};
try{
 const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',media],'probe.stderr.log'));
 fs.writeFileSync(path.join(out,'ffprobe.json'),JSON.stringify(probe,null,2));
 report.duration=Number(probe.format.duration);report.formatStartTime=probe.format.start_time;
 report.streams=probe.streams.map(s=>({type:s.codec_type,codec:s.codec_name,width:s.width,height:s.height,rate:s.avg_frame_rate,start:s.start_time,duration:s.duration,sampleRate:s.sample_rate,channels:s.channels}));
 const log=fs.readFileSync(path.join(input,'capture.ffmpeg.log'),'utf8');
 const starts=[...log.matchAll(/Duration: N\/A, start: ([\d.]+)/g)].map(m=>Number(m[1]));
 report.actualInputStarts=starts;report.actualInputStartGapSeconds=starts[1]-starts[0];
 report.finalFrameStats=[...log.matchAll(/frame=\s*(\d+)[^\r\n]*time=([-\d:.]+)[^\r\n]*dup=(\d+) drop=(\d+)/g)].map(m=>({frames:Number(m[1]),time:m[2],dup:Number(m[3]),drop:Number(m[4])})).at(-1);
 report.actualSignalLog=log.split('\n').filter(s=>s.includes('received signal'));
 report.originalModeFailure=old.errors;report.originalCleanup=old.cleanup;
 run('ffmpeg',['-v','error','-i',media,'-f','null','-'],'decode.log');
 report.decode='actual full decode exited0';
 for(const [index,fraction]of [0,.25,.5,.75,1].entries())run('ffmpeg',['-v','error','-y','-ss',String(Math.min(report.duration-.1,report.duration*fraction)),'-i',media,'-frames:v','1',path.join(out,'frame-'+index+'.png')],'frame-'+index+'.log');
 run('ffmpeg',['-hide_banner','-i',media,'-filter_complex','ebur128=peak=true','-f','null','-'],'loudness.log');
 run('ffmpeg',['-hide_banner','-i',media,'-af','volumedetect','-f','null','-'],'volume.log');
 run('ffmpeg',['-v','error','-y','-i',media,'-filter_complex','showwavespic=s=1200x240:colors=gold','-frames:v','1',path.join(out,'waveform.png')],'waveform.log');
 const md5=run('ffmpeg',['-v','error','-i',media,'-map','0:v:0','-f','framemd5','-'],'framemd5.stderr.log');
 fs.writeFileSync(path.join(out,'decoded-frame-md5.txt'),md5);
 const hashes=md5.split('\n').filter(s=>s&&!s.startsWith('#')).map(s=>s.split(',').at(-1).trim());
 let longest=0,current=0,last=null;
 for(const hash of hashes){current=hash===last?current+1:1;longest=Math.max(longest,current);last=hash;}
 report.decodedFrames=hashes.length;report.longestExactDecodedDuplicateRun=longest;
 report.status='failed-source-audited-not-accepted';
}catch(error){report.status='audit-failed';report.errors.push(error.stack||String(error));process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'AUDIT_ACTUAL.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
