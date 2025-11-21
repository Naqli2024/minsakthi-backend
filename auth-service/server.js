const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const authRoutes = require("./routes/authRoute");
const userRoutes = require("./routes/userRoute");

dotenv.config();

const app = express();
app.use(express.json());

app.use(cookieParser());

app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  abortOnLimit: true,
}));

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Database connected"))
.catch(err => console.log(err));

// Enable CORS for frontend origin
app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true              
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});

