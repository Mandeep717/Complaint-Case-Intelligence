import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from './db.js';

const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID();
async function main(){
  const users=[
    {name:'System Administrator',email:'admin@demo.aicte.local',role:'admin',bureauId:null,region:'National'},
    {name:'PGRC Officer',email:'officer.pgrc@demo.aicte.local',role:'bureau_officer',bureauId:'PGRC',region:'North'},
    {name:'Regulation Officer',email:'officer.reg@demo.aicte.local',role:'bureau_officer',bureauId:'REGULATION',region:'North'},
    {name:'Overlap Reviewer',email:'reviewer@demo.aicte.local',role:'reviewer',bureauId:null,region:'National'},
    {name:'Regional Viewer',email:'viewer@demo.aicte.local',role:'read_only',bureauId:null,region:'North'}
  ];
  const userIds:any={};for(const u of users){let existing=db.prepare('SELECT id FROM users WHERE email=?').get(u.email) as any;const x=existing?.id||id();userIds[u.email]=x;if(!existing)db.prepare('INSERT INTO users(id,name,email,passwordHash,role,bureauId,region,createdAt) VALUES(?,?,?,?,?,?,?,?)').run(x,u.name,u.email,await bcrypt.hash('Demo@26264',10),u.role,u.bureauId,u.region,now())}
  const institutions=[
    {aicteId:'DEMO-DEL-001',name:'North Valley Institute of Technology',address:'Sector 18, New Delhi',region:'North'},
    {aicteId:'DEMO-KA-002',name:'Western Lakes College of Engineering',address:'Mysuru Road, Bengaluru',region:'South'},
    {aicteId:'DEMO-MH-003',name:'Riverbend School of Management',address:'Pune, Maharashtra',region:'West'}
  ];const inst:any={};for(const i of institutions){let e=db.prepare('SELECT id FROM institutions WHERE aicteId=?').get(i.aicteId) as any;const x=e?.id||id();inst[i.aicteId]=x;if(!e)db.prepare('INSERT INTO institutions(id,aicteId,name,address,region,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)').run(x,i.aicteId,i.name,i.address,i.region,now(),now())}
  const records=[
    ['DEMO-DEL-001','PGRC','Student Grievance','Delayed degree certificates for 2024 graduates','Graduates report that final degree certificates have not been issued despite completing all requirements. Multiple students say their employers need proof of graduation.','UNDER_PROCESS','HIGH',-74,'officer.pgrc@demo.aicte.local'],
    ['DEMO-DEL-001','REGULATION','Student Grievance','Final academic documents not received','A group of former students say the institute has still not sent their graduation documents. They need the certificates for employment and further study.','PENDING','MEDIUM',-21,'officer.reg@demo.aicte.local'],
    ['DEMO-DEL-001','REGULATION','Faculty Matters','Concern about faculty recruitment notice','A complainant questions the qualification criteria in a recent faculty recruitment advertisement.','PENDING','LOW',25,'officer.reg@demo.aicte.local'],
    ['DEMO-KA-002','PGRC','Fee Related','Refund of cancelled semester fees','Students seek return of semester fees after classes were cancelled and the term was not delivered.','ESCALATED','URGENT',-32,'officer.pgrc@demo.aicte.local'],
    ['DEMO-KA-002','REGULATION','Infrastructure','Laboratory access during renovation','Students say the engineering laboratories are unavailable during scheduled renovation work.','TRANSFERRED','MEDIUM',13,'officer.reg@demo.aicte.local'],
    ['DEMO-MH-003','PGRC','Student Grievance','Request for transcript correction','A former student requests correction of a course title on an academic transcript.','DISPOSED','LOW',-4,'officer.pgrc@demo.aicte.local']
  ] as any[];
  const complaintIds:any[]=[];
  for(const [aicteId,bureauId,category,subject,description,status,priority,dueOffset,officerEmail] of records){const existing=db.prepare('SELECT id FROM complaints WHERE subject=? AND institutionId=?').get(subject,inst[aicteId]) as any;if(existing){complaintIds.push(existing.id);continue}const cid=id(),caseId=`AICTE-DEMO-${String(complaintIds.length+1).padStart(4,'0')}`,received=new Date(Date.now()-Math.abs(dueOffset+30)*86400000).toISOString().slice(0,10),due=new Date(Date.now()+dueOffset*86400000).toISOString().slice(0,10),actor=userIds[officerEmail];db.prepare('INSERT INTO complaints(id,caseId,institutionId,receivedAt,category,subject,description,bureauId,assignedOfficerId,status,priority,expectedDisposalAt,lastActionAt,nextAction,createdBy,analysisState,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(cid,caseId,inst[aicteId],received,category,subject,description,bureauId,actor,status,priority,due,now(),'Review supporting records',actor,'completed',now(),now());db.prepare('INSERT INTO actions(id,complaintId,actionType,performedBy,remarks,createdAt) VALUES(?,?,?,?,?,?)').run(id(),cid,'COMPLAINT_REGISTERED',actor,'Synthetic demonstration case',now());complaintIds.push(cid)}
  const a=db.prepare('SELECT id FROM complaints WHERE subject=?').get('Delayed degree certificates for 2024 graduates') as any,b=db.prepare('SELECT id FROM complaints WHERE subject=?').get('Final academic documents not received') as any;if(a&&b){const pair=[a.id,b.id].sort().join(':');db.prepare(`INSERT OR IGNORE INTO relationships(id,pairKey,complaintA,complaintB,matchingSignals,similarityScore,llmExplanation,reviewStatus,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id(),pair,...[a.id,b.id].sort(),JSON.stringify(['Same AICTE institution ID','Same complaint category','Keyword or meaning similarity']),0.71,JSON.stringify({relationship:'potentially_related',similarities:['Both describe delays receiving academic completion documents','Both involve graduates of the same institution'],differences:['Exact certificate type and affected students differ or are unverified'],uncertainties:['The records do not establish whether the complainants refer to the same group'],evidence:[{complaintId:'AICTE-DEMO-0001',field:'description'},{complaintId:'AICTE-DEMO-0002',field:'description'}],recommendedReview:true}),'pending',now(),now());const rel=db.prepare('SELECT id FROM relationships WHERE pairKey=?').get(pair) as any;db.prepare('INSERT OR IGNORE INTO notifications(id,recipientId,type,complaintId,relationshipId,eventKey,message,createdAt) VALUES(?,?,?,?,?,?,?,?)').run(id(),userIds['reviewer@demo.aicte.local'],'overlap',a.id,rel.id,`overlap:${pair}`,'Review a potential cross-bureau complaint overlap',now())}
  console.log('Synthetic data ready. Demo accounts use password: Demo@26264');
}
main().catch(e=>{console.error(e);process.exit(1)});
