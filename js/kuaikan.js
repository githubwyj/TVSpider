/*
* @File     : kuaikan.js
* @Author   : jade
* @Date     : 2024/3/19 11:12
* @Email    : jadehh@1ive.com
* @Software : Samples
* @Desc     :
*/
import {jinja2, _, dayjs} from "../lib/cat.js";
import {Spider} from "./spider.js";
import {VodDetail, VodShort} from "../lib/vod.js";
import * as Utils from "../lib/utils.js";
const charStr = 'abacdefghjklmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ0123456789';
function randStr(len, withNum) {
    let _str = '';
    let containsNum = withNum === undefined ? true : withNum;
    for (let i = 0; i < len; i++) {
        let idx = _.random(0, containsNum ? charStr.length - 1 : charStr.length - 11);
        _str += charStr[idx];
    }
    return _str;
}

function randDevice() {
    return {
        brand: 'Huawei',
        model: 'HUAWEI Mate 20',
        release: '10',
        buildId: randStr(3, false).toUpperCase() + _.random(11, 99) + randStr(1, false).toUpperCase(),
    };
}

async function request(reqUrl,device, postData, agentSp, get) {
    let ts = dayjs().valueOf().toString();
    let rand = randStr(32);
    let sign = CryptoJS.enc.Hex.stringify(CryptoJS.MD5('H58d2%gLbeingX*%D4Y8!C!!@G_' + ts + '_' + rand))
        .toString()
        .toLowerCase();
    let headers = {
        'user-agent': agentSp || device.ua,
    };
    if (reqUrl.includes('baibaipei')) {
        headers['device-id'] = device.id;
        headers['sign'] = sign;
        headers['time'] = ts;
        headers['md5'] = rand;
        headers['version'] = '2.1.5';
        headers['system-model'] = device.model;
        headers['system-brand'] = device.brand;
        headers['system-version'] = device.release;
        headers["host"] = "api1.baibaipei.com:8899"
    }
    if (!get) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    let res = await req(reqUrl, {
        method: get ? 'get' : 'post', headers: headers, data: postData || {},
    });

    let content = res.content;
    // console.log(content);
    try {
        let key = CryptoJS.enc.Utf8.parse('IjhHsCB2B5^#%0Ag');
        let iv = CryptoJS.enc.Utf8.parse('y8_m.3rauW/>j,}.');
        let src = CryptoJS.enc.Base64.parse(content);
        let dst = CryptoJS.AES.decrypt({ciphertext: src}, key, {iv: iv, padding: CryptoJS.pad.Pkcs7});
        dst = CryptoJS.enc.Utf8.stringify(dst);
        return JSON.parse(dst);
    } catch (e) {
        return JSON.parse(content)
    }
}

