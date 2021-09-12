import {writeFileSync} from 'fs'
import {join} from 'path'
import {JSDOM} from 'jsdom'
import {CLIT} from '@ddu6/cli-tools'
import {config} from './init'
const clit=new CLIT(__dirname,config)
interface CourseInfo{
    title:string
    number:number
    department:string
    limit:number
    href:string
    index:number
    seq:string
}
interface CourseDesc{
    title:string
    number?:number
    department?:string
}
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
const electAndDropURL='https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/SupplyCancel.do'
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
async function getElectiveCookie(studentId:string,password:string){
    for(let i=0;i<config.errLimit;i++){
        try{
            const cookie=await getLoginCookie(studentId,password,'syllabus','学生选课系统','http://elective.pku.edu.cn:80/elective2008/ssoLogin.do')
            await get(homepageURL,{},cookie)
            return cookie
        }catch(err){
            if(err instanceof Error){
                clit.log(err)
            }
        }
        await sleep(config.smallErrSleep)
    }
    throw new Error('Fail to get elective cookie')
}
function htmlToCourseInfos(html:string){
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
    const courseInfos:CourseInfo[]=[]
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
        courseInfos.push({
            title:title,
            number:number,
            department:department,
            limit:limit,
            href:href,
            index:index,
            seq:seq
        })
    }
    return courseInfos
}
async function getAllCourseInfos(cookie:string){
    for(let i=0;i<config.errLimit;i++){
        try{
            const {body}=await get(electAndDropURL,{xh:config.studentId},cookie,homepageURL)
            return htmlToCourseInfos(body)
        }catch(err){
            if(err instanceof Error){
                clit.log(err)
            }
        }
        await sleep(config.smallErrSleep)
    }
    throw new Error('Fail to get all course infos')
}
async function getElectedNum(index:number,seq:string,studentId:string,cookie:string){
    try{
        const {body}=await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/refreshLimit.do',{
            index:index.toString(),
            seq:seq,
            xh:studentId
        },cookie,electAndDropURL,config.getElectedNumTimeout)
        let tmp
        try{
            tmp=JSON.parse(body).electedNum
        }catch(err){
            if(err instanceof Error){
                clit.log(err)
            }
            clit.log(`Fail to parse ${body}`)
            if(body.includes('会话超时')||body.includes('超时操作')||body.includes('重新登录')){
                return 400
            }
            return 500
        }
        if(tmp==='NA'){
            return 503
        }
        if(tmp==='NB'){
            return 500
        }
        const electedNum=Number(tmp)
        if(!isFinite(electedNum)){
            return 500
        }
        return {
            electedNum:electedNum
        }
    }catch(err){
        if(err instanceof Error){
            clit.log(err)
        }
        return 500
    }
}
async function getVCodeImg(cookie:string){
    const {buffer}=await get(`https://elective.pku.edu.cn/elective2008/DrawServlet?Rand=${(Math.random()*10000)}`,{},cookie,electAndDropURL)
    writeFileSync(join(__dirname,`../info/vcode-imgs/${CLIT.getDate()} ${CLIT.getTime()}.gif`),buffer)
    return buffer.toString('base64')
}
async function recognizeVCodeImg(base64Img:string,tusername:string,tpassword:string){
    const {body}=await post('https://api.ttshitu.com/base64',{
        username:tusername,
        password:tpassword,
        typeid:'4',
        image:base64Img
    })
    const {success,message,data}=JSON.parse(body)
    if(!success){
        if(typeof message==='string'){
            return message
        }
        return 500
    }
    const {result}=data
    if(typeof result!=='string'){
        return 500
    }
    return {vcode:result}
}
async function verifyVCode(vcode:string,studentId:string,cookie:string){
    const {body}=await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/validate.do',{
        xh:studentId,
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
async function verifySession(studentId:string,tusername:string,tpassowrd:string,cookie:string){
    for(let i=0;i<config.errLimit;i++){
        try{
            const img=await getVCodeImg(cookie)
            let result=await recognizeVCodeImg(img,tusername,tpassowrd)
            if(typeof result!=='object'){
                clit.out(`${result}, fail to recognize vcode img`)
                await sleep(config.smallErrSleep)
                continue
            }
            const {vcode}=result
            clit.out(`Recognized as ${vcode}`)
            result=await verifyVCode(vcode,studentId,cookie)
            if(result===200){
                return
            }
        }catch(err){
            if(err instanceof Error){
                clit.log(err)
            }
        }
        await sleep(config.smallErrSleep)
    }
    throw new Error('Fail to verify main session')
}
async function electCourse(href:string,cookie:string){
    try{
        const {body}=await get(href,{},cookie,electAndDropURL)
        writeFileSync(join(__dirname,`../info/election-results/${CLIT.getDate()} ${CLIT.getTime()}.html`),body)
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
        if(msg.includes('成功')){
            return 200
        }
        return 500
    }catch(err){
        if(err instanceof Error){
            clit.log(err)
        }
    }
}
async function getCourseInfos(courseDescs:CourseDesc[],cookie:string){
    const allCourseInfos=await getAllCourseInfos(cookie)
    const courseInfos:CourseInfo[]=[]
    for(let i=0;i<allCourseInfos.length;i++){
        const courseInfo=allCourseInfos[i]
        const {title,number,department}=courseInfo
        for(let i=0;i<courseDescs.length;i++){
            const {title:dtitle,number:dnumber,department:ddepartment}=courseDescs[i]
            if(!title.includes(dtitle)){
                continue
            }
            if(dnumber!==undefined&&number!==dnumber){
                continue
            }
            if(ddepartment!==undefined&&!department.includes(ddepartment)){
                continue
            }
            courseInfos.push(courseInfo)
            break
        }
    }
    return courseInfos
}
export async function main(){
    first:while(true){
        const {studentId,password,refreshInterval,ttshitu:{username:tusername,password:tpassword},courses}=config
        let mainCookie=await getElectiveCookie(studentId,password)
        let mainCourseInfos=await getCourseInfos(courses,mainCookie)
        if(mainCourseInfos.length===0){
            clit.out('Finished')
            return
        }
        clit.out('Courses to elect:\n'+mainCourseInfos.map(val=>val.title+' '+val.number+' '+val.department).join('\n'))
        const cookiePool=[{
            cookie:mainCookie,
            startTime:Date.now()/1000,
        }]
        const courseInfoss=[mainCourseInfos]
        clit.out('Main session started')
        const cookiePoolSize=Math.ceil(3/refreshInterval)
        for(let j=1;j<cookiePoolSize;j++){
            await sleep(config.smallErrSleep)
            const cookie=await getElectiveCookie(studentId,password)
            cookiePool.push({
                cookie:cookie,
                startTime:Date.now()/1000,
            })
            const courseInfos=await getCourseInfos(courses,cookie)
            if(courseInfos.length!==mainCourseInfos.length){
                clit.out(`Please do not operate on elective by yourself unless all sessions are started`)
                continue first
            }
            courseInfoss.push(courseInfos)
            clit.out(`Session ${j} started`)
        }
        clit.out('All sessions started')
        await verifySession(studentId,tusername,tpassword,mainCookie)
        clit.out('Main session verified')
        let i=-1
        let j=-1
        while(true){
            await sleep(refreshInterval)
            j=(j+1)%cookiePool.length
            i=(i+1)%mainCourseInfos.length
            const courseInfos=courseInfoss[j]
            const {cookie,startTime}=cookiePool[j]
            const {index,seq,limit,title,number,department}=courseInfos[i]
            normal:{
                if(Date.now()/1000-config.sessionDuration+Math.random()*300>startTime){
                    clit.out(`Session ${j} retired`)
                    break normal
                }
                const getResult=await getElectedNum(index,seq,studentId,cookie)
                if(getResult===503){
                    clit.out('Too frequent, fail to get elected num')
                    await sleep(config.congestionSleep)
                    continue
                }else if(getResult===400){
                    clit.out(`Session ${j} expired`)
                    break normal
                }else if(typeof getResult==='number'){
                    clit.out(`${getResult}, fail to get elected num`)
                    await sleep(config.bigErrSleep)
                    continue
                }
                const {electedNum}=getResult
                if(electedNum>=limit){
                    clit.out(`No places avaliable for ${title} ${number} of ${department}`)
                    continue
                }
                const {href}=mainCourseInfos[i]
                const electResult=await electCourse(href,mainCookie)
                if(electResult!==200){
                    clit.out(`Fail to elect ${title} ${number} of ${department}`)
                    await verifySession(studentId,tusername,tpassword,mainCookie)
                    clit.out('Main session verified')
                    const electResult=await electCourse(href,mainCookie)
                    if(electResult!==200){
                        clit.out(`Fail to elect ${title} ${number} of ${department}`)
                        continue
                    }
                }
                if(mainCourseInfos.length===1){
                    clit.out('Finished')
                    return
                }
                continue first
            }
            renew:{
                const cookie=await getElectiveCookie(studentId,password)
                cookiePool[j]={
                    cookie:cookie,
                    startTime:Date.now()/1000,
                }
                const courseInfos=await getCourseInfos(courses,cookie)
                if(courseInfos.length!==mainCourseInfos.length){
                    clit.out(`Courses to elect are changed`)
                    continue first
                }
                courseInfoss[j]=courseInfos
                if(j!==0){
                    clit.out(`Session ${j} renewed`)
                }else{
                    mainCookie=cookie
                    mainCourseInfos=courseInfos
                    clit.out(`Main session renewed`)
                    await verifySession(studentId,tusername,tpassword,mainCookie)
                    clit.out('Main session verified')
                }
            }
        }
    }
}