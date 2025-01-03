const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1310050179784900669/XIBJZdRauQMs_y2F47qxqnV2gZ8gO1vCXf1RgcudqnRAZ8oxQAtvTe02oku1-8HpLceb';

async function sendDiscordMessage(message) {
    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: message,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('Message sent successfully to Discord!');
        return { success: true };
    } catch (error) {
        console.error('Error sending message to Discord:', error);
        throw error;
    }
}

// Export an execute function instead of running immediately
module.exports = {
    execute: async (input) => {
        return await sendDiscordMessage('Hello from the test script! 🚀');
    }
};
