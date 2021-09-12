"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
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
    ttshitu: {
        username: "xxxxxxxx",
        password: "xxxxxxxx"
    },
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
    proxies: [
        "http://xx.xx.xx.xx:3128/"
    ],
    sessionDuration: 1800,
    refreshInterval: 3,
    errLimit: 100,
    errSleep: 1,
    congestionSleep: 3,
    requestTimeout: 30,
    getElectedNumTimeout: 2,
};
const path = path_1.join(__dirname, '../config.json');
if (!fs_1.existsSync(path)) {
    fs_1.writeFileSync(path, JSON.stringify(exports.config, undefined, 4));
}
else {
    Object.assign(exports.config, JSON.parse(fs_1.readFileSync(path, { encoding: 'utf8' })));
}
