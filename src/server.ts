import express from 'express';
// import bodyParser from 'body-parser';
import authRoutes from './routes/AuthRouters';
import customerRoutes from './routes/CustomerRouters';

const cors = require('cors');

const app = express();
const PORT = 6000;

app.use(cors());

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
