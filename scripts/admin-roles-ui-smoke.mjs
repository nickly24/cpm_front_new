/* Local UI smoke with synthetic API responses. All non-local requests are blocked.
 * PLAYWRIGHT_MODULE=/path/to/playwright node scripts/admin-roles-ui-smoke.mjs
 * Frontend must run on 3007 with both NEXT_PUBLIC_* API URLs set to http://127.0.0.1:5099.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sections = Object.entries({ dashboard:'Главная', users:'Пользователи', schools:'Школы', upload:'Загрузка', schedule:'Расписание', 'telegram-bot':'Telegram-бот', assignments:'Домашние задания', 'review-queue':'Очередь работ', 'homework-archive':'Архив работ', monitoring:'Мониторинг', tests:'Тесты', 'test-results':'Результаты', exams:'Экзамены', attendance:'Посещаемость', scan:'Сканирование', zaps:'Запросы на отгул', train:'Карточки', ratings:'Рейтинг' }).map(([id,label])=>({id,label}));
const output = process.env.SMOKE_OUTPUT || '/tmp/cpm-admin-roles-ui';
fs.mkdirSync(output, {recursive:true});
(async()=>{
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
 const context = await browser.newContext({viewport:{width:1440,height:1050}, serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('auth_token','offline-synthetic-token'));
 let user={role:'admin',id:1,full_name:'Главный администратор'};
 let access={status:true,sections,roles:[],users:[]};
 const requests=[],unexpected=[],errors=[];
 const draft={id:'offline-draft',title:'Контрольный черновик',direction:'Математика',canvas:{questions:[{id:'q1',text:'Сколько будет 2 + 2?',points:1,type:'single',answers:[{id:'a1',text:'4',isCorrect:true}]}],layout:{}},status:'active'};
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin==='http://localhost:3007')return route.continue();
   if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com') return route.fulfill({status:200,contentType:'text/css',body:''});
   if(url.origin!=='http://127.0.0.1:5099'){unexpected.push(req.url());return route.abort();}
   const p=url.pathname,m=req.method();requests.push({p,m});
   const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://localhost:3007','Access-Control-Allow-Credentials':'true'},body:JSON.stringify(data)});
   if(p==='/api/aun')return user?reply({status:true,...user,entity_id:user.id}):reply({status:false},401);
   if(p==='/api/admin-access'&&m==='GET')return reply(access);
   if(p==='/api/admin-access/roles'&&m==='POST') {const data=req.postDataJSON();access.roles.push({...data,id:1,users_count:0});return reply({status:true,id:1},201)}
   if(p==='/api/admin-access/users'&&m==='POST') {const data=req.postDataJSON();access.users.push({...data,id:1,role_name:access.roles[0].name});access.roles[0].users_count++;return reply({status:true,id:1,credentials:{login:data.login,password:'Offline-demo-password'}},201)}
   if(p==='/directions')return reply([{id:1,name:'Математика'}]);
   if(p.startsWith('/tests/'))return reply([]);
   if(p==='/test-drafts')return reply([draft]);
   if(p==='/api/get-students'||p==='/api/get-groups')return reply({status:true,res:[]});
   unexpected.push(m+' '+p);return reply({error:'Unmocked request'},500);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3007/cabinet/admin/access');
 await page.getByRole('button',{name:'+ Создать роль',exact:true}).click();
 await page.getByLabel('Название роли').fill('Редактор тестов');
 assert.equal(await page.getByRole('checkbox').count(),36);
 const view=page.getByRole('checkbox',{name:'Тесты: просмотр',exact:true}),edit=page.getByRole('checkbox',{name:'Тесты: редактирование',exact:true});
 await edit.check();assert.equal(await view.isChecked(),true);
 await view.uncheck();assert.equal(await edit.isChecked(),false);
 await view.check();
 await page.screenshot({path:output+'/role-matrix.png',fullPage:true});
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.getByRole('heading',{name:'Редактор тестов',exact:true}).waitFor();
 await page.getByRole('button',{name:/^Пользователи/}).click();
 await page.getByRole('button',{name:'+ Добавить пользователя',exact:true}).click();
 await page.getByLabel('ФИО',{exact:true}).fill('Тестовый сотрудник');
 await page.getByLabel('Логин',{exact:true}).fill('offline_editor');
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.getByText('Offline-demo-password',{exact:true}).waitFor();
 assert.equal(access.users[0].role_id,1);
 await page.screenshot({path:output+'/access-users.png',fullPage:true});
 user={role:'staff_admin',id:7,full_name:'Тестовый сотрудник',role_name:'Просмотр тестов',permissions:{tests:{view:true,edit:false}}};
 await page.goto('http://localhost:3007/cabinet/staff_admin/dashboard');
 await page.waitForURL('**/cabinet/staff_admin/tests');
 await page.getByText('Режим просмотра',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Создать',exact:true}).count(),0);
 assert.equal(await page.getByRole('link',{name:'Доступ и роли',exact:true}).count(),0);
 assert.equal(await page.getByRole('link',{name:'Пользователи',exact:true}).count(),0);
 await page.getByRole('button',{name:/^Драфты/}).click();
 await page.getByRole('button',{name:/Контрольный черновик/}).click();
 await page.getByRole('heading',{name:'Контрольный черновик'}).waitFor();
 assert.equal(requests.filter(r=>r.p.startsWith('/test-drafts')&&r.m!=='GET').length,0);
 await page.screenshot({path:output+'/view-only-draft.png',fullPage:true});
 await page.goto('http://localhost:3007/cabinet/staff_admin/users');
 await page.getByRole('heading',{name:'Раздел недоступен'}).waitFor();
 assert.equal(requests.filter(r=>r.p==='/api/get-students').length,0);
 user.permissions.tests.edit=true;
 await page.goto('http://localhost:3007/cabinet/staff_admin/tests');
 await page.getByRole('button',{name:'Создать',exact:true}).waitFor();
 user.permissions={};
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByRole('heading',{name:'Раздел недоступен'}).waitFor();
 user=null;
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForURL('**/login');
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',scenarios:9,apiRequests:requests.length,externalRequests:0,screenshots:output},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
