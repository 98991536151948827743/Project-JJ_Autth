import express from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();
import { connectToMongo } from './database/connectMongo.js';

const PORT = process.env.PORT || 3001;

const app = express();
import userRoutes from './routes/route.js';


// Middleware
app.use(morgan('dev'));
app.use(express.json());

// Sample route
app.get('/', (req, res) => {
  res.send('Hello, World!');
});
app.use('/api/users', userRoutes);

// connection to mongoDB
connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on: http://localhost:${PORT}`);
  });
});