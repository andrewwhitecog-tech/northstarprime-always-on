'use strict';
// Source identity only. This job does not manufacture or relabel an earlier UI-native result.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const expected=[
  "100644 blob 86b38ec22fedc7c3163efab8f8844db2bb57c4be\t.github/scripts/native-browser-focus.cjs",
  "100644 blob bca093d8edb8340c659ef30b58999d4428a586e2\tarcade/custom/dharma-invaders/assets/start-v01.png",
  "100644 blob 97148a7a53ab3471ac04f0b46c7b697bdbf6a6db\tarcade/custom/dharma-invaders/assets/title-v01.png",
  "100644 blob 5e0143dc0e94ffc6e9a6ca42fafa8cc1316dc36e\tarcade/custom/dharma-invaders/index.html",
  "100644 blob 0818773f204edf480c2af13ac6249dd16942dcb7\tarcade/custom/dharma-invaders/tests/browser_ui.cjs",
  "100644 blob e6dae03f2e83431f84e80caed7a8f76f8da82be6\tarcade/custom/dharma-invaders/tests/dash_completion.test.cjs",
  "100644 blob 241d7afc6c6ef1eb531d6d582ae0a9944ca4ed21\tarcade/custom/dharma-invaders/tests/ui_contract.test.cjs",
  "100644 blob a4c912a32dadba0b3a17e118b581426fcf330067\tstatic/art/games/vorath_overhaul_v01/commentary_siege/commentary_sentinel_redaction_atlas_v01.png",
  "100644 blob 2d686bcb2c7fb32f368638b58cf125bf8192203b\tstatic/art/games/vorath_overhaul_v01/commentary_siege/commentary_sentinel_redaction_atlas_v01.webp",
  "100644 blob f336ae87624bf21e971c43b7568ec98632e0843d\tstatic/games/chiptune.js"
];
const paths=["arcade/custom/dharma-invaders","static/games/chiptune.js","static/art/games/vorath_overhaul_v01/commentary_siege/commentary_sentinel_redaction_atlas_v01.webp","static/art/games/vorath_overhaul_v01/commentary_siege/commentary_sentinel_redaction_atlas_v01.png",".github/scripts/native-browser-focus.cjs"];
const actual=cp.execFileSync('git',['ls-tree','-r','HEAD','--',...paths],{encoding:'utf8',windowsHide:true}).trim().split('\n').filter(x=>!x.endsWith('/tests/browser_edge.cjs'));
const exactSourceMatch=JSON.stringify(actual)===JSON.stringify(expected);
const receipt={scope:exactSourceMatch?'Exact unchanged UI/game/assets/test/shared-dependency source binding; UI native NOT repeated. The separately failed edge phase must pass now.':'Source differs from retained UI result; full native UI suite must execute.',exactSourceMatch,currentHead:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),retainedRun:42630166948,retainedTestedMerge:'a6135b6b7967ed3f2974cb01e91311f06d8ea6f3',retainedUIReportSha256:'eb7c7f478eb1bd565f375e6bab8e86fb9d2a4bb65b4e49a41f80f663ad6afb47',retainedArtifact:13680647046,priorWorkflowConclusion:'failure (four edge Pause timing failures), UI JSON genuinely passed separately',expected,actual};
const out=process.env.NSP_PLAYTEST_OUT;if(!out)throw Error('output required');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'RETAINED_UI_SOURCE_BINDING.json'),JSON.stringify(receipt,null,2));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'needs-ui='+String(!exactSourceMatch)+'\n');console.log(JSON.stringify(receipt,null,2));
