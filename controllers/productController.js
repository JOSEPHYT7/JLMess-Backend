const Product = require('../models/Product');

const getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).lean();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).lean();
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createProduct = async (req, res) => {
    try {
        const { name, price, available, image } = req.body;
        const product = new Product({
            name,
            price,
            available: available !== undefined ? available : true,
            image: image || undefined
        });
        const createdProduct = await product.save();

        const io = req.app.get('socketio');
        if (io) io.emit('menuUpdated', createdProduct);

        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const { name, price, available, image } = req.body;
        const product = await Product.findById(req.params.id);

        if (product) {
            product.name = name !== undefined ? name : product.name;
            product.price = price !== undefined ? price : product.price;
            product.available = available !== undefined ? available : product.available;
            product.image = image !== undefined ? image : product.image;

            const updatedProduct = await product.save();

            const io = req.app.get('socketio');
            if (io) io.emit('menuUpdated', updatedProduct);

            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            await Product.deleteOne({ _id: product._id });

            const io = req.app.get('socketio');
            if (io) io.emit('menuUpdated', { _id: product._id, deleted: true });

            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };
