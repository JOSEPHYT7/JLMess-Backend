const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Product = require('./models/Product');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const importData = async () => {
    try {
        await User.deleteMany();
        await Product.deleteMany();

        await User.create({
            name: 'Admin User',
            email: 'admin@tiffin.com',
            password: 'password123',
            role: 'admin'
        });

        await User.create({
            name: 'Staff User',
            email: 'staff@tiffin.com',
            password: 'password123',
            role: 'staff'
        });

        const sampleProducts = [
            { name: 'Idly', price: 40, available: true, image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?auto=format&fit=crop&w=500&q=80' },
            { name: 'Dosa', price: 50, available: true, image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=500&q=80' },
            { name: 'Puri', price: 50, available: true, image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=500&q=80' },
            { name: 'Vada', price: 40, available: true, image: 'https://images.unsplash.com/photo-1604242692760-2f8b0e891458?auto=format&fit=crop&w=500&q=80' },
            { name: 'Vuggani Bajji', price: 45, available: true, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80' },
            { name: 'Upma', price: 40, available: true, image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=500&q=80' }
        ];

        await Product.insertMany(sampleProducts);

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

importData();
