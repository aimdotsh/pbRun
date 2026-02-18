/**
 * COROS API client for fetching activities
 * Based on running_page coros_sync.py implementation
 */

const axios = require('axios');
const crypto = require('crypto');

const COROS_URLS = {
  LOGIN_URL: 'https://teamcnapi.coros.com/account/login',
  DOWNLOAD_URL: 'https://teamcnapi.coros.com/activity/detail/download',
  ACTIVITY_LIST: 'https://teamcnapi.coros.com/activity/query',
};

const COROS_FILE_TYPES = {
  gpx: 1,
  fit: 4,
  tcx: 3,
};

class CorosClient {
  constructor(account, password) {
    this.account = account;
    this.password = password;
    this.accessToken = null;
    this.client = null;
  }

  async login() {
    const encryptedPassword = crypto.createHash('md5').update(this.password).digest('hex');
    
    const headers = {
      'authority': 'teamcnapi.coros.com',
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9',
      'content-type': 'application/json;charset=UTF-8',
      'origin': 'https://t.coros.com',
      'referer': 'https://t.coros.com/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    const data = {
      account: this.account,
      accountType: 2,
      pwd: encryptedPassword,
    };

    try {
      const response = await axios.post(COROS_URLS.LOGIN_URL, data, { headers, timeout: 30000 });
      const respJson = response.data;
      this.accessToken = respJson?.data?.accessToken;

      if (!this.accessToken) {
        throw new Error('COROS login failed: No access token received. Please check your account and password.');
      }

      this.client = axios.create({
        timeout: 240000,
        headers: {
          'accesstoken': this.accessToken,
          'cookie': `CPL-coros-region=2; CPL-coros-token=${this.accessToken}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      return true;
    } catch (error) {
      throw new Error(`COROS login failed: ${error.message}`);
    }
  }

  async fetchActivityIds(onlyRunning = true) {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.');
    }

    const allActivities = [];
    let pageNumber = 1;
    const modeList = onlyRunning ? '100,101,102,103' : '';

    while (true) {
      const url = `${COROS_URLS.ACTIVITY_LIST}?modeList=${modeList}&pageNumber=${pageNumber}&size=20`;
      
      try {
        const response = await this.client.get(url);
        const data = response.data;
        const activities = data?.data?.dataList;

        if (!activities || activities.length === 0) {
          break;
        }

        for (const activity of activities) {
          if (activity.labelId) {
            allActivities.push({
              labelId: activity.labelId,
              sportType: activity.sportType,
              startTime: activity.startTime,
              duration: activity.duration,
              distance: activity.distance,
              name: activity.name || null,
              device: activity.device || null,
              trainingLoad: activity.trainingLoad || null,
            });
          }
        }

        pageNumber++;
      } catch (error) {
        console.error(`Error fetching COROS activities page ${pageNumber}: ${error.message}`);
        break;
      }
    }

    return allActivities;
  }

  async downloadFitFile(labelId, sportType) {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.');
    }

    const url = `${COROS_URLS.DOWNLOAD_URL}?labelId=${labelId}&sportType=${sportType}&fileType=${COROS_FILE_TYPES.fit}`;

    try {
      const response = await this.client.post(url);
      const fileUrl = response.data?.data?.fileUrl;

      if (!fileUrl) {
        return null;
      }

      const fileResponse = await this.client.get(fileUrl, { responseType: 'arraybuffer' });
      return fileResponse.data;
    } catch (error) {
      console.error(`Error downloading COROS FIT file ${labelId}: ${error.message}`);
      return null;
    }
  }

  async checkAuth() {
    try {
      await this.login();
      const activities = await this.fetchActivityIds();
      return activities.length >= 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = CorosClient;