function formatPlayUrl(src, name) {
    return name
        .trim()
        .replaceAll(src, '')
        .replace(/<|>|《|》/g, '')
        .replace(/\$|#/g, ' ')
        .trim();
}

function jsonParse(input, json) {
    try {
        let url = json.url ?? '';
        if (url.startsWith('//')) {
            url = 'https:' + url;
        }
        if (!url.startsWith('http')) {
            return {};
        }
        let headers = json['headers'] || {};
        let ua = (json['user-agent'] || '').trim();
        if (ua.length > 0) {
            headers['User-Agent'] = ua;
        }
        let referer = (json['referer'] || '').trim();
        if (referer.length > 0) {
            headers['Referer'] = referer;
        }
        _.keys(headers).forEach((hk) => {
            if (!headers[hk]) delete headers[hk];
        });
        return {
            header: headers, url: url,
        };
    } catch (error) {
        console.log(error);
    }
    return {};
}

class KuaiKanSpider extends Spider {
    constructor() {
        super();
        this.siteUrl = 'https://api1.baibaipei.com:8899';
        this.device = {}
        this.parse = []
    }

    getName() {
        return "🛥︎|快看视频|🛥︎"
    }

    getAppName() {
        return "快看视频"
    }

    async init(cfg) {
        await super.init(cfg);
        this.danmuStaus = true
        await this.setDevice();
    }


    async setDevice() {
        let deviceKey = 'device';
        let deviceInfo = await local.get(this.siteKey, deviceKey);
        if (deviceInfo.length > 0) {
            try {
                this.device = JSON.parse(deviceInfo);
            } catch (error) {
            }
        }
        if (_.isEmpty(this.device)) {
            this.device = randDevice();
            this.device.id = randStr(13).toLowerCase();
            this.device.ua = 'okhttp/3.14.9';
            await local.set(this.siteKey, deviceKey, JSON.stringify(this.device));
        }
    }

    async setClasses() {
        await this.setDevice()
        let response = await request(this.siteUrl + '/api.php/Index/getTopVideoCategory',this.device);
        for (const type of response.data) {
            let typeName = type["nav_name"];
            if (typeName === '推荐') continue;
            let typeId = type["nav_type_id"].toString();
            this.classes.push({
                type_id: typeId, type_name: typeName,
            });
        }
    }

    async getFilter(filterData) {
        await this.jadeLog.debug(JSON.stringify(filterData))
        let filterAll = []
        for (let key of Object.keys(filterData)) {
            let itemValues = filterData[key];
            if (key === 'plot') key = 'class';
            let typeExtendName = '';
            switch (key) {
                case 'class':
                    typeExtendName = '类型';
                    break;
                case 'area':
                    typeExtendName = '地区';
                    break;
                case 'lang':
                    typeExtendName = '语言';
                    break;
                case 'year':
                    typeExtendName = '年代';
                    break;
                case 'sort':
                    typeExtendName = '排序';
                    break;
            }
            if (typeExtendName.length === 0) continue;
            let newTypeExtend = {
                key: key, name: typeExtendName,
            };
            let newTypeExtendKV = [];
            for (let j = 0; j < itemValues.length; j++) {
                const name = itemValues[j];
                let value = key === 'sort' ? j + '' : name === '全部' ? '0' : name;
                newTypeExtendKV.push({n: name, v: value});
            }
            newTypeExtend['init'] = key === 'sort' ? '1' : newTypeExtendKV[0]['v'];
            newTypeExtend.value = newTypeExtendKV;
            filterAll.push(newTypeExtend);
        }
        return filterAll
    }

    async setFilterObj() {
        for (const typeDic of this.classes) {
            let typeId = typeDic["type_id"]
            if (typeId !== "最近更新") {
                let filterData = (await request(this.siteUrl + '/api.php/Video/getFilterType',this.device, {type: typeId})).data;
                this.filterObj[typeId] = await this.getFilter(filterData)
            }
        }

    }

    async parseVodShortListFromJSONByHome(obj) {
        let vod_list = []
        for (const data of obj["video"]) {
            let video_vod_list = await this.parseVodShortListFromJson(data["list"])
            vod_list.push(...video_vod_list)
        }
        return vod_list
    }

    async parseVodShortListFromJson(obj) {
        let vod_list = []
        for (const data of obj) {
            let vodShort = new VodShort()
            vodShort.vod_id = data["vod_id"]
            vodShort.vod_name = data["vod_name"]
            vodShort.vod_pic = data["vod_pic"]
            vodShort.vod_remarks = data["vod_remarks"]
            vod_list.push(vodShort)
        }

        return vod_list
    }

    async parseVodDetailfromJson(obj) {
        let vodDetail = new VodDetail()
        vodDetail.load_dic(JSON.stringify(obj))
        vodDetail.vod_content = obj["vod_content"].trim()
        vodDetail.type_name = obj["vod_class"]
        let playlist = {};
        for (const item of obj["vod_play"]) {
            let from = item["playerForm"];
            if (from === 'jp') continue;
            if (from === 'xg') continue;
            let urls = [];
            for (const u of item.url) {
                urls.push(formatPlayUrl(vodDetail.vod_name, u.title) + '$' + u.play_url);
            }
            if (!playlist.hasOwnProperty(from) && urls.length > 0) {
                playlist[from] = urls;
            }
        }
        this.parse = obj.parse || [];
        vodDetail.vod_play_from = _.keys(playlist).join('$$$');
        let urls = _.values(playlist);
        let vod_play_url = [];
        for (const urlist of urls) {
            vod_play_url.push(urlist.join('#'));
        }
        vodDetail.vod_play_url = vod_play_url.join('$$$');
        return vodDetail
    }

    async setHomeVod() {
        let data = await request(this.siteUrl + "/api.php/Index/getHomePage",this.device, {"p": "1", "type": "1"})
        this.homeVodList = await this.parseVodShortListFromJSONByHome(data.data)
    }

    async setCategory(tid, pg, filter, extend) {
        if (pg === 0) pg = 1;
        let reqUrl = this.siteUrl + '/api.php/Video/getFilterVideoList';
        let formData = JSON.parse(jinja2(`{
        "type": "{{tid}}",
        "p": "{{pg}}",
        "area": "{{ext.area|default(0)}}",
        "year": "{{ext.year|default(0)}}",
        "sort": "{{ext.sort|default(0)}}",
        "class": "{{ext.class|default(0)}}"}`, {ext: extend, tid: tid, pg: pg}));
        console.log(formData);
        let data = await request(reqUrl,this.device, formData);
        this.vodList = await this.parseVodShortListFromJson(data["data"]["data"])
    }

    async setDetail(id) {
        let data = await request(this.siteUrl + '/api.php/Video/getVideoInfo',this.device, {video_id: id})
        this.vodDetail = await this.parseVodDetailfromJson(data["data"]["video"])
    }

    async setPlay(flag, id, flags) {
        try {
            if (id.indexOf('youku') >= 0 || id.indexOf('iqiyi') >= 0 || id.indexOf('v.qq.com') >= 0 || id.indexOf('pptv') >= 0 || id.indexOf('le.com') >= 0 || id.indexOf('1905.com') >= 0 || id.indexOf('mgtv') >= 0) {
                if (this.parse.length > 0) {
                    for (let index = 0; index < this.parse.length; index++) {
                        try {
                            const p = this.parse[index];
                            let res = await req(p + id, {
                                headers: {'user-agent': 'okhttp/4.1.0'},
                            });
                            let result = jsonParse(id, JSON.parse(res.content));
                            this.playUrl = result.url
                        } catch (error) {
                        }
                    }
                }
            }
            if (id.indexOf('jqq-') >= 0) {
                let jqqHeaders = await request(this.siteUrl + '/jqqheader.json',this.device, null, null, true);
                let ids = id.split('-');
                let jxJqq = await req('https://api.juquanquanapp.com/app/drama/detail?dramaId=' + ids[1] + '&episodeSid=' + ids[2] + '&quality=LD', {headers: jqqHeaders});
                let jqqInfo = JSON.parse(jxJqq.content);
                if (jqqInfo.data["playInfo"]["url"]) {
                    this.playUrl = jqqInfo.data["playInfo"]["url"]
                }
            }
            let res = await request(this.siteUrl + '/video.php',this.device, {url: id});
            let result = jsonParse(id, res.data);
            if (result.url) {
                this.playUrl = await js2Proxy(true, this.siteType, this.siteKey, 'lzm3u8/' + Utils.base64Encode(result.url), {});
            }
        } catch (e) {
            await this.jadeLog.error(e)

        }
    }

    async setSearch(wd, quick) {
        let data = await request(this.siteUrl + '/api.php/Search/getSearch',this.device, {key: wd, type_id: 0, p: 1})
        this.vodList = await this.parseVodShortListFromJson(data["data"]["data"])
    }

    async proxy(segments, headers) {
        let what = segments[0];
        let url = Utils.base64Decode(segments[1]);
        if (what === 'lzm3u8') {
            const resp = await req(url, {});
            let hls = resp.content;
            const jsBase = await js2Proxy(false, this.siteType, this.siteKey, 'lzm3u8/', {});
            const baseUrl = url.substr(0, url.lastIndexOf('/') + 1);
            console.log(hls.length);
            hls = hls.replace(/#EXT-X-DISCONTINUITY\r*\n*#EXTINF:6.433333,[\s\S]*?#EXT-X-DISCONTINUITY/, '');
            console.log(hls.length);
            hls = hls.replace(/(#EXT-X-KEY\S+URI=")(\S+)("\S+)/g, function (match, p1, p2, p3) {
                let up = (!p2.startsWith('http') ? baseUrl : '') + p2;
                return p1 + up + p3;
            });
            hls = hls.replace(/(#EXT-X-STREAM-INF:.*\n)(.*)/g, function (match, p1, p2) {
                let up = (!p2.startsWith('http') ? baseUrl : '') + p2;
                return p1 + jsBase + Utils.base64Decode(up);
            });
            hls = hls.replace(/(#EXTINF:.*\n)(.*)/g, function (match, p1, p2) {
                let up = (!p2.startsWith('http') ? baseUrl : '') + p2;
                return p1 + up;
            });
            return JSON.stringify({
                code: resp.code, content: hls, headers: resp.headers,
            });
        }
        return JSON.stringify({
            code: 500, content: '',
        });
    }

}


let spider = new KuaiKanSpider()

async function init(cfg) {
    await spider.init(cfg)
}

async function home(filter) {
    return await spider.home(filter)
}

async function homeVod() {
    return await spider.homeVod()
}

async function category(tid, pg, filter, extend) {
    return await spider.category(tid, pg, filter, extend)
}

async function detail(id) {
    return await spider.detail(id)
}

async function play(flag, id, flags) {
    return await spider.play(flag, id, flags)
}

async function search(wd, quick) {
    return await spider.search(wd, quick)
}

async function proxy(segments, headers) {
    return await spider.proxy(segments, headers)
}

export function __jsEvalReturn() {
    return {
        init: init,
        home: home,
        homeVod: homeVod,
        category: category,
        detail: detail,
        play: play,
        search: search,
        proxy: proxy
    };
}