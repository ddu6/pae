"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveSessions = exports.saveConfig = exports.sessions = exports.config = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
[
    '../info/',
    '../info/election-results/',
    '../info/vcode-imgs/'
].map(val => path_1.join(__dirname, val)).forEach(val => {
    if (!fs_1.existsSync(val)) {
        fs_1.mkdirSync(val);
    }
});
exports.config = {
    studentId: "1x000xxxxx",
    password: "xxxxxxxx",
    courses: [
        {
            title: "普通物理",
            number: 3,
            department: "数学科学学院"
        },
        {
            title: "逻辑导论"
        }
    ],
    ttshitu: {
        username: "xxxxxxxx",
        password: "xxxxxxxx"
    },
    proxies: [
        "http://xx.xx.xx.xx:3128/"
    ],
    proxyDelay: 2,
    sessionDuration: 1800,
    refreshInterval: 3,
    errLimit: 100,
    errSleep: 1,
    congestionSleep: 3,
    requestTimeout: 30,
    getElectedNumTimeout: 3,
    recognizeTimeout: 5,
};
exports.sessions = {
    main: {
        cookie: '',
        start: 0,
        courseInfoArray: []
    },
    others: []
};
const path0 = path_1.join(__dirname, '../config.json');
const path1 = path_1.join(__dirname, '../sessions.json');
function saveConfig() {
    fs_1.writeFileSync(path0, JSON.stringify(exports.config, undefined, 4));
}
exports.saveConfig = saveConfig;
function saveSessions() {
    fs_1.writeFileSync(path1, JSON.stringify(exports.sessions, undefined, 4));
}
exports.saveSessions = saveSessions;
if (!fs_1.existsSync(path0)) {
    saveConfig();
}
else {
    Object.assign(exports.config, JSON.parse(fs_1.readFileSync(path0, { encoding: 'utf8' })));
}
if (!fs_1.existsSync(path1)) {
    saveSessions();
}
else {
    Object.assign(exports.sessions, JSON.parse(fs_1.readFileSync(path1, { encoding: 'utf8' })));
}
