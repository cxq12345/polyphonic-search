
import { pinyin_dict_notone } from './dict'
/*
 * 汉字与拼音互转工具，根据导入的字典文件的不同支持不同
 * 对于多音字目前只是将所有可能的组合输出，准确识别多音字需要完善的词库，而词库文件往往比字库还要大，所以不太适合web环境。
 * @start 2016-09-26
 * @last 2016-09-29
 */
 const toneMap = {
    ā: "a1",
    á: "a2",
    ǎ: "a3",
    à: "a4",
    ō: "o1",
    ó: "o2",
    ǒ: "o3",
    ò: "o4",
    ē: "e1",
    é: "e2",
    ě: "e3",
    è: "e4",
    ī: "i1",
    í: "i2",
    ǐ: "i3",
    ì: "i4",
    ū: "u1",
    ú: "u2",
    ǔ: "u3",
    ù: "u4",
    ü: "v0",
    ǖ: "v1",
    ǘ: "v2",
    ǚ: "v3",
    ǜ: "v4",
    ń: "n2",
    ň: "n3",
    "": "m2",
  };

  const dict = {}; // 存储所有字典数据
  const pinyinUtil = {
    /**
     * 解析各种字典文件，所需的字典文件必须在本JS之前导入
     */
    parseDict() {
      // 如果导入了 pinyin_dict_notone.js
      if (pinyin_dict_notone) {
        dict.notone = {};
        dict.py2hz = pinyin_dict_notone; // 拼音转汉字
        // eslint-disable-next-line guard-for-in
        for (const i in pinyin_dict_notone) {
          const temp = pinyin_dict_notone[i];
          for (let j = 0, len = temp.length; j < len; j++) {
            if (!dict.notone[temp[j]]) dict.notone[temp[j]] = i; // 不考虑多音字
          }
        }
      }
    },
    /**
     * 根据汉字获取拼音，如果不是汉字直接返回原字符
     * @param chinese 要转换的汉字
     * @param splitterParam 分隔字符，默认用空格分隔
     * @param withtoneParam 返回结果是否包含声调，默认是
     * @param polyphoneParam 是否支持多音字，默认否
     */
    getPinyin(chinese, splitterParam, withtoneParam, polyphoneParam) {
      if (!chinese || /^ +$/g.test(chinese)) return "";
      const splitter = splitterParam || "";
      const withtone = withtoneParam || "";
      const polyphone = polyphoneParam || "";
      const result = [];
      if (dict.notone) {
        // 使用没有声调的字典文件
        if (withtone) console.warn("pinyin_dict_notone 字典文件不支持声调！");
        if (polyphone)
          console.warn("pinyin_dict_notone 字典文件不支持多音字！");
        let noChinese = "";
        for (let i = 0, len = chinese.length; i < len; i++) {
          const temp = chinese.charAt(i);
          const pinyin = dict.notone[temp];
          if (pinyin) {
            // 插入拼音
            // 空格，把noChinese作为一个词插入
            // eslint-disable-next-line babel/no-unused-expressions
            noChinese && (result.push(noChinese), (noChinese = ""));
            result.push(pinyin);
          } else if (!temp || /^ +$/g.test(temp)) {
            // 空格，插入之前的非中文字符
            // eslint-disable-next-line babel/no-unused-expressions
            noChinese && (result.push(noChinese), (noChinese = ""));
          } else {
            // 非空格，关联到noChinese中
            noChinese += temp;
          }
        }

        if (noChinese) {
          result.push(noChinese);
          noChinese = "";
        }
      } else {
        // eslint-disable-next-line no-throw-literal
        throw "抱歉，未找到合适的拼音字典文件！";
      }
      if (!polyphone) return result.join(splitter);
      if (window.pinyin_dict_polyphone)
        return parsePolyphone(chinese, result, splitter, withtone);
      return handlePolyphone(result, " ", splitter);
    },
    /**
     * 获取汉字的拼音首字母
     * @param str 汉字字符串，如果遇到非汉字则原样返回
     * @param polyphoneParam 是否支持多音字，默认false，如果为true，会返回所有可能的组合数组
     */
    getFirstLetter(str, polyphoneParam) {
      const polyphone = polyphoneParam || false;
      if (!str || /^ +$/g.test(str)) return "";
      if (dict.firstletter) {
        // 使用首字母字典文件
        const result = [];
        for (let i = 0; i < str.length; i++) {
          const unicode = str.charCodeAt(i);
          let ch = str.charAt(i);
          if (unicode >= 19968 && unicode <= 40869) {
            ch = dict.firstletter.all.charAt(unicode - 19968);
            if (polyphone) ch = dict.firstletter.polyphone[unicode] || ch;
          }
          result.push(ch);
        }
        if (!polyphone) return result.join("");
        // 如果不用管多音字，直接将数组拼接成字符串
        return handlePolyphone(result, "", ""); // 处理多音字，此时的result类似于：['D', 'ZC', 'F']
      }
      let py = this.getPinyin(str, " ", false, polyphone);
      py = py instanceof Array ? py : [py];
      const result = [];
      for (let i = 0; i < py.length; i++) {
        result.push(
          py[i].replace(/(^| )(\w)\w*/g, function (m, $1, $2) {
            return $2.toUpperCase();
          })
        );
      }
      if (!polyphone) return result[0];
      return simpleUnique(result);
    },
    /**
     * 去除拼音中的声调，比如将 xiǎo míng tóng xué 转换成 xiao ming tong xue
     * @param pinyin 需要转换的拼音
     */
    removeTone(pinyin) {
      return pinyin.replace(/[āáǎàōóǒòēéěèīíǐìūúǔùüǖǘǚǜńň]/g, function (m) {
        return toneMap[m][0];
      });
    },
  };

  /**
   * 处理多音字，将类似['D', 'ZC', 'F']转换成['DZF', 'DCF']
   * 或者将 ['chang zhang', 'cheng'] 转换成 ['chang cheng', 'zhang cheng']
   */
  function handlePolyphone(array, splitterParam, joinChar) {
    const splitter = splitterParam || "";
    let result = [""];
    let temp = [];
    for (let i = 0; i < array.length; i++) {
      temp = [];
      const t = array[i].split(splitter);
      for (let j = 0; j < t.length; j++) {
        for (let k = 0; k < result.length; k++)
          temp.push(result[k] + (result[k] ? joinChar : "") + t[j]);
      }
      result = temp;
    }
    return simpleUnique(result);
  }

  /**
   * 根据词库找出多音字正确的读音
   * 这里只是非常简单的实现，效率和效果都有一些问题
   * 推荐使用第三方分词工具先对句子进行分词，然后再匹配多音字
   * @param chinese 需要转换的汉字
   * @param resultParam 初步匹配出来的包含多个发音的拼音结果
   * @param splitter 返回结果拼接字符
   */
  function parsePolyphone(chinese, resultParam, splitter, withtone) {
    const result = resultParam;
    const poly = window.pinyin_dict_polyphone;
    const max = 7; // 最多只考虑7个汉字的多音字词，虽然词库里面有10个字的，但是数量非常少，为了整体效率暂时忽略之
    let temp = poly[chinese];
    if (temp) {
      // 如果直接找到了结果
      temp = temp.split(" ");
      for (let i = 0; i < temp.length; i++) {
        result[i] = temp[i] || result[i];
        if (!withtone) result[i] = pinyinUtil.removeTone(result[i]);
      }
      return result.join(splitter);
    }
    for (let i = 0; i < chinese.length; i++) {
      temp = "";
      for (let j = 0; j < max && i + j < chinese.length; j++) {
        if (!/^[\u2E80-\u9FFF]+$/.test(chinese[i + j])) break; // 如果碰到非汉字直接停止本次查找
        temp += chinese[i + j];
        let res = poly[temp];
        if (res) {
          // 如果找到了多音字词语
          res = res.split(" ");
          for (let k = 0; k <= j; k++) {
            if (res[k])
              result[i + k] = withtone ? res[k] : pinyinUtil.removeTone(res[k]);
          }
          break;
        }
      }
    }
    // 最后这一步是为了防止出现词库里面也没有包含的多音字词语
    for (let i = 0; i < result.length; i++) {
      result[i] = result[i].replace(/ .*$/g, "");
    }
    return result.join(splitter);
  }

  // 简单数组去重
  function simpleUnique(array) {
    const result = [];
    const hash = {};
    for (let i = 0; i < array.length; i++) {
      const key = typeof array[i] + array[i];
      if (!hash[key]) {
        result.push(array[i]);
        hash[key] = true;
      }
    }
    return result;
  }

  pinyinUtil.parseDict();
  pinyinUtil.dict = dict;
  // window.pinyinUtil = pinyinUtil;
  export default pinyinUtil;

