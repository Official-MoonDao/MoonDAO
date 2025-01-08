const axios = require('axios');

async function getCurrentCycle(space) {
    try {
        const response = await axios.get(`https://api.nance.app/${space}`);
        console.log('Full API Response:', JSON.stringify(response.data, null, 2));
        
        if (!response.data?.data?.currentCycle) {
            console.error('Invalid response structure:', response.data);
            throw new Error('Current cycle not found in response');
        }
        
        return response.data.data.currentCycle;
    } catch (error) {
        console.error('Error fetching current cycle:', error.message);
        throw error;
    }
}

module.exports = getCurrentCycle;
