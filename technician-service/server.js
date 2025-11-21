const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoute = require('./routes/technician');

dotenv.config();

const app = express();

// Increase body size for JSON & URL Encoded
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use(cookieParser());

// Enable CORS for frontend origin
app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true              
}));

// Routes
app.use('/api', authRoute);

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Database connected"))
.catch(err => console.log(err));

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Service inventory running on port ${PORT}`);
});

