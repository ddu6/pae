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
function log(msg) {
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
    console.log(string + '\n');
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
    fs.appendFileSync(path.join(__dirname, '../info/semilog.txt'), string + '\n\n');
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
        throw new Error(`${result.toString()}. Fail to get ${url}.`);
    return result;
}
async function post(url, params = {}, cookie = '', referer = '') {
    const result = await basicallyPost(url, params, cookie, referer);
    if (typeof result === 'number')
        throw new Error(`${result.toString()}. Fail to post ${url}.`);
    return result;
}
const electAndDropURL = 'https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/SupplyCancel.do';
const homepageURL = 'https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/HelpController.jpf';
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
async function getVCodeImg(cookie) {
    const { buffer } = await get(`https://elective.pku.edu.cn/elective2008/DrawServlet?Rand=${(Math.random() * 10000).toString()}`, {}, cookie, electAndDropURL);
    fs.writeFileSync(path.join(__dirname, `../info/vcode ${getDate()}.gif`), buffer);
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
async function verify(studentId, tusername, tpassowrd, cookie) {
    for (let i = 0; i < 5; i++) {
        const img = await getVCodeImg(cookie);
        let result = await recognizeVCodeImg(img, tusername, tpassowrd);
        if (typeof result !== 'object')
            return result;
        const { vcode } = result;
        log(vcode);
        result = await verifyVCode(vcode, studentId, cookie);
        if (result === 200)
            return 200;
        await sleep(1);
    }
    return 500;
}
async function electCourse(href, cookie) {
    const { body } = await get(href, {}, cookie, electAndDropURL);
    fs.writeFileSync(path.join(__dirname, `../info/election-result ${getDate()}.html`), body);
    const dom = new jsdom_1.JSDOM(body);
    const ele = dom.window.document.body.querySelector('#msgTips');
    if (ele === null)
        return 500;
    const msg = ele.textContent;
    if (msg === null)
        return 500;
    return msg.trim();
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
async function main(loopLimit = 1000) {
    const { studentId, password, refreshInterval, ttshitu: { username: tusername, password: tpassword }, courses } = getConfig();
    const cookie = await getLoginCookie(studentId, password, 'syllabus', '学生选课系统', 'http://elective.pku.edu.cn:80/elective2008/ssoLogin.do');
    await get(homepageURL, {}, cookie);
    const courseInfos = await getCourseInfos(courses, cookie);
    console.log(courseInfos);
    if (courseInfos.length === 0)
        return;
    const result = await verify(studentId, tusername, tpassword, cookie);
    if (result !== 200) {
        log(`${result}. Fail to verify.`);
        return;
    }
    log('Verified.');
    for (let i = 0; i < loopLimit; i++) {
        for (let i = 0; i < courseInfos.length; i++) {
            await sleep(refreshInterval + Math.random());
            const { index, seq, href, limit, title, number, department } = courseInfos[i];
            const result = await getElectedNum(index, seq, studentId, cookie);
            if (result === 503) {
                log('Too frequent. Fail to get elected num.');
                await sleep(15);
                continue;
            }
            else if (typeof result === 'number') {
                log(`${result}. Fail to get elected num.`);
                return;
            }
            const { electedNum } = result;
            if (electedNum >= limit) {
                log(`No places avaliable for ${title} ${number} of ${department}.`);
                continue;
            }
            const msg = await electCourse(href, cookie);
            log(`${msg}.`);
            if (typeof msg === 'number'
                || !msg.includes('成功')) {
                await main(1);
                return;
            }
            if (courseInfos.length === 1)
                return;
            await main();
            return;
        }
    }
}
exports.main = main;
