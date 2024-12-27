const getCurrentCycle = require('../Extract/get_current_cycle');

// Replace 'jbdao' with any space name you want to query
const spaceName = 'moondao';

async function run() {
    try {
        const cycle = await getCurrentCycle(spaceName);
        console.log(`Current cycle for ${spaceName}:`, cycle);
    } catch (error) {
        console.error('Failed:', error);
    }
}

run();