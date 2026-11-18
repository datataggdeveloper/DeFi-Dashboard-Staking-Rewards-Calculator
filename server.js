const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Connect Database
// connectDB();

// Init Middleware
app.use(express.json());

// Define Routes
app.use('/api/users', require('./server/routes/api/users'));
app.use('/api/auth', require('./server/routes/api/auth'));
app.use('/api/profile', require('./server/routes/api/profile'));
app.use('/api/posts', require('./server/routes/api/posts'));
app.use('/api/calculate-rewards', require('./server/routes/api/staking'));

// Centralized error handling (must come after all routes)
app.use(require('./server/middleware/errorHandler'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Last-resort guards so a stray async failure is logged instead of killing the process
process.on('unhandledRejection', (reason) =>
  console.error('Unhandled promise rejection:', reason)
);

const PORT = process.env.PORT || 5025;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
