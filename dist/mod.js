"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const jsdom_1 = require("jsdom");
function getDate() {
    const date = new Date();
    return [date.getMonth() + 1, date.getDate()].map(val => val.toString().padStart(2, '0')).join('-') + ' ' + [date.getHours(), date.getMinutes(), date.getSeconds()].map(val => val.toString().padStart(2, '0')).join(':') + ':' + date.getMilliseconds().toString().padStart(3, '0');
}
function semilog(msg) {
    let string = getDate() + ' ';
    if (typeof msg !== 'string') {
        const { stack } = msg;
        if (stack !== undefined) {
            string += stack;
        }
        else {
            string += msg.message;
        }
    }
    else {
        string += msg;
    }
    string = string.replace(/\n */g, '\n                   ');
    fs.appendFileSync(path.join(__dirname, '../info/semilog.txt'), string + '\n\n');
    return string;
}
function log(msg) {
    const string = semilog(msg);
    console.log(string + '\n');
}
async function sleep(time) {
    await new Promise(resolve => {
        setTimeout(resolve, time * 1000);
    });
}
async function basicallyGet(url, params = {}, cookie = '', referer = '') {
    let paramsStr = new URL(url).searchParams.toString();
    if (paramsStr.length > 0)
        paramsStr += '&';
    paramsStr += new URLSearchParams(params).toString();
    if (paramsStr.length > 0)
        paramsStr = '?' + paramsStr;
    url = new URL(paramsStr, url).href;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36'
    };
    if (cookie.length > 0)
        headers.Cookie = cookie;
    if (referer.length > 0)
        headers.Referer = referer;
    const result = await new Promise((resolve) => {
        const httpsOrHTTP = url.startsWith('https://') ? https : http;
        httpsOrHTTP.get(url, {
            headers: headers
        }, async (res) => {
            const { statusCode } = res;
            if (statusCode === undefined) {
                resolve(500);
                return;
            }
            if (statusCode >= 400) {
                resolve(statusCode);
                return;
            }
            let cookie;
            const cookie0 = res.headers["set-cookie"];
            if (cookie0 === undefined) {
                cookie = '';
            }
            else {
                cookie = cookie0.map(val => val.split(';')[0]).join('; ');
            }
            let body = '';
            const buffers = [];
            res.on('data', chunk => {
                if (typeof chunk === 'string') {
                    body += chunk;
                }
                else if (chunk instanceof Buffer) {
                    body += chunk;
                    buffers.push(chunk);
                }
            });
            res.on('end', () => {
                resolve({
                    body: body,
                    buffer: Buffer.concat(buffers),
                    cookie: cookie,
                    headers: res.headers,
                    status: statusCode
                });
            });
            res.on('error', err => {
                semilog(err);
                resolve(500);
            });
        }).on('error', err => {
            semilog(err);
            resolve(500);
        });
    });
    return result;
}
async function basicallyPost(url, params = {}, cookie = '', referer = '') {
    const paramsStr = new URLSearchParams(params).toString();
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    if (cookie.length > 0)
        headers.Cookie = cookie;
    if (referer.length > 0)
        headers.Referer = referer;
    const result = await new Promise((resolve) => {
        const httpsOrHTTP = url.startsWith('https://') ? https : http;
        const req = httpsOrHTTP.request(url, {
            method: 'POST',
            headers: headers
        }, async (res) => {
            const { statusCode } = res;
            if (statusCode === undefined) {
                resolve(500);
                return;
            }
            if (statusCode >= 400) {
                resolve(statusCode);
                return;
            }
            let cookie;
            const cookie0 = res.headers["set-cookie"];
            if (cookie0 === undefined) {
                cookie = '';
            }
            else {
                cookie = cookie0.map(val => val.split(';')[0]).join('; ');
            }
            let body = '';
            const buffers = [];
            res.on('data', chunk => {
                if (typeof chunk === 'string') {
                    body += chunk;
                }
                else if (chunk instanceof Buffer) {
                    body += chunk;
                    buffers.push(chunk);
                }
            });
            res.on('end', () => {
                resolve({
                    body: body,
                    buffer: Buffer.concat(buffers),
                    cookie: cookie,
                    headers: res.headers,
                    status: statusCode
                });
            });
            res.on('error', err => {
                semilog(err);
                resolve(500);
            });
        }).on('error', err => {
            semilog(err);
            resolve(500);
        });
        req.write(paramsStr);
        req.end();
    });
    return result;
}
async function get(url, params = {}, cookie = '', referer = '') {
    const result = await basicallyGet(url, params, cookie, referer);
    if (typeof result === 'number')
        throw new Error(`${result}. Fail to get ${url}.`);
    return result;
}
async function post(url, params = {}, cookie = '', referer = '') {
    const result = await basicallyPost(url, params, cookie, referer);
    if (typeof result === 'number')
        throw new Error(`${result}. Fail to post ${url}.`);
    return result;
}
const electAndDropURL = 'https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/SupplyCancel.do';
const homepageURL = 'https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/HelpController.jpf';
const recognizeErrLimit = 10;
const sessionTimeLimit = 3600;
async function getLoginCookie(studentId, password, appId, appName, redirectURL) {
    let { cookie } = await get('https://iaaa.pku.edu.cn/iaaa/oauth.jsp', {
        appID: appId,
        appName: appName,
        redirectUrl: redirectURL
    });
    const { body } = await post('https://iaaa.pku.edu.cn/iaaa/oauthlogin.do', {
        appid: appId,
        userName: studentId,
        password: password,
        randCode: '',
        smsCode: '',
        otpCode: '',
        redirUrl: redirectURL
    }, `remember=true; userName=${studentId}; ${cookie}`, 'https://iaaa.pku.edu.cn/iaaa/oauth.jsp');
    const { token } = JSON.parse(body);
    if (typeof token !== 'string')
        throw new Error(`Fail to get login cookie of app ${appId}.`);
    const res = await get(redirectURL, {
        _rand: Math.random().toString(),
        token: token
    });
    let { status, headers } = res;
    cookie = res.cookie;
    if (status !== 301)
        return cookie;
    const { location } = headers;
    if (location === undefined)
        return cookie;
    cookie = (await get(location)).cookie;
    return cookie;
}
async function getElectiveCookie(studentId, password) {
    const cookie = await getLoginCookie(studentId, password, 'syllabus', '学生选课系统', 'http://elective.pku.edu.cn:80/elective2008/ssoLogin.do');
    await get(homepageURL, {}, cookie);
    return cookie;
}
function htmlToCourseInfos(html) {
    const dom = new jsdom_1.JSDOM(html);
    let ele;
    let result = dom.window.document.body.querySelectorAll('table table>tbody');
    for (let i = 0; i < result.length; i++) {
        const val = result[i];
        const html = val.innerHTML;
        if (html.includes('限数/已选')) {
            ele = val;
            break;
        }
    }
    if (ele === undefined)
        return [];
    const courseInfos = [];
    result = ele.querySelectorAll(':scope>tr');
    for (let i = 0; i < result.length; i++) {
        const children = result[i].children;
        if (children.length < 10)
            continue;
        let tmp = children[0].textContent;
        if (tmp === null)
            continue;
        const title = tmp;
        tmp = children[5].textContent;
        if (tmp === null)
            continue;
        const number = Number(tmp);
        if (isNaN(number))
            continue;
        tmp = children[6].textContent;
        if (tmp === null)
            continue;
        const department = tmp;
        tmp = children[9].textContent;
        if (tmp === null)
            continue;
        tmp = tmp.split('/')[0].trim();
        const limit = Number(tmp);
        if (isNaN(number))
            continue;
        const a = children[10].querySelector('a');
        if (a === null)
            continue;
        const href = new URL(a.href, electAndDropURL).href;
        tmp = a.getAttribute('onclick');
        if (tmp === null)
            continue;
        tmp = tmp.replace(/.*?\(/, '').replace(/[);\\']/g, '');
        const array = tmp.split(',');
        if (array.length < 9)
            continue;
        const index = Number(array[5]);
        if (isNaN(index))
            continue;
        const seq = array[6];
        courseInfos.push({
            title: title,
            number: number,
            department: department,
            limit: limit,
            href: href,
            index: index,
            seq: seq
        });
    }
    return courseInfos;
}
async function getAllCourseInfos(cookie) {
    const { body } = await get(electAndDropURL, {}, cookie, homepageURL);
    return htmlToCourseInfos(body);
}
async function getElectedNum(index, seq, studentId, cookie) {
    const { body } = await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/refreshLimit.do', {
        index: index.toString(),
        seq: seq,
        xh: studentId
    }, cookie, electAndDropURL);
    try {
        const tmp = JSON.parse(body).electedNum;
        if (tmp === 'NA')
            return 503;
        if (tmp === 'NB')
            return 500;
        const electedNum = Number(tmp);
        if (isNaN(electedNum))
            return 500;
        return {
            electedNum: electedNum
        };
    }
    catch (err) {
        semilog(err);
        semilog(`Fail to parse ${body}.`);
        if (body.includes('会话超时') || body.includes('超时操作') || body.includes('重新登录'))
            return 400;
        return 500;
    }
}
async function getVCodeImg(cookie) {
    const { buffer } = await get(`https://elective.pku.edu.cn/elective2008/DrawServlet?Rand=${(Math.random() * 10000)}`, {}, cookie, electAndDropURL);
    fs.writeFileSync(path.join(__dirname, `../info/vcode-imgs/${getDate()}.gif`), buffer);
    return buffer.toString('base64');
}
async function recognizeVCodeImg(base64Img, tusername, tpassword) {
    const { body } = await post('https://api.ttshitu.com/base64', {
        username: tusername,
        password: tpassword,
        typeid: '4',
        image: base64Img
    });
    const { success, message, data } = JSON.parse(body);
    if (!success) {
        if (typeof message === 'string')
            return message;
        return 500;
    }
    const { result } = data;
    if (typeof result !== 'string')
        return 500;
    return { vcode: result };
}
async function verifyVCode(vcode, studentId, cookie) {
    const { body } = await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/validate.do', {
        xh: studentId,
        validCode: vcode
    }, cookie, electAndDropURL);
    const result = Number(JSON.parse(body).valid);
    if (result === 2)
        return 200;
    if (result === 1)
        return 401;
    return 403;
}
async function verifyCookie(studentId, tusername, tpassowrd, cookie) {
    for (let i = 0; i < recognizeErrLimit; i++) {
        const img = await getVCodeImg(cookie);
        let result = await recognizeVCodeImg(img, tusername, tpassowrd);
        if (typeof result !== 'object')
            return result;
        const { vcode } = result;
        log(`Recognized as ${vcode}.`);
        result = await verifyVCode(vcode, studentId, cookie);
        if (result === 200)
            return 200;
        await sleep(1);
    }
    return 500;
}
async function electCourse(href, cookie) {
    const { body } = await get(href, {}, cookie, electAndDropURL);
    fs.writeFileSync(path.join(__dirname, `../info/election-results/${getDate()}.html`), body);
    const dom = new jsdom_1.JSDOM(body);
    const ele = dom.window.document.body.querySelector('#msgTips');
    if (ele === null)
        return 500;
    let msg = ele.textContent;
    if (msg === null)
        return 500;
    msg = msg.trim();
    log(msg);
    if (msg.includes('成功'))
        return 200;
    return 500;
}
function getConfig() {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), { encoding: 'utf8' }));
    return config;
}
async function getCourseInfos(courseDescs, cookie) {
    const allCourseInfos = await getAllCourseInfos(cookie);
    const courseInfos = [];
    for (let i = 0; i < allCourseInfos.length; i++) {
        const courseInfo = allCourseInfos[i];
        const { title, number, department } = courseInfo;
        for (let i = 0; i < courseDescs.length; i++) {
            const { title: dtitle, number: dnumber, department: ddepartment } = courseDescs[i];
            if (!title.includes(dtitle))
                continue;
            if (dnumber !== undefined && number !== dnumber)
                continue;
            if (ddepartment !== undefined && !department.includes(ddepartment))
                continue;
            courseInfos.push(courseInfo);
            break;
        }
    }
    return courseInfos;
}
async function main() {
    while (true) {
        const { studentId, password, refreshInterval, ttshitu: { username: tusername, password: tpassword }, courses } = getConfig();
        const mainCookie = await getElectiveCookie(studentId, password);
        const mainCourseInfos = await getCourseInfos(courses, mainCookie);
        if (mainCourseInfos.length === 0) {
            log('Finished.');
            return;
        }
        log('Courses to elect:\n' + mainCourseInfos.map(val => val.title + ' ' + val.number + ' ' + val.department).join('\n'));
        const cookiePool = [mainCookie];
        const courseInfoss = [mainCourseInfos];
        log('Main cookie added.');
        const cookiePoolSize = Math.ceil(3 / refreshInterval);
        for (let j = 1; j < cookiePoolSize; j++) {
            await sleep(1);
            const cookie = await getElectiveCookie(studentId, password);
            cookiePool.push(cookie);
            const courseInfos = await getCourseInfos(courses, cookie);
            if (courseInfos.length !== mainCourseInfos.length) {
                log(`Please do not operate on elective by yourself unless all cookies are added.`);
                return;
            }
            courseInfoss.push(courseInfos);
            log(`Cookie ${j} added.`);
        }
        log('All cookies added.');
        const verifyResult = await verifyCookie(studentId, tusername, tpassword, mainCookie);
        if (verifyResult !== 200) {
            log(`${verifyResult}. Fail to verify main cookie.`);
            return;
        }
        log('Main cookie verified.');
        const startTime = Date.now() / 1000;
        let i = -1;
        let j = -1;
        while (true) {
            await sleep(refreshInterval + Math.random());
            const time = Date.now() / 1000;
            if (time - startTime > sessionTimeLimit) {
                log('Session time limit reached.');
                break;
            }
            j = (j + 1) % cookiePool.length;
            i = (i + 1) % mainCourseInfos.length;
            const courseInfos = courseInfoss[j];
            const cookie = cookiePool[j];
            const { index, seq, limit, title, number, department } = courseInfos[i];
            const getResult = await getElectedNum(index, seq, studentId, cookie);
            if (getResult === 503) {
                log('Too frequent. Fail to get elected num.');
                await sleep(3);
                continue;
            }
            else if (getResult === 400) {
                log(`Cookie ${j} expired.`);
                const cookie = await getElectiveCookie(studentId, password);
                cookiePool[j] = cookie;
                const courseInfos = await getCourseInfos(courses, cookie);
                if (courseInfos.length !== mainCourseInfos.length) {
                    log(`Courses to elect are changed.`);
                    break;
                }
                courseInfoss[j] = courseInfos;
                log(`Cookie ${j} renewed.`);
                continue;
            }
            else if (typeof getResult === 'number') {
                log(`${getResult}. Fail to get elected num.`);
                return;
            }
            const { electedNum } = getResult;
            if (electedNum >= limit) {
                log(`No places avaliable for ${title} ${number} of ${department}.`);
                continue;
            }
            const { href } = mainCourseInfos[i];
            const electResult = await electCourse(href, mainCookie);
            if (electResult !== 200) {
                log(`Fail to elect ${title} ${number} of ${department}.`);
                return;
            }
            if (mainCourseInfos.length === 1) {
                log('Finished.');
                return;
            }
            break;
        }
    }
}
exports.main = main;
