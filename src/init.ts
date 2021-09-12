import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'fs'
import {join} from 'path'
[
    '../info/',
    '../info/election-results/',
    '../info/vcode-imgs/'
].map(val=>join(__dirname,val)).forEach(val=>{
    if(!existsSync(val)){
        mkdirSync(val)
    }
})
export const config={
    studentId:"1x000xxxxx",
    password:"xxxxxxxx",
    ttshitu:{
        username:"xxxxxxxx",
        password:"xxxxxxxx"
    },
    courses:[
        {
            title:"普通物理",
            number:3,
            department:"数学科学学院"
        },
        {
            title:"逻辑导论"
        }
    ],
    proxies:[
        "http://xx.xx.xx.xx:3128/"
    ],
    sessionDuration:1800,
    refreshInterval:3,
    errLimit:100,
    errSleep:1,
    congestionSleep:3,
    requestTimeout:30,
    getElectedNumTimeout:3,
}
const path=join(__dirname,'../config.json')
if(!existsSync(path)){
    writeFileSync(path,JSON.stringify(config,undefined,4))
}else{
    Object.assign(config,JSON.parse(readFileSync(path,{encoding:'utf8'})))
}