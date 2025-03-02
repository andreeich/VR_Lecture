// Import Express
const express = require("express");
const path = require("path");

// Create Express app
const app = express();

// Serve static files from the current directory
app.use(express.static(__dirname));

// Route for the home page
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "index.html"));
});

// Set the port number
const PORT = 3000;

// Start the server
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
