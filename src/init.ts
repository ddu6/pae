import * as fs from 'fs'
import * as path from 'path'
[
    '../info/',
    '../info/election-results/',
    '../info/vcode-imgs/'
].map(val=>path.join(__dirname,val)).forEach(val=>{
    if(!fs.existsSync(val))fs.mkdirSync(val)
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
    refreshInterval:15,
    timeout:30,
}
const path0=path.join(__dirname,'../config.json')
if(!fs.existsSync(path0))fs.writeFileSync(path0,JSON.stringify(config,null,4))