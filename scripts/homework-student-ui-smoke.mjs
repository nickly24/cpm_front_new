/* Offline regression: no real accounts, API, database or object storage. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/nikolajpribys/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output = process.env.SMOKE_OUTPUT || '/Users/nikolajpribys/Desktop/cpm/outputs/homework-redesign/student';
await fs.mkdir(output, { recursive: true });
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (let i=1;i<=3;i++) { const page=pdf.addPage([595,842]); page.drawText(`HOMEWORK / PAGE ${i}`,{x:48,y:770,size:24,font,color:rgb(.16,.2,.27)});page.drawText('Mathematics. Practice and solutions.',{x:48,y:725,size:16,font}); for(let j=0;j<7;j++)page.drawText(`${j+1}.   x + ${j+2} = ${(j+2)*3}    =>    x = ${(j+2)*2}`,{x:48,y:665-j*60,size:17,font}); }
const bytes=Buffer.from(await pdf.save());
const row = (id,name,state,result=null) => ({ homework_id:id,homework_name:name,homework_type:'ОВ',deadline:'2026-09-18',status:result===null?'ДЗ не сделано':'ДЗ сдано',result,submission_id:id,submission_state:state,has_file:['graded','submitted','revision_requested'].includes(state),has_draft:state==='draft',revision_comment:state==='revision_requested'?'Проверьте решение третьей задачи и добавьте пояснение.':null });
const rows=[row(1,'Квадратные уравнения','none'),row(2,'Геометрия: площади фигур','submitted'),row(3,'Функции и графики','revision_requested'),row(4,'Тригонометрические выражения','graded',95)];
let work={id:1,state:'none',has_file:false,has_draft:false,revision_comment:null};
let job=null, failUpload=true, failFileUrl=true, uploadCount=0, submits=0;
const requests=[],unexpected=[],errors=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
await context.addInitScript(()=>{localStorage.setItem('auth_token','offline-test-token');localStorage.setItem('theme','light');});
await context.route('**/*', async route=>{
 const request=route.request(),url=new URL(request.url()),p=url.pathname;
 const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://localhost:3010','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},body:JSON.stringify(data)});
 if(p==='/offline-homework.pdf') return route.fulfill({contentType:'application/pdf',body:bytes});
 if(url.origin==='http://localhost:3010')return route.continue();
 if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com')return route.fulfill({status:200,contentType:'text/css',body:''});
 if(url.origin!=='http://127.0.0.1:5099'){unexpected.push(request.url());return route.abort();}
 if(request.method()==='OPTIONS')return reply({});
 requests.push({p,method:request.method()});
 if(p==='/api/aun')return reply({status:true,role:'student',id:7,entity_id:7,full_name:'Анна Смирнова',group_id:2});
 if(p==='/api/homeworks/student-with-sessions')return reply({status:true,res:rows.map(r=>r.homework_id===1?{...r,submission_state:work.state,has_file:work.has_file,has_draft:work.has_draft}:r),pagination:{current_page:1,total_pages:1,total_items:4,items_per_page:100}});
 if(p.match(/^\/api\/workspaces\/\d+$/)) {
  const id=Number(p.split('/').at(-1)),r=rows.find(r=>r.homework_id===id),sub=id===1?work:{id,state:r.submission_state,has_file:r.has_file,has_draft:r.has_draft,revision_comment:r.revision_comment};
  const metadata={id:1,filename:'Анна Смирнова — Домашняя работа.pdf',page_count:3,size_bytes:bytes.length};
  return reply({homework:{id,name:r.homework_name,deadline:r.deadline,published:true},submission:{...sub,draft_file:sub.has_draft?metadata:null,current_file:sub.has_file?metadata:null,submitted_at_utc:sub.has_file?'2026-09-12T09:00:00Z':null},legacy_result:r.result===null?null:{id,status:1,result:r.result,date_pass:'2026-09-12'},permissions:{upload:['none','draft','revision_requested'].includes(sub.state),submit:sub.has_draft,remove_draft:sub.has_draft},limits:{max_bytes:10485760,max_pages:35,poll_after_seconds:10},active_job:job&&['queued','uploading'].includes(job.status)?job:null});
 }
 if(p==='/api/workspaces/1/uploads') { job={id:'11111111-1111-4111-8111-111111111111',homework_id:1,status:'uploading',stage:'uploading',progress:0}; return reply({job,upload:{method:'POST',url:'http://127.0.0.1:5099/offline-upload',fields:{key:'offline'}},max_bytes:10485760,poll_after_seconds:10},201); }
 if(p==='/offline-upload') {uploadCount++; if(failUpload){failUpload=false;return route.fulfill({status:503,body:'offline simulated upload failure'});}return route.fulfill({status:204,body:''});}
 if(p.endsWith('/complete')){work={...work,state:'draft',has_draft:true};job={...job,status:'ready',stage:'ready',progress:100};return reply(job,202);}
 if(p==='/api/jobs/active')return reply({items:job&&['queued','uploading'].includes(job.status)?[job]:[],polling_required:false,poll_after_seconds:10});
 if(p.startsWith('/api/jobs/')&&p.endsWith('/cancel')){job={...job,status:'cancelled'};return reply(job);}
 if(p.startsWith('/api/jobs/'))return reply(job||{});
 if(p.endsWith('/file-url')){if(failFileUrl){failFileUrl=false;return reply({error:'storage_unavailable'},503);}return reply({url:'http://localhost:3010/offline-homework.pdf',filename:'Анна Смирнова — Домашняя работа.pdf',expires_in:300});}
 if(p==='/api/workspaces/1/submit'){submits++;work={...work,state:'submitted',has_draft:false,has_file:true};return reply({state:'submitted'});}
 if(p==='/api/workspaces/1/draft'&&request.method()==='DELETE'){work={...work,state:'none',has_draft:false};return reply({ok:true,state:'none'});}
 unexpected.push(request.method()+' '+p);return reply({error:'Unmocked request'},500);
});
const page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.error('PAGEERROR',error.message)});
const fit=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'page must fit viewport');
try {
 await page.goto('http://localhost:3010/cabinet/student/homework');
 await page.getByRole('heading',{name:'Квадратные уравнения',exact:true}).waitFor();await fit();
 await page.screenshot({path:output+'/mobile-list.png',fullPage:true});
 await page.getByRole('button',{name:'Подготовить работу',exact:true}).first().click();
 await page.getByRole('heading',{name:'Добавьте свою работу',exact:true}).waitFor();await fit();
 await page.screenshot({path:output+'/mobile-empty.png',fullPage:true});
 await page.locator('input[type=file]').first().setInputFiles({name:'homework.pdf',mimeType:'application/pdf',buffer:bytes});
 await page.getByText('S3 отклонил загрузку (503)',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Повторить',exact:true}).click();
 await page.getByRole('button',{name:'Отправить на проверку',exact:true}).waitFor();
 await page.getByText('Хранилище временно недоступно. Попробуйте ещё раз.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Обновить работу',exact:true}).click();
 await page.getByRole('button',{name:'Следующая страница',exact:true}).click();
 await page.getByText('2 / 3',{exact:true}).waitFor();
 await page.locator('canvas[data-rendered-page="2"]').waitFor();
 await page.getByText('Открываем страницу…',{exact:true}).waitFor({state:'hidden'});
 assert.equal(await page.getByText(/Не удалось отобразить страницу/).count(),0);
 await page.screenshot({path:output+'/mobile-draft-pdf.png'});
 assert.equal(uploadCount,2,'retry transfers the local File again');
 assert.equal(requests.some(r=>r.p.includes('local-')),false,'local identifiers never reach job API');
 await page.getByRole('button',{name:'Удалить черновик',exact:true}).click();
 await page.getByRole('button',{name:'Оставить',exact:true}).click();
 await page.getByRole('button',{name:'Удалить черновик',exact:true}).click();
 await page.getByRole('button',{name:'Удалить',exact:true}).click();
 await page.getByRole('heading',{name:'Добавьте свою работу',exact:true}).waitFor();
 assert.equal(await page.locator('canvas').count(),0,'removed draft cannot remain in preview');
 await page.locator('input[type=file]').first().setInputFiles({name:'corrected.pdf',mimeType:'application/pdf',buffer:bytes});
 await page.getByRole('button',{name:'Отправить на проверку',exact:true}).waitFor();
 await page.getByRole('button',{name:'Отправить на проверку',exact:true}).click();
 await page.getByText('Работа отправлена на проверку',{exact:true}).waitFor();
 assert.equal(submits,1);assert.equal(await page.getByRole('button',{name:'Заменить PDF',exact:true}).count(),0);
 await page.getByRole('button',{name:'Все задания',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:/^На проверке/}).click();
 assert.equal(await page.getByRole('heading',{name:'Квадратные уравнения',exact:true}).count(),1);
 await page.getByRole('button',{name:/^Доработка/}).click();
 await page.getByRole('button',{name:'Исправить работу',exact:true}).click();
 await page.getByText('Проверьте решение третьей задачи и добавьте пояснение.',{exact:true}).last().waitFor();
 await page.getByText('Открываем страницу…',{exact:true}).waitFor({state:'hidden'});
 await page.screenshot({path:output+'/mobile-revision.png'});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('canvas[data-rendered-page="1"]').waitFor();
 await page.getByText('Открываем страницу…',{exact:true}).waitFor({state:'hidden'});
 await page.screenshot({path:output+'/desktop-revision.png',fullPage:true});
 await page.getByRole('button',{name:'Все задания',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:/^Все задания/}).click();
 await page.screenshot({path:output+'/desktop-list.png',fullPage:true});
 work={id:1,state:'uploading',has_file:false,has_draft:false};job={id:'22222222-2222-4222-8222-222222222222',homework_id:1,status:'uploading',stage:'uploading',progress:0};
 await page.reload();
 await page.getByRole('button',{name:'Открыть загрузки',exact:true}).waitFor();
 job={...job,status:'failed',stage:'failed',error_code:'upload_expired'};work={...work,state:'none'};
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByRole('button',{name:'Открыть загрузки',exact:true}).click();
 await page.getByText('Загрузка прервалась. Выберите файл заново.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Выбрать другой',exact:true}).click();
 await page.getByRole('heading',{name:'Добавьте свою работу',exact:true}).waitFor();
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 const report={result:'PASS',scenarios:['mobile list','empty workspace','failed upload','retry local File','PDF link retry','PDF paging','remove confirmation cancel','remove draft','upload replacement','submit once','locked after submit','list reflects submission','revision comment','desktop layout','reload interrupted upload','expired job recovery'],requests:requests.length,externalRequests:0,screenshots:output};
 await fs.writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
