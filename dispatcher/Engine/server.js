const express = require('express');
const app = express();
const Controller = require('./Controller');

// Initialize controller in the background
const controller = new Controller();
setInterval(() => controller.processEvents(), 1000);

// Simple health check endpoint
app.get('/', (req, res) => {
    res.status(200).send('OK');
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
}); 