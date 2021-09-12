"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const jsdom_1 = require("jsdom");
const cli_tools_1 = require("@ddu6/cli-tools");
const init_1 = require("./init");
const clit = new cli_tools_1.CLIT(__dirname, init_1.config);
async function sleep(time) {
    await new Promise(resolve => {
        setTimeout(resolve, time * 1000);
    });
}
async function get(url, params = {}, cookie = '', referer = '', requestTimeout) {
    const result = await clit.request(url, params, {}, cookie, referer, undefined, requestTimeout);
    if (typeof result === 'number') {
        throw new Error(`${result}, fail to get ${url}`);
    }
    return result;
}
async function post(url, form = {}, cookie = '', referer = '', requestTimeout) {
    const result = await clit.request(url, {}, form, cookie, referer, undefined, requestTimeout);
    if (typeof result === 'number') {
        throw new Error(`${result}, fail to post ${url}`);
    }
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
    if (typeof token !== 'string') {
        throw new Error(`Fail to get login cookie of app ${appId}`);
    }
    const res = await get(redirectURL, {
        _rand: Math.random().toString(),
        token: token
    });
    let { status, headers } = res;
    cookie = res.cookie;
    if (status !== 301) {
        return cookie;
    }
    const { location } = headers;
    if (location === undefined) {
        return cookie;
    }
    cookie = `${(await get(location, {}, cookie, redirectURL)).cookie}; ${cookie}`;
    return cookie;
}
async function getElectiveCookie() {
    for (let i = 0; i < init_1.config.errLimit; i++) {
        try {
            const cookie = await getLoginCookie(init_1.config.studentId, init_1.config.password, 'syllabus', '学生选课系统', 'http://elective.pku.edu.cn:80/elective2008/ssoLogin.do');
            await get(homepageURL, {}, cookie);
            return cookie;
        }
        catch (err) {
            if (err instanceof Error) {
                clit.log(err);
            }
        }
        await sleep(init_1.config.errSleep);
    }
    throw new Error('Fail to get elective cookie');
}
function htmlToCourseInfoArray(html) {
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
    if (ele === undefined) {
        return [];
    }
    const courseInfoArray = [];
    result = ele.querySelectorAll(':scope>tr');
    for (let i = 0; i < result.length; i++) {
        const children = result[i].children;
        if (children.length < 10) {
            continue;
        }
        let tmp = children[0].textContent;
        if (tmp === null) {
            continue;
        }
        const title = tmp;
        tmp = children[5].textContent;
        if (tmp === null) {
            continue;
        }
        const number = Number(tmp);
        if (!isFinite(number)) {
            continue;
        }
        tmp = children[6].textContent;
        if (tmp === null) {
            continue;
        }
        const department = tmp;
        tmp = children[9].textContent;
        if (tmp === null) {
            continue;
        }
        tmp = tmp.split('/')[0].trim();
        const limit = Number(tmp);
        if (!isFinite(number)) {
            continue;
        }
        const a = children[10].querySelector('a');
        if (a === null) {
            continue;
        }
        const href = new URL(a.href, electAndDropURL).href;
        tmp = a.getAttribute('onclick');
        if (tmp === null) {
            continue;
        }
        tmp = tmp.replace(/.*?\(/, '').replace(/[);\\']/g, '');
        const array = tmp.split(',');
        if (array.length < 9) {
            continue;
        }
        const index = Number(array[5]);
        if (!isFinite(index)) {
            continue;
        }
        const seq = array[6];
        courseInfoArray.push({
            title: title,
            number: number,
            department: department,
            limit: limit,
            href: href,
            index: index,
            seq: seq
        });
    }
    return courseInfoArray;
}
async function getCourseInfoArray(cookie) {
    for (let i = 0; i < init_1.config.errLimit; i++) {
        try {
            const { body } = await get(electAndDropURL, { xh: init_1.config.studentId }, cookie, homepageURL);
            if (body.includes('会话超时') || body.includes('超时操作') || body.includes('重新登录')) {
                clit.out('Timeout');
                return 504;
            }
            return htmlToCourseInfoArray(body);
        }
        catch (err) {
            if (err instanceof Error) {
                clit.log(err);
            }
        }
        await sleep(init_1.config.errSleep);
    }
    throw new Error('Fail to get course info array');
}
async function getElectedNum(index, seq, cookie) {
    try {
        const { body } = await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/refreshLimit.do', {
            index: index.toString(),
            seq,
            xh: init_1.config.studentId
        }, cookie, electAndDropURL, init_1.config.getElectedNumTimeout);
        if (body.includes('会话超时') || body.includes('超时操作') || body.includes('重新登录')) {
            clit.out('Timeout');
            return 504;
        }
        const result = JSON.parse(body).electedNum;
        if (result === 'NA') {
            return 503;
        }
        if (result === 'NB') {
            return 400;
        }
        const data = Number(result);
        if (!isFinite(data)) {
            return 500;
        }
        return {
            data
        };
    }
    catch (err) {
        if (err instanceof Error) {
            clit.log(err);
        }
        return 500;
    }
}
async function getVCodeImg(cookie) {
    const { buffer, body } = await get(`https://elective.pku.edu.cn/elective2008/DrawServlet?Rand=${(Math.random() * 10000)}`, {}, cookie, electAndDropURL);
    if (body.includes('会话超时') || body.includes('超时操作') || body.includes('重新登录')) {
        clit.out('Timeout');
        return 504;
    }
    fs_1.writeFileSync(path_1.join(__dirname, `../info/vcode-imgs/${cli_tools_1.CLIT.getDate()} ${cli_tools_1.CLIT.getTime()}.gif`), buffer);
    return buffer.toString('base64');
}
async function recognizeVCodeImg(base64Img) {
    const { body } = await post('https://api.ttshitu.com/base64', {
        username: init_1.config.ttshitu.username,
        password: init_1.config.ttshitu.password,
        typeid: '4',
        image: base64Img
    }, '', '', init_1.config.recognizeTimeout);
    const { success, message, data } = JSON.parse(body);
    if (!success) {
        if (typeof message === 'string') {
            clit.out(message);
        }
        return 500;
    }
    const { result } = data;
    if (typeof result !== 'string') {
        return 500;
    }
    return result;
}
async function verifyVCode(vcode, cookie) {
    const { body } = await post('https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/validate.do', {
        xh: init_1.config.studentId,
        validCode: vcode
    }, cookie, electAndDropURL);
    const result = Number(JSON.parse(body).valid);
    if (result === 2) {
        return 200;
    }
    if (result === 1) {
        return 401;
    }
    return 403;
}
async function verifySession(cookie) {
    for (let i = 0; i < init_1.config.errLimit; i++) {
        try {
            const img = await getVCodeImg(cookie);
            if (img === 504) {
                return 504;
            }
            const result = await recognizeVCodeImg(img);
            if (result === 500) {
                clit.out(`Fail to recognize vcode img`);
                await sleep(init_1.config.errSleep);
                continue;
            }
            clit.out(`Recognized as ${result}`);
            if (await verifyVCode(result, cookie) === 200) {
                clit.out('Verified');
                return 200;
            }
        }
        catch (err) {
            if (err instanceof Error) {
                clit.log(err);
            }
        }
        await sleep(init_1.config.errSleep);
    }
    throw new Error('Fail to verify session');
}
async function electCourse(href, cookie) {
    try {
        const { body } = await get(href, {}, cookie, electAndDropURL);
        fs_1.writeFileSync(path_1.join(__dirname, `../info/election-results/${cli_tools_1.CLIT.getDate()} ${cli_tools_1.CLIT.getTime()}.html`), body);
        if (body.includes('会话超时') || body.includes('超时操作') || body.includes('重新登录')) {
            clit.out('Timeout');
            return 504;
        }
        const dom = new jsdom_1.JSDOM(body);
        const ele = dom.window.document.body.querySelector('#msgTips');
        if (ele === null) {
            return 500;
        }
        let msg = ele.textContent;
        if (msg === null) {
            return 500;
        }
        msg = msg.trim();
        clit.out(msg);
        if (msg.includes('您已经选过该课程了')
            || msg.includes('上课时间冲突')
            || msg.includes('考试时间冲突')
            || msg.includes('在补退选阶段开始后的约一周开放选课')
            || msg.includes('总学分已经超过规定学分上限')
            || msg.includes('只能选')
            || msg.includes('只能修')
            || msg.includes('选课人数已满')) {
            return 409;
        }
        if (msg.includes('成功')) {
            return 200;
        }
    }
    catch (err) {
        if (err instanceof Error) {
            clit.log(err);
        }
    }
    return 500;
}
function getCourseInfo(session, { title, number, department }) {
    for (const courseInfo of session.courseInfoArray) {
        if (courseInfo.title.includes(title)
            && (number === undefined || courseInfo.number === number)
            && (department === undefined || courseInfo.department.includes(department))) {
            return courseInfo;
        }
    }
    return undefined;
}
async function createSession() {
    const cookie = await getElectiveCookie();
    const courseInfoArray = await getCourseInfoArray(cookie);
    if (courseInfoArray === 504) {
        throw new Error('Fail to create session');
    }
    clit.out('New session');
    return {
        cookie,
        start: Date.now() / 1000,
        courseInfoArray,
    };
}
async function updateSession(session) {
    const result = await getCourseInfoArray(session.cookie);
    if (result === 504) {
        return 504;
    }
    session.courseInfoArray = result;
    init_1.saveSessions();
    if (session === init_1.sessions.main) {
        if (await verifySession(session.cookie) === 504) {
            return 504;
        }
    }
    return 200;
}
async function renewSession(session) {
    Object.assign(session, await createSession());
    init_1.saveSessions();
    if (session === init_1.sessions.main) {
        if (await verifySession(session.cookie) === 504) {
            throw new Error('Fail to renew session');
        }
    }
}
let sessionIndex = -1;
async function getSession() {
    sessionIndex = (sessionIndex + 1) % (init_1.sessions.others.length + 1);
    let session;
    if (sessionIndex === 0) {
        session = init_1.sessions.main;
    }
    else {
        session = init_1.sessions.others[sessionIndex - 1];
    }
    if (Date.now() / 1000 - init_1.config.sessionDuration + Math.random() * 300 > session.start) {
        await renewSession(session);
    }
    return session;
}
async function main() {
    const sessionNum = Math.ceil(3 / init_1.config.refreshInterval) * init_1.config.courses.length;
    if (Date.now() / 1000 - init_1.config.sessionDuration + Math.random() * 300 > init_1.sessions.main.start) {
        await renewSession(init_1.sessions.main);
    }
    init_1.sessions.others = init_1.sessions.others.filter(val => Date.now() / 1000 - init_1.config.sessionDuration + Math.random() * 300 <= val.start).slice(0, sessionNum - 1);
    for (let i = 0; i < sessionNum - 1 - init_1.sessions.others.length; i++) {
        init_1.sessions.others.push(await createSession());
        init_1.saveSessions();
    }
    while (true) {
        const promises = [];
        let electing = false;
        for (let i = 0; i < init_1.config.courses.length; i++) {
            const session = await getSession();
            const courseInfo = getCourseInfo(session, init_1.config.courses[i]);
            if (courseInfo === undefined) {
                init_1.config.courses.splice(i, 1);
                init_1.saveConfig();
                i--;
                continue;
            }
            promises.push((async () => {
                const result0 = await getElectedNum(courseInfo.index, courseInfo.seq, session.cookie);
                if (result0 === 503) {
                    clit.out('Too frequent');
                    await sleep(init_1.config.congestionSleep);
                    return;
                }
                if (result0 === 504) {
                    await renewSession(session);
                    return;
                }
                if (result0 === 400) {
                    if (await updateSession(session) === 504) {
                        await renewSession(session);
                    }
                    return;
                }
                if (result0 === 500) {
                    clit.out(`Fail to get elected num`);
                    return;
                }
                const { data } = result0;
                if (data >= courseInfo.limit) {
                    clit.out(`No places avaliable for ${courseInfo.title}`);
                    return;
                }
                if (electing) {
                    return;
                }
                electing = true;
                const result1 = await electCourse(courseInfo.href, init_1.sessions.main.cookie);
                if (result1 === 504) {
                    clit.out(`Fail to elect ${courseInfo.title}`);
                    await renewSession(init_1.sessions.main);
                    return;
                }
                if (result1 === 500) {
                    clit.out(`Fail to elect ${courseInfo.title}`);
                    if (await verifySession(init_1.sessions.main.cookie) === 504) {
                        await renewSession(init_1.sessions.main);
                        return;
                    }
                    const result = await electCourse(courseInfo.href, init_1.sessions.main.cookie);
                    if (result === 500 || result === 504) {
                        clit.out(`Fail to elect ${courseInfo.title}`);
                        await renewSession(init_1.sessions.main);
                        return;
                    }
                }
                return true;
            })());
        }
        const result = await Promise.all(promises);
        for (let i = 0; i < result.length; i++) {
            if (result[i] === true) {
                init_1.config.courses.splice(i, 1);
                init_1.saveConfig();
                result.splice(i, 1);
                i--;
            }
        }
        if (result.length < promises.length) {
            if (await updateSession(init_1.sessions.main) === 504) {
                await renewSession(init_1.sessions.main);
            }
            for (const session of init_1.sessions.others) {
                if (await updateSession(session) === 504) {
                    await renewSession(session);
                }
            }
        }
        if (init_1.config.courses.length === 0) {
            clit.out('Finished');
            return;
        }
        await sleep(init_1.config.refreshInterval);
    }
}
exports.main = main;
