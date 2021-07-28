const axios = require('axios');
const cheerio = require('cheerio');
const Listen = require('../models/Listen');

// ------------------------------------------------------------------------------------------------------------------------------------
function olxDateToDate(olxDate) {
  let date = new Date();
  if (olxDate.includes('Сегодня') || olxDate.includes('Вчера')) {
    if (olxDate.includes('Вчера')) {
      date = new Date(new Date().valueOf() - 1000 * 60 * 60 * 24);
    }
    const dateArr = olxDate.replace('Сегодня ', '').replace('Вчера ', '').split(':');
    date.setHours(dateArr[0]);
    date.setMinutes(dateArr[1]);
  } else {
    const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    const dateArr = olxDate.split('  ');
    date.setDate(dateArr[0]);
    date.setMonth(months.indexOf(dateArr[1]));
    date.setHours('00');
    date.setMinutes('00');
  }
  date.setSeconds('00');
  date.setMilliseconds('000');
  return date;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getNewAdLinks(listenLink, listenUpdated) {
  try {
    let newAdLinks = [];
    const response = await axios.get(listenLink);
    const $ = cheerio.load(response.data);
    const wrapper = $('table#offers_table div.offer-wrapper');
    for (const wrap of wrapper) {
      const href = $(wrap).find('td.title-cell div h3 a').attr('href');
      const olxDate = $(wrap).find('td.bottom-cell small.breadcrumb span')[1].children[1].data;
      if (olxDateToDate(olxDate) < new Date(listenUpdated)) {
        return newAdLinks;
      }
      newAdLinks.push(href);
    }
    const nextPage = $('span.next a').attr('href');
    if (nextPage) {
      await sleep(10);
      newAdLinks = newAdLinks.concat(await getNewAdLinks(nextPage, listenUpdated));
    }
    return newAdLinks;
  } catch (error) {
    throw new Error(error);
  }
}

// ------------------------------------------------------------------------------------------------------------------------------------
function chekContainsSubStrInStr(substr, str) {
  if (substr === '' || str === '') return false;
  const string = str.toLowerCase().trim();
  const substring = substr.toLowerCase().trim();
  const subStrArr = substring.split(' ');
  for (const subStrWord of subStrArr) {
    if (string.includes(subStrWord)) {
      return true;
    }
  }
  return false;
}

async function isAdFiltered(adLink, excludeWord, blackList) {
  try {
    const response = await axios.get(adLink);
    const $ = cheerio.load(response.data);
    const adDescription = $('div[data-cy="ad_description"] div').text();
    const adAuthor = $('div[data-cy="seller_card"] section a').attr('href'); /*! !!!!!!!!!!!!!!! */
    if (chekContainsSubStrInStr(excludeWord, adDescription) || blackList.includes(adAuthor)) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function filterNewAdLinks(newAdLinks, excludeWord, blackList) {
  try {
    await Promise.all(
      newAdLinks.map(
        (adLink) =>
          new Promise((resolve, reject) => {
            (async () => {
              try {
                await sleep(10);
                if (await isAdFiltered(adLink, excludeWord, blackList)) {
                  resolve(adLink);
                }
                resolve();
              } catch (error) {
                reject(error);
              }
            })();
          })
      )
    )
      .then((filtered) => {
        filtered = filtered.filter((el) => el !== undefined);
        newAdLinks = newAdLinks.filter((el) => !filtered.includes(el));
      })
      .catch((error) => {
        throw new Error(error);
      });
    return newAdLinks;
  } catch (error) {
    throw new Error(error);
  }
}

module.exports = {
  isDuplicateLink: async (chatId, link) => {
    try {
      const duplicate = await Listen.findOne({ chatId, link });
      if (duplicate) {
        return true;
      }
      return false;
    } catch (error) {
      return true;
    }
  },
  isValidLink: async (link) => {
    try {
      const response = await axios.get(link);
      const $ = cheerio.load(response.data);
      const adCount = Number($('div.hasPromoted p').text().replace('Найдено ', '').replace(' объявлений', '').replace(' объявление', ''));
      if (adCount) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },
  validateFilter: (filter) => {
    try {
      const obj = JSON.parse(filter);
      const filterObj = obj[Object.keys(obj)[0]];
      if (filterObj.hasOwnProperty('blackList') && filterObj.hasOwnProperty('excludeWord')) {
        if (Array.isArray(filterObj.blackList) && typeof filterObj.excludeWord === 'string') {
          return filterObj;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  },
  // ------------------------------------------------------------------------------------------------------------------------------------
  listen: async (obj) => {
    try {
      await Listen.updateOne({ _id: obj._id }, { $set: { updated: new Date() } });
      let newAdLinks = await getNewAdLinks(obj.link, obj.updated);
      if (newAdLinks.length) {
        if (obj.filter) {
          newAdLinks = await filterNewAdLinks(newAdLinks, obj.filter.excludeWord, obj.filter.blackList);
        }
        let msg = `You have new ads ( on request ${JSON.stringify(obj.link)}): `;
        for (const adLink of newAdLinks) {
          msg += `\n${adLink}`;
        }
        return { chatId: obj.chatId, msg };
      }
      return null;
    } catch (error) {
      throw new Error(error);
    }
  },
};
