const {GoogleAuth} = require('google-auth-library');

async function getAuthToken() {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

module.exports = { getAuthToken }; 