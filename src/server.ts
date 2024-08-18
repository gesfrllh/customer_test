import express from 'express';
// import bodyParser from 'body-parser';
import authRoutes from './routes/AuthRouters';
import customerRoutes from './routes/CustomerRouters';
import productRoutes from './routes/ProductsRouters'
import dashboardRoutes from './routes/DashboardRoutes'
import resetPassword from './routes/ResetPassword'
import uploadRoutes from './routes/UploadRouters';
import path from 'path';

const cors = require('cors');

const app = express();
const PORT = 8080;

app.use(cors());

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/password', resetPassword)
app.use('/api/uploads', uploadRoutes)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
