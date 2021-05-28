"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const jsdom_1 = require("jsdom");
const init_1 = require("./init");
Object.assign(init_1.config, JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), { encoding: 'utf8' })));
function getDate() {
    const date = new Date();
    return [date.getMonth() + 1, date.getDate()].map(val => val.toString().padStart(2, '0')).join('-') + ' ' + [date.getHours(), date.getMinutes(), date.getSeconds()].map(val => val.toString().padStart(2, '0')).join(':') + ':' + date.getMilliseconds().toString().padStart(3, '0');
}
function log(msg) {
    let string = getDate() + '  ';
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
    string = string.replace(/\n */g, '\n                    ');
    fs.appendFileSync(path.join(__dirname, '../info/log.txt'), string + '\n\n');
    return string;
}
function out(msg) {
    const string = log(msg);
    console.log(string + '\n');
}
async function sleep(time) {
    await new Promise(resolve => {
        setTimeout(resolve, time * 1000);
    });
}
async function basicallyGet(url, params = {}, form = {}, cookie = '', referer = '', noUserAgent = false) {
    let paramsStr = new URL(url).searchParams.toString();
    if (paramsStr.length > 0) {
        paramsStr += '&';
    }
    paramsStr += new URLSearchParams(params).toString();
    if (paramsStr.length > 0) {
        paramsStr = '?' + paramsStr;
    }
    url = new URL(paramsStr, url).href;
    const formStr = new URLSearchParams(form).toString();
    const headers = {};
    if (cookie.length > 0) {
        headers.Cookie = cookie;
    }
    if (referer.length > 0) {
        headers.Referer = referer;
    }
    if (!noUserAgent) {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36';
    }
    if (formStr.length > 0) {
        Object.assign(headers, {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        });
    }
    const options = {
        method: formStr.length > 0 ? 'POST' : 'GET',
        headers: headers
    };
    const proxies = init_1.config.proxies;
    if (proxies.length > 0) {
        const i = Math.min(Math.floor(Math.random() * proxies.length), proxies.length - 1);
        const proxy = proxies[i];
        if (proxy !== 'http://xx.xx.xx.xx:3128/') {
            options.path = url;
            url = proxy;
        }
    }
    const result = await new Promise((resolve) => {
        setTimeout(() => {
            resolve(500);
        }, init_1.config.timeout * 1000);
        const httpsOrHTTP = url.startsWith('https://') ? https : http;
        const req = httpsOrHTTP.request(url, options, async (res) => {
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
                log(err);
                resolve(500);
            });
        }).on('error', err => {
            log(err);
            resolve(500);
        });
        if (formStr.length > 0) {
            req.write(formStr);
        }
        req.end();
    });
    return result;
}
async function get(url, params = {}, cookie = '', referer = '') {
    const result = await basicallyGet(url, params, {}, cookie, referer);
    if (typeof result === 'number')
        throw new Error(`${result}. Fail to get ${url}.`);
    return result;
}
async function post(url, form = {}, cookie = '', referer = '') {
    const result = await basicallyGet(url, {}, form, cookie, referer);
    if (typeof result === 'number')
        throw new Error(`${result}. Fail to post ${url}.`);
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
async function getElectiveCookie(studentId, password) {
    for (let i = 0; i < init_1.config.errLimit; i++) {
        try {
            const cookie = await getLoginCookie(studentId, password, 'syllabus', '学生选课系统', 'http://elective.pku.edu.cn:80/elective2008/ssoLogin.do');
            await get(homepageURL, {}, cookie);
            return cookie;
        }
        catch (err) {
            log(err);
        }
        await sleep(init_1.config.smallErrSleep);
    }
    throw new Error('Fail to get elective cookie.');
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
    for (let i = 0; i < init_1.config.errLimit; i++) {
        try {
            const { body } = await get(electAndDropURL, {}, cookie, homepageURL);
            return htmlToCourseInfos(body);
        }
        catch (err) {
            log(err);
        }
        await sleep(init_1.config.smallErrSleep);
    }
    throw new Error('Fail to get all course infos.');
}
async function getElectedNum(index, seq, studentId, cookie) {
    try {
        const { body } = await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/refreshLimit.do', {
            index: index.toString(),
            seq: seq,
            xh: studentId
        }, cookie, electAndDropURL);
        let tmp;
        try {
            tmp = JSON.parse(body).electedNum;
        }
        catch (err) {
            log(err);
            log(`Fail to parse ${body}.`);
            if (body.includes('会话超时') || body.includes('超时操作') || body.includes('重新登录'))
                return 400;
            return 500;
        }
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
        log(err);
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
async function verifySession(studentId, tusername, tpassowrd, cookie) {
    for (let i = 0; i < init_1.config.errLimit; i++) {
        try {
            const img = await getVCodeImg(cookie);
            let result = await recognizeVCodeImg(img, tusername, tpassowrd);
            if (typeof result !== 'object') {
                out(`${result}. Fail to recognize vcode img.`);
                await sleep(init_1.config.smallErrSleep);
                continue;
            }
            const { vcode } = result;
            out(`Recognized as ${vcode}.`);
            result = await verifyVCode(vcode, studentId, cookie);
            if (result === 200)
                return;
        }
        catch (err) {
            log(err);
        }
        await sleep(init_1.config.smallErrSleep);
    }
    throw new Error('Fail to verify main session.');
}
async function electCourse(href, cookie) {
    try {
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
        out(msg);
        if (msg.includes('成功'))
            return 200;
        return 500;
    }
    catch (err) {
        log(err);
        return 500;
    }
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
        const { studentId, password, refreshInterval, ttshitu: { username: tusername, password: tpassword }, courses } = init_1.config;
        let mainCookie = await getElectiveCookie(studentId, password);
        let mainCourseInfos = await getCourseInfos(courses, mainCookie);
        if (mainCourseInfos.length === 0) {
            out('Finished.');
            return;
        }
        out('Courses to elect:\n' + mainCourseInfos.map(val => val.title + ' ' + val.number + ' ' + val.department).join('\n'));
        const cookiePool = [{
                cookie: mainCookie,
                startTime: Date.now() / 1000,
            }];
        const courseInfoss = [mainCourseInfos];
        out('Main session started.');
        const cookiePoolSize = Math.ceil(3 / refreshInterval);
        for (let j = 1; j < cookiePoolSize; j++) {
            await sleep(init_1.config.smallErrSleep);
            const cookie = await getElectiveCookie(studentId, password);
            cookiePool.push({
                cookie: cookie,
                startTime: Date.now() / 1000,
            });
            const courseInfos = await getCourseInfos(courses, cookie);
            if (courseInfos.length !== mainCourseInfos.length) {
                out(`Please do not operate on elective by yourself unless all sessions are started.`);
                return;
            }
            courseInfoss.push(courseInfos);
            out(`Session ${j} started.`);
        }
        out('All sessions started.');
        await verifySession(studentId, tusername, tpassword, mainCookie);
        out('Main session verified.');
        let i = -1;
        let j = -1;
        while (true) {
            await sleep(refreshInterval);
            j = (j + 1) % cookiePool.length;
            i = (i + 1) % mainCourseInfos.length;
            const courseInfos = courseInfoss[j];
            const { cookie, startTime } = cookiePool[j];
            const { index, seq, limit, title, number, department } = courseInfos[i];
            if (Date.now() / 1000 - init_1.config.sessionDuration + Math.random() * 300 > startTime && j !== 0) {
                out(`Session ${j} retired.`);
                const cookie = await getElectiveCookie(studentId, password);
                cookiePool[j] = {
                    cookie: cookie,
                    startTime: Date.now() / 1000,
                };
                const courseInfos = await getCourseInfos(courses, cookie);
                if (courseInfos.length !== mainCourseInfos.length) {
                    out(`Courses to elect are changed.`);
                    break;
                }
                courseInfoss[j] = courseInfos;
                if (j !== 0) {
                    out(`Session ${j} renewed.`);
                }
                else {
                    mainCookie = cookie;
                    mainCourseInfos = courseInfos;
                    out(`Main session renewed.`);
                    await verifySession(studentId, tusername, tpassword, mainCookie);
                    out('Main session verified.');
                }
                continue;
            }
            const getResult = await getElectedNum(index, seq, studentId, cookie);
            if (getResult === 503) {
                out('Too frequent. Fail to get elected num.');
                await sleep(init_1.config.congestionSleep);
                continue;
            }
            else if (getResult === 400) {
                out(`Session ${j} expired.`);
                const cookie = await getElectiveCookie(studentId, password);
                cookiePool[j] = {
                    cookie: cookie,
                    startTime: Date.now() / 1000,
                };
                const courseInfos = await getCourseInfos(courses, cookie);
                if (courseInfos.length !== mainCourseInfos.length) {
                    out(`Courses to elect are changed.`);
                    break;
                }
                courseInfoss[j] = courseInfos;
                if (j !== 0) {
                    out(`Session ${j} renewed.`);
                }
                else {
                    mainCookie = cookie;
                    mainCourseInfos = courseInfos;
                    out(`Main session renewed.`);
                    await verifySession(studentId, tusername, tpassword, mainCookie);
                    out('Main session verified.');
                }
                continue;
            }
            else if (typeof getResult === 'number') {
                out(`${getResult}. Fail to get elected num.`);
                await sleep(init_1.config.bigErrSleep);
                continue;
            }
            const { electedNum } = getResult;
            if (electedNum >= limit) {
                out(`No places avaliable for ${title} ${number} of ${department}.`);
                continue;
            }
            const { href } = mainCourseInfos[i];
            const electResult = await electCourse(href, mainCookie);
            if (electResult !== 200) {
                out(`Fail to elect ${title} ${number} of ${department}.`);
                await verifySession(studentId, tusername, tpassword, mainCookie);
                out('Main session verified.');
                const electResult = await electCourse(href, mainCookie);
                if (electResult !== 200) {
                    out(`Fail to elect ${title} ${number} of ${department}.`);
                    continue;
                }
            }
            if (mainCourseInfos.length === 1) {
                out('Finished.');
                return;
            }
            break;
        }
    }
}
exports.main = main;
