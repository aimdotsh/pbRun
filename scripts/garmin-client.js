/**
 * Garmin Connect API client
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class GarminClient {
  constructor(authToken) {
    this.authToken = authToken;
    this.baseUrl = 'https://connectapi.garmin.com';

    // Parse auth token (Base64 encoded JSON array)
    try {
      const decoded = Buffer.from(authToken, 'base64').toString('utf-8');
      const authData = JSON.parse(decoded);

      // authData is [oauth_token_data, oauth2_token_data]
      this.oauthToken = authData[0];
      this.oauth2Token = authData[1];

      this.accessToken = this.oauth2Token.access_token;
    } catch (error) {
      throw new Error(`Failed to parse GARMIN_SECRET_STRING: ${error.message}`);
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 240000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${this.accessToken}`,
        'origin': 'https://sso.garmin.com',
        'nk': 'NT'
      }
    });
  }

  /**
   * Get list of activities
   */
  async getActivities(start = 0, limit = 100) {
    try {
      const url = `/activitylist-service/activities/search/activities?start=${start}&limit=${limit}`;
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching activities: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Download FIT file for an activity
   */
  async downloadFitFile(activityId) {
    try {
      const url = `/download-service/files/activity/${activityId}`;
      const response = await this.client.get(url, {
        responseType: 'arraybuffer'
      });
      return response.data;
    } catch (error) {
      console.error(`Error downloading FIT file for activity ${activityId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if token is valid
   */
  async checkAuth() {
    try {
      await this.getActivities(0, 1);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = GarminClient;
