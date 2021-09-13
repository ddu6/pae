import {writeFileSync} from 'fs'
import {join} from 'path'
import {JSDOM} from 'jsdom'
import {CLIT} from '@ddu6/cli-tools'
import {config, CourseInfo, saveConfig, saveSessions, Session, sessions} from './init'
const clit=new CLIT(__dirname,{
    requestTimeout:config.requestTimeout
})
const pclit=new CLIT(__dirname,config)
async function sleep(time:number){
    await new Promise(resolve=>{
        setTimeout(resolve,time*1000)
    })
}
async function get(url:string,params:Record<string,string>={},cookie='',referer='',requestTimeout?:number){
    const result=await clit.request(url,params,{},cookie,referer,undefined,requestTimeout)
    if(typeof result==='number'){
        throw new Error(`${result}, fail to get ${url}`)
    }
    return result
}
async function post(url:string,form:Record<string,string>={},cookie='',referer='',requestTimeout?:number){
    const result=await clit.request(url,{},form,cookie,referer,undefined,requestTimeout)
    if(typeof result==='number'){
        throw new Error(`${result}, fail to post ${url}`)
    }
    return result
}
async function ppost(url:string,form:Record<string,string>={},cookie='',referer='',requestTimeout?:number){
    const result=await pclit.request(url,{},form,cookie,referer,undefined,requestTimeout)
    if(typeof result==='number'){
        throw new Error(`${result}, fail to post ${url}`)
    }
    return result
}
const electAndDropURL='https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/SupplyCancel.do?xh='+config.studentId
const homepageURL='https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/HelpController.jpf'
async function getLoginCookie(studentId:string,password:string,appId:string,appName:string,redirectURL:string){
    let {cookie}=await get('https://iaaa.pku.edu.cn/iaaa/oauth.jsp',{
        appID:appId,
        appName:appName,
        redirectUrl:redirectURL
    })
    const {body}=await post('https://iaaa.pku.edu.cn/iaaa/oauthlogin.do',{
        appid:appId,
        userName:studentId,
        password:password,
        randCode:'',
        smsCode:'',
        otpCode:'',
        redirUrl:redirectURL
    },`remember=true; userName=${studentId}; ${cookie}`,'https://iaaa.pku.edu.cn/iaaa/oauth.jsp')
    const {token}=JSON.parse(body)
    if(typeof token!=='string'){
        throw new Error(`Fail to get login cookie of app ${appId}`)
    }
    const res=await get(redirectURL,{
        _rand:Math.random().toString(),
        token:token
    })
    let {status,headers}=res
    cookie=res.cookie
    if(status!==301){
        return cookie
    }
    const {location}=headers
    if(location===undefined){
        return cookie
    }
    cookie=`${(await get(location,{},cookie,redirectURL)).cookie}; ${cookie}`
    return cookie
}
async function getElectiveCookie(){
    for(let i=0;i<config.errLimit;i++){
        try{
            const cookie=await getLoginCookie(config.studentId,config.password,'syllabus','学生选课系统','http://elective.pku.edu.cn:80/elective2008/ssoLogin.do')
            await get(homepageURL,{},cookie)
            return cookie
        }catch(err){
            if(err instanceof Error){
                clit.log(err)
            }
        }
        await sleep(config.errSleep)
    }
    throw new Error('Fail to get elective cookie')
}
function htmlToCourseInfoArray(html:string){
    const dom=new JSDOM(html)
    let ele:Element|undefined
    let result=dom.window.document.body.querySelectorAll('table table>tbody')
    for(let i=0;i<result.length;i++){
        const val=result[i]
        const html=val.innerHTML
        if(html.includes('限数/已选')){
            ele=val
            break
        }
    }
    if(ele===undefined){
        return []
    }
    const courseInfoArray:CourseInfo[]=[]
    result=ele.querySelectorAll(':scope>tr')
    for(let i=0;i<result.length;i++){
        const children=result[i].children
        if(children.length<10){
            continue
        }
        let tmp=children[0].textContent
        if(tmp===null){
            continue
        }
        const title=tmp
        tmp=children[5].textContent
        if(tmp===null){
            continue
        }
        const number=Number(tmp)
        if(!isFinite(number)){
            continue
        }
        tmp=children[6].textContent
        if(tmp===null){
            continue
        }
        const department=tmp
        tmp=children[9].textContent
        if(tmp===null){
            continue
        }
        tmp=tmp.split('/')[0].trim()
        const limit=Number(tmp)
        if(!isFinite(number)){
            continue
        }
        const a=children[10].querySelector('a')
        if(a===null){
            continue
        }
        const href=new URL(a.href,electAndDropURL).href
        tmp=a.getAttribute('onclick')
        if(tmp===null){
            continue
        }
        tmp=tmp.replace(/.*?\(/,'').replace(/[);\\']/g,'')
        const array=tmp.split(',')
        if(array.length<9){
            continue
        }
        const index=Number(array[5])
        if(!isFinite(index)){
            continue
        }
        const seq=array[6]
        courseInfoArray.push({
            title:title,
            number:number,
            department:department,
            limit:limit,
            href:href,
            index:index,
            seq:seq
        })
    }
    return courseInfoArray
}
async function getCourseInfoArray(cookie:string){
    for(let i=0;i<config.errLimit;i++){
        try{
            const {body}=await get(electAndDropURL,{},cookie,homepageURL)
            if(body.includes('会话超时')||body.includes('超时操作')||body.includes('重新登录')){
                clit.out('Timeout')
                return 504
            }
            return htmlToCourseInfoArray(body)
        }catch(err){
            if(err instanceof Error){
                clit.log(err)
            }
        }
        await sleep(config.errSleep)
    }
    throw new Error('Fail to get course info array')
}
async function getElectedNum(index:number,seq:string,cookie:string){
    try{
        const {body}=await ppost('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/refreshLimit.do',{
            index:index.toString(),
            seq,
            xh:config.studentId
        },cookie,electAndDropURL,config.getElectedNumTimeout)
        if(body.includes('会话超时')||body.includes('超时操作')||body.includes('重新登录')){
            clit.out('Timeout')
            return 504
        }
        const result=JSON.parse(body).electedNum
        if(result==='NA'){
            return 503
        }
        if(result==='NB'){
            return 400
        }
        const data=Number(result)
        if(!isFinite(data)){
            return 500
        }
        return {
            data
        }
    }catch(err){
        if(err instanceof Error){
            clit.log(err)
        }
        return 500
    }
}
async function getVCodeImg(cookie:string){
    const {buffer,body}=await get(`https://elective.pku.edu.cn/elective2008/DrawServlet?Rand=${(Math.random()*10000)}`,{},cookie,electAndDropURL)
    if(body.includes('会话超时')||body.includes('超时操作')||body.includes('重新登录')){
        clit.out('Timeout')
        return 504
    }
    writeFileSync(join(__dirname,`../info/vcode-imgs/${CLIT.getDate()} ${CLIT.getTime()}.gif`),buffer)
    return buffer.toString('base64')
}
async function recognizeVCodeImg(base64Img:string){
    const {body}=await post('https://api.ttshitu.com/base64',{
        username:config.ttshitu.username,
        password:config.ttshitu.password,
        typeid:'4',
        image:base64Img
    },'','',config.recognizeTimeout)
    const {success,message,data}=JSON.parse(body)
    if(!success){
        if(typeof message==='string'){
            clit.out(message)
        }
        return 500
    }
    const {result}=data
    if(typeof result!=='string'){
        return 500
    }
    return result
}
async function verifyVCode(vcode:string,cookie:string){
    const {body}=await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/validate.do',{
        xh:config.studentId,
        validCode:vcode
    },cookie,electAndDropURL)
    const result=Number(JSON.parse(body).valid)
    if(result===2){
        return 200
    }
    if(result===1){
        return 401
    }
    return 403
}
async function verifySession(cookie:string){
    for(let i=0;i<config.errLimit;i++){
        try{
            const img=await getVCodeImg(cookie)
            if(img===504){
                return 504
            }
            const result=await recognizeVCodeImg(img)
            if(result===500){
                clit.out(`Fail to recognize vcode img`)
                await sleep(config.errSleep)
                continue
            }
            clit.out(`Recognized as ${result}`)
            if(await verifyVCode(result,cookie)===200){
                clit.out('Verified')
                return 200
            }
        }catch(err){
            if(err instanceof Error){
                clit.log(err)
            }
        }
        await sleep(config.errSleep)
    }
    throw new Error('Fail to verify session')
}
async function electCourse(href:string,cookie:string){
    try{
        const {body}=await get(href,{},cookie,electAndDropURL)
        writeFileSync(join(__dirname,`../info/election-results/${CLIT.getDate()} ${CLIT.getTime()}.html`),body)
        if(body.includes('会话超时')||body.includes('超时操作')||body.includes('重新登录')){
            clit.out('Timeout')
            return 504
        }
        const dom=new JSDOM(body)
        const ele=dom.window.document.body.querySelector('#msgTips')
        if(ele===null){
            return 500
        }
        let msg=ele.textContent
        if(msg===null){
            return 500
        }
        msg=msg.trim()
        clit.out(msg)
        if(
            msg.includes('您已经选过该课程了')
            ||msg.includes('上课时间冲突')
            ||msg.includes('考试时间冲突')
            ||msg.includes('在补退选阶段开始后的约一周开放选课')
            ||msg.includes('总学分已经超过规定学分上限')
            ||msg.includes('只能选')
            ||msg.includes('只能修')
            ||msg.includes('选课人数已满')
        ){
            return 409
        }
        if(msg.includes('成功')){
            return 200
        }
    }catch(err){
        if(err instanceof Error){
            clit.log(err)
        }
    }
    return 500
}
interface CourseDesc{
    title:string
    number?:number
    department?:string
}
function getCourseInfo(session:Session,{title,number,department}:CourseDesc){
    for(const courseInfo of session.courseInfoArray){
        if(
            courseInfo.title.includes(title)
            &&(number===undefined||courseInfo.number===number)
            &&(department===undefined||courseInfo.department.includes(department))
        ){
            return courseInfo
        }
    }
    return undefined
}
async function createSession():Promise<Session>{
    for(let i=0;i<config.errLimit;i++){
        const cookie=await getElectiveCookie()
        const courseInfoArray=await getCourseInfoArray(cookie)
        if(courseInfoArray!==504){
            clit.out('New session')
            return {
                cookie,
                start:Date.now()/1000,
                courseInfoArray,
            }
        }
        await sleep(config.errSleep)
    }
    throw new Error('Fail to create session')
}
async function updateSession(session:Session){
    const result=await getCourseInfoArray(session.cookie)
    if(result===504){
        return 504
    }
    session.courseInfoArray=result
    saveSessions()
    if(session===sessions.main){
        if(await verifySession(session.cookie)===504){
            return 504
        }
    }
    return 200
}
async function renewSession(session:Session){
    for(let i=0;i<config.errLimit;i++){
        Object.assign(session,await createSession())
        saveSessions()
        if(session!==sessions.main){
            return
        }
        if(await verifySession(session.cookie)!==504){
            return
        }
        await sleep(config.errSleep)
    }
    throw new Error('Fail to renew session')
}
let sessionIndex=-1
async function getSession(){
    sessionIndex=(sessionIndex+1)%(sessions.others.length+1)
    let session:Session
    if(sessionIndex===0){
        session=sessions.main
    }else{
        session=sessions.others[sessionIndex-1]
    }
    if(Date.now()/1000-config.sessionDuration+Math.random()*300>session.start){
        await renewSession(session)
    }
    return session
}
export async function main(){
    const batchSize=Math.ceil(config.proxyDelay/config.refreshInterval)
    const sessionNum=Math.max(Math.ceil(3/config.refreshInterval),batchSize*2)*config.courses.length
    if(Date.now()/1000-config.sessionDuration+Math.random()*300>sessions.main.start){
        await renewSession(sessions.main)
    }
    sessions.others=sessions.others.filter(
        val=>Date.now()/1000-config.sessionDuration+Math.random()*300<=val.start
    ).slice(0,sessionNum-1)
    for(let i=0;i<sessionNum-1-sessions.others.length;i++){
        sessions.others.push(await createSession())
        saveSessions()
    }
    let lastPromises:Promise<CourseDesc|undefined>[]=[]
    let electing=false
    while(true){
        const promises:Promise<CourseDesc|undefined>[]=[]
        for(let i=0;i<batchSize;i++){
            for(let i=0;i<config.courses.length;i++){
                const session=await getSession()
                const courseDesc=config.courses[i]
                const courseInfo0=getCourseInfo(session,courseDesc)
                const courseInfo1=getCourseInfo(sessions.main,courseDesc)
                if(courseInfo0===undefined||courseInfo1===undefined){
                    config.courses.splice(i,1)
                    saveConfig()
                    i--
                    continue
                }
                promises.push((async ()=>{
                    if(electing){
                        return
                    }
                    const result0=await getElectedNum(courseInfo0.index,courseInfo0.seq,session.cookie)
                    if(result0===503){
                        clit.out('Too frequent')
                        await sleep(config.congestionSleep)
                        return
                    }
                    if(result0===504){
                        await renewSession(session)
                        return
                    }
                    if(result0===400){
                        if(await updateSession(session)===504){
                            await renewSession(session)
                        }
                        return
                    }
                    if(result0===500){
                        clit.out(`Fail to get elected num`)
                        return
                    }
                    const {data}=result0
                    if(data>=courseInfo0.limit){
                        clit.out(`No places avaliable for ${courseInfo0.title}`)
                        return
                    }
                    if(electing){
                        return
                    }
                    electing=true
                    const result1=await electCourse(courseInfo1.href,sessions.main.cookie)
                    if(result1===504){
                        clit.out(`Fail to elect ${courseInfo1.title}`)
                        await renewSession(sessions.main)
                        electing=false
                        return
                    }
                    if(result1===500){
                        clit.out(`Fail to elect ${courseInfo1.title}`)
                        if(await verifySession(sessions.main.cookie)===504){
                            await renewSession(sessions.main)
                            electing=false
                            return
                        }
                        const result=await electCourse(courseInfo1.href,sessions.main.cookie)
                        if(result===500||result===504){
                            clit.out(`Fail to elect ${courseInfo1.title}`)
                            await renewSession(sessions.main)
                            electing=false
                            return
                        }
                    }
                    return courseDesc
                })())
            }
            await sleep(config.refreshInterval)
        }
        const result=await Promise.all(lastPromises)
        lastPromises=promises
        if(result.find(val=>val!==undefined)!==undefined){
            config.courses=config.courses.filter(val=>!result.includes(val))
            saveConfig()
            if(await updateSession(sessions.main)===504){
                await renewSession(sessions.main)
            }
            for(const session of sessions.others){
                if(await updateSession(session)===504){
                    await renewSession(session)
                }
            }
            electing=false
        }
        if(config.courses.length===0){
            clit.out('Finished')
            return
        }
    }
}