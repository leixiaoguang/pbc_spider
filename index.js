const axios = require('axios');
const async = require('async');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const cookieTime = Math.floor(new Date().getTime() / 1000);
const cookie = "ccpassport=6febdc9fee74bfea14eb7cf53c8888de; wzwschallenge=-1; wzwstemplate=NQ==; wzwstemplate=Mw==; wzwschallenge=V1pXU19DT05GSVJNX1BSRUZJWF9MQUJFTDMxMjM4NjU=; wzwsconfirm=fd08299e682964890adb2a1ba029baf7; wzwsvtime=" + cookieTime;
const http = axios.create({
  baseURL: config.baseUrl,
  headers: {
    'Cookie': cookie
  }
});

function isCookieExpire($) {
  return $('body').find('noscript').length > 0;
}

const aaa = function (trs) {
  return new Promise((resolve, reject) => {
    async.map(trs, getPaymentAgancyListItem, (err, results) => {
      if (err) return reject(err)
      resolve(results);
    });
  });
}

// 根据url获得支付机构集合
async function getPaymentAgancyList(url) {
  try {
    let body = await http.get(url);
    let html = body.data;
    let $ = cheerio.load(html);
    if (isCookieExpire($)) throw new Error('cookie 过期');
    let id = 'd6d180ae830740258523efcbbb6eefae'
    let trs = $(`#${id} tr table tr`);
    let list = await aaa(trs);
    return list;
  } catch (err) {
    throw err;
  }
}


// 组织支付集合集合元素
async function getPaymentAgancyListItem(tr) {
  let $ = cheerio.load(tr);
  let tds = $(tr).find('td');
  let index = tds.eq(1).text().trim();
  let a = tds.eq(2).find('a');
  let name = a.text().trim();
  let href = a.attr('href');
  let date = tds.eq(3).text().trim();
  let detail = await getPaymentAgancyDetail(href);
  console.log(index);
  return ({
    index,
    name,
    href,
    date,
    detail
  });
}

// 根据url获得支付机构详情
async function getPaymentAgancyDetail(url) {
  try {
    let body = await http.get(url);
    let html = body.data;
    let $ = cheerio.load(html);
    if (isCookieExpire($)) throw new Error('cookie 过期');
    let tables = $('#zwgk_pre table table');
    return [].map.call(tables, table => {
      let trs = $(table).find('tr');
      return ({
        info: trs.eq(0).text().trim(),
        code: getPaymentAgancyDetailItem(trs.eq(1)),
        name: getPaymentAgancyDetailItem(trs.eq(2)),
        legal_representative: getPaymentAgancyDetailItem(trs.eq(3)),
        address: getPaymentAgancyDetailItem(trs.eq(4)),
        business_type: getPaymentAgancyDetailItem(trs.eq(5)),
        business_scope: getPaymentAgancyDetailItem(trs.eq(6)),
        issue_date: getPaymentAgancyDetailItem(trs.eq(7)),
        deadline: getPaymentAgancyDetailItem(trs.eq(8)),
      });
    });
  } catch (err) {
    throw err;
  }
}

// 获得支付详情元素信息
function getPaymentAgancyDetailItem(tr) {
  let $ = cheerio.load(tr);
  return ({
    key: tr.find('td').eq(0).text().trim(),
    value: tr.find('td').eq(1).text().trim()
  });
}

// 生成url集合
let urls = [];
let currentIndex = 1;
let maxPageSize = 13;
for (let i = currentIndex; i <= maxPageSize; i++) {
  urls.push(`${config.url.paymentAgencyListPrefix}index${i}.html`);
}

// 并发执行
async.mapLimit(urls, 2, async function (url) {
  const paymentList = await getPaymentAgancyList(url);
  return paymentList;
}, (err, results) => {
  if (err) return console.log(err.message);
  // 合并结果
  let list = results.reduce((prev, cur) => {
    return prev.concat(cur);
  }, []);
  // 写入文件
  fs.writeFile(path.join(__dirname, `${config.fileName.paymentAgencyList}.json`), JSON.stringify(list), err => {
    if (err) return console.error(err.message);
    console.log(`获取列表成功!`);
  });
})
